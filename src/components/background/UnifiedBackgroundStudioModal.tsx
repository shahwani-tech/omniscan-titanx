/**
 * OMNISCAN TITAN X - Unified Background Studio & Two-Layer Compositor
 * Professional Multi-Layer Architecture:
 * - Layer 1 (Bottom): Draggable, zoomable background layer (image, color, gradient, pattern)
 * - Layer 2 (Top): Fixed, centered foreground subject layer (cropped transparent PNG)
 * - Non-Destructive Live Compositor & Offscreen Web Worker rendering
 * - Biometric Guidelines Overlay (Face Oval, Eye Line, Shoulder, Crown, Headroom %)
 * - Collapsible 3-Column UI (Left Controls, Center Canvas, Right Subject & Export)
 * - 50-step Undo/Redo & Comprehensive Keyboard Shortcuts
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  BackgroundStudioState,
  BackgroundMode,
  DEFAULT_BACKGROUND_TRANSFORM,
  DEFAULT_FOREGROUND_TRANSFORM,
  BackgroundGradient,
  ImageFitMode,
} from "../../engine/background/types";
import { BackgroundCompositor } from "../../engine/background/BackgroundCompositor";
import { toast } from "../../services/toast/toastService";
import { backgroundRemovalService } from "../../engine/background/BackgroundRemovalService";
import {
  ShadowRemovalLevel,
} from "../../engine/backgroundRemover";
import { BackgroundColorPicker } from "./BackgroundColorPicker";
import { BackgroundImageControls } from "./BackgroundImageControls";
import { BackgroundGradientPicker } from "./BackgroundGradientPicker";
import { BackgroundCropModal } from "./BackgroundCropModal";
import { ForegroundSubjectControls } from "./ForegroundSubjectControls";
import { BackgroundProviderConfigDialog } from "./BackgroundProviderConfigDialog";
import { BuiltinBackgroundLibrary } from "./BuiltinBackgroundLibrary";
import { SmartBackgroundSuggestions } from "./SmartBackgroundSuggestions";
import { BiometricGuideOverlay } from "./BiometricGuideOverlay";
import { BuiltinPattern } from "../../engine/background/patterns";
import {
  detectImageTransparency,
  TransparencyCheckResult,
} from "../../utils/transparencyDetector";
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
  Info,
  Cpu,
  CheckCircle2,
  UploadCloud,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Eye,
  EyeOff,
  SplitSquareVertical,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";

interface UnifiedBackgroundStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialImage: string; // The cropped photo from PhotoPrintStudioModal
  onApply: (finalCompositeUrl: string, fullState: BackgroundStudioState) => void;
  title?: string;
  subtitle?: string;
}

export const UnifiedBackgroundStudioModal: React.FC<UnifiedBackgroundStudioModalProps> = ({
  isOpen,
  onClose,
  initialImage,
  onApply,
  title = "Passport Photo Background Composer",
  subtitle = "Two-Layer Studio: Position background freely behind your centered passport portrait",
}) => {
  // -------------------------------------------------------------
  // Primary State Engine
  // -------------------------------------------------------------
  const [state, setState] = useState<BackgroundStudioState>(() => ({
    originalImage: initialImage,
    foregroundImage: null,
    backgroundMode: "transparent",
    backgroundColor: "#FFFFFF",
    backgroundGradient: {
      type: "linear",
      color1: "#FFFFFF",
      color2: "#E2E8F0",
      angle: 180,
    },
    backgroundImage: null,
    backgroundImageName: undefined,
    backgroundTransform: { ...DEFAULT_BACKGROUND_TRANSFORM },
    foregroundTransform: { ...DEFAULT_FOREGROUND_TRANSFORM },
    removalOptions: {
      algorithm: "hybrid",
      edgeFeathering: 1.5,
      hairMatting: true,
      shadowHandling: true,
      shadowRemovalLevel: "medium",
      contrastBoost: 1.0,
      spillSuppression: true,
    },
    manualStrokes: [],
    removalState: {
      status: "idle",
      confidenceScore: 98,
      providerId: "local",
    },
    originalHasTransparency: false,
  }));

  // Transparency check result cache
  const [transparencyResult, setTransparencyResult] = useState<TransparencyCheckResult | null>(null);
  const [isCheckingTransparency, setIsCheckingTransparency] = useState<boolean>(false);

  // Hidden source file input
  const sourceFileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize with initialImage when modal opens or prop updates
  useEffect(() => {
    if (initialImage) {
      setState((prev) => ({
        ...prev,
        originalImage: initialImage,
        foregroundImage: prev.originalHasTransparency ? initialImage : prev.foregroundImage,
      }));
    }
  }, [initialImage]);

  // -------------------------------------------------------------
  // Undo / Redo History Stacks (50 Steps)
  // -------------------------------------------------------------
  const [history, setHistory] = useState<BackgroundStudioState[]>([]);
  const [future, setFuture] = useState<BackgroundStudioState[]>([]);

  const pushHistory = useCallback((newState: BackgroundStudioState) => {
    setHistory((prev) => [...prev.slice(-49), state]);
    setFuture([]);
    setState(newState);
  }, [state]);

  const commitHistory = useCallback(() => {
    setHistory((prev) => [...prev.slice(-49), state]);
    setFuture([]);
  }, [state]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, h.length - 1));
    setFuture((f) => [state, ...f]);
    setState(prev);
    toast.info("Undo");
  }, [history, state]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, state]);
    setState(next);
    toast.info("Redo");
  }, [future, state]);

  // Restore Original Clean Crop Handler
  const handleRestoreOriginalCrop = () => {
    const isTrans = Boolean(transparencyResult?.hasTransparency || state.originalHasTransparency);
    pushHistory({
      ...state,
      backgroundMode: isTrans ? "transparent" : "original",
      foregroundImage: isTrans ? state.originalImage : null,
      backgroundImage: null,
      backgroundImageName: undefined,
      manualStrokes: [],
      backgroundTransform: { ...DEFAULT_BACKGROUND_TRANSFORM },
      foregroundTransform: { ...DEFAULT_FOREGROUND_TRANSFORM },
      removalState: {
        status: "idle",
        confidenceScore: 98,
        providerId: state.removalState.providerId,
      },
    });
    setLeftTab("image");
    toast.info("Reset to original clean transparent crop.");
  };

  // -------------------------------------------------------------
  // UI Layout & Collapsible Panels
  // -------------------------------------------------------------
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState<boolean>(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);
  const [leftTab, setLeftTab] = useState<"image" | "library" | "color" | "gradient" | "transparent">("image");
  const [rightTab, setRightTab] = useState<"subject" | "removal">("subject");

  // View Modes & Overlays
  const [viewMode, setViewMode] = useState<"composite" | "split" | "transparent">("composite");
  const [splitSliderPos, setSplitSliderPos] = useState<number>(50);
  const [showBiometricGuides, setShowBiometricGuides] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Manual Mask Refinement Brush State
  const [manualRefineActive, setManualRefineActive] = useState<boolean>(false);
  const [brushAction, setBrushAction] = useState<"add" | "remove">("remove");
  const [brushRadius, setBrushRadius] = useState<number>(18);

  // Modals
  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false);
  const [isProviderConfigOpen, setIsProviderConfigOpen] = useState<boolean>(false);

  // -------------------------------------------------------------
  // Dragging & Zooming State (60fps CSS transform)
  // -------------------------------------------------------------
  const [isDraggingBg, setIsDraggingBg] = useState<boolean>(false);
  const isDraggingBgRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentBgPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const bgLayerRef = useRef<HTMLDivElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const rAFRef = useRef<number | null>(null);

  // -------------------------------------------------------------
  // Background Removal Execution
  // -------------------------------------------------------------
  const executeRemoval = async (
    optionsToUse = state.removalOptions,
    strokesToUse = state.manualStrokes
  ) => {
    if (state.removalState.status === "processing") return;

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
      const result = await backgroundRemovalService.executeRemoval({
        image: state.originalImage,
        options: {
          ...optionsToUse,
          manualStrokes: strokesToUse,
        },
      });

      setState((prev) => ({
        ...prev,
        foregroundImage: result.transparentDataUrl,
        removalOptions: optionsToUse,
        manualStrokes: strokesToUse,
        backgroundMode: prev.backgroundMode === "original" ? "transparent" : prev.backgroundMode,
        removalState: {
          status: "completed",
          providerId: activeProvider.id,
          confidenceScore: result.confidenceScore,
          maskUrl: result.maskDataUrl,
          edgeUrl: result.edgeDataUrl,
          transparentUrl: result.transparentDataUrl,
        },
      }));
      toast.success("Subject cutout extracted!");
    } catch (err: any) {
      console.error("Removal failure:", err);
      const isUnconfigured =
        Boolean(err.isUnconfigured) ||
        err.message?.includes("isn't set up yet") ||
        err.message?.includes("not configured") ||
        err.status === 503;

      setState((prev) => ({
        ...prev,
        removalState: {
          ...prev.removalState,
          status: "failed",
          isUnconfigured,
          errorMessage: isUnconfigured
            ? "AI background removal isn't configured yet."
            : (err.message || "Background removal failed."),
        },
      }));
    }
  };

  // Smart Transparency Detection: Detects transparent PNGs automatically!
  useEffect(() => {
    if (!isOpen || !state.originalImage) return;

    let isMounted = true;
    setIsCheckingTransparency(true);

    detectImageTransparency(state.originalImage)
      .then((result) => {
        if (!isMounted) return;
        setIsCheckingTransparency(false);
        setTransparencyResult(result);

        if (result.hasTransparency) {
          setState((prev) => ({
            ...prev,
            originalHasTransparency: true,
            foregroundImage: prev.foregroundImage || prev.originalImage,
            backgroundMode:
              prev.backgroundMode === "original" ? "transparent" : prev.backgroundMode,
          }));
        }
      })
      .catch(() => {
        if (isMounted) setIsCheckingTransparency(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, state.originalImage]);

  // -------------------------------------------------------------
  // Pointer Event Handlers for 60fps Background Drag
  // -------------------------------------------------------------
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag background if not painting manual brush strokes
    if (manualRefineActive) return;

    isDraggingBgRef.current = true;
    setIsDraggingBg(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragOriginRef.current = {
      x: state.backgroundTransform.x,
      y: state.backgroundTransform.y,
    };
    currentBgPosRef.current = { ...dragOriginRef.current };

    // Capture pointer
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingBgRef.current) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const newX = dragOriginRef.current.x + dx;
    const newY = dragOriginRef.current.y + dy;

    currentBgPosRef.current = { x: newX, y: newY };

    // High performance 60fps CSS transform update via rAF
    if (!rAFRef.current) {
      rAFRef.current = requestAnimationFrame(() => {
        if (bgLayerRef.current) {
          const t = state.backgroundTransform;
          const sx = (t.scale || 1) * (t.scaleX || 1);
          const sy = (t.scale || 1) * (t.scaleY || 1);
          const rot = t.rotation || 0;
          bgLayerRef.current.style.transform = `translate3d(${currentBgPosRef.current.x}px, ${currentBgPosRef.current.y}px, 0px) scale(${sx}, ${sy}) rotate(${rot}deg)`;
        }
        rAFRef.current = null;
      });
    }
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingBgRef.current) return;
    isDraggingBgRef.current = false;
    setIsDraggingBg(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (rAFRef.current) {
      cancelAnimationFrame(rAFRef.current);
      rAFRef.current = null;
    }

    // Commit to React state and history
    pushHistory({
      ...state,
      backgroundTransform: {
        ...state.backgroundTransform,
        x: Math.round(currentBgPosRef.current.x),
        y: Math.round(currentBgPosRef.current.y),
      },
    });
  };

  // Mouse wheel zoom centered on cursor
  const handleStageWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (manualRefineActive) return;
    e.preventDefault();

    const currentScale = state.backgroundTransform.scale || 1;
    const factor = e.deltaY < 0 ? 1.06 : 0.94;
    const newScale = Math.max(0.5, Math.min(5.0, currentScale * factor));

    setState((prev) => ({
      ...prev,
      backgroundTransform: {
        ...prev.backgroundTransform,
        scale: Number(newScale.toFixed(3)),
      },
    }));
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Ctrl+0: Fit background to canvas
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        pushHistory({
          ...state,
          backgroundTransform: {
            ...state.backgroundTransform,
            fitMode: "cover",
            x: 0,
            y: 0,
            scale: 1,
          },
        });
        toast.info("Fit background to canvas");
        return;
      }

      // R / r: Reset background transform
      if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        pushHistory({
          ...state,
          backgroundTransform: { ...DEFAULT_BACKGROUND_TRANSFORM },
        });
        toast.info("Reset background position & zoom");
        return;
      }

      // Delete / Backspace: Remove background image
      if ((e.key === "Delete" || e.key === "Backspace") && state.backgroundImage) {
        e.preventDefault();
        pushHistory({
          ...state,
          backgroundImage: null,
          backgroundImageName: undefined,
          backgroundMode: "transparent",
        });
        toast.info("Removed background image");
        return;
      }

      // + / =: Zoom in background
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        const cur = state.backgroundTransform.scale || 1;
        const nxt = Math.min(5, Number((cur * 1.08).toFixed(2)));
        pushHistory({
          ...state,
          backgroundTransform: { ...state.backgroundTransform, scale: nxt },
        });
        return;
      }

      // - / _: Zoom out background
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        const cur = state.backgroundTransform.scale || 1;
        const nxt = Math.max(0.5, Number((cur * 0.92).toFixed(2)));
        pushHistory({
          ...state,
          backgroundTransform: { ...state.backgroundTransform, scale: nxt },
        });
        return;
      }

      // Arrow keys: Nudge background
      const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (arrowKeys.includes(e.key) && state.backgroundImage) {
        e.preventDefault();
        const step = e.ctrlKey || e.metaKey ? 0.2 : e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (e.key === "ArrowUp") dy = -step;
        if (e.key === "ArrowDown") dy = step;
        if (e.key === "ArrowLeft") dx = -step;
        if (e.key === "ArrowRight") dx = step;

        setState((prev) => ({
          ...prev,
          backgroundTransform: {
            ...prev.backgroundTransform,
            x: prev.backgroundTransform.x + dx,
            y: prev.backgroundTransform.y + dy,
          },
        }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, state, handleUndo, handleRedo, pushHistory]);

  // -------------------------------------------------------------
  // Final Export Handlers
  // -------------------------------------------------------------
  const handleApplyToStudio = async () => {
    try {
      const isTransparentBg = state.backgroundMode === "transparent";
      const finalCompositeUrl = await BackgroundCompositor.renderToDataUrl(state, {
        width: 1200,
        height: 1500,
        exportFormat: isTransparentBg ? "png" : "jpeg",
        exportQuality: 0.98,
      });
      onApply(finalCompositeUrl, state);
      onClose();
    } catch (err) {
      console.error("Could not export final composite:", err);
      toast.error("Failed to render background composite.");
    }
  };

  const handleExportPNG = async () => {
    try {
      const url = await BackgroundCompositor.renderToDataUrl(state, {
        width: 1200,
        height: 1500,
        exportFormat: "png",
      });
      const link = document.createElement("a");
      link.download = "passport-photo-composite.png";
      link.href = url;
      link.click();
      toast.success("Exported transparent PNG.");
    } catch {
      toast.error("Export PNG failed.");
    }
  };

  const handleExportJPG = async () => {
    try {
      const url = await BackgroundCompositor.renderToDataUrl(state, {
        width: 1200,
        height: 1500,
        exportFormat: "jpeg",
        exportQuality: 0.98,
        forceSolidBackgroundForPrint: true,
      });
      const link = document.createElement("a");
      link.download = "passport-photo-composite.jpg";
      link.href = url;
      link.click();
      toast.success("Exported high-res JPG.");
    } catch {
      toast.error("Export JPG failed.");
    }
  };

  // Compute CSS filter string for background layer
  const bgTransform = state.backgroundTransform;
  const filterParts: string[] = [];
  if (bgTransform.blur && bgTransform.blur > 0) {
    filterParts.push(`blur(${bgTransform.blur}px)`);
  }
  if (bgTransform.brightness !== undefined && bgTransform.brightness !== 0) {
    filterParts.push(`brightness(${1 + bgTransform.brightness / 100})`);
  }
  if (bgTransform.contrast !== undefined && bgTransform.contrast !== 0) {
    filterParts.push(`contrast(${1 + bgTransform.contrast / 100})`);
  }
  if (bgTransform.saturation !== undefined && bgTransform.saturation !== 0) {
    filterParts.push(`saturate(${1 + bgTransform.saturation / 100})`);
  }
  if (bgTransform.temperature !== undefined && bgTransform.temperature !== 0) {
    if (bgTransform.temperature > 0) {
      filterParts.push(`sepia(${bgTransform.temperature * 0.35}%)`);
    } else {
      filterParts.push(`hue-rotate(${bgTransform.temperature * 0.25}deg)`);
    }
  }
  const bgFilterCss = filterParts.length > 0 ? filterParts.join(" ") : undefined;

  // Background fit mode object-fit mapping
  const objectFitStyle: React.CSSProperties["objectFit"] =
    bgTransform.fitMode === "contain"
      ? "contain"
      : bgTransform.fitMode === "stretch"
      ? "fill"
      : bgTransform.fitMode === "center"
      ? "none"
      : "cover";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-black/95 backdrop-blur-md flex items-center justify-center p-2 select-none animate-in fade-in duration-150">
      <div className="bg-neutral-925 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col w-full max-w-[98vw] h-[96vh] overflow-hidden text-neutral-200">
        {/* TOP MODAL HEADER */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-neutral-800 bg-neutral-900">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {title}
                </h3>
                {isCheckingTransparency ? (
                  <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-[10px] text-neutral-400">
                    <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                    <span>Checking Transparency...</span>
                  </div>
                ) : transparencyResult?.hasTransparency || state.originalHasTransparency ? (
                  <div className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-[10px] text-emerald-300 font-bold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Transparent Subject Active</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-[10px] text-neutral-400">
                    <span>Opaque Portrait</span>
                  </div>
                )}
                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-neutral-850 border border-neutral-750 text-[10px] text-neutral-300 font-mono">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Two-Layer Composition</span>
                </div>
              </div>
              <p className="text-[11px] text-neutral-400">{subtitle}</p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center space-x-2">
            {/* Upload/Replace Photo */}
            <input
              ref={sourceFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  const dataUrl = evt.target?.result as string;
                  if (dataUrl) {
                    setState((prev) => ({
                      ...prev,
                      originalImage: dataUrl,
                      foregroundImage: null,
                      backgroundMode: "original",
                      manualStrokes: [],
                    }));
                  }
                };
                reader.readAsDataURL(file);
                e.target.value = "";
              }}
            />

            <button
              type="button"
              onClick={() => sourceFileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white flex items-center space-x-1.5 text-xs font-medium border border-neutral-700 transition-colors"
              title="Replace source photo"
            >
              <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>Replace Photo</span>
            </button>

            {/* Restore Original Clean Crop */}
            <button
              type="button"
              onClick={handleRestoreOriginalCrop}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-amber-300 hover:text-amber-200 flex items-center space-x-1.5 text-xs font-medium border border-neutral-700 transition-colors"
              title="Revert to initial clean transparent crop"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset to Crop</span>
            </button>

            {/* Provider Configuration */}
            <button
              type="button"
              onClick={() => setIsProviderConfigOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white flex items-center space-x-1.5 text-xs font-medium border border-neutral-700 transition-colors"
              title="Configure Background Removal Engine"
            >
              <Settings className="w-3.5 h-3.5 text-emerald-400" />
              <span>AI Engine</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3-COLUMN STUDIO WORKSPACE */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* ========================================================= */}
          {/* 1. LEFT PANEL (Collapsible Controls)                      */}
          {/* ========================================================= */}
          {isLeftPanelOpen && (
            <div className="w-84 md:w-92 bg-neutral-900 border-r border-neutral-800 flex flex-col overflow-hidden text-xs shrink-0 animate-in slide-in-from-left duration-200">
              {/* Left Panel Tabs */}
              <div className="p-2 border-b border-neutral-800 bg-neutral-950">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block px-1 mb-1.5">
                  Background Layer Mode
                </span>
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { id: "image", label: "Image" },
                    { id: "library", label: "Library" },
                    { id: "color", label: "Solid" },
                    { id: "gradient", label: "Gradient" },
                    { id: "transparent", label: "None" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setLeftTab(tab.id as any);
                        if (tab.id === "transparent") {
                          pushHistory({ ...state, backgroundMode: "transparent" });
                        } else if (tab.id === "color") {
                          pushHistory({ ...state, backgroundMode: "color" });
                        } else if (tab.id === "gradient") {
                          pushHistory({ ...state, backgroundMode: "gradient" });
                        } else if (tab.id === "image" || tab.id === "library") {
                          if (state.backgroundImage) {
                            pushHistory({ ...state, backgroundMode: "image" });
                          }
                        }
                      }}
                      className={`py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all border ${
                        leftTab === tab.id
                          ? "bg-emerald-600 border-emerald-500 text-white shadow"
                          : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Left Panel Body Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-4">
                {/* 1. Custom Image Controls (Upload, 5 Fit options, Adjustments, Scale, Pan) */}
                {leftTab === "image" && (
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
                        backgroundMode: "transparent",
                      });
                      setLeftTab("transparent");
                    }}
                    onOpenCrop={() => setIsCropModalOpen(true)}
                  />
                )}

                {/* 2. Built-in Background Library (Solid Standard, Studio Gradients, Pattern Backdrops) */}
                {leftTab === "library" && (
                  <BuiltinBackgroundLibrary
                    currentMode={state.backgroundMode}
                    currentColor={state.backgroundColor}
                    currentGradient={state.backgroundGradient}
                    currentImage={state.backgroundImage}
                    onSelectColor={(hex, name) => {
                      pushHistory({
                        ...state,
                        backgroundMode: "color",
                        backgroundColor: hex,
                      });
                      toast.success(`Applied ${name}`);
                    }}
                    onSelectGradient={(grad, name) => {
                      pushHistory({
                        ...state,
                        backgroundMode: "gradient",
                        backgroundGradient: grad,
                      });
                      toast.success(`Applied ${name}`);
                    }}
                    onSelectPattern={(pat) => {
                      pushHistory({
                        ...state,
                        backgroundMode: "image",
                        backgroundImage: pat.dataUrl,
                        backgroundImageName: pat.name,
                        backgroundTransform: {
                          ...state.backgroundTransform,
                          fitMode: pat.fitMode,
                          x: 0,
                          y: 0,
                          scale: 1,
                        },
                      });
                      toast.success(`Applied ${pat.name}`);
                    }}
                  />
                )}

                {/* 3. Solid Background Color Picker */}
                {leftTab === "color" && (
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

                {/* 4. Background Gradient Picker */}
                {leftTab === "gradient" && (
                  <BackgroundGradientPicker
                    gradient={state.backgroundGradient}
                    onChange={(grad) => {
                      pushHistory({
                        ...state,
                        backgroundMode: "gradient",
                        backgroundGradient: grad,
                      });
                    }}
                  />
                )}

                {/* 5. Transparent / None Card */}
                {leftTab === "transparent" && (
                  <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Transparent Canvas</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono">
                        PNG Export
                      </span>
                    </div>
                    <div
                      className="h-28 rounded-lg border border-neutral-800 flex flex-col items-center justify-center p-3 text-center"
                      style={{
                        backgroundImage: `repeating-conic-gradient(#262626 0% 25%, #171717 0% 50%) 50% / 16px 16px`,
                      }}
                    >
                      <div className="bg-neutral-900/95 px-3 py-1.5 rounded-lg border border-neutral-700 text-[11px] text-neutral-200 shadow font-semibold">
                        Pure Alpha Cutout
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1.5">
                        Zero background pixels. Exports as an isolated transparent passport subject.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. CENTER PANEL (Live Interactive Two-Layer Canvas)       */}
          {/* ========================================================= */}
          <div className="flex-1 bg-neutral-950 flex flex-col relative overflow-hidden">
            {/* Top Canvas Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 bg-neutral-900/90 border-b border-neutral-800 z-20">
              {/* Left Panel Toggle & History Controls */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-colors"
                  title={isLeftPanelOpen ? "Collapse Left Panel" : "Expand Left Panel"}
                >
                  {isLeftPanelOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                </button>

                {/* Undo / Redo */}
                <div className="flex items-center bg-neutral-950 rounded-lg p-0.5 border border-neutral-800">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    className="p-1.5 rounded text-neutral-400 hover:text-white disabled:opacity-25 hover:bg-neutral-800 transition-colors"
                    title={`Undo (${history.length} steps)`}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={future.length === 0}
                    className="p-1.5 rounded text-neutral-400 hover:text-white disabled:opacity-25 hover:bg-neutral-800 transition-colors"
                    title={`Redo (${future.length} steps)`}
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Center Viewport Toggles (Biometric Guides, Split View, Cutout View) */}
              <div className="flex items-center space-x-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowBiometricGuides(!showBiometricGuides)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center space-x-1 transition-colors ${
                    showBiometricGuides
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  }`}
                  title="Toggle ICAO Biometric Guide Overlay (Eye line, face oval, headroom)"
                >
                  {showBiometricGuides ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>Biometric Guides</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === "split" ? "composite" : "split")}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center space-x-1 transition-colors ${
                    viewMode === "split"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  }`}
                  title="Toggle Before/After Split Comparison"
                >
                  <SplitSquareVertical className="w-3.5 h-3.5" />
                  <span>Split View</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === "transparent" ? "composite" : "transparent")}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center space-x-1 transition-colors ${
                    viewMode === "transparent"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-neutral-400 hover:text-white"
                  }`}
                  title="View transparent cutout alpha channel"
                >
                  <span>Cutout Only</span>
                </button>
              </div>

              {/* Right Zoom & Panel Toggle */}
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 bg-neutral-950 px-2 py-1 rounded-lg border border-neutral-800 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.6, Number((z - 0.1).toFixed(1))))}
                    className="text-neutral-400 hover:text-white p-0.5"
                    title="Zoom Out Stage"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <span className="w-10 text-center text-neutral-300">{Math.round(zoomLevel * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(2.0, Number((z + 0.1).toFixed(1))))}
                    className="text-neutral-400 hover:text-white p-0.5"
                    title="Zoom In Stage"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1)}
                    className="text-neutral-500 hover:text-white ml-1 text-[9px]"
                    title="Reset Stage Zoom (100%)"
                  >
                    Reset
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
                  className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-colors"
                  title={isRightPanelOpen ? "Collapse Right Panel" : "Expand Right Panel"}
                >
                  {isRightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Interactive Canvas Viewport */}
            <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-neutral-950">
              {/* Floating Layer Status HUD */}
              {viewMode === "composite" && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-neutral-900/90 backdrop-blur-md border border-neutral-750 rounded-full px-3.5 py-1 text-[10px] text-neutral-300 flex items-center space-x-2 shadow-xl">
                  {state.backgroundImage ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>
                        Background Layer: <strong className="text-white">Drag anywhere to pan</strong> • <strong className="text-white">Scroll to zoom</strong> ({Math.round((state.backgroundTransform.scale || 1) * 100)}%)
                      </span>
                    </>
                  ) : state.backgroundMode === "color" ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      <span>Solid Background: <strong className="text-white">{state.backgroundColor}</strong> • Subject fixed in center</span>
                    </>
                  ) : state.backgroundMode === "gradient" ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      <span>Studio Gradient Active • Subject fixed in center</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-neutral-400" />
                      <span>Transparent Mode • Subject cutout on transparent alpha canvas</span>
                    </>
                  )}
                </div>
              )}

              {/* THE TWO-LAYER COMPOSITOR STAGE */}
              <div
                ref={stageContainerRef}
                onPointerDown={handleStagePointerDown}
                onPointerMove={handleStagePointerMove}
                onPointerUp={handleStagePointerUp}
                onWheel={handleStageWheel}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: "center center",
                }}
                className={`relative w-[360px] h-[450px] sm:w-[400px] sm:h-[500px] rounded-xl border border-neutral-700 shadow-2xl overflow-hidden select-none transition-transform duration-75 ${
                  manualRefineActive
                    ? "cursor-crosshair"
                    : isDraggingBg
                    ? "cursor-grabbing"
                    : state.backgroundImage
                    ? "cursor-grab"
                    : "cursor-default"
                }`}
              >
                {/* Checkerboard transparency grid base */}
                <div
                  className="absolute inset-0 z-0 pointer-events-none"
                  style={{
                    backgroundImage: `repeating-conic-gradient(#262626 0% 25%, #171717 0% 50%) 50% / 16px 16px`,
                  }}
                />

                {/* ======================================================= */}
                {/* LAYER 1 (Bottom): Background Layer                     */}
                {/* ======================================================= */}
                <div
                  ref={bgLayerRef}
                  className="absolute inset-0 z-1 pointer-events-none flex items-center justify-center will-change-transform"
                  style={{
                    transform: `translate3d(${state.backgroundTransform.x}px, ${state.backgroundTransform.y}px, 0px) scale(${(state.backgroundTransform.scale || 1) * (state.backgroundTransform.scaleX || 1)}, ${(state.backgroundTransform.scale || 1) * (state.backgroundTransform.scaleY || 1)}) rotate(${state.backgroundTransform.rotation || 0}deg)`,
                    filter: bgFilterCss,
                    opacity: state.backgroundTransform.opacity ?? 1,
                  }}
                >
                  {state.backgroundMode === "image" && state.backgroundImage ? (
                    state.backgroundTransform.fitMode === "tile" ? (
                      <div
                        className="w-full h-full"
                        style={{
                          backgroundImage: `url("${state.backgroundImage}")`,
                          backgroundRepeat: "repeat",
                          backgroundSize: "contain",
                        }}
                      />
                    ) : (
                      <img
                        src={state.backgroundImage}
                        alt="Background layer"
                        style={{ objectFit: objectFitStyle }}
                        className="w-full h-full block select-none pointer-events-none"
                        draggable={false}
                      />
                    )
                  ) : state.backgroundMode === "color" ? (
                    <div
                      className="w-full h-full"
                      style={{ backgroundColor: state.backgroundColor }}
                    />
                  ) : state.backgroundMode === "gradient" && state.backgroundGradient ? (
                    <div
                      className="w-full h-full"
                      style={{
                        background:
                          state.backgroundGradient.type === "linear"
                            ? `linear-gradient(${state.backgroundGradient.angle}deg, ${state.backgroundGradient.color1}, ${state.backgroundGradient.color2})`
                            : `radial-gradient(circle, ${state.backgroundGradient.color1} 0%, ${state.backgroundGradient.color2} 100%)`,
                      }}
                    />
                  ) : null}
                </div>

                {/* ======================================================= */}
                {/* LAYER 2 (Top): Foreground Subject (Fixed Cutout)        */}
                {/* ======================================================= */}
                <div
                  className="absolute inset-0 z-2 pointer-events-none flex items-center justify-center select-none"
                  style={{
                    transform: `translate3d(${state.foregroundTransform.x}px, ${state.foregroundTransform.y}px, 0px) scale(${(state.foregroundTransform.scale || 1) * (state.foregroundTransform.scaleX || 1)}, ${(state.foregroundTransform.scale || 1) * (state.foregroundTransform.scaleY || 1)}) rotate(${state.foregroundTransform.rotation || 0}deg)`,
                    opacity: state.foregroundTransform.opacity ?? 1,
                  }}
                >
                  <img
                    src={state.foregroundImage || state.originalImage}
                    alt="Foreground Subject Cutout"
                    className="w-full h-full object-contain pointer-events-none select-none block"
                    draggable={false}
                  />
                </div>

                {/* Split Comparison Overlay (if active) */}
                {viewMode === "split" && (
                  <div
                    className="absolute inset-0 z-10 overflow-hidden border-r-2 border-emerald-400 pointer-events-none"
                    style={{ width: `${splitSliderPos}%` }}
                  >
                    <img
                      src={state.originalImage}
                      alt="Original Reference"
                      className="w-[400px] h-[500px] object-contain max-w-none block bg-black/60"
                    />
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-bold text-white uppercase tracking-wider">
                      Original
                    </div>
                  </div>
                )}

                {/* Biometric Guide Guidelines Overlay */}
                {showBiometricGuides && (
                  <BiometricGuideOverlay
                    subjectYOffset={state.foregroundTransform.y}
                    subjectScale={state.foregroundTransform.scale || 1}
                  />
                )}
              </div>

              {/* Split Slider Controller Bar */}
              {viewMode === "split" && (
                <div className="absolute bottom-10 inset-x-12 z-30 flex items-center justify-center">
                  <div className="bg-neutral-900/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-neutral-700 shadow-xl flex items-center space-x-3 w-80">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase">Original</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={splitSliderPos}
                      onChange={(e) => setSplitSliderPos(Number(e.target.value))}
                      className="flex-1 accent-emerald-500 cursor-ew-resize h-1 bg-neutral-750 rounded"
                    />
                    <span className="text-[10px] text-emerald-400 font-bold uppercase">Composite</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Keyboard Shortcuts & Help Bar */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-neutral-900 border-t border-neutral-800 text-[10px] text-neutral-400">
              <div className="flex items-center space-x-3">
                <span>🖱️ <strong>Drag</strong> to Pan BG</span>
                <span>🔍 <strong>Wheel</strong> to Zoom (50%-500%)</span>
                <span>⌨️ <strong>Arrow Keys</strong>: 1px (Shift: 10px)</span>
                <span><strong>Ctrl+0</strong>: Fit</span>
                <span><strong>R</strong>: Reset</span>
                <span><strong>Del</strong>: Remove BG</span>
              </div>
              <div className="text-neutral-500 font-mono text-[9px]">
                OmniScan Studio Composite Engine
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3. RIGHT PANEL (Subject Fine-Tune, Suggestions & Export)  */}
          {/* ========================================================= */}
          {isRightPanelOpen && (
            <div className="w-80 md:w-88 bg-neutral-900 border-l border-neutral-800 flex flex-col overflow-hidden text-xs shrink-0 animate-in slide-in-from-right duration-200">
              {/* Primary Action Buttons Header */}
              <div className="p-3 border-b border-neutral-800 bg-neutral-950 space-y-2">
                <button
                  type="button"
                  onClick={handleApplyToStudio}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center space-x-2 transition-all shadow-lg hover:shadow-emerald-900/40 text-xs"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Apply to Photo Print Studio</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleExportPNG}
                    className="py-1.5 px-2 rounded-lg bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 text-neutral-200 hover:text-white flex items-center justify-center space-x-1.5 font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Export PNG</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportJPG}
                    className="py-1.5 px-2 rounded-lg bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 text-neutral-200 hover:text-white flex items-center justify-center space-x-1.5 font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>Export JPG</span>
                  </button>
                </div>
              </div>

              {/* Right Panel Sub-tabs */}
              <div className="flex border-b border-neutral-800 bg-neutral-950 p-1 space-x-1">
                <button
                  type="button"
                  onClick={() => setRightTab("subject")}
                  className={`flex-1 py-1.5 rounded text-[11px] font-bold flex items-center justify-center space-x-1.5 transition-colors ${
                    rightTab === "subject"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Subject & Smart</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab("removal")}
                  className={`flex-1 py-1.5 rounded text-[11px] font-bold flex items-center justify-center space-x-1.5 transition-colors ${
                    rightTab === "removal"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>AI Removal / Matte</span>
                </button>
              </div>

              {/* Right Panel Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 space-y-4">
                {rightTab === "subject" ? (
                  <>
                    {/* Foreground Subject Controls (Headroom vertical offset & fine scale) */}
                    <ForegroundSubjectControls
                      transform={state.foregroundTransform}
                      onChange={(updated) => {
                        setState((prev) => ({
                          ...prev,
                          foregroundTransform: updated,
                        }));
                      }}
                      onReset={() => {
                        pushHistory({
                          ...state,
                          foregroundTransform: { ...DEFAULT_FOREGROUND_TRANSFORM },
                        });
                      }}
                      hasTransparentSubject={Boolean(state.foregroundImage || transparencyResult?.hasTransparency)}
                    />

                    {/* Smart Background Suggestions (Skin tone & passport standards) */}
                    <SmartBackgroundSuggestions
                      subjectImage={state.foregroundImage || state.originalImage}
                      currentColor={state.backgroundColor}
                      onApplySuggestion={(hex, label) => {
                        pushHistory({
                          ...state,
                          backgroundMode: "color",
                          backgroundColor: hex,
                        });
                        toast.success(`Applied ${label} (${hex})`);
                      }}
                    />
                  </>
                ) : (
                  <>
                    {/* AI Background Removal Execution Card */}
                    <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          AI Subject Segmentation
                        </span>
                        {state.removalState.status === "completed" && (
                          <span className="text-[10px] text-emerald-400 font-mono">
                            {state.removalState.confidenceScore}% Matched
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => executeRemoval()}
                        disabled={state.removalState.status === "processing"}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg flex items-center justify-center space-x-2 transition-colors shadow"
                      >
                        <Wand2 className="w-4 h-4" />
                        <span>
                          {state.removalState.status === "processing"
                            ? "Analyzing & Extracting Subject..."
                            : state.foregroundImage
                            ? "Re-Run Subject Segmentation"
                            : "Extract Transparent Cutout"}
                        </span>
                      </button>

                      <p className="text-[10px] text-neutral-400 leading-relaxed">
                        Processes hair matting and border contours to isolate the subject on an alpha transparent canvas.
                      </p>
                    </div>

                    {/* Auto Shadow Removal Level */}
                    <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider">
                          Shadow Removal Level
                        </span>
                        <span className="text-[10px] text-emerald-400 uppercase font-mono">
                          {state.removalOptions.shadowRemovalLevel}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {(["off", "low", "medium", "high"] as ShadowRemovalLevel[]).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
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
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Background Crop Modal (for fine-cropping background images) */}
      {isCropModalOpen && state.backgroundImage && (
        <BackgroundCropModal
          isOpen={isCropModalOpen}
          onClose={() => setIsCropModalOpen(false)}
          imageUrl={state.backgroundImage}
          initialCrop={state.backgroundTransform.crop}
          aspectRatio={4 / 5}
          onApplyCrop={(croppedUrl, cropRect) => {
            pushHistory({
              ...state,
              backgroundImage: croppedUrl,
              backgroundTransform: {
                ...state.backgroundTransform,
                crop: cropRect,
              },
            });
            setIsCropModalOpen(false);
            toast.success("Applied background image crop.");
          }}
        />
      )}

      {/* Provider Config Dialog */}
      {isProviderConfigOpen && (
        <BackgroundProviderConfigDialog
          isOpen={isProviderConfigOpen}
          onClose={() => setIsProviderConfigOpen(false)}
          onSaved={() => {
            setIsProviderConfigOpen(false);
            toast.success("Background removal configuration updated.");
          }}
        />
      )}
    </div>
  );
};
