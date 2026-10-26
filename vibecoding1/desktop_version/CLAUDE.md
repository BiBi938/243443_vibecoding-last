<!-- Created: 2026-09-29 09:09 -->
# CLAUDE.md — Desktop Version

Version-specific guidance for `desktop_version/`. See the root `CLAUDE.md` for shared conventions and MNIST preprocessing rules.

## Overview

A single-file Tkinter desktop app (`digit_recognition.py`) that trains (or loads a cached) MLP classifier on MNIST and lets the user draw a digit with the mouse for live prediction. There is no test suite.

## Commands

Run from inside `desktop_version/`:

```
pip install -r requirements.txt      # numpy, scikit-learn, pillow, joblib
python digit_recognition.py          # run the GUI (trains on first run if mnist_mlp_model.joblib is missing)
pyinstaller digit_recognition.spec   # build dist\digit_recognition.exe (bundles the .joblib model as data)
```

`run_digit_recognition.bat` launches the built `dist\digit_recognition.exe` directly (no Python required) — use it to sanity-check the frozen build.

There is no lint or test command configured.

## Architecture

Everything lives in `digit_recognition.py`, in two halves:

1. **Model lifecycle** — `load_or_train_model()` loads `mnist_mlp_model.joblib` if present, otherwise `train_model()` downloads MNIST via `fetch_openml`, trains an `MLPClassifier` (128, 64 hidden units), and caches the result with `joblib.dump`. `resource_path()` resolves the model file relative to `sys._MEIPASS` when frozen by PyInstaller vs. relative to the script in normal dev mode — this indirection exists specifically so the same code works both as `python digit_recognition.py` and as the onefile exe built by `digit_recognition.spec`.

2. **GUI** — `DigitRecognizerApp` owns a Tkinter `Canvas` plus a parallel in-memory PIL `Image` that mirrors every stroke (avoids screenshotting the widget). On mouse release, `preprocess()` converts the drawing into model input by replicating MNIST's own preprocessing: invert to white-on-black, crop to the drawn bounding box, resize so the longer side is 20px (aspect ratio preserved), and center in a 28x28 canvas. The resulting normalized array is fed to `model.predict` / `predict_proba` for the displayed prediction and confidence.

When editing `preprocess()`, keep it aligned with MNIST's actual formatting (20px bounding box centered in 28x28) — a mismatch there is the most likely source of prediction accuracy regressions, separate from model training quality. This function is also the reference the web version must match.
