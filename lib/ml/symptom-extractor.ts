/**
 * Trace NLP — Symptom Extractor
 *
 * Rule-based extractor that reads free-text input (typed OR dictated via
 * the iOS/Android keyboard mic) and turns it into structured SymptomChecks.
 *
 * Why rule-based vs. a trained classifier:
 *   - 14 symptoms × ~5 synonyms each = a tractable lexicon
 *   - Medical terminology rewards precision over recall; a transformer
 *     trained on 10k synthetic notes would hallucinate
 *   - Zero model weights to ship — entire feature is ~12 KB of TS
 *   - Negation handling ("no headache", "didn't feel feverish") is the
 *     hard part, and we can do it deterministically with windowed
 *     dependency-style scoping
 *
 * What this is NOT:
 *   - Not a medical NER system. It will miss creative phrasings and
 *     anatomically specific descriptions. The UI shows the extractions
 *     as *suggestions* the user can accept or reject — never as
 *     committed log entries.
 */

import { SymptomChecks } from '../types';
import { EMPTY_SYMPTOMS } from '../symptoms';

// ─── Lexicon ────────────────────────────────────────────────────────────────
//
// Each symptom maps to a set of trigger phrases. Phrases are word-bounded
// (matched against a tokenized lowercase string) so "tired" won't match
// "tiredness" — we list both. Multi-word phrases are matched literally
// against the tokenized text.

const TRIGGERS: Record<keyof SymptomChecks, string[]> = {
  fatigue: [
    'tired', 'fatigue', 'fatigued', 'exhausted', 'exhaustion', 'worn out',
    'no energy', 'wiped out', 'drained', 'sluggish', 'lethargic', 'lethargy',
  ],
  jointPain: [
    'joint pain', 'joints hurt', 'joints ache', 'arthralgia', 'sore joints',
    'knee pain', 'wrist pain', 'elbow pain', 'ankle pain', 'shoulder pain',
    'stiff joints', 'painful joints',
  ],
  headache: [
    'headache', 'headaches', 'head hurts', 'head ache', 'migraine', 'migraines',
    'head pain',
  ],
  brainFog: [
    'brain fog', 'foggy', 'cant focus', "can't focus", 'cant concentrate',
    "can't concentrate", 'spacey', 'cloudy', 'forgetful', 'confused',
    'mental fog', 'hard to think', 'word finding',
  ],
  fever: [
    'fever', 'feverish', 'hot', 'burning up', 'temperature', 'pyrexia',
    'low grade fever', 'running a fever', 'felt feverish',
  ],
  neckStiffness: [
    'stiff neck', 'neck stiffness', 'neck hurts', 'neck pain', 'cant turn my head',
    "can't turn my head", 'rigid neck', 'sore neck',
  ],
  facialDroop: [
    'facial droop', 'face droop', 'bells palsy', "bell's palsy", 'face drooping',
    'face is drooping', 'one side of face', 'lopsided face', 'cant smile',
    "can't smile", 'face paralysis', 'facial weakness',
  ],
  heartPalpitations: [
    'palpitations', 'heart racing', 'racing heart', 'pounding heart',
    'skipping beats', 'skipped beat', 'heart flutter', 'heart fluttering',
    'irregular heartbeat', 'tachycardia',
  ],
  rash: [
    'rash', 'bullseye', "bull's eye", 'bulls eye', 'red ring', 'circular rash',
    'red patch', 'erythema migrans', 'em rash', 'expanding rash', 'skin spot',
    'red spot',
  ],
  muscleAches: [
    'muscle aches', 'muscle pain', 'sore muscles', 'myalgia', 'aches',
    'body aches', 'achy', 'aching',
  ],
  chills: [
    'chills', 'shivering', 'shivers', 'cold sweats', 'goosebumps',
    'felt cold', 'rigors',
  ],
  swollenLymphNodes: [
    'swollen glands', 'swollen lymph nodes', 'swollen nodes', 'lymphadenopathy',
    'lumps in neck', 'swollen neck glands', 'tender glands',
  ],
  dizziness: [
    'dizzy', 'dizziness', 'lightheaded', 'light headed', 'vertigo',
    'spinning', 'off balance', 'unsteady', 'woozy',
  ],
  nightSweats: [
    'night sweats', 'sweating at night', 'soaked sheets', 'drenched in sweat',
    'waking up sweating',
  ],
};

// Negation words/phrases that flip the meaning of a trigger if they appear
// within `NEGATION_WINDOW` tokens before the trigger.
const NEGATION_TOKENS = new Set([
  'no', 'not', 'never', 'without', 'denies', 'denied', 'deny', 'cant',
  "can't", 'didnt', "didn't", 'doesnt', "doesn't", 'dont', "don't",
  'none', 'nope', 'absent', 'absense', 'absence',
]);
const NEGATION_WINDOW = 4;

// Stop tokens that *break* a negation window — once we hit one of these, the
// preceding "no" no longer applies. Matches the way clinical NLP systems
// scope negation to clauses. "and" deliberately NOT included because "denies
// fatigue and joint pain" propagates the denial to both terms in normal
// English; "but" and punctuation do break the scope.
const NEGATION_BLOCKERS = new Set([
  '.', ';', '!', '?', 'but', 'however',
]);

// ─── Tokenization ───────────────────────────────────────────────────────────

interface Token {
  text: string;
  start: number;    // char offset in original input
}

function tokenize(input: string): Token[] {
  const out: Token[] = [];
  const lower = input.toLowerCase();
  // Split on whitespace AND keep punctuation as separate tokens so the
  // negation blocker logic can see them.
  const re = /[a-z']+|[.,;!?]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower)) !== null) {
    out.push({ text: m[0], start: m.index });
  }
  return out;
}

function tokensToString(tokens: Token[]): string {
  return tokens.map((t) => t.text).join(' ');
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface SymptomMatch {
  symptom: keyof SymptomChecks;
  phrase: string;       // the phrase that matched
  negated: boolean;
  position: number;     // char offset
}

export interface ExtractionResult {
  symptoms: SymptomChecks;
  matches: SymptomMatch[];
}

/**
 * Extract symptoms from free text. Returns both the boolean checks (suitable
 * for SymptomChecks) and the full match list (for showing why each was
 * suggested in the UI).
 */
export function extractSymptoms(input: string): ExtractionResult {
  const tokens = tokenize(input);
  const tokenTexts = tokens.map((t) => t.text);
  const tokenLine = tokenTexts.join(' ');

  const matches: SymptomMatch[] = [];
  const symptoms: SymptomChecks = { ...EMPTY_SYMPTOMS };

  for (const [symptom, phrases] of Object.entries(TRIGGERS) as [
    keyof SymptomChecks,
    string[]
  ][]) {
    for (const phrase of phrases) {
      // Match as a whole sequence of tokens (handles multi-word phrases).
      // Use a word-boundary-style search on the joined token line.
      const phraseTokens = phrase.toLowerCase().split(/\s+/).join(' ');
      let searchFrom = 0;
      while (true) {
        const idx = tokenLine.indexOf(phraseTokens, searchFrom);
        if (idx === -1) break;
        // Confirm the match aligns with token boundaries
        const before = idx === 0 ? ' ' : tokenLine[idx - 1];
        const afterIdx = idx + phraseTokens.length;
        const after = afterIdx >= tokenLine.length ? ' ' : tokenLine[afterIdx];
        if (before === ' ' && after === ' ') {
          // Find the token index that started this phrase.
          const phraseStartTokenIdx = tokenIndexAtCharOffset(tokenLine, idx);
          const negated = isNegated(tokenTexts, phraseStartTokenIdx);
          const origStart = tokens[phraseStartTokenIdx]?.start ?? 0;
          matches.push({
            symptom,
            phrase,
            negated,
            position: origStart,
          });
          if (!negated) {
            symptoms[symptom] = true;
          }
        }
        searchFrom = idx + phraseTokens.length;
      }
    }
  }

  return { symptoms, matches };
}

function tokenIndexAtCharOffset(line: string, charOffset: number): number {
  // We joined tokens with single spaces, so token i starts at
  // sum(len(tokens[j]) + 1 for j<i).
  let pos = 0;
  let tokenIdx = 0;
  while (pos < charOffset && tokenIdx < 10_000) {
    const nextSpace = line.indexOf(' ', pos);
    if (nextSpace === -1 || nextSpace >= charOffset) return tokenIdx;
    pos = nextSpace + 1;
    tokenIdx++;
  }
  return tokenIdx;
}

function isNegated(tokens: string[], symptomTokenIdx: number): boolean {
  const start = Math.max(0, symptomTokenIdx - NEGATION_WINDOW);
  for (let i = symptomTokenIdx - 1; i >= start; i--) {
    const t = tokens[i];
    if (NEGATION_BLOCKERS.has(t)) return false;
    if (NEGATION_TOKENS.has(t)) return true;
  }
  return false;
}

/**
 * Merge an extraction result into an existing SymptomChecks (e.g. when the
 * user has already toggled some symptoms manually — extraction should add
 * to that set, not overwrite).
 */
export function mergeSymptoms(
  current: SymptomChecks,
  extracted: SymptomChecks
): SymptomChecks {
  const out: SymptomChecks = { ...current };
  (Object.keys(extracted) as (keyof SymptomChecks)[]).forEach((k) => {
    if (extracted[k]) out[k] = true;
  });
  return out;
}
