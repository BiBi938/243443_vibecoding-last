<!-- Created: 2026-09-29 10:05 -->
# Handwritten Digit Recognizer

MNIST로 학습한 MLP 모델로 마우스/터치로 그린 손글씨 숫자(0–9)를 인식하는 프로그램입니다. 데스크톱 버전과 웹 버전 두 가지로 제공됩니다.

| 폴더 | 설명 |
|---|---|
| [`desktop_version/`](desktop_version/) | Tkinter 데스크톱 앱 (PyInstaller로 exe 빌드 가능) |
| [`web_version/`](web_version/) | Flask 서버 + HTML Canvas 웹 앱 |

학습된 모델(`mnist_mlp_model.joblib`)이 각 폴더에 포함되어 있어 바로 실행할 수 있습니다. 모델 파일을 지우면 첫 실행 때 MNIST를 내려받아 다시 학습합니다.

## 설치

```
python -m venv .venv
.venv\Scripts\activate
pip install -r web_version/requirements.txt     # 웹 버전 (데스크톱 의존성 포함)
```

## 실행

**데스크톱 버전**
```
cd desktop_version
python digit_recognition.py
```
exe 빌드: `pyinstaller digit_recognition.spec` → `dist\digit_recognition.exe`

**웹 버전**
```
cd web_version
python app.py
```
브라우저에서 http://localhost:5000 을 엽니다. Windows에서는 `web_version\run_web.bat`을 더블클릭해도 됩니다.
