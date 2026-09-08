/**
 * OMNISCAN TITAN X - Centralized Unified Background Studio & Compositing Modal
 * Complete Professional Multi-Layer Architecture:
 * - Non-Destructive State Model (Original Image + Alpha Foreground + Multi-Layer Background)
 * - Provider Abstraction (Local Biometric AI vs GitHub / Remote AI Backend)
 * - Background Color Selector (HEX, RGB, HSL, Swatches, Recents)
 * - Custom Background Image (JPG, PNG, WEBP, BMP, TIFF, SVG)
 * - Separate Background Transforms, Fit Modes (Contain, Cover, Fill, Center, Original) & Dedicated Crop
 * - Independent Foreground Subject Controls (Move, Scale, Rotate, Flip, Opacity)
 * - Manual Mask Refinement Brush (Add / Keep vs Erase / Remove)
 * - High-DPI Canvas Compositing Pipeline
 * - Full Undo / Redo History
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  BackgroundStudioState,
  BackgroundMode,
  DEFAULT_BACKGROUND_TRANSFORM,
  DEFAULT_FOREGROUND_TRANSFORM,
  STANDARD_BACKGROUND_PRESETS,
  BackgroundCrop,
  BackgroundRemovalResult,
} from "../../engine/background/types";
import { BackgroundCompositor } from "../../engine/background/BackgroundCompositor";
import { backgroundRemovalService } from "../../engine/background/BackgroundRemovalService";
import {
  DEFAULT_BG_REMOVAL_OPTIONS,
  BackgroundRemovalOptions,
  ManualBrushStroke,
  ShadowRemovalLevel,
} from "../../engine/backgroundRemover";
import { BackgroundColorPicker } from "./BackgroundColorPicker";
import { BackgroundImageControls } from "./BackgroundImageControls";
import { BackgroundCropModal } from "./BackgroundCropModal";
import { ForegroundSubjectControls } from "./ForegroundSubjectControls";
import { BackgroundProviderConfigDialog } from "./BackgroundProviderConfigDialog";
import {
  Wand2,
  Palette,
  Image as ImageIcon,
  User,
  ShieldCheck,
  Paintbrush,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  RefreshCw,
  Sliders,
  Settings,
  X,
  Check,
  RotateCcw,
  Layers,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

interface UnifiedBackgroundStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialImage: string;
  initialState?: Partial<BackgroundStudioState>;
  title?: string;
  subtitle?: string;
  onApply: (finalCompositeUrl: string, fullState: BackgroundStudioState) => void;
}

export const UnifiedBackgroundStudioModal: React.FC<UnifiedBackgroundStudioModalProps> = ({
  isOpen,
  onClose,
  initialImage,
  initialState,
  title = "Studio Background Editor & Compositor",
  subtitle = "Independent Multi-Layer Background Replacement • Local Biometric AI & GitHub Backend Integration",
  onApply,
}) => {
  // -------------------------------------------------------------
  // Non-Destructive Multi-Layer State
  // -------------------------------------------------------------
  const [state, setState] = useState<BackgroundStudioState>(() => {
    return {
      originalImage: initialImage,
      foregroundImage: initialState?.foregroundImage || null,
      backgroundMode: initialState?.backgroundMode || "color",
      backgroundColor: initialState?.backgroundColor || "#FFFFFF",
      backgroundGradient: initialState?.backgroundGradient,
      backgroundImage: initialState?.backgroundImage || null,
      backgroundImageName: initialState?.backgroundImageName,
      backgroundTransform: initialState?.backgroundTransform || { ...DEFAULT_BACKGROUND_TRANSFORM },
      backgroundCrop: initialState?.backgroundCrop || null,
      foregroundTransform: initialState?.foregroundTransform || { ...DEFAULT_FOREGROUND_TRANSFORM },
      manualStrokes: initialState?.manualStrokes || [],
      removalOptions: initialState?.removalOptions || { ...DEFAULT_BG_REMOVAL_OPTIONS },
      removalState: initialState?.removalState || {
        status: "idle",
        providerId: backgroundRemovalService.getActiveProviderId(),
        confidenceScore: 98,
      },
      compositePreviewUrl: null,
    };
  });

  // Re-sync if initialImage changes
  useEffect(() => {
    if (initialImage && initialImage !== state.originalImage) {
      setState((prev) => ({
        ...prev,
        originalImage: initialImage,
        foregroundImage: null,
      }));
    }
  }, [initialImage]);

  // Undo / Redo History Stacks
  const [history, setHistory] = useState<BackgroundStudioState[]>([]);
  const [future, setFuture] = useState<BackgroundStudioState[]>([]);

  const pushHistory = useCallback((newState: BackgroundStudioState) => {
    setHistory((prev) => [...prev.slice(-25), state]);
    setFuture([]);
    setState(newState);
  }, [state]);

  const commitHistory = useCallback(() => {
    setHistory((prev) => [...prev.slice(-25), state]);
    setFuture([]);
  }, [state]);

  const updateState = useCallback((updater: (prev: BackgroundStudioState) => BackgroundStudioState) => {
    setState((curr) => {
      const next = updater(curr);
      setHistory((h) => [...h.slice(-25), curr]);
      setFuture([]);
      return next;
    });
  }, []);

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, h.length - 1));
    setFuture((f) => [state, ...f]);
    setState(prev);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, state]);
    setState(next);
  };

  // -------------------------------------------------------------
  // View & UI Navigation Modes
  // -------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<"removal" | "color" | "image" | "foreground" | "presets">("removal");
  const [viewMode, setViewMode] = useState<"composite" | "transparent" | "mask" | "edge" | "original" | "split">("composite");
  const [splitSliderPos, setSplitSliderPos] = useState<number>(50);

  // Manual Mask Refinement Brush State
  const [manualRefineActive, setManualRefineActive] = useState<boolean>(false);
  const [brushAction, setBrushAction] = useState<"add" | "remove">("remove");
  const [brushRadius, setBrushRadius] = useState<number>(18);
  const [brushHardness, setBrushHardness] = useState<number>(0.5);
  const [isPainting, setIsPainting] = useState<boolean>(false);
  const [brushCursorPos, setBrushCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Crop Modal & Provider Config Dialog Modals
  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false);
  const [isProviderConfigOpen, setIsProviderConfigOpen] = useState<boolean>(false);

  // Interactive Preview Canvas
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);

  // -------------------------------------------------------------
  // Live Composite Render Loop
  // -------------------------------------------------------------
  const renderComposite = useCallback(async () => {
    if (!previewCanvasRef.current) return;
    try {
      await BackgroundCompositor.renderToCanvas(previewCanvasRef.current, state, {
        width: 800,
        height: 1000,
      });
    } catch (err) {
      console.warn("Error rendering preview composite:", err);
    }
  }, [state]);

  useEffect(() => {
    renderComposite();
  }, [renderComposite]);

  // -------------------------------------------------------------
  // Background Removal Execution
  // -------------------------------------------------------------
  const executeRemoval = async (
    optionsToUse = state.removalOptions,
    strokesToUse = state.manualStrokes
  ) => {
    const activeProvider = backgroundRemovalService.getActiveProvider();

    setState((prev) => ({
      ...prev,
      removalState: {
        ...prev.removalState,
        status: "processing",
        errorMessage: undefined,
      },
    }));

    try {
      const result: BackgroundRemovalResult = await backgroundRemovalService.executeRemoval({
        image: state.originalImage,
        options: {
          ...optionsToUse,
          manualStrokes: strokesToUse,
        },
      });

      setState((prev) => {
        const next: BackgroundStudioState = {
          ...prev,
          foregroundImage: result.transparentDataUrl,
          removalOptions: optionsToUse,
          manualStrokes: strokesToUse,
          removalState: {
            status: "completed",
            providerId: activeProvider.id,
            confidenceScore: result.confidenceScore,
            maskUrl: result.maskDataUrl,
            edgeUrl: result.edgeDataUrl,
            transparentUrl: result.transparentDataUrl,
          },
        };
        return next;
      });
    } catch (err: any) {
      console.error("Removal failure:", err);
      setState((prev) => ({
        ...prev,
        removalState: {
          ...prev.removalState,
          status: "failed",
          errorMessage: err.message || "Background removal failed.",
        },
      }));
    }
  };

  // Run removal on initial modal open if not yet processed
  useEffect(() => {
    if (isOpen && state.removalState.status === "idle" && !state.foregroundImage) {
      executeRemoval();
    }
  }, [isOpen]);

  // -------------------------------------------------------------
  // Manual Brush Point Addition
  // -------------------------------------------------------------
  const handleAddBrushPoint = (clientX: number, clientY: number, container: HTMLElement) => {
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const normRadius = brushRadius / Math.min(rect.width, rect.height);

    const stroke: ManualBrushStroke = {
      x: normX,
      y: normY,
      radius: normRadius,
      action: brushAction,
      hardness: brushHardness,
      opacity: 1.0,
    };

    const updatedStrokes = [...state.manualStrokes, stroke];
    setState((prev) => ({ ...prev, manualStrokes: updatedStrokes }));
    executeRemoval(state.removalOptions, updatedStrokes);
  };

  // -------------------------------------------------------------
  // Canvas Interactive Drag & Zoom Controls (Independent Layers)
  // -------------------------------------------------------------
  const isLayerDraggingRef = useRef<boolean>(false);
  const dragStartPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragInitialPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isLayerDragging, setIsLayerDragging] = useState<boolean>(false);

  const handleCanvasWheel = (e: React.WheelEvent) => {
    if (viewMode !== "composite") return;
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    if (activeTab === "image" && state.backgroundImage) {
      e.preventDefault();
      const currentScale = state.backgroundTransform.scale || 1;
      const nextScale = Math.max(0.1, Math.min(4, currentScale + delta));
      updateState((prev) => ({
        ...prev,
        backgroundTransform: {
          ...prev.backgroundTransform,
          scale: nextScale,
        },
      }));
    } else if (activeTab === "foreground" && (state.foregroundImage || state.originalImage)) {
      e.preventDefault();
      const currentScale = state.foregroundTransform.scale || 1;
      const nextScale = Math.max(0.2, Math.min(3, currentScale + delta));
      updateState((prev) => ({
        ...prev,
        foregroundTransform: {
          ...prev.foregroundTransform,
          scale: nextScale,
        },
      }));
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (manualRefineActive) {
      setIsPainting(true);
      handleAddBrushPoint(e.clientX, e.clientY, e.currentTarget);
      return;
    }

    if (viewMode !== "composite") return;

    if (activeTab === "image" && state.backgroundImage) {
      isLayerDraggingRef.current = true;
      dragStartPointRef.current = { x: e.clientX, y: e.clientY };
      dragInitialPosRef.current = {
        x: state.backgroundTransform.x,
        y: state.backgroundTransform.y,
      };
      setIsLayerDragging(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
    } else if (activeTab === "foreground" && (state.foregroundImage || state.originalImage)) {
      isLayerDraggingRef.current = true;
      dragStartPointRef.current = { x: e.clientX, y: e.clientY };
      dragInitialPosRef.current = {
        x: state.foregroundTransform.x,
        y: state.foregroundTransform.y,
      };
      setIsLayerDragging(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setBrushCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });

    if (manualRefineActive && isPainting) {
      handleAddBrushPoint(e.clientX, e.clientY, e.currentTarget);
      return;
    }

    if (!isLayerDraggingRef.current) return;

    const dx = e.clientX - dragStartPointRef.current.x;
    const dy = e.clientY - dragStartPointRef.current.y;

    if (activeTab === "image") {
      setState((prev) => ({
        ...prev,
        backgroundTransform: {
          ...prev.backgroundTransform,
          x: Math.round(dragInitialPosRef.current.x + dx),
          y: Math.round(dragInitialPosRef.current.y + dy),
        },
      }));
    } else if (activeTab === "foreground") {
      setState((prev) => ({
        ...prev,
        foregroundTransform: {
          ...prev.foregroundTransform,
          x: Math.round(dragInitialPosRef.current.x + dx),
          y: Math.round(dragInitialPosRef.current.y + dy),
        },
      }));
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (manualRefineActive) {
      setIsPainting(false);
      return;
    }

    if (isLayerDraggingRef.current) {
      isLayerDraggingRef.current = false;
      setIsLayerDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      commitHistory();
    }
  };

  // -------------------------------------------------------------
  // Apply & Export Action
  // -------------------------------------------------------------
  const handleApplyToStudio = async () => {
    try {
      const finalCompositeUrl = await BackgroundCompositor.renderToDataUrl(state, {
        width: 1200,
        height: 1500,
        exportFormat: state.backgroundMode === "transparent" ? "png" : "jpeg",
        exportQuality: 0.98,
      });
      onApply(finalCompositeUrl, state);
      onClose();
    } catch (err) {
      console.error("Could not export final composite:", err);
      alert("Failed to render background composite.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-lg flex items-center justify-center p-3 select-none animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl flex flex-col w-full max-w-6xl h-[92vh] overflow-hidden text-neutral-200">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-neutral-850">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                  {title}
                </h3>
                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[10px] text-emerald-300 font-semibold">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>
                    {state.removalState.status === "completed"
                      ? `${state.removalState.confidenceScore}% Biometric Validated`
                      : state.removalState.status === "processing"
                      ? "Analyzing Subject..."
                      : "Ready"}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-neutral-400">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Undo / Redo */}
            <div className="flex items-center bg-neutral-950 rounded-lg p-0.5 border border-neutral-800">
              <button
                onClick={handleUndo}
                disabled={history.length === 0}
                className="p-1.5 rounded text-neutral-400 hover:text-white disabled:opacity-30 hover:bg-neutral-800 transition-colors"
                title="Undo last change"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleRedo}
                disabled={future.length === 0}
                className="p-1.5 rounded text-neutral-400 hover:text-white disabled:opacity-30 hover:bg-neutral-800 transition-colors"
                title="Redo change"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            {/* Provider Configuration */}
            <button
              onClick={() => setIsProviderConfigOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center space-x-1.5 text-xs font-medium border border-neutral-700 transition-colors"
              title="Configure Local vs GitHub Background Removal Backend"
            >
              <Settings className="w-3.5 h-3.5 text-emerald-400" />
              <span>Provider: {backgroundRemovalService.getActiveProvider().name.split(" ")[0]}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workspace Body: 2 Columns */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: Live Interactive Preview Stage */}
          <div className="flex-1 bg-neutral-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* View Mode Switcher */}
            <div className="absolute top-3 inset-x-0 flex flex-col items-center z-20 space-y-2">
              <div className="flex bg-neutral-900/95 backdrop-blur-md p-1 rounded-lg border border-neutral-800 space-x-1 text-xs shadow-xl">
                <button
                  onClick={() => setViewMode("composite")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    viewMode === "composite"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Result Composite
                </button>
                <button
                  onClick={() => setViewMode("transparent")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    viewMode === "transparent"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Transparent Cutout
                </button>
                <button
                  onClick={() => setViewMode("mask")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    viewMode === "mask"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Matte Alpha Mask
                </button>
                <button
                  onClick={() => setViewMode("edge")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    viewMode === "edge"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Edge Boundary View
                </button>
                <button
                  onClick={() => setViewMode("original")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    viewMode === "original"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Original Source
                </button>
                <button
                  onClick={() => setViewMode("split")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    viewMode === "split"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Before / After Split
                </button>
              </div>

              {/* Manual Brush Floating Toolbar */}
              <div className="flex items-center bg-neutral-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neutral-800 space-x-3 text-xs shadow-lg">
                <button
                  onClick={() => setManualRefineActive(!manualRefineActive)}
                  className={`px-2 py-1 rounded font-semibold flex items-center space-x-1 transition-all ${
                    manualRefineActive
                      ? "bg-amber-600 text-white shadow ring-2 ring-amber-400/40"
                      : "bg-neutral-800 text-neutral-300 hover:text-white"
                  }`}
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  <span>Manual Retouch Brush</span>
                </button>

                {manualRefineActive && (
                  <div className="flex items-center space-x-2 animate-in fade-in duration-150">
                    <div className="flex bg-neutral-950 p-0.5 rounded border border-neutral-800">
                      <button
                        onClick={() => setBrushAction("add")}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center space-x-1 ${
                          brushAction === "add" ? "bg-emerald-600 text-white" : "text-neutral-400 hover:text-white"
                        }`}
                        title="Add subject pixels"
                      >
                        <Paintbrush className="w-3 h-3" />
                        <span>Keep</span>
                      </button>
                      <button
                        onClick={() => setBrushAction("remove")}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center space-x-1 ${
                          brushAction === "remove" ? "bg-rose-600 text-white" : "text-neutral-400 hover:text-white"
                        }`}
                        title="Erase background pixels"
                      >
                        <Eraser className="w-3 h-3" />
                        <span>Erase</span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-1 text-[10px]">
                      <span className="text-neutral-400">Size:</span>
                      <input
                        type="range"
                        min="6"
                        max="80"
                        value={brushRadius}
                        onChange={(e) => setBrushRadius(Number(e.target.value))}
                        className="w-16 accent-emerald-500 cursor-pointer"
                      />
                      <span className="font-mono text-emerald-400">{brushRadius}px</span>
                    </div>

                    {state.manualStrokes.length > 0 && (
                      <button
                        onClick={() => {
                          const updatedStrokes = state.manualStrokes.slice(0, -1);
                          setState((prev) => ({ ...prev, manualStrokes: updatedStrokes }));
                          executeRemoval(state.removalOptions, updatedStrokes);
                        }}
                        className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
                        title="Undo last stroke"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Canvas Stage Viewport */}
            {state.removalState.status === "processing" ? (
              <div className="flex flex-col items-center space-y-3 text-neutral-400">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                <span className="text-xs font-semibold text-neutral-200">
                  Segmenting subject & matting hair contours...
                </span>
                <span className="text-[10px] text-neutral-400">
                  Using {backgroundRemovalService.getActiveProvider().name}
                </span>
              </div>
            ) : state.removalState.status === "failed" ? (
              <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-5 max-w-md text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
                <h4 className="font-bold text-white text-sm">Background Removal Failed</h4>
                <p className="text-xs text-rose-200">{state.removalState.errorMessage}</p>
                <div className="flex items-center justify-center space-x-2 pt-2">
                  <button
                    onClick={() => executeRemoval()}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => setIsProviderConfigOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs"
                  >
                    Configure Provider
                  </button>
                </div>
              </div>
            ) : (
              <div
                onWheel={handleCanvasWheel}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerLeave={() => {
                  if (manualRefineActive) setIsPainting(false);
                  if (isLayerDraggingRef.current) {
                    isLayerDraggingRef.current = false;
                    setIsLayerDragging(false);
                    commitHistory();
                  }
                  setBrushCursorPos(null);
                }}
                className={`relative max-w-full max-h-full flex items-center justify-center ${
                  manualRefineActive
                    ? "cursor-crosshair"
                    : isLayerDragging
                    ? "cursor-grabbing"
                    : (activeTab === "image" && state.backgroundImage) ||
                      (activeTab === "foreground" && (state.foregroundImage || state.originalImage))
                    ? "cursor-grab"
                    : ""
                }`}
              >
                {/* Floating Interactive Canvas Layer HUD */}
                {viewMode === "composite" && !manualRefineActive && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-neutral-900/90 backdrop-blur border border-neutral-700/80 rounded-full px-3 py-1 text-[10px] text-neutral-300 flex items-center space-x-2 shadow-lg">
                    {activeTab === "image" && state.backgroundImage ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Background Image Active: <strong className="text-white">Drag to Pan</strong> • <strong className="text-white">Scroll to Zoom</strong> ({Math.round((state.backgroundTransform.scale || 1) * 100)}%)</span>
                      </>
                    ) : activeTab === "foreground" ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                        <span>Foreground Subject Active: <strong className="text-white">Drag to Pan</strong> • <strong className="text-white">Scroll to Zoom</strong> ({Math.round((state.foregroundTransform.scale || 1) * 100)}%)</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                        <span>Select Background Image or Foreground tab to drag and zoom layers</span>
                      </>
                    )}
                  </div>
                )}
                {/* Virtual Brush Cursor Ring */}
                {manualRefineActive && brushCursorPos && (
                  <div
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed z-30 transition-none"
                    style={{
                      left: brushCursorPos.x,
                      top: brushCursorPos.y,
                      width: brushRadius * 2,
                      height: brushRadius * 2,
                      borderColor: brushAction === "add" ? "#10B981" : "#F43F5E",
                      backgroundColor:
                        brushAction === "add"
                          ? "rgba(16, 185, 129, 0.15)"
                          : "rgba(244, 63, 94, 0.15)",
                    }}
                  />
                )}

                {/* View Modes Selection */}
                {viewMode === "transparent" ? (
                  <div
                    className="p-1 rounded-lg border border-neutral-700 shadow-2xl max-h-[64vh] max-w-[48vw] overflow-hidden"
                    style={{
                      backgroundImage: `repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 50% / 16px 16px`,
                    }}
                  >
                    <img
                      src={state.foregroundImage || state.originalImage}
                      alt="Transparent Cutout"
                      className="max-h-[62vh] max-w-[46vw] object-contain block pointer-events-none"
                    />
                  </div>
                ) : viewMode === "mask" ? (
                  <div className="p-1 rounded-lg border border-neutral-700 shadow-2xl bg-black max-h-[64vh] max-w-[48vw]">
                    <img
                      src={state.removalState.maskUrl || state.originalImage}
                      alt="Matte Alpha Mask"
                      className="max-h-[62vh] max-w-[46vw] object-contain block pointer-events-none"
                    />
                  </div>
                ) : viewMode === "edge" ? (
                  <div className="p-1 rounded-lg border border-cyan-500/40 shadow-2xl bg-neutral-950 max-h-[64vh] max-w-[48vw]">
                    <img
                      src={state.removalState.edgeUrl || state.originalImage}
                      alt="Edge Boundary View"
                      className="max-h-[62vh] max-w-[46vw] object-contain block pointer-events-none"
                    />
                  </div>
                ) : viewMode === "original" ? (
                  <div className="p-1 rounded-lg border border-neutral-700 shadow-2xl bg-neutral-900 max-h-[64vh] max-w-[48vw]">
                    <img
                      src={state.originalImage}
                      alt="Original Source"
                      className="max-h-[62vh] max-w-[46vw] object-contain block pointer-events-none"
                    />
                  </div>
                ) : viewMode === "split" ? (
                  <div className="relative p-1 rounded-lg border border-neutral-700 shadow-2xl overflow-hidden max-h-[64vh] max-w-[48vw]">
                    <canvas
                      ref={previewCanvasRef}
                      className="max-h-[62vh] max-w-[46vw] object-contain block"
                    />
                    {/* Clipped Original Overlay */}
                    <div
                      className="absolute inset-0 overflow-hidden border-r-2 border-emerald-400"
                      style={{ width: `${splitSliderPos}%` }}
                    >
                      <img
                        src={state.originalImage}
                        alt="Original Source"
                        className="max-h-[62vh] max-w-[46vw] object-contain block h-full w-auto"
                      />
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 rounded text-[9px] font-bold text-white">
                        ORIGINAL
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-500/50 rounded text-[9px] font-bold text-emerald-300">
                      COMPOSITE
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={splitSliderPos}
                      onChange={(e) => setSplitSliderPos(Number(e.target.value))}
                      className="absolute bottom-2 inset-x-4 accent-emerald-500 cursor-ew-resize z-20"
                    />
                  </div>
                ) : (
                  <div
                    className="p-1 rounded-lg border border-neutral-700 shadow-2xl max-h-[64vh] max-w-[48vw] overflow-hidden"
                    style={{
                      backgroundColor:
                        state.backgroundMode === "transparent" ? "transparent" : state.backgroundColor,
                      backgroundImage:
                        state.backgroundMode === "transparent"
                          ? `repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 50% / 16px 16px`
                          : undefined,
                    }}
                  >
                    <canvas
                      ref={previewCanvasRef}
                      className="max-h-[62vh] max-w-[46vw] object-contain block"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Independent Layer & Processing Controls */}
          <div className="w-96 bg-neutral-900 border-l border-neutral-800 flex flex-col overflow-hidden text-xs">
            {/* Layer Tabs Navigation */}
            <div className="flex border-b border-neutral-800 bg-neutral-950 p-1 space-x-1">
              <button
                onClick={() => setActiveTab("removal")}
                className={`flex-1 py-1.5 rounded text-[11px] font-bold flex items-center justify-center space-x-1 transition-colors ${
                  activeTab === "removal"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Removal</span>
              </button>
              <button
                onClick={() => setActiveTab("color")}
                className={`flex-1 py-1.5 rounded text-[11px] font-bold flex items-center justify-center space-x-1 transition-colors ${
                  activeTab === "color"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Color</span>
              </button>
              <button
                onClick={() => setActiveTab("image")}
                className={`flex-1 py-1.5 rounded text-[11px] font-bold flex items-center justify-center space-x-1 transition-colors ${
                  activeTab === "image"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Backdrop</span>
              </button>
              <button
                onClick={() => setActiveTab("foreground")}
                className={`flex-1 py-1.5 rounded text-[11px] font-bold flex items-center justify-center space-x-1 transition-colors ${
                  activeTab === "foreground"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Subject</span>
              </button>
            </div>

            {/* Tab Panels Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              {/* TAB 1: BACKGROUND REMOVAL & MATTING CONTROLS */}
              {activeTab === "removal" && (
                <div className="space-y-4">
                  {/* Background Mode Selector */}
                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      Active Background Mode
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: "color", label: "Solid Color" },
                          { id: "image", label: "Custom Image" },
                          { id: "transparent", label: "Transparent" },
                          { id: "original", label: "Original Photo" },
                          { id: "gradient", label: "Gradient" },
                          { id: "preset", label: "ICAO Preset" },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            pushHistory({ ...state, backgroundMode: m.id });
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border text-center transition-all ${
                            state.backgroundMode === m.id
                              ? "bg-emerald-950/60 border-emerald-400 text-white font-bold ring-1 ring-emerald-500/40"
                              : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Re-Analyze Subject Button */}
                  <button
                    onClick={() => executeRemoval()}
                    disabled={state.removalState.status === "processing"}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center space-x-2 transition-colors shadow"
                  >
                    <Wand2 className="w-4 h-4" />
                    <span>Re-Analyze & Segment Subject</span>
                  </button>

                  {/* Shadow Removal Level Selector */}
                  <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider">
                        Auto Shadow Removal
                      </span>
                      <span className="text-[10px] text-emerald-400 uppercase font-mono">
                        {state.removalOptions.shadowRemovalLevel}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {(["off", "low", "medium", "high"] as ShadowRemovalLevel[]).map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => {
                            const updated = {
                              ...state.removalOptions,
                              shadowRemovalLevel: lvl,
                              shadowHandling: lvl !== "off",
                            };
                            setState((prev) => ({ ...prev, removalOptions: updated }));
                            executeRemoval(updated);
                          }}
                          className={`py-1 rounded text-[10px] font-bold uppercase transition-colors ${
                            state.removalOptions.shadowRemovalLevel === lvl
                              ? "bg-emerald-600 text-white"
                              : "bg-neutral-900 text-neutral-400 hover:text-white"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Precision Sliders */}
                  <div className="space-y-3 bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      Matting & Boundary Tuning
                    </div>

                    {/* Sensitivity */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-neutral-300">Tolerance Sensitivity</span>
                        <span className="font-mono text-emerald-400">
                          {state.removalOptions.sensitivity}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="90"
                        value={state.removalOptions.sensitivity}
                        onChange={(e) => {
                          const updated = { ...state.removalOptions, sensitivity: Number(e.target.value) };
                          setState((prev) => ({ ...prev, removalOptions: updated }));
                        }}
                        onMouseUp={() => executeRemoval()}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    {/* Edge Feather */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-neutral-300">Edge Feather (Softness)</span>
                        <span className="font-mono text-emerald-400">
                          {state.removalOptions.edgeFeather}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="12"
                        value={state.removalOptions.edgeFeather}
                        onChange={(e) => {
                          const updated = { ...state.removalOptions, edgeFeather: Number(e.target.value) };
                          setState((prev) => ({ ...prev, removalOptions: updated }));
                        }}
                        onMouseUp={() => executeRemoval()}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    {/* Edge Shift */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-neutral-300">Edge Shift (Erode / Expand)</span>
                        <span className="font-mono text-emerald-400">
                          {state.removalOptions.edgeShift}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-6"
                        max="6"
                        value={state.removalOptions.edgeShift}
                        onChange={(e) => {
                          const updated = { ...state.removalOptions, edgeShift: Number(e.target.value) };
                          setState((prev) => ({ ...prev, removalOptions: updated }));
                        }}
                        onMouseUp={() => executeRemoval()}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    {/* Hair Matting Toggle */}
                    <div className="flex items-center justify-between pt-1 border-t border-neutral-850">
                      <span className="text-neutral-300 text-[11px]">Fine Hair Matting</span>
                      <input
                        type="checkbox"
                        checked={state.removalOptions.hairDetailPreservation}
                        onChange={(e) => {
                          const updated = { ...state.removalOptions, hairDetailPreservation: e.target.checked };
                          setState((prev) => ({ ...prev, removalOptions: updated }));
                          executeRemoval(updated);
                        }}
                        className="accent-emerald-500 w-4 h-4 rounded"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: BACKGROUND COLOR SYSTEM */}
              {activeTab === "color" && (
                <BackgroundColorPicker
                  color={state.backgroundColor}
                  onChange={(hex) => {
                    pushHistory({
                      ...state,
                      backgroundMode: "color",
                      backgroundColor: hex,
                    });
                  }}
                  onReset={() => {
                    pushHistory({
                      ...state,
                      backgroundMode: "color",
                      backgroundColor: "#FFFFFF",
                    });
                  }}
                />
              )}

              {/* TAB 3: CUSTOM BACKGROUND IMAGE & TRANSFORMS */}
              {activeTab === "image" && (
                <div className="space-y-3">
                  <BackgroundImageControls
                    backgroundImage={state.backgroundImage}
                    imageName={state.backgroundImageName}
                    transform={state.backgroundTransform}
                    onImageLoaded={(dataUrl, name) => {
                      pushHistory({
                        ...state,
                        backgroundMode: "image",
                        backgroundImage: dataUrl,
                        backgroundImageName: name,
                      });
                    }}
                    onTransformChange={(updated) => {
                      setState((prev) => ({
                        ...prev,
                        backgroundMode: "image",
                        backgroundTransform: updated,
                      }));
                    }}
                    onResetTransform={() => {
                      pushHistory({
                        ...state,
                        backgroundTransform: { ...DEFAULT_BACKGROUND_TRANSFORM },
                      });
                    }}
                    onRemoveImage={() => {
                      pushHistory({
                        ...state,
                        backgroundImage: null,
                        backgroundImageName: undefined,
                        backgroundMode: "color",
                      });
                    }}
                    onOpenCrop={() => setIsCropModalOpen(true)}
                  />
                </div>
              )}

              {/* TAB 4: INDEPENDENT FOREGROUND CONTROLS */}
              {activeTab === "foreground" && (
                <ForegroundSubjectControls
                  transform={state.foregroundTransform}
                  onChange={(updated) => {
                    setState((prev) => ({ ...prev, foregroundTransform: updated }));
                  }}
                  onReset={() => {
                    pushHistory({
                      ...state,
                      foregroundTransform: { ...DEFAULT_FOREGROUND_TRANSFORM },
                    });
                  }}
                  hasTransparentSubject={Boolean(state.foregroundImage)}
                />
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-950 space-y-2">
              <button
                onClick={handleApplyToStudio}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-lg"
              >
                <Check className="w-4 h-4" />
                <span>Apply to Studio Photo</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    pushHistory({
                      ...state,
                      backgroundMode: "original",
                      foregroundImage: null,
                      manualStrokes: [],
                    });
                  }}
                  className="py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-lg flex items-center justify-center space-x-1 border border-neutral-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Original</span>
                </button>
                <button
                  onClick={onClose}
                  className="py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-400 hover:text-white rounded-lg border border-neutral-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Background Image Crop Modal */}
      {state.backgroundImage && (
        <BackgroundCropModal
          isOpen={isCropModalOpen}
          onClose={() => setIsCropModalOpen(false)}
          imageSrc={state.backgroundImage}
          initialCrop={state.backgroundCrop}
          onApplyCrop={(croppedDataUrl, cropDef) => {
            pushHistory({
              ...state,
              backgroundImage: croppedDataUrl,
              backgroundCrop: cropDef,
            });
          }}
        />
      )}

      {/* Background Removal Provider Config Dialog */}
      <BackgroundProviderConfigDialog
        isOpen={isProviderConfigOpen}
        onClose={() => setIsProviderConfigOpen(false)}
        onProviderChanged={() => {
          setState((prev) => ({
            ...prev,
            removalState: {
              ...prev.removalState,
              providerId: backgroundRemovalService.getActiveProviderId(),
            },
          }));
        }}
      />
    </div>
  );
};
