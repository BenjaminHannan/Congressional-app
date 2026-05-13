/**
 * Trace — Risk Engine Tests
 *
 * Pure-TS unit tests for the 0–100 Lyme risk synthesizer. These exist so the
 * scoring weights and red-flag escalation logic can't silently regress as the
 * app evolves. The behavioural contracts asserted below are what the
 * risk-engine docs / README promise users.
 */

import { calculateRisk } from '../risk-engine';
import { EMPTY_SYMPTOMS } from '../symptoms';
import { SymptomLog, ExposureData } from '../types';

const ISO_NOW = '2026-05-12T12:00:00.000Z';

function makeLog(
  overrides: Partial<Omit<SymptomLog, 'symptoms'>> & {
    symptoms?: Partial<SymptomLog['symptoms']>;
  } = {}
): SymptomLog {
  const { symptoms: symptomOverrides = {}, ...rest } = overrides;
  return {
    id: 'test-id',
    date: '2026-05-12',
    timestamp: ISO_NOW,
    symptoms: { ...EMPTY_SYMPTOMS, ...symptomOverrides },
    severity: 5,
    notes: '',
    ...rest,
  };
}

describe('calculateRisk', () => {
  test('no symptoms and no exposure → score 0, low risk, recommends monitoring', () => {
    const result = calculateRisk([], null);

    expect(result.score).toBe(0);
    expect(result.level).toBe('low');
    expect(result.redFlags).toHaveLength(0);
    expect(result.factors).toHaveLength(0);
    // The "monitor" recommendation copy uses the word "monitoring".
    expect(result.recommendation.toLowerCase()).toContain('monitor');
  });

  test('any red-flag symptom escalates to critical with ER recommendation', () => {
    const redFlagLog = makeLog({
      symptoms: { facialDroop: true },
      severity: 8,
    });

    const result = calculateRisk([redFlagLog], null);

    expect(result.level).toBe('critical');
    expect(result.redFlags.length).toBeGreaterThan(0);
    // Recommendation must clearly direct the user to the ER.
    expect(result.recommendation).toMatch(/ER|911|emergency/i);
  });

  test('bullseye rash + tick attached + endemic NH county → score ≥ 60', () => {
    const exposure: ExposureData = {
      dateFirstSymptoms: '2026-05-01',
      outdoorActivity: true,
      activityDetails: 'hiking the AT',
      locationRisk: 'nh',
      county: 'Carroll', // very_high risk category in nh-data
      foundTick: 'yes_attached',
      rashStatus: 'circular',
      recentFluLike: false,
      petsOutdoor: false,
      nearWoods: true,
    };

    const result = calculateRisk([], exposure);

    expect(result.score).toBeGreaterThanOrEqual(60);
    // With no red flags this should land in 'high' (51-75) or higher.
    expect(['high', 'critical']).toContain(result.level);
  });

  test('sustained 3+ day fatigue pattern adds duration points', () => {
    const fatigueLogs: SymptomLog[] = [
      makeLog({ id: '1', date: '2026-05-12', symptoms: { fatigue: true } }),
      makeLog({ id: '2', date: '2026-05-11', symptoms: { fatigue: true } }),
      makeLog({ id: '3', date: '2026-05-10', symptoms: { fatigue: true } }),
    ];
    const singleLog = [fatigueLogs[0]];

    const sustained = calculateRisk(fatigueLogs, null);
    const single = calculateRisk(singleLog, null);

    expect(sustained.score).toBeGreaterThan(single.score);
    expect(sustained.factors.some((f) => /persistent fatigue/i.test(f))).toBe(
      true
    );
  });
});
