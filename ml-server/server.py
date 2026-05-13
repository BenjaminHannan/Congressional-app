"""
Trace ML — Inference Server

Serves the trained model via HTTP. The phone sends a base64 image,
the server runs inference on the GPU and returns a classification.

Usage:
    python server.py

Then expose via ngrok:
    ngrok http 8000

Paste the ngrok URL into trace/lib/bite-scanner.ts ML_SERVER_CONFIG.url.
"""

import base64
import io
from typing import Optional

import torch
import torch.nn as nn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel
from torchvision import models, transforms

# ── Friendly class names + descriptions ──
# Keys match the dataset class names (plural) used during training.
CLASS_INFO = {
    'ticks': {
        'bite_type': 'Tick Bite',
        'description': (
            'Pattern consistent with a tick bite. Monitor the area closely for the next '
            '3-30 days — if you see an expanding red rash (especially with central clearing), '
            'see a doctor immediately as it could be early Lyme disease.'
        ),
    },
    'mosquitos': {
        'bite_type': 'Mosquito Bite',
        'description': (
            'Common mosquito bite. Typically a small itchy bump that resolves within a few '
            'days. Generally harmless — no medical attention needed unless there are signs of infection.'
        ),
    },
    'spiders': {
        'bite_type': 'Spider Bite',
        'description': (
            'Pattern consistent with a spider bite. Most spider bites are harmless, but some '
            '(brown recluse, black widow) require medical attention. Monitor for spreading '
            'redness, severe pain, or necrosis.'
        ),
    },
    'ants': {
        'bite_type': 'Ant Bite / Sting',
        'description': (
            'Common ant bite or sting. Usually heals within a few days. '
            'Fire ant stings can cause more significant reactions and form pustules.'
        ),
    },
    'bed_bugs': {
        'bite_type': 'Bed Bug Bite',
        'description': (
            'Pattern consistent with bed bug bites — these often appear in clusters or lines. '
            'Bites are itchy but not medically dangerous. If confirmed, treat your living space.'
        ),
    },
    'chiggers': {
        'bite_type': 'Chigger Bite',
        'description': (
            'Chigger bite — typically very itchy red welts, often around tight clothing lines '
            '(socks, waistbands). Resolves on its own within 1-2 weeks.'
        ),
    },
    'fleas': {
        'bite_type': 'Flea Bite',
        'description': (
            'Common flea bite — small red bumps, often around ankles and lower legs. '
            'Treat the source (pets, environment) to prevent more bites.'
        ),
    },
    'no_bites': {
        'bite_type': 'No Bite Detected',
        'description': (
            'The model did not detect a bite or unusual skin mark in this image. '
            'If you have concerns, consider taking another photo with better lighting and a closer view.'
        ),
    },
}


class ClassifyRequest(BaseModel):
    image: str  # base64-encoded JPEG


class ClassifyResponse(BaseModel):
    # Binary tick/not-tick decision (the answer the app actually uses)
    is_tick: bool
    tick_probability: float        # 0-1, probability this is a tick bite
    confidence: float              # 0-1, how confident in the binary decision

    # Friendly fields for the app
    label: str                     # "tick" or "not_tick"
    bite_type: str
    description: str
    features: list[str]            # Top 3 predictions for transparency
    top_predictions: list[dict]    # Full 8-class top-3


# ── Load model on startup ──
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f'Inference device: {device}')

CHECKPOINT_PATH = 'model.pt'

# Load checkpoint
try:
    checkpoint = torch.load(CHECKPOINT_PATH, map_location=device, weights_only=False)
    classes = checkpoint['classes']
    num_classes = checkpoint['num_classes']

    # Build model and load weights
    model = models.mobilenet_v3_large(weights=None)
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_features, num_classes)
    model.load_state_dict(checkpoint['state_dict'])
    model.to(device).eval()
    print(f'Loaded model with classes: {classes}')
except FileNotFoundError:
    print(f'WARNING: {CHECKPOINT_PATH} not found. Run train.py first.')
    model = None
    classes = []

# Same preprocessing as validation in train.py
preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

# ── FastAPI app ──
app = FastAPI(title='Trace ML Server')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/')
def root():
    return {
        'service': 'Trace ML Server',
        'status': 'ready' if model else 'no_model',
        'classes': classes,
        'device': str(device),
    }


@app.get('/health')
def health():
    return {'ok': True, 'model_loaded': model is not None}


@app.post('/classify', response_model=ClassifyResponse)
def classify(req: ClassifyRequest):
    """
    Binary tick / not-tick classification.

    Strategy: run the 8-way model, then collapse to binary by summing
    the tick probability vs everything else. Decision threshold defaults
    to 0.5 but is asymmetric — we lean conservative because false negatives
    (missing a real tick bite) are worse than false positives.
    """
    if model is None:
        raise HTTPException(503, 'Model not loaded. Run train.py first.')

    # Decode base64 image
    try:
        img_bytes = base64.b64decode(req.image)
        img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    except Exception as e:
        raise HTTPException(400, f'Invalid image: {e}')

    # Preprocess and run inference
    tensor = preprocess(img).unsqueeze(0).to(device)
    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1)[0]

    # Find tick class index
    tick_idx = classes.index('ticks') if 'ticks' in classes else None
    if tick_idx is None:
        raise HTTPException(500, 'Model has no "ticks" class.')

    tick_prob = probs[tick_idx].item()
    not_tick_prob = 1.0 - tick_prob

    # Conservative decision: only call it a tick bite if probability is meaningful.
    # We use 0.35 as the threshold — false positives are better than false negatives
    # for Lyme screening, but we don't want to flag every random photo as a tick.
    is_tick = tick_prob >= 0.35
    confidence = tick_prob if is_tick else not_tick_prob

    # Top-3 from full 8-way predictions for transparency
    top_probs, top_idxs = torch.topk(probs, k=min(3, len(classes)))
    top_predictions = [
        {'label': classes[idx.item()], 'confidence': prob.item()}
        for prob, idx in zip(top_probs, top_idxs)
    ]

    # Friendly text
    if is_tick:
        bite_type = 'Tick Bite'
        description = (
            f'The model classified this as a tick bite (model gave it '
            f'{round(tick_prob * 100)}% probability). In New Hampshire, tick '
            f'bites carry a real risk of Lyme disease — monitor the area carefully.'
        )
    else:
        bite_type = 'Not a Tick Bite'
        description = (
            f'The model is {round(not_tick_prob * 100)}% confident this is NOT a tick bite. '
            f'Note: the model is trained on bug bites, so unfamiliar things '
            f'(pimples, scratches, etc.) may be classified as the closest match.'
        )

    # Show what the model actually saw — top 3 of all 8 classes
    features = [
        f'{p["label"].replace("_", " ").title()}: {round(p["confidence"] * 100)}%'
        for p in top_predictions
    ]

    return ClassifyResponse(
        is_tick=is_tick,
        tick_probability=tick_prob,
        confidence=confidence,
        label='tick' if is_tick else 'not_tick',
        bite_type=bite_type,
        description=description,
        features=features,
        top_predictions=top_predictions,
    )


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
