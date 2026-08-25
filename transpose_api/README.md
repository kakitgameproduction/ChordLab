# Chordasy Transpose API

This folder contains the standalone Python API used by the Chordasy website PDF transpose demo.

It is deployed separately from the static GitHub Pages website because PDF processing requires a Python runtime. The service is self-contained and does not depend on the app's `chordvault` package.

## What it does

- Accepts a PDF upload
- Recognizes supported chord symbols from a PDF text layer
- Transposes chord roots and slash-bass notes while preserving chord modifiers
- Generates highlighted preview pages
- Returns a downloadable transposed PDF

## Chord recognition

The parser supports common and complex letter-based chord symbols, including:

- Basic and slash chords: `C`, `F#m7`, `C/E`, `A/D`
- Extensions and suspended chords: `C7`, `Dmaj9`, `Gsus4`, `F6/9`
- Parenthetical modifiers: `G(4)`, `Dm7(4)`, `Am7(b5)`, `C7(b9,#11)`
- Altered and omitted tones: `C#7(#9#5)`, `Cadd#11`, `Cno3`, `Comit5`, `C7alt`
- Common symbols and Unicode accidentals: `CΔ7`, `C°7`, `Cø7`, `F♯m7`, `B♭maj7`

Recognition is intentionally conservative. Invalid or prose-like values such as `C(chorus)` are not treated as chords.

Current limitations:

- PDFs must contain a selectable text layer; scanned or image-only PDFs are not analyzed.
- JPG and PNG files are not accepted by this API.
- Number-system and Roman-numeral chords are not currently transposed.

## Endpoints

- `GET /api/health`
- `POST /api/transpose/upload`
- `GET /api/transpose/<document_id>/preview?transpose=2`
- `GET /api/transpose/<document_id>/pages/0?transpose=2`
- `GET /api/transpose/<document_id>/download?transpose=2`

## Local run

```bash
cd transpose_api
pip install -r requirements.txt
gunicorn app:app
```

Or:

```bash
cd transpose_api
python app.py
```

Default port is `8080`.

## Upload request

Use `multipart/form-data` with field name:

- `file`

Example using curl:

```bash
curl -X POST http://127.0.0.1:8080/api/transpose/upload \
  -F "file=@/path/to/chart.pdf"
```

## Typical response

```json
{
  "document_id": "2f7b9a0f4d6c4d2fa29f3d5b1d4a8e9f",
  "filename": "Amazing Grace.pdf",
  "transpose": 0,
  "transpose_supported": true,
  "page_count": 2,
  "pages": [
    "https://chordlab-transpose-api.onrender.com/api/transpose/2f7b9a0f4d6c4d2fa29f3d5b1d4a8e9f/pages/0?transpose=0",
    "https://chordlab-transpose-api.onrender.com/api/transpose/2f7b9a0f4d6c4d2fa29f3d5b1d4a8e9f/pages/1?transpose=0"
  ],
  "download_url": "https://chordlab-transpose-api.onrender.com/api/transpose/2f7b9a0f4d6c4d2fa29f3d5b1d4a8e9f/download?transpose=0"
}
```

## Render deploy

1. Commit the contents of this `transpose_api` directory to GitHub.
2. In Render, choose `New +` -> `Blueprint`, or `New +` -> `Web Service`.
3. Connect the GitHub repo.
4. If using `Blueprint`, Render can read `transpose_api/render.yaml`.
5. If using `Web Service`, set:

   - Root Directory: `transpose_api`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`

6. The current production API URL is:

   `https://chordlab-transpose-api.onrender.com`

7. The website calls:

   `https://chordlab-transpose-api.onrender.com/api/transpose/upload`

If automatic deploy is disabled, use **Manual Deploy → Deploy latest commit** in Render. A free Render instance can take approximately 30–50 seconds to wake after a period of inactivity.

## Website integration

Frontend flow:

1. Open the transpose demo.
2. Upload a text-layer PDF.
3. Receive a `document_id` and preview-page URLs.
4. Change the transpose amount with `-1`, `+1`, or Reset.
5. Request the preview endpoint with the new semitone value.
6. Use the returned `download_url` to download the final PDF.

## Notes

- This service supports text-layer PDF files only.
- Uploaded files are stored temporarily and cleaned up automatically.
- GitHub Pages cannot run this service directly; it must be hosted on a Python-capable platform.
