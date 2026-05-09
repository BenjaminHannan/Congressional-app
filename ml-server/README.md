# Trace ML Server

Self-hosted PyTorch image classifier for the Trace Lyme app. The phone sends a bite photo here, the GPU runs inference, and the result comes back to the phone.

**Why this approach?** Free (your hardware), GPU-accelerated, private (data never leaves your network), and perfect for the Congressional App Challenge demo. You only run the server when you're demoing the app.

---

## One-time setup

### 1. Install Python + dependencies

You need Python 3.10+. If you have an NVIDIA GPU, install CUDA-enabled PyTorch first; otherwise CPU works (slower).

```powershell
cd ml-server

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate

# Install requirements (default uses CUDA if available)
pip install -r requirements.txt

# OR for explicit CUDA 12.1 PyTorch:
# pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

### 2. Download the datasets

You need a free Kaggle account. Go download these and unzip them into the `data/` folder:

1. **Bug Bite Images**: https://www.kaggle.com/datasets/moonfallidk/bug-bite-images
   (1,300 images: ant, bed bug, chigger, flea, mosquito, spider, **tick**, uninfected_skin)
2. **Lyme Disease EM Rashes**: https://www.kaggle.com/datasets/sshikamaru/lyme-disease-full-dataset
   (5,000+ erythema migrans rash images)

### 3. Arrange the data

The training script expects this folder layout:

```
ml-server/
  data/
    ant/             ← from Bug Bite Images
    bed_bug/
    chigger/
    flea/
    mosquito/
    spider/
    tick/
    no_bite/         ← rename "uninfected_skin" to this
    erythema_migrans/  ← put the Lyme EM dataset images here
```

### 4. Train the model

```powershell
python train.py --epochs 15 --batch-size 32
```

Training time depends on your GPU:
- RTX 3060: ~10-15 minutes
- RTX 4090: ~3-5 minutes
- CPU only: ~1-2 hours

You'll see per-epoch accuracy. Expect 80-95% validation accuracy on this combined dataset. The script saves `model.pt` and `classes.txt` to the current folder.

---

## Running the server (every demo)

### 1. Start the server

```powershell
.\venv\Scripts\activate
python server.py
```

Server runs on `http://localhost:8000`. Test it:
```powershell
curl http://localhost:8000/health
```

### 2. Expose with ngrok (free)

Sign up at https://ngrok.com (free tier is fine). Install, then:

```powershell
ngrok http 8000
```

Copy the `https://...ngrok-free.app` URL it gives you.

### 3. Point the app at your server

Open `trace/lib/bite-scanner.ts`. Find:

```typescript
const ML_SERVER_CONFIG = {
  url: '',  // ← paste your ngrok URL here
  timeoutMs: 8000,
};
```

Paste your ngrok URL. Save. Reload the app (shake phone → Reload).

### 4. Test it

Open the Scan tab, take a photo. The "AI Classification" card will say `• GPU model` instead of `• on-device`, and the result will come from your trained model.

---

## API reference

### `GET /health`
Returns `{ok: true, model_loaded: true}`

### `POST /classify`
Body: `{image: "<base64 jpeg>"}`

Returns:
```json
{
  "label": "tick",
  "confidence": 0.87,
  "bite_type": "Tick Bite",
  "description": "Pattern consistent with a tick bite...",
  "features": ["Tick: 87%", "Mosquito: 9%", "Spider: 4%"],
  "top_predictions": [...]
}
```

---

## When you're done demoing

Just close the server (Ctrl+C) and ngrok. The app gracefully falls back to the on-device questionnaire classifier — nothing breaks.

---

## Tips for accuracy

- **More data = better.** The combined Kaggle datasets are a solid start. If you find more EM rash images, add them to `data/erythema_migrans/`.
- **Balance the classes.** If one class has way more images than others, the model gets biased. Aim for roughly 200-500 images per class.
- **Train longer.** Bump `--epochs` to 25-30 if your validation accuracy is still climbing.
- **Use the GPU.** CPU training works but is painfully slow. Make sure `print(device)` in `server.py` says `cuda`.
