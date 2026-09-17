# OMNISCAN TITAN X — Offline & Network Architecture Guide

## Overview

OmniScan Titan X is engineered as a **100% offline-first application**, fully prepared for packaging as a standalone Electron desktop application (`.exe`, `.dmg`, `.AppImage`) or running in isolated/air-gapped enterprise environments.

---

## 1. Zero External Runtime Dependencies

The application core requires **zero internet connection** and makes **zero external CDN or remote web requests** during regular operation.

### Local Bundling Verification:
- **Fonts**: All typography (`Cinzel`, `JetBrains Mono`, `Plus Jakarta Sans`) is bundled locally as `.woff2` files under `src/assets/fonts/` and emitted into `dist/assets/`. All external Google Fonts CDN links have been removed from `index.html`.
- **PDF.js Engine**: Uses `pdfjs-dist` with a dedicated locally compiled worker (`pdf.worker.min.mjs`) bundled by Vite. Fully compatible with both `http:` and Electron `file://` protocols.
- **Tesseract.js OCR**: Tesseract Web Worker (`worker.min.js`), WebAssembly core binaries (`tesseract-core.wasm.js`, SIMD/LSTM variants), and pre-trained language datasets (`eng`, `urd`, `ara`, `fra`, `spa`, `deu`) are stored in `public/tesseract/` and served locally from `dist/tesseract/`.
- **Image Processing & Computer Vision Filters**: Perspective warp, deskew, illumination correction, adaptive thresholding, binarization, and color adjustments run locally in client-side Web Workers (`filterWorkerPool.ts`).
- **Office / Document Conversion**: DOCX (`mammoth`), XLSX (`xlsx`), and PPTX engines execute entirely in local browser memory.
- **Layout & Print Studios**: A6 Half-Card Studio, 4x6 Photo Studio, ID Card Print Studio, and N-up multi-page layout generators operate client-side using local canvas rendering and PDF generation (`jspdf` / `pdf-lib`).

---

## 2. Documented External Integrations

Only two optional, explicit features interface with external network APIs. Both fail gracefully with local fallbacks when offline:

### A. Autonomous Document Intelligence (Google Gemini AI)
- **Endpoint**: `/api/intelligence/analyze`
- **Network Call**: Communicates server-side with Google Gemini models via `@google/genai` (requiring `GEMINI_API_KEY`).
- **Offline Fallback**: When the device is offline or no API key is configured, OmniScan Titan X automatically activates its built-in **Local Heuristic Intelligence Engine** (`runLocalHeuristicIntelligence` in `src/engine/intelligence.ts`), providing instant offline document classification, entity parsing, date/monetary extraction, and PII detection with zero latency and zero data egress.

### B. Remote AI Background Removal (Optional Microservice)
- **Endpoint**: `/api/background/remove`
- **Network Call**: Optional user-configured external microservice for server-side AI background segmentation models (e.g. RMBG, BiRefNet, rembg).
- **Offline Behavior**: If unconfigured or offline, the app displays status feedback and allows manual cropping, local color filtering, and edge detection instead.

---

## 3. Electron Packaging Guidelines

To package OmniScan Titan X into an Electron `.exe`:

1. **Build the production bundle**:
   ```bash
   npm run build
   ```
2. **Main Electron Entry Point** (`main.js`):
   Point your `BrowserWindow` directly to the local `dist/index.html` file using `loadFile`:
   ```javascript
   const { app, BrowserWindow } = require('electron');
   const path = require('path');

   function createWindow() {
     const win = new BrowserWindow({
       width: 1440,
       height: 900,
       webPreferences: {
         nodeIntegration: false,
         contextIsolation: true,
         sandbox: true
       }
     });

     // Load directly from local filesystem (file:// protocol)
     win.loadFile(path.join(__dirname, 'dist', 'index.html'));
   }

   app.whenReady().then(createWindow);
   ```
3. **Asset Protocol Support**:
   `vite.config.ts` is configured with `base: './'`, ensuring all assets, scripts, stylesheets, workers, and WASM binaries resolve relative to the current file path on disk without needing a local web server.
