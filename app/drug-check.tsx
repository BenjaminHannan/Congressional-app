/**
 * Trace — Drug-Interaction Checker
 *
 * Modal that lets a Lyme patient check whether the medications they are
 * already taking interact with the antibiotic they have been prescribed
 * (or are considering). The data layer is in `lib/drug-interactions.ts` —
 * a small, source-cited curated database focused on the four IDSA-2020
 * first-line Lyme antibiotics.
 *
 * The flow:
 *   1. Pick your Lyme antibiotic from a list of four cards.
 *   2. Either browse the "Common interactions" auto-populated for that
 *      antibiotic, OR type the name of another drug to search.
 *   3. Each interaction is shown with severity color, mechanism, and a
 *      concrete recommendation (e.g. "separate dosing by 2 hours").
 *
 * Disclaimers and citation footnotes are prominent — this is decision
 * SUPPORT, not pharmaceutical advice.
 */

import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { T } from '@/lib/theme';
import {
  LYME_ANTIBIOTICS,
  LymeAntibiotic,
  DrugInteraction,
  InteractionSeverity,
  findInteractions,
  commonInteractionsFor,
} from '@/lib/drug-interactions';

const SEVERITY_COLOR: Record<InteractionSeverity, string> = {
  contraindicated: T.danger,
  major: T.danger,
  moderate: T.warning,
  minor: T.primary,
};

const SEVERITY_LABEL: Record<InteractionSeverity, string> = {
  contraindicated: 'CONTRAINDICATED',
  major: 'MAJOR',
  moderate: 'MODERATE',
  minor: 'MINOR',
};

export default function DrugCheckScreen() {
  const router = useRouter();
  const [selectedAb, setSelectedAb] = useState<LymeAntibiotic | null>(null);
  const [query, setQuery] = useState('');

  // Live results: if the query is empty, show "common" interactions for the
  // selected antibiotic; otherwise filter to what matches the user's input.
  const results: DrugInteraction[] = useMemo(() => {
    if (!selectedAb) return [];
    const q = query.trim();
    if (q.length === 0) return commonInteractionsFor(selectedAb.id);
    return findInteractions(selectedAb.id, q);
  }, [selectedAb, query]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity
          style={styles.closeRow}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Close drug-interaction checker"
        >
          <MaterialIcons name="close" size={24} color={T.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.h1}>Lyme antibiotic check</Text>
        <Text style={styles.subtitle}>
          Look up interactions with the four IDSA-2020 first-line Lyme
          antibiotics. Decision support — not pharmaceutical advice.
        </Text>

        {/* Antibiotic picker */}
        <Text style={styles.sectionLabel}>1. Pick the Lyme antibiotic</Text>
        <View style={styles.antibioticGrid}>
          {LYME_ANTIBIOTICS.map((ab) => {
            const selected = selectedAb?.id === ab.id;
            return (
              <TouchableOpacity
                key={ab.id}
                style={[styles.abCard, selected && styles.abCardSelected]}
                onPress={() => setSelectedAb(ab)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Select ${ab.name}`}
              >
                <Text
                  style={[
                    styles.abName,
                    selected && styles.abNameSelected,
                  ]}
                >
                  {ab.name}
                </Text>
                <Text style={styles.abRole}>{ab.idsaRole}</Text>
                {selected && (
                  <View style={styles.abCheck}>
                    <MaterialIcons name="check" size={14} color={T.white} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedAb && (
          <>
            {/* Search */}
            <Text style={styles.sectionLabel}>
              2. Type another medication you take
            </Text>
            <View style={styles.searchRow}>
              <MaterialIcons name="search" size={18} color={T.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="e.g. warfarin, tums, birth control"
                placeholderTextColor={T.textMuted}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => setQuery('')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <MaterialIcons
                    name="close"
                    size={18}
                    color={T.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.searchHelp}>
              Leave blank to see common interactions for {selectedAb.name}.
            </Text>

            {/* Results */}
            <Text style={styles.sectionLabel}>
              {query.trim().length === 0
                ? `Common interactions with ${selectedAb.name}`
                : `${results.length} match${results.length === 1 ? '' : 'es'} for "${query.trim()}"`}
            </Text>

            {results.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="info-outline" size={20} color={T.textSecondary} />
                <Text style={styles.emptyText}>
                  No interactions in the curated database. This does NOT mean
                  there are none — only that we don't have this combination
                  flagged. Ask your pharmacist.
                </Text>
              </View>
            ) : (
              results.map((it, i) => (
                <InteractionCard key={i} interaction={it} />
              ))
            )}
          </>
        )}

        <View style={styles.disclaimerCard}>
          <MaterialIcons name="warning-amber" size={18} color={T.warning} />
          <Text style={styles.disclaimerText}>
            This database is hand-curated and intentionally focused — your
            pharmacist will catch interactions Trace misses. Always tell your
            prescriber about every medication you take. In an emergency, call
            911.
          </Text>
        </View>

        <Text style={styles.footer}>
          Sources: DailyMed (US NLM), IDSA/AAN/ACR 2020 Lyme Guidelines, FDA
          drug labels. See `lib/drug-interactions.ts` in the project repo for
          per-row citations.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InteractionCard({ interaction }: { interaction: DrugInteraction }) {
  const color = SEVERITY_COLOR[interaction.severity];
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{interaction.otherDrug}</Text>
        <View style={[styles.severityPill, { backgroundColor: color }]}>
          <Text style={styles.severityPillText}>
            {SEVERITY_LABEL[interaction.severity]}
          </Text>
        </View>
      </View>
      <Text style={styles.cardSection}>Mechanism</Text>
      <Text style={styles.cardBody}>{interaction.mechanism}</Text>
      <Text style={styles.cardSection}>What to do</Text>
      <Text style={styles.cardBody}>{interaction.recommendation}</Text>
      <Text style={styles.cardSource}>{interaction.source}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: T.lg, paddingBottom: T.xxl },
  closeRow: { alignSelf: 'flex-end', padding: T.sm },
  h1: {
    fontSize: T.fontXxl,
    fontWeight: '800',
    color: T.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    lineHeight: 20,
    marginBottom: T.lg,
  },
  sectionLabel: {
    fontSize: T.fontXs,
    fontWeight: '700',
    color: T.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: T.md,
    marginBottom: T.sm,
  },
  antibioticGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: T.sm,
  },
  abCard: {
    width: '47%',
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.md,
    borderWidth: 1.5,
    borderColor: T.border,
    position: 'relative',
  },
  abCardSelected: {
    borderColor: T.primary,
    backgroundColor: T.primaryFaint,
  },
  abName: {
    fontSize: T.fontMd,
    fontWeight: '700',
    color: T.text,
    marginBottom: 4,
  },
  abNameSelected: {
    color: T.primaryDark,
  },
  abRole: {
    fontSize: 11,
    color: T.textSecondary,
    lineHeight: 15,
  },
  abCheck: {
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sm,
    backgroundColor: T.card,
    borderRadius: T.radius,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: T.md,
    paddingVertical: T.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: T.fontMd,
    color: T.text,
    paddingVertical: 0,
  },
  searchHelp: {
    fontSize: 10,
    color: T.textMuted,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: T.sm,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.sm,
    backgroundColor: T.bg,
    borderRadius: T.radius,
    padding: T.md,
    borderWidth: 1,
    borderColor: T.border,
  },
  emptyText: {
    flex: 1,
    fontSize: T.fontSm,
    color: T.textSecondary,
    lineHeight: 20,
  },
  card: {
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.sm,
    borderWidth: 1,
    borderColor: T.border,
    borderLeftWidth: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: T.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: T.fontMd,
    fontWeight: '700',
    color: T.text,
  },
  severityPill: {
    paddingHorizontal: T.sm,
    paddingVertical: 2,
    borderRadius: T.radiusFull,
  },
  severityPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: T.white,
    letterSpacing: 0.4,
  },
  cardSection: {
    fontSize: 10,
    fontWeight: '700',
    color: T.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: T.xs,
  },
  cardBody: {
    fontSize: T.fontSm,
    color: T.text,
    lineHeight: 20,
    marginTop: 2,
  },
  cardSource: {
    fontSize: 10,
    color: T.textMuted,
    fontStyle: 'italic',
    marginTop: T.sm,
  },
  disclaimerCard: {
    flexDirection: 'row',
    gap: T.sm,
    backgroundColor: T.warningBg,
    borderRadius: T.radius,
    padding: T.md,
    marginTop: T.lg,
    borderLeftWidth: 4,
    borderLeftColor: T.warning,
  },
  disclaimerText: {
    flex: 1,
    fontSize: T.fontSm,
    color: T.text,
    lineHeight: 20,
  },
  footer: {
    fontSize: 10,
    color: T.textMuted,
    textAlign: 'center',
    marginTop: T.lg,
    lineHeight: 14,
  },
});
