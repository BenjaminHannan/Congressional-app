/**
 * Trace — NH Lyme Heatmap
 *
 * Interactive county-level map of New Hampshire showing Lyme disease
 * incidence rates. Tap a county for detailed stats.
 *
 * Data source: NH Division of Public Health Services
 *
 * The geographic layout uses positioned views arranged to roughly
 * match New Hampshire's actual county boundaries, creating a
 * recognizable state shape without needing an SVG library.
 */

import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  NH_COUNTIES,
  NH_STATE_AVERAGE_RATE,
  US_NATIONAL_AVERAGE_RATE,
  CountyData,
  NH_LYME_FACT,
} from '@/lib/nh-data';
import { T } from '@/lib/theme';
import { TickSighting } from '@/lib/types';
import {
  getTickSightings,
  saveTickSighting,
  generateId,
} from '@/lib/storage';
import {
  summarizeByCounty,
  getAllSightingsSorted,
  CountySightingSummary,
} from '@/lib/tick-sightings';

const screenWidth = Dimensions.get('window').width;
const MAP_PADDING = 24;
const MAP_WIDTH = screenWidth - MAP_PADDING * 2;

/**
 * Color scale based on incidence rate.
 * Higher = more red, lower = more green/yellow.
 */
function getRiskColor(rate: number): string {
  if (rate >= 150) return '#DC2626';      // red — very high
  if (rate >= 130) return '#EA580C';      // orange-red
  if (rate >= 110) return '#D97706';      // amber
  if (rate >= 80) return '#CA8A04';       // yellow-amber
  return '#65A30D';                       // green — moderate
}

function getRiskTextColor(rate: number): string {
  if (rate >= 130) return '#FFFFFF';
  return '#1C1917';
}

function sourceLabel(source: TickSighting['source']): string {
  if (source === 'user') return 'you';
  if (source === 'unh_extension') return 'UNH Ext.';
  return 'community';
}

function sourceColor(source: TickSighting['source']): { backgroundColor: string } {
  if (source === 'user') return { backgroundColor: T.primary };
  if (source === 'unh_extension') return { backgroundColor: T.danger };
  return { backgroundColor: T.warning };
}

function daysAgo(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.floor((Date.now() - d.getTime()) / 86400_000);
  if (diff <= 0) return 'today';
  if (diff === 1) return '1d ago';
  if (diff < 30) return `${diff}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Geographic layout for NH counties.
 * Values are percentages of the map container, roughly matching
 * the real geography of New Hampshire.
 *
 * NH is tall and narrow — Coos is the huge northern county,
 * Grafton/Carroll in the upper-middle, then a cluster in the south.
 */
const COUNTY_LAYOUT: Record<string, { top: number; left: number; width: number; height: number }> = {
  Coos:         { top: 0,   left: 15, width: 70, height: 25 },
  Grafton:      { top: 26,  left: 5,  width: 40, height: 22 },
  Carroll:      { top: 26,  left: 48, width: 42, height: 18 },
  Sullivan:     { top: 49,  left: 0,  width: 28, height: 14 },
  Merrimack:    { top: 49,  left: 30, width: 30, height: 18 },
  Belknap:      { top: 46,  left: 55, width: 22, height: 11 },
  Strafford:    { top: 46,  left: 68, width: 27, height: 14 },
  Cheshire:     { top: 64,  left: 0,  width: 28, height: 18 },
  Hillsborough: { top: 68,  left: 30, width: 33, height: 18 },
  Rockingham:   { top: 62,  left: 55, width: 38, height: 22 },
};

export default function MapScreen() {
  const [selected, setSelected] = useState<CountyData | null>(null);
  const [userSightings, setUserSightings] = useState<TickSighting[]>([]);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportCounty, setReportCounty] = useState<string>('Grafton');
  const [reportTown, setReportTown] = useState('');
  const [reportNotes, setReportNotes] = useState('');

  useFocusEffect(
    useCallback(() => {
      getTickSightings().then(setUserSightings).catch(() => {});
    }, [])
  );

  const sightingsByCounty: Record<string, CountySightingSummary> =
    summarizeByCounty(userSightings);
  const recentSightings = getAllSightingsSorted(userSightings).slice(0, 6);

  // Sort counties by incidence rate for the list view
  const sortedCounties = [...NH_COUNTIES].sort((a, b) => b.incidenceRate - a.incidenceRate);
  const maxRate = Math.max(...NH_COUNTIES.map((c) => c.incidenceRate));

  async function handleReportSighting() {
    const town = reportTown.trim();
    if (!town) {
      Alert.alert('Town required', 'Enter the town or area where you found the tick.');
      return;
    }
    const sighting: TickSighting = {
      id: generateId(),
      date: new Date().toISOString().slice(0, 10),
      county: reportCounty,
      town,
      source: 'user',
      notes: reportNotes.trim() || undefined,
    };
    await saveTickSighting(sighting);
    const next = await getTickSightings();
    setUserSightings(next);
    setReportModalOpen(false);
    setReportTown('');
    setReportNotes('');
    Alert.alert('Sighting saved', 'Stored locally on your device. Shows up immediately on the map.');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <Text style={styles.title}>NH Lyme Heatmap</Text>
        <Text style={styles.subtitle}>
          Tap a county to see detailed Lyme disease statistics.
        </Text>

        {/* State comparison bar */}
        <View style={styles.compBar}>
          <View style={styles.compItem}>
            <Text style={styles.compNumber}>{NH_STATE_AVERAGE_RATE}</Text>
            <Text style={styles.compLabel}>NH Average{'\n'}per 100k</Text>
          </View>
          <View style={styles.compDivider} />
          <View style={styles.compItem}>
            <Text style={styles.compNumber}>{US_NATIONAL_AVERAGE_RATE}</Text>
            <Text style={styles.compLabel}>US Average{'\n'}per 100k</Text>
          </View>
          <View style={styles.compDivider} />
          <View style={styles.compItem}>
            <Text style={[styles.compNumber, { color: T.danger }]}>
              {Math.round(NH_STATE_AVERAGE_RATE / US_NATIONAL_AVERAGE_RATE)}x
            </Text>
            <Text style={styles.compLabel}>Higher{'\n'}than US</Text>
          </View>
        </View>

        {/* Geographic map */}
        <View style={styles.mapContainer}>
          <View style={styles.mapInner}>
            {NH_COUNTIES.map((county) => {
              const layout = COUNTY_LAYOUT[county.name];
              if (!layout) return null;

              const bg = getRiskColor(county.incidenceRate);
              const textColor = getRiskTextColor(county.incidenceRate);
              const isSelected = selected?.name === county.name;

              return (
                <TouchableOpacity
                  key={county.name}
                  style={[
                    styles.countyBlock,
                    {
                      top: `${layout.top}%`,
                      left: `${layout.left}%`,
                      width: `${layout.width}%`,
                      height: `${layout.height}%`,
                      backgroundColor: bg,
                    },
                    isSelected && styles.countyBlockSelected,
                  ]}
                  onPress={() => setSelected(county)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.countyName, { color: textColor }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {county.name}
                  </Text>
                  <Text style={[styles.countyRate, { color: textColor }]}>
                    {county.incidenceRate}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#65A30D' }]} />
              <Text style={styles.legendText}>Moderate</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#D97706' }]} />
              <Text style={styles.legendText}>High</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EA580C' }]} />
              <Text style={styles.legendText}>Very High</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
              <Text style={styles.legendText}>Highest</Text>
            </View>
          </View>
        </View>

        {/* Selected county detail card */}
        {selected && (
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailName}>{selected.name} County</Text>
              <View
                style={[
                  styles.detailBadge,
                  { backgroundColor: getRiskColor(selected.incidenceRate) },
                ]}
              >
                <Text
                  style={[
                    styles.detailBadgeText,
                    { color: getRiskTextColor(selected.incidenceRate) },
                  ]}
                >
                  {selected.riskCategory.replace('_', ' ').toUpperCase()} RISK
                </Text>
              </View>
            </View>

            <View style={styles.detailStats}>
              <View style={styles.detailStat}>
                <Text style={styles.detailStatNum}>{selected.incidenceRate}</Text>
                <Text style={styles.detailStatLabel}>Cases per{'\n'}100,000</Text>
              </View>
              <View style={styles.detailStat}>
                <Text style={styles.detailStatNum}>
                  {Math.round(selected.incidenceRate / US_NATIONAL_AVERAGE_RATE)}x
                </Text>
                <Text style={styles.detailStatLabel}>National{'\n'}Average</Text>
              </View>
              <View style={styles.detailStat}>
                <Text style={styles.detailStatNum}>
                  ~{Math.round(selected.population / 1000)}k
                </Text>
                <Text style={styles.detailStatLabel}>Population</Text>
              </View>
            </View>

            <Text style={styles.detailEstimate}>
              Estimated ~{Math.round((selected.incidenceRate / 100000) * selected.population)} cases
              per year in {selected.name} County
            </Text>
          </View>
        )}

        {/* Community tick sightings panel */}
        <View style={styles.sightingsCard}>
          <View style={styles.sightingsHeader}>
            <MaterialIcons name="bug-report" size={18} color={T.danger} />
            <Text style={styles.sightingsTitle}>Recent Tick Sightings</Text>
            <Text style={styles.sightingsSubtitle}>(this season)</Text>
          </View>
          <Text style={styles.sightingsHelp}>
            Combines local user reports with UNH Cooperative Extension drag
            sampling and community-reported observations. {recentSightings.length}{' '}
            shown · {Object.values(sightingsByCounty).reduce((a, c) => a + c.total, 0)}{' '}
            total in database.
          </Text>

          {recentSightings.map((s) => (
            <View key={s.id} style={styles.sightingRow}>
              <View style={[styles.sightingDot, sourceColor(s.source)]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sightingPrimary}>
                  {s.town} ({s.county})
                </Text>
                {s.notes && (
                  <Text style={styles.sightingNote} numberOfLines={2}>
                    {s.notes}
                  </Text>
                )}
              </View>
              <Text style={styles.sightingMeta}>
                {sourceLabel(s.source)} · {daysAgo(s.date)}
              </Text>
            </View>
          ))}

          <TouchableOpacity
            style={styles.reportButton}
            onPress={() => setReportModalOpen(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Report a tick sighting"
          >
            <MaterialIcons name="add-location" size={18} color={T.white} />
            <Text style={styles.reportButtonText}>Report a sighting</Text>
          </TouchableOpacity>
        </View>

        {/* Report sighting modal */}
        <Modal
          visible={reportModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setReportModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Report a tick sighting</Text>
                <TouchableOpacity
                  onPress={() => setReportModalOpen(false)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close report sighting"
                >
                  <MaterialIcons name="close" size={22} color={T.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>County</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.countyChipRow}
              >
                {NH_COUNTIES.map((c) => {
                  const sel = reportCounty === c.name;
                  return (
                    <TouchableOpacity
                      key={c.name}
                      style={[styles.countyChip, sel && styles.countyChipActive]}
                      onPress={() => setReportCounty(c.name)}
                    >
                      <Text
                        style={[
                          styles.countyChipText,
                          sel && styles.countyChipTextActive,
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.modalLabel}>Town or area</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Hanover, Smarts Mountain trailhead"
                placeholderTextColor={T.textMuted}
                value={reportTown}
                onChangeText={setReportTown}
                autoCapitalize="words"
              />

              <Text style={styles.modalLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 56 }]}
                placeholder="e.g. Pulled an attached deer tick after a hike"
                placeholderTextColor={T.textMuted}
                value={reportNotes}
                onChangeText={setReportNotes}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={styles.modalSubmit}
                onPress={handleReportSighting}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSubmitText}>Save sighting</Text>
              </TouchableOpacity>

              <Text style={styles.modalDisclaimer}>
                Sightings are stored locally on your device only. No backend,
                no PII, no telemetry. A future Trace release may add an
                opt-in federated submission layer.
              </Text>
            </View>
          </View>
        </Modal>

        {/* County ranking list */}
        <Text style={styles.rankTitle}>All Counties — Ranked by Incidence</Text>

        {sortedCounties.map((county, index) => {
          const barWidth = (county.incidenceRate / maxRate) * 100;
          const isSelected = selected?.name === county.name;

          return (
            <TouchableOpacity
              key={county.name}
              style={[styles.rankRow, isSelected && styles.rankRowSelected]}
              onPress={() => setSelected(county)}
              activeOpacity={0.7}
            >
              <Text style={styles.rankNum}>{index + 1}</Text>
              <View style={styles.rankInfo}>
                <View style={styles.rankNameRow}>
                  <Text style={styles.rankName}>{county.name}</Text>
                  <Text style={styles.rankRate}>
                    {county.incidenceRate}/100k
                  </Text>
                </View>
                <View style={styles.rankBarBg}>
                  <View
                    style={[
                      styles.rankBarFill,
                      {
                        width: `${barWidth}%`,
                        backgroundColor: getRiskColor(county.incidenceRate),
                      },
                    ]}
                  />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* US comparison bar */}
        <View style={styles.usCompare}>
          <Text style={styles.usCompareLabel}>US National Average</Text>
          <View style={styles.rankBarBg}>
            <View
              style={[
                styles.rankBarFill,
                {
                  width: `${(US_NATIONAL_AVERAGE_RATE / maxRate) * 100}%`,
                  backgroundColor: '#94A3B8',
                },
              ]}
            />
          </View>
          <Text style={styles.usCompareRate}>{US_NATIONAL_AVERAGE_RATE}/100k</Text>
        </View>

        {/* Fun fact */}
        <View style={styles.factCard}>
          <MaterialIcons name="lightbulb" size={20} color={T.warning} />
          <Text style={styles.factText}>
            Hanover, NH is just 11 miles from Old Lyme, Connecticut — the town
            where Lyme disease was first identified in 1975.
          </Text>
        </View>

        <Text style={styles.source}>
          Data: NH Division of Public Health Services.{'\n'}
          Rates are approximate annual estimates per 100,000 population.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { padding: MAP_PADDING, paddingBottom: T.xxl },

  title: {
    fontSize: T.fontXl,
    fontWeight: '700',
    color: T.text,
    marginBottom: T.xs,
  },
  subtitle: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    marginBottom: T.md,
  },

  // Comparison bar
  compBar: {
    flexDirection: 'row',
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.md,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
  },
  compItem: {
    flex: 1,
    alignItems: 'center',
  },
  compNumber: {
    fontSize: T.fontXxl,
    fontWeight: '800',
    color: T.primaryDark,
  },
  compLabel: {
    fontSize: 11,
    color: T.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  compDivider: {
    width: 1,
    height: 40,
    backgroundColor: T.border,
  },

  // Map
  mapContainer: {
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.md,
    marginBottom: T.md,
    borderWidth: 1,
    borderColor: T.border,
  },
  mapInner: {
    width: '100%',
    height: 340,
    position: 'relative',
  },
  countyBlock: {
    position: 'absolute',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  countyBlockSelected: {
    borderColor: T.text,
    borderWidth: 3,
    zIndex: 10,
  },
  countyName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  countyRate: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.85,
    textAlign: 'center',
  },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: T.md,
    marginTop: T.sm,
    paddingTop: T.sm,
    borderTopWidth: 1,
    borderTopColor: T.borderLight,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: T.textSecondary,
  },

  // Detail card
  detailCard: {
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.lg,
    marginBottom: T.md,
    borderWidth: 1,
    borderColor: T.border,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: T.md,
  },
  detailName: {
    fontSize: T.fontLg,
    fontWeight: '700',
    color: T.text,
  },
  detailBadge: {
    paddingHorizontal: T.sm,
    paddingVertical: T.xs,
    borderRadius: T.radiusFull,
  },
  detailBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detailStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: T.md,
  },
  detailStat: {
    alignItems: 'center',
  },
  detailStatNum: {
    fontSize: T.fontXl,
    fontWeight: '700',
    color: T.primaryDark,
  },
  detailStatLabel: {
    fontSize: 11,
    color: T.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  detailEstimate: {
    fontSize: T.fontSm,
    color: T.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Ranking list
  rankTitle: {
    fontSize: T.fontMd,
    fontWeight: '700',
    color: T.text,
    marginBottom: T.sm,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    borderRadius: T.radiusSm,
    padding: T.sm,
    marginBottom: T.xs,
    borderWidth: 1,
    borderColor: T.border,
  },
  rankRowSelected: {
    borderColor: T.primary,
    backgroundColor: T.primaryFaint,
  },
  rankNum: {
    width: 24,
    fontSize: T.fontSm,
    fontWeight: '700',
    color: T.textMuted,
    textAlign: 'center',
  },
  rankInfo: {
    flex: 1,
    marginLeft: T.sm,
  },
  rankNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rankName: {
    fontSize: T.fontSm,
    fontWeight: '600',
    color: T.text,
  },
  rankRate: {
    fontSize: T.fontXs,
    color: T.textSecondary,
    fontWeight: '500',
  },
  rankBarBg: {
    height: 6,
    backgroundColor: T.borderLight,
    borderRadius: 3,
  },
  rankBarFill: {
    height: 6,
    borderRadius: 3,
  },

  // US comparison
  usCompare: {
    padding: T.sm,
    marginBottom: T.md,
  },
  usCompareLabel: {
    fontSize: T.fontXs,
    color: T.textMuted,
    marginBottom: 4,
  },
  usCompareRate: {
    fontSize: T.fontXs,
    color: T.textMuted,
    marginTop: 2,
  },

  // Fact card
  factCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: T.warningBg,
    borderRadius: T.radius,
    padding: T.md,
    gap: T.sm,
    marginBottom: T.md,
  },
  factText: {
    flex: 1,
    fontSize: T.fontSm,
    color: T.text,
    lineHeight: 20,
  },

  source: {
    fontSize: T.fontXs,
    color: T.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Community tick-sightings panel
  sightingsCard: {
    backgroundColor: T.card,
    borderRadius: T.radius,
    padding: T.md,
    marginVertical: T.md,
    borderWidth: 1,
    borderColor: T.border,
  },
  sightingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sightingsTitle: {
    fontSize: T.fontXs,
    fontWeight: '700',
    color: T.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sightingsSubtitle: {
    fontSize: T.fontXs,
    color: T.textMuted,
    fontStyle: 'italic',
    flex: 1,
  },
  sightingsHelp: {
    fontSize: T.fontXs,
    color: T.textSecondary,
    lineHeight: 16,
    marginBottom: T.sm,
  },
  sightingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: T.sm,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  sightingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  sightingPrimary: {
    fontSize: T.fontSm,
    fontWeight: '600',
    color: T.text,
  },
  sightingNote: {
    fontSize: T.fontXs,
    color: T.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  sightingMeta: {
    fontSize: 10,
    color: T.textMuted,
    fontWeight: '600',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: T.sm,
    backgroundColor: T.primary,
    borderRadius: T.radiusSm,
    paddingVertical: T.sm,
    marginTop: T.sm,
  },
  reportButtonText: {
    color: T.white,
    fontSize: T.fontSm,
    fontWeight: '700',
  },

  // Report sighting modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: T.card,
    borderTopLeftRadius: T.radius,
    borderTopRightRadius: T.radius,
    padding: T.lg,
    gap: T.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: T.fontLg,
    fontWeight: '700',
    color: T.text,
  },
  modalLabel: {
    fontSize: T.fontXs,
    fontWeight: '700',
    color: T.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: T.sm,
  },
  countyChipRow: {
    flexGrow: 0,
  },
  countyChip: {
    paddingHorizontal: T.md,
    paddingVertical: T.xs,
    borderRadius: T.radiusFull,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    marginRight: T.xs,
  },
  countyChipActive: {
    backgroundColor: T.primary,
    borderColor: T.primary,
  },
  countyChipText: {
    fontSize: T.fontXs,
    fontWeight: '600',
    color: T.text,
  },
  countyChipTextActive: {
    color: T.white,
  },
  modalInput: {
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: T.radiusSm,
    padding: T.md,
    fontSize: T.fontSm,
    color: T.text,
  },
  modalSubmit: {
    backgroundColor: T.primary,
    borderRadius: T.radius,
    paddingVertical: T.md,
    alignItems: 'center',
    marginTop: T.sm,
  },
  modalSubmitText: {
    color: T.white,
    fontSize: T.fontMd,
    fontWeight: '700',
  },
  modalDisclaimer: {
    fontSize: 10,
    color: T.textMuted,
    fontStyle: 'italic',
    lineHeight: 14,
    textAlign: 'center',
  },
});
