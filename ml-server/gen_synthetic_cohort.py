"""
Trace ML — Synthetic Patient Cohort Generator

Builds a labeled dataset of ~10k patient encounters used to train the fusion
risk model (train_risk_fusion.py). Each row encodes a snapshot of what a Trace
user would have on-device at assessment time: 14 binary symptom flags, exposure
context, NH county-level incidence, and a log-count summary.

Labels (0/1/2) come from priors published in:
  - IDSA/AAN/ACR 2020 Lyme Disease Clinical Practice Guidelines
  - CDC Lyme Disease Surveillance, 2019–2023
  - NH DHHS Bureau of Infectious Disease Control surveillance reports

The priors below are *approximate* — they are tuned so the trained classifier
exhibits the same qualitative behavior as the published literature (e.g.,
red-flag symptoms strongly predict disseminated Lyme; ~30% of early Lyme
patients see a bullseye rash). The dataset is synthetic by design: it is NOT
a substitute for clinical validation, and the trained model is presented as a
structured risk-organizing aid, not a diagnostic device.

Usage:
    python gen_synthetic_cohort.py --n 10000 --seed 42

Output:
    data/synthetic/cohort.csv         — 10k rows, 32 features + label
    data/synthetic/feature_names.json — ordered feature names (JS uses these)
"""

import argparse
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd

# ───────────────────────────────────────────────────────────────────────────
# Feature schema — kept identical to lib/types.ts SymptomChecks + ExposureData
# so JS-side inference can encode features the same way.
# ───────────────────────────────────────────────────────────────────────────

SYMPTOM_KEYS = [
    'fatigue', 'jointPain', 'headache', 'brainFog', 'fever',
    'neckStiffness', 'facialDroop', 'heartPalpitations',
    'rash', 'muscleAches', 'chills', 'swollenLymphNodes',
    'dizziness', 'nightSweats',
]

RED_FLAG_KEYS = {'neckStiffness', 'facialDroop', 'heartPalpitations'}

TICK_STATES = ['no', 'yes_removed', 'yes_attached', 'unsure']
RASH_STATES = ['no', 'circular', 'other', 'unsure']
LOCATION_STATES = ['nh', 'other_endemic', 'non_endemic', 'unsure']

# NH counties (with their incidence rates) plus an "out of NH" sentinel
NH_COUNTY_RATES = {
    'Belknap': 145, 'Carroll': 160, 'Cheshire': 130, 'Coos': 55,
    'Grafton': 120, 'Hillsborough': 110, 'Merrimack': 125,
    'Rockingham': 155, 'Strafford': 140, 'Sullivan': 115,
}
US_NATIONAL_AVERAGE = 9


def feature_names() -> list[str]:
    """Stable column order used by both training and JS inference."""
    cols = list(SYMPTOM_KEYS)
    cols += [f'foundTick_{s}' for s in TICK_STATES]
    cols += [f'rashStatus_{s}' for s in RASH_STATES]
    cols += [f'locationRisk_{s}' for s in LOCATION_STATES]
    cols += ['outdoorActivity', 'nearWoods', 'petsOutdoor', 'recentFluLike']
    cols += ['countyIncidenceRate', 'logCount']
    return cols


# ───────────────────────────────────────────────────────────────────────────
# Priors. P[symptom | class] — order matches SYMPTOM_KEYS.
# Sources for early Lyme: Steere & Sikand 2003, Wormser et al. 2006 (IDSA).
# Disseminated rates: Halperin 2015, Forrester et al. 2014 (CDC).
# Background noise rates for no-Lyme controls: NHANES symptom-prevalence range.
# ───────────────────────────────────────────────────────────────────────────

P_SYMPTOM = {
    'no_lyme': {
        'fatigue': 0.18, 'jointPain': 0.10, 'headache': 0.20, 'brainFog': 0.08,
        'fever': 0.05, 'neckStiffness': 0.02, 'facialDroop': 0.002,
        'heartPalpitations': 0.04, 'rash': 0.05, 'muscleAches': 0.12,
        'chills': 0.05, 'swollenLymphNodes': 0.06, 'dizziness': 0.07,
        'nightSweats': 0.04,
    },
    'early_lyme': {
        'fatigue': 0.78, 'jointPain': 0.55, 'headache': 0.65, 'brainFog': 0.35,
        'fever': 0.45, 'neckStiffness': 0.10, 'facialDroop': 0.03,
        'heartPalpitations': 0.06, 'rash': 0.70, 'muscleAches': 0.55,
        'chills': 0.35, 'swollenLymphNodes': 0.40, 'dizziness': 0.18,
        'nightSweats': 0.20,
    },
    'disseminated_lyme': {
        'fatigue': 0.85, 'jointPain': 0.80, 'headache': 0.70, 'brainFog': 0.65,
        'fever': 0.30, 'neckStiffness': 0.35, 'facialDroop': 0.20,
        'heartPalpitations': 0.18, 'rash': 0.30, 'muscleAches': 0.55,
        'chills': 0.25, 'swollenLymphNodes': 0.30, 'dizziness': 0.40,
        'nightSweats': 0.30,
    },
}

P_FOUND_TICK = {
    'no_lyme':           [0.78, 0.10, 0.02, 0.10],
    'early_lyme':        [0.30, 0.30, 0.25, 0.15],
    'disseminated_lyme': [0.55, 0.20, 0.10, 0.15],
}

P_RASH_STATUS = {
    'no_lyme':           [0.85, 0.02, 0.08, 0.05],
    'early_lyme':        [0.20, 0.55, 0.15, 0.10],  # bullseye in ~55%, atypical in 15%
    'disseminated_lyme': [0.65, 0.10, 0.15, 0.10],  # often gone by dissemination
}

P_LOCATION = {
    'no_lyme':           [0.35, 0.10, 0.45, 0.10],
    'early_lyme':        [0.55, 0.25, 0.10, 0.10],
    'disseminated_lyme': [0.55, 0.25, 0.10, 0.10],
}

P_OUTDOOR = {'no_lyme': 0.30, 'early_lyme': 0.75, 'disseminated_lyme': 0.70}
P_NEAR_WOODS = {'no_lyme': 0.25, 'early_lyme': 0.65, 'disseminated_lyme': 0.65}
P_PETS_OUTDOOR = {'no_lyme': 0.30, 'early_lyme': 0.45, 'disseminated_lyme': 0.45}
P_FLU_LIKE = {'no_lyme': 0.20, 'early_lyme': 0.30, 'disseminated_lyme': 0.40}

# Class mixture in the cohort. Real Trace users self-select toward elevated
# risk, so the early-Lyme rate here is higher than the population base rate.
CLASS_MIX = {
    'no_lyme': 0.50,
    'early_lyme': 0.35,
    'disseminated_lyme': 0.15,
}
CLASS_TO_LABEL = {'no_lyme': 0, 'early_lyme': 1, 'disseminated_lyme': 2}


def sample_county(rng: np.random.Generator, klass: str) -> float:
    """Return the county's incidence rate. Disseminated/early lean NH-resident."""
    in_nh = rng.random() < (
        0.65 if klass != 'no_lyme' else 0.30
    )
    if in_nh:
        # Weight by population — Hillsborough/Rockingham dominate
        counties = list(NH_COUNTY_RATES.keys())
        weights = np.array([
            63, 49, 77, 31, 91, 419, 153, 314, 133, 43
        ], dtype=float)
        weights = weights / weights.sum()
        c = rng.choice(counties, p=weights)
        return float(NH_COUNTY_RATES[c])
    return float(US_NATIONAL_AVERAGE)  # outside NH baseline


def sample_log_count(rng: np.random.Generator, klass: str) -> int:
    """How many days of symptom logs the user has. Sicker users log more."""
    if klass == 'disseminated_lyme':
        return int(np.clip(rng.normal(12, 6), 1, 30))
    if klass == 'early_lyme':
        return int(np.clip(rng.normal(5, 3), 1, 30))
    return int(np.clip(rng.normal(2, 2), 1, 30))


def sample_row(rng: np.random.Generator, klass: str) -> dict:
    """Sample a single patient row given the latent class."""
    row: dict[str, float] = {}

    # Symptoms — independent Bernoullis with class-specific priors.
    # Correlations within a class are implicitly modeled by the elevated
    # joint priors (every classic symptom is independently high in early-Lyme).
    for key in SYMPTOM_KEYS:
        row[key] = 1.0 if rng.random() < P_SYMPTOM[klass][key] else 0.0

    # Found tick — one-hot
    tick_state = rng.choice(TICK_STATES, p=P_FOUND_TICK[klass])
    for s in TICK_STATES:
        row[f'foundTick_{s}'] = 1.0 if s == tick_state else 0.0

    # Rash — one-hot
    rash_state = rng.choice(RASH_STATES, p=P_RASH_STATUS[klass])
    for s in RASH_STATES:
        row[f'rashStatus_{s}'] = 1.0 if s == rash_state else 0.0

    # Location risk — one-hot
    loc_state = rng.choice(LOCATION_STATES, p=P_LOCATION[klass])
    for s in LOCATION_STATES:
        row[f'locationRisk_{s}'] = 1.0 if s == loc_state else 0.0

    row['outdoorActivity'] = 1.0 if rng.random() < P_OUTDOOR[klass] else 0.0
    row['nearWoods'] = 1.0 if rng.random() < P_NEAR_WOODS[klass] else 0.0
    row['petsOutdoor'] = 1.0 if rng.random() < P_PETS_OUTDOOR[klass] else 0.0
    row['recentFluLike'] = 1.0 if rng.random() < P_FLU_LIKE[klass] else 0.0

    row['countyIncidenceRate'] = sample_county(rng, klass)
    row['logCount'] = float(sample_log_count(rng, klass))

    return row


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--n', type=int, default=10000)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument(
        '--out-dir', default=str(Path('data') / 'synthetic'),
        help='Directory for cohort.csv + feature_names.json'
    )
    args = parser.parse_args()

    rng = np.random.default_rng(args.seed)

    classes = list(CLASS_MIX.keys())
    probs = np.array([CLASS_MIX[k] for k in classes])
    sampled_classes = rng.choice(classes, size=args.n, p=probs)

    rows = []
    for klass in sampled_classes:
        r = sample_row(rng, klass)
        r['label'] = CLASS_TO_LABEL[klass]
        r['klass'] = klass  # kept for sanity-checks, dropped before training
        rows.append(r)

    cols = feature_names() + ['label', 'klass']
    df = pd.DataFrame(rows, columns=cols)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    csv_path = out_dir / 'cohort.csv'
    df.to_csv(csv_path, index=False)

    feat_path = out_dir / 'feature_names.json'
    with open(feat_path, 'w') as f:
        json.dump(feature_names(), f, indent=2)

    # Sanity print
    print(f'Wrote {len(df)} rows to {csv_path}')
    print(f'Class balance: {df["klass"].value_counts(normalize=True).to_dict()}')
    print(f'Red-flag prevalence by class:')
    for k in classes:
        sub = df[df['klass'] == k]
        rf = sub[list(RED_FLAG_KEYS)].max(axis=1).mean()
        print(f'  {k:20s}  any-red-flag = {rf:.3f}')
    print(f'Feature names written to {feat_path}')


if __name__ == '__main__':
    main()
