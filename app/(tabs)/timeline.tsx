/**
 * Trace — Symptom Timeline
 *
 * Vertical timeline showing all logged symptom entries.
 * Newest first. Color-coded by severity.
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
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { getSymptomLogs, deleteSymptomLog } from '@/lib/storage';
import { SYMPTOMS } from '@/lib/symptoms';
import { SymptomLog } from '@/lib/types';
import { T } from '@/lib/theme';
import { predictFromLogs, TemporalPrediction } from '@/lib/ml/symptom-progression';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getSeverityColor(severity: number): string {
  if (severity >= 7) return T.danger;
  if (severity >= 4) return T.warning;
  return T.success;
}

function getActiveSymptomLabels(log: SymptomLog): string[] {
  return SYMPTOMS.filter((s) => log.symptoms[s.key]).map((s) => s.label);
}

/**
 * Sparkline of the trajectory model's per-day Lyme probability. Rendered
 * with vanilla RN Views (no svg lib needed). Bars are color-graded against
 * the same warning/danger palette the rest of the app uses, so a climbing
 * trajectory reads as red at a glance.
 */
function TrajectorySparkline({ pred }: { pred: TemporalPrediction }) {
  const ps = pred.perDayProbabilities;
  if (ps.length === 0) return null;

  const maxBars = 14;
  const bars = ps.length > maxBars ? ps.slice(-maxBars) : ps;

  function barColor(p: number): string {
    if (p >= 0.7) return T.danger;
    if (p >= 0.4) return T.warning;
    return T.success;
  }

  const latestPct = Math.round(pred.latest * 100);
  const trendPct = Math.round(pred.trend * 100);
  const trendIsUp = pred.trend >= 0;

  return (
    <View style={sparkStyles.card}>
      <View style={sparkStyles.headerRow}>
        <MaterialIcons name="timeline" size={16} color={T.primary} />
        <Text style={sparkStyles.title}>Trajectory Model</Text>
        <View style={sparkStyles.trendBadge}>
          <MaterialIcons
            name={trendIsUp ? 'trending-up' : 'trending-down'}
            size={12}
            color={trendIsUp ? T.danger : T.success}
          />
          <Text
            style={[
              sparkStyles.trendText,
              { color: trendIsUp ? T.danger : T.success },
            ]}
          >
            {trendIsUp ? '+' : ''}
            {trendPct}%
          </Text>
        </View>
      </View>

      <Text style={sparkStyles.metric}>{latestPct}%</Text>
      <Text style={sparkStyles.metricLabel}>
        GRU probability that this trajectory matches Lyme progression
      </Text>

      <View style={sparkStyles.barRow}>
        {bars.map((p, i) => (
          <View
            key={i}
            style={[
              sparkStyles.bar,
              {
                height: Math.max(4, Math.round(p * 56)),
                backgroundColor: barColor(p),
              },
            ]}
          />
        ))}
      </View>
      <View style={sparkStyles.axisRow}>
        <Text style={sparkStyles.axisText}>oldest</Text>
        <Text style={sparkStyles.axisText}>today</Text>
      </View>
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  card: {
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.md,
    borderWidth: 1,
    borderColor: T.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: T.fontXs,
    fontWeight: '700',
    color: T.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: T.xs,
    paddingVertical: 2,
    borderRadius: T.radiusFull,
    backgroundColor: T.bg,
  },
  trendText: {
    fontSize: T.fontXs,
    fontWeight: '700',
  },
  metric: {
    fontSize: 32,
    fontWeight: '800',
    color: T.text,
    lineHeight: 36,
    marginTop: 4,
  },
  metricLabel: {
    fontSize: T.fontXs,
    color: T.textSecondary,
    lineHeight: 16,
    marginBottom: T.sm,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 60,
    gap: 3,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 4,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  axisText: {
    fontSize: 10,
    color: T.textMuted,
  },
});

export default function TimelineScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<SymptomLog[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [])
  );

  async function loadLogs() {
    const data = await getSymptomLogs();
    setLogs(data);
  }

  function handleDelete(log: SymptomLog) {
    Alert.alert(
      'Delete Entry',
      `Remove the log from ${formatDate(log.date)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSymptomLog(log.id);
            await loadLogs();
          },
        },
      ]
    );
  }

  if (logs.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="timeline" size={64} color={T.primary} />
          <Text style={styles.emptyTitle}>Log your first symptom to start tracking</Text>
          <Text style={styles.emptyDesc}>
            A dated record of how you feel is the most useful thing you can bring
            to a doctor's appointment. Daily check-ins take under a minute.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)/check')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open symptom check"
          >
            <MaterialIcons name="fact-check" size={20} color={T.white} />
            <Text style={styles.emptyButtonText}>Start Symptom Check</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const trajectoryPred = predictFromLogs(logs);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {trajectoryPred && <TrajectorySparkline pred={trajectoryPred} />}

        <Text style={styles.summary}>
          {logs.length} {logs.length === 1 ? 'entry' : 'entries'} logged
        </Text>

        {logs.map((log, index) => {
          const symptomLabels = getActiveSymptomLabels(log);
          const severityColor = getSeverityColor(log.severity);
          const isLast = index === logs.length - 1;

          return (
            <View key={log.id} style={styles.entryRow}>
              {/* Timeline bar */}
              <View style={styles.timelineBar}>
                <View
                  style={[styles.dot, { backgroundColor: severityColor }]}
                />
                {!isLast && <View style={styles.line} />}
              </View>

              {/* Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardDate}>{formatDate(log.date)}</Text>
                  <View style={styles.cardHeaderRight}>
                    <View
                      style={[
                        styles.severityBadge,
                        { backgroundColor: severityColor },
                      ]}
                    >
                      <Text style={styles.severityText}>
                        {log.severity}/10
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDelete(log)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete log from ${formatDate(log.date)}`}
                    >
                      <MaterialIcons
                        name="delete-outline"
                        size={18}
                        color={T.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Symptoms */}
                {symptomLabels.length > 0 ? (
                  <View style={styles.chipRow}>
                    {symptomLabels.map((label) => {
                      const info = SYMPTOMS.find((s) => s.label === label);
                      return (
                        <View
                          key={label}
                          style={[
                            styles.chip,
                            info?.isRedFlag && styles.chipRedFlag,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              info?.isRedFlag && styles.chipTextRedFlag,
                            ]}
                          >
                            {label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.noSymptoms}>No symptoms checked</Text>
                )}

                {/* Temperature */}
                {log.temperature && (
                  <View style={styles.tempRow}>
                    <MaterialIcons
                      name="thermostat"
                      size={16}
                      color={log.temperature >= 100.4 ? T.danger : T.textSecondary}
                    />
                    <Text
                      style={[
                        styles.tempText,
                        log.temperature >= 100.4 && { color: T.danger },
                      ]}
                    >
                      {log.temperature}°F
                    </Text>
                  </View>
                )}

                {/* Notes */}
                {log.notes ? (
                  <Text style={styles.notes} numberOfLines={3}>
                    {log.notes}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: T.lg, paddingBottom: T.xxl },
  summary: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    marginBottom: T.md,
  },
  // Empty state
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
  // Timeline
  entryRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  timelineBar: {
    width: 24,
    alignItems: 'center',
    marginRight: T.sm,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 4,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: T.border,
    marginTop: 4,
  },
  // Card
  card: {
    flex: 1,
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.sm,
    borderWidth: 1,
    borderColor: T.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: T.sm,
  },
  cardDate: {
    fontSize: T.fontMd,
    fontWeight: '600',
    color: T.text,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sm,
  },
  severityBadge: {
    paddingHorizontal: T.sm,
    paddingVertical: 2,
    borderRadius: T.radiusFull,
  },
  severityText: {
    color: T.white,
    fontSize: T.fontXs,
    fontWeight: '700',
  },
  chipRow: {
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
  chipRedFlag: {
    backgroundColor: T.dangerBg,
  },
  chipText: {
    fontSize: T.fontXs,
    color: T.primaryDark,
    fontWeight: '500',
  },
  chipTextRedFlag: {
    color: T.danger,
  },
  noSymptoms: {
    fontSize: T.fontSm,
    color: T.textMuted,
    fontStyle: 'italic',
  },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.xs,
    marginTop: T.sm,
  },
  tempText: {
    fontSize: T.fontSm,
    color: T.textSecondary,
  },
  notes: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    marginTop: T.sm,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
