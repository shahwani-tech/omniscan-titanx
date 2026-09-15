import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RotateCw,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Keyboard,
  Sparkles,
} from "lucide-react";

export interface StudioStep {
  id: string;
  label: string;
  shortLabel?: string;
  description?: string;
  icon?: React.ReactNode;
  isCompleted?: boolean;
  isLocked?: boolean;
  lockReason?: string;
  badge?: string;
}

export interface ShortcutItem {
  key: string;
  description: string;
}

export interface UnifiedStudioShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badgeText?: string;
  badgeVariant?: "sky" | "indigo" | "emerald" | "amber";
  icon?: React.ReactNode;

  // Step Navigation
  steps: StudioStep[];
  activeStepId: string;
  onSelectStep: (stepId: string) => void;

  // Header extras
  modeSwitcher?: React.ReactNode;
  headerExtraActions?: React.ReactNode;

  // Panels
  leftPanel?: React.ReactNode;
  leftPanelTitle?: string;
  leftPanelWidth?: string; // e.g. "w-80", "w-84", "w-96"
  leftPanelCollapsible?: boolean;

  centerContent: React.ReactNode;

  rightPanel?: React.ReactNode;
  rightPanelTitle?: string;
  rightPanelWidth?: string;
  rightPanelCollapsible?: boolean;
  defaultRightPanelOpen?: boolean;

  // Footer bar
  footerLeft?: React.ReactNode;
  footerCenter?: React.ReactNode;
  footerRight?: React.ReactNode;

  // Unsaved changes protection
  isDirty?: boolean;
  dirtyWarningMessage?: string;

  // Shortcuts & Actions
  shortcuts?: ShortcutItem[];
  onUndo?: () => void;
  onRedo?: () => void;
  onRotateCW?: () => void;
  onRotateCCW?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onFitZoom?: () => void;
  onPrimaryAction?: () => void;
}

const DEFAULT_SHORTCUTS: ShortcutItem[] = [
  { key: "Tab / Shift+Tab", description: "Next / Previous step" },
  { key: "Ctrl + S", description: "Primary action / Print / Export" },
  { key: "Ctrl + Z", description: "Undo adjustments" },
  { key: "Ctrl + Shift + Z", description: "Redo adjustments" },
  { key: "R", description: "Rotate 90° clockwise" },
  { key: "Shift + R", description: "Rotate 90° counter-clockwise" },
  { key: "+ / -", description: "Zoom in / Zoom out" },
  { key: "Ctrl + 0", description: "Fit to canvas" },
  { key: "?", description: "Toggle keyboard shortcuts help" },
  { key: "Esc", description: "Close studio modal" },
];

export const UnifiedStudioShell: React.FC<UnifiedStudioShellProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badgeText,
  badgeVariant = "sky",
  icon,
  steps,
  activeStepId,
  onSelectStep,
  modeSwitcher,
  headerExtraActions,
  leftPanel,
  leftPanelTitle,
  leftPanelWidth = "w-80",
  leftPanelCollapsible = true,
  centerContent,
  rightPanel,
  rightPanelTitle,
  rightPanelWidth = "w-80",
  rightPanelCollapsible = true,
  defaultRightPanelOpen = true,
  footerLeft,
  footerCenter,
  footerRight,
  isDirty = false,
  dirtyWarningMessage = "You have adjustments or edits in this studio session that will be discarded.",
  shortcuts = DEFAULT_SHORTCUTS,
  onUndo,
  onRedo,
  onRotateCW,
  onRotateCCW,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitZoom,
  onPrimaryAction,
}) => {
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(defaultRightPanelOpen);
  const [showDirtyConfirm, setShowDirtyConfirm] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Safe close handler that checks isDirty
  const handleRequestClose = useCallback(() => {
    if (isDirty) {
      setShowDirtyConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const handleConfirmDiscard = () => {
    setShowDirtyConfirm(false);
    onClose();
  };

  // Find step index for navigation
  const currentStepIndex = steps.findIndex((s) => s.id === activeStepId);

  const handleStepNext = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      const nextStep = steps[currentStepIndex + 1];
      if (!nextStep.isLocked) {
        onSelectStep(nextStep.id);
      }
    }
  }, [currentStepIndex, steps, onSelectStep]);

  const handleStepPrev = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevStep = steps[currentStepIndex - 1];
      if (!prevStep.isLocked) {
        onSelectStep(prevStep.id);
      }
    }
  }, [currentStepIndex, steps, onSelectStep]);

  // Global Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
        } else if (showDirtyConfirm) {
          setShowDirtyConfirm(false);
        } else {
          handleRequestClose();
        }
        return;
      }

      if (isInput) return;

      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (onPrimaryAction) onPrimaryAction();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          if (onRedo) onRedo();
        } else {
          if (onUndo) onUndo();
        }
        return;
      }

      if (e.key === "r" || e.key === "R") {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          if (e.shiftKey) {
            if (onRotateCCW) onRotateCCW();
          } else {
            if (onRotateCW) onRotateCW();
          }
          return;
        }
      }

      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        if (onZoomIn) onZoomIn();
        return;
      }

      if (e.key === "-") {
        e.preventDefault();
        if (onZoomOut) onZoomOut();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        if (onFitZoom) onFitZoom();
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          handleStepPrev();
        } else {
          handleStepNext();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    isOpen,
    showShortcutsModal,
    showDirtyConfirm,
    handleRequestClose,
    onPrimaryAction,
    onUndo,
    onRedo,
    onRotateCW,
    onRotateCCW,
    onZoomIn,
    onZoomOut,
    onFitZoom,
    handleStepNext,
    handleStepPrev,
  ]);

  if (!isOpen) return null;

  const BADGE_COLOR_MAP = {
    sky: "bg-sky-950 text-sky-300 border-sky-700/60",
    indigo: "bg-indigo-950 text-indigo-300 border-indigo-700/60",
    emerald: "bg-emerald-950 text-emerald-300 border-emerald-700/60",
    amber: "bg-amber-950 text-amber-300 border-amber-700/60",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-3 select-none animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-[1720px] h-[96vh] bg-neutral-900 border border-neutral-750 rounded-2xl shadow-2xl overflow-hidden relative">
        {/* ========================================================= */}
        {/* TOP UNIFIED HEADER BAR                                    */}
        {/* ========================================================= */}
        <header className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-950/90 shrink-0">
          {/* Left: Studio Identity */}
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              {icon || <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                  {title}
                </h2>
                {badgeText && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                      BADGE_COLOR_MAP[badgeVariant] || BADGE_COLOR_MAP.sky
                    }`}
                  >
                    {badgeText}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-[11px] text-neutral-400 truncate max-w-xl">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Center-Left: Mode Switcher (e.g. ID Card <-> A6 Duplex) */}
          {modeSwitcher && (
            <div className="hidden lg:flex items-center mx-2">{modeSwitcher}</div>
          )}

          {/* Center: Unified Hybrid Step Navigation Bar */}
          <div className="flex items-center bg-neutral-900/90 p-1 rounded-xl border border-neutral-800 space-x-1 shadow-inner">
            {steps.map((step, idx) => {
              const isActive = step.id === activeStepId;
              const isClickable = !step.isLocked;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => isClickable && onSelectStep(step.id)}
                  disabled={step.isLocked}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-sky-600 text-white shadow-md font-semibold"
                      : step.isCompleted
                      ? "text-emerald-300 hover:text-white hover:bg-neutral-800/80"
                      : step.isLocked
                      ? "text-neutral-500 opacity-50 cursor-not-allowed"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-800/80"
                  }`}
                  title={
                    step.isLocked
                      ? step.lockReason || "Complete previous steps first"
                      : step.description || step.label
                  }
                >
                  {/* Step Status Indicator */}
                  {step.isLocked ? (
                    <Lock className="w-3 h-3 text-neutral-500" />
                  ) : step.isCompleted && !isActive ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : step.icon ? (
                    step.icon
                  ) : (
                    <span
                      className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                        isActive
                          ? "bg-white text-sky-700"
                          : "bg-neutral-800 text-neutral-300"
                      }`}
                    >
                      {idx + 1}
                    </span>
                  )}

                  <span>{step.label}</span>

                  {step.badge && (
                    <span className="px-1 py-0.2 rounded text-[9px] bg-neutral-800 text-neutral-300 font-mono">
                      {step.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right: Actions, Help & Close */}
          <div className="flex items-center space-x-2">
            {headerExtraActions}

            {/* Keyboard Shortcuts Help */}
            <button
              type="button"
              onClick={() => setShowShortcutsModal(true)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-neutral-800" />

            {/* Close Modal Button */}
            <button
              type="button"
              onClick={handleRequestClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Close Studio (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ========================================================= */}
        {/* MAIN WORKSPACE (3-Panel Layout)                           */}
        {/* ========================================================= */}
        <div className="flex flex-1 min-h-0 overflow-hidden relative">
          {/* LEFT PANEL */}
          {leftPanel && isLeftPanelOpen && (
            <aside
              className={`${leftPanelWidth} bg-neutral-900/95 border-r border-neutral-800 flex flex-col shrink-0 overflow-y-auto custom-scrollbar text-xs z-10 transition-all`}
            >
              {leftPanelTitle && (
                <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between text-neutral-300 font-semibold text-xs">
                  <span>{leftPanelTitle}</span>
                  {leftPanelCollapsible && (
                    <button
                      type="button"
                      onClick={() => setIsLeftPanelOpen(false)}
                      className="text-neutral-400 hover:text-white p-0.5 rounded"
                      title="Collapse Left Panel"
                    >
                      <PanelLeftClose className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
              <div className="p-3 space-y-4 flex-1">{leftPanel}</div>
            </aside>
          )}

          {/* Left Panel Expand Toggle (when collapsed) */}
          {leftPanel && !isLeftPanelOpen && (
            <button
              type="button"
              onClick={() => setIsLeftPanelOpen(true)}
              className="absolute left-2 top-2 z-20 p-2 rounded-lg bg-neutral-900/90 border border-neutral-750 text-neutral-400 hover:text-white hover:bg-neutral-800 shadow-xl"
              title="Expand Left Panel"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}

          {/* CENTER VIEWPORT / CANVAS WORKSPACE */}
          <main className="flex-1 flex flex-col bg-neutral-950 overflow-hidden relative">
            {centerContent}
          </main>

          {/* RIGHT PANEL (Collapsible) */}
          {rightPanel && isRightPanelOpen && (
            <aside
              className={`${rightPanelWidth} bg-neutral-900/95 border-l border-neutral-800 flex flex-col shrink-0 overflow-y-auto custom-scrollbar text-xs z-10 transition-all`}
            >
              {rightPanelTitle && (
                <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between text-neutral-300 font-semibold text-xs">
                  <span>{rightPanelTitle}</span>
                  {rightPanelCollapsible && (
                    <button
                      type="button"
                      onClick={() => setIsRightPanelOpen(false)}
                      className="text-neutral-400 hover:text-white p-0.5 rounded"
                      title="Collapse Right Panel"
                    >
                      <PanelRightClose className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
              <div className="p-3 space-y-4 flex-1">{rightPanel}</div>
            </aside>
          )}

          {/* Right Panel Expand Toggle (when collapsed) */}
          {rightPanel && !isRightPanelOpen && (
            <button
              type="button"
              onClick={() => setIsRightPanelOpen(true)}
              className="absolute right-2 top-2 z-20 p-2 rounded-lg bg-neutral-900/90 border border-neutral-750 text-neutral-400 hover:text-white hover:bg-neutral-800 shadow-xl"
              title="Expand Right Panel"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ========================================================= */}
        {/* UNIFIED BOTTOM FOOTER BAR                                 */}
        {/* ========================================================= */}
        {(footerLeft || footerCenter || footerRight) && (
          <footer className="h-14 bg-neutral-950/95 border-t border-neutral-800 px-4 flex items-center justify-between text-xs shrink-0 select-none z-10">
            <div className="flex items-center space-x-2">{footerLeft}</div>
            <div className="flex items-center space-x-2 text-neutral-400">
              {footerCenter}
            </div>
            <div className="flex items-center space-x-2">{footerRight}</div>
          </footer>
        )}

        {/* ========================================================= */}
        {/* UNSAVED WORK CONFIRMATION DIALOG                          */}
        {/* ========================================================= */}
        {showDirtyConfirm && (
          <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Discard Unsaved Changes?
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {dirtyWarningMessage}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDirtyConfirm(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDiscard}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow"
                >
                  Discard and Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* KEYBOARD SHORTCUTS HELP MODAL                             */}
        {/* ========================================================= */}
        {showShortcutsModal && (
          <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center space-x-2 text-white font-bold text-sm">
                  <Keyboard className="w-4 h-4 text-sky-400" />
                  <span>Studio Keyboard Shortcuts</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShortcutsModal(false)}
                  className="text-neutral-400 hover:text-white p-1 rounded hover:bg-neutral-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                {shortcuts.map((sc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-neutral-950/60 border border-neutral-800/80 text-xs"
                  >
                    <span className="text-neutral-300">{sc.description}</span>
                    <kbd className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[11px] text-sky-300 shadow-sm">
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowShortcutsModal(false)}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
