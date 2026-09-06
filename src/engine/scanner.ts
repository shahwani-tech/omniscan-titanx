/**
 * OMNISCAN TITAN X - Enterprise Scanner Abstraction & Acquisition Engine
 * Hardware TWAIN/WIA Bridge, Camera Document Capture & High-Speed Feeder Simulator
 */

import { ScannerProfile, OmniPage } from "../types";
import { processImagePipeline, DEFAULT_FILTERS } from "./vision";

export const DEFAULT_SCANNER_PROFILES: ScannerProfile[] = [
  {
    id: "profile-standard-color",
    name: "Color Document (300 DPI)",
    source: "flatbed",
    colorMode: "color",
    dpi: 300,
    pageSize: "letter",
    brightness: 0,
    contrast: 0,
    autoDeskew: true,
    autoCrop: true,
    removeBlankPages: true,
    blankSensitivity: 0.85,
    duplexFlip: "long-edge",
  },
  {
    id: "profile-high-speed-adf",
    name: "High-Speed ADF Duplex (B&W)",
    source: "duplex",
    colorMode: "monochrome",
    dpi: 300,
    pageSize: "auto",
    brightness: 5,
    contrast: 15,
    autoDeskew: true,
    autoCrop: true,
    removeBlankPages: true,
    blankSensitivity: 0.9,
    duplexFlip: "long-edge",
  },
  {
    id: "profile-archival-photo",
    name: "Archival Precision (600 DPI)",
    source: "flatbed",
    colorMode: "color",
    dpi: 600,
    pageSize: "a4",
    brightness: 0,
    contrast: 0,
    autoDeskew: false,
    autoCrop: false,
    removeBlankPages: false,
    blankSensitivity: 0.5,
    duplexFlip: "long-edge",
  },
  {
    id: "profile-mobile-camera",
    name: "Live Camera Document Scanner",
    source: "camera",
    colorMode: "color",
    dpi: 300,
    pageSize: "auto",
    brightness: 0,
    contrast: 10,
    autoDeskew: true,
    autoCrop: true,
    removeBlankPages: false,
    blankSensitivity: 0.7,
    duplexFlip: "long-edge",
  },
];

export const SCANNER_PROFILES = DEFAULT_SCANNER_PROFILES;

/**
 * Simulate an Automated Document Feeder (ADF) multi-page scanning session
 */
export async function simulateScannerFeed(
  profile: ScannerProfile,
  pageCount = 3
): Promise<OmniPage[]> {
  const pages: OmniPage[] = [];
  for (let i = 0; i < pageCount; i++) {
    const partial = await acquireSimulatedScan(profile, i);
    pages.push({
      ...partial,
      id: `scan-${Date.now()}-${i}`,
      pageNumber: i + 1,
      isModified: false,
      lastModifiedAt: new Date().toISOString(),
    } as OmniPage);
  }
  return pages;
}

/**
 * Capture a frame from an active HTMLVideoElement
 */
export async function captureCameraFrame(
  videoElement: HTMLVideoElement,
  profile: ScannerProfile
): Promise<Partial<OmniPage>> {
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth || 1920;
  canvas.height = videoElement.videoHeight || 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create camera capture canvas");

  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  const rawDataUrl = canvas.toDataURL("image/jpeg", 0.95);

  const filters = {
    ...DEFAULT_FILTERS,
    colorMode: profile.colorMode,
    brightness: profile.brightness,
    contrast: profile.contrast,
    backgroundWhiten: true,
    shadowRemoval: true,
  };

  const processed = await processImagePipeline(rawDataUrl, filters);

  return {
    originalDataUrl: rawDataUrl,
    processedDataUrl: processed.processedDataUrl,
    thumbnailDataUrl: processed.thumbnailDataUrl,
    width: processed.width,
    height: processed.height,
    dpi: profile.dpi,
    sizeBytes: Math.round(processed.processedDataUrl.length * 0.75),
    isBlank: processed.isBlank,
    blankScore: processed.blankScore,
    filters,
    annotations: [],
    redactions: [],
    formFields: [],
  };
}

/**
 * Generate high-fidelity realistic scan target (for instant hardware preview testing)
 */
export async function acquireSimulatedScan(
  profile: ScannerProfile,
  pageIndex = 0
): Promise<Partial<OmniPage>> {
  const canvas = document.createElement("canvas");
  // Standard Letter at 300 DPI = 2550 x 3300 px
  const scale = profile.dpi / 150;
  canvas.width = Math.floor(1275 * scale);
  canvas.height = Math.floor(1650 * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context failed");

  // Subtle paper grain background
  ctx.fillStyle = "#FCFCF9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Slight scanner edge shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
  ctx.fillRect(0, 0, 18 * scale, canvas.height);

  // Add realistic header and document typography
  ctx.fillStyle = "#1E293B";
  ctx.font = `bold ${28 * scale}px sans-serif`;
  ctx.fillText("TITAN GLOBAL ENTERPRISES INC.", 60 * scale, 120 * scale);

  ctx.font = `500 ${14 * scale}px sans-serif`;
  ctx.fillStyle = "#64748B";
  ctx.fillText("770 Technology Parkway, Suite 400 • Cambridge, MA 02142", 60 * scale, 155 * scale);
  ctx.fillText("Tax ID: US-994820194 • ISO-9001 Document Control", 60 * scale, 180 * scale);

  // Decorative Rule
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(60 * scale, 210 * scale);
  ctx.lineTo(canvas.width - 60 * scale, 210 * scale);
  ctx.stroke();

  // Invoice Details Box
  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(60 * scale, 240 * scale, canvas.width - 120 * scale, 130 * scale);
  ctx.strokeRect(60 * scale, 240 * scale, canvas.width - 120 * scale, 130 * scale);

  ctx.fillStyle = "#0F172A";
  ctx.font = `bold ${18 * scale}px sans-serif`;
  ctx.fillText(`COMMERCIAL INVOICE #TITAN-2026-${1000 + pageIndex}`, 85 * scale, 280 * scale);

  ctx.font = `400 ${14 * scale}px sans-serif`;
  ctx.fillStyle = "#334155";
  ctx.fillText(`Issued: 2026-08-31   |   Due Date: 2026-09-30   |   Currency: USD ($)`, 85 * scale, 315 * scale);
  ctx.fillText(`Customer Account: ACME LOGISTICS GLOBAL (REF: #PO-88192)`, 85 * scale, 345 * scale);

  // Table header
  const tableY = 410 * scale;
  ctx.fillStyle = "#0F172A";
  ctx.fillRect(60 * scale, tableY, canvas.width - 120 * scale, 40 * scale);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${13 * scale}px sans-serif`;
  ctx.fillText("ITEM DESCRIPTION", 80 * scale, tableY + 25 * scale);
  ctx.fillText("QTY", 650 * scale, tableY + 25 * scale);
  ctx.fillText("UNIT RATE", 800 * scale, tableY + 25 * scale);
  ctx.fillText("TOTAL AMOUNT", 1000 * scale, tableY + 25 * scale);

  // Table rows
  const rows = [
    { desc: "High-Throughput Optical Scanning Cluster Module", qty: "4", rate: "$1,450.00", total: "$5,800.00" },
    { desc: "Titan Vision AI Neural Inference Engine License (Enterprise)", qty: "1", rate: "$12,500.00", total: "$12,500.00" },
    { desc: "Automated ADF Feeder Hardware Calibrator & Sensor Kit", qty: "2", rate: "$820.00", total: "$1,640.00" },
    { desc: "24/7 Priority Archival & Compliance Support SLA", qty: "12", rate: "$350.00", total: "$4,200.00" },
  ];

  let currentY = tableY + 70 * scale;
  ctx.font = `400 ${13 * scale}px sans-serif`;
  ctx.fillStyle = "#1E293B";

  rows.forEach((r, idx) => {
    if (idx % 2 === 1) {
      ctx.fillStyle = "#F1F5F9";
      ctx.fillRect(60 * scale, currentY - 20 * scale, canvas.width - 120 * scale, 35 * scale);
    }
    ctx.fillStyle = "#1E293B";
    ctx.fillText(r.desc, 80 * scale, currentY);
    ctx.fillText(r.qty, 660 * scale, currentY);
    ctx.fillText(r.rate, 800 * scale, currentY);
    ctx.fillText(r.total, 1000 * scale, currentY);
    currentY += 45 * scale;
  });

  // Totals Box
  currentY += 30 * scale;
  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(750 * scale, currentY, 465 * scale, 140 * scale);
  ctx.strokeRect(750 * scale, currentY, 465 * scale, 140 * scale);

  ctx.font = `500 ${13 * scale}px sans-serif`;
  ctx.fillStyle = "#475569";
  ctx.fillText("Subtotal:", 770 * scale, currentY + 35 * scale);
  ctx.fillText("$24,140.00", 1080 * scale, currentY + 35 * scale);

  ctx.fillText("Sales Tax (6.25%):", 770 * scale, currentY + 65 * scale);
  ctx.fillText("$1,508.75", 1080 * scale, currentY + 65 * scale);

  ctx.font = `bold ${16 * scale}px sans-serif`;
  ctx.fillStyle = "#0F172A";
  ctx.fillText("Total Balance Due:", 770 * scale, currentY + 110 * scale);
  ctx.fillText("$25,648.75", 1060 * scale, currentY + 110 * scale);

  // Security barcode / QR block
  ctx.fillStyle = "#1E293B";
  for (let b = 0; b < 45; b++) {
    const bw = (b % 3 === 0 ? 4 : 2) * scale;
    ctx.fillRect(80 * scale + b * 7 * scale, canvas.height - 180 * scale, bw, 45 * scale);
  }
  ctx.font = `400 ${11 * scale}px monospace`;
  ctx.fillText("*DOC-TITAN-X-VERIFIED-SECURE*", 80 * scale, canvas.height - 120 * scale);

  // Signature Block
  ctx.font = `italic ${18 * scale}px serif`;
  ctx.fillStyle = "#1D4ED8";
  ctx.fillText("Eleanor Vance, VP Finance", 800 * scale, canvas.height - 150 * scale);
  ctx.font = `400 ${12 * scale}px sans-serif`;
  ctx.fillStyle = "#64748B";
  ctx.fillText("Authorized Corporate Officer", 800 * scale, canvas.height - 125 * scale);

  const rawDataUrl = canvas.toDataURL("image/jpeg", 0.95);

  const filters = {
    ...DEFAULT_FILTERS,
    colorMode: profile.colorMode,
    brightness: profile.brightness,
    contrast: profile.contrast,
  };

  const processed = await processImagePipeline(rawDataUrl, filters);

  return {
    originalDataUrl: rawDataUrl,
    processedDataUrl: processed.processedDataUrl,
    thumbnailDataUrl: processed.thumbnailDataUrl,
    width: processed.width,
    height: processed.height,
    dpi: profile.dpi,
    sizeBytes: Math.round(processed.processedDataUrl.length * 0.75),
    isBlank: false,
    blankScore: 0,
    filters,
    annotations: [],
    redactions: [],
    formFields: [],
  };
}
