import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Crop,
  RotateCw,
  RotateCcw,
  Check,
  X,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Move,
  Maximize2,
  Hand,
  MousePointer,
  Grid3X3,
  Crosshair,
  Shield,
  Scissors,
  Sliders,
  Layers,
  Undo2,
  Redo2,
  Lock,
  Unlock,
  Sparkles,
  HelpCircle,
  Maximize,
  Focus,
  Eye,
  Info,
} from "lucide-react";
import { A6HalfCardNumericInput } from "./A6HalfCardNumericInput";

export interface A6CropBox {
  x: number; // 0 to 1 normalized relative to image width
  y: number; // 0 to 1 normalized relative to image height
  width: number; // 0 to 1 normalized
  height: number; // 0 to 1 normalized
}

export interface A6CropState {
  cropBox: A6CropBox;
  preset: string;
  targetWidthMm: number;
  targetHeightMm: number;
  lockRatio: boolean;
  imageScale: number; // 0.5 to 4.0
  imagePan: { x: number; y: number }; // normalized offset
  rotation: number; // -180 to 180 deg
  showGrid: boolean;
  showCenterGuides: boolean;
  showSafeArea: boolean;
  showBleedGuides: boolean;
  showPhysicalGuide: boolean;
}

interface A6HalfCardCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  cardSide: "front" | "back";
  targetWidthMm: number;
  targetHeightMm: number;
  initialCropState?: A6CropState | null;
  onApplyCrop: (croppedDataUrl: string, state?: A6CropState) => void;
  onClose: () => void;
}

// Preset definitions for A6 Half-Card
interface CropPresetItem {
  id: string;
  label: string;
  widthMm?: number;
  heightMm?: number;
  ratio?: number;
  description: string;
}

const PRESETS: CropPresetItem[] = [
  { id: "74x105", label: "74 × 105 mm", widthMm: 74, heightMm: 105, ratio: 74 / 105, description: "Standard A6 Half-Card (Portrait)" },
  { id: "105x74", label: "105 × 74 mm", widthMm: 105, heightMm: 74, ratio: 105 / 74, description: "Standard A6 Half-Card (Landscape)" },
  { id: "a6-portrait", label: "A6 Sheet Portrait", widthMm: 105, heightMm: 148, ratio: 105 / 148, description: "105 × 148 mm Sheet" },
  { id: "a6-landscape", label: "A6 Sheet Landscape", widthMm: 148, heightMm: 105, ratio: 148 / 105, description: "148 × 105 mm Sheet" },
  { id: "free", label: "Free Crop", description: "Unconstrained ratio" },
  { id: "center", label: "Center Crop", description: "Centered crop box" },
  { id: "fit", label: "Fit Image", description: "Fit full image in crop" },
  { id: "fill", label: "Fill Area", description: "Cover entire crop box" },
  { id: "original", label: "Original Ratio", description: "Match source image" },
  { id: "passport", label: "35 × 45 mm", widthMm: 35, heightMm: 45, ratio: 35 / 45, description: "Passport Photo" },
  { id: "id-card", label: "85.6 × 54 mm", widthMm: 85.6, heightMm: 54, ratio: 85.6 / 54, description: "Standard ID Card" },
];

export const A6HalfCardCropModal: React.FC<A6HalfCardCropModalProps> = ({
  isOpen,
  imageSrc,
  cardSide,
  targetWidthMm: initialWidthMm,
  targetHeightMm: initialHeightMm,
  initialCropState,
  onApplyCrop,
  onClose,
}) => {
  // Target physical dimensions in mm
  const [targetWidthMm, setTargetWidthMm] = useState<number>(() => initialCropState?.targetWidthMm ?? initialWidthMm);
  const [targetHeightMm, setTargetHeightMm] = useState<number>(() => initialCropState?.targetHeightMm ?? initialHeightMm);
  const [lockRatio, setLockRatio] = useState<boolean>(() => initialCropState?.lockRatio ?? true);
  const [selectedPreset, setSelectedPreset] = useState<string>(() => initialCropState?.preset ?? "74x105");

  // Normalized Crop Box (0 to 1)
  const [cropBox, setCropBox] = useState<A6CropBox>(() => {
    if (initialCropState?.cropBox) return initialCropState.cropBox;
    const aspect = initialWidthMm / initialHeightMm;
    if (aspect <= 1) {
      const h = 0.85;
      const w = Math.min(0.85, h * aspect);
      return { x: (1 - w) / 2, y: (1 - h) / 2, width: w, height: h };
    } else {
      const w = 0.85;
      const h = Math.min(0.85, w / aspect);
      return { x: (1 - w) / 2, y: (1 - h) / 2, width: w, height: h };
    }
  });

  // Image Transformations inside Crop
  const [imageScale, setImageScale] = useState<number>(() => initialCropState?.imageScale ?? 1.0);
  const [imagePan, setImagePan] = useState<{ x: number; y: number }>(() => initialCropState?.imagePan ?? { x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(() => initialCropState?.rotation ?? 0);

  // Viewport Canvas Navigation (High-Zoom & Pan)
  const [viewportZoom, setViewportZoom] = useState<number>(1.0);
  const [viewportPan, setViewportPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<"box" | "image" | "hand">("box");
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isCanvasDragging, setIsCanvasDragging] = useState<boolean>(false);

  // Overlay Guides
  const [showGrid, setShowGrid] = useState<boolean>(() => initialCropState?.showGrid ?? true);
  const [showCenterGuides, setShowCenterGuides] = useState<boolean>(() => initialCropState?.showCenterGuides ?? true);
  const [showSafeArea, setShowSafeArea] = useState<boolean>(() => initialCropState?.showSafeArea ?? true);
  const [showBleedGuides, setShowBleedGuides] = useState<boolean>(() => initialCropState?.showBleedGuides ?? true);
  const [showPhysicalGuide, setShowPhysicalGuide] = useState<boolean>(() => initialCropState?.showPhysicalGuide ?? true);

  // Image Natural Dimensions
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 800, height: 600 });
  const [isImageLoaded, setIsImageLoaded] = useState<boolean>(false);

  // Undo / Redo History
  interface HistorySnapshot {
    cropBox: A6CropBox;
    imageScale: number;
    imagePan: { x: number; y: number };
    rotation: number;
    targetWidthMm: number;
    targetHeightMm: number;
    lockRatio: boolean;
  }
  const historyRef = useRef<HistorySnapshot[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const [, setHistoryTick] = useState<number>(0);

  const pushHistory = useCallback((snapshot: HistorySnapshot) => {
    const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
    trimmed.push(snapshot);
    if (trimmed.length > 30) trimmed.shift();
    historyRef.current = trimmed;
    historyIndexRef.current = trimmed.length - 1;
    setHistoryTick((t) => t + 1);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const snap = historyRef.current[historyIndexRef.current];
      setCropBox(snap.cropBox);
      setImageScale(snap.imageScale);
      setImagePan(snap.imagePan);
      setRotation(snap.rotation);
      setTargetWidthMm(snap.targetWidthMm);
      setTargetHeightMm(snap.targetHeightMm);
      setLockRatio(snap.lockRatio);
      setHistoryTick((t) => t + 1);
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const snap = historyRef.current[historyIndexRef.current];
      setCropBox(snap.cropBox);
      setImageScale(snap.imageScale);
      setImagePan(snap.imagePan);
      setRotation(snap.rotation);
      setTargetWidthMm(snap.targetWidthMm);
      setTargetHeightMm(snap.targetHeightMm);
      setLockRatio(snap.lockRatio);
      setHistoryTick((t) => t + 1);
    }
  }, []);

  // Element Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Drag interaction refs & state
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cropStartRef = useRef<A6CropBox>(cropBox);
  const imagePanStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const viewportPanStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  // Aspect ratio in pixels: (targetWidthMm / targetHeightMm) adjusted by image aspect
  const targetAspect = targetWidthMm / targetHeightMm;

  // Load natural image dimensions
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      setIsImageLoaded(true);

      // Initialize history
      const initialSnap: HistorySnapshot = {
        cropBox,
        imageScale,
        imagePan,
        rotation,
        targetWidthMm,
        targetHeightMm,
        lockRatio,
      };
      historyRef.current = [initialSnap];
      historyIndexRef.current = 0;
      setHistoryTick(1);
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  // Viewport Mouse Wheel Zoom (centered on visible viewport center, NOT cursor-centered)
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button, input, select, textarea, .no-wheel-zoom")) return;

      e.preventDefault();
      const zoomStep = e.deltaY < 0 ? 0.12 : -0.12;
      setViewportZoom((prev) => {
        return Math.min(5.0, Math.max(0.25, Number((prev + zoomStep).toFixed(2))));
      });
    };

    vp.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      vp.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Spacebar Temporary Pan listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select")) return;

      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleApply();
      } else if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleResetCrop();
      } else if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleCenterCrop();
      } else if (e.key.toLowerCase() === "h" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setActiveTool((t) => (t === "hand" ? "box" : "hand"));
      } else if (e.key === "0" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setViewportZoom(1.0);
        setViewportPan({ x: 0, y: 0 });
      } else if (e.key === "1" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setViewportZoom(1.0);
      } else if (e.key === "2" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleFitWidth();
      } else if (e.key === "3" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleFitHeight();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setViewportZoom((z) => Math.min(5.0, Number((z + 0.15).toFixed(2))));
      } else if (e.key === "-") {
        e.preventDefault();
        setViewportZoom((z) => Math.max(0.25, Number((z - 0.15).toFixed(2))));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        handleRedo();
      } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const step = e.altKey ? 0.002 : e.shiftKey ? 0.05 : 0.01;
        let dx = 0;
        let dy = 0;
        if (e.key === "ArrowUp") dy = -step;
        if (e.key === "ArrowDown") dy = step;
        if (e.key === "ArrowLeft") dx = -step;
        if (e.key === "ArrowRight") dx = step;

        if (activeTool === "image") {
          setImagePan((prev) => ({
            x: Number((prev.x + dx * 100).toFixed(1)),
            y: Number((prev.y + dy * 100).toFixed(1)),
          }));
        } else {
          setCropBox((prev) => ({
            x: Math.max(0, Math.min(1 - prev.width, prev.x + dx)),
            y: Math.max(0, Math.min(1 - prev.height, prev.y + dy)),
            width: prev.width,
            height: prev.height,
          }));
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [activeTool, handleUndo, handleRedo, onClose]);

  // Fit Width
  const handleFitWidth = () => {
    if (!viewportRef.current || !containerRef.current) return;
    const vpW = viewportRef.current.clientWidth - 80;
    const boxW = containerRef.current.clientWidth || 600;
    const zoom = Math.min(4.0, Math.max(0.3, vpW / boxW));
    setViewportZoom(Number(zoom.toFixed(2)));
    setViewportPan({ x: 0, y: 0 });
  };

  // Fit Height
  const handleFitHeight = () => {
    if (!viewportRef.current || !containerRef.current) return;
    const vpH = viewportRef.current.clientHeight - 80;
    const boxH = containerRef.current.clientHeight || 500;
    const zoom = Math.min(4.0, Math.max(0.3, vpH / boxH));
    setViewportZoom(Number(zoom.toFixed(2)));
    setViewportPan({ x: 0, y: 0 });
  };

  // -------------------------------------------------------------
  // Preset Selection
  // -------------------------------------------------------------
  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const item = PRESETS.find((p) => p.id === presetId);
    if (!item) return;

    if (presetId === "free") {
      setLockRatio(false);
      return;
    }

    if (item.widthMm && item.heightMm) {
      setTargetWidthMm(item.widthMm);
      setTargetHeightMm(item.heightMm);
      setLockRatio(true);

      const ratio = item.widthMm / item.heightMm;
      // Adjust cropBox to centered ratio
      adjustCropBoxToRatio(ratio);
    } else if (presetId === "original") {
      if (imageSize.width && imageSize.height) {
        const ratio = imageSize.width / imageSize.height;
        setLockRatio(true);
        adjustCropBoxToRatio(ratio);
      }
    } else if (presetId === "center") {
      handleCenterCrop();
    } else if (presetId === "fit") {
      handleFitImage();
    } else if (presetId === "fill") {
      handleFillArea();
    }
  };

  const adjustCropBoxToRatio = (ratio: number) => {
    if (!imageSize.width || !imageSize.height) return;
    // Ratio in normalized coordinate space:
    // width_px = normW * imgW, height_px = normH * imgH
    // aspect = width_px / height_px = (normW * imgW) / (normH * imgH)
    // Therefore: normW / normH = ratio * (imgH / imgW)
    const normRatio = ratio * (imageSize.height / imageSize.width);

    let w: number;
    let h: number;
    if (normRatio <= 1) {
      h = 0.85;
      w = Math.min(0.9, h * normRatio);
    } else {
      w = 0.85;
      h = Math.min(0.9, w / normRatio);
    }

    const newCrop: A6CropBox = {
      x: (1 - w) / 2,
      y: (1 - h) / 2,
      width: Number(w.toFixed(4)),
      height: Number(h.toFixed(4)),
    };
    setCropBox(newCrop);
    pushHistory({
      cropBox: newCrop,
      imageScale,
      imagePan,
      rotation,
      targetWidthMm,
      targetHeightMm,
      lockRatio: true,
    });
  };

  // Center Crop Box
  const handleCenterCrop = () => {
    setCropBox((prev) => {
      const newCrop = {
        ...prev,
        x: Number(((1 - prev.width) / 2).toFixed(4)),
        y: Number(((1 - prev.height) / 2).toFixed(4)),
      };
      pushHistory({
        cropBox: newCrop,
        imageScale,
        imagePan,
        rotation,
        targetWidthMm,
        targetHeightMm,
        lockRatio,
      });
      return newCrop;
    });
  };

  // Fit Image
  const handleFitImage = () => {
    setImageScale(1.0);
    setImagePan({ x: 0, y: 0 });
    handleSelectPreset("74x105");
  };

  // Fill Area
  const handleFillArea = () => {
    const newCrop: A6CropBox = { x: 0.02, y: 0.02, width: 0.96, height: 0.96 };
    setCropBox(newCrop);
    setImageScale(1.0);
    setImagePan({ x: 0, y: 0 });
    pushHistory({
      cropBox: newCrop,
      imageScale: 1.0,
      imagePan: { x: 0, y: 0 },
      rotation,
      targetWidthMm,
      targetHeightMm,
      lockRatio,
    });
  };

  // Reset Crop
  const handleResetCrop = () => {
    const aspect = initialWidthMm / initialHeightMm;
    const normRatio = aspect * (imageSize.height / imageSize.width);
    let w: number;
    let h: number;
    if (normRatio <= 1) {
      h = 0.85;
      w = Math.min(0.9, h * normRatio);
    } else {
      w = 0.85;
      h = Math.min(0.9, w / normRatio);
    }
    const defaultCrop: A6CropBox = {
      x: (1 - w) / 2,
      y: (1 - h) / 2,
      width: Number(w.toFixed(4)),
      height: Number(h.toFixed(4)),
    };
    setCropBox(defaultCrop);
    setTargetWidthMm(initialWidthMm);
    setTargetHeightMm(initialHeightMm);
    setLockRatio(true);
    setImageScale(1.0);
    setImagePan({ x: 0, y: 0 });
    setRotation(0);
    setViewportZoom(1.0);
    setViewportPan({ x: 0, y: 0 });
    setSelectedPreset("74x105");

    pushHistory({
      cropBox: defaultCrop,
      imageScale: 1.0,
      imagePan: { x: 0, y: 0 },
      rotation: 0,
      targetWidthMm: initialWidthMm,
      targetHeightMm: initialHeightMm,
      lockRatio: true,
    });
  };

  // -------------------------------------------------------------
  // Pointer Event Handlers (Handles, Crop Box, Image, Viewport Pan)
  // -------------------------------------------------------------
  const handlePointerDown = (handle: string, e: React.PointerEvent) => {
    // 1. Middle mouse button (button 1) OR Space pressed OR Hand mode active -> Viewport Pan
    if (e.button === 1 || isSpacePressed || activeTool === "hand" || handle === "viewport") {
      e.preventDefault();
      e.stopPropagation();
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      setActiveHandle("viewport");
      setIsCanvasDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      viewportPanStartRef.current = { ...viewportPan };
      return;
    }

    // 2. Only accept primary left button for handles and box movement
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    setActiveHandle(handle);
    setIsCanvasDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    cropStartRef.current = { ...cropBox };
    imagePanStartRef.current = { ...imagePan };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeHandle || !containerRef.current) return;
    e.preventDefault();

    // Coalesce pointer movements using requestAnimationFrame
    const clientX = e.clientX;
    const clientY = e.clientY;
    const isShift = e.shiftKey;
    const isAlt = e.altKey;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      // 1. Viewport Pan Dragging
      if (activeHandle === "viewport") {
        const dx = clientX - dragStartRef.current.x;
        const dy = clientY - dragStartRef.current.y;
        setViewportPan({
          x: viewportPanStartRef.current.x + dx,
          y: viewportPanStartRef.current.y + dy,
        });
        return;
      }

      // 2. Image Pan Dragging inside Crop Box
      if (activeHandle === "move-image") {
        const dx = clientX - dragStartRef.current.x;
        const dy = clientY - dragStartRef.current.y;
        setImagePan({
          x: imagePanStartRef.current.x + dx,
          y: imagePanStartRef.current.y + dy,
        });
        return;
      }

      // 3. Crop Box / Handles Dragging
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      // getBoundingClientRect() is already scaled by viewportZoom; dividing client pixel delta by rect width/height gives exact normalized 0..1 movement
      const dx = (clientX - dragStartRef.current.x) / rect.width;
      const dy = (clientY - dragStartRef.current.y) / rect.height;

      const start = cropStartRef.current;
      const normRatio = (targetWidthMm / targetHeightMm) * (imageSize.height / (imageSize.width || 1));
      const effectiveLock = lockRatio || isShift;

      // A. Move entire Crop Box
      if (activeHandle === "move-box") {
        const newX = Math.max(0, Math.min(1 - start.width, start.x + dx));
        const newY = Math.max(0, Math.min(1 - start.height, start.y + dy));
        setCropBox({
          x: Number(newX.toFixed(4)),
          y: Number(newY.toFixed(4)),
          width: start.width,
          height: start.height,
        });
        return;
      }

      // B. Resize Corner Handles (NW, NE, SW, SE)
      let newX = start.x;
      let newY = start.y;
      let newW = start.width;
      let newH = start.height;

      if (activeHandle === "se") {
        newW = Math.max(0.05, Math.min(1 - start.x, start.width + dx));
        newH = Math.max(0.05, Math.min(1 - start.y, start.height + dy));

        if (effectiveLock) {
          newH = newW / normRatio;
          if (newY + newH > 1) {
            newH = 1 - newY;
            newW = newH * normRatio;
          }
        }
        if (isAlt) {
          // Center resize
          const cx = start.x + start.width / 2;
          const cy = start.y + start.height / 2;
          newX = Math.max(0, cx - newW / 2);
          newY = Math.max(0, cy - newH / 2);
        }
      } else if (activeHandle === "sw") {
        newW = Math.max(0.05, start.width - dx);
        newX = start.x + (start.width - newW);
        if (newX < 0) {
          newW += newX;
          newX = 0;
        }
        newH = Math.max(0.05, Math.min(1 - start.y, start.height + dy));

        if (effectiveLock) {
          newH = newW / normRatio;
          if (newY + newH > 1) {
            newH = 1 - newY;
            newW = newH * normRatio;
            newX = start.x + start.width - newW;
          }
        }
        if (isAlt) {
          const cx = start.x + start.width / 2;
          const cy = start.y + start.height / 2;
          newX = Math.max(0, cx - newW / 2);
          newY = Math.max(0, cy - newH / 2);
        }
      } else if (activeHandle === "ne") {
        newW = Math.max(0.05, Math.min(1 - start.x, start.width + dx));
        newH = Math.max(0.05, start.height - dy);
        newY = start.y + (start.height - newH);
        if (newY < 0) {
          newH += newY;
          newY = 0;
        }
        if (effectiveLock) {
          newH = newW / normRatio;
          newY = start.y + start.height - newH;
          if (newY < 0) {
            newY = 0;
            newH = start.y + start.height;
            newW = newH * normRatio;
          }
        }
        if (isAlt) {
          const cx = start.x + start.width / 2;
          const cy = start.y + start.height / 2;
          newX = Math.max(0, cx - newW / 2);
          newY = Math.max(0, cy - newH / 2);
        }
      } else if (activeHandle === "nw") {
        newW = Math.max(0.05, start.width - dx);
        newX = start.x + (start.width - newW);
        if (newX < 0) {
          newW += newX;
          newX = 0;
        }
        newH = Math.max(0.05, start.height - dy);
        newY = start.y + (start.height - newH);
        if (newY < 0) {
          newH += newY;
          newY = 0;
        }
        if (effectiveLock) {
          newH = newW / normRatio;
          newY = start.y + start.height - newH;
          if (newY < 0) {
            newY = 0;
            newH = start.y + start.height;
            newW = newH * normRatio;
            newX = start.x + start.width - newW;
          }
        }
        if (isAlt) {
          const cx = start.x + start.width / 2;
          const cy = start.y + start.height / 2;
          newX = Math.max(0, cx - newW / 2);
          newY = Math.max(0, cy - newH / 2);
        }
      }

      // C. Resize Edge Handles (N, S, E, W)
      else if (activeHandle === "n") {
        newH = Math.max(0.05, start.height - dy);
        newY = start.y + (start.height - newH);
        if (newY < 0) {
          newH += newY;
          newY = 0;
        }
        if (effectiveLock) {
          newW = newH * normRatio;
          newX = start.x + (start.width - newW) / 2;
          if (newX < 0) newX = 0;
          if (newX + newW > 1) newW = 1 - newX;
        }
      } else if (activeHandle === "s") {
        newH = Math.max(0.05, Math.min(1 - start.y, start.height + dy));
        if (effectiveLock) {
          newW = newH * normRatio;
          newX = start.x + (start.width - newW) / 2;
          if (newX < 0) newX = 0;
          if (newX + newW > 1) newW = 1 - newX;
        }
      } else if (activeHandle === "w") {
        newW = Math.max(0.05, start.width - dx);
        newX = start.x + (start.width - newW);
        if (newX < 0) {
          newW += newX;
          newX = 0;
        }
        if (effectiveLock) {
          newH = newW / normRatio;
          newY = start.y + (start.height - newH) / 2;
          if (newY < 0) newY = 0;
          if (newY + newH > 1) newH = 1 - newY;
        }
      } else if (activeHandle === "e") {
        newW = Math.max(0.05, Math.min(1 - start.x, start.width + dx));
        if (effectiveLock) {
          newH = newW / normRatio;
          newY = start.y + (start.height - newH) / 2;
          if (newY < 0) newY = 0;
          if (newY + newH > 1) newH = 1 - newY;
        }
      }

      // Clamp boundary strictly
      newX = Math.max(0, Math.min(1 - newW, newX));
      newY = Math.max(0, Math.min(1 - newH, newY));
      newW = Math.max(0.05, Math.min(1 - newX, newW));
      newH = Math.max(0.05, Math.min(1 - newY, newH));

      setCropBox({
        x: Number(newX.toFixed(4)),
        y: Number(newY.toFixed(4)),
        width: Number(newW.toFixed(4)),
        height: Number(newH.toFixed(4)),
      });
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeHandle) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}

      if (activeHandle !== "viewport") {
        pushHistory({
          cropBox,
          imageScale,
          imagePan,
          rotation,
          targetWidthMm,
          targetHeightMm,
          lockRatio,
        });
      }

      setActiveHandle(null);
      setIsCanvasDragging(false);
    }
  };

  // -------------------------------------------------------------
  // High-Resolution 300 DPI Apply Crop Export
  // -------------------------------------------------------------
  const handleApply = () => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const dpi = 300;
      const targetCanvasW = Math.round((targetWidthMm * dpi) / 25.4);
      const targetCanvasH = Math.round((targetHeightMm * dpi) / 25.4);

      const outCanvas = document.createElement("canvas");
      outCanvas.width = Math.max(100, targetCanvasW);
      outCanvas.height = Math.max(100, targetCanvasH);
      const ctx = outCanvas.getContext("2d");
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // 1. Crop box in natural image pixel space
      const srcX = cropBox.x * img.naturalWidth;
      const srcY = cropBox.y * img.naturalHeight;
      const srcW = cropBox.width * img.naturalWidth;
      const srcH = cropBox.height * img.naturalHeight;

      // 2. Intermediate offscreen canvas containing cropped source slice
      const cropSlice = document.createElement("canvas");
      cropSlice.width = Math.max(50, Math.round(srcW));
      cropSlice.height = Math.max(50, Math.round(srcH));
      const sliceCtx = cropSlice.getContext("2d");
      if (sliceCtx) {
        sliceCtx.imageSmoothingEnabled = true;
        sliceCtx.imageSmoothingQuality = "high";
        sliceCtx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, cropSlice.width, cropSlice.height);
      }

      // 3. Render onto final physical canvas with user transforms (rotation, imageScale, imagePan)
      ctx.save();
      ctx.translate(outCanvas.width / 2, outCanvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(imageScale, imageScale);

      // Convert pan offset to canvas coordinate system
      const pxPanX = (imagePan.x / 100) * outCanvas.width;
      const pxPanY = (imagePan.y / 100) * outCanvas.height;
      ctx.translate(-outCanvas.width / 2 + pxPanX, -outCanvas.height / 2 + pxPanY);

      ctx.drawImage(cropSlice, 0, 0, outCanvas.width, outCanvas.height);
      ctx.restore();

      const croppedUrl = outCanvas.toDataURL("image/png");

      const finalState: A6CropState = {
        cropBox,
        preset: selectedPreset,
        targetWidthMm,
        targetHeightMm,
        lockRatio,
        imageScale,
        imagePan,
        rotation,
        showGrid,
        showCenterGuides,
        showSafeArea,
        showBleedGuides,
        showPhysicalGuide,
      };

      onApplyCrop(croppedUrl, finalState);
      onClose();
    };
    img.src = imageSrc;
  };

  if (!isOpen) return null;

  // Calculated physical millimeter measurements for display
  const physicalWidthPx = imageSize.width * cropBox.width;
  const physicalHeightPx = imageSize.height * cropBox.height;
  const effectiveDpi = Math.round(
    Math.min(
      (physicalWidthPx / (targetWidthMm / 25.4)),
      (physicalHeightPx / (targetHeightMm / 25.4))
    ) || 300
  );

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 select-none">
      <div className="bg-neutral-900 border border-neutral-750 rounded-2xl w-full max-w-6xl h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn">
        {/* ========================================================= */}
        {/* Header Bar */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-neutral-950/80">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Crop {cardSide.toUpperCase()} Card
                </h3>
                <span className="text-[11px] font-mono font-medium text-indigo-400 bg-indigo-950/70 px-2 py-0.5 rounded border border-indigo-800/60">
                  Target: {targetWidthMm} × {targetHeightMm} mm
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/50">
                  {effectiveDpi} DPI
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Exact physical A6 half-card dimensions. Drag handles, hold Shift to lock ratio, Alt to resize from center.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Undo / Redo */}
            <button
              onClick={handleUndo}
              disabled={historyIndexRef.current <= 0}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-30 disabled:hover:bg-neutral-800 transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndexRef.current >= historyRef.current.length - 1}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-30 disabled:hover:bg-neutral-800 transition-colors"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-neutral-800 mx-1" />

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Close (Escape)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* Mode Switcher & Presets Ribbon */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between px-5 py-2 border-b border-neutral-800 bg-neutral-900/90 text-xs overflow-x-auto gap-3">
          {/* Interaction Mode Toggle */}
          <div className="flex items-center bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 shrink-0">
            <button
              onClick={() => setActiveTool("box")}
              className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                activeTool === "box"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
              title="Resize and reposition crop box"
            >
              <Crop className="w-3.5 h-3.5" />
              <span>Crop Box</span>
            </button>
            <button
              onClick={() => setActiveTool("image")}
              className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                activeTool === "image"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
              title="Move and pan image inside crop frame"
            >
              <Move className="w-3.5 h-3.5" />
              <span>Move Image</span>
            </button>
            <button
              onClick={() => setActiveTool("hand")}
              className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                activeTool === "hand"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
              title="Hand Tool: Pan preview canvas (H or Space+Drag)"
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Pan Canvas</span>
            </button>
          </div>

          {/* Quick Presets Chips */}
          <div className="flex items-center space-x-1.5 shrink-0 overflow-x-auto">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                  selectedPreset === p.id
                    ? "bg-indigo-600/25 text-indigo-300 border-indigo-500/60"
                    : "bg-neutral-800/80 text-neutral-300 border-neutral-700/60 hover:text-white hover:bg-neutral-750"
                }`}
                title={p.description}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Rotation & Flip Controls */}
          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
              className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
              title="Rotate 90° CCW"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
              title="Rotate 90° CW"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLockRatio(!lockRatio)}
              className={`p-1.5 rounded border transition-colors ${
                lockRatio
                  ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/50"
                  : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white"
              }`}
              title={lockRatio ? "Lock Aspect Ratio (ON)" : "Lock Aspect Ratio (OFF)"}
            >
              {lockRatio ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* Main Body: Interactive Canvas Viewport (Left) + Numeric Controls (Right) */}
        {/* ========================================================= */}
        <div className="flex-1 flex overflow-hidden">
          {/* ------------------------------------------------------- */}
          {/* Canvas Viewport Area */}
          {/* ------------------------------------------------------- */}
          <div className="flex-1 flex flex-col relative bg-neutral-950 overflow-hidden">
            {/* Viewport Floating Toolbar */}
            <div className="absolute top-3 left-4 z-20 flex items-center space-x-2 bg-neutral-900/90 backdrop-blur-md border border-neutral-750 px-2 py-1 rounded-xl shadow-xl text-xs">
              {/* Guides Toggles */}
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`p-1.5 rounded transition-colors ${
                  showGrid ? "text-indigo-400 bg-indigo-950/60" : "text-neutral-400 hover:text-neutral-200"
                }`}
                title="Toggle Rule of Thirds Grid"
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowCenterGuides(!showCenterGuides)}
                className={`p-1.5 rounded transition-colors ${
                  showCenterGuides ? "text-indigo-400 bg-indigo-950/60" : "text-neutral-400 hover:text-neutral-200"
                }`}
                title="Toggle Center Crosshair Guides"
              >
                <Crosshair className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowSafeArea(!showSafeArea)}
                className={`p-1.5 rounded transition-colors ${
                  showSafeArea ? "text-emerald-400 bg-emerald-950/60" : "text-neutral-400 hover:text-neutral-200"
                }`}
                title="Toggle 3mm Safe Area Inset Guide"
              >
                <Shield className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowBleedGuides(!showBleedGuides)}
                className={`p-1.5 rounded transition-colors ${
                  showBleedGuides ? "text-rose-400 bg-rose-950/60" : "text-neutral-400 hover:text-neutral-200"
                }`}
                title="Toggle 3mm Bleed Outset Guide"
              >
                <Scissors className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-4 bg-neutral-800" />

              {/* Viewport Zoom Controls */}
              <button
                onClick={() => setViewportZoom((z) => Math.max(0.25, Number((z - 0.15).toFixed(2))))}
                className="p-1.5 rounded text-neutral-400 hover:text-white transition-colors"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-neutral-300 text-[11px] w-12 text-center">
                {Math.round(viewportZoom * 100)}%
              </span>
              <button
                onClick={() => setViewportZoom((z) => Math.min(5.0, Number((z + 0.15).toFixed(2))))}
                className="p-1.5 rounded text-neutral-400 hover:text-white transition-colors"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setViewportZoom(1.0);
                  setViewportPan({ x: 0, y: 0 });
                }}
                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                title="Reset View (0)"
              >
                100%
              </button>
            </div>

            {/* Canvas Interactive Viewport */}
            <div
              ref={viewportRef}
              className={`flex-1 flex items-center justify-center p-8 overflow-hidden relative select-none ${
                isCanvasDragging
                  ? "cursor-grabbing"
                  : isSpacePressed || activeTool === "hand"
                  ? "cursor-grab"
                  : "cursor-default"
              }`}
              onPointerDown={(e) => handlePointerDown("viewport", e)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={(e) => {
                if (isCanvasDragging) e.preventDefault();
              }}
            >
              {/* Scalable & Pannable Canvas Board */}
              <div
                ref={containerRef}
                className="relative inline-block border border-neutral-800 rounded-sm shadow-2xl select-none bg-black"
                style={{
                  transform: `translate(${viewportPan.x}px, ${viewportPan.y}px) scale(${viewportZoom})`,
                  transformOrigin: "center center",
                  transition: isCanvasDragging ? "none" : "transform 0.08s ease-out",
                }}
              >
                {/* Source Image */}
                <div
                  className="relative overflow-hidden block"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: "transform 0.15s ease-out",
                  }}
                >
                  <img
                    ref={imageRef}
                    src={imageSrc}
                    alt="Crop target"
                    className="max-h-[62vh] max-w-[55vw] object-contain block pointer-events-none select-none"
                    style={{
                      transform: `scale(${imageScale}) translate(${imagePan.x}px, ${imagePan.y}px)`,
                      transition: "transform 0.05s ease-out",
                    }}
                  />
                </div>

                {/* Dark Mask outside Crop Box */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "rgba(0, 0, 0, 0.68)",
                    clipPath: `polygon(
                      0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                      ${cropBox.x * 100}% ${cropBox.y * 100}%,
                      ${(cropBox.x + cropBox.width) * 100}% ${cropBox.y * 100}%,
                      ${(cropBox.x + cropBox.width) * 100}% ${(cropBox.y + cropBox.height) * 100}%,
                      ${cropBox.x * 100}% ${(cropBox.y + cropBox.height) * 100}%,
                      ${cropBox.x * 100}% ${cropBox.y * 100}%
                    )`,
                  }}
                />

                {/* Bleed Guide (3mm outer bleed border) */}
                {showBleedGuides && (
                  <div
                    className="absolute border border-dashed border-rose-500/70 pointer-events-none"
                    style={{
                      left: `max(0%, ${(cropBox.x - (3 / targetWidthMm) * cropBox.width) * 100}%)`,
                      top: `max(0%, ${(cropBox.y - (3 / targetHeightMm) * cropBox.height) * 100}%)`,
                      width: `${Math.min(100, (cropBox.width + ((6 / targetWidthMm) * cropBox.width)) * 100)}%`,
                      height: `${Math.min(100, (cropBox.height + ((6 / targetHeightMm) * cropBox.height)) * 100)}%`,
                    }}
                  >
                    <span className="absolute -top-3.5 left-0 text-[8px] font-mono text-rose-400 bg-rose-950/80 px-1 rounded">
                      Bleed (3mm)
                    </span>
                  </div>
                )}

                {/* Active Crop Box Boundary */}
                <div
                  className={`absolute border-2 border-indigo-400 shadow-[0_0_0_1px_rgba(0,0,0,0.8)] ${
                    activeTool === "image"
                      ? "cursor-move"
                      : activeTool === "box"
                      ? "cursor-move"
                      : "cursor-default"
                  }`}
                  style={{
                    left: `${cropBox.x * 100}%`,
                    top: `${cropBox.y * 100}%`,
                    width: `${cropBox.width * 100}%`,
                    height: `${cropBox.height * 100}%`,
                  }}
                  onPointerDown={(e) => {
                    if (activeTool === "image") {
                      handlePointerDown("move-image", e);
                    } else if (activeTool === "box") {
                      handlePointerDown("move-box", e);
                    }
                  }}
                >
                  {/* Physical Dimension Badge */}
                  {showPhysicalGuide && (
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-indigo-900/90 text-indigo-200 border border-indigo-700/80 px-2 py-0.5 rounded text-[9px] font-mono whitespace-nowrap pointer-events-none shadow-md">
                      {targetWidthMm} × {targetHeightMm} mm ({Math.round(physicalWidthPx)} × {Math.round(physicalHeightPx)} px)
                    </div>
                  )}

                  {/* Rule of Thirds Grid */}
                  {showGrid && (
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-45">
                      <div className="border-r border-b border-white/70" />
                      <div className="border-r border-b border-white/70" />
                      <div className="border-b border-white/70" />
                      <div className="border-r border-b border-white/70" />
                      <div className="border-r border-b border-white/70" />
                      <div className="border-b border-white/70" />
                      <div className="border-r border-white/70" />
                      <div className="border-r border-white/70" />
                      <div />
                    </div>
                  )}

                  {/* Center Crosshair Guides */}
                  {showCenterGuides && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
                      <div className="absolute w-full border-t border-dashed border-indigo-300" />
                      <div className="absolute h-full border-l border-dashed border-indigo-300" />
                    </div>
                  )}

                  {/* Safe Area Guide (3mm inner margin) */}
                  {showSafeArea && (
                    <div
                      className="absolute border border-dashed border-emerald-400/80 pointer-events-none"
                      style={{
                        inset: `${Math.min(25, (3 / targetWidthMm) * 100)}%`,
                      }}
                    >
                      <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-emerald-400">
                        Safe (3mm)
                      </span>
                    </div>
                  )}

                  {/* Corner Handles (4) */}
                  <div
                    className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize shadow-lg hover:scale-125 transition-transform"
                    onPointerDown={(e) => handlePointerDown("nw", e)}
                  />
                  <div
                    className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-sm cursor-nesw-resize shadow-lg hover:scale-125 transition-transform"
                    onPointerDown={(e) => handlePointerDown("ne", e)}
                  />
                  <div
                    className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-sm cursor-nesw-resize shadow-lg hover:scale-125 transition-transform"
                    onPointerDown={(e) => handlePointerDown("sw", e)}
                  />
                  <div
                    className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize shadow-lg hover:scale-125 transition-transform"
                    onPointerDown={(e) => handlePointerDown("se", e)}
                  />

                  {/* Edge Handles (4) */}
                  <div
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border-2 border-indigo-600 rounded-sm cursor-ns-resize shadow-lg hover:scale-110 transition-transform"
                    onPointerDown={(e) => handlePointerDown("n", e)}
                  />
                  <div
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border-2 border-indigo-600 rounded-sm cursor-ns-resize shadow-lg hover:scale-110 transition-transform"
                    onPointerDown={(e) => handlePointerDown("s", e)}
                  />
                  <div
                    className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-6 bg-white border-2 border-indigo-600 rounded-sm cursor-ew-resize shadow-lg hover:scale-110 transition-transform"
                    onPointerDown={(e) => handlePointerDown("w", e)}
                  />
                  <div
                    className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-6 bg-white border-2 border-indigo-600 rounded-sm cursor-ew-resize shadow-lg hover:scale-110 transition-transform"
                    onPointerDown={(e) => handlePointerDown("e", e)}
                  />
                </div>
              </div>
            </div>

            {/* Viewport Bottom Hint Bar */}
            <div className="px-5 py-1.5 border-t border-neutral-800 bg-neutral-950/70 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
              <div className="flex items-center space-x-3">
                <span>Hold <kbd className="px-1 py-0.5 bg-neutral-800 text-neutral-200 rounded">Space</kbd> + Left Drag to Pan Canvas</span>
                <span>•</span>
                <span>Middle-Mouse Drag to Pan</span>
                <span>•</span>
                <span>Wheel to Zoom</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>Hold <kbd className="px-1 py-0.5 bg-neutral-800 text-neutral-200 rounded">Shift</kbd> Lock Ratio</span>
                <span>•</span>
                <span>Hold <kbd className="px-1 py-0.5 bg-neutral-800 text-neutral-200 rounded">Alt</kbd> Center Resize</span>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------- */}
          {/* Right Side Panel: Advanced Numeric Crop Controls */}
          {/* ------------------------------------------------------- */}
          <div className="w-80 bg-neutral-900 border-l border-neutral-800 flex flex-col overflow-y-auto">
            <div className="p-4 space-y-5">
              {/* Section 1: Physical Millimeter Dimensions */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center space-x-1.5 mb-2.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Physical Output (mm)</span>
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Target Width</label>
                    <A6HalfCardNumericInput
                      id="crop-target-width-mm"
                      value={targetWidthMm}
                      min={20}
                      max={300}
                      step={1}
                      precision={1}
                      unit="mm"
                      onChange={(val) => {
                        setTargetWidthMm(val);
                        if (lockRatio) {
                          setTargetHeightMm(Number((val / targetAspect).toFixed(1)));
                        }
                      }}
                      ariaLabel="Crop Target Width in Millimeters"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Target Height</label>
                    <A6HalfCardNumericInput
                      id="crop-target-height-mm"
                      value={targetHeightMm}
                      min={20}
                      max={300}
                      step={1}
                      precision={1}
                      unit="mm"
                      onChange={(val) => {
                        setTargetHeightMm(val);
                        if (lockRatio) {
                          setTargetWidthMm(Number((val * targetAspect).toFixed(1)));
                        }
                      }}
                      ariaLabel="Crop Target Height in Millimeters"
                    />
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-400">
                  <span>Aspect Ratio:</span>
                  <span className="font-mono text-neutral-200">
                    {(targetWidthMm / targetHeightMm).toFixed(3)} ({(targetWidthMm).toFixed(0)}:{(targetHeightMm).toFixed(0)})
                  </span>
                </div>
              </div>

              <div className="h-px bg-neutral-800" />

              {/* Section 2: Crop Box Position & Percentage */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center space-x-1.5 mb-2.5">
                  <Crop className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Crop Box Coordinates</span>
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Crop X (%)</label>
                    <A6HalfCardNumericInput
                      id="crop-box-x"
                      value={Math.round(cropBox.x * 100)}
                      min={0}
                      max={100}
                      step={1}
                      unit="%"
                      onChange={(val) => {
                        const newX = Math.min(1 - cropBox.width, val / 100);
                        setCropBox((prev) => ({ ...prev, x: newX }));
                      }}
                      ariaLabel="Crop Box X Position Percent"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Crop Y (%)</label>
                    <A6HalfCardNumericInput
                      id="crop-box-y"
                      value={Math.round(cropBox.y * 100)}
                      min={0}
                      max={100}
                      step={1}
                      unit="%"
                      onChange={(val) => {
                        const newY = Math.min(1 - cropBox.height, val / 100);
                        setCropBox((prev) => ({ ...prev, y: newY }));
                      }}
                      ariaLabel="Crop Box Y Position Percent"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Crop Width (%)</label>
                    <A6HalfCardNumericInput
                      id="crop-box-width"
                      value={Math.round(cropBox.width * 100)}
                      min={5}
                      max={100}
                      step={1}
                      unit="%"
                      onChange={(val) => {
                        const newW = Math.min(1 - cropBox.x, val / 100);
                        setCropBox((prev) => ({ ...prev, width: newW }));
                      }}
                      ariaLabel="Crop Box Width Percent"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-1">Crop Height (%)</label>
                    <A6HalfCardNumericInput
                      id="crop-box-height"
                      value={Math.round(cropBox.height * 100)}
                      min={5}
                      max={100}
                      step={1}
                      unit="%"
                      onChange={(val) => {
                        const newH = Math.min(1 - cropBox.y, val / 100);
                        setCropBox((prev) => ({ ...prev, height: newH }));
                      }}
                      ariaLabel="Crop Box Height Percent"
                    />
                  </div>
                </div>

                {/* Quick alignment buttons */}
                <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                  <button
                    onClick={handleCenterCrop}
                    className="py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-medium transition-colors"
                  >
                    Center Box
                  </button>
                  <button
                    onClick={handleFitImage}
                    className="py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-medium transition-colors"
                  >
                    Fit Area
                  </button>
                  <button
                    onClick={handleFillArea}
                    className="py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-medium transition-colors"
                  >
                    Fill Area
                  </button>
                </div>
              </div>

              <div className="h-px bg-neutral-800" />

              {/* Section 3: Image Scale & Offset Inside Crop */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center space-x-1.5 mb-2.5">
                  <Move className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Image Inside Crop</span>
                </h4>
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                      <span>Image Zoom</span>
                      <span className="font-mono text-neutral-200">{Math.round(imageScale * 100)}%</span>
                    </div>
                    <A6HalfCardNumericInput
                      id="crop-image-scale"
                      value={Math.round(imageScale * 100)}
                      min={50}
                      max={400}
                      step={5}
                      unit="%"
                      onChange={(val) => setImageScale(val / 100)}
                      ariaLabel="Image Zoom Percent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-1">Image Pan X</label>
                      <A6HalfCardNumericInput
                        id="crop-image-pan-x"
                        value={imagePan.x}
                        min={-200}
                        max={200}
                        step={2}
                        unit="px"
                        onChange={(val) => setImagePan((p) => ({ ...p, x: val }))}
                        ariaLabel="Image Horizontal Pan Offset"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 block mb-1">Image Pan Y</label>
                      <A6HalfCardNumericInput
                        id="crop-image-pan-y"
                        value={imagePan.y}
                        min={-200}
                        max={200}
                        step={2}
                        unit="px"
                        onChange={(val) => setImagePan((p) => ({ ...p, y: val }))}
                        ariaLabel="Image Vertical Pan Offset"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                      <span>Fine Rotation</span>
                      <span className="font-mono text-neutral-200">{rotation}°</span>
                    </div>
                    <A6HalfCardNumericInput
                      id="crop-image-rotation"
                      value={rotation}
                      min={-180}
                      max={180}
                      step={1}
                      unit="°"
                      onChange={(val) => setRotation(val)}
                      ariaLabel="Image Rotation Degrees"
                    />
                  </div>

                  <button
                    onClick={() => {
                      setImageScale(1.0);
                      setImagePan({ x: 0, y: 0 });
                      setRotation(0);
                    }}
                    className="w-full py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-medium transition-colors"
                  >
                    Reset Image Position & Scale
                  </button>
                </div>
              </div>

              <div className="h-px bg-neutral-800" />

              {/* Section 4: Print & Resolution Specifications */}
              <div className="bg-neutral-950/70 p-3 rounded-xl border border-neutral-800 text-[11px] space-y-1.5 font-mono">
                <div className="text-neutral-400 flex justify-between">
                  <span>Source Res:</span>
                  <span className="text-neutral-200">{imageSize.width} × {imageSize.height} px</span>
                </div>
                <div className="text-neutral-400 flex justify-between">
                  <span>Target 300 DPI:</span>
                  <span className="text-indigo-400">
                    {Math.round((targetWidthMm * 300) / 25.4)} × {Math.round((targetHeightMm * 300) / 25.4)} px
                  </span>
                </div>
                <div className="text-neutral-400 flex justify-between">
                  <span>Effective Output:</span>
                  <span className={effectiveDpi >= 250 ? "text-emerald-400" : "text-amber-400"}>
                    {effectiveDpi} DPI ({effectiveDpi >= 250 ? "Print Sharp" : "Fair"})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* Footer Bar */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-800 bg-neutral-950">
          <div className="flex items-center space-x-3 text-xs text-neutral-400 font-mono">
            <span>
              Cropping: <strong className="text-neutral-200">{Math.round(cropBox.width * 100)}% × {Math.round(cropBox.height * 100)}%</strong> of original
            </span>
            <span>•</span>
            <span>
              Physical Size: <strong className="text-indigo-400">{targetWidthMm} × {targetHeightMm} mm</strong>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleResetCrop}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-750 transition-colors cursor-pointer"
            >
              Reset
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Cancel (Esc)
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply Crop (Enter)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
