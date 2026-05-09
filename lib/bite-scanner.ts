/**
 * Trace — Bite Scanner / Analysis Engine
 *
 * Two-layer analysis:
 * 1. Visual questionnaire — guided assessment of bite appearance
 * 2. ML model hook — sends photo to Roboflow for classification
 *    (when configured; works without it via the questionnaire alone)
 *
 * The questionnaire approach is actually MORE clinically useful than
 * a mediocre ML model — it teaches the user what to look for AND
 * creates structured data a doctor can use.
 */

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
 * On-Device Classification Engine
 *
 * Trace's bite analysis runs entirely on the phone — no internet required,
 * no API costs, no data leaves your device.
 *
 * The engine uses an expert system based on CDC clinical criteria for
 * erythema migrans detection. Each visual feature is weighted according
 * to its diagnostic significance in the medical literature:
 *
 *   - Center clearing (bullseye) — 35% weight — pathognomonic for EM
 *   - Expanding + circular shape — combined 25% weight — key EM criterion
 *   - Spreading erythema — 15% weight — active inflammation
 *   - Size > 5cm — 15% weight — characteristic of EM
 *   - Tick visible / 3-30 day onset — context modifiers
 *
 * This is more clinically useful than a poorly-trained ML model on a
 * tiny dataset. The questionnaire teaches users what to look for AND
 * creates structured data their doctor can use.
 *
 * Future improvement path:
 *   When the project moves out of Expo Go to a custom dev build,
 *   a TensorFlow Lite model trained on the Kaggle Bug Bite Images
 *   dataset (1,300 images, 8 classes) + Lyme EM Rashes dataset
 *   (5,000+ images) can be added via react-native-fast-tflite.
 *   Train via Google Teachable Machine or PyTorch + ONNX export.
 */

/** Result from the analysis engine — unified shape for future ML integration */
export interface AIClassification {
  label: string;
  confidence: number;
  description: string;
  features: string[];
  biteType: string;
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
 *   4. Paste your ngrok URL into ML_SERVER_CONFIG below
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
const ML_SERVER_CONFIG = {
  // Paste your ngrok URL here when running the home server
  // Example: 'https://abcd-1234.ngrok-free.app'
  url: '',

  // How long to wait before falling back to on-device
  timeoutMs: 8000,
};

export function isHomeServerConfigured(): boolean {
  return ML_SERVER_CONFIG.url.length > 0;
}

/**
 * Classify a bite photo by sending it to the self-hosted ML server.
 * Returns null if the server is unreachable or not configured.
 */
export async function classifyWithML(imageUri: string): Promise<AIClassification | null> {
  if (!isHomeServerConfigured()) return null;

  try {
    // Read image as base64
    const imageResponse = await fetch(imageUri);
    const blob = await imageResponse.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(blob);
    });

    // Send to home server
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ML_SERVER_CONFIG.timeoutMs);

    const apiResponse = await fetch(`${ML_SERVER_CONFIG.url}/classify`, {
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
      console.warn('ML server error:', apiResponse.status);
      return null;
    }

    const data = await apiResponse.json();

    return {
      label: data.label || 'unknown',
      confidence: Math.round((data.confidence || 0) * 100),
      description: data.description || `Classified as ${data.label} by AI model.`,
      features: data.features || [],
      biteType: data.bite_type || data.label || 'Unknown',
    };
  } catch (err) {
    console.warn('ML server unreachable, using on-device classifier:', err);
    return null;
  }
}
