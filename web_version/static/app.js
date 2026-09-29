// Created: 2026-09-29 09:12
// Canvas drawing + prediction requests for the web digit recognizer.

const BRUSH_RADIUS = 8; // same stroke thickness as the desktop app (280x280 canvas)

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const resultEl = document.getElementById("result");
const probsEl = document.getElementById("probabilities");

let drawing = false;
let last = null;

function clearCanvas() {
  // Opaque white background so the exported PNG is black-on-white, like the desktop image.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  resultEl.textContent = "Draw a digit (0-9)";
  renderProbabilities(null);
}

function canvasPoint(event) {
  // Map CSS pixels to canvas pixels in case the canvas is scaled down on small screens.
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function drawTo(point) {
  ctx.strokeStyle = "#000";
  ctx.fillStyle = "#000";
  ctx.lineWidth = BRUSH_RADIUS * 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (last) {
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(point.x, point.y, BRUSH_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
  last = point;
}

canvas.addEventListener("pointerdown", (event) => {
  drawing = true;
  last = null;
  canvas.setPointerCapture(event.pointerId);
  drawTo(canvasPoint(event));
});

canvas.addEventListener("pointermove", (event) => {
  if (drawing) drawTo(canvasPoint(event));
});

function endStroke() {
  if (!drawing) return;
  drawing = false;
  last = null;
  predict();
}

canvas.addEventListener("pointerup", endStroke);
canvas.addEventListener("pointercancel", endStroke);

function renderProbabilities(probabilities) {
  probsEl.innerHTML = "";
  if (!probabilities) return;
  const top = probabilities.indexOf(Math.max(...probabilities));
  probabilities.forEach((p, digit) => {
    const li = document.createElement("li");
    if (digit === top) li.className = "top";
    const pct = (p * 100).toFixed(1);
    li.innerHTML =
      `<span>${digit}</span>` +
      `<div class="bar"><span style="width:${pct}%"></span></div>` +
      `<span class="pct">${pct}%</span>`;
    probsEl.appendChild(li);
  });
}

let requestId = 0;

async function predict() {
  const id = ++requestId;
  try {
    const response = await fetch("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: canvas.toDataURL("image/png") }),
    });
    const data = await response.json();
    if (id !== requestId) return; // a newer stroke's request superseded this one
    if (!response.ok) throw new Error(data.error || response.statusText);

    if (data.prediction === null) {
      resultEl.textContent = "Draw a digit (0-9)";
      renderProbabilities(null);
      return;
    }
    const confidence = (data.probabilities[data.prediction] * 100).toFixed(1);
    resultEl.textContent = `Prediction: ${data.prediction} (${confidence}%)`;
    renderProbabilities(data.probabilities);
  } catch (err) {
    if (id === requestId) resultEl.textContent = `Error: ${err.message}`;
  }
}

document.getElementById("clear-btn").addEventListener("click", clearCanvas);
document.getElementById("predict-btn").addEventListener("click", predict);

clearCanvas();
