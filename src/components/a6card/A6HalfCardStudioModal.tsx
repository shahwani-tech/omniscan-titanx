import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Printer,
  FileDown,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Sliders,
  Sparkles,
  Zap,
  Compass,
  ArrowUpDown,
  Layers,
  Copy,
  Trash2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Crop,
  RotateCw,
  RotateCcw,
  Check,
  AlertTriangle,
  FileText,
  Upload,
  ArrowRightLeft,
  Sun,
  Eye,
  Minimize2,
  Grid,
  Lock,
  Unlock,
  Move,
  AlignCenter,
  ArrowUp,
  ArrowDown,
  Hand,
  MousePointer,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import {
  A6HalfCardConfig,
  A6LayoutMode,
  A6PaperOrientation,
  A6CardAdjustment,
  DEFAULT_A6_CONFIG,
  DEFAULT_HALF_CARD_WIDTH_MM,
  DEFAULT_HALF_CARD_HEIGHT_MM,
  A6_PORTRAIT_WIDTH_MM,
  A6_PORTRAIT_HEIGHT_MM,
  calculateA6Layout,
  renderA6SheetCanvas,
  exportA6SheetAsPDF,
  exportA6SheetAsBlob,
  printA6Canvases,
  createSampleA6CardSvg,
  getA6SheetDimensions,
} from "../../engine/a6HalfCardLayout";
import { renderPDFPageToDataUrl } from "../../engine/pdf";
import { useShortcuts } from "../../commands/ShortcutContext";
import { usePrint } from "../../context/PrintContext";
import { A6HalfCardNumericInput } from "./A6HalfCardNumericInput";
import { A6HalfCardCropModal, A6CropState } from "./A6HalfCardCropModal";
import { A6PdfPagePickerModal } from "./A6PdfPagePickerModal";
import { OmniPage } from "../../types";

interface A6HalfCardStudioModalProps {
  pages: OmniPage[];
  activePageIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onInsertIntoDocument?: (newPageDataUrls: string[]) => void;
}

interface PdfMetadata {
  fileName: string;
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  activePage: number;
  numPages: number;
}

export const A6HalfCardStudioModal: React.FC<A6HalfCardStudioModalProps> = ({
  pages,
  activePageIndex,
  isOpen,
  onClose,
  onInsertIntoDocument,
}) => {
  const { openPrintDialog } = usePrint();

  // -------------------------------------------------------------
  // Configuration State
  // -------------------------------------------------------------
  const [config, setConfig] = useState<A6HalfCardConfig>(() => ({
    ...DEFAULT_A6_CONFIG,
    front: { ...DEFAULT_A6_CONFIG.front },
    back: { ...DEFAULT_A6_CONFIG.back },
  }));

  // -------------------------------------------------------------
  // Image & PDF State (Explicit, Separate Front & Back)
  // -------------------------------------------------------------
  const [frontImage, setFrontImage] = useState<string>(() => createSampleA6CardSvg("front"));
  const [backImage, setBackImage] = useState<string>(() => createSampleA6CardSvg("back"));

  // PDF Metadata tracking per side
  const [frontPdf, setFrontPdf] = useState<PdfMetadata | null>(null);
  const [backPdf, setBackPdf] = useState<PdfMetadata | null>(null);

  // PDF Page Picker Modal State
  const [pdfPickerState, setPdfPickerState] = useState<{
    isOpen: boolean;
    side: "front" | "back";
  }>({
    isOpen: false,
    side: "front",
  });

  // Active side tab for adjustments ("front" vs "back")
  const [activeSideTab, setActiveSideTab] = useState<"front" | "back">("front");

  // Aspect ratio lock toggle per side
  const [isAspectLocked, setIsAspectLocked] = useState<boolean>(true);

  // Active page preview in multi-page mode (Mode C)
  const [activePreviewPageIndex, setActivePreviewPageIndex] = useState<number>(0);

  // Viewport zoom and pan for preview canvas (center-based)
  const [previewZoom, setPreviewZoom] = useState<number>(1.0);
  const [canvasPan, setCanvasPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [previewTool, setPreviewTool] = useState<"select" | "hand">("select");
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isCanvasDragging, setIsCanvasDragging] = useState<boolean>(false);

  // Independent Raw Sources & Crop States for Front and Back
  const [frontRawImage, setFrontRawImage] = useState<string | null>(null);
  const [backRawImage, setBackRawImage] = useState<string | null>(null);
  const [frontCropState, setFrontCropState] = useState<A6CropState | null>(null);
  const [backCropState, setBackCropState] = useState<A6CropState | null>(null);

  // Loading / rendering status
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Crop modal state
  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false);
  const [cropTargetSide, setCropTargetSide] = useState<"front" | "back">("front");

  // Refs
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const frontObjectUrlRef = useRef<string | null>(null);
  const backObjectUrlRef = useRef<string | null>(null);

  // Pointer drag refs
  const isCanvasDraggingRef = useRef<boolean>(false);
  const canvasDragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasPanStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (frontObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(frontObjectUrlRef.current);
        } catch {}
      }
      if (backObjectUrlRef.current) {
        try {
          URL.revokeObjectURL(backObjectUrlRef.current);
        } catch {}
      }
    };
  }, []);

  // Show brief toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  // -------------------------------------------------------------
  // Viewport High-Zoom Canvas Drag & Pan Handlers
  // -------------------------------------------------------------
  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Left click with hand tool OR space pressed OR middle mouse click
    const isMiddle = e.button === 1;
    const isHandMode = previewTool === "hand";
    if (isMiddle || isHandMode || isSpacePressed) {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      isCanvasDraggingRef.current = true;
      setIsCanvasDragging(true);
      canvasDragStartRef.current = { x: e.clientX, y: e.clientY };
      canvasPanStartRef.current = { ...canvasPan };
    }
  };

  const handleViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isCanvasDraggingRef.current) return;
    e.preventDefault();

    const clientX = e.clientX;
    const clientY = e.clientY;

    if (canvasRafRef.current) cancelAnimationFrame(canvasRafRef.current);
    canvasRafRef.current = requestAnimationFrame(() => {
      const dx = clientX - canvasDragStartRef.current.x;
      const dy = clientY - canvasDragStartRef.current.y;

      const vp = viewportRef.current;
      const canvas = previewCanvasRef.current;
      let limitX = 1200;
      let limitY = 1200;
      if (vp && canvas) {
        const boardW = canvas.width * previewZoom;
        const boardH = canvas.height * previewZoom;
        limitX = Math.max(300, boardW / 2 + vp.clientWidth / 2 - 100);
        limitY = Math.max(300, boardH / 2 + vp.clientHeight / 2 - 100);
      }

      const nextX = Math.max(-limitX, Math.min(limitX, canvasPanStartRef.current.x + dx));
      const nextY = Math.max(-limitY, Math.min(limitY, canvasPanStartRef.current.y + dy));

      setCanvasPan({ x: nextX, y: nextY });
    });
  };

  const handleViewportPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isCanvasDraggingRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      isCanvasDraggingRef.current = false;
      setIsCanvasDragging(false);
    }
  };

  const handleFitWidth = () => {
    const vp = viewportRef.current;
    const canvas = previewCanvasRef.current;
    if (!vp || !canvas || canvas.width <= 0) return;
    const vpW = vp.clientWidth - 80;
    const nextZoom = Math.min(3.0, Math.max(0.3, Number((vpW / canvas.width).toFixed(2))));
    setPreviewZoom(nextZoom);
    setCanvasPan({ x: 0, y: 0 });
  };

  const handleFitHeight = () => {
    const vp = viewportRef.current;
    const canvas = previewCanvasRef.current;
    if (!vp || !canvas || canvas.height <= 0) return;
    const vpH = vp.clientHeight - 80;
    const nextZoom = Math.min(3.0, Math.max(0.3, Number((vpH / canvas.height).toFixed(2))));
    setPreviewZoom(nextZoom);
    setCanvasPan({ x: 0, y: 0 });
  };

  const handleResetPreview = () => {
    setPreviewZoom(1.0);
    setCanvasPan({ x: 0, y: 0 });
  };

  // -------------------------------------------------------------
  // Center-Based Zoom Wheel Listener on Viewport
  // -------------------------------------------------------------
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const handleWheel = (e: WheelEvent) => {
      // 1. Do not zoom if mouse is over interactive form elements or controls
      const target = e.target as HTMLElement;
      if (target.closest("button, input, select, textarea, .no-wheel-zoom")) {
        return;
      }

      // 2. Do not zoom when pointer is over native scrollbars
      const rect = vp.getBoundingClientRect();
      const isOverScrollbarY = e.clientX >= rect.left + vp.clientWidth;
      const isOverScrollbarX = e.clientY >= rect.top + vp.clientHeight;
      if (isOverScrollbarX || isOverScrollbarY) {
        return;
      }

      // 3. Center-based zoom: strictly centered on visible preview viewport
      e.preventDefault();
      const zoomStep = e.deltaY < 0 ? 0.1 : -0.1;
      setPreviewZoom((prev) => {
        const next = Math.min(3.0, Math.max(0.4, Number((prev + zoomStep).toFixed(2))));
        return next;
      });
    };

    vp.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      vp.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // -------------------------------------------------------------
  // Dedicated A6 Half-Card Keyboard Shortcuts
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select")) return;

      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      } else if (e.key.toLowerCase() === "h" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setPreviewTool((prev) => (prev === "hand" ? "select" : "hand"));
      } else if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setCropTargetSide(activeSideTab);
        setIsCropModalOpen(true);
      } else if (e.key === "0" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleResetPreview();
      } else if (e.key === "1" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setPreviewZoom(1.0);
      } else if (e.key === "2" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleFitWidth();
      } else if (e.key === "3" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleFitHeight();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setPreviewZoom((z) => Math.min(3.0, Number((z + 0.1).toFixed(2))));
      } else if (e.key === "-") {
        e.preventDefault();
        setPreviewZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))));
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
  }, [isOpen, activeSideTab]);

  // -------------------------------------------------------------
  // Unified File Processor (Images & PDFs)
  // -------------------------------------------------------------
  const processUploadedFile = async (file: File, side: "front" | "back") => {
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      try {
        setIsRendering(true);
        showToast(`Loading PDF for ${side.toUpperCase()}...`);

        if (side === "front" && frontObjectUrlRef.current) {
          try {
            URL.revokeObjectURL(frontObjectUrlRef.current);
          } catch {}
        } else if (side === "back" && backObjectUrlRef.current) {
          try {
            URL.revokeObjectURL(backObjectUrlRef.current);
          } catch {}
        }

        let objectUrl: string | undefined;
        try {
          objectUrl = URL.createObjectURL(file);
          if (side === "front") frontObjectUrlRef.current = objectUrl;
          else backObjectUrlRef.current = objectUrl;
        } catch {}

        const loadingTask = objectUrl
          ? pdfjsLib.getDocument({ url: objectUrl, useSystemFonts: true })
          : pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true });

        const pdfDoc = await loadingTask.promise;

        // Render page 1 at 200 DPI for fast interactive responsiveness
        const rendered = await renderPDFPageToDataUrl(pdfDoc, 1, 200);

        const meta: PdfMetadata = {
          fileName: file.name,
          pdfDoc,
          activePage: 1,
          numPages: pdfDoc.numPages,
        };

        if (side === "front") {
          setFrontPdf(meta);
          setFrontImage(rendered.dataUrl);
          setFrontRawImage(rendered.dataUrl);
          setFrontCropState(null);
        } else {
          setBackPdf(meta);
          setBackImage(rendered.dataUrl);
          setBackRawImage(rendered.dataUrl);
          setBackCropState(null);
        }

        showToast(`Loaded PDF: Page 1 of ${pdfDoc.numPages}`);

        // If multi-page, prompt page selector so user can select their preferred page
        if (pdfDoc.numPages > 1) {
          setPdfPickerState({ isOpen: true, side });
        }
      } catch (err) {
        console.error("PDF load error:", err);
        showToast("Failed to read PDF file. Please ensure it is valid.");
      } finally {
        setIsRendering(false);
      }
    } else if (file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          if (side === "front") {
            setFrontPdf(null); // Clear PDF metadata since user uploaded image
            setFrontImage(reader.result);
            setFrontRawImage(reader.result);
            setFrontCropState(null);
            showToast("Front image loaded successfully.");
          } else {
            setBackPdf(null);
            setBackImage(reader.result);
            setBackRawImage(reader.result);
            setBackCropState(null);
            showToast("Back image loaded successfully.");
          }
        }
      };
      reader.onerror = () => showToast("Could not read image file.");
      reader.readAsDataURL(file);
    } else {
      showToast("Unsupported file format. Please upload JPG, PNG, WEBP, or PDF.");
    }
  };

  const handleFrontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUploadedFile(file, "front");
    e.target.value = ""; // Allow re-selecting identical file
  };

  const handleBackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUploadedFile(file, "back");
    e.target.value = ""; // Allow re-selecting identical file
  };

  // Drag & drop handlers
  const handleFrontDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processUploadedFile(file, "front");
  };

  const handleBackDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processUploadedFile(file, "back");
  };

  // Page selector page change handler
  const handleSelectPdfPage = async (side: "front" | "back", pageNum: number) => {
    const meta = side === "front" ? frontPdf : backPdf;
    if (!meta || !meta.pdfDoc) return;

    try {
      setIsRendering(true);
      showToast(`Rendering Page ${pageNum}...`);
      const rendered = await renderPDFPageToDataUrl(meta.pdfDoc, pageNum, 200);

      if (side === "front") {
        setFrontPdf((prev) => (prev ? { ...prev, activePage: pageNum } : null));
        setFrontImage(rendered.dataUrl);
        setFrontRawImage(rendered.dataUrl);
        setFrontCropState(null);
      } else {
        setBackPdf((prev) => (prev ? { ...prev, activePage: pageNum } : null));
        setBackImage(rendered.dataUrl);
        setBackRawImage(rendered.dataUrl);
        setBackCropState(null);
      }
      showToast(`Switched ${side.toUpperCase()} to Page ${pageNum}`);
    } catch (err) {
      console.error("Error rendering selected PDF page:", err);
      showToast("Could not load selected page.");
    } finally {
      setIsRendering(false);
    }
  };

  // Import from existing document page
  const handleImportDocumentPage = (side: "front" | "back") => {
    const page = pages[activePageIndex];
    if (page && page.originalDataUrl) {
      if (side === "front") {
        setFrontPdf(null);
        setFrontImage(page.originalDataUrl);
        setFrontRawImage(page.originalDataUrl);
        setFrontCropState(null);
        showToast(`Document Page ${activePageIndex + 1} imported as Front card.`);
      } else {
        setBackPdf(null);
        setBackImage(page.originalDataUrl);
        setBackRawImage(page.originalDataUrl);
        setBackCropState(null);
        showToast(`Document Page ${activePageIndex + 1} imported as Back card.`);
      }
    } else {
      showToast("No active document page found to import.");
    }
  };

  // Preload Authentic Sample
  const handleLoadSamples = () => {
    setFrontPdf(null);
    setBackPdf(null);
    const sampleFront = createSampleA6CardSvg("front");
    const sampleBack = createSampleA6CardSvg("back");
    setFrontImage(sampleFront);
    setFrontRawImage(sampleFront);
    setFrontCropState(null);
    setBackImage(sampleBack);
    setBackRawImage(sampleBack);
    setBackCropState(null);
    showToast("Loaded sample front & back cards.");
  };

  // -------------------------------------------------------------
  // Card Adjustment Updates (Front vs Back)
  // -------------------------------------------------------------
  const currentAdjustment = activeSideTab === "front" ? config.front : config.back;

  const updateActiveAdjustment = (updates: Partial<A6CardAdjustment>) => {
    setConfig((prev) => {
      if (activeSideTab === "front") {
        return { ...prev, front: { ...prev.front, ...updates } };
      } else {
        return { ...prev, back: { ...prev.back, ...updates } };
      }
    });
  };

  // Aspect-ratio locked width/height updates
  const handleWidthChange = (newWidth: number) => {
    if (isAspectLocked) {
      const ratio = currentAdjustment.heightMm / currentAdjustment.widthMm;
      const newHeight = Number((newWidth * ratio).toFixed(1));
      updateActiveAdjustment({ widthMm: newWidth, heightMm: newHeight });
    } else {
      updateActiveAdjustment({ widthMm: newWidth });
    }
  };

  const handleHeightChange = (newHeight: number) => {
    if (isAspectLocked) {
      const ratio = currentAdjustment.widthMm / currentAdjustment.heightMm;
      const newWidth = Number((newHeight * ratio).toFixed(1));
      updateActiveAdjustment({ widthMm: newWidth, heightMm: newHeight });
    } else {
      updateActiveAdjustment({ heightMm: newHeight });
    }
  };

  // Copy sizing from active side to both sides
  const handleApplySizeToBoth = () => {
    const src = activeSideTab === "front" ? config.front : config.back;
    setConfig((prev) => ({
      ...prev,
      front: {
        ...prev.front,
        widthMm: src.widthMm,
        heightMm: src.heightMm,
        preserveAspect: src.preserveAspect,
        fitMode: src.fitMode,
      },
      back: {
        ...prev.back,
        widthMm: src.widthMm,
        heightMm: src.heightMm,
        preserveAspect: src.preserveAspect,
        fitMode: src.fitMode,
      },
    }));
    showToast("Applied card dimensions to both Front and Back.");
  };

  // -------------------------------------------------------------
  // Automatic Fitting Actions
  // -------------------------------------------------------------
  const handleFitInside74x105 = () => {
    updateActiveAdjustment({
      widthMm: DEFAULT_HALF_CARD_WIDTH_MM,
      heightMm: DEFAULT_HALF_CARD_HEIGHT_MM,
      fitMode: "contain",
      preserveAspect: true,
      zoom: 1.0,
      panX: 0,
      panY: 0,
      offsetX: 0,
      offsetY: 0,
    });
    showToast("Fit card inside 74 × 105 mm.");
  };

  const handleFill74x105 = () => {
    updateActiveAdjustment({
      widthMm: DEFAULT_HALF_CARD_WIDTH_MM,
      heightMm: DEFAULT_HALF_CARD_HEIGHT_MM,
      fitMode: "cover",
      preserveAspect: true,
      zoom: 1.0,
      panX: 0,
      panY: 0,
      offsetX: 0,
      offsetY: 0,
    });
    showToast("Filled 74 × 105 mm area.");
  };

  const handleStretchToExact = () => {
    updateActiveAdjustment({
      widthMm: DEFAULT_HALF_CARD_WIDTH_MM,
      heightMm: DEFAULT_HALF_CARD_HEIGHT_MM,
      fitMode: "stretch",
      preserveAspect: false,
      zoom: 1.0,
      panX: 0,
      panY: 0,
    });
    showToast("Stretched to exact 74 × 105 mm.");
  };

  const handleCenterContent = () => {
    updateActiveAdjustment({
      offsetX: 0,
      offsetY: 0,
      panX: 0,
      panY: 0,
    });
    showToast("Centered card inside slot.");
  };

  const handleAutoFitToA6 = () => {
    const { widthMm: sheetW, heightMm: sheetH } = getA6SheetDimensions(config.orientation);
    const m = config.marginMm;
    const g = config.gapMm;

    if (config.layoutMode === "mode-d-one-page-stacked" || config.layoutMode === "mode-e-two-identical") {
      if (config.orientation === "portrait") {
        const fitW = Number((sheetW - m * 2).toFixed(1));
        const fitH = Number(((sheetH - m * 2 - g) / 2).toFixed(1));
        updateActiveAdjustment({ widthMm: fitW, heightMm: fitH, offsetX: 0, offsetY: 0 });
      } else {
        const fitW = Number(((sheetW - m * 2 - g) / 2).toFixed(1));
        const fitH = Number((sheetH - m * 2).toFixed(1));
        updateActiveAdjustment({ widthMm: fitW, heightMm: fitH, offsetX: 0, offsetY: 0 });
      }
    } else {
      const fitW = Number((sheetW - m * 2).toFixed(1));
      const fitH = Number((sheetH - m * 2).toFixed(1));
      updateActiveAdjustment({ widthMm: fitW, heightMm: fitH, offsetX: 0, offsetY: 0 });
    }
    showToast("Auto-fitted card to printable A6 bounds.");
  };

  // Snapping positions
  const handleSnapUpper = () => {
    updateActiveAdjustment({ offsetY: -12, offsetX: 0 });
    showToast("Snapped to upper half.");
  };

  const handleSnapLower = () => {
    updateActiveAdjustment({ offsetY: 12, offsetX: 0 });
    showToast("Snapped to lower half.");
  };

  const handleSnapTopEdge = () => {
    updateActiveAdjustment({ offsetY: -25 });
    showToast("Snapped toward top edge.");
  };

  const handleSnapBottomEdge = () => {
    updateActiveAdjustment({ offsetY: 25 });
    showToast("Snapped toward bottom edge.");
  };

  // Reset active side adjustments
  const handleResetActiveSide = () => {
    updateActiveAdjustment({
      widthMm: DEFAULT_HALF_CARD_WIDTH_MM,
      heightMm: DEFAULT_HALF_CARD_HEIGHT_MM,
      brightness: 0,
      contrast: 0,
      gamma: 1.0,
      sharpness: 0,
      deskewAngle: 0,
      grayscale: false,
      zoom: 1.0,
      panX: 0,
      panY: 0,
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
      fitMode: "contain",
      preserveAspect: true,
      preset: "original",
    });
    showToast(`Reset ${activeSideTab.toUpperCase()} card adjustments.`);
  };

  // Quick Preset Handlers
  const handleApplyPreset = (presetName: string) => {
    switch (presetName) {
      case "original":
        updateActiveAdjustment({
          brightness: 0,
          contrast: 0,
          gamma: 1.0,
          sharpness: 0,
          grayscale: false,
          preset: "original",
        });
        break;
      case "auto-tone":
        updateActiveAdjustment({
          brightness: 8,
          contrast: 14,
          gamma: 1.05,
          sharpness: 20,
          grayscale: false,
          preset: "auto-tone",
        });
        break;
      case "crisp-bw":
        updateActiveAdjustment({
          brightness: 12,
          contrast: 35,
          gamma: 1.15,
          sharpness: 30,
          grayscale: true,
          preset: "crisp-bw",
        });
        break;
      case "grayscale":
        updateActiveAdjustment({
          brightness: 4,
          contrast: 10,
          gamma: 1.0,
          sharpness: 10,
          grayscale: true,
          preset: "grayscale",
        });
        break;
      case "high-contrast":
        updateActiveAdjustment({
          brightness: 5,
          contrast: 30,
          gamma: 1.1,
          sharpness: 25,
          grayscale: false,
          preset: "high-contrast",
        });
        break;
    }
  };

  // Swap Front & Back
  const handleSwapFrontBack = () => {
    const tempImg = frontImage;
    setFrontImage(backImage);
    setBackImage(tempImg);

    const tempRaw = frontRawImage;
    setFrontRawImage(backRawImage);
    setBackRawImage(tempRaw);

    const tempCrop = frontCropState;
    setFrontCropState(backCropState);
    setBackCropState(tempCrop);

    const tempPdf = frontPdf;
    setFrontPdf(backPdf);
    setBackPdf(tempPdf);

    setConfig((prev) => ({
      ...prev,
      front: { ...prev.back },
      back: { ...prev.front },
    }));
    showToast("Swapped Front and Back cards.");
  };

  // Repeat selected card to both slots
  const handleRepeatCard = (side: "front" | "back") => {
    if (side === "front") {
      setBackImage(frontImage);
      setBackRawImage(frontRawImage);
      setBackCropState(frontCropState);
      setBackPdf(frontPdf);
      setConfig((prev) => ({
        ...prev,
        back: { ...prev.front },
      }));
      showToast("Duplicated Front card to Back.");
    } else {
      setFrontImage(backImage);
      setFrontRawImage(backRawImage);
      setFrontCropState(backCropState);
      setFrontPdf(backPdf);
      setConfig((prev) => ({
        ...prev,
        front: { ...prev.back },
      }));
      showToast("Duplicated Back card to Front.");
    }
  };

  // Clear handlers
  const handleClearFront = () => {
    setFrontImage("");
    setFrontRawImage(null);
    setFrontCropState(null);
    setFrontPdf(null);
    showToast("Cleared Front card.");
  };

  const handleClearBack = () => {
    setBackImage("");
    setBackRawImage(null);
    setBackCropState(null);
    setBackPdf(null);
    showToast("Cleared Back card.");
  };

  // -------------------------------------------------------------
  // Live Canvas Rendering Effect (DPI: 150 for smooth preview)
  // -------------------------------------------------------------
  const layout = calculateA6Layout(config);
  const totalPages = layout.pages.length;

  // Ensure active page is within bounds
  useEffect(() => {
    if (activePreviewPageIndex >= totalPages) {
      setActivePreviewPageIndex(0);
    }
  }, [totalPages, activePreviewPageIndex]);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsRendering(true);

    const render = async () => {
      try {
        const canvas = await renderA6SheetCanvas(
          config,
          { front: frontImage, back: backImage },
          activePreviewPageIndex,
          { dpi: 150, showGuidesOverlay: true }
        );

        if (isMounted && previewCanvasRef.current) {
          const displayCanvas = previewCanvasRef.current;
          displayCanvas.width = canvas.width;
          displayCanvas.height = canvas.height;
          const ctx = displayCanvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
            ctx.drawImage(canvas, 0, 0);
          }
        }
      } catch (err) {
        console.error("A6 Studio Render Error:", err);
      } finally {
        if (isMounted) setIsRendering(false);
      }
    };

    const timer = setTimeout(render, 40);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [config, frontImage, backImage, activePreviewPageIndex, isOpen]);

  // -------------------------------------------------------------
  // Export & Print Handlers
  // -------------------------------------------------------------
  const handleDirectPrint = () => {
    openPrintDialog({
      type: "a6-card",
      title: "A6 Half-Card Print Job",
      a6Config: config,
      a6Images: { front: frontImage, back: backImage },
      defaultPaperSize: "a6",
      defaultOrientation: config.orientation,
      hasCuttingGuides: config.showCuttingGuides,
    });
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const pdfBytes = await exportA6SheetAsPDF(config, {
        front: frontImage,
        back: backImage,
      });
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OMNISCAN_A6_HalfCard_${config.layoutMode}_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Exported A6 PDF successfully.");
    } catch (err) {
      console.error("PDF Export error:", err);
      showToast("PDF Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportImage = async (format: "image/png" | "image/jpeg") => {
    setIsExporting(true);
    try {
      const blob = await exportA6SheetAsBlob(
        config,
        { front: frontImage, back: backImage },
        format,
        300,
        activePreviewPageIndex
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OMNISCAN_A6_HalfCard_Page${activePreviewPageIndex + 1}_${Date.now()}.${
        format === "image/png" ? "png" : "jpg"
      }`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Downloaded 300 DPI ${format === "image/png" ? "PNG" : "JPEG"}.`);
    } catch (err) {
      console.error("Image export error:", err);
      showToast("Failed to export image.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleInsertDocument = async () => {
    if (!onInsertIntoDocument) return;
    setIsExporting(true);
    try {
      const pageUrls: string[] = [];
      for (let i = 0; i < layout.pages.length; i++) {
        const c = await renderA6SheetCanvas(
          config,
          { front: frontImage, back: backImage },
          i,
          { dpi: 300, showGuidesOverlay: false }
        );
        pageUrls.push(c.toDataURL("image/png"));
      }
      onInsertIntoDocument(pageUrls);
      showToast(`Inserted ${pageUrls.length} A6 page(s) into document.`);
      onClose();
    } catch (err) {
      console.error("Insert error:", err);
      showToast("Failed to insert page.");
    } finally {
      setIsExporting(false);
    }
  };

  // Centralized Shortcut Management for A6 Half-Card Studio
  const { pushScope, popScope, registerAction } = useShortcuts();

  useEffect(() => {
    if (!isOpen) return;
    pushScope("a6-studio");
    return () => {
      popScope("a6-studio");
    };
  }, [isOpen, pushScope, popScope]);

  useEffect(() => {
    if (!isOpen) return;

    const unregFront = registerAction("a6.switchFront", () => setActiveSideTab("front"));
    const unregBack = registerAction("a6.switchBack", () => setActiveSideTab("back"));
    const unregOrient = registerAction("a6.toggleOrientation", () =>
      setConfig((prev) => ({
        ...prev,
        orientation: prev.orientation === "portrait" ? "landscape" : "portrait",
      }))
    );
    const unregRotateCw = registerAction("a6.rotateCw", () =>
      updateActiveAdjustment({ rotation: (currentAdjustment.rotation + 90) % 360 })
    );
    const unregRotateCcw = registerAction("a6.rotateCcw", () =>
      updateActiveAdjustment({ rotation: (currentAdjustment.rotation - 90 + 360) % 360 })
    );
    const unregZoomIn = registerAction("a6.zoomIn", () =>
      updateActiveAdjustment({
        zoom: Math.min(3.0, Number((currentAdjustment.zoom + 0.1).toFixed(2))),
      })
    );
    const unregZoomOut = registerAction("a6.zoomOut", () =>
      updateActiveAdjustment({
        zoom: Math.max(0.5, Number((currentAdjustment.zoom - 0.1).toFixed(2))),
      })
    );
    const unregResetZoom = registerAction("a6.resetZoom", () =>
      updateActiveAdjustment({ zoom: 1.0, offsetX: 0, offsetY: 0 })
    );
    const unregUp = registerAction("a6.nudgeUp", () =>
      updateActiveAdjustment({ offsetY: currentAdjustment.offsetY - 2 })
    );
    const unregDown = registerAction("a6.nudgeDown", () =>
      updateActiveAdjustment({ offsetY: currentAdjustment.offsetY + 2 })
    );
    const unregLeft = registerAction("a6.nudgeLeft", () =>
      updateActiveAdjustment({ offsetX: currentAdjustment.offsetX - 2 })
    );
    const unregRight = registerAction("a6.nudgeRight", () =>
      updateActiveAdjustment({ offsetX: currentAdjustment.offsetX + 2 })
    );
    const unregGrid = registerAction("a6.toggleGrid", () =>
      setConfig((prev) => ({
        ...prev,
        border: { ...prev.border, enabled: !prev.border.enabled },
      }))
    );
    const unregGuides = registerAction("a6.toggleGuides", () =>
      setConfig((prev) => ({
        ...prev,
        cuttingGuides: {
          ...prev.cuttingGuides,
          enabled: !prev.cuttingGuides.enabled,
        },
      }))
    );
    const unregReset = registerAction("a6.resetAll", () => {
      handleResetActiveSide();
    });
    const unregPrint = registerAction("a6.print", handleDirectPrint);
    const unregExport = registerAction("a6.export", handleExportPdf);
    const unregClose = registerAction("a6.close", onClose);

    return () => {
      unregFront();
      unregBack();
      unregOrient();
      unregRotateCw();
      unregRotateCcw();
      unregZoomIn();
      unregZoomOut();
      unregResetZoom();
      unregUp();
      unregDown();
      unregLeft();
      unregRight();
      unregGrid();
      unregGuides();
      unregReset();
      unregPrint();
      unregExport();
      unregClose();
    };
  }, [
    isOpen,
    currentAdjustment,
    handleDirectPrint,
    handleExportPdf,
    onClose,
    registerAction,
  ]);

  if (!isOpen) return null;

  const currentSheetDim = getA6SheetDimensions(config.orientation);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md select-none overflow-hidden animate-fadeIn">
      {/* Hidden File Inputs for Front and Back (Supports JPG, PNG, WEBP, and PDF) */}
      <input
        ref={frontInputRef}
        id="a6-front-file-input"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleFrontUpload}
        className="hidden"
      />
      <input
        ref={backInputRef}
        id="a6-back-file-input"
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleBackUpload}
        className="hidden"
      />

      {/* Main Studio Container */}
      <div className="flex flex-col w-[98vw] h-[96vh] max-w-[1720px] bg-neutral-900 border border-neutral-750 rounded-2xl shadow-2xl overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-neutral-950/80">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  A6 Half-Card PDF Layout Studio
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-700/60">
                  Target: 74 × 105 mm
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-neutral-400 bg-neutral-800 border border-neutral-700">
                  A6 Paper: {currentSheetDim.widthMm} × {currentSheetDim.heightMm} mm
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Images &amp; PDF Uploads • Independent Front/Back State • Center-Based Zoom • High-Precision Print &amp; PDF Export
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center space-x-2.5">
            {onInsertIntoDocument && (
              <button
                onClick={handleInsertDocument}
                disabled={isExporting}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Insert A6 sheet(s) into current PDF project"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                <span>Insert Into Project</span>
              </button>
            )}

            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Export high-resolution PDF with exact physical dimensions"
            >
              <FileDown className="w-3.5 h-3.5 text-red-400" />
              <span>Export PDF</span>
            </button>

            <button
              onClick={() => handleExportImage("image/png")}
              disabled={isExporting}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Download 300 DPI PNG Image"
            >
              <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
              <span>PNG (300 DPI)</span>
            </button>

            <button
              onClick={handleDirectPrint}
              disabled={isExporting}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Direct High-Precision Print"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A6</span>
            </button>

            <div className="h-5 w-px bg-neutral-800 mx-1" />

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Close Studio (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Studio Body: 3-Column Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* ========================================================= */}
          {/* COLUMN 1: UPLOAD & LAYOUT MODES                           */}
          {/* ========================================================= */}
          <div className="w-80 border-r border-neutral-800 bg-neutral-900/60 overflow-y-auto p-4 space-y-4 text-xs">
            {/* 1. Upload Front & Back Sections */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Card Uploads (Image / PDF)</span>
                </span>
                <button
                  type="button"
                  onClick={handleLoadSamples}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium underline transition-colors cursor-pointer"
                  title="Load sample high-res A6 half-cards"
                >
                  Load Samples
                </button>
              </div>

              {/* Front Card Drop/Upload Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFrontDrop}
                className={`p-2.5 rounded-xl border transition-all ${
                  frontImage
                    ? "bg-neutral-950/80 border-indigo-900/60"
                    : "bg-neutral-950/40 border-dashed border-neutral-700 hover:border-indigo-500"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    <span className="font-bold text-neutral-200 text-[11px]">FRONT CARD</span>
                    {frontPdf && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-red-950 text-red-300 border border-red-800">
                        PDF
                      </span>
                    )}
                  </div>
                  {frontImage && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          setCropTargetSide("front");
                          setIsCropModalOpen(true);
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                        title="Crop Front Card"
                      >
                        Crop
                      </button>
                      <button
                        onClick={handleClearFront}
                        className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                        title="Remove Front"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {frontImage ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-14 h-16 bg-neutral-900 rounded border border-neutral-800 overflow-hidden flex items-center justify-center shrink-0">
                        <img
                          src={frontImage}
                          alt="Front card preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        {frontPdf ? (
                          <div className="text-[10px] text-neutral-300">
                            <p className="font-medium text-white truncate max-w-[150px]" title={frontPdf.fileName}>
                              {frontPdf.fileName}
                            </p>
                            <p className="text-neutral-400 font-mono">
                              Page {frontPdf.activePage} of {frontPdf.numPages}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-emerald-400 font-medium flex items-center space-x-1">
                            <Check className="w-3 h-3" />
                            <span>Image Loaded</span>
                          </p>
                        )}
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => frontInputRef.current?.click()}
                            className="flex-1 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-medium border border-neutral-700 transition-colors"
                          >
                            Replace
                          </button>
                          {frontPdf && frontPdf.numPages > 1 && (
                            <button
                              type="button"
                              onClick={() => setPdfPickerState({ isOpen: true, side: "front" })}
                              className="px-2 py-0.5 rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-300 text-[10px] font-medium border border-indigo-800 transition-colors"
                              title="Select another PDF page"
                            >
                              Page...
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-center space-y-1.5">
                    <p className="text-[11px] text-neutral-400">Drag &amp; drop Image or PDF</p>
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        type="button"
                        onClick={() => frontInputRef.current?.click()}
                        className="px-3 py-1 rounded bg-indigo-600/80 hover:bg-indigo-600 text-white text-[11px] font-semibold transition-colors"
                      >
                        Browse Front
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImportDocumentPage("front")}
                        className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] border border-neutral-700"
                        title="Import active document page as front"
                      >
                        From Doc
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Back Card Drop/Upload Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleBackDrop}
                className={`p-2.5 rounded-xl border transition-all ${
                  backImage
                    ? "bg-neutral-950/80 border-indigo-900/60"
                    : "bg-neutral-950/40 border-dashed border-neutral-700 hover:border-indigo-500"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-violet-400" />
                    <span className="font-bold text-neutral-200 text-[11px]">BACK CARD</span>
                    {backPdf && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-red-950 text-red-300 border border-red-800">
                        PDF
                      </span>
                    )}
                  </div>
                  {backImage && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          setCropTargetSide("back");
                          setIsCropModalOpen(true);
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                        title="Crop Back Card"
                      >
                        Crop
                      </button>
                      <button
                        onClick={handleClearBack}
                        className="p-1 rounded text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                        title="Remove Back"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {backImage ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-14 h-16 bg-neutral-900 rounded border border-neutral-800 overflow-hidden flex items-center justify-center shrink-0">
                        <img
                          src={backImage}
                          alt="Back card preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        {backPdf ? (
                          <div className="text-[10px] text-neutral-300">
                            <p className="font-medium text-white truncate max-w-[150px]" title={backPdf.fileName}>
                              {backPdf.fileName}
                            </p>
                            <p className="text-neutral-400 font-mono">
                              Page {backPdf.activePage} of {backPdf.numPages}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-emerald-400 font-medium flex items-center space-x-1">
                            <Check className="w-3 h-3" />
                            <span>Image Loaded</span>
                          </p>
                        )}
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => backInputRef.current?.click()}
                            className="flex-1 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-medium border border-neutral-700 transition-colors"
                          >
                            Replace
                          </button>
                          {backPdf && backPdf.numPages > 1 && (
                            <button
                              type="button"
                              onClick={() => setPdfPickerState({ isOpen: true, side: "back" })}
                              className="px-2 py-0.5 rounded bg-violet-950 hover:bg-violet-900 text-violet-300 text-[10px] font-medium border border-violet-800 transition-colors"
                              title="Select another PDF page"
                            >
                              Page...
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-center space-y-1.5">
                    <p className="text-[11px] text-neutral-400">Drag &amp; drop Image or PDF</p>
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        type="button"
                        onClick={() => backInputRef.current?.click()}
                        className="px-3 py-1 rounded bg-violet-600/80 hover:bg-violet-600 text-white text-[11px] font-semibold transition-colors"
                      >
                        Browse Back
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImportDocumentPage("back")}
                        className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] border border-neutral-700"
                        title="Import active document page as back"
                      >
                        From Doc
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Layout Mode Selection (Modes A, B, C, D, E) */}
            <div className="space-y-2 border-t border-neutral-800 pt-3">
              <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Grid className="w-3.5 h-3.5 text-indigo-400" />
                <span>Layout Mode</span>
              </span>

              <div className="space-y-1.5">
                {[
                  {
                    id: "mode-d-one-page-stacked" as A6LayoutMode,
                    title: "Mode D: Front + Back on One A6",
                    desc: "Upper & Lower slots on 1 sheet",
                  },
                  {
                    id: "mode-c-separate-pages" as A6LayoutMode,
                    title: "Mode C: Front + Back (2 Pages)",
                    desc: "Page 1 Front, Page 2 Back",
                  },
                  {
                    id: "mode-e-two-identical" as A6LayoutMode,
                    title: "Mode E: Two Identical Copies",
                    desc: "2× copies on one A6 sheet",
                  },
                  {
                    id: "mode-a-single-front" as A6LayoutMode,
                    title: "Mode A: Single Front Card",
                    desc: "1 Front card inside A6",
                  },
                  {
                    id: "mode-b-single-back" as A6LayoutMode,
                    title: "Mode B: Single Back Card",
                    desc: "1 Back card inside A6",
                  },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setConfig((p) => ({ ...p, layoutMode: mode.id }))}
                    className={`w-full text-left p-2 rounded-lg border transition-all cursor-pointer ${
                      config.layoutMode === mode.id
                        ? "bg-indigo-950/70 border-indigo-500 text-white shadow-sm"
                        : "bg-neutral-950/40 border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-white"
                    }`}
                  >
                    <div className="font-semibold text-[11px]">{mode.title}</div>
                    <div className="text-[10px] text-neutral-400">{mode.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Mode-Specific Sub-Options */}
            {config.layoutMode === "mode-d-one-page-stacked" && (
              <div className="space-y-2 bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-neutral-300 font-medium">Slot Ordering</span>
                  <button
                    onClick={() =>
                      setConfig((p) => ({
                        ...p,
                        frontBackOrder:
                          p.frontBackOrder === "front-first" ? "back-first" : "front-first",
                      }))
                    }
                    className="flex items-center space-x-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] transition-colors cursor-pointer"
                  >
                    <ArrowUpDown className="w-3 h-3 text-indigo-400" />
                    <span>
                      {config.frontBackOrder === "front-first" ? "Front First" : "Back First"}
                    </span>
                  </button>
                </div>
                <button
                  onClick={handleSwapFrontBack}
                  className="w-full py-1 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-[10px] font-medium border border-neutral-700 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
                  <span>Swap Front &amp; Back Images</span>
                </button>
              </div>
            )}

            {config.layoutMode === "mode-e-two-identical" && (
              <div className="space-y-2 bg-neutral-950/60 p-2.5 rounded-xl border border-neutral-800">
                <span className="text-[11px] text-neutral-300 font-medium block">
                  Identical Card Source
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setConfig((p) => ({ ...p, twoIdenticalSource: "front" }))}
                    className={`py-1 rounded text-[11px] font-medium border cursor-pointer ${
                      config.twoIdenticalSource === "front"
                        ? "bg-indigo-600 text-white border-indigo-500"
                        : "bg-neutral-800 text-neutral-300 border-neutral-700"
                    }`}
                  >
                    2× Front
                  </button>
                  <button
                    onClick={() => setConfig((p) => ({ ...p, twoIdenticalSource: "back" }))}
                    className={`py-1 rounded text-[11px] font-medium border cursor-pointer ${
                      config.twoIdenticalSource === "back"
                        ? "bg-violet-600 text-white border-violet-500"
                        : "bg-neutral-800 text-neutral-300 border-neutral-700"
                    }`}
                  >
                    2× Back
                  </button>
                </div>
              </div>
            )}

            {/* 3. Orientation & Sheet Settings */}
            <div className="space-y-2.5 border-t border-neutral-800 pt-3">
              <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Sheet &amp; Margins</span>
              </span>

              {/* Orientation Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setConfig((p) => ({ ...p, orientation: "portrait" }))}
                  className={`py-1.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                    config.orientation === "portrait"
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                      : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white"
                  }`}
                >
                  Portrait (105×148)
                </button>
                <button
                  onClick={() => setConfig((p) => ({ ...p, orientation: "landscape" }))}
                  className={`py-1.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                    config.orientation === "landscape"
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                      : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white"
                  }`}
                >
                  Landscape (148×105)
                </button>
              </div>

              {/* Outer Margin Slider + Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">Outer Margin</span>
                  <span className="text-neutral-300 font-mono">{config.marginMm} mm</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="0.5"
                    value={config.marginMm}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, marginMm: parseFloat(e.target.value) }))
                    }
                    className="flex-1 h-1.5 bg-neutral-800 accent-indigo-500 rounded cursor-pointer"
                  />
                  <A6HalfCardNumericInput
                    id="a6-input-margin"
                    value={config.marginMm}
                    min={0}
                    max={15}
                    step={0.5}
                    precision={1}
                    unit="mm"
                    onChange={(val) => setConfig((p) => ({ ...p, marginMm: val }))}
                    ariaLabel="Outer sheet margin in millimeters"
                  />
                </div>
              </div>

              {/* Gap Between Slots Slider + Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">Slot Gap</span>
                  <span className="text-neutral-300 font-mono">{config.gapMm} mm</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.5"
                    value={config.gapMm}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, gapMm: parseFloat(e.target.value) }))
                    }
                    className="flex-1 h-1.5 bg-neutral-800 accent-indigo-500 rounded cursor-pointer"
                  />
                  <A6HalfCardNumericInput
                    id="a6-input-gap"
                    value={config.gapMm}
                    min={0}
                    max={20}
                    step={0.5}
                    precision={1}
                    unit="mm"
                    onChange={(val) => setConfig((p) => ({ ...p, gapMm: val }))}
                    ariaLabel="Gap between slots in millimeters"
                  />
                </div>
              </div>

              {/* Visual Guide Toggles */}
              <div className="space-y-1.5 pt-1 text-[11px]">
                <label className="flex items-center space-x-2 cursor-pointer text-neutral-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={config.showSlotGuides}
                    onChange={(e) => setConfig((p) => ({ ...p, showSlotGuides: e.target.checked }))}
                    className="rounded bg-neutral-800 border-neutral-700 text-indigo-500 focus:ring-0"
                  />
                  <span>Show Half-Card Slot Guides</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer text-neutral-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={config.showCuttingGuides}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, showCuttingGuides: e.target.checked }))
                    }
                    className="rounded bg-neutral-800 border-neutral-700 text-indigo-500 focus:ring-0"
                  />
                  <span>Show Cutting Corner Marks</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer text-neutral-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={config.showCenterDashedLine}
                    onChange={(e) =>
                      setConfig((p) => ({ ...p, showCenterDashedLine: e.target.checked }))
                    }
                    className="rounded bg-neutral-800 border-neutral-700 text-indigo-500 focus:ring-0"
                  />
                  <span>Show Center Fold/Cut Line</span>
                </label>
              </div>

              {/* Card Border Options */}
              <div className="pt-2 border-t border-neutral-800/80">
                <span className="text-[10px] text-neutral-400 font-medium block mb-1">
                  Card Border Style
                </span>
                <div className="grid grid-cols-4 gap-1">
                  {(["none", "hairline", "solid", "dashed"] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => setConfig((p) => ({ ...p, cardBorder: b }))}
                      className={`py-1 rounded text-[10px] font-medium border cursor-pointer capitalize ${
                        config.cardBorder === b
                          ? "bg-indigo-600/30 text-indigo-300 border-indigo-500"
                          : "bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* COLUMN 2: ACTIVE CARD ADJUSTMENTS (FRONT VS BACK TABS)    */}
          {/* ========================================================= */}
          <div className="w-80 border-r border-neutral-800 bg-neutral-900/40 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Front / Back Switcher Tabs */}
            <div className="flex rounded-xl bg-neutral-950 p-1 border border-neutral-800">
              <button
                onClick={() => setActiveSideTab("front")}
                className={`flex-1 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  activeSideTab === "front"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-300" />
                <span>Front Controls</span>
              </button>
              <button
                onClick={() => setActiveSideTab("back")}
                className={`flex-1 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                  activeSideTab === "back"
                    ? "bg-violet-600 text-white shadow-md"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-violet-300" />
                <span>Back Controls</span>
              </button>
            </div>

            {/* Quick Actions for Selected Side */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => {
                  setCropTargetSide(activeSideTab);
                  setIsCropModalOpen(true);
                }}
                className="py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 flex items-center justify-center space-x-1 font-medium transition-colors cursor-pointer"
              >
                <Crop className="w-3.5 h-3.5 text-indigo-400" />
                <span>Crop Card</span>
              </button>
              <button
                onClick={() => handleRepeatCard(activeSideTab)}
                className="py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 flex items-center justify-center space-x-1 font-medium transition-colors cursor-pointer"
                title="Duplicate active card to other side"
              >
                <Copy className="w-3.5 h-3.5 text-sky-400" />
                <span>Repeat to Other</span>
              </button>
            </div>

            {/* Physical Card Dimensions (74 mm × 105 mm Default Area) */}
            <div className="space-y-2 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-200 text-[11px]">Card Physical Size</span>
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => setIsAspectLocked((p) => !p)}
                    className={`p-1 rounded text-[10px] border transition-colors cursor-pointer ${
                      isAspectLocked
                        ? "bg-indigo-950 border-indigo-700 text-indigo-300"
                        : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white"
                    }`}
                    title={isAspectLocked ? "Aspect ratio locked" : "Aspect ratio unlocked"}
                  >
                    {isAspectLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => {
                      updateActiveAdjustment({
                        widthMm: DEFAULT_HALF_CARD_WIDTH_MM,
                        heightMm: DEFAULT_HALF_CARD_HEIGHT_MM,
                      });
                    }}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono transition-colors cursor-pointer"
                    title="Reset to default 74 × 105 mm"
                  >
                    reset (74×105)
                  </button>
                </div>
              </div>

              {/* Width mm */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">Width</span>
                  <span className="text-neutral-300 font-mono">{currentAdjustment.widthMm} mm</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="30"
                    max="140"
                    step="0.5"
                    value={currentAdjustment.widthMm}
                    onChange={(e) => handleWidthChange(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-neutral-800 accent-indigo-500 rounded cursor-pointer"
                  />
                  <A6HalfCardNumericInput
                    id={`a6-width-${activeSideTab}`}
                    value={currentAdjustment.widthMm}
                    min={30}
                    max={140}
                    step={0.5}
                    precision={1}
                    unit="mm"
                    onChange={(val) => handleWidthChange(val)}
                    ariaLabel={`${activeSideTab} card width in millimeters`}
                  />
                </div>
              </div>

              {/* Height mm */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">Height</span>
                  <span className="text-neutral-300 font-mono">{currentAdjustment.heightMm} mm</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="30"
                    max="140"
                    step="0.5"
                    value={currentAdjustment.heightMm}
                    onChange={(e) => handleHeightChange(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-neutral-800 accent-indigo-500 rounded cursor-pointer"
                  />
                  <A6HalfCardNumericInput
                    id={`a6-height-${activeSideTab}`}
                    value={currentAdjustment.heightMm}
                    min={30}
                    max={140}
                    step={0.5}
                    precision={1}
                    unit="mm"
                    onChange={(val) => handleHeightChange(val)}
                    ariaLabel={`${activeSideTab} card height in millimeters`}
                  />
                </div>
              </div>

              {/* Automatic Fitting Options */}
              <div className="pt-1.5 space-y-1.5 border-t border-neutral-800/60">
                <span className="text-[10px] text-neutral-400 font-medium block">Automatic Fitting</span>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={handleFitInside74x105}
                    className="py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-medium border border-neutral-700 transition-colors cursor-pointer"
                  >
                    Fit (74×105)
                  </button>
                  <button
                    onClick={handleFill74x105}
                    className="py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-medium border border-neutral-700 transition-colors cursor-pointer"
                  >
                    Fill (74×105)
                  </button>
                  <button
                    onClick={handleStretchToExact}
                    className="py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-medium border border-neutral-700 transition-colors cursor-pointer"
                  >
                    Stretch
                  </button>
                  <button
                    onClick={handleCenterContent}
                    className="py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-medium border border-neutral-700 transition-colors cursor-pointer"
                  >
                    Center
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1 pt-1">
                  <button
                    onClick={handleAutoFitToA6}
                    className="py-1 rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-300 text-[10px] font-medium border border-indigo-800 transition-colors cursor-pointer"
                    title="Maximize to printable A6 bounds"
                  >
                    Auto-Fit to A6
                  </button>
                  <button
                    onClick={handleApplySizeToBoth}
                    className="py-1 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-[10px] border border-neutral-700 transition-colors cursor-pointer"
                  >
                    Apply to Both
                  </button>
                </div>
              </div>
            </div>

            {/* Snapping & Alignment Controls */}
            <div className="space-y-2 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
              <span className="font-bold text-neutral-200 text-[11px] flex items-center space-x-1.5">
                <Move className="w-3.5 h-3.5 text-indigo-400" />
                <span>Alignment &amp; Snapping</span>
              </span>
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={handleSnapUpper}
                  className="py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] border border-neutral-700 flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <ArrowUp className="w-3 h-3 text-indigo-400" />
                  <span>Upper</span>
                </button>
                <button
                  onClick={handleCenterContent}
                  className="py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] border border-neutral-700 flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <AlignCenter className="w-3 h-3 text-emerald-400" />
                  <span>Center</span>
                </button>
                <button
                  onClick={handleSnapLower}
                  className="py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] border border-neutral-700 flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <ArrowDown className="w-3 h-3 text-indigo-400" />
                  <span>Lower</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1 pt-0.5">
                <button
                  onClick={handleSnapTopEdge}
                  className="py-1 rounded bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white text-[10px] border border-neutral-750 cursor-pointer"
                >
                  Snap Top Edge
                </button>
                <button
                  onClick={handleSnapBottomEdge}
                  className="py-1 rounded bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white text-[10px] border border-neutral-750 cursor-pointer"
                >
                  Snap Bottom Edge
                </button>
              </div>
            </div>

            {/* Geometric Orientation & Nudge (Rotation, Zoom, Deskew) */}
            <div className="space-y-3">
              <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                <span>Rotation &amp; Positioning</span>
              </span>

              {/* 90-degree Rotation */}
              <div className="flex items-center justify-between">
                <span className="text-neutral-400 text-[11px]">Rotate Card</span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() =>
                      updateActiveAdjustment({
                        rotation: (currentAdjustment.rotation - 90 + 360) % 360,
                      })
                    }
                    className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
                    title="Rotate 90° Left"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <A6HalfCardNumericInput
                    id={`a6-rotation-${activeSideTab}`}
                    value={currentAdjustment.rotation}
                    min={0}
                    max={360}
                    step={90}
                    precision={0}
                    unit="°"
                    onChange={(val) => updateActiveAdjustment({ rotation: val % 360 })}
                    ariaLabel={`${activeSideTab} card rotation angle`}
                  />
                  <button
                    onClick={() =>
                      updateActiveAdjustment({
                        rotation: (currentAdjustment.rotation + 90) % 360,
                      })
                    }
                    className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
                    title="Rotate 90° Right"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Fine Deskew Slider + Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">Fine Deskew</span>
                  <button
                    onClick={() => updateActiveAdjustment({ deskewAngle: 0 })}
                    className="text-[10px] text-neutral-500 hover:text-indigo-400 font-mono cursor-pointer"
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
                    value={currentAdjustment.deskewAngle}
                    onChange={(e) =>
                      updateActiveAdjustment({ deskewAngle: parseFloat(e.target.value) })
                    }
                    className="flex-1 h-1.5 bg-neutral-800 accent-indigo-500 rounded cursor-pointer"
                  />
                  <A6HalfCardNumericInput
                    id={`a6-deskew-${activeSideTab}`}
                    value={currentAdjustment.deskewAngle}
                    min={-15}
                    max={15}
                    step={0.1}
                    precision={1}
                    unit="°"
                    onChange={(val) => updateActiveAdjustment({ deskewAngle: val })}
                    ariaLabel={`${activeSideTab} card fine deskew in degrees`}
                  />
                </div>
              </div>

              {/* Card Zoom Slider + Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">Card Frame Zoom</span>
                  <button
                    onClick={() => updateActiveAdjustment({ zoom: 1.0 })}
                    className="text-[10px] text-neutral-500 hover:text-indigo-400 font-mono cursor-pointer"
                  >
                    reset (1.0×)
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.05"
                    value={currentAdjustment.zoom}
                    onChange={(e) =>
                      updateActiveAdjustment({ zoom: parseFloat(e.target.value) })
                    }
                    className="flex-1 h-1.5 bg-neutral-800 accent-indigo-500 rounded cursor-pointer"
                  />
                  <A6HalfCardNumericInput
                    id={`a6-zoom-${activeSideTab}`}
                    value={currentAdjustment.zoom}
                    min={0.5}
                    max={3.0}
                    step={0.05}
                    precision={2}
                    unit="×"
                    onChange={(val) => updateActiveAdjustment({ zoom: val })}
                    ariaLabel={`${activeSideTab} card zoom multiplier`}
                  />
                </div>
              </div>

              {/* Offset X & Y Nudge (mm) */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[10px] text-neutral-400 block mb-0.5">X Position (mm)</span>
                  <A6HalfCardNumericInput
                    id={`a6-offsetx-${activeSideTab}`}
                    value={currentAdjustment.offsetX}
                    min={-40}
                    max={40}
                    step={0.5}
                    precision={1}
                    unit="mm"
                    onChange={(val) => updateActiveAdjustment({ offsetX: val })}
                    ariaLabel="Horizontal offset relative to slot center"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block mb-0.5">Y Position (mm)</span>
                  <A6HalfCardNumericInput
                    id={`a6-offsety-${activeSideTab}`}
                    value={currentAdjustment.offsetY}
                    min={-40}
                    max={40}
                    step={0.5}
                    precision={1}
                    unit="mm"
                    onChange={(val) => updateActiveAdjustment({ offsetY: val })}
                    ariaLabel="Vertical offset relative to slot center"
                  />
                </div>
              </div>
            </div>

            {/* Filter Pipeline Sliders & Inputs */}
            <div className="space-y-2.5 border-t border-neutral-800 pt-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-200 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tone &amp; Enhancements</span>
                </span>
                <button
                  onClick={handleResetActiveSide}
                  className="text-[10px] text-neutral-500 hover:text-indigo-400 font-mono cursor-pointer"
                >
                  Reset All
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: "original", label: "Original" },
                  { id: "auto-tone", label: "Auto Tone" },
                  { id: "crisp-bw", label: "Crisp B&W" },
                  { id: "grayscale", label: "Grayscale" },
                  { id: "high-contrast", label: "Contrast" },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleApplyPreset(p.id)}
                    className="py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-medium border border-neutral-700 cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Brightness */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">Brightness</span>
                  <button
                    onClick={() => updateActiveAdjustment({ brightness: 0 })}
                    className="text-[10px] text-neutral-500 hover:text-indigo-400 font-mono cursor-pointer"
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
                    value={currentAdjustment.brightness}
                    onChange={(e) =>
                      updateActiveAdjustment({ brightness: parseInt(e.target.value, 10) })
                    }
                    className="flex-1 h-1.5 bg-neutral-800 accent-indigo-500 rounded cursor-pointer"
                  />
                  <A6HalfCardNumericInput
                    id={`a6-brightness-${activeSideTab}`}
                    value={currentAdjustment.brightness}
                    min={-100}
                    max={100}
                    step={1}
                    precision={0}
                    onChange={(val) => updateActiveAdjustment({ brightness: val })}
                    ariaLabel="Brightness numeric adjustment"
                  />
                </div>
              </div>

              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">Contrast</span>
                  <button
                    onClick={() => updateActiveAdjustment({ contrast: 0 })}
                    className="text-[10px] text-neutral-500 hover:text-indigo-400 font-mono cursor-pointer"
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
                    value={currentAdjustment.contrast}
                    onChange={(e) =>
                      updateActiveAdjustment({ contrast: parseInt(e.target.value, 10) })
                    }
                    className="flex-1 h-1.5 bg-neutral-800 accent-indigo-500 rounded cursor-pointer"
                  />
                  <A6HalfCardNumericInput
                    id={`a6-contrast-${activeSideTab}`}
                    value={currentAdjustment.contrast}
                    min={-100}
                    max={100}
                    step={1}
                    precision={0}
                    onChange={(val) => updateActiveAdjustment({ contrast: val })}
                    ariaLabel="Contrast numeric adjustment"
                  />
                </div>
              </div>

              {/* Gamma Curve */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">Gamma Curve</span>
                  <button
                    onClick={() => updateActiveAdjustment({ gamma: 1.0 })}
                    className="text-[10px] text-neutral-500 hover:text-indigo-400 font-mono cursor-pointer"
                  >
                    reset (1.0)
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.05"
                    value={currentAdjustment.gamma}
                    onChange={(e) =>
                      updateActiveAdjustment({ gamma: parseFloat(e.target.value) })
                    }
                    className="flex-1 h-1.5 bg-neutral-800 accent-indigo-500 rounded cursor-pointer"
                  />
                  <A6HalfCardNumericInput
                    id={`a6-gamma-${activeSideTab}`}
                    value={currentAdjustment.gamma}
                    min={0.2}
                    max={3.0}
                    step={0.05}
                    precision={2}
                    onChange={(val) => updateActiveAdjustment({ gamma: val })}
                    ariaLabel="Gamma curve numeric adjustment"
                  />
                </div>
              </div>

              {/* Unsharp Mask (Sharpness) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">Unsharp Mask</span>
                  <button
                    onClick={() => updateActiveAdjustment({ sharpness: 0 })}
                    className="text-[10px] text-neutral-500 hover:text-indigo-400 font-mono cursor-pointer"
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
                    value={currentAdjustment.sharpness}
                    onChange={(e) =>
                      updateActiveAdjustment({ sharpness: parseInt(e.target.value, 10) })
                    }
                    className="flex-1 h-1.5 bg-neutral-800 accent-indigo-500 rounded cursor-pointer"
                  />
                  <A6HalfCardNumericInput
                    id={`a6-sharpness-${activeSideTab}`}
                    value={currentAdjustment.sharpness}
                    min={0}
                    max={100}
                    step={1}
                    precision={0}
                    onChange={(val) => updateActiveAdjustment({ sharpness: val })}
                    ariaLabel="Unsharp mask numeric adjustment"
                  />
                </div>
              </div>

              {/* Grayscale Toggle */}
              <label className="flex items-center space-x-2 pt-1 cursor-pointer text-neutral-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={currentAdjustment.grayscale}
                  onChange={(e) => updateActiveAdjustment({ grayscale: e.target.checked })}
                  className="rounded bg-neutral-800 border-neutral-700 text-indigo-500 focus:ring-0"
                />
                <span>Convert to Monochrome / Grayscale</span>
              </label>
            </div>
          </div>

          {/* ========================================================= */}
          {/* COLUMN 3: INTERACTIVE A6 PREVIEW CANVAS                   */}
          {/* ========================================================= */}
          <div className="flex-1 bg-neutral-950 flex flex-col relative overflow-hidden">
            {/* Top Preview Controls Bar */}
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-neutral-800 bg-neutral-900/80">
              <div className="flex items-center space-x-3">
                {/* Multi-page switcher if in Mode C */}
                {config.layoutMode === "mode-c-separate-pages" && (
                  <div className="flex items-center space-x-1.5 bg-neutral-950 px-2 py-1 rounded-lg border border-neutral-800">
                    <button
                      onClick={() => setActivePreviewPageIndex(0)}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                        activePreviewPageIndex === 0
                          ? "bg-indigo-600 text-white"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      Page 1: Front
                    </button>
                    <button
                      onClick={() => setActivePreviewPageIndex(1)}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                        activePreviewPageIndex === 1
                          ? "bg-violet-600 text-white"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      Page 2: Back
                    </button>
                  </div>
                )}

                <div className="text-[11px] text-neutral-400 font-mono">
                  ISO 216 A6 ({currentSheetDim.widthMm} × {currentSheetDim.heightMm} mm)
                </div>

                {layout.pages[activePreviewPageIndex]?.hasOverflowWarning && (
                  <div className="flex items-center space-x-1 text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Warning: Card boundaries exceed sheet printable area</span>
                  </div>
                )}
              </div>

              {/* Preview Mode Tool & Center-Based Zoom Controls */}
              <div className="flex items-center space-x-2">
                {/* Tool Selector: Select vs Hand/Pan */}
                <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded p-0.5 mr-1">
                  <button
                    onClick={() => setPreviewTool("select")}
                    className={`p-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      previewTool === "select"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-neutral-400 hover:text-white"
                    }`}
                    title="Select Mode (V)"
                  >
                    <MousePointer className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewTool("hand")}
                    className={`p-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      previewTool === "hand"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-neutral-400 hover:text-white"
                    }`}
                    title="Hand / Pan Mode (H or Space+Drag)"
                  >
                    <Hand className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => setPreviewZoom((p) => Math.max(0.4, Number((p - 0.1).toFixed(2))))}
                  className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                  title="Zoom Out Preview (-)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-neutral-300 text-[11px] w-12 text-center">
                  {Math.round(previewZoom * 100)}%
                </span>
                <button
                  onClick={() => setPreviewZoom((p) => Math.min(3.0, Number((p + 0.1).toFixed(2))))}
                  className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                  title="Zoom In Preview (+)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleFitWidth}
                  className="px-1.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono transition-colors cursor-pointer"
                  title="Fit to Width (2)"
                >
                  Fit W
                </button>
                <button
                  onClick={handleFitHeight}
                  className="px-1.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono transition-colors cursor-pointer"
                  title="Fit to Height (3)"
                >
                  Fit H
                </button>
                <button
                  onClick={() => setPreviewZoom(1.0)}
                  className="px-1.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono transition-colors cursor-pointer"
                  title="Actual Size 100% (1)"
                >
                  100%
                </button>
                <button
                  onClick={handleResetPreview}
                  className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono transition-colors cursor-pointer"
                  title="Reset Pan & Zoom (0)"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Canvas Container Viewport with Center-Based Zoom & Panning */}
            <div
              ref={viewportRef}
              className={`flex-1 overflow-hidden flex items-center justify-center p-8 relative select-none ${
                isCanvasDragging
                  ? "cursor-grabbing"
                  : isSpacePressed || previewTool === "hand"
                  ? "cursor-grab"
                  : "cursor-default"
              }`}
              onPointerDown={handleViewportPointerDown}
              onPointerMove={handleViewportPointerMove}
              onPointerUp={handleViewportPointerUp}
              onPointerCancel={handleViewportPointerUp}
              onContextMenu={(e) => {
                if (isCanvasDraggingRef.current) e.preventDefault();
              }}
            >
              {isRendering && (
                <div className="absolute top-4 right-4 z-20 flex items-center space-x-1.5 bg-neutral-900/90 border border-neutral-750 px-2.5 py-1 rounded-full text-[10px] text-neutral-300 shadow-lg">
                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                  <span>Updating Sheet...</span>
                </div>
              )}

              {/* Physical A6 Preview Board */}
              <div
                className="relative shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-neutral-800 rounded-sm bg-white transition-transform duration-75 ease-out select-none"
                style={{
                  transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${previewZoom})`,
                  transformOrigin: "center center",
                }}
              >
                <canvas ref={previewCanvasRef} className="block pointer-events-none" />
              </div>
            </div>

            {/* Bottom Status & Measurement Ruler Bar */}
            <div className="px-5 py-2 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
              <div className="flex items-center space-x-4">
                <span>
                  Slot Target:{" "}
                  <strong className="text-neutral-200">
                    {config.front.widthMm} × {config.front.heightMm} mm
                  </strong>
                </span>
                <span>
                  Orientation: <strong className="text-neutral-200">{config.orientation}</strong>
                </span>
                <span>
                  Mode: <strong className="text-indigo-400">{config.layoutMode}</strong>
                </span>
              </div>
              <div className="flex items-center space-x-3 text-neutral-500">
                <span>Pan: {previewTool === "hand" || isSpacePressed ? "Active" : "Hold Space or Middle Click"}</span>
                <span>•</span>
                <span>Zoom: {Math.round(previewZoom * 100)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-2xl z-50 flex items-center space-x-2 animate-slideUp">
            <Check className="w-4 h-4 text-white shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>

      {/* PDF Multi-Page Selector Modal */}
      {pdfPickerState.isOpen && (
        <A6PdfPagePickerModal
          isOpen={pdfPickerState.isOpen}
          side={pdfPickerState.side}
          fileName={
            (pdfPickerState.side === "front" ? frontPdf?.fileName : backPdf?.fileName) ||
            "Uploaded PDF Document"
          }
          pdfDoc={pdfPickerState.side === "front" ? frontPdf?.pdfDoc ?? null : backPdf?.pdfDoc ?? null}
          currentPage={
            (pdfPickerState.side === "front" ? frontPdf?.activePage : backPdf?.activePage) || 1
          }
          onSelectPage={(pageNum) => handleSelectPdfPage(pdfPickerState.side, pageNum)}
          onClose={() => setPdfPickerState({ isOpen: false, side: "front" })}
        />
      )}

      {/* Dedicated Card Crop Modal with Independent State */}
      {isCropModalOpen && (
        <A6HalfCardCropModal
          isOpen={isCropModalOpen}
          cardSide={cropTargetSide}
          imageSrc={cropTargetSide === "front" ? (frontRawImage || frontImage) : (backRawImage || backImage)}
          targetWidthMm={
            cropTargetSide === "front" ? config.front.widthMm : config.back.widthMm
          }
          targetHeightMm={
            cropTargetSide === "front" ? config.front.heightMm : config.back.heightMm
          }
          initialCropState={cropTargetSide === "front" ? frontCropState : backCropState}
          onApplyCrop={(croppedUrl, cropState) => {
            if (cropTargetSide === "front") {
              setFrontImage(croppedUrl);
              if (cropState) setFrontCropState(cropState);
              showToast("Cropped Front card image.");
            } else {
              setBackImage(croppedUrl);
              if (cropState) setBackCropState(cropState);
              showToast("Cropped Back card image.");
            }
          }}
          onClose={() => setIsCropModalOpen(false)}
        />
      )}
    </div>
  );
};
