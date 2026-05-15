/**
 * Trace ML — Fusion Risk Model (pure-TS inference)
 *
 * Walks a serialized sklearn GradientBoostingClassifier exported by
 * `ml-server/train_risk_fusion.py` and returns a calibrated probability over
 * { no_lyme, early_lyme, disseminated_lyme } plus a single overall "Lyme
 * probability" (early + disseminated) for the home-screen risk gauge.
 *
 * Why this lives on-device:
 *   - The model is ~100 KB JSON, walks in microseconds, ships as a static asset.
 *   - No native modules → works in Expo Go, no EAS dev build required.
 *   - Photos, symptoms, exposure data never leave the phone for risk synthesis.
 *
 * The math:
 *   F_k(x) = init_k + learning_rate * Σ_{stage} tree_{stage,k}(x)
 *   p_k    = softmax(F)_k
 *
 * Per-feature contributions are computed by single-feature ablation (zeroing
 * one feature at a time and re-running inference). This is not proper SHAP
 * but is cheap and informative enough for a UI hint.
 */

import { SymptomChecks, ExposureData } from '../types';
// Bundled by Metro at build time. Path is relative to this file.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MODEL: GbdtModel = require('../../assets/models/risk_model.json');

// ─── Types matching the JSON shape from train_risk_fusion.py ────────────────

interface InternalNode {
  f: number;        // feature index
  t: number;        // threshold (split is feature <= t → left)
  l: number;        // left child index
  r: number;        // right child index
}
interface LeafNode { v: number }
type TreeNode = InternalNode | LeafNode;
type Tree = TreeNode[];

interface GbdtModel {
  version: number;
  type: 'gbdt-multiclass';
  n_classes: number;
  classes: string[];          // ["no_lyme", "early_lyme", "disseminated_lyme"]
  feature_names: string[];    // 32 entries, in vector order
  learning_rate: number;
  init: number[];             // log-prior per class
  stages: Tree[][];           // (n_stages, n_classes, nodes)
}

// ─── Feature encoding ───────────────────────────────────────────────────────
//
// Kept in lockstep with ml-server/gen_synthetic_cohort.py::feature_names().
// If either side changes, both must change together. The fusion model JSON
// embeds the column order so we don't have to hard-code it twice — we derive
// the encoder from MODEL.feature_names at startup.

const SYMPTOM_KEYS_IN_VECTOR: (keyof SymptomChecks)[] = [
  'fatigue', 'jointPain', 'headache', 'brainFog', 'fever',
  'neckStiffness', 'facialDroop', 'heartPalpitations',
  'rash', 'muscleAches', 'chills', 'swollenLymphNodes',
  'dizziness', 'nightSweats',
];

const TICK_STATES = ['no', 'yes_removed', 'yes_attached', 'unsure'] as const;
const RASH_STATES = ['no', 'circular', 'other', 'unsure'] as const;
const LOCATION_STATES = ['nh', 'other_endemic', 'non_endemic', 'unsure'] as const;

const NH_COUNTY_RATES: Record<string, number> = {
  Belknap: 145, Carroll: 160, Cheshire: 130, Coos: 55,
  Grafton: 120, Hillsborough: 110, Merrimack: 125,
  Rockingham: 155, Strafford: 140, Sullivan: 115,
};
const US_NATIONAL_AVERAGE = 9;

export interface FusionInput {
  symptoms: SymptomChecks;
  exposure: ExposureData | null;
  logCount: number;
}

export function encodeFeatures(input: FusionInput): number[] {
  const { symptoms, exposure, logCount } = input;
  const vec: Record<string, number> = {};

  for (const k of SYMPTOM_KEYS_IN_VECTOR) {
    vec[k] = symptoms[k] ? 1 : 0;
  }

  const tick = exposure?.foundTick ?? 'no';
  for (const s of TICK_STATES) vec[`foundTick_${s}`] = tick === s ? 1 : 0;

  const rash = exposure?.rashStatus ?? 'no';
  for (const s of RASH_STATES) vec[`rashStatus_${s}`] = rash === s ? 1 : 0;

  const loc = exposure?.locationRisk ?? 'unsure';
  for (const s of LOCATION_STATES) vec[`locationRisk_${s}`] = loc === s ? 1 : 0;

  vec.outdoorActivity = exposure?.outdoorActivity ? 1 : 0;
  vec.nearWoods = exposure?.nearWoods ? 1 : 0;
  vec.petsOutdoor = exposure?.petsOutdoor ? 1 : 0;
  vec.recentFluLike = exposure?.recentFluLike ? 1 : 0;

  const county = exposure?.county || '';
  vec.countyIncidenceRate =
    NH_COUNTY_RATES[county] ?? US_NATIONAL_AVERAGE;

  vec.logCount = Math.max(1, Math.min(30, Math.floor(logCount)));

  return MODEL.feature_names.map((name) => {
    const v = vec[name];
    if (v === undefined) {
      // Should never happen if encoder and feature_names agree.
      throw new Error(`risk-fusion: missing feature ${name}`);
    }
    return v;
  });
}

// ─── Tree walker + softmax ──────────────────────────────────────────────────

function walkTree(tree: Tree, x: number[]): number {
  let i = 0;
  while (true) {
    const node = tree[i];
    if ('v' in node) return node.v;
    i = x[node.f] <= node.t ? node.l : node.r;
  }
}

function softmax(z: number[]): number[] {
  const m = Math.max(...z);
  const exps = z.map((v) => Math.exp(v - m));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function rawScores(x: number[]): number[] {
  const K = MODEL.n_classes;
  const scores = MODEL.init.slice();
  const lr = MODEL.learning_rate;
  for (const stage of MODEL.stages) {
    for (let k = 0; k < K; k++) {
      scores[k] += lr * walkTree(stage[k], x);
    }
  }
  return scores;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface FusionPrediction {
  classes: string[];                    // ["no_lyme", "early_lyme", "disseminated_lyme"]
  probabilities: number[];              // aligned with classes, sums to 1
  lymeProbability: number;              // P(early_lyme) + P(disseminated_lyme)
  topClass: string;
  topConfidence: number;
  /** Top contributing features (positive = pushes toward Lyme). */
  contributions: { feature: string; deltaLymeProb: number }[];
}

const CONTRIBUTION_TOPK = 6;

/**
 * Run the fusion model. Returns the full 3-way softmax plus a single
 * "probability of Lyme (early or disseminated)" headline for the UI.
 */
export function predictRisk(input: FusionInput): FusionPrediction {
  const x = encodeFeatures(input);
  const probs = softmax(rawScores(x));
  const lymeProb = probs[1] + probs[2];

  // Single-feature ablation for per-feature contribution. We zero one feature
  // at a time and measure how much the lymeProb drops; positive delta means
  // that feature was pushing the prediction toward Lyme.
  //
  // Only walk features that are currently active (x[i] !== 0) OR that are
  // continuous (countyIncidenceRate, logCount). Saves CPU.
  const contributions: { feature: string; deltaLymeProb: number }[] = [];
  for (let i = 0; i < x.length; i++) {
    const featureName = MODEL.feature_names[i];
    const isContinuous =
      featureName === 'countyIncidenceRate' || featureName === 'logCount';
    if (!isContinuous && x[i] === 0) continue;

    const original = x[i];
    x[i] = isContinuous ? US_NATIONAL_AVERAGE : 0;
    const baseProbs = softmax(rawScores(x));
    const baseLyme = baseProbs[1] + baseProbs[2];
    x[i] = original;

    const delta = lymeProb - baseLyme;
    if (Math.abs(delta) > 1e-4) {
      contributions.push({ feature: featureName, deltaLymeProb: delta });
    }
  }
  contributions.sort(
    (a, b) => Math.abs(b.deltaLymeProb) - Math.abs(a.deltaLymeProb)
  );

  const topIdx = probs.indexOf(Math.max(...probs));

  return {
    classes: MODEL.classes,
    probabilities: probs,
    lymeProbability: lymeProb,
    topClass: MODEL.classes[topIdx],
    topConfidence: probs[topIdx],
    contributions: contributions.slice(0, CONTRIBUTION_TOPK),
  };
}

/**
 * Friendly labels for contribution rows shown in the UI. Maps the raw vector
 * feature names to short English phrases.
 */
const FEATURE_LABELS: Record<string, string> = {
  fatigue: 'Fatigue',
  jointPain: 'Joint pain',
  headache: 'Headache',
  brainFog: 'Brain fog',
  fever: 'Fever',
  neckStiffness: 'Neck stiffness',
  facialDroop: 'Facial droop',
  heartPalpitations: 'Heart palpitations',
  rash: 'Rash',
  muscleAches: 'Muscle aches',
  chills: 'Chills',
  swollenLymphNodes: 'Swollen lymph nodes',
  dizziness: 'Dizziness',
  nightSweats: 'Night sweats',
  foundTick_no: 'No tick found',
  foundTick_yes_removed: 'Tick found and removed',
  foundTick_yes_attached: 'Tick still attached',
  foundTick_unsure: 'Tick exposure unsure',
  rashStatus_circular: 'Bullseye rash',
  rashStatus_other: 'Non-circular rash',
  rashStatus_unsure: 'Rash status unsure',
  locationRisk_nh: 'Located in NH',
  locationRisk_other_endemic: 'Located in endemic area',
  locationRisk_non_endemic: 'Outside endemic area',
  locationRisk_unsure: 'Location unsure',
  outdoorActivity: 'Recent outdoor activity',
  nearWoods: 'Lives near woods',
  petsOutdoor: 'Pets go outside',
  recentFluLike: 'Recent flu-like illness',
  countyIncidenceRate: 'NH county incidence rate',
  logCount: 'Sustained tracking history',
};

export function prettyFeatureName(raw: string): string {
  return FEATURE_LABELS[raw] || raw;
}

export function modelClasses(): string[] {
  return MODEL.classes.slice();
}
