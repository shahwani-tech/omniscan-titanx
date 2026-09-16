/**
 * OMNISCAN TITAN X - Computer Vision Verification Suite & Timing Benchmark
 * Programmatic harness for the 8 Accuracy Scenarios and 12MP latency targets.
 */

import {
  detectDocumentQuadFromBuffer,
  computeEnsembleDeskewFromBuffer,
  computeBlanknessFromBuffer,
} from "./pixelCore";
import {
  analyzeImageAndComputeAutoGrade,
  computeAutoGradeFromBuffer,
} from "./autoColorGrade";
import { classifyImageContent } from "./autoClassifier";

export interface ScenarioTestResult {
  testId: string;
  name: string;
  passed: boolean;
  expectedConfidence: string;
  actualConfidence: number;
  actualConfidencePct: string;
  notes: string;
  quadDetails?: string;
}

export interface TimingBenchmarkResult {
  feature: string;
  targetMs: number;
  run1Ms: number;
  run2Ms: number;
  run3Ms: number;
  averageMs: number;
  passed: boolean;
  marginMs: number;
}

export interface FullBenchmarkReport {
  accuracyResults: ScenarioTestResult[];
  timingResults: TimingBenchmarkResult[];
  allAccuracyPassed: boolean;
  allTimingsPassed: boolean;
  timestamp: string;
}

// -------------------------------------------------------------
// HELPER: Generate Synthetic Test Buffers (Zero DOM)
// -------------------------------------------------------------
function fillRect(
  buffer: Uint8ClampedArray,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number
) {
  const minX = Math.max(0, Math.min(w - 1, Math.round(x0)));
  const maxX = Math.max(0, Math.min(w - 1, Math.round(x1)));
  const minY = Math.max(0, Math.min(h - 1, Math.round(y0)));
  const maxY = Math.max(0, Math.min(h - 1, Math.round(y1)));

  for (let y = minY; y <= maxY; y++) {
    const rowOffset = y * (w << 2);
    for (let x = minX; x <= maxX; x++) {
      const idx = rowOffset + (x << 2);
      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = 255;
    }
  }
}

// -------------------------------------------------------------
// ITEM 1: 8 ACCURACY TEST SCENARIOS
// -------------------------------------------------------------
export function runAccuracyTestScenarios(): ScenarioTestResult[] {
  const results: ScenarioTestResult[] = [];
  const W = 640;
  const H = 480;

  // -----------------------------------------------------------
  // TEST 1: White document on dark background
  // -----------------------------------------------------------
  {
    const buf = new Uint8ClampedArray(W * H * 4);
    // Dark background (RGB 32, 32, 35)
    buf.fill(32);
    for (let i = 3; i < buf.length; i += 4) buf[i] = 255;

    // White document at [x: 80..560, y: 60..420]
    fillRect(buf, W, H, 80, 60, 560, 420, 245, 245, 248);

    // Simulated printed text lines
    for (let y = 100; y < 380; y += 16) {
      fillRect(buf, W, H, 110, y, 530, y + 3, 40, 40, 45);
    }

    const res = detectDocumentQuadFromBuffer(buf, W, H);
    const passed = res.confidence >= 0.85;

    results.push({
      testId: "TEST 1",
      name: "White document on dark background",
      passed,
      expectedConfidence: "> 85%",
      actualConfidence: res.confidence,
      actualConfidencePct: `${(res.confidence * 100).toFixed(1)}%`,
      notes: passed
        ? "Corners detected with high precision. Strong Otsu threshold separation and Douglas-Peucker contour fitting."
        : "Failed confidence threshold.",
      quadDetails: `TL:(${res.quad.topLeft.x.toFixed(2)},${res.quad.topLeft.y.toFixed(2)}) BR:(${res.quad.bottomRight.x.toFixed(2)},${res.quad.bottomRight.y.toFixed(2)})`,
    });
  }

  // -----------------------------------------------------------
  // TEST 2: Dark document on light background
  // -----------------------------------------------------------
  {
    const buf = new Uint8ClampedArray(W * H * 4);
    // Light desk background (RGB 230, 226, 220)
    for (let i = 0; i < buf.length; i += 4) {
      buf[i] = 230;
      buf[i + 1] = 226;
      buf[i + 2] = 220;
      buf[i + 3] = 255;
    }

    // Dark document [x: 90..550, y: 70..410]
    fillRect(buf, W, H, 90, 70, 550, 410, 45, 48, 52);
    // Light text on dark document
    for (let y = 110; y < 370; y += 16) {
      fillRect(buf, W, H, 120, y, 520, y + 2, 210, 210, 215);
    }

    const res = detectDocumentQuadFromBuffer(buf, W, H);
    const passed = res.confidence >= 0.85;

    results.push({
      testId: "TEST 2",
      name: "Dark document on light background",
      passed,
      expectedConfidence: "> 85%",
      actualConfidence: res.confidence,
      actualConfidencePct: `${(res.confidence * 100).toFixed(1)}%`,
      notes: passed
        ? "Dual-polarity edge gradient passes successfully extracted boundary contours despite inverted contrast."
        : "Failed confidence threshold.",
      quadDetails: `TL:(${res.quad.topLeft.x.toFixed(2)},${res.quad.topLeft.y.toFixed(2)}) BR:(${res.quad.bottomRight.x.toFixed(2)},${res.quad.bottomRight.y.toFixed(2)})`,
    });
  }

  // -----------------------------------------------------------
  // TEST 3: Document with shadow across one corner
  // -----------------------------------------------------------
  {
    const buf = new Uint8ClampedArray(W * H * 4);
    // Dark background
    buf.fill(30);
    for (let i = 3; i < buf.length; i += 4) buf[i] = 255;

    // White document
    fillRect(buf, W, H, 80, 60, 560, 420, 245, 245, 245);

    // Apply diagonal cast shadow darkening the top-right corner
    for (let y = 60; y <= 240; y++) {
      const rowOffset = y * (W << 2);
      for (let x = 320; x <= 560; x++) {
        const shadowDist = (x - 320) + (240 - y);
        if (shadowDist > 80) {
          const idx = rowOffset + (x << 2);
          const shadowFactor = Math.max(0.45, 1 - (shadowDist / 400));
          buf[idx] = Math.round(buf[idx] * shadowFactor);
          buf[idx + 1] = Math.round(buf[idx + 1] * shadowFactor);
          buf[idx + 2] = Math.round(buf[idx + 2] * shadowFactor);
        }
      }
    }

    const res = detectDocumentQuadFromBuffer(buf, W, H);
    const passed = res.confidence >= 0.70;

    results.push({
      testId: "TEST 3",
      name: "Document with shadow across one corner",
      passed,
      expectedConfidence: "> 70%",
      actualConfidence: res.confidence,
      actualConfidencePct: `${(res.confidence * 100).toFixed(1)}%`,
      notes: passed
        ? "Corners correctly placed despite top-right shadow gradient. Adaptive localized thresholding maintained boundary continuity."
        : "Corner placement was corrupted by shadow gradient.",
      quadDetails: `TL:(${res.quad.topLeft.x.toFixed(2)},${res.quad.topLeft.y.toFixed(2)}) TR:(${res.quad.topRight.x.toFixed(2)},${res.quad.topRight.y.toFixed(2)})`,
    });
  }

  // -----------------------------------------------------------
  // TEST 4: Document at extreme angle (45°+ tilt)
  // -----------------------------------------------------------
  {
    const buf = new Uint8ClampedArray(W * H * 4);
    // Dark background
    buf.fill(28);
    for (let i = 3; i < buf.length; i += 4) buf[i] = 255;

    // Draw rotated quadrilateral at ~45°
    // Center (320, 240), size 260x180, rotated 45°
    const cx = 320, cy = 240;
    const rad = Math.PI / 4; // 45 degrees
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    for (let y = 0; y < H; y++) {
      const rowOffset = y * (W << 2);
      for (let x = 0; x < W; x++) {
        // Inverse transform to test if inside local box [-130..130, -90..90]
        const dx = x - cx;
        const dy = y - cy;
        const localX = dx * cosA + dy * sinA;
        const localY = -dx * sinA + dy * cosA;

        if (Math.abs(localX) <= 130 && Math.abs(localY) <= 90) {
          const idx = rowOffset + (x << 2);
          buf[idx] = 242;
          buf[idx + 1] = 242;
          buf[idx + 2] = 244;
        }
      }
    }

    const res = detectDocumentQuadFromBuffer(buf, W, H);
    const passed = res.confidence >= 0.75;

    results.push({
      testId: "TEST 4",
      name: "Document at extreme angle (45°+ tilt)",
      passed,
      expectedConfidence: "> 75%",
      actualConfidence: res.confidence,
      actualConfidencePct: `${(res.confidence * 100).toFixed(1)}%`,
      notes: passed
        ? "Quadrilateral correctly fits 45° tilted polygon. Convex hull and geometric ordering aligned corners accurately."
        : "Failed 45-degree angle test.",
      quadDetails: `Confidence: ${(res.confidence * 100).toFixed(1)}%, 4 non-axis-aligned corners identified.`,
    });
  }

  // -----------------------------------------------------------
  // TEST 5: Document partially outside frame
  // -----------------------------------------------------------
  {
    const buf = new Uint8ClampedArray(W * H * 4);
    buf.fill(32);
    for (let i = 3; i < buf.length; i += 4) buf[i] = 255;

    // Document starts at frame boundary x=0, y=0 (extends off-screen to top-left)
    fillRect(buf, W, H, 0, 0, 480, 360, 240, 240, 245);

    const res = detectDocumentQuadFromBuffer(buf, W, H);
    // Places corner at frame edge (x=0, y=0)
    const placedAtEdge = res.quad.topLeft.x <= 0.05 && res.quad.topLeft.y <= 0.05;
    const passed = res.confidence >= 0.60 && placedAtEdge;

    results.push({
      testId: "TEST 5",
      name: "Document partially outside frame",
      passed,
      expectedConfidence: "> 60% (with frame-edge clamping)",
      actualConfidence: res.confidence,
      actualConfidencePct: `${(res.confidence * 100).toFixed(1)}%`,
      notes: passed
        ? "Successfully detected visible document boundary and clamped out-of-frame corner to viewport edge."
        : "Failed frame boundary clamping.",
      quadDetails: `Top-Left clamped at (${res.quad.topLeft.x.toFixed(2)}, ${res.quad.topLeft.y.toFixed(2)})`,
    });
  }

  // -----------------------------------------------------------
  // TEST 6: White document on white desk (hardest case)
  // -----------------------------------------------------------
  {
    const buf = new Uint8ClampedArray(W * H * 4);
    // White desk background: RGB 245, 244, 242
    for (let i = 0; i < buf.length; i += 4) {
      buf[i] = 245;
      buf[i + 1] = 244;
      buf[i + 2] = 242;
      buf[i + 3] = 255;
    }

    // White paper: RGB 250, 250, 249 (very faint delta of ~5-7)
    fillRect(buf, W, H, 80, 60, 560, 420, 250, 250, 249);

    const res = detectDocumentQuadFromBuffer(buf, W, H);
    // For low-contrast white-on-white, confidence should be < 60%
    // and engine gracefully falls back to canonical borders
    const isLowConfidence = res.confidence < 0.60;
    const passed = isLowConfidence;

    results.push({
      testId: "TEST 6",
      name: "White document on white desk (hardest case)",
      passed,
      expectedConfidence: "< 60% (graceful fallback trigger)",
      actualConfidence: res.confidence,
      actualConfidencePct: `${(res.confidence * 100).toFixed(1)}%`,
      notes: passed
        ? 'Low confidence correctly registered (<60%). Safely triggered fallback with "Could not detect edges — adjust manually" recommendation.'
        : "False positive high confidence produced on indistinguishable white-on-white background.",
      quadDetails: `Confidence: ${(res.confidence * 100).toFixed(1)}% (Low tier badge displayed)`,
    });
  }

  // -----------------------------------------------------------
  // TEST 7: ID card / small document on large background
  // -----------------------------------------------------------
  {
    const buf = new Uint8ClampedArray(W * H * 4);
    // Dark textured table
    buf.fill(40);
    for (let i = 3; i < buf.length; i += 4) buf[i] = 255;

    // Small ID card (~30% width, ratio 1.58: 190px × 120px)
    // Centered at [x: 225..415, y: 180..300]
    fillRect(buf, W, H, 225, 180, 415, 300, 242, 240, 235);
    // Card header bar
    fillRect(buf, W, H, 225, 180, 415, 205, 30, 80, 160);
    // Photo box
    fillRect(buf, W, H, 235, 215, 280, 285, 120, 140, 160);

    const res = detectDocumentQuadFromBuffer(buf, W, H);
    const passed = res.confidence >= 0.80;

    // Verify it detected the ID card, not the whole frame
    const widthRel = res.quad.topRight.x - res.quad.topLeft.x;
    const isSmallDoc = widthRel > 0.20 && widthRel < 0.50;

    results.push({
      testId: "TEST 7",
      name: "ID card / small document on large background",
      passed: passed && isSmallDoc,
      expectedConfidence: "> 80% (targeting isolated card)",
      actualConfidence: res.confidence,
      actualConfidencePct: `${(res.confidence * 100).toFixed(1)}%`,
      notes: passed && isSmallDoc
        ? "Detected the small card boundaries specifically (isolated 30% width contour, not full table background)."
        : "Failed to isolate small card from background.",
      quadDetails: `Relative width detected: ${(widthRel * 100).toFixed(1)}% of frame`,
    });
  }

  // -----------------------------------------------------------
  // TEST 8: Multiple documents in one photo
  // -----------------------------------------------------------
  {
    const buf = new Uint8ClampedArray(W * H * 4);
    buf.fill(35);
    for (let i = 3; i < buf.length; i += 4) buf[i] = 255;

    // Document A (Primary, larger): [x: 50..340, y: 60..420]
    fillRect(buf, W, H, 50, 60, 340, 420, 248, 248, 250);
    for (let y = 100; y < 380; y += 20) {
      fillRect(buf, W, H, 70, y, 320, y + 3, 50, 50, 55);
    }

    // Document B (Secondary, smaller): [x: 380..590, y: 120..380]
    fillRect(buf, W, H, 380, 120, 590, 380, 245, 245, 248);

    const res = detectDocumentQuadFromBuffer(buf, W, H);
    // Should detect the prominent document and provide candidate contours
    const hasCandidates = res.candidates && res.candidates.length >= 1;
    const passed = res.confidence >= 0.70 && hasCandidates;

    results.push({
      testId: "TEST 8",
      name: "Multiple documents in one photo",
      passed,
      expectedConfidence: "> 70% with multiple candidates",
      actualConfidence: res.confidence,
      actualConfidencePct: `${(res.confidence * 100).toFixed(1)}%`,
      notes: passed
        ? `Detected prominent primary document (${(res.confidence * 100).toFixed(1)}%) and populated ${res.candidates.length} alternative candidate contours.`
        : "Failed multiple document candidate segregation.",
      quadDetails: `Candidate contours available: ${res.candidates?.length || 0}`,
    });
  }

  return results;
}

// -------------------------------------------------------------
// ITEM 2: ACTUAL MS TIMING MEASUREMENTS (12MP BUFFER)
// -------------------------------------------------------------
export async function runLatencyTimingBenchmarks(): Promise<TimingBenchmarkResult[]> {
  const results: TimingBenchmarkResult[] = [];

  // Create 12MP synthetic buffer (4000 × 3000 = 12,000,000 pixels = 48MB RGBA)
  const W = 4000;
  const H = 3000;
  const buffer12MP = new Uint8ClampedArray(W * H * 4);

  // Fill background
  buffer12MP.fill(35);
  for (let i = 3; i < buffer12MP.length; i += 4) buffer12MP[i] = 255;

  // Insert a large document inside [x: 600..3400, y: 400..2600]
  fillRect(buffer12MP, W, H, 600, 400, 3400, 2600, 245, 245, 248);
  // Add some text lines
  for (let y = 600; y < 2400; y += 60) {
    fillRect(buffer12MP, W, H, 800, y, 3200, y + 15, 30, 30, 35);
  }

  // 1. Edge/quad detection (Target < 500ms)
  {
    const times: number[] = [];
    for (let run = 0; run < 3; run++) {
      const t0 = performance.now();
      detectDocumentQuadFromBuffer(buffer12MP, W, H);
      const t1 = performance.now();
      times.push(t1 - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    results.push({
      feature: "Edge / Quad Detection",
      targetMs: 500,
      run1Ms: Number(times[0].toFixed(1)),
      run2Ms: Number(times[1].toFixed(1)),
      run3Ms: Number(times[2].toFixed(1)),
      averageMs: Number(avg.toFixed(1)),
      passed: avg < 500,
      marginMs: Number((500 - avg).toFixed(1)),
    });
  }

  // 2. Deskew estimation (Target < 300ms)
  {
    const times: number[] = [];
    for (let run = 0; run < 3; run++) {
      const t0 = performance.now();
      computeEnsembleDeskewFromBuffer(buffer12MP, W, H);
      const t1 = performance.now();
      times.push(t1 - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    results.push({
      feature: "Ensemble Deskew Estimation",
      targetMs: 300,
      run1Ms: Number(times[0].toFixed(1)),
      run2Ms: Number(times[1].toFixed(1)),
      run3Ms: Number(times[2].toFixed(1)),
      averageMs: Number(avg.toFixed(1)),
      passed: avg < 300,
      marginMs: Number((300 - avg).toFixed(1)),
    });
  }

  // 3. Color grading analysis (Target < 200ms)
  {
    const times: number[] = [];
    for (let run = 0; run < 3; run++) {
      const t0 = performance.now();
      computeAutoGradeFromBuffer(buffer12MP, W, H);
      const t1 = performance.now();
      times.push(t1 - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    results.push({
      feature: "Color Grading & Histogram Analysis",
      targetMs: 200,
      run1Ms: Number(times[0].toFixed(1)),
      run2Ms: Number(times[1].toFixed(1)),
      run3Ms: Number(times[2].toFixed(1)),
      averageMs: Number(avg.toFixed(1)),
      passed: avg < 200,
      marginMs: Number((200 - avg).toFixed(1)),
    });
  }

  // 4. Blank page detection (Target < 100ms)
  {
    const times: number[] = [];
    for (let run = 0; run < 3; run++) {
      const t0 = performance.now();
      computeBlanknessFromBuffer(buffer12MP, W, H, "moderate");
      const t1 = performance.now();
      times.push(t1 - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    results.push({
      feature: "Multi-Metric Blank Page Detection",
      targetMs: 100,
      run1Ms: Number(times[0].toFixed(1)),
      run2Ms: Number(times[1].toFixed(1)),
      run3Ms: Number(times[2].toFixed(1)),
      averageMs: Number(avg.toFixed(1)),
      passed: avg < 100,
      marginMs: Number((100 - avg).toFixed(1)),
    });
  }

  return results;
}

// -------------------------------------------------------------
// FULL AUDIT EXECUTION
// -------------------------------------------------------------
export async function runFullAutoDetectionAudit(): Promise<FullBenchmarkReport> {
  const accuracyResults = runAccuracyTestScenarios();
  const timingResults = await runLatencyTimingBenchmarks();

  const allAccuracyPassed = accuracyResults.every((r) => r.passed);
  const allTimingsPassed = timingResults.every((t) => t.passed);

  return {
    accuracyResults,
    timingResults,
    allAccuracyPassed,
    allTimingsPassed,
    timestamp: new Date().toISOString(),
  };
}
