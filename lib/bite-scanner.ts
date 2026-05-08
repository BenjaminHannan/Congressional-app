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
 * AI Vision Classification — GPT-4o mini
 *
 * Sends the bite photo to OpenAI's GPT-4o mini vision model with a
 * medical classification prompt trained on CDC / dermatological criteria.
 *
 * Cost: ~$0.01-0.03 per scan. Essentially free for demo purposes.
 *
 * To configure: set your OpenAI API key below.
 * Get one at: https://platform.openai.com/api-keys
 */

const AI_CONFIG = {
  apiKey: '',  // Set your OpenAI API key here
  model: 'gpt-4o-mini',
  endpoint: 'https://api.openai.com/v1/chat/completions',
};

export function isMLModelConfigured(): boolean {
  return AI_CONFIG.apiKey.length > 0;
}

/** Result from the AI vision model */
export interface AIClassification {
  label: string;
  confidence: number;
  description: string;
  features: string[];
  biteType: string;
}

/**
 * Medical classification prompt.
 * Asks GPT-4o mini to act as a dermatological triage assistant
 * and return structured JSON.
 */
const CLASSIFICATION_PROMPT = `You are a dermatological triage assistant helping classify skin marks and insect bites. Analyze this photo carefully.

Classify the image into one of these categories:
- "erythema_migrans" — expanding circular/oval rash with possible central clearing (Lyme disease rash)
- "tick_bite" — small red mark consistent with a tick bite (no expanding rash)
- "mosquito_bite" — raised, itchy bump typical of mosquito bites
- "spider_bite" — bite with two puncture points or necrotic center
- "other_insect_bite" — other insect bite (ant, flea, bed bug, chigger, etc.)
- "skin_irritation" — non-bite skin irritation, rash, or allergic reaction
- "normal_skin" — no visible bite or concerning mark
- "unclear" — image too blurry or unclear to classify

Respond ONLY with valid JSON in this exact format:
{
  "classification": "<category from above>",
  "confidence": <0-100>,
  "bite_type": "<plain English name, e.g. 'Mosquito Bite'>",
  "description": "<1-2 sentence description of what you observe>",
  "features": ["<feature 1>", "<feature 2>", "<feature 3>"]
}

Important rules:
- Be conservative. Do NOT classify as erythema_migrans unless you see clear expanding circular rash with central clearing.
- Most small red bumps are mosquito or other common insect bites.
- List the specific visual features you observe (color, shape, size, pattern, texture).
- This is for educational triage only, not diagnosis.`;

/**
 * Send image to GPT-4o mini for AI classification.
 * Reads the image file as base64 and sends to OpenAI Vision API.
 */
export async function classifyWithML(imageUri: string): Promise<AIClassification | null> {
  if (!isMLModelConfigured()) return null;

  try {
    // Read image as base64 from the local file URI
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

    // Send to OpenAI Vision API
    const apiResponse = await fetch(AI_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: CLASSIFICATION_PROMPT },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.1, // Low temp for consistent classification
      }),
    });

    if (!apiResponse.ok) {
      console.warn('AI classification API error:', apiResponse.status);
      return null;
    }

    const data = await apiResponse.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) return null;

    // Parse the JSON response — handle markdown code blocks
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonStr);

    return {
      label: parsed.classification || 'unclear',
      confidence: Math.max(0, Math.min(100, parsed.confidence || 50)),
      description: parsed.description || 'Unable to determine classification.',
      features: parsed.features || [],
      biteType: parsed.bite_type || parsed.classification || 'Unknown',
    };
  } catch (err) {
    console.warn('AI classification failed:', err);
    return null;
  }
}
