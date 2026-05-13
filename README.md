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
2. **Scan a bite or rash** — phone camera + an image classifier distinguishes tick bites and erythema migrans rashes from mosquito/spider/flea bites. Runs on a self-hosted PyTorch model with an on-device questionnaire fallback.
3. **Get a synthesized risk assessment** — combines symptom pattern, exposure history, and NH county-level CDC data into a 0–100 score with a clear recommendation (continue monitoring → see doctor → ER now).
4. **See local risk on a map** — every NH county color-coded by Lyme incidence rate vs. the national average.
5. **Generate a doctor report** — one-tap PDF of dated symptom logs, exposure context, and risk factors to bring to an appointment. Seeing a written timeline is far more convincing than describing it from memory.
6. **Patient advocacy** — for the "you've been told it's just a virus" case, ready-to-use scripts grounded in the IDSA 2020 guidelines (e.g., asking about empirical doxycycline in endemic areas without waiting for serology).

Nothing leaves the phone unless the user explicitly exports a PDF. All data is stored locally with AsyncStorage.

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
│   └── (tabs)/
│       ├── index.tsx         # Home — risk dashboard
│       ├── scan.tsx          # Photo classifier
│       ├── check.tsx         # Daily symptom check
│       ├── map.tsx           # NH county risk map
│       ├── report.tsx        # PDF generator
│       └── timeline.tsx      # Symptom history
├── lib/
│   ├── types.ts              # Core data shapes
│   ├── storage.ts            # AsyncStorage wrappers
│   ├── symptoms.ts           # Symptom catalog + red-flag rules
│   ├── risk-engine.ts        # 0–100 risk scoring
│   ├── nh-data.ts            # NH county CDC incidence data
│   ├── bite-scanner.ts       # ML server + on-device fallback
│   ├── pdf-generator.ts      # Doctor-report PDF builder
│   └── theme.ts              # Design tokens
├── components/             # Shared UI primitives
└── ml-server/              # Self-hosted PyTorch classifier (see below)
```

### Risk engine

[`lib/risk-engine.ts`](lib/risk-engine.ts) synthesizes four signals into a single score:

| Component | Max points | Examples |
|---|---|---|
| Symptom pattern | 40 | symptom count, severity, classic Lyme cluster |
| Exposure context | 30 | tick attached, bullseye rash, near woods |
| Geographic risk | 20 | NH county incidence vs. national average |
| Duration / persistence | 10 | sustained pattern across 3+ days |

Any red-flag symptom (facial droop, neck stiffness, heart palpitations) immediately escalates the assessment to **critical** and surfaces the ER modal — these are signs of neuro-Lyme or Lyme carditis and they don't wait.

The engine is **not a diagnostic tool.** It's a structured way for patients to walk into a doctor's office with organized evidence instead of a vague "I haven't felt right."

### ML classifier

[`ml-server/`](ml-server/) is a small FastAPI + PyTorch service that classifies bite/rash photos. It's trained on two public Kaggle datasets (Bug Bite Images + Lyme EM Rashes) covering 9 classes: ant, bed bug, chigger, flea, mosquito, spider, tick, erythema migrans, and uninfected skin.

The phone sends a base64 JPEG, gets back a label + confidence + top-3 predictions. When the server isn't reachable, [`lib/bite-scanner.ts`](lib/bite-scanner.ts) falls back to an on-device questionnaire-based classifier so the app keeps working offline.

See [`ml-server/README.md`](ml-server/README.md) for setup and training instructions.

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
