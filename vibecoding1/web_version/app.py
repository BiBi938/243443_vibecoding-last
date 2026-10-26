# Created: 2026-09-29 09:12
"""
Handwritten digit recognition -- web version.

Serves a page with an HTML canvas; the browser posts the drawing as a PNG
data URL to /predict, which runs the same MNIST-style preprocessing as the
desktop app and returns the prediction with per-digit probabilities.

Run:
    pip install -r requirements.txt
    python app.py    # then open http://127.0.0.1:5000
"""

import base64
import binascii
import io

from flask import Flask, jsonify, render_template, request
from PIL import Image, UnidentifiedImageError

from digit_model import load_or_train_model, preprocess

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024  # a 280x280 PNG is far smaller

model = load_or_train_model()


@app.get("/")
def index():
    return render_template("index.html")


@app.post("/predict")
def predict():
    data = request.get_json(silent=True) or {}
    data_url = data.get("image", "")
    _, _, encoded = data_url.partition(",")
    try:
        image = Image.open(io.BytesIO(base64.b64decode(encoded, validate=True)))
        image.load()
    except (binascii.Error, UnidentifiedImageError, OSError):
        return jsonify(error="Invalid image data"), 400

    features = preprocess(image)
    if features is None:
        return jsonify(prediction=None, probabilities=[0.0] * 10)

    probabilities = model.predict_proba(features)[0]
    prediction = int(model.classes_[probabilities.argmax()])
    return jsonify(prediction=prediction, probabilities=[float(p) for p in probabilities])


if __name__ == "__main__":
    app.run(debug=True)
