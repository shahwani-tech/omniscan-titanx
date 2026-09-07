/**
 * OMNISCAN TITAN X - Enterprise Desktop & Native Printing System
 * Types & Schemas for Native Printer Discovery, DEVMODE Overrides, and Print Pipeline
 */

import { OmniDocument } from "./index";

export type PrinterOnlineState = "online" | "offline" | "busy" | "error" | "paused" | "unknown";

export interface InstalledPrinter {
  name: string;
  displayName: string;
  isDefault: boolean;
  status: PrinterOnlineState;
  statusText?: string;
  isOnline: boolean;
  driverName?: string;
  portName?: string;
  isNetwork?: boolean;
  isVirtual?: boolean;
  location?: string;
  comment?: string;
  capabilities?: PrinterCapabilities;
}

export interface PaperSizeOption {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  widthInches: number;
  heightInches: number;
}

export interface PrinterCapabilities {
  paperSizes: PaperSizeOption[];
  supportedOrientations: ("portrait" | "landscape")[];
  supportsColor: boolean;
  supportsGrayscale: boolean;
  supportsDuplex: boolean;
  duplexModes: ("none" | "long-edge" | "short-edge")[];
  supportsQuality: boolean;
  qualityOptions: ("draft" | "normal" | "high")[];
  supportsBorderless: boolean;
  supportsCustomMargins: boolean;
  minMarginsMm: { top: number; right: number; bottom: number; left: number };
  resolutionsDpi: number[];
  paperSources: string[];
  maxCopies: number;
}

/**
 * Temporary Driver Preferences (DEVMODE Cloned Configuration)
 * These settings apply strictly to the active print job and do NOT permanently
 * alter the user's system-level Windows default printer settings.
 */
export interface TemporaryDriverPreferences {
  quality: "draft" | "normal" | "high";
  mediaType: "plain" | "photo-glossy" | "photo-matte" | "cardstock" | "envelope" | "auto";
  paperSource: string;
  resolutionDpi: number;
  borderless: boolean;
  colorManagement: "driver" | "icm" | "app";
  inkSaving: boolean;
  customDriverSettings?: Record<string, string | number | boolean>;
  isTemporary: boolean;
}

export interface PrintSettings {
  printerName: string;
  copies: number;
  collate: boolean;
  paperSizeId: string;
  orientation: "portrait" | "landscape";
  colorMode: "color" | "grayscale";
  quality: "draft" | "normal" | "high";
  scaling: "actual" | "fit" | "fill" | "custom";
  customScalePercent: number; // 25 to 400
  centerHorizontally: boolean;
  centerVertically: boolean;
  marginType: "none" | "normal" | "narrow" | "custom";
  customMarginsMm: { top: number; right: number; bottom: number; left: number };
  pageRangeMode: "all" | "current" | "custom" | "odd" | "even";
  customPageRange: string; // e.g. "1-3, 5"
  duplex: "none" | "long-edge" | "short-edge";
  paperSource: string;
  borderless: boolean;
  printBackground: boolean;
  cuttingGuides: boolean;
  cropMarks: boolean;
  bleedMm: number;
  imageInterpolation: "high" | "smooth" | "fast";
  temporaryPreferences: TemporaryDriverPreferences;
}

export type PrintPayloadType =
  | "document"
  | "photo-sheet"
  | "idcard-sheet"
  | "a6-card"
  | "canvases"
  | "images";

export interface PrintPageItem {
  pageIndex: number;
  dataUrl: string;
  widthMm: number;
  heightMm: number;
  label?: string;
}

export interface PrintJobPayload {
  type: PrintPayloadType;
  title: string;
  document?: OmniDocument;
  activePageIndex?: number;
  selectedPageIds?: string[];
  pages?: PrintPageItem[];
  canvases?: HTMLCanvasElement[];
  images?: Array<{
    url: string;
    widthMm?: number;
    heightMm?: number;
  }>;
  metadata?: Record<string, any>;
  defaultPaperSize?: string;
  defaultOrientation?: "portrait" | "landscape";
  hasCuttingGuides?: boolean;
}

export type PrintJobState =
  | "idle"
  | "enumerating"
  | "preparing-preview"
  | "ready"
  | "submitting"
  | "spooling"
  | "printing"
  | "completed"
  | "cancelled"
  | "failed";

export interface PrintJobStatus {
  id: string;
  state: PrintJobState;
  progressPercent: number;
  message: string;
  error?: string;
  printerName?: string;
  jobId?: number | string;
  startedAt?: string;
  completedAt?: string;
}

export interface NativePrintBridgeAPI {
  isDesktop: boolean;
  platform: "win32" | "darwin" | "linux" | "browser";
  getPrinters: () => Promise<InstalledPrinter[]>;
  getPrinterCapabilities: (printerName: string) => Promise<PrinterCapabilities>;
  openPrinterPreferences: (printerName: string) => Promise<{ success: boolean; message?: string }>;
  applyTemporaryDevMode: (printerName: string, prefs: TemporaryDriverPreferences) => Promise<{ success: boolean }>;
  submitPrintJob: (job: {
    printerName: string;
    settings: PrintSettings;
    pages: PrintPageItem[];
  }) => Promise<{ success: boolean; jobId: string | number; message?: string }>;
  restorePrinterPreferences: (printerName: string) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    desktopPrintBridge?: NativePrintBridgeAPI;
  }
}
