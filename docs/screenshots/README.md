# Screenshots

Drop final PNGs here using the exact filenames below. The top-level README
references them in its `## Screenshots` section.

Recommended: portrait (1290 × 2796 from an iPhone 15 Pro simulator) or
the equivalent Android resolution. Keep them under ~800 KB each.

| File              | What it should show |
|-------------------|---------------------|
| `01-welcome.png`  | Welcome / onboarding screen — logo, tagline, the three entry-path cards ("I found a tick on me", "Something doesn't feel right", "I'm already diagnosed"). |
| `02-home.png`     | Home dashboard with the **ML Risk Assessment** card populated: percentage gauge, three class-probability bars (no-Lyme / early / disseminated), "What the model weighted" feature contributions, AND the muted "Interpretable baseline" card below showing the heuristic agrees. |
| `03-check.png`    | Symptom-check screen, mid-flow, with several symptoms selected and one red-flag symptom (e.g. neck stiffness) tapped to demonstrate the red-flag styling. |
| `04-map.png`      | NH heatmap with a county selected — Grafton is a good choice for the NH-02 framing. Should include the detail card with cases/100k and the national-average multiplier. |
| `05-pdf.png`      | The doctor-report PDF (either the preview from `expo-print` or a screenshot of the generated PDF) showing the disclaimer header, risk badge, exposure context, and timeline table. |
| `06-scan-gradcam.png` | Scan results screen with the **AI heat-map overlay** toggle active — Grad-CAM red/yellow regions visible over a tick photo. Top-3 prediction bars below, "Tick" leading. |
| `07-timeline-sparkline.png` | Timeline tab with the **Trajectory Model** sparkline card at the top — 5+ days of bars, climbing to red, plus the `+XX%` trend badge and the percentage metric. |
| `08-ml-explainability.png` | About → How the AI works screen — confusion matrix and reliability diagram both visible. The "Limitations" section should also be in frame (the synthetic-data + demographic-skew callouts are part of the credibility story). |
