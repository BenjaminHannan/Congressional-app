# Changelog

All notable changes to Trace are documented here. This project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
