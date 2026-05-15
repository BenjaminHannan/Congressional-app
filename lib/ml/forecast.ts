/**
 * Trace ML — Multi-Horizon Red-Flag Forecaster (pure-TS inference)
 *
 * Loads a GRU exported by ml-server/train_forecast.py and predicts the
 * probability that a red-flag symptom (neck stiffness, facial droop, or
 * heart palpitations — neuro-Lyme / Lyme carditis) emerges in the next
 * 1, 3, or 7 days given the user's current symptom history.
 *
 * Architecture:
 *   x_t ∈ R^14  →  GRU(hidden=24)  →  Linear(24 → 3)  →  σ
 *   output: [P(rf in 1d), P(rf in 3d), P(rf in 7d)]
 *
 * The forecast is what the heuristic baseline genuinely cannot do — scoring
 * "current state" is fundamentally different from forecasting trajectory
 * continuation. The GRU's final hidden state summarizes the latent dynamics
 * of the user's history; the linear head reads three look-ahead questions
 * out of it.
 */

import { SymptomChecks, SymptomLog } from '../types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
let MODEL: ForecastModel | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  MODEL = require('../../assets/models/forecast_model.json');
} catch {}

interface GruWeights {
  Wir: number[][]; Wiz: number[][]; Win: number[][];
  Whr: number[][]; Whz: number[][]; Whn: number[][];
  bir: number[]; biz: number[]; bin: number[];
  bhr: number[]; bhz: number[]; bhn: number[];
}
interface ForecastModel {
  version: number;
  type: 'gru-multi-horizon-binary';
  input_size: number;
  hidden_size: number;
  horizons_days: number[];          // typically [1, 3, 7]
  gru: GruWeights;
  head: { W: number[][]; b: number[] };  // (n_horizons, hidden_size)
  symptom_keys: (keyof SymptomChecks)[];
  red_flag_keys: (keyof SymptomChecks)[];
}

// ─── Linear-algebra helpers (shared shape with symptom-progression.ts) ─────

function sigmoid(x: number): number {
  if (x >= 0) {
    const e = Math.exp(-x);
    return 1 / (1 + e);
  }
  const e = Math.exp(x);
  return e / (1 + e);
}

function matvec(W: number[][], x: number[], b: number[]): number[] {
  const out = new Array<number>(W.length);
  for (let i = 0; i < W.length; i++) {
    const row = W[i];
    let acc = b[i];
    for (let j = 0; j < row.length; j++) acc += row[j] * x[j];
    out[i] = acc;
  }
  return out;
}

// ─── Public API ────────────────────────────────────────────────────────────

export interface ForecastPrediction {
  horizons: number[];                // [1, 3, 7]
  probabilities: number[];           // P(red flag within horizon[i] days)
  /** Largest spike that crosses a 60% threshold — useful for headline text. */
  highestHorizon: { days: number; probability: number } | null;
  /** Friendly label for the soonest probable red-flag day. */
  soonestRedFlag: string;
}

function encode(s: SymptomChecks, keys: (keyof SymptomChecks)[]): number[] {
  return keys.map((k) => (s[k] ? 1 : 0));
}

/**
 * Run the forecaster forward over a chronological symptom history. Returns
 * the per-horizon probability vector. Returns null when the model asset
 * isn't bundled (fail-safe — the Timeline tab will hide the forecast card).
 */
export function predictForecast(history: SymptomChecks[]): ForecastPrediction | null {
  if (!MODEL) return null;
  if (history.length < 2) return null;

  const H = MODEL.hidden_size;
  let h = new Array<number>(H).fill(0);
  const g = MODEL.gru;

  for (const s of history) {
    const x = encode(s, MODEL.symptom_keys);

    const rInput = matvec(g.Wir, x, g.bir);
    const rHidden = matvec(g.Whr, h, g.bhr);
    const zInput = matvec(g.Wiz, x, g.biz);
    const zHidden = matvec(g.Whz, h, g.bhz);
    const nInput = matvec(g.Win, x, g.bin);
    const nHidden = matvec(g.Whn, h, g.bhn);

    const hNext = new Array<number>(H);
    for (let i = 0; i < H; i++) {
      const r = sigmoid(rInput[i] + rHidden[i]);
      const z = sigmoid(zInput[i] + zHidden[i]);
      const n = Math.tanh(nInput[i] + r * nHidden[i]);
      hNext[i] = (1 - z) * n + z * h[i];
    }
    h = hNext;
  }

  // Linear head over the final hidden state
  const headLogits = matvec(MODEL.head.W, h, MODEL.head.b);
  const probabilities = headLogits.map(sigmoid);

  const THRESHOLD = 0.6;
  let highest: { days: number; probability: number } | null = null;
  for (let i = 0; i < probabilities.length; i++) {
    if (probabilities[i] >= THRESHOLD) {
      if (!highest || probabilities[i] > highest.probability) {
        highest = { days: MODEL.horizons_days[i], probability: probabilities[i] };
      }
    }
  }

  // Friendly summary line for the UI
  let soonest = '';
  for (let i = 0; i < probabilities.length; i++) {
    if (probabilities[i] >= THRESHOLD) {
      soonest = `Red-flag symptoms likely within ${MODEL.horizons_days[i]} day${
        MODEL.horizons_days[i] === 1 ? '' : 's'
      } (${Math.round(probabilities[i] * 100)}%)`;
      break;
    }
  }
  if (!soonest) {
    // Find max prob among horizons
    let mi = 0;
    for (let i = 1; i < probabilities.length; i++)
      if (probabilities[i] > probabilities[mi]) mi = i;
    soonest = `Red-flag risk within ${MODEL.horizons_days[mi]} days: ${Math.round(
      probabilities[mi] * 100
    )}% (below alert threshold)`;
  }

  return {
    horizons: MODEL.horizons_days.slice(),
    probabilities,
    highestHorizon: highest,
    soonestRedFlag: soonest,
  };
}

/**
 * Convenience: take Trace's newest-first SymptomLog[] and produce a
 * chronological forecast.
 */
export function forecastFromLogs(logs: SymptomLog[]): ForecastPrediction | null {
  if (logs.length < 2) return null;
  const chronological = [...logs].reverse();
  return predictForecast(chronological.map((l) => l.symptoms));
}

export function isForecastAvailable(): boolean {
  return MODEL !== null;
}
