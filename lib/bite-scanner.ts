/**
 * Trace — Bite Scanner / Analysis Engine
 *
 * Two-layer analysis:
 * 1. Visual questionnaire — guided assessment of bite appearance
 * 2. ML model — sends photo to a self-hosted GPU server for classification
 *    (when configured; falls back to questionnaire alone when offline)
 *
 * The questionnaire approach is clinically grounded in CDC criteria
 * and creates structured data a doctor can use, while the ML model
 * adds real image-based classification.
 */

import * as FileSystem from 'expo-file-system/legacy';

/**
 * URL of the self-hosted ML inference server.
 *
 * Set to `null` by default — Trace works fully offline using the on-device
 * questionnaire classifier in `analyzeBite()` below. The phone NEVER attempts
 * a network call to a stale endpoint, which keeps the privacy story honest:
 * by default no bite photo ever leaves the device.
 *
 * To wire up a live server during a demo:
 *   1. cd ml-server && python server.py        (boots the FastAPI service)
 *   2. ngrok http 8000                         (or any HTTPS tunnel)
 *   3. Replace `null` below with the public URL string, e.g.
 *        const ML_SERVER_URL: string | null = 'https://abcd-1234.ngrok-free.app';
 *   4. Reload the app. The Scan screen will start sending photos to the server
 *      and gracefully fall back to the on-device classifier if a request fails.
 *
 * Keep this null in checked-in code. ngrok URLs rotate and a stale value
 * would silently waste 8 seconds per scan on a doomed fetch.
 */
const ML_SERVER_URL: string | null = null;

export interface ScanAnswers {
  shape: 'circular' | 'oval' | 'irregular' | 'none';
  expanding: boolean;
  centerClearing: boolean;      // "bullseye" = red ring with clear center
  redness: 'none' | 'mild' | 'significant' | 'spreading';
  warmToTouch: boolean;
  size: 'small' | 'medium' | 'large';  // <2cm, 2-5cm, >5cm
  tickVisible: boolean;
  duration: 'new' | 'days' | 'week_plus';
}

export interface ScanResult {
  classification: 'erythema_migrans' | 'possible_bite' | 'irritation' | 'needs_evaluation' | 'low_concern';
  confidence: number;           // 0-100
  title: string;
  description: string;
  urgency: 'emergency' | 'urgent' | 'soon' | 'monitor';
  actions: string[];
}

/**
 * Analyze bite based on visual questionnaire answers.
 *
 * Scoring is based on CDC clinical criteria for erythema migrans:
 * - Expanding circular/oval rash > 5cm
 * - Central clearing ("bullseye")
 * - Warm to touch
 * - Appeared days after possible tick exposure
 */
export function analyzeBite(answers: ScanAnswers): ScanResult {
  let score = 0;

  // ── Shape analysis ──
  // Most insect bites are circular — this alone is NOT Lyme-specific.
  // Only a small bump; the real signal comes from combos below.
  if (answers.shape === 'circular' || answers.shape === 'oval') {
    score += 10;
  }

  // ── Center clearing = classic bullseye ──
  // This is THE hallmark of erythema migrans. Heavily weighted.
  if (answers.centerClearing) {
    score += 35;
  }

  // ── Expanding rash ──
  // Key diagnostic criterion, but only significant when combined
  // with other features (handled via combo bonus below).
  if (answers.expanding) {
    score += 15;
  }

  // ── Combo bonus: expanding + circular/oval ──
  // An expanding circular rash is highly specific to EM.
  // Neither feature alone is alarming, but together they are.
  if (answers.expanding && (answers.shape === 'circular' || answers.shape === 'oval')) {
    score += 10;
  }

  // ── Redness ──
  // "Spreading" redness is significant; mild redness is normal for any bite.
  if (answers.redness === 'spreading') {
    score += 15;
  } else if (answers.redness === 'significant') {
    score += 5;
  } else if (answers.redness === 'mild') {
    score += 2;
  }

  // ── Warmth ──
  // Many insect bites are warm/itchy. Low weight on its own.
  if (answers.warmToTouch) {
    score += 5;
  }

  // ── Size > 5cm is significant for EM ──
  if (answers.size === 'large') {
    score += 15;
  } else if (answers.size === 'medium') {
    score += 5;
  }

  // ── Tick still visible ──
  if (answers.tickVisible) {
    score += 10;
  }

  // ── Duration context ──
  // 3-30 days after exposure is classic EM timeline
  if (answers.duration === 'days') {
    score += 10;
  } else if (answers.duration === 'week_plus') {
    score += 5;
  }

  // Cap at 100
  score = Math.min(score, 100);

  // Classify — thresholds tuned so normal bug bites stay low
  if (score >= 65) {
    return {
      classification: 'erythema_migrans',
      confidence: score,
      title: 'Possible Erythema Migrans (Lyme Rash)',
      description:
        'This matches several characteristics of erythema migrans, the signature rash ' +
        'of Lyme disease. An expanding circular or oval rash, especially with central ' +
        'clearing ("bullseye" pattern), is highly suggestive of Lyme disease.',
      urgency: 'urgent',
      actions: [
        'See a doctor within 24-48 hours — do not wait',
        'Ask about starting doxycycline immediately',
        'Take a photo with a coin or ruler next to the rash for scale',
        'Draw a circle around the rash edge with pen to track expansion',
        'Note the date and save this scan in your Trace log',
      ],
    };
  } else if (score >= 40) {
    return {
      classification: 'needs_evaluation',
      confidence: score,
      title: 'Needs Medical Evaluation',
      description:
        'This bite or rash has some features that warrant medical evaluation. ' +
        'While not a definitive match for erythema migrans, several factors suggest ' +
        'you should see a doctor, especially in a Lyme-endemic area like New Hampshire.',
      urgency: 'soon',
      actions: [
        'Schedule a doctor appointment within the next few days',
        'Continue monitoring — take a photo every 12-24 hours to track changes',
        'Draw a pen circle around the edge to see if it expands',
        'Log your symptoms daily in Trace',
        'If the rash expands or new symptoms develop, seek care sooner',
      ],
    };
  } else if (score >= 15) {
    return {
      classification: 'possible_bite',
      confidence: score,
      title: 'Possible Tick or Insect Bite',
      description:
        'This appears to be a bite or mild skin irritation. It does not currently ' +
        'show the classic features of a Lyme rash, but bites can evolve over ' +
        '3-30 days. Monitor closely.',
      urgency: 'monitor',
      actions: [
        'Take a photo daily to track any changes',
        'Watch for: expanding size, circular shape, central clearing',
        'Log any new symptoms (fatigue, fever, joint pain) in Trace',
        'If the area grows or changes shape, see a doctor',
        'If a tick is still attached, remove it with fine-tipped tweezers',
      ],
    };
  } else {
    return {
      classification: 'low_concern',
      confidence: 100 - score,
      title: 'Low Concern',
      description:
        'Based on your description, this does not currently match the features ' +
        'of a Lyme disease rash. It may be a minor irritation or non-tick bite.',
      urgency: 'monitor',
      actions: [
        'Keep the area clean',
        'Monitor for any changes over the next week',
        'If new symptoms develop, log them in Trace',
        'No urgent action needed at this time',
      ],
    };
  }
}

/**
 * Map an ML classification to a ScanResult.
 *
 * The CV model classifies bite photos into 8 mutually exclusive classes
 * (ants, bed_bugs, chiggers, fleas, mosquitos, no_bites, spiders, ticks).
 * Only tick bites carry meaningful Lyme risk, so tick predictions escalate
 * to "see a doctor soon" while everything else stays in monitor/low_concern.
 *
 * The CV model does NOT classify erythema migrans rashes — that's the job
 * of the on-device questionnaire (analyzeBite below), which scores CDC
 * clinical criteria (bullseye, expansion, size, duration). The two
 * subsystems are complementary, not redundant.
 */
const NON_TICK_BITE_TYPES: Record<string, { title: string; blurb: string }> = {
  ants: {
    title: 'Ant Bite or Sting',
    blurb:
      'The model identified this as an ant bite or sting. These usually heal on their own in a few days. Fire-ant stings can form pustules — see a doctor if you have severe pain, spreading redness, or signs of an allergic reaction.',
  },
  bed_bugs: {
    title: 'Bed Bug Bite',
    blurb:
      'The model identified this as a bed bug bite. These often appear in clusters or short lines, itch for several days, and are not medically dangerous. If confirmed, treating your living space prevents more bites.',
  },
  chiggers: {
    title: 'Chigger Bite',
    blurb:
      'The model identified this as a chigger bite. Chigger bites are extremely itchy, often appear around sock or waistband lines, and clear up on their own in 1–2 weeks.',
  },
  fleas: {
    title: 'Flea Bite',
    blurb:
      'The model identified this as a flea bite. These usually appear as small red bumps on the lower legs or ankles. Treating pets and the environment prevents more bites.',
  },
  mosquitos: {
    title: 'Mosquito Bite',
    blurb:
      'The model identified this as a mosquito bite — a common itchy bump that resolves within a few days. No medical attention needed unless there are signs of infection.',
  },
  no_bites: {
    title: 'No Bite Detected',
    blurb:
      'The model did not find a bite or unusual skin mark in this image. If you still have concerns, try a sharper, closer photo with good natural light.',
  },
  spiders: {
    title: 'Spider Bite',
    blurb:
      'The model identified this as a spider bite. Most spider bites are harmless, but a small number (e.g., brown recluse, black widow) can be serious. Watch for spreading redness, severe pain, or tissue damage and see a doctor if those appear.',
  },
};

const TICK_ACTIONS = [
  'If a tick is still attached, remove it with fine-tipped tweezers — grasp close to the skin and pull straight out',
  'Save the tick in a sealed bag (your doctor may want to identify the species)',
  'Take a dated photo of the bite right now for comparison later',
  'Watch for an expanding rash (especially with central clearing) over the next 3–30 days — see a doctor immediately if you see one',
  'Log the bite date in Trace and check daily for new symptoms (fatigue, fever, headache, joint pain)',
  'In NH, ask your doctor about empirical doxycycline if symptoms develop — IDSA guidelines support this in endemic areas',
];

const NON_TICK_ACTIONS = [
  'Keep the area clean and watch it heal normally',
  'If it gets worse (spreading redness, pus, severe pain), see a doctor',
  'Take another photo if anything changes — you can always rescan',
  'If you also have flu-like symptoms or a separate expanding rash, log them in the Check tab',
];

export function mlClassificationToResult(ml: AIClassification): ScanResult {
  const label = ml.label.toLowerCase();
  const isTick = label === 'tick' || label === 'ticks';

  if (isTick) {
    return {
      classification: 'possible_bite',
      confidence: ml.confidence,
      title: 'Tick Bite',
      description:
        ml.description ||
        'The model identified this as a tick bite. In New Hampshire, tick ' +
        'bites carry a real risk of Lyme disease. Most tick bites do NOT ' +
        'result in Lyme — but watch carefully and act early if symptoms appear.',
      urgency: 'soon',
      actions: TICK_ACTIONS,
    };
  }

  const known = NON_TICK_BITE_TYPES[label];
  const isNoBite = label === 'no_bites' || label === 'no_bite';

  return {
    classification: isNoBite ? 'low_concern' : 'possible_bite',
    confidence: ml.confidence,
    title: known?.title || 'Insect Bite',
    description:
      ml.description ||
      known?.blurb ||
      'The model classified this as a non-tick bite. From a Lyme disease ' +
      'standpoint, no urgent action is needed.',
    urgency: 'monitor',
    actions: NON_TICK_ACTIONS,
  };
}

/**
 * Default empty scan answers
 */
export const EMPTY_SCAN_ANSWERS: ScanAnswers = {
  shape: 'none',
  expanding: false,
  centerClearing: false,
  redness: 'none',
  warmToTouch: false,
  size: 'small',
  tickVisible: false,
  duration: 'new',
};

/**
 * On-Device Questionnaire Engine — complementary to the CV model.
 *
 * Where the CV model classifies bite *type* (tick, mosquito, etc.), this
 * engine scores CDC clinical criteria for *erythema migrans* (the Lyme rash):
 *
 *   - Center clearing (bullseye) — 35% weight — pathognomonic for EM
 *   - Expanding + circular shape — combined 25% weight — key EM criterion
 *   - Spreading erythema — 15% weight — active inflammation
 *   - Size > 5cm — 15% weight — characteristic of EM
 *   - Tick visible / 3-30 day onset — context modifiers
 *
 * The questionnaire runs entirely on-device, requires no model weights,
 * and produces structured data a doctor can read. The CV model adds an
 * image-grounded prior on top.
 */

/** Result from the analysis engine — unified shape for future ML integration */
export interface AIClassification {
  label: string;
  confidence: number;
  description: string;
  features: string[];
  biteType: string;
  /** When true, the model is not confident enough to give a specific answer */
  uncertain?: boolean;
  /** Top 3 predictions with confidence (0–100) — full softmax view */
  topPredictions?: { label: string; confidence: number }[];
  /** Base64-encoded PNG of the Grad-CAM saliency overlay, if /explain was called */
  saliencyPng?: string;
}

/**
 * Always returns true — the questionnaire-based engine is always available.
 * Kept as a function name so the UI can stay generic when an ML model
 * is added later.
 */
export function isMLModelConfigured(): boolean {
  return true;
}

/**
 * Generate a structured AI-style classification from the questionnaire answers.
 * This runs entirely on-device using rule-based pattern matching against
 * CDC erythema migrans criteria.
 */
export function classifyFromAnswers(answers: ScanAnswers): AIClassification {
  const features: string[] = [];

  // Build human-readable feature list from the answers
  if (answers.shape === 'circular') features.push('Circular shape');
  else if (answers.shape === 'oval') features.push('Oval shape');
  else if (answers.shape === 'irregular') features.push('Irregular shape');

  if (answers.centerClearing) features.push('Central clearing (bullseye)');
  if (answers.expanding) features.push('Expanding outward');

  if (answers.redness === 'spreading') features.push('Spreading redness');
  else if (answers.redness === 'significant') features.push('Significant redness');
  else if (answers.redness === 'mild') features.push('Mild redness');

  if (answers.warmToTouch) features.push('Warm to touch');

  if (answers.size === 'large') features.push('Large size (>5cm)');
  else if (answers.size === 'medium') features.push('Medium size (2-5cm)');
  else features.push('Small size (<2cm)');

  if (answers.tickVisible) features.push('Tick visible');

  if (answers.duration === 'days') features.push('Onset 3-30 days ago');
  else if (answers.duration === 'week_plus') features.push('Onset 1+ weeks ago');
  else features.push('New / today');

  // Run the analyzer to determine classification
  const result = analyzeBite(answers);

  // Map internal classification to user-friendly bite type
  let biteType = 'Possible Bite';
  let description = '';

  if (result.classification === 'erythema_migrans') {
    biteType = 'Possible Erythema Migrans';
    description =
      'The pattern strongly resembles the classic Lyme disease rash. ' +
      'Multiple defining features were detected, including features that ' +
      'are not typical of common insect bites.';
  } else if (result.classification === 'needs_evaluation') {
    biteType = 'Atypical Bite or Rash';
    description =
      'Several features warrant medical attention, though not all classic ' +
      'EM characteristics are present. Continue tracking and have it ' +
      'evaluated by a clinician.';
  } else if (result.classification === 'possible_bite') {
    biteType = answers.tickVisible ? 'Tick Bite' : 'Common Insect Bite';
    description = answers.tickVisible
      ? 'This appears consistent with a tick bite. Monitor the area for the ' +
        'development of any expanding rash over the next 3-30 days.'
      : 'This appears to be a common insect bite (mosquito, fly, or similar). ' +
        'No features specific to Lyme disease were detected.';
  } else {
    biteType = 'Skin Irritation';
    description =
      'Minimal features of concern. This may be a minor skin irritation, ' +
      'allergic reaction, or non-tick bite.';
  }

  return {
    label: result.classification,
    confidence: result.confidence,
    description,
    features,
    biteType,
  };
}

/**
 * Self-Hosted ML Server Integration
 *
 * The Trace ML model runs on a self-hosted Python server (typically on
 * a home GPU machine). The phone sends the bite photo and receives
 * a classification — inference happens on the GPU, not the phone.
 *
 * Setup:
 *   1. Train the model: see /ml-server/train.py
 *      Datasets:
 *        - Kaggle: moonfallidk/bug-bite-images (8 classes incl. tick)
 *        - Kaggle: sshikamaru/lyme-disease-full-dataset (EM rashes)
 *   2. Run the server: cd ml-server && python server.py
 *   3. Expose with ngrok: ngrok http 8000
 *   4. Replace `null` with your ngrok URL in the ML_SERVER_URL constant
 *      at the top of this file (see comment block above for details)
 *   5. Reload the app
 *
 * Why this approach:
 *   - Free: no API costs, runs on your hardware
 *   - Powerful: full GPU inference, custom model
 *   - Privacy: data never goes to a third party
 *   - Demo-friendly: turn the server on for demos, off otherwise
 *   - Works in Expo Go: just an HTTPS call, no native modules
 *
 * The app gracefully falls back to the on-device questionnaire
 * classifier when the server is unreachable.
 */
/** How long to wait on the ML server before falling back to on-device. */
const ML_SERVER_TIMEOUT_MS = 8000;

export function isHomeServerConfigured(): boolean {
  return typeof ML_SERVER_URL === 'string' && ML_SERVER_URL.length > 0;
}

/**
 * Classify a bite photo by sending it to the self-hosted ML server.
 * Returns null if the server is unreachable or not configured.
 *
 * Reads the photo as base64 via expo-file-system (reliable in RN),
 * not the browser FileReader API.
 */
export async function classifyWithML(imageUri: string): Promise<AIClassification | null> {
  // When ML_SERVER_URL is null we skip the network entirely. Callers fall
  // back to the on-device questionnaire classifier — no fetch attempt to a
  // stale tunnel, no 8-second timeout, no leaked photo bytes.
  if (!ML_SERVER_URL) {
    console.log('[ML] Server not configured — using on-device classifier');
    return null;
  }

  try {
    // Read image as base64 using Expo's file system (works reliably on RN)
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log(`[ML] Sending ${base64.length} chars of base64 to server...`);

    // Send to home server with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ML_SERVER_TIMEOUT_MS);

    const apiResponse = await fetch(`${ML_SERVER_URL}/classify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Skip ngrok's interstitial warning page
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ image: base64 }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!apiResponse.ok) {
      const text = await apiResponse.text().catch(() => '');
      console.warn(`[ML] Server error ${apiResponse.status}: ${text.slice(0, 200)}`);
      return null;
    }

    const data = await apiResponse.json();
    console.log(`[ML] Got classification: ${data.label} (${data.confidence})`);

    const topPredictions: { label: string; confidence: number }[] = Array.isArray(
      data.top_predictions
    )
      ? data.top_predictions.map((p: any) => ({
          label: String(p.label || 'unknown'),
          confidence: Math.round((Number(p.confidence) || 0) * 100),
        }))
      : [];

    return {
      label: data.label || 'unknown',
      confidence: Math.round((data.confidence || 0) * 100),
      description: data.description || `Classified as ${data.label} by AI model.`,
      features: data.features || [],
      biteType: data.bite_type || data.label || 'Unknown',
      topPredictions,
    };
  } catch (err: any) {
    console.warn('[ML] Request failed:', err?.message || err);
    return null;
  }
}

/**
 * Ask the server for a Grad-CAM saliency overlay of the photo. Returns the
 * base64 PNG ready for <Image source={{ uri: `data:image/png;base64,${...}` }} />.
 * Best-effort — silently returns null on any failure so the UI keeps working.
 */
export async function explainWithML(imageUri: string): Promise<string | null> {
  if (!ML_SERVER_URL) return null;

  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ML_SERVER_TIMEOUT_MS);

    const apiResponse = await fetch(`${ML_SERVER_URL}/explain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ image: base64 }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!apiResponse.ok) {
      console.warn(`[ML] /explain ${apiResponse.status}`);
      return null;
    }

    const data = await apiResponse.json();
    return typeof data.saliency_png === 'string' ? data.saliency_png : null;
  } catch (err: any) {
    console.warn('[ML] /explain failed:', err?.message || err);
    return null;
  }
}
