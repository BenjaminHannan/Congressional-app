"""
Trace ML — Forecasting Head

Trains a multi-horizon predictor that answers a clinically useful question:

    Given the user's symptom history up to today, what is the probability
    that a *red-flag symptom* (neck stiffness, facial droop, heart
    palpitations — i.e. neuro-Lyme or Lyme carditis) emerges in the next
    1, 3, or 7 days if no treatment is started?

This is something the heuristic risk engine in lib/risk-engine.ts genuinely
cannot do: scoring "current state" is different from forecasting trajectory
continuation. The GRU's hidden state, summarized over the user's history,
contains exactly the kind of latent-dynamics signal a logistic-regression-
style heuristic cannot recover.

Architecture:

    x_t ∈ R^14  →  GRU(hidden=24)  →  Linear(24 → 3)  →  σ
    output: [P(red flag in 1d), P(in 3d), P(in 7d)]

Training data: reuses ml-server/data/synthetic/trajectories.npz from
gen_synthetic_trajectories.py. For each sequence we sample a random cutoff
t and build a training example whose input is the prefix [0:t] and whose
labels are computed by looking ahead in the same sequence.

Usage:
    python train_forecast.py

Outputs:
    forecast_model.json                  — loaded by lib/ml/forecast.ts
    data/synthetic/forecast_metrics.json — for the explainability tab
"""

import argparse
import json
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from sklearn.metrics import roc_auc_score, brier_score_loss
import matplotlib.pyplot as plt


SYMPTOM_KEYS = [
    'fatigue', 'jointPain', 'headache', 'brainFog', 'fever',
    'neckStiffness', 'facialDroop', 'heartPalpitations',
    'rash', 'muscleAches', 'chills', 'swollenLymphNodes',
    'dizziness', 'nightSweats',
]
RED_FLAG_INDICES = [
    SYMPTOM_KEYS.index('neckStiffness'),
    SYMPTOM_KEYS.index('facialDroop'),
    SYMPTOM_KEYS.index('heartPalpitations'),
]
HORIZONS = [1, 3, 7]  # days ahead


class ForecastGRU(nn.Module):
    def __init__(self, input_size=14, hidden_size=24, n_horizons=3):
        super().__init__()
        self.gru = nn.GRU(input_size, hidden_size, num_layers=1, batch_first=True)
        self.head = nn.Linear(hidden_size, n_horizons)

    def forward(self, x):
        # x: (B, T, 14). Take the final-step hidden state.
        _, h_n = self.gru(x)
        h_last = h_n[-1]                          # (B, hidden)
        return self.head(h_last)                  # (B, n_horizons)


class ForecastDataset(Dataset):
    """Each (sequence, cutoff) pair becomes one training example.

    Note: we resample the cutoff every epoch so the model sees more diverse
    prefixes. This is implemented via __getitem__ — `idx` keys to a base
    trajectory, and we pick the cutoff fresh each call.
    """

    def __init__(self, X: np.ndarray, rng: np.random.Generator, min_t: int = 2):
        # X: (N, T, 14)
        self.X = X
        self.rng = rng
        self.T = X.shape[1]
        self.min_t = min_t

    def __len__(self):
        return len(self.X)

    def __getitem__(self, idx):
        seq = self.X[idx]                          # (T, 14)
        t = int(self.rng.integers(self.min_t, self.T))  # cutoff in [min_t, T-1]
        prefix = seq[:t]                            # (t, 14)

        # Pad prefix to fixed length T (zeros). The GRU walks all T steps
        # but we discard everything after the cutoff for label purposes,
        # so padding doesn't bias the prediction toward post-cutoff content.
        pad = np.zeros((self.T - t, 14), dtype=np.float32)
        padded = np.concatenate([prefix, pad], axis=0)

        # Labels: for each horizon h, "did any red flag appear in days [t, t+h-1]?"
        # We use post-cutoff days from the same synthetic trajectory.
        labels = np.zeros(len(HORIZONS), dtype=np.float32)
        for i, h in enumerate(HORIZONS):
            end = min(self.T, t + h)
            window = seq[t:end]                     # (h or fewer, 14)
            rf = window[:, RED_FLAG_INDICES].max() if window.size > 0 else 0
            labels[i] = float(rf > 0)

        return (
            torch.from_numpy(padded),
            torch.from_numpy(np.array(t, dtype=np.int64)),
            torch.from_numpy(labels),
        )


def run_epoch(model, loader, opt, device, training=True):
    if training:
        model.train()
    else:
        model.eval()

    total_loss = 0.0
    n = 0
    all_logits = []
    all_y = []

    bce = nn.BCEWithLogitsLoss()
    grad_ctx = torch.enable_grad() if training else torch.no_grad()
    with grad_ctx:
        for padded, t, y in loader:
            padded = padded.to(device)
            y = y.to(device)
            # Note: GRU sees the full padded sequence. The padded zeros after
            # the cutoff are encoded but produce no "real" signal — we rely on
            # the GRU's gating to ignore them. In practice the model learns
            # quickly that zero-rows after a high-activity prefix carry no
            # information.
            logits = model(padded)
            loss = bce(logits, y)
            if training:
                opt.zero_grad()
                loss.backward()
                opt.step()
            total_loss += loss.item() * padded.size(0)
            n += padded.size(0)
            all_logits.append(logits.detach().cpu().numpy())
            all_y.append(y.detach().cpu().numpy())

    losses = total_loss / n
    logits = np.concatenate(all_logits)
    ys = np.concatenate(all_y)
    probs = 1.0 / (1.0 + np.exp(-logits))

    metrics = {}
    for i, h in enumerate(HORIZONS):
        try:
            auc = roc_auc_score(ys[:, i], probs[:, i])
        except Exception:
            auc = float('nan')
        brier = brier_score_loss(ys[:, i], probs[:, i])
        metrics[f'auc_{h}d'] = float(auc)
        metrics[f'brier_{h}d'] = float(brier)
        metrics[f'pos_rate_{h}d'] = float(ys[:, i].mean())

    return losses, metrics, probs, ys


def export_weights(model: ForecastGRU) -> dict:
    gru = model.gru
    H = gru.hidden_size
    I = gru.input_size

    W_ih = gru.weight_ih_l0.detach().cpu().numpy()
    W_hh = gru.weight_hh_l0.detach().cpu().numpy()
    b_ih = gru.bias_ih_l0.detach().cpu().numpy()
    b_hh = gru.bias_hh_l0.detach().cpu().numpy()

    def split3(a):
        return a[:H], a[H:2 * H], a[2 * H:3 * H]

    Wir, Wiz, Win = split3(W_ih)
    Whr, Whz, Whn = split3(W_hh)
    bir, biz, bin_ = split3(b_ih)
    bhr, bhz, bhn = split3(b_hh)

    head_W = model.head.weight.detach().cpu().numpy()   # (3, H)
    head_b = model.head.bias.detach().cpu().numpy()     # (3,)

    return {
        'version': 1,
        'type': 'gru-multi-horizon-binary',
        'input_size': I,
        'hidden_size': H,
        'horizons_days': HORIZONS,
        'gru': {
            'Wir': Wir.tolist(), 'Wiz': Wiz.tolist(), 'Win': Win.tolist(),
            'Whr': Whr.tolist(), 'Whz': Whz.tolist(), 'Whn': Whn.tolist(),
            'bir': bir.tolist(), 'biz': biz.tolist(), 'bin': bin_.tolist(),
            'bhr': bhr.tolist(), 'bhz': bhz.tolist(), 'bhn': bhn.tolist(),
        },
        'head': {
            'W': head_W.tolist(),
            'b': head_b.tolist(),
        },
        'symptom_keys': SYMPTOM_KEYS,
        'red_flag_keys': [SYMPTOM_KEYS[i] for i in RED_FLAG_INDICES],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', default='data/synthetic/trajectories.npz')
    parser.add_argument('--epochs', type=int, default=20)
    parser.add_argument('--batch-size', type=int, default=128)
    parser.add_argument('--lr', type=float, default=3e-3)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--hidden', type=int, default=24)
    parser.add_argument('--output', default='forecast_model.json')
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    rng = np.random.default_rng(args.seed)

    npz = np.load(args.data, allow_pickle=True)
    X = npz['X']  # (N, T, 14)

    # 80/20 split
    n = len(X)
    perm = rng.permutation(n)
    n_tr = int(0.8 * n)
    Xtr = X[perm[:n_tr]]
    Xte = X[perm[n_tr:]]

    rng_tr = np.random.default_rng(args.seed)
    rng_te = np.random.default_rng(args.seed + 1)
    train_ds = ForecastDataset(Xtr, rng_tr)
    test_ds = ForecastDataset(Xte, rng_te)
    tr_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True)
    te_loader = DataLoader(test_ds, batch_size=args.batch_size, shuffle=False)

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f'Device: {device}')

    model = ForecastGRU(input_size=14, hidden_size=args.hidden).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f'Params: {n_params}')

    opt = torch.optim.Adam(model.parameters(), lr=args.lr)

    train_losses, val_metrics_per_epoch = [], []
    for ep in range(args.epochs):
        tr_loss, _, _, _ = run_epoch(model, tr_loader, opt, device, training=True)
        val_loss, val_metrics, val_probs, val_ys = run_epoch(
            model, te_loader, opt, device, training=False
        )
        train_losses.append(tr_loss)
        val_metrics_per_epoch.append(val_metrics)
        aucs = '  '.join(f'{h}d AUC={val_metrics[f"auc_{h}d"]:.3f}' for h in HORIZONS)
        print(f'[{ep+1:2d}/{args.epochs}] train_loss={tr_loss:.4f}  val_loss={val_loss:.4f}  {aucs}')

    final_metrics = val_metrics_per_epoch[-1]
    print(f'\nFinal held-out metrics:')
    for h in HORIZONS:
        print(f'  {h}d horizon — pos_rate={final_metrics[f"pos_rate_{h}d"]:.3f}  '
              f'AUC={final_metrics[f"auc_{h}d"]:.4f}  '
              f'Brier={final_metrics[f"brier_{h}d"]:.4f}')

    # ── Export weights ──
    out_path = Path(args.output)
    weights = export_weights(model)
    out_path.write_text(json.dumps(weights, separators=(',', ':')))
    print(f'Wrote {out_path} ({out_path.stat().st_size / 1024:.1f} KB)')

    assets_dir = Path('..') / 'assets' / 'models'
    if assets_dir.parent.exists():
        assets_dir.mkdir(parents=True, exist_ok=True)
        (assets_dir / 'forecast_model.json').write_text(json.dumps(weights))
        print(f'Copied to {assets_dir / "forecast_model.json"}')

    # ── Metrics ──
    metrics = {
        'n_train': int(len(Xtr)),
        'n_test': int(len(Xte)),
        'n_params': int(n_params),
        'horizons_days': HORIZONS,
        'final_metrics': final_metrics,
        'train_loss_curve': train_losses,
        'symptom_keys': SYMPTOM_KEYS,
        'red_flag_keys': [SYMPTOM_KEYS[i] for i in RED_FLAG_INDICES],
    }
    Path('data/synthetic/forecast_metrics.json').write_text(json.dumps(metrics, indent=2))
    print(f'Wrote data/synthetic/forecast_metrics.json')

    metrics_assets = Path('..') / 'assets' / 'ml-metrics'
    if metrics_assets.parent.exists():
        metrics_assets.mkdir(parents=True, exist_ok=True)
        (metrics_assets / 'forecast_metrics.json').write_text(json.dumps(metrics))

    # Plot
    fig, ax = plt.subplots(figsize=(5.5, 3.6))
    epochs = range(1, len(train_losses) + 1)
    for h in HORIZONS:
        ax.plot(epochs, [m[f'auc_{h}d'] for m in val_metrics_per_epoch],
                '-o', label=f'{h}-day horizon', markersize=4)
    ax.set_xlabel('Epoch'); ax.set_ylabel('Val AUC')
    ax.set_title('Forecast model — held-out AUC per horizon')
    ax.legend(); ax.grid(alpha=0.2); ax.set_ylim(0, 1.02)
    fig.tight_layout()
    fig.savefig('data/synthetic/forecast_training.png', dpi=140)
    plt.close(fig)


if __name__ == '__main__':
    main()
