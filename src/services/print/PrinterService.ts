/**
 * OMNISCAN TITAN X - Printer Service
 * High-level service for printer lifecycle, temporary DEVMODE management,
 * capability synchronization, and job submission.
 */

import {
  InstalledPrinter,
  PrinterCapabilities,
  TemporaryDriverPreferences,
  PrintSettings,
  PrintPageItem,
} from "../../types/print";
import { nativePrintBridge } from "./NativePrintBridge";
import { DEFAULT_TEMPORARY_PREFERENCES } from "./constants";

export class PrinterService {
  private static instance: PrinterService;
  private installedPrinters: InstalledPrinter[] = [];
  private capabilitiesCache = new Map<string, PrinterCapabilities>();
  private temporaryPrefsCache = new Map<string, TemporaryDriverPreferences>();

  private constructor() {}

  public static getInstance(): PrinterService {
    if (!PrinterService.instance) {
      PrinterService.instance = new PrinterService();
    }
    return PrinterService.instance;
  }

  /**
   * Fetch all installed OS printers
   */
  public async loadPrinters(): Promise<InstalledPrinter[]> {
    const list = await nativePrintBridge.getPrinters();
    this.installedPrinters = list;
    return list;
  }

  public getCachedPrinters(): InstalledPrinter[] {
    return this.installedPrinters;
  }

  /**
   * Retrieve or fetch capabilities for a specific printer
   */
  public async getCapabilities(printerName: string): Promise<PrinterCapabilities> {
    if (this.capabilitiesCache.has(printerName)) {
      return this.capabilitiesCache.get(printerName)!;
    }

    const caps = await nativePrintBridge.getPrinterCapabilities(printerName);
    this.capabilitiesCache.set(printerName, caps);
    return caps;
  }

  /**
   * Open the native Windows driver preferences interface for the selected printer
   * Crucial Requirement 6: Captures current preferences, creates a temporary copy
   * for this print job, and ensures settings do NOT permanently overwrite Windows defaults.
   */
  public async openPrinterPreferences(
    printerName: string
  ): Promise<{ success: boolean; message?: string }> {
    // 1. Initialize temporary preferences session
    if (!this.temporaryPrefsCache.has(printerName)) {
      this.temporaryPrefsCache.set(printerName, {
        ...DEFAULT_TEMPORARY_PREFERENCES,
      });
    }

    // 2. Invoke the native driver dialog via bridge
    const result = await nativePrintBridge.openPrinterPreferences(printerName);

    return result;
  }

  /**
   * Update temporary per-job DEVMODE overrides
   */
  public updateTemporaryPreferences(
    printerName: string,
    overrides: Partial<TemporaryDriverPreferences>
  ): TemporaryDriverPreferences {
    const current = this.temporaryPrefsCache.get(printerName) || { ...DEFAULT_TEMPORARY_PREFERENCES };
    const updated: TemporaryDriverPreferences = {
      ...current,
      ...overrides,
      isTemporary: true,
    };
    this.temporaryPrefsCache.set(printerName, updated);
    return updated;
  }

  public getTemporaryPreferences(printerName: string): TemporaryDriverPreferences {
    return this.temporaryPrefsCache.get(printerName) || { ...DEFAULT_TEMPORARY_PREFERENCES };
  }

  /**
   * Submit the print job and automatically restore previous printer configuration
   */
  public async submitPrintJob(payload: {
    printerName: string;
    settings: PrintSettings;
    pages: PrintPageItem[];
  }): Promise<{ success: boolean; jobId: string | number; message?: string }> {
    // 1. Ensure temporary preferences are attached to the job
    const tempPrefs = this.getTemporaryPreferences(payload.printerName);
    const finalSettings: PrintSettings = {
      ...payload.settings,
      temporaryPreferences: tempPrefs,
    };

    // 2. Submit to native bridge
    const result = await nativePrintBridge.submitPrintJob({
      printerName: payload.printerName,
      settings: finalSettings,
      pages: payload.pages,
    });

    // 3. Crucial Requirement 6: Automatically release/discard temporary settings
    // and restore baseline configuration so subsequent jobs start with defaults.
    this.temporaryPrefsCache.delete(payload.printerName);
    await nativePrintBridge.restorePrinterPreferences(payload.printerName);

    return result;
  }

  /**
   * Discard temporary preferences if the user cancels the dialog
   */
  public async cancelJobSession(printerName: string): Promise<void> {
    if (this.temporaryPrefsCache.has(printerName)) {
      this.temporaryPrefsCache.delete(printerName);
      await nativePrintBridge.restorePrinterPreferences(printerName);
    }
  }
}

export const printerService = PrinterService.getInstance();
