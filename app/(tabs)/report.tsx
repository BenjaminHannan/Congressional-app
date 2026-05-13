/**
 * Trace — Report Screen
 *
 * Risk assessment summary + Doctor-ready PDF generation.
 * The killer feature of Trace.
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { getSymptomLogs, getExposure, getProfile } from '@/lib/storage';
import { calculateRisk } from '@/lib/risk-engine';
import { generateAndSharePDF } from '@/lib/pdf-generator';
import { RiskAssessment, SymptomLog, ExposureData } from '@/lib/types';
import { T } from '@/lib/theme';

const RISK_COLORS = {
  low: T.success,
  moderate: T.warning,
  high: T.danger,
  critical: T.danger,
};

const RISK_BG = {
  low: T.successBg,
  moderate: T.warningBg,
  high: T.dangerBg,
  critical: T.dangerBg,
};

const RISK_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  low: 'check-circle',
  moderate: 'info',
  high: 'warning',
  critical: 'error',
};

export default function ReportScreen() {
  const router = useRouter();
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [logs, setLogs] = useState<SymptomLog[]>([]);
  const [exposure, setExposure] = useState<ExposureData | null>(null);
  const [name, setName] = useState('');
  const [generating, setGenerating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    const [l, e, p] = await Promise.all([
      getSymptomLogs(),
      getExposure(),
      getProfile(),
    ]);
    setLogs(l);
    setExposure(e);
    setName(p?.name || '');
    if (l.length > 0 || e) {
      setRisk(calculateRisk(l, e));
    }
  }

  async function handleGeneratePDF() {
    if (!risk) return;
    setGenerating(true);
    try {
      await generateAndSharePDF(logs, exposure, risk, name);
    } catch (err) {
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  if (!risk) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="assessment" size={64} color={T.primary} />
          <Text style={styles.emptyTitle}>Log your first symptom to start tracking</Text>
          <Text style={styles.emptyDesc}>
            The Doctor Report becomes available once you have at least one
            symptom log or completed exposure assessment. It's the most
            convincing thing you can bring to an appointment.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)/check')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Start symptom check"
          >
            <MaterialIcons name="fact-check" size={20} color={T.white} />
            <Text style={styles.emptyButtonText}>Start Symptom Check</Text>
          </TouchableOpacity>
          {!exposure && (
            <TouchableOpacity
              style={styles.emptySecondary}
              onPress={() => router.push('/exposure-form')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Fill out exposure assessment"
            >
              <Text style={styles.emptySecondaryText}>
                Or fill out the exposure assessment first
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Risk Summary Card */}
        <View style={[styles.riskCard, { backgroundColor: RISK_BG[risk.level] }]}>
          <View style={styles.riskIconRow}>
            <MaterialIcons
              name={RISK_ICONS[risk.level]}
              size={40}
              color={RISK_COLORS[risk.level]}
            />
            <View style={styles.riskTextArea}>
              <Text style={styles.riskLevelText}>
                {risk.level.charAt(0).toUpperCase() + risk.level.slice(1)} Risk
              </Text>
              <Text style={styles.riskScoreText}>
                Score: {risk.score}/100
              </Text>
            </View>
          </View>
          <Text style={styles.riskRec}>{risk.recommendation}</Text>
        </View>

        {/* Red Flags */}
        {risk.redFlags.length > 0 && (
          <View style={styles.redFlagSection}>
            <Text style={styles.sectionTitle}>
              <MaterialIcons name="error" size={18} color={T.danger} /> Active
              Red Flags
            </Text>
            {risk.redFlags.map((flag, i) => (
              <View key={i} style={styles.redFlagItem}>
                <MaterialIcons name="warning" size={16} color={T.danger} />
                <Text style={styles.redFlagText}>{flag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Contributing Factors */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contributing Factors</Text>
          {risk.factors.map((factor, i) => (
            <View key={i} style={styles.factorRow}>
              <MaterialIcons
                name="arrow-right"
                size={16}
                color={T.primary}
              />
              <Text style={styles.factorText}>{factor}</Text>
            </View>
          ))}
        </View>

        {/* Data Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Data</Text>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Symptom entries:</Text>
            <Text style={styles.dataValue}>{logs.length}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Exposure data:</Text>
            <Text style={styles.dataValue}>
              {exposure ? 'Completed' : 'Not yet filled'}
            </Text>
          </View>
          {exposure?.county && (
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>County:</Text>
              <Text style={styles.dataValue}>
                {exposure.county}, NH
              </Text>
            </View>
          )}
        </View>

        {/* Generate PDF Button */}
        <TouchableOpacity
          style={styles.pdfButton}
          onPress={handleGeneratePDF}
          disabled={generating}
          activeOpacity={0.8}
        >
          {generating ? (
            <ActivityIndicator color={T.white} />
          ) : (
            <MaterialIcons name="picture-as-pdf" size={24} color={T.white} />
          )}
          <Text style={styles.pdfButtonText}>
            {generating ? 'Generating...' : 'Generate Doctor Report (PDF)'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.pdfHint}>
          Creates a professional PDF you can share with your doctor.{'\n'}
          Includes symptom timeline, exposure context, and suggested questions.
        </Text>

        {/* Advocacy Link */}
        <TouchableOpacity
          style={styles.advocacyCard}
          onPress={() => router.push('/advocacy')}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="record-voice-over"
            size={24}
            color={T.primaryDark}
          />
          <View style={styles.advocacyTextArea}>
            <Text style={styles.advocacyTitle}>
              "I was told it's a virus"
            </Text>
            <Text style={styles.advocacyDesc}>
              Evidence-based language to advocate for yourself at the doctor's
              office
            </Text>
          </View>
          <MaterialIcons
            name="chevron-right"
            size={20}
            color={T.textMuted}
          />
        </TouchableOpacity>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          This assessment is based on symptom patterns and exposure data you
          provided, interpreted through publicly available CDC and IDSA
          guidelines. It is not a medical diagnosis. Always consult a qualified
          healthcare provider for clinical decisions.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: T.lg, paddingBottom: T.xxl },
  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: T.xxl,
  },
  emptyTitle: {
    fontSize: T.fontLg,
    fontWeight: '600',
    color: T.text,
    marginTop: T.md,
  },
  emptyDesc: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    textAlign: 'center',
    marginTop: T.sm,
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primary,
    borderRadius: T.radius,
    paddingHorizontal: T.lg,
    paddingVertical: T.md,
    gap: T.sm,
    marginTop: T.lg,
  },
  emptyButtonText: {
    color: T.white,
    fontSize: T.fontMd,
    fontWeight: '600',
  },
  emptySecondary: {
    marginTop: T.md,
    padding: T.sm,
  },
  emptySecondaryText: {
    color: T.primary,
    fontSize: T.fontSm,
    fontWeight: '500',
  },
  // Risk card
  riskCard: {
    borderRadius: T.radiusLg,
    padding: T.lg,
    marginBottom: T.md,
  },
  riskIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: T.md,
    gap: T.md,
  },
  riskTextArea: {},
  riskLevelText: {
    fontSize: T.fontXl,
    fontWeight: '700',
    color: T.text,
  },
  riskScoreText: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    marginTop: 2,
  },
  riskRec: {
    fontSize: T.fontSm,
    color: T.text,
    lineHeight: 22,
  },
  // Red flags
  redFlagSection: {
    backgroundColor: T.dangerBg,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.md,
    borderWidth: 1,
    borderColor: T.dangerLight,
  },
  redFlagItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.sm,
    marginTop: T.sm,
  },
  redFlagText: {
    flex: 1,
    fontSize: T.fontSm,
    color: T.danger,
    lineHeight: 20,
  },
  // Sections
  section: {
    marginBottom: T.md,
  },
  sectionTitle: {
    fontSize: T.fontMd,
    fontWeight: '700',
    color: T.text,
    marginBottom: T.sm,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.sm,
    marginBottom: T.sm,
  },
  factorText: {
    flex: 1,
    fontSize: T.fontSm,
    color: T.textSecondary,
    lineHeight: 20,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: T.sm,
    borderBottomWidth: 1,
    borderBottomColor: T.borderLight,
  },
  dataLabel: {
    fontSize: T.fontSm,
    color: T.textSecondary,
  },
  dataValue: {
    fontSize: T.fontSm,
    fontWeight: '600',
    color: T.text,
  },
  // PDF button
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primary,
    borderRadius: T.radius,
    padding: T.md,
    marginTop: T.md,
    gap: T.sm,
  },
  pdfButtonText: {
    color: T.white,
    fontSize: T.fontLg,
    fontWeight: '600',
  },
  pdfHint: {
    fontSize: T.fontXs,
    color: T.textMuted,
    textAlign: 'center',
    marginTop: T.sm,
    lineHeight: 18,
    marginBottom: T.lg,
  },
  // Advocacy
  advocacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.primaryFaint,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.lg,
    borderWidth: 1,
    borderColor: T.primaryLight,
  },
  advocacyTextArea: {
    flex: 1,
    marginLeft: T.md,
  },
  advocacyTitle: {
    fontSize: T.fontMd,
    fontWeight: '600',
    color: T.primaryDark,
  },
  advocacyDesc: {
    fontSize: T.fontXs,
    color: T.textSecondary,
    marginTop: 2,
  },
  // Disclaimer
  disclaimer: {
    fontSize: T.fontXs,
    color: T.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
