# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A handwritten digit recognition project (MNIST) developed as two separate versions:

| Folder | Description | Details |
|---|---|---|
| `desktop_version/` | Tkinter desktop app, distributable as a PyInstaller onefile exe | `desktop_version/CLAUDE.md` |
| `web_version/` | Flask server + HTML canvas web app | `web_version/CLAUDE.md` |

Each version is self-contained in its own folder (its own `requirements.txt`, model file, build artifacts). Run commands from inside the relevant version folder. A shared Python virtualenv lives at the repo root in `.venv/`.

When working on one version, read that folder's `CLAUDE.md` as well — it holds the version-specific commands and architecture.

## Conventions (apply to both versions)

Every new file created in this repo must start with a comment stating the creation date and time (e.g. `# Created: 2026-09-22 14:30` for Python, `REM Created: ...` for `.bat`, `<!-- Created: ... -->` for HTML, `// Created: ...` for JS), using the appropriate comment syntax for that file type. (Formats without comments, such as JSON, are exempt.)

## Shared domain knowledge

Both versions must feed the model input that matches MNIST's own formatting, otherwise accuracy drops regardless of model quality:

1. Invert to white-on-black (MNIST digits are white strokes on black background).
2. Crop to the drawn stroke's bounding box.
3. Resize so the longer side is 20px, preserving aspect ratio.
4. Center in a 28x28 canvas.
5. Normalize pixel values to 0–1 and flatten to 784 features.

The reference implementation is `preprocess()` in `desktop_version/digit_recognition.py`. If the web version reimplements preprocessing (e.g. in JavaScript on the client), keep it behaviorally identical to that function.
