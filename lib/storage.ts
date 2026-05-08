/**
 * Trace — Local Storage Layer
 *
 * All data stays on the user's device. No cloud sync, no analytics,
 * no third-party trackers. Privacy is a feature, not an afterthought.
 *
 * Uses AsyncStorage with JSON serialization.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SymptomLog, ExposureData, UserProfile } from './types';

// Storage keys
const KEYS = {
  PROFILE: '@trace/profile',
  SYMPTOMS: '@trace/symptoms',
  EXPOSURE: '@trace/exposure',
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
}
