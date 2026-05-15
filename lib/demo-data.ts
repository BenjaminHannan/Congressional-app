/**
 * Trace — Demo Data Seeder
 *
 * Loads a curated 7-day "classic Lyme trajectory" plus matching exposure and
 * profile records into AsyncStorage. Used to demo the trajectory sparkline,
 * the ML risk gauge, and the doctor-report PDF without spending 90 seconds
 * tapping symptom checkboxes during a live recording.
 *
 * Trigger: long-press the version number on the About screen. The function
 * is intentionally NOT bound to a visible button so a real user never
 * accidentally overwrites their data.
 */

import {
  saveProfile,
  saveExposure,
  saveSymptomLog,
  clearAllData,
  generateId,
} from './storage';
import { EMPTY_SYMPTOMS } from './symptoms';
import { SymptomChecks, SymptomLog, ExposureData, UserProfile } from './types';

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function s(overrides: Partial<SymptomChecks>): SymptomChecks {
  return { ...EMPTY_SYMPTOMS, ...overrides };
}

/** Seven-day classic Lyme climb. Day 0 = today (newest). */
const TRAJECTORY: { daysAgo: number; severity: number; symptoms: Partial<SymptomChecks>; notes?: string }[] = [
  {
    daysAgo: 6,
    severity: 4,
    symptoms: { fatigue: true, fever: true, muscleAches: true, chills: true },
    notes: 'Felt like a sudden flu — started after a weekend hike near Hanover.',
  },
  {
    daysAgo: 5,
    severity: 5,
    symptoms: { fatigue: true, fever: true, headache: true, muscleAches: true, chills: true },
    notes: 'Fever broke briefly but came back this evening.',
  },
  {
    daysAgo: 4,
    severity: 6,
    symptoms: { fatigue: true, headache: true, jointPain: true, muscleAches: true, swollenLymphNodes: true },
    notes: 'Joint pain showing up in left knee and right wrist — moving around.',
  },
  {
    daysAgo: 3,
    severity: 7,
    symptoms: { fatigue: true, jointPain: true, brainFog: true, headache: true },
    notes: 'Hard to focus at school. Joints stiff in the morning.',
  },
  {
    daysAgo: 2,
    severity: 7,
    symptoms: { fatigue: true, jointPain: true, brainFog: true, headache: true, dizziness: true },
  },
  {
    daysAgo: 1,
    severity: 8,
    symptoms: { fatigue: true, jointPain: true, brainFog: true, neckStiffness: true, headache: true },
    notes: 'Neck feels stiff. This is starting to scare me.',
  },
  {
    daysAgo: 0,
    severity: 9,
    symptoms: {
      fatigue: true,
      jointPain: true,
      brainFog: true,
      neckStiffness: true,
      facialDroop: true,
      headache: true,
    },
    notes: 'Mom noticed the left side of my face is drooping. Going to ER.',
  },
];

const DEMO_EXPOSURE: ExposureData = {
  dateFirstSymptoms: isoDate(6),
  outdoorActivity: true,
  activityDetails: 'Hiking with friends — went off-trail near a meadow.',
  locationRisk: 'nh',
  county: 'Grafton',
  foundTick: 'yes_attached',
  rashStatus: 'circular',
  recentFluLike: false,
  petsOutdoor: true,
  nearWoods: true,
};

const DEMO_PROFILE: UserProfile = {
  onboardingComplete: true,
  entryPath: 'bitten',
  name: 'Demo',
  startDate: isoDate(6),
};

/**
 * Wipe all stored data and seed the demo dataset. Returns the number of
 * symptom logs written.
 */
export async function seedDemoData(): Promise<number> {
  await clearAllData();
  await saveProfile(DEMO_PROFILE);
  await saveExposure(DEMO_EXPOSURE);

  for (const day of TRAJECTORY) {
    const log: SymptomLog = {
      id: generateId(),
      date: isoDate(day.daysAgo),
      timestamp: new Date(Date.now() - day.daysAgo * 86400_000).toISOString(),
      symptoms: s(day.symptoms),
      severity: day.severity,
      notes: day.notes ?? '',
    };
    await saveSymptomLog(log);
  }

  return TRAJECTORY.length;
}
