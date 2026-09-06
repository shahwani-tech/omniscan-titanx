/**
 * OMNISCAN TITAN X - Dedicated ID Card & Document Crop Studio
 * Fully Independent, High-Precision Crop & Zoom Engine for Front/Back Cards
 * Supports Image Zoom (25%-1000%), Cursor-Centered Mouse Wheel, Image Pan,
 * Independent Crop Box Movement & Resizing, Draggable CropBar, Non-Destructive
 * Workflow, Aspect Presets, Undo/Redo, Rotation, and Native High-Resolution Export.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Check,
  RotateCw,
  RotateCcw,
  Undo2,
  Redo2,
  RefreshCw,
  Crop,
  Lock,
  Unlock,
  Sliders,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Move,
  GripHorizontal,
  Sparkles,
} from "lucide-react";
import { IdCardUnit, convertIdCardUnit } from "../../engine/idCardLayout";

export interface NormalizedCropRect {
  x: number; // 0 to 1
  y: number; // 0 to 1
  width: number; // 0 to 1
  height: number; // 0 to 1
}

export type CropPresetType =
  | "free"
  | "original"
  | "id-1"
  | "a6"
  | "1:1"
  | "4:3"
  | "3:2"
  | "16:9"
  | "custom";

export type DragHandleType =
  | "move-box"
  | "top-left"
  | "top-right"
  | "bottom-right"
  | "bottom-left"
  | "top"
  | "bottom"
  | "left"
  | "right";

export interface PixelCropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IdCardCropState {
  cropBox: PixelCropBox;
  zoom: number;
  imagePan: { x: number; y: number };
  rotation: number;
  preset: CropPresetType;
  aspectRatioLocked: boolean;
  unit: IdCardUnit;
  customWidth: number;
  customHeight: number;
}

interface IdCardCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  sideName: "Front Side" | "Back Side";
  initialState?: IdCardCropState | null;
  onApplyCrop: (croppedDataUrl: string, finalState?: IdCardCropState) => void;
}

interface HistoryState {
  cropBox: PixelCropBox;
  imagePan: { x: number; y: number };
  zoom: number;
  rotation: number;
}

// Module-level CropBar persistence across renders/modal openings
interface PersistedCropBarState {
  x: number;
  y: number;
  isCollapsed: boolean;
}
let moduleCropBarState: PersistedCropBarState | null = (() => {
  try {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("omniscan_idcard_cropbar_pos");
      if (saved) return JSON.parse(saved);
    }
  } catch (_) {}
  return null;
})();

const saveCropBarState = (pos: { x: number; y: number } | null, isCollapsed: boolean) => {
  if (!pos) return;
  moduleCropBarState = { x: pos.x, y: pos.y, isCollapsed };
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem("omniscan_idcard_cropbar_pos", JSON.stringify(moduleCropBarState));
    }
  } catch (_) {}
};

export const IdCardCropModal: React.FC<IdCardCropModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  sideName,
  initialState,
  onApplyCrop,
}) => {
  // Image source & Dimensions
  const [naturalWidth, setNaturalWidth] = useState<number>(800);
  const [naturalHeight, setNaturalHeight] = useState<number>(600);
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);

  // Rotation (0, 90, 180, 270)
  const [rotation, setRotation] = useState<number>(initialState?.rotation ?? 0);

  // Image Zoom & Pan State (Independent for Front and Back)
  const [zoom, setZoom] = useState<number>(initialState?.zoom ?? 1.0);
  const [imagePan, setImagePan] = useState<{ x: number; y: number }>(
    initialState?.imagePan ?? { x: 0, y: 0 }
  );

  // Crop Preset & Aspect Ratio
  const [preset, setPreset] = useState<CropPresetType>(initialState?.preset ?? "id-1");
  const [aspectRatioLocked, setAspectRatioLocked] = useState<boolean>(
    initialState?.aspectRatioLocked ?? true
  );
  const [unit, setUnit] = useState<IdCardUnit>(initialState?.unit ?? "mm");
  const [customWidth, setCustomWidth] = useState<number>(initialState?.customWidth ?? 85.6);
  const [customHeight, setCustomHeight] = useState<number>(initialState?.customHeight ?? 53.98);

  // Stage Viewport Reference & Dimensions
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageDimensions, setStageDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });

  // Crop Box in Stage Coordinates
  const [cropBox, setCropBox] = useState<PixelCropBox>(
    initialState?.cropBox ?? { x: 150, y: 100, width: 450, height: 284 }
  );

  // Floating CropBar Position & Size / Collapsed State
  const [cropBarPos, setCropBarPos] = useState<{ x: number; y: number } | null>(() =>
    moduleCropBarState ? { x: moduleCropBarState.x, y: moduleCropBarState.y } : null
  );
  const [isCropBarCollapsed, setIsCropBarCollapsed] = useState<boolean>(
    () => moduleCropBarState?.isCollapsed ?? false
  );
  const [isDraggingCropBar, setIsDraggingCropBar] = useState<boolean>(false);
  const barDragStartRef = useRef<{ clientX: number; clientY: number; initialPos: { x: number; y: number } }>({
    clientX: 0,
    clientY: 0,
    initialPos: { x: 0, y: 0 },
  });

  // Dragging States for CropBox and Image Pan
  const [activeHandle, setActiveHandle] = useState<DragHandleType | null>(null);
  const [isPanningImage, setIsPanningImage] = useState<boolean>(false);
  const panStartRef = useRef<{
    clientX: number;
    clientY: number;
    initialPan: { x: number; y: number };
  }>({
    clientX: 0,
    clientY: 0,
    initialPan: { x: 0, y: 0 },
  });
  const boxDragStartRef = useRef<{
    clientX: number;
    clientY: number;
    initialBox: PixelCropBox;
  }>({
    clientX: 0,
    clientY: 0,
    initialBox: cropBox,
  });

  // Rotated Source Canvas Cache (for instant rendering and native crop extraction)
  const rotatedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Record History State
  const recordHistory = useCallback(
    (newBox: PixelCropBox, newPan: { x: number; y: number }, newZoom: number, newRot: number) => {
      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        next.push({ cropBox: newBox, imagePan: newPan, zoom: newZoom, rotation: newRot });
        return next;
      });
      setHistoryIndex((idx) => idx + 1);
    },
    [historyIndex]
  );

  // Undo / Redo Actions
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setCropBox(prev.cropBox);
      setImagePan(prev.imagePan);
      setZoom(prev.zoom);
      setRotation(prev.rotation);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setCropBox(next.cropBox);
      setImagePan(next.imagePan);
      setZoom(next.zoom);
      setRotation(next.rotation);
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Measure Stage Dimensions on Mount & Resize
  useEffect(() => {
    const updateSize = () => {
      if (stageRef.current) {
        const rect = stageRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setStageDimensions({ width: rect.width, height: rect.height });
        }
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Compute Rotated Dimensions
  const isRotated90 = rotation % 180 !== 0;
  const rotW = isRotated90 ? naturalHeight : naturalWidth;
  const rotH = isRotated90 ? naturalWidth : naturalHeight;

  // Base Fitted Scale & Dimensions in the Stage
  const baseScale = Math.min(
    (stageDimensions.width * 0.8) / rotW,
    (stageDimensions.height * 0.8) / rotH,
    1.0
  );
  const baseDisplayW = rotW * baseScale;
  const baseDisplayH = rotH * baseScale;

  // Current Displayed Image Dimensions & Position on Screen
  const displayedW = baseDisplayW * zoom;
  const displayedH = baseDisplayH * zoom;
  const imgLeft = stageDimensions.width / 2 + imagePan.x - displayedW / 2;
  const imgTop = stageDimensions.height / 2 + imagePan.y - displayedH / 2;

  // Load and cache rotated source image
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setNaturalWidth(img.naturalWidth);
      setNaturalHeight(img.naturalHeight);
      setImgLoaded(true);

      // Create rotated cache canvas
      const currentRot90 = rotation % 180 !== 0;
      const cW = currentRot90 ? img.naturalHeight : img.naturalWidth;
      const cH = currentRot90 ? img.naturalWidth : img.naturalHeight;

      const rCanvas = document.createElement("canvas");
      rCanvas.width = cW;
      rCanvas.height = cH;
      const ctx = rCanvas.getContext("2d");
      if (ctx) {
        ctx.translate(cW / 2, cH / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      }
      rotatedCanvasRef.current = rCanvas;

      // Initialize crop box if not provided
      if (!initialState) {
        const targetAspect = 85.6 / 53.98; // ID-1 default
        let initW = Math.min(stageDimensions.width * 0.65, 480);
        let initH = initW / targetAspect;
        if (initH > stageDimensions.height * 0.7) {
          initH = stageDimensions.height * 0.7;
          initW = initH * targetAspect;
        }
        const initialBox: PixelCropBox = {
          x: Math.round((stageDimensions.width - initW) / 2),
          y: Math.round((stageDimensions.height - initH) / 2),
          width: Math.round(initW),
          height: Math.round(initH),
        };
        setCropBox(initialBox);
        setHistory([{ cropBox: initialBox, imagePan: { x: 0, y: 0 }, zoom: 1.0, rotation }]);
        setHistoryIndex(0);
      }
    };
    img.src = imageSrc;
  }, [imageSrc, rotation, isOpen]);

  // Target Aspect Ratio calculation
  const getTargetAspectRatio = useCallback((): number | null => {
    if (preset === "free") return null;
    if (preset === "original") return rotW / rotH;
    if (preset === "id-1") return 85.6 / 53.98;
    if (preset === "a6") return 148 / 105;
    if (preset === "1:1") return 1.0;
    if (preset === "4:3") return 4 / 3;
    if (preset === "3:2") return 3 / 2;
    if (preset === "16:9") return 16 / 9;
    if (preset === "custom") {
      return customWidth > 0 && customHeight > 0 ? customWidth / customHeight : null;
    }
    return null;
  }, [preset, rotW, rotH, customWidth, customHeight]);

  // Adjust crop box to a target aspect ratio while remaining centered
  const applyPresetAspect = (targetAspect: number | null) => {
    if (!targetAspect) return;
    setCropBox((prev) => {
      let newW = prev.width;
      let newH = prev.height;
      const currentAspect = prev.width / prev.height;

      if (currentAspect > targetAspect) {
        newW = prev.height * targetAspect;
      } else {
        newH = prev.width / targetAspect;
      }

      newW = Math.max(50, Math.min(stageDimensions.width - 20, newW));
      newH = Math.max(50, Math.min(stageDimensions.height - 20, newH));

      const newX = Math.max(10, Math.min(stageDimensions.width - newW - 10, prev.x + (prev.width - newW) / 2));
      const newY = Math.max(10, Math.min(stageDimensions.height - newH - 10, prev.y + (prev.height - newH) / 2));

      const updated = {
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      };
      recordHistory(updated, imagePan, zoom, rotation);
      return updated;
    });
  };

  const handleSelectPreset = (newPreset: CropPresetType) => {
    setPreset(newPreset);
    if (newPreset === "free") {
      setAspectRatioLocked(false);
    } else {
      setAspectRatioLocked(true);
      if (newPreset === "id-1") applyPresetAspect(85.6 / 53.98);
      else if (newPreset === "a6") applyPresetAspect(148 / 105);
      else if (newPreset === "original") applyPresetAspect(rotW / rotH);
      else if (newPreset === "1:1") applyPresetAspect(1.0);
      else if (newPreset === "4:3") applyPresetAspect(4 / 3);
      else if (newPreset === "3:2") applyPresetAspect(3 / 2);
      else if (newPreset === "16:9") applyPresetAspect(16 / 9);
    }
  };

  // Rotation Handlers (+90°, -90°, 180°)
  const handleRotate = (degDelta: number) => {
    const newRot = (rotation + degDelta + 360) % 360;
    setRotation(newRot);
    recordHistory(cropBox, imagePan, zoom, newRot);
  };

  // Zoom Controls Handlers
  const handleZoomSlider = (newZoomVal: number) => {
    const clamped = Math.max(0.25, Math.min(10.0, Number(newZoomVal.toFixed(2))));
    setZoom(clamped);
  };

  const handleZoomIn = () => {
    setZoom((z) => Math.min(10.0, Number((z * 1.2).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.25, Number((z / 1.2).toFixed(2))));
  };

  const handleFitImage = () => {
    setZoom(1.0);
    setImagePan({ x: 0, y: 0 });
  };

  const handleFitCropArea = () => {
    // Scale image so that the whole image fills the crop box nicely
    const scaleX = cropBox.width / baseDisplayW;
    const scaleY = cropBox.height / baseDisplayH;
    const bestScale = Math.max(scaleX, scaleY);
    setZoom(Math.max(0.25, Math.min(10.0, Number(bestScale.toFixed(2)))));
    // Center image on the crop box
    const centerCropX = cropBox.x + cropBox.width / 2;
    const centerCropY = cropBox.y + cropBox.height / 2;
    setImagePan({
      x: centerCropX - stageDimensions.width / 2,
      y: centerCropY - stageDimensions.height / 2,
    });
  };

  const handleActualSize = () => {
    setZoom(baseScale > 0 ? Number((1.0 / baseScale).toFixed(2)) : 1.0);
  };

  const handleResetZoom = () => {
    setZoom(1.0);
    setImagePan({ x: 0, y: 0 });
  };

  // Mouse Wheel Zoom centered around image/preview center
  const handleWheel = (e: React.WheelEvent) => {
    // Only zoom when over stage and not dragging bar
    if (isDraggingCropBar) return;

    // Do not zoom when pointer is over interactive controls, buttons, or floating crop bar
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, input, select, textarea, [data-interactive], .pdf-crop-bar")) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newZoom = Math.max(0.25, Math.min(10.0, Number((zoom * zoomFactor).toFixed(3))));
    if (newZoom === zoom) return;

    // Center-based zoom: image scales symmetrically around stage center
    const zoomRatio = newZoom / zoom;
    setImagePan((prevPan) => ({
      x: Math.round(prevPan.x * zoomRatio),
      y: Math.round(prevPan.y * zoomRatio),
    }));
    setZoom(newZoom);
  };

  // Dragging: Free Image Space -> Pan Image
  const handleStagePointerDown = (e: React.PointerEvent) => {
    // If user clicked directly on the stage / backdrop (outside crop box and outside floating bar)
    if (activeHandle || isDraggingCropBar) return;
    e.preventDefault();
    setIsPanningImage(true);
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialPan: { ...imagePan },
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Dragging: CropBox Body -> Move CropBox
  const handleBoxPointerDown = (e: React.PointerEvent, handle: DragHandleType) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveHandle(handle);
    boxDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialBox: { ...cropBox },
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Dragging: Floating CropBar Header
  const handleBarPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCropBar(true);
    const currentBarPos = cropBarPos || {
      x: Math.round(stageDimensions.width / 2 - 240),
      y: 16,
    };
    barDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialPos: currentBarPos,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Unified Pointer Move
  const handleUnifiedPointerMove = (e: React.PointerEvent) => {
    // 1. Image Panning
    if (isPanningImage) {
      e.preventDefault();
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      setImagePan({
        x: panStartRef.current.initialPan.x + dx,
        y: panStartRef.current.initialPan.y + dy,
      });
      return;
    }

    // 2. CropBar Dragging
    if (isDraggingCropBar) {
      e.preventDefault();
      const dx = e.clientX - barDragStartRef.current.clientX;
      const dy = e.clientY - barDragStartRef.current.clientY;
      const maxX = stageDimensions.width - 200;
      const maxY = stageDimensions.height - 60;
      setCropBarPos({
        x: Math.max(10, Math.min(maxX, barDragStartRef.current.initialPos.x + dx)),
        y: Math.max(10, Math.min(maxY, barDragStartRef.current.initialPos.y + dy)),
      });
      return;
    }

    // 3. CropBox Move / Resize
    if (activeHandle) {
      e.preventDefault();
      const dx = e.clientX - boxDragStartRef.current.clientX;
      const dy = e.clientY - boxDragStartRef.current.clientY;
      const initial = boxDragStartRef.current.initialBox;

      let newX = initial.x;
      let newY = initial.y;
      let newW = initial.width;
      let newH = initial.height;
      const minSize = 40;
      const targetAspect = aspectRatioLocked ? getTargetAspectRatio() : null;

      if (activeHandle === "move-box") {
        newX = Math.max(0, Math.min(stageDimensions.width - newW, initial.x + dx));
        newY = Math.max(0, Math.min(stageDimensions.height - newH, initial.y + dy));
      } else {
        if (activeHandle.includes("right")) {
          newW = Math.max(minSize, Math.min(stageDimensions.width - initial.x, initial.width + dx));
        }
        if (activeHandle.includes("left")) {
          const potW = initial.width - dx;
          if (potW >= minSize && initial.x + dx >= 0) {
            newX = initial.x + dx;
            newW = potW;
          }
        }
        if (activeHandle.includes("bottom")) {
          newH = Math.max(minSize, Math.min(stageDimensions.height - initial.y, initial.height + dy));
        }
        if (activeHandle.includes("top")) {
          const potH = initial.height - dy;
          if (potH >= minSize && initial.y + dy >= 0) {
            newY = initial.y + dy;
            newH = potH;
          }
        }

        // Apply aspect ratio lock if active
        if (targetAspect) {
          if (activeHandle === "left" || activeHandle === "right") {
            newH = newW / targetAspect;
            if (newY + newH > stageDimensions.height) {
              newH = stageDimensions.height - newY;
              newW = newH * targetAspect;
            }
          } else {
            newW = newH * targetAspect;
            if (newX + newW > stageDimensions.width) {
              newW = stageDimensions.width - newX;
              newH = newW / targetAspect;
            }
          }
        }
      }

      setCropBox({
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      });
    }
  };

  // Unified Pointer Up
  const handleUnifiedPointerUp = (e: React.PointerEvent) => {
    if (isPanningImage) {
      setIsPanningImage(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
      recordHistory(cropBox, imagePan, zoom, rotation);
    }
    if (isDraggingCropBar) {
      setIsDraggingCropBar(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
      saveCropBarState(cropBarPos, isCropBarCollapsed);
    }
    if (activeHandle) {
      setActiveHandle(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
      recordHistory(cropBox, imagePan, zoom, rotation);
    }
  };

  // Execute Pixel-Perfect Crop from Rotated Source Image
  const handleApply = async () => {
    if (!rotatedCanvasRef.current) return;

    try {
      const srcCanvas = rotatedCanvasRef.current;
      const sW = srcCanvas.width;
      const sH = srcCanvas.height;

      // Map CropBox in stage coordinates to native pixels of the rotated source image
      const normX = (cropBox.x - imgLeft) / displayedW;
      const normY = (cropBox.y - imgTop) / displayedH;
      const normW = cropBox.width / displayedW;
      const normH = cropBox.height / displayedH;

      const sourceX = normX * sW;
      const sourceY = normY * sH;
      const sourceW = normW * sW;
      const sourceH = normH * sH;

      const outW = Math.max(16, Math.round(sourceW));
      const outH = Math.max(16, Math.round(sourceH));

      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = outW;
      outputCanvas.height = outH;
      const outCtx = outputCanvas.getContext("2d");
      if (!outCtx) throw new Error("Could not acquire 2D context");

      // Pure clean white paper background
      outCtx.fillStyle = "#FFFFFF";
      outCtx.fillRect(0, 0, outW, outH);

      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = "high";

      // Draw exact portion of the image framed by the crop box
      outCtx.drawImage(
        srcCanvas,
        -sourceX * (outW / sourceW),
        -sourceY * (outH / sourceH),
        sW * (outW / sourceW),
        sH * (outH / sourceH)
      );

      const croppedDataUrl = outputCanvas.toDataURL("image/png", 1.0);

      const finalState: IdCardCropState = {
        cropBox,
        zoom,
        imagePan,
        rotation,
        preset,
        aspectRatioLocked,
        unit,
        customWidth,
        customHeight,
      };

      onApplyCrop(croppedDataUrl, finalState);
      onClose();
    } catch (err) {
      console.error("Failed to extract ID card crop:", err);
    }
  };

  // Physical dimension calculations for HUD display
  // Ratio of crop box to native image size
  const nativeCropW = Math.round((cropBox.width / displayedW) * rotW);
  const nativeCropH = Math.round((cropBox.height / displayedH) * rotH);
  const displayW = convertIdCardUnit(nativeCropW, "px", unit);
  const displayH = convertIdCardUnit(nativeCropH, "px", unit);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 bg-neutral-950 border-b border-neutral-800 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-sky-600/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shadow-md">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  Crop Document: {sideName}
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                  Precision Crop &amp; Zoom
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Independent front/back zoom &amp; pan • Drag image under crop frame • Pixel-perfect export
              </p>
            </div>
          </div>

          {/* Undo / Redo & Close */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Undo Crop Action"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Redo Crop Action"
            >
              <Redo2 className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-neutral-800 mx-1" />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              title="Cancel (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Workspace: Left Sidebar + Interactive Canvas Viewport */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Controls Sidebar */}
          <aside className="w-72 bg-neutral-900/95 border-r border-neutral-800 p-4 flex flex-col space-y-4 overflow-y-auto custom-scrollbar text-xs shrink-0">
            {/* Aspect Ratio Presets */}
            <div className="space-y-2">
              <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span>Aspect Ratio &amp; Presets</span>
              </span>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleSelectPreset("id-1")}
                  className={`py-1.5 px-2 rounded-lg font-medium text-left transition-all border ${
                    preset === "id-1"
                      ? "bg-sky-600/20 text-sky-400 border-sky-500/50 shadow-sm"
                      : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <div className="font-semibold">ID-1 / CNIC</div>
                  <div className="text-[10px] text-neutral-500">85.6 × 54 mm</div>
                </button>

                <button
                  onClick={() => handleSelectPreset("a6")}
                  className={`py-1.5 px-2 rounded-lg font-medium text-left transition-all border ${
                    preset === "a6"
                      ? "bg-sky-600/20 text-sky-400 border-sky-500/50 shadow-sm"
                      : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <div className="font-semibold">A6 Ratio</div>
                  <div className="text-[10px] text-neutral-500">105 × 148 mm</div>
                </button>

                <button
                  onClick={() => handleSelectPreset("original")}
                  className={`py-1.5 px-2 rounded-lg font-medium text-left transition-all border ${
                    preset === "original"
                      ? "bg-sky-600/20 text-sky-400 border-sky-500/50 shadow-sm"
                      : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <div className="font-semibold">Original Ratio</div>
                  <div className="text-[10px] text-neutral-500">Match Source</div>
                </button>

                <button
                  onClick={() => handleSelectPreset("free")}
                  className={`py-1.5 px-2 rounded-lg font-medium text-left transition-all border ${
                    preset === "free"
                      ? "bg-sky-600/20 text-sky-400 border-sky-500/50 shadow-sm"
                      : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <div className="font-semibold">Free Crop</div>
                  <div className="text-[10px] text-neutral-500">Unconstrained</div>
                </button>

                <button
                  onClick={() => handleSelectPreset("1:1")}
                  className={`py-1.5 px-2 rounded-lg font-medium text-left transition-all border ${
                    preset === "1:1"
                      ? "bg-sky-600/20 text-sky-400 border-sky-500/50 shadow-sm"
                      : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <div className="font-semibold">1:1 Square</div>
                  <div className="text-[10px] text-neutral-500">Equal Sides</div>
                </button>

                <button
                  onClick={() => handleSelectPreset("4:3")}
                  className={`py-1.5 px-2 rounded-lg font-medium text-left transition-all border ${
                    preset === "4:3"
                      ? "bg-sky-600/20 text-sky-400 border-sky-500/50 shadow-sm"
                      : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <div className="font-semibold">4:3 Standard</div>
                  <div className="text-[10px] text-neutral-500">Photo Standard</div>
                </button>
              </div>

              {/* Aspect Ratio Lock Toggle */}
              <button
                onClick={() => setAspectRatioLocked((l) => !l)}
                className={`w-full py-1.5 px-2.5 rounded-lg font-medium flex items-center justify-between transition-colors border ${
                  aspectRatioLocked
                    ? "bg-sky-950/60 text-sky-400 border-sky-800/60"
                    : "bg-neutral-950 text-neutral-400 border-neutral-800"
                }`}
              >
                <span>Lock Aspect Ratio</span>
                {aspectRatioLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Orientation & Rotation */}
            <div className="space-y-2 pt-1 border-t border-neutral-800">
              <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                <span>Orientation &amp; Rotation</span>
              </span>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => handleRotate(90)}
                  className="py-1.5 px-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-300 flex flex-col items-center justify-center space-y-1"
                  title="Rotate 90° Clockwise"
                >
                  <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[10px] font-medium">+90° CW</span>
                </button>
                <button
                  onClick={() => handleRotate(-90)}
                  className="py-1.5 px-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-300 flex flex-col items-center justify-center space-y-1"
                  title="Rotate 90° Counter-Clockwise"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[10px] font-medium">-90° CCW</span>
                </button>
                <button
                  onClick={() => handleRotate(180)}
                  className="py-1.5 px-2 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-300 flex flex-col items-center justify-center space-y-1"
                  title="Rotate 180° Flip"
                >
                  <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[10px] font-medium">180° Flip</span>
                </button>
              </div>
            </div>

            {/* Zoom Slider & View Quick Buttons */}
            <div className="space-y-2 pt-1 border-t border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                  <ZoomIn className="w-3.5 h-3.5 text-sky-400" />
                  <span>Image Zoom</span>
                </span>
                <span className="text-sky-400 font-mono text-[11px] font-bold bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800/80">
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              {/* Slider */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleZoomOut}
                  className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min="0.25"
                  max="10.0"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => handleZoomSlider(parseFloat(e.target.value))}
                  className="flex-1 accent-sky-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
                />
                <button
                  onClick={handleZoomIn}
                  className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Preset Zoom Buttons */}
              <div className="grid grid-cols-4 gap-1 pt-1">
                <button
                  onClick={handleFitImage}
                  className="py-1 px-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded text-[10px] text-neutral-300 font-medium text-center"
                  title="Fit entire image in workspace"
                >
                  Fit Image
                </button>
                <button
                  onClick={handleFitCropArea}
                  className="py-1 px-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded text-[10px] text-neutral-300 font-medium text-center"
                  title="Fit crop area"
                >
                  Fit Crop
                </button>
                <button
                  onClick={handleActualSize}
                  className="py-1 px-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded text-[10px] text-neutral-300 font-medium text-center"
                  title="100% Native Resolution"
                >
                  100%
                </button>
                <button
                  onClick={handleResetZoom}
                  className="py-1 px-1 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded text-[10px] text-neutral-300 font-medium text-center"
                  title="Reset Zoom & Pan"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Physical Dimensions & Units */}
            <div className="space-y-2 pt-1 border-t border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px]">
                  Physical Dimensions
                </span>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as IdCardUnit)}
                  className="bg-neutral-950 border border-neutral-800 rounded px-1.5 py-0.5 text-neutral-300 text-[10px]"
                >
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                  <option value="in">in</option>
                  <option value="pt">pt</option>
                  <option value="px">px</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                <div>
                  <span className="block text-[10px] text-neutral-400 mb-0.5">Width ({unit})</span>
                  <div className="font-mono text-white text-xs font-semibold">{displayW.toFixed(2)}</div>
                </div>
                <div>
                  <span className="block text-[10px] text-neutral-400 mb-0.5">Height ({unit})</span>
                  <div className="font-mono text-white text-xs font-semibold">{displayH.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Reset Entire Crop Frame */}
            <div className="pt-2 border-t border-neutral-800">
              <button
                onClick={() => {
                  const targetAspect = 85.6 / 53.98;
                  let initW = Math.min(stageDimensions.width * 0.7, 480);
                  let initH = initW / targetAspect;
                  const resetBox: PixelCropBox = {
                    x: Math.round((stageDimensions.width - initW) / 2),
                    y: Math.round((stageDimensions.height - initH) / 2),
                    width: Math.round(initW),
                    height: Math.round(initH),
                  };
                  setCropBox(resetBox);
                  setZoom(1.0);
                  setImagePan({ x: 0, y: 0 });
                  setRotation(0);
                  recordHistory(resetBox, { x: 0, y: 0 }, 1.0, 0);
                }}
                className="w-full py-2 px-3 bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>Reset Crop &amp; View</span>
              </button>
            </div>
          </aside>

          {/* Center Stage: Canvas Viewport Area */}
          <main
            ref={stageRef}
            onWheel={handleWheel}
            onPointerDown={handleStagePointerDown}
            onPointerMove={handleUnifiedPointerMove}
            onPointerUp={handleUnifiedPointerUp}
            onPointerCancel={handleUnifiedPointerUp}
            className={`flex-1 bg-neutral-950 relative overflow-hidden flex items-center justify-center select-none ${
              isPanningImage ? "cursor-grabbing" : "cursor-grab"
            }`}
            style={{
              touchAction: "none",
            }}
          >
            {/* Transformed Image Underlay */}
            {imgLoaded && (
              <div
                className="absolute pointer-events-none select-none"
                style={{
                  left: `${imgLeft}px`,
                  top: `${imgTop}px`,
                  width: `${displayedW}px`,
                  height: `${displayedH}px`,
                  willChange: "transform, left, top",
                }}
              >
                <img
                  src={imageSrc}
                  alt="Crop Source"
                  className="w-full h-full object-contain block select-none"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transformOrigin: "center center",
                  }}
                />
              </div>
            )}

            {/* Darkened Mask Over Uncropped Areas */}
            {/* Top Mask */}
            <div
              className="absolute left-0 top-0 right-0 bg-black/70 pointer-events-none"
              style={{ height: `${Math.max(0, cropBox.y)}px` }}
            />
            {/* Bottom Mask */}
            <div
              className="absolute left-0 right-0 bottom-0 bg-black/70 pointer-events-none"
              style={{ top: `${Math.min(stageDimensions.height, cropBox.y + cropBox.height)}px` }}
            />
            {/* Left Mask */}
            <div
              className="absolute left-0 bg-black/70 pointer-events-none"
              style={{
                top: `${cropBox.y}px`,
                height: `${cropBox.height}px`,
                width: `${Math.max(0, cropBox.x)}px`,
              }}
            />
            {/* Right Mask */}
            <div
              className="absolute right-0 bg-black/70 pointer-events-none"
              style={{
                top: `${cropBox.y}px`,
                height: `${cropBox.height}px`,
                left: `${Math.min(stageDimensions.width, cropBox.x + cropBox.width)}px`,
              }}
            />

            {/* Interactive Crop Box */}
            <div
              className="absolute border-2 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.4)] cursor-move select-none"
              style={{
                left: `${cropBox.x}px`,
                top: `${cropBox.y}px`,
                width: `${cropBox.width}px`,
                height: `${cropBox.height}px`,
              }}
              onPointerDown={(e) => handleBoxPointerDown(e, "move-box")}
            >
              {/* 3x3 Grid Overlay Lines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                <div className="border-r border-b border-sky-300" />
                <div className="border-r border-b border-sky-300" />
                <div className="border-b border-sky-300" />
                <div className="border-r border-b border-sky-300" />
                <div className="border-r border-b border-sky-300" />
                <div className="border-b border-sky-300" />
                <div className="border-r border-b border-sky-300" />
                <div className="border-r border-b border-sky-300" />
                <div />
              </div>

              {/* Dimension HUD Badge */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-neutral-900/90 border border-sky-500/40 text-sky-300 font-mono text-[10px] px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap">
                {displayW.toFixed(1)} × {displayH.toFixed(1)} {unit} ({nativeCropW} × {nativeCropH} px)
              </div>

              {/* Drag Handles: Corners */}
              <div
                className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-sky-600 rounded-sm cursor-nwse-resize shadow hover:scale-125 transition-transform"
                onPointerDown={(e) => handleBoxPointerDown(e, "top-left")}
              />
              <div
                className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-sky-600 rounded-sm cursor-nesw-resize shadow hover:scale-125 transition-transform"
                onPointerDown={(e) => handleBoxPointerDown(e, "top-right")}
              />
              <div
                className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-sky-600 rounded-sm cursor-nesw-resize shadow hover:scale-125 transition-transform"
                onPointerDown={(e) => handleBoxPointerDown(e, "bottom-left")}
              />
              <div
                className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-sky-600 rounded-sm cursor-nwse-resize shadow hover:scale-125 transition-transform"
                onPointerDown={(e) => handleBoxPointerDown(e, "bottom-right")}
              />

              {/* Drag Handles: Edges */}
              <div
                className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-5 bg-white border-2 border-sky-600 rounded-sm cursor-ew-resize shadow hover:scale-125 transition-transform"
                onPointerDown={(e) => handleBoxPointerDown(e, "left")}
              />
              <div
                className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-5 bg-white border-2 border-sky-600 rounded-sm cursor-ew-resize shadow hover:scale-125 transition-transform"
                onPointerDown={(e) => handleBoxPointerDown(e, "right")}
              />
              <div
                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-3 bg-white border-2 border-sky-600 rounded-sm cursor-ns-resize shadow hover:scale-125 transition-transform"
                onPointerDown={(e) => handleBoxPointerDown(e, "top")}
              />
              <div
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-3 bg-white border-2 border-sky-600 rounded-sm cursor-ns-resize shadow hover:scale-125 transition-transform"
                onPointerDown={(e) => handleBoxPointerDown(e, "bottom")}
              />
            </div>

            {/* Draggable Floating CropBar with Image Zoom & Pan Controls */}
            <div
              className="absolute z-20 bg-neutral-900/95 border border-neutral-700/80 rounded-xl shadow-2xl backdrop-blur-md px-3 py-2 flex items-center space-x-3 text-xs text-neutral-200 select-none"
              style={{
                left: cropBarPos ? `${cropBarPos.x}px` : "50%",
                top: cropBarPos ? `${cropBarPos.y}px` : "16px",
                transform: cropBarPos ? "none" : "translateX(-50%)",
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Draggable Header Handle */}
              <div
                onPointerDown={handleBarPointerDown}
                className="flex items-center space-x-1 text-neutral-400 hover:text-white cursor-grab active:cursor-grabbing pr-2 border-r border-neutral-800"
                title="Drag CropBar to reposition"
              >
                <GripHorizontal className="w-4 h-4 text-sky-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">CropBar</span>
              </div>

              {/* Minus Button */}
              {!isCropBarCollapsed && (
                <>
                  <button
                    onClick={handleZoomOut}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
                    title="Zoom Out (Wheel Down)"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>

                  {/* Zoom Slider */}
                  <input
                    type="range"
                    min="0.25"
                    max="10.0"
                    step="0.05"
                    value={zoom}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => handleZoomSlider(parseFloat(e.target.value))}
                    className="w-24 accent-sky-500 bg-neutral-800 h-1.5 rounded cursor-pointer"
                    title="Zoom Slider"
                  />
                </>
              )}

              {/* Zoom Percentage Display */}
              <span className="w-12 text-center font-mono font-bold text-sky-400 text-xs">
                {Math.round(zoom * 100)}%
              </span>

              {!isCropBarCollapsed && (
                <>
                  {/* Plus Button */}
                  <button
                    onClick={handleZoomIn}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
                    title="Zoom In (Wheel Up)"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>

                  <div className="h-4 w-px bg-neutral-800" />

                  {/* Fit Image, Fit Crop Area, 100%, Reset Buttons */}
                  <button
                    onClick={handleFitImage}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-medium text-neutral-300"
                    title="Fit entire image in workspace"
                  >
                    Fit Image
                  </button>

                  <button
                    onClick={handleFitCropArea}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-medium text-neutral-300"
                    title="Fit crop area"
                  >
                    Fit Crop
                  </button>

                  <button
                    onClick={handleActualSize}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-medium text-neutral-300"
                    title="100% 1:1 Scale"
                  >
                    100%
                  </button>

                  <button
                    onClick={handleResetZoom}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] font-medium text-neutral-300"
                    title="Reset Zoom & Pan"
                  >
                    Reset
                  </button>

                  <div className="h-4 w-px bg-neutral-800" />
                </>
              )}

              {/* Collapse / Expand Toggle */}
              <button
                onClick={() => {
                  const nextCollapsed = !isCropBarCollapsed;
                  setIsCropBarCollapsed(nextCollapsed);
                  saveCropBarState(cropBarPos, nextCollapsed);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white transition-colors"
                title={isCropBarCollapsed ? "Expand CropBar" : "Collapse CropBar"}
              >
                {isCropBarCollapsed ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Helpful Interaction Tip Overlay */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none bg-black/60 backdrop-blur-sm border border-neutral-800 text-[10px] text-neutral-400 px-3 py-1 rounded-full flex items-center space-x-2">
              <span>Mouse Wheel: Zoom</span>
              <span>•</span>
              <span>Drag Image: Pan</span>
              <span>•</span>
              <span>Drag Box: Move</span>
              <span>•</span>
              <span>Drag Handles: Resize</span>
            </div>
          </main>
        </div>

        {/* Footer Action Buttons */}
        <footer className="h-16 bg-neutral-950 border-t border-neutral-800 px-6 flex items-center justify-between shrink-0">
          <div className="text-xs text-neutral-400">
            Position image inside the crop frame. Press{" "}
            <span className="text-white font-mono font-semibold">Apply Crop</span> to save.
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex items-center space-x-1.5 px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Apply Crop to {sideName}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

