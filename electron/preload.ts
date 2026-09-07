/**
 * OMNISCAN TITAN X - Electron Preload Script
 * Exposes a strictly isolated, secure desktopPrintBridge API to the React renderer
 */

import { contextBridge, ipcRenderer } from "electron";
import {
  InstalledPrinter,
  PrinterCapabilities,
  TemporaryDriverPreferences,
  PrintSettings,
  PrintPageItem,
  NativePrintBridgeAPI,
} from "../src/types/print";

const desktopPrintBridge: NativePrintBridgeAPI = {
  isDesktop: true,
  platform: process.platform as any,

  getPrinters: async (): Promise<InstalledPrinter[]> => {
    return await ipcRenderer.invoke("desktop:get-printers");
  },

  getPrinterCapabilities: async (printerName: string): Promise<PrinterCapabilities> => {
    return await ipcRenderer.invoke("desktop:get-printer-capabilities", printerName);
  },

  openPrinterPreferences: async (
    printerName: string
  ): Promise<{ success: boolean; message?: string }> => {
    return await ipcRenderer.invoke("desktop:open-printer-preferences", printerName);
  },

  applyTemporaryDevMode: async (
    printerName: string,
    prefs: TemporaryDriverPreferences
  ): Promise<{ success: boolean }> => {
    return await ipcRenderer.invoke("desktop:apply-temporary-devmode", printerName, prefs);
  },

  submitPrintJob: async (job: {
    printerName: string;
    settings: PrintSettings;
    pages: PrintPageItem[];
  }): Promise<{ success: boolean; jobId: string | number; message?: string }> => {
    return await ipcRenderer.invoke("desktop:submit-print-job", job);
  },

  restorePrinterPreferences: async (
    printerName: string
  ): Promise<{ success: boolean }> => {
    return await ipcRenderer.invoke("desktop:restore-printer-preferences", printerName);
  },
};

contextBridge.exposeInMainWorld("desktopPrintBridge", desktopPrintBridge);
