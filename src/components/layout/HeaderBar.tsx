/**
 * OMNISCAN TITAN X - Main Application Menu Bar & Quick Actions
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Scan,
  FolderOpen,
  Download,
  Save,
  Wand2,
  Layers,
  FileSearch,
  ShieldCheck,
  SplitSquareVertical,
  Activity,
  Command,
  Sun,
  Moon,
  Globe,
  Plus,
  RotateCw,
  RotateCcw,
  Crop,
  CheckCircle2,
  Trash2,
  Copy,
  Sparkles,
  Sliders,
  Printer,
  Palette,
  Scissors,
  Undo2,
  Redo2,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Keyboard,
} from "lucide-react";
import { AppLanguage, AppTheme, ViewMode, ActiveTool } from "../../types";
import { t } from "../../engine/i18n";

interface HeaderBarProps {
  applicationName?: string;
  documentName: string;
  theme: AppTheme;
  language: AppLanguage;
  viewMode: ViewMode;
  isProcessing: boolean;
  isDirty: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  activeTool?: ActiveTool;
  onSetActiveTool?: (tool: ActiveTool) => void;
  enableCollapse?: boolean;
  onThemeChange: (theme: AppTheme) => void;
  onLanguageChange: (lang: AppLanguage) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenScanModal: () => void;
  onImportFile: () => void;
  onExportPdf: () => void;
  onSaveProject: () => void;
  onOpenProject: () => void;
  onRunOcr: () => void;
  onAutoDeskew: () => void;
  onAutoCrop: () => void;
  onAutoEnhance?: () => void;
  onAutoEnhanceAll?: () => void;
  onOpenFilterStudio: () => void;
  onOpenPhotoPrintStudio: () => void;
  onOpenIdCardStudio?: () => void;
  onOpenDocumentConverter?: () => void;
  onOpenBatchStudio: () => void;
  onOpenCompare: () => void;
  onOpenSecurity: () => void;
  onOpenDiagnostics: () => void;
  onOpenCommandPalette: () => void;
  onOpenKeyboardShortcuts?: () => void;
  onAnalyzeIntelligence: () => void;
  onRotateActivePage: (degrees: number) => void;
  onDeleteActivePage: () => void;
  onDuplicateActivePage: () => void;
  onAddBlankPage: () => void;
  onOpenCropMode?: () => void;
  onOpenSplitPdf?: () => void;
  onPrintDocument?: () => void;
  onRemoveBlankPages?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  applicationName,
  documentName,
  theme,
  language,
  viewMode,
  isProcessing,
  isDirty,
  canUndo,
  canRedo,
  activeTool = "select",
  onSetActiveTool,
  enableCollapse = true,
  onThemeChange,
  onLanguageChange,
  onViewModeChange,
  onOpenScanModal,
  onImportFile,
  onExportPdf,
  onSaveProject,
  onOpenProject,
  onRunOcr,
  onAutoDeskew,
  onAutoCrop,
  onAutoEnhance,
  onAutoEnhanceAll,
  onOpenFilterStudio,
  onOpenPhotoPrintStudio,
  onOpenIdCardStudio,
  onOpenDocumentConverter,
  onOpenBatchStudio,
  onOpenCompare,
  onOpenSecurity,
  onOpenDiagnostics,
  onOpenCommandPalette,
  onOpenKeyboardShortcuts,
  onAnalyzeIntelligence,
  onRotateActivePage,
  onDeleteActivePage,
  onDuplicateActivePage,
  onAddBlankPage,
  onOpenCropMode,
  onOpenSplitPdf,
  onPrintDocument,
  onRemoveBlankPages,
  onUndo,
  onRedo,
}) => {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState<boolean>(false);
  const menubarRef = useRef<HTMLDivElement>(null);
  const quickActionBarRef = useRef<HTMLDivElement>(null);

  // Dedicated horizontal mouse-wheel scrolling for the Quick Action Bar
  useEffect(() => {
    const container = quickActionBarRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Don't intercept browser zooming or modified clicks
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      // If content fits completely without horizontal overflow, do not intercept
      if (maxScrollLeft <= 1) return;

      // Determine delta: convert vertical wheel rotation to horizontal scroll
      let delta = 0;
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        delta = e.deltaY;
        if (e.deltaMode === 1) {
          delta *= 24; // Line mode (Firefox/certain drivers)
        } else if (e.deltaMode === 2) {
          delta *= container.clientWidth; // Page mode
        }
      } else {
        // User is already scrolling horizontally (trackpad swipe or horizontal tilt wheel)
        // Allow native horizontal scrolling to proceed without interference
        return;
      }

      if (delta === 0) return;

      // Wheel DOWN (delta > 0) -> scroll RIGHT
      if (delta > 0 && container.scrollLeft < maxScrollLeft - 0.5) {
        e.preventDefault();
        container.scrollLeft = Math.min(maxScrollLeft, container.scrollLeft + delta);
        return;
      }

      // Wheel UP (delta < 0) -> scroll LEFT
      if (delta < 0 && container.scrollLeft > 0.5) {
        e.preventDefault();
        container.scrollLeft = Math.max(0, container.scrollLeft + delta);
        return;
      }

      // At boundary edges (already at far left when scrolling UP, or far right when scrolling DOWN),
      // do not preventDefault to allow natural container/page behavior.
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const toggleDropdown = (menu: string) => {
    setActiveDropdown(activeDropdown === menu ? null : menu);
  };

  const handleMenuHover = (menu: string) => {
    if (activeDropdown !== null) {
      setActiveDropdown(menu);
    }
  };

  const closeDropdowns = () => setActiveDropdown(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!activeDropdown) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menubarRef.current && !menubarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activeDropdown]);

  return (
    <header className="flex flex-col bg-neutral-900 border-b border-neutral-800 select-none relative z-40 shrink-0">
      {/* Top Application Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-800/80 text-xs">
        {/* Brand & Project Name */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded bg-gradient-to-tr from-sky-600 to-indigo-500 flex items-center justify-center shadow-sm">
              <Scan className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold tracking-wider text-sky-400 font-serif uppercase">
              {applicationName || "OMNISCAN TITAN X"}
            </span>
          </div>

          <span className="text-neutral-600">|</span>

          <div className="flex items-center space-x-1.5 text-neutral-300">
            <span className="font-medium max-w-[200px] truncate">{documentName}</span>
            {isDirty && (
              <span className="w-2 h-2 rounded-full bg-amber-500" title="Unsaved changes" />
            )}
          </div>
        </div>

        {/* Global Action Icons & Controls */}
        <div className="flex items-center space-x-2">
          {/* Command Palette Trigger */}
          <button
            onClick={onOpenCommandPalette}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
            title="Command Palette (Ctrl + K / Ctrl + Shift + P)"
          >
            <Command className="w-3 h-3 text-sky-400" />
            <span className="hidden sm:inline">Commands</span>
            <kbd className="px-1 py-0.5 text-[10px] bg-neutral-900 rounded border border-neutral-700 text-neutral-400 font-mono">
              ⌘K
            </kbd>
          </button>

          {/* Shortcuts Panel Trigger */}
          {onOpenKeyboardShortcuts && (
            <button
              onClick={onOpenKeyboardShortcuts}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
              title="Keyboard Shortcuts & Settings (Ctrl + / or F1)"
            >
              <Keyboard className="w-3 h-3 text-sky-400" />
              <span className="hidden md:inline">Shortcuts</span>
              <kbd className="px-1 py-0.5 text-[10px] bg-neutral-900 rounded border border-neutral-700 text-neutral-400 font-mono">
                ⌘/
              </kbd>
            </button>
          )}

          {/* Language Selector */}
          <div className="flex items-center space-x-1 bg-neutral-800 rounded px-1.5 py-0.5 border border-neutral-700">
            <Globe className="w-3 h-3 text-neutral-400" />
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as AppLanguage)}
              className="bg-transparent text-neutral-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="en" className="bg-neutral-900">EN - English</option>
              <option value="ur" className="bg-neutral-900">UR - اردو</option>
              <option value="ar" className="bg-neutral-900">AR - العربية</option>
              <option value="fr" className="bg-neutral-900">FR - Français</option>
              <option value="es" className="bg-neutral-900">ES - Español</option>
              <option value="de" className="bg-neutral-900">DE - Deutsch</option>
            </select>
          </div>

          {/* Theme Selector */}
          <div className="flex items-center bg-neutral-800 rounded p-0.5 border border-neutral-700">
            <button
              onClick={() => onThemeChange("titan-dark")}
              className={`p-1 rounded ${theme === "titan-dark" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"}`}
              title="Titan Dark"
            >
              <Moon className="w-3 h-3" />
            </button>
            <button
              onClick={() => onThemeChange("studio-light")}
              className={`p-1 rounded ${theme === "studio-light" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"}`}
              title="Studio Light"
            >
              <Sun className="w-3 h-3" />
            </button>
          </div>

          {/* Diagnostics Button */}
          <button
            onClick={onOpenDiagnostics}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-sky-400 transition-colors"
            title="System Diagnostics & Engine Status"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Menu Bar (File, Edit, View, Page, Scan, CV Lab, OCR, Batch, Tools) */}
      <div
        ref={menubarRef}
        className="flex items-center px-2 py-1 text-xs text-neutral-300 relative border-b border-neutral-800 bg-neutral-900"
      >
        <div className="flex items-center space-x-1">
          {/* File Menu */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown("file")}
              onMouseEnter={() => handleMenuHover("file")}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeDropdown === "file"
                  ? "bg-sky-600 text-white font-medium shadow"
                  : "hover:bg-neutral-800 hover:text-white"
              }`}
            >
              {t("menu.file", language)}
            </button>
            {activeDropdown === "file" && (
              <div className="absolute left-0 top-full mt-1.5 w-64 bg-neutral-900/98 border border-neutral-700/90 rounded-lg shadow-2xl py-1.5 z-[100] text-xs backdrop-blur-xl ring-1 ring-black/60 divide-y divide-neutral-800">
                <div className="py-0.5">
                  <button
                    onClick={() => { onOpenScanModal(); closeDropdowns(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center justify-between transition-colors text-neutral-200"
                  >
                    <span className="flex items-center space-x-2">
                      <Scan className="w-3.5 h-3.5 text-sky-400" />
                      <span>Acquire New Scan...</span>
                    </span>
                    <kbd className="text-[10px] text-neutral-400 font-mono">Ctrl+N</kbd>
                  </button>
                  <button
                    onClick={() => { onImportFile(); closeDropdowns(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center justify-between transition-colors text-neutral-200"
                  >
                    <span className="flex items-center space-x-2">
                      <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                      <span>Import PDF / Image...</span>
                    </span>
                    <kbd className="text-[10px] text-neutral-400 font-mono">Ctrl+O</kbd>
                  </button>
                </div>

                <div className="py-0.5">
                  <button
                    onClick={() => { onSaveProject(); closeDropdowns(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-emerald-600 hover:text-white flex items-center justify-between transition-colors text-neutral-200"
                  >
                    <span className="flex items-center space-x-2">
                      <Save className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Save Titan Project (.titanproj)</span>
                    </span>
                    <kbd className="text-[10px] text-neutral-400 font-mono">Ctrl+S</kbd>
                  </button>
                  <button
                    onClick={() => { onOpenProject(); closeDropdowns(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 hover:text-white flex items-center space-x-2 transition-colors text-neutral-200"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Open Titan Project...</span>
                  </button>
                </div>

                <div className="py-0.5">
                  <button
                    onClick={() => { onExportPdf(); closeDropdowns(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center justify-between transition-colors font-semibold text-sky-300"
                  >
                    <span className="flex items-center space-x-2">
                      <Download className="w-3.5 h-3.5 text-sky-400" />
                      <span>Export PDF/A Archival...</span>
                    </span>
                    <kbd className="text-[10px] text-neutral-400 font-mono">Ctrl+E</kbd>
                  </button>
                  {onOpenSplitPdf && (
                    <button
                      onClick={() => { onOpenSplitPdf(); closeDropdowns(); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 hover:text-white flex items-center space-x-2 transition-colors text-neutral-200"
                    >
                      <Scissors className="w-3.5 h-3.5 text-sky-400" />
                      <span>Split PDF Document...</span>
                    </button>
                  )}
                  {onPrintDocument && (
                    <button
                      onClick={() => { onPrintDocument(); closeDropdowns(); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-neutral-800 hover:text-white flex items-center justify-between transition-colors text-neutral-200"
                    >
                      <span className="flex items-center space-x-2">
                        <Printer className="w-3.5 h-3.5 text-amber-400" />
                        <span>Print Document...</span>
                      </span>
                      <kbd className="text-[10px] text-neutral-400 font-mono">Ctrl+P</kbd>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Edit Menu */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown("edit")}
              onMouseEnter={() => handleMenuHover("edit")}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeDropdown === "edit"
                  ? "bg-sky-600 text-white font-medium shadow"
                  : "hover:bg-neutral-800 hover:text-white"
              }`}
            >
              {t("menu.edit", language)}
            </button>
            {activeDropdown === "edit" && (
              <div className="absolute left-0 top-full mt-1.5 w-56 bg-neutral-900/98 border border-neutral-700/90 rounded-lg shadow-2xl py-1.5 z-[100] text-xs backdrop-blur-xl ring-1 ring-black/60">
                {onUndo && (
                  <button
                    disabled={!canUndo}
                    onClick={() => { onUndo(); closeDropdowns(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white disabled:opacity-40 flex items-center justify-between transition-colors text-neutral-200"
                  >
                    <span className="flex items-center space-x-2">
                      <Undo2 className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Undo</span>
                    </span>
                    <kbd className="text-[10px] text-neutral-400 font-mono">Ctrl+Z</kbd>
                  </button>
                )}
                {onRedo && (
                  <button
                    disabled={!canRedo}
                    onClick={() => { onRedo(); closeDropdowns(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white disabled:opacity-40 flex items-center justify-between transition-colors text-neutral-200"
                  >
                    <span className="flex items-center space-x-2">
                      <Redo2 className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Redo</span>
                    </span>
                    <kbd className="text-[10px] text-neutral-400 font-mono">Ctrl+Y</kbd>
                  </button>
                )}
                <div className="my-1 border-t border-neutral-800" />
                <button
                  onClick={() => { onDuplicateActivePage(); closeDropdowns(); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 transition-colors text-neutral-200"
                >
                  <Copy className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Duplicate Page</span>
                </button>
                <button
                  onClick={() => { onDeleteActivePage(); closeDropdowns(); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-red-600 hover:text-white flex items-center space-x-2 text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected Page</span>
                </button>
              </div>
            )}
          </div>

          {/* Page Menu */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown("page")}
              onMouseEnter={() => handleMenuHover("page")}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeDropdown === "page"
                  ? "bg-sky-600 text-white font-medium shadow"
                  : "hover:bg-neutral-800 hover:text-white"
              }`}
            >
              {t("menu.page", language)}
            </button>
            {activeDropdown === "page" && (
              <div className="absolute left-0 top-full mt-1.5 w-60 bg-neutral-900/98 border border-neutral-700/90 rounded-lg shadow-2xl py-1.5 z-[100] text-xs backdrop-blur-xl ring-1 ring-black/60">
                <button
                  onClick={() => { onAddBlankPage(); closeDropdowns(); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 transition-colors text-neutral-200"
                >
                  <Plus className="w-3.5 h-3.5 text-sky-400" />
                  <span>Insert Blank Page</span>
                </button>
                {onRemoveBlankPages && (
                  <button
                    onClick={() => { onRemoveBlankPages(); closeDropdowns(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-amber-600 hover:text-white flex items-center space-x-2 transition-colors text-amber-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Auto-Remove Blank Pages</span>
                  </button>
                )}
                {onOpenCropMode && (
                  <button
                    onClick={() => { onOpenCropMode(); closeDropdowns(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 transition-colors text-sky-300 font-semibold"
                  >
                    <Crop className="w-3.5 h-3.5 text-sky-400" />
                    <span>Crop Page (Physical Crop)...</span>
                  </button>
                )}
                <div className="my-1 border-t border-neutral-800" />
                <button
                  onClick={() => { onRotateActivePage(90); closeDropdowns(); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 transition-colors text-neutral-200"
                >
                  <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                  <span>Rotate 90° Clockwise</span>
                </button>
                <button
                  onClick={() => { onRotateActivePage(-90); closeDropdowns(); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 transition-colors text-neutral-200"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                  <span>Rotate 90° Counter-Clockwise</span>
                </button>
                <button
                  onClick={() => { onRotateActivePage(180); closeDropdowns(); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 transition-colors text-neutral-200"
                >
                  <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                  <span>Rotate 180° Flip</span>
                </button>
              </div>
            )}
          </div>

          {/* CV Lab Menu */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown("cvlab")}
              onMouseEnter={() => handleMenuHover("cvlab")}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeDropdown === "cvlab"
                  ? "bg-sky-600 text-white font-medium shadow"
                  : "hover:bg-neutral-800 hover:text-white"
              }`}
            >
              {t("menu.cvlab", language)}
            </button>
            {activeDropdown === "cvlab" && (
              <div className="absolute left-0 top-full mt-1.5 w-64 bg-neutral-900/98 border border-neutral-700/90 rounded-lg shadow-2xl py-1.5 z-[100] text-xs backdrop-blur-xl ring-1 ring-black/60">
                <button
                  onClick={() => { onOpenFilterStudio(); closeDropdowns(); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 font-semibold text-sky-400 transition-colors"
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>CamScanner Filter Studio (16 Presets)...</span>
                </button>
                <div className="my-1 border-t border-neutral-800" />
                <button
                  onClick={() => { onAutoDeskew(); closeDropdowns(); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 transition-colors text-neutral-200"
                >
                  <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto-Calculate Deskew</span>
                </button>
                <button
                  onClick={() => { onAutoCrop(); closeDropdowns(); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 transition-colors text-neutral-200"
                >
                  <Crop className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto-Detect Page Boundaries</span>
                </button>
              </div>
            )}
          </div>

          {/* Tools Menu */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown("tools")}
              onMouseEnter={() => handleMenuHover("tools")}
              className={`px-2.5 py-1 rounded transition-colors ${
                activeDropdown === "tools"
                  ? "bg-sky-600 text-white font-medium shadow"
                  : "hover:bg-neutral-800 hover:text-white"
              }`}
            >
              {t("menu.tools", language)}
            </button>
            {activeDropdown === "tools" && (
              <div className="absolute left-0 top-full mt-1.5 w-64 bg-neutral-900/98 border border-neutral-700/90 rounded-lg shadow-2xl py-1.5 z-[100] text-xs backdrop-blur-xl ring-1 ring-black/60 divide-y divide-neutral-800">
                <div className="py-0.5">
                  <button
                    onClick={() => { onOpenPhotoPrintStudio(); closeDropdowns(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 font-semibold text-amber-300 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>4×6" Photo &amp; Passport Studio...</span>
                  </button>
                  {onOpenIdCardStudio && (
                    <button
                      onClick={() => { onOpenIdCardStudio(); closeDropdowns(); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 font-semibold text-emerald-300 transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                      <span>ID Card / CNIC Print Studio...</span>
                    </button>
                  )}
                  <button
                    onClick={() => { onOpenFilterStudio(); closeDropdowns(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 text-neutral-200 transition-colors"
                  >
                    <Palette className="w-3.5 h-3.5 text-sky-400" />
                    <span>CamScanner Document Filters...</span>
                  </button>
                  {onAutoEnhanceAll && (
                    <button
                      onClick={() => { onAutoEnhanceAll(); closeDropdowns(); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 text-sky-300 font-medium transition-colors"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Adaptive Auto-Enhance All Pages...</span>
                    </button>
                  )}
                </div>
                <div className="py-0.5">
                  {onOpenDocumentConverter && (
                    <button
                      onClick={() => { onOpenDocumentConverter(); closeDropdowns(); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 text-sky-300 font-semibold transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5 text-sky-400" />
                      <span>Document Workspace &amp; Converter...</span>
                    </button>
                  )}
                  <button
                    onClick={() => { onOpenBatchStudio(); closeDropdowns(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 text-neutral-200 transition-colors"
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Batch Automation Studio...</span>
                  </button>
                  <button
                    onClick={() => { onOpenCompare(); closeDropdowns(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 text-neutral-200 transition-colors"
                  >
                    <SplitSquareVertical className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Compare Documents / Diff...</span>
                  </button>
                  <button
                    onClick={() => { onOpenSecurity(); closeDropdowns(); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center space-x-2 text-rose-300 transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                    <span>Security & Redaction Audit...</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="ml-auto flex items-center space-x-1 bg-neutral-800/80 rounded p-0.5 border border-neutral-750">
          <button
            onClick={() => onViewModeChange("single")}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${viewMode === "single" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"}`}
          >
            Single
          </button>
          <button
            onClick={() => onViewModeChange("continuous")}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${viewMode === "continuous" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"}`}
          >
            Continuous
          </button>
          <button
            onClick={() => onViewModeChange("two-page")}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${viewMode === "two-page" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"}`}
          >
            2-Page
          </button>
          <button
            onClick={() => onViewModeChange("grid")}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${viewMode === "grid" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"}`}
          >
            Grid
          </button>
        </div>
      </div>

      {/* Quick Action Bar (Scan, Import, Auto Deskew, Run OCR, Intelligence, Export) - div:nth-of-type(3) */}
      <div
        ref={quickActionBarRef}
        id="quick-action-bar"
        data-toolbar="quick-action-bar"
        className="flex items-center px-3 py-1.5 bg-neutral-850/80 text-xs overflow-x-auto custom-scrollbar border-b border-neutral-800/60 min-h-[38px] transition-colors"
      >
        {/* Fixed Left Anchor: Collapse / Expand Toggle Button */}
        {enableCollapse && (
          <div className="flex items-center space-x-1.5 flex-shrink-0 mr-1.5 select-none">
            <button
              id="quick-action-bar-collapse-btn"
              onClick={() => setIsToolbarCollapsed(!isToolbarCollapsed)}
              className={`p-1.5 rounded transition-all duration-200 flex items-center justify-center flex-shrink-0 ${
                isToolbarCollapsed
                  ? "bg-sky-600/30 text-sky-400 hover:bg-sky-600 hover:text-white border border-sky-500/50 shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent"
              }`}
              title={
                isToolbarCollapsed
                  ? "Expand Quick Action Toolbar (Left to Right)"
                  : "Collapse Quick Action Toolbar"
              }
              aria-label={isToolbarCollapsed ? "Expand Toolbar" : "Collapse Toolbar"}
            >
              {isToolbarCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5 transition-transform duration-200" />
              )}
            </button>

            {/* Collapsed State: Persistent Active Tool Badge */}
            {isToolbarCollapsed && (
              <button
                id="quick-action-bar-active-badge"
                onClick={() => setIsToolbarCollapsed(false)}
                className={`flex items-center space-x-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  activeTool === "crop"
                    ? "bg-sky-600/30 text-sky-300 border border-sky-500/50"
                    : activeTool === "redact-region"
                    ? "bg-rose-600/30 text-rose-300 border border-rose-500/50"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-750 hover:text-white border border-neutral-700"
                }`}
                title={`Selected tool: ${activeTool} — Click to expand toolbar`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeTool === "crop"
                      ? "bg-sky-400 animate-pulse"
                      : activeTool === "redact-region"
                      ? "bg-rose-400 animate-pulse"
                      : "bg-neutral-400"
                  }`}
                />
                <span className="capitalize">
                  {activeTool === "crop" ? "Crop Page" : activeTool === "redact-region" ? "Redact" : "Quick Actions"}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Collapsible Content: Collapses from Left to Right (Tools remain permanently mounted to preserve selection state) */}
        <div
          id="quick-action-bar-content"
          className={`flex items-center space-x-1.5 flex-nowrap transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            isToolbarCollapsed
              ? "max-w-0 opacity-0 pointer-events-none overflow-hidden scale-x-95 origin-left"
              : "max-w-[2400px] opacity-100 pointer-events-auto overflow-visible flex-1 scale-x-100 origin-left"
          }`}
          style={{
            transformOrigin: "left center",
            whiteSpace: "nowrap",
          }}
        >
          <button
            onClick={onOpenScanModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-sm transition-all active:scale-95 flex-shrink-0"
          >
            <Scan className="w-3.5 h-3.5" />
            <span>{t("action.scan", language)}</span>
          </button>

          <button
            onClick={onImportFile}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-all flex-shrink-0"
          >
            <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>{t("action.import", language)}</span>
          </button>

          <div className="h-4 w-px bg-neutral-750 mx-1 flex-shrink-0" />

          <button
            onClick={onOpenFilterStudio}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-gradient-to-r from-sky-900/60 to-indigo-900/60 hover:from-sky-800/80 hover:to-indigo-800/80 text-sky-200 font-medium border border-sky-700/50 transition-all shadow-sm flex-shrink-0"
            title="Open CamScanner Filter Studio"
          >
            <Palette className="w-3.5 h-3.5 text-sky-400" />
            <span>Filter Studio</span>
          </button>

          <button
            onClick={onOpenPhotoPrintStudio}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-gradient-to-r from-amber-900/50 to-orange-900/50 hover:from-amber-800/70 hover:to-orange-800/70 text-amber-200 font-medium border border-amber-700/50 transition-all shadow-sm flex-shrink-0"
            title="Open 4x6 Photo & Passport Print Studio"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>4×6" Print Studio</span>
          </button>

          {onOpenIdCardStudio && (
            <button
              onClick={onOpenIdCardStudio}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-gradient-to-r from-emerald-900/50 to-teal-900/50 hover:from-emerald-800/70 hover:to-teal-800/70 text-emerald-200 font-medium border border-emerald-700/50 transition-all shadow-sm flex-shrink-0"
              title="Open ID Card / CNIC Print Studio (A4, Letter & A6 Half-Card Layouts)"
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              <span>ID Card Studio</span>
            </button>
          )}

          {onOpenCropMode && (
            <button
              id="quick-action-crop-tool-btn"
              onClick={onOpenCropMode}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded font-medium transition-all border flex-shrink-0 ${
                activeTool === "crop"
                  ? "bg-sky-600 text-white border-sky-500 shadow-sm"
                  : "bg-neutral-800 hover:bg-neutral-700 text-sky-300 border-neutral-750"
              }`}
              title="Open Dedicated 8-Point Physical Page Crop Tool (C)"
            >
              <Crop className="w-3.5 h-3.5 text-sky-400" />
              <span>Crop Page</span>
            </button>
          )}

          <div className="h-4 w-px bg-neutral-750 mx-1 flex-shrink-0" />

          {onAutoEnhance && (
            <button
              onClick={onAutoEnhance}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-gradient-to-r from-sky-600/30 to-indigo-600/30 hover:from-sky-600/50 hover:to-indigo-600/50 text-sky-200 font-semibold border border-sky-500/40 transition-all shadow-sm flex-shrink-0"
              title="Run End-Level Adaptive Document Processing (Defect Diagnosis, Skew, Lighting & Quality Verification)"
            >
              <Wand2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Auto-Enhance</span>
            </button>
          )}

          <button
            onClick={onAutoDeskew}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-all flex-shrink-0"
            title="Auto calculate and deskew document angle"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>{t("action.autoDeskew", language)}</span>
          </button>

          <button
            onClick={onRunOcr}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-all flex-shrink-0"
            title="Run high-accuracy local OCR"
          >
            <FileSearch className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t("action.runOcr", language)}</span>
          </button>

          <button
            onClick={onAnalyzeIntelligence}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-gradient-to-r from-purple-900/60 to-indigo-900/60 hover:from-purple-800/80 hover:to-indigo-800/80 text-purple-200 font-medium border border-purple-700/50 transition-all shadow-sm flex-shrink-0"
            title="Autonomous Document Intelligence & Classification"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Document Intelligence</span>
          </button>

          <div className="h-4 w-px bg-neutral-750 mx-1 flex-shrink-0" />

          {onOpenDocumentConverter && (
            <button
              onClick={onOpenDocumentConverter}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-all shadow-sm flex-shrink-0"
              title="Open All-in-One Document Workspace & File Converter (Merge, Split, Word, Excel, PPT, Image)"
            >
              <Layers className="w-3.5 h-3.5 text-white" />
              <span>Workspace / Converter</span>
            </button>
          )}

          <button
            onClick={onOpenBatchStudio}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-all flex-shrink-0"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Batch Studio</span>
          </button>

          <button
            onClick={onOpenCompare}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-all flex-shrink-0"
          >
            <SplitSquareVertical className="w-3.5 h-3.5 text-emerald-400" />
            <span>Compare</span>
          </button>

          <button
            onClick={onOpenSecurity}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded font-medium transition-all flex-shrink-0 ${
              activeTool === "redact-region"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
            <span>Security / Redact</span>
          </button>

          {onOpenSplitPdf && (
            <button
              onClick={onOpenSplitPdf}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-all flex-shrink-0"
              title="Split PDF into multiple documents"
            >
              <Scissors className="w-3.5 h-3.5 text-sky-400" />
              <span>Split</span>
            </button>
          )}

          {onPrintDocument && (
            <button
              onClick={onPrintDocument}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-all flex-shrink-0"
              title="Print Document (Ctrl+P)"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Print</span>
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={onExportPdf}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm transition-all active:scale-95 ml-auto flex-shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t("action.export", language)}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
