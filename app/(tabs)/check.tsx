/**
 * Trace — Symptom Checker
 *
 * Quick "How are you feeling right now?" assessment.
 * Tap symptoms → rate severity → get instant risk result.
 * Saves to storage so Report / Timeline / PDF can use it.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SYMPTOMS, EMPTY_SYMPTOMS, getRedFlags, countSymptoms } from '@/lib/symptoms';
import { SymptomChecks } from '@/lib/types';
import { saveSymptomLog, generateId, getExposure, getSymptomLogs } from '@/lib/storage';
import { calculateRisk } from '@/lib/risk-engine';
import { T } from '@/lib/theme';
import { Citations } from '@/components/citations';
import {
  extractSymptoms,
  mergeSymptoms,
  SymptomMatch,
} from '@/lib/ml/symptom-extractor';

type Step = 'symptoms' | 'severity' | 'result';

const RISK_COLORS = {
  low: T.success,
  moderate: T.warning,
  high: T.danger,
  critical: T.danger,
};

const RISK_ICONS: Record<string, string> = {
  low: 'check-circle',
  moderate: 'info',
  high: 'warning',
  critical: 'error',
};

export default function CheckScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('symptoms');
  const [symptoms, setSymptoms] = useState<SymptomChecks>({ ...EMPTY_SYMPTOMS });
  const [severity, setSeverity] = useState(5);
  const [notes, setNotes] = useState('');
  const [extractedMatches, setExtractedMatches] = useState<SymptomMatch[]>([]);
  const [result, setResult] = useState<{
    level: string;
    score: number;
    factors: string[];
    redFlags: string[];
    recommendation: string;
  } | null>(null);

  function toggleSymptom(key: keyof SymptomChecks) {
    setSymptoms((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleNext() {
    const count = countSymptoms(symptoms);
    if (count === 0) {
      Alert.alert('No Symptoms Selected', 'Tap the symptoms you\'re experiencing, or press Skip if you feel fine.');
      return;
    }

    // Check for red flags immediately
    const flags = getRedFlags(symptoms);
    if (flags.length > 0) {
      router.push('/red-flag');
    }

    setStep('severity');
  }

  async function handleFinish() {
    // Save the log entry
    const today = new Date().toISOString().slice(0, 10);
    await saveSymptomLog({
      id: generateId(),
      date: today,
      timestamp: new Date().toISOString(),
      symptoms,
      severity,
      notes: notes.trim(),
    });

    // Calculate risk with all data
    const [logs, exposure] = await Promise.all([
      getSymptomLogs(),
      getExposure(),
    ]);
    const risk = calculateRisk(logs, exposure);
    setResult(risk);
    setStep('result');
  }

  function reset() {
    setStep('symptoms');
    setSymptoms({ ...EMPTY_SYMPTOMS });
    setSeverity(5);
    setNotes('');
    setResult(null);
    setExtractedMatches([]);
  }

  /**
   * Run the rule-based symptom extractor on the user's free-text notes.
   * Toggles matched symptoms on (or off if negated) and shows a chip row
   * with the phrases that triggered each match — so the user can sanity
   * check the NLP rather than blindly trusting it.
   */
  function handleExtractFromNotes() {
    const trimmed = notes.trim();
    if (trimmed.length === 0) {
      Alert.alert(
        'Voice note is empty',
        'Type or dictate a description first (use your phone keyboard\'s mic button for voice).',
      );
      return;
    }
    const { symptoms: extracted, matches } = extractSymptoms(trimmed);

    // Apply matches: turn ON positives, turn OFF explicit negations.
    const next: SymptomChecks = mergeSymptoms(symptoms, extracted);
    for (const m of matches) {
      if (m.negated) next[m.symptom] = false;
    }
    setSymptoms(next);
    setExtractedMatches(matches);

    if (matches.length === 0) {
      Alert.alert(
        'No symptoms found',
        'The extractor didn\'t recognize any symptoms in your note. You can still tap them manually above.',
      );
    }
  }

  const activeCount = countSymptoms(symptoms);

  // ─── Step 1: Symptom Selection ──────────────────────────────────────────
  if (step === 'symptoms') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>How are you feeling?</Text>
          <Text style={styles.subtitle}>
            Tap every symptom you're experiencing right now.
          </Text>

          {/* Regular symptoms */}
          <View style={styles.grid}>
            {SYMPTOMS.filter((s) => !s.isRedFlag).map((s) => {
              const active = symptoms[s.key];
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.symptomCard, active && styles.symptomCardActive]}
                  onPress={() => toggleSymptom(s.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.symptomLabel, active && styles.symptomLabelActive]}>
                    {s.label}
                  </Text>
                  <Text style={[styles.symptomDesc, active && styles.symptomDescActive]} numberOfLines={2}>
                    {s.description}
                  </Text>
                  {active && (
                    <View style={styles.checkBadge}>
                      <MaterialIcons name="check" size={14} color={T.white} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Red flag section */}
          <Text style={styles.redFlagHeader}>
            ⚠️ Urgent Symptoms
          </Text>
          <Text style={styles.redFlagSubtext}>
            These may need emergency care — tap if you're experiencing any.
          </Text>

          {SYMPTOMS.filter((s) => s.isRedFlag).map((s) => {
            const active = symptoms[s.key];
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.redFlagCard, active && styles.redFlagCardActive]}
                onPress={() => toggleSymptom(s.key)}
                activeOpacity={0.7}
              >
                <View style={styles.redFlagRow}>
                  <MaterialIcons
                    name="warning"
                    size={20}
                    color={active ? T.white : T.danger}
                  />
                  <View style={{ flex: 1, marginLeft: T.sm }}>
                    <Text style={[styles.redFlagLabel, active && styles.redFlagLabelActive]}>
                      {s.label}
                    </Text>
                    <Text style={[styles.redFlagDesc, active && styles.redFlagDescActive]}>
                      {s.description}
                    </Text>
                  </View>
                  {active && (
                    <MaterialIcons name="check-circle" size={22} color={T.white} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Bottom actions */}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={[styles.nextButton, activeCount === 0 && styles.nextButtonDisabled]}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>
                {activeCount > 0
                  ? `Continue with ${activeCount} symptom${activeCount !== 1 ? 's' : ''}`
                  : 'Select symptoms above'}
              </Text>
              <MaterialIcons name="arrow-forward" size={20} color={T.white} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => {
                Alert.alert('No Symptoms', 'Great! If you start feeling unwell, come back and check your symptoms.');
              }}
            >
              <Text style={styles.skipText}>I feel fine today</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Step 2: Severity + Notes ───────────────────────────────────────────
  if (step === 'severity') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity style={styles.backRow} onPress={() => setStep('symptoms')}>
            <MaterialIcons name="arrow-back" size={20} color={T.textSecondary} />
            <Text style={styles.backText}>Back to symptoms</Text>
          </TouchableOpacity>

          <Text style={styles.title}>How bad is it?</Text>
          <Text style={styles.subtitle}>
            Rate your overall severity from 1 (barely noticeable) to 10 (worst ever).
          </Text>

          {/* Severity selector */}
          <View style={styles.severityRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
              const isSelected = severity === n;
              const bg = n <= 3 ? T.success : n <= 6 ? T.warning : T.danger;
              return (
                <TouchableOpacity
                  key={n}
                  style={[
                    styles.severityDot,
                    isSelected && { backgroundColor: bg, borderColor: bg },
                  ]}
                  onPress={() => setSeverity(n)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Severity ${n} of 10`}
                >
                  <Text
                    style={[
                      styles.severityNum,
                      isSelected && styles.severityNumActive,
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.severityLabels}>
            <Text style={styles.severityLabelText}>Mild</Text>
            <Text style={styles.severityLabelText}>Severe</Text>
          </View>

          {/* Selected symptoms summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Selected Symptoms</Text>
            <View style={styles.chipWrap}>
              {SYMPTOMS.filter((s) => symptoms[s.key]).map((s) => (
                <View
                  key={s.key}
                  style={[styles.chip, s.isRedFlag && styles.chipDanger]}
                >
                  <Text style={[styles.chipText, s.isRedFlag && styles.chipTextDanger]}>
                    {s.label}
                    {s.isRedFlag ? ' ⚠️' : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Notes + symptom extraction */}
          <View style={styles.notesHeaderRow}>
            <Text style={styles.notesLabel}>Voice note (optional)</Text>
            <Text style={styles.notesHint}>
              Tap the mic on your phone keyboard to dictate
            </Text>
          </View>
          <TextInput
            style={styles.notesInput}
            placeholder="e.g., I have a bad headache and my joints ache. No fever."
            placeholderTextColor={T.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={styles.extractButton}
            onPress={handleExtractFromNotes}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Extract symptoms from voice note"
          >
            <MaterialIcons name="auto-fix-high" size={18} color={T.primary} />
            <Text style={styles.extractButtonText}>
              Extract symptoms from note
            </Text>
          </TouchableOpacity>

          {extractedMatches.length > 0 && (
            <View style={styles.extractedBox}>
              <Text style={styles.extractedTitle}>
                Extracted {extractedMatches.length} mention
                {extractedMatches.length === 1 ? '' : 's'}:
              </Text>
              <View style={styles.extractedChips}>
                {extractedMatches.map((m, i) => (
                  <View
                    key={i}
                    style={[
                      styles.extractedChip,
                      m.negated && styles.extractedChipNegated,
                    ]}
                  >
                    <MaterialIcons
                      name={m.negated ? 'remove-circle' : 'check-circle'}
                      size={12}
                      color={m.negated ? T.textMuted : T.primary}
                    />
                    <Text
                      style={[
                        styles.extractedChipText,
                        m.negated && styles.extractedChipTextNegated,
                      ]}
                    >
                      {m.phrase}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.extractedNote}>
                Rule-based NLP, runs on-device. Review the toggles above —
                you can override any extraction before submitting.
              </Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleFinish}
            activeOpacity={0.8}
          >
            <MaterialIcons name="assessment" size={22} color={T.white} />
            <Text style={styles.submitText}>Get My Assessment</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Step 3: Results ────────────────────────────────────────────────────
  if (step === 'result' && result) {
    const color = RISK_COLORS[result.level as keyof typeof RISK_COLORS] || T.textMuted;
    const icon = RISK_ICONS[result.level] || 'info';

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Risk level header */}
          <View style={[styles.resultHeader, { backgroundColor: color }]}>
            <MaterialIcons name={icon as any} size={48} color={T.white} />
            <Text style={styles.resultLevel}>
              {result.level.toUpperCase()} RISK
            </Text>
            <Text style={styles.resultScore}>Score: {result.score}/100</Text>
          </View>

          {/* Recommendation */}
          <View style={styles.recCard}>
            <Text style={styles.recTitle}>What This Means</Text>
            <Text style={styles.recText}>{result.recommendation}</Text>
            <Citations />
          </View>

          {/* Contributing factors */}
          {result.factors.length > 0 && (
            <View style={styles.factorsCard}>
              <Text style={styles.factorsTitle}>Contributing Factors</Text>
              {result.factors.map((f, i) => (
                <View key={i} style={styles.factorRow}>
                  <MaterialIcons name="chevron-right" size={16} color={T.primary} />
                  <Text style={styles.factorText}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Red flags */}
          {result.redFlags.length > 0 && (
            <View style={styles.redFlagsResult}>
              <Text style={styles.redFlagsTitle}>⚠️ Red Flags Detected</Text>
              {result.redFlags.map((f, i) => (
                <Text key={i} style={styles.redFlagResultText}>{f}</Text>
              ))}
            </View>
          )}

          {/* Actions */}
          <TouchableOpacity
            style={styles.reportButton}
            onPress={() => {
              reset();
              setTimeout(() => router.push('/(tabs)/report'), 100);
            }}
            activeOpacity={0.8}
          >
            <MaterialIcons name="description" size={20} color={T.white} />
            <Text style={styles.reportButtonText}>Generate Doctor Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkAgainButton}
            onPress={reset}
            activeOpacity={0.8}
          >
            <Text style={styles.checkAgainText}>Check Again</Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            This assessment is educational, not diagnostic. It is based on
            publicly available CDC and IDSA clinical criteria. Only a healthcare
            provider can diagnose Lyme disease. In an emergency, call 911.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: T.lg, paddingBottom: T.xxl },

  title: {
    fontSize: T.fontXl,
    fontWeight: '700',
    color: T.text,
    marginBottom: T.xs,
  },
  subtitle: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    marginBottom: T.lg,
    lineHeight: 20,
  },

  // Symptom grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.sm,
    marginBottom: T.lg,
  },
  symptomCard: {
    width: '47%',
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.md,
    borderWidth: 1.5,
    borderColor: T.border,
    minHeight: 80,
    position: 'relative',
  },
  symptomCardActive: {
    borderColor: T.primary,
    backgroundColor: T.primaryFaint,
  },
  symptomLabel: {
    fontSize: T.fontMd,
    fontWeight: '600',
    color: T.text,
    marginBottom: 4,
  },
  symptomLabelActive: {
    color: T.primaryDark,
  },
  symptomDesc: {
    fontSize: 11,
    color: T.textMuted,
    lineHeight: 15,
  },
  symptomDescActive: {
    color: T.textSecondary,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: T.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Red flag symptoms
  redFlagHeader: {
    fontSize: T.fontMd,
    fontWeight: '700',
    color: T.danger,
    marginBottom: T.xs,
  },
  redFlagSubtext: {
    fontSize: T.fontXs,
    color: T.textSecondary,
    marginBottom: T.sm,
  },
  redFlagCard: {
    backgroundColor: T.dangerBg,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.sm,
    borderWidth: 1.5,
    borderColor: T.dangerLight,
  },
  redFlagCardActive: {
    backgroundColor: T.danger,
    borderColor: T.danger,
  },
  redFlagRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  redFlagLabel: {
    fontSize: T.fontMd,
    fontWeight: '600',
    color: T.danger,
  },
  redFlagLabelActive: {
    color: T.white,
  },
  redFlagDesc: {
    fontSize: T.fontXs,
    color: T.textSecondary,
    marginTop: 2,
  },
  redFlagDescActive: {
    color: 'rgba(255,255,255,0.85)',
  },

  // Bottom actions
  bottomActions: {
    marginTop: T.lg,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primary,
    borderRadius: T.radius,
    padding: T.md,
    gap: T.sm,
  },
  nextButtonDisabled: {
    backgroundColor: T.textMuted,
  },
  nextButtonText: {
    color: T.white,
    fontSize: T.fontMd,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    padding: T.md,
    marginTop: T.xs,
  },
  skipText: {
    color: T.textSecondary,
    fontSize: T.fontSm,
  },

  // Back row
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.xs,
    marginBottom: T.md,
    padding: T.xs,
  },
  backText: {
    fontSize: T.fontSm,
    color: T.textSecondary,
  },

  // Severity
  severityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: T.xs,
  },
  severityDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: T.border,
    backgroundColor: T.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  severityNum: {
    fontSize: T.fontSm,
    fontWeight: '600',
    color: T.textSecondary,
  },
  severityNumActive: {
    color: T.white,
  },
  severityLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: T.lg,
  },
  severityLabelText: {
    fontSize: T.fontXs,
    color: T.textMuted,
  },

  // Summary
  summaryCard: {
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.md,
    borderWidth: 1,
    borderColor: T.border,
  },
  summaryTitle: {
    fontSize: T.fontSm,
    fontWeight: '600',
    color: T.text,
    marginBottom: T.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.xs,
  },
  chip: {
    backgroundColor: T.primaryFaint,
    paddingHorizontal: T.sm,
    paddingVertical: T.xs,
    borderRadius: T.radiusFull,
  },
  chipDanger: {
    backgroundColor: T.dangerBg,
  },
  chipText: {
    fontSize: T.fontXs,
    fontWeight: '600',
    color: T.primaryDark,
  },
  chipTextDanger: {
    color: T.danger,
  },

  // Notes
  notesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: T.xs,
  },
  notesLabel: {
    fontSize: T.fontSm,
    fontWeight: '600',
    color: T.text,
  },
  notesHint: {
    fontSize: 10,
    color: T.textMuted,
    fontStyle: 'italic',
  },
  notesInput: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radiusSm,
    padding: T.md,
    fontSize: T.fontSm,
    color: T.text,
    minHeight: 80,
    marginBottom: T.sm,
  },
  extractButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.xs,
    backgroundColor: T.primaryFaint,
    borderRadius: T.radiusSm,
    paddingVertical: T.sm,
    borderWidth: 1,
    borderColor: T.primaryLight,
    marginBottom: T.md,
  },
  extractButtonText: {
    color: T.primaryDark,
    fontWeight: '700',
    fontSize: T.fontSm,
  },
  extractedBox: {
    backgroundColor: T.bg,
    borderRadius: T.radiusSm,
    padding: T.sm,
    marginBottom: T.lg,
    borderWidth: 1,
    borderColor: T.border,
  },
  extractedTitle: {
    fontSize: T.fontXs,
    fontWeight: '700',
    color: T.text,
    marginBottom: T.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  extractedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: T.xs,
  },
  extractedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: T.primaryFaint,
    paddingHorizontal: T.sm,
    paddingVertical: 4,
    borderRadius: T.radiusFull,
  },
  extractedChipNegated: {
    backgroundColor: T.border,
  },
  extractedChipText: {
    fontSize: 11,
    color: T.primaryDark,
    fontWeight: '600',
  },
  extractedChipTextNegated: {
    color: T.textMuted,
    textDecorationLine: 'line-through',
  },
  extractedNote: {
    fontSize: 10,
    color: T.textMuted,
    lineHeight: 14,
    fontStyle: 'italic',
  },

  // Submit
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primary,
    borderRadius: T.radius,
    padding: T.md,
    gap: T.sm,
  },
  submitText: {
    color: T.white,
    fontSize: T.fontLg,
    fontWeight: '600',
  },

  // Results
  resultHeader: {
    alignItems: 'center',
    borderRadius: T.radius,
    padding: T.xl,
    marginBottom: T.md,
  },
  resultLevel: {
    fontSize: T.fontXl,
    fontWeight: '800',
    color: T.white,
    marginTop: T.sm,
    letterSpacing: 1,
  },
  resultScore: {
    fontSize: T.fontSm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: T.xs,
  },

  recCard: {
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.lg,
    marginBottom: T.md,
    borderWidth: 1,
    borderColor: T.border,
  },
  recTitle: {
    fontSize: T.fontMd,
    fontWeight: '700',
    color: T.text,
    marginBottom: T.sm,
  },
  recText: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    lineHeight: 22,
  },

  factorsCard: {
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.md,
    borderWidth: 1,
    borderColor: T.border,
  },
  factorsTitle: {
    fontSize: T.fontMd,
    fontWeight: '700',
    color: T.text,
    marginBottom: T.sm,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: T.xs,
    gap: T.xs,
  },
  factorText: {
    flex: 1,
    fontSize: T.fontSm,
    color: T.textSecondary,
    lineHeight: 20,
  },

  redFlagsResult: {
    backgroundColor: T.dangerBg,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.md,
    borderWidth: 1,
    borderColor: T.dangerLight,
  },
  redFlagsTitle: {
    fontSize: T.fontMd,
    fontWeight: '700',
    color: T.danger,
    marginBottom: T.sm,
  },
  redFlagResultText: {
    fontSize: T.fontSm,
    color: T.text,
    lineHeight: 20,
    marginBottom: T.sm,
  },

  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.primary,
    borderRadius: T.radius,
    padding: T.md,
    gap: T.sm,
    marginBottom: T.sm,
  },
  reportButtonText: {
    color: T.white,
    fontSize: T.fontMd,
    fontWeight: '600',
  },
  checkAgainButton: {
    alignItems: 'center',
    padding: T.md,
  },
  checkAgainText: {
    color: T.textSecondary,
    fontSize: T.fontMd,
  },
  disclaimer: {
    fontSize: T.fontXs,
    color: T.textMuted,
    textAlign: 'center',
    marginTop: T.md,
    lineHeight: 18,
  },
});
