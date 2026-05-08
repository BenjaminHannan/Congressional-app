/**
 * Trace — New Hampshire Lyme Disease Data
 *
 * County-level incidence data for Lyme disease in New Hampshire.
 * Used in risk assessment and the NH heatmap display.
 *
 * Source: NH Division of Public Health Services, Bureau of Infectious Disease Control
 * Note: Data represents approximate incidence rates per 100,000 population.
 * Updated annually — these figures are representative estimates.
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
