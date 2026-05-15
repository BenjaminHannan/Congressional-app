/**
 * Trace ML — Temporal Symptom-Progression Model (pure-TS inference)
 *
 * Loads a tiny GRU exported by ml-server/train_temporal.py and runs it forward
 * over the user's recent symptom logs. Returns one probability per day, which
 * the Timeline tab renders as a sparkline above the entry list.
 *
 * Architecture (matches train_temporal.py):
 *
 *   x_t ∈ R^14  →  GRU(hidden=16)  →  Linear(16 → 1)  →  σ  →  p_t ∈ (0, 1)
 *
 * Standard GRU equations:
 *
 *   r_t = σ(W_ir·x_t + b_ir + W_hr·h_{t-1} + b_hr)
 *   z_t = σ(W_iz·x_t + b_iz + W_hz·h_{t-1} + b_hz)
 *   n_t = tanh(W_in·x_t + b_in + r_t ⊙ (W_hn·h_{t-1} + b_hn))
 *   h_t = (1 - z_t) ⊙ n_t + z_t ⊙ h_{t-1}
 *
 * ~1.5k parameters, ~30 KB JSON, runs in <1 ms for 14 days. No native modules.
 */

import { SymptomChecks, SymptomLog } from '../types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MODEL: GruModel = require('../../assets/models/temporal_model.json');

interface GruWeights {
  Wir: number[][]; Wiz: number[][]; Win: number[][];
  Whr: number[][]; Whz: number[][]; Whn: number[][];
  bir: number[]; biz: number[]; bin: number[];
  bhr: number[]; bhz: number[]; bhn: number[];
}
interface GruModel {
  version: number;
  type: 'gru-binary';
  input_size: number;
  hidden_size: number;
  gru: GruWeights;
  head: { W: number[]; b: number };
  symptom_keys: (keyof SymptomChecks)[];
}

// ─── Small linear-algebra helpers ───────────────────────────────────────────

function sigmoid(x: number): number {
  if (x >= 0) {
    const e = Math.exp(-x);
    return 1 / (1 + e);
  }
  const e = Math.exp(x);
  return e / (1 + e);
}

function tanh(x: number): number {
  return Math.tanh(x);
}

/** y = W x + b   where W is (out, in), x is (in,), b is (out,) */
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

// ─── Public API ─────────────────────────────────────────────────────────────

export interface TemporalPrediction {
  /** One probability per day in chronological order (oldest first). */
  perDayProbabilities: number[];
  /** Probability for the most recent day. */
  latest: number;
  /** Increase from first to last day — positive = trajectory climbing. */
  trend: number;
}

/**
 * Encode a SymptomChecks object to a 14-element binary vector in the same
 * column order the model expects.
 */
function encodeSymptoms(s: SymptomChecks): number[] {
  return MODEL.symptom_keys.map((k) => (s[k] ? 1 : 0));
}

/**
 * Run the GRU forward over a sequence of symptom checks. Returns one
 * probability per timestep — what the model thinks of the trajectory
 * *ending* at that day.
 *
 * Input ordering MUST be chronological (oldest first). The model was trained
 * on left-to-right sequences.
 */
export function predictTrajectory(history: SymptomChecks[]): TemporalPrediction {
  const H = MODEL.hidden_size;
  let h = new Array<number>(H).fill(0);
  const probs: number[] = [];
  const g = MODEL.gru;

  for (const s of history) {
    const x = encodeSymptoms(s);

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
      const n = tanh(nInput[i] + r * nHidden[i]);
      hNext[i] = (1 - z) * n + z * h[i];
    }
    h = hNext;

    // Linear head
    let logit = MODEL.head.b;
    for (let i = 0; i < H; i++) logit += MODEL.head.W[i] * h[i];
    probs.push(sigmoid(logit));
  }

  const latest = probs.length ? probs[probs.length - 1] : 0;
  const first = probs.length ? probs[0] : 0;
  return {
    perDayProbabilities: probs,
    latest,
    trend: latest - first,
  };
}

/**
 * Convenience: take Trace's stored SymptomLog array (newest-first) and produce
 * a chronological trajectory prediction. Returns null when there are fewer
 * than 2 logs (the sparkline needs at least 2 points to draw anything useful).
 */
export function predictFromLogs(logs: SymptomLog[]): TemporalPrediction | null {
  if (logs.length < 2) return null;
  const chronological = [...logs].reverse(); // SymptomLog stores newest-first
  const history = chronological.map((l) => l.symptoms);
  return predictTrajectory(history);
}
