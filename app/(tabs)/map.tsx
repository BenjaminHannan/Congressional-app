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

import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  NH_COUNTIES,
  NH_STATE_AVERAGE_RATE,
  US_NATIONAL_AVERAGE_RATE,
  CountyData,
  NH_LYME_FACT,
} from '@/lib/nh-data';
import { T } from '@/lib/theme';

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

  // Sort counties by incidence rate for the list view
  const sortedCounties = [...NH_COUNTIES].sort((a, b) => b.incidenceRate - a.incidenceRate);
  const maxRate = Math.max(...NH_COUNTIES.map((c) => c.incidenceRate));

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
});
