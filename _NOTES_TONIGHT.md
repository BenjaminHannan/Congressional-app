# Tonight — Trace punch-list notes

## What I completed

All 14 items, end to end, one commit per item. Run `git log --oneline` to see them.

- **Blockers**
  - `lib/bite-scanner.ts`: hardcoded ngrok URL replaced with a top-of-file `ML_SERVER_URL` constant defaulting to `null`. When null, `classifyWithML` skips the fetch entirely — no 8-second timeout on a dead tunnel and no bite photo bytes leaving the device by default. There's a long comment block at the top of the file explaining exactly how to wire up a live server later (start the FastAPI service, expose with ngrok, paste the URL).
  - `app/(tabs)/scan.tsx`: full audit. When the server isn't configured, the screen now drops into a `fallback` step that shows the saved photo, explains nothing was uploaded, and routes the user to the symptom check. I also added a "next step" pill under the urgency badge on the results step so the most important action is visible without scrolling.
  - `app/(tabs)/timeline.tsx`: was already functionally complete. Added a11y label on the delete button and a real CTA on the empty state.
  - **Empty states** on Home, Timeline, and Report all have the friendly "Log your first symptom to start tracking" card with a button into the correct flow (symptom check by default, exposure form as a secondary on Report).

- **Credibility**
  - Disclaimer: tightened wording in the PDF HTML header (highlighted callout block) and the Home footer to the exact submission language.
  - Citations: new `components/citations.tsx` is a tappable short line that expands to full IDSA 2020 + CDC 2019–2023 references with tappable URLs. Mounted on the Advocacy header and the Check result card.
  - `lib/nh-data.ts`: added a CDC source block (dataset name, year range, two URLs) and a per-value TODO checklist — every county incidence number is flagged for verification against the latest CDC NNDSS release before submission.

- **Polish**
  - `app/red-flag.tsx`: fires `Haptics.notificationAsync(Warning)` on mount, wrapped in `.catch(() => {})` so emulators / web don't throw.
  - A11y: ran a grep for `accessibilityLabel`. The only previously icon-only touch targets were the advocacy close X, the timeline delete, the new info icon on the home header, and the severity-rating dots on the check screen. All now have labels + roles. Text+icon buttons get implicit a11y from their text children, so I didn't add redundant props.
  - `app/about.tsx`: new modal reachable from a small `info-outline` icon in the Home tab's header right. Reads version from `app.json` via `expo-constants` so a future bump only needs to touch one file.

- **Docs**
  - `CHANGELOG.md` at the root with v1.0.0 bullets distilled from the README's "What the app does."
  - README: "Impact" callout near the top with the four NH numbers; new `## Screenshots` table referencing `docs/screenshots/01-welcome.png … 05-pdf.png`; new `## Building for distribution` section with EAS preview commands (NOT run); new `## Submission readiness` checklist at the bottom.
  - `docs/screenshots/` has a `.gitkeep` and an inner `README.md` that describes exactly what each of the five captures should show — so you don't have to guess when you're recording them.

- **Tests**
  - Jest 29 + ts-jest 29 (jest 30 had an internal API breakage with ts-jest 29 — downgraded). Test suite is at `lib/__tests__/risk-engine.test.ts` and covers all four required cases. `npm test` reports 4/4 passing.

## What I skipped and why

- **No demo video, no TestFlight, no `eas build`, no `git push`.** You explicitly excluded these.
- **`ml-server/venv/`** is untouched, per your instructions.
- **Custom app icon.** Not generated — you said you'd handle Figma. Heads up: `assets/images/icon.png` and the splash / Android adaptive icons in `assets/images/` are all still the default Expo placeholders. The app.json still references them; once you have the final PNGs, drop them in with the same filenames and you're done.
- **Component tests.** Jest config is intentionally scoped to `lib/__tests__/**/*.test.ts` — pure-TS modules only. Wiring up `jest-expo` to test the RN components would have meant pulling in a much heavier dependency tree and dealing with React Native module mocks. Called out as a follow-up in `jest.config.js`.

## What surprised me in the codebase

- **`bite-scanner.ts` shape mismatch with the README.** README says the ML server returns a 9-class classifier (ant, bed bug, chigger, …, erythema migrans, uninfected skin). The actual `mlClassificationToResult()` in the code does a *binary* tick / not-tick decision — anything that isn't the literal label `"tick"` falls into the low-concern bucket, including EM rashes. That probably matches what the latest `ml-server/server.py` actually returns (you committed an ML server rewrite right before I started), but the README still describes the older 9-class model. Worth a one-line tweak to the README's "ML classifier" section to match reality.
- **The `getCountyData()` value for Grafton is `riskCategory: 'high'`, not `'very_high'`.** That means a Grafton-county user with `locationRisk: 'nh'` only gets the +15 NH points, not the +5 very_high bonus. Given Hanover/Lyme are *in* Grafton County and the README brags about 200+/100k there, I'd consider promoting Grafton to `very_high` once the actual CDC numbers are confirmed. The risk-engine test I wrote uses Carroll (`very_high`) instead so it isn't sensitive to this decision either way.
- **Risk engine can exceed 100 before the cap.** That's not a bug, just an observation — the cap at `Math.min(score, 100)` does its job, but the underlying weights can sum to ~140 with a fully red-flagged log + every exposure factor + 7-day sustained pattern. If you ever want a more useful "saturated" score, you'd need to either re-weight or apply non-linear scoring. Out of scope for tonight.
- **Pre-existing uncommitted ML-server rewrite.** When I opened the repo there were ~435 lines of pending changes across the scan screen + bite-scanner + ml-server. I committed them first as `chore: snapshot pre-task ML server + scan rewrite work` so my per-item commits would be clean. If you want to amend or reword that snapshot commit, it's the one right before `fix(bite-scanner): null ML_SERVER_URL by default`.

## Things to reconsider before submitting

1. **README vs. binary classifier.** Fix the "ML classifier" paragraph in the README to match the binary tick/not-tick model the server actually serves, or retrain to the 9-class model the README still promises.
2. **`getCountyData('Grafton')` risk tier.** Decide whether Grafton should be `'very_high'`. If yes, also recheck whether the +5 very_high bonus in `risk-engine.ts` should actually scale by category instead of being binary on `'very_high'` (currently `'high'` counties get nothing extra past the +15 NH baseline).
3. **The "Roboflow / GPT-4o vision" comments in older commits.** I didn't touch git history, but if a judge skims your commit log they'll see commits referencing services Trace doesn't actually use anymore. Consider a single `docs:` commit that updates `ml-server/README.md` to match the current FastAPI implementation.
4. **`app.json` still has the default `"name": "trace"` (lowercase).** App stores display this. You may want `"Trace"` (capitalized) for a polished look — although Expo's slug rules might constrain this.
5. **`scripts/reset-project.js`** is still present as a leftover from the Expo template. Won't ship to users but it's noise in the repo. Low priority, but worth deleting if you want a tighter source tree.
6. **The exposure form `dateFirstSymptoms` is a free-text TextInput**, not a date picker. The value is later passed through `new Date(dateStr + 'T00:00:00')` in `pdf-generator.ts` and `timeline.tsx`, which means free-text like "2 weeks ago" produces `Invalid Date` and the PDF will print `Invalid Date`. Either swap in a date picker, or `try/catch` and format around it. Not blocking but ugly if a judge tries it.
7. **No date picker / no future-date validation anywhere.** Same theme as #6 — a user could log symptoms for a date in the future and the timeline would display it. Easy to add in a future pass.

Otherwise — I think the punch list as written gets you to a defensible submission. The remaining items on the README's "Submission readiness — still mine" list are the things you specifically reserved (video, screenshots, icon, clinician sign-off, EAS build, CDC verification).
