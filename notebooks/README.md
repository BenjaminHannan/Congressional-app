# Notebooks

Reproducible analysis notebooks for Trace's ML pipeline. Each one is a
self-contained end-to-end run of one head of the model — load the data,
train, evaluate, visualize. Charts are inlined so GitHub renders them
directly without needing to re-execute.

| File | What it covers |
|---|---|
| `02_risk_fusion.ipynb` | The gradient-boosted fusion risk model. Loads `ml-server/data/synthetic/cohort.csv`, trains the same `GradientBoostingClassifier` used in `train_risk_fusion.py`, shows prior-prevalence sanity checks, confusion matrix, reliability diagram, feature importances. |
| `03_temporal.ipynb` | The tiny GRU trajectory model. Loads `ml-server/data/synthetic/trajectories.npz`, trains a 1-layer GRU (hidden=16), shows example positive/negative sequences, training curves, and per-step probability rollouts. |

> The CV head (MobileNetV3) is trained via `ml-server/train.py` — there is
> no notebook for it because the dataset is too large to include in the
> repo and training requires a GPU. The model card in `docs/ML.md`
> describes its architecture and training procedure.

## How to run

```bash
cd ml-server
./venv/Scripts/python.exe gen_synthetic_cohort.py --n 10000 --seed 42
./venv/Scripts/python.exe gen_synthetic_trajectories.py --n 10000 --seed 42

cd ../notebooks
../ml-server/venv/Scripts/jupyter.exe notebook        # or `jupyter lab`
```

Or re-execute headlessly (what we run before commits):

```bash
../ml-server/venv/Scripts/jupyter.exe nbconvert \
  --to notebook --execute --inplace 02_risk_fusion.ipynb
../ml-server/venv/Scripts/jupyter.exe nbconvert \
  --to notebook --execute --inplace 03_temporal.ipynb
```

The notebooks are deterministic given the seeds set inside them — the same
input → the same model → the same metrics. The fusion notebook produces
byte-identical `risk_model.json` to `train_risk_fusion.py` (same
hyperparameters, same seed).
