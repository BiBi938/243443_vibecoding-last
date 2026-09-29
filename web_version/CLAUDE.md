<!-- Created: 2026-09-29 09:09 -->
# CLAUDE.md — Web Version

Version-specific guidance for `web_version/`. See the root `CLAUDE.md` for shared conventions and MNIST preprocessing rules.

## Overview

Browser-based version of the handwritten digit recognizer: a Flask server plus a vanilla HTML/JS page. The user draws a digit on an HTML `<canvas>` and gets a live prediction with confidence and a per-digit probability chart, mirroring the desktop app's behavior. There is no test suite.

## Commands

Run from inside `web_version/`:

```
pip install -r requirements.txt      # flask, numpy, scikit-learn, pillow, joblib
python app.py                        # dev server at http://127.0.0.1:5000 (trains on first run if mnist_mlp_model.joblib is missing)
```

`run_web.bat` starts the server with the repo-root `.venv` Python and opens the browser after 3 seconds — double-click it from Explorer. The server only runs while its console window is open.

There is no lint, test, or build command configured.

## Architecture

- **`digit_model.py`** — model lifecycle and preprocessing. `load_or_train_model()` / `train_model()` use the same MLP settings as the desktop version and cache to `mnist_mlp_model.joblib` in this folder (a copy of the desktop model; this folder is self-contained and never imports from `desktop_version/`). `preprocess()` is a copy of the desktop `DigitRecognizerApp.preprocess()`; the only addition is `to_grayscale()`, which flattens the uploaded PNG onto white and scales it to 280x280 so the rest of the pipeline sees exactly what the desktop app's in-memory image would contain.
- **`app.py`** — Flask app. `GET /` renders `templates/index.html`; `POST /predict` takes JSON `{"image": "<PNG data URL>"}` and returns `{"prediction": int|null, "probabilities": [10 floats]}` (`null` when the canvas is blank, HTTP 400 on undecodable image data). The model is loaded once at import time.
- **`static/app.js`** — pointer-event drawing on a 280x280 canvas with a white background and round-capped stroke of radius 8 (matching the desktop `BRUSH_RADIUS`), so stroke thickness after resizing matches the desktop app. Predicts automatically on stroke end; stale responses are dropped via a request counter.

Preprocessing runs server-side on purpose, so it stays byte-for-byte identical to the desktop reference. If you change `preprocess()` here or in `desktop_version/`, change the other one to match.
