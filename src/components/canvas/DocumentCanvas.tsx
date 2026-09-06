/**
 * OMNISCAN TITAN X - Super-Sized High-Performance Document Canvas
 * Infinite Zoom, Pan, Split-View Comparison, 8x Loupe, Annotation & Redaction Layers
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  OmniPage,
  ViewMode,
  ActiveTool,
  OmniAnnotation,
  OmniRedaction,
  Point,
} from "../../types";
import {
  screenToDocumentNormalized,
  computeDiagnosticSnapshot,
  CoordinateDiagnosticSnapshot,
} from "../../engine/coordinateSystem";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Sliders,
  Eye,
  Columns,
  Search,
  PenTool,
  Highlighter,
  Square,
  Circle,
  Type,
  Shield,
  Stamp,
  Check,
  X,
  GripVertical,
  RotateCcw,
  Scaling,
  LayoutGrid,
  Maximize,
  Minimize,
  SlidersHorizontal,
  Scan,
  FolderOpen,
  Plus,
  Printer,
  Crop,
  RefreshCw,
} from "lucide-react";
import { PdfCropOverlay } from "../crop/PdfCropOverlay";
import { PdfCropControlBar } from "../crop/PdfCropControlBar";
import {
  NormalizedCropBox,
  CropUnit,
  StandardCropPreset,
} from "../../engine/cropEngine";
import { OmniDocument } from "../../types";

interface DocumentCanvasProps {
  pages: OmniPage[];
  activePageIndex: number;
  viewMode: ViewMode;
  activeTool: ActiveTool;
  zoom: number;
  document?: OmniDocument;
  activePagePreviewUrl?: string | null;
  onZoomChange: (newZoom: number) => void;
  onSelectPage: (index: number) => void;
  onAddAnnotation: (pageIndex: number, annotation: OmniAnnotation) => void;
  onAddRedaction: (pageIndex: number, redaction: OmniRedaction) => void;
  onDeleteAnnotation: (pageIndex: number, id: string) => void;
  onDeleteRedaction: (pageIndex: number, id: string) => void;
  onSetActiveTool: (tool: ActiveTool) => void;
  onOpenScanModal?: () => void;
  onImportFiles?: () => void;
  onAddBlankPage?: () => void;
  onOpenPhotoPrintStudio?: () => void;
  onApplyPageCrop?: (cropBox: NormalizedCropBox, scope: "current" | "selected" | "all") => void;
}

export const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  pages,
  activePageIndex,
  viewMode,
  activeTool,
  zoom,
  document: propDocument,
  activePagePreviewUrl,
  onZoomChange,
  onSelectPage,
  onAddAnnotation,
  onAddRedaction,
  onDeleteAnnotation,
  onDeleteRedaction,
  onSetActiveTool,
  onOpenScanModal,
  onImportFiles,
  onAddBlankPage,
  onOpenPhotoPrintStudio,
  onApplyPageCrop,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageElementRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<Point>({ x: 0, y: 0 });

  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  const prevZoomPropRef = useRef(zoom);

  useEffect(() => {
    zoomRef.current = zoom;
    if (prevZoomPropRef.current !== zoom) {
      const oldZoom = prevZoomPropRef.current;
      prevZoomPropRef.current = zoom;
      if (oldZoom > 0 && zoom > 0 && oldZoom !== zoom) {
        setPan((currentPan) => {
          const factor = zoom / oldZoom;
          return {
            x: currentPan.x * factor,
            y: currentPan.y * factor,
          };
        });
      }
    }
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Helper: check if pointer is over the viewport's scrollbar
  const isPointerOverScrollbar = (element: HTMLElement, clientX: number, clientY: number): boolean => {
    const rect = element.getBoundingClientRect();

    // Vertical scrollbar check (right edge)
    const isScrollableY = element.scrollHeight > element.clientHeight;
    const vScrollbarWidth = element.offsetWidth - element.clientWidth - element.clientLeft;
    if (isScrollableY && vScrollbarWidth > 0) {
      const vScrollbarLeft = rect.right - vScrollbarWidth;
      if (clientX >= vScrollbarLeft && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return true;
      }
    }

    // Horizontal scrollbar check (bottom edge)
    const isScrollableX = element.scrollWidth > element.clientWidth;
    const hScrollbarHeight = element.offsetHeight - element.clientHeight - element.clientTop;
    if (isScrollableX && hScrollbarHeight > 0) {
      const hScrollbarTop = rect.bottom - hScrollbarHeight;
      if (clientY >= hScrollbarTop && clientY <= rect.bottom && clientX >= rect.left && clientX <= rect.right) {
        return true;
      }
    }

    return false;
  };

  // Helper: check if target is inside a scrollable child element or floating control bar
  const isInsideScrollableChild = (target: EventTarget | null, viewport: HTMLElement): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;

    // If inside floating toolbar, crop bar, input, select, button, slider, or dialog
    if (target.closest(".pdf-crop-bar, [data-floating-toolbar], input, select, textarea, button")) {
      return true;
    }

    // Traverse upward to see if any child container between target and viewport has scrollable overflow
    let current: HTMLElement | null = target;
    while (current && current !== viewport && current !== document.body) {
      const style = window.getComputedStyle(current);
      const hasScrollY = (style.overflowY === "auto" || style.overflowY === "scroll") && current.scrollHeight > current.clientHeight;
      const hasScrollX = (style.overflowX === "auto" || style.overflowX === "scroll") && current.scrollWidth > current.clientWidth;
      if (hasScrollY || hasScrollX) {
        return true;
      }
      current = current.parentElement;
    }

    return false;
  };

  // High-precision Center-Based Mouse Wheel Zoom over the Document Viewport
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // 1. If pointer is over the viewport's scrollbar, allow native scrollbar scrolling (no zoom, no preventDefault)
      if (isPointerOverScrollbar(viewport, e.clientX, e.clientY)) {
        return;
      }

      // 2. If pointer is over any scrollable child container, input, or toolbar control, allow native child scrolling (no zoom, no preventDefault)
      if (isInsideScrollableChild(e.target, viewport)) {
        return;
      }

      // 3. Pointer is over PDF canvas / document content area: execute center-anchored PDF wheel zoom
      e.preventDefault();
      e.stopPropagation();

      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;

      // Wheel up zooms in, wheel down zooms out
      const zoomStep = 1.12;
      const factor = e.deltaY < 0 ? zoomStep : 1 / zoomStep;
      const newZoom = Math.max(0.25, Math.min(10.0, Number((currentZoom * factor).toFixed(3))));

      if (newZoom === currentZoom) return;

      // Center-anchored zoom: anchor is strictly the center of the visible viewport (0, 0 relative to center)
      // Preserves whatever is in the center of the screen without drifting towards the cursor or jumping
      const newPanX = currentPan.x * (newZoom / currentZoom);
      const newPanY = currentPan.y * (newZoom / currentZoom);

      setPan({ x: newPanX, y: newPanY });
      onZoomChange(newZoom);
    };

    viewport.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleNativeWheel);
    };
  }, [onZoomChange]);

  // Dedicated PDF Page Crop Mode State
  const [cropBox, setCropBox] = useState<NormalizedCropBox>({
    x: 0.05,
    y: 0.05,
    width: 0.9,
    height: 0.9,
  });
  const [cropUnit, setCropUnit] = useState<CropUnit>("mm");
  const [cropPreset, setCropPreset] = useState<StandardCropPreset>("free");
  const [cropAspectRatioLocked, setCropAspectRatioLocked] = useState<boolean>(false);
  const [cropTargetAspectRatio, setCropTargetAspectRatio] = useState<number | null>(null);
  const [cropScope, setCropScope] = useState<"current" | "selected" | "all">("current");

  // Before/After Split Slider State (0 to 1)
  const [splitPos, setSplitPos] = useState<number>(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  // 8x Magnifier Loupe Tool
  const [loupePos, setLoupePos] = useState<Point | null>(null);

  // Drawing Annotation / Redaction drag state
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<Point | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<Point[]>([]);

  // OCR bounding box hover
  const [hoveredOcrWord, setHoveredOcrWord] = useState<any | null>(null);

  // Floating Canvas Toolbar Draggable & Resizable State
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingToolbar, setIsDraggingToolbar] = useState<boolean>(false);
  const [toolbarScale, setToolbarScale] = useState<number>(1.0);
  const [toolbarOrientation, setToolbarOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [isResizingToolbar, setIsResizingToolbar] = useState<boolean>(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragStartOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });
  const resizeStartRef = useRef<{ startX: number; startY: number; startScale: number }>({ startX: 0, startY: 0, startScale: 1.0 });

  const handleToolbarDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    if (toolbarRef.current && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const toolbarRect = toolbarRef.current.getBoundingClientRect();

      const currentX = toolbarRect.left - containerRect.left;
      const currentY = toolbarRect.top - containerRect.top;

      dragStartOffsetRef.current = {
        offsetX: clientX - toolbarRect.left,
        offsetY: clientY - toolbarRect.top,
      };

      setToolbarPos({ x: currentX, y: currentY });
      setIsDraggingToolbar(true);
    }
  };

  const handleToolbarResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    resizeStartRef.current = {
      startX: clientX,
      startY: clientY,
      startScale: toolbarScale,
    };
    setIsResizingToolbar(true);
  };

  useEffect(() => {
    if (!isDraggingToolbar) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

      if (!containerRef.current || !toolbarRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const toolbarRect = toolbarRef.current.getBoundingClientRect();

      const rawX = clientX - containerRect.left - dragStartOffsetRef.current.offsetX;
      const rawY = clientY - containerRect.top - dragStartOffsetRef.current.offsetY;

      const padding = 8;
      const maxX = Math.max(padding, containerRect.width - toolbarRect.width - padding);
      const maxY = Math.max(padding, containerRect.height - toolbarRect.height - padding);

      const clampedX = Math.max(padding, Math.min(maxX, rawX));
      const clampedY = Math.max(padding, Math.min(maxY, rawY));

      setToolbarPos({ x: clampedX, y: clampedY });
    };

    const handlePointerUp = () => {
      setIsDraggingToolbar(false);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: false });
    window.addEventListener("touchend", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
    };
  }, [isDraggingToolbar]);

  // Handle Drag-to-Resize Toolbar
  useEffect(() => {
    if (!isResizingToolbar) return;

    const handleResizeMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

      const deltaX = clientX - resizeStartRef.current.startX;
      const deltaY = clientY - resizeStartRef.current.startY;
      const delta = toolbarOrientation === "horizontal" ? deltaX : deltaY;

      const newScale = Math.max(0.75, Math.min(1.5, resizeStartRef.current.startScale + delta / 220));
      setToolbarScale(Number(newScale.toFixed(2)));
    };

    const handleResizeUp = () => {
      setIsResizingToolbar(false);
    };

    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeUp);
    window.addEventListener("touchmove", handleResizeMove, { passive: false });
    window.addEventListener("touchend", handleResizeUp);

    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeUp);
      window.removeEventListener("touchmove", handleResizeMove);
      window.removeEventListener("touchend", handleResizeUp);
    };
  }, [isResizingToolbar, toolbarOrientation]);

  const activePage = pages[activePageIndex] || null;
  const displayedPageUrl =
    (activePage && activePagePreviewUrl) ||
    activePage?.processedDataUrl ||
    activePage?.thumbnailDataUrl;

  // Center Pan on page change or fit
  const centerCanvas = useCallback(() => {
    setPan({ x: 0, y: 0 });
  }, []);

  // Global window listeners for active canvas panning to ensure fluid movement even when pointer leaves canvas bounds
  useEffect(() => {
    if (!isPanning) return;

    const handlePointerMove = (e: MouseEvent) => {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    };

    const handlePointerUp = () => {
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [isPanning, startPan]);

  // Mouse Handlers for Pan & Drawing with precision normalized page coordinates
  const getNormalizedPageCoords = useCallback((clientX: number, clientY: number) => {
    if (!pageElementRef.current) return null;
    const norm = screenToDocumentNormalized(clientX, clientY, pageElementRef.current, true);
    if (!norm) return null;
    return { x: norm.u, y: norm.v };
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 1 || activeTool === "pan" || activeTool === "crop" || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (activeTool === "split-view") {
      setIsDraggingSplit(true);
      return;
    }

    // Annotation or Redaction creation
    if (
      [
        "highlight",
        "redact-region",
        "shape-rectangle",
        "shape-circle",
        "text-annotation",
        "stamp",
        "freehand",
      ].includes(activeTool)
    ) {
      const coords = getNormalizedPageCoords(e.clientX, e.clientY);
      if (coords) {
        setDrawStart(coords);
        setDrawCurrent(coords);
        if (activeTool === "freehand") {
          setFreehandPoints([coords]);
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
      return;
    }

    if (isDraggingSplit && activeTool === "split-view" && pageElementRef.current) {
      const rect = pageElementRef.current.getBoundingClientRect();
      const pos = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
      setSplitPos(pos);
      return;
    }

    if (activeTool === "magnifier" && pageElementRef.current) {
      const rect = pageElementRef.current.getBoundingClientRect();
      setLoupePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      return;
    }

    if (drawStart) {
      const coords = getNormalizedPageCoords(e.clientX, e.clientY);
      if (coords) {
        setDrawCurrent(coords);
        if (activeTool === "freehand") {
          setFreehandPoints((prev) => [...prev, coords]);
        }
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setIsDraggingSplit(false);

    if (drawStart && drawCurrent && activePage) {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const w = Math.abs(drawCurrent.x - drawStart.x);
      const h = Math.abs(drawCurrent.y - drawStart.y);

      // Only create if meaningful size
      if (w > 0.01 && h > 0.01) {
        if (activeTool === "redact-region") {
          onAddRedaction(activePageIndex, {
            id: `red-${Date.now()}`,
            x,
            y,
            width: w,
            height: h,
            reason: "User Redacted",
            color: "#000000",
            isPermanent: false,
          });
        } else if (activeTool === "highlight") {
          onAddAnnotation(activePageIndex, {
            id: `ann-${Date.now()}`,
            type: "highlight",
            x,
            y,
            width: w,
            height: h,
            strokeColor: "#FBBF24",
            opacity: 0.4,
            strokeWidth: 1,
            createdAt: new Date().toISOString(),
          });
        } else if (activeTool === "shape-rectangle") {
          onAddAnnotation(activePageIndex, {
            id: `ann-${Date.now()}`,
            type: "rectangle",
            x,
            y,
            width: w,
            height: h,
            strokeColor: "#EF4444",
            strokeWidth: 2,
            opacity: 1.0,
            createdAt: new Date().toISOString(),
          });
        } else if (activeTool === "shape-circle") {
          onAddAnnotation(activePageIndex, {
            id: `ann-${Date.now()}`,
            type: "circle",
            x,
            y,
            width: w,
            height: h,
            strokeColor: "#3B82F6",
            strokeWidth: 2,
            opacity: 1.0,
            createdAt: new Date().toISOString(),
          });
        } else if (activeTool === "text-annotation") {
          const text = prompt("Enter text for annotation note:") || "Note";
          onAddAnnotation(activePageIndex, {
            id: `ann-${Date.now()}`,
            type: "text",
            x,
            y,
            width: w,
            height: h,
            text,
            strokeColor: "#10B981",
            strokeWidth: 1,
            opacity: 1.0,
            fontSize: 14,
            createdAt: new Date().toISOString(),
          });
        } else if (activeTool === "stamp") {
          onAddAnnotation(activePageIndex, {
            id: `ann-${Date.now()}`,
            type: "stamp",
            x,
            y,
            width: Math.max(0.18, w),
            height: Math.max(0.06, h),
            text: "APPROVED",
            strokeColor: "#DC2626",
            strokeWidth: 2,
            opacity: 0.9,
            createdAt: new Date().toISOString(),
          });
        }
      }

      setDrawStart(null);
      setDrawCurrent(null);
      setFreehandPoints([]);
    }
  };

  const handleApplyCrop = () => {
    if (onApplyPageCrop) {
      onApplyPageCrop(cropBox, cropScope);
    }
  };

  const handleResetCrop = () => {
    setCropBox({ x: 0, y: 0, width: 1, height: 1 });
    setCropPreset("free");
    setCropAspectRatioLocked(false);
    setCropTargetAspectRatio(null);
  };

  const handleCancelCrop = () => {
    onSetActiveTool("select");
  };

  return (
    <main
      ref={containerRef}
      className="relative flex-1 bg-neutral-950 overflow-hidden flex flex-col select-none"
    >
      {/* Dedicated PDF Page Crop Control Bar when Active */}
      {activeTool === "crop" && activePage && (
        <PdfCropControlBar
          activePage={activePage}
          document={
            propDocument
              ? { ...propDocument, selectedPageIds: propDocument.selectedPageIds || [] }
              : {
                  id: "active-doc",
                  name: "PDF Document",
                  pages,
                  activePageIndex,
                  selectedPageIds: [],
                  tags: [],
                  isDirty: false,
                  createdAt: "",
                  updatedAt: "",
                  metadata: {
                    title: "",
                    author: "",
                    subject: "",
                    keywords: "",
                    creator: "",
                    producer: "",
                    creationDate: "",
                    modificationDate: "",
                    pdfAStandard: "PDF/A-2b",
                  },
                }
          }
          cropBox={cropBox}
          unit={cropUnit}
          preset={cropPreset}
          aspectRatioLocked={cropAspectRatioLocked}
          targetAspectRatio={cropTargetAspectRatio}
          cropScope={cropScope}
          onCropBoxChange={setCropBox}
          onUnitChange={setCropUnit}
          onPresetChange={setCropPreset}
          onAspectRatioLockChange={(locked, ratio) => {
            setCropAspectRatioLocked(locked);
            setCropTargetAspectRatio(ratio);
          }}
          onCropScopeChange={setCropScope}
          onApplyCrop={handleApplyCrop}
          onCancelCrop={handleCancelCrop}
          onResetCrop={handleResetCrop}
        />
      )}
      {/* Floating Canvas Toolbar (Freely Draggable & Resizable) */}
      <div
        ref={toolbarRef}
        style={{
          ...(toolbarPos
            ? {
                left: `${toolbarPos.x}px`,
                top: `${toolbarPos.y}px`,
                transform: `scale(${toolbarScale})`,
                transformOrigin: "top left",
              }
            : {
                top: "12px",
                left: "50%",
                transform: `translateX(-50%) scale(${toolbarScale})`,
                transformOrigin: "top center",
              }),
        }}
        className={`absolute z-20 flex ${
          toolbarOrientation === "vertical"
            ? "flex-col space-y-1.5 p-1.5"
            : "items-center space-x-1 px-2 py-1"
        } bg-neutral-900/95 backdrop-blur-xl rounded-xl border border-neutral-800 shadow-2xl text-xs transition-shadow duration-150 ${
          isDraggingToolbar
            ? "ring-2 ring-sky-500/50 shadow-2xl scale-[1.01] cursor-grabbing"
            : isResizingToolbar
            ? "ring-2 ring-amber-500/50 shadow-2xl cursor-se-resize"
            : "hover:border-neutral-700"
        }`}
      >
        {/* Drag Handle & Orientation Controls */}
        <div
          className={`flex ${
            toolbarOrientation === "vertical" ? "flex-col items-center space-y-1" : "items-center space-x-1"
          }`}
        >
          <div
            onMouseDown={handleToolbarDragStart}
            onTouchStart={handleToolbarDragStart}
            onDoubleClick={() => {
              setToolbarPos(null);
              setToolbarScale(1.0);
            }}
            className="flex items-center justify-center p-1 text-neutral-400 hover:text-white cursor-grab active:cursor-grabbing hover:bg-neutral-800/80 rounded transition-colors group select-none"
            title="Drag bar anywhere (Double-click to snap back to top-center)"
          >
            <GripVertical className="w-4 h-4 text-neutral-400 group-hover:text-sky-400 transition-colors" />
          </div>

          <button
            onClick={() => setToolbarOrientation(toolbarOrientation === "horizontal" ? "vertical" : "horizontal")}
            className="p-1 rounded text-neutral-400 hover:text-sky-300 hover:bg-neutral-800/80 transition-colors"
            title={`Switch to ${toolbarOrientation === "horizontal" ? "Vertical Dock" : "Horizontal Bar"}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>

        <div
          className={
            toolbarOrientation === "vertical"
              ? "w-full h-px bg-neutral-800 my-0.5"
              : "h-4 w-px bg-neutral-800 mx-0.5"
          }
        />

        {/* Tool Selectors */}
        <button
          onClick={() => onSetActiveTool("select")}
          className={`p-1.5 rounded transition-colors ${activeTool === "select" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"}`}
          title="Pointer / Select Tool (V)"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onSetActiveTool("pan")}
          className={`p-1.5 rounded transition-colors ${activeTool === "pan" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"}`}
          title="Pan Hand Tool (H / Middle Click)"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onSetActiveTool("magnifier")}
          className={`p-1.5 rounded transition-colors ${activeTool === "magnifier" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"}`}
          title="8x Precision Magnifier Loupe"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onSetActiveTool(activeTool === "crop" ? "select" : "crop")}
          className={`flex items-center space-x-1 ${
            toolbarOrientation === "vertical" ? "p-1.5" : "px-2 py-1"
          } rounded transition-colors ${activeTool === "crop" ? "bg-sky-600 text-white font-bold shadow" : "text-neutral-400 hover:text-white"}`}
          title="Dedicated PDF Page Crop Mode (C)"
        >
          <Crop className="w-3.5 h-3.5" />
          {toolbarOrientation === "horizontal" && <span className="hidden sm:inline">Crop</span>}
        </button>

        <div
          className={
            toolbarOrientation === "vertical"
              ? "w-full h-px bg-neutral-800 my-0.5"
              : "h-4 w-px bg-neutral-800 mx-1"
          }
        />

        {/* Split View Toggle */}
        <button
          onClick={() => onSetActiveTool(activeTool === "split-view" ? "select" : "split-view")}
          className={`flex items-center space-x-1 ${
            toolbarOrientation === "vertical" ? "p-1.5" : "px-2 py-1"
          } rounded transition-colors ${activeTool === "split-view" ? "bg-amber-600 text-white font-medium" : "text-neutral-400 hover:text-white"}`}
          title="Before / After Comparison Split Slider"
        >
          <Columns className="w-3.5 h-3.5" />
          {toolbarOrientation === "horizontal" && <span className="hidden sm:inline">Split</span>}
        </button>

        <div
          className={
            toolbarOrientation === "vertical"
              ? "w-full h-px bg-neutral-800 my-0.5"
              : "h-4 w-px bg-neutral-800 mx-1"
          }
        />

        {/* Annotation Tools */}
        <button
          onClick={() => onSetActiveTool("highlight")}
          className={`p-1.5 rounded transition-colors ${activeTool === "highlight" ? "bg-amber-500 text-neutral-950 font-bold" : "text-neutral-400 hover:text-white"}`}
          title="Highlight Text (Yellow)"
        >
          <Highlighter className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onSetActiveTool("shape-rectangle")}
          className={`p-1.5 rounded transition-colors ${activeTool === "shape-rectangle" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"}`}
          title="Draw Rectangle"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onSetActiveTool("shape-circle")}
          className={`p-1.5 rounded transition-colors ${activeTool === "shape-circle" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"}`}
          title="Draw Circle"
        >
          <Circle className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onSetActiveTool("text-annotation")}
          className={`p-1.5 rounded transition-colors ${activeTool === "text-annotation" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"}`}
          title="Add Text Stamp / Note"
        >
          <Type className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onSetActiveTool("stamp")}
          className={`p-1.5 rounded transition-colors ${activeTool === "stamp" ? "bg-rose-600 text-white font-bold" : "text-neutral-400 hover:text-white"}`}
          title="Add Official Approval Stamp"
        >
          <Stamp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onSetActiveTool("redact-region")}
          className={`flex items-center space-x-1 ${
            toolbarOrientation === "vertical" ? "p-1.5" : "px-2 py-1"
          } rounded transition-colors ${activeTool === "redact-region" ? "bg-rose-600 text-white font-semibold" : "text-rose-400 hover:bg-rose-950/40"}`}
          title="Redact Sensitive Area"
        >
          <Shield className="w-3.5 h-3.5" />
          {toolbarOrientation === "horizontal" && <span className="hidden sm:inline">Redact</span>}
        </button>

        <div
          className={
            toolbarOrientation === "vertical"
              ? "w-full h-px bg-neutral-800 my-0.5"
              : "h-4 w-px bg-neutral-800 mx-1"
          }
        />

        {/* Size Presets (S, M, L) */}
        <div
          className={`flex items-center ${
            toolbarOrientation === "vertical" ? "flex-col space-y-0.5" : "space-x-0.5"
          } bg-neutral-950/60 p-0.5 rounded border border-neutral-800`}
        >
          <button
            onClick={() => setToolbarScale(0.8)}
            className={`px-1.5 py-0.5 text-[10px] font-semibold rounded transition-colors ${
              toolbarScale <= 0.85 ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"
            }`}
            title="Compact Size (80%)"
          >
            S
          </button>
          <button
            onClick={() => setToolbarScale(1.0)}
            className={`px-1.5 py-0.5 text-[10px] font-semibold rounded transition-colors ${
              toolbarScale > 0.85 && toolbarScale < 1.15
                ? "bg-sky-600 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
            title="Standard Size (100%)"
          >
            M
          </button>
          <button
            onClick={() => setToolbarScale(1.25)}
            className={`px-1.5 py-0.5 text-[10px] font-semibold rounded transition-colors ${
              toolbarScale >= 1.15 ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"
            }`}
            title="Large Size (125%)"
          >
            L
          </button>
        </div>

        {/* Reset position & scale icon */}
        {(toolbarPos || toolbarScale !== 1.0 || toolbarOrientation !== "horizontal") && (
          <button
            onClick={() => {
              setToolbarPos(null);
              setToolbarScale(1.0);
              setToolbarOrientation("horizontal");
            }}
            className="p-1 rounded text-neutral-400 hover:text-sky-300 hover:bg-neutral-800 transition-colors"
            title="Reset bar position, orientation & scale"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}

        {/* Interactive Drag-to-Resize Grip */}
        <div
          onMouseDown={handleToolbarResizeStart}
          onTouchStart={handleToolbarResizeStart}
          onDoubleClick={() => setToolbarScale(1.0)}
          className={`flex items-center justify-center p-1 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800/80 rounded transition-colors cursor-se-resize select-none ${
            isResizingToolbar ? "text-amber-400 bg-neutral-800" : ""
          }`}
          title={`Drag to resize smoothly (${Math.round(toolbarScale * 100)}% - Double click to reset)`}
        >
          <Scaling className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`pdf-main-viewport flex-1 min-h-0 relative flex items-center justify-center p-8 overflow-auto select-none custom-scrollbar ${
          activeTool === "pan" || activeTool === "crop"
            ? isPanning
              ? "cursor-grabbing"
              : "cursor-grab"
            : isPanning
            ? "cursor-grabbing"
            : "cursor-crosshair"
        }`}
      >
        {/* Render Single Page Mode */}
        {viewMode === "single" && activePage && (
          <div
            ref={pageElementRef}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isPanning ? "none" : "transform 0.08s ease-out",
            }}
            className="relative shadow-2xl rounded bg-white border border-neutral-800 shrink-0"
          >
            {/* Split View Mode */}
            {activeTool === "split-view" ? (
              <div className="relative overflow-hidden">
                {/* Processed (Right Side) */}
                <img
                  src={displayedPageUrl}
                  alt="Processed Document"
                  className="max-h-[82vh] w-auto pointer-events-none object-contain"
                />

                {/* Original (Left Side Clamped by splitPos) */}
                <div
                  style={{ width: `${splitPos * 100}%` }}
                  className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-amber-400 shadow-2xl"
                >
                  <img
                    src={activePage.originalDataUrl}
                    alt="Original Document"
                    className="max-h-[82vh] w-auto max-w-none pointer-events-none object-contain"
                  />
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-amber-400 font-bold">
                    ORIGINAL
                  </span>
                </div>

                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-sky-400 font-bold">
                  PROCESSED
                </span>

                {/* Slider Handle */}
                <div
                  style={{ left: `${splitPos * 100}%` }}
                  className="absolute inset-y-0 -ml-3 w-6 flex items-center justify-center cursor-ew-resize z-10"
                  data-split-slider="true"
                  onWheel={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const delta = (e.deltaY < 0 || e.deltaX > 0) ? 0.02 : -0.02;
                    setSplitPos((prev) => Math.max(0.05, Math.min(0.95, Number((prev + delta).toFixed(3)))));
                  }}
                  title="Drag or roll mouse wheel to adjust comparison split"
                >
                  <div className="w-5 h-8 rounded-full bg-amber-400 text-neutral-950 flex items-center justify-center shadow-lg font-bold text-[10px]">
                    ↔
                  </div>
                </div>
              </div>
            ) : (
              /* Standard Single View */
              <div className="relative">
                <img
                  src={displayedPageUrl}
                  alt={`Page ${activePageIndex + 1}`}
                  className="max-h-[82vh] w-auto pointer-events-none object-contain shadow-2xl"
                />

                {/* Progressive high-res render badge */}
                {activePage.isPendingRender && (
                  <div className="absolute top-2 right-2 flex items-center space-x-1.5 bg-neutral-900/90 text-sky-400 border border-sky-500/40 rounded-full px-2.5 py-0.5 text-[11px] font-mono shadow-lg pointer-events-none backdrop-blur">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Rendering...</span>
                  </div>
                )}

                {/* Vector Annotations Layer */}
                {activePage.annotations.map((ann) => {
                  return (
                    <div
                      key={ann.id}
                      style={{
                        left: `${ann.x * 100}%`,
                        top: `${ann.y * 100}%`,
                        width: `${ann.width * 100}%`,
                        height: `${ann.height * 100}%`,
                        borderColor: ann.strokeColor,
                        borderWidth: ann.type === "highlight" ? 0 : `${ann.strokeWidth || 2}px`,
                        backgroundColor:
                          ann.type === "highlight" ? ann.strokeColor : ann.fillColor || "transparent",
                        opacity: ann.opacity || 1.0,
                        borderRadius: ann.type === "circle" ? "9999px" : "2px",
                      }}
                      className="absolute group border pointer-events-auto"
                    >
                      {ann.type === "text" && (
                        <span
                          style={{ color: ann.strokeColor, fontSize: `${ann.fontSize || 13}px` }}
                          className="p-1 font-bold font-sans block"
                        >
                          {ann.text}
                        </span>
                      )}

                      {ann.type === "stamp" && (
                        <div className="w-full h-full border-2 border-red-600 bg-red-950/20 text-red-500 font-serif font-black flex items-center justify-center text-xs tracking-wider">
                          {ann.text || "APPROVED"}
                        </div>
                      )}

                      {/* Delete annotation on hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAnnotation(activePageIndex, ann.id);
                        }}
                        className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete Annotation"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                {/* Redactions Layer */}
                {activePage.redactions.map((red) => (
                  <div
                    key={red.id}
                    style={{
                      left: `${red.x * 100}%`,
                      top: `${red.y * 100}%`,
                      width: `${red.width * 100}%`,
                      height: `${red.height * 100}%`,
                      backgroundColor: red.color || "#000000",
                    }}
                    className="absolute group z-10 flex items-center justify-center"
                  >
                    {red.label && (
                      <span className="text-[10px] font-mono font-bold text-white tracking-widest uppercase">
                        {red.label}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteRedaction(activePageIndex, red.id);
                      }}
                      className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow"
                      title="Remove Redaction"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Active Drawing Box Preview */}
                {drawStart && drawCurrent && (
                  <div
                    style={{
                      left: `${Math.min(drawStart.x, drawCurrent.x) * 100}%`,
                      top: `${Math.min(drawStart.y, drawCurrent.y) * 100}%`,
                      width: `${Math.abs(drawCurrent.x - drawStart.x) * 100}%`,
                      height: `${Math.abs(drawCurrent.y - drawStart.y) * 100}%`,
                    }}
                    className={`absolute border-2 pointer-events-none z-20 ${
                      activeTool === "redact-region"
                        ? "bg-rose-600/30 border-rose-500 border-dashed"
                        : "bg-sky-500/20 border-sky-400"
                    }`}
                  />
                )}

                {/* OCR Bounding Box Inspection Overlay */}
                {activePage.ocr?.blocks && (
                  <div className="absolute inset-0 pointer-events-none">
                    {activePage.ocr.blocks.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          left: `${(b.bbox.x0 / activePage.width) * 100}%`,
                          top: `${(b.bbox.y0 / activePage.height) * 100}%`,
                          width: `${((b.bbox.x1 - b.bbox.x0) / activePage.width) * 100}%`,
                          height: `${((b.bbox.y1 - b.bbox.y0) / activePage.height) * 100}%`,
                        }}
                        className="absolute border border-emerald-500/20 hover:border-emerald-400 hover:bg-emerald-500/10 pointer-events-auto transition-colors group"
                      >
                        <span className="absolute -top-3.5 left-0 px-1 py-0.2 text-[8px] font-mono bg-emerald-950 text-emerald-300 rounded opacity-0 group-hover:opacity-100 transition-opacity shadow">
                          {b.confidence}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* PDF Page Interactive 8-Point Crop Overlay */}
                {activeTool === "crop" && (
                  <PdfCropOverlay
                    page={activePage}
                    cropBox={cropBox}
                    unit={cropUnit}
                    aspectRatioLocked={cropAspectRatioLocked}
                    targetAspectRatio={cropTargetAspectRatio}
                    onCropBoxChange={setCropBox}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Render Continuous Multi-Page Vertical Scroll View */}
        {viewMode === "continuous" && (
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "top center",
            }}
            className="flex flex-col space-y-6 items-center"
          >
            {pages.map((page, idx) => (
              <div
                key={page.id}
                onClick={() => onSelectPage(idx)}
                className={`relative shadow-2xl rounded bg-neutral-900 border transition-all ${
                  idx === activePageIndex ? "border-sky-500 ring-2 ring-sky-500/30" : "border-neutral-800"
                }`}
              >
                <img
                  src={page.processedDataUrl || page.thumbnailDataUrl}
                  alt={`Page ${idx + 1}`}
                  className="max-h-[75vh] w-auto pointer-events-none object-contain"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 font-mono text-xs text-neutral-300 font-bold">
                  Page {idx + 1}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Render Two-Page Book Spread */}
        {viewMode === "two-page" && (
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
            className="flex items-center space-x-4"
          >
            {pages.slice(0, 2).map((page, idx) => (
              <div
                key={page.id}
                onClick={() => onSelectPage(idx)}
                className="relative shadow-2xl rounded bg-neutral-900 border border-neutral-800"
              >
                <img
                  src={page.processedDataUrl || page.thumbnailDataUrl}
                  alt={`Spread ${idx + 1}`}
                  className="max-h-[78vh] w-auto pointer-events-none object-contain"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 font-mono text-xs text-neutral-300">
                  Page {idx + 1}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Render Grid View */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4 max-w-6xl w-full">
            {pages.map((page, idx) => (
              <div
                key={page.id}
                onClick={() => {
                  onSelectPage(idx);
                  // Double click to single mode
                }}
                className={`flex flex-col rounded-lg border bg-neutral-900 p-2 cursor-pointer shadow-lg transition-all hover:scale-102 ${
                  idx === activePageIndex ? "border-sky-500 ring-2 ring-sky-500/40" : "border-neutral-800"
                }`}
              >
                <img
                  src={page.thumbnailDataUrl || page.processedDataUrl}
                  alt={`Grid ${idx + 1}`}
                  className="w-full aspect-[3/4] object-contain bg-neutral-950 rounded mb-2"
                />
                <div className="flex items-center justify-between text-xs text-neutral-300 font-mono">
                  <span className="font-bold">Page {idx + 1}</span>
                  <span className="text-neutral-500 text-[10px]">{page.width}×{page.height}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty Workspace Dropzone / Placeholder */}
        {pages.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 max-w-md text-center bg-neutral-900/90 border border-neutral-800 rounded-2xl shadow-2xl backdrop-blur-xl space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600/20 to-indigo-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-inner">
              <Scan className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Document Workspace is Empty</h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                All pages have been cleared. Scan a new page, import images/PDFs, or use the Passport Studio.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {onOpenScanModal && (
                <button
                  onClick={onOpenScanModal}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg transition-all active:scale-95"
                >
                  <Scan className="w-4 h-4" />
                  <span>Scan New Page</span>
                </button>
              )}
              {onImportFiles && (
                <button
                  onClick={onImportFiles}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs font-medium border border-neutral-700 transition-all"
                >
                  <FolderOpen className="w-4 h-4 text-sky-400" />
                  <span>Import PDF / Files</span>
                </button>
              )}
              {onAddBlankPage && (
                <button
                  onClick={onAddBlankPage}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs font-medium border border-neutral-700 transition-all"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Add Blank Page</span>
                </button>
              )}
              {onOpenPhotoPrintStudio && (
                <button
                  onClick={onOpenPhotoPrintStudio}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 text-xs font-medium border border-amber-800/60 transition-all"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Passport Studio</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 8x Loupe Floating Magnifier Box */}
      {activeTool === "magnifier" && loupePos && activePage && (
        <div
          style={{
            left: `${loupePos.x + 20}px`,
            top: `${loupePos.y - 80}px`,
          }}
          className="pointer-events-none fixed z-50 w-44 h-44 rounded-full border-4 border-sky-400 bg-neutral-950 shadow-2xl overflow-hidden flex items-center justify-center"
        >
          <img
            src={displayedPageUrl}
            alt="Magnified"
            style={{
              transform: `scale(4.0)`,
              transformOrigin: `${(loupePos.x / (containerRef.current?.clientWidth || 1)) * 100}% ${(loupePos.y / (containerRef.current?.clientHeight || 1)) * 100}%`,
            }}
            className="max-none w-full h-full object-contain"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full border border-sky-400 bg-sky-500/40" />
          </div>
          <span className="absolute bottom-2 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[9px] text-sky-300 font-bold">
            8X LOUPE
          </span>
        </div>
      )}
    </main>
  );
};
