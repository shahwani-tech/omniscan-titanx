/**
 * OMNISCAN TITAN X - Dedicated ID Card & CNIC Print Studio Modal
 * Completely Isolated Workspace for Arranging ID-1 / CNIC / A6 / A5 / Custom Cards on A4 Paper.
 * 100% Offline, Zero Regression, Two-Page Side-by-Side Preview, PDF-like Mouse Wheel & Pan,
 * Independent Front/Back Crop Engine, High-Precision Physical DPI Layout & Two-Page PDF Export.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  X,
  Printer,
  FileDown,
  CreditCard,
  RotateCw,
  RotateCcw,
  ArrowLeftRight,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Scissors,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  ShieldCheck,
  FileText,
  Sliders,
  Grid,
  Lock,
  Unlock,
  Eye,
  Check,
  Image as ImageIcon,
  Copy,
  Crop,
  Move,
  Wand2,
  SlidersHorizontal,
  Sun,
  Contrast,
  Compass,
  Zap,
} from "lucide-react";
import { useShortcuts } from "../../commands/ShortcutContext";
import {
  IdCardStudioConfig,
  DEFAULT_ID_CARD_CONFIG,
  ID_CARD_PRESETS,
  ID_CARD_PAPER_SIZES,
  calculateIdCardLayout,
  renderIdCardSheetCanvas,
  exportIdCardSheetAsPDF,
  exportIdCardSheetAsBlob,
  printIdCardCanvases,
  convertIdCardUnit,
  createSampleIdCardSvg,
  IdCardUnit,
  FrontBackLayoutMode,
  PairArrangement,
} from "../../engine/idCardLayout";
import { BUILTIN_CAMSCANNER_PRESETS, executeFilterPipeline } from "../../engine/filters";
import { DEFAULT_FILTERS } from "../../engine/vision";
import { ImageFilterPipeline, OmniPage } from "../../types";
import { IdCardCropModal, IdCardCropState } from "./IdCardCropModal";
import { IdCardFilterNumericInput } from "./IdCardFilterNumericInput";
import { usePrint } from "../../context/PrintContext";
import { classifyImageContent, ContentClassificationResult } from "../../engine/autoClassifier";
import * as pdfjsLib from "pdfjs-dist";
import { renderPDFPageThumbnail, renderPDFPageToDataUrl } from "../../engine/pdf";
import { A6HalfCardStudioModal } from "../a6card/A6HalfCardStudioModal";
import {
  PdfImportDialog,
  ACCEPTED_DOCUMENT_AND_IMAGE_TYPES,
  PdfImportPageResult,
} from "../common/PdfImportDialog";

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
};

interface IdCardPrintStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages?: OmniPage[];
  activePageIndex?: number;
  initialMode?: "idcard" | "a6";
  onInsertIntoDocument?: (newPageDataUrls: string[]) => void;
}

export const IdCardPrintStudioModal: React.FC<IdCardPrintStudioModalProps> = ({
  isOpen,
  onClose,
  pages = [],
  activePageIndex = 0,
  initialMode = "idcard",
  onInsertIntoDocument,
}) => {
  const { openPrintDialog } = usePrint();

  // Studio Layout Mode: 'idcard' (Multi-Card on A4/Letter) | 'a6' (Dedicated A6 Half-Card Sheet Layout Studio)
  const [studioLayoutMode, setStudioLayoutMode] = useState<"idcard" | "a6">(initialMode);

  useEffect(() => {
    if (isOpen && initialMode) {
      setStudioLayoutMode(initialMode);
    }
  }, [isOpen, initialMode]);

  // -------------------------------------------------------------
  // Configuration State (Completely Isolated from Main App)
  // -------------------------------------------------------------
  const [config, setConfig] = useState<IdCardStudioConfig>({
    ...DEFAULT_ID_CARD_CONFIG,
    frontBackMode: "separate-pages",
  });

  // Preview Layout Mode: 'side-by-side' (Both A4 sheets) | 'page-1' (Fronts only) | 'page-2' (Backs only) | 'summary'
  const [previewMode, setPreviewMode] = useState<"side-by-side" | "page-1" | "page-2" | "summary">("side-by-side");
  const currentModeRef = useRef<"side-by-side" | "page-1" | "page-2" | "summary">("side-by-side");

  // Per-View High-Precision Zoom & Pan (Retains independent zoom and pan for Both Pages, Front, and Back)
  type SheetViewMode = "side-by-side" | "page-1" | "page-2";
  interface ViewportState {
    zoom: number;
    pan: { x: number; y: number };
  }
  const viewportsRef = useRef<Record<SheetViewMode, ViewportState>>({
    "side-by-side": { zoom: 0.65, pan: { x: 0, y: 0 } },
    "page-1": { zoom: 0.85, pan: { x: 0, y: 0 } },
    "page-2": { zoom: 0.85, pan: { x: 0, y: 0 } },
  });

  const [zoom, setZoom] = useState<number>(0.65);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const updateZoomPan = useCallback((newZoom: number, newPan: { x: number; y: number }) => {
    setZoom(newZoom);
    setPan(newPan);
    zoomRef.current = newZoom;
    panRef.current = newPan;
    const mode = currentModeRef.current;
    if (mode !== "summary") {
      viewportsRef.current[mode] = { zoom: newZoom, pan: newPan };
    }
  }, []);

  // Panning State
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; initialPan: { x: number; y: number } }>({
    clientX: 0,
    clientY: 0,
    initialPan: { x: 0, y: 0 },
  });

  // Source, Base (Cropped), and Final Filtered Images for Front and Back
  const [originalFrontImage, setOriginalFrontImage] = useState<string>(() => {
    return pages[activePageIndex]?.processedDataUrl || createSampleIdCardSvg("front");
  });
  const [frontBaseImage, setFrontBaseImage] = useState<string>(() => {
    return pages[activePageIndex]?.processedDataUrl || createSampleIdCardSvg("front");
  });
  const [frontImage, setFrontImage] = useState<string>(() => {
    return pages[activePageIndex]?.processedDataUrl || createSampleIdCardSvg("front");
  });

  const [originalBackImage, setOriginalBackImage] = useState<string>(() => {
    return pages[activePageIndex + 1]?.processedDataUrl || createSampleIdCardSvg("back");
  });
  const [backBaseImage, setBackBaseImage] = useState<string>(() => {
    return pages[activePageIndex + 1]?.processedDataUrl || createSampleIdCardSvg("back");
  });
  const [backImage, setBackImage] = useState<string>(() => {
    return pages[activePageIndex + 1]?.processedDataUrl || createSampleIdCardSvg("back");
  });

  // Independent Crop State Persistence for Front and Back
  const [frontCropState, setFrontCropState] = useState<IdCardCropState | null>(null);
  const [backCropState, setBackCropState] = useState<IdCardCropState | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState<boolean>(false);
  const [cropTargetSide, setCropTargetSide] = useState<"front" | "back">("front");

  // Non-destructive Filter Pipeline States
  const [frontFilters, setFrontFilters] = useState<ImageFilterPipeline>({ ...DEFAULT_FILTERS });
  const [backFilters, setBackFilters] = useState<ImageFilterPipeline>({ ...DEFAULT_FILTERS });
  const [frontDetectedContent, setFrontDetectedContent] = useState<ContentClassificationResult | null>(null);
  const [backDetectedContent, setBackDetectedContent] = useState<ContentClassificationResult | null>(null);
  const [frontFilterSource, setFrontFilterSource] = useState<"auto-detected" | "user-override">("auto-detected");
  const [backFilterSource, setBackFilterSource] = useState<"auto-detected" | "user-override">("auto-detected");
  const [applyToScope, setApplyToScope] = useState<"current" | "both" | "all">("current");
  const [activeFilterSide, setActiveFilterSide] = useState<"front" | "back">("front");

  // Export / Print Status
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // PDF Page Picker Modal State
  const [isPdfImportDialogOpen, setIsPdfImportDialogOpen] = useState<boolean>(false);
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [pdfTargetSide, setPdfTargetSide] = useState<"front" | "back">("front");

  // Canvas References: Page 1 (Front) & Page 2 (Back)
  const page1CanvasRef = useRef<HTMLCanvasElement>(null);
  const page2CanvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // File Input References
  const frontFileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------
  // High-Performance Filter Execution Pipeline (Zero-Lag & Non-Destructive)
  // -------------------------------------------------------------
  const fullResFrontImageRef = useRef<string>(frontImage);
  const fullResBackImageRef = useRef<string>(backImage);
  const frontBaseImageRef = useRef<string>(frontBaseImage);
  const backBaseImageRef = useRef<string>(backBaseImage);
  const frontImageRef = useRef<string>(frontImage);
  const backImageRef = useRef<string>(backImage);
  const frontFiltersRef = useRef<ImageFilterPipeline>(frontFilters);
  const backFiltersRef = useRef<ImageFilterPipeline>(backFilters);
  const applyToScopeRef = useRef<"current" | "both" | "all">(applyToScope);
  const activeFilterSideRef = useRef<"front" | "back">(activeFilterSide);
  const configRef = useRef<IdCardStudioConfig>(config);

  const frontDecodedImgRef = useRef<HTMLImageElement | null>(null);
  const backDecodedImgRef = useRef<HTMLImageElement | null>(null);
  const frontBaseImageDecodedForRef = useRef<string | null>(null);
  const backBaseImageDecodedForRef = useRef<string | null>(null);

  const frontFilteredCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backFilteredCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const rafHandleRef = useRef<number | null>(null);
  const isFilterProcessingRef = useRef<boolean>(false);
  const pendingFilterRunRef = useRef<{ fast: boolean; targetSide?: "front" | "back" | "both" } | null>(null);
  const isDraggingSliderRef = useRef<boolean>(false);
  const sliderSettleTimerRef = useRef<number | null>(null);

  // PDF Document & streaming reference
  const currentPdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const currentPdfObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (currentPdfObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(currentPdfObjectUrlRef.current);
        } catch {}
      }
    };
  }, []);

  // Sync synchronization refs
  useEffect(() => {
    frontImageRef.current = frontImage;
  }, [frontImage]);
  useEffect(() => {
    backImageRef.current = backImage;
  }, [backImage]);
  useEffect(() => {
    frontFiltersRef.current = frontFilters;
  }, [frontFilters]);
  useEffect(() => {
    backFiltersRef.current = backFilters;
  }, [backFilters]);
  useEffect(() => {
    applyToScopeRef.current = applyToScope;
  }, [applyToScope]);
  useEffect(() => {
    activeFilterSideRef.current = activeFilterSide;
  }, [activeFilterSide]);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const endSliderInteraction = () => {
    if (sliderSettleTimerRef.current) {
      clearTimeout(sliderSettleTimerRef.current);
      sliderSettleTimerRef.current = null;
    }
    isDraggingSliderRef.current = false;
    executeFilterPipelineScheduled(false);
  };

  const markSliderInteraction = () => {
    isDraggingSliderRef.current = true;
  };

  const executeFilterPipelineScheduled = useCallback((fast: boolean, explicitSide?: "front" | "back" | "both") => {
    const scope = applyToScopeRef.current;
    const activeSide = activeFilterSideRef.current;
    const targetSide = explicitSide || (scope === "both" || scope === "all" ? "both" : activeSide);

    if (rafHandleRef.current) {
      pendingFilterRunRef.current = {
        fast,
        targetSide: pendingFilterRunRef.current?.targetSide === "both" || targetSide === "both" ? "both" : targetSide,
      };
      return;
    }

    rafHandleRef.current = requestAnimationFrame(async () => {
      rafHandleRef.current = null;
      await runFilterPass(fast, targetSide);

      if (pendingFilterRunRef.current) {
        const next = pendingFilterRunRef.current;
        pendingFilterRunRef.current = null;
        executeFilterPipelineScheduled(next.fast, next.targetSide);
      }
    });
  }, []);

  const runFilterPass = async (fast: boolean, targetSide: "front" | "back" | "both") => {
    if (isFilterProcessingRef.current) {
      pendingFilterRunRef.current = {
        fast,
        targetSide: pendingFilterRunRef.current?.targetSide === "both" || targetSide === "both" ? "both" : targetSide,
      };
      return;
    }
    isFilterProcessingRef.current = true;

    try {
      const needFront = targetSide === "front" || targetSide === "both";
      const needBack = targetSide === "back" || targetSide === "both";

      // 1. FRONT SIDE FILTER PASS
      if (needFront && frontBaseImageRef.current) {
        if (!frontDecodedImgRef.current || frontBaseImageDecodedForRef.current !== frontBaseImageRef.current) {
          frontDecodedImgRef.current = await loadImage(frontBaseImageRef.current);
          frontBaseImageDecodedForRef.current = frontBaseImageRef.current;
        }

        const fRes = await executeFilterPipeline(
          frontBaseImageRef.current,
          frontFiltersRef.current,
          {
            sourceImage: frontDecodedImgRef.current,
            isFastPreview: fast,
            previewScale: fast ? 0.45 : 1.0,
            maxDimension: fast ? 600 : 1200,
          }
        );

        if (fRes.processedCanvas) {
          frontFilteredCanvasRef.current = fRes.processedCanvas;
        }
        if (fRes.processedDataUrl) {
          setFrontImage(fRes.processedDataUrl);
          if (!fast) fullResFrontImageRef.current = fRes.processedDataUrl;
        }

        if (page1CanvasRef.current) {
          const rendered1 = await renderIdCardSheetCanvas(
            configRef.current,
            frontFilteredCanvasRef.current || fRes.processedDataUrl,
            backFilteredCanvasRef.current || backImageRef.current,
            {
              targetDpi: 150,
              pageIndex: 0,
              destinationCanvas: page1CanvasRef.current,
            }
          );
          renderedPage1Cache.current = rendered1;
        }
      }

      // 2. BACK SIDE FILTER PASS
      if (needBack && backBaseImageRef.current) {
        if (!backDecodedImgRef.current || backBaseImageDecodedForRef.current !== backBaseImageRef.current) {
          backDecodedImgRef.current = await loadImage(backBaseImageRef.current);
          backBaseImageDecodedForRef.current = backBaseImageRef.current;
        }

        const bRes = await executeFilterPipeline(
          backBaseImageRef.current,
          backFiltersRef.current,
          {
            sourceImage: backDecodedImgRef.current,
            isFastPreview: fast,
            previewScale: fast ? 0.45 : 1.0,
            maxDimension: fast ? 600 : 1200,
          }
        );

        if (bRes.processedCanvas) {
          backFilteredCanvasRef.current = bRes.processedCanvas;
        }
        if (bRes.processedDataUrl) {
          setBackImage(bRes.processedDataUrl);
          if (!fast) fullResBackImageRef.current = bRes.processedDataUrl;
        }

        if (page2CanvasRef.current) {
          const rendered2 = await renderIdCardSheetCanvas(
            configRef.current,
            frontFilteredCanvasRef.current || frontImageRef.current,
            backFilteredCanvasRef.current || bRes.processedDataUrl,
            {
              targetDpi: 150,
              pageIndex: 1,
              destinationCanvas: page2CanvasRef.current,
            }
          );
          renderedPage2Cache.current = rendered2;
        }
      }
    } catch (err) {
      console.warn("Could not execute scheduled filter pipeline:", err);
    } finally {
      isFilterProcessingRef.current = false;
    }
  };

  // Base image loading and filtering
  useEffect(() => {
    if (!isOpen) return;
    frontBaseImageRef.current = frontBaseImage;
    loadImage(frontBaseImage).then((img) => {
      frontDecodedImgRef.current = img;
      frontBaseImageDecodedForRef.current = frontBaseImage;
      executeFilterPipelineScheduled(false, "front");
    }).catch((err) => {
      console.warn("Error decoding front image:", err);
    });
  }, [frontBaseImage, executeFilterPipelineScheduled]);

  useEffect(() => {
    if (!isOpen) return;
    backBaseImageRef.current = backBaseImage;
    loadImage(backBaseImage).then((img) => {
      backDecodedImgRef.current = img;
      backBaseImageDecodedForRef.current = backBaseImage;
      executeFilterPipelineScheduled(false, "back");
    }).catch((err) => {
      console.warn("Error decoding back image:", err);
    });
  }, [backBaseImage, executeFilterPipelineScheduled]);

  // -------------------------------------------------------------
  // Layout Calculation (Memoized)
  // -------------------------------------------------------------
  const layout = useMemo(() => {
    return calculateIdCardLayout(config);
  }, [config]);

  // Derived counts
  const frontCopiesCount = useMemo(() => {
    return layout.positions.filter((p) => p.pageIndex === 0).length;
  }, [layout]);

  const backCopiesCount = useMemo(() => {
    return layout.positions.filter((p) => p.pageIndex === 1).length;
  }, [layout]);

  // Dimension calculations for zero-layout-shift preview canvases
  const rawPaperW = config.paperWidthMm;
  const rawPaperH = config.paperHeightMm;
  const paperWMm = config.orientation === "landscape" ? Math.max(rawPaperW, rawPaperH) : Math.min(rawPaperW, rawPaperH);
  const paperHMm = config.orientation === "landscape" ? Math.min(rawPaperW, rawPaperH) : Math.max(rawPaperW, rawPaperH);

  const PREVIEW_DPI = 150;
  const paperDisplayWidth = Math.round((paperWMm / 25.4) * PREVIEW_DPI);
  const paperDisplayHeight = Math.round((paperHMm / 25.4) * PREVIEW_DPI);

  // -------------------------------------------------------------
  // Live Canvases Rendering for Page 1 & Page 2 with Memory Cache
  // -------------------------------------------------------------
  const renderedPage1Cache = useRef<HTMLCanvasElement | null>(null);
  const renderedPage2Cache = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    async function renderPreviewCanvases() {
      try {
        const targetDpi = 150;
        const frontSrc = frontFilteredCanvasRef.current || frontImageRef.current;
        const backSrc = backFilteredCanvasRef.current || backImageRef.current;

        if (page1CanvasRef.current) {
          const rendered1 = await renderIdCardSheetCanvas(config, frontSrc, backSrc, {
            targetDpi,
            pageIndex: 0,
            destinationCanvas: page1CanvasRef.current,
          });
          if (isCancelled) return;
          renderedPage1Cache.current = rendered1;
        }

        if (page2CanvasRef.current) {
          const rendered2 = await renderIdCardSheetCanvas(config, frontSrc, backSrc, {
            targetDpi,
            pageIndex: 1,
            destinationCanvas: page2CanvasRef.current,
          });
          if (isCancelled) return;
          renderedPage2Cache.current = rendered2;
        }
      } catch (err) {
        console.warn("Could not render ID card preview canvases:", err);
      }
    }

    renderPreviewCanvases();

    return () => {
      isCancelled = true;
    };
  }, [config]);

  // View Switcher with Persistent Viewport State & Canvas Pixel Protection
  const handleSwitchTab = (newMode: "side-by-side" | "page-1" | "page-2" | "summary") => {
    const prevMode = currentModeRef.current;
    if (prevMode === newMode) return;

    // 1. Save previous view mode's zoom & pan if it was a sheet view
    if (prevMode !== "summary") {
      viewportsRef.current[prevMode] = { zoom: zoomRef.current, pan: { ...panRef.current } };
    }

    // 2. Restore target view mode's zoom & pan if it is a sheet view
    if (newMode !== "summary") {
      const saved = viewportsRef.current[newMode];
      setZoom(saved.zoom);
      setPan({ ...saved.pan });
      zoomRef.current = saved.zoom;
      panRef.current = { ...saved.pan };
    }

    // 3. Keep sidebar filter active side in sync
    if (newMode === "page-1") {
      setActiveFilterSide("front");
    } else if (newMode === "page-2") {
      setActiveFilterSide("back");
    }

    currentModeRef.current = newMode;
    setPreviewMode(newMode);

    // 4. Ensure canvas buffers are healthy and restored immediately
    requestAnimationFrame(() => {
      if (page1CanvasRef.current && renderedPage1Cache.current) {
        if (page1CanvasRef.current.width === 0 || page1CanvasRef.current.height === 0) {
          page1CanvasRef.current.width = renderedPage1Cache.current.width;
          page1CanvasRef.current.height = renderedPage1Cache.current.height;
          page1CanvasRef.current.getContext("2d")?.drawImage(renderedPage1Cache.current, 0, 0);
        }
      }
      if (page2CanvasRef.current && renderedPage2Cache.current) {
        if (page2CanvasRef.current.width === 0 || page2CanvasRef.current.height === 0) {
          page2CanvasRef.current.width = renderedPage2Cache.current.width;
          page2CanvasRef.current.height = renderedPage2Cache.current.height;
          page2CanvasRef.current.getContext("2d")?.drawImage(renderedPage2Cache.current, 0, 0);
        }
      }
    });
  };

  // -------------------------------------------------------------
  // PDF-like Mouse Wheel Routing & Center-Based Zoom
  // -------------------------------------------------------------
  const isPointerOverScrollbar = (
    element: HTMLElement,
    clientX: number,
    clientY: number,
    target?: EventTarget | null
  ): boolean => {
    const rect = element.getBoundingClientRect();

    // Check vertical scrollbar (right side of element)
    const isScrollableY = element.scrollHeight > element.clientHeight;
    const vGutter = element.offsetWidth - element.clientWidth - element.clientLeft;
    const isDirectViewportTarget = !target || target === element;
    const vScrollbarWidth = isScrollableY ? (vGutter > 0 ? vGutter : (isDirectViewportTarget ? 14 : 0)) : 0;
    if (isScrollableY && vScrollbarWidth > 0) {
      const vScrollbarLeft = rect.right - vScrollbarWidth;
      if (clientX >= vScrollbarLeft && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return true;
      }
    }

    // Check horizontal scrollbar (bottom side of element)
    const isScrollableX = element.scrollWidth > element.clientWidth;
    const hGutter = element.offsetHeight - element.clientHeight - element.clientTop;
    const hScrollbarHeight = isScrollableX ? (hGutter > 0 ? hGutter : (isDirectViewportTarget ? 14 : 0)) : 0;
    if (isScrollableX && hScrollbarHeight > 0) {
      const hScrollbarTop = rect.bottom - hScrollbarHeight;
      if (clientY >= hScrollbarTop && clientY <= rect.bottom && clientX >= rect.left && clientX <= rect.right) {
        return true;
      }
    }

    return false;
  };

  const isInsideScrollableChild = (target: EventTarget | null, viewport: HTMLElement): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;

    // Interactive form elements, buttons, inputs, sliders, dropdowns, or sidebar
    if (target.closest("button, input, select, textarea, [data-interactive], aside")) {
      return true;
    }

    // Traverse ancestors strictly between target and viewport (excluding viewport itself!)
    let current: HTMLElement | null = target;
    while (current && current !== viewport && current !== document.body) {
      if (current !== viewport) {
        const style = window.getComputedStyle(current);
        const hasScrollY = (style.overflowY === "auto" || style.overflowY === "scroll") && current.scrollHeight > current.clientHeight;
        const hasScrollX = (style.overflowX === "auto" || style.overflowX === "scroll") && current.scrollWidth > current.clientWidth;
        if (hasScrollY || hasScrollX) {
          return true;
        }
      }
      current = current.parentElement;
    }

    return false;
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // Allow normal vertical scrolling when in Inspection mode
      if (currentModeRef.current === "summary") return;

      // 1. If pointer is over viewport scrollbar, allow native scrolling (no zoom, no preventDefault)
      if (isPointerOverScrollbar(viewport, e.clientX, e.clientY, e.target)) return;

      // 2. If pointer is over scrollable child container or toolbar, allow native scrolling
      if (isInsideScrollableChild(e.target, viewport)) return;

      // 3. Pointer is over canvas viewport: execute center-based wheel zoom
      e.preventDefault();
      e.stopPropagation();

      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;

      const zoomStep = 1.12;
      const factor = e.deltaY < 0 ? zoomStep : 1 / zoomStep;
      const newZoom = Math.max(0.25, Math.min(4.0, Number((currentZoom * factor).toFixed(3))));

      if (newZoom === currentZoom) return;

      // Center-based zoom: zoom scales strictly centered around the center of the visible document preview
      const zoomRatio = newZoom / currentZoom;
      const newPan = {
        x: Math.round(currentPan.x * zoomRatio),
        y: Math.round(currentPan.y * zoomRatio),
      };

      updateZoomPan(newZoom, newPan);
    };

    viewport.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleNativeWheel);
    };
  }, [updateZoomPan]);

  // -------------------------------------------------------------
  // Pan Interaction Handlers
  // -------------------------------------------------------------
  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only pan if left click and not clicking interactive controls
    if (e.button !== 0 || currentModeRef.current === "summary") return;
    const target = e.target as HTMLElement;
    if (target.closest("button, input, select, textarea, [data-interactive]")) return;
    if (isPointerOverScrollbar(e.currentTarget, e.clientX, e.clientY, e.target)) return;

    setIsPanning(true);
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialPan: { ...pan },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || currentModeRef.current === "summary") return;
    const dx = e.clientX - panStartRef.current.clientX;
    const dy = e.clientY - panStartRef.current.clientY;
    const newPan = {
      x: panStartRef.current.initialPan.x + dx,
      y: panStartRef.current.initialPan.y + dy,
    };
    setPan(newPan);
    panRef.current = newPan;
    const mode = currentModeRef.current;
    if (mode !== "summary") {
      viewportsRef.current[mode].pan = newPan;
    }
  };

  const handleViewportPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // Reset Zoom & Pan
  const handleFitPages = () => {
    const mode = currentModeRef.current;
    const fitZoom = mode === "side-by-side" ? 0.65 : 0.85;
    updateZoomPan(fitZoom, { x: 0, y: 0 });
  };

  const handleActualSize = () => {
    updateZoomPan(1.0, { x: 0, y: 0 });
  };

  // -------------------------------------------------------------
  // Preset & Sizing Handlers
  // -------------------------------------------------------------
  const handleSelectPreset = (presetId: string) => {
    const preset = ID_CARD_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    // Dynamically calculate optimal grid layout for the selected document preset on current paper
    const testConfig: IdCardStudioConfig = {
      ...config,
      presetId,
      docWidthMm: preset.widthMm,
      docHeightMm: preset.heightMm,
      copyCountMode: "auto",
    };
    const autoLayout = calculateIdCardLayout(testConfig);
    const manualCols = autoLayout.columns > 0 ? autoLayout.columns : 1;
    const manualRows = autoLayout.rows > 0 ? autoLayout.rows : 1;
    const manualCopies = manualCols * manualRows;

    setConfig((prev) => ({
      ...prev,
      presetId,
      docWidthMm: preset.widthMm,
      docHeightMm: preset.heightMm,
      manualColumns: manualCols,
      manualRows: manualRows,
      manualTotalCopies: manualCopies,
    }));
  };

  const handleSelectPaper = (paperId: string) => {
    const paper = ID_CARD_PAPER_SIZES.find((p) => p.id === paperId);
    if (!paper) return;
    setConfig((prev) => ({
      ...prev,
      paperSizeId: paperId,
      paperWidthMm: paper.widthMm,
      paperHeightMm: paper.heightMm,
    }));
  };

  const handleSwapSides = () => {
    const tempOrig = originalFrontImage;
    const tempBase = frontBaseImage;
    const tempFilters = frontFilters;
    const tempCrop = frontCropState;
    const tempRot = config.frontRotation;

    setOriginalFrontImage(originalBackImage);
    setFrontBaseImage(backBaseImage);
    setFrontFilters(backFilters);
    setFrontCropState(backCropState);

    setOriginalBackImage(tempOrig);
    setBackBaseImage(tempBase);
    setBackFilters(tempFilters);
    setBackCropState(tempCrop);

    setConfig((prev) => ({
      ...prev,
      frontRotation: prev.backRotation,
      backRotation: tempRot,
    }));

    // Swap viewports between page-1 and page-2
    const tempVp = { ...viewportsRef.current["page-1"] };
    viewportsRef.current["page-1"] = { ...viewportsRef.current["page-2"] };
    viewportsRef.current["page-2"] = tempVp;
    if (currentModeRef.current === "page-1") {
      updateZoomPan(viewportsRef.current["page-1"].zoom, viewportsRef.current["page-1"].pan);
    } else if (currentModeRef.current === "page-2") {
      updateZoomPan(viewportsRef.current["page-2"].zoom, viewportsRef.current["page-2"].pan);
    }
  };

  const handleRotateSide = (side: "front" | "back", degDelta: number) => {
    setConfig((prev) => {
      if (side === "front") {
        return { ...prev, frontRotation: (prev.frontRotation + degDelta + 360) % 360 };
      } else {
        return { ...prev, backRotation: (prev.backRotation + degDelta + 360) % 360 };
      }
    });
  };

  // -------------------------------------------------------------
  // Independent Crop Dialog Handlers
  // -------------------------------------------------------------
  const handleOpenCrop = (side: "front" | "back") => {
    setCropTargetSide(side);
    setCropModalOpen(true);
  };

  const handleApplyCroppedImage = (croppedDataUrl: string, finalState?: IdCardCropState) => {
    if (cropTargetSide === "front") {
      setFrontBaseImage(croppedDataUrl);
      if (finalState) setFrontCropState(finalState);
      classifyImageContent(croppedDataUrl)
        .then((res) => {
          setFrontDetectedContent(res);
          setFrontFilterSource("auto-detected");
          setFrontFilters((prev) => ({ ...prev, ...res.recommendedFilters }));
          frontFiltersRef.current = { ...frontFiltersRef.current, ...res.recommendedFilters };
          executeFilterPipelineScheduled(false, "front");
        })
        .catch((err) => console.warn("Front card crop classify failed:", err));
    } else {
      setBackBaseImage(croppedDataUrl);
      if (finalState) setBackCropState(finalState);
      classifyImageContent(croppedDataUrl)
        .then((res) => {
          setBackDetectedContent(res);
          setBackFilterSource("auto-detected");
          setBackFilters((prev) => ({ ...prev, ...res.recommendedFilters }));
          backFiltersRef.current = { ...backFiltersRef.current, ...res.recommendedFilters };
          executeFilterPipelineScheduled(false, "back");
        })
        .catch((err) => console.warn("Back card crop classify failed:", err));
    }
  };

  // -------------------------------------------------------------
  // Non-Destructive Filter & Adjustments Handlers
  // -------------------------------------------------------------
  const currentFilters = activeFilterSide === "front" ? frontFilters : backFilters;
  const currentDetectedContent = activeFilterSide === "front" ? frontDetectedContent : backDetectedContent;
  const currentFilterSource = activeFilterSide === "front" ? frontFilterSource : backFilterSource;

  const handleApplyActiveSettingsToBothSides = () => {
    const sourceFilters = activeFilterSide === "front" ? frontFilters : backFilters;
    const targetSide = activeFilterSide === "front" ? "back" : "front";

    // Copy tone settings while preserving each side's rotation and geometry
    const { cropBox, perspectivePoints, rotation, deskewAngle, ...toneSettings } = sourceFilters;

    if (targetSide === "back") {
      setBackFilters((prev) => ({ ...prev, ...toneSettings }));
      backFiltersRef.current = { ...backFiltersRef.current, ...toneSettings };
      setBackFilterSource("user-override");
      executeFilterPipelineScheduled(false, "back");
      setStatusMessage("Applied Front settings to Back card.");
    } else {
      setFrontFilters((prev) => ({ ...prev, ...toneSettings }));
      frontFiltersRef.current = { ...frontFiltersRef.current, ...toneSettings };
      setFrontFilterSource("user-override");
      executeFilterPipelineScheduled(false, "front");
      setStatusMessage("Applied Back settings to Front card.");
    }
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleReDetectActiveSide = async () => {
    const targetImg = activeFilterSide === "front" ? frontBaseImage : backBaseImage;
    if (!targetImg) return;

    setStatusMessage(`Running CamScanner optical detection on ${activeFilterSide === "front" ? "Front" : "Back"}...`);
    try {
      const res = await classifyImageContent(targetImg);
      if (activeFilterSide === "front") {
        setFrontDetectedContent(res);
        setFrontFilterSource("auto-detected");
        setFrontFilters((prev) => ({
          ...prev,
          ...res.recommendedFilters,
        }));
        frontFiltersRef.current = {
          ...frontFiltersRef.current,
          ...res.recommendedFilters,
        };
        executeFilterPipelineScheduled(false, "front");
      } else {
        setBackDetectedContent(res);
        setBackFilterSource("auto-detected");
        setBackFilters((prev) => ({
          ...prev,
          ...res.recommendedFilters,
        }));
        backFiltersRef.current = {
          ...backFiltersRef.current,
          ...res.recommendedFilters,
        };
        executeFilterPipelineScheduled(false, "back");
      }
      setStatusMessage(`Auto-detected: ${res.label} (${res.recommendedPreset.toUpperCase()})`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.warn("Re-detect failed:", err);
    }
  };

  const handleApplyPreset = (presetId: string) => {
    const meta = BUILTIN_CAMSCANNER_PRESETS.find((p) => p.id === presetId);
    const targetUpdates = meta?.filters || { preset: presetId };

    const updateFilter = (prev: ImageFilterPipeline): ImageFilterPipeline => ({
      ...prev,
      ...targetUpdates,
      preset: presetId as any,
      rotation: prev.rotation,
      deskewAngle: prev.deskewAngle,
    });

    const targetSide = applyToScope === "both" || applyToScope === "all" ? "both" : activeFilterSide;
    if (targetSide === "both") {
      setFrontFilters(updateFilter);
      setBackFilters(updateFilter);
      frontFiltersRef.current = updateFilter(frontFiltersRef.current);
      backFiltersRef.current = updateFilter(backFiltersRef.current);
      setFrontFilterSource("user-override");
      setBackFilterSource("user-override");
    } else if (targetSide === "front") {
      setFrontFilters(updateFilter);
      frontFiltersRef.current = updateFilter(frontFiltersRef.current);
      setFrontFilterSource("user-override");
    } else {
      setBackFilters(updateFilter);
      backFiltersRef.current = updateFilter(backFiltersRef.current);
      setBackFilterSource("user-override");
    }

    executeFilterPipelineScheduled(false, targetSide);
  };

  const handleFilterParamChange = (key: keyof ImageFilterPipeline, val: any, isFast = true) => {
    isDraggingSliderRef.current = isFast;

    if (sliderSettleTimerRef.current) {
      clearTimeout(sliderSettleTimerRef.current);
      sliderSettleTimerRef.current = null;
    }

    const targetSide = applyToScope === "both" || applyToScope === "all" ? "both" : activeFilterSide;

    if (isFast) {
      sliderSettleTimerRef.current = window.setTimeout(() => {
        isDraggingSliderRef.current = false;
        executeFilterPipelineScheduled(false, targetSide);
      }, 160);
    } else {
      isDraggingSliderRef.current = false;
    }

    const updateFilter = (prev: ImageFilterPipeline): ImageFilterPipeline => ({
      ...prev,
      preset: "custom",
      [key]: val,
    });

    if (targetSide === "both") {
      setFrontFilters(updateFilter);
      setBackFilters(updateFilter);
      frontFiltersRef.current = updateFilter(frontFiltersRef.current);
      backFiltersRef.current = updateFilter(backFiltersRef.current);
      setFrontFilterSource("user-override");
      setBackFilterSource("user-override");
      executeFilterPipelineScheduled(isFast, "both");
    } else if (targetSide === "front") {
      setFrontFilters(updateFilter);
      frontFiltersRef.current = updateFilter(frontFiltersRef.current);
      setFrontFilterSource("user-override");
      executeFilterPipelineScheduled(isFast, "front");
    } else {
      setBackFilters(updateFilter);
      backFiltersRef.current = updateFilter(backFiltersRef.current);
      setBackFilterSource("user-override");
      executeFilterPipelineScheduled(isFast, "back");
    }
  };

  const handleResetFilters = () => {
    const targetSide = applyToScope === "both" || applyToScope === "all" ? "both" : activeFilterSide;
    if (targetSide === "both") {
      setFrontFilters({ ...DEFAULT_FILTERS });
      setBackFilters({ ...DEFAULT_FILTERS });
      frontFiltersRef.current = { ...DEFAULT_FILTERS };
      backFiltersRef.current = { ...DEFAULT_FILTERS };
    } else if (targetSide === "front") {
      setFrontFilters({ ...DEFAULT_FILTERS });
      frontFiltersRef.current = { ...DEFAULT_FILTERS };
    } else {
      setBackFilters({ ...DEFAULT_FILTERS });
      backFiltersRef.current = { ...DEFAULT_FILTERS };
    }

    executeFilterPipelineScheduled(false, targetSide);
  };

  const handleResetSpecimen = () => {
    const sFront = createSampleIdCardSvg("front");
    const sBack = createSampleIdCardSvg("back");
    setOriginalFrontImage(sFront);
    setFrontBaseImage(sFront);
    setFrontCropState(null);
    setFrontImage(sFront);
    fullResFrontImageRef.current = sFront;

    setOriginalBackImage(sBack);
    setBackBaseImage(sBack);
    setBackCropState(null);
    setBackImage(sBack);
    fullResBackImageRef.current = sBack;

    setFrontFilters({ ...DEFAULT_FILTERS });
    setBackFilters({ ...DEFAULT_FILTERS });
    frontFiltersRef.current = { ...DEFAULT_FILTERS };
    backFiltersRef.current = { ...DEFAULT_FILTERS };
    setConfig((prev) => ({ ...prev, frontRotation: 0, backRotation: 0 }));

    executeFilterPipelineScheduled(false, "both");
  };

  // -------------------------------------------------------------
  // File Upload Handlers (Independent Front & Back)
  // -------------------------------------------------------------
  const handleOpenPdfDialog = (file?: File | null, side: "front" | "back" = "front") => {
    setPdfTargetSide(side);
    setSelectedPdfFile(file || null);
    setIsPdfImportDialogOpen(true);
  };

  const handlePdfImport = (
    result: PdfImportPageResult,
    targetSide?: "front" | "back"
  ) => {
    const side = targetSide || pdfTargetSide || "front";
    const dataUrl = result.dataUrl;

    if (side === "front") {
      setOriginalFrontImage(dataUrl);
      setFrontBaseImage(dataUrl);
      setFrontCropState(null);
      setFrontImage(dataUrl);
      fullResFrontImageRef.current = dataUrl;
      classifyImageContent(dataUrl)
        .then((res) => {
          setFrontDetectedContent(res);
          setFrontFilterSource("auto-detected");
          setFrontFilters((prev) => ({ ...prev, ...res.recommendedFilters }));
          frontFiltersRef.current = { ...frontFiltersRef.current, ...res.recommendedFilters };
          executeFilterPipelineScheduled(false, "front");
        })
        .catch((err) => console.warn("Front upload auto-classify error:", err));
    } else {
      setOriginalBackImage(dataUrl);
      setBackBaseImage(dataUrl);
      setBackCropState(null);
      setBackImage(dataUrl);
      fullResBackImageRef.current = dataUrl;
      classifyImageContent(dataUrl)
        .then((res) => {
          setBackDetectedContent(res);
          setBackFilterSource("auto-detected");
          setBackFilters((prev) => ({ ...prev, ...res.recommendedFilters }));
          backFiltersRef.current = { ...backFiltersRef.current, ...res.recommendedFilters };
          executeFilterPipelineScheduled(false, "back");
        })
        .catch((err) => console.warn("Back upload auto-classify error:", err));
    }

    setStatusMessage(`Imported PDF Page ${result.pageNum} as ${side === "front" ? "Front" : "Back"} card.`);
    setTimeout(() => setStatusMessage(null), 2500);
  };

  const processUploadedFile = (file: File, side: "front" | "back") => {
    if (!file) return;

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      handleOpenPdfDialog(file, side);
      return;
    }

    const validImageTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/svg+xml"];
    const isKnownExt = /\.(jpe?g|png|webp|svg)$/i.test(file.name);
    if (!validImageTypes.includes(file.type) && !isKnownExt) {
      setStatusMessage("Please select a valid image (JPG, PNG, WEBP, SVG) or PDF file.");
      setTimeout(() => setStatusMessage(null), 3500);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (side === "front") {
        setOriginalFrontImage(dataUrl);
        setFrontBaseImage(dataUrl);
        setFrontCropState(null);
        setFrontImage(dataUrl);
        fullResFrontImageRef.current = dataUrl;
        classifyImageContent(dataUrl)
          .then((res) => {
            setFrontDetectedContent(res);
            setFrontFilterSource("auto-detected");
            setFrontFilters((prev) => ({ ...prev, ...res.recommendedFilters }));
            frontFiltersRef.current = { ...frontFiltersRef.current, ...res.recommendedFilters };
            executeFilterPipelineScheduled(false, "front");
          })
          .catch((err) => console.warn("Front upload auto-classify error:", err));
      } else {
        setOriginalBackImage(dataUrl);
        setBackBaseImage(dataUrl);
        setBackCropState(null);
        setBackImage(dataUrl);
        fullResBackImageRef.current = dataUrl;
        classifyImageContent(dataUrl)
          .then((res) => {
            setBackDetectedContent(res);
            setBackFilterSource("auto-detected");
            setBackFilters((prev) => ({ ...prev, ...res.recommendedFilters }));
            backFiltersRef.current = { ...backFiltersRef.current, ...res.recommendedFilters };
            executeFilterPipelineScheduled(false, "back");
          })
          .catch((err) => console.warn("Back upload auto-classify error:", err));
      }
      setStatusMessage(`${side === "front" ? "Front" : "Back"} ID card uploaded.`);
      setTimeout(() => setStatusMessage(null), 2500);
    };
    reader.onerror = () => {
      setStatusMessage("Failed to read image file.");
      setTimeout(() => setStatusMessage(null), 3000);
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, side: "front" | "back") => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file, side);
    }
    e.target.value = "";
  };

  // -------------------------------------------------------------
  // Export & Print Actions (Two-Page Output)
  // -------------------------------------------------------------
  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      setStatusMessage("Generating 300 DPI Two-Page PDF...");

      const exportFront = fullResFrontImageRef.current || frontImage;
      const exportBack = fullResBackImageRef.current || backImage;
      const pdfBytes = await exportIdCardSheetAsPDF(config, exportFront, exportBack);
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `ID_Card_Print_Sheet_${config.paperSizeId}_2Pages.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      setStatusMessage("PDF Exported Successfully!");
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err) {
      console.error("PDF export failed:", err);
      setStatusMessage("Export failed. Please check card images.");
      setTimeout(() => setStatusMessage(null), 3500);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    const printFront = fullResFrontImageRef.current || frontImage;
    const printBack = fullResBackImageRef.current || backImage;

    openPrintDialog({
      type: "id-card",
      title: "ID Card / CNIC Print Job",
      idCardConfig: config,
      idCardImages: { front: printFront, back: printBack },
      defaultPaperSize: config.paperSizeId,
      defaultOrientation: config.orientation,
      hasCuttingGuides: config.cuttingGuidesType !== "none",
    });
  };

  // Centralized Shortcut Management for ID Card / CNIC Studio
  const { pushScope, popScope, registerAction } = useShortcuts();

  useEffect(() => {
    if (!isOpen || studioLayoutMode !== "idcard") return;
    pushScope("idcard-studio");
    return () => {
      popScope("idcard-studio");
    };
  }, [isOpen, studioLayoutMode, pushScope, popScope]);

  useEffect(() => {
    if (!isOpen || studioLayoutMode !== "idcard") return;

    const unregFront = registerAction("idcard.switchFront", () => setCropTargetSide("front"));
    const unregBack = registerAction("idcard.switchBack", () => setCropTargetSide("back"));
    const unregBoth = registerAction("idcard.toggleBoth", () =>
      setPreviewMode((prev) => (prev === "side-by-side" ? "page-1" : "side-by-side"))
    );
    const unregRotateCw = registerAction("idcard.rotateCw", () =>
      handleRotateSide(cropTargetSide, 90)
    );
    const unregRotateCcw = registerAction("idcard.rotateCcw", () =>
      handleRotateSide(cropTargetSide, -90)
    );
    const unregGrid = registerAction("idcard.toggleGrid", () =>
      setConfig((prev) => ({
        ...prev,
        border: { ...prev.border, enabled: !prev.border.enabled },
      }))
    );
    const unregGuides = registerAction("idcard.toggleGuides", () =>
      setConfig((prev) => ({
        ...prev,
        cuttingGuides: { ...prev.cuttingGuides, enabled: !prev.cuttingGuides.enabled },
      }))
    );
    const unregReset = registerAction("idcard.resetAll", () => {
      setConfig((prev) => ({ ...prev, frontRotation: 0, backRotation: 0 }));
    });
    const unregPrint = registerAction("idcard.print", handlePrint);
    const unregExport = registerAction("idcard.export", handleExportPdf);
    const unregClose = registerAction("idcard.close", onClose);

    return () => {
      unregFront();
      unregBack();
      unregBoth();
      unregRotateCw();
      unregRotateCcw();
      unregGrid();
      unregGuides();
      unregReset();
      unregPrint();
      unregExport();
      unregClose();
    };
  }, [
    isOpen,
    studioLayoutMode,
    cropTargetSide,
    handlePrint,
    handleExportPdf,
    onClose,
    registerAction,
  ]);

  if (!isOpen) return null;

  // Dedicated A6 Half-Card Layout Mode Relocation:
  // Renders the uncompromised A6 Half-Card Studio workspace right inside the ID Card Studio
  if (studioLayoutMode === "a6") {
    return (
      <A6HalfCardStudioModal
        pages={pages}
        activePageIndex={activePageIndex}
        isOpen={isOpen}
        onClose={onClose}
        onInsertIntoDocument={onInsertIntoDocument}
        studioMode={studioLayoutMode}
        onSwitchStudioMode={(mode) => setStudioLayoutMode(mode)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col select-none">
      {/* -------------------------------------------------------------
          TOP BAR: Title, Mode Toggles, Zoom & Action Buttons
         ------------------------------------------------------------- */}
      <header className="h-14 bg-neutral-900 border-b border-neutral-800 px-4 flex items-center justify-between shrink-0 shadow-md">
        {/* Title & Badge */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center shadow-lg shadow-sky-600/30">
            <CreditCard className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold text-white tracking-wide">ID CARD / CNIC PRINT STUDIO</h1>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                2-Page A4 Studio
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Page 1: {frontCopiesCount} Front Copies • Page 2: {backCopiesCount} Back Copies • Exact Physical Scale
            </p>
          </div>
        </div>

        {/* Primary Studio Layout Mode Switcher */}
        <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs shadow-inner">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center space-x-1.5 bg-sky-600 text-white shadow-sm cursor-default"
            title="Currently in Standard ID Card / CNIC (A4 Multi-Card) Studio"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>ID Card / CNIC (A4)</span>
          </button>
          <button
            type="button"
            onClick={() => setStudioLayoutMode("a6")}
            className="px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center space-x-1.5 text-neutral-400 hover:text-white cursor-pointer"
            title="Switch to A6 Half-Card Layout Studio (74×105mm, Independent Front/Back, Exact Physical Scale)"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>A6 Half-Card (74×105mm)</span>
          </button>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
          <button
            onClick={() => handleSwitchTab("side-by-side")}
            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center space-x-1.5 ${
              previewMode === "side-by-side"
                ? "bg-sky-600 text-white shadow"
                : "text-neutral-400 hover:text-white"
            }`}
            title="Display both Page 1 (Front) and Page 2 (Back) simultaneously side-by-side"
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Both Pages (Side-by-Side)</span>
          </button>
          <button
            onClick={() => handleSwitchTab("page-1")}
            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center space-x-1.5 ${
              previewMode === "page-1"
                ? "bg-emerald-600 text-white shadow"
                : "text-neutral-400 hover:text-white"
            }`}
            title="Focus on Page 1 (Front Copies)"
          >
            <span>Page 1 (Front)</span>
          </button>
          <button
            onClick={() => handleSwitchTab("page-2")}
            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center space-x-1.5 ${
              previewMode === "page-2"
                ? "bg-indigo-600 text-white shadow"
                : "text-neutral-400 hover:text-white"
            }`}
            title="Focus on Page 2 (Back Copies)"
          >
            <span>Page 2 (Back)</span>
          </button>
          <button
            onClick={() => handleSwitchTab("summary")}
            className={`px-3 py-1 rounded-md font-medium transition-all flex items-center space-x-1.5 ${
              previewMode === "summary"
                ? "bg-sky-600 text-white shadow"
                : "text-neutral-400 hover:text-white"
            }`}
            title="Pre-flight Print Safety Inspection"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Inspection</span>
          </button>
        </div>

        {/* Action Buttons: Print, PDF Export & Close */}
        <div className="flex items-center space-x-2">
          {statusMessage && (
            <span className="text-xs text-amber-400 bg-amber-950/50 border border-amber-800/50 px-2.5 py-1 rounded-md font-medium animate-pulse">
              {statusMessage}
            </span>
          )}
          <button
            onClick={handlePrint}
            disabled={isExporting}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-50"
            title="Print 2-Page Sheet with browser print dialog"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print 2-Page Sheet</span>
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-50"
            title="Export 300 DPI Two-Page PDF"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Export 2-Page PDF</span>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
            title="Close ID Card Studio (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* -------------------------------------------------------------
          MAIN WORKSPACE: Sidebar Controls + Center Canvas Viewport
         ------------------------------------------------------------- */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT CONTROL SIDEBAR */}
        <aside className="w-80 bg-neutral-900/95 border-r border-neutral-800 flex flex-col shrink-0 overflow-y-auto custom-scrollbar text-xs">
          {/* Document Source Slots & Crop Controls */}
          <div className="p-3 border-b border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                <span>Card Source Documents</span>
              </span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => handleOpenPdfDialog(null, "front")}
                  className="flex items-center space-x-1 text-[11px] text-indigo-300 hover:text-white font-medium px-2 py-0.5 rounded bg-indigo-950/70 border border-indigo-800/80 hover:bg-indigo-900 transition-colors"
                  title="Import page from PDF Document"
                >
                  <FileText className="w-3 h-3 text-red-400" />
                  <span>PDF</span>
                </button>
                <button
                  onClick={handleSwapSides}
                  className="flex items-center space-x-1 text-[11px] text-sky-400 hover:text-sky-300 font-medium px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/60"
                  title="Swap Front and Back sides"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>Swap</span>
                </button>
              </div>
            </div>

            {/* Front & Back Cards Slots */}
            <div className="grid grid-cols-2 gap-2">
              {/* FRONT CARD SLOT */}
              <div className="bg-neutral-950 rounded-lg p-2 border border-neutral-800 flex flex-col space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-300">
                  <span className="text-emerald-400">Front Side</span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleRotateSide("front", 90)}
                      className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
                      title="Rotate 90° CW"
                    >
                      <RotateCw className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Thumbnail View */}
                <div
                  onClick={() => frontFileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) processUploadedFile(file, "front");
                  }}
                  className="w-full aspect-[85.6/53.98] bg-neutral-900 rounded border border-neutral-700/60 flex items-center justify-center cursor-pointer overflow-hidden relative group"
                  title="Click or drop image to replace Front image"
                >
                  <img
                    key={`front-thumb-${frontImage.length}`}
                    src={frontImage}
                    alt="Front Card"
                    className="w-full h-full object-contain"
                    style={{ transform: `rotate(${config.frontRotation}deg)` }}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] text-white font-medium">
                    Replace
                  </div>
                </div>

                {/* Upload & Crop Buttons */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => frontFileInputRef.current?.click()}
                    className="flex-1 py-1 px-1 bg-neutral-800 hover:bg-neutral-700 text-[10px] rounded text-neutral-200 text-center font-medium"
                  >
                    Upload
                  </button>
                  <button
                    onClick={() => handleOpenCrop("front")}
                    className="flex-1 py-1 px-1 bg-sky-950/80 hover:bg-sky-900 border border-sky-800 text-[10px] rounded text-sky-400 font-medium flex items-center justify-center space-x-0.5"
                    title="Crop Front Card"
                  >
                    <Crop className="w-3 h-3" />
                    <span>Crop</span>
                  </button>
                </div>
              </div>

              {/* BACK CARD SLOT */}
              <div className="bg-neutral-950 rounded-lg p-2 border border-neutral-800 flex flex-col space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-300">
                  <span className="text-indigo-400">Back Side</span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleRotateSide("back", 90)}
                      className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
                      title="Rotate 90° CW"
                    >
                      <RotateCw className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Thumbnail View */}
                <div
                  onClick={() => backFileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "copy";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) processUploadedFile(file, "back");
                  }}
                  className="w-full aspect-[85.6/53.98] bg-neutral-900 rounded border border-neutral-700/60 flex items-center justify-center cursor-pointer overflow-hidden relative group"
                  title="Click or drop image to replace Back image"
                >
                  <img
                    key={`back-thumb-${backImage.length}`}
                    src={backImage}
                    alt="Back Card"
                    className="w-full h-full object-contain"
                    style={{ transform: `rotate(${config.backRotation}deg)` }}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] text-white font-medium">
                    Replace
                  </div>
                </div>

                {/* Upload & Crop Buttons */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => backFileInputRef.current?.click()}
                    className="flex-1 py-1 px-1 bg-neutral-800 hover:bg-neutral-700 text-[10px] rounded text-neutral-200 text-center font-medium"
                  >
                    Upload
                  </button>
                  <button
                    onClick={() => handleOpenCrop("back")}
                    className="flex-1 py-1 px-1 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800 text-[10px] rounded text-indigo-400 font-medium flex items-center justify-center space-x-0.5"
                    title="Crop Back Card"
                  >
                    <Crop className="w-3 h-3" />
                    <span>Crop</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions: Multi-page PDF Import & Reset Specimen */}
            <div className="flex items-center space-x-1.5 pt-1">
              <button
                onClick={() => pdfFileInputRef.current?.click()}
                className="flex-1 py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/60 rounded text-neutral-200 font-medium flex items-center justify-center space-x-1"
                title="Import a multi-page PDF document to select front/back pages"
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span>Import PDF Document</span>
              </button>
              <button
                onClick={handleResetSpecimen}
                className="py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/60 rounded text-amber-300 font-medium flex items-center space-x-1"
                title="Reset to specimen practice sample cards"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Specimen</span>
              </button>
            </div>
          </div>

          {/* Filters & Image Adjustments */}
          <div className="p-3 border-b border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Wand2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Filters &amp; Adjustments</span>
              </span>
              <button
                onClick={handleResetFilters}
                className="text-[10px] text-neutral-400 hover:text-white flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-neutral-800 transition-colors"
                title="Reset filters to original"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            </div>

            {/* Scope: Apply To */}
            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-neutral-400">Apply To</label>
              <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-0.5 rounded border border-neutral-800 text-[10px]">
                <button
                  onClick={() => setApplyToScope("current")}
                  className={`py-1 rounded font-medium text-center transition-colors ${
                    applyToScope === "current"
                      ? "bg-sky-600 text-white shadow-sm font-semibold"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Current Side
                </button>
                <button
                  onClick={() => setApplyToScope("both")}
                  className={`py-1 rounded font-medium text-center transition-colors ${
                    applyToScope === "both"
                      ? "bg-sky-600 text-white shadow-sm font-semibold"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Both Sides
                </button>
                <button
                  onClick={() => setApplyToScope("all")}
                  className={`py-1 rounded font-medium text-center transition-colors ${
                    applyToScope === "all"
                      ? "bg-sky-600 text-white shadow-sm font-semibold"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  All Pages
                </button>
              </div>
            </div>

            {/* Side Switcher (Visible when "Current Side" is selected) */}
            {applyToScope === "current" && (
              <div className="flex items-center space-x-1 bg-neutral-900/90 p-1 rounded-md border border-neutral-800">
                <span className="text-[10px] text-neutral-400 pl-1">Side:</span>
                <button
                  onClick={() => setActiveFilterSide("front")}
                  className={`flex-1 py-0.5 px-2 rounded text-[10px] font-medium transition-all ${
                    activeFilterSide === "front"
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                      : "text-neutral-400 hover:text-white border border-transparent"
                  }`}
                >
                  Front Card
                </button>
                <button
                  onClick={() => setActiveFilterSide("back")}
                  className={`flex-1 py-0.5 px-2 rounded text-[10px] font-medium transition-all ${
                    activeFilterSide === "back"
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                      : "text-neutral-400 hover:text-white border border-transparent"
                  }`}
                >
                  Back Card
                </button>
              </div>
            )}

            {/* Content Optical Auto-Detection Status */}
            {currentDetectedContent && (
              <div className="p-2 rounded-md bg-neutral-950 border border-neutral-800/80 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center space-x-1.5">
                    <span className="px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[9px] bg-sky-950 text-sky-300 border border-sky-600/40">
                      {currentDetectedContent.label}
                    </span>
                    <span className="text-neutral-400">
                      {currentFilterSource === "auto-detected" ? "✨ Auto filter" : "Manual override"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleReDetectActiveSide}
                    className="text-sky-400 hover:text-sky-300 underline underline-offset-2"
                  >
                    Re-detect
                  </button>
                </div>
                <div className="text-[9px] text-neutral-500">
                  {currentDetectedContent.reason}
                </div>
              </div>
            )}

            {/* Prominent Action: Apply Settings to Both Sides */}
            <button
              type="button"
              onClick={handleApplyActiveSettingsToBothSides}
              className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-md bg-sky-950/70 hover:bg-sky-900 border border-sky-600/40 hover:border-sky-500/60 text-sky-200 text-[11px] font-medium transition-all shadow-sm group"
              title="Copy current side's filter & adjustment values to the opposite card side (one-time copy)"
            >
              <Copy className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
              <span>
                Apply {activeFilterSide === "front" ? "Front" : "Back"} Settings to Both Sides
              </span>
            </button>

            {/* Preset Filter Buttons */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-medium text-neutral-400">Preset Filters</label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: "original", label: "Original" },
                  { id: "lighten", label: "Lighten" },
                  { id: "enhance", label: "Enhance" },
                  { id: "shadow-removal", label: "No Shadow" },
                  { id: "monochrome", label: "B&W" },
                  { id: "eco", label: "Eco" },
                  { id: "grayscale", label: "Grayscale" },
                ].map((preset) => {
                  const isActive = currentFilters.preset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset.id)}
                      className={`py-1 px-1 rounded text-[10px] font-medium transition-all text-center border ${
                        isActive
                          ? "bg-sky-600 text-white border-sky-400 shadow"
                          : "bg-neutral-950 text-neutral-300 border-neutral-800 hover:bg-neutral-800 hover:text-white"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Adjustment Sliders */}
            <div className="space-y-2.5 pt-1">
              {/* Brightness */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] h-4 select-none">
                  <span className="text-neutral-400 flex items-center space-x-1">
                    <Sun className="w-3 h-3 text-amber-400" />
                    <span>Brightness</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleFilterParamChange("brightness", 0, false)}
                    className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
                    title="Reset Brightness to 0"
                  >
                    reset (0)
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={currentFilters.brightness}
                    onPointerDown={markSliderInteraction}
                    onPointerUp={endSliderInteraction}
                    onPointerCancel={endSliderInteraction}
                    onChange={(e) => handleFilterParamChange("brightness", parseInt(e.target.value, 10))}
                    className="flex-1 h-1.5 bg-neutral-800 accent-sky-500 rounded cursor-pointer"
                  />
                  <IdCardFilterNumericInput
                    id="filter-input-brightness"
                    value={currentFilters.brightness}
                    min={-100}
                    max={100}
                    step={1}
                    precision={0}
                    onChange={(val, isCommit) => handleFilterParamChange("brightness", val, !isCommit)}
                    ariaLabel="Brightness numeric input"
                  />
                </div>
              </div>

              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] h-4 select-none">
                  <span className="text-neutral-400 flex items-center space-x-1">
                    <Contrast className="w-3 h-3 text-sky-400" />
                    <span>Contrast</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleFilterParamChange("contrast", 0, false)}
                    className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
                    title="Reset Contrast to 0"
                  >
                    reset (0)
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    step="1"
                    value={currentFilters.contrast}
                    onPointerDown={markSliderInteraction}
                    onPointerUp={endSliderInteraction}
                    onPointerCancel={endSliderInteraction}
                    onChange={(e) => handleFilterParamChange("contrast", parseInt(e.target.value, 10))}
                    className="flex-1 h-1.5 bg-neutral-800 accent-sky-500 rounded cursor-pointer"
                  />
                  <IdCardFilterNumericInput
                    id="filter-input-contrast"
                    value={currentFilters.contrast}
                    min={-100}
                    max={100}
                    step={1}
                    precision={0}
                    onChange={(val, isCommit) => handleFilterParamChange("contrast", val, !isCommit)}
                    ariaLabel="Contrast numeric input"
                  />
                </div>
              </div>

              {/* Gamma Curve */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] h-4 select-none">
                  <span className="text-neutral-400 flex items-center space-x-1">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span>Gamma Curve</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleFilterParamChange("gamma", 1.0, false)}
                    className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
                    title="Reset Gamma to 1.00"
                  >
                    reset (1.00)
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.05"
                    value={currentFilters.gamma}
                    onPointerDown={markSliderInteraction}
                    onPointerUp={endSliderInteraction}
                    onPointerCancel={endSliderInteraction}
                    onChange={(e) => handleFilterParamChange("gamma", parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-neutral-800 accent-sky-500 rounded cursor-pointer"
                  />
                  <IdCardFilterNumericInput
                    id="filter-input-gamma"
                    value={currentFilters.gamma}
                    min={0.2}
                    max={3.0}
                    step={0.05}
                    precision={2}
                    onChange={(val, isCommit) => handleFilterParamChange("gamma", val, !isCommit)}
                    ariaLabel="Gamma Curve numeric input"
                  />
                </div>
              </div>

              {/* Unsharp Mask (Sharpness) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] h-4 select-none">
                  <span className="text-neutral-400 flex items-center space-x-1">
                    <Zap className="w-3 h-3 text-sky-400" />
                    <span>Unsharp Mask</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleFilterParamChange("sharpness", 0, false)}
                    className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
                    title="Reset Unsharp Mask to 0"
                  >
                    reset (0)
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={currentFilters.sharpness}
                    onPointerDown={markSliderInteraction}
                    onPointerUp={endSliderInteraction}
                    onPointerCancel={endSliderInteraction}
                    onChange={(e) => handleFilterParamChange("sharpness", parseInt(e.target.value, 10))}
                    className="flex-1 h-1.5 bg-neutral-800 accent-sky-500 rounded cursor-pointer"
                  />
                  <IdCardFilterNumericInput
                    id="filter-input-sharpness"
                    value={currentFilters.sharpness}
                    min={0}
                    max={100}
                    step={1}
                    precision={0}
                    onChange={(val, isCommit) => handleFilterParamChange("sharpness", val, !isCommit)}
                    ariaLabel="Unsharp Mask numeric input"
                  />
                </div>
              </div>

              {/* Fine Deskew Angle */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] h-4 select-none">
                  <span className="text-neutral-400 flex items-center space-x-1">
                    <Compass className="w-3 h-3 text-emerald-400" />
                    <span>Fine Deskew</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleFilterParamChange("deskewAngle", 0, false)}
                    className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
                    title="Reset Deskew to 0.0°"
                  >
                    reset (0.0°)
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="-15"
                    max="15"
                    step="0.1"
                    value={currentFilters.deskewAngle}
                    onPointerDown={markSliderInteraction}
                    onPointerUp={endSliderInteraction}
                    onPointerCancel={endSliderInteraction}
                    onChange={(e) => handleFilterParamChange("deskewAngle", parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-neutral-800 accent-sky-500 rounded cursor-pointer"
                  />
                  <IdCardFilterNumericInput
                    id="filter-input-deskew"
                    value={currentFilters.deskewAngle}
                    min={-15}
                    max={15}
                    step={0.1}
                    precision={1}
                    unit="°"
                    onChange={(val, isCommit) => handleFilterParamChange("deskewAngle", val, !isCommit)}
                    ariaLabel="Fine Deskew numeric input in degrees"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Document Dimensions & Paper Settings */}
          <div className="p-3 border-b border-neutral-800 space-y-3">
            <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>Document &amp; Paper Size</span>
            </span>

            {/* Document Preset Selection */}
            <div>
              <label className="block text-[11px] text-neutral-400 mb-1 font-medium">Document Preset</label>
              <select
                value={config.presetId}
                onChange={(e) => handleSelectPreset(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-neutral-200 focus:border-sky-500 focus:outline-none"
              >
                {ID_CARD_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {(config.presetId === "a6-half-card" || config.presetId === "a6-half-card-landscape") && (
                <button
                  type="button"
                  onClick={() => setStudioLayoutMode("a6")}
                  className="mt-1.5 w-full py-1.5 px-2 rounded-lg text-[10px] font-semibold bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  title="Switch to dedicated A6 Half-Card sheet layout mode"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Open Dedicated A6 Sheet Studio Mode</span>
                </button>
              )}
            </div>

            {/* Custom Dimension Inputs & Units */}
            <div className="grid grid-cols-12 gap-1.5 items-end">
              <div className="col-span-4">
                <label className="block text-[10px] text-neutral-400 mb-0.5">Width ({config.unit})</label>
                <input
                  type="number"
                  step="0.1"
                  value={Number(convertIdCardUnit(config.docWidthMm, "mm", config.unit).toFixed(2))}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 1;
                    const mm = convertIdCardUnit(val, config.unit, "mm");
                    setConfig((prev) => ({ ...prev, presetId: "custom", docWidthMm: mm }));
                  }}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-neutral-200 text-center text-xs"
                />
              </div>
              <div className="col-span-1 flex items-center justify-center pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setConfig((prev) => {
                      const newW = prev.docHeightMm;
                      const newH = prev.docWidthMm;
                      const testConf = { ...prev, docWidthMm: newW, docHeightMm: newH, copyCountMode: "auto" as const };
                      const autoL = calculateIdCardLayout(testConf);
                      return {
                        ...prev,
                        presetId: "custom",
                        docWidthMm: newW,
                        docHeightMm: newH,
                        manualColumns: autoL.columns > 0 ? autoL.columns : 1,
                        manualRows: autoL.rows > 0 ? autoL.rows : 1,
                        manualTotalCopies: (autoL.columns > 0 ? autoL.columns : 1) * (autoL.rows > 0 ? autoL.rows : 1),
                      };
                    });
                  }}
                  className="p-1 text-neutral-400 hover:text-sky-400 hover:bg-neutral-800 rounded transition-colors"
                  title="Swap Width and Height (Toggle Orientation)"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
              <div className="col-span-4">
                <label className="block text-[10px] text-neutral-400 mb-0.5">Height ({config.unit})</label>
                <input
                  type="number"
                  step="0.1"
                  value={Number(convertIdCardUnit(config.docHeightMm, "mm", config.unit).toFixed(2))}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 1;
                    const mm = convertIdCardUnit(val, config.unit, "mm");
                    setConfig((prev) => ({ ...prev, presetId: "custom", docHeightMm: mm }));
                  }}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-neutral-200 text-center text-xs"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-[10px] text-neutral-400 mb-0.5">Unit</label>
                <select
                  value={config.unit}
                  onChange={(e) => setConfig((prev) => ({ ...prev, unit: e.target.value as IdCardUnit }))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-1.5 py-1 text-neutral-200 text-xs"
                >
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                  <option value="in">inches</option>
                  <option value="pt">points</option>
                  <option value="px">pixels</option>
                </select>
              </div>
            </div>

            {/* Paper Size & Orientation */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[10px] text-neutral-400 mb-1">Target Paper</label>
                <select
                  value={config.paperSizeId}
                  onChange={(e) => handleSelectPaper(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-neutral-200 text-xs"
                >
                  {ID_CARD_PAPER_SIZES.map((paper) => (
                    <option key={paper.id} value={paper.id}>
                      {paper.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-neutral-400 mb-1">Orientation</label>
                <select
                  value={config.orientation}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      orientation: e.target.value as "portrait" | "landscape",
                    }))
                  }
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-neutral-200 text-xs"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>
          </div>

          {/* Copy Count & Grid Modes */}
          <div className="p-3 border-b border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Grid className="w-3.5 h-3.5 text-sky-400" />
                <span>Copies &amp; Grid Alignment</span>
              </span>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                {layout.columns} cols × {layout.rows} rows ({frontCopiesCount}/page)
              </span>
            </div>

            {/* Copy Count Mode Switch */}
            <div className="grid grid-cols-2 gap-1 bg-neutral-950 p-0.5 rounded border border-neutral-800">
              <button
                onClick={() => setConfig((prev) => ({ ...prev, copyCountMode: "auto" }))}
                className={`py-1 rounded font-medium text-center transition-colors ${
                  config.copyCountMode === "auto"
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Auto Calculation
              </button>
              <button
                onClick={() => setConfig((prev) => ({ ...prev, copyCountMode: "manual" }))}
                className={`py-1 rounded font-medium text-center transition-colors ${
                  config.copyCountMode === "manual"
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Manual Grid
              </button>
            </div>

            {/* Manual Controls */}
            {config.copyCountMode === "manual" && (
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <div>
                  <span className="block text-[10px] text-neutral-400 mb-0.5">Columns</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={config.manualColumns}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        manualColumns: Math.max(1, parseInt(e.target.value) || 1),
                      }))
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-center text-xs"
                  />
                </div>
                <div>
                  <span className="block text-[10px] text-neutral-400 mb-0.5">Rows</span>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={config.manualRows}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        manualRows: Math.max(1, parseInt(e.target.value) || 1),
                      }))
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-center text-xs"
                  />
                </div>
                <div>
                  <span className="block text-[10px] text-neutral-400 mb-0.5">Total Copies</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={config.manualTotalCopies}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        manualTotalCopies: Math.max(1, parseInt(e.target.value) || 1),
                      }))
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-center text-xs font-bold text-sky-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Margins & Gaps */}
          <div className="p-3 border-b border-neutral-800 space-y-3">
            <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Margins &amp; Spacing (mm)</span>
            </span>

            {/* Margins Mode */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-neutral-400">Sheet Margins</span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        marginMode: prev.marginMode === "auto" ? "manual" : "auto",
                      }))
                    }
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      config.marginMode === "auto"
                        ? "bg-sky-950 text-sky-400 border border-sky-800"
                        : "bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    {config.marginMode === "auto" ? "Centered (Auto)" : "Manual"}
                  </button>
                  <button
                    onClick={() => setConfig((prev) => ({ ...prev, linkMargins: !prev.linkMargins }))}
                    className="text-neutral-400 hover:text-white"
                    title={config.linkMargins ? "Margins Linked" : "Margins Independent"}
                  >
                    {config.linkMargins ? <Lock className="w-3 h-3 text-sky-400" /> : <Unlock className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1">
                <div>
                  <span className="block text-[9px] text-neutral-500 text-center">Top</span>
                  <input
                    type="number"
                    step="0.5"
                    disabled={config.marginMode === "auto"}
                    value={Number(config.marginTopMm.toFixed(1))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setConfig((prev) => ({
                        ...prev,
                        marginMode: "manual",
                        marginTopMm: val,
                        ...(prev.linkMargins ? { marginBottomMm: val, marginLeftMm: val, marginRightMm: val } : {}),
                      }));
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-1 py-1 text-center text-xs disabled:opacity-50"
                  />
                </div>
                <div>
                  <span className="block text-[9px] text-neutral-500 text-center">Bottom</span>
                  <input
                    type="number"
                    step="0.5"
                    disabled={config.marginMode === "auto"}
                    value={Number(config.marginBottomMm.toFixed(1))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setConfig((prev) => ({
                        ...prev,
                        marginMode: "manual",
                        marginBottomMm: val,
                        ...(prev.linkMargins ? { marginTopMm: val, marginLeftMm: val, marginRightMm: val } : {}),
                      }));
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-1 py-1 text-center text-xs disabled:opacity-50"
                  />
                </div>
                <div>
                  <span className="block text-[9px] text-neutral-500 text-center">Left</span>
                  <input
                    type="number"
                    step="0.5"
                    disabled={config.marginMode === "auto"}
                    value={Number(config.marginLeftMm.toFixed(1))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setConfig((prev) => ({
                        ...prev,
                        marginMode: "manual",
                        marginLeftMm: val,
                        ...(prev.linkMargins ? { marginTopMm: val, marginBottomMm: val, marginRightMm: val } : {}),
                      }));
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-1 py-1 text-center text-xs disabled:opacity-50"
                  />
                </div>
                <div>
                  <span className="block text-[9px] text-neutral-500 text-center">Right</span>
                  <input
                    type="number"
                    step="0.5"
                    disabled={config.marginMode === "auto"}
                    value={Number(config.marginRightMm.toFixed(1))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setConfig((prev) => ({
                        ...prev,
                        marginMode: "manual",
                        marginRightMm: val,
                        ...(prev.linkMargins ? { marginTopMm: val, marginBottomMm: val, marginLeftMm: val } : {}),
                      }));
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-1 py-1 text-center text-xs disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Gaps Between Cards */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-neutral-400">Gaps Between Cards</span>
                <button
                  onClick={() => setConfig((prev) => ({ ...prev, linkGaps: !prev.linkGaps }))}
                  className="text-neutral-400 hover:text-white"
                  title={config.linkGaps ? "Gaps Linked" : "Gaps Independent"}
                >
                  {config.linkGaps ? <Lock className="w-3 h-3 text-sky-400" /> : <Unlock className="w-3 h-3" />}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="block text-[9px] text-neutral-500 mb-0.5">Horizontal Gap (mm)</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={Number(config.gapHMm.toFixed(1))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setConfig((prev) => ({
                        ...prev,
                        gapHMm: val,
                        ...(prev.linkGaps ? { gapVMm: val } : {}),
                      }));
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-center text-xs"
                  />
                </div>
                <div>
                  <span className="block text-[9px] text-neutral-500 mb-0.5">Vertical Gap (mm)</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={Number(config.gapVMm.toFixed(1))}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setConfig((prev) => ({
                        ...prev,
                        gapVMm: val,
                        ...(prev.linkGaps ? { gapHMm: val } : {}),
                      }));
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-center text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Borders & Cutting Guides */}
          <div className="p-3 border-b border-neutral-800 space-y-2.5">
            <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <Scissors className="w-3.5 h-3.5 text-sky-400" />
              <span>Borders &amp; Cutting Guides</span>
            </span>

            {/* Border Toggle & Options */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.borderEnabled}
                    onChange={(e) => setConfig((prev) => ({ ...prev, borderEnabled: e.target.checked }))}
                    className="rounded text-sky-600"
                  />
                  <span>Card Perimeter Border</span>
                </label>
                {config.borderEnabled && (
                  <input
                    type="color"
                    value={config.borderColor}
                    onChange={(e) => setConfig((prev) => ({ ...prev, borderColor: e.target.value }))}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
                  />
                )}
              </div>

              {config.borderEnabled && (
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <select
                    value={config.borderThicknessPx}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, borderThicknessPx: parseInt(e.target.value) || 1 }))
                    }
                    className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs"
                  >
                    <option value={1}>1px Fine Border</option>
                    <option value={2}>2px Standard</option>
                    <option value={3}>3px Heavy</option>
                  </select>
                  <select
                    value={config.borderStyle}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        borderStyle: e.target.value as "solid" | "dashed" | "dotted",
                      }))
                    }
                    className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs"
                  >
                    <option value="solid">Solid Line</option>
                    <option value="dashed">Dashed Line</option>
                    <option value="dotted">Dotted Line</option>
                  </select>
                </div>
              )}
            </div>

            {/* Cutting Guides */}
            <div className="pt-1">
              <label className="block text-[11px] text-neutral-400 mb-1">Cutting Guides</label>
              <select
                value={config.cuttingGuidesType}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    cuttingGuidesType: e.target.value as "none" | "corner-marks" | "crop-marks" | "dashed-lines",
                  }))
                }
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200"
              >
                <option value="none">No Cutting Guides</option>
                <option value="corner-marks">Corner Tick Marks (L-Marks)</option>
                <option value="crop-marks">Standard Crosshair Crop Marks</option>
                <option value="dashed-lines">Perimeter Dashed Scissor Lines</option>
              </select>
            </div>
          </div>

          {/* Sample Document Practice Watermark */}
          <div className="p-3 space-y-2">
            <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Practice Document Safety</span>
            </span>

            <label className="flex items-center space-x-2 text-[11px] text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.watermarkEnabled}
                onChange={(e) => setConfig((prev) => ({ ...prev, watermarkEnabled: e.target.checked }))}
                className="rounded text-sky-600"
              />
              <span>Add "SAMPLE / PRACTICE" Watermark</span>
            </label>

            {config.watermarkEnabled && (
              <input
                type="text"
                value={config.watermarkText}
                onChange={(e) => setConfig((prev) => ({ ...prev, watermarkText: e.target.value }))}
                placeholder="Watermark text"
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200"
              />
            )}
          </div>
        </aside>

        {/* CENTER VIEWPORT / WORKSPACE */}
        <main className="flex-1 flex flex-col bg-neutral-950 overflow-hidden relative">
          {/* Top Sub-Bar: Status, Zoom & Navigation */}
          <div className="h-10 bg-neutral-900/80 border-b border-neutral-800 px-4 flex items-center justify-between text-xs shrink-0 z-10">
            {/* Left Info Badges */}
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-white">
                PAGE 1 (FRONT): {frontCopiesCount} COPIES • PAGE 2 (BACK): {backCopiesCount} COPIES
              </span>
              <span className="text-neutral-500">|</span>
              <span className="text-neutral-400">
                A4 ({config.orientation}) • {config.docWidthMm} × {config.docHeightMm} mm
              </span>
              {layout.warningMessage && (
                <span className="text-amber-400 font-medium flex items-center space-x-1 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{layout.warningMessage}</span>
                </span>
              )}
            </div>

            {/* Right Zoom & Pan Controls */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => {
                  const newZoom = Math.max(0.25, Number((zoom - 0.1).toFixed(2)));
                  const ratio = newZoom / zoom;
                  updateZoomPan(newZoom, {
                    x: Math.round(pan.x * ratio),
                    y: Math.round(pan.y * ratio),
                  });
                }}
                className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
                title="Zoom Out (Mouse Wheel Down)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="w-12 text-center text-[11px] text-neutral-300 font-mono">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => {
                  const newZoom = Math.min(4.0, Number((zoom + 0.1).toFixed(2)));
                  const ratio = newZoom / zoom;
                  updateZoomPan(newZoom, {
                    x: Math.round(pan.x * ratio),
                    y: Math.round(pan.y * ratio),
                  });
                }}
                className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
                title="Zoom In (Mouse Wheel Up)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <div className="h-4 w-px bg-neutral-800 mx-1" />
              <button
                onClick={handleFitPages}
                className="px-2 py-0.5 hover:bg-neutral-800 rounded text-[11px] text-neutral-300 font-medium"
                title="Fit sheets in viewport"
              >
                Fit
              </button>
              <button
                onClick={handleActualSize}
                className="px-2 py-0.5 hover:bg-neutral-800 rounded text-[11px] text-neutral-300 font-medium"
                title="100% 1:1 Scale"
              >
                100%
              </button>
              <button
                onClick={() => updateZoomPan(zoom, { x: 0, y: 0 })}
                className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
                title="Reset Pan to Center"
              >
                <Move className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Canvas Viewport Area with Center-Based Wheel Zoom and Panning */}
          <div
            ref={viewportRef}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={handleViewportPointerUp}
            onPointerCancel={handleViewportPointerUp}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (!file) return;
              let targetSide: "front" | "back" = "front";
              if (previewMode === "page-2") {
                targetSide = "back";
              } else if (previewMode === "side-by-side") {
                const rect = e.currentTarget.getBoundingClientRect();
                const relX = e.clientX - rect.left;
                targetSide = relX > rect.width / 2 ? "back" : "front";
              }
              processUploadedFile(file, targetSide);
            }}
            className={`flex-1 overflow-auto p-12 items-center justify-center custom-scrollbar relative select-none ${
              isPanning ? "cursor-grabbing" : "cursor-grab"
            } ${previewMode === "summary" ? "hidden" : "flex"}`}
            style={{
              backgroundColor: "#0B0F17",
            }}
          >
            <div
              className="flex items-start justify-center gap-12 origin-center"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                willChange: "transform",
              }}
            >
              {/* PAGE 1: FRONT SIDE */}
              <div
                className={`flex-col items-center space-y-3 ${
                  previewMode === "page-2" ? "hidden" : "flex"
                }`}
              >
                {/* Header Label for Page 1 */}
                <div className="flex items-center space-x-2 bg-neutral-900/90 border border-emerald-500/40 px-3.5 py-1.5 rounded-full shadow-lg">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-300 tracking-wider">
                    PAGE 1 / FRONT
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    ({frontCopiesCount} Copies • {layout.columns} × {layout.rows} Grid)
                  </span>
                </div>

                {/* Physical Paper Frame */}
                <div
                  className="bg-white rounded-sm shadow-2xl overflow-hidden relative border border-neutral-300 shrink-0 select-none"
                  style={{
                    width: `${paperDisplayWidth}px`,
                    height: `${paperDisplayHeight}px`,
                    aspectRatio: `${paperWMm} / ${paperHMm}`,
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
                  }}
                >
                  <canvas
                    ref={page1CanvasRef}
                    className="block pointer-events-none w-full h-full"
                    style={{
                      width: `${paperDisplayWidth}px`,
                      height: `${paperDisplayHeight}px`,
                    }}
                  />
                </div>
              </div>

              {/* PAGE 2: BACK SIDE */}
              <div
                className={`flex-col items-center space-y-3 ${
                  previewMode === "page-1" ? "hidden" : "flex"
                }`}
              >
                {/* Header Label for Page 2 */}
                <div className="flex items-center space-x-2 bg-neutral-900/90 border border-indigo-500/40 px-3.5 py-1.5 rounded-full shadow-lg">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-xs font-bold text-indigo-300 tracking-wider">
                    PAGE 2 / BACK
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    ({backCopiesCount} Copies • Matching Alignment)
                  </span>
                </div>

                {/* Physical Paper Frame */}
                <div
                  className="bg-white rounded-sm shadow-2xl overflow-hidden relative border border-neutral-300 shrink-0 select-none"
                  style={{
                    width: `${paperDisplayWidth}px`,
                    height: `${paperDisplayHeight}px`,
                    aspectRatio: `${paperWMm} / ${paperHMm}`,
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
                  }}
                >
                  <canvas
                    ref={page2CanvasRef}
                    className="block pointer-events-none w-full h-full"
                    style={{
                      width: `${paperDisplayWidth}px`,
                      height: `${paperDisplayHeight}px`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pre-Flight Print Safety Inspection Dedicated Viewport */}
          <div
            className={`flex-1 overflow-y-auto p-8 justify-center items-start custom-scrollbar ${
              previewMode === "summary" ? "flex" : "hidden"
            }`}
            style={{
              backgroundColor: "#0B0F17",
            }}
          >
            <div className="max-w-2xl w-full bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-2xl space-y-6 my-auto">
              <div className="flex items-center space-x-3 pb-4 border-b border-neutral-800">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Pre-Flight Print Safety Inspection</h2>
                  <p className="text-xs text-neutral-400">
                    Physical calibration verification for true 100% 1:1 scale output
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-2">
                  <span className="font-bold text-sky-400">Two-Page Output Geometry</span>
                  <div className="flex justify-between text-neutral-300">
                    <span>Paper Format:</span>
                    <span className="font-mono text-white">{config.paperSizeId.toUpperCase()} ({config.orientation})</span>
                  </div>
                  <div className="flex justify-between text-neutral-300">
                    <span>Physical Paper Size:</span>
                    <span className="font-mono text-white">{config.paperWidthMm} × {config.paperHeightMm} mm</span>
                  </div>
                  <div className="flex justify-between text-neutral-300">
                    <span>Card Dimensions:</span>
                    <span className="font-mono text-white">{config.docWidthMm} × {config.docHeightMm} mm</span>
                  </div>
                  <div className="flex justify-between text-neutral-300">
                    <span>Resolution:</span>
                    <span className="font-mono text-emerald-400 font-bold">300 DPI (High Precision)</span>
                  </div>
                </div>

                <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-2">
                  <span className="font-bold text-indigo-400">Page Copy Breakdown</span>
                  <div className="flex justify-between text-neutral-300">
                    <span>Page 1 (Fronts):</span>
                    <span className="font-mono text-white font-bold">{frontCopiesCount} Copies</span>
                  </div>
                  <div className="flex justify-between text-neutral-300">
                    <span>Page 2 (Backs):</span>
                    <span className="font-mono text-white font-bold">{backCopiesCount} Copies</span>
                  </div>
                  <div className="flex justify-between text-neutral-300">
                    <span>Grid Arrangement:</span>
                    <span className="font-mono text-white">{layout.columns} Columns × {layout.rows} Rows</span>
                  </div>
                  <div className="flex justify-between text-neutral-300">
                    <span>Front/Back Alignment:</span>
                    <span className="font-mono text-emerald-400 font-bold">Exact 100% Matched</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-xs text-amber-300 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <span className="font-bold">CRITICAL PRINTER DIALOG REQUIREMENT:</span>
                  <p className="mt-0.5 text-amber-200/90 text-[11px]">
                    When the system print dialog opens, set <span className="font-semibold text-white">Scale</span> to <span className="font-semibold text-white">"Actual Size"</span> or <span className="font-semibold text-white">"100%"</span>.
                    Do NOT select "Fit to Printable Area" or "Shrink to Page", as that will distort the exact physical millimeter card size.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* -------------------------------------------------------------
          Hidden File Inputs
         ------------------------------------------------------------- */}
      {/* Hidden File Inputs with Explicit IDs and Ref Handlers */}
      <input
        id="id-card-front-file-input"
        ref={frontFileInputRef}
        type="file"
        accept={ACCEPTED_DOCUMENT_AND_IMAGE_TYPES}
        className="hidden"
        onChange={(e) => handleFileUpload(e, "front")}
      />
      <input
        id="id-card-back-file-input"
        ref={backFileInputRef}
        type="file"
        accept={ACCEPTED_DOCUMENT_AND_IMAGE_TYPES}
        className="hidden"
        onChange={(e) => handleFileUpload(e, "back")}
      />
      <input
        id="id-card-pdf-file-input"
        ref={pdfFileInputRef}
        type="file"
        accept={ACCEPTED_DOCUMENT_AND_IMAGE_TYPES}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleOpenPdfDialog(file, "front");
          e.target.value = "";
        }}
      />

      {/* -------------------------------------------------------------
          Independent Crop Modal (For Front / Back)
         ------------------------------------------------------------- */}
      <IdCardCropModal
        isOpen={cropModalOpen}
        onClose={() => setCropModalOpen(false)}
        imageSrc={cropTargetSide === "front" ? originalFrontImage : originalBackImage}
        sideName={cropTargetSide === "front" ? "Front Side" : "Back Side"}
        initialState={cropTargetSide === "front" ? frontCropState : backCropState}
        docWidthMm={config.docWidthMm}
        docHeightMm={config.docHeightMm}
        unit={config.unit}
        onApplyCrop={handleApplyCroppedImage}
      />

      {/* -------------------------------------------------------------
          Centralized PDF Import Dialog
         ------------------------------------------------------------- */}
      <PdfImportDialog
        isOpen={isPdfImportDialogOpen}
        onClose={() => {
          setIsPdfImportDialogOpen(false);
          setSelectedPdfFile(null);
        }}
        initialFile={selectedPdfFile}
        title="ID Card PDF Page Importer"
        description="Select any PDF page to import with 300 DPI print quality into Front or Back card."
        selectionMode="single"
        showSideSelector={true}
        initialSide={pdfTargetSide}
        showDualSideButtons={true}
        primaryButtonLabel={`Use as ${pdfTargetSide === "front" ? "Front" : "Back"} Card`}
        onImportSingle={handlePdfImport}
      />
    </div>
  );
};
