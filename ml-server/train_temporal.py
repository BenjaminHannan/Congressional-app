"""
Trace ML — Temporal Symptom-Progression Model

Trains a tiny GRU (1 layer, hidden=16, ~2k params) on synthetic symptom
trajectories and exports its weights to JSON for pure-TS inference on-device.

The model produces a per-day "trajectory probability" — at each day t, given
the symptom history up to and including t, how strongly does the *shape* of
that history match Lyme progression? The Timeline tab renders this as a
sparkline above the daily entries: a climbing curve is the visual signal a
doctor wants to see.

Architecture:

    x_t ∈ R^14  →  GRU(hidden=16)  →  Linear(16 → 1)  →  σ  →  p_t ∈ (0, 1)

Why a GRU rather than an LSTM or Transformer:
  - Smallest standard RNN unit that handles vanishing gradients on 14-day windows.
  - ~2k parameters total → JSON fits in <50 KB → ships as a static asset.
  - Pure-TS forward pass is ~30 lines of matrix-multiply.

Usage:
    python train_temporal.py

Outputs:
    temporal_model.json                     — loaded by lib/ml/symptom-progression.ts
    data/synthetic/temporal_metrics.json    — held-out metrics + sample trajectories
    data/synthetic/temporal_training.png    — train/val loss curves
"""

import argparse
import json
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import roc_auc_score, brier_score_loss
import matplotlib.pyplot as plt


class TinyGRU(nn.Module):
    def __init__(self, input_size=14, hidden_size=16):
        super().__init__()
        self.gru = nn.GRU(input_size, hidden_size, num_layers=1, batch_first=True)
        self.head = nn.Linear(hidden_size, 1)

    def forward(self, x):
        out, _ = self.gru(x)              # (B, T, H)
        logits = self.head(out)           # (B, T, 1)
        return logits.squeeze(-1)         # (B, T)


def _last_step_loss(logits: torch.Tensor, y: torch.Tensor) -> torch.Tensor:
    """Binary CE on the final-day prediction. Auxiliary objective on every step."""
    last = logits[:, -1]
    return nn.functional.binary_cross_entropy_with_logits(last, y.float())


def _every_step_loss(logits: torch.Tensor, y: torch.Tensor) -> torch.Tensor:
    """Encourage the per-step probability to track progressively up across the
    sequence by supervising every step with the trajectory-level label. This
    creates a useful sparkline even on partial histories."""
    B, T = logits.shape
    y_t = y.float().unsqueeze(1).expand(B, T)
    return nn.functional.binary_cross_entropy_with_logits(logits, y_t)


def train_one_epoch(model, loader, optim, device):
    model.train()
    total = 0.0
    n = 0
    for x, y in loader:
        x = x.to(device); y = y.to(device)
        optim.zero_grad()
        logits = model(x)
        loss = 0.5 * _last_step_loss(logits, y) + 0.5 * _every_step_loss(logits, y)
        loss.backward()
        optim.step()
        total += loss.item() * x.size(0)
        n += x.size(0)
    return total / n


@torch.no_grad()
def eval_model(model, loader, device):
    model.eval()
    all_last, all_y = [], []
    losses = []
    for x, y in loader:
        x = x.to(device); y = y.to(device)
        logits = model(x)
        last_logit = logits[:, -1]
        last_prob = torch.sigmoid(last_logit)
        loss = 0.5 * _last_step_loss(logits, y) + 0.5 * _every_step_loss(logits, y)
        losses.append(loss.item() * x.size(0))
        all_last.append(last_prob.cpu().numpy())
        all_y.append(y.cpu().numpy())
    all_last = np.concatenate(all_last)
    all_y = np.concatenate(all_y)
    mean_loss = sum(losses) / len(all_y)
    try:
        auc = roc_auc_score(all_y, all_last)
    except Exception:
        auc = float('nan')
    brier = brier_score_loss(all_y, all_last)
    return mean_loss, auc, brier, all_last, all_y


def export_gru_weights(model: TinyGRU) -> dict:
    """
    PyTorch GRU stacks Wir|Wiz|Win in `weight_ih_l0` (shape 3H × I) and
    Whr|Whz|Whn in `weight_hh_l0` (3H × H). We split them into the three
    gates (reset, update, new) so the JS-side forward pass can be written
    line-for-line against the standard GRU equations:

        r_t = σ(W_ir · x_t + b_ir + W_hr · h_{t-1} + b_hr)
        z_t = σ(W_iz · x_t + b_iz + W_hz · h_{t-1} + b_hz)
        n_t = tanh(W_in · x_t + b_in + r_t ⊙ (W_hn · h_{t-1} + b_hn))
        h_t = (1 - z_t) ⊙ n_t + z_t ⊙ h_{t-1}
    """
    gru = model.gru
    H = gru.hidden_size
    W_ih = gru.weight_ih_l0.detach().cpu().numpy()     # (3H, I)
    W_hh = gru.weight_hh_l0.detach().cpu().numpy()     # (3H, H)
    b_ih = gru.bias_ih_l0.detach().cpu().numpy()       # (3H,)
    b_hh = gru.bias_hh_l0.detach().cpu().numpy()       # (3H,)

    def split3(arr):
        return arr[0:H], arr[H:2 * H], arr[2 * H:3 * H]

    Wir, Wiz, Win = split3(W_ih)
    Whr, Whz, Whn = split3(W_hh)
    bir, biz, bin_ = split3(b_ih)
    bhr, bhz, bhn = split3(b_hh)

    head_W = model.head.weight.detach().cpu().numpy()  # (1, H)
    head_b = model.head.bias.detach().cpu().numpy()    # (1,)

    return {
        'version': 1,
        'type': 'gru-binary',
        'input_size': gru.input_size,
        'hidden_size': H,
        'gru': {
            'Wir': Wir.tolist(), 'Wiz': Wiz.tolist(), 'Win': Win.tolist(),
            'Whr': Whr.tolist(), 'Whz': Whz.tolist(), 'Whn': Whn.tolist(),
            'bir': bir.tolist(), 'biz': biz.tolist(), 'bin': bin_.tolist(),
            'bhr': bhr.tolist(), 'bhz': bhz.tolist(), 'bhn': bhn.tolist(),
        },
        'head': {
            'W': head_W[0].tolist(),       # (H,)
            'b': float(head_b[0]),
        },
        'symptom_keys': [
            'fatigue', 'jointPain', 'headache', 'brainFog', 'fever',
            'neckStiffness', 'facialDroop', 'heartPalpitations',
            'rash', 'muscleAches', 'chills', 'swollenLymphNodes',
            'dizziness', 'nightSweats',
        ],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', default='data/synthetic/trajectories.npz')
    parser.add_argument('--epochs', type=int, default=15)
    parser.add_argument('--batch-size', type=int, default=128)
    parser.add_argument('--lr', type=float, default=3e-3)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--output', default='temporal_model.json')
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    npz = np.load(args.data, allow_pickle=True)
    X = npz['X']
    y = npz['y']
    symptom_keys = list(npz['symptom_keys'])

    # 80/20 split
    n = len(X)
    perm = np.random.permutation(n)
    n_train = int(0.8 * n)
    train_idx, test_idx = perm[:n_train], perm[n_train:]
    Xtr, ytr = X[train_idx], y[train_idx]
    Xte, yte = X[test_idx], y[test_idx]

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f'Training on: {device}')

    tr_loader = DataLoader(
        TensorDataset(torch.from_numpy(Xtr), torch.from_numpy(ytr)),
        batch_size=args.batch_size, shuffle=True,
    )
    te_loader = DataLoader(
        TensorDataset(torch.from_numpy(Xte), torch.from_numpy(yte)),
        batch_size=args.batch_size, shuffle=False,
    )

    model = TinyGRU(input_size=X.shape[2], hidden_size=16).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    print(f'Model params: {n_params}')

    optim = torch.optim.Adam(model.parameters(), lr=args.lr)

    train_losses = []
    val_aucs = []
    for ep in range(args.epochs):
        tr_loss = train_one_epoch(model, tr_loader, optim, device)
        val_loss, auc, brier, _, _ = eval_model(model, te_loader, device)
        train_losses.append(tr_loss)
        val_aucs.append(auc)
        print(f'[Epoch {ep+1:2d}/{args.epochs}] '
              f'train_loss={tr_loss:.4f}  val_loss={val_loss:.4f}  '
              f'AUC={auc:.4f}  Brier={brier:.4f}')

    # Final eval
    val_loss, auc, brier, probs, ys = eval_model(model, te_loader, device)
    print(f'\nHeld-out: AUC={auc:.4f}  Brier={brier:.4f}  n={len(ys)}')

    # ── Export weights ──
    out_path = Path(args.output)
    weights = export_gru_weights(model)
    out_path.write_text(json.dumps(weights, separators=(',', ':')))
    print(f'Wrote {out_path} ({out_path.stat().st_size / 1024:.1f} KB)')

    # Copy to assets/
    assets_dir = Path('..') / 'assets' / 'models'
    if assets_dir.parent.exists():
        assets_dir.mkdir(parents=True, exist_ok=True)
        (assets_dir / 'temporal_model.json').write_text(json.dumps(weights))
        print(f'Copied to {assets_dir / "temporal_model.json"}')

    # ── Metrics + example attention rollout ──
    # Pick one positive trajectory and run it through the model day-by-day to
    # get the per-step probability — this lands directly on the explainability tab.
    model.eval()
    with torch.no_grad():
        pos_mask = ys == 1
        if pos_mask.sum() > 0:
            example_X = torch.from_numpy(Xte[pos_mask][0:1]).to(device)
            example_logits = model(example_X)
            example_per_step = torch.sigmoid(example_logits).cpu().numpy()[0].tolist()
            example_input = Xte[pos_mask][0].tolist()
        else:
            example_per_step = []
            example_input = []

    metrics = {
        'auc': float(auc),
        'brier': float(brier),
        'val_loss': float(val_loss),
        'n_train': int(len(Xtr)),
        'n_test': int(len(Xte)),
        'n_params': int(n_params),
        'seq_len': int(X.shape[1]),
        'symptom_keys': symptom_keys,
        'train_loss_curve': train_losses,
        'val_auc_curve': val_aucs,
        'example_input': example_input,
        'example_per_step_prob': example_per_step,
    }
    Path('data/synthetic/temporal_metrics.json').write_text(json.dumps(metrics, indent=2))
    print(f'Wrote data/synthetic/temporal_metrics.json')

    metrics_assets = Path('..') / 'assets' / 'ml-metrics'
    if metrics_assets.parent.exists():
        metrics_assets.mkdir(parents=True, exist_ok=True)
        (metrics_assets / 'temporal_metrics.json').write_text(json.dumps(metrics))
        print(f'Copied to {metrics_assets / "temporal_metrics.json"}')

    # ── Training curve plot ──
    fig, ax = plt.subplots(figsize=(4.2, 3.6))
    ax2 = ax.twinx()
    epochs = list(range(1, args.epochs + 1))
    ax.plot(epochs, train_losses, color='#0d9488', label='Train loss')
    ax2.plot(epochs, val_aucs, color='#dc2626', linestyle='--', label='Val AUC')
    ax.set_xlabel('Epoch'); ax.set_ylabel('Loss', color='#0d9488')
    ax2.set_ylabel('AUC', color='#dc2626')
    ax.set_title(f'Temporal GRU — final AUC {auc:.3f}, Brier {brier:.3f}')
    fig.tight_layout()
    fig.savefig('data/synthetic/temporal_training.png', dpi=140)
    plt.close(fig)
    print(f'Plots written to data/synthetic/')


if __name__ == '__main__':
    main()
