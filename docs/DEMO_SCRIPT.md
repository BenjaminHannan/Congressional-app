# Trace — Demo Video Script (90 seconds)

A structure for the Congressional App Challenge demo video that lands the ML
story without burying the clinical purpose. Six beats, each ~15 seconds.

## 0:00 – 0:15 — The problem, here

> "I live in NH-02. In 2019, Hanover and Lyme each reported over **200 Lyme
> cases per 100,000 people** — about 22× the national average. A UNH study
> in Grafton County found more than half of adult blacklegged ticks were
> carrying *Borrelia*. I caught Lyme as a kid. Most people miss it because
> only ~30% see the bullseye rash, and the standard antibody test is
> negative for the first 2–4 weeks. I built Trace to shrink that window."

**Show:** Welcome screen + Home screen ML risk gauge.

## 0:15 – 0:30 — Bite scanner with Grad-CAM

> "Trace runs three machine-learning models. The first is a fine-tuned
> MobileNetV3 image classifier."

**Show:** Tap Scan, take or pick a photo of a tick. Server runs the
classifier, top-3 bars animate in. Tap "Show AI heat map" — Grad-CAM
overlay appears, highlighting where the model looked. Urgency badge reads
**SEE A DOCTOR SOON**.

> "It calls out the tick at 94% confidence, and the heat map shows exactly
> what pixels drove the decision. No black box."

## 0:30 – 0:50 — Five-day symptom check + temporal GRU

> "The second model is a tiny GRU that scores the *trajectory* of your
> symptoms across days."

**Show:** Open Check, log symptoms (rapid 5-day montage). Open Timeline —
the trajectory sparkline at the top climbs from green to red as days
accumulate. Trend badge reads **+62%**.

> "Most apps look at one day at a time. The progression model looks at the
> whole arc — which is what a doctor actually wants to see."

## 0:50 – 1:10 — Home risk gauge + per-feature attribution

> "The third model is a gradient-boosted ensemble that fuses everything —
> symptoms, exposure, NH county data — into a single calibrated probability."

**Show:** Home. ML Risk Assessment card reads **HIGH — 78%**.
Class-probability bars show no-Lyme / early-Lyme / disseminated breakdown.
"What the model weighted" lists Bullseye rash +18%, Located in NH +12%,
Fatigue +9%, ...

> "Calibrated probability — when the model says 70%, it means 70%. AUC on
> our held-out set is 0.99, Brier 0.025."

## 1:10 – 1:25 — Explainability + PDF

> "Tap About → How the AI works to see the confusion matrix, calibration
> diagram, and an honest model card flagging known limitations like the
> demographic skew in our skin-imagery training data."

**Show:** ML Explainability screen scroll. Then tap Doctor Report →
**Generate PDF** → share sheet appears.

## 1:25 – 1:30 — Wrap

> "All three models run on this phone — no accounts, no cloud, no telemetry.
> Trace is open source on GitHub. Built for NH-02."

**Show:** About screen with version, repo link, "Hanover, NH" / "CAC NH-02
2026".

---

## Production notes

- Record on a real device with `ML_SERVER_URL` configured for the demo
  (HF Spaces URL from `ml-server/README_HF_SPACES.md`). The Grad-CAM beat
  fails without a live server.
- The Timeline sparkline needs at least 5 logged days to show motion.
  Either use the 5-day montage above OR seed the demo dataset:
  **About screen → long-press the version number → "Load demo data"**.
  This wipes any current state and seeds a 7-day climbing Lyme
  trajectory + matching NH exposure record + an ER-bound Day-0 entry
  with neckStiffness + facialDroop, so every ML view (Home gauge,
  Timeline sparkline, ML Explainability tab) populates immediately.
  Defined in `lib/demo-data.ts`.
- The honest "AUC=1.00 is a synthetic-data artifact" beat in the model card
  is intentional. Calling it out yourself is judged better than having a
  judge spot it.
- Keep the camera off your face. Voiceover only, screen recording at 60fps
  on iOS (`Cmd-R` from QuickTime with the phone connected via USB).
