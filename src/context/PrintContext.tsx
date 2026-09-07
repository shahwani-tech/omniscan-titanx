/**
 * OMNISCAN TITAN X - Centralized Print Context & Command Registry
 * Connects every tool, command, and shortcut to the unified print system.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  InstalledPrinter,
  PrinterCapabilities,
  PrintSettings,
  PrintJobPayload,
  PrintJobStatus,
  TemporaryDriverPreferences,
} from "../types/print";
import { printerService } from "../services/print/PrinterService";
import { printPreviewRenderer, RenderedPreviewPage } from "../services/print/PrintPreviewRenderer";
import { DEFAULT_PRINT_SETTINGS, DEFAULT_TEMPORARY_PREFERENCES } from "../services/print/constants";
import { nativePrintBridge } from "../services/print/NativePrintBridge";

interface PrintContextValue {
  isOpen: boolean;
  openPrintDialog: (payload: PrintJobPayload) => void;
  closePrintDialog: () => void;
  payload: PrintJobPayload | null;

  // Printer List & Selection
  installedPrinters: InstalledPrinter[];
  selectedPrinter: InstalledPrinter | null;
  selectedPrinterName: string;
  setSelectedPrinterName: (name: string) => void;
  refreshPrinters: () => Promise<void>;
  isLoadingPrinters: boolean;

  // Capabilities & Preferences
  capabilities: PrinterCapabilities | null;
  temporaryPreferences: TemporaryDriverPreferences;
  updateTemporaryPreferences: (overrides: Partial<TemporaryDriverPreferences>) => void;
  openNativePreferences: () => Promise<{ success: boolean; message?: string }>;

  // Settings
  printSettings: PrintSettings;
  updatePrintSettings: (overrides: Partial<PrintSettings>) => void;

  // Real Preview Engine & Navigation
  renderedPages: RenderedPreviewPage[];
  isPreviewLoading: boolean;
  refreshPreview: () => Promise<void>;
  activePreviewIndex: number;
  setActivePreviewIndex: React.Dispatch<React.SetStateAction<number>>;
  previewZoom: number;
  setPreviewZoom: React.Dispatch<React.SetStateAction<number>>;
  zoomIn: () => void;
  zoomOut: () => void;
  fitPage: () => void;
  actualSize: () => void;
  nextPage: () => void;
  prevPage: () => void;

  // Execution & Job Status
  jobStatus: PrintJobStatus;
  submitPrint: () => Promise<void>;
  cancelJob: () => void;

  // Bridge Environment
  bridgeMode: "electron" | "local-server" | "browser-fallback";
  isDesktop: boolean;
}

const PrintContext = createContext<PrintContextValue | null>(null);

const STORAGE_KEY_DEFAULT_PRINTER = "omniscan_titanx_last_printer";

export const PrintProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [payload, setPayload] = useState<PrintJobPayload | null>(null);

  const [installedPrinters, setInstalledPrinters] = useState<InstalledPrinter[]>([]);
  const [selectedPrinterName, setSelectedPrinterNameState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_DEFAULT_PRINTER) || "";
    } catch {
      return "";
    }
  });
  const [isLoadingPrinters, setIsLoadingPrinters] = useState<boolean>(false);
  const [capabilities, setCapabilities] = useState<PrinterCapabilities | null>(null);

  const [printSettings, setPrintSettings] = useState<PrintSettings>({ ...DEFAULT_PRINT_SETTINGS });
  const [temporaryPreferences, setTemporaryPreferencesState] = useState<TemporaryDriverPreferences>({
    ...DEFAULT_TEMPORARY_PREFERENCES,
  });

  const [renderedPages, setRenderedPages] = useState<RenderedPreviewPage[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(0);
  const [previewZoom, setPreviewZoom] = useState<number>(1.0);

  const [jobStatus, setJobStatus] = useState<PrintJobStatus>({
    id: "",
    state: "idle",
    progressPercent: 0,
    message: "Ready to print.",
  });

  const bridgeMode = nativePrintBridge.bridgeMode;
  const isDesktop = nativePrintBridge.isDesktop;

  // Active printer object
  const selectedPrinter =
    installedPrinters.find((p) => p.name === selectedPrinterName) || installedPrinters[0] || null;

  // 1. Refresh & Load System Printers
  const refreshPrinters = useCallback(async () => {
    setIsLoadingPrinters(true);
    try {
      const printers = await printerService.loadPrinters();
      setInstalledPrinters(printers);

      if (printers.length > 0) {
        setSelectedPrinterNameState((curr) => {
          if (curr && printers.some((p) => p.name === curr)) return curr;
          const defaultPrinter = printers.find((p) => p.isDefault) || printers.find((p) => p.isOnline) || printers[0];
          try {
            localStorage.setItem(STORAGE_KEY_DEFAULT_PRINTER, defaultPrinter.name);
          } catch {}
          return defaultPrinter.name;
        });
      }
    } catch (err) {
      console.error("Failed to load printers:", err);
    } finally {
      setIsLoadingPrinters(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    refreshPrinters();
  }, [refreshPrinters]);

  // 2. Synchronize Capabilities when selected printer changes
  useEffect(() => {
    if (!selectedPrinterName) return;

    let isMounted = true;
    printerService.getCapabilities(selectedPrinterName).then((caps) => {
      if (!isMounted) return;
      setCapabilities(caps);

      // Adapt settings to printer capabilities (Requirement 9)
      setPrintSettings((prev) => {
        const next = { ...prev, printerName: selectedPrinterName };

        // If duplex is not supported by new printer, disable duplex
        if (!caps.supportsDuplex && next.duplex !== "none") {
          next.duplex = "none";
        }
        // If color is not supported by new printer, switch to grayscale
        if (!caps.supportsColor && next.colorMode === "color") {
          next.colorMode = "grayscale";
        }
        // If paper size is not in supported list, fallback to first available
        if (caps.paperSizes.length > 0 && !caps.paperSizes.some((p) => p.id === next.paperSizeId)) {
          next.paperSizeId = caps.paperSizes[0].id;
        }

        return next;
      });

      // Load temporary preferences for this printer
      const currentTemp = printerService.getTemporaryPreferences(selectedPrinterName);
      setTemporaryPreferencesState(currentTemp);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedPrinterName]);

  // 3. Render Real Preview
  const refreshPreview = useCallback(async () => {
    if (!payload) return;
    setIsPreviewLoading(true);
    try {
      const pages = await printPreviewRenderer.renderPreviewPages(payload, printSettings, 150);
      setRenderedPages(pages);
      setActivePreviewIndex((curr) => (curr >= pages.length ? Math.max(0, pages.length - 1) : curr));
    } catch (err) {
      console.error("Preview render failed:", err);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [payload, printSettings]);

  // Trigger preview update when settings or payload change
  useEffect(() => {
    if (isOpen && payload) {
      const timer = setTimeout(() => {
        refreshPreview();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isOpen, payload, printSettings, refreshPreview]);

  // Zoom & Page Navigation Helpers
  const zoomIn = useCallback(() => {
    setPreviewZoom((prev) => Math.min(3.0, Number((prev + 0.15).toFixed(2))));
  }, []);

  const zoomOut = useCallback(() => {
    setPreviewZoom((prev) => Math.max(0.3, Number((prev - 0.15).toFixed(2))));
  }, []);

  const fitPage = useCallback(() => {
    setPreviewZoom(0.85);
  }, []);

  const actualSize = useCallback(() => {
    setPreviewZoom(1.0);
  }, []);

  const nextPage = useCallback(() => {
    setActivePreviewIndex((prev) => (renderedPages.length > 0 ? (prev + 1) % renderedPages.length : 0));
  }, [renderedPages.length]);

  const prevPage = useCallback(() => {
    setActivePreviewIndex((prev) => (renderedPages.length > 0 ? (prev - 1 + renderedPages.length) % renderedPages.length : 0));
  }, [renderedPages.length]);

  // 4. Open Centralized Print Dialog
  const openPrintDialog = useCallback(
    (newPayload: PrintJobPayload) => {
      setPayload(newPayload);
      setActivePreviewIndex(0);
      setPreviewZoom(1.0);

      // Seed default orientation and paper size if specified by payload
      setPrintSettings((prev) => ({
        ...prev,
        paperSizeId: newPayload.defaultPaperSize || prev.paperSizeId || "a4",
        orientation: newPayload.defaultOrientation || prev.orientation || "portrait",
        cuttingGuides: Boolean(newPayload.hasCuttingGuides),
      }));

      setJobStatus({
        id: "",
        state: "ready",
        progressPercent: 0,
        message: "Review layout preview and print settings.",
      });

      setIsOpen(true);
      refreshPrinters();
    },
    [refreshPrinters]
  );

  // Global event listener for decoupled tool modules
  useEffect(() => {
    const handleCustomPrintEvent = (e: Event) => {
      const customEvent = e as CustomEvent<PrintJobPayload>;
      if (customEvent.detail) {
        openPrintDialog(customEvent.detail);
      }
    };
    window.addEventListener("omniscan:open-print-dialog", handleCustomPrintEvent);
    return () => {
      window.removeEventListener("omniscan:open-print-dialog", handleCustomPrintEvent);
    };
  }, [openPrintDialog]);

  // 5. Close Dialog & Cleanup Temporary Preferences
  const closePrintDialog = useCallback(() => {
    if (selectedPrinterName) {
      printerService.cancelJobSession(selectedPrinterName);
    }
    setIsOpen(false);
    setPayload(null);
    setRenderedPages([]);
    setJobStatus({
      id: "",
      state: "idle",
      progressPercent: 0,
      message: "Ready to print.",
    });
  }, [selectedPrinterName]);

  // 6. Change Selected Printer
  const setSelectedPrinterName = useCallback((name: string) => {
    setSelectedPrinterNameState(name);
    try {
      localStorage.setItem(STORAGE_KEY_DEFAULT_PRINTER, name);
    } catch {}
    setPrintSettings((prev) => ({ ...prev, printerName: name }));
  }, []);

  // 7. Update Print Settings
  const updatePrintSettings = useCallback((overrides: Partial<PrintSettings>) => {
    setPrintSettings((prev) => ({ ...prev, ...overrides }));
  }, []);

  // 8. Update Temporary Driver Preferences
  const updateTemporaryPreferences = useCallback(
    (overrides: Partial<TemporaryDriverPreferences>) => {
      if (!selectedPrinterName) return;
      const updated = printerService.updateTemporaryPreferences(selectedPrinterName, overrides);
      setTemporaryPreferencesState(updated);
      setPrintSettings((prev) => ({
        ...prev,
        quality: overrides.quality || prev.quality,
        borderless: overrides.borderless !== undefined ? overrides.borderless : prev.borderless,
      }));
    },
    [selectedPrinterName]
  );

  // 9. Open Native Printer Preferences Dialog
  const openNativePreferences = useCallback(async () => {
    if (!selectedPrinterName) {
      return { success: false, message: "No printer selected." };
    }
    return await printerService.openPrinterPreferences(selectedPrinterName);
  }, [selectedPrinterName]);

  // 10. Final Print Job Submission
  const submitPrint = useCallback(async () => {
    if (!payload || !selectedPrinterName) return;

    try {
      setJobStatus({
        id: `job_${Date.now()}`,
        state: "preparing-preview",
        progressPercent: 15,
        message: "Rendering high-resolution 300 DPI print pages...",
      });

      // 1. Render high-res 300 DPI source pages
      const finalPages = await printPreviewRenderer.renderFinalPrintPages(payload, printSettings);

      setJobStatus((prev) => ({
        ...prev,
        state: "spooling",
        progressPercent: 50,
        message: `Spooling to "${selectedPrinterName}" with temporary per-job DEVMODE configuration...`,
      }));

      // 2. Submit to Native Bridge
      const result = await printerService.submitPrintJob({
        printerName: selectedPrinterName,
        settings: printSettings,
        pages: finalPages,
      });

      if (!result.success) {
        throw new Error(result.message || "Native print spooler returned failure.");
      }

      setJobStatus({
        id: String(result.jobId || Date.now()),
        state: "completed",
        progressPercent: 100,
        message: result.message || `Print job submitted successfully to "${selectedPrinterName}".`,
      });

      // Reset temporary preferences state back to clean baseline
      setTemporaryPreferencesState({ ...DEFAULT_TEMPORARY_PREFERENCES });
    } catch (err: any) {
      console.error("Print job submission error:", err);
      setJobStatus({
        id: "",
        state: "failed",
        progressPercent: 0,
        message: "Print submission failed.",
        error: err.message || "Unknown printing error.",
      });
    }
  }, [payload, selectedPrinterName, printSettings]);

  const cancelJob = useCallback(() => {
    if (selectedPrinterName) {
      printerService.cancelJobSession(selectedPrinterName);
    }
    closePrintDialog();
  }, [selectedPrinterName, closePrintDialog]);

  return (
    <PrintContext.Provider
      value={{
        isOpen,
        openPrintDialog,
        closePrintDialog,
        payload,
        installedPrinters,
        selectedPrinter,
        selectedPrinterName,
        setSelectedPrinterName,
        refreshPrinters,
        isLoadingPrinters,
        capabilities,
        temporaryPreferences,
        updateTemporaryPreferences,
        openNativePreferences,
        printSettings,
        updatePrintSettings,
        renderedPages,
        isPreviewLoading,
        refreshPreview,
        activePreviewIndex,
        setActivePreviewIndex,
        previewZoom,
        setPreviewZoom,
        zoomIn,
        zoomOut,
        fitPage,
        actualSize,
        nextPage,
        prevPage,
        jobStatus,
        submitPrint,
        cancelJob,
        bridgeMode,
        isDesktop,
      }}
    >
      {children}
    </PrintContext.Provider>
  );
};

export const usePrint = (): PrintContextValue => {
  const context = useContext(PrintContext);
  if (!context) {
    throw new Error("usePrint must be used within a PrintProvider");
  }
  return context;
};
