/**
 * Tests for the pure-TS fusion-model inference layer.
 *
 * These check the contract of `predictRisk` rather than the specific numeric
 * outputs (which depend on the seed used to train the model). The properties
 * we assert here:
 *
 *  1. Probabilities are well-formed (3 classes, sum to 1, all in [0, 1]).
 *  2. The empty-input case (no symptoms, no exposure) yields low Lyme prob.
 *  3. The classic-Lyme case (bullseye + tick attached + NH + classic cluster)
 *     yields a high Lyme prob — strictly higher than the empty case.
 *  4. Adding a red-flag symptom strictly increases the Lyme probability.
 *  5. Contributions are sorted by absolute deltaLymeProb, descending.
 */

import { predictRisk } from '../ml/risk-fusion';
import { calculateRiskML } from '../risk-engine';
import { EMPTY_SYMPTOMS } from '../symptoms';
import { SymptomChecks, ExposureData, SymptomLog } from '../types';

const ISO_NOW = '2026-05-14T12:00:00.000Z';

function emptyExposure(): ExposureData {
  return {
    dateFirstSymptoms: '',
    outdoorActivity: false,
    activityDetails: '',
    locationRisk: 'unsure',
    county: '',
    foundTick: 'no',
    rashStatus: 'no',
    recentFluLike: false,
    petsOutdoor: false,
    nearWoods: false,
  };
}

function makeLog(symptoms: Partial<SymptomChecks>, date: string): SymptomLog {
  return {
    id: `t-${date}`,
    date,
    timestamp: ISO_NOW,
    symptoms: { ...EMPTY_SYMPTOMS, ...symptoms },
    severity: 5,
    notes: '',
  };
}

describe('predictRisk', () => {
  test('probabilities are well-formed (3 classes, sum to 1)', () => {
    const out = predictRisk({
      symptoms: { ...EMPTY_SYMPTOMS },
      exposure: emptyExposure(),
      logCount: 1,
    });

    expect(out.classes).toEqual(['no_lyme', 'early_lyme', 'disseminated_lyme']);
    expect(out.probabilities).toHaveLength(3);
    const sum = out.probabilities.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
    out.probabilities.forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });
  });

  test('empty inputs land in low Lyme probability', () => {
    const out = predictRisk({
      symptoms: { ...EMPTY_SYMPTOMS },
      exposure: emptyExposure(),
      logCount: 1,
    });

    // Empty case should overwhelmingly land in no_lyme.
    expect(out.topClass).toBe('no_lyme');
    expect(out.lymeProbability).toBeLessThan(0.5);
  });

  test('classic Lyme case yields high Lyme probability', () => {
    const classic: SymptomChecks = {
      ...EMPTY_SYMPTOMS,
      fatigue: true,
      jointPain: true,
      headache: true,
      muscleAches: true,
      fever: true,
    };
    const exposure: ExposureData = {
      ...emptyExposure(),
      outdoorActivity: true,
      locationRisk: 'nh',
      county: 'Carroll',
      foundTick: 'yes_attached',
      rashStatus: 'circular',
      nearWoods: true,
    };

    const out = predictRisk({ symptoms: classic, exposure, logCount: 5 });

    expect(out.lymeProbability).toBeGreaterThan(0.7);
    // top class is either early or disseminated Lyme, NOT no_lyme
    expect(['early_lyme', 'disseminated_lyme']).toContain(out.topClass);
  });

  test('adding a red flag strictly increases disseminated probability', () => {
    const base: SymptomChecks = {
      ...EMPTY_SYMPTOMS,
      fatigue: true,
      jointPain: true,
      headache: true,
    };
    const withRedFlag: SymptomChecks = {
      ...base,
      neckStiffness: true,
    };

    const exposure: ExposureData = {
      ...emptyExposure(),
      locationRisk: 'nh',
      county: 'Carroll',
      nearWoods: true,
    };

    const baseOut = predictRisk({ symptoms: base, exposure, logCount: 5 });
    const flagOut = predictRisk({
      symptoms: withRedFlag,
      exposure,
      logCount: 5,
    });

    // Disseminated probability must rise when a red-flag symptom is added.
    expect(flagOut.probabilities[2]).toBeGreaterThan(baseOut.probabilities[2]);
  });

  test('contributions are sorted by |deltaLymeProb| descending', () => {
    const out = predictRisk({
      symptoms: {
        ...EMPTY_SYMPTOMS,
        fatigue: true,
        jointPain: true,
        headache: true,
        fever: true,
        muscleAches: true,
      },
      exposure: {
        ...emptyExposure(),
        outdoorActivity: true,
        locationRisk: 'nh',
        county: 'Carroll',
        foundTick: 'yes_attached',
        rashStatus: 'circular',
        nearWoods: true,
      },
      logCount: 5,
    });

    expect(out.contributions.length).toBeGreaterThan(0);
    for (let i = 1; i < out.contributions.length; i++) {
      expect(Math.abs(out.contributions[i].deltaLymeProb)).toBeLessThanOrEqual(
        Math.abs(out.contributions[i - 1].deltaLymeProb)
      );
    }
  });
});

describe('calculateRiskML', () => {
  test('returns RiskAssessment shape with extras', () => {
    const logs: SymptomLog[] = [
      makeLog({ fatigue: true, jointPain: true }, '2026-05-12'),
    ];
    const assessment = calculateRiskML(logs, {
      ...emptyExposure(),
      locationRisk: 'nh',
      county: 'Carroll',
      nearWoods: true,
    });

    expect(['low', 'moderate', 'high', 'critical']).toContain(assessment.level);
    expect(assessment.score).toBeGreaterThanOrEqual(0);
    expect(assessment.score).toBeLessThanOrEqual(100);
    expect(assessment.classProbabilities).toHaveLength(3);
    expect(assessment.lymeProbability).toBeGreaterThanOrEqual(0);
    expect(assessment.lymeProbability).toBeLessThanOrEqual(1);
    expect(Array.isArray(assessment.contributions)).toBe(true);
  });

  test('any red-flag symptom forces critical level', () => {
    const logs: SymptomLog[] = [
      makeLog({ facialDroop: true, fatigue: true }, '2026-05-12'),
    ];
    const out = calculateRiskML(logs, emptyExposure());
    expect(out.level).toBe('critical');
    expect(out.redFlags.length).toBeGreaterThan(0);
    expect(out.recommendation).toMatch(/ER|911|emergency/i);
  });

  test('empty case has low risk', () => {
    const out = calculateRiskML([], null);
    expect(out.level).toBe('low');
    expect(out.lymeProbability).toBeLessThan(0.5);
  });
});
