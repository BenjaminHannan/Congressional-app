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
 * Roboflow ML Model Integration
 *
 * When a Roboflow API key and model endpoint are configured,
 * this sends the photo for classification. Otherwise, the app
 * uses the questionnaire-based analysis above.
 *
 * To configure:
 * 1. Train a model at roboflow.com with tick bite / EM rash images
 * 2. Set your API key and model ID below
 */
const ROBOFLOW_CONFIG = {
  apiKey: '',   // Set your Roboflow API key here
  modelId: '',  // e.g., 'tick-bite-classifier/1'
  endpoint: 'https://detect.roboflow.com',
};

export function isMLModelConfigured(): boolean {
  return ROBOFLOW_CONFIG.apiKey.length > 0 && ROBOFLOW_CONFIG.modelId.length > 0;
}

/**
 * Send image to Roboflow ML model for classification.
 * Only works when ROBOFLOW_CONFIG is set up.
 */
export async function classifyWithML(imageUri: string): Promise<{
  label: string;
  confidence: number;
} | null> {
  if (!isMLModelConfigured()) return null;

  try {
    // Read image as base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.readAsDataURL(blob);
    });

    // Send to Roboflow
    const apiResponse = await fetch(
      `${ROBOFLOW_CONFIG.endpoint}/${ROBOFLOW_CONFIG.modelId}?api_key=${ROBOFLOW_CONFIG.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: base64,
      }
    );

    const data = await apiResponse.json();

    if (data.predictions && data.predictions.length > 0) {
      return {
        label: data.predictions[0].class,
        confidence: Math.round(data.predictions[0].confidence * 100),
      };
    }
    return null;
  } catch {
    return null;
  }
}
