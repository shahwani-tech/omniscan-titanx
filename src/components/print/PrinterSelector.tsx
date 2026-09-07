/**
 * OMNISCAN TITAN X - Printer Selector Component
 * Real-time installed OS printer list with status, driver details, and refresh.
 */

import React from "react";
import {
  Printer,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Wifi,
  HardDrive,
  FileText,
  Sliders,
} from "lucide-react";
import { usePrint } from "../../context/PrintContext";

export const PrinterSelector: React.FC = () => {
  const {
    installedPrinters,
    selectedPrinterName,
    setSelectedPrinterName,
    selectedPrinter,
    refreshPrinters,
    isLoadingPrinters,
    bridgeMode,
  } = usePrint();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
          <Printer className="w-3.5 h-3.5 text-amber-400" />
          Destination Printer
        </label>
        <button
          type="button"
          onClick={refreshPrinters}
          disabled={isLoadingPrinters}
          className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-neutral-800/60 disabled:opacity-50"
          title="Refresh OS installed printer list"
        >
          <RefreshCw className={`w-3 h-3 ${isLoadingPrinters ? "animate-spin text-amber-400" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Printer Select Dropdown */}
      <div className="relative">
        <select
          value={selectedPrinterName}
          onChange={(e) => setSelectedPrinterName(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700/80 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/50 appearance-none pr-8 cursor-pointer font-medium"
        >
          {installedPrinters.map((p) => (
            <option key={p.name} value={p.name}>
              {p.displayName} {p.isDefault ? "★ (Default)" : ""} {!p.isOnline ? "• (Offline)" : ""}
            </option>
          ))}
          {installedPrinters.length === 0 && (
            <option value="">No printers detected</option>
          )}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-neutral-400">
          <Sliders className="w-4 h-4" />
        </div>
      </div>

      {/* Printer Status Detail Card */}
      {selectedPrinter && (
        <div className="bg-neutral-950/80 border border-neutral-800 rounded-lg p-2.5 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-medium text-neutral-200 truncate">
              {selectedPrinter.status === "online" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              )}
              <span className="truncate">{selectedPrinter.displayName}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {selectedPrinter.isDefault && (
                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded text-[10px] font-semibold">
                  Default
                </span>
              )}
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                  selectedPrinter.isOnline
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                }`}
              >
                {selectedPrinter.statusText || (selectedPrinter.isOnline ? "Online" : "Offline")}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-neutral-400 pt-1 border-t border-neutral-800/80">
            <div className="truncate flex items-center gap-1">
              <span className="text-neutral-500">Driver:</span>
              <span className="text-neutral-300 truncate" title={selectedPrinter.driverName}>
                {selectedPrinter.driverName || "Standard Driver"}
              </span>
            </div>
            <div className="truncate flex items-center gap-1 justify-end">
              <span className="text-neutral-500">Port:</span>
              <span className="text-neutral-300 truncate">{selectedPrinter.portName || "USB/Direct"}</span>
            </div>
            <div className="flex items-center gap-1">
              {selectedPrinter.isNetwork ? (
                <>
                  <Wifi className="w-3 h-3 text-sky-400" />
                  <span className="text-sky-300">Network Printer</span>
                </>
              ) : selectedPrinter.isVirtual ? (
                <>
                  <FileText className="w-3 h-3 text-purple-400" />
                  <span className="text-purple-300">Virtual PDF Spooler</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-3 h-3 text-neutral-400" />
                  <span className="text-neutral-300">Local Hardware</span>
                </>
              )}
            </div>
            <div className="text-right text-neutral-500 text-[10px]">
              Bridge: <span className="text-neutral-400 uppercase font-mono">{bridgeMode}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
