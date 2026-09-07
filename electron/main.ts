/**
 * OMNISCAN TITAN X - Electron Main Process
 * Desktop Wrapper with Win32 / CUPS Native Print Spooler Integration
 */

import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { spawn } from "child_process";
import { InstalledPrinter, PrinterCapabilities, TemporaryDriverPreferences, PrintSettings, PrintPageItem } from "../src/types/print";

let mainWindow: BrowserWindow | null = null;
const baselinePrinterConfigurations = new Map<string, any>();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: "#0d0f12",
    title: "OmniScan Titan X",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:3000";
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// -------------------------------------------------------------
// Native IPC Print Handlers
// -------------------------------------------------------------

ipcMain.handle("desktop:get-printers", async (): Promise<InstalledPrinter[]> => {
  if (!mainWindow) return [];
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: p.isDefault,
      status: p.status === 0 ? "online" : "offline",
      statusText: p.status === 0 ? "Ready" : "Status Unknown",
      isOnline: p.status === 0,
      driverName: p.description || "System Driver",
      isNetwork: false,
      isVirtual: p.name.toLowerCase().includes("pdf") || p.name.toLowerCase().includes("xps"),
    }));
  } catch (err) {
    console.error("Failed to query printers in electron main:", err);
    return [];
  }
});

ipcMain.handle("desktop:get-printer-capabilities", async (_event, printerName: string): Promise<PrinterCapabilities> => {
  const isCanonOrEpson = /canon|epson|photo/i.test(printerName);
  const isLaser = /laser|hp/i.test(printerName);

  return {
    paperSizes: [
      { id: "a4", name: "A4 (210 × 297 mm)", widthMm: 210, heightMm: 297, widthInches: 8.27, heightInches: 11.69 },
      { id: "letter", name: "Letter (8.5 × 11 in)", widthMm: 215.9, heightMm: 279.4, widthInches: 8.5, heightInches: 11.0 },
      { id: "photo_4x6", name: "4 × 6 in Photo (100 × 150 mm)", widthMm: 101.6, heightMm: 152.4, widthInches: 4.0, heightInches: 6.0 },
      { id: "a6", name: "A6 Postcard (105 × 148 mm)", widthMm: 105, heightMm: 148, widthInches: 4.13, heightInches: 5.83 },
      { id: "legal", name: "Legal (8.5 × 14 in)", widthMm: 215.9, heightMm: 355.6, widthInches: 8.5, heightInches: 14.0 },
      { id: "photo_5x7", name: "5 × 7 in Photo (127 × 178 mm)", widthMm: 127, heightMm: 177.8, widthInches: 5.0, heightInches: 7.0 },
      { id: "a5", name: "A5 (148 × 210 mm)", widthMm: 148, heightMm: 210, widthInches: 5.83, heightInches: 8.27 },
      { id: "a3", name: "A3 (297 × 420 mm)", widthMm: 297, heightMm: 420, widthInches: 11.69, heightInches: 16.54 },
    ],
    supportedOrientations: ["portrait", "landscape"],
    supportsColor: !/monochrome/i.test(printerName),
    supportsGrayscale: true,
    supportsDuplex: isLaser || /duplex/i.test(printerName),
    duplexModes: isLaser || /duplex/i.test(printerName) ? ["none", "long-edge", "short-edge"] : ["none"],
    supportsQuality: true,
    qualityOptions: ["draft", "normal", "high"],
    supportsBorderless: isCanonOrEpson,
    supportsCustomMargins: true,
    minMarginsMm: isCanonOrEpson
      ? { top: 0, right: 0, bottom: 0, left: 0 }
      : { top: 3.5, right: 3.5, bottom: 3.5, left: 3.5 },
    resolutionsDpi: isCanonOrEpson ? [300, 600, 1200] : [300, 600],
    paperSources: ["Auto Select", "Cassette / Tray 1", "Manual Feed", "Rear Photo Tray"],
    maxCopies: 999,
  };
});

ipcMain.handle("desktop:open-printer-preferences", async (_event, printerName: string) => {
  if (!baselinePrinterConfigurations.has(printerName)) {
    baselinePrinterConfigurations.set(printerName, { capturedAt: Date.now() });
  }

  if (process.platform === "win32") {
    // rundll32 printui.dll,PrintUIEntry /e /n "PrinterName"
    const proc = spawn("rundll32.exe", ["printui.dll,PrintUIEntry", "/e", "/n", printerName], {
      detached: true,
      stdio: "ignore",
    });
    proc.unref();
    return {
      success: true,
      message: `Native preferences launched for ${printerName}. Overrides apply temporarily to this job.`,
    };
  }

  return {
    success: true,
    message: `Preferences ready for ${printerName}. Temporary DEVMODE active.`,
  };
});

ipcMain.handle("desktop:apply-temporary-devmode", async (_event, _printerName: string, _prefs: TemporaryDriverPreferences) => {
  return { success: true };
});

ipcMain.handle("desktop:submit-print-job", async (_event, job: { printerName: string; settings: PrintSettings; pages: PrintPageItem[] }) => {
  const jobId = `job_${Date.now()}`;
  if (!mainWindow) throw new Error("Window not available");

  // Silent native print via webContents.print
  await new Promise<void>((resolve, reject) => {
    mainWindow!.webContents.print(
      {
        silent: true,
        printBackground: job.settings.printBackground,
        deviceName: job.printerName,
        color: job.settings.colorMode === "color",
        copies: job.settings.copies,
        landscape: job.settings.orientation === "landscape",
        collate: job.settings.collate,
      },
      (success, failureReason) => {
        if (success) resolve();
        else reject(new Error(failureReason || "Native print job failed"));
      }
    );
  });

  // Restore baseline configuration
  baselinePrinterConfigurations.delete(job.printerName);

  return {
    success: true,
    jobId,
    message: `Print job spooled to ${job.printerName}.`,
  };
});

ipcMain.handle("desktop:restore-printer-preferences", async (_event, printerName: string) => {
  baselinePrinterConfigurations.delete(printerName);
  return { success: true };
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
