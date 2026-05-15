# Changelog

All notable changes to Trace are documented here. This project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] — five novel features the past CAC winners didn't do

- **Multi-horizon red-flag forecasting.** New GRU forecasting head predicts
  the probability of red-flag symptoms (neck stiffness, facial droop, heart
  palpitations) emerging in 1, 3, or 7 days given the user's current
  trajectory. Held-out AUC 0.82–0.85 on synthetic data — genuinely
  predictive, not perfect-1.0-overfit. The heuristic risk engine cannot do
  this; predicting *future* state requires the GRU's latent dynamics.
- **Rule-based NLP symptom extractor.** Free-text or dictated voice notes
  on the Check tab can be auto-converted into structured symptoms — with
  negation scoping ("denies fatigue", "no headache but stiff neck")
  handled deterministically. Suggestions are shown as chips the user can
  accept or reject; nothing committed without confirmation.
- **Lyme antibiotic drug-interaction checker.** Curated, source-cited
  database of major interactions for doxycycline, amoxicillin, cefuroxime,
  and ceftriaxone. Severity-coded results (contraindicated → major →
  moderate → minor), each with mechanism, recommendation, and DailyMed/FDA
  citation. Reachable from the Advocacy modal.
- **Community tick-sightings map.** New "Recent Tick Sightings" panel on
  the NH Map tab pre-seeded with public UNH Cooperative Extension drag-
  sampling data and community-reported observations across all 10 NH
  counties. Users can add their own sightings; everything is stored
  locally (no backend in v1.2, called out honestly in the disclaimer).
- **Coin-reference rash diameter measurement.** Photo + 4 taps (2 on the
  US quarter, 2 on the rash) computes rash diameter in mm/cm and flags
  the IDSA-2020 5 cm erythema migrans threshold. No native AR module —
  works in Expo Go.

Implementation:
- `ml-server/train_forecast.py`, `gen_synthetic_trajectories.py` (existing)
  → `assets/models/forecast_model.json` (59 KB).
- `lib/ml/forecast.ts`, `lib/ml/symptom-extractor.ts`,
  `lib/drug-interactions.ts`, `lib/tick-sightings.ts` — all pure-TS,
  on-device.
- New screens: `app/drug-check.tsx`, `app/measure-rash.tsx`.
- New tests: `forecast.test.ts`, `symptom-extractor.test.ts`,
  `drug-interactions.test.ts`, `tick-sightings.test.ts` — 27 new tests,
  total 44/44 passing.
- Metro bundles all 22 routes cleanly including the new modals.

## [1.1.0] — ML expansion

- **Three-model ML pipeline.** Image (MobileNetV3, 8-class bug-bite classifier
  hosted as an optional FastAPI service), fusion risk (gradient-boosted decision
  trees trained on a 10k-row synthetic cohort grounded in IDSA 2020 + CDC
  surveillance priors), and a tiny GRU that scores the *shape* of a user's
  symptom trajectory across days. The fusion and temporal models run pure-TS
  on-device — no native modules, no EAS dev build required, no data leaves
  the phone.
- **Grad-CAM saliency.** Scan results screen has a toggle that overlays a
  red-yellow heat map showing which pixels of the photo the model used.
- **Per-feature contribution attribution.** Home screen surfaces the top
  features the fusion model weighted on the current input, computed by
  single-feature ablation.
- **Trajectory sparkline.** Timeline tab renders the GRU's per-day Lyme
  probability as a sparkline above the entry list, with trend badge.
- **ML Explainability tab** (`app/ml-explainability.tsx`) reachable from
  About. Confusion matrix, reliability diagram, feature importances,
  example trajectory rollout, and a model card with limitations (synthetic
  training data, demographic skew in skin imagery).
- **Reproducible training pipeline** in `ml-server/`. Four scripts
  (`gen_synthetic_cohort.py`, `train_risk_fusion.py`,
  `gen_synthetic_trajectories.py`, `train_temporal.py`) regenerate the
  fusion + temporal models byte-identically from seed.
- **HF Spaces deploy guide** + `Dockerfile` for the CV head.
- **Held-out metrics** at submission: fusion accuracy 0.96, AUC 0.99,
  Brier 0.025; temporal AUC ~1.0 on synthetic data (artifact, called out
  in the model card).
- **Tests.** Added `risk-fusion.test.ts` and `symptom-progression.test.ts`
  alongside the existing risk-engine tests.

## [1.0.0] — 2026 Congressional App Challenge submission

Initial release.

- **Daily symptom logging.** 14 Lyme-specific symptoms tracked, including red
  flags (Bell's palsy, neck stiffness, heart palpitations) that immediately
  escalate the assessment and surface an ER-now modal.
- **Bite / rash scanner.** Take or pick a photo and run an on-device
  questionnaire-based classifier (CDC erythema migrans criteria), with an
  optional path to a self-hosted PyTorch model for image classification.
- **0–100 risk synthesis.** Combines symptom pattern, exposure history, and
  NH county-level CDC incidence data into a single score with a clear
  recommendation (continue monitoring → see doctor → ER now).
- **NH county heatmap.** Every NH county color-coded by Lyme incidence rate
  vs. the national average. Tap a county for cases per 100k, multiplier,
  population, and estimated annual case count.
- **Doctor-ready PDF report.** One-tap export of dated symptom logs, exposure
  context, risk factors, and suggested questions for the appointment.
- **Patient advocacy guide.** Ready-to-use scripts grounded in the IDSA 2020
  Lyme Disease Clinical Practice Guidelines for the "you've been told it's
  just a virus" case.
- **Privacy by default.** No accounts, no cloud, no analytics, no telemetry.
  All data is stored locally with AsyncStorage. The PDF report leaves the
  phone only if the user explicitly shares it.
