/**
 * OMNISCAN TITAN X - Enterprise Sample Document Generator
 * High-Resolution Realistic Scanned Artifacts for Instant Functional Verification
 */

import { OmniPage, ImageFilterPipeline } from "../types";
import { DEFAULT_FILTERS } from "../engine/vision";

function createPageCanvas(width = 1275, height = 1650): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not create canvas context");
  return { canvas, ctx };
}

/**
 * Generate Sample Page 1: Commercial Invoice
 */
export function generateSampleInvoicePage(): Partial<OmniPage> {
  const { canvas, ctx } = createPageCanvas();
  const w = canvas.width;
  const h = canvas.height;

  // Creamy paper background with slight corner scan gradient
  ctx.fillStyle = "#FAF9F6";
  ctx.fillRect(0, 0, w, h);

  // Left margin punch hole simulation shadows
  ctx.fillStyle = "rgba(40, 40, 40, 0.75)";
  ctx.beginPath();
  ctx.arc(35, h * 0.2, 16, 0, Math.PI * 2);
  ctx.arc(35, h * 0.5, 16, 0, Math.PI * 2);
  ctx.arc(35, h * 0.8, 16, 0, Math.PI * 2);
  ctx.fill();

  // Document Header
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 32px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("TITAN AERO-DYNAMICS CORP.", 100, 110);

  ctx.font = "500 15px 'Plus Jakarta Sans', sans-serif";
  ctx.fillStyle = "#64748B";
  ctx.fillText("100 Innovation Way, Enterprise Tower Suite 800 • Austin, TX 78701", 100, 140);
  ctx.fillText("Tax ID: US-74928103 • Tel: +1 (512) 882-9900 • billing@titanaero.com", 100, 165);

  // Accent Line
  ctx.strokeStyle = "#0284C7";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(100, 190);
  ctx.lineTo(w - 90, 190);
  ctx.stroke();

  // Invoice Information Badge
  ctx.fillStyle = "#F0FDF4";
  ctx.strokeStyle = "#86EFAC";
  ctx.lineWidth = 1.5;
  ctx.fillRect(w - 420, 70, 330, 95);
  ctx.strokeRect(w - 420, 70, 330, 95);

  ctx.fillStyle = "#166534";
  ctx.font = "bold 18px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("TAX INVOICE / BILLED", w - 400, 105);
  ctx.font = "600 14px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("Invoice #: INV-2026-TITAN-8842", w - 400, 130);
  ctx.font = "500 13px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("Issue Date: August 31, 2026", w - 400, 152);

  // Customer Block
  ctx.fillStyle = "#F8FAFC";
  ctx.strokeStyle = "#E2E8F0";
  ctx.fillRect(100, 220, w - 190, 110);
  ctx.strokeRect(100, 220, w - 190, 110);

  ctx.fillStyle = "#334155";
  ctx.font = "bold 14px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("BILL TO CUSTOMER ACCOUNT:", 125, 250);
  ctx.font = "600 16px 'Plus Jakarta Sans', sans-serif";
  ctx.fillStyle = "#0F172A";
  ctx.fillText("PACIFIC ORBITAL DEFENSE SYSTEMS LLC", 125, 275);
  ctx.font = "400 14px 'Plus Jakarta Sans', sans-serif";
  ctx.fillStyle = "#64748B";
  ctx.fillText("Attn: Accounts Payable | PO Reference: #PODS-2026-PO-4921", 125, 298);
  ctx.fillText("900 Harbor Boulevard, Dock 14, Seattle, WA 98101", 125, 318);

  // Line items table
  const tableY = 360;
  ctx.fillStyle = "#0F172A";
  ctx.fillRect(100, tableY, w - 190, 42);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 14px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("ITEM DESCRIPTION", 120, tableY + 26);
  ctx.fillText("QTY", 640, tableY + 26);
  ctx.fillText("UNIT PRICE", 780, tableY + 26);
  ctx.fillText("TOTAL (USD)", 990, tableY + 26);

  const items = [
    { desc: "Titan-X Autonomous Optical Scanner Rig (Dual-ADF, 1200 DPI)", qty: "2", unit: "$8,450.00", total: "$16,900.00" },
    { desc: "Computer Vision Pre-Processing Neural Chipset Module", qty: "4", unit: "$2,100.00", total: "$8,400.00" },
    { desc: "Enterprise Multi-Language OCR Engine License (Unlimited)", qty: "1", unit: "$14,500.00", total: "$14,500.00" },
    { desc: "Secure Document Shredding & Hardware Encryption Key Card", qty: "6", unit: "$450.00", total: "$2,700.00" },
    { desc: "Level-3 Archival Redaction & PDF/A Validation Compliance Kit", qty: "1", unit: "$3,800.00", total: "$3,800.00" },
  ];

  let currentY = tableY + 75;
  ctx.font = "400 14px 'Plus Jakarta Sans', sans-serif";

  items.forEach((item, idx) => {
    if (idx % 2 === 1) {
      ctx.fillStyle = "#F1F5F9";
      ctx.fillRect(100, currentY - 22, w - 190, 36);
    }
    ctx.fillStyle = "#1E293B";
    ctx.fillText(item.desc, 120, currentY);
    ctx.fillText(item.qty, 650, currentY);
    ctx.fillText(item.unit, 780, currentY);
    ctx.fillText(item.total, 990, currentY);
    currentY += 46;
  });

  // Summary Totals Box
  currentY += 20;
  ctx.fillStyle = "#F8FAFC";
  ctx.strokeStyle = "#CBD5E1";
  ctx.fillRect(w - 520, currentY, 430, 160);
  ctx.strokeRect(w - 520, currentY, 430, 160);

  ctx.fillStyle = "#475569";
  ctx.font = "500 14px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("Subtotal (Gross):", w - 490, currentY + 35);
  ctx.fillText("$46,300.00", w - 210, currentY + 35);

  ctx.fillText("State Sales Tax (8.25%):", w - 490, currentY + 70);
  ctx.fillText("$3,819.75", w - 210, currentY + 70);

  ctx.fillText("Early Settlement Discount:", w - 490, currentY + 105);
  ctx.fillText("-$1,200.00", w - 210, currentY + 105);

  ctx.strokeStyle = "#0284C7";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w - 490, currentY + 120);
  ctx.lineTo(w - 110, currentY + 120);
  ctx.stroke();

  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 18px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("Total Balance Due:", w - 490, currentY + 145);
  ctx.fillStyle = "#0284C7";
  ctx.fillText("$48,919.75", w - 210, currentY + 145);

  // Bank wire instructions
  ctx.fillStyle = "#334155";
  ctx.font = "bold 14px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("REMITTANCE WIRE INSTRUCTIONS:", 100, currentY + 35);
  ctx.font = "400 13px 'Plus Jakarta Sans', sans-serif";
  ctx.fillStyle = "#64748B";
  ctx.fillText("Bank: Silicon Horizon Trust (Routing: 121000358)", 100, currentY + 60);
  ctx.fillText("Account #: 9948-2810-4921 | Swift: SITHUS33", 100, currentY + 82);
  ctx.fillText("Payment Terms: Net 30 Days | Overdue interest: 1.5%/month", 100, currentY + 104);

  // Signature and Stamp
  ctx.fillStyle = "#1E293B";
  ctx.font = "italic 22px serif";
  ctx.fillText("Marcus Sterling, Chief Financial Officer", 100, h - 140);
  ctx.font = "500 13px 'Plus Jakarta Sans', sans-serif";
  ctx.fillStyle = "#94A3B8";
  ctx.fillText("Authorized Signatory • Electronic Document Verification ID: #TITAN-VERIFIED-9812", 100, h - 110);

  // Official Seal Stamp Simulation
  ctx.save();
  ctx.translate(w - 240, h - 170);
  ctx.rotate(-0.12);
  ctx.strokeStyle = "rgba(220, 38, 38, 0.75)";
  ctx.lineWidth = 3;
  ctx.strokeRect(-90, -40, 180, 80);
  ctx.strokeRect(-84, -34, 168, 68);
  ctx.fillStyle = "rgba(220, 38, 38, 0.85)";
  ctx.font = "bold 18px 'Cinzel', serif";
  ctx.textAlign = "center";
  ctx.fillText("TITAN AERO", 0, -8);
  ctx.font = "bold 12px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("★ AUDITED & CERTIFIED ★", 0, 14);
  ctx.restore();

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

  return {
    id: "sample-page-1",
    pageNumber: 1,
    originalDataUrl: dataUrl,
    processedDataUrl: dataUrl,
    thumbnailDataUrl: dataUrl,
    width: w,
    height: h,
    dpi: 300,
    sizeBytes: Math.round(dataUrl.length * 0.75),
    isBlank: false,
    blankScore: 0,
    filters: { ...DEFAULT_FILTERS },
    annotations: [],
    redactions: [
      {
        id: "red-sample-1",
        x: 0.14,
        y: 0.585,
        width: 0.18,
        height: 0.018,
        reason: "Financial Routing Number",
        label: "CONFIDENTIAL",
        color: "#000000",
        isPermanent: false,
      },
    ],
    formFields: [],
    isModified: false,
    lastModifiedAt: new Date().toISOString(),
  };
}

/**
 * Generate Sample Page 2: Legal Master Services Agreement
 */
export function generateSampleContractPage(): Partial<OmniPage> {
  const { canvas, ctx } = createPageCanvas();
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = "#FCFBF8";
  ctx.fillRect(0, 0, w, h);

  // Punch holes
  ctx.fillStyle = "rgba(45, 45, 45, 0.8)";
  ctx.beginPath();
  ctx.arc(35, h * 0.25, 15, 0, Math.PI * 2);
  ctx.arc(35, h * 0.75, 15, 0, Math.PI * 2);
  ctx.fill();

  // Header Title
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 26px 'Cinzel', serif";
  ctx.textAlign = "center";
  ctx.fillText("MASTER ENTERPRISE SERVICE & N.D.A. AGREEMENT", w / 2, 100);

  ctx.font = "500 13px 'Plus Jakarta Sans', sans-serif";
  ctx.fillStyle = "#64748B";
  ctx.fillText("DOCUMENT REFERENCE: #LEGAL-2026-MSA-7719B • CLASSIFICATION: HIGHLY CONFIDENTIAL", w / 2, 130);

  ctx.textAlign = "left";
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(90, 150);
  ctx.lineTo(w - 90, 150);
  ctx.stroke();

  // Agreement Clauses
  const paragraphs = [
    "THIS MASTER SERVICES AGREEMENT (the 'Agreement') is entered into as of August 31, 2026 (the 'Effective Date'), by and between TITAN INTELLIGENCE TECHNOLOGIES INC. ('Provider'), a Delaware corporation having its principal office at Cambridge, MA, and STRATOS GLOBAL HOLDINGS LLC ('Client'), having its headquarters in Geneva, Switzerland.",
    "WHEREAS, Provider specializes in autonomous optical character recognition, high-throughput document intelligence pipelines, computer vision deskew algorithms, and compliant PDF/A archival processing systems;",
    "NOW, THEREFORE, in consideration of the mutual covenants contained herein and other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties hereby agree as follows:",
    "1. SCOPE OF AUTONOMOUS PROCESSING. Provider shall furnish to Client the complete OmniScan Titan X suite, including local non-destructive image filters, offline OCR inference nodes, and automated batch workflow scripting infrastructure.",
    "2. DATA PRIVACY & ZERO-RETENTION GUARANTEE. Under no circumstances shall document source imagery, OCR layout coordinates, or unencrypted metadata packets be transmitted to unauthorized external endpoints. All core intelligence processing executes locally within client sandboxed memory.",
    "3. REDACTION INTEGRITY & COMPLIANCE. When redaction is applied by Client, Provider's PDF engine shall destructively flatten underlying raster pixels and permanently strip vector glyph nodes, ensuring zero recovery in accordance with NIST SP 800-88 standards.",
    "4. INTELLECTUAL PROPERTY & INDEMNIFICATION. Client retains sole and unencumbered ownership of all digitized assets, extracted semantic schemas, and derived training weights generated during local operations.",
    "5. TERM & TERMINATION. This Agreement shall commence on the Effective Date and shall continue in full force for an initial period of thirty-six (36) consecutive months unless terminated earlier pursuant to the breach provisions outlined in Section 8.",
  ];

  let textY = 190;
  ctx.font = "400 14px/1.6 'Plus Jakarta Sans', sans-serif";
  ctx.fillStyle = "#1E293B";

  paragraphs.forEach((p) => {
    // Word wrap paragraph to 1050px width
    const words = p.split(" ");
    let line = "";
    const maxWidth = w - 190;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, 95, textY);
        line = words[n] + " ";
        textY += 24;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 95, textY);
    textY += 32;
  });

  // Signature Lines Block
  textY += 40;
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 15px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("IN WITNESS WHEREOF, the parties hereto have executed this Agreement by their duly authorized representatives.", 95, textY);

  textY += 70;
  // Party 1
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(95, textY);
  ctx.lineTo(450, textY);
  ctx.stroke();

  ctx.fillStyle = "#1E293B";
  ctx.font = "italic 20px serif";
  ctx.fillText("Dr. Jonathan Vance", 100, textY - 12);
  ctx.font = "500 13px 'Plus Jakarta Sans', sans-serif";
  ctx.fillStyle = "#64748B";
  ctx.fillText("TITAN INTELLIGENCE TECHNOLOGIES INC.", 95, textY + 22);
  ctx.fillText("Title: Chief Executive Officer & Director", 95, textY + 42);

  // Party 2
  ctx.beginPath();
  ctx.moveTo(w - 460, textY);
  ctx.lineTo(w - 105, textY);
  ctx.stroke();

  ctx.fillStyle = "#1E293B";
  ctx.font = "italic 20px serif";
  ctx.fillText("Claire Beaumont", w - 450, textY - 12);
  ctx.font = "500 13px 'Plus Jakarta Sans', sans-serif";
  ctx.fillStyle = "#64748B";
  ctx.fillText("STRATOS GLOBAL HOLDINGS LLC", w - 460, textY + 22);
  ctx.fillText("Title: Senior Managing Partner", w - 460, textY + 42);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

  return {
    id: "sample-page-2",
    pageNumber: 2,
    originalDataUrl: dataUrl,
    processedDataUrl: dataUrl,
    thumbnailDataUrl: dataUrl,
    width: w,
    height: h,
    dpi: 300,
    sizeBytes: Math.round(dataUrl.length * 0.75),
    isBlank: false,
    blankScore: 0,
    filters: { ...DEFAULT_FILTERS },
    annotations: [
      {
        id: "ann-sample-1",
        type: "highlight",
        x: 0.075,
        y: 0.355,
        width: 0.85,
        height: 0.045,
        strokeColor: "#FBBF24",
        opacity: 0.38,
        strokeWidth: 1,
        createdAt: new Date().toISOString(),
      },
    ],
    redactions: [],
    formFields: [],
    isModified: false,
    lastModifiedAt: new Date().toISOString(),
  };
}

/**
 * Generate Complete Initial OmniScan Document
 */
export function createInitialSampleDocument(): OmniPage[] {
  const p1 = generateSampleInvoicePage() as OmniPage;
  const p2 = generateSampleContractPage() as OmniPage;
  return [p1, p2];
}
