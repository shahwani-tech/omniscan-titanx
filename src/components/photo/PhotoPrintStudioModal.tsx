/**
 * OMNISCAN TITAN X - Standalone Professional Passport & 4x6" Photo Studio
 * Complete Workspace: Biometric Cutout, Fixed 8-Handle Crop Box with Image Wheel Zoom,
 * CamScanner Filter Engine, Professional Background Remover, 4x6" 8-Copy Sheet Grid Engine,
 * Independent 4x6 Outer Margins (Top, Bottom, Left, Right), True Physical 4x6" PDF Export,
 * High-DPI Output & Non-Destructive Session Isolation
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
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
import * as pdfjsLib from "pdfjs-dist";
import { renderPDFPageToDataUrl } from "../../engine/pdf";
import { useShortcuts } from "../../commands/ShortcutContext";
import {
  PdfImportDialog,
  ACCEPTED_DOCUMENT_AND_IMAGE_TYPES,
  PdfImportPageResult,
} from "../common/PdfImportDialog";
import { analyzeFile } from "../../services/upload/FileTypeRegistry";
import { parseDocumentFile, decodeImageFile } from "../../services/upload/DocumentImportService";
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
} from "lucide-react";
import { PhotoFilterNumericInput } from "./PhotoFilterNumericInput";
import { usePrint } from "../../context/PrintContext";

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
  const { openPrintDialog } = usePrint();

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
    paperSizeId: "photo-4x6",
    passportStandardId: "uk-eu-schengen", // 35x45mm standard
    copies: 8, // 8 copies by default for 4x6"
    columns: 2,
    rows: 4,
    autoFit: true,
    orientation: "portrait",
    marginMode: "auto",
    marginUnit: "in",
    marginTopInches: 0.1,
    marginBottomInches: 0.1,
    marginLeftInches: 0.1,
    marginRightInches: 0.1,
    gapHorizontalInches: 0.08,
    gapVerticalInches: 0.08,
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

  // Selected Country Standard & Paper Specification
  const currentPassportSpec =
    PASSPORT_STANDARDS.find((p) => p.id === sheetConfig.passportStandardId) || PASSPORT_STANDARDS[1];
  const currentPaperSpec =
    STANDARD_PAPER_SIZES.find((p) => p.id === sheetConfig.paperSizeId) || STANDARD_PAPER_SIZES[0];

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

  // -------------------------------------------------------------
  // Professional Background Remover State
  // -------------------------------------------------------------
  const [isBgRemoverOpen, setIsBgRemoverOpen] = useState<boolean>(false);
  const [bgRemoverOptions, setBgRemoverOptions] = useState<BackgroundRemovalOptions>(DEFAULT_BG_REMOVAL_OPTIONS);
  const [bgRemoverPreviewUrl, setBgRemoverPreviewUrl] = useState<string | null>(null);
  const [bgRemoverMaskUrl, setBgRemoverMaskUrl] = useState<string | null>(null);
  const [bgRemoverTransparentUrl, setBgRemoverTransparentUrl] = useState<string | null>(null);
  const [bgRemoverEdgeUrl, setBgRemoverEdgeUrl] = useState<string | null>(null);
  const [bgConfidenceScore, setBgConfidenceScore] = useState<number>(98);
  const [isProcessingBgRemoval, setIsProcessingBgRemoval] = useState<boolean>(false);
  const [bgPreviewMode, setBgPreviewMode] = useState<"composite" | "transparent" | "mask" | "edge" | "original" | "split">("composite");
  const [splitSliderPos, setSplitSliderPos] = useState<number>(50);

  // Manual Mask Refine Brush State
  const [manualRefineActive, setManualRefineActive] = useState<boolean>(false);
  const [brushAction, setBrushAction] = useState<"add" | "remove">("add");
  const [brushRadius, setBrushRadius] = useState<number>(24);
  const [brushHardness, setBrushHardness] = useState<number>(0.6);
  const [brushOpacity, setBrushOpacity] = useState<number>(1.0);
  const [manualStrokes, setManualStrokes] = useState<ManualBrushStroke[]>([]);
  const [isPainting, setIsPainting] = useState<boolean>(false);
  const [brushCursorPos, setBrushCursorPos] = useState<{ x: number; y: number } | null>(null);
  const bgPreviewCanvasRef = useRef<HTMLDivElement>(null);

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
    setActiveHandle(handle);
    setDragStartMouse({ x: e.clientX, y: e.clientY });
    setDragStartCropBox({ ...cropBox });
  };

  // Image Panning handler underneath the fixed crop box
  const handleImageMouseDown = (e: React.MouseEvent) => {
    if (activeHandle) return;
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
      const rect = cropImageRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const deltaNormX = (e.clientX - dragStartMouse.x) / rect.width;
      const deltaNormY = (e.clientY - dragStartMouse.y) / rect.height;

      const targetRatio = currentPassportSpec.widthInches / currentPassportSpec.heightInches;
      const imgAspect = rect.width / rect.height;

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
      img.crossOrigin = "anonymous";
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

    // Background color filling
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

    // Exact WYSIWYG crop transformation with image zoom, pan, and crop rotation
    const scaleX = outW / (cropBox.width * img.width);
    const scaleY = outH / (cropBox.height * img.height);

    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.translate(-cropBox.x * img.width, -cropBox.y * img.height);

    const centerX = img.width / 2;
    const centerY = img.height / 2;
    const displayImgWidth = cropImageRef.current?.getBoundingClientRect().width || img.width;
    const displayImgHeight = cropImageRef.current?.getBoundingClientRect().height || img.height;

    ctx.translate(
      centerX + (cropImagePan.x / displayImgWidth) * img.width,
      centerY + (cropImagePan.y / displayImgHeight) * img.height
    );
    ctx.rotate((cropRotation * Math.PI) / 180);
    ctx.scale(cropZoom, cropZoom);
    ctx.translate(-centerX, -centerY);

    ctx.drawImage(img, 0, 0);
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

  // Re-generate photo buffer smoothly when entering sheet mode or changing filters
  useEffect(() => {
    if (!isOpen) return;
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
  }, [generateProcessedPhoto, isOpen]);

  // -------------------------------------------------------------
  // Background Remover Execution Handler & Manual Mask Refinement
  // -------------------------------------------------------------
  const executeBgRemoval = async (opts = bgRemoverOptions, strokes = manualStrokes) => {
    setIsProcessingBgRemoval(true);
    try {
      const mergedOpts: BackgroundRemovalOptions = {
        ...opts,
        manualStrokes: strokes,
      };
      const res = await removeBackground(rawSourceImage, mergedOpts);
      setBgRemoverPreviewUrl(res.resultDataUrl);
      setBgRemoverMaskUrl(res.maskDataUrl);
      setBgRemoverTransparentUrl(res.transparentDataUrl);
      setBgRemoverEdgeUrl(res.edgeDataUrl);
      setBgConfidenceScore(res.confidenceScore);
    } catch (err) {
      console.error("Background removal failure:", err);
      showToast("Background removal encountered an error.");
    } finally {
      setIsProcessingBgRemoval(false);
    }
  };

  const handleOpenBgRemover = () => {
    setIsBgRemoverOpen(true);
    setManualStrokes([]);
    executeBgRemoval(bgRemoverOptions, []);
  };

  const handleApplyBgRemoval = () => {
    if (bgRemoverPreviewUrl) {
      setRawSourceImage(bgRemoverPreviewUrl);
      showToast("Studio background replacement applied.");
      setIsBgRemoverOpen(false);
    }
  };

  const handleResetBgRemoval = () => {
    setBgRemoverOptions(DEFAULT_BG_REMOVAL_OPTIONS);
    setManualStrokes([]);
    executeBgRemoval(DEFAULT_BG_REMOVAL_OPTIONS, []);
    showToast("Background remover reset to biometric defaults.");
  };

  const handleUndoManualStroke = () => {
    if (manualStrokes.length === 0) return;
    const updated = manualStrokes.slice(0, -Math.min(manualStrokes.length, 12));
    setManualStrokes(updated);
    executeBgRemoval(bgRemoverOptions, updated);
    showToast("Reverted previous brush strokes.");
  };

  const handleClearAllManualStrokes = () => {
    setManualStrokes([]);
    executeBgRemoval(bgRemoverOptions, []);
    showToast("Cleared manual mask corrections.");
  };

  const handleAddBrushPoint = (clientX: number, clientY: number, targetElem: HTMLElement) => {
    const rect = targetElem.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const normRadius = brushRadius / rect.width;

    const newStroke: ManualBrushStroke = {
      x: nx,
      y: ny,
      radius: normRadius,
      action: brushAction,
      hardness: brushHardness,
      opacity: brushOpacity,
    };

    const updated = [...manualStrokes, newStroke];
    setManualStrokes(updated);
    executeBgRemoval(bgRemoverOptions, updated);
  };

  // -------------------------------------------------------------
  // Live Sheet Grid Layout Calculation & Real-Time Canvas Rendering
  // -------------------------------------------------------------
  const layoutResult = calculatePhotoSheetLayout(sheetConfig, ["photo-1"]);

  useEffect(() => {
    if (!isOpen || (studioStep !== "sheet" && studioStep !== "filters")) return;

    let isMounted = true;
    setIsRendering(true);

    const renderSheet = async () => {
      try {
        const photoUrl = processedPhotoDataUrl || rawSourceImage;
        const canvas = await renderPhotoSheetCanvas(
          sheetConfig,
          { "photo-1": photoUrl },
          { targetDpi: 150, showGuidesOverlay: true }
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
  }, [sheetConfig, processedPhotoDataUrl, rawSourceImage, studioStep, isOpen]);

  // -------------------------------------------------------------
  // Actions: PDF Export, Image Download, Print, Insert Into Doc
  // -------------------------------------------------------------
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const pdfBytes = await exportPhotoSheetAsPDF(sheetConfig, { "photo-1": processedPhotoDataUrl });
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OMNISCAN_Passport_4x6_${currentPassportSpec.id}_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("4×6\" High-DPI PDF generated and downloaded.");
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
      const blob = await exportPhotoSheetAsBlob(sheetConfig, { "photo-1": processedPhotoDataUrl }, format, 300);
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
    const a = document.createElement("a");
    a.href = processedPhotoDataUrl;
    a.download = `Passport_Photo_${currentPassportSpec.id}_${Date.now()}.jpg`;
    a.click();
    showToast("Cropped Single Photo downloaded.");
  };

  const handlePrintSheet = () => {
    const photoUrl = processedPhotoDataUrl || rawSourceImage;
    openPrintDialog({
      type: "photo-sheet",
      title: `Photo Sheet (${sheetConfig.paperSizeId.toUpperCase()}) - ${currentPassportSpec.name}`,
      photoSheetConfig: sheetConfig,
      photoSheetImages: { "photo-1": photoUrl },
      defaultPaperSize: sheetConfig.paperSizeId,
      defaultOrientation: sheetConfig.orientation,
      hasCuttingGuides: sheetConfig.cuttingGuides.type !== "none",
    });
  };

  const handleInsertIntoDocument = () => {
    if (!onInsertIntoDocument) return;
    if (previewCanvas) {
      const sheetDataUrl = previewCanvas.toDataURL("image/jpeg", 0.95);
      onInsertIntoDocument(sheetDataUrl);
      showToast("Inserted 4×6\" Photo Sheet into current document as new page.");
      onClose();
    }
  };

  // Centralized Shortcut Management for Photo Print Studio
  const { pushScope, popScope, registerAction } = useShortcuts();

  useEffect(() => {
    if (!isOpen) return;
    pushScope("photo-studio");
    return () => {
      popScope("photo-studio");
    };
  }, [isOpen, pushScope, popScope]);

  useEffect(() => {
    if (!isOpen) return;

    const unregZoomIn = registerAction("photo.zoomIn", () =>
      setCropZoom((prev) => Math.min(3.0, Number((prev + 0.1).toFixed(2))))
    );
    const unregZoomOut = registerAction("photo.zoomOut", () =>
      setCropZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))))
    );
    const unregResetZoom = registerAction("photo.resetZoom", () => {
      setCropZoom(1.0);
      setCropImagePan({ x: 0, y: 0 });
    });
    const unregRotateCw = registerAction("photo.rotateCw", () =>
      setCropRotation((prev) => (prev + 90) % 360)
    );
    const unregRotateCcw = registerAction("photo.rotateCcw", () =>
      setCropRotation((prev) => (prev - 90 + 360) % 360)
    );
    const unregUp = registerAction("photo.nudgeUp", () =>
      setCropImagePan((prev) => ({ ...prev, y: prev.y - 10 }))
    );
    const unregDown = registerAction("photo.nudgeDown", () =>
      setCropImagePan((prev) => ({ ...prev, y: prev.y + 10 }))
    );
    const unregLeft = registerAction("photo.nudgeLeft", () =>
      setCropImagePan((prev) => ({ ...prev, x: prev.x - 10 }))
    );
    const unregRight = registerAction("photo.nudgeRight", () =>
      setCropImagePan((prev) => ({ ...prev, x: prev.x + 10 }))
    );
    const unregGrid = registerAction("photo.toggleGrid", () =>
      setSheetConfig((prev) => ({
        ...prev,
        border: { ...prev.border, enabled: !prev.border.enabled },
      }))
    );
    const unregGuides = registerAction("photo.toggleGuides", () =>
      setSheetConfig((prev) => ({
        ...prev,
        cuttingGuides: {
          ...prev.cuttingGuides,
          type: prev.cuttingGuides.type === "none" ? "corner-marks" : "none",
        },
      }))
    );
    const unregResetAll = registerAction("photo.resetAll", () => {
      setCropZoom(1.0);
      setCropImagePan({ x: 0, y: 0 });
      setCropRotation(0);
      handleResetFilters();
    });
    const unregPrint = registerAction("photo.print", handlePrintSheet);
    const unregExport = registerAction("photo.export", handleExportPDF);
    const unregClose = registerAction("photo.close", onClose);

    return () => {
      unregZoomIn();
      unregZoomOut();
      unregResetZoom();
      unregRotateCw();
      unregRotateCcw();
      unregUp();
      unregDown();
      unregLeft();
      unregRight();
      unregGrid();
      unregGuides();
      unregResetAll();
      unregPrint();
      unregExport();
      unregClose();
    };
  }, [
    isOpen,
    registerAction,
    handlePrintSheet,
    handleExportPDF,
    onClose,
  ]);

  // Quick Preset Handlers
  const handleSelectPresetCopies = (copies: number, cols: number, rows: number) => {
    setSheetConfig((prev) => ({
      ...prev,
      copies,
      columns: cols,
      rows,
      autoFit: true,
    }));
  };

  const handleAutoFitLayout = () => {
    setSheetConfig((prev) => ({
      ...prev,
      autoFit: true,
      marginMode: "auto",
      marginLeftInches: 0.1,
      marginRightInches: 0.1,
      marginTopInches: 0.1,
      marginBottomInches: 0.1,
      gapHorizontalInches: 0.08,
      gapVerticalInches: 0.08,
    }));
    showToast("Layout auto-fitted to maximum sheet capacity.");
  };

  // Outer Margin update helper
  const handleMarginChange = (side: "top" | "bottom" | "left" | "right", rawValue: number) => {
    const valInInches = convertUnits(Math.max(0, rawValue), marginUnit, "in");
    setSheetConfig((prev) => {
      const updated = { ...prev, marginMode: "manual" as const };
      if (side === "top") updated.marginTopInches = valInInches;
      if (side === "bottom") updated.marginBottomInches = valInInches;
      if (side === "left") updated.marginLeftInches = valInInches;
      if (side === "right") updated.marginRightInches = valInInches;
      return updated;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl flex flex-col w-full max-w-7xl h-[94vh] overflow-hidden">
        {/* Studio Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-850 select-none">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                  Passport & 4×6" Photo Studio
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-700/50">
                  ICAO 9303 Biometric Engine
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Official Biometric Cropping, Face Guides, Retouch, & 4×6" Multi-Copy Grid Printing
              </p>
            </div>
          </div>

          {/* Stepper Tabs */}
          <div className="flex items-center bg-neutral-900 p-1 rounded-lg border border-neutral-800 space-x-1">
            <button
              onClick={() => setStudioStep("crop")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                studioStep === "crop"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              <Crop className="w-3.5 h-3.5" />
              <span>1. Biometric Cutout</span>
            </button>
            <button
              onClick={() => setStudioStep("filters")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                studioStep === "filters"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>2. Retouch & Tone</span>
            </button>
            <button
              onClick={() => setStudioStep("sheet")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                studioStep === "sheet"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>3. 4×6" Print Sheet ({sheetConfig.copies} Copies)</span>
            </button>
          </div>

          {/* Background Remover Action & Close Studio */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleOpenBgRemover}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-medium transition-colors shadow-sm"
              title="Open Professional Studio Background Remover"
            >
              <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Background Remover</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Close Passport Photo Studio"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Studio Main Workspace (2-Column Layout) */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: Interactive Stage Canvas */}
          <div className="flex-1 bg-neutral-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
            {/* STAGE 1: Biometric Crop Editor */}
            {studioStep === "crop" && (
              <div
                ref={cropContainerRef}
                onMouseDown={handleImageMouseDown}
                className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
              >
                {/* Source Image Frame */}
                <div className="relative inline-block shadow-2xl rounded border border-neutral-800">
                  <img
                    ref={cropImageRef}
                    src={rawSourceImage}
                    alt="Source Crop"
                    className="max-h-[62vh] max-w-[50vw] object-contain block pointer-events-none"
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
                <div className="relative p-2 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl">
                  <img
                    src={processedPhotoDataUrl || rawSourceImage}
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
                        alt="4x6 Sheet Layout"
                        className="max-h-[64vh] max-w-[52vw] object-contain block"
                      />
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
                onClick={() => setCropRotation((prev) => (prev + 90) % 360)}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white"
                title="Rotate 90°"
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

          {/* RIGHT: Studio Controls & Configuration Sidebar */}
          <div className="w-96 bg-neutral-900 border-l border-neutral-800 flex flex-col h-full overflow-y-auto custom-scrollbar select-none text-xs text-neutral-200">
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
                          .then((decoded) => {
                            setRawSourceImage(decoded.dataUrl);
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
                    onChange={(e) => {
                      const spec = PASSPORT_STANDARDS.find((p) => p.id === e.target.value);
                      if (spec) {
                        setSheetConfig((prev) => ({
                          ...prev,
                          passportStandardId: spec.id,
                          photoWidthInches: spec.widthInches,
                          photoHeightInches: spec.heightInches,
                        }));
                      }
                    }}
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
                  onClick={() => setStudioStep("filters")}
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
                      <PhotoFilterNumericInput
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
                      <PhotoFilterNumericInput
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
                      <PhotoFilterNumericInput
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
                      <PhotoFilterNumericInput
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
                      <PhotoFilterNumericInput
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
                    onClick={() => setStudioStep("crop")}
                    className="w-1/2 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Back to Crop
                  </button>
                  <button
                    onClick={() => setStudioStep("sheet")}
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
                {/* Quick 8-Copy & Multi-Grid Presets for 4x6" Paper */}
                <div>
                  <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
                    Quick Sheet Layouts (4×6" Paper)
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      onClick={() => handleSelectPresetCopies(8, 2, 4)}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        sheetConfig.copies === 8 && sheetConfig.rows === 4
                          ? "bg-sky-600 text-white border-sky-400 font-bold"
                          : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-300"
                      }`}
                    >
                      <div className="text-xs">8 Copies</div>
                      <div className="text-[9px] opacity-70">2×4 Grid</div>
                    </button>
                    <button
                      onClick={() => handleSelectPresetCopies(6, 2, 3)}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        sheetConfig.copies === 6 && sheetConfig.rows === 3
                          ? "bg-sky-600 text-white border-sky-400 font-bold"
                          : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-300"
                      }`}
                    >
                      <div className="text-xs">6 Copies</div>
                      <div className="text-[9px] opacity-70">2×3 Grid</div>
                    </button>
                    <button
                      onClick={() => handleSelectPresetCopies(4, 2, 2)}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        sheetConfig.copies === 4 && sheetConfig.rows === 2
                          ? "bg-sky-600 text-white border-sky-400 font-bold"
                          : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-300"
                      }`}
                    >
                      <div className="text-xs">4 Copies</div>
                      <div className="text-[9px] opacity-70">2×2 Grid</div>
                    </button>
                    <button
                      onClick={() => handleSelectPresetCopies(1, 1, 1)}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        sheetConfig.copies === 1
                          ? "bg-sky-600 text-white border-sky-400 font-bold"
                          : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-300"
                      }`}
                    >
                      <div className="text-xs">1 Copy</div>
                      <div className="text-[9px] opacity-70">Single</div>
                    </button>
                  </div>
                </div>

                {/* Paper Size & Orientation */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                      Paper Size
                    </label>
                    <select
                      value={sheetConfig.paperSizeId}
                      onChange={(e) => {
                        const spec = STANDARD_PAPER_SIZES.find((p) => p.id === e.target.value);
                        if (spec) {
                          setSheetConfig((prev) => ({
                            ...prev,
                            paperSizeId: spec.id,
                            paperWidthInches: spec.widthInches,
                            paperHeightInches: spec.heightInches,
                          }));
                        }
                      }}
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
                      Orientation
                    </label>
                    <select
                      value={sheetConfig.orientation}
                      onChange={(e) =>
                        setSheetConfig((prev) => ({
                          ...prev,
                          orientation: e.target.value as "portrait" | "landscape",
                        }))
                      }
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white"
                    >
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                </div>

                {/* PASSPORT PHOTO MARGIN SYSTEM (4 Independent Outer Margins) */}
                <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                        4×6" Outer Sheet Margins
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        Space from paper edges to photo grid
                      </div>
                    </div>

                    {/* Mode Toggle & Unit Selector */}
                    <div className="flex items-center space-x-1.5">
                      <div className="flex bg-neutral-900 rounded p-0.5 border border-neutral-800">
                        <button
                          onClick={() => setSheetConfig((prev) => ({ ...prev, marginMode: "auto" }))}
                          className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                            sheetConfig.marginMode !== "manual"
                              ? "bg-sky-600 text-white"
                              : "text-neutral-400 hover:text-white"
                          }`}
                        >
                          Auto
                        </button>
                        <button
                          onClick={() => setSheetConfig((prev) => ({ ...prev, marginMode: "manual" }))}
                          className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                            sheetConfig.marginMode === "manual"
                              ? "bg-sky-600 text-white"
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
                              setSheetConfig((prev) => ({
                                ...prev,
                                marginMode: "manual",
                                marginTopInches: 0,
                                marginBottomInches: 0,
                                marginLeftInches: 0,
                                marginRightInches: 0,
                              }));
                            }}
                            className="px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
                          >
                            Borderless (0)
                          </button>
                          <button
                            onClick={() => {
                              setSheetConfig((prev) => ({
                                ...prev,
                                marginMode: "manual",
                                marginTopInches: 0.1,
                                marginBottomInches: 0.1,
                                marginLeftInches: 0.1,
                                marginRightInches: 0.1,
                              }));
                            }}
                            className="px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
                          >
                            0.1" (2.5mm)
                          </button>
                          <button
                            onClick={() => {
                              setSheetConfig((prev) => ({
                                ...prev,
                                marginMode: "manual",
                                marginTopInches: 0.2,
                                marginBottomInches: 0.2,
                                marginLeftInches: 0.2,
                                marginRightInches: 0.2,
                              }));
                            }}
                            className="px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300"
                          >
                            0.2" (5.0mm)
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-neutral-400 bg-neutral-900/60 p-2 rounded border border-neutral-800/80 flex items-center justify-between">
                      <span>✓ Symmetric Auto-Centering active on 4×6" Paper</span>
                      <span className="font-mono text-sky-400 text-[10px]">
                        {sheetConfig.marginLeftInches.toFixed(2)}" margins
                      </span>
                    </div>
                  )}

                  {/* Photo Gap Spacing (Independent from outer margins) */}
                  <div className="pt-2 border-t border-neutral-850 flex items-center justify-between">
                    <span className="text-[10px] text-neutral-400">Photo-to-Photo Gap</span>
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="0.5"
                        value={sheetConfig.gapHorizontalInches}
                        onChange={(e) =>
                          setSheetConfig((prev) => ({
                            ...prev,
                            gapHorizontalInches: Math.max(0, Number(e.target.value)),
                            gapVerticalInches: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-14 bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5 text-right font-mono text-xs"
                      />
                      <span className="text-[10px] text-neutral-400">in</span>
                    </div>
                  </div>
                </div>

                {/* Copies & Grid Dimensions */}
                <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-300">Total Copies on Sheet</span>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={sheetConfig.copies}
                      onChange={(e) =>
                        setSheetConfig((prev) => ({
                          ...prev,
                          copies: Math.max(1, Number(e.target.value)),
                        }))
                      }
                      className="w-16 bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-right font-mono text-sky-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-800">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Columns</span>
                      <input
                        type="number"
                        min="1"
                        max="6"
                        value={sheetConfig.columns}
                        onChange={(e) =>
                          setSheetConfig((prev) => ({
                            ...prev,
                            columns: Number(e.target.value),
                            autoFit: false,
                          }))
                        }
                        className="w-12 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-right font-mono"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-400">Rows</span>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={sheetConfig.rows}
                        onChange={(e) =>
                          setSheetConfig((prev) => ({
                            ...prev,
                            rows: Number(e.target.value),
                            autoFit: false,
                          }))
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

                {/* Action Export Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-lg"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>Export 4×6" Physical PDF (300 DPI)</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleExportImage("image/jpeg")}
                      className="py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 rounded-lg flex items-center justify-center space-x-1.5 transition-colors border border-neutral-700"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-400" />
                      <span>Download JPG</span>
                    </button>
                    <button
                      onClick={handlePrintSheet}
                      className="py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Sheet</span>
                    </button>
                  </div>

                  {onInsertIntoDocument && (
                    <button
                      onClick={handleInsertIntoDocument}
                      className="w-full py-2 bg-neutral-800 hover:bg-neutral-750 text-sky-300 font-semibold rounded-lg flex items-center justify-center space-x-2 transition-colors border border-sky-700/50 mt-1"
                    >
                      <Plus className="w-4 h-4 text-sky-400" />
                      <span>Insert 4×6" Sheet into Current Document</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* DEDICATED PROFESSIONAL BACKGROUND REMOVER MODAL (INSIDE STUDIO) */}
        {/* ------------------------------------------------------------- */}
        {isBgRemoverOpen && (
          <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-lg flex items-center justify-center p-3 animate-in fade-in duration-150">
            <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl flex flex-col w-full max-w-5xl h-[90vh] overflow-hidden">
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-neutral-850">
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <Wand2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                        Professional Studio Background Remover
                      </h3>
                      <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[10px] text-emerald-300 font-semibold">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>{bgConfidenceScore}% Biometric Validated</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      Biometric Anatomical Matting • Hair Strand Preservation • Manual Mask Refinement • ICAO 9303 Compliance
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsBgRemoverOpen(false)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Main Area (2 Columns) */}
              <div className="flex flex-1 overflow-hidden">
                {/* Left: Interactive Preview Canvas & Manual Refine Stage */}
                <div className="flex-1 bg-neutral-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
                  {/* View Mode Switcher */}
                  <div className="absolute top-3 inset-x-0 flex flex-col items-center z-20 space-y-2">
                    <div className="flex bg-neutral-900/95 backdrop-blur-md p-1 rounded-lg border border-neutral-800 space-x-1 text-xs shadow-xl">
                      <button
                        onClick={() => setBgPreviewMode("composite")}
                        className={`px-2.5 py-1 rounded font-medium transition-colors ${
                          bgPreviewMode === "composite" ? "bg-emerald-600 text-white shadow" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Result Composite
                      </button>
                      <button
                        onClick={() => setBgPreviewMode("transparent")}
                        className={`px-2.5 py-1 rounded font-medium transition-colors ${
                          bgPreviewMode === "transparent" ? "bg-emerald-600 text-white shadow" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Transparent Cutout
                      </button>
                      <button
                        onClick={() => setBgPreviewMode("mask")}
                        className={`px-2.5 py-1 rounded font-medium transition-colors ${
                          bgPreviewMode === "mask" ? "bg-emerald-600 text-white shadow" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Matte Alpha Mask
                      </button>
                      <button
                        onClick={() => setBgPreviewMode("edge")}
                        className={`px-2.5 py-1 rounded font-medium transition-colors ${
                          bgPreviewMode === "edge" ? "bg-emerald-600 text-white shadow" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Edge Boundary View
                      </button>
                      <button
                        onClick={() => setBgPreviewMode("original")}
                        className={`px-2.5 py-1 rounded font-medium transition-colors ${
                          bgPreviewMode === "original" ? "bg-emerald-600 text-white shadow" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Original Source
                      </button>
                      <button
                        onClick={() => setBgPreviewMode("split")}
                        className={`px-2.5 py-1 rounded font-medium transition-colors ${
                          bgPreviewMode === "split" ? "bg-emerald-600 text-white shadow" : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Before / After Split
                      </button>
                    </div>

                    {/* Manual Mask Refinement Floating Toolbar */}
                    <div className="flex items-center bg-neutral-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neutral-800 space-x-3 text-xs shadow-lg">
                      <div className="flex items-center space-x-1.5 border-r border-neutral-800 pr-2">
                        <button
                          onClick={() => setManualRefineActive(!manualRefineActive)}
                          className={`px-2 py-1 rounded font-semibold flex items-center space-x-1 transition-all ${
                            manualRefineActive
                              ? "bg-amber-600 text-white shadow ring-2 ring-amber-400/40"
                              : "bg-neutral-800 text-neutral-300 hover:text-white"
                          }`}
                        >
                          <Paintbrush className="w-3.5 h-3.5" />
                          <span>Manual Refine Brush</span>
                        </button>
                      </div>

                      {manualRefineActive && (
                        <div className="flex items-center space-x-3 animate-in fade-in duration-150">
                          {/* Brush Mode: Add/Keep vs Erase/Remove */}
                          <div className="flex bg-neutral-950 p-0.5 rounded border border-neutral-800">
                            <button
                              onClick={() => setBrushAction("add")}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center space-x-1 ${
                                brushAction === "add" ? "bg-emerald-600 text-white" : "text-neutral-400 hover:text-white"
                              }`}
                              title="Keep / Restore subject pixels (Add to foreground)"
                            >
                              <Paintbrush className="w-3 h-3" />
                              <span>Add / Keep</span>
                            </button>
                            <button
                              onClick={() => setBrushAction("remove")}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center space-x-1 ${
                                brushAction === "remove" ? "bg-rose-600 text-white" : "text-neutral-400 hover:text-white"
                              }`}
                              title="Erase / Remove background fragments"
                            >
                              <Eraser className="w-3 h-3" />
                              <span>Erase / Remove</span>
                            </button>
                          </div>

                          {/* Brush Size */}
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] text-neutral-400 font-semibold">Size:</span>
                            <input
                              type="range"
                              min="6"
                              max="80"
                              value={brushRadius}
                              onChange={(e) => setBrushRadius(Number(e.target.value))}
                              className="w-16 accent-emerald-500 cursor-pointer"
                            />
                            <PhotoFilterNumericInput
                              id="passport-input-brush-size"
                              value={brushRadius}
                              min={6}
                              max={80}
                              step={1}
                              precision={0}
                              unit="px"
                              onChange={(val) => setBrushRadius(val)}
                              ariaLabel="Brush size in pixels"
                              className="w-11"
                            />
                          </div>

                          {/* Brush Hardness */}
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] text-neutral-400 font-semibold">Hardness:</span>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={brushHardness}
                              onChange={(e) => setBrushHardness(Number(e.target.value))}
                              className="w-14 accent-emerald-500 cursor-pointer"
                            />
                            <PhotoFilterNumericInput
                              id="passport-input-brush-hardness"
                              value={brushHardness}
                              min={0}
                              max={1}
                              step={0.1}
                              precision={1}
                              onChange={(val) => setBrushHardness(val)}
                              ariaLabel="Brush hardness"
                              className="w-11"
                            />
                          </div>

                          {/* Undo & Clear */}
                          <div className="flex items-center space-x-1 border-l border-neutral-800 pl-2">
                            <button
                              onClick={handleUndoManualStroke}
                              disabled={manualStrokes.length === 0}
                              className="p-1 text-neutral-300 hover:text-white disabled:opacity-40 rounded hover:bg-neutral-800"
                              title="Undo last stroke"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={handleClearAllManualStrokes}
                              disabled={manualStrokes.length === 0}
                              className="p-1 text-rose-400 hover:text-rose-300 disabled:opacity-40 rounded hover:bg-neutral-800"
                              title="Clear all manual strokes"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {isProcessingBgRemoval ? (
                    <div className="flex flex-col items-center space-y-2 text-neutral-400">
                      <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                      <span className="text-xs font-medium">Analyzing subject contours, matting hair & rendering...</span>
                    </div>
                  ) : (
                    <div
                      ref={bgPreviewCanvasRef}
                      onPointerDown={(e) => {
                        if (!manualRefineActive) return;
                        setIsPainting(true);
                        handleAddBrushPoint(e.clientX, e.clientY, e.currentTarget);
                      }}
                      onPointerMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setBrushCursorPos({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                        });
                        if (manualRefineActive && isPainting) {
                          handleAddBrushPoint(e.clientX, e.clientY, e.currentTarget);
                        }
                      }}
                      onPointerUp={() => setIsPainting(false)}
                      onPointerLeave={() => {
                        setIsPainting(false);
                        setBrushCursorPos(null);
                      }}
                      className={`relative max-w-full max-h-full flex items-center justify-center ${
                        manualRefineActive ? "cursor-crosshair" : ""
                      }`}
                    >
                      {/* Virtual Brush Cursor Ring Overlay */}
                      {manualRefineActive && brushCursorPos && (
                        <div
                          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed z-30 transition-none"
                          style={{
                            left: brushCursorPos.x,
                            top: brushCursorPos.y,
                            width: brushRadius * 2,
                            height: brushRadius * 2,
                            borderColor: brushAction === "add" ? "#10B981" : "#F43F5E",
                            backgroundColor: brushAction === "add" ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
                          }}
                        />
                      )}

                      {bgPreviewMode === "transparent" ? (
                        <div
                          className="p-1 rounded-lg border border-neutral-700 shadow-2xl max-h-[62vh] max-w-[48vw] overflow-hidden"
                          style={{
                            backgroundImage: `repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 50% / 16px 16px`,
                          }}
                        >
                          <img
                            src={bgRemoverTransparentUrl || rawSourceImage}
                            alt="Transparent Cutout"
                            className="max-h-[60vh] max-w-[46vw] object-contain block pointer-events-none"
                          />
                        </div>
                      ) : bgPreviewMode === "mask" ? (
                        <div className="p-1 rounded-lg border border-neutral-700 shadow-2xl bg-black max-h-[62vh] max-w-[48vw]">
                          <img
                            src={bgRemoverMaskUrl || rawSourceImage}
                            alt="Matte Mask"
                            className="max-h-[60vh] max-w-[46vw] object-contain block pointer-events-none"
                          />
                        </div>
                      ) : bgPreviewMode === "edge" ? (
                        <div className="p-1 rounded-lg border border-cyan-500/40 shadow-2xl bg-neutral-950 max-h-[62vh] max-w-[48vw]">
                          <img
                            src={bgRemoverEdgeUrl || bgRemoverPreviewUrl || rawSourceImage}
                            alt="Edge Boundary View"
                            className="max-h-[60vh] max-w-[46vw] object-contain block pointer-events-none"
                          />
                        </div>
                      ) : bgPreviewMode === "original" ? (
                        <div className="p-1 rounded-lg border border-neutral-700 shadow-2xl bg-neutral-900 max-h-[62vh] max-w-[48vw]">
                          <img
                            src={rawSourceImage}
                            alt="Original Source"
                            className="max-h-[60vh] max-w-[46vw] object-contain block pointer-events-none"
                          />
                        </div>
                      ) : bgPreviewMode === "split" ? (
                        <div className="relative p-1 rounded-lg border border-neutral-700 shadow-2xl overflow-hidden max-h-[62vh] max-w-[48vw]">
                          {/* Composited Image (Right Layer) */}
                          <img
                            src={bgRemoverPreviewUrl || rawSourceImage}
                            alt="Result Composite"
                            className="max-h-[60vh] max-w-[46vw] object-contain block"
                          />
                          {/* Original Image (Left Layer Clipped) */}
                          <div
                            className="absolute inset-0 overflow-hidden border-r-2 border-emerald-400"
                            style={{ width: `${splitSliderPos}%` }}
                          >
                            <img
                              src={rawSourceImage}
                              alt="Original Source"
                              className="max-h-[60vh] max-w-[46vw] object-contain block h-full w-auto"
                            />
                            <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 rounded text-[9px] font-bold text-white">
                              ORIGINAL
                            </div>
                          </div>
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-500/50 rounded text-[9px] font-bold text-emerald-300">
                            REMOVED
                          </div>
                          {/* Draggable Split Slider Handle */}
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={splitSliderPos}
                            onChange={(e) => setSplitSliderPos(Number(e.target.value))}
                            className="absolute bottom-2 inset-x-4 accent-emerald-500 cursor-ew-resize z-20"
                          />
                        </div>
                      ) : (
                        <div className="p-1 rounded-lg border border-neutral-700 shadow-2xl bg-white max-h-[62vh] max-w-[48vw]">
                          <img
                            src={bgRemoverPreviewUrl || rawSourceImage}
                            alt="Composited Background Result"
                            className="max-h-[60vh] max-w-[46vw] object-contain block pointer-events-none"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Refinement & Background Replacement Controls */}
                <div className="w-88 bg-neutral-900 border-l border-neutral-800 p-4 space-y-4 overflow-y-auto custom-scrollbar select-none text-xs text-neutral-200">
                  {/* Re-Analyze Subject Action */}
                  <div>
                    <button
                      onClick={() => executeBgRemoval(bgRemoverOptions, manualStrokes)}
                      disabled={isProcessingBgRemoval}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center space-x-2 transition-colors shadow"
                    >
                      <Wand2 className="w-4 h-4" />
                      <span>Re-Analyze & Segment Subject</span>
                    </button>
                  </div>

                  {/* Target Studio Background Color */}
                  <div>
                    <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
                      Target Replacement Background
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => {
                          const updated = { ...bgRemoverOptions, backgroundColor: "white" as const };
                          setBgRemoverOptions(updated);
                          executeBgRemoval(updated);
                        }}
                        className={`p-1.5 rounded-lg border text-center transition-all ${
                          bgRemoverOptions.backgroundColor === "white"
                            ? "bg-emerald-950/60 border-emerald-400 text-white font-bold"
                            : "bg-neutral-950 border-neutral-800 text-neutral-300"
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white border border-neutral-300 mx-auto mb-1 shadow-sm" />
                        <div className="text-[10px]">Pure White</div>
                      </button>

                      <button
                        onClick={() => {
                          const updated = { ...bgRemoverOptions, backgroundColor: "blue" as const };
                          setBgRemoverOptions(updated);
                          executeBgRemoval(updated);
                        }}
                        className={`p-1.5 rounded-lg border text-center transition-all ${
                          bgRemoverOptions.backgroundColor === "blue"
                            ? "bg-emerald-950/60 border-emerald-400 text-white font-bold"
                            : "bg-neutral-950 border-neutral-800 text-neutral-300"
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-sky-200 border border-sky-400 mx-auto mb-1 shadow-sm" />
                        <div className="text-[10px]">Embassy Blue</div>
                      </button>

                      <button
                        onClick={() => {
                          const updated = { ...bgRemoverOptions, backgroundColor: "gray" as const };
                          setBgRemoverOptions(updated);
                          executeBgRemoval(updated);
                        }}
                        className={`p-1.5 rounded-lg border text-center transition-all ${
                          bgRemoverOptions.backgroundColor === "gray"
                            ? "bg-emerald-950/60 border-emerald-400 text-white font-bold"
                            : "bg-neutral-950 border-neutral-800 text-neutral-300"
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-neutral-200 border border-neutral-400 mx-auto mb-1 shadow-sm" />
                        <div className="text-[10px]">Light Gray</div>
                      </button>

                      <button
                        onClick={() => {
                          const updated = { ...bgRemoverOptions, backgroundColor: "cream" as const };
                          setBgRemoverOptions(updated);
                          executeBgRemoval(updated);
                        }}
                        className={`p-1.5 rounded-lg border text-center transition-all ${
                          bgRemoverOptions.backgroundColor === "cream"
                            ? "bg-emerald-950/60 border-emerald-400 text-white font-bold"
                            : "bg-neutral-950 border-neutral-800 text-neutral-300"
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-amber-50 border border-amber-200 mx-auto mb-1 shadow-sm" />
                        <div className="text-[10px]">Off-White</div>
                      </button>

                      <button
                        onClick={() => {
                          const updated = { ...bgRemoverOptions, backgroundColor: "transparent" as const };
                          setBgRemoverOptions(updated);
                          executeBgRemoval(updated);
                        }}
                        className={`p-1.5 rounded-lg border text-center transition-all ${
                          bgRemoverOptions.backgroundColor === "transparent"
                            ? "bg-emerald-950/60 border-emerald-400 text-white font-bold"
                            : "bg-neutral-950 border-neutral-800 text-neutral-300"
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-neutral-800 border border-neutral-600 mx-auto mb-1 shadow-sm" />
                        <div className="text-[10px]">Transparent</div>
                      </button>

                      <button
                        onClick={() => {
                          const updated = { ...bgRemoverOptions, backgroundColor: "custom" as const };
                          setBgRemoverOptions(updated);
                          executeBgRemoval(updated);
                        }}
                        className={`p-1.5 rounded-lg border text-center transition-all ${
                          bgRemoverOptions.backgroundColor === "custom"
                            ? "bg-emerald-950/60 border-emerald-400 text-white font-bold"
                            : "bg-neutral-950 border-neutral-800 text-neutral-300"
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded-full border border-neutral-400 mx-auto mb-1 shadow-sm"
                          style={{ backgroundColor: bgRemoverOptions.customColorHex || "#FFFFFF" }}
                        />
                        <div className="text-[10px]">Custom</div>
                      </button>
                    </div>

                    {bgRemoverOptions.backgroundColor === "custom" && (
                      <div className="mt-2 flex items-center space-x-2 bg-neutral-950 p-1.5 rounded border border-neutral-800">
                        <span className="text-neutral-400 text-[11px]">Pick Color:</span>
                        <input
                          type="color"
                          value={bgRemoverOptions.customColorHex || "#FFFFFF"}
                          onChange={(e) => {
                            const updated = { ...bgRemoverOptions, customColorHex: e.target.value };
                            setBgRemoverOptions(updated);
                            executeBgRemoval(updated);
                          }}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="font-mono text-sky-400 text-xs">{bgRemoverOptions.customColorHex}</span>
                      </div>
                    )}

                    {/* Dedicated Passport Background Mode */}
                    <div className="mt-2.5 p-2 rounded bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-emerald-300 flex items-center space-x-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          <span>Passport Background (ICAO 9303)</span>
                        </div>
                        <p className="text-[9px] text-neutral-400">
                          Enforces 100% uniform clean backdrop without shadows or gradients.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={bgRemoverOptions.passportSafeBackground}
                        onChange={(e) => {
                          const updated = { ...bgRemoverOptions, passportSafeBackground: e.target.checked };
                          setBgRemoverOptions(updated);
                          executeBgRemoval(updated);
                        }}
                        className="accent-emerald-500 w-4 h-4 rounded"
                      />
                    </div>
                  </div>

                  {/* Shadow Handling Level Selector */}
                  <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                        Auto Shadow Removal
                      </span>
                      <span className="text-[10px] text-emerald-400 uppercase font-mono">
                        {bgRemoverOptions.shadowRemovalLevel}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {(["off", "low", "medium", "high"] as ShadowRemovalLevel[]).map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => {
                            const updated = { ...bgRemoverOptions, shadowRemovalLevel: lvl, shadowHandling: lvl !== "off" };
                            setBgRemoverOptions(updated);
                            executeBgRemoval(updated);
                          }}
                          className={`py-1 rounded text-[10px] font-bold uppercase transition-colors ${
                            bgRemoverOptions.shadowRemovalLevel === lvl
                              ? "bg-emerald-600 text-white"
                              : "bg-neutral-900 text-neutral-400 hover:text-white"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] text-neutral-400">
                      Distinguishes backdrop cast shadows from dark hair, suits and collars.
                    </p>
                  </div>

                  {/* Hair & Edge Refinement Controls */}
                  <div className="space-y-3 bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                    <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                      Hair & Edge Precision
                    </div>

                    {/* Sensitivity / Tolerance */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-neutral-300">Detection Sensitivity</span>
                        <PhotoFilterNumericInput
                          id="passport-input-bg-sensitivity"
                          value={bgRemoverOptions.sensitivity}
                          min={10}
                          max={90}
                          step={1}
                          precision={0}
                          unit="%"
                          onChange={(val) => {
                            const updated = { ...bgRemoverOptions, sensitivity: val };
                            setBgRemoverOptions(updated);
                            executeBgRemoval(updated);
                          }}
                          ariaLabel="Detection sensitivity percentage"
                          className="w-11"
                        />
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="90"
                        value={bgRemoverOptions.sensitivity}
                        onChange={(e) => {
                          const updated = { ...bgRemoverOptions, sensitivity: Number(e.target.value) };
                          setBgRemoverOptions(updated);
                          executeBgRemoval(updated);
                        }}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    {/* Edge Feather */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-neutral-300">Edge Feather (Softness)</span>
                        <PhotoFilterNumericInput
                          id="passport-input-bg-feather"
                          value={bgRemoverOptions.edgeFeather}
                          min={0}
                          max={12}
                          step={1}
                          precision={0}
                          unit="px"
                          onChange={(val) => {
                            const updated = { ...bgRemoverOptions, edgeFeather: val };
                            setBgRemoverOptions(updated);
                            executeBgRemoval(updated);
                          }}
                          ariaLabel="Edge feather in pixels"
                          className="w-11"
                        />
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="12"
                        value={bgRemoverOptions.edgeFeather}
                        onChange={(e) => {
                          const updated = { ...bgRemoverOptions, edgeFeather: Number(e.target.value) };
                          setBgRemoverOptions(updated);
                          executeBgRemoval(updated);
                        }}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    {/* Edge Shift / Erode */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-neutral-300">Edge Shift (Erode / Expand)</span>
                        <PhotoFilterNumericInput
                          id="passport-input-bg-shift"
                          value={bgRemoverOptions.edgeShift}
                          min={-6}
                          max={6}
                          step={1}
                          precision={0}
                          unit="px"
                          onChange={(val) => {
                            const updated = { ...bgRemoverOptions, edgeShift: val };
                            setBgRemoverOptions(updated);
                            executeBgRemoval(updated);
                          }}
                          ariaLabel="Edge shift in pixels"
                          className="w-11"
                        />
                      </div>
                      <input
                        type="range"
                        min="-6"
                        max="6"
                        value={bgRemoverOptions.edgeShift}
                        onChange={(e) => {
                          const updated = { ...bgRemoverOptions, edgeShift: Number(e.target.value) };
                          setBgRemoverOptions(updated);
                          executeBgRemoval(updated);
                        }}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>

                    {/* Hair Detail Preservation Toggle */}
                    <div className="flex items-center justify-between pt-1 border-t border-neutral-850">
                      <span className="text-neutral-300 text-[11px]">Fine Hair Strand Matting</span>
                      <input
                        type="checkbox"
                        checked={bgRemoverOptions.hairDetailPreservation}
                        onChange={(e) => {
                          const updated = { ...bgRemoverOptions, hairDetailPreservation: e.target.checked };
                          setBgRemoverOptions(updated);
                          executeBgRemoval(updated);
                        }}
                        className="accent-emerald-500 w-4 h-4 rounded"
                      />
                    </div>
                  </div>

                  {/* Smart Artifact & Hole Cleanup */}
                  <div className="space-y-2 bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                        Smart Background Cleanup
                      </span>
                      <input
                        type="checkbox"
                        checked={bgRemoverOptions.smartArtifactCleanup}
                        onChange={(e) => {
                          const updated = { ...bgRemoverOptions, smartArtifactCleanup: e.target.checked };
                          setBgRemoverOptions(updated);
                          executeBgRemoval(updated);
                        }}
                        className="accent-emerald-500 w-4 h-4 rounded"
                      />
                    </div>

                    {bgRemoverOptions.smartArtifactCleanup && (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-neutral-300">Cleanup Detail Sensitivity</span>
                          <PhotoFilterNumericInput
                            id="passport-input-bg-cleanup"
                            value={bgRemoverOptions.cleanupDetailSensitivity}
                            min={10}
                            max={90}
                            step={1}
                            precision={0}
                            unit="%"
                            onChange={(val) => {
                              const updated = { ...bgRemoverOptions, cleanupDetailSensitivity: val };
                              setBgRemoverOptions(updated);
                              executeBgRemoval(updated);
                            }}
                            ariaLabel="Cleanup detail sensitivity percentage"
                            className="w-11"
                          />
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="90"
                          value={bgRemoverOptions.cleanupDetailSensitivity}
                          onChange={(e) => {
                            const updated = { ...bgRemoverOptions, cleanupDetailSensitivity: Number(e.target.value) };
                            setBgRemoverOptions(updated);
                            executeBgRemoval(updated);
                          }}
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                        <p className="text-[9px] text-neutral-400 mt-1">
                          Removes isolated background noise pixels & fills internal clothing holes.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions: Apply, Reset, Cancel */}
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={handleApplyBgRemoval}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-lg"
                    >
                      <Check className="w-4 h-4" />
                      <span>Apply to Studio Photo</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleResetBgRemoval}
                        className="py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-lg flex items-center justify-center space-x-1 transition-colors border border-neutral-700"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Reset Defaults</span>
                      </button>
                      <button
                        onClick={() => setIsBgRemoverOpen(false)}
                        className="py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-400 hover:text-white rounded-lg transition-colors border border-neutral-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
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
          <div className="absolute bottom-4 right-4 bg-neutral-900/95 border border-sky-500/80 text-white text-xs px-4 py-2 rounded-lg shadow-2xl flex items-center space-x-2 animate-in slide-in-from-bottom duration-150 z-50">
            <CheckCircle className="w-4 h-4 text-sky-400" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
