"""
Trace ML — Fusion Risk Model Training

Trains a multiclass GradientBoostingClassifier on the synthetic cohort
(gen_synthetic_cohort.py output) and exports a JSON file that the phone app
can walk in pure TypeScript.

Why GBM over a deep model:
  - Calibration: tree ensembles produce probabilities that align with empirical
    frequencies when fit on tabular data with strong prior structure.
  - Interpretability: leaf values are signed contributions that compose linearly
    in log-odds space, giving us free per-feature SHAP-like attributions.
  - Footprint: 50 stages × 3 classes × small trees ≈ 30 KB JSON, vs. MBs for a
    deep net. Ships as a static asset.
  - No native dependency: tree walking in JS is ~80 lines of pure TS.

Why sklearn over xgboost/lightgbm:
  - Sklearn's GradientBoostingClassifier has a stable, fully-documented internal
    representation that we can serialize without reverse-engineering. The other
    libraries have similar APIs but heavier installs and less stable internals.

Usage:
    python train_risk_fusion.py

Outputs:
    risk_model.json                       — used by lib/ml/risk-fusion.ts
    data/synthetic/fusion_metrics.json    — held-out metrics for explainability tab
    data/synthetic/confusion_matrix.png   — visual sanity check
    data/synthetic/reliability_diagram.png
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    log_loss,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.tree._tree import TREE_LEAF
import matplotlib.pyplot as plt


CLASSES = ['no_lyme', 'early_lyme', 'disseminated_lyme']


# ───────────────────────────────────────────────────────────────────────────
# Tree serialization
# Each sklearn DecisionTreeRegressor stores its structure in `tree_`. We
# walk the arrays into a compact JSON shape:
#
#   { "f": <feature_idx>, "t": <threshold>, "l": <left_idx>, "r": <right_idx> }
#   { "v": <leaf_value> }                                  # leaf
#
# The JS side mirrors this exactly.
# ───────────────────────────────────────────────────────────────────────────

def serialize_tree(reg) -> list[dict]:
    """Flatten an sklearn regression tree into a list of node dicts."""
    t = reg.tree_
    out = []
    for i in range(t.node_count):
        if t.children_left[i] == TREE_LEAF:
            out.append({'v': float(t.value[i, 0, 0])})
        else:
            out.append({
                'f': int(t.feature[i]),
                't': float(t.threshold[i]),
                'l': int(t.children_left[i]),
                'r': int(t.children_right[i]),
            })
    return out


def export_model(clf: GradientBoostingClassifier, feature_names: list[str]) -> dict:
    n_classes = clf.n_classes_
    init_log_priors = clf.init_.class_prior_   # raw prior probs
    # Convert to log-odds (sklearn's GBM uses `LogOddsEstimator` for binary,
    # `PriorProbabilityEstimator` for multiclass — internally stored as log
    # priors). We bake the initial log-priors into the JSON.
    eps = 1e-12
    init = np.log(np.clip(init_log_priors, eps, 1.0)).tolist()

    stages = []
    # estimators_ has shape (n_stages, n_classes)
    for stage_trees in clf.estimators_:
        per_class = [serialize_tree(t) for t in stage_trees]
        stages.append(per_class)

    return {
        'version': 1,
        'type': 'gbdt-multiclass',
        'n_classes': int(n_classes),
        'classes': CLASSES,
        'feature_names': feature_names,
        'learning_rate': float(clf.learning_rate),
        'init': init,
        'stages': stages,
    }


# ───────────────────────────────────────────────────────────────────────────
# Calibration & visualization
# ───────────────────────────────────────────────────────────────────────────

def reliability_diagram(y_true_pos: np.ndarray, y_prob_pos: np.ndarray, n_bins: int = 10) -> dict:
    """Returns {bins: [{p_pred, p_emp, n}]} for the explainability screen."""
    bins = np.linspace(0, 1, n_bins + 1)
    out = []
    for i in range(n_bins):
        mask = (y_prob_pos >= bins[i]) & (y_prob_pos < bins[i + 1] + (1e-9 if i == n_bins - 1 else 0))
        n = int(mask.sum())
        if n == 0:
            continue
        p_pred = float(y_prob_pos[mask].mean())
        p_emp = float(y_true_pos[mask].mean())
        out.append({'p_pred': p_pred, 'p_emp': p_emp, 'n': n})
    return {'bins': out, 'n_bins': n_bins}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cohort', default='data/synthetic/cohort.csv')
    parser.add_argument('--n-estimators', type=int, default=80)
    parser.add_argument('--max-depth', type=int, default=3)
    parser.add_argument('--learning-rate', type=float, default=0.1)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--output', default='risk_model.json')
    args = parser.parse_args()

    df = pd.read_csv(args.cohort)
    with open('data/synthetic/feature_names.json', 'r') as f:
        feature_names = json.load(f)

    X = df[feature_names].values
    y = df['label'].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=args.seed, stratify=y,
    )

    clf = GradientBoostingClassifier(
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        learning_rate=args.learning_rate,
        random_state=args.seed,
    )
    clf.fit(X_train, y_train)

    # Metrics
    proba_test = clf.predict_proba(X_test)
    pred_test = proba_test.argmax(axis=1)
    acc = accuracy_score(y_test, pred_test)
    ll = log_loss(y_test, proba_test, labels=[0, 1, 2])

    # Brier — per-class one-vs-rest, then averaged
    brier_per_class = []
    for k in range(3):
        y_bin = (y_test == k).astype(int)
        brier_per_class.append(brier_score_loss(y_bin, proba_test[:, k]))
    brier_mean = float(np.mean(brier_per_class))

    # AUC — one-vs-rest, macro avg
    try:
        auc_macro = roc_auc_score(y_test, proba_test, multi_class='ovr', average='macro')
    except Exception:
        auc_macro = float('nan')

    cm = confusion_matrix(y_test, pred_test, labels=[0, 1, 2])
    cls_rep = classification_report(
        y_test, pred_test, target_names=CLASSES, output_dict=True, zero_division=0,
    )

    print(f'\n=== Held-out metrics (n={len(X_test)}) ===')
    print(f'Accuracy:      {acc:.4f}')
    print(f'Log loss:      {ll:.4f}')
    print(f'Brier (mean):  {brier_mean:.4f}   per-class: {[round(b, 4) for b in brier_per_class]}')
    print(f'AUC (macro):   {auc_macro:.4f}')
    print(f'\nConfusion matrix:\n{cm}')
    print(f'\nClassification report:')
    for k, v in cls_rep.items():
        if isinstance(v, dict):
            print(f'  {k:25s} P={v["precision"]:.3f}  R={v["recall"]:.3f}  F1={v["f1-score"]:.3f}')

    # ── Export model JSON ──
    model_json = export_model(clf, feature_names)

    # Top-level project root model lives at the repo root for `assets/` consumption
    out_path = Path(args.output)
    out_path.write_text(json.dumps(model_json, separators=(',', ':')))
    size_kb = out_path.stat().st_size / 1024
    print(f'\nWrote {out_path} ({size_kb:.1f} KB)')

    # Also copy into trace/assets/models/ for the app to load
    assets_dir = Path('..') / 'assets' / 'models'
    if assets_dir.parent.exists():
        assets_dir.mkdir(parents=True, exist_ok=True)
        assets_target = assets_dir / 'risk_model.json'
        assets_target.write_text(json.dumps(model_json))
        print(f'Copied to {assets_target}')

    # ── Metrics JSON (consumed by ML explainability tab) ──
    early_brier = brier_per_class[1]
    diss_brier = brier_per_class[2]
    rd = reliability_diagram(
        (y_test == 1).astype(int).astype(float),
        proba_test[:, 1],
    )

    metrics = {
        'accuracy': float(acc),
        'log_loss': float(ll),
        'brier_mean': brier_mean,
        'brier_no_lyme': float(brier_per_class[0]),
        'brier_early_lyme': float(early_brier),
        'brier_disseminated_lyme': float(diss_brier),
        'auc_macro': float(auc_macro),
        'n_train': int(len(X_train)),
        'n_test': int(len(X_test)),
        'classes': CLASSES,
        'confusion_matrix': cm.tolist(),
        'reliability_diagram_early_lyme': rd,
        'classification_report': cls_rep,
        'feature_names': feature_names,
        'feature_importances': clf.feature_importances_.tolist(),
    }
    metrics_path = Path('data') / 'synthetic' / 'fusion_metrics.json'
    metrics_path.write_text(json.dumps(metrics, indent=2))
    print(f'Wrote {metrics_path}')

    # Mirror into assets/ml-metrics/
    metrics_assets = Path('..') / 'assets' / 'ml-metrics'
    if metrics_assets.parent.exists():
        metrics_assets.mkdir(parents=True, exist_ok=True)
        (metrics_assets / 'fusion_metrics.json').write_text(json.dumps(metrics))
        print(f'Copied metrics to {metrics_assets / "fusion_metrics.json"}')

    # ── Sanity plots ──
    plots_dir = Path('data') / 'synthetic'

    # Confusion matrix
    fig, ax = plt.subplots(figsize=(4.2, 3.6))
    im = ax.imshow(cm, cmap='Blues')
    ax.set_xticks(range(3)); ax.set_yticks(range(3))
    ax.set_xticklabels(CLASSES, rotation=15, ha='right'); ax.set_yticklabels(CLASSES)
    ax.set_xlabel('Predicted'); ax.set_ylabel('True')
    for i in range(3):
        for j in range(3):
            ax.text(j, i, cm[i, j], ha='center', va='center',
                    color='white' if cm[i, j] > cm.max() / 2 else 'black', fontsize=10)
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(plots_dir / 'confusion_matrix.png', dpi=140)
    plt.close(fig)

    # Reliability diagram for early-lyme
    fig, ax = plt.subplots(figsize=(4.2, 3.6))
    rb = rd['bins']
    if rb:
        ax.plot([0, 1], [0, 1], 'k--', alpha=0.5, label='Perfect calibration')
        ax.scatter(
            [b['p_pred'] for b in rb],
            [b['p_emp'] for b in rb],
            s=[max(15, b['n']) for b in rb],
            color='#0d9488', alpha=0.8,
        )
    ax.set_xlabel('Predicted P(early-Lyme)')
    ax.set_ylabel('Empirical frequency')
    ax.set_title(f'Reliability (Brier = {early_brier:.3f})')
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    ax.legend(loc='upper left', fontsize=9)
    fig.tight_layout()
    fig.savefig(plots_dir / 'reliability_diagram.png', dpi=140)
    plt.close(fig)
    print(f'Plots written to {plots_dir}/')


if __name__ == '__main__':
    main()
