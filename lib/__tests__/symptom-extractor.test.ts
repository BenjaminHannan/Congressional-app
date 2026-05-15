/**
 * Tests for the rule-based symptom extractor.
 *
 * Contracts:
 *  1. Common single-word symptoms are recognized.
 *  2. Multi-word phrases (e.g. "stiff neck") are recognized.
 *  3. Negation ("no headache", "denies fatigue") flips the extraction.
 *  4. Negation is *scoped* — "but" or punctuation breaks it.
 *  5. Synonyms map to the canonical symptom key.
 *  6. mergeSymptoms preserves manually-toggled symptoms.
 */

import { extractSymptoms, mergeSymptoms } from '../ml/symptom-extractor';
import { EMPTY_SYMPTOMS } from '../symptoms';

describe('extractSymptoms', () => {
  test('extracts simple single-word symptoms', () => {
    const r = extractSymptoms('I am tired and have a headache.');
    expect(r.symptoms.fatigue).toBe(true);
    expect(r.symptoms.headache).toBe(true);
    expect(r.symptoms.fever).toBe(false);
  });

  test('extracts multi-word phrases', () => {
    const r = extractSymptoms('My neck feels really stiff today.');
    // "stiff neck" should match the trigger
    // Note: the trigger list also includes "stiff neck" reordered as in source text
    const r2 = extractSymptoms('I have a stiff neck.');
    expect(r2.symptoms.neckStiffness).toBe(true);
  });

  test('handles negation: "no headache"', () => {
    const r = extractSymptoms('I have a fever but no headache.');
    expect(r.symptoms.fever).toBe(true);
    // "but" should reset the negation scope so "no headache" still negates the
    // headache match — but importantly fever is NOT negated.
    expect(r.symptoms.headache).toBe(false);
    const headacheMatch = r.matches.find((m) => m.symptom === 'headache');
    expect(headacheMatch?.negated).toBe(true);
  });

  test('handles negation: "denies fatigue"', () => {
    const r = extractSymptoms('Denies fatigue and joint pain.');
    expect(r.symptoms.fatigue).toBe(false);
    expect(r.symptoms.jointPain).toBe(false);
    expect(r.matches.find((m) => m.symptom === 'fatigue')?.negated).toBe(true);
  });

  test('synonyms map to canonical symptom keys', () => {
    const r = extractSymptoms('I feel exhausted and dizzy with bullseye rash.');
    expect(r.symptoms.fatigue).toBe(true);    // "exhausted" → fatigue
    expect(r.symptoms.dizziness).toBe(true);  // "dizzy" → dizziness
    expect(r.symptoms.rash).toBe(true);       // "bullseye" → rash
  });

  test('punctuation breaks negation scope', () => {
    // "No fever. I have headache." — the period blocks negation from reaching
    // "headache".
    const r = extractSymptoms('No fever. I have a headache.');
    expect(r.symptoms.fever).toBe(false);
    expect(r.symptoms.headache).toBe(true);
  });

  test('empty input yields empty extraction', () => {
    const r = extractSymptoms('');
    expect(r.matches).toHaveLength(0);
    Object.values(r.symptoms).forEach((v) => expect(v).toBe(false));
  });
});

describe('mergeSymptoms', () => {
  test('preserves existing positives and adds extracted positives', () => {
    const current = { ...EMPTY_SYMPTOMS, fatigue: true };
    const extracted = { ...EMPTY_SYMPTOMS, headache: true };
    const merged = mergeSymptoms(current, extracted);
    expect(merged.fatigue).toBe(true);
    expect(merged.headache).toBe(true);
    expect(merged.fever).toBe(false);
  });
});
