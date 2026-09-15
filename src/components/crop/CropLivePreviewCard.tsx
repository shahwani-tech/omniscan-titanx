/**
 * OMNISCAN PRO ULTRA - Professional Live Crop & Perspective Warp Preview Panel
 * Real-time 60fps canvas rendering, DPI-aware sub-pixel drawing,
 * CamScanner-grade Before/After split comparison, interactive zoom & pan,
 * and high-definition fullscreen inspector.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Eye,
  X,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Columns,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Crop,
  Layers,
  Check,
} from "lucide-react";
import {
  OmniPage,
  PerspectiveQuad,
  PerspectivePreset,
} from "../../types";
import { NormalizedCropBox, CropUnit } from "../../engine/cropEngine";
import {
  calculateTargetDimensions,
  PERSPECTIVE_PRESETS,
  renderFastPerspectivePreviewSync,
} from "../../engine/perspectiveEngine";
import { pageBlobStore } from "../../services/storage/PageBlobStore";

export interface CropLivePreviewCardProps {
  activePage: OmniPage;
  cropMode: "rect" | "perspective";
  cropBox: NormalizedCropBox;
  perspectiveQuad?: PerspectiveQuad;
  perspectivePreset?: PerspectivePreset;
  fineDeskewEnabled?: boolean;
  pageWidth: number;
  pageHeight: number;
  unit: CropUnit;
  realWidth: number | string;
  realHeight: number | string;
  onClose: () => void;
  resolvedImageUrl?: string;
}

export const CropLivePreviewCard: React.FC<CropLivePreviewCardProps> = ({
  activePage,
  cropMode,
  cropBox,
  perspectiveQuad,
  perspectivePreset = "natural",
  fineDeskewEnabled = true,
  pageWidth,
  pageHeight,
  unit,
  realWidth,
  realHeight,
  onClose,
  resolvedImageUrl,
}) => {
  // Container & Canvas references
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Expanded / Full Screen inspector state
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Split-view before/after comparison state (0 to 1 divider position)
  const [isSplitView, setIsSplitView] = useState<boolean>(false);
  const [splitPos, setSplitPos] = useState<number>(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);

  // Zoom & Pan inside the preview viewport
  const [previewZoom, setPreviewZoom] = useState<number>(1.0);
  const [previewPan, setPreviewPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Source image state & async blob/data resolution
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(true);
  const [imageError, setImageError] = useState<string | null>(null);

  // Perspective Warped preview image state
  const [warpedImage, setWarpedImage] = useState<HTMLImageElement | null>(null);
  const [isComputingWarp, setIsComputingWarp] = useState<boolean>(false);
  const [warpError, setWarpError] = useState<string | null>(null);
  const warpJobIdRef = useRef<number>(0);

  // Animation frame tracker
  const rafIdRef = useRef<number | null>(null);

  // Canvas display dimensions based on expanded state
  const displayW = isExpanded ? 580 : 310;
  const displayH = isExpanded ? 380 : 190;

  // ---------------------------------------------------------------------------
  // 1. ASYNC IMAGE SOURCE RESOLUTION (BlobStore + Base64 + Fallback)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;
    let localBlobUrl: string | null = null;

    async function loadSource() {
      setIsLoadingImage(true);
      setImageError(null);

      try {
        let url = resolvedImageUrl;

        // 1. Try resolving processed blob URL from PageBlobStore
        if (!url) {
          url = await pageBlobStore.resolvePageUrl(activePage, "processed");
        }

        // 2. Try resolving original blob URL from PageBlobStore
        if (!url) {
          url = await pageBlobStore.resolvePageUrl(activePage, "original");
        }

        // 3. Fall back to legacy base64 in-memory data URLs
        if (!url) {
          url =
            activePage.processedDataUrl ||
            activePage.originalDataUrl ||
            activePage.thumbnailDataUrl ||
            "";
        }

        if (!url) {
          if (isMounted) {
            setImageError("Image data not available");
            setIsLoadingImage(false);
          }
          return;
        }

        if (url.startsWith("blob:")) {
          localBlobUrl = url;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
          if (!isMounted) return;
          setSourceImage(img);
          setIsLoadingImage(false);
          setImageError(null);
        };

        img.onerror = async () => {
          if (!isMounted) return;
          // As a secondary fallback, try loading directly through loadPageDataUrl
          try {
            const dataUrl = await pageBlobStore.loadPageDataUrl(activePage, "original");
            if (dataUrl && isMounted) {
              const fallbackImg = new Image();
              fallbackImg.onload = () => {
                if (isMounted) {
                  setSourceImage(fallbackImg);
                  setIsLoadingImage(false);
                  setImageError(null);
                }
              };
              fallbackImg.onerror = () => {
                if (isMounted) {
                  setImageError("Failed to decode image data");
                  setIsLoadingImage(false);
                }
              };
              fallbackImg.src = dataUrl;
              return;
            }
          } catch {
            // Ignore
          }

          if (isMounted) {
            setImageError("Failed to render preview image");
            setIsLoadingImage(false);
          }
        };

        img.src = url;
        if (img.complete && img.naturalWidth > 0) {
          if (isMounted) {
            setSourceImage(img);
            setIsLoadingImage(false);
            setImageError(null);
          }
        }
      } catch (err) {
        if (isMounted) {
          setImageError("Error resolving document image");
          setIsLoadingImage(false);
        }
      }
    }

    loadSource();

    return () => {
      isMounted = false;
      if (localBlobUrl) {
        pageBlobStore.revokeBlobUrl(localBlobUrl);
      }
    };
  }, [
    activePage.id,
    activePage.processedBlobId,
    activePage.originalBlobId,
    activePage.processedDataUrl,
    activePage.originalDataUrl,
    resolvedImageUrl,
  ]);

  // ---------------------------------------------------------------------------
  // 2. PERSPECTIVE WARPED PREVIEW COMPUTATION (Worker/Sync + Fallback)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (cropMode !== "perspective" || !perspectiveQuad || !sourceImage) {
      setWarpedImage(null);
      setIsComputingWarp(false);
      setWarpError(null);
      return;
    }

    const currentJobId = ++warpJobIdRef.current;
    setIsComputingWarp(true);
    setWarpError(null);

    // Timeout protection: if worker/algorithm hangs for > 3.0 seconds, fall back gracefully
    const timeoutTimer = setTimeout(() => {
      if (warpJobIdRef.current === currentJobId) {
        setIsComputingWarp(false);
        setWarpError("Preview unavailable");
      }
    }, 3000);

    // Asynchronous warp computation
    const runWarp = async () => {
      try {
        const previewDataUrl = renderFastPerspectivePreviewSync(
          sourceImage,
          perspectiveQuad,
          isExpanded ? 640 : 440
        );

        if (!previewDataUrl) {
          throw new Error("Empty warp preview buffer");
        }

        const warpedImg = new Image();
        warpedImg.onload = () => {
          if (warpJobIdRef.current === currentJobId) {
            clearTimeout(timeoutTimer);
            setWarpedImage(warpedImg);
            setIsComputingWarp(false);
            setWarpError(null);
          }
        };
        warpedImg.onerror = () => {
          if (warpJobIdRef.current === currentJobId) {
            clearTimeout(timeoutTimer);
            setIsComputingWarp(false);
            setWarpError("Preview unavailable");
          }
        };
        warpedImg.src = previewDataUrl;
      } catch (err) {
        if (warpJobIdRef.current === currentJobId) {
          clearTimeout(timeoutTimer);
          setIsComputingWarp(false);
          setWarpError("Preview unavailable");
        }
      }
    };

    runWarp();

    return () => {
      clearTimeout(timeoutTimer);
    };
  }, [
    cropMode,
    perspectiveQuad,
    sourceImage,
    fineDeskewEnabled,
    isExpanded,
  ]);

  // ---------------------------------------------------------------------------
  // 3. CANVAS DRAWING PIPELINE (requestAnimationFrame + DPI scaling)
  // ---------------------------------------------------------------------------
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImage) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const physW = Math.round(displayW * dpr);
    const physH = Math.round(displayH * dpr);

    if (canvas.width !== physW || canvas.height !== physH) {
      canvas.width = physW;
      canvas.height = physH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Draw neutral background canvas
    ctx.fillStyle = "#0c0d0e";
    ctx.fillRect(0, 0, displayW, displayH);

    // Subtle 8px checkerboard pattern for transparent areas
    const checkerSize = 10;
    ctx.fillStyle = "#141618";
    for (let y = 0; y < displayH; y += checkerSize) {
      for (let x = 0; x < displayW; x += checkerSize) {
        if ((Math.floor(x / checkerSize) + Math.floor(y / checkerSize)) % 2 === 0) {
          ctx.fillRect(x, y, checkerSize, checkerSize);
        }
      }
    }

    // 2. Apply interactive Zoom & Pan transformation around center
    ctx.save();
    ctx.translate(displayW / 2 + previewPan.x, displayH / 2 + previewPan.y);
    ctx.scale(previewZoom, previewZoom);
    ctx.translate(-displayW / 2, -displayH / 2);

    const srcW = sourceImage.naturalWidth || sourceImage.width || 1;
    const srcH = sourceImage.naturalHeight || sourceImage.height || 1;
    const canvasAspect = displayW / displayH;

    // Helper: calculate aspect-fit destination rectangle
    const fitRect = (w: number, h: number) => {
      const aspect = w / h;
      let dw = displayW;
      let dh = displayH;
      let dx = 0;
      let dy = 0;
      if (aspect > canvasAspect) {
        dw = displayW;
        dh = displayW / aspect;
        dy = (displayH - dh) / 2;
      } else {
        dh = displayH;
        dw = displayH * aspect;
        dx = (displayW - dw) / 2;
      }
      return { dx, dy, dw, dh };
    };

    // Helper: draw source image with quadrilateral outline overlay
    const drawSourceWithQuad = () => {
      const { dx, dy, dw, dh } = fitRect(srcW, srcH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(sourceImage, 0, 0, srcW, srcH, dx, dy, dw, dh);

      if (perspectiveQuad) {
        const q = perspectiveQuad;
        const pTL = { x: dx + q.topLeft.x * dw, y: dy + q.topLeft.y * dh };
        const pTR = { x: dx + q.topRight.x * dw, y: dy + q.topRight.y * dh };
        const pBR = { x: dx + q.bottomRight.x * dw, y: dy + q.bottomRight.y * dh };
        const pBL = { x: dx + q.bottomLeft.x * dw, y: dy + q.bottomLeft.y * dh };

        // Translucent blue-cyan interior fill
        ctx.fillStyle = "rgba(14, 165, 233, 0.16)";
        ctx.beginPath();
        ctx.moveTo(pTL.x, pTL.y);
        ctx.lineTo(pTR.x, pTR.y);
        ctx.lineTo(pBR.x, pBR.y);
        ctx.lineTo(pBL.x, pBL.y);
        ctx.closePath();
        ctx.fill();

        // Quadrilateral bounding stroke
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // 3x3 Internal Perspective Grid
        ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
        ctx.lineWidth = 1;
        for (let i = 1; i <= 2; i++) {
          const t = i / 3;
          // Horizontal guide
          const leftX = pTL.x + (pBL.x - pTL.x) * t;
          const leftY = pTL.y + (pBL.y - pTL.y) * t;
          const rightX = pTR.x + (pBR.x - pTR.x) * t;
          const rightY = pTR.y + (pBR.y - pTR.y) * t;
          ctx.beginPath();
          ctx.moveTo(leftX, leftY);
          ctx.lineTo(rightX, rightY);
          ctx.stroke();

          // Vertical guide
          const topX = pTL.x + (pTR.x - pTL.x) * t;
          const topY = pTL.y + (pTR.y - pTL.y) * t;
          const botX = pBL.x + (pBR.x - pBL.x) * t;
          const botY = pBL.y + (pBR.y - pBL.y) * t;
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.lineTo(botX, botY);
          ctx.stroke();
        }

        // 4 Corner Control Pins
        const corners = [pTL, pTR, pBR, pBL];
        corners.forEach((c) => {
          ctx.fillStyle = "#0284c7";
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(c.x, c.y, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
    };

    // Helper: draw warped image
    const drawWarpedResult = () => {
      if (!warpedImage) return;
      const wW = warpedImage.naturalWidth || warpedImage.width || 1;
      const wH = warpedImage.naturalHeight || warpedImage.height || 1;
      const { dx, dy, dw, dh } = fitRect(wW, wH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(warpedImage, 0, 0, wW, wH, dx, dy, dw, dh);
    };

    // Helper: draw rectangular cropped sub-region
    const drawRectCropResult = () => {
      const sx = Math.max(0, Math.min(srcW - 1, cropBox.x * srcW));
      const sy = Math.max(0, Math.min(srcH - 1, cropBox.y * srcH));
      const sw = Math.max(1, Math.min(srcW - sx, cropBox.width * srcW));
      const sh = Math.max(1, Math.min(srcH - sy, cropBox.height * srcH));

      const { dx, dy, dw, dh } = fitRect(sw, sh);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(sourceImage, sx, sy, sw, sh, dx, dy, dw, dh);
    };

    // Helper: draw split divider vertical line & grab circle
    const drawDivider = (splitX: number) => {
      ctx.save();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, displayH);
      ctx.stroke();

      const centerY = displayH / 2;
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(splitX, centerY, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#171717";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#171717";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("↔", splitX, centerY);
      ctx.restore();
    };

    // -------------------------------------------------------------------------
    // EXECUTE DRAW CALL BASED ON MODE & SPLIT COMPARISON
    // -------------------------------------------------------------------------
    if (cropMode === "rect") {
      if (!isSplitView) {
        drawRectCropResult();
      } else {
        const splitX = displayW * splitPos;

        // "BEFORE" - Original page with cropbox outline on left
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, splitX, displayH);
        ctx.clip();
        const { dx, dy, dw, dh } = fitRect(srcW, srcH);
        ctx.drawImage(sourceImage, 0, 0, srcW, srcH, dx, dy, dw, dh);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.85)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
          dx + cropBox.x * dw,
          dy + cropBox.y * dh,
          cropBox.width * dw,
          cropBox.height * dh
        );
        ctx.restore();

        // "AFTER" - Cropped sub-rectangle on right
        ctx.save();
        ctx.beginPath();
        ctx.rect(splitX, 0, displayW - splitX, displayH);
        ctx.clip();
        drawRectCropResult();
        ctx.restore();

        drawDivider(splitX);
      }
    } else {
      // Perspective Warp Mode
      if (!isSplitView) {
        if (warpedImage) {
          drawWarpedResult();
        } else {
          // Instant zero-delay fallback: show source with quad so preview is NEVER blank!
          drawSourceWithQuad();
        }
      } else {
        const splitX = displayW * splitPos;

        // "BEFORE" - Source with Quad outline on left
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, splitX, displayH);
        ctx.clip();
        drawSourceWithQuad();
        ctx.restore();

        // "AFTER" - Warped Result (or source quad if computing) on right
        ctx.save();
        ctx.beginPath();
        ctx.rect(splitX, 0, displayW - splitX, displayH);
        ctx.clip();
        if (warpedImage) {
          drawWarpedResult();
        } else {
          drawSourceWithQuad();
        }
        ctx.restore();

        drawDivider(splitX);
      }
    }

    ctx.restore(); // Restore zoom/pan
    ctx.restore(); // Restore DPR scale
  }, [
    sourceImage,
    cropMode,
    cropBox,
    perspectiveQuad,
    warpedImage,
    isSplitView,
    splitPos,
    previewZoom,
    previewPan,
    displayW,
    displayH,
  ]);

  // Trigger draw within one animation frame whenever state updates
  useEffect(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      drawPreview();
    });
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [drawPreview]);

  // ---------------------------------------------------------------------------
  // 4. INTERACTION HANDLERS (Drag Split Divider, Zoom Wheel, Pan)
  // ---------------------------------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;

    if (isSplitView) {
      const splitX = displayW * splitPos;
      if (Math.abs(clientX - splitX) < 28) {
        setIsDraggingSplit(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
    }

    if (previewZoom > 1.0) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX - previewPan.x,
        y: e.clientY - previewPan.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (isDraggingSplit) {
      const clientX = e.clientX - rect.left;
      const newSplit = Math.max(0.08, Math.min(0.92, clientX / displayW));
      setSplitPos(Number(newSplit.toFixed(3)));
      return;
    }

    if (isPanning) {
      setPreviewPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingSplit) {
      setIsDraggingSplit(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe no-op
      }
    }
    if (isPanning) {
      setIsPanning(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe no-op
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setPreviewZoom((z) => {
      const next = Math.max(1.0, Math.min(4.0, Number((z + delta).toFixed(2))));
      if (next === 1.0) {
        setPreviewPan({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setPreviewZoom(1.0);
    setPreviewPan({ x: 0, y: 0 });
  };

  // Dimensions & Preset readouts
  const activePresetDef = PERSPECTIVE_PRESETS.find((p) => p.id === perspectivePreset) || PERSPECTIVE_PRESETS[0];
  const perspectiveDims = perspectiveQuad && sourceImage
    ? calculateTargetDimensions(
        sourceImage.naturalWidth || sourceImage.width,
        sourceImage.naturalHeight || sourceImage.height,
        perspectiveQuad,
        activePresetDef.aspectRatio
      )
    : null;

  return (
    <div
      ref={containerRef}
      style={{
        width: `${displayW + 20}px`,
      }}
      className={`absolute z-50 bg-neutral-900/98 backdrop-blur-2xl border ${
        cropMode === "perspective" ? "border-amber-500/50 shadow-amber-950/40" : "border-sky-500/50 shadow-sky-950/40"
      } rounded-2xl p-2.5 shadow-2xl flex flex-col space-y-2 select-none animate-in fade-in zoom-in-95 duration-150 ${
        isExpanded
          ? "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] ring-1 ring-white/10"
          : "top-full right-0 mt-2.5"
      }`}
    >
      {/* ------------------------------------------------------------- */}
      {/* HEADER: Title, Mode indicator, and Action Controls            */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
        <div className="flex items-center space-x-1.5">
          {cropMode === "perspective" ? (
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Crop className="w-3.5 h-3.5 text-sky-400" />
          )}
          <span className="font-bold text-xs text-neutral-100 flex items-center gap-1">
            <span>{cropMode === "perspective" ? "Perspective Warp" : "Live Crop"}</span>
            <span className="text-[10px] text-neutral-400 font-normal">Preview</span>
          </span>

          {/* Sub-label badges */}
          {cropMode === "perspective" && isComputingWarp && (
            <span className="flex items-center space-x-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              <span>Computing...</span>
            </span>
          )}
          {warpError && (
            <span className="flex items-center space-x-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              <AlertCircle className="w-2.5 h-2.5" />
              <span>{warpError}</span>
            </span>
          )}
        </div>

        {/* Right Tools: Split-View, Zoom, Maximize, Close */}
        <div className="flex items-center space-x-1">
          {/* Split View Comparison Toggle */}
          <button
            type="button"
            onClick={() => setIsSplitView(!isSplitView)}
            className={`p-1 rounded text-xs transition-colors flex items-center space-x-1 ${
              isSplitView
                ? "bg-amber-500/30 text-amber-300 border border-amber-500/50 font-bold"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
            title="Toggle CamScanner-style Before / After Split Comparison (↔)"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">Split</span>
          </button>

          {/* Zoom In & Out */}
          <div className="flex items-center space-x-0.5 bg-neutral-800/80 rounded px-1 py-0.5 border border-neutral-750">
            <button
              type="button"
              onClick={() =>
                setPreviewZoom((z) => {
                  const next = Math.max(1.0, Number((z - 0.25).toFixed(2)));
                  if (next === 1.0) setPreviewPan({ x: 0, y: 0 });
                  return next;
                })
              }
              disabled={previewZoom <= 1.0}
              className="p-0.5 rounded text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition-colors"
              title="Zoom out preview"
            >
              <ZoomOut className="w-3 h-3" />
            </button>

            <span className="font-mono text-[9px] text-neutral-300 w-8 text-center select-none">
              {Math.round(previewZoom * 100)}%
            </span>

            <button
              type="button"
              onClick={() =>
                setPreviewZoom((z) => Math.min(4.0, Number((z + 0.25).toFixed(2))))
              }
              disabled={previewZoom >= 4.0}
              className="p-0.5 rounded text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 transition-colors"
              title="Zoom in preview to inspect fine details"
            >
              <ZoomIn className="w-3 h-3" />
            </button>

            {previewZoom > 1.0 && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-0.5 rounded text-sky-400 hover:text-sky-300"
                title="Reset zoom to 100%"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          {/* Expand / Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors ${
              isExpanded ? "text-sky-400" : ""
            }`}
            title={isExpanded ? "Restore compact preview" : "Expand preview size for detailed inspection"}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close Live Preview Card */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Close live preview"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PREVIEW CANVAS CONTAINER                                      */}
      {/* ------------------------------------------------------------- */}
      <div
        style={{
          width: `${displayW}px`,
          height: `${displayH}px`,
        }}
        className="relative bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center shadow-inner group"
      >
        {/* Loading Spinner during initial page load */}
        {isLoadingImage && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-neutral-950/80 backdrop-blur-sm space-y-1.5">
            <RefreshCw className="w-5 h-5 text-sky-400 animate-spin" />
            <span className="text-[10px] text-neutral-400 font-medium">Loading document page...</span>
          </div>
        )}

        {/* Error State Display */}
        {imageError && !isLoadingImage && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center bg-neutral-950 space-y-1 text-rose-400">
            <AlertCircle className="w-6 h-6" />
            <span className="text-xs font-semibold">{imageError}</span>
            <span className="text-[10px] text-neutral-400">Preview source could not be resolved.</span>
          </div>
        )}

        {/* High-Performance Canvas */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          style={{
            width: `${displayW}px`,
            height: `${displayH}px`,
          }}
          className={`block rounded-lg select-none ${
            isDraggingSplit
              ? "cursor-ew-resize"
              : previewZoom > 1.0
              ? isPanning
                ? "cursor-grabbing"
                : "cursor-grab"
              : isSplitView
              ? "cursor-ew-resize"
              : "cursor-default"
          }`}
        />

        {/* Split View Comparison Overlay Pill Labels */}
        {isSplitView && !isLoadingImage && (
          <>
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm font-mono text-[9px] text-amber-400 font-bold border border-amber-500/40 pointer-events-none shadow">
              BEFORE (ORIGINAL)
            </div>
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm font-mono text-[9px] text-sky-400 font-bold border border-sky-500/40 pointer-events-none shadow">
              AFTER ({cropMode === "perspective" ? "WARPED" : "CROPPED"})
            </div>
          </>
        )}

        {/* Floating Zoom Indicator Pill */}
        {previewZoom > 1.0 && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/85 backdrop-blur-sm font-mono text-[9px] text-sky-300 font-semibold border border-sky-500/30 pointer-events-none">
            {Math.round(previewZoom * 100)}% (Drag to Pan)
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* FOOTER: Metric readout (Dimensions, Preset, Pixels)          */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center justify-between text-[10px] text-neutral-300 font-mono bg-neutral-850/90 px-2.5 py-1.5 rounded-xl border border-neutral-750">
        {cropMode === "perspective" && perspectiveDims ? (
          <>
            <span className="text-amber-400 font-bold flex items-center gap-1 truncate max-w-[170px]">
              <Sparkles className="w-2.5 h-2.5 shrink-0" />
              <span>{activePresetDef.name}</span>
            </span>
            <span className="text-sky-400 font-bold">
              {perspectiveDims.targetW} × {perspectiveDims.targetH} px
            </span>
          </>
        ) : (
          <>
            <span className="text-neutral-300">
              {typeof realWidth === "number" ? realWidth.toFixed(1) : realWidth} × {typeof realHeight === "number" ? realHeight.toFixed(1) : realHeight} {unit}
            </span>
            <span className="text-sky-400 font-bold">
              {Math.round(cropBox.width * pageWidth)} × {Math.round(cropBox.height * pageHeight)} px
            </span>
          </>
        )}
      </div>
    </div>
  );
};
