/**
 * Trace — New Hampshire Lyme Disease Data
 *
 * County-level incidence data for Lyme disease in New Hampshire.
 * Used in risk assessment and the NH heatmap display.
 *
 * ─── CDC SOURCE ─────────────────────────────────────────────────────────
 * Dataset:     Lyme disease — Reported cases by state or locality and county,
 *              National Notifiable Diseases Surveillance System (NNDSS)
 * Publisher:   U.S. Centers for Disease Control and Prevention (CDC),
 *              Division of Vector-Borne Diseases
 * Year range:  2019–2023 (most recent 5-year window at the time of writing,
 *              2026; verify against the latest CDC release before submission)
 * URL:         https://www.cdc.gov/lyme/data-research/facts-stats/index.html
 *              https://www.cdc.gov/lyme/data-research/facts-stats/lyme-disease-case-map.html
 *
 * Supplemental sources used for the README's NH-specific framing:
 *   - NH DHHS Bureau of Infectious Disease Control — annual surveillance reports
 *   - UNH Cooperative Extension tick-testing program, Grafton County 2017–2019
 *     (cited for the "50%+ of adult blacklegged ticks infected" figure)
 *
 * ─── TODO BEFORE CAC SUBMISSION ─────────────────────────────────────────
 * The values below were drafted as representative estimates. Each one must
 * be cross-checked against the CDC NNDSS county table or the NH DHHS annual
 * report and updated to the most recent published year. If a number is
 * uncertain, prefer to under-state it rather than over-state it.
 *
 *   [ ] Belknap       incidenceRate: 145   — verify vs. CDC 2019–2023
 *   [ ] Carroll       incidenceRate: 160   — verify vs. CDC 2019–2023
 *   [ ] Cheshire      incidenceRate: 130   — verify vs. CDC 2019–2023
 *   [ ] Coos          incidenceRate: 55    — verify vs. CDC 2019–2023
 *   [ ] Grafton       incidenceRate: 120   — verify vs. CDC 2019–2023
 *                                           (Hanover/Lyme report 200+/100k —
 *                                           ensure county avg is consistent)
 *   [ ] Hillsborough  incidenceRate: 110   — verify vs. CDC 2019–2023
 *   [ ] Merrimack     incidenceRate: 125   — verify vs. CDC 2019–2023
 *   [ ] Rockingham    incidenceRate: 155   — verify vs. CDC 2019–2023
 *   [ ] Strafford     incidenceRate: 140   — verify vs. CDC 2019–2023
 *   [ ] Sullivan      incidenceRate: 115   — verify vs. CDC 2019–2023
 *   [ ] NH_STATE_AVERAGE_RATE: 128         — verify vs. CDC 2019–2023
 *   [ ] US_NATIONAL_AVERAGE_RATE: 9        — verify vs. CDC 2019–2023
 *   [ ] county populations — pull from US Census 2020 + ACS most recent year
 *
 * Data represents approximate incidence rates per 100,000 population.
 */

export interface CountyData {
  name: string;
  incidenceRate: number; // cases per 100,000
  riskCategory: 'high' | 'very_high' | 'moderate';
  population: number;   // approximate
}

/**
 * NH counties with Lyme incidence data.
 * NH is consistently among the top 5 states for Lyme disease incidence.
 * ALL NH counties are at least moderate risk; most are high or very high.
 */
export const NH_COUNTIES: CountyData[] = [
  { name: 'Belknap', incidenceRate: 145, riskCategory: 'very_high', population: 63000 },
  { name: 'Carroll', incidenceRate: 160, riskCategory: 'very_high', population: 49000 },
  { name: 'Cheshire', incidenceRate: 130, riskCategory: 'very_high', population: 77000 },
  { name: 'Coos', incidenceRate: 55, riskCategory: 'moderate', population: 31000 },
  { name: 'Grafton', incidenceRate: 120, riskCategory: 'high', population: 91000 },
  { name: 'Hillsborough', incidenceRate: 110, riskCategory: 'high', population: 419000 },
  { name: 'Merrimack', incidenceRate: 125, riskCategory: 'high', population: 153000 },
  { name: 'Rockingham', incidenceRate: 155, riskCategory: 'very_high', population: 314000 },
  { name: 'Strafford', incidenceRate: 140, riskCategory: 'very_high', population: 133000 },
  { name: 'Sullivan', incidenceRate: 115, riskCategory: 'high', population: 43000 },
];

/** Statewide average */
export const NH_STATE_AVERAGE_RATE = 128;

/** US national average for comparison */
export const US_NATIONAL_AVERAGE_RATE = 9;

/**
 * Get a county's data by name
 */
export function getCountyData(name: string): CountyData | undefined {
  return NH_COUNTIES.find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get the risk message for a county
 */
export function getCountyRiskMessage(county: string): string {
  const data = getCountyData(county);
  if (!data) return 'New Hampshire is a high-incidence state for Lyme disease.';

  const multiplier = Math.round(data.incidenceRate / US_NATIONAL_AVERAGE_RATE);
  return (
    `${data.name} County has a Lyme disease rate of approximately ` +
    `${data.incidenceRate} cases per 100,000 — about ${multiplier}x the national average.`
  );
}

/**
 * Key fact for the demo / about screen
 */
export const NH_LYME_FACT =
  'New Hampshire consistently ranks among the top 5 states for Lyme disease incidence. ' +
  'The disease is named after Old Lyme, Connecticut — just 150 miles from Hanover, NH.';
