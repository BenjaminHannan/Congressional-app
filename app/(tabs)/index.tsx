/**
 * Trace — Home Dashboard
 *
 * Overview of the user's current status:
 * - Days tracking
 * - Current risk level
 * - Quick stats
 * - Red flag alerts
 * - Quick actions
 */

import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { getSymptomLogs, getExposure, getProfile } from '@/lib/storage';
import { calculateRisk } from '@/lib/risk-engine';
import { countSymptoms, getRedFlags } from '@/lib/symptoms';
import { getCountyRiskMessage } from '@/lib/nh-data';
import { SymptomLog, ExposureData, UserProfile, RiskAssessment } from '@/lib/types';
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

export default function HomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<SymptomLog[]>([]);
  const [exposure, setExposure] = useState<ExposureData | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    const [p, l, e] = await Promise.all([
      getProfile(),
      getSymptomLogs(),
      getExposure(),
    ]);
    setProfile(p);
    setLogs(l);
    setExposure(e);
    if (l.length > 0 || e) {
      setRisk(calculateRisk(l, e));
    }
  }

  const daysTracking = profile?.startDate
    ? Math.max(
        1,
        Math.ceil(
          (Date.now() - new Date(profile.startDate).getTime()) / (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  const latestLog = logs.length > 0 ? logs[0] : null;
  const hasRedFlags = latestLog ? getRedFlags(latestLog.symptoms).length > 0 : false;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Greeting */}
        <Text style={styles.greeting}>
          {profile?.name ? `Hi ${profile.name}` : 'Welcome back'}
        </Text>

        {/* Red Flag Alert */}
        {hasRedFlags && (
          <TouchableOpacity
            style={styles.redFlagBanner}
            onPress={() => router.push('/red-flag')}
            activeOpacity={0.8}
          >
            <MaterialIcons name="warning" size={24} color={T.white} />
            <View style={styles.redFlagText}>
              <Text style={styles.redFlagTitle}>Red Flag Symptoms Detected</Text>
              <Text style={styles.redFlagDesc}>
                Tap for urgent guidance — some symptoms need immediate care
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={T.white} />
          </TouchableOpacity>
        )}

        {/* Risk Card */}
        {risk && (
          <View style={[styles.riskCard, { backgroundColor: RISK_BG[risk.level] }]}>
            <View style={styles.riskHeader}>
              <Text style={styles.riskLabel}>Current Risk Assessment</Text>
              <View
                style={[
                  styles.riskBadge,
                  { backgroundColor: RISK_COLORS[risk.level] },
                ]}
              >
                <Text style={styles.riskBadgeText}>
                  {risk.level.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.riskScore}>Score: {risk.score}/100</Text>
            <Text style={styles.riskRec} numberOfLines={3}>
              {risk.recommendation}
            </Text>
          </View>
        )}

        {/* Empty state — first-run, before any symptom log or exposure */}
        {!risk && (
          <View style={styles.emptyCard}>
            <MaterialIcons name="add-circle-outline" size={32} color={T.primary} />
            <Text style={styles.emptyTitle}>
              Log your first symptom to start tracking
            </Text>
            <Text style={styles.emptyDesc}>
              Daily check-ins build a dated record you can hand to a doctor —
              the single most convincing piece of evidence for early Lyme.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/check')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Start your first symptom check"
            >
              <MaterialIcons name="fact-check" size={20} color={T.white} />
              <Text style={styles.emptyButtonText}>Start Symptom Check</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{daysTracking}</Text>
            <Text style={styles.statLabel}>Days{'\n'}Tracking</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{logs.length}</Text>
            <Text style={styles.statLabel}>Entries{'\n'}Logged</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {latestLog ? countSymptoms(latestLog.symptoms) : 0}
            </Text>
            <Text style={styles.statLabel}>Active{'\n'}Symptoms</Text>
          </View>
        </View>

        {/* Scan Prompt */}
        <TouchableOpacity
          style={styles.logPrompt}
          onPress={() => router.push('/(tabs)/scan')}
          activeOpacity={0.8}
        >
          <MaterialIcons name="photo-camera" size={28} color={T.primary} />
          <View style={{ marginLeft: T.md, flex: 1 }}>
            <Text style={styles.logPromptTitle}>Scan a Bite or Rash</Text>
            <Text style={styles.logPromptDesc}>
              Take a photo and answer guided questions for assessment
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={T.textMuted} />
        </TouchableOpacity>

        {/* NH Lyme Fact */}
        {exposure?.locationRisk === 'nh' && exposure.county && (
          <View style={styles.factCard}>
            <MaterialIcons name="info" size={20} color={T.primary} />
            <Text style={styles.factText}>
              {getCountyRiskMessage(exposure.county)}
            </Text>
          </View>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/(tabs)/report')}
          activeOpacity={0.7}
        >
          <MaterialIcons name="description" size={24} color={T.primary} />
          <Text style={styles.actionText}>Generate Doctor Report (PDF)</Text>
          <MaterialIcons name="chevron-right" size={20} color={T.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/advocacy')}
          activeOpacity={0.7}
        >
          <MaterialIcons name="record-voice-over" size={24} color={T.primary} />
          <Text style={styles.actionText}>"I was told it's a virus"</Text>
          <MaterialIcons name="chevron-right" size={20} color={T.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/(tabs)/timeline')}
          activeOpacity={0.7}
        >
          <MaterialIcons name="timeline" size={24} color={T.primary} />
          <Text style={styles.actionText}>View Symptom Timeline</Text>
          <MaterialIcons name="chevron-right" size={20} color={T.textMuted} />
        </TouchableOpacity>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Trace is an educational tool, not a diagnostic device.{'\n'}
          Always consult a qualified healthcare provider.{'\n'}
          In an emergency, call 911.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: T.lg, paddingBottom: T.xxl },
  greeting: {
    fontSize: T.fontXl,
    fontWeight: '700',
    color: T.text,
    marginBottom: T.md,
  },
  redFlagBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.danger,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.md,
  },
  redFlagText: { flex: 1, marginLeft: T.sm },
  redFlagTitle: { color: T.white, fontWeight: '700', fontSize: T.fontMd },
  redFlagDesc: { color: 'rgba(255,255,255,0.85)', fontSize: T.fontXs, marginTop: 2 },
  riskCard: {
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.md,
  },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: T.sm,
  },
  riskLabel: { fontSize: T.fontSm, fontWeight: '600', color: T.text },
  riskBadge: {
    paddingHorizontal: T.md,
    paddingVertical: T.xs,
    borderRadius: T.radiusFull,
  },
  riskBadgeText: { color: T.white, fontWeight: '700', fontSize: T.fontXs },
  riskScore: { fontSize: T.fontXs, color: T.textSecondary, marginBottom: T.xs },
  riskRec: { fontSize: T.fontSm, color: T.text, lineHeight: 20 },
  emptyCard: {
    backgroundColor: T.primaryFaint,
    borderRadius: T.radius,
    padding: T.lg,
    marginBottom: T.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.primaryLight,
  },
  emptyTitle: {
    fontSize: T.fontLg,
    fontWeight: '700',
    color: T.text,
    marginTop: T.sm,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    textAlign: 'center',
    marginTop: T.sm,
    marginBottom: T.md,
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
  },
  emptyButtonText: {
    color: T.white,
    fontSize: T.fontMd,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: T.sm,
    marginBottom: T.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.border,
  },
  statNumber: { fontSize: T.fontXxl, fontWeight: '700', color: T.primaryDark },
  statLabel: {
    fontSize: T.fontXs,
    color: T.textSecondary,
    textAlign: 'center',
    marginTop: T.xs,
  },
  logPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.primaryFaint,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.md,
    borderWidth: 1,
    borderColor: T.primaryLight,
  },
  logPromptTitle: { fontSize: T.fontMd, fontWeight: '600', color: T.primaryDark },
  logPromptDesc: { fontSize: T.fontXs, color: T.textSecondary, marginTop: 2 },
  factCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: T.primaryFaint,
    borderRadius: T.radiusSm,
    padding: T.md,
    marginBottom: T.md,
    gap: T.sm,
  },
  factText: { flex: 1, fontSize: T.fontSm, color: T.textSecondary, lineHeight: 20 },
  sectionTitle: {
    fontSize: T.fontMd,
    fontWeight: '700',
    color: T.text,
    marginBottom: T.sm,
    marginTop: T.sm,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.sm,
    borderWidth: 1,
    borderColor: T.border,
  },
  actionText: {
    flex: 1,
    marginLeft: T.md,
    fontSize: T.fontMd,
    fontWeight: '500',
    color: T.text,
  },
  disclaimer: {
    fontSize: T.fontXs,
    color: T.textMuted,
    textAlign: 'center',
    marginTop: T.lg,
    lineHeight: 18,
  },
});
