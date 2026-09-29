"""
Handwritten digit recognition.

On first run, this script downloads the MNIST dataset, trains a neural
network classifier, and caches the trained model to disk. On every run
(including the first), it opens a small GUI window where the user can
draw a digit (0-9) with the mouse; the trained model then predicts which
digit was drawn.

Install dependencies first:
    pip install -r requirements.txt
"""

import sys
import time
import tkinter as tk
from pathlib import Path

import joblib
import numpy as np
from PIL import Image, ImageDraw
from sklearn.datasets import fetch_openml
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier


def resource_path(filename: str) -> Path:
    """Resolve a data file both in normal script mode and in a frozen
    (PyInstaller onefile) executable, where bundled files are extracted
    to a temporary folder referenced by sys._MEIPASS."""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        base_dir = Path(sys._MEIPASS)
    else:
        base_dir = Path(__file__).parent
    return base_dir / filename


MODEL_PATH = resource_path("mnist_mlp_model.joblib")

CANVAS_SIZE = 280  # displayed drawing area, in pixels (28 * 10)
IMAGE_SIZE = 28  # input size expected by the trained model
BRUSH_RADIUS = 8  # stroke thickness on the 280x280 canvas


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


class DigitRecognizerApp:
    """Tkinter GUI where the user draws a digit and gets a live prediction."""

    def __init__(self, root: tk.Tk, model):
        self.model = model
        self.root = root
        self.root.title("Handwritten Digit Recognizer")

        self.canvas = tk.Canvas(
            root, width=CANVAS_SIZE, height=CANVAS_SIZE, bg="white", cursor="cross"
        )
        self.canvas.grid(row=0, column=0, columnspan=2, padx=10, pady=10)

        # A parallel in-memory image mirrors the canvas so the drawing can be
        # turned into model input without capturing a screenshot of the widget.
        self.image = Image.new("L", (CANVAS_SIZE, CANVAS_SIZE), color=255)
        self.draw = ImageDraw.Draw(self.image)

        self.canvas.bind("<B1-Motion>", self.paint)
        self.canvas.bind("<ButtonRelease-1>", lambda event: self.predict())

        self.result_label = tk.Label(root, text="Draw a digit (0-9)", font=("Arial", 20))
        self.result_label.grid(row=1, column=0, columnspan=2, pady=5)

        self.clear_button = tk.Button(root, text="Clear", command=self.clear_canvas)
        self.clear_button.grid(row=2, column=0, pady=10, sticky="ew", padx=10)

        self.predict_button = tk.Button(root, text="Predict", command=self.predict)
        self.predict_button.grid(row=2, column=1, pady=10, sticky="ew", padx=10)

    def paint(self, event):
        x, y = event.x, event.y
        r = BRUSH_RADIUS
        self.canvas.create_oval(x - r, y - r, x + r, y + r, fill="black", outline="black")
        self.draw.ellipse([x - r, y - r, x + r, y + r], fill=0)

    def clear_canvas(self):
        self.canvas.delete("all")
        self.draw.rectangle([0, 0, CANVAS_SIZE, CANVAS_SIZE], fill=255)
        self.result_label.config(text="Draw a digit (0-9)")

    def preprocess(self):
        """Convert the drawn image into a normalized 28x28 array, MNIST-style."""
        arr = np.array(self.image, dtype=np.uint8)
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

    def predict(self):
        features = self.preprocess()
        if features is None:
            self.result_label.config(text="Draw a digit (0-9)")
            return

        prediction = self.model.predict(features)[0]
        probabilities = self.model.predict_proba(features)[0]
        confidence = probabilities[prediction] * 100
        self.result_label.config(text=f"Prediction: {prediction} ({confidence:.1f}%)")


def main():
    model = load_or_train_model()

    root = tk.Tk()
    DigitRecognizerApp(root, model)
    root.mainloop()


if __name__ == "__main__":
    main()
