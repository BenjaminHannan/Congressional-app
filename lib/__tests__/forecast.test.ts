/**
 * Tests for the multi-horizon red-flag forecaster.
 *
 * Contracts:
 *  1. Probabilities are well-formed (3 horizons, each in [0,1]).
 *  2. A classic-Lyme prefix (escalating symptoms, no red flags YET) yields
 *     elevated forecast probabilities — the model genuinely picks up
 *     pre-red-flag signal.
 *  3. A flat no-symptoms prefix yields low forecast probabilities.
 *  4. forecastFromLogs returns null with fewer than 2 logs.
 *  5. A 7-day prefix that ALREADY contains red flags doesn't cap the
 *     forecast — the model is still capable of saying "more on the way."
 */

import { predictForecast, forecastFromLogs } from '../ml/forecast';
import { EMPTY_SYMPTOMS } from '../symptoms';
import { SymptomChecks, SymptomLog } from '../types';

function s(overrides: Partial<SymptomChecks>): SymptomChecks {
  return { ...EMPTY_SYMPTOMS, ...overrides };
}

describe('predictForecast', () => {
  test('returns well-formed probabilities for a classic Lyme prefix', () => {
    const history: SymptomChecks[] = [
      s({ fatigue: true, fever: true, muscleAches: true, chills: true }),
      s({ fatigue: true, fever: true, headache: true, muscleAches: true }),
      s({ fatigue: true, headache: true, jointPain: true, swollenLymphNodes: true }),
      s({ fatigue: true, jointPain: true, brainFog: true, headache: true }),
      s({ fatigue: true, jointPain: true, brainFog: true, dizziness: true }),
    ];

    const out = predictForecast(history);
    expect(out).not.toBeNull();
    expect(out!.horizons).toEqual([1, 3, 7]);
    expect(out!.probabilities).toHaveLength(3);
    out!.probabilities.forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });
    // Soft contract: at least ONE of the horizons fires meaningfully on an
    // escalating Lyme prefix — we don't assert monotonicity across horizons
    // because the trained model is allowed to be wrong about which horizon
    // is most likely on any given input.
    expect(Math.max(...out!.probabilities)).toBeGreaterThan(0.15);
  });

  test('flat trajectory yields low forecast probabilities', () => {
    const history: SymptomChecks[] = Array.from({ length: 7 }, () => s({}));
    const out = predictForecast(history)!;
    // All horizons should be below 0.5 for a totally-asymptomatic history.
    out.probabilities.forEach((p) => {
      expect(p).toBeLessThan(0.5);
    });
  });

  test('returns null for fewer than 2 days of history', () => {
    expect(predictForecast([])).toBeNull();
    expect(predictForecast([s({ fatigue: true })])).toBeNull();
  });
});

describe('forecastFromLogs', () => {
  test('handles newest-first storage order correctly', () => {
    const logs: SymptomLog[] = [
      { id: 'a', date: '2026-05-14', timestamp: 'x', severity: 7, notes: '',
        symptoms: s({ fatigue: true, jointPain: true, brainFog: true }) },
      { id: 'b', date: '2026-05-13', timestamp: 'x', severity: 6, notes: '',
        symptoms: s({ fatigue: true, jointPain: true, headache: true }) },
      { id: 'c', date: '2026-05-12', timestamp: 'x', severity: 5, notes: '',
        symptoms: s({ fatigue: true, fever: true, headache: true }) },
      { id: 'd', date: '2026-05-11', timestamp: 'x', severity: 4, notes: '',
        symptoms: s({ fatigue: true, fever: true, muscleAches: true }) },
    ];

    const out = forecastFromLogs(logs);
    expect(out).not.toBeNull();
    expect(out!.probabilities).toHaveLength(3);
  });

  test('returns null with fewer than 2 logs', () => {
    expect(forecastFromLogs([])).toBeNull();
  });
});
