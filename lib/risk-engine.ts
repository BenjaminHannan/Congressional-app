/**
 * Trace — Risk Synthesis Engine
 *
 * Calculates a Lyme disease risk assessment based on:
 * - Symptom patterns (which symptoms, how many, severity, duration)
 * - Exposure context (location, outdoor activity, tick contact, season)
 * - NH county-level incidence data
 *
 * This is NOT a diagnostic tool. It synthesizes publicly available clinical
 * guidance (CDC, IDSA 2020) into a structured assessment that helps patients
 * have informed conversations with their doctors.
 *
 * Medical content reviewed by clinical advisor.
 */

import { SymptomLog, ExposureData, RiskAssessment, RiskLevel, SymptomChecks } from './types';
import { getRedFlags } from './symptoms';
import { getCountyData, NH_STATE_AVERAGE_RATE, US_NATIONAL_AVERAGE_RATE } from './nh-data';

/**
 * Calculate overall Lyme risk assessment.
 *
 * Scoring approach:
 * - Symptom pattern score (0-40 points)
 * - Exposure context score (0-30 points)
 * - Geographic risk score (0-20 points)
 * - Duration/pattern score (0-10 points)
 *
 * Levels:
 * - 0-25:  low
 * - 26-50: moderate
 * - 51-75: high
 * - 76+:   critical (red flags present)
 */
export function calculateRisk(
  logs: SymptomLog[],
  exposure: ExposureData | null
): RiskAssessment {
  let score = 0;
  const factors: string[] = [];
  const redFlags: string[] = [];

  // ─── 1. Symptom Pattern Score (0-40) ───────────────────────────────────

  if (logs.length > 0) {
    const latestLog = logs[0]; // logs are sorted newest-first
    const symptomCount = Object.values(latestLog.symptoms).filter(Boolean).length;
    const severity = latestLog.severity;

    // Points for number of symptoms
    if (symptomCount >= 5) {
      score += 20;
      factors.push(`${symptomCount} active symptoms reported`);
    } else if (symptomCount >= 3) {
      score += 12;
      factors.push(`${symptomCount} active symptoms reported`);
    } else if (symptomCount >= 1) {
      score += 5;
      factors.push(`${symptomCount} symptom(s) reported`);
    }

    // Points for severity
    if (severity >= 7) {
      score += 10;
      factors.push('High symptom severity');
    } else if (severity >= 4) {
      score += 5;
      factors.push('Moderate symptom severity');
    }

    // Classic Lyme symptom cluster: fatigue + joint pain + headache
    const s = latestLog.symptoms;
    if (s.fatigue && s.jointPain && s.headache) {
      score += 10;
      factors.push('Classic Lyme symptom cluster (fatigue, joint pain, headache)');
    }

    // Migrating joint pain is highly suggestive
    if (s.jointPain && s.muscleAches) {
      score += 5;
      factors.push('Joint and muscle pain pattern');
    }

    // Red flag detection
    const activeRedFlags = getRedFlags(latestLog.symptoms);
    for (const rf of activeRedFlags) {
      redFlags.push(rf.redFlagMessage || rf.label);
      score += 15; // Each red flag significantly elevates risk
    }
  }

  // ─── 2. Exposure Context Score (0-30) ──────────────────────────────────

  if (exposure) {
    if (exposure.outdoorActivity) {
      score += 8;
      factors.push('Recent outdoor activity in potential tick habitat');
    }

    if (exposure.foundTick === 'yes_attached') {
      score += 15;
      factors.push('Tick was found still attached');
    } else if (exposure.foundTick === 'yes_removed') {
      score += 10;
      factors.push('Tick was found and removed');
    } else if (exposure.foundTick === 'unsure') {
      score += 5;
      factors.push('Unsure about tick exposure');
    }

    if (exposure.rashStatus === 'circular') {
      score += 15;
      factors.push('Circular/bullseye rash reported — highly suggestive of Lyme');
    } else if (exposure.rashStatus === 'other') {
      score += 5;
      factors.push('Non-circular rash reported');
    }

    if (exposure.nearWoods) {
      score += 5;
      factors.push('Lives or spends time near wooded/grassy areas');
    }

    if (exposure.petsOutdoor) {
      score += 2;
      factors.push('Pets go outdoors (can carry ticks inside)');
    }
  }

  // ─── 3. Geographic Risk Score (0-20) ───────────────────────────────────

  if (exposure?.locationRisk === 'nh') {
    score += 15;
    factors.push('Located in New Hampshire — one of the highest-incidence states');

    if (exposure.county) {
      const countyData = getCountyData(exposure.county);
      if (countyData) {
        if (countyData.riskCategory === 'very_high') {
          score += 5;
          factors.push(
            `${countyData.name} County: ~${countyData.incidenceRate} cases/100k ` +
            `(${Math.round(countyData.incidenceRate / US_NATIONAL_AVERAGE_RATE)}x national average)`
          );
        }
      }
    }
  } else if (exposure?.locationRisk === 'other_endemic') {
    score += 10;
    factors.push('Located in a Lyme-endemic area');
  }

  // ─── 4. Duration/Pattern Score (0-10) ──────────────────────────────────

  if (logs.length >= 7) {
    score += 5;
    factors.push(`${logs.length} days of symptom tracking — sustained pattern`);
  }

  if (logs.length >= 3) {
    // Check if symptoms are consistent across multiple days
    const recentLogs = logs.slice(0, 3);
    const allHaveFatigue = recentLogs.every((l) => l.symptoms.fatigue);
    if (allHaveFatigue) {
      score += 5;
      factors.push('Persistent fatigue across multiple days');
    }
  }

  // ─── Calculate Level ───────────────────────────────────────────────────

  // Cap at 100
  score = Math.min(score, 100);

  let level: RiskLevel;
  let recommendation: string;

  if (redFlags.length > 0) {
    level = 'critical';
    recommendation =
      'You have symptoms that require urgent medical attention. ' +
      'Go to the ER or call 911 immediately. Do not wait for a scheduled appointment.';
  } else if (score >= 51) {
    level = 'high';
    recommendation =
      'Your symptom pattern and exposure history are consistent with possible Lyme disease. ' +
      'See a doctor as soon as possible. Generate the Doctor Report below to bring with you. ' +
      'Ask about empirical doxycycline treatment — in endemic areas, IDSA guidelines support ' +
      'starting treatment based on clinical suspicion without waiting for test results.';
  } else if (score >= 26) {
    level = 'moderate';
    recommendation =
      'Some of your symptoms and exposure factors are associated with Lyme disease. ' +
      'Consider scheduling an appointment with your doctor. Continue logging symptoms daily — ' +
      'a clear pattern over several days strengthens your case.';
  } else {
    level = 'low';
    recommendation =
      'Based on current data, your risk appears low. Continue monitoring and logging symptoms. ' +
      'If new symptoms develop or existing ones worsen, your risk assessment will update.';
  }

  return {
    level,
    score,
    factors,
    redFlags,
    recommendation,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get the advocacy text for the "I was told it's a virus" feature.
 * Provides evidence-based language patients can bring to their doctor.
 */
export function getAdvocacyTips(): { title: string; text: string }[] {
  return [
    {
      title: 'Ask for Lyme-specific testing',
      text:
        '"I\'d like to be tested for Lyme disease. I live in New Hampshire, ' +
        'which has one of the highest incidence rates in the country, and my ' +
        'symptoms are consistent with early Lyme."',
    },
    {
      title: 'Know about test timing',
      text:
        'The standard two-tier test (ELISA + Western blot) can be negative in the ' +
        'first 2-4 weeks of infection because antibodies haven\'t developed yet. ' +
        'A negative early test does NOT rule out Lyme disease.',
    },
    {
      title: 'Ask about empirical treatment',
      text:
        '"The IDSA 2020 guidelines recommend that in endemic areas, clinicians may ' +
        'treat based on clinical suspicion alone, without waiting for serological ' +
        'confirmation. Can we discuss starting doxycycline?"',
    },
    {
      title: 'Share your symptom timeline',
      text:
        'Use the Doctor Report feature to generate a PDF of your symptom history. ' +
        'Seeing dated entries with specific symptoms is more convincing than a ' +
        'verbal description from memory.',
    },
    {
      title: 'Request a follow-up',
      text:
        '"If this isn\'t Lyme, I\'d like to understand what else it could be. ' +
        'Can we schedule a follow-up in one week if symptoms don\'t improve?"',
    },
  ];
}
