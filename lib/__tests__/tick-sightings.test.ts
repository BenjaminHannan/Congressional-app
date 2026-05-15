/**
 * Tests for the tick-sightings aggregator.
 *
 * Contracts:
 *  1. summarizeByCounty merges seeded + user sightings.
 *  2. Per-source counts are correct.
 *  3. daysSinceMostRecent is computed and is non-negative.
 *  4. getAllSightingsSorted returns newest-first.
 */

import {
  SEED_SIGHTINGS,
  summarizeByCounty,
  getAllSightingsSorted,
} from '../tick-sightings';
import { TickSighting } from '../types';

const today = new Date();
function isoNDaysAgo(n: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const USER_SIGHTING: TickSighting = {
  id: 'user-1',
  date: isoNDaysAgo(1),
  county: 'Grafton',
  town: 'Hanover',
  source: 'user',
  notes: 'unit test sighting',
};

describe('tick-sightings aggregator', () => {
  test('summarizeByCounty merges seed + user', () => {
    const before = summarizeByCounty([]);
    const after = summarizeByCounty([USER_SIGHTING]);
    expect(after.Grafton.total).toBe(before.Grafton.total + 1);
    expect(after.Grafton.user).toBe(1);
  });

  test('per-source counts add up to total', () => {
    const summary = summarizeByCounty([USER_SIGHTING]);
    for (const c of Object.values(summary)) {
      expect(c.user + c.community + c.unhExtension).toBe(c.total);
    }
  });

  test('daysSinceMostRecent is non-negative when sightings exist', () => {
    const summary = summarizeByCounty([USER_SIGHTING]);
    for (const c of Object.values(summary)) {
      expect(c.daysSinceMostRecent).not.toBeNull();
      expect(c.daysSinceMostRecent!).toBeGreaterThanOrEqual(0);
    }
  });

  test('getAllSightingsSorted returns newest-first', () => {
    const all = getAllSightingsSorted([USER_SIGHTING]);
    expect(all.length).toBe(SEED_SIGHTINGS.length + 1);
    for (let i = 1; i < all.length; i++) {
      expect(all[i].date <= all[i - 1].date).toBe(true);
    }
  });
});
