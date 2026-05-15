"""
Trace ML — Synthetic Symptom Trajectory Generator

Builds a labeled time-series dataset of (T_days × 14) binary symptom matrices.
Used by train_temporal.py to train a tiny GRU that scores how strongly the
*shape* of a user's symptom history matches the published progression of
Lyme disease (vs. a flu-like illness or random noise).

Positive (Lyme) trajectories are drawn from a 3-state Markov chain that
encodes the IDSA-documented stages:

    flu_like  →  joint_involvement  →  neuro_or_cardiac

Per-stage symptom emission probabilities are tuned to the same priors used in
gen_synthetic_cohort.py.

Negative trajectories come from two distributions:
  - Flu controls — symptoms peak early then decay over ~10 days
  - Random controls — independent low-rate Bernoullis (background noise)

Usage:
    python gen_synthetic_trajectories.py --n 10000 --seed 42

Outputs:
    data/synthetic/trajectories.npz   — X (n, T, 14) float32, y (n,) int64
"""

import argparse
from pathlib import Path

import numpy as np


SYMPTOM_KEYS = [
    'fatigue', 'jointPain', 'headache', 'brainFog', 'fever',
    'neckStiffness', 'facialDroop', 'heartPalpitations',
    'rash', 'muscleAches', 'chills', 'swollenLymphNodes',
    'dizziness', 'nightSweats',
]
N_SYMPTOMS = len(SYMPTOM_KEYS)
SEQ_LEN = 14  # days of history the GRU consumes

# Per-stage emission priors (P[symptom | stage])
STAGES = {
    'flu_like': {
        'fatigue': 0.75, 'jointPain': 0.20, 'headache': 0.65, 'brainFog': 0.20,
        'fever': 0.60, 'neckStiffness': 0.05, 'facialDroop': 0.005,
        'heartPalpitations': 0.05, 'rash': 0.45, 'muscleAches': 0.55,
        'chills': 0.50, 'swollenLymphNodes': 0.35, 'dizziness': 0.10,
        'nightSweats': 0.15,
    },
    'joint': {
        'fatigue': 0.85, 'jointPain': 0.85, 'headache': 0.50, 'brainFog': 0.40,
        'fever': 0.20, 'neckStiffness': 0.15, 'facialDroop': 0.02,
        'heartPalpitations': 0.08, 'rash': 0.20, 'muscleAches': 0.60,
        'chills': 0.20, 'swollenLymphNodes': 0.30, 'dizziness': 0.20,
        'nightSweats': 0.20,
    },
    'neuro_cardiac': {
        'fatigue': 0.85, 'jointPain': 0.70, 'headache': 0.70, 'brainFog': 0.70,
        'fever': 0.20, 'neckStiffness': 0.40, 'facialDroop': 0.25,
        'heartPalpitations': 0.30, 'rash': 0.15, 'muscleAches': 0.55,
        'chills': 0.15, 'swollenLymphNodes': 0.20, 'dizziness': 0.45,
        'nightSweats': 0.30,
    },
}

# Markov transition: stay in current stage by default; progress with small prob
TRANSITION = {
    'flu_like':       {'flu_like': 0.85, 'joint': 0.13, 'neuro_cardiac': 0.02},
    'joint':          {'flu_like': 0.05, 'joint': 0.85, 'neuro_cardiac': 0.10},
    'neuro_cardiac':  {'flu_like': 0.00, 'joint': 0.10, 'neuro_cardiac': 0.90},
}


def emit(rng: np.random.Generator, stage: str) -> np.ndarray:
    probs = STAGES[stage]
    return np.array(
        [1.0 if rng.random() < probs[k] else 0.0 for k in SYMPTOM_KEYS],
        dtype=np.float32,
    )


def sample_lyme_trajectory(rng: np.random.Generator) -> np.ndarray:
    """A T×14 matrix. Stage = flu_like for first ~3-5 days then progresses."""
    stage = 'flu_like'
    out = np.zeros((SEQ_LEN, N_SYMPTOMS), dtype=np.float32)
    for day in range(SEQ_LEN):
        out[day] = emit(rng, stage)
        # advance stage stochastically (after the first day)
        trans = TRANSITION[stage]
        next_stages = list(trans.keys())
        next_probs = [trans[s] for s in next_stages]
        stage = rng.choice(next_stages, p=next_probs)
    return out


def sample_flu_control(rng: np.random.Generator) -> np.ndarray:
    """Flu-like illness — symptoms peak early then decay."""
    out = np.zeros((SEQ_LEN, N_SYMPTOMS), dtype=np.float32)
    base = STAGES['flu_like']
    for day in range(SEQ_LEN):
        # Decay factor: 1.0 → ~0.1 across SEQ_LEN
        decay = max(0.1, 1.0 - day / (SEQ_LEN - 1))
        for j, k in enumerate(SYMPTOM_KEYS):
            p = base[k] * decay
            # Suppress red flags and chronic markers — flu doesn't do those
            if k in ('neckStiffness', 'facialDroop', 'heartPalpitations',
                    'brainFog', 'nightSweats'):
                p *= 0.1
            out[day, j] = 1.0 if rng.random() < p else 0.0
    return out


def sample_random_control(rng: np.random.Generator) -> np.ndarray:
    """Background noise — independent low-rate symptoms."""
    out = np.zeros((SEQ_LEN, N_SYMPTOMS), dtype=np.float32)
    base_rates = [
        0.18, 0.10, 0.20, 0.08, 0.05, 0.02, 0.002, 0.04,
        0.05, 0.12, 0.05, 0.06, 0.07, 0.04,
    ]
    for day in range(SEQ_LEN):
        for j in range(N_SYMPTOMS):
            out[day, j] = 1.0 if rng.random() < base_rates[j] else 0.0
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--n', type=int, default=10000)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--out', default='data/synthetic/trajectories.npz')
    args = parser.parse_args()

    rng = np.random.default_rng(args.seed)

    # 50/25/25 split: lyme / flu / random
    n_lyme = args.n // 2
    n_flu = args.n // 4
    n_random = args.n - n_lyme - n_flu

    X = np.empty((args.n, SEQ_LEN, N_SYMPTOMS), dtype=np.float32)
    y = np.empty((args.n,), dtype=np.int64)

    idx = 0
    for _ in range(n_lyme):
        X[idx] = sample_lyme_trajectory(rng)
        y[idx] = 1
        idx += 1
    for _ in range(n_flu):
        X[idx] = sample_flu_control(rng)
        y[idx] = 0
        idx += 1
    for _ in range(n_random):
        X[idx] = sample_random_control(rng)
        y[idx] = 0
        idx += 1

    # Shuffle
    perm = rng.permutation(args.n)
    X = X[perm]
    y = y[perm]

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    np.savez(out_path, X=X, y=y, symptom_keys=np.array(SYMPTOM_KEYS, dtype=object))
    print(f'Wrote {out_path}: X={X.shape}, y={y.shape}, positive_rate={y.mean():.3f}')


if __name__ == '__main__':
    main()
