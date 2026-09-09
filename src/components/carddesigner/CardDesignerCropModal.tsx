/**
 * CardDesignerCropModal.tsx
 * 
 * High-Precision Crop, Deskew, Rotation & Auto-Fit Studio for Card Designer:
 * - Dedicated crop workflow consistent with ID Card & CNIC Copy Studio
 * - 8-point corner/edge handles + free/preset aspect ratios (85.6:54 CR80 Card, 1:1, 3:4, 4:3, 3:2, 16:9, Free)
 * - Independent image Zoom (25%-1000%) with cursor/center wheel zoom & pan
 * - 90° CW/CCW quick rotation + fine rotation + fine deskew (-15.0° to +15.0°) with 0.1° accuracy
 * - Smooth real-time live preview canvas via requestAnimationFrame
 * - Synchronized live numeric inputs for crop coordinates, rotation, deskew, and zoom
 * - Non-destructive original source preservation & revert capability
 * - Auto-fits confirmed result to exact CR80 physical card dimensions (85.6mm × 54mm)
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Crop,
  Check,
  X,
  RotateCw,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Sliders,
  Move,
  Lock,
  Unlock,
  Eye,
  Sparkles,
} from "lucide-react";
import { CardObject, ImageCropRect } from "../../engine/carddesigner/types";

export type CardCropPresetType =
  | "85.6:54"
  | "free"
  | "original"
  | "1:1"
  | "3:4"
  | "4:3"
  | "3:2"
  | "16:9"
  | "a6";

export type DragHandleType =
  | "move-box"
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left";

export interface PixelCropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CardDesignerAdjustments {
  cropBoxNorm: { x: number; y: number; width: number; height: number };
  cropBoxPixels: PixelCropBox;
  zoom: number;
  imagePan: { x: number; y: number };
  rotation: number; // 0, 90, 180, 270
  deskewAngle: number; // -15.0 to +15.0
  preset: CardCropPresetType;
  aspectRatioLocked: boolean;
  shape?: "rect" | "circle" | "rounded";
}

export interface CropConfirmResult {
  croppedDataUrl: string;
  originalSrc: string;
  naturalWidth: number;
  naturalHeight: number;
  adjustments: CardDesignerAdjustments;
  cropRect?: ImageCropRect;
}

export interface CardDesignerCropModalTarget {
  existingObject?: CardObject;
  imageSrc: string;
  originalSrc?: string;
  targetSide: "front" | "back";
  title?: string;
  initialAdjustments?: CardDesignerAdjustments;
  isNewImport?: boolean;
}

interface CardDesignerCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: CardDesignerCropModalTarget | null;
  onConfirm: (result: CropConfirmResult) => void;
}

export const CardDesignerCropModal: React.FC<CardDesignerCropModalProps> = ({
  isOpen,
  onClose,
  target,
  onConfirm,
}) => {
  // Source Image & Dimensions
  const [naturalWidth, setNaturalWidth] = useState<number>(800);
  const [naturalHeight, setNaturalHeight] = useState<number>(500);
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);

  // Rotation (90° increments) & Deskew Angle (-15° to +15°)
  const [rotation, setRotation] = useState<number>(
    target?.initialAdjustments?.rotation ?? 0
  );
  const [deskewAngle, setDeskewAngle] = useState<number>(
    target?.initialAdjustments?.deskewAngle ?? 0
  );

  // Zoom & Pan
  const [zoom, setZoom] = useState<number>(
    target?.initialAdjustments?.zoom ?? 1.0
  );
  const [imagePan, setImagePan] = useState<{ x: number; y: number }>(
    target?.initialAdjustments?.imagePan ?? { x: 0, y: 0 }
  );

  // Aspect Ratio & Preset
  const [preset, setPreset] = useState<CardCropPresetType>(
    target?.initialAdjustments?.preset ?? "85.6:54"
  );
  const [aspectRatioLocked, setAspectRatioLocked] = useState<boolean>(
    target?.initialAdjustments?.aspectRatioLocked ?? true
  );

  // Mask Shape
  const [cropShape, setCropShape] = useState<"rect" | "circle" | "rounded">(
    target?.initialAdjustments?.shape ?? "rect"
  );

  // Stage Viewport
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageDimensions, setStageDimensions] = useState<{ width: number; height: number }>({
    width: 700,
    height: 480,
  });

  // Crop Box in Stage Coordinates
  const [cropBox, setCropBox] = useState<PixelCropBox>({
    x: 100,
    y: 60,
    width: 500,
    height: 315,
  });

  // Active interaction handle
  const [activeHandle, setActiveHandle] = useState<DragHandleType | null>(null);
  const [isPanningImage, setIsPanningImage] = useState<boolean>(false);

  // Drag start tracking refs
  const panStartRef = useRef<{ clientX: number; clientY: number; initialPan: { x: number; y: number } }>({
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
    initialBox: { x: 0, y: 0, width: 0, height: 0 },
  });

  // Loaded source image element ref
  const sourceImageRef = useRef<HTMLImageElement | null>(null);

  // Live preview canvas ref
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafPreviewIdRef = useRef<number | null>(null);

  // Measure Stage Dimensions
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  // Load Source Image
  const imageSrc = target?.imageSrc || "";
  useEffect(() => {
    if (!isOpen || !imageSrc) return;
    setImgLoaded(false);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setNaturalWidth(img.naturalWidth || 800);
      setNaturalHeight(img.naturalHeight || 500);
      sourceImageRef.current = img;
      setImgLoaded(true);

      // Initialize crop box to 85.6:54 ratio if not provided
      const targetAspect = 85.6 / 54.0;
      const stageW = stageDimensions.width || 700;
      const stageH = stageDimensions.height || 480;

      let initW = Math.min(stageW * 0.75, 520);
      let initH = initW / targetAspect;
      if (initH > stageH * 0.75) {
        initH = stageH * 0.75;
        initW = initH * targetAspect;
      }

      if (target?.initialAdjustments?.cropBoxPixels) {
        setCropBox(target.initialAdjustments.cropBoxPixels);
        setRotation(target.initialAdjustments.rotation ?? 0);
        setDeskewAngle(target.initialAdjustments.deskewAngle ?? 0);
        setZoom(target.initialAdjustments.zoom ?? 1.0);
        setImagePan(target.initialAdjustments.imagePan ?? { x: 0, y: 0 });
        setPreset(target.initialAdjustments.preset ?? "85.6:54");
        setAspectRatioLocked(target.initialAdjustments.aspectRatioLocked ?? true);
        setCropShape(target.initialAdjustments.shape ?? "rect");
      } else {
        const initialBox: PixelCropBox = {
          x: Math.round((stageW - initW) / 2),
          y: Math.round((stageH - initH) / 2),
          width: Math.round(initW),
          height: Math.round(initH),
        };
        setCropBox(initialBox);
        setRotation(0);
        setDeskewAngle(0);
        setZoom(1.0);
        setImagePan({ x: 0, y: 0 });
        setPreset("85.6:54");
        setAspectRatioLocked(true);
        setCropShape("rect");
      }
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc, stageDimensions.width, stageDimensions.height]);

  // Rotated & Deskewed Dimensions
  const isRotated90 = rotation % 180 !== 0;
  const rotW = isRotated90 ? naturalHeight : naturalWidth;
  const rotH = isRotated90 ? naturalWidth : naturalHeight;

  // Base Fitted Scale & Dimensions in Stage
  const baseScale = Math.min(
    (stageDimensions.width * 0.8) / (rotW || 800),
    (stageDimensions.height * 0.8) / (rotH || 500),
    1.0
  );
  const baseDisplayW = (rotW || 800) * baseScale;
  const baseDisplayH = (rotH || 500) * baseScale;

  // Current Displayed Image Dimensions & Position on Screen
  const displayedW = baseDisplayW * zoom;
  const displayedH = baseDisplayH * zoom;
  const imgLeft = stageDimensions.width / 2 + imagePan.x - displayedW / 2;
  const imgTop = stageDimensions.height / 2 + imagePan.y - displayedH / 2;

  // Target Aspect Ratio calculation
  const getTargetAspectRatio = useCallback((): number | null => {
    if (!aspectRatioLocked || preset === "free") return null;
    if (preset === "85.6:54") return 85.6 / 54.0;
    if (preset === "original") return rotW / rotH;
    if (preset === "1:1") return 1.0;
    if (preset === "3:4") return 3 / 4;
    if (preset === "4:3") return 4 / 3;
    if (preset === "3:2") return 3 / 2;
    if (preset === "16:9") return 16 / 9;
    if (preset === "a6") return 148 / 105;
    return null;
  }, [aspectRatioLocked, preset, rotW, rotH]);

  // Apply Preset Aspect Ratio while keeping crop box centered
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

      return {
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newW),
        height: Math.round(newH),
      };
    });
  };

  const handleSelectPreset = (newPreset: CardCropPresetType) => {
    setPreset(newPreset);
    if (newPreset === "free") {
      setAspectRatioLocked(false);
    } else {
      setAspectRatioLocked(true);
      if (newPreset === "85.6:54") applyPresetAspect(85.6 / 54.0);
      else if (newPreset === "1:1") applyPresetAspect(1.0);
      else if (newPreset === "3:4") applyPresetAspect(3 / 4);
      else if (newPreset === "4:3") applyPresetAspect(4 / 3);
      else if (newPreset === "3:2") applyPresetAspect(3 / 2);
      else if (newPreset === "16:9") applyPresetAspect(16 / 9);
      else if (newPreset === "a6") applyPresetAspect(148 / 105);
      else if (newPreset === "original") applyPresetAspect(rotW / rotH);
    }
  };

  // Rotation Actions
  const handleRotateCw = () => setRotation((prev) => (prev + 90) % 360);
  const handleRotateCcw = () => setRotation((prev) => (prev + 270) % 360);

  // Zoom Actions
  const handleZoomIn = () => setZoom((z) => Math.min(10.0, Number((z * 1.2).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.25, Number((z / 1.2).toFixed(2))));
  const handleResetZoom = () => {
    setZoom(1.0);
    setImagePan({ x: 0, y: 0 });
  };
  const handleFitCrop = () => {
    const scaleX = cropBox.width / (baseDisplayW || 1);
    const scaleY = cropBox.height / (baseDisplayH || 1);
    const bestScale = Math.max(scaleX, scaleY);
    setZoom(Math.max(0.25, Math.min(10.0, Number(bestScale.toFixed(2)))));
    const centerCropX = cropBox.x + cropBox.width / 2;
    const centerCropY = cropBox.y + cropBox.height / 2;
    setImagePan({
      x: centerCropX - stageDimensions.width / 2,
      y: centerCropY - stageDimensions.height / 2,
    });
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((prev) => Math.max(0.25, Math.min(10.0, Number((prev * zoomFactor).toFixed(2)))));
  };

  // Pointer Down Handlers
  const handlePointerDownImage = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-crop-handle]")) return;
    setIsPanningImage(true);
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialPan: { ...imagePan },
    };
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handlePointerDownHandle = (handle: DragHandleType, e: React.PointerEvent) => {
    e.stopPropagation();
    setActiveHandle(handle);
    boxDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialBox: { ...cropBox },
    };
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  // Pointer Move Handler
  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanningImage) {
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      setImagePan({
        x: Math.round(panStartRef.current.initialPan.x + dx),
        y: Math.round(panStartRef.current.initialPan.y + dy),
      });
      return;
    }

    if (!activeHandle) return;

    const dx = e.clientX - boxDragStartRef.current.clientX;
    const dy = e.clientY - boxDragStartRef.current.clientY;
    const init = boxDragStartRef.current.initialBox;
    const targetAspect = getTargetAspectRatio();

    if (activeHandle === "move-box") {
      let newX = init.x + dx;
      let newY = init.y + dy;
      newX = Math.max(0, Math.min(stageDimensions.width - init.width, newX));
      newY = Math.max(0, Math.min(stageDimensions.height - init.height, newY));
      setCropBox({
        x: Math.round(newX),
        y: Math.round(newY),
        width: init.width,
        height: init.height,
      });
      return;
    }

    let newX = init.x;
    let newY = init.y;
    let newW = init.width;
    let newH = init.height;

    // Corner & Edge adjustments
    if (activeHandle.includes("left")) {
      newW = Math.max(40, init.width - dx);
      newX = init.x + (init.width - newW);
    }
    if (activeHandle.includes("right")) {
      newW = Math.max(40, init.width + dx);
    }
    if (activeHandle.includes("top")) {
      newH = Math.max(40, init.height - dy);
      newY = init.y + (init.height - newH);
    }
    if (activeHandle.includes("bottom")) {
      newH = Math.max(40, init.height + dy);
    }

    // Aspect ratio locking
    if (targetAspect) {
      if (activeHandle === "left" || activeHandle === "right") {
        newH = newW / targetAspect;
      } else if (activeHandle === "top" || activeHandle === "bottom") {
        newW = newH * targetAspect;
      } else {
        // Corner handle: match to width
        newH = newW / targetAspect;
        if (activeHandle.includes("top")) {
          newY = init.y + (init.height - newH);
        }
      }
    }

    // Stage constraints
    if (newX < 0) {
      newW += newX;
      newX = 0;
    }
    if (newY < 0) {
      newH += newY;
      newY = 0;
    }
    if (newX + newW > stageDimensions.width) {
      newW = stageDimensions.width - newX;
      if (targetAspect) newH = newW / targetAspect;
    }
    if (newY + newH > stageDimensions.height) {
      newH = stageDimensions.height - newY;
      if (targetAspect) newW = newH * targetAspect;
    }

    setCropBox({
      x: Math.round(newX),
      y: Math.round(newY),
      width: Math.max(40, Math.round(newW)),
      height: Math.max(40, Math.round(newH)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanningImage) {
      setIsPanningImage(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
    if (activeHandle) {
      setActiveHandle(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // Live Real-Time Preview Rendering using requestAnimationFrame
  const updateLivePreview = useCallback(() => {
    if (!previewCanvasRef.current || !sourceImageRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pW = canvas.width;
    const pH = canvas.height;

    ctx.clearRect(0, 0, pW, pH);

    // Clean white backing
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pW, pH);

    // Save and apply rotation + deskew
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Center of preview canvas
    ctx.translate(pW / 2, pH / 2);

    // Ratio of preview canvas to crop box
    const scaleX = pW / cropBox.width;
    const scaleY = pH / cropBox.height;

    // Crop box center relative to stage center
    const cropCenterX = cropBox.x + cropBox.width / 2;
    const cropCenterY = cropBox.y + cropBox.height / 2;

    // Image center relative to crop center
    const imgCenterX = stageDimensions.width / 2 + imagePan.x;
    const imgCenterY = stageDimensions.height / 2 + imagePan.y;
    const relX = (imgCenterX - cropCenterX) * scaleX;
    const relY = (imgCenterY - cropCenterY) * scaleY;

    ctx.translate(relX, relY);

    // Combined rotation + fine deskew angle
    const totalAngleDeg = rotation + deskewAngle;
    ctx.rotate((totalAngleDeg * Math.PI) / 180);

    // Draw source image
    const drawW = displayedW * scaleX;
    const drawH = displayedH * scaleY;
    const isRot = rotation % 180 !== 0;
    const w = isRot ? drawH : drawW;
    const h = isRot ? drawW : drawH;

    ctx.drawImage(sourceImageRef.current, -w / 2, -h / 2, w, h);

    ctx.restore();

    // Shape mask if circular/rounded
    if (cropShape === "circle") {
      ctx.globalCompositeOperation = "destination-in";
      ctx.beginPath();
      ctx.ellipse(pW / 2, pH / 2, pW / 2, pH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
  }, [
    cropBox,
    rotation,
    deskewAngle,
    imagePan,
    zoom,
    displayedW,
    displayedH,
    stageDimensions,
    cropShape,
  ]);

  // Schedule live preview update whenever geometry changes
  useEffect(() => {
    if (rafPreviewIdRef.current) {
      cancelAnimationFrame(rafPreviewIdRef.current);
    }
    rafPreviewIdRef.current = requestAnimationFrame(updateLivePreview);
    return () => {
      if (rafPreviewIdRef.current) {
        cancelAnimationFrame(rafPreviewIdRef.current);
      }
    };
  }, [updateLivePreview]);

  // High-Resolution Export on Confirmation
  const handleApplyCrop = async () => {
    if (!sourceImageRef.current) return;

    try {
      const img = sourceImageRef.current;
      const sW = img.naturalWidth || 800;
      const sH = img.naturalHeight || 500;

      // Target high-resolution canvas matching CR80 standard aspect ratio (85.6mm × 54mm @ 300 DPI: ~1011 × 638 px)
      const targetAspect = 85.6 / 54.0;
      const exportWidth = 1200;
      const exportHeight = Math.round(exportWidth / targetAspect);

      const canvas = document.createElement("canvas");
      canvas.width = exportWidth;
      canvas.height = exportHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas 2D context");

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, exportWidth, exportHeight);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.save();
      ctx.translate(exportWidth / 2, exportHeight / 2);

      const scaleX = exportWidth / cropBox.width;
      const scaleY = exportHeight / cropBox.height;

      const cropCenterX = cropBox.x + cropBox.width / 2;
      const cropCenterY = cropBox.y + cropBox.height / 2;
      const imgCenterX = stageDimensions.width / 2 + imagePan.x;
      const imgCenterY = stageDimensions.height / 2 + imagePan.y;

      const relX = (imgCenterX - cropCenterX) * scaleX;
      const relY = (imgCenterY - cropCenterY) * scaleY;

      ctx.translate(relX, relY);

      const totalAngleDeg = rotation + deskewAngle;
      ctx.rotate((totalAngleDeg * Math.PI) / 180);

      const drawW = displayedW * scaleX;
      const drawH = displayedH * scaleY;
      const isRot = rotation % 180 !== 0;
      const w = isRot ? drawH : drawW;
      const h = isRot ? drawW : drawH;

      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();

      // Shape clipping if required
      if (cropShape === "circle") {
        ctx.globalCompositeOperation = "destination-in";
        ctx.beginPath();
        ctx.ellipse(exportWidth / 2, exportHeight / 2, exportWidth / 2, exportHeight / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }

      const croppedDataUrl = canvas.toDataURL("image/png", 1.0);

      // Normalized crop box representation for storage
      const normX = (cropBox.x - imgLeft) / displayedW;
      const normY = (cropBox.y - imgTop) / displayedH;
      const normW = cropBox.width / displayedW;
      const normH = cropBox.height / displayedH;

      const adjustments: CardDesignerAdjustments = {
        cropBoxNorm: { x: normX, y: normY, width: normW, height: normH },
        cropBoxPixels: { ...cropBox },
        zoom,
        imagePan: { ...imagePan },
        rotation,
        deskewAngle,
        preset,
        aspectRatioLocked,
        shape: cropShape,
      };

      const result: CropConfirmResult = {
        croppedDataUrl,
        originalSrc: target?.originalSrc || target?.imageSrc || "",
        naturalWidth: sW,
        naturalHeight: sH,
        adjustments,
        cropRect: {
          x: Math.round(normX * 100),
          y: Math.round(normY * 100),
          width: Math.round(normW * 100),
          height: Math.round(normH * 100),
          shape: cropShape,
        },
      };

      onConfirm(result);
      onClose();
    } catch (err) {
      console.error("Failed to apply crop:", err);
    }
  };

  // Reset Adjustments inside modal
  const handleResetModalAdjustments = () => {
    setRotation(0);
    setDeskewAngle(0);
    setZoom(1.0);
    setImagePan({ x: 0, y: 0 });
    setPreset("85.6:54");
    setAspectRatioLocked(true);
    setCropShape("rect");
    applyPresetAspect(85.6 / 54.0);
  };

  if (!isOpen) return null;

  return (
    <div
      id="card-designer-crop-modal-overlay"
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 select-none animate-in fade-in duration-150"
    >
      <div
        id="card-designer-crop-dialog-window"
        className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden text-neutral-200"
      >
        {/* =========================================================
            HEADER BAR
           ========================================================= */}
        <header className="h-14 bg-neutral-950 border-b border-neutral-800 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-sky-600/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shadow-md">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  {target?.title ? `Crop & Adjust: ${target.title}` : "Card Photo & Face Crop Studio"}
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                  CR80 85.6 × 54mm Auto-Fit
                </span>
                {target?.targetSide && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                    {target.targetSide} Side
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400">
                Precision frame crop, 90° rotation, fine deskew, zoom, and live card boundary preview
              </p>
            </div>
          </div>

          <button
            type="button"
            id="crop-dialog-btn-close"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            title="Cancel and close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* =========================================================
            TOP CONTROL TOOLBAR (PRESETS, ROTATION, DESKEW, ZOOM)
           ========================================================= */}
        <div className="bg-neutral-950/80 border-b border-neutral-800 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Presets */}
          <div className="flex items-center space-x-1.5">
            <span className="text-neutral-400 text-[11px] font-medium mr-1">Aspect:</span>
            {[
              { id: "85.6:54", label: "85.6:54 (CR80 Card)" },
              { id: "free", label: "Free" },
              { id: "original", label: "Original" },
              { id: "1:1", label: "1:1 Square" },
              { id: "3:4", label: "3:4 ID Photo" },
              { id: "4:3", label: "4:3" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                id={`crop-preset-${p.id}`}
                onClick={() => handleSelectPreset(p.id as CardCropPresetType)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  preset === p.id
                    ? "bg-sky-600 text-white shadow-sm"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}

            <button
              type="button"
              id="crop-toggle-lock"
              onClick={() => setAspectRatioLocked(!aspectRatioLocked)}
              className={`p-1 rounded ml-1 ${
                aspectRatioLocked ? "text-sky-400 bg-sky-950/60" : "text-neutral-500 hover:text-neutral-300"
              }`}
              title={aspectRatioLocked ? "Aspect Ratio Locked" : "Aspect Ratio Free"}
            >
              {aspectRatioLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Quick Rotation & Fine Deskew */}
          <div className="flex items-center space-x-3 bg-neutral-900/90 border border-neutral-800 rounded-lg px-3 py-1">
            <div className="flex items-center space-x-1">
              <button
                type="button"
                id="crop-btn-rot-ccw"
                onClick={handleRotateCcw}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white"
                title="Rotate 90° Counter-Clockwise"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                id="crop-btn-rot-cw"
                onClick={handleRotateCw}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white"
                title="Rotate 90° Clockwise"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] text-neutral-300 w-8 text-center">
                {rotation}°
              </span>
            </div>

            <div className="h-4 w-px bg-neutral-700" />

            {/* Fine Deskew Slider & Numeric Input */}
            <div className="flex items-center space-x-2">
              <span className="text-neutral-400 text-[11px] flex items-center space-x-1">
                <Sliders className="w-3 h-3 text-sky-400" />
                <span>Deskew:</span>
              </span>
              <input
                type="range"
                id="crop-input-deskew-slider"
                min={-15}
                max={15}
                step={0.1}
                value={deskewAngle}
                onChange={(e) => setDeskewAngle(parseFloat(e.target.value) || 0)}
                className="w-24 accent-sky-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  id="crop-input-deskew-num"
                  min={-15}
                  max={15}
                  step={0.1}
                  value={deskewAngle}
                  onChange={(e) =>
                    setDeskewAngle(Math.max(-15, Math.min(15, parseFloat(e.target.value) || 0)))
                  }
                  className="w-14 bg-neutral-950 border border-neutral-700 rounded px-1.5 py-0.5 text-center font-mono text-[11px] text-sky-300 outline-none"
                />
                <span className="text-[10px] text-neutral-400">°</span>
              </div>
              <button
                type="button"
                id="crop-btn-reset-deskew"
                onClick={() => setDeskewAngle(0)}
                className="text-[10px] text-sky-400 hover:text-sky-300 font-medium px-1"
                title="Reset Deskew to 0.0°"
              >
                0.0°
              </button>
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1.5 bg-neutral-900/90 border border-neutral-800 rounded-lg px-2 py-1">
            <button
              type="button"
              id="crop-btn-zoom-out"
              onClick={handleZoomOut}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-300"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              id="crop-input-zoom-slider"
              min={0.25}
              max={5.0}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value) || 1.0)}
              className="w-20 accent-sky-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />
            <button
              type="button"
              id="crop-btn-zoom-in"
              onClick={handleZoomIn}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-300"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] text-neutral-300 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              id="crop-btn-fit-crop"
              onClick={handleFitCrop}
              className="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-200"
              title="Fit Image to Crop Box"
            >
              Fit
            </button>
            <button
              type="button"
              id="crop-btn-reset-zoom"
              onClick={handleResetZoom}
              className="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-200"
              title="Reset Zoom to 100%"
            >
              1:1
            </button>
          </div>
        </div>

        {/* =========================================================
            MAIN WORKSPACE (LEFT: INTERACTIVE STAGE; RIGHT: LIVE PREVIEW & DETAILS)
           ========================================================= */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Interactive Stage */}
          <div
            ref={stageRef}
            id="card-crop-interactive-stage"
            onWheel={handleWheel}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="flex-1 relative bg-neutral-950 overflow-hidden cursor-crosshair flex items-center justify-center select-none"
          >
            {/* Grid Pattern Background */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)",
                backgroundSize: "20px 20px",
              }}
            />

            {/* Displayed Image Container */}
            {imageSrc && (
              <div
                style={{
                  position: "absolute",
                  left: `${imgLeft}px`,
                  top: `${imgTop}px`,
                  width: `${displayedW}px`,
                  height: `${displayedH}px`,
                  transform: `rotate(${rotation + deskewAngle}deg)`,
                  transformOrigin: "center center",
                  transition: isPanningImage || activeHandle ? "none" : "transform 0.05s linear",
                }}
                onPointerDown={handlePointerDownImage}
                className="cursor-move select-none"
              >
                <img
                  src={imageSrc}
                  alt="Source"
                  draggable={false}
                  className="w-full h-full object-contain pointer-events-none drop-shadow-xl"
                />
              </div>
            )}

            {/* Scrim Overlay (4 Darkened rects around the crop box) */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "rgba(0, 0, 0, 0.65)",
                clipPath: `polygon(
                  0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                  ${cropBox.x}px ${cropBox.y}px,
                  ${cropBox.x}px ${cropBox.y + cropBox.height}px,
                  ${cropBox.x + cropBox.width}px ${cropBox.y + cropBox.height}px,
                  ${cropBox.x + cropBox.width}px ${cropBox.y}px,
                  ${cropBox.x}px ${cropBox.y}px
                )`,
              }}
            />

            {/* Main Interactive Crop Box */}
            <div
              id="card-crop-active-box"
              style={{
                position: "absolute",
                left: `${cropBox.x}px`,
                top: `${cropBox.y}px`,
                width: `${cropBox.width}px`,
                height: `${cropBox.height}px`,
                borderRadius: cropShape === "circle" ? "9999px" : "0px",
              }}
              onPointerDown={(e) => handlePointerDownHandle("move-box", e)}
              className="border-2 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.35)] cursor-move select-none"
            >
              {/* 3x3 Rule-of-Thirds Grid */}
              <div className="w-full h-full grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                <div className="border-r border-b border-sky-200/50" />
                <div className="border-r border-b border-sky-200/50" />
                <div className="border-b border-sky-200/50" />
                <div className="border-r border-b border-sky-200/50" />
                <div className="border-r border-b border-sky-200/50" />
                <div className="border-b border-sky-200/50" />
                <div className="border-r border-sky-200/50" />
                <div className="border-r border-sky-200/50" />
                <div />
              </div>

              {/* 8-Point Resize Handles */}
              {/* Corners */}
              <div
                data-crop-handle="top-left"
                onPointerDown={(e) => handlePointerDownHandle("top-left", e)}
                className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-white border-2 border-sky-500 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
              />
              <div
                data-crop-handle="top-right"
                onPointerDown={(e) => handlePointerDownHandle("top-right", e)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-sky-500 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
              />
              <div
                data-crop-handle="bottom-left"
                onPointerDown={(e) => handlePointerDownHandle("bottom-left", e)}
                className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-white border-2 border-sky-500 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
              />
              <div
                data-crop-handle="bottom-right"
                onPointerDown={(e) => handlePointerDownHandle("bottom-right", e)}
                className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border-2 border-sky-500 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
              />

              {/* Edges */}
              <div
                data-crop-handle="top"
                onPointerDown={(e) => handlePointerDownHandle("top", e)}
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white border border-sky-500 rounded-sm cursor-ns-resize shadow-md"
              />
              <div
                data-crop-handle="bottom"
                onPointerDown={(e) => handlePointerDownHandle("bottom", e)}
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white border border-sky-500 rounded-sm cursor-ns-resize shadow-md"
              />
              <div
                data-crop-handle="left"
                onPointerDown={(e) => handlePointerDownHandle("left", e)}
                className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-6 bg-white border border-sky-500 rounded-sm cursor-ew-resize shadow-md"
              />
              <div
                data-crop-handle="right"
                onPointerDown={(e) => handlePointerDownHandle("right", e)}
                className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-6 bg-white border border-sky-500 rounded-sm cursor-ew-resize shadow-md"
              />

              {/* Center Dimension HUD Badge */}
              <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-sky-300 pointer-events-none border border-sky-500/30">
                {cropBox.width} × {cropBox.height} px
              </div>
            </div>

            {/* Hint Badge */}
            <div className="absolute bottom-3 left-4 bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-lg px-3 py-1.5 text-[11px] text-neutral-400 flex items-center space-x-2 pointer-events-none">
              <Move className="w-3.5 h-3.5 text-sky-400" />
              <span>Drag handles to frame image • Drag inside box to reposition • Mouse wheel to zoom</span>
            </div>
          </div>

          {/* =========================================================
              RIGHT SIDEBAR: LIVE PREVIEW & NUMERIC INPUTS
             ========================================================= */}
          <div className="w-80 bg-neutral-900 border-l border-neutral-800 flex flex-col justify-between p-4 overflow-y-auto shrink-0">
            <div className="space-y-4">
              {/* Live Preview Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-white uppercase tracking-wider">
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  <span>Real-Time Live Preview</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 font-mono">
                  85.6 × 54mm Fit
                </span>
              </div>

              {/* Card Aspect Ratio Frame (Live Canvas) */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 shadow-inner flex flex-col items-center">
                <div
                  className="w-full relative rounded-lg overflow-hidden border border-neutral-700 shadow-md bg-white flex items-center justify-center"
                  style={{
                    aspectRatio: "85.6 / 54.0",
                  }}
                >
                  <canvas
                    ref={previewCanvasRef}
                    width={342}
                    height={216}
                    className="w-full h-full object-contain"
                  />
                  {/* Subtle CR80 Card Boundary Guideline */}
                  <div className="absolute inset-0 pointer-events-none border border-sky-400/20" />
                </div>
                <div className="mt-2 text-[10px] text-neutral-400 text-center flex items-center justify-center space-x-1">
                  <Sparkles className="w-3 h-3 text-sky-400" />
                  <span>Updates live with rotation, deskew, and crop</span>
                </div>
              </div>

              {/* Live Numeric Inputs */}
              <div className="space-y-3 pt-1">
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Numeric Geometry Sync
                </div>

                {/* Crop Box Position & Size */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">Crop X (px)</label>
                    <input
                      type="number"
                      id="crop-input-x"
                      value={cropBox.x}
                      onChange={(e) =>
                        setCropBox((prev) => ({
                          ...prev,
                          x: Math.max(0, parseInt(e.target.value) || 0),
                        }))
                      }
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">Crop Y (px)</label>
                    <input
                      type="number"
                      id="crop-input-y"
                      value={cropBox.y}
                      onChange={(e) =>
                        setCropBox((prev) => ({
                          ...prev,
                          y: Math.max(0, parseInt(e.target.value) || 0),
                        }))
                      }
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">Crop Width</label>
                    <input
                      type="number"
                      id="crop-input-w"
                      value={cropBox.width}
                      onChange={(e) => {
                        const val = Math.max(40, parseInt(e.target.value) || 40);
                        const aspect = getTargetAspectRatio();
                        setCropBox((prev) => ({
                          ...prev,
                          width: val,
                          height: aspect ? Math.round(val / aspect) : prev.height,
                        }));
                      }}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">Crop Height</label>
                    <input
                      type="number"
                      id="crop-input-h"
                      value={cropBox.height}
                      onChange={(e) => {
                        const val = Math.max(40, parseInt(e.target.value) || 40);
                        const aspect = getTargetAspectRatio();
                        setCropBox((prev) => ({
                          ...prev,
                          height: val,
                          width: aspect ? Math.round(val * aspect) : prev.width,
                        }));
                      }}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                    />
                  </div>
                </div>

                {/* Rotation & Deskew Angles */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">Rotation (°)</label>
                    <input
                      type="number"
                      id="crop-input-rot-field"
                      value={rotation}
                      onChange={(e) => setRotation((parseInt(e.target.value) || 0) % 360)}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-white font-mono text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-neutral-400 block mb-0.5">Deskew (°)</label>
                    <input
                      type="number"
                      id="crop-input-deskew-field"
                      step={0.1}
                      min={-15}
                      max={15}
                      value={deskewAngle}
                      onChange={(e) =>
                        setDeskewAngle(Math.max(-15, Math.min(15, parseFloat(e.target.value) || 0)))
                      }
                      className="w-full bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-sky-300 font-mono text-xs outline-none"
                    />
                  </div>
                </div>

                {/* Mask Shape Selection */}
                <div className="space-y-1.5 pt-2">
                  <label className="text-[10px] text-neutral-400 block">Photo Mask Frame</label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: "rect", label: "Rect" },
                      { id: "rounded", label: "Rounded" },
                      { id: "circle", label: "Circular" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        id={`crop-shape-${m.id}`}
                        onClick={() => setCropShape(m.id as any)}
                        className={`py-1 text-[10px] rounded border font-medium transition-colors ${
                          cropShape === m.id
                            ? "bg-sky-600 border-sky-500 text-white"
                            : "bg-neutral-950 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Reset in Sidebar */}
            <div className="pt-4 border-t border-neutral-800">
              <button
                type="button"
                id="crop-btn-reset-all"
                onClick={handleResetModalAdjustments}
                className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset All Adjustments</span>
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================
            FOOTER ACTIONS
           ========================================================= */}
        <footer className="h-14 bg-neutral-950 border-t border-neutral-800 px-5 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-neutral-400 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              On confirmation, image auto-fits to exact 85.6mm × 54mm card dimensions with non-destructive revert
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              id="crop-dialog-btn-cancel"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              id="crop-dialog-btn-apply"
              onClick={handleApplyCrop}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-sky-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              <span>Confirm & Fit to Card (85.6 × 54mm)</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
