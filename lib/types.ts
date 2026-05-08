/**
 * Trace — Core Data Types
 *
 * These types define the shape of all data stored locally on the user's device.
 * Privacy-first: nothing leaves the phone unless the user explicitly exports a PDF.
 */

// ─── Symptom Logging ─────────────────────────────────────────────────────────

/** The Lyme-specific symptoms Trace tracks. Each maps to a known clinical sign. */
export interface SymptomChecks {
  fatigue: boolean;           // Persistent, sleep-resistant fatigue
  jointPain: boolean;         // Migrating joint pain (classic Lyme pattern)
  headache: boolean;          // Can indicate neuro-Lyme
  brainFog: boolean;          // Cognitive issues, difficulty concentrating
  fever: boolean;             // Low-grade fever common in early Lyme
  neckStiffness: boolean;     // RED FLAG — possible Lyme meningitis
  facialDroop: boolean;       // RED FLAG — Bell's palsy, classic neuro-Lyme
  heartPalpitations: boolean; // RED FLAG — possible Lyme carditis
  rash: boolean;              // Erythema migrans (bullseye) or atypical
  muscleAches: boolean;       // Myalgia
  chills: boolean;            // Often accompanies fever
  swollenLymphNodes: boolean; // Near the bite site typically
  dizziness: boolean;         // Can indicate neuro involvement
  nightSweats: boolean;       // Common in co-infections (babesiosis)
}

/** A single daily symptom log entry */
export interface SymptomLog {
  id: string;
  date: string;               // ISO date string (YYYY-MM-DD)
  timestamp: string;          // ISO datetime of when log was created
  symptoms: SymptomChecks;
  severity: number;           // 1-10 scale
  notes: string;
  temperature?: number;       // Optional, in Fahrenheit
}

// ─── Exposure Assessment ─────────────────────────────────────────────────────

export type TickFoundStatus = 'no' | 'yes_removed' | 'yes_attached' | 'unsure';
export type RashStatus = 'no' | 'circular' | 'other' | 'unsure';
export type LocationRisk = 'nh' | 'other_endemic' | 'non_endemic' | 'unsure';
export type EntryPath = 'bitten' | 'not_feeling_right' | 'tracking';

/** Exposure context — filled out during onboarding or updated later */
export interface ExposureData {
  dateFirstSymptoms: string;   // When user first noticed something wrong
  outdoorActivity: boolean;    // Recent outdoor activity in tick habitat
  activityDetails: string;     // What/where
  locationRisk: LocationRisk;  // Where they live/were exposed
  county: string;              // NH county if applicable
  foundTick: TickFoundStatus;
  rashStatus: RashStatus;
  recentFluLike: boolean;      // Recent flu-like illness before current symptoms
  petsOutdoor: boolean;        // Pets that go outside (tick vector)
  nearWoods: boolean;          // Lives near woods/tall grass/leaf litter
}

// ─── User Profile ────────────────────────────────────────────────────────────

export interface UserProfile {
  onboardingComplete: boolean;
  entryPath: EntryPath;
  name: string;
  startDate: string;          // When they started using Trace
}

// ─── Risk Assessment ─────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface RiskAssessment {
  level: RiskLevel;
  score: number;              // 0-100
  factors: string[];          // Human-readable factors contributing to score
  redFlags: string[];         // Active red-flag symptoms
  recommendation: string;     // What to do next
  updatedAt: string;          // When this assessment was last calculated
}

// ─── Symptom Metadata ────────────────────────────────────────────────────────

export interface SymptomInfo {
  key: keyof SymptomChecks;
  label: string;
  description: string;
  isRedFlag: boolean;
  redFlagMessage?: string;
}
