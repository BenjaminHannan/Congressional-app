/**
 * Trace — Symptom Definitions
 *
 * Lyme-specific symptom metadata. Each symptom includes a plain-language
 * description and whether it constitutes a red flag requiring urgent care.
 *
 * Medical content reviewed by clinical advisor.
 * Sources: CDC Lyme Disease guidance, IDSA 2020 guidelines.
 */

import { SymptomInfo, SymptomChecks } from './types';

export const SYMPTOMS: SymptomInfo[] = [
  {
    key: 'fatigue',
    label: 'Fatigue',
    description: 'Persistent tiredness that doesn\'t improve with rest',
    isRedFlag: false,
  },
  {
    key: 'jointPain',
    label: 'Joint Pain',
    description: 'Pain in one or more joints, especially if it moves between joints',
    isRedFlag: false,
  },
  {
    key: 'headache',
    label: 'Headache',
    description: 'Persistent or severe headache',
    isRedFlag: false,
  },
  {
    key: 'brainFog',
    label: 'Brain Fog',
    description: 'Difficulty concentrating, memory issues, feeling "cloudy"',
    isRedFlag: false,
  },
  {
    key: 'fever',
    label: 'Fever',
    description: 'Temperature above 100.4°F (38°C)',
    isRedFlag: false,
  },
  {
    key: 'muscleAches',
    label: 'Muscle Aches',
    description: 'Generalized muscle pain or soreness',
    isRedFlag: false,
  },
  {
    key: 'chills',
    label: 'Chills',
    description: 'Feeling cold, shivering, often with fever',
    isRedFlag: false,
  },
  {
    key: 'swollenLymphNodes',
    label: 'Swollen Lymph Nodes',
    description: 'Tender, swollen glands, especially near a possible bite site',
    isRedFlag: false,
  },
  {
    key: 'rash',
    label: 'Rash',
    description: 'Any new rash — circular "bullseye" or otherwise',
    isRedFlag: false,
  },
  {
    key: 'dizziness',
    label: 'Dizziness',
    description: 'Feeling lightheaded or off-balance',
    isRedFlag: false,
  },
  {
    key: 'nightSweats',
    label: 'Night Sweats',
    description: 'Drenching sweats during sleep',
    isRedFlag: false,
  },
  // ─── Red Flag Symptoms (require urgent medical attention) ──────────────
  {
    key: 'neckStiffness',
    label: 'Severe Neck Stiffness',
    description: 'Stiff neck with headache — may indicate Lyme meningitis',
    isRedFlag: true,
    redFlagMessage:
      'Severe headache combined with neck stiffness can indicate Lyme meningitis. ' +
      'This requires urgent medical evaluation. Go to the ER or call 911 if symptoms are severe.',
  },
  {
    key: 'facialDroop',
    label: 'Facial Droop / Weakness',
    description: 'One side of face drooping or weak — Bell\'s palsy',
    isRedFlag: true,
    redFlagMessage:
      'Facial droop (Bell\'s palsy) is a classic sign of neurological Lyme disease. ' +
      'Go to the ER immediately. This is treatable but requires prompt medical care.',
  },
  {
    key: 'heartPalpitations',
    label: 'Heart Palpitations',
    description: 'Racing, skipping, or pounding heartbeat with fatigue',
    isRedFlag: true,
    redFlagMessage:
      'Heart palpitations with fatigue can indicate Lyme carditis, which affects the heart\'s ' +
      'electrical system. Seek emergency medical care immediately. Call 911 if you feel faint.',
  },
];

/** Default empty symptom state */
export const EMPTY_SYMPTOMS: SymptomChecks = {
  fatigue: false,
  jointPain: false,
  headache: false,
  brainFog: false,
  fever: false,
  neckStiffness: false,
  facialDroop: false,
  heartPalpitations: false,
  rash: false,
  muscleAches: false,
  chills: false,
  swollenLymphNodes: false,
  dizziness: false,
  nightSweats: false,
};

/** Get active red flags from a symptom check */
export function getRedFlags(symptoms: SymptomChecks): SymptomInfo[] {
  return SYMPTOMS.filter((s) => s.isRedFlag && symptoms[s.key]);
}

/** Count how many symptoms are checked */
export function countSymptoms(symptoms: SymptomChecks): number {
  return Object.values(symptoms).filter(Boolean).length;
}
