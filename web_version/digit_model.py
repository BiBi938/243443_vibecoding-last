# Created: 2026-09-29 09:12
"""
Model lifecycle and MNIST-style preprocessing for the web version.

The model is loaded from mnist_mlp_model.joblib next to this file; if it is
missing, MNIST is downloaded and a new MLP is trained and cached (same
settings as desktop_version). preprocess() must stay behaviorally identical
to DigitRecognizerApp.preprocess() in desktop_version/digit_recognition.py.
"""

import time
from pathlib import Path

import joblib
import numpy as np
from PIL import Image
from sklearn.datasets import fetch_openml
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier

MODEL_PATH = Path(__file__).parent / "mnist_mlp_model.joblib"

CANVAS_SIZE = 280  # drawing area size the client sends, in pixels (28 * 10)
IMAGE_SIZE = 28  # input size expected by the trained model


def load_mnist():
    """Download (and cache) the MNIST dataset of 28x28 handwritten digit images."""
    print("Loading MNIST dataset (downloads and caches on first run)...")
    # "liac-arff" avoids a pandas dependency, keeping the environment minimal.
    mnist = fetch_openml("mnist_784", version=1, as_frame=False, parser="liac-arff")
    X = mnist.data.astype(np.float32) / 255.0  # scale pixel values to [0, 1]
    y = mnist.target.astype(np.int64)
    return X, y


def train_model():
    """Train an MLP classifier on MNIST and save it to MODEL_PATH."""
    X, y = load_mnist()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=10000, random_state=42, stratify=y
    )

    print(f"Training on {len(X_train)} samples...")
    start = time.time()
    model = MLPClassifier(
        hidden_layer_sizes=(128, 64),
        activation="relu",
        solver="adam",
        alpha=1e-4,
        max_iter=50,
        early_stopping=True,
        n_iter_no_change=5,
        random_state=42,
        verbose=True,
    )
    model.fit(X_train, y_train)
    print(f"Training finished in {time.time() - start:.1f} seconds")

    accuracy = accuracy_score(y_test, model.predict(X_test))
    print(f"Test accuracy: {accuracy * 100:.2f}%")

    joblib.dump(model, MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")
    return model


def load_or_train_model():
    """Load the cached model if it exists, otherwise train a new one."""
    if MODEL_PATH.exists():
        print(f"Loading cached model from {MODEL_PATH}")
        return joblib.load(MODEL_PATH)
    return train_model()


def to_grayscale(image: Image.Image) -> Image.Image:
    """Flatten any uploaded image (possibly with transparency) onto white,
    convert to grayscale, and scale to the canvas size the desktop app uses."""
    image = image.convert("RGBA")
    background = Image.new("RGBA", image.size, (255, 255, 255, 255))
    gray = Image.alpha_composite(background, image).convert("L")
    if gray.size != (CANVAS_SIZE, CANVAS_SIZE):
        gray = gray.resize((CANVAS_SIZE, CANVAS_SIZE), Image.LANCZOS)
    return gray


def preprocess(image: Image.Image):
    """Convert a black-on-white drawing into a normalized 28x28 array, MNIST-style."""
    arr = np.array(to_grayscale(image), dtype=np.uint8)
    arr = 255 - arr  # invert: bright strokes on dark background, like MNIST

    mask = arr > 20
    if not mask.any():
        return None

    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    digit = arr[rmin : rmax + 1, cmin : cmax + 1]

    # Scale the digit so its longer side is 20px, preserving aspect ratio,
    # then center it in a 28x28 canvas -- matches MNIST's own preprocessing.
    h, w = digit.shape
    if h > w:
        new_h = 20
        new_w = max(1, round(w * 20 / h))
    else:
        new_w = 20
        new_h = max(1, round(h * 20 / w))

    digit_img = Image.fromarray(digit).resize((new_w, new_h), Image.LANCZOS)

    canvas28 = Image.new("L", (IMAGE_SIZE, IMAGE_SIZE), color=0)
    offset = ((IMAGE_SIZE - new_w) // 2, (IMAGE_SIZE - new_h) // 2)
    canvas28.paste(digit_img, offset)

    normalized = np.array(canvas28, dtype=np.float32) / 255.0
    return normalized.reshape(1, -1)
