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
import { useFocusEffect } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { getSymptomLogs, deleteSymptomLog } from '@/lib/storage';
import { SYMPTOMS } from '@/lib/symptoms';
import { SymptomLog } from '@/lib/types';
import { T } from '@/lib/theme';

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

export default function TimelineScreen() {
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
          <MaterialIcons name="timeline" size={64} color={T.border} />
          <Text style={styles.emptyTitle}>No entries yet</Text>
          <Text style={styles.emptyDesc}>
            Your symptom timeline will appear here after you log your first day.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
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
