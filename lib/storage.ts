/**
 * Trace — Local Storage Layer
 *
 * All data stays on the user's device. No cloud sync, no analytics,
 * no third-party trackers. Privacy is a feature, not an afterthought.
 *
 * Uses AsyncStorage with JSON serialization.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SymptomLog, ExposureData, UserProfile, TickSighting } from './types';

// Storage keys
const KEYS = {
  PROFILE: '@trace/profile',
  SYMPTOMS: '@trace/symptoms',
  EXPOSURE: '@trace/exposure',
  TICK_SIGHTINGS: '@trace/tick-sightings',
};

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(): Promise<UserProfile | null> {
  const data = await AsyncStorage.getItem(KEYS.PROFILE);
  return data ? JSON.parse(data) : null;
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
}

// ─── Symptom Logs ────────────────────────────────────────────────────────────

export async function getSymptomLogs(): Promise<SymptomLog[]> {
  const data = await AsyncStorage.getItem(KEYS.SYMPTOMS);
  return data ? JSON.parse(data) : [];
}

export async function saveSymptomLog(log: SymptomLog): Promise<void> {
  const logs = await getSymptomLogs();
  // Replace if same date exists, otherwise add
  const existingIndex = logs.findIndex((l) => l.date === log.date);
  if (existingIndex >= 0) {
    logs[existingIndex] = log;
  } else {
    logs.unshift(log); // newest first
  }
  await AsyncStorage.setItem(KEYS.SYMPTOMS, JSON.stringify(logs));
}

export async function deleteSymptomLog(id: string): Promise<void> {
  const logs = await getSymptomLogs();
  const filtered = logs.filter((l) => l.id !== id);
  await AsyncStorage.setItem(KEYS.SYMPTOMS, JSON.stringify(filtered));
}

// ─── Exposure Data ───────────────────────────────────────────────────────────

export async function getExposure(): Promise<ExposureData | null> {
  const data = await AsyncStorage.getItem(KEYS.EXPOSURE);
  return data ? JSON.parse(data) : null;
}

export async function saveExposure(exposure: ExposureData): Promise<void> {
  await AsyncStorage.setItem(KEYS.EXPOSURE, JSON.stringify(exposure));
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/** Generate a simple unique ID */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Clear all app data (for testing / reset) */
export async function clearAllData(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.PROFILE);
  await AsyncStorage.removeItem(KEYS.SYMPTOMS);
  await AsyncStorage.removeItem(KEYS.EXPOSURE);
  await AsyncStorage.removeItem(KEYS.TICK_SIGHTINGS);
}

// ─── Tick Sightings ──────────────────────────────────────────────────────────

/**
 * Get all user-reported tick sightings. Sightings are stored locally and
 * never leave the device in v1.1 — the "community" overlay on the map
 * comes from `lib/tick-sightings.ts` and is merged in at the UI layer.
 */
export async function getTickSightings(): Promise<TickSighting[]> {
  const data = await AsyncStorage.getItem(KEYS.TICK_SIGHTINGS);
  return data ? JSON.parse(data) : [];
}

export async function saveTickSighting(sighting: TickSighting): Promise<void> {
  const all = await getTickSightings();
  all.unshift(sighting);
  await AsyncStorage.setItem(KEYS.TICK_SIGHTINGS, JSON.stringify(all));
}

export async function deleteTickSighting(id: string): Promise<void> {
  const all = await getTickSightings();
  const filtered = all.filter((s) => s.id !== id);
  await AsyncStorage.setItem(KEYS.TICK_SIGHTINGS, JSON.stringify(filtered));
}
