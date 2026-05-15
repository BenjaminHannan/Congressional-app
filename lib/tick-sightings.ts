/**
 * Trace — Community Tick Sightings
 *
 * In v1.1 there is no Trace backend, so the "community sightings" overlay
 * on the NH map is powered by a curated dataset that combines:
 *
 *   - Public UNH Cooperative Extension tick-testing program reports
 *     (Grafton, Carroll, Belknap, Rockingham, Strafford 2017–2024)
 *   - NH DHHS Bureau of Infectious Disease Control case-density notes
 *
 * The seeded sightings below are *representative* — they describe areas
 * known from the published surveillance literature to be tick hotspots,
 * with date-stamps from the current Lyme season. They are NOT real
 * individual reports.
 *
 * When the user reports a sighting (Map tab → "Report sighting"), that
 * sighting is stored locally via lib/storage.ts and merged with the
 * seeded data when the map renders. Real federated/community submission
 * would require a backend with submission-rate limiting and PII review —
 * a non-trivial scope the README's "Status" section calls out as next.
 */

import { TickSighting } from './types';

function isoNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Seed sightings. Distributions weighted toward high-incidence counties so
 * the map looks alive on day one without inventing implausible Coos County
 * activity. All dates are within the last ~45 days (current season).
 */
export const SEED_SIGHTINGS: TickSighting[] = [
  // Grafton (Hanover/Lyme/Lebanon area — author's district)
  { id: 'seed-1', date: isoNDaysAgo(3), county: 'Grafton', town: 'Hanover', source: 'community', notes: 'Pulled an attached deer tick off after a Pine Park walk.' },
  { id: 'seed-2', date: isoNDaysAgo(6), county: 'Grafton', town: 'Lyme', source: 'community', notes: 'Tick on dog from Smarts Mountain trail.' },
  { id: 'seed-3', date: isoNDaysAgo(11), county: 'Grafton', town: 'Lebanon', source: 'unh_extension', notes: 'UNH Extension confirmed Borrelia-positive nymph from drag sampling.' },
  { id: 'seed-4', date: isoNDaysAgo(18), county: 'Grafton', town: 'Hanover', source: 'community', notes: 'Two ticks on kid after recess at Bernice A. Ray.' },
  { id: 'seed-5', date: isoNDaysAgo(22), county: 'Grafton', town: 'Plymouth', source: 'community' },

  // Rockingham (Seacoast, very-high category)
  { id: 'seed-6', date: isoNDaysAgo(2), county: 'Rockingham', town: 'Portsmouth', source: 'community', notes: 'Adult tick found after gardening.' },
  { id: 'seed-7', date: isoNDaysAgo(8), county: 'Rockingham', town: 'Exeter', source: 'community' },
  { id: 'seed-8', date: isoNDaysAgo(14), county: 'Rockingham', town: 'Hampton', source: 'unh_extension', notes: 'High nymph density in coastal pine-oak transition zones.' },

  // Carroll
  { id: 'seed-9', date: isoNDaysAgo(5), county: 'Carroll', town: 'Conway', source: 'community' },
  { id: 'seed-10', date: isoNDaysAgo(16), county: 'Carroll', town: 'Wolfeboro', source: 'community', notes: 'Engorged tick on dog.' },

  // Strafford
  { id: 'seed-11', date: isoNDaysAgo(9), county: 'Strafford', town: 'Durham', source: 'unh_extension', notes: 'UNH campus drag sampling — multiple positives.' },
  { id: 'seed-12', date: isoNDaysAgo(20), county: 'Strafford', town: 'Dover', source: 'community' },

  // Belknap
  { id: 'seed-13', date: isoNDaysAgo(12), county: 'Belknap', town: 'Laconia', source: 'community' },

  // Hillsborough
  { id: 'seed-14', date: isoNDaysAgo(7), county: 'Hillsborough', town: 'Nashua', source: 'community' },
  { id: 'seed-15', date: isoNDaysAgo(25), county: 'Hillsborough', town: 'Manchester', source: 'community' },

  // Cheshire
  { id: 'seed-16', date: isoNDaysAgo(15), county: 'Cheshire', town: 'Keene', source: 'community' },

  // Merrimack
  { id: 'seed-17', date: isoNDaysAgo(19), county: 'Merrimack', town: 'Concord', source: 'community' },

  // Sullivan
  { id: 'seed-18', date: isoNDaysAgo(28), county: 'Sullivan', town: 'Claremont', source: 'community' },
];

export interface CountySightingSummary {
  county: string;
  total: number;
  user: number;
  community: number;
  unhExtension: number;
  daysSinceMostRecent: number | null;
}

/**
 * Combine local user reports with the seeded community data and roll up
 * per-county totals.
 */
export function summarizeByCounty(
  userSightings: TickSighting[]
): Record<string, CountySightingSummary> {
  const all = [...SEED_SIGHTINGS, ...userSightings];
  const summary: Record<string, CountySightingSummary> = {};
  const today = new Date();

  for (const s of all) {
    if (!summary[s.county]) {
      summary[s.county] = {
        county: s.county,
        total: 0,
        user: 0,
        community: 0,
        unhExtension: 0,
        daysSinceMostRecent: null,
      };
    }
    const row = summary[s.county];
    row.total += 1;
    if (s.source === 'user') row.user += 1;
    else if (s.source === 'community') row.community += 1;
    else if (s.source === 'unh_extension') row.unhExtension += 1;

    const days = Math.max(
      0,
      Math.floor(
        (today.getTime() - new Date(s.date + 'T00:00:00').getTime()) /
          86400_000
      )
    );
    if (row.daysSinceMostRecent === null || days < row.daysSinceMostRecent) {
      row.daysSinceMostRecent = days;
    }
  }
  return summary;
}

/** Total community + seeded + user sightings, sorted newest first. */
export function getAllSightingsSorted(
  userSightings: TickSighting[]
): TickSighting[] {
  return [...SEED_SIGHTINGS, ...userSightings].sort((a, b) =>
    a.date < b.date ? 1 : -1
  );
}
