/**
 * OMNISCAN TITAN X - Centralized Application Print Dialog
 * Unified desktop print workflow with native printer selection, driver preferences,
 * temporary DEVMODE per-job isolation, and high-accuracy physical preview.
 */

import React, { useEffect } from "react";
import {
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sliders,
  Sparkles,
  Layers,
  ArrowLeft,
  RotateCcw,
  Check,
} from "lucide-react";
import { usePrint } from "../../context/PrintContext";
import { PrintPreview } from "./PrintPreview";
import { PrinterSelector } from "./PrinterSelector";
import { PrinterPreferencesPanel } from "./PrinterPreferencesPanel";
import { PrintSettingsPanel } from "./PrintSettingsPanel";

export const PrintDialog: React.FC = () => {
  const {
    isOpen,
    closePrintDialog,
    payload,
    selectedPrinter,
    jobStatus,
    submitPrint,
    printSettings,
    renderedPages,
    bridgeMode,
    isDesktop,
    refreshPreview,
  } = usePrint();

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && jobStatus.state !== "submitting" && jobStatus.state !== "spooling") {
        closePrintDialog();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, jobStatus.state, closePrintDialog]);

  if (!isOpen || !payload) return null;

  const isSubmitting = jobStatus.state === "submitting" || jobStatus.state === "spooling" || jobStatus.state === "preparing-preview";
  const isCompleted = jobStatus.state === "completed";
  const isFailed = jobStatus.state === "failed";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 p-2 sm:p-4 md:p-6">
      <div className="w-full max-w-[1500px] h-[95vh] max-h-[950px] bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* 1. Header Bar */}
        <div className="h-14 px-5 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-neutral-100 tracking-tight">
                  Print Document
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-[11px] text-neutral-300 font-mono">
                  {payload.title || "OmniScan Print Job"}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Native Desktop Spooler & Physical Print Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Desktop / Bridge Mode Indicator (Requirement 18) */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded-full text-[11px]">
              <span
                className={`w-2 h-2 rounded-full ${
                  isDesktop || bridgeMode === "electron"
                    ? "bg-emerald-400"
                    : bridgeMode === "local-server"
                    ? "bg-sky-400"
                    : "bg-amber-400"
                }`}
              />
              <span className="text-neutral-300 font-medium">
                {bridgeMode === "electron"
                  ? "Electron Native Bridge"
                  : bridgeMode === "local-server"
                  ? "Desktop Server Spooler"
                  : "Browser Sandbox (Simulation)"}
              </span>
            </div>

            <button
              type="button"
              onClick={closePrintDialog}
              disabled={isSubmitting}
              className="p-2 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 rounded-lg transition-colors disabled:opacity-30"
              title="Close Print Dialog (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Main Content Split: Center Preview + Right Settings Sidebar */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Center Stage: Interactive Real Print Preview (Requirement 7 & 15) */}
          <div className="flex-1 flex flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-neutral-800">
            <PrintPreview />
          </div>

          {/* Right Panel: Settings, Printer Selector & Driver Preferences (Requirement 8 & 15) */}
          <div className="w-full lg:w-[420px] xl:w-[460px] bg-neutral-900 flex flex-col shrink-0 overflow-hidden">
            {/* Scrollable Settings Form */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Fallback Sandbox Notice if in browser with no native bridge (Requirement 18) */}
              {bridgeMode === "browser-fallback" && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    Browser Sandbox Detected
                  </div>
                  <p className="text-[11px] text-neutral-300">
                    Direct printer switching and hardware driver preferences require the OmniScan Desktop / Electron wrapper. Local spooling mode is active.
                  </p>
                </div>
              )}

              {/* 1. Printer Selector (Requirement 4) */}
              <PrinterSelector />

              {/* 2. Printer Preferences Button & Temporary DEVMODE Banner (Requirements 5 & 6) */}
              <PrinterPreferencesPanel />

              {/* 3. Print Settings Form (Requirement 8) */}
              <div className="pt-2 border-t border-neutral-800">
                <PrintSettingsPanel />
              </div>
            </div>

            {/* 4. Bottom Action & Status Bar (Requirement 10, 11, 15) */}
            <div className="p-4 bg-neutral-950 border-t border-neutral-800 space-y-3 shrink-0">
              {/* Status Message / Progress Feedback */}
              {jobStatus.state !== "idle" && (
                <div
                  className={`px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 border ${
                    isCompleted
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : isFailed
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                      : isSubmitting
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : "bg-neutral-900 border-neutral-800 text-neutral-300"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {isSubmitting && <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />}
                    {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    {isFailed && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
                    <span className="truncate">{jobStatus.message}</span>
                  </div>
                  {jobStatus.error && (
                    <span className="text-[10px] text-rose-400 underline font-mono truncate max-w-[120px]" title={jobStatus.error}>
                      {jobStatus.error}
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={closePrintDialog}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700/80 active:bg-neutral-800 text-neutral-300 hover:text-neutral-100 rounded-xl text-xs font-medium transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={refreshPreview}
                    disabled={isSubmitting}
                    className="px-3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5"
                    title="Refresh rendered preview"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>

                  <button
                    type="button"
                    onClick={submitPrint}
                    disabled={isSubmitting || renderedPages.length === 0 || !selectedPrinter}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-neutral-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 min-w-[120px] justify-center"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
                        <span>Sending...</span>
                      </>
                    ) : isCompleted ? (
                      <>
                        <Check className="w-4 h-4 text-neutral-950 stroke-[3]" />
                        <span>Done</span>
                      </>
                    ) : (
                      <>
                        <Printer className="w-4 h-4 text-neutral-950 stroke-[2.5]" />
                        <span>Print</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
