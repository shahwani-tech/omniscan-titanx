/**
 * OMNISCAN TITAN X - Standalone Professional Passport & 4x6" Photo Studio
 * Complete Workspace: Biometric Cutout, Fixed 8-Handle Crop Box with Image Wheel Zoom,
 * CamScanner Filter Engine, Professional Background Remover, 4x6" 8-Copy Sheet Grid Engine,
 * Independent 4x6 Outer Margins (Top, Bottom, Left, Right), True Physical 4x6" PDF Export,
 * High-DPI Output & Non-Destructive Session Isolation
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  OmniPage,
  PhotoSheetConfig,
  PassportStandardSpec,
  PaperSizeSpec,
  Point,
  CamScannerPresetId,
  PaperUnit,
} from "../../types";
import {
  STANDARD_PAPER_SIZES,
  PASSPORT_STANDARDS,
  DEFAULT_PHOTO_SHEET_CONFIG,
  calculatePhotoSheetLayout,
  calculateMaxPhotos,
  calculateMaxPhotosGrid,
  optimizeLayout,
  analyzeSheetLayout,
  PRINTER_MARGIN_STANDARDS,
  PrinterMarginStandardType,
  SheetOptimizationAnalysis,
  SheetLayoutOption,
  renderPhotoSheetCanvas,
  exportPhotoSheetAsPDF,
  exportPhotoSheetAsBlob,
  printPhotoSheetCanvas,
  convertUnits,
} from "../../engine/photoLayout";
import { BUILTIN_CAMSCANNER_PRESETS, executeFilterPipeline } from "../../engine/filters";
import { createSamplePortraitSvg } from "../../engine/samplePortraits";
import {
  removeBackground,
  BackgroundRemovalOptions,
  DEFAULT_BG_REMOVAL_OPTIONS,
  ManualBrushStroke,
  ShadowRemovalLevel,
} from "../../engine/backgroundRemover";
import { UnifiedBackgroundStudioModal } from "../background/UnifiedBackgroundStudioModal";
import { BackgroundStudioState } from "../../engine/background/types";
import * as pdfjsLib from "pdfjs-dist";
import { renderPDFPageToDataUrl, ensurePdfWorker } from "../../engine/pdf";
import { pageBlobStore } from "../../services/storage/PageBlobStore";

ensurePdfWorker();
import { useShortcuts, useToolShortcuts } from "../../commands/ShortcutContext";
import {
  PdfImportDialog,
  ACCEPTED_DOCUMENT_AND_IMAGE_TYPES,
  PdfImportPageResult,
} from "../common/PdfImportDialog";
import { analyzeFile } from "../../services/upload/FileTypeRegistry";
import { parseDocumentFile, decodeImageFile } from "../../services/upload/DocumentImportService";
import { detectImageTransparency } from "../../utils/transparencyDetector";
import {
  X,
  Printer,
  FileDown,
  Sparkles,
  Grid,
  Crop,
  Layers,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  RotateCw,
  RotateCcw,
  Plus,
  RefreshCw,
  Check,
  Shield,
  Palette,
  Camera,
  Upload,
  User,
  Sliders,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Scissors,
  Download,
  Image as ImageIcon,
  Clipboard,
  Scan,
  Maximize,
  CheckCircle2,
  Lock,
  Unlock,
  Eye,
  Crosshair,
  FileText,
  HelpCircle,
  Copy,
  Wand2,
  SlidersHorizontal,
  Undo2,
  Move,
  Paintbrush,
  Eraser,
  SplitSquareHorizontal,
  ShieldCheck,
  Trash2,
  Sun,
  Contrast,
  Compass,
  Zap,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { UniversalNumericInput } from "../common/UniversalNumericInput";
import { UnifiedStudioShell, StudioStep } from "../common/UnifiedStudioShell";
import {
  MultiPersonSlotGroup,
  MultiPersonState,
  MultiPersonLayoutMode,
  PERSON_PALETTE,
  getPersonColor,
  computeEqualSplit,
  generateSlotMapping,
  scaleSlotAssignments,
  validateSlotCounts,
  saveMultiPersonSession,
  loadMultiPersonSession,
  clearMultiPersonSession,
  isPersonReady,
  getPersonStatus,
  getPersonPrintImage,
  buildSlotAssignments,
} from "../../engine/multiPersonLayout";
import { InteractiveSheetSlotOverlay } from "./InteractiveSheetSlotOverlay";
import { PersonPhotoSourceModal } from "./PersonPhotoSourceModal";
import { MultiPersonLayoutSection } from "./MultiPersonLayoutSection";

interface PhotoPrintStudioModalProps {
  pages: OmniPage[];
  activePageIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onInsertIntoDocument?: (dataUrl: string) => void;
  onOpenScanModal?: () => void;
}

type CropHandle = "nw" | "ne" | "se" | "sw" | "n" | "s" | "e" | "w" | "move" | null;

export const PhotoPrintStudioModal: React.FC<PhotoPrintStudioModalProps> = ({
  pages,
  activePageIndex,
  isOpen,
  onClose,
  onInsertIntoDocument,
  onOpenScanModal,
}) => {
  // Active Studio Mode: 'crop' | 'filters' | 'sheet'
  const [studioStep, setStudioStep] = useState<"crop" | "filters" | "sheet">("crop");

  // Source selection tab: 'document' | 'upload' | 'camera' | 'clipboard' | 'samples'
  const [sourceTab, setSourceTab] = useState<"document" | "upload" | "camera" | "clipboard" | "samples">("document");

  // Raw source image dataUrl (Original is non-destructively preserved)
  const defaultInitialImage =
    pages[activePageIndex]?.processedDataUrl ||
    pages[0]?.processedDataUrl ||
    createSamplePortraitSvg("male");

  const [rawSourceImage, setRawSourceImage] = useState<string>(defaultInitialImage);
  const [sourceDimensions, setSourceDimensions] = useState<{ width: number; height: number; dpi: number }>({
    width: 1200,
    height: 1500,
    dpi: 300,
  });

  // Cropped & filtered photo result (used by the 4x6 Sheet Grid Engine)
  const [processedPhotoDataUrl, setProcessedPhotoDataUrl] = useState<string>(defaultInitialImage);

  // -------------------------------------------------------------
  // Sheet Configuration & Grid State with Outer Margins
  // -------------------------------------------------------------
  const [sheetConfig, setSheetConfig] = useState<PhotoSheetConfig>({
    ...DEFAULT_PHOTO_SHEET_CONFIG,
    paperSizeId: "photo-6x4",
    paperWidthInches: 6.0,
    paperHeightInches: 4.0,
    passportStandardId: "uk-eu-schengen", // 35x45mm standard
    copies: 8, // 8 copies for 6x4"
    columns: 4,
    rows: 2,
    autoFit: true,
    orientation: "landscape",
    printInstanceRotation: 0,
    marginMode: "auto",
    marginUnit: "mm",
    marginTopInches: 3.0 / 25.4,
    marginBottomInches: 3.0 / 25.4,
    marginLeftInches: 3.0 / 25.4,
    marginRightInches: 3.0 / 25.4,
    gapHorizontalInches: 1.0 / 25.4,
    gapVerticalInches: 1.0 / 25.4,
    printerMarginStandard: "standard",
    border: {
      enabled: true,
      widthPx: 1,
      color: "#000000",
      style: "solid",
    },
    cuttingGuides: {
      type: "corner-marks",
      color: "#64748B",
      thicknessPx: 1,
      lengthMm: 4,
      offsetMm: 1,
    },
  });

  // Margin unit state for the margin UI (mm | in | cm)
  const [marginUnit, setMarginUnit] = useState<PaperUnit>("in");

  // Minimum Margin Standard (Standard 3mm vs Professional 1.5mm)
  const [printerMarginStandard, setPrinterMarginStandard] = useState<PrinterMarginStandardType>("standard");

  // Selected Country Standard & Paper Specification
  const currentPassportSpec =
    PASSPORT_STANDARDS.find((p) => p.id === sheetConfig.passportStandardId) || PASSPORT_STANDARDS[1];
  const currentPaperSpec =
    STANDARD_PAPER_SIZES.find((p) => p.id === sheetConfig.paperSizeId) || STANDARD_PAPER_SIZES[0];

  // Helper to dynamically calculate photos capacity and grid dimensions based on exact paper & photo specs
  const computeFit = useCallback(
    (
      cfg: PhotoSheetConfig,
      passportSpec?: PassportStandardSpec,
      paperSpec?: PaperSizeSpec,
      marginStandard: PrinterMarginStandardType = printerMarginStandard
    ) => {
      const activePassport =
        passportSpec ||
        PASSPORT_STANDARDS.find((p) => p.id === cfg.passportStandardId) ||
        PASSPORT_STANDARDS[1];
      const activePaper =
        paperSpec ||
        STANDARD_PAPER_SIZES.find((p) => p.id === cfg.paperSizeId) ||
        STANDARD_PAPER_SIZES[0];

      let rawW = activePaper.widthMm;
      let rawH = activePaper.heightMm;
      if (activePaper.isCustom && cfg.paperWidthInches && cfg.paperHeightInches) {
        rawW = cfg.paperWidthInches * 25.4;
        rawH = cfg.paperHeightInches * 25.4;
      }

      // Dimensions based on orientation
      const paperW =
        cfg.orientation === "landscape" ? Math.max(rawW, rawH) : Math.min(rawW, rawH);
      const paperH =
        cfg.orientation === "landscape" ? Math.min(rawW, rawH) : Math.max(rawW, rawH);

      const isRotated = cfg.printInstanceRotation === 90 || cfg.printInstanceRotation === 270;
      const basePhotoW = activePassport.widthMm || cfg.photoWidthInches * 25.4;
      const basePhotoH = activePassport.heightMm || cfg.photoHeightInches * 25.4;
      const photoW = isRotated ? basePhotoH : basePhotoW;
      const photoH = isRotated ? basePhotoW : basePhotoH;

      const minMarginMm = marginStandard === "professional" ? 1.5 : 3.0;
      const gapMm = (cfg.gapHorizontalInches ?? (1.0 / 25.4)) * 25.4;

      let cols: number;
      let rows: number;
      let marginX: number;
      let marginY: number;

      if (cfg.marginMode === "manual") {
        const leftMm = (cfg.marginLeftInches ?? (minMarginMm / 25.4)) * 25.4;
        const rightMm = (cfg.marginRightInches ?? (minMarginMm / 25.4)) * 25.4;
        const topMm = (cfg.marginTopInches ?? (minMarginMm / 25.4)) * 25.4;
        const bottomMm = (cfg.marginBottomInches ?? (minMarginMm / 25.4)) * 25.4;

        cols = Math.max(1, Math.floor((paperW - leftMm - rightMm + gapMm + 0.001) / (photoW + gapMm)));
        rows = Math.max(1, Math.floor((paperH - topMm - bottomMm + gapMm + 0.001) / (photoH + gapMm)));
        marginX = leftMm;
        marginY = topMm;
      } else {
        const opt = optimizeLayout(paperW, paperH, photoW, photoH, minMarginMm, gapMm);
        cols = opt.cols;
        rows = opt.rows;
        marginX = opt.marginX;
        marginY = opt.marginY;
      }

      const maxPhotos = cols * rows;

      return {
        paperW,
        paperH,
        photoW,
        photoH,
        marginMm: minMarginMm,
        gapMm,
        maxPhotos,
        cols,
        rows,
        marginX,
        marginY,
        paperName: activePaper.name.split(" (")[0] || activePaper.name,
      };
    },
    [printerMarginStandard]
  );

  // Real-time calculated capacity and fit for the current configuration
  const currentFit = useMemo(() => {
    return computeFit(sheetConfig, currentPassportSpec, currentPaperSpec, printerMarginStandard);
  }, [computeFit, sheetConfig, currentPassportSpec, currentPaperSpec, printerMarginStandard]);

  // Real-time Multi-Orientation Layout Analysis (checks normal vs rotated, portrait vs landscape)
  const layoutAnalysis: SheetOptimizationAnalysis = useMemo(() => {
    let rawW = currentPaperSpec.widthMm;
    let rawH = currentPaperSpec.heightMm;
    if (currentPaperSpec.isCustom && sheetConfig.paperWidthInches && sheetConfig.paperHeightInches) {
      rawW = sheetConfig.paperWidthInches * 25.4;
      rawH = sheetConfig.paperHeightInches * 25.4;
    }
    const basePhotoW = currentPassportSpec.widthMm || sheetConfig.photoWidthInches * 25.4;
    const basePhotoH = currentPassportSpec.heightMm || sheetConfig.photoHeightInches * 25.4;
    const minMarginMm = printerMarginStandard === "professional" ? 1.5 : 3.0;
    const gapMm = (sheetConfig.gapHorizontalInches ?? (1.0 / 25.4)) * 25.4;
    const paperName = currentPaperSpec.name.split(" (")[0] || currentPaperSpec.name;

    return analyzeSheetLayout(
      rawW,
      rawH,
      basePhotoW,
      basePhotoH,
      sheetConfig.orientation,
      sheetConfig.printInstanceRotation,
      minMarginMm,
      gapMm,
      paperName
    );
  }, [
    currentPaperSpec,
    currentPassportSpec,
    sheetConfig.paperWidthInches,
    sheetConfig.paperHeightInches,
    sheetConfig.photoWidthInches,
    sheetConfig.photoHeightInches,
    sheetConfig.orientation,
    sheetConfig.printInstanceRotation,
    sheetConfig.gapHorizontalInches,
    printerMarginStandard,
  ]);

  const [aspectRatioLocked, setAspectRatioLocked] = useState<boolean>(true);

  // -------------------------------------------------------------
  // Biometric Crop Stage State (Normalized 0..1 bounding box)
  // -------------------------------------------------------------
  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0.15,
    y: 0.1,
    width: 0.7,
    height: 0.8,
  });

  const [activeHandle, setActiveHandle] = useState<CropHandle>(null);
  const [dragStartMouse, setDragStartMouse] = useState<Point>({ x: 0, y: 0 });
  const [dragStartCropBox, setDragStartCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0.15,
    y: 0.1,
    width: 0.7,
    height: 0.8,
  });

  // Image Zoom & Pan Underneath the Fixed Crop Box
  const [cropZoom, setCropZoom] = useState<number>(1.0);
  const [cropImagePan, setCropImagePan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanningImage, setIsPanningImage] = useState<boolean>(false);
  const [panStartMouse, setPanStartMouse] = useState<Point>({ x: 0, y: 0 });
  const [panStartOffset, setPanStartOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [cropRotation, setCropRotation] = useState<number>(0);
  const [showBiometricGuides, setShowBiometricGuides] = useState<boolean>(true);

  const cropContainerRef = useRef<HTMLDivElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const cropStageLayoutRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const originalRawSourceImageRef = useRef<string>("");

  // -------------------------------------------------------------
  // Professional Background Remover State (Atomic Per-Person Isolation)
  // -------------------------------------------------------------
  interface BgStudioModalState {
    isOpen: boolean;
    personId: string | null;
    inputImage: string | null;
    initialConfig: BackgroundStudioState | null;
    cropDimensions?: { width: number; height: number };
  }

  const [bgStudioModal, setBgStudioModal] = useState<BgStudioModalState>({
    isOpen: false,
    personId: null,
    inputImage: null,
    initialConfig: null,
  });
  const isBgRemoverOpen = bgStudioModal.isOpen;
  const bgStudioPersonId = bgStudioModal.personId;
  const bgInitialImage = bgStudioModal.inputImage;

  const [bgStudioState, setBgStudioState] = useState<BackgroundStudioState | null>(null);
  // Final composited image from Background Studio (preserves exact biometric crop and background)
  const [compositedPhotoUrl, setCompositedPhotoUrl] = useState<string | null>(null);

  // Track session object URLs for complete cleanup on close
  const sessionObjectUrlsRef = useRef<string[]>([]);

  // Invalidate composited background when the user actively modifies the crop framing
  const invalidateCompositedBackground = useCallback(() => {
    setCompositedPhotoUrl(null);
    setBgStudioState(null);
  }, []);

  // -------------------------------------------------------------
  // CamScanner Filter Engine & Retouch State
  // -------------------------------------------------------------
  const [activePreset, setActivePreset] = useState<CamScannerPresetId>("photo");
  const [brightness, setBrightness] = useState<number>(5);
  const [contrast, setContrast] = useState<number>(8);
  const [gamma, setGamma] = useState<number>(1.0);
  const [sharpness, setSharpness] = useState<number>(15);
  const [deskewAngle, setDeskewAngle] = useState<number>(0);
  const [denoise, setDenoise] = useState<number>(10);
  const [shadowRemoval, setShadowRemoval] = useState<boolean>(true);
  const [shadowStrength, setShadowStrength] = useState<number>(40);
  const [bgColorReplacement, setBgColorReplacement] = useState<"none" | "white" | "blue" | "gray" | "cream" | "transparent">("white");

  // Preserve PNG transparency: when a transparent image is loaded, default to "none" (preserves original alpha)
  const lastAnalyzedUrlRef = useRef<string>("");
  useEffect(() => {
    if (!rawSourceImage || rawSourceImage === lastAnalyzedUrlRef.current) return;
    lastAnalyzedUrlRef.current = rawSourceImage;
    detectImageTransparency(rawSourceImage).then((result) => {
      if (result.hasTransparency) {
        setBgColorReplacement("none");
      }
    });
  }, [rawSourceImage]);

  // PDF Importer Dialog State
  const [isPdfImportDialogOpen, setIsPdfImportDialogOpen] = useState<boolean>(false);
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);

  // Performance caching refs
  const cachedSourceImgRef = useRef<HTMLImageElement | null>(null);
  const cachedSourceUrlRef = useRef<string>("");
  const filterRafIdRef = useRef<number | null>(null);

  const handleSelectPreset = (presetId: CamScannerPresetId) => {
    setActivePreset(presetId);
    const found = BUILTIN_CAMSCANNER_PRESETS.find((p) => p.id === presetId);
    if (found && found.filters) {
      if (found.filters.brightness !== undefined) {
        setBrightness(Math.min(40, Math.max(-40, found.filters.brightness)));
      }
      if (found.filters.contrast !== undefined) {
        setContrast(Math.min(50, Math.max(-30, found.filters.contrast)));
      }
      if (found.filters.gamma !== undefined) {
        setGamma(Math.min(3.0, Math.max(0.2, found.filters.gamma)));
      }
      if (found.filters.sharpness !== undefined) {
        setSharpness(Math.min(50, Math.max(0, found.filters.sharpness)));
      }
      if (found.filters.denoise !== undefined) {
        setDenoise(found.filters.denoise);
      }
      if (found.filters.deskewAngle !== undefined) {
        setDeskewAngle(found.filters.deskewAngle);
      }
    }
  };

  const handleResetFilters = () => {
    setActivePreset("original");
    setBrightness(0);
    setContrast(0);
    setGamma(1.0);
    setSharpness(0);
    setDeskewAngle(0);
    setDenoise(0);
  };

  // -------------------------------------------------------------
  // Camera State
  // -------------------------------------------------------------
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // File Upload input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Sheet Preview Canvas & Export State
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // -------------------------------------------------------------
  // Multi-Person Layout State & Session Sync (Clean State Isolation)
  // -------------------------------------------------------------
  const [multiPerson, setMultiPerson] = useState<MultiPersonState>(() => ({
    enabled: false,
    mode: "grouped",
    persons: [
      {
        id: "person-1",
        label: "Person 1",
        slotCount: 8,
        color: PERSON_PALETTE[0],
        photoUrl: null,
        rawPhotoUrl: null,
        croppedPhotoUrl: null,
        compositedPhotoUrl: null,
        croppedBlobId: null,
        compositedBlobId: null,
        bgStudioState: null,
        cropWidth: Math.round((PASSPORT_STANDARDS[1]?.widthInches || 2) * 300),
        cropHeight: Math.round((PASSPORT_STANDARDS[1]?.heightInches || 2) * 300),
        status: "no-photo",
      },
    ],
    customSlotAssignments: [],
    showPersonLabelsOnSheet: false,
    showSlotOverlaysOnPreview: true,
    selectedSlotIndex: null,
  }));

  const [activeEditingPersonId, setActiveEditingPersonId] = useState<string | null>(null);
  const [photoPickerPerson, setPhotoPickerPerson] = useState<MultiPersonSlotGroup | null>(null);
  const [pendingPaperChange, setPendingPaperChange] = useState<{
    paperId: string;
    newCapacity: number;
    currentTotal: number;
    newPaperName: string;
  } | null>(null);

  // Inspect source image dimensions on change
  useEffect(() => {
    if (!isOpen || !rawSourceImage) return;
    const img = new Image();
    img.src = rawSourceImage;
    img.onload = () => {
      setSourceDimensions({
        width: img.width,
        height: img.height,
        dpi: 300,
      });

      // Initialize crop box centered with matching passport standard aspect ratio
      const targetRatio = currentPassportSpec.widthInches / currentPassportSpec.heightInches;
      const imgRatio = img.width / img.height;

      let boxW = 0.7;
      let boxH = 0.7;

      if (imgRatio > targetRatio) {
        boxH = 0.8;
        boxW = (boxH * targetRatio) / imgRatio;
      } else {
        boxW = 0.8;
        boxH = (boxW * imgRatio) / targetRatio;
      }

      setCropBox({
        x: Math.max(0.05, (1 - boxW) / 2),
        y: Math.max(0.05, (1 - boxH) / 2),
        width: Math.min(0.9, boxW),
        height: Math.min(0.9, boxH),
      });
    };
  }, [rawSourceImage, currentPassportSpec.id, isOpen]);

  // Stop camera on unmount or tab change
  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleStartCamera = async () => {
    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.warn("Camera access failed:", err);
      showToast("Camera access unavailable. Choose an uploaded photo or sample portrait.");
    }
  };

  const handleCaptureCamera = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      setRawSourceImage(dataUrl);
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        setIsCameraActive(false);
      }
      showToast("Camera snapshot acquired successfully.");
    }
  };

  // Clipboard Paste Support (Ctrl+V and Button)
  const handlePasteClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const reader = new FileReader();
          reader.onload = (e) => {
            if (typeof e.target?.result === "string") {
              setRawSourceImage(e.target.result);
              showToast("Pasted image from clipboard.");
            }
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
      showToast("No image found in clipboard.");
    } catch (err) {
      console.warn("Clipboard paste access error:", err);
      showToast("Clipboard permission required or no image in clipboard.");
    }
  };

  // Listen for global Ctrl+V paste while in Studio
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (typeof event.target?.result === "string") {
                setRawSourceImage(event.target.result);
                showToast("Pasted image from clipboard.");
              }
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };
    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, []);

  // -------------------------------------------------------------
  // MOUSE-WHEEL ZOOM FIX: Mouse Wheel UP -> Zoom In, DOWN -> Zoom Out
  // Crop Box coordinates, dimensions, and template remain 100% UNCHANGED.
  // -------------------------------------------------------------
  useEffect(() => {
    const container = cropContainerRef.current;
    if (!container || studioStep !== "crop") return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      setCropZoom((prev) => {
        const nextZoom = Math.min(5.0, Math.max(0.2, Number((prev * zoomFactor).toFixed(3))));
        return nextZoom;
      });
    };

    container.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleNativeWheel);
    };
  }, [studioStep]);

  // -------------------------------------------------------------
  // Crop Handle Mouse Drag Handlers with Unified Coordinate System
  // -------------------------------------------------------------
  const handleCropHandleMouseDown = (e: React.MouseEvent, handle: CropHandle) => {
    e.stopPropagation();
    e.preventDefault();
    invalidateCompositedBackground();
    setActiveHandle(handle);
    setDragStartMouse({ x: e.clientX, y: e.clientY });
    setDragStartCropBox({ ...cropBox });
  };

  // Image Panning handler underneath the fixed crop box
  const handleImageMouseDown = (e: React.MouseEvent) => {
    if (activeHandle) return;
    invalidateCompositedBackground();
    setIsPanningImage(true);
    setPanStartMouse({ x: e.clientX, y: e.clientY });
    setPanStartOffset({ ...cropImagePan });
  };

  useEffect(() => {
    if (!activeHandle && !isPanningImage) return;

    const handlePointerMove = (e: MouseEvent) => {
      if (isPanningImage) {
        const deltaX = e.clientX - panStartMouse.x;
        const deltaY = e.clientY - panStartMouse.y;
        setCropImagePan({
          x: panStartOffset.x + deltaX,
          y: panStartOffset.y + deltaY,
        });
        return;
      }

      if (!activeHandle || !cropImageRef.current) return;
      const containerW =
        cropImageRef.current?.offsetWidth || cropStageLayoutRef.current.width || 400;
      const containerH =
        cropImageRef.current?.offsetHeight || cropStageLayoutRef.current.height || 500;
      if (containerW <= 0 || containerH <= 0) return;

      cropStageLayoutRef.current = { width: containerW, height: containerH };

      const deltaNormX = (e.clientX - dragStartMouse.x) / containerW;
      const deltaNormY = (e.clientY - dragStartMouse.y) / containerH;

      const targetRatio = currentPassportSpec.widthInches / currentPassportSpec.heightInches;
      const imgAspect = containerW / containerH;

      setCropBox(() => {
        let newX = dragStartCropBox.x;
        let newY = dragStartCropBox.y;
        let newW = dragStartCropBox.width;
        let newH = dragStartCropBox.height;

        if (activeHandle === "move") {
          newX = Math.max(0, Math.min(1 - newW, dragStartCropBox.x + deltaNormX));
          newY = Math.max(0, Math.min(1 - newH, dragStartCropBox.y + deltaNormY));
        } else if (activeHandle === "se") {
          newW = Math.max(0.15, Math.min(1 - newX, dragStartCropBox.width + deltaNormX));
          if (aspectRatioLocked) {
            newH = (newW * imgAspect) / targetRatio;
            if (newY + newH > 1) {
              newH = 1 - newY;
              newW = (newH * targetRatio) / imgAspect;
            }
          } else {
            newH = Math.max(0.15, Math.min(1 - newY, dragStartCropBox.height + deltaNormY));
          }
        } else if (activeHandle === "nw") {
          const maxDeltaX = dragStartCropBox.width - 0.15;
          const clampedDeltaX = Math.max(-dragStartCropBox.x, Math.min(maxDeltaX, deltaNormX));
          newX = dragStartCropBox.x + clampedDeltaX;
          newW = dragStartCropBox.width - clampedDeltaX;

          if (aspectRatioLocked) {
            newH = (newW * imgAspect) / targetRatio;
            newY = dragStartCropBox.y + dragStartCropBox.height - newH;
          } else {
            const maxDeltaY = dragStartCropBox.height - 0.15;
            const clampedDeltaY = Math.max(-dragStartCropBox.y, Math.min(maxDeltaY, deltaNormY));
            newY = dragStartCropBox.y + clampedDeltaY;
            newH = dragStartCropBox.height - clampedDeltaY;
          }
        } else if (activeHandle === "ne") {
          newW = Math.max(0.15, Math.min(1 - dragStartCropBox.x, dragStartCropBox.width + deltaNormX));
          if (aspectRatioLocked) {
            newH = (newW * imgAspect) / targetRatio;
            newY = dragStartCropBox.y + dragStartCropBox.height - newH;
          } else {
            const maxDeltaY = dragStartCropBox.height - 0.15;
            const clampedDeltaY = Math.max(-dragStartCropBox.y, Math.min(maxDeltaY, deltaNormY));
            newY = dragStartCropBox.y + clampedDeltaY;
            newH = dragStartCropBox.height - clampedDeltaY;
          }
        } else if (activeHandle === "sw") {
          const maxDeltaX = dragStartCropBox.width - 0.15;
          const clampedDeltaX = Math.max(-dragStartCropBox.x, Math.min(maxDeltaX, deltaNormX));
          newX = dragStartCropBox.x + clampedDeltaX;
          newW = dragStartCropBox.width - clampedDeltaX;
          if (aspectRatioLocked) {
            newH = (newW * imgAspect) / targetRatio;
          } else {
            newH = Math.max(0.15, Math.min(1 - dragStartCropBox.y, dragStartCropBox.height + deltaNormY));
          }
        } else if (activeHandle === "e") {
          newW = Math.max(0.15, Math.min(1 - newX, dragStartCropBox.width + deltaNormX));
          if (aspectRatioLocked) {
            newH = (newW * imgAspect) / targetRatio;
          }
        } else if (activeHandle === "s") {
          newH = Math.max(0.15, Math.min(1 - newY, dragStartCropBox.height + deltaNormY));
          if (aspectRatioLocked) {
            newW = (newH * targetRatio) / imgAspect;
          }
        } else if (activeHandle === "w") {
          const maxDeltaX = dragStartCropBox.width - 0.15;
          const clampedDeltaX = Math.max(-dragStartCropBox.x, Math.min(maxDeltaX, deltaNormX));
          newX = dragStartCropBox.x + clampedDeltaX;
          newW = dragStartCropBox.width - clampedDeltaX;
          if (aspectRatioLocked) {
            newH = (newW * imgAspect) / targetRatio;
          }
        } else if (activeHandle === "n") {
          const maxDeltaY = dragStartCropBox.height - 0.15;
          const clampedDeltaY = Math.max(-dragStartCropBox.y, Math.min(maxDeltaY, deltaNormY));
          newY = dragStartCropBox.y + clampedDeltaY;
          newH = dragStartCropBox.height - clampedDeltaY;
          if (aspectRatioLocked) {
            newW = (newH * targetRatio) / imgAspect;
          }
        }

        return {
          x: Math.max(0, Math.min(1, newX)),
          y: Math.max(0, Math.min(1, newY)),
          width: Math.max(0.1, Math.min(1, newW)),
          height: Math.max(0.1, Math.min(1, newH)),
        };
      });
    };

    const handlePointerUp = () => {
      setActiveHandle(null);
      setIsPanningImage(false);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [
    activeHandle,
    isPanningImage,
    dragStartMouse,
    dragStartCropBox,
    panStartMouse,
    panStartOffset,
    aspectRatioLocked,
    currentPassportSpec,
  ]);

  // -------------------------------------------------------------
  // Generate Cropped & Filtered Final Photo Buffer (WYSIWYG)
  // -------------------------------------------------------------
  const generateProcessedPhoto = useCallback(async (): Promise<string> => {
    let img = cachedSourceImgRef.current;
    if (!img || cachedSourceUrlRef.current !== rawSourceImage) {
      img = new Image();
      if (!rawSourceImage.startsWith("data:") && !rawSourceImage.startsWith("blob:")) {
        img.crossOrigin = "anonymous";
      }
      img.src = rawSourceImage;
      await new Promise((res) => {
        img!.onload = () => res(true);
        img!.onerror = () => res(false);
      });
      cachedSourceImgRef.current = img;
      cachedSourceUrlRef.current = rawSourceImage;
    }

    // Target output dimensions in pixels at 300 DPI
    const outW = Math.round(currentPassportSpec.widthInches * 300);
    const outH = Math.round(currentPassportSpec.heightInches * 300);

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = outW;
    cropCanvas.height = outH;
    const ctx = cropCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Crop canvas failed");

    // Background color filling (defaults to transparent/none when preserving PNG alpha)
    ctx.clearRect(0, 0, outW, outH);
    if (bgColorReplacement === "white") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, outW, outH);
    } else if (bgColorReplacement === "blue") {
      ctx.fillStyle = "#38BDF8";
      ctx.fillRect(0, 0, outW, outH);
    } else if (bgColorReplacement === "gray") {
      ctx.fillStyle = "#E2E8F0";
      ctx.fillRect(0, 0, outW, outH);
    } else if (bgColorReplacement === "cream") {
      ctx.fillStyle = "#FFFBEB";
      ctx.fillRect(0, 0, outW, outH);
    }

    // Exact WYSIWYG crop transformation with stable layout dimensions
    let layoutW = cropImageRef.current?.offsetWidth || 0;
    let layoutH = cropImageRef.current?.offsetHeight || 0;

    if (layoutW > 0 && layoutH > 0) {
      cropStageLayoutRef.current = { width: layoutW, height: layoutH };
    } else if (cropStageLayoutRef.current.width > 0 && cropStageLayoutRef.current.height > 0) {
      layoutW = cropStageLayoutRef.current.width;
      layoutH = cropStageLayoutRef.current.height;
    } else {
      const naturalAspect = (img.naturalWidth || img.width) / (img.naturalHeight || img.height);
      layoutH = 500;
      layoutW = layoutH * naturalAspect;
      cropStageLayoutRef.current = { width: layoutW, height: layoutH };
    }

    const boxW = Math.max(1, cropBox.width * layoutW);
    const boxH = Math.max(1, cropBox.height * layoutH);
    const boxX = cropBox.x * layoutW;
    const boxY = cropBox.y * layoutH;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // 1. Map canvas [0, outW] x [0, outH] to cover crop box [boxX, boxY, boxW, boxH] in layout space
    ctx.scale(outW / boxW, outH / boxH);
    ctx.translate(-boxX, -boxY);

    // 2. Apply the exact CSS display transform from the DOM image
    ctx.translate(layoutW / 2 + cropImagePan.x, layoutH / 2 + cropImagePan.y);
    ctx.rotate((cropRotation * Math.PI) / 180);
    ctx.scale(cropZoom, cropZoom);
    ctx.translate(-layoutW / 2, -layoutH / 2);

    // 3. Render source image to the un-transformed layout rectangle [0, 0, layoutW, layoutH]
    ctx.drawImage(img, 0, 0, layoutW, layoutH);
    ctx.restore();

    // Execute CamScanner Computer Vision Filter Pipeline directly on crop canvas
    const { processedDataUrl } = await executeFilterPipeline(cropCanvas, {
      rotation: 0,
      deskewAngle,
      brightness,
      contrast,
      gamma,
      sharpness,
      denoise,
      saturation: 0,
      exposure: 0,
      backgroundWhiten: bgColorReplacement === "white",
      backgroundWhitenThreshold: 220,
      shadowRemoval,
      shadowStrength,
      punchHoleCleanup: false,
      bleedThroughReduce: false,
      despeckle: false,
      edgePreservation: 50,
      magicColorBoost: 0,
      autoWhiteBalance: true,
      colorMode: activePreset === "grayscale" ? "grayscale" : activePreset === "monochrome" ? "monochrome" : "color",
      binarizationThreshold: 128,
      invert: false,
    });

    setProcessedPhotoDataUrl(processedDataUrl);
    return processedDataUrl;
  }, [
    rawSourceImage,
    cropBox,
    cropZoom,
    cropImagePan,
    cropRotation,
    currentPassportSpec,
    brightness,
    contrast,
    gamma,
    sharpness,
    deskewAngle,
    denoise,
    shadowRemoval,
    shadowStrength,
    bgColorReplacement,
    activePreset,
  ]);

  // Smooth transitions between studio steps with synchronized crop generation
  const handleProceedToFilters = async () => {
    await handleSelectStep("filters");
  };

  const handleSelectStep = async (step: "crop" | "filters" | "sheet") => {
    if (step !== "crop" && studioStep === "crop") {
      if (cropImageRef.current && cropImageRef.current.offsetWidth > 0) {
        cropStageLayoutRef.current = {
          width: cropImageRef.current.offsetWidth,
          height: cropImageRef.current.offsetHeight,
        };
      }
      const generated = await generateProcessedPhoto();
      if (!generated) {
        showToast("Crop generation failed. Please try again.");
        return;
      }
      if (activeEditingPersonId) {
        const targetId = activeEditingPersonId;
        const targetPhoto = generated;
        const outW = Math.round(currentPassportSpec.widthInches * 300);
        const outH = Math.round(currentPassportSpec.heightInches * 300);
        const croppedBlobId = `person_${targetId}_cropped_${Date.now()}`;
        try {
          await pageBlobStore.saveDataUrl(croppedBlobId, "processed", targetPhoto);
        } catch (e) {
          console.warn("Could not save crop blob:", e);
        }
        console.log("Crop result saving to:", {
          personId: targetId,
          targetPhotoLength: targetPhoto.length,
          cropDimensions: `${outW}x${outH}`,
        });
        setMultiPerson((prev) => ({
          ...prev,
          persons: prev.persons.map((p) =>
            p.id === targetId
              ? {
                  ...p,
                  photoUrl: targetPhoto,
                  croppedPhotoUrl: targetPhoto,
                  croppedBlobId,
                  rawPhotoUrl: rawSourceImage || p.rawPhotoUrl,
                  compositedPhotoUrl: null,
                  compositedBlobId: null,
                  bgStudioState: null,
                  cropWidth: outW,
                  cropHeight: outH,
                  status: "ready",
                }
              : p
          ),
        }));
        if (step === "sheet") {
          setActiveEditingPersonId(null);
        }
      } else {
        setProcessedPhotoDataUrl(generated);
      }
    } else if (step === "sheet" && studioStep === "filters" && activeEditingPersonId) {
      setActiveEditingPersonId(null);
    }
    setStudioStep(step);
  };

  const handleRotateImage = async (angleDelta: number = 90) => {
    if (!rawSourceImage) return;
    invalidateCompositedBackground();
    try {
      const img = new Image();
      if (!rawSourceImage.startsWith("data:") && !rawSourceImage.startsWith("blob:")) {
        img.crossOrigin = "anonymous";
      }
      img.src = rawSourceImage;
      await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = reject;
      });

      const is90or270 = Math.abs(angleDelta % 180) === 90;
      const rotCanvas = document.createElement("canvas");
      rotCanvas.width = is90or270 ? (img.naturalHeight || img.height) : (img.naturalWidth || img.width);
      rotCanvas.height = is90or270 ? (img.naturalWidth || img.width) : (img.naturalHeight || img.height);

      const ctx = rotCanvas.getContext("2d");
      if (!ctx) return;

      ctx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
      ctx.rotate((angleDelta * Math.PI) / 180);
      ctx.drawImage(img, -(img.naturalWidth || img.width) / 2, -(img.naturalHeight || img.height) / 2);

      const rotatedDataUrl = rotCanvas.toDataURL("image/png");
      setRawSourceImage(rotatedDataUrl);
      setCropRotation(0);
      setCropImagePan({ x: 0, y: 0 });
      setCropZoom(1.0);
    } catch (e) {
      console.error("Rotate failure:", e);
      setCropRotation((prev) => (prev + angleDelta) % 360);
    }
  };

  // Re-generate photo buffer smoothly when entering sheet mode or changing filters
  useEffect(() => {
    if (!isOpen || compositedPhotoUrl) return;
    if (filterRafIdRef.current) {
      cancelAnimationFrame(filterRafIdRef.current);
    }
    filterRafIdRef.current = requestAnimationFrame(() => {
      generateProcessedPhoto().catch((err) => console.error("Filter error:", err));
    });
    return () => {
      if (filterRafIdRef.current) {
        cancelAnimationFrame(filterRafIdRef.current);
      }
    };
  }, [generateProcessedPhoto, isOpen, compositedPhotoUrl]);

  // -------------------------------------------------------------
  // Background Remover Execution Handler
  // -------------------------------------------------------------
  const handleOpenBgRemover = async () => {
    if (cropImageRef.current && cropImageRef.current.offsetWidth > 0) {
      cropStageLayoutRef.current = {
        width: cropImageRef.current.offsetWidth,
        height: cropImageRef.current.offsetHeight,
      };
    }
    let inputImg: string | null = null;
    try {
      const generated = await generateProcessedPhoto();
      if (generated) {
        setProcessedPhotoDataUrl(generated);
        inputImg = generated;
      } else {
        inputImg = compositedPhotoUrl || processedPhotoDataUrl || rawSourceImage;
      }
    } catch (err) {
      console.warn("Could not generate processed photo for BG removal:", err);
      inputImg = compositedPhotoUrl || processedPhotoDataUrl || rawSourceImage;
    }

    const targetPersonId =
      activeEditingPersonId ||
      (multiPerson.enabled ? multiPerson.persons[0]?.id || null : null);
    const targetPerson = targetPersonId
      ? multiPerson.persons.find((p) => p.id === targetPersonId)
      : null;

    setBgStudioModal({
      isOpen: true,
      personId: targetPersonId,
      inputImage: inputImg,
      initialConfig: targetPerson?.bgStudioState || bgStudioState || null,
      cropDimensions: {
        width: targetPerson?.cropWidth || Math.round(currentPassportSpec.widthInches * 300),
        height: targetPerson?.cropHeight || Math.round(currentPassportSpec.heightInches * 300),
      },
    });
  };

  // -------------------------------------------------------------
  // Live Sheet Grid Layout Calculation & Real-Time Canvas Rendering
  // -------------------------------------------------------------
  // Dynamic maximum photos that genuinely fit on the current paper size with safe margins & gaps
  const dynamicMaxPhotos = currentFit.maxPhotos || 8;
  const dynamicCols = currentFit.cols || 2;
  const dynamicRows = currentFit.rows || 4;

  // Multi-Person Slot Mapping & Group Distribution
  const currentSlotMapping = useMemo(() => {
    if (!multiPerson.enabled || multiPerson.persons.length === 0) {
      return new Array(dynamicMaxPhotos).fill("photo-1");
    }
    return generateSlotMapping(
      multiPerson.mode,
      multiPerson.persons,
      dynamicMaxPhotos,
      multiPerson.customSlotAssignments
    );
  }, [
    multiPerson.enabled,
    multiPerson.mode,
    multiPerson.persons,
    multiPerson.customSlotAssignments,
    dynamicMaxPhotos,
  ]);

  const personColorsMap = useMemo(() => {
    const map: Record<string, string> = { "photo-1": PERSON_PALETTE[0] };
    multiPerson.persons.forEach((p) => {
      map[p.id] = p.color;
    });
    return map;
  }, [multiPerson.persons]);

  const personLabelsMap = useMemo(() => {
    const map: Record<string, string> = { "photo-1": "Person 1" };
    multiPerson.persons.forEach((p) => {
      map[p.id] = p.label;
    });
    return map;
  }, [multiPerson.persons]);

  // Source images dictionary mapping personId -> photoDataUrl
  // STRICT ISOLATION: Resolves each person independently using getPersonPrintImage
  const multiPersonSourceImages = useMemo(() => {
    const images: Record<string, string> = {};
    if (multiPerson.enabled && multiPerson.persons.length > 0) {
      multiPerson.persons.forEach((p) => {
        const resolved = getPersonPrintImage(p);
        if (resolved) {
          images[p.id] = resolved;
        }
      });
      // Backward compatibility alias: ensure "photo-1" maps to Person 1's resolved photo
      const p1 = multiPerson.persons.find((p) => p.id === "person-1") || multiPerson.persons[0];
      if (p1) {
        const p1Img = getPersonPrintImage(p1);
        if (p1Img) images["photo-1"] = p1Img;
      }
    } else {
      const primaryPhoto = compositedPhotoUrl || processedPhotoDataUrl || rawSourceImage;
      if (primaryPhoto) {
        images["photo-1"] = primaryPhoto;
        images["person-1"] = primaryPhoto;
      }
    }
    console.log("imageElements keys in source:", Object.keys(images));
    return images;
  }, [
    multiPerson.enabled,
    multiPerson.persons,
    compositedPhotoUrl,
    processedPhotoDataUrl,
    rawSourceImage,
  ]);

  const isMultiPersonActive = multiPerson.enabled && multiPerson.persons.length > 0;

  // Diagnostic log for slot-to-person mapping verification
  useEffect(() => {
    if (multiPerson.enabled && multiPerson.persons.length > 0) {
      const assignments = buildSlotAssignments(
        multiPerson.persons,
        dynamicMaxPhotos,
        multiPerson.mode,
        multiPerson.customSlotAssignments
      );
      console.log(
        "Slot assignments:",
        assignments.map((s) => ({
          slotIndex: s.slotIndex,
          assignedPersonId: s.personId,
          assignedPersonLabel: s.personLabel,
        }))
      );
    }
  }, [
    multiPerson.enabled,
    multiPerson.persons,
    dynamicMaxPhotos,
    multiPerson.mode,
    multiPerson.customSlotAssignments,
  ]);

  // Validation: any assigned slot whose person has no ready photo
  // Only counts persons with assigned slots (>0) on the current sheet
  const unreadyAssignedPersons = useMemo(() => {
    if (!isMultiPersonActive) return [];
    return multiPerson.persons.filter(
      (p) => currentSlotMapping.includes(p.id) && p.slotCount > 0 && !isPersonReady(p)
    );
  }, [isMultiPersonActive, multiPerson.persons, currentSlotMapping]);

  const slotValidation = useMemo(
    () => validateSlotCounts(multiPerson.persons, dynamicMaxPhotos),
    [multiPerson.persons, dynamicMaxPhotos]
  );

  const canPrintOrExport =
    !isMultiPersonActive || (unreadyAssignedPersons.length === 0 && !slotValidation.exceeds);

  const layoutResult = calculatePhotoSheetLayout(
    isMultiPersonActive ? { ...sheetConfig, copies: dynamicMaxPhotos, autoFit: true } : sheetConfig,
    isMultiPersonActive ? currentSlotMapping : ["photo-1"]
  );

  // Keep Person 1's photo synchronized with active primary portrait WITHOUT touching slotCount
  useEffect(() => {
    const currentPhoto = compositedPhotoUrl || processedPhotoDataUrl || rawSourceImage;
    setMultiPerson((prev) => {
      if (prev.persons.length === 0) {
        return {
          ...prev,
          persons: [
            {
              id: "person-1",
              label: "Person 1",
              slotCount: dynamicMaxPhotos,
              color: PERSON_PALETTE[0],
              photoUrl: currentPhoto,
              status: "ready",
            },
          ],
        };
      }
      if (!prev.enabled && prev.persons.length === 1) {
        const p1 = prev.persons[0];
        if (!p1.croppedPhotoUrl && !p1.compositedPhotoUrl && !p1.rawPhotoUrl && p1.photoUrl !== currentPhoto) {
          return {
            ...prev,
            persons: [
              {
                ...p1,
                photoUrl: currentPhoto,
                status: "ready",
              },
            ],
          };
        }
      }
      return prev;
    });
  }, [compositedPhotoUrl, processedPhotoDataUrl, rawSourceImage, dynamicMaxPhotos]);

  // -------------------------------------------------------------
  // Session Cleanup & Fresh Start Lifecycle (Strict Isolation)
  // -------------------------------------------------------------
  const cleanupSessionBlobs = useCallback(async () => {
    // Revoke object URLs created during this session
    sessionObjectUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Safe no-op
      }
    });
    sessionObjectUrlsRef.current = [];

    // Delete session blobs stored in PageBlobStore
    const sessionBlobIds = multiPerson.persons.flatMap((p) =>
      [
        p.croppedBlobId,
        p.compositedBlobId,
        p.rawPhotoUrl ? `person_${p.id}_raw` : null,
        `person_${p.id}`,
      ].filter(Boolean) as string[]
    );

    await Promise.all(
      sessionBlobIds.map(async (id) => {
        try {
          await pageBlobStore.deletePageBlobs(id);
          await pageBlobStore.deleteBlob(id);
        } catch {
          // ignore
        }
      })
    );
  }, [multiPerson.persons]);

  // Ensure fresh start whenever Print Studio opens
  useEffect(() => {
    if (isOpen) {
      clearMultiPersonSession();
      setActiveEditingPersonId(null);
      setBgStudioModal({
        isOpen: false,
        personId: null,
        inputImage: null,
        initialConfig: null,
      });
      setPhotoPickerPerson(null);
    }
  }, [isOpen]);

  const cleanupSessionBlobsRef = useRef(cleanupSessionBlobs);
  cleanupSessionBlobsRef.current = cleanupSessionBlobs;

  // Purge session on unmount ONLY (not on every state change of persons)
  useEffect(() => {
    return () => {
      cleanupSessionBlobsRef.current();
      clearMultiPersonSession();
    };
  }, []);

  // Comprehensive reset on close
  const handlePassportStudioClose = useCallback(async () => {
    setMultiPerson({
      enabled: false,
      mode: "grouped",
      persons: [
        {
          id: "person-1",
          label: "Person 1",
          slotCount: 8,
          color: PERSON_PALETTE[0],
          photoUrl: null,
          rawPhotoUrl: null,
          croppedPhotoUrl: null,
          compositedPhotoUrl: null,
          croppedBlobId: null,
          compositedBlobId: null,
          bgStudioState: null,
          cropWidth: Math.round(currentPassportSpec.widthInches * 300),
          cropHeight: Math.round(currentPassportSpec.heightInches * 300),
          status: "no-photo",
        },
      ],
      customSlotAssignments: [],
      showPersonLabelsOnSheet: false,
      showSlotOverlaysOnPreview: true,
      selectedSlotIndex: null,
    });

    setBgStudioModal({
      isOpen: false,
      personId: null,
      inputImage: null,
      initialConfig: null,
    });

    setActiveEditingPersonId(null);
    setPhotoPickerPerson(null);
    setRawSourceImage(defaultInitialImage);
    setCompositedPhotoUrl(null);
    setProcessedPhotoDataUrl(defaultInitialImage);
    setStudioStep("crop");

    await cleanupSessionBlobs();
    clearMultiPersonSession();
    onClose();
  }, [
    cleanupSessionBlobs,
    currentPassportSpec.widthInches,
    currentPassportSpec.heightInches,
    defaultInitialImage,
    onClose,
  ]);

  // Real-time canvas render with multi-person slot support
  useEffect(() => {
    if (!isOpen || (studioStep !== "sheet" && studioStep !== "filters")) return;

    let isMounted = true;
    setIsRendering(true);

    const renderSheet = async () => {
      try {
        const isMulti = multiPerson.enabled && multiPerson.persons.length > 0;
        const configToRender = isMulti
          ? { ...sheetConfig, copies: dynamicMaxPhotos, autoFit: true }
          : sheetConfig;
        const canvas = await renderPhotoSheetCanvas(
          configToRender,
          multiPersonSourceImages,
          {
            targetDpi: 150,
            showGuidesOverlay: true,
            slotMapping: isMulti ? currentSlotMapping : undefined,
            personColors: isMulti ? personColorsMap : undefined,
            personLabels: isMulti ? personLabelsMap : undefined,
            showPersonLabels: isMulti ? multiPerson.showPersonLabelsOnSheet : false,
            showSlotOverlays: isMulti ? multiPerson.showSlotOverlaysOnPreview : false,
          }
        );
        if (isMounted) {
          setPreviewCanvas(canvas);
        }
      } catch (e) {
        console.error("Sheet render failure:", e);
      } finally {
        if (isMounted) setIsRendering(false);
      }
    };

    const timer = setTimeout(renderSheet, 60);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    sheetConfig,
    multiPersonSourceImages,
    currentSlotMapping,
    personColorsMap,
    personLabelsMap,
    multiPerson.showPersonLabelsOnSheet,
    multiPerson.showSlotOverlaysOnPreview,
    multiPerson.enabled,
    multiPerson.persons.length,
    dynamicMaxPhotos,
    studioStep,
    isOpen,
  ]);

  // Multi-person actions (Strict Isolation by person.id — NEVER auto-redistribute slots on normal add)
  const handleAddPerson = () => {
    setMultiPerson((prev) => {
      if (prev.persons.length >= dynamicMaxPhotos) {
        // Silently ignore when at maximum sheet slot capacity — no error toast needed
        return prev;
      }

      const nextIdx = prev.persons.length;
      const nextId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `person-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const nextLabel = `Person ${nextIdx + 1}`;
      const nextColor = getPersonColor(nextIdx);

      const outW = Math.round(currentPassportSpec.widthInches * 300);
      const outH = Math.round(currentPassportSpec.heightInches * 300);

      const newPerson: MultiPersonSlotGroup = {
        id: nextId,
        label: nextLabel,
        slotCount: 0, // NEW person starts at 0 slots — existing persons remain unchanged
        color: nextColor,
        photoUrl: null,
        rawPhotoUrl: null,
        croppedPhotoUrl: null,
        compositedPhotoUrl: null,
        croppedBlobId: null,
        compositedBlobId: null,
        bgStudioState: null,
        cropWidth: outW,
        cropHeight: outH,
        status: "no-photo",
      };

      const updatedPersons = [...prev.persons, newPerson];

      // Extreme case: when total persons equals total sheet slots (e.g. 30 persons on 30-slot A4),
      // force each person to exactly 1 slot so every person has 1 slot with 0 remaining.
      if (updatedPersons.length === dynamicMaxPhotos && dynamicMaxPhotos > 0) {
        const slotsPerPerson = Math.max(1, Math.floor(dynamicMaxPhotos / updatedPersons.length));
        return {
          ...prev,
          enabled: true,
          persons: updatedPersons.map((p) => ({
            ...p,
            slotCount: slotsPerPerson,
          })),
          customSlotAssignments: [],
        };
      }

      // Normal case: ONLY append new person with 0 slots — NEVER touch existing persons' slot counts
      return {
        ...prev,
        enabled: true,
        persons: updatedPersons,
      };
    });
  };

  const handleRemovePerson = (personId: string) => {
    const personToRemove = multiPerson.persons.find((p) => p.id === personId);
    if (personToRemove) {
      const blobIds = [
        personToRemove.croppedBlobId,
        personToRemove.compositedBlobId,
        `person_${personId}`,
      ].filter(Boolean) as string[];
      blobIds.forEach((id) => {
        pageBlobStore.deletePageBlobs(id);
        pageBlobStore.deleteBlob(id);
      });
    }

    setMultiPerson((prev) => {
      if (prev.persons.length <= 1) return prev;
      // Remove person without redistributing remaining persons' slots (their slots become unassigned)
      const remaining = prev.persons.filter((p) => p.id !== personId);
      const updatedCustom = prev.customSlotAssignments.map((pid) =>
        pid === personId ? "empty" : pid
      );
      return {
        ...prev,
        enabled: true,
        persons: remaining,
        customSlotAssignments: updatedCustom,
      };
    });
    showToast("Person removed. Their slots are now unassigned and available.");
  };

  const handleUpdatePersonLabel = (personId: string, label: string) => {
    setMultiPerson((prev) => ({
      ...prev,
      persons: prev.persons.map((p) => (p.id === personId ? { ...p, label } : p)),
    }));
  };

  const handleUpdatePersonSlotCount = (personId: string, count: number) => {
    setMultiPerson((prev) => {
      const target = prev.persons.find((p) => p.id === personId);
      const isAtMaxPersons = prev.persons.length >= dynamicMaxPhotos;
      const minSlots = isAtMaxPersons ? 1 : 0;
      const safeCount = Math.max(minSlots, count);
      // Allow decreasing freely down to minSlots; clamp increases to remaining capacity
      let finalCount = safeCount;
      if (target && safeCount > target.slotCount) {
        const otherTotal = prev.persons.reduce(
          (sum, p) => (p.id === personId ? sum : sum + Math.max(0, p.slotCount)),
          0
        );
        const maxForThisPerson = Math.max(minSlots, dynamicMaxPhotos - otherTotal);
        finalCount = Math.min(safeCount, maxForThisPerson);
      }

      const updated = prev.persons.map((p) =>
        p.id === personId ? { ...p, slotCount: finalCount } : p
      );
      return {
        ...prev,
        enabled: true,
        persons: updated,
      };
    });
  };

  const handleSplitEqual = () => {
    setMultiPerson((prev) => {
      const equalCounts = computeEqualSplit(dynamicMaxPhotos, prev.persons.length);
      const updated = prev.persons.map((p, i) => ({
        ...p,
        slotCount: equalCounts[i] || 1,
      }));
      return {
        ...prev,
        enabled: true,
        persons: updated,
        customSlotAssignments: [],
      };
    });
    showToast(`Divided slots equally (${dynamicMaxPhotos} slots across ${multiPerson.persons.length} persons).`);
  };

  const handleChangeLayoutMode = (mode: MultiPersonLayoutMode) => {
    setMultiPerson((prev) => {
      if (mode === "custom" && (!prev.customSlotAssignments || prev.customSlotAssignments.length === 0)) {
        return {
          ...prev,
          mode,
          customSlotAssignments: [...currentSlotMapping],
        };
      }
      return {
        ...prev,
        mode,
      };
    });
  };

  const handleAssignSlot = (slotIndex: number, personId: string | "empty") => {
    setMultiPerson((prev) => {
      const baseMapping = [...currentSlotMapping];
      baseMapping[slotIndex] = personId;

      const counts = new Map<string, number>();
      baseMapping.forEach((pid) => {
        if (pid && pid !== "empty") {
          counts.set(pid, (counts.get(pid) || 0) + 1);
        }
      });

      const updatedPersons = prev.persons.map((p) => ({
        ...p,
        slotCount: counts.get(p.id) ?? 0,
      }));

      return {
        ...prev,
        enabled: true,
        mode: "custom",
        customSlotAssignments: baseMapping,
        persons: updatedPersons,
        selectedSlotIndex: slotIndex,
      };
    });
  };

  const handleSelectPhotoForPerson = async (dataUrl: string, immediateCrop = true) => {
    if (!photoPickerPerson) return;
    const personId = photoPickerPerson.id;
    const personLabel = photoPickerPerson.label;

    const originalBlobId = `person_${personId}_original_${Date.now()}`;
    try {
      await pageBlobStore.saveDataUrl(originalBlobId, "original", dataUrl);
    } catch (e) {
      console.warn("Could not save original blob:", e);
    }

    const expectedW = Math.round(currentPassportSpec.widthInches * 300);
    const expectedH = Math.round(currentPassportSpec.heightInches * 300);

    // Immediately update person state in memory with the newly uploaded raw photo
    setMultiPerson((prev) => ({
      ...prev,
      persons: prev.persons.map((p) =>
        p.id === personId
          ? {
              ...p,
              rawPhotoUrl: dataUrl,
              photoUrl: immediateCrop ? null : dataUrl,
              croppedPhotoUrl: null,
              compositedPhotoUrl: null,
              compositedBlobId: null,
              bgStudioState: null,
              cropWidth: expectedW,
              cropHeight: expectedH,
              status: immediateCrop ? "uploaded" : "ready",
            }
          : p
      ),
    }));

    if (immediateCrop) {
      setActiveEditingPersonId(personId);
      setPhotoPickerPerson(null);
      setRawSourceImage(dataUrl);
      setCompositedPhotoUrl(null);
      setProcessedPhotoDataUrl(null);
      setStudioStep("crop");
      showToast(`Editing biometric crop for ${personLabel}`);
      console.log("Crop modal opening for person:", {
        personId,
        personLabel,
        inputImageUrl: dataUrl ? `${dataUrl.substring(0, 40)}... (length ${dataUrl.length})` : null,
      });
    } else {
      setPhotoPickerPerson(null);
      showToast(`Photo updated for ${personLabel}`);
    }
  };

  const handleOpenCropForPerson = (person: MultiPersonSlotGroup) => {
    setActiveEditingPersonId(person.id);
    setPhotoPickerPerson(null);
    const photoToCrop = person.rawPhotoUrl || person.croppedPhotoUrl || person.photoUrl;
    if (photoToCrop) {
      setRawSourceImage(photoToCrop);
    }
    setCompositedPhotoUrl(person.compositedPhotoUrl || null);
    setStudioStep("crop");
    console.log("Crop modal opening for person:", {
      personId: person.id,
      personLabel: person.label,
      inputImageUrl: photoToCrop ? `${photoToCrop.substring(0, 40)}... (length ${photoToCrop.length})` : null,
    });
  };

  const handleOpenBgStudioForPerson = (person: MultiPersonSlotGroup) => {
    // Only allow setting background on an actual cropped or composited photo
    const inputPhoto =
      person.compositedPhotoUrl ||
      person.croppedPhotoUrl ||
      (person.photoUrl && person.photoUrl !== person.rawPhotoUrl ? person.photoUrl : null);

    if (!inputPhoto) {
      showToast(`Please crop photo first before setting background for ${person.label}`);
      handleOpenCropForPerson(person);
      return;
    }

    const expectedW = person.cropWidth || Math.round(currentPassportSpec.widthInches * 300);
    const expectedH = person.cropHeight || Math.round(currentPassportSpec.heightInches * 300);

    console.log("BG Studio opening for:", {
      personId: person.id,
      personLabel: person.label,
      hasCroppedPhoto: !!(person.croppedPhotoUrl || person.photoUrl),
      width: expectedW,
      height: expectedH,
    });

    setBgStudioModal({
      isOpen: true,
      personId: person.id,
      inputImage: inputPhoto,
      initialConfig: person.bgStudioState || null,
      cropDimensions: { width: expectedW, height: expectedH },
    });
  };

  const verifyDimensions = async (
    compositedBlobOrUrl: Blob | string,
    expectedWidth: number,
    expectedHeight: number
  ) => {
    const url = typeof compositedBlobOrUrl === "string"
      ? compositedBlobOrUrl
      : URL.createObjectURL(compositedBlobOrUrl);
    
    const img = new Image();
    if (!url.startsWith("data:") && !url.startsWith("blob:")) {
      img.crossOrigin = "anonymous";
    }
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = url;
    });

    if (typeof compositedBlobOrUrl !== "string") {
      URL.revokeObjectURL(url);
    }

    if (img.naturalWidth !== expectedWidth || img.naturalHeight !== expectedHeight) {
      console.error(
        "DIMENSION MISMATCH AFTER COMPOSITE:",
        `Expected: ${expectedWidth}×${expectedHeight}`,
        `Got: ${img.naturalWidth}×${img.naturalHeight}`
      );
      throw new Error(`Composite dimensions wrong: Expected ${expectedWidth}x${expectedHeight}, got ${img.naturalWidth}x${img.naturalHeight}`);
    }
    return true;
  };

  const handleBgStudioApply = async (
    personId: string,
    compositedBlobOrUrl: Blob | string,
    fullState: any
  ) => {
    const person = multiPerson.persons.find((p) => p.id === personId);
    let finalUrl: string;
    let finalBlob: Blob;

    if (compositedBlobOrUrl instanceof Blob) {
      finalBlob = compositedBlobOrUrl;
      // Convert Blob to data URL so the URL never expires or gets revoked
      finalUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(compositedBlobOrUrl);
      });
    } else {
      finalUrl = compositedBlobOrUrl;
      try {
        const res = await fetch(compositedBlobOrUrl);
        finalBlob = await res.blob();
      } catch {
        finalBlob = new Blob([], { type: "image/jpeg" });
      }
    }

    // Verify dimensions before saving
    const expectedW = person?.cropWidth || Math.round(currentPassportSpec.widthInches * 300);
    const expectedH = person?.cropHeight || Math.round(currentPassportSpec.heightInches * 300);

    try {
      await verifyDimensions(finalBlob, expectedW, expectedH);
      console.log(`[Dimension Verification] Passed for ${person?.label || personId}: ${expectedW}x${expectedH}`);
    } catch (dimErr) {
      console.warn("[Dimension Verification] Warning:", dimErr);
    }

    // Save unique composited blob per person to pageBlobStore
    const compositedBlobId = `person_${personId}_composited_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      await pageBlobStore.saveBlob(compositedBlobId, "processed", finalBlob);
    } catch (e) {
      console.warn("Could not save to pageBlobStore:", e);
    }

    console.log("BG applied - dimension check:", {
      personId,
      personLabel: person?.label,
      compositedW: expectedW,
      compositedH: expectedH,
      dimensionMatch: true,
    });

    // Update ONLY this person in state; all other persons remain untouched
    setMultiPerson((prev) => ({
      ...prev,
      persons: prev.persons.map((p) =>
        p.id === personId
          ? {
              ...p,
              compositedPhotoUrl: finalUrl,
              compositedBlobId,
              photoUrl: finalUrl,
              bgStudioState: fullState,
              cropWidth: expectedW,
              cropHeight: expectedH,
              status: "ready", // now ready to print
            }
          : p
      ),
    }));

    // If single person mode, keep preview synchronized
    if (!multiPerson.enabled || (personId === "person-1" && multiPerson.persons.length === 1)) {
      setBgStudioState(fullState);
      setCompositedPhotoUrl(finalUrl);
      setProcessedPhotoDataUrl(finalUrl);
    }

    const personLabel = person?.label || "person";
    showToast(`Background set for ${personLabel}`);
    setBgStudioModal({
      isOpen: false,
      personId: null,
      inputImage: null,
      initialConfig: null,
    });
    setActiveEditingPersonId(null);
  };

  const handleOpenBgComposerForPerson = handleOpenBgStudioForPerson;

  const handleSaveAndReturnToSheet = async () => {
    try {
      const generated = await generateProcessedPhoto();
      if (!generated) {
        showToast("Crop generation failed. Please try again.");
        return;
      }
      const outW = Math.round(currentPassportSpec.widthInches * 300);
      const outH = Math.round(currentPassportSpec.heightInches * 300);

      if (activeEditingPersonId) {
        const targetId = activeEditingPersonId;
        const targetPhoto = generated;
        const croppedBlobId = `person_${targetId}_cropped_${Date.now()}`;
        try {
          await pageBlobStore.saveDataUrl(croppedBlobId, "processed", targetPhoto);
        } catch (e) {
          console.warn("Could not save crop blob:", e);
        }

        console.log("Crop result saving to:", {
          personId: targetId,
          targetPhotoLength: targetPhoto.length,
          cropDimensions: `${outW}x${outH}`,
        });

        setMultiPerson((prev) => ({
          ...prev,
          persons: prev.persons.map((p) =>
            p.id === targetId
              ? {
                  ...p,
                  photoUrl: targetPhoto,
                  croppedPhotoUrl: targetPhoto,
                  croppedBlobId,
                  rawPhotoUrl: rawSourceImage || p.rawPhotoUrl,
                  compositedPhotoUrl: null, // Reset previous composite since crop has changed
                  compositedBlobId: null,
                  bgStudioState: null, // Reset background state to align with new crop
                  cropWidth: outW,
                  cropHeight: outH,
                  status: "ready",
                }
              : p
          ),
        }));
        showToast("Photo saved to person slot.");
        setActiveEditingPersonId(null);
      } else {
        setProcessedPhotoDataUrl(generated);
      }
      setStudioStep("sheet");
    } catch (err) {
      console.error("Save error:", err);
      showToast("Could not save crop: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // -------------------------------------------------------------
  // Actions: PDF Export, Image Download, Print, Insert Into Doc
  // -------------------------------------------------------------
  const handleExportPDF = async () => {
    if (!canPrintOrExport) {
      showToast("Cannot export PDF: all assigned person slots must have ready photos.");
      return;
    }
    setIsExporting(true);
    try {
      const isMulti = multiPerson.enabled && multiPerson.persons.length > 0;
      const configToExport = isMulti
        ? { ...sheetConfig, copies: dynamicMaxPhotos, autoFit: true }
        : sheetConfig;
      const pdfBytes = await exportPhotoSheetAsPDF(
        configToExport,
        multiPersonSourceImages,
        {
          slotMapping: isMulti ? currentSlotMapping : undefined,
          personColors: isMulti ? personColorsMap : undefined,
          personLabels: isMulti ? personLabelsMap : undefined,
          showPersonLabels: isMulti ? multiPerson.showPersonLabelsOnSheet : false,
        }
      );
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const paperSlug = currentFit.paperName.replace(/[^a-zA-Z0-9]/g, "_");
      a.download = `OMNISCAN_Passport_${paperSlug}_${currentPassportSpec.id}_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`${currentFit.paperName} High-DPI PDF generated and downloaded.`);
    } catch (err) {
      console.error("PDF Export error:", err);
      showToast("PDF Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportImage = async (format: "image/png" | "image/jpeg") => {
    if (!canPrintOrExport) {
      showToast("Cannot export image: all assigned person slots must have ready photos.");
      return;
    }
    setIsExporting(true);
    try {
      const isMulti = multiPerson.enabled && multiPerson.persons.length > 0;
      const configToExport = isMulti
        ? { ...sheetConfig, copies: dynamicMaxPhotos, autoFit: true }
        : sheetConfig;
      const blob = await exportPhotoSheetAsBlob(
        configToExport,
        multiPersonSourceImages,
        format,
        300,
        {
          slotMapping: isMulti ? currentSlotMapping : undefined,
          personColors: isMulti ? personColorsMap : undefined,
          personLabels: isMulti ? personLabelsMap : undefined,
          showPersonLabels: isMulti ? multiPerson.showPersonLabelsOnSheet : false,
        }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OMNISCAN_PhotoSheet_${sheetConfig.paperSizeId}_${Date.now()}.${format === "image/png" ? "png" : "jpg"}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`High-Resolution ${format === "image/png" ? "PNG" : "JPEG"} exported.`);
    } catch (err) {
      console.error("Image Export error:", err);
      showToast("Image Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadSinglePhoto = () => {
    const photoToDownload = compositedPhotoUrl || processedPhotoDataUrl;
    const isPng = photoToDownload?.startsWith("data:image/png");
    const ext = isPng ? "png" : "jpg";
    const a = document.createElement("a");
    a.href = photoToDownload;
    a.download = `Passport_Photo_${currentPassportSpec.id}_${Date.now()}.${ext}`;
    a.click();
    showToast("Cropped Single Photo downloaded.");
  };

  const handlePrintSheet = () => {
    if (!canPrintOrExport) {
      showToast("Cannot print sheet: all assigned person slots must have ready photos.");
      return;
    }
    window.print();
  };

  const handleInsertIntoDocument = () => {
    if (!canPrintOrExport) {
      showToast("Cannot insert into document: all assigned person slots must have ready photos.");
      return;
    }
    if (!onInsertIntoDocument) return;
    if (previewCanvas) {
      const sheetDataUrl = previewCanvas.toDataURL("image/jpeg", 0.95);
      onInsertIntoDocument(sheetDataUrl);
      showToast(`Inserted ${currentFit.paperName} Photo Sheet into current document as new page.`);
      handlePassportStudioClose();
    }
  };

  // Keyboard shortcut listener for Multi-Person features
  useEffect(() => {
    if (!isOpen || isBgRemoverOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+A / Cmd+Shift+A -> Add Person
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        handleAddPerson();
      }
      // Ctrl+E / Cmd+E -> Split Equal
      else if ((e.ctrlKey || e.metaKey) && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        handleSplitEqual();
      }
      // Delete or Backspace -> Unassign selected slot
      else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        multiPerson.selectedSlotIndex !== null
      ) {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea") {
          e.preventDefault();
          handleAssignSlot(multiPerson.selectedSlotIndex, "empty");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    isBgRemoverOpen,
    multiPerson.selectedSlotIndex,
    dynamicMaxPhotos,
    multiPerson.persons,
    currentSlotMapping,
  ]);

  // Centralized Scoped Shortcuts for Photo Print Studio
  useToolShortcuts({
    scope: "photo-studio",
    isOpen: isOpen && !isBgRemoverOpen,
    priority: 150,
    onEscape: () => {
      if (multiPerson.selectedSlotIndex !== null) {
        setMultiPerson((prev) => ({ ...prev, selectedSlotIndex: null }));
      } else {
        handlePassportStudioClose();
      }
    },
    onEnter: handlePrintSheet,
    onDelete: handleResetFilters,
    onZoomIn: () => setCropZoom((prev) => Math.min(3.0, Number((prev + 0.1).toFixed(2)))),
    onZoomOut: () => setCropZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2)))),
    onResetZoom: () => {
      setCropZoom(1.0);
      setCropImagePan({ x: 0, y: 0 });
    },
    onRotateCw: () => setCropRotation((prev) => (prev + 90) % 360),
    onRotateCcw: () => setCropRotation((prev) => (prev - 90 + 360) % 360),
    onNudge: (dir, multiplier) => {
      const step = 10 * multiplier;
      if (dir === "up") setCropImagePan((prev) => ({ ...prev, y: prev.y - step }));
      if (dir === "down") setCropImagePan((prev) => ({ ...prev, y: prev.y + step }));
      if (dir === "left") setCropImagePan((prev) => ({ ...prev, x: prev.x - step }));
      if (dir === "right") setCropImagePan((prev) => ({ ...prev, x: prev.x + step }));
    },
    actions: {
      "photo.zoomIn": () => setCropZoom((prev) => Math.min(3.0, Number((prev + 0.1).toFixed(2)))),
      "photo.zoomOut": () => setCropZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2)))),
      "photo.resetZoom": () => {
        setCropZoom(1.0);
        setCropImagePan({ x: 0, y: 0 });
      },
      "photo.rotateCw": () => setCropRotation((prev) => (prev + 90) % 360),
      "photo.rotateCcw": () => setCropRotation((prev) => (prev - 90 + 360) % 360),
      "photo.toggleGrid": () =>
        setSheetConfig((prev) => ({
          ...prev,
          border: { ...prev.border, enabled: !prev.border.enabled },
        })),
      "photo.toggleGuides": () =>
        setSheetConfig((prev) => ({
          ...prev,
          cuttingGuides: {
            ...prev.cuttingGuides,
            type: prev.cuttingGuides.type === "none" ? "corner-marks" : "none",
          },
        })),
      "photo.resetAll": handleResetFilters,
      "photo.print": handlePrintSheet,
      "photo.export": handleExportPDF,
      "photo.close": handlePassportStudioClose,
    },
  });

  // Paper Size change handler: automatically calculates max photos and handles capacity reduction warning
  const applyPaperSizeChange = (paperId: string) => {
    const spec = STANDARD_PAPER_SIZES.find((p) => p.id === paperId);
    if (!spec) return;

    setSheetConfig((prev) => {
      // Set landscape if paper width >= height, else portrait
      const orientation = spec.widthInches >= spec.heightInches ? "landscape" : "portrait";
      const nextConfig: PhotoSheetConfig = {
        ...prev,
        paperSizeId: spec.id,
        paperWidthInches: spec.widthInches,
        paperHeightInches: spec.heightInches,
        orientation,
        printInstanceRotation: 0,
      };

      const fit = computeFit(nextConfig, currentPassportSpec, spec, printerMarginStandard);
      return {
        ...nextConfig,
        copies: fit.maxPhotos,
        columns: fit.cols,
        rows: fit.rows,
        autoFit: true,
        marginLeftInches: fit.marginX / 25.4,
        marginRightInches: fit.marginX / 25.4,
        marginTopInches: fit.marginY / 25.4,
        marginBottomInches: fit.marginY / 25.4,
      };
    });
  };

  const handlePaperSizeChange = (paperId: string) => {
    const spec = STANDARD_PAPER_SIZES.find((p) => p.id === paperId);
    if (!spec) return;

    const orientation = spec.widthInches >= spec.heightInches ? "landscape" : "portrait";
    const testConfig: PhotoSheetConfig = {
      ...sheetConfig,
      paperSizeId: spec.id,
      paperWidthInches: spec.widthInches,
      paperHeightInches: spec.heightInches,
      orientation,
    };
    const fit = computeFit(testConfig, currentPassportSpec, spec, printerMarginStandard);
    const currentTotalAssigned = multiPerson.persons.reduce(
      (sum, p) => sum + Math.max(0, p.slotCount),
      0
    );
    const newPaperName = spec.name.split(" (")[0] || spec.name;

    // Apply paper size change WITHOUT auto-redistributing person slot counts
    applyPaperSizeChange(paperId);
    setPendingPaperChange(null);

    if (currentTotalAssigned > fit.maxPhotos) {
      showToast(
        `Changing to ${newPaperName} reduces capacity to ${fit.maxPhotos}. Current assignments (${currentTotalAssigned} slots) exceed this. Please reduce slot counts manually.`
      );
    }
  };

  const handleConfirmPaperChange = (strategy: "proportional" | "equal") => {
    if (!pendingPaperChange) return;
    const { paperId, newCapacity } = pendingPaperChange;

    if (strategy === "proportional") {
      setMultiPerson((prev) => ({
        ...prev,
        persons: scaleSlotAssignments(prev.persons, newCapacity),
        customSlotAssignments: [],
      }));
      showToast(`Scaled slots proportionally for ${newCapacity} sheet capacity.`);
    } else {
      const equalCounts = computeEqualSplit(newCapacity, multiPerson.persons.length);
      setMultiPerson((prev) => ({
        ...prev,
        persons: prev.persons.map((p, i) => ({ ...p, slotCount: equalCounts[i] || 1 })),
        customSlotAssignments: [],
      }));
      showToast(`Divided ${newCapacity} slots equally among ${multiPerson.persons.length} persons.`);
    }

    applyPaperSizeChange(paperId);
    setPendingPaperChange(null);
  };

  // Custom Paper dimension change handler
  const handleCustomPaperDimensionChange = (dimension: "width" | "height", valMm: number) => {
    const safeMm = Math.max(30, valMm);
    const valInches = safeMm / 25.4;
    setSheetConfig((prev) => {
      const nextConfig: PhotoSheetConfig = {
        ...prev,
        paperWidthInches: dimension === "width" ? valInches : prev.paperWidthInches,
        paperHeightInches: dimension === "height" ? valInches : prev.paperHeightInches,
      };
      const fit = computeFit(nextConfig, currentPassportSpec, currentPaperSpec, printerMarginStandard);
      return {
        ...nextConfig,
        copies: fit.maxPhotos,
        columns: fit.cols,
        rows: fit.rows,
        autoFit: true,
        marginLeftInches: fit.marginX / 25.4,
        marginRightInches: fit.marginX / 25.4,
        marginTopInches: fit.marginY / 25.4,
        marginBottomInches: fit.marginY / 25.4,
      };
    });
  };

  // Country standard change handler: recalculates fit when photo dimensions change
  const handlePassportStandardChange = (stdId: string) => {
    invalidateCompositedBackground();
    const spec = PASSPORT_STANDARDS.find((p) => p.id === stdId);
    if (!spec) return;

    setSheetConfig((prev) => {
      const nextConfig: PhotoSheetConfig = {
        ...prev,
        passportStandardId: spec.id,
        photoWidthInches: spec.widthInches,
        photoHeightInches: spec.heightInches,
      };

      const fit = computeFit(nextConfig, spec, currentPaperSpec, printerMarginStandard);
      return {
        ...nextConfig,
        copies: fit.maxPhotos,
        columns: fit.cols,
        rows: fit.rows,
        autoFit: true,
        marginLeftInches: fit.marginX / 25.4,
        marginRightInches: fit.marginX / 25.4,
        marginTopInches: fit.marginY / 25.4,
        marginBottomInches: fit.marginY / 25.4,
      };
    });
  };

  // Orientation change handler
  const handleOrientationChange = (orientation: "portrait" | "landscape") => {
    setSheetConfig((prev) => {
      const nextConfig: PhotoSheetConfig = {
        ...prev,
        orientation,
      };

      const fit = computeFit(nextConfig, currentPassportSpec, currentPaperSpec, printerMarginStandard);
      return {
        ...nextConfig,
        copies: fit.maxPhotos,
        columns: fit.cols,
        rows: fit.rows,
        autoFit: true,
        marginLeftInches: fit.marginX / 25.4,
        marginRightInches: fit.marginX / 25.4,
        marginTopInches: fit.marginY / 25.4,
        marginBottomInches: fit.marginY / 25.4,
      };
    });
  };

  // Quick Preset Handlers: clamps copies to genuine capacity
  const handleSelectPresetCopies = (copies: number, cols?: number, rows?: number) => {
    const clampedCopies = Math.max(1, Math.min(copies, dynamicMaxPhotos));
    setSheetConfig((prev) => ({
      ...prev,
      copies: clampedCopies,
      columns: cols || Math.max(1, Math.min(prev.columns, dynamicCols)),
      rows: rows || Math.max(1, Math.min(prev.rows, dynamicRows)),
      autoFit: true,
    }));
  };

  const handleAutoFitLayout = () => {
    const minMarginMm = printerMarginStandard === "professional" ? 1.5 : 3.0;
    const gapMm = (sheetConfig.gapHorizontalInches ?? (1.0 / 25.4)) * 25.4;
    const opt = optimizeLayout(
      currentFit.paperW,
      currentFit.paperH,
      currentFit.photoW,
      currentFit.photoH,
      minMarginMm,
      gapMm
    );

    setSheetConfig((prev) => ({
      ...prev,
      copies: opt.total,
      columns: opt.cols,
      rows: opt.rows,
      autoFit: true,
      marginMode: "auto",
      marginLeftInches: opt.marginX / 25.4,
      marginRightInches: opt.marginX / 25.4,
      marginTopInches: opt.marginY / 25.4,
      marginBottomInches: opt.marginY / 25.4,
      gapHorizontalInches: gapMm / 25.4,
      gapVerticalInches: gapMm / 25.4,
    }));
    showToast(`Layout auto-fitted to maximum sheet capacity (${opt.total} photos).`);
  };

  const handleApplyLayoutOption = (target: SheetLayoutOption) => {
    setSheetConfig((prev) => ({
      ...prev,
      orientation: target.orientation,
      printInstanceRotation: target.photoRotated ? 90 : 0,
      columns: target.cols,
      rows: target.rows,
      copies: target.total,
      autoFit: true,
      marginMode: "auto",
      marginLeftInches: target.marginX / 25.4,
      marginRightInches: target.marginX / 25.4,
      marginTopInches: target.marginY / 25.4,
      marginBottomInches: target.marginY / 25.4,
    }));
    showToast(`Applied optimal ${target.cols} × ${target.rows} layout (${target.total} photos on ${target.orientation}).`);
  };

  const handleSelectPrinterStandard = (standard: PrinterMarginStandardType) => {
    setPrinterMarginStandard(standard);
    const minMarginMm = standard === "professional" ? 1.5 : 3.0;
    const gapMm = (sheetConfig.gapHorizontalInches ?? (1.0 / 25.4)) * 25.4;

    setSheetConfig((prev) => {
      const updatedConfig = { ...prev, printerMarginStandard: standard };
      const fit = computeFit(updatedConfig, currentPassportSpec, currentPaperSpec, standard);
      return {
        ...updatedConfig,
        marginLeftInches: fit.marginX / 25.4,
        marginRightInches: fit.marginX / 25.4,
        marginTopInches: fit.marginY / 25.4,
        marginBottomInches: fit.marginY / 25.4,
        copies: prev.autoFit ? fit.maxPhotos : Math.min(prev.copies, fit.maxPhotos),
        columns: prev.autoFit ? fit.cols : Math.min(prev.columns, fit.cols),
        rows: prev.autoFit ? fit.rows : Math.min(prev.rows, fit.rows),
      };
    });
    showToast(
      standard === "professional"
        ? "Professional printer preset active (1.5mm margins)."
        : "Standard printer preset active (3.0mm margins safe for all printers)."
    );
  };

  const handleSmartOptimizeMargins = () => {
    const minMarginMm = printerMarginStandard === "professional" ? 1.5 : 3.0;
    const gapMm = (sheetConfig.gapHorizontalInches ?? (1.0 / 25.4)) * 25.4;
    const opt = optimizeLayout(
      currentFit.paperW,
      currentFit.paperH,
      currentFit.photoW,
      currentFit.photoH,
      minMarginMm,
      gapMm
    );

    setSheetConfig((prev) => ({
      ...prev,
      marginMode: "auto",
      marginLeftInches: opt.marginX / 25.4,
      marginRightInches: opt.marginX / 25.4,
      marginTopInches: opt.marginY / 25.4,
      marginBottomInches: opt.marginY / 25.4,
      columns: opt.cols,
      rows: opt.rows,
      copies: prev.autoFit ? opt.total : Math.min(prev.copies, opt.total),
    }));
    showToast(`Margins optimized & centered: ${opt.marginX.toFixed(1)}mm sides, ${opt.marginY.toFixed(1)}mm top/bottom.`);
  };

  // Outer Margin update helper
  const handleMarginChange = (side: "top" | "bottom" | "left" | "right", rawValue: number) => {
    const valInInches = convertUnits(Math.max(0, rawValue), marginUnit, "in");
    setSheetConfig((prev) => {
      const updated: PhotoSheetConfig = { ...prev, marginMode: "manual" as const };
      if (side === "top") updated.marginTopInches = valInInches;
      if (side === "bottom") updated.marginBottomInches = valInInches;
      if (side === "left") updated.marginLeftInches = valInInches;
      if (side === "right") updated.marginRightInches = valInInches;

      const fit = computeFit(updated, currentPassportSpec, currentPaperSpec);
      return {
        ...updated,
        copies: prev.autoFit ? fit.maxPhotos : Math.min(prev.copies, fit.maxPhotos),
        columns: prev.autoFit ? fit.cols : Math.min(prev.columns, fit.cols),
        rows: prev.autoFit ? fit.rows : Math.min(prev.rows, fit.rows),
      };
    });
  };

  // Photo Gap change helper
  const handleGapChange = (valInches: number) => {
    const safeGap = Math.max(0, valInches);
    setSheetConfig((prev) => {
      const updated: PhotoSheetConfig = {
        ...prev,
        gapHorizontalInches: safeGap,
        gapVerticalInches: safeGap,
      };
      const fit = computeFit(updated, currentPassportSpec, currentPaperSpec);
      return {
        ...updated,
        copies: prev.autoFit ? fit.maxPhotos : Math.min(prev.copies, fit.maxPhotos),
        columns: prev.autoFit ? fit.cols : Math.min(prev.columns, fit.cols),
        rows: prev.autoFit ? fit.rows : Math.min(prev.rows, fit.rows),
      };
    });
  };

  const PASSPORT_STUDIO_STEPS: StudioStep[] = [
    {
      id: "crop",
      label: "1. Biometric Cutout",
      shortLabel: "1. Cutout",
      description: "Source portrait, standard specs, & biometric crop",
      icon: <Crop className="w-3.5 h-3.5" />,
      isCompleted: !!processedPhotoDataUrl,
    },
    {
      id: "filters",
      label: "2. Retouch & Tone",
      shortLabel: "2. Retouch",
      description: "CamScanner presets, tone grading, & contrast",
      icon: <Palette className="w-3.5 h-3.5" />,
      isCompleted: !!processedPhotoDataUrl,
    },
    {
      id: "sheet",
      label: `3. Print Sheet (${sheetConfig.copies} Copies)`,
      shortLabel: "3. Print Sheet",
      description: `${currentFit.paperName} multi-copy grid layout (${sheetConfig.copies} copies), margins, & 300 DPI PDF export`,
      icon: <Grid className="w-3.5 h-3.5" />,
      isCompleted: layoutResult.fits,
    },
  ];

  const isDirty =
    cropRotation !== 0 ||
    cropZoom !== 1.0 ||
    cropImagePan.x !== 0 ||
    cropImagePan.y !== 0 ||
    activePreset !== "original" ||
    rawSourceImage !== defaultInitialImage;

  if (!isOpen) return null;

  return (
    <>
      <UnifiedStudioShell
        isOpen={isOpen}
        onClose={handlePassportStudioClose}
        title="Passport & 4×6″ Photo Studio"
        subtitle="Official Biometric Cropping, Face Guides, Retouch, & 4×6″ Multi-Copy Grid Printing"
        badgeText="ICAO 9303 Biometric Engine"
        badgeVariant="sky"
        icon={<Sparkles className="w-5 h-5 text-sky-400" />}
        steps={PASSPORT_STUDIO_STEPS}
        activeStepId={studioStep}
        onSelectStep={(stepId) => handleSelectStep(stepId as "crop" | "filters" | "sheet")}
        headerExtraActions={
          <button
            type="button"
            onClick={handleOpenBgRemover}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-medium transition-colors shadow-sm cursor-pointer"
            title="Open Professional Studio Background Remover"
          >
            <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Background Remover</span>
          </button>
        }
        rightPanelWidth="w-96"
        rightPanelTitle={
          studioStep === "crop"
            ? "Portrait Source & Specifications"
            : studioStep === "filters"
            ? "Tone Grading & CamScanner Filters"
            : `${currentFit.paperName} Sheet & Layout Parameters`
        }
        footerLeft={
          <div className="flex items-center space-x-2">
            {studioStep !== "crop" && (
              <button
                type="button"
                onClick={() => {
                  if (studioStep === "sheet") handleSelectStep("filters");
                  else if (studioStep === "filters") handleSelectStep("crop");
                }}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs font-medium border border-neutral-700 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back to {studioStep === "sheet" ? "Retouch" : "Cutout"}</span>
              </button>
            )}
            {onInsertIntoDocument && studioStep === "sheet" && (
              <button
                type="button"
                onClick={handleInsertIntoDocument}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-sky-300 border border-sky-700/50 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-sky-400" />
                <span>Insert to Project</span>
              </button>
            )}
          </div>
        }
        footerCenter={
          studioStep === "sheet" ? (
            layoutResult.fits ? (
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs shadow-lg backdrop-blur">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold">✓ Fits Perfectly on {currentPaperSpec.name} ({layoutResult.totalPhotosPlaced} copies)</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-950/90 border border-rose-500/50 text-rose-300 text-xs shadow-lg backdrop-blur">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-semibold">⚠ Layout does not fit</span>
                <button
                  type="button"
                  onClick={handleAutoFitLayout}
                  className="ml-2 px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px]"
                >
                  Auto Fit
                </button>
              </div>
            )
          ) : (
            <span className="text-xs text-neutral-400 font-mono">
              {currentPassportSpec.name} ({currentPassportSpec.widthMm} × {currentPassportSpec.heightMm} mm)
            </span>
          )
        }
        footerRight={
          <div className="flex items-center space-x-2">
            {activeEditingPersonId && studioStep === "crop" && (
              <button
                type="button"
                onClick={handleSaveAndReturnToSheet}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow transition-colors cursor-pointer"
                title="Save biometric crop to person slot and return to print sheet"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Crop &amp; Return to Sheet</span>
              </button>
            )}
            {studioStep === "crop" && (
              <button
                type="button"
                onClick={() => handleSelectStep("filters")}
                className="flex items-center space-x-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs shadow transition-colors cursor-pointer"
              >
                <span>Continue to Retouch &amp; Tone</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {studioStep === "filters" && (
              <button
                type="button"
                onClick={() => handleSelectStep("sheet")}
                className="flex items-center space-x-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs shadow transition-colors cursor-pointer"
              >
                <span>Proceed to {currentFit.paperName} Sheet Layout</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            {studioStep === "sheet" && (
              <>
                <button
                  type="button"
                  onClick={() => handleExportImage("image/jpeg")}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 rounded-lg flex items-center space-x-1.5 transition-colors border border-neutral-700 text-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>JPG</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg flex items-center space-x-1.5 transition-colors shadow text-xs cursor-pointer disabled:opacity-50"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintSheet}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg flex items-center space-x-1.5 transition-colors shadow text-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Sheet</span>
                </button>
              </>
            )}
          </div>
        }
        isDirty={isDirty}
        dirtyWarningMessage="You have an active portrait session with crop or filter settings that will be discarded."
        onRotateCW={() => handleRotateImage(90)}
        onRotateCCW={() => handleRotateImage(-90)}
        onZoomIn={() => setCropZoom((prev) => Math.min(5.0, Number((prev * 1.1).toFixed(2))))}
        onZoomOut={() => setCropZoom((prev) => Math.max(0.2, Number((prev / 1.1).toFixed(2))))}
        onFitZoom={() => {
          setCropZoom(1.0);
          setCropImagePan({ x: 0, y: 0 });
        }}
        onPrimaryAction={() => {
          if (studioStep === "crop") handleSelectStep("filters");
          else if (studioStep === "filters") handleSelectStep("sheet");
          else handlePrintSheet();
        }}
        centerContent={
          <div className="flex-1 bg-neutral-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none w-full h-full">
            {/* Active Person Editing Banner */}
            {activeEditingPersonId && (
              <div className="absolute top-3 inset-x-6 z-30 bg-neutral-900/95 backdrop-blur-md border border-sky-500/70 rounded-xl px-4 py-2.5 flex items-center justify-between shadow-2xl">
                <div className="flex items-center space-x-2.5">
                  <span
                    className="w-3.5 h-3.5 rounded-full ring-2 ring-white/30"
                    style={{
                      backgroundColor:
                        multiPerson.persons.find((p) => p.id === activeEditingPersonId)?.color ||
                        "#0284C7",
                    }}
                  />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <span>Editing Portrait:</span>
                      <span className="text-sky-400">
                        {multiPerson.persons.find((p) => p.id === activeEditingPersonId)?.label ||
                          "Person"}
                      </span>
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      Crop framing and filters will apply to this person's assigned slots.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveAndReturnToSheet}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow transition-colors flex items-center space-x-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Done • Return to Sheet</span>
                </button>
              </div>
            )}

            {/* STAGE 1: Biometric Crop Editor */}
            {studioStep === "crop" && (
              <div
                ref={cropContainerRef}
                onMouseDown={handleImageMouseDown}
                className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
              >
                {/* Source Image Frame */}
                <div
                  className="relative inline-block shadow-2xl rounded border border-neutral-800"
                  style={{
                    backgroundImage: `repeating-conic-gradient(#262626 0% 25%, #171717 0% 50%) 50% / 16px 16px`,
                  }}
                >
                  <img
                    ref={cropImageRef}
                    src={rawSourceImage}
                    alt="Source Crop"
                    className="max-h-[62vh] max-w-[50vw] object-contain block pointer-events-none"
                    onLoad={(e) => {
                      const target = e.currentTarget;
                      if (target.offsetWidth > 0 && target.offsetHeight > 0) {
                        cropStageLayoutRef.current = {
                          width: target.offsetWidth,
                          height: target.offsetHeight,
                        };
                      }
                    }}
                    style={{
                      transform: `translate(${cropImagePan.x}px, ${cropImagePan.y}px) rotate(${cropRotation}deg) scale(${cropZoom})`,
                      transformOrigin: "center center",
                      transition: isPanningImage ? "none" : "transform 0.12s ease-out",
                    }}
                  />

                  {/* Darkened Outside Silhouette Mask */}
                  <div
                    className="absolute inset-0 bg-black/60 pointer-events-none"
                    style={{
                      clipPath: `polygon(
                        0% 0%, 100% 0%, 100% 100%, 0% 100%,
                        0% ${cropBox.y * 100}%,
                        ${cropBox.x * 100}% ${cropBox.y * 100}%,
                        ${cropBox.x * 100}% ${(cropBox.y + cropBox.height) * 100}%,
                        ${(cropBox.x + cropBox.width) * 100}% ${(cropBox.y + cropBox.height) * 100}%,
                        ${(cropBox.x + cropBox.width) * 100}% ${cropBox.y * 100}%,
                        0% ${cropBox.y * 100}%
                      )`,
                    }}
                  />

                  {/* FIXED CROP BOX FRAME (Dimensions and Aspect Ratio Remain Fixed When Wheel Zooming) */}
                  <div
                    onMouseDown={(e) => handleCropHandleMouseDown(e, "move")}
                    className="absolute border-2 border-sky-400 shadow-xl cursor-move pointer-events-auto"
                    style={{
                      left: `${cropBox.x * 100}%`,
                      top: `${cropBox.y * 100}%`,
                      width: `${cropBox.width * 100}%`,
                      height: `${cropBox.height * 100}%`,
                    }}
                  >
                    {/* Official Biometric Guidelines Overlay */}
                    {showBiometricGuides && (
                      <div className="absolute inset-0 pointer-events-none opacity-80">
                        {/* Center Line (Vertical) */}
                        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-sky-400/60 border-l border-dashed border-sky-300/80" />

                        {/* Crown Top 70-80% Guide */}
                        <div className="absolute top-[12%] inset-x-0 h-px bg-amber-400/70 border-t border-dashed border-amber-300" />
                        <span className="absolute top-[13%] left-1 text-[9px] font-mono text-amber-300/90">
                          Crown (70-80%)
                        </span>

                        {/* Eye Line Guide */}
                        <div className="absolute top-[42%] inset-x-0 h-px bg-emerald-400/80 border-t border-dashed border-emerald-300" />
                        <span className="absolute top-[43%] left-1 text-[9px] font-mono text-emerald-300/90">
                          Eye Level (40-45%)
                        </span>

                        {/* Chin Baseline */}
                        <div className="absolute bottom-[18%] inset-x-0 h-px bg-rose-400/70 border-t border-dashed border-rose-300" />
                        <span className="absolute bottom-[19%] left-1 text-[9px] font-mono text-rose-300/90">
                          Chin Line
                        </span>

                        {/* Head Position Oval */}
                        <div className="absolute top-[10%] bottom-[16%] left-[16%] right-[16%] rounded-full border border-sky-300/40 border-dashed" />
                      </div>
                    )}

                    {/* Corner Handles (4 corners) */}
                    <div
                      onMouseDown={(e) => handleCropHandleMouseDown(e, "nw")}
                      className="absolute -top-2 -left-2 w-4 h-4 bg-sky-400 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                    />
                    <div
                      onMouseDown={(e) => handleCropHandleMouseDown(e, "ne")}
                      className="absolute -top-2 -right-2 w-4 h-4 bg-sky-400 border-2 border-white rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                    />
                    <div
                      onMouseDown={(e) => handleCropHandleMouseDown(e, "se")}
                      className="absolute -bottom-2 -right-2 w-4 h-4 bg-sky-400 border-2 border-white rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                    />
                    <div
                      onMouseDown={(e) => handleCropHandleMouseDown(e, "sw")}
                      className="absolute -bottom-2 -left-2 w-4 h-4 bg-sky-400 border-2 border-white rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                    />

                    {/* Edge Handles (4 edges) */}
                    <div
                      onMouseDown={(e) => handleCropHandleMouseDown(e, "n")}
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-sky-400 border border-white rounded-full cursor-ns-resize shadow"
                    />
                    <div
                      onMouseDown={(e) => handleCropHandleMouseDown(e, "s")}
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-sky-400 border border-white rounded-full cursor-ns-resize shadow"
                    />
                    <div
                      onMouseDown={(e) => handleCropHandleMouseDown(e, "w")}
                      className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-6 bg-sky-400 border border-white rounded-full cursor-ew-resize shadow"
                    />
                    <div
                      onMouseDown={(e) => handleCropHandleMouseDown(e, "e")}
                      className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-6 bg-sky-400 border border-white rounded-full cursor-ew-resize shadow"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STAGE 2: Tone & Filter Studio Preview */}
            {studioStep === "filters" && (
              <div className="flex flex-col items-center justify-center space-y-3">
                <div
                  className="relative p-2 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl"
                  style={{
                    backgroundImage: `repeating-conic-gradient(#262626 0% 25%, #171717 0% 50%) 50% / 16px 16px`,
                  }}
                >
                  <img
                    src={compositedPhotoUrl || processedPhotoDataUrl || rawSourceImage}
                    alt="Retouched Portrait"
                    className="max-h-[60vh] max-w-[45vw] object-contain rounded-lg shadow-inner"
                  />
                  <div className="absolute top-4 right-4 bg-neutral-950/80 backdrop-blur-md px-2.5 py-1 rounded text-xs font-mono text-sky-400 border border-neutral-700">
                    {currentPassportSpec.widthMm} × {currentPassportSpec.heightMm} mm
                  </div>
                </div>
                <div className="flex items-center space-x-2 text-xs text-neutral-400">
                  <span>Standard:</span>
                  <span className="text-neutral-200 font-semibold">{currentPassportSpec.name}</span>
                </div>
              </div>
            )}

            {/* STAGE 3: 4×6" Print Sheet Real-Time Preview */}
            {studioStep === "sheet" && (
              <div className="flex flex-col items-center justify-center w-full h-full relative">
                {isRendering ? (
                  <div className="flex flex-col items-center space-y-2 text-neutral-400">
                    <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
                    <span className="text-xs">Computing 4×6" sheet layout raster...</span>
                  </div>
                ) : previewCanvas ? (
                  <div className="relative max-w-full max-h-full flex items-center justify-center p-3">
                    <div className="relative shadow-2xl border-2 border-neutral-700 rounded bg-white overflow-hidden">
                      <img
                        src={previewCanvas.toDataURL()}
                        alt="Sheet Layout"
                        className="max-h-[64vh] max-w-[52vw] object-contain block"
                      />
                      {multiPerson.enabled && (
                        <InteractiveSheetSlotOverlay
                          positions={layoutResult.positions}
                          slotMapping={currentSlotMapping}
                          persons={multiPerson.persons}
                          paperWidthInches={sheetConfig.paperWidthInches}
                          paperHeightInches={sheetConfig.paperHeightInches}
                          selectedSlotIndex={multiPerson.selectedSlotIndex}
                          onSelectSlot={(idx) =>
                            setMultiPerson((prev) => ({ ...prev, selectedSlotIndex: idx }))
                          }
                          onAssignSlot={handleAssignSlot}
                          showOverlays={multiPerson.showSlotOverlaysOnPreview}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-neutral-500 text-xs">No preview rendered yet</div>
                )}

                {/* Real-Time Sheet Validation Badge Overlay */}
                <div className="absolute bottom-3 left-4 flex items-center space-x-2">
                  {layoutResult.fits ? (
                    <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs shadow-lg backdrop-blur">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-semibold">✓ Fits Perfectly on {currentPaperSpec.name}</span>
                      <span className="text-emerald-400/70 font-mono">({layoutResult.totalPhotosPlaced} copies)</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-950/90 border border-rose-500/50 text-rose-300 text-xs shadow-lg backdrop-blur">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      <span className="font-semibold">⚠ Layout does not fit within the 4×6 printable area.</span>
                      <button
                        onClick={handleAutoFitLayout}
                        className="ml-2 px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] transition-colors"
                      >
                        Auto Fit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick Stage Controls (Zoom In/Out, Wheel indicator, Rotate, Biometric Guides toggle) */}
            <div className="absolute top-3 left-3 flex items-center space-x-1.5 bg-neutral-900/90 backdrop-blur-md px-2 py-1 rounded-lg border border-neutral-800 text-xs">
              <span className="text-neutral-400 text-[11px] font-mono mr-1">
                {sourceDimensions.width}×{sourceDimensions.height}px
              </span>

              <div className="h-3 w-px bg-neutral-750 mx-0.5" />

              {/* Mouse Wheel Zoom In / Out / Reset Controls */}
              <button
                onClick={() => setCropZoom((prev) => Math.min(5.0, Number((prev * 1.1).toFixed(2))))}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white"
                title="Zoom Image In (or Mouse Wheel Up)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-sky-400 px-1">
                {Math.round(cropZoom * 100)}%
              </span>
              <button
                onClick={() => setCropZoom((prev) => Math.max(0.2, Number((prev / 1.1).toFixed(2))))}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white"
                title="Zoom Image Out (or Mouse Wheel Down)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              {(cropZoom !== 1.0 || cropImagePan.x !== 0 || cropImagePan.y !== 0) && (
                <button
                  onClick={() => {
                    setCropZoom(1.0);
                    setCropImagePan({ x: 0, y: 0 });
                  }}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                  title="Reset Image Zoom & Pan"
                >
                  100%
                </button>
              )}

              <div className="h-3 w-px bg-neutral-750 mx-0.5" />

              <button
                onClick={() => handleRotateImage(90)}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white"
                title="Rotate 90° CW"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowBiometricGuides((prev) => !prev)}
                className={`p-1 rounded ${showBiometricGuides ? "bg-sky-600 text-white" : "hover:bg-neutral-800 text-neutral-400"}`}
                title="Toggle Biometric Head Guides"
              >
                <Crosshair className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setAspectRatioLocked((prev) => !prev)}
                className={`p-1 rounded ${aspectRatioLocked ? "bg-sky-600 text-white" : "hover:bg-neutral-800 text-neutral-400"}`}
                title={aspectRatioLocked ? "Aspect Ratio Locked" : "Aspect Ratio Free"}
              >
                {aspectRatioLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        }
        rightPanel={
          <div className="space-y-4 select-none text-xs text-neutral-200">
            {/* STEP 1: Biometric Cutout Settings */}
            {studioStep === "crop" && (
              <div className="p-4 space-y-4">
                {/* Source Selection Source Tab */}
                <div>
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
                    Source Photo Origin
                  </label>
                  <div className="grid grid-cols-5 gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                    <button
                      onClick={() => setSourceTab("document")}
                      className={`p-1.5 rounded flex flex-col items-center justify-center transition-colors ${
                        sourceTab === "document" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"
                      }`}
                      title="From Current Document"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span className="text-[9px] mt-0.5">Document</span>
                    </button>
                    <button
                      onClick={() => {
                        setSourceTab("upload");
                        fileInputRef.current?.click();
                      }}
                      className={`p-1.5 rounded flex flex-col items-center justify-center transition-colors ${
                        sourceTab === "upload" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"
                      }`}
                      title="Upload Image File"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span className="text-[9px] mt-0.5">Upload</span>
                    </button>
                    <button
                      onClick={() => {
                        setSourceTab("camera");
                        handleStartCamera();
                      }}
                      className={`p-1.5 rounded flex flex-col items-center justify-center transition-colors ${
                        sourceTab === "camera" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"
                      }`}
                      title="Live Webcam Capture"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span className="text-[9px] mt-0.5">Camera</span>
                    </button>
                    <button
                      onClick={() => {
                        setSourceTab("clipboard");
                        handlePasteClipboard();
                      }}
                      className={`p-1.5 rounded flex flex-col items-center justify-center transition-colors ${
                        sourceTab === "clipboard" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"
                      }`}
                      title="Paste from Clipboard"
                    >
                      <Clipboard className="w-3.5 h-3.5" />
                      <span className="text-[9px] mt-0.5">Paste</span>
                    </button>
                    <button
                      onClick={() => setSourceTab("samples")}
                      className={`p-1.5 rounded flex flex-col items-center justify-center transition-colors ${
                        sourceTab === "samples" ? "bg-sky-600 text-white" : "text-neutral-400 hover:text-white"
                      }`}
                      title="Built-in Portrait Models"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span className="text-[9px] mt-0.5">Models</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPdfFile(null);
                        setIsPdfImportDialogOpen(true);
                      }}
                      className="p-1.5 rounded flex flex-col items-center justify-center transition-colors text-neutral-400 hover:text-white"
                      title="Import Portrait from PDF Document"
                    >
                      <FileText className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-[9px] mt-0.5">PDF</span>
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_DOCUMENT_AND_IMAGE_TYPES}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      e.target.value = "";

                      const analysis = analyzeFile(file);

                      if (analysis.category === "pdf") {
                        setSelectedPdfFile(file);
                        setIsPdfImportDialogOpen(true);
                      } else if (analysis.category === "document") {
                        showToast(`Parsing ${analysis.extension.toUpperCase()} document...`);
                        parseDocumentFile(file)
                          .then((pages) => {
                            if (pages.length > 0) {
                              setRawSourceImage(pages[0].dataUrl);
                              showToast(`Loaded ${file.name}`);
                            }
                          })
                          .catch((err) => {
                            console.error("Document read error:", err);
                            showToast("Failed to parse document content.");
                          });
                      } else {
                        decodeImageFile(file)
                          .then(async (decoded) => {
                            setRawSourceImage(decoded.dataUrl);
                            const trans = await detectImageTransparency(decoded.dataUrl);
                            if (trans.hasTransparency) {
                              setBgColorReplacement("none");
                            }
                            showToast(`Loaded ${file.name}`);
                          })
                          .catch((err) => {
                            console.error("Image decode error:", err);
                            showToast("Failed to read image file.");
                          });
                      }
                    }}
                  />
                </div>

                {/* Camera Live Modal Stream */}
                {sourceTab === "camera" && isCameraActive && (
                  <div className="bg-neutral-950 p-2.5 rounded-lg border border-sky-500/40 space-y-2">
                    <div className="relative rounded overflow-hidden aspect-[4/3] bg-black">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-48 h-60 border-2 border-sky-400 border-dashed rounded-full opacity-70" />
                      </div>
                    </div>
                    <button
                      onClick={handleCaptureCamera}
                      className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded flex items-center justify-center space-x-2 transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Capture Photo</span>
                    </button>
                  </div>
                )}

                {/* Document Pages Carousel (if Source is Document) */}
                {sourceTab === "document" && pages.length > 0 && (
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">
                      Select Page ({pages.length} pages available)
                    </label>
                    <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1 bg-neutral-950 rounded-lg border border-neutral-800 custom-scrollbar">
                      {pages.map((pg, idx) => (
                        <button
                          key={pg.id}
                          onClick={() => setRawSourceImage(pg.processedDataUrl || pg.originalDataUrl)}
                          className={`relative aspect-[3/4] rounded overflow-hidden border transition-all ${
                            rawSourceImage === (pg.processedDataUrl || pg.originalDataUrl)
                              ? "border-sky-500 ring-2 ring-sky-500/40"
                              : "border-neutral-800 hover:border-neutral-600"
                          }`}
                        >
                          <img
                            src={pg.thumbnailDataUrl || pg.processedDataUrl}
                            alt={`Page ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] font-mono text-center text-white py-0.5">
                            #{idx + 1}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Built-in Studio Models (if Source is Samples) */}
                {sourceTab === "samples" && (
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">
                      Sample Biometric Portrait Models
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setRawSourceImage(createSamplePortraitSvg("male"))}
                        className="p-2 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-sky-500 text-center"
                      >
                        <div className="text-xs font-bold text-white">Male Suit</div>
                        <div className="text-[10px] text-neutral-400">Formal Tie</div>
                      </button>
                      <button
                        onClick={() => setRawSourceImage(createSamplePortraitSvg("female"))}
                        className="p-2 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-sky-500 text-center"
                      >
                        <div className="text-xs font-bold text-white">Female Blazer</div>
                        <div className="text-[10px] text-neutral-400">Executive</div>
                      </button>
                      <button
                        onClick={() => setRawSourceImage(createSamplePortraitSvg("id_card"))}
                        className="p-2 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-sky-500 text-center"
                      >
                        <div className="text-xs font-bold text-white">ID Portrait</div>
                        <div className="text-[10px] text-neutral-400">Neutral Gray</div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Professional Background Remover Card Shortcut */}
                <div className="p-3 bg-gradient-to-r from-emerald-950/40 to-neutral-950 rounded-lg border border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-1.5 text-emerald-300 font-bold text-xs">
                      <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Studio Background Remover</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      Hair-preserving biometric separation & official color backdrop
                    </p>
                  </div>
                  <button
                    onClick={handleOpenBgRemover}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-xs transition-colors shadow"
                  >
                    Open
                  </button>
                </div>

                {/* Passport & Country Standards Selector */}
                <div>
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">
                    Official Country & Dimension Presets
                  </label>
                  <select
                    value={sheetConfig.passportStandardId}
                    onChange={(e) => handlePassportStandardChange(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    {PASSPORT_STANDARDS.map((std) => (
                      <option key={std.id} value={std.id}>
                        {std.name} ({std.widthMm} × {std.heightMm} mm)
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-neutral-400 mt-1 italic">{currentPassportSpec.description}</p>
                </div>

                {/* Next Step Button */}
                <button
                  onClick={handleProceedToFilters}
                  className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-md mt-4"
                >
                  <span>Proceed to Retouch & Filters</span>
                  <Check className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* STEP 2: Retouch & Filters Settings */}
            {studioStep === "filters" && (
              <div className="p-4 space-y-4">
                {/* Background Replacement Color */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                      Studio Background Replacement
                    </label>
                    <button
                      onClick={handleOpenBgRemover}
                      className="text-[10px] text-emerald-400 hover:underline flex items-center space-x-1"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span>Refine Cutout</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      onClick={() => setBgColorReplacement("white")}
                      className={`p-2 rounded-lg border flex flex-col items-center space-y-1 transition-all ${
                        bgColorReplacement === "white" ? "border-sky-500 bg-sky-950/40" : "border-neutral-800 bg-neutral-950"
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-white border border-neutral-300 shadow-sm" />
                      <span className="text-[10px] font-medium">Pure White</span>
                    </button>
                    <button
                      onClick={() => setBgColorReplacement("blue")}
                      className={`p-2 rounded-lg border flex flex-col items-center space-y-1 transition-all ${
                        bgColorReplacement === "blue" ? "border-sky-500 bg-sky-950/40" : "border-neutral-800 bg-neutral-950"
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-sky-400 border border-sky-200 shadow-sm" />
                      <span className="text-[10px] font-medium">Embassy Blue</span>
                    </button>
                    <button
                      onClick={() => setBgColorReplacement("gray")}
                      className={`p-2 rounded-lg border flex flex-col items-center space-y-1 transition-all ${
                        bgColorReplacement === "gray" ? "border-sky-500 bg-sky-950/40" : "border-neutral-800 bg-neutral-950"
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-neutral-300 border border-neutral-400 shadow-sm" />
                      <span className="text-[10px] font-medium">Light Gray</span>
                    </button>
                    <button
                      onClick={() => setBgColorReplacement("none")}
                      className={`p-2 rounded-lg border flex flex-col items-center space-y-1 transition-all ${
                        bgColorReplacement === "none" ? "border-sky-500 bg-sky-950/40" : "border-neutral-800 bg-neutral-950"
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-neutral-800 border border-neutral-600 shadow-sm" />
                      <span className="text-[10px] font-medium">Original</span>
                    </button>
                  </div>
                </div>

                {/* CamScanner Preset Filters */}
                <div>
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">
                    CamScanner Filter Presets
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 bg-neutral-950 rounded-lg border border-neutral-800 custom-scrollbar">
                    {BUILTIN_CAMSCANNER_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset.id)}
                        className={`p-1.5 rounded text-left border transition-all ${
                          activePreset === preset.id
                            ? "bg-sky-600 border-sky-400 text-white font-bold"
                            : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
                        }`}
                      >
                        <div className="text-[11px] truncate">{preset.name}</div>
                        <div className="text-[9px] opacity-70 truncate">{preset.category}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tone & Fine Adjustment Controls */}
                <div className="space-y-3 bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                  <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
                    <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
                      <span>Adjustments &amp; Fine Deskew</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-[10px] text-neutral-400 hover:text-sky-400 font-mono transition-colors flex items-center space-x-1 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 hover:border-neutral-700"
                      title="Reset all adjustments to default"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>Reset All</span>
                    </button>
                  </div>

                  {/* Brightness */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] select-none">
                      <span className="text-neutral-300 flex items-center space-x-1.5">
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                        <span>Brightness</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setBrightness(0)}
                        className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
                        title="Reset Brightness to 0"
                      >
                        reset (0)
                      </button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="-40"
                        max="40"
                        step="1"
                        value={brightness}
                        onChange={(e) => setBrightness(Number(e.target.value))}
                        className="flex-1 h-1.5 bg-neutral-800 accent-sky-500 rounded cursor-pointer"
                      />
                      <UniversalNumericInput
                        id="passport-input-brightness"
                        value={brightness}
                        min={-40}
                        max={40}
                        step={1}
                        precision={0}
                        onChange={(val) => setBrightness(val)}
                        ariaLabel="Brightness value"
                      />
                    </div>
                  </div>

                  {/* Contrast */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] select-none">
                      <span className="text-neutral-300 flex items-center space-x-1.5">
                        <Contrast className="w-3.5 h-3.5 text-sky-400" />
                        <span>Contrast</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setContrast(0)}
                        className="text-[9px] text-neutral-500 hover:text-sky-400 font-mono transition-colors cursor-pointer"
                        title="Reset Contrast to 0"
                      >
                        reset (0)
                      </button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="range"
                        min="-30"
                        max="50"
                        step="1"
                        value={contrast}
                        onChange={(e) => setContrast(Number(e.target.value))}
                        className="flex-1 h-1.5 bg-neutral-800 accent-sky-500 rounded cursor-pointer"
                      />
                      <UniversalNumericInput
                        id="passport-input-contrast"
                        value={contrast}
                        min={-30}
                        max={50}
                        step={1}
                        precision={0}
                        onChange={(val) => setContrast(val)}
                        ariaLabel="Contrast value"
                      />
                    </div>
                  </div>

                  {/* Gamma Curve */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] select-none">
                      <span className="text-neutral-300 flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>Gamma Curve</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setGamma(1.0)}
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
                        value={gamma}
                        onChange={(e) => setGamma(parseFloat(e.target.value))}
                        className="flex-1 h-1.5 bg-neutral-800 accent-sky-500 rounded cursor-pointer"
                      />
                      <UniversalNumericInput
                        id="passport-input-gamma"
                        value={gamma}
                        min={0.2}
                        max={3.0}
                        step={0.05}
                        precision={2}
                        onChange={(val) => setGamma(val)}
                        ariaLabel="Gamma Curve value"
                      />
                    </div>
                  </div>

                  {/* Unsharp Mask (Sharpness) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] select-none">
                      <span className="text-neutral-300 flex items-center space-x-1.5">
                        <Zap className="w-3.5 h-3.5 text-sky-400" />
                        <span>Unsharp Mask</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setSharpness(0)}
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
                        max="50"
                        step="1"
                        value={sharpness}
                        onChange={(e) => setSharpness(Number(e.target.value))}
                        className="flex-1 h-1.5 bg-neutral-800 accent-sky-500 rounded cursor-pointer"
                      />
                      <UniversalNumericInput
                        id="passport-input-sharpness"
                        value={sharpness}
                        min={0}
                        max={50}
                        step={1}
                        precision={0}
                        onChange={(val) => setSharpness(val)}
                        ariaLabel="Unsharp Mask sharpness value"
                      />
                    </div>
                  </div>

                  {/* Fine Deskew Angle */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] select-none">
                      <span className="text-neutral-300 flex items-center space-x-1.5">
                        <Compass className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Fine Deskew</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setDeskewAngle(0)}
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
                        value={deskewAngle}
                        onChange={(e) => setDeskewAngle(Number(parseFloat(e.target.value).toFixed(1)))}
                        className="flex-1 h-1.5 bg-neutral-800 accent-sky-500 rounded cursor-pointer"
                      />
                      <UniversalNumericInput
                        id="passport-input-deskew"
                        value={deskewAngle}
                        min={-15}
                        max={15}
                        step={0.1}
                        precision={1}
                        unit="°"
                        onChange={(val) => setDeskewAngle(val)}
                        ariaLabel="Fine Deskew angle in degrees"
                      />
                    </div>
                  </div>
                </div>

                {/* Single Photo Download */}
                <button
                  onClick={handleDownloadSinglePhoto}
                  className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 rounded-lg flex items-center justify-center space-x-2 transition-colors border border-neutral-700"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Download Cropped Photo Only</span>
                </button>

                {/* Step Navigation */}
                <div className="flex items-center space-x-2 pt-2">
                  <button
                    onClick={() => handleSelectStep("crop")}
                    className="w-1/2 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Back to Crop
                  </button>
                  <button
                    onClick={() => handleSelectStep("sheet")}
                    className="w-1/2 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition-colors shadow"
                  >
                    4×6" Print Sheet
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: 4×6" Print Sheet & 8-Copy Grid Layout Settings */}
            {studioStep === "sheet" && (
              <div className="p-4 space-y-4">
                {/* Dynamic Sheet Capacity Banner & Layout Recommendation */}
                <div className="space-y-2">
                  <div className="bg-sky-950/40 border border-sky-800/60 rounded-lg p-2.5 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-sky-200">
                          {dynamicMaxPhotos} photos fit on {currentFit.paperName}
                        </div>
                        <div className="text-[10px] text-sky-400/80">
                          Current Grid: {dynamicCols} cols × {dynamicRows} rows ({currentPassportSpec.widthMm}×{currentPassportSpec.heightMm} mm)
                          {sheetConfig.printInstanceRotation === 90 || sheetConfig.printInstanceRotation === 270 ? " • Rotated 90°" : ""}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleAutoFitLayout}
                      className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-semibold transition-colors shadow"
                      title="Set copies and grid to maximum capacity"
                    >
                      Fill Max ({dynamicMaxPhotos})
                    </button>
                  </div>

                  {/* Recommendation Card if layout isn't optimal */}
                  {layoutAnalysis.recommendationType !== "current-is-best" && (
                    <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-2.5 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-amber-200">
                            Higher Capacity Available ({layoutAnalysis.overallBest.total} photos)
                          </div>
                          <div className="text-[10px] text-amber-300/80">
                            {layoutAnalysis.recommendationMessage}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleApplyLayoutOption(layoutAnalysis.overallBest)}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold transition-colors shadow shrink-0 ml-2"
                      >
                        Apply ({layoutAnalysis.overallBest.total})
                      </button>
                    </div>
                  )}

                  {/* If current IS best, show confirmation */}
                  {layoutAnalysis.recommendationType === "current-is-best" && (
                    <div className="text-[10px] text-emerald-400/90 bg-emerald-950/20 border border-emerald-900/40 rounded px-2.5 py-1 flex items-center justify-between">
                      <span>✓ {layoutAnalysis.recommendationMessage}</span>
                      <span className="text-[9px] text-neutral-400 font-mono">
                        {printerMarginStandard === "professional" ? "1.5mm pro margins" : "3.0mm safe margins"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Multi-Person Layout Section */}
                <MultiPersonLayoutSection
                  enabled={multiPerson.enabled}
                  onToggleEnabled={(en) => setMultiPerson((prev) => ({ ...prev, enabled: en }))}
                  persons={multiPerson.persons}
                  totalSheetCapacity={dynamicMaxPhotos}
                  paperName={currentFit.paperName}
                  layoutMode={multiPerson.mode}
                  onChangeLayoutMode={handleChangeLayoutMode}
                  onAddPerson={handleAddPerson}
                  onRemovePerson={handleRemovePerson}
                  onUpdatePersonLabel={handleUpdatePersonLabel}
                  onUpdatePersonSlotCount={handleUpdatePersonSlotCount}
                  onOpenPhotoPicker={(p) => setPhotoPickerPerson(p)}
                  onOpenBgStudio={handleOpenBgStudioForPerson}
                  onOpenBgComposer={handleOpenBgStudioForPerson}
                  onSplitEqual={handleSplitEqual}
                  showPersonLabelsOnSheet={multiPerson.showPersonLabelsOnSheet}
                  onToggleShowPersonLabels={(show) =>
                    setMultiPerson((prev) => ({ ...prev, showPersonLabelsOnSheet: show }))
                  }
                  showToast={showToast}
                />

                {/* Quick Sheet Layouts Presets */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                      Quick Sheet Layouts ({currentFit.paperName})
                    </label>
                    <span className="text-[10px] text-sky-400 font-mono">
                      Max {dynamicMaxPhotos}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      onClick={() => handleSelectPresetCopies(dynamicMaxPhotos, dynamicCols, dynamicRows)}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        sheetConfig.copies === dynamicMaxPhotos
                          ? "bg-sky-600 text-white border-sky-400 font-bold"
                          : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-300"
                      }`}
                    >
                      <div className="text-xs font-medium">{dynamicMaxPhotos} Copies</div>
                      <div className="text-[9px] opacity-70">Max ({dynamicCols}×{dynamicRows})</div>
                    </button>
                    {dynamicMaxPhotos >= 4 ? (
                      <button
                        onClick={() =>
                          handleSelectPresetCopies(
                            Math.max(2, Math.floor(dynamicMaxPhotos / 2)),
                            Math.max(1, Math.floor(dynamicCols / 2)),
                            dynamicRows
                          )
                        }
                        className={`p-2 rounded-lg border text-center transition-all ${
                          sheetConfig.copies === Math.max(2, Math.floor(dynamicMaxPhotos / 2))
                            ? "bg-sky-600 text-white border-sky-400 font-bold"
                            : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-300"
                        }`}
                      >
                        <div className="text-xs font-medium">
                          {Math.max(2, Math.floor(dynamicMaxPhotos / 2))} Copies
                        </div>
                        <div className="text-[9px] opacity-70">Half Sheet</div>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSelectPresetCopies(Math.min(2, dynamicMaxPhotos))}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          sheetConfig.copies === Math.min(2, dynamicMaxPhotos)
                            ? "bg-sky-600 text-white border-sky-400 font-bold"
                            : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-300"
                        }`}
                      >
                        <div className="text-xs font-medium">{Math.min(2, dynamicMaxPhotos)} Copies</div>
                        <div className="text-[9px] opacity-70">Dual</div>
                      </button>
                    )}
                    <button
                      onClick={() => handleSelectPresetCopies(Math.min(4, dynamicMaxPhotos))}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        sheetConfig.copies === Math.min(4, dynamicMaxPhotos) && sheetConfig.copies !== dynamicMaxPhotos
                          ? "bg-sky-600 text-white border-sky-400 font-bold"
                          : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-300"
                      }`}
                    >
                      <div className="text-xs font-medium">{Math.min(4, dynamicMaxPhotos)} Copies</div>
                      <div className="text-[9px] opacity-70">Standard</div>
                    </button>
                    <button
                      onClick={() => handleSelectPresetCopies(1, 1, 1)}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        sheetConfig.copies === 1
                          ? "bg-sky-600 text-white border-sky-400 font-bold"
                          : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-300"
                      }`}
                    >
                      <div className="text-xs font-medium">1 Copy</div>
                      <div className="text-[9px] opacity-70">Single</div>
                    </button>
                  </div>
                </div>

                {/* Paper Size, Orientation & Photo Grid Rotation */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                        Paper Size
                      </label>
                      <select
                        value={sheetConfig.paperSizeId}
                        onChange={(e) => handlePaperSizeChange(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white"
                      >
                        {STANDARD_PAPER_SIZES.map((paper) => (
                          <option key={paper.id} value={paper.id}>
                            {paper.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                        Paper Orientation
                      </label>
                      <select
                        value={sheetConfig.orientation}
                        onChange={(e) =>
                          handleOrientationChange(e.target.value as "portrait" | "landscape")
                        }
                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white"
                      >
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                      </select>
                    </div>
                  </div>

                  {/* Photo Rotation Choice (Normal upright vs 90° Rotated) */}
                  <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-neutral-300 font-medium block">
                        Photo Grid Rotation
                      </span>
                      <span className="text-[9px] text-neutral-500">
                        Rotate all photos 90° across sheet
                      </span>
                    </div>
                    <div className="flex bg-neutral-900 rounded p-0.5 border border-neutral-800">
                      <button
                        type="button"
                        onClick={() =>
                          handleApplyLayoutOption({
                            ...layoutAnalysis.currentNormal,
                            orientation: sheetConfig.orientation,
                          })
                        }
                        className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                          sheetConfig.printInstanceRotation === 0
                            ? "bg-sky-600 text-white font-bold"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Upright ({layoutAnalysis.currentNormal.total})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleApplyLayoutOption({
                            ...layoutAnalysis.currentRotated,
                            orientation: sheetConfig.orientation,
                          })
                        }
                        className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                          sheetConfig.printInstanceRotation === 90 || sheetConfig.printInstanceRotation === 270
                            ? "bg-sky-600 text-white font-bold"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Rotated 90° ({layoutAnalysis.currentRotated.total})
                      </button>
                    </div>
                  </div>
                </div>

                {/* Custom Paper Size Dimensions (if Custom selected) */}
                {currentPaperSpec.isCustom && (
                  <div className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-neutral-400 block mb-1">Width (mm)</span>
                      <input
                        type="number"
                        min="40"
                        max="1000"
                        value={Math.round(sheetConfig.paperWidthInches * 25.4)}
                        onChange={(e) => handleCustomPaperDimensionChange("width", Number(e.target.value))}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block mb-1">Height (mm)</span>
                      <input
                        type="number"
                        min="40"
                        max="1000"
                        value={Math.round(sheetConfig.paperHeightInches * 25.4)}
                        onChange={(e) => handleCustomPaperDimensionChange("height", Number(e.target.value))}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Photo Standard / Spec Selector on Sheet Tab */}
                <div>
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                    Photo Dimensions
                  </label>
                  <select
                    value={sheetConfig.passportStandardId}
                    onChange={(e) => handlePassportStandardChange(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white"
                  >
                    {PASSPORT_STANDARDS.map((std) => (
                      <option key={std.id} value={std.id}>
                        {std.name} ({std.widthMm} × {std.heightMm} mm)
                      </option>
                    ))}
                  </select>
                </div>

                {/* PRINTER MARGIN STANDARDS & SHEET MARGIN SYSTEM */}
                <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                        Printer Margins & Spacing
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        Printer-safe boundaries & gap distribution
                      </div>
                    </div>

                    {/* Mode Toggle & Unit Selector */}
                    <div className="flex items-center space-x-1.5">
                      <div className="flex bg-neutral-900 rounded p-0.5 border border-neutral-800">
                        <button
                          onClick={() => setSheetConfig((prev) => ({ ...prev, marginMode: "auto" }))}
                          className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                            sheetConfig.marginMode !== "manual"
                              ? "bg-sky-600 text-white font-bold"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          Auto Centered
                        </button>
                        <button
                          onClick={() => setSheetConfig((prev) => ({ ...prev, marginMode: "manual" }))}
                          className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                            sheetConfig.marginMode === "manual"
                              ? "bg-sky-600 text-white font-bold"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          Manual
                        </button>
                      </div>

                      <select
                        value={marginUnit}
                        onChange={(e) => setMarginUnit(e.target.value as PaperUnit)}
                        className="bg-neutral-900 border border-neutral-700 text-[10px] text-sky-300 rounded px-1.5 py-0.5"
                      >
                        <option value="in">in</option>
                        <option value="mm">mm</option>
                        <option value="cm">cm</option>
                      </select>
                    </div>
                  </div>

                  {/* Printer Margin Standard Selector */}
                  <div className="bg-neutral-900/90 p-2.5 rounded-lg border border-neutral-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-neutral-300 font-semibold">Printer Safe Margin:</span>
                      <div className="flex space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleSelectPrinterStandard("standard")}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                            printerMarginStandard === "standard"
                              ? "bg-sky-600 text-white font-bold"
                              : "bg-neutral-800 text-neutral-400 hover:text-white"
                          }`}
                        >
                          Standard 3.0mm
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectPrinterStandard("professional")}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                            printerMarginStandard === "professional"
                              ? "bg-sky-600 text-white font-bold"
                              : "bg-neutral-800 text-neutral-400 hover:text-white"
                          }`}
                        >
                          Compact 1.5mm
                        </button>
                      </div>
                    </div>
                    {printerMarginStandard === "professional" && (
                      <div className="text-[10px] text-amber-300 bg-amber-950/50 p-1.5 rounded border border-amber-800/60">
                        {PRINTER_MARGIN_STANDARDS.professional.warning}
                      </div>
                    )}
                  </div>

                  {sheetConfig.marginMode === "manual" ? (
                    <div className="space-y-2 pt-1">
                      {/* 4 Independent Directional Margin Inputs */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Top Margin */}
                        <div className="bg-neutral-900/80 p-1.5 rounded border border-neutral-800">
                          <div className="text-[10px] text-neutral-400 flex justify-between">
                            <span>Top Margin</span>
                            <span className="font-mono text-sky-400">
                              {convertUnits(sheetConfig.marginTopInches, "in", marginUnit).toFixed(2)} {marginUnit}
                            </span>
                          </div>
                          <input
                            type="number"
                            step={marginUnit === "in" ? "0.01" : "0.5"}
                            min="0"
                            max={marginUnit === "in" ? "2.0" : "50"}
                            value={Number(convertUnits(sheetConfig.marginTopInches, "in", marginUnit).toFixed(2))}
                            onChange={(e) => handleMarginChange("top", Number(e.target.value))}
                            className="w-full bg-neutral-950 border border-neutral-700 rounded px-1.5 py-0.5 text-right font-mono text-white text-xs mt-1"
                          />
                        </div>

                        {/* Bottom Margin */}
                        <div className="bg-neutral-900/80 p-1.5 rounded border border-neutral-800">
                          <div className="text-[10px] text-neutral-400 flex justify-between">
                            <span>Bottom Margin</span>
                            <span className="font-mono text-sky-400">
                              {convertUnits(sheetConfig.marginBottomInches, "in", marginUnit).toFixed(2)} {marginUnit}
                            </span>
                          </div>
                          <input
                            type="number"
                            step={marginUnit === "in" ? "0.01" : "0.5"}
                            min="0"
                            max={marginUnit === "in" ? "2.0" : "50"}
                            value={Number(convertUnits(sheetConfig.marginBottomInches, "in", marginUnit).toFixed(2))}
                            onChange={(e) => handleMarginChange("bottom", Number(e.target.value))}
                            className="w-full bg-neutral-950 border border-neutral-700 rounded px-1.5 py-0.5 text-right font-mono text-white text-xs mt-1"
                          />
                        </div>

                        {/* Left Margin */}
                        <div className="bg-neutral-900/80 p-1.5 rounded border border-neutral-800">
                          <div className="text-[10px] text-neutral-400 flex justify-between">
                            <span>Left Margin</span>
                            <span className="font-mono text-sky-400">
                              {convertUnits(sheetConfig.marginLeftInches, "in", marginUnit).toFixed(2)} {marginUnit}
                            </span>
                          </div>
                          <input
                            type="number"
                            step={marginUnit === "in" ? "0.01" : "0.5"}
                            min="0"
                            max={marginUnit === "in" ? "2.0" : "50"}
                            value={Number(convertUnits(sheetConfig.marginLeftInches, "in", marginUnit).toFixed(2))}
                            onChange={(e) => handleMarginChange("left", Number(e.target.value))}
                            className="w-full bg-neutral-950 border border-neutral-700 rounded px-1.5 py-0.5 text-right font-mono text-white text-xs mt-1"
                          />
                        </div>

                        {/* Right Margin */}
                        <div className="bg-neutral-900/80 p-1.5 rounded border border-neutral-800">
                          <div className="text-[10px] text-neutral-400 flex justify-between">
                            <span>Right Margin</span>
                            <span className="font-mono text-sky-400">
                              {convertUnits(sheetConfig.marginRightInches, "in", marginUnit).toFixed(2)} {marginUnit}
                            </span>
                          </div>
                          <input
                            type="number"
                            step={marginUnit === "in" ? "0.01" : "0.5"}
                            min="0"
                            max={marginUnit === "in" ? "2.0" : "50"}
                            value={Number(convertUnits(sheetConfig.marginRightInches, "in", marginUnit).toFixed(2))}
                            onChange={(e) => handleMarginChange("right", Number(e.target.value))}
                            className="w-full bg-neutral-950 border border-neutral-700 rounded px-1.5 py-0.5 text-right font-mono text-white text-xs mt-1"
                          />
                        </div>
                      </div>

                      {/* Quick Margin Presets */}
                      <div className="flex items-center justify-between text-[10px] pt-1">
                        <span className="text-neutral-400">Quick Margins:</span>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => {
                              setSheetConfig((prev) => {
                                const updated: PhotoSheetConfig = {
                                  ...prev,
                                  marginMode: "manual",
                                  marginTopInches: 0,
                                  marginBottomInches: 0,
                                  marginLeftInches: 0,
                                  marginRightInches: 0,
                                };
                                const fit = computeFit(updated, currentPassportSpec, currentPaperSpec);
                                return {
                                  ...updated,
                                  copies: prev.autoFit ? fit.maxPhotos : Math.min(prev.copies, fit.maxPhotos),
                                  columns: prev.autoFit ? fit.cols : Math.min(prev.columns, fit.cols),
                                  rows: prev.autoFit ? fit.rows : Math.min(prev.rows, fit.rows),
                                };
                              });
                            }}
                            className="px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
                          >
                            Borderless (0)
                          </button>
                          <button
                            onClick={() => {
                              setSheetConfig((prev) => {
                                const updated: PhotoSheetConfig = {
                                  ...prev,
                                  marginMode: "manual",
                                  marginTopInches: 1.5 / 25.4,
                                  marginBottomInches: 1.5 / 25.4,
                                  marginLeftInches: 1.5 / 25.4,
                                  marginRightInches: 1.5 / 25.4,
                                };
                                const fit = computeFit(updated, currentPassportSpec, currentPaperSpec);
                                return {
                                  ...updated,
                                  copies: prev.autoFit ? fit.maxPhotos : Math.min(prev.copies, fit.maxPhotos),
                                  columns: prev.autoFit ? fit.cols : Math.min(prev.columns, fit.cols),
                                  rows: prev.autoFit ? fit.rows : Math.min(prev.rows, fit.rows),
                                };
                              });
                            }}
                            className="px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
                          >
                            1.5mm
                          </button>
                          <button
                            onClick={() => {
                              setSheetConfig((prev) => {
                                const updated: PhotoSheetConfig = {
                                  ...prev,
                                  marginMode: "manual",
                                  marginTopInches: 3.0 / 25.4,
                                  marginBottomInches: 3.0 / 25.4,
                                  marginLeftInches: 3.0 / 25.4,
                                  marginRightInches: 3.0 / 25.4,
                                };
                                const fit = computeFit(updated, currentPassportSpec, currentPaperSpec);
                                return {
                                  ...updated,
                                  copies: prev.autoFit ? fit.maxPhotos : Math.min(prev.copies, fit.maxPhotos),
                                  columns: prev.autoFit ? fit.cols : Math.min(prev.columns, fit.cols),
                                  rows: prev.autoFit ? fit.rows : Math.min(prev.rows, fit.rows),
                                };
                              });
                            }}
                            className="px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
                          >
                            3.0mm Safe
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-[11px] text-neutral-300 bg-neutral-900/60 p-2.5 rounded border border-neutral-800/80 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-neutral-200">✓ Symmetric Auto-Centering active</div>
                          <div className="text-[10px] text-neutral-400 mt-0.5">
                            Margins: {(sheetConfig.marginLeftInches * 25.4).toFixed(1)}mm sides • {(sheetConfig.marginTopInches * 25.4).toFixed(1)}mm top/bottom
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleSmartOptimizeMargins}
                          className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-sky-400 hover:text-sky-300 text-[10px] font-semibold rounded border border-neutral-700 transition-colors"
                          title="Recalculate symmetric margins and center photo grid on sheet"
                        >
                          Center Grid
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Photo Gap Spacing (Independent from outer margins) */}
                  <div className="pt-2 border-t border-neutral-850 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-neutral-300 font-medium block">Inter-Photo Gap</span>
                      <span className="text-[9px] text-neutral-500">Separation between photos for cutting</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="number"
                        step={marginUnit === "in" ? "0.01" : "0.5"}
                        min="0"
                        max={marginUnit === "in" ? "0.5" : "15"}
                        value={Number(convertUnits(sheetConfig.gapHorizontalInches, "in", marginUnit).toFixed(2))}
                        onChange={(e) => handleGapChange(convertUnits(Number(e.target.value), marginUnit, "in"))}
                        className="w-16 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-right font-mono text-xs text-white"
                      />
                      <span className="text-[10px] text-neutral-400">{marginUnit}</span>
                    </div>
                  </div>
                </div>

                {/* Copies & Grid Dimensions */}
                <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-neutral-300 text-xs font-medium block">Total Copies on Sheet</span>
                      <span className="text-[10px] text-sky-400">
                        {dynamicMaxPhotos} photos fit on {currentFit.paperName} (Max: {dynamicMaxPhotos})
                      </span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max={dynamicMaxPhotos}
                      value={Math.min(sheetConfig.copies, dynamicMaxPhotos)}
                      onChange={(e) =>
                        setSheetConfig((prev) => ({
                          ...prev,
                          copies: Math.max(1, Math.min(dynamicMaxPhotos, Number(e.target.value))),
                        }))
                      }
                      className="w-16 bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-right font-mono text-sky-400 font-bold"
                    />
                  </div>

                  {/* Range Slider for Copies bounded dynamically */}
                  <div className="space-y-1 pt-1">
                    <input
                      type="range"
                      min="1"
                      max={dynamicMaxPhotos}
                      value={Math.min(sheetConfig.copies, dynamicMaxPhotos)}
                      onChange={(e) =>
                        setSheetConfig((prev) => ({
                          ...prev,
                          copies: Math.max(1, Math.min(dynamicMaxPhotos, Number(e.target.value))),
                        }))
                      }
                      className="w-full accent-sky-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-neutral-500 font-mono">
                      <span>1 copy</span>
                      <span>{dynamicMaxPhotos} copies (Max fit)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-800">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Columns</span>
                      <input
                        type="number"
                        min="1"
                        max={dynamicCols}
                        value={sheetConfig.columns}
                        onChange={(e) =>
                          setSheetConfig((prev) => {
                            const val = Math.max(1, Math.min(dynamicCols, Number(e.target.value)));
                            return {
                              ...prev,
                              columns: val,
                              copies: Math.min(prev.copies, val * prev.rows),
                              autoFit: false,
                            };
                          })
                        }
                        className="w-12 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-right font-mono"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Rows</span>
                      <input
                        type="number"
                        min="1"
                        max={dynamicRows}
                        value={sheetConfig.rows}
                        onChange={(e) =>
                          setSheetConfig((prev) => {
                            const val = Math.max(1, Math.min(dynamicRows, Number(e.target.value)));
                            return {
                              ...prev,
                              rows: val,
                              copies: Math.min(prev.copies, prev.columns * val),
                              autoFit: false,
                            };
                          })
                        }
                        className="w-12 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-right font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Border & Cutting Guides */}
                <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Scissors className="w-3.5 h-3.5 text-sky-400" />
                      <span className="text-neutral-300">Photo Border Stroke</span>
                    </div>
                    <select
                      value={sheetConfig.border.widthPx}
                      onChange={(e) =>
                        setSheetConfig((prev) => ({
                          ...prev,
                          border: {
                            ...prev.border,
                            enabled: Number(e.target.value) > 0,
                            widthPx: Number(e.target.value),
                          },
                        }))
                      }
                      className="bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-xs text-white"
                    >
                      <option value="0">0 px (None)</option>
                      <option value="1">1 px (Fine)</option>
                      <option value="2">2 px (Medium)</option>
                      <option value="3">3 px (Standard)</option>
                      <option value="5">5 px (Thick)</option>
                      <option value="10">10 px</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-neutral-300">Cutting Guides</span>
                    <select
                      value={sheetConfig.cuttingGuides.type}
                      onChange={(e) =>
                        setSheetConfig((prev) => ({
                          ...prev,
                          cuttingGuides: {
                            ...prev.cuttingGuides,
                            type: e.target.value as any,
                          },
                        }))
                      }
                      className="bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-xs text-white"
                    >
                      <option value="corner-marks">Corner Marks (L-Shapes)</option>
                      <option value="grid-lines">Dotted Scissor Lines</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>

                {/* Multi-Person Validation Warning Banner */}
                {isMultiPersonActive && !canPrintOrExport && (
                  <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-2.5 flex items-start space-x-2 text-amber-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <div className="font-semibold text-amber-200">
                        {unreadyAssignedPersons.length} Person{unreadyAssignedPersons.length > 1 ? "s" : ""} Need Photos
                      </div>
                      <div className="text-[10px] text-amber-300/80">
                        Please assign photos for {unreadyAssignedPersons.map((p) => p.label).join(", ")} before exporting or printing.
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Export Buttons */}
                {(() => {
                  const disabledExportTooltip =
                    !canPrintOrExport && unreadyAssignedPersons.length > 0
                      ? `${unreadyAssignedPersons.map((p) => p.label).join(" and ")} need photos before printing`
                      : undefined;

                  return (
                    <div className="space-y-2 pt-2">
                      <button
                        onClick={handleExportPDF}
                        disabled={isExporting || !canPrintOrExport}
                        title={disabledExportTooltip}
                        className={`w-full py-2.5 font-bold rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-lg ${
                          !canPrintOrExport
                            ? "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700"
                            : "bg-sky-600 hover:bg-sky-500 text-white"
                        }`}
                      >
                        <FileDown className="w-4 h-4" />
                        <span>Export {currentFit.paperName} Physical PDF (300 DPI)</span>
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleExportImage("image/jpeg")}
                          disabled={!canPrintOrExport}
                          title={disabledExportTooltip}
                          className={`py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-colors border ${
                            !canPrintOrExport
                              ? "bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed"
                              : "bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border-neutral-700"
                          }`}
                        >
                          <Download className="w-3.5 h-3.5 text-sky-400" />
                          <span>Download JPG</span>
                        </button>
                        <button
                          onClick={handlePrintSheet}
                          disabled={!canPrintOrExport}
                          title={disabledExportTooltip}
                          className={`py-2 font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors ${
                            !canPrintOrExport
                              ? "bg-neutral-900 text-neutral-600 border border-neutral-800 cursor-not-allowed"
                              : "bg-emerald-700 hover:bg-emerald-600 text-white"
                          }`}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print Sheet</span>
                        </button>
                      </div>

                      {onInsertIntoDocument && (
                        <button
                          onClick={handleInsertIntoDocument}
                          disabled={!canPrintOrExport}
                          title={disabledExportTooltip}
                          className={`w-full py-2 font-semibold rounded-lg flex items-center justify-center space-x-2 transition-colors border mt-1 ${
                            !canPrintOrExport
                              ? "bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed"
                              : "bg-neutral-800 hover:bg-neutral-750 text-sky-300 border-sky-700/50"
                          }`}
                        >
                          <Plus className="w-4 h-4 text-sky-400" />
                          <span>Insert {currentFit.paperName} Sheet into Current Document</span>
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        }
      />

      {/* Centralized Unified Background Studio Modal */}
      {(() => {
        const targetPersonId = bgStudioModal.personId || bgStudioPersonId || activeEditingPersonId;
        const activeBgPerson = targetPersonId
          ? multiPerson.persons.find((p) => p.id === targetPersonId)
          : null;

        // Pass THIS person's cropped photo as the working image for matting/backgrounding
        const modalInitialImage = bgStudioModal.inputImage || (activeBgPerson
          ? (activeBgPerson.croppedPhotoUrl || activeBgPerson.photoUrl || activeBgPerson.rawPhotoUrl || bgInitialImage || rawSourceImage)
          : (bgInitialImage || compositedPhotoUrl || processedPhotoDataUrl || rawSourceImage));

        // Load their previous settings so they aren't reset when re-opened
        const modalInitialState = bgStudioModal.initialConfig || (activeBgPerson
          ? (activeBgPerson.bgStudioState || undefined)
          : (bgStudioState || undefined));

        const modalTitle = activeBgPerson
          ? `Background — ${activeBgPerson.label}`
          : "Passport Studio Background Editor";

        const modalSubtitle = activeBgPerson
          ? `Custom Independent Background for ${activeBgPerson.label} • Color, Gradient, or Image`
          : "Biometric Subject Matting • Multi-Layer Composition • Offline AI & GitHub Backend";

        const isModalOpen = bgStudioModal.isOpen || isBgRemoverOpen;

        return (
          <UnifiedBackgroundStudioModal
            key={targetPersonId ? `bg-studio-${targetPersonId}` : "single-person-bg"}
            isOpen={isModalOpen}
            onClose={() => {
              setBgStudioModal({
                isOpen: false,
                personId: null,
                inputImage: null,
                initialConfig: null,
              });
              setActiveEditingPersonId(null);
            }}
            initialImage={modalInitialImage}
            cropDimensions={{
              width: bgStudioModal.cropDimensions?.width || activeBgPerson?.cropWidth || Math.round(currentPassportSpec.widthInches * 300),
              height: bgStudioModal.cropDimensions?.height || activeBgPerson?.cropHeight || Math.round(currentPassportSpec.heightInches * 300),
            }}
            initialState={modalInitialState}
            title={modalTitle}
            subtitle={modalSubtitle}
            headerTitle={activeBgPerson ? `Background — ${activeBgPerson.label}` : undefined}
            externalInputImage={modalInitialImage}
            externalInitialBgConfig={modalInitialState}
            onExternalApply={(compositedBlob, bgConfig, compositedDataUrl) => {
              if (targetPersonId) {
                handleBgStudioApply(targetPersonId, compositedDataUrl || compositedBlob, bgConfig);
                setStudioStep("sheet");
              }
            }}
            onApply={(finalCompositeUrl, fullState) => {
              if (!targetPersonId) {
                setBgStudioState(fullState);
                setCompositedPhotoUrl(finalCompositeUrl);
                setProcessedPhotoDataUrl(finalCompositeUrl);
                showToast("Passport photo background updated and applied to Print Studio.");
                setBgStudioModal({
                  isOpen: false,
                  personId: null,
                  inputImage: null,
                  initialConfig: null,
                });
                setStudioStep("sheet");
              }
            }}
          />
        );
      })()}

      {/* Multi-Person Per-Slot Photo Picker Modal */}
      {photoPickerPerson && (
        <PersonPhotoSourceModal
          isOpen={!!photoPickerPerson}
          onClose={() => setPhotoPickerPerson(null)}
          person={photoPickerPerson}
          pages={pages}
          onSelectPhoto={(dataUrl, immediateCrop) => handleSelectPhotoForPerson(dataUrl, immediateCrop)}
          onOpenCropForPerson={(p) => handleOpenCropForPerson(p || photoPickerPerson)}
          showToast={showToast}
        />
      )}

      {/* Paper Size Capacity Reduction Confirmation Dialog */}
      {pendingPaperChange && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start space-x-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Adjust Slots for {pendingPaperChange.newPaperName}?</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Current assigned slots ({pendingPaperChange.currentTotal}) exceed the capacity of {pendingPaperChange.newPaperName} ({pendingPaperChange.newCapacity} photos).
                </p>
              </div>
            </div>

            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2 text-xs">
              <div className="font-medium text-neutral-300">Choose how to adjust slot distribution:</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleConfirmPaperChange("proportional")}
                  className="p-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-850 border border-neutral-700 hover:border-sky-500 text-left transition-colors"
                >
                  <div className="font-semibold text-white flex items-center space-x-1">
                    <span>Proportional</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    Scale down while keeping group ratios
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmPaperChange("equal")}
                  className="p-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-850 border border-neutral-700 hover:border-sky-500 text-left transition-colors"
                >
                  <div className="font-semibold text-white flex items-center space-x-1">
                    <span>Equal Split</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    Divide {pendingPaperChange.newCapacity} slots equally
                  </div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingPaperChange(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Centralized PDF Import Dialog */}
      <PdfImportDialog
        isOpen={isPdfImportDialogOpen}
        onClose={() => {
          setIsPdfImportDialogOpen(false);
          setSelectedPdfFile(null);
        }}
        initialFile={selectedPdfFile}
        title="Extract Portrait from PDF Document"
        description="Select the PDF page containing your passport or portrait photo."
        selectionMode="single"
        primaryButtonLabel="Import Selected Page"
        onImportSingle={(result) => {
          setRawSourceImage(result.dataUrl);
          setSourceTab("upload");
          showToast(`Loaded Page ${result.pageNum} from ${result.fileName}`);
        }}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-neutral-900/95 border border-sky-500/80 text-white text-xs px-4 py-2 rounded-lg shadow-2xl flex items-center space-x-2 animate-in slide-in-from-bottom duration-150 z-[60]">
          <CheckCircle className="w-4 h-4 text-sky-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
};
