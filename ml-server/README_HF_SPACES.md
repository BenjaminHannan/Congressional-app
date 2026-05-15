# Deploying Trace ML Server to Hugging Face Spaces

Free hosting for the FastAPI + PyTorch classifier so the phone app can hit a
stable URL instead of a laptop+ngrok tunnel.

## Why Spaces

- Free CPU tier is sufficient for MobileNetV3 (≈200 ms per inference)
- No credit card required
- Stable HTTPS URL (`https://<user>-<space>.hf.space`) — no rotating ngrok URLs
- Docker SDK supported, so the existing `Dockerfile` Just Works

## One-time setup

1. Sign in at https://huggingface.co and create a new Space:
   - **SDK:** Docker
   - **Hardware:** CPU basic (free)
   - **Visibility:** Public

2. Clone the empty Space repo locally (HF gives you the URL on the next page),
   then copy these four files into it:
   ```
   ml-server/Dockerfile
   ml-server/requirements.txt
   ml-server/server.py
   ml-server/classes.txt
   ml-server/model.pt
   ```

   `model.pt` is 17 MB — well under HF's 5 GB per-file limit but you may need
   `git lfs track "model.pt"` if your local git is configured to refuse large
   blobs.

3. Commit and push. The Space will build the Docker image and start serving on
   port 8000 within a few minutes.

4. Once the Space is "Running", grab the URL from the top of the page (looks
   like `https://benjaminhannan-trace-ml.hf.space`) and paste it into
   `trace/lib/bite-scanner.ts`:

   ```ts
   const ML_SERVER_URL: string | null = 'https://benjaminhannan-trace-ml.hf.space';
   ```

   Reload Expo Go — the Scan tab now hits the live model.

## Endpoints exposed

| Path        | Method | Purpose                                                 |
|-------------|--------|---------------------------------------------------------|
| `/`         | GET    | Service status + class list                             |
| `/health`   | GET    | Liveness probe                                          |
| `/classify` | POST   | `{image: <b64>}` → binary tick/not-tick + top-3 softmax |
| `/explain`  | POST   | `{image: <b64>}` → Grad-CAM saliency PNG over the photo |

## Privacy note

Photos are sent only when `ML_SERVER_URL` is non-null. The server does not
write images to disk — they live in request memory and are discarded after the
response. Privacy claims in the README still hold: by default
`ML_SERVER_URL = null` and the app uses the on-device questionnaire flow.
