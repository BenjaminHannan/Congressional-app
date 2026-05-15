# Trace

**A Lyme disease tracking and patient-advocacy app for New Hampshire.**

Built for the [Congressional App Challenge](https://www.congressionalappchallenge.us/) — NH-02, Hanover.

**Repository:** [github.com/BenjaminHannan/Congressional-app](https://github.com/BenjaminHannan/Congressional-app)

---

> ### Impact — why this matters in NH-02
>
> - **200+ cases per 100,000 people.** Hanover and Lyme each reported Lyme incidence rates north of 200/100k in 2019 — about 22× the US national average.
> - **50%+ of adult ticks infected.** A UNH study of adult blacklegged ticks collected in Grafton County found over half carried *Borrelia burgdorferi*.
> - **~30% bullseye rate.** Only about 30% of Lyme patients ever develop the classic erythema migrans bullseye — most never see the "obvious" sign.
> - **2–4 week serology blind spot.** Standard antibody tests can return negative for the first 2–4 weeks of infection, exactly when treatment is most effective.

---

## Why I built this

A couple of years ago I was bitten by a tick in the woods around Hanover. I never saw a bullseye rash, my early symptoms looked like the flu, and by the time anyone connected the dots I had a full-blown case of Lyme disease that took months to recover from.

That experience isn't unusual here. New Hampshire is one of the highest-incidence states in the country, and the Upper Valley is a hot zone within it: in 2019, the towns of Hanover and Lyme each reported Lyme rates of **200+ cases per 100,000 people**, and a UNH study of ticks collected in Grafton County found that **more than 50% of adult blacklegged ticks were infected with *Borrelia burgdorferi*** — the bacterium that causes Lyme. The disease is hard to catch early because:

- Only ~30% of patients ever see the classic bullseye rash
- Standard antibody tests can be **negative for the first 2–4 weeks** of infection
- Early symptoms (fatigue, joint pain, headache) get dismissed as "just a virus"

By the time the diagnosis is obvious, the easy-to-treat window has often closed. Trace is built to shrink that window.

---

## What the app does

Trace is a privacy-first iOS/Android app (Expo + React Native) that helps people who suspect Lyme:

1. **Log symptoms daily** — 14 Lyme-specific symptoms tracked, including red flags (Bell's palsy, neck stiffness, heart palpitations) that need ER attention immediately.
2. **Scan a bite or rash** — phone camera + a fine-tuned **MobileNetV3** classifier identifies the bite type. Tap to view a **Grad-CAM saliency overlay** showing what the model looked at. On-device questionnaire (CDC erythema migrans criteria) fills in when the cloud server is unreachable.
3. **See a fusion-model risk score** — a **gradient-boosted decision-tree ensemble** combines 14 symptom flags, exposure context, and NH county incidence into a calibrated 0–100 probability of Lyme. Runs entirely on-device. The hand-tuned heuristic engine is shown alongside as an interpretable baseline.
4. **Watch your trajectory** — a tiny **GRU** scores the *shape* of your symptom history across days. Rendered as a sparkline on the Timeline tab — climbing is the visual signal a doctor wants to see.
5. **Local risk on a map** — every NH county color-coded by Lyme incidence rate vs. the national average.
6. **Generate a doctor report** — one-tap PDF of dated symptom logs, exposure context, and risk factors. Seeing a written timeline is far more convincing than describing it from memory.
7. **Patient advocacy** — ready-to-use scripts grounded in the IDSA 2020 guidelines for the "you've been told it's just a virus" case.
8. **Full ML transparency** — *About → How the AI works* surfaces confusion matrix, calibration diagram, feature importances, and a model card with known limitations.

Nothing leaves the phone unless the user explicitly exports a PDF. All data is stored locally with AsyncStorage. The fusion and temporal models run in pure TypeScript on-device — even risk synthesis never touches a server.

---

## Screenshots

| Welcome | Home | Symptom check | NH map | Doctor PDF |
|---|---|---|---|---|
| ![Welcome](docs/screenshots/01-welcome.png) | ![Home](docs/screenshots/02-home.png) | ![Check](docs/screenshots/03-check.png) | ![Map](docs/screenshots/04-map.png) | ![PDF](docs/screenshots/05-pdf.png) |

See [`docs/screenshots/README.md`](docs/screenshots/README.md) for what each capture should show.

---

## Architecture

```
trace/
├── app/                    # Expo Router screens
│   ├── _layout.tsx           # Root stack, onboarding routing
│   ├── index.tsx             # Splash / entry router
│   ├── welcome.tsx           # Onboarding intro
│   ├── exposure-form.tsx     # Initial exposure questionnaire
│   ├── red-flag.tsx          # Modal: ER-now warning
│   ├── advocacy.tsx          # Modal: doctor advocacy scripts
│   ├── about.tsx             # Modal: version, repo, disclaimer
│   ├── ml-explainability.tsx # Modal: ML model card + metrics
│   └── (tabs)/
│       ├── index.tsx         # Home — ML risk gauge + baseline
│       ├── scan.tsx          # MobileNetV3 + Grad-CAM
│       ├── check.tsx         # Daily symptom check
│       ├── map.tsx           # NH county risk map
│       ├── report.tsx        # PDF generator
│       └── timeline.tsx      # GRU trajectory sparkline + entries
├── lib/
│   ├── types.ts              # Core data shapes
│   ├── storage.ts            # AsyncStorage wrappers
│   ├── symptoms.ts           # Symptom catalog + red-flag rules
│   ├── risk-engine.ts        # Heuristic + ML risk synthesis
│   ├── nh-data.ts            # NH county CDC incidence data
│   ├── bite-scanner.ts       # ML server client + Grad-CAM fetcher
│   ├── pdf-generator.ts      # Doctor-report PDF builder
│   ├── theme.ts              # Design tokens
│   └── ml/
│       ├── risk-fusion.ts        # Pure-TS GBM tree walker
│       └── symptom-progression.ts # Pure-TS GRU forward pass
├── assets/
│   ├── models/                  # Trained model JSON (bundled)
│   │   ├── risk_model.json         # ~100 KB GBM
│   │   └── temporal_model.json     # ~30 KB GRU
│   └── ml-metrics/              # Held-out metrics for explainability tab
│       ├── fusion_metrics.json
│       └── temporal_metrics.json
├── ml-server/              # FastAPI + PyTorch CV head + training pipeline
│   ├── server.py               # /classify + /explain (Grad-CAM)
│   ├── train.py                # MobileNetV3 fine-tuning
│   ├── gen_synthetic_cohort.py  # Phase 2 training data
│   ├── train_risk_fusion.py     # GBM training + JSON export
│   ├── gen_synthetic_trajectories.py
│   ├── train_temporal.py        # GRU training + JSON export
│   ├── Dockerfile               # For HF Spaces deploy
│   └── README_HF_SPACES.md      # Cloud-deploy guide
└── docs/
    ├── ML.md                   # Full model card
    └── DEMO_SCRIPT.md          # 90-second video script
```

### Machine learning

Trace runs three trained models and a heuristic baseline. The heuristic
is the floor — easy to read, trivially auditable. The ML models are the
lift. Both are surfaced in the UI so a viewer can see they agree. Full
model card (architectures, training data, held-out metrics, limitations)
is in [`docs/ML.md`](docs/ML.md).

```
inputs                  models                       UI
──────                  ──────                       ──
bite photo  ───────►  MobileNetV3 (8-class)  ────►  Scan tab
                      + Grad-CAM saliency           (top-3 bars + heat map)

14-day symptom  ────► GRU (hidden=16, ~1.5k    ────► Timeline sparkline
trajectory            params, per-day prob)

symptoms +      ────► Gradient-boosted          ────► Home risk gauge
exposure +            decision trees            ────► (calibrated P(Lyme)
NH county             (3-class, calibrated)            + per-feature bars)
```

| Head | Where it runs | Held-out metric |
|---|---|---|
| **CV** — bite type | Cloud FastAPI (optional, see [`ml-server/`](ml-server/)) | 8-class softmax |
| **Fusion** — risk synthesis | **On-device, pure-TS** | Accuracy 0.96, AUC 0.99, Brier 0.025 |
| **Temporal** — trajectory | **On-device, pure-TS** | AUC 1.00 (synthetic; see model card) |

The fusion and temporal models bundle as JSON assets
(`assets/models/risk_model.json`, `assets/models/temporal_model.json`) and
walk in pure TypeScript at runtime — no native modules, no EAS dev build
required. The CV head requires the cloud server; the Scan tab gracefully
falls back to an on-device questionnaire when it's not reachable.

In-app, tap **About → How the AI works** to see the confusion matrix,
reliability diagram, feature importances, an example trajectory rollout,
and the honest list of known limitations (synthetic training data,
demographic skew in skin imagery, not a diagnostic device).

### Risk engine (heuristic baseline)

[`lib/risk-engine.ts`](lib/risk-engine.ts) synthesizes four signals into a single score:

| Component | Max points | Examples |
|---|---|---|
| Symptom pattern | 40 | symptom count, severity, classic Lyme cluster |
| Exposure context | 30 | tick attached, bullseye rash, near woods |
| Geographic risk | 20 | NH county incidence vs. national average |
| Duration / persistence | 10 | sustained pattern across 3+ days |

Any red-flag symptom (facial droop, neck stiffness, heart palpitations) immediately escalates the assessment to **critical** and surfaces the ER modal — these are signs of neuro-Lyme or Lyme carditis and they don't wait. This logic also overrides the ML head when red flags are present.

The engine is **not a diagnostic tool.** It's a structured way for patients to walk into a doctor's office with organized evidence instead of a vague "I haven't felt right."

### Reproducing the ML pipeline

```bash
cd ml-server
./venv/Scripts/python.exe gen_synthetic_cohort.py --n 10000
./venv/Scripts/python.exe train_risk_fusion.py
./venv/Scripts/python.exe gen_synthetic_trajectories.py --n 10000
./venv/Scripts/python.exe train_temporal.py
```

The four commands generate the synthetic cohorts, train the fusion GBM
and temporal GRU, and mirror the resulting JSON artifacts into
`assets/models/` and `assets/ml-metrics/`. Re-running with the same seed
produces byte-identical outputs.

For the CV head, see [`ml-server/README.md`](ml-server/README.md) (Kaggle
dataset download + `train.py` instructions). The deploy guide is
[`ml-server/README_HF_SPACES.md`](ml-server/README_HF_SPACES.md).

---

## Running it

### Phone app

```bash
cd trace
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS/Android), or press `i` / `a` for simulator.

### ML server (optional — only needed for the camera classifier demo)

See [`ml-server/README.md`](ml-server/README.md). Quickstart:

```bash
cd ml-server
python -m venv venv
.\venv\Scripts\activate    # Windows
pip install -r requirements.txt
# ... download datasets, train ...
python server.py
ngrok http 8000            # paste URL into lib/bite-scanner.ts
```

Without the server, the Scan tab uses the on-device fallback classifier — nothing breaks.

---

## Building for distribution

Trace is built with [EAS Build](https://docs.expo.dev/build/introduction/).
The commands below assume you have the EAS CLI installed and are logged in
(`npm install -g eas-cli` then `eas login`).

```bash
# One-time, from the trace/ directory
eas build:configure

# iOS — internal-distribution simulator build, no Apple Developer enrollment needed
eas build --platform ios --profile preview

# Android — installable .apk for sideloading onto a test device
eas build --platform android --profile preview
```

For a production submission build (App Store / Play Store), swap
`--profile preview` for `--profile production` once an `eas.json` profile is
configured. See [EAS Build profiles](https://docs.expo.dev/build/eas-json/).

---

## Tech stack

- **Expo SDK 54** + **React Native 0.81** + **Expo Router 6** (file-based routing)
- **TypeScript** throughout
- **AsyncStorage** for local persistence (zero backend, zero accounts)
- **expo-image-picker** + **expo-print** + **expo-sharing** for camera and PDF export
- **PyTorch** + **FastAPI** for the optional ML classifier
- Public CDC NH county-level Lyme incidence data

---

## Privacy

Trace is designed so a teenager in a household that doesn't believe in Lyme — or anyone with reasons to keep medical data off the cloud — can use it safely.

- No accounts, no logins, no analytics, no telemetry.
- Symptom logs, exposure data, and bite photos live only on the device.
- The PDF report is generated locally and only leaves the phone if the user shares it.
- The ML server (when used) doesn't store images; it classifies and returns.

---

## Status

This is a Congressional App Challenge submission for NH-02, 2026. Built by Benjamin Hannan, Hanover, NH.

---

## Submission readiness

### Done

- [x] Blocker fixes: hardcoded ngrok URL replaced with a null-default `ML_SERVER_URL` constant; scan / timeline screens audited end-to-end; empty-state CTAs on Home, Timeline, and Report.
- [x] Credibility: tightened medical disclaimer in the PDF header and home footer; tappable IDSA 2020 + CDC 2019–2023 citations on advocacy and check result; CDC source comment block + per-value verification TODO in `lib/nh-data.ts`.
- [x] Polish: warning haptic on the red-flag modal mount; `accessibilityLabel`/`accessibilityRole` on icon-only buttons across `app/` and `components/`.
- [x] About screen at `app/about.tsx`, reachable from an info icon in the Home tab header. Shows version (read from `app.json` via `expo-constants`), author, CAC NH-02 2026, and the disclaimer.
- [x] `CHANGELOG.md` (v1.0.0) at the repo root.
- [x] README: NH "Impact" callout, screenshots section + folder, EAS distribution commands.
- [x] **Three-model ML pipeline:** MobileNetV3 image classifier (CV) + sklearn GBM (fusion risk) + tiny GRU (temporal trajectory). Fusion + temporal models run pure-TS on-device. Full reproducible training pipeline in `ml-server/`.
- [x] **Grad-CAM saliency overlay** on the Scan tab — `/explain` endpoint on the FastAPI server, base64 PNG rendered with a toggle on the result screen.
- [x] **Home ML risk gauge** with class-probability bars and per-feature contribution attributions, plus the heuristic baseline shown alongside as a sanity check.
- [x] **Timeline trajectory sparkline** powered by an on-device GRU forward pass.
- [x] **ML explainability tab** at `app/ml-explainability.tsx` — confusion matrix, reliability diagram, feature importances, example rollout, and an honest limitations section.
- [x] **Model card** at [`docs/ML.md`](docs/ML.md) — architectures, training data, held-out metrics, known limitations (synthetic-data caveat, demographic skew). Demo script at [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).
- [x] **HF Spaces deploy guide** at [`ml-server/README_HF_SPACES.md`](ml-server/README_HF_SPACES.md) + `Dockerfile` so the CV head can run on a stable free URL instead of laptop+ngrok.
- [x] Unit tests: `jest` + `ts-jest` cover the heuristic risk engine AND the fusion + temporal models. Run with `npm test`.

### Still mine

- [ ] Record the demo video — script lives at [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).
- [ ] Capture the eight screenshots referenced in [`docs/screenshots/README.md`](docs/screenshots/README.md), including the three new ML captures (Grad-CAM overlay, Timeline sparkline, ML Explainability tab).
- [ ] Deploy `ml-server/` to Hugging Face Spaces and paste the URL into `lib/bite-scanner.ts::ML_SERVER_URL`. Step-by-step in [`ml-server/README_HF_SPACES.md`](ml-server/README_HF_SPACES.md).
- [ ] Design a custom app icon in Figma — `assets/images/icon.png` is still the default Expo icon.
- [ ] Clinician outreach for an explicit medical-content review sign-off.
- [ ] `eas build --platform ios --profile preview` and `--platform android --profile preview` once Apple/Google distribution is sorted out.
- [ ] Verify every county incidence number, the NH state average, and the US national average against the latest CDC NNDSS release (checklist already in `lib/nh-data.ts`).
