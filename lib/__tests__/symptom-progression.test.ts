/**
 * Tests for the pure-TS temporal GRU inference.
 *
 * Contracts:
 *  1. A classic Lyme trajectory (sustained classic-cluster + accumulating
 *     red flags) yields a high latest probability and a positive trend.
 *  2. A flat no-symptoms trajectory yields low probabilities throughout.
 *  3. A "flu" trajectory — high early, decaying — yields a NEGATIVE trend.
 *  4. predictFromLogs returns null with fewer than 2 logs.
 *  5. All probabilities are in [0, 1].
 */

import { predictTrajectory, predictFromLogs } from '../ml/symptom-progression';
import { EMPTY_SYMPTOMS } from '../symptoms';
import { SymptomChecks, SymptomLog } from '../types';

function s(overrides: Partial<SymptomChecks>): SymptomChecks {
  return { ...EMPTY_SYMPTOMS, ...overrides };
}

describe('predictTrajectory', () => {
  test('classic Lyme trajectory climbs across days', () => {
    // 7-day trajectory: flu-like start → joint involvement → neuro hint
    const history: SymptomChecks[] = [
      s({ fatigue: true, fever: true, headache: true }),
      s({ fatigue: true, fever: true, headache: true, muscleAches: true }),
      s({ fatigue: true, headache: true, jointPain: true, muscleAches: true }),
      s({ fatigue: true, jointPain: true, muscleAches: true, brainFog: true }),
      s({ fatigue: true, jointPain: true, brainFog: true, headache: true }),
      s({ fatigue: true, jointPain: true, brainFog: true, neckStiffness: true }),
      s({ fatigue: true, jointPain: true, brainFog: true, neckStiffness: true,
          facialDroop: true }),
    ];

    const out = predictTrajectory(history);

    expect(out.perDayProbabilities).toHaveLength(7);
    out.perDayProbabilities.forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });
    expect(out.latest).toBeGreaterThan(0.7);
    expect(out.trend).toBeGreaterThan(0);
  });

  test('flat no-symptoms trajectory stays low', () => {
    const history: SymptomChecks[] = Array.from({ length: 7 }, () =>
      s({})
    );

    const out = predictTrajectory(history);

    expect(out.latest).toBeLessThan(0.3);
    out.perDayProbabilities.forEach((p) => {
      expect(p).toBeLessThan(0.4);
    });
  });

  test('flu trajectory (high early, decaying) yields a non-positive trend', () => {
    const history: SymptomChecks[] = [
      s({ fatigue: true, fever: true, headache: true, muscleAches: true, chills: true }),
      s({ fatigue: true, fever: true, headache: true, muscleAches: true, chills: true }),
      s({ fatigue: true, fever: true, headache: true, muscleAches: true }),
      s({ fatigue: true, headache: true, muscleAches: true }),
      s({ fatigue: true, headache: true }),
      s({ fatigue: true }),
      s({}),
    ];

    const out = predictTrajectory(history);

    // Trend MUST be non-positive (flu fades; Lyme doesn't).
    expect(out.trend).toBeLessThanOrEqual(0);
    expect(out.latest).toBeLessThan(0.5);
  });
});

describe('predictFromLogs', () => {
  test('returns null when fewer than 2 logs', () => {
    expect(predictFromLogs([])).toBeNull();
    expect(
      predictFromLogs([
        {
          id: '1',
          date: '2026-05-12',
          timestamp: '2026-05-12T12:00:00Z',
          symptoms: s({ fatigue: true }),
          severity: 5,
          notes: '',
        },
      ])
    ).toBeNull();
  });

  test('handles newest-first storage order correctly', () => {
    // SymptomLog[] is newest-first per storage.ts; predictFromLogs reverses
    // internally. Pass [today, yesterday] and confirm the latest probability
    // corresponds to today's symptoms (the heavier ones).
    const logs: SymptomLog[] = [
      // Newest: severe classic Lyme
      {
        id: 'today',
        date: '2026-05-12',
        timestamp: '2026-05-12T12:00:00Z',
        symptoms: s({
          fatigue: true,
          jointPain: true,
          headache: true,
          neckStiffness: true,
          facialDroop: true,
        }),
        severity: 9,
        notes: '',
      },
      // Older: nothing
      {
        id: 'yesterday',
        date: '2026-05-11',
        timestamp: '2026-05-11T12:00:00Z',
        symptoms: s({}),
        severity: 1,
        notes: '',
      },
    ];

    const out = predictFromLogs(logs);
    expect(out).not.toBeNull();
    // Latest = today (heavy red flags) should be high
    expect(out!.latest).toBeGreaterThan(0.5);
    // Trend should be positive: yesterday low → today high
    expect(out!.trend).toBeGreaterThan(0);
  });
});
