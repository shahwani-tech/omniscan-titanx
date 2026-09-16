/**
 * OMNISCAN TITAN X - Super-Sized High-Performance Document Canvas
 * Infinite Zoom, Pan, Split-View Comparison, 8x Loupe, Annotation & Redaction Layers
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import { PerspectiveWarpOverlay } from "../crop/PerspectiveWarpOverlay";
import {
  NormalizedCropBox,
  CropUnit,
  StandardCropPreset,
} from "../../engine/cropEngine";
import {
  PerspectiveQuad,
  PerspectivePreset,
  PerspectiveDetectionCandidate,
} from "../../types";
import {
  detectDocumentPerspective,
  renderFastPerspectivePreviewSync,
} from "../../engine/perspectiveEngine";
import { loadImage } from "../../engine/vision";
import { OmniDocument } from "../../types";
import { prioritizePdfThumbnailPages } from "../../engine/pdf";
import { pageBlobStore } from "../../services/storage/PageBlobStore";
import { DraggableBarContainer } from "../common/DraggableBarContainer";
import { useAdaptiveViewport } from "../../hooks/useAdaptiveViewport";

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
  onViewModeChange?: (mode: ViewMode) => void;
  onAddAnnotation: (pageIndex: number, annotation: OmniAnnotation) => void;
  onAddRedaction: (pageIndex: number, redaction: OmniRedaction) => void;
  onDeleteAnnotation: (pageIndex: number, id: string) => void;
  onDeleteRedaction: (pageIndex: number, id: string) => void;
  onSetActiveTool: (tool: ActiveTool) => void;
  onOpenScanModal?: () => void;
  onImportFiles?: () => void;
  onAddBlankPage?: () => void;
  onOpenPhotoPrintStudio?: () => void;
  onApplyPageCrop?: (cropBox: NormalizedCropBox, scope: "current" | "selected" | "all") => void | Promise<void>;
  onApplyPerspectiveWarp?: (
    quad: PerspectiveQuad,
    preset: PerspectivePreset,
    fineDeskew: boolean,
    scope: "current" | "selected" | "all"
  ) => void | Promise<void>;
  isProcessing?: boolean;
}

export const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  pages,
  activePageIndex,
  viewMode,
  activeTool,
  zoom,
  document: propDocument,
  activePagePreviewUrl,
  isProcessing,
  onZoomChange,
  onSelectPage,
  onViewModeChange,
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
  onApplyPerspectiveWarp,
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
      // 1. In continuous view mode, if not holding Ctrl/Cmd, allow smooth native vertical scrolling
      if (viewMode === "continuous" && !e.ctrlKey && !e.metaKey) {
        return;
      }

      // 1b. In grid view mode, allow smooth native vertical scrolling through the page grid (do NOT intercept/zoom)
      if (viewMode === "grid") {
        return;
      }

      // 2. If pointer is over the viewport's scrollbar, allow native scrollbar scrolling (no zoom, no preventDefault)
      if (isPointerOverScrollbar(viewport, e.clientX, e.clientY)) {
        return;
      }

      // 3. If pointer is over any scrollable child container, input, or toolbar control, allow native child scrolling (no zoom, no preventDefault)
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
  }, [onZoomChange, viewMode]);

  // Dedicated PDF Page Crop Mode State
  const [cropMode, setCropMode] = useState<"rect" | "perspective">("rect");
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

  // Perspective Warp Mode State
  const [perspectiveQuad, setPerspectiveQuad] = useState<PerspectiveQuad>({
    topLeft: { x: 0.05, y: 0.05 },
    topRight: { x: 0.95, y: 0.05 },
    bottomRight: { x: 0.95, y: 0.95 },
    bottomLeft: { x: 0.05, y: 0.95 },
    preset: "natural",
  });
  const [perspectivePreset, setPerspectivePreset] = useState<PerspectivePreset>("natural");
  const [fineDeskewEnabled, setFineDeskewEnabled] = useState<boolean>(false);
  const [isDetectingPerspective, setIsDetectingPerspective] = useState<boolean>(false);
  const [detectionCandidates, setDetectionCandidates] = useState<PerspectiveDetectionCandidate[]>([]);
  const [perspectivePreviewUrl, setPerspectivePreviewUrl] = useState<string | null>(null);

  // Before/After Split Slider State (0 to 1)
  const [splitPos, setSplitPos] = useState<number>(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  // Grid View Scroll Container Ref
  const gridScrollContainerRef = useRef<HTMLDivElement>(null);

  // Continuous View Mode Windowed Virtualization State & Calculations
  // (Mirrors the robust windowed virtualization pattern from PageNavigator.tsx)
  const CONTINUOUS_OVERSCAN = 6;
  const CONTINUOUS_PAGE_GAP = 24; // 24px gap between pages (space-y-6)
  const continuousScrollContainerRef = useRef<HTMLDivElement>(null);
  const [continuousScrollTop, setContinuousScrollTop] = useState<number>(0);
  const [continuousContainerHeight, setContinuousContainerHeight] = useState<number>(800);

  // Measure continuous scroll container height via ResizeObserver (matching PageNavigator pattern)
  useEffect(() => {
    if (viewMode !== "continuous") return;
    const el = continuousScrollContainerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContinuousContainerHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode]);

  const handleContinuousScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setContinuousScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Base rendered width for continuous view based on zoom level
  const continuousBaseWidth = Math.round(760 * zoom);

  // Dynamic height calculation per page based on aspect ratio (supports mixed portrait/landscape/different sizes)
  const getContinuousPageHeight = useCallback(
    (page: OmniPage) => {
      if (page.width && page.height && page.width > 0) {
        return Math.round(continuousBaseWidth * (page.height / page.width));
      }
      // Standard A4 aspect ratio fallback (1.4142)
      return Math.round(continuousBaseWidth * 1.4142);
    },
    [continuousBaseWidth]
  );

  // Cumulative layout metrics for all pages (exact top, height, and bottom boundaries)
  const continuousMetrics = useMemo(() => {
    let currentTop = 0;
    const items: Array<{ index: number; top: number; height: number; bottom: number }> = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const height = getContinuousPageHeight(page);
      const top = currentTop;
      const bottom = top + height;
      items.push({ index: i, top, height, bottom });
      currentTop = bottom + CONTINUOUS_PAGE_GAP;
    }

    const totalHeight = items.length > 0 ? items[items.length - 1].bottom : 0;
    return { items, totalHeight };
  }, [pages, getContinuousPageHeight]);

  const totalPageCount = pages.length;
  // Window virtualization activates when total pages > 20 to prevent DOM/memory bloat on 50, 100, 500, 1000+ page docs
  const isContinuousVirtual = totalPageCount > 20;

  // Windowed visible range calculation with binary search and OVERSCAN buffer
  const { continuousStartIndex, continuousEndIndex } = useMemo(() => {
    if (totalPageCount === 0) {
      return { continuousStartIndex: 0, continuousEndIndex: 0 };
    }
    if (!isContinuousVirtual) {
      return { continuousStartIndex: 0, continuousEndIndex: totalPageCount - 1 };
    }

    const visibleTop = continuousScrollTop;
    const visibleBottom = continuousScrollTop + continuousContainerHeight;

    // Binary search for first intersecting page (where page bottom >= visibleTop)
    let low = 0;
    let high = totalPageCount - 1;
    let first = 0;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (continuousMetrics.items[mid].bottom >= visibleTop) {
        first = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    // Binary search for last intersecting page (where page top <= visibleBottom)
    low = 0;
    high = totalPageCount - 1;
    let last = totalPageCount - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (continuousMetrics.items[mid].top <= visibleBottom) {
        last = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const start = Math.max(0, first - CONTINUOUS_OVERSCAN);
    const end = Math.min(totalPageCount - 1, last + CONTINUOUS_OVERSCAN);
    return { continuousStartIndex: start, continuousEndIndex: end };
  }, [
    totalPageCount,
    isContinuousVirtual,
    continuousScrollTop,
    continuousContainerHeight,
    continuousMetrics,
  ]);

  // Height of top spacer element for unrendered pages above the viewport
  const continuousTopSpacer =
    isContinuousVirtual && continuousStartIndex > 0
      ? continuousMetrics.items[continuousStartIndex].top
      : 0;

  // Height of bottom spacer element for unrendered pages below the viewport
  const continuousBottomSpacer =
    isContinuousVirtual && continuousEndIndex < totalPageCount - 1
      ? Math.max(
          0,
          continuousMetrics.totalHeight - continuousMetrics.items[continuousEndIndex].bottom
        )
      : 0;

  // Handle clicking on spacer/placeholder areas to correctly navigate to not-yet-mounted pages
  const handleContinuousSpacerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, isTopSpacer: boolean) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const targetY = isTopSpacer
        ? clickY
        : (continuousMetrics.items[continuousEndIndex]?.bottom || 0) + clickY;

      for (let i = 0; i < continuousMetrics.items.length; i++) {
        const m = continuousMetrics.items[i];
        if (targetY >= m.top && targetY <= m.bottom + CONTINUOUS_PAGE_GAP) {
          onSelectPage(i);
          return;
        }
      }
    },
    [continuousMetrics, continuousEndIndex, onSelectPage]
  );

  // Prioritize PDF thumbnail rendering for visible range in continuous mode (matching PageNavigator pattern)
  useEffect(() => {
    if (viewMode === "continuous" && pages.length > 0) {
      const visibleNums: number[] = [];
      for (let i = continuousStartIndex; i <= continuousEndIndex; i++) {
        if (pages[i]?.pageNumber) {
          visibleNums.push(pages[i].pageNumber);
        }
      }
      if (visibleNums.length > 0) {
        prioritizePdfThumbnailPages(visibleNums);
      }
    }
  }, [viewMode, continuousStartIndex, continuousEndIndex, pages]);

  // Scroll active page into view in continuous mode if navigated externally
  const scrollContinuousActivePageIntoView = useCallback(() => {
    if (
      viewMode !== "continuous" ||
      !continuousScrollContainerRef.current ||
      activePageIndex < 0 ||
      activePageIndex >= continuousMetrics.items.length
    ) {
      return;
    }

    const item = continuousMetrics.items[activePageIndex];
    if (!item) return;

    const currentScroll = continuousScrollContainerRef.current.scrollTop;
    const visibleBottom = currentScroll + continuousContainerHeight;

    if (item.top < currentScroll || item.bottom > visibleBottom) {
      continuousScrollContainerRef.current.scrollTo({
        top: Math.max(0, item.top - continuousContainerHeight / 4),
        behavior: "smooth",
      });
    }
  }, [viewMode, activePageIndex, continuousContainerHeight, continuousMetrics]);

  useEffect(() => {
    scrollContinuousActivePageIntoView();
  }, [activePageIndex, scrollContinuousActivePageIntoView]);

  // 8x Magnifier Loupe Tool
  const [loupePos, setLoupePos] = useState<Point | null>(null);

  // Drawing Annotation / Redaction drag state
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<Point | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<Point[]>([]);
  const [pendingTextAnnotation, setPendingTextAnnotation] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [annotationNoteText, setAnnotationNoteText] = useState("Note");

  // OCR bounding box hover
  const [hoveredOcrWord, setHoveredOcrWord] = useState<any | null>(null);

  // Adaptive Viewport Metrics for Responsive Density
  const { toolbarPaddingClass } = useAdaptiveViewport();

  // Floating Canvas Toolbar Scaling & Orientation (Positioning and dragging handled by DraggableBarContainer)
  const [toolbarScale, setToolbarScale] = useState<number>(1.0);
  const [toolbarOrientation, setToolbarOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [isResizingToolbar, setIsResizingToolbar] = useState<boolean>(false);
  const resizeStartRef = useRef<{ startX: number; startY: number; startScale: number }>({ startX: 0, startY: 0, startScale: 1.0 });

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
  const [resolvedActivePageUrl, setResolvedActivePageUrl] = useState<string>("");
  const [resolvedOriginalUrl, setResolvedOriginalUrl] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    let createdUrl: string | null = null;
    let createdOrigUrl: string | null = null;

    if (activePage) {
      // Immediate fallback to thumbnail for fast rendering
      setResolvedActivePageUrl(activePage.thumbnailDataUrl || activePage.processedDataUrl || "");

      pageBlobStore.resolvePageUrl(activePage, "processed").then((url) => {
        if (isMounted && url) {
          createdUrl = url.startsWith("blob:") ? url : null;
          setResolvedActivePageUrl(url);
        }
      });

      pageBlobStore.resolvePageUrl(activePage, "original").then((url) => {
        if (isMounted && url) {
          createdOrigUrl = url.startsWith("blob:") ? url : null;
          setResolvedOriginalUrl(url);
        }
      });
    } else {
      setResolvedActivePageUrl("");
      setResolvedOriginalUrl("");
    }

    return () => {
      isMounted = false;
      if (createdUrl) pageBlobStore.revokeBlobUrl(createdUrl);
      if (createdOrigUrl) pageBlobStore.revokeBlobUrl(createdOrigUrl);
    };
  }, [
    activePage?.id,
    activePage?.processedBlobId,
    activePage?.originalBlobId,
    activePage?.processedDataUrl,
    activePage?.originalDataUrl,
    activePage?.lastModifiedAt,
  ]);

  const displayedPageUrl =
    (activePage && activePagePreviewUrl) ||
    resolvedActivePageUrl ||
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
          setPendingTextAnnotation({ x, y, width: w, height: h });
          setAnnotationNoteText("Note");
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

  const handleApplyCrop = async () => {
    if (onApplyPageCrop) {
      await onApplyPageCrop(cropBox, cropScope);
      handleResetCrop();
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

  // Perspective Warp Handlers
  const handleResetPerspectiveQuad = () => {
    setPerspectiveQuad({
      topLeft: { x: 0.05, y: 0.05 },
      topRight: { x: 0.95, y: 0.05 },
      bottomRight: { x: 0.95, y: 0.95 },
      bottomLeft: { x: 0.05, y: 0.95 },
      preset: perspectivePreset,
    });
  };

  const handleAutoDetectPerspective = async () => {
    if (!activePage) return;
    setIsDetectingPerspective(true);
    try {
      // Guarantee a safe fallback quad is in place immediately so handles are visible without delay
      setPerspectiveQuad((prev) => {
        if (
          prev &&
          prev.topLeft &&
          prev.topRight &&
          prev.bottomRight &&
          prev.bottomLeft
        ) {
          return prev;
        }
        return {
          topLeft: { x: 0.05, y: 0.05 },
          topRight: { x: 0.95, y: 0.05 },
          bottomRight: { x: 0.95, y: 0.95 },
          bottomLeft: { x: 0.05, y: 0.95 },
          preset: perspectivePreset,
        };
      });

      // Robustly resolve source image URL across blob store, memory data URLs, and previews
      let src =
        displayedPageUrl ||
        resolvedActivePageUrl ||
        activePage.processedDataUrl ||
        activePage.originalDataUrl;

      if (!src) {
        src =
          (await pageBlobStore.resolvePageUrl(activePage, "processed")) ||
          (await pageBlobStore.resolvePageUrl(activePage, "original")) ||
          activePage.thumbnailDataUrl ||
          "";
      }

      if (!src) {
        console.warn("Auto-detect perspective: no source image available");
        return;
      }

      const result = await detectDocumentPerspective(src);
      if (result && result.quad) {
        setPerspectiveQuad(result.quad);
        if (result.candidates && result.candidates.length > 0) {
          setDetectionCandidates(result.candidates);
        }
      }
    } catch (err) {
      console.warn("Auto-detect perspective error:", err);
      // On failure, smoothly retain full-frame safe corners
      setPerspectiveQuad({
        topLeft: { x: 0.05, y: 0.05 },
        topRight: { x: 0.95, y: 0.05 },
        bottomRight: { x: 0.95, y: 0.95 },
        bottomLeft: { x: 0.05, y: 0.95 },
        preset: perspectivePreset,
      });
    } finally {
      setIsDetectingPerspective(false);
    }
  };

  // Safe mode switch handler ensuring handles and detection initialize cleanly
  const handleCropModeChange = (newMode: "rect" | "perspective") => {
    setCropMode(newMode);
    if (newMode === "perspective") {
      if (activePage?.perspectiveQuad) {
        setPerspectiveQuad(activePage.perspectiveQuad);
      } else {
        setPerspectiveQuad({
          topLeft: { x: 0.05, y: 0.05 },
          topRight: { x: 0.95, y: 0.05 },
          bottomRight: { x: 0.95, y: 0.95 },
          bottomLeft: { x: 0.05, y: 0.95 },
          preset: perspectivePreset,
        });
        handleAutoDetectPerspective();
      }
    }
  };

  const handleApplyPerspectiveWarp = async () => {
    if (onApplyPerspectiveWarp) {
      await onApplyPerspectiveWarp(
        perspectiveQuad,
        perspectivePreset,
        fineDeskewEnabled,
        cropScope
      );
      handleResetPerspectiveQuad();
    }
  };

  // Synchronize Live De-Warped Preview
  useEffect(() => {
    if (activeTool !== "crop" || cropMode !== "perspective" || !activePage) {
      setPerspectivePreviewUrl(null);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(async () => {
      try {
        const src = activePage.processedDataUrl || activePage.originalDataUrl;
        if (!src) return;
        const img = await loadImage(src);
        if (isCancelled) return;
        const previewDataUrl = renderFastPerspectivePreviewSync(img, perspectiveQuad, 360);
        if (!isCancelled && previewDataUrl) {
          setPerspectivePreviewUrl(previewDataUrl);
        }
      } catch {
        // Non-blocking preview generation
      }
    }, 60);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [activeTool, cropMode, activePage, perspectiveQuad]);

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
          cropMode={cropMode}
          onCropModeChange={handleCropModeChange}
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
          perspectiveQuad={perspectiveQuad}
          onPerspectiveQuadChange={setPerspectiveQuad}
          perspectivePreset={perspectivePreset}
          onPerspectivePresetChange={setPerspectivePreset}
          isDetectingPerspective={isDetectingPerspective}
          onAutoDetectPerspective={handleAutoDetectPerspective}
          detectionCandidates={detectionCandidates}
          fineDeskewEnabled={fineDeskewEnabled}
          onFineDeskewToggle={setFineDeskewEnabled}
          perspectivePreviewUrl={perspectivePreviewUrl}
          resolvedImageUrl={displayedPageUrl || resolvedActivePageUrl}
          isProcessing={isProcessing}
          onApplyPerspectiveWarp={handleApplyPerspectiveWarp}
          onResetPerspectiveQuad={handleResetPerspectiveQuad}
        />
      )}
      {/* Floating Canvas Toolbar (Freely Draggable, Responsive & Persistent) */}
      <DraggableBarContainer
        storageKey="omniscan.toolbar.position"
        barTitle="Toolbar"
        defaultDock="top-center"
        defaultY={12}
        canSwitchOrientation={true}
        defaultOrientation={toolbarOrientation}
        onOrientationChange={setToolbarOrientation}
        zIndex={20}
      >
        {({ isDragging, resetPosition, orientation, toggleOrientation, dragHandleProps }) => (
          <div
            style={{
              transform: `scale(${toolbarScale})`,
              transformOrigin: orientation === "vertical" ? "top left" : "top center",
            }}
            className={`flex ${
              orientation === "vertical"
                ? "flex-col space-y-1.5 p-1.5"
                : `${toolbarPaddingClass} items-center space-x-1`
            } bg-neutral-900/95 backdrop-blur-xl rounded-xl border border-neutral-800 shadow-2xl text-xs transition-shadow duration-150 ${
              isDragging
                ? "ring-2 ring-sky-500/50 shadow-2xl scale-[1.01] cursor-grabbing"
                : isResizingToolbar
                ? "ring-2 ring-amber-500/50 shadow-2xl cursor-se-resize"
                : "hover:border-neutral-700"
            }`}
          >
            {/* Drag Handle & Orientation Controls */}
            <div
              className={`flex ${
                orientation === "vertical" ? "flex-col items-center space-y-1" : "items-center space-x-1"
              }`}
            >
              <div
                {...dragHandleProps}
                className="flex items-center justify-center p-1 text-neutral-400 hover:text-white cursor-grab active:cursor-grabbing hover:bg-neutral-800/80 rounded transition-colors group select-none"
                title="Drag bar anywhere (Double-click to snap back to top-center)"
              >
                <GripVertical className="w-4 h-4 text-neutral-400 group-hover:text-sky-400 transition-colors" />
              </div>

              <button
                type="button"
                onClick={toggleOrientation}
                className="p-1 rounded text-neutral-400 hover:text-sky-300 hover:bg-neutral-800/80 transition-colors"
                title={`Switch to ${orientation === "horizontal" ? "Vertical Dock" : "Horizontal Bar"}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              className={
                orientation === "vertical"
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
        <button
          type="button"
          onClick={() => {
            resetPosition();
            setToolbarScale(1.0);
          }}
          className="p-1 rounded text-neutral-400 hover:text-sky-300 hover:bg-neutral-800 transition-colors"
          title="Reset bar position, orientation & scale"
        >
          <RotateCcw className="w-3 h-3" />
        </button>

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
        )}
      </DraggableBarContainer>

      {/* Main Canvas Viewport */}
      <div
        ref={viewportRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`pdf-main-viewport flex-1 min-h-0 relative flex items-center justify-center p-8 overflow-hidden select-none ${
          activeTool === "pan" || activeTool === "crop"
            ? isPanning
              ? "cursor-grabbing"
              : "cursor-grab"
            : isPanning
            ? "cursor-grabbing"
            : "cursor-crosshair"
        }`}
      >
        {/* Render Single Page Mode (or Interactive Crop Focus) */}
        {(viewMode === "single" || activeTool === "crop") && activePage && (
          <div
            ref={pageElementRef}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              aspectRatio: activePage.width && activePage.height ? `${activePage.width} / ${activePage.height}` : undefined,
            }}
            className="relative shadow-2xl rounded bg-white border border-neutral-800 shrink-0 select-none"
          >
            {/* Split View Mode */}
            {activeTool === "split-view" ? (
              <div
                className="relative overflow-hidden"
                style={{
                  aspectRatio: activePage.width && activePage.height ? `${activePage.width} / ${activePage.height}` : undefined,
                }}
              >
                {/* Processed (Right Side) */}
                <img
                  src={displayedPageUrl}
                  alt="Processed Document"
                  className="max-h-[82vh] w-auto pointer-events-none object-contain"
                  style={{
                    aspectRatio: activePage.width && activePage.height ? `${activePage.width} / ${activePage.height}` : undefined,
                  }}
                />

                {/* Original (Left Side Clamped by splitPos) */}
                <div
                  style={{ width: `${splitPos * 100}%` }}
                  className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-amber-400 shadow-2xl"
                >
                  <img
                    src={resolvedOriginalUrl || activePage.originalDataUrl || activePage.thumbnailDataUrl}
                    alt="Original Document"
                    className="max-h-[82vh] w-auto max-w-none pointer-events-none object-contain"
                    style={{
                      aspectRatio: activePage.width && activePage.height ? `${activePage.width} / ${activePage.height}` : undefined,
                    }}
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
              <div
                className="relative"
                style={{
                  aspectRatio: activePage.width && activePage.height ? `${activePage.width} / ${activePage.height}` : undefined,
                }}
              >
                <img
                  src={displayedPageUrl}
                  alt={`Page ${activePageIndex + 1}`}
                  className="max-h-[82vh] w-auto pointer-events-none object-contain shadow-2xl"
                  style={{
                    aspectRatio: activePage.width && activePage.height ? `${activePage.width} / ${activePage.height}` : undefined,
                  }}
                />

                {/* Progressive high-res render badge */}
                {activePage.isPendingRender && (
                  <div className="absolute top-2 right-2 flex items-center space-x-1.5 bg-neutral-900/90 text-sky-400 border border-sky-500/40 rounded-full px-2.5 py-0.5 text-[11px] font-mono shadow-lg pointer-events-none backdrop-blur">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Rendering...</span>
                  </div>
                )}

                {/* Vector Annotations Layer */}
                {(activePage.annotations || []).map((ann) => {
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
                {(activePage.redactions || []).map((red) => (
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

                {/* PDF Page Interactive Crop / Perspective Warp Overlay */}
                {activeTool === "crop" && (
                  cropMode === "perspective" ? (
                    <PerspectiveWarpOverlay
                      page={activePage}
                      quad={perspectiveQuad}
                      onQuadChange={setPerspectiveQuad}
                      imageUrl={displayedPageUrl || resolvedActivePageUrl || activePage.processedDataUrl || activePage.originalDataUrl}
                      onCancel={handleCancelCrop}
                    />
                  ) : (
                    <PdfCropOverlay
                      page={activePage}
                      cropBox={cropBox}
                      unit={cropUnit}
                      aspectRatioLocked={cropAspectRatioLocked}
                      targetAspectRatio={cropTargetAspectRatio}
                      onCropBoxChange={setCropBox}
                    />
                  )
                )}

                {/* Perspective Edge Detection Floating HUD Indicator */}
                {activeTool === "crop" && cropMode === "perspective" && isDetectingPerspective && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-2 bg-neutral-900/95 text-sky-300 border border-sky-500/50 rounded-full px-3.5 py-1.5 shadow-2xl backdrop-blur-md animate-pulse pointer-events-none text-xs font-semibold">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                    <span>Detecting Document Boundaries...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Render Continuous Multi-Page Windowed Virtualized Vertical Scroll View */}
        {viewMode === "continuous" && activeTool !== "crop" && (
          <div
            ref={continuousScrollContainerRef}
            onScroll={handleContinuousScroll}
            className="absolute inset-0 overflow-y-auto overflow-x-auto custom-scrollbar flex flex-col items-center py-8 select-none"
            data-continuous-scroll="true"
          >
            {/* Dynamic Sized Inner Container representing full document height */}
            <div
              style={{
                width: `${continuousBaseWidth}px`,
                minHeight: `${continuousMetrics.totalHeight}px`,
                transform: pan.x ? `translateX(${pan.x}px)` : undefined,
              }}
              className="flex flex-col items-center relative"
            >
              {/* Top Spacer for unrendered pages above viewport */}
              {continuousTopSpacer > 0 && (
                <div
                  style={{ height: `${continuousTopSpacer}px`, width: "100%" }}
                  aria-hidden="true"
                  onClick={(e) => handleContinuousSpacerClick(e, true)}
                  className="cursor-pointer"
                  title="Click to jump to page"
                />
              )}

              {/* Rendered Windowed Pages with OVERSCAN buffer */}
              <div className="flex flex-col space-y-6 items-center w-full">
                {pages
                  .slice(continuousStartIndex, continuousEndIndex + 1)
                  .map((page, offset) => {
                    const idx = continuousStartIndex + offset;
                    const metric = continuousMetrics.items[idx];
                    const pageH = metric ? metric.height : getContinuousPageHeight(page);

                    return (
                      <div
                        key={page.id}
                        onClick={() => onSelectPage(idx)}
                        style={{
                          width: `${continuousBaseWidth}px`,
                          height: `${pageH}px`,
                        }}
                        className={`relative shadow-2xl rounded bg-neutral-900 border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                          idx === activePageIndex
                            ? "border-sky-500 ring-2 ring-sky-500/30"
                            : "border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        <img
                          src={page.processedDataUrl || page.thumbnailDataUrl}
                          alt={`Page ${idx + 1}`}
                          className="max-h-full max-w-full pointer-events-none object-contain rounded"
                          loading="lazy"
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 font-mono text-xs text-neutral-300 font-bold pointer-events-none">
                          Page {idx + 1}
                        </span>
                      </div>
                    );
                  })}
              </div>

              {/* Bottom Spacer for unrendered pages below viewport */}
              {continuousBottomSpacer > 0 && (
                <div
                  style={{ height: `${continuousBottomSpacer}px`, width: "100%" }}
                  aria-hidden="true"
                  onClick={(e) => handleContinuousSpacerClick(e, false)}
                  className="cursor-pointer"
                  title="Click to jump to page"
                />
              )}
            </div>
          </div>
        )}

        {/* Render Two-Page Book Spread */}
        {viewMode === "two-page" && (() => {
          const spreadStartIndex = Math.floor(activePageIndex / 2) * 2;
          const spreadPages = pages.slice(spreadStartIndex, spreadStartIndex + 2);
          const hasPrevSpread = spreadStartIndex > 0;
          const hasNextSpread = spreadStartIndex + 2 < pages.length;

          return (
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
              }}
              className="flex flex-col items-center space-y-4"
            >
              <div className="flex items-center space-x-4">
                {spreadPages.map((page, idx) => {
                  const actualIndex = spreadStartIndex + idx;
                  const isActive = actualIndex === activePageIndex;
                  return (
                    <div
                      key={page.id}
                      onClick={() => onSelectPage(actualIndex)}
                      className={`relative shadow-2xl rounded bg-neutral-900 border transition-all cursor-pointer ${
                        isActive ? "border-sky-500 ring-2 ring-sky-500/40" : "border-neutral-800 hover:border-neutral-700"
                      }`}
                    >
                      <img
                        src={page.processedDataUrl || page.thumbnailDataUrl}
                        alt={`Page ${actualIndex + 1}`}
                        className="max-h-[78vh] w-auto pointer-events-none object-contain"
                      />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 font-mono text-xs text-neutral-300 font-bold">
                        Page {actualIndex + 1}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Spread Navigator Controls if document has > 2 pages */}
              {pages.length > 2 && (
                <div className="flex items-center space-x-3 bg-neutral-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-neutral-800 shadow-xl pointer-events-auto">
                  <button
                    type="button"
                    disabled={!hasPrevSpread}
                    onClick={() => onSelectPage(Math.max(0, spreadStartIndex - 2))}
                    className="px-2.5 py-1 rounded text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-800 text-neutral-200 transition-colors"
                  >
                    ← Previous Spread
                  </button>
                  <span className="font-mono text-xs text-neutral-400">
                    Pages {spreadStartIndex + 1}–{Math.min(spreadStartIndex + 2, pages.length)} of {pages.length}
                  </span>
                  <button
                    type="button"
                    disabled={!hasNextSpread}
                    onClick={() => onSelectPage(Math.min(pages.length - 1, spreadStartIndex + 2))}
                    className="px-2.5 py-1 rounded text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-800 text-neutral-200 transition-colors"
                  >
                    Next Spread →
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Render Grid View */}
        {viewMode === "grid" && (
          <div
            ref={gridScrollContainerRef}
            style={{ scrollBehavior: "smooth" }}
            className="absolute inset-0 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col items-center p-6 select-none scroll-smooth"
            data-grid-scroll="true"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4 max-w-6xl w-full">
              {pages.map((page, idx) => (
                <div
                  key={page.id}
                  onClick={() => {
                    onSelectPage(idx);
                  }}
                  onDoubleClick={() => {
                    onSelectPage(idx);
                    if (onViewModeChange) {
                      onViewModeChange("single");
                    }
                    setPan({ x: 0, y: 0 });
                    if (viewportRef.current) {
                      viewportRef.current.scrollTop = 0;
                      viewportRef.current.scrollLeft = 0;
                    }
                  }}
                  title="Double-click to open in Single Page view"
                  className={`group relative flex flex-col rounded-lg border bg-neutral-900 p-2 cursor-pointer shadow-lg transition-all hover:scale-102 ${
                    idx === activePageIndex
                      ? "border-sky-500 ring-2 ring-sky-500/40"
                      : "border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  <div className="relative w-full aspect-[3/4] bg-neutral-950 rounded mb-2 overflow-hidden flex items-center justify-center">
                    <img
                      src={page.thumbnailDataUrl || page.processedDataUrl}
                      alt={`Grid ${idx + 1}`}
                      className="w-full h-full object-contain pointer-events-none select-none"
                    />

                    {/* Subtle hover hint for discoverability */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-neutral-900/95 border border-neutral-700/80 text-[11px] text-sky-300 font-medium shadow-lg pointer-events-none backdrop-blur-sm">
                      <Maximize2 className="w-3 h-3 text-sky-400" />
                      <span>Double-click to open</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-neutral-300 font-mono">
                    <span className="font-bold">Page {idx + 1}</span>
                    <span className="text-neutral-500 text-[10px]">{page.width}×{page.height}</span>
                  </div>
                </div>
              ))}
            </div>
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

      {/* Non-blocking Text Annotation Note Dialog */}
      {pendingTextAnnotation && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-2xl space-y-3">
            <h4 className="text-sm font-semibold text-neutral-200">Add Text Annotation Note</h4>
            <input
              type="text"
              autoFocus
              value={annotationNoteText}
              onChange={(e) => setAnnotationNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onAddAnnotation(activePageIndex, {
                    id: `ann-${Date.now()}`,
                    type: "text",
                    x: pendingTextAnnotation.x,
                    y: pendingTextAnnotation.y,
                    width: pendingTextAnnotation.width,
                    height: pendingTextAnnotation.height,
                    text: annotationNoteText.trim() || "Note",
                    strokeColor: "#10B981",
                    strokeWidth: 1,
                    opacity: 1.0,
                    fontSize: 14,
                    createdAt: new Date().toISOString(),
                  });
                  setPendingTextAnnotation(null);
                } else if (e.key === "Escape") {
                  setPendingTextAnnotation(null);
                }
              }}
              placeholder="Enter note text..."
              className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:border-emerald-500"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingTextAnnotation(null)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 bg-neutral-800 rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddAnnotation(activePageIndex, {
                    id: `ann-${Date.now()}`,
                    type: "text",
                    x: pendingTextAnnotation.x,
                    y: pendingTextAnnotation.y,
                    width: pendingTextAnnotation.width,
                    height: pendingTextAnnotation.height,
                    text: annotationNoteText.trim() || "Note",
                    strokeColor: "#10B981",
                    strokeWidth: 1,
                    opacity: 1.0,
                    fontSize: 14,
                    createdAt: new Date().toISOString(),
                  });
                  setPendingTextAnnotation(null);
                }}
                className="px-3 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-500 rounded-md font-medium shadow"
              >
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
