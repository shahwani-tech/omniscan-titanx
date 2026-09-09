/**
 * CardDesignStudioModal.tsx
 * 
 * Master Workspace for Professional ID & Service Card Designer:
 * - Direct vector design architecture inspired by CorelDRAW
 * - Displays BOTH Front Card (top) and Back Card (underneath) on the SAME physical A6 page (105 × 148 mm)
 * - Independent object manipulation for all text, shapes, photos, barcodes, and QR elements
 * - Built-in Undo/Redo history stack with shortcut support
 * - Seamless integration with the centralized Print Pipeline
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  CardDesignerProject,
  CardObject,
  CardSide,
  ActiveToolType,
  ImageCropRect,
  ShapeType,
} from "../../engine/carddesigner/types";
import {
  createDefaultProject,
  createCorporateEmployeeTemplate,
  createOfficialServiceTemplate,
  createVisitorAccessTemplate,
} from "../../engine/carddesigner/templates";
import { HistoryManager } from "../../engine/carddesigner/history";
import { CardDesignerToolbar } from "./CardDesignerToolbar";
import { CardDesignerCanvas } from "./CardDesignerCanvas";
import { CardDesignerInspector } from "./CardDesignerInspector";
import { CardDesignerLayersPanel } from "./CardDesignerLayersPanel";
import {
  CardDesignerCropModal,
  CardDesignerCropModalTarget,
  CropConfirmResult,
} from "./CardDesignerCropModal";
import { CardDesignerVectorImportModal } from "./CardDesignerVectorImportModal";
import { CardDesignerExportModal } from "./CardDesignerExportModal";
import { CardDesignerKeyboardShortcutsModal } from "./CardDesignerKeyboardShortcutsModal";
import { CardDesignerPresetManagerModal } from "./CardDesignerPresetManagerModal";
import { getAllPresets, loadPresetProject, CardPresetItem } from "../../engine/carddesigner/presetStorage";
import { UnifiedBackgroundStudioModal } from "../background/UnifiedBackgroundStudioModal";
import {
  PdfImportDialog,
  ACCEPTED_DOCUMENT_AND_IMAGE_TYPES,
  PdfImportPageResult,
} from "../common/PdfImportDialog";
import { analyzeFile } from "../../services/upload/FileTypeRegistry";
import { parseDocumentFile, decodeImageFile } from "../../services/upload/DocumentImportService";
import {
  renderA6SheetToCanvas,
  exportProjectToPdf,
} from "../../engine/carddesigner/renderExport";
import { getTrueCardBoundsInZone } from "../../engine/carddesigner/cardGeometry";
import {
  saveProjectToDisk,
  openProjectFileDialog,
  parseProjectJson,
} from "../../engine/carddesigner/projectFileManager";
import { usePrint } from "../../context/PrintContext";
import {
  Printer,
  FileDown,
  Upload,
  LayoutTemplate,
  X,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  FileText,
  FolderOpen,
  Save,
  Keyboard,
  FolderKanban,
} from "lucide-react";

interface CardDesignStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToPrint?: (printJobData: {
    pdfBlob?: Blob;
    imageUrl?: string;
    title: string;
    pageFormat: "A6";
  }) => void;
}

export const CardDesignStudioModal: React.FC<CardDesignStudioModalProps> = ({
  isOpen,
  onClose,
  onSendToPrint,
}) => {
  // Master Project State
  const [project, setProject] = useState<CardDesignerProject>(() =>
    createCorporateEmployeeTemplate()
  );

  // History Stack Manager
  const historyRef = useRef<HistoryManager>(new HistoryManager(createCorporateEmployeeTemplate()));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Interactive Editor States
  const [activeSide, setActiveSide] = useState<CardSide>("front");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<ActiveToolType>("select");
  const [zoom, setZoom] = useState<number>(1.2);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Modals
  const [cropModalTarget, setCropModalTarget] = useState<CardDesignerCropModalTarget | null>(null);
  const [isVectorImportOpen, setIsVectorImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const [isPdfImportOpen, setIsPdfImportOpen] = useState(false);
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [bgStudioTargetObject, setBgStudioTargetObject] = useState<CardObject | null>(null);
  const [bgStudioTargetSide, setBgStudioTargetSide] = useState<CardSide | null>(null);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);

  // In-Memory Clipboard for Copy/Paste
  const clipboardRef = useRef<CardObject[]>([]);

  // Sync history state
  const commitHistory = useCallback((projectToSave?: CardDesignerProject) => {
    historyRef.current.push(projectToSave || project);
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  }, [project]);

  const handleUndo = useCallback(() => {
    const previous = historyRef.current.undo();
    if (previous) {
      setProject(previous);
      setCanUndo(historyRef.current.canUndo());
      setCanRedo(historyRef.current.canRedo());
    }
  }, []);

  const handleRedo = useCallback(() => {
    const next = historyRef.current.redo();
    if (next) {
      setProject(next);
      setCanUndo(historyRef.current.canUndo());
      setCanRedo(historyRef.current.canRedo());
    }
  }, []);

  // Viewport-Center Anchored Zoom Engine (always scales symmetrically around the visible viewport center)
  const applyCenterZoom = useCallback(
    (targetZoomOrUpdater: number | ((prev: number) => number)) => {
      setZoom((prevZoom) => {
        const rawNext =
          typeof targetZoomOrUpdater === "function"
            ? targetZoomOrUpdater(prevZoom)
            : targetZoomOrUpdater;
        const nextZoom = Math.min(4.0, Math.max(0.2, Math.round(rawNext * 100) / 100));
        if (nextZoom === prevZoom) return prevZoom;

        const ratio = nextZoom / prevZoom;

        // Viewport center is anchor: scale pan offset proportionally so centered content remains centered
        setPanOffset((prevPan) => ({
          x: Math.round(prevPan.x * ratio * 10) / 10,
          y: Math.round(prevPan.y * ratio * 10) / 10,
        }));

        return nextZoom;
      });
    },
    []
  );

  const handleZoomIn = useCallback(() => {
    applyCenterZoom((prev) => Math.min(4.0, prev + 0.15));
  }, [applyCenterZoom]);

  const handleZoomOut = useCallback(() => {
    applyCenterZoom((prev) => Math.max(0.2, prev - 0.15));
  }, [applyCenterZoom]);

  const handleResetZoom = useCallback(() => {
    setZoom(1.0);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleFitPage = useCallback(() => {
    const approxViewportW = Math.max(300, window.innerWidth - 650);
    const approxViewportH = Math.max(300, window.innerHeight - 150);
    const baseW = project.pageWidthMm * 3.779527559;
    const baseH = project.pageHeightMm * 3.779527559;
    const scale = Math.min(approxViewportW / baseW, approxViewportH / baseH);
    const fitZoom = Math.min(3.0, Math.max(0.3, Math.round(scale * 100) / 100));
    setZoom(fitZoom);
    setPanOffset({ x: 0, y: 0 });
  }, [project.pageWidthMm, project.pageHeightMm]);

  // Copy selected objects
  const handleCopySelected = useCallback(() => {
    const currentObjs = activeSide === "front" ? project.front.objects : project.back.objects;
    const toCopy = currentObjs.filter((o) => selectedIds.includes(o.id));
    if (toCopy.length > 0) {
      clipboardRef.current = JSON.parse(JSON.stringify(toCopy));
    }
  }, [activeSide, project, selectedIds]);

  // Paste copied objects with slight offset
  const handlePasteSelected = useCallback(() => {
    if (clipboardRef.current.length === 0) return;
    const currentObjs = activeSide === "front" ? project.front.objects : project.back.objects;
    const maxZ = Math.max(...currentObjs.map((o) => o.zIndex), 0);
    const newIds: string[] = [];
    const pastedObjs: CardObject[] = clipboardRef.current.map((obj, idx) => {
      const newId = `${obj.type}-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`;
      newIds.push(newId);
      return {
        ...obj,
        id: newId,
        name: `${obj.name} (Copy)`,
        targetSide: activeSide,
        x: Math.round((obj.x + 3) * 10) / 10,
        y: Math.round((obj.y + 3) * 10) / 10,
        zIndex: maxZ + idx + 1,
      };
    });

    setProject((prev) => ({
      ...prev,
      [activeSide]: {
        ...prev[activeSide],
        objects: [...prev[activeSide].objects, ...pastedObjs],
      },
    }));
    setSelectedIds(newIds);
    commitHistory();
  }, [activeSide, commitHistory]);

  // Delete selected objects
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    setProject((prev) => ({
      ...prev,
      front: {
        ...prev.front,
        objects: prev.front.objects.filter((o) => !selectedIds.includes(o.id)),
      },
      back: {
        ...prev.back,
        objects: prev.back.objects.filter((o) => !selectedIds.includes(o.id)),
      },
    }));
    setSelectedIds([]);
    commitHistory();
  }, [selectedIds, commitHistory]);

  // Duplicate selected objects
  const handleDuplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const allObjs = [...project.front.objects, ...project.back.objects];
    const newFrontObjs = [...project.front.objects];
    const newBackObjs = [...project.back.objects];
    const newSelectedIds: string[] = [];

    selectedIds.forEach((id) => {
      const found = allObjs.find((o) => o.id === id);
      if (!found) return;
      const copy: CardObject = {
        ...found,
        id: `${found.type}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: `${found.name} (Copy)`,
        x: found.x + 3,
        y: found.y + 3,
        zIndex:
          Math.max(
            ...(found.targetSide === "front" ? newFrontObjs : newBackObjs).map((o) => o.zIndex),
            0
          ) + 1,
      };
      if (found.targetSide === "front") {
        newFrontObjs.push(copy);
      } else {
        newBackObjs.push(copy);
      }
      newSelectedIds.push(copy.id);
    });

    setProject((prev) => ({
      ...prev,
      front: { ...prev.front, objects: newFrontObjs },
      back: { ...prev.back, objects: newBackObjs },
    }));
    setSelectedIds(newSelectedIds);
    commitHistory();
  }, [selectedIds, project, commitHistory]);

  // Nudge selected objects with arrow keys
  const handleNudgeSelected = useCallback(
    (dxMm: number, dyMm: number) => {
      if (selectedIds.length === 0) return;
      setProject((prev) => {
        const updateObjs = (objs: CardObject[]) =>
          objs.map((o) => {
            if (!selectedIds.includes(o.id) || o.locked) return o;
            return {
              ...o,
              x: Math.round((o.x + dxMm) * 100) / 100,
              y: Math.round((o.y + dyMm) * 100) / 100,
            };
          });

        return {
          ...prev,
          front: { ...prev.front, objects: updateObjs(prev.front.objects) },
          back: { ...prev.back, objects: updateObjs(prev.back.objects) },
        };
      });
      commitHistory();
    },
    [selectedIds, commitHistory]
  );

  // Group / Ungroup
  const handleGroupSelected = useCallback(() => {
    if (selectedIds.length < 2) return;
    const newGroupId = `group-${Date.now()}`;
    setProject((prev) => ({
      ...prev,
      [activeSide]: {
        ...prev[activeSide],
        objects: prev[activeSide].objects.map((o) =>
          selectedIds.includes(o.id) ? { ...o, groupId: newGroupId } : o
        ),
      },
    }));
    commitHistory();
  }, [activeSide, selectedIds, commitHistory]);

  const handleUngroupSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    setProject((prev) => ({
      ...prev,
      [activeSide]: {
        ...prev[activeSide],
        objects: prev[activeSide].objects.map((o) =>
          selectedIds.includes(o.id) ? { ...o, groupId: undefined } : o
        ),
      },
    }));
    commitHistory();
  }, [activeSide, selectedIds, commitHistory]);

  // Layer Reordering
  const handleReorderSelected = useCallback(
    (direction: "up" | "down" | "top" | "bottom") => {
      if (selectedIds.length === 0) return;
      setProject((prev) => {
        const sideState = prev[activeSide];
        const list = [...sideState.objects].sort((a, b) => a.zIndex - b.zIndex);
        const primaryId = selectedIds[0];
        const idx = list.findIndex((o) => o.id === primaryId);
        if (idx === -1) return prev;

        if (direction === "up" && idx < list.length - 1) {
          const temp = list[idx].zIndex;
          list[idx].zIndex = list[idx + 1].zIndex;
          list[idx + 1].zIndex = temp;
        } else if (direction === "down" && idx > 0) {
          const temp = list[idx].zIndex;
          list[idx].zIndex = list[idx - 1].zIndex;
          list[idx - 1].zIndex = temp;
        } else if (direction === "top") {
          const maxZ = Math.max(...list.map((o) => o.zIndex), 0);
          list[idx].zIndex = maxZ + 1;
        } else if (direction === "bottom") {
          const minZ = Math.min(...list.map((o) => o.zIndex), 0);
          list[idx].zIndex = minZ - 1;
        }

        return {
          ...prev,
          [activeSide]: {
            ...sideState,
            objects: list,
          },
        };
      });
      commitHistory();
    },
    [activeSide, selectedIds, commitHistory]
  );

  // Flip Horizontal / Vertical
  const handleFlipHorizontal = useCallback(() => {
    if (selectedIds.length === 0) return;
    setProject((prev) => ({
      ...prev,
      [activeSide]: {
        ...prev[activeSide],
        objects: prev[activeSide].objects.map((o) =>
          selectedIds.includes(o.id) ? { ...o, flipX: !o.flipX } : o
        ),
      },
    }));
    commitHistory();
  }, [activeSide, selectedIds, commitHistory]);

  const handleFlipVertical = useCallback(() => {
    if (selectedIds.length === 0) return;
    setProject((prev) => ({
      ...prev,
      [activeSide]: {
        ...prev[activeSide],
        objects: prev[activeSide].objects.map((o) =>
          selectedIds.includes(o.id) ? { ...o, flipY: !o.flipY } : o
        ),
      },
    }));
    commitHistory();
  }, [activeSide, selectedIds, commitHistory]);

  // Flip active card side (Front <-> Back)
  const handleToggleCardSide = useCallback(() => {
    setActiveSide((prev) => (prev === "front" ? "back" : "front"));
    setSelectedIds([]);
  }, []);

  // Comprehensive Scoped Keyboard Shortcuts System
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Guard against typing inside inputs, textareas, selects, or content-editable fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Help Modal (?)
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      // Flip card side (Tab)
      if (e.key === "Tab" && !isCtrlOrCmd) {
        e.preventDefault();
        handleToggleCardSide();
        return;
      }

      // View & Zoom shortcuts
      if ((e.key === "+" || e.key === "=") && !isCtrlOrCmd) {
        e.preventDefault();
        handleZoomIn();
        return;
      }
      if (e.key === "-" && !isCtrlOrCmd) {
        e.preventDefault();
        handleZoomOut();
        return;
      }
      if (e.key === "0" && !isCtrlOrCmd) {
        e.preventDefault();
        if (e.shiftKey) {
          handleFitPage();
        } else {
          handleResetZoom();
        }
        return;
      }

      // Undo / Redo
      if (isCtrlOrCmd && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (isCtrlOrCmd && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Save / Open native project
      if (isCtrlOrCmd && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveProject();
        return;
      }
      if (isCtrlOrCmd && e.key.toLowerCase() === "o") {
        e.preventDefault();
        handleOpenProject();
        return;
      }

      // Clipboard: Copy / Paste
      if (isCtrlOrCmd && e.key.toLowerCase() === "c") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleCopySelected();
        }
        return;
      }
      if (isCtrlOrCmd && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePasteSelected();
        return;
      }

      // Selection & Deletion
      if (isCtrlOrCmd && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const currentSideObjs = activeSide === "front" ? project.front.objects : project.back.objects;
        setSelectedIds(currentSideObjs.map((o) => o.id));
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteSelected();
        return;
      }
      if (isCtrlOrCmd && e.key.toLowerCase() === "d") {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }
      if (e.key === "Escape") {
        setSelectedIds([]);
        setIsTemplateMenuOpen(false);
        return;
      }

      // Group / Ungroup
      if (isCtrlOrCmd && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey) {
          handleUngroupSelected();
        } else {
          handleGroupSelected();
        }
        return;
      }

      // Layer Order: Bring Forward / Send Backward / Bring to Front / Send to Back
      if (isCtrlOrCmd && e.key === "]") {
        e.preventDefault();
        if (e.shiftKey) {
          handleReorderSelected("top");
        } else {
          handleReorderSelected("up");
        }
        return;
      }
      if (isCtrlOrCmd && e.key === "[") {
        e.preventDefault();
        if (e.shiftKey) {
          handleReorderSelected("bottom");
        } else {
          handleReorderSelected("down");
        }
        return;
      }

      // Flip Horizontal / Vertical
      if (selectedIds.length > 0 && e.key.toLowerCase() === "h" && !isCtrlOrCmd) {
        e.preventDefault();
        handleFlipHorizontal();
        return;
      }
      if (selectedIds.length > 0 && e.shiftKey && e.key.toLowerCase() === "v" && !isCtrlOrCmd) {
        e.preventDefault();
        handleFlipVertical();
        return;
      }

      // Nudge with Arrow Keys
      if (
        selectedIds.length > 0 &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.altKey ? 0.1 : e.shiftKey ? 5.0 : 1.0;
        let dx = 0;
        let dy = 0;
        if (e.key === "ArrowLeft") dx = -step;
        if (e.key === "ArrowRight") dx = step;
        if (e.key === "ArrowUp") dy = -step;
        if (e.key === "ArrowDown") dy = step;
        handleNudgeSelected(dx, dy);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleFitPage,
    handleUndo,
    handleRedo,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleCopySelected,
    handlePasteSelected,
    handleGroupSelected,
    handleUngroupSelected,
    handleReorderSelected,
    handleFlipHorizontal,
    handleFlipVertical,
    handleToggleCardSide,
    handleNudgeSelected,
    activeSide,
    project,
    selectedIds,
  ]);

  // Add Object directly to active side
  const handleAddObject = useCallback((obj: CardObject) => {
    setProject((prev) => ({
      ...prev,
      [activeSide]: {
        ...prev[activeSide],
        objects: [...prev[activeSide].objects, obj],
      },
    }));
    setSelectedIds([obj.id]);
    commitHistory();
  }, [activeSide, commitHistory]);

  const handleAddText = useCallback(() => {
    const existing = activeSide === "front" ? project.front.objects : project.back.objects;
    const maxZ = existing.reduce((max, o) => Math.max(max, o.zIndex), 0);
    const newText: CardObject = {
      id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: "Text Box",
      type: "text",
      targetSide: activeSide,
      x: 10,
      y: 15,
      width: 50,
      height: 10,
      rotation: 0,
      opacity: 1,
      zIndex: maxZ + 1,
      visible: true,
      locked: false,
      aspectRatioLocked: false,
      flipX: false,
      flipY: false,
      text: "Sample Heading",
      fontSize: 12,
      fontFamily: "Inter, sans-serif",
      fontWeight: "600",
      textAlign: "left",
      textColor: "#1e293b",
    };
    handleAddObject(newText);
  }, [activeSide, project, handleAddObject]);

  const handleAddShape = useCallback((shape: ShapeType) => {
    const existing = activeSide === "front" ? project.front.objects : project.back.objects;
    const maxZ = existing.reduce((max, o) => Math.max(max, o.zIndex), 0);
    const newShape: CardObject = {
      id: `shape-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: `${shape.charAt(0).toUpperCase() + shape.slice(1)} Shape`,
      type: "shape",
      targetSide: activeSide,
      x: 15,
      y: 20,
      width: shape === "line" ? 40 : 25,
      height: shape === "line" ? 1 : 25,
      rotation: 0,
      opacity: 1,
      zIndex: maxZ + 1,
      visible: true,
      locked: false,
      aspectRatioLocked: false,
      flipX: false,
      flipY: false,
      shapeType: shape,
      fillColor: shape === "line" ? "transparent" : "#3b82f6",
      strokeColor: "#1d4ed8",
      strokeWidth: shape === "line" ? 0.8 : 0.5,
      cornerRadius: shape === "rounded-rect" ? 3 : 0,
    };
    handleAddObject(newShape);
  }, [activeSide, project, handleAddObject]);

  const handleAddBarcode = useCallback(() => {
    const existing = activeSide === "front" ? project.front.objects : project.back.objects;
    const maxZ = existing.reduce((max, o) => Math.max(max, o.zIndex), 0);
    const newBarcode: CardObject = {
      id: `barcode-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: "Code 128 Barcode",
      type: "barcode",
      targetSide: activeSide,
      x: 12,
      y: 75,
      width: 50,
      height: 14,
      rotation: 0,
      opacity: 1,
      zIndex: maxZ + 1,
      visible: true,
      locked: false,
      aspectRatioLocked: true,
      flipX: false,
      flipY: false,
      barcodeType: "code128",
      barcodeValue: "ID-" + Math.floor(100000 + Math.random() * 900000),
      displayBarcodeText: true,
    };
    handleAddObject(newBarcode);
  }, [activeSide, project, handleAddObject]);

  const handleAddQrCode = useCallback(() => {
    const existing = activeSide === "front" ? project.front.objects : project.back.objects;
    const maxZ = existing.reduce((max, o) => Math.max(max, o.zIndex), 0);
    const newQr: CardObject = {
      id: `qrcode-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: "Authentication QR Code",
      type: "qrcode",
      targetSide: activeSide,
      x: 12,
      y: 60,
      width: 20,
      height: 20,
      rotation: 0,
      opacity: 1,
      zIndex: maxZ + 1,
      visible: true,
      locked: false,
      aspectRatioLocked: true,
      flipX: false,
      flipY: false,
      qrValue: "https://omniscan.id/verify/" + Date.now(),
      qrForegroundColor: "#0f172a",
      qrBackgroundColor: "#ffffff",
    };
    handleAddObject(newQr);
  }, [activeSide, project, handleAddObject]);

  const handleOpenCropForObject = useCallback((obj: CardObject) => {
    setCropModalTarget({
      existingObject: obj,
      imageSrc: obj.originalSrc || obj.src || "",
      originalSrc: obj.originalSrc || obj.src || "",
      targetSide: obj.targetSide,
      title: obj.name,
      initialAdjustments: obj.appliedCropAdjustments,
      isNewImport: false,
    });
  }, []);

  const handleRevertImageAdjustments = useCallback(
    (obj: CardObject) => {
      const original = obj.originalSrc || obj.src || "";
      if (!original) return;

      const revertedObj: CardObject = {
        ...obj,
        src: original,
        cropRect: undefined,
        appliedCropAdjustments: undefined,
        imagePan: undefined,
        imageZoom: undefined,
        imageFilters: obj.imageFilters ? { ...obj.imageFilters, deskewAngle: 0 } : undefined,
      };

      setProject((prev) => {
        const updateList = (list: CardObject[]) =>
          list.map((o) => (o.id === obj.id ? revertedObj : o));

        const next = {
          ...prev,
          front: { ...prev.front, objects: updateList(prev.front.objects) },
          back: { ...prev.back, objects: updateList(prev.back.objects) },
        };
        commitHistory(next);
        return next;
      });

      // Re-open crop dialog pre-loaded with original image and reset adjustments so user can redo adjustments differently
      setCropModalTarget({
        existingObject: revertedObj,
        imageSrc: original,
        originalSrc: original,
        targetSide: obj.targetSide,
        title: obj.name,
        initialAdjustments: undefined,
        isNewImport: false,
      });
    },
    [commitHistory]
  );

  const handleReplaceImage = useCallback((obj: CardObject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        const url = re.target?.result as string;
        if (!url) return;
        setCropModalTarget({
          existingObject: obj,
          imageSrc: url,
          originalSrc: url,
          targetSide: obj.targetSide,
          title: `Replace: ${file.name.replace(/\.[^/.]+$/, "")}`,
          initialAdjustments: undefined,
          isNewImport: false,
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, []);

  const handleTriggerImageUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        const url = re.target?.result as string;
        if (!url) return;
        setCropModalTarget({
          imageSrc: url,
          originalSrc: url,
          targetSide: activeSide,
          title: file.name.replace(/\.[^/.]+$/, ""),
          isNewImport: true,
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [activeSide]);

  const handleTriggerSignatureUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/webp";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        const url = re.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const aspect = img.naturalWidth / (img.naturalHeight || 1);
          const targetW = 35;
          const targetH = targetW / aspect;
          const existing = activeSide === "front" ? project.front.objects : project.back.objects;
          const maxZ = existing.reduce((max, o) => Math.max(max, o.zIndex), 0);
          const newSig: CardObject = {
            id: `sig-${Date.now()}`,
            name: "Authorized Signature",
            type: "signature",
            targetSide: activeSide,
            x: 20,
            y: 70,
            width: Math.round(targetW * 10) / 10,
            height: Math.round(targetH * 10) / 10,
            rotation: 0,
            opacity: 1,
            zIndex: maxZ + 1,
            visible: true,
            locked: false,
            aspectRatioLocked: true,
            flipX: false,
            flipY: false,
            src: url,
            isSignature: true,
            preserveAlpha: true,
          };
          handleAddObject(newSig);
        };
        img.src = url;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [activeSide, project, handleAddObject]);

  const handleTriggerCrop = useCallback(() => {
    const currentObjs = activeSide === "front" ? project.front.objects : project.back.objects;
    const selected = currentObjs.find(
      (o) => selectedIds.includes(o.id) && (o.type === "image" || o.type === "signature")
    );
    if (selected) {
      handleOpenCropForObject(selected);
    }
  }, [activeSide, project, selectedIds, handleOpenCropForObject]);

  // Import single PDF page: triggers dedicated Crop/Adjust modal before placing onto card
  const handlePdfImportToCard = (
    result: PdfImportPageResult,
    targetSide: CardSide = activeSide
  ) => {
    const side = result.side || targetSide;
    setCropModalTarget({
      imageSrc: result.dataUrl,
      originalSrc: result.dataUrl,
      targetSide: side,
      title: `PDF Page ${result.pageNum} (${result.fileName})`,
      isNewImport: true,
    });
    setIsPdfImportOpen(false);
    setSelectedPdfFile(null);
  };

  // Import multiple PDF pages simultaneously: starts with first page in crop dialog
  const handleMultiplePdfImportToCard = (
    results: PdfImportPageResult[],
    targetSide: CardSide = activeSide
  ) => {
    if (results.length === 0) return;
    handlePdfImportToCard(results[0], results[0].side || targetSide);
  };

  const handleConfirmCrop = useCallback(
    (result: CropConfirmResult) => {
      if (!cropModalTarget) return;

      const side = cropModalTarget.targetSide;
      const cardBounds = getTrueCardBoundsInZone(project);

      if (cropModalTarget.isNewImport) {
        // Auto-fit to exact CR80 physical card dimensions: 85.6mm × 54mm
        const currentList = side === "front" ? project.front.objects : project.back.objects;
        const maxZ = currentList.reduce((max, o) => Math.max(max, o.zIndex), 0);

        const newObj: CardObject = {
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: cropModalTarget.title || "Card Photo / Face",
          type: "image",
          targetSide: side,
          x: cardBounds.x,
          y: cardBounds.y,
          width: cardBounds.width,
          height: cardBounds.height,
          rotation: 0,
          opacity: 1,
          zIndex: maxZ + 1,
          visible: true,
          locked: false,
          aspectRatioLocked: false,
          flipX: false,
          flipY: false,
          src: result.croppedDataUrl,
          originalSrc: result.originalSrc,
          naturalWidth: result.naturalWidth,
          naturalHeight: result.naturalHeight,
          appliedCropAdjustments: result.adjustments,
          cropRect: result.cropRect,
          fitMode: "contain",
          imageFilters: {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            sharpness: 0,
            deskewAngle: 0,
            grayscale: false,
          },
        };

        setProject((prev) => {
          const next = {
            ...prev,
            [side]: {
              ...prev[side],
              objects: [...prev[side].objects, newObj],
            },
          };
          commitHistory(next);
          return next;
        });

        setSelectedIds([newObj.id]);
      } else if (cropModalTarget.existingObject) {
        const targetId = cropModalTarget.existingObject.id;
        setProject((prev) => {
          const updateList = (list: CardObject[]) =>
            list.map((o) => {
              if (o.id === targetId) {
                return {
                  ...o,
                  src: result.croppedDataUrl,
                  originalSrc: result.originalSrc || o.originalSrc,
                  naturalWidth: result.naturalWidth,
                  naturalHeight: result.naturalHeight,
                  appliedCropAdjustments: result.adjustments,
                  cropRect: result.cropRect,
                };
              }
              return o;
            });

          const next = {
            ...prev,
            front: { ...prev.front, objects: updateList(prev.front.objects) },
            back: { ...prev.back, objects: updateList(prev.back.objects) },
          };
          commitHistory(next);
          return next;
        });
      }

      setCropModalTarget(null);
    },
    [cropModalTarget, project, commitHistory]
  );

  // Direct Drag & Drop Handler for Card Canvas
  const handleDropFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    const firstFile = files[0];
    const fileName = firstFile.name.toLowerCase();

    // Native .ocard project drop
    if (fileName.endsWith(".ocard") || fileName.endsWith(".omniscanproj")) {
      try {
        const text = await firstFile.text();
        const loadedProject = parseProjectJson(text);
        setProject(loadedProject);
        historyRef.current = new HistoryManager(loadedProject);
        setCanUndo(false);
        setCanRedo(false);
        setSelectedIds([]);
        setActiveSide("front");
      } catch (err: any) {
        alert(`Failed to load dropped project file: ${err.message}`);
      }
      return;
    }

    const analysis = analyzeFile(firstFile);

    if (analysis.category === "pdf") {
      setSelectedPdfFile(firstFile);
      setIsPdfImportOpen(true);
      return;
    }

    if (analysis.category === "document") {
      try {
        const pages = await parseDocumentFile(firstFile);
        if (pages.length > 0) {
          const firstPage = pages[0];
          handlePdfImportToCard(
            {
              pageNum: 1,
              dataUrl: firstPage.dataUrl,
              width: firstPage.width,
              height: firstPage.height,
              fileName: firstFile.name,
              side: activeSide,
            },
            activeSide
          );
        }
      } catch (err: any) {
        console.error("Document import error in Card Designer:", err);
      }
      return;
    }

    if (analysis.category === "image") {
      if (analysis.extension === "svg") {
        setIsVectorImportOpen(true);
        return;
      }
      try {
        const { dataUrl, width, height } = await decodeImageFile(firstFile);
        handlePdfImportToCard(
          {
            pageNum: 1,
            dataUrl,
            width,
            height,
            fileName: firstFile.name,
            side: activeSide,
          },
          activeSide
        );
      } catch (err: any) {
        console.error("Image decode error in Card Designer:", err);
      }
      return;
    }
  };

  // Apply Loaded Preset or Template to Studio
  const handleApplyPreset = (loadedProject: CardDesignerProject) => {
    setProject(loadedProject);
    historyRef.current = new HistoryManager(loadedProject);
    setCanUndo(false);
    setCanRedo(false);
    setSelectedIds([]);
    setIsTemplateMenuOpen(false);
  };

  // Load Preset by slot ID or custom ID (resolving user-replaced slots or builtins)
  const handleSelectPresetById = (slotOrId: string) => {
    const loaded = loadPresetProject(slotOrId);
    if (loaded) {
      handleApplyPreset(loaded);
    }
  };

  // Switch Template (legacy compatibility wrapper)
  const handleLoadTemplate = (type: "corporate" | "official" | "visitor" | "blank") => {
    handleSelectPresetById(type);
  };

  // Save Project File (.ocard)
  const handleSaveProject = () => {
    try {
      saveProjectToDisk(project);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  // Open Project File (.ocard)
  const handleOpenProject = async () => {
    try {
      const loadedProject = await openProjectFileDialog();
      setProject(loadedProject);
      historyRef.current = new HistoryManager(loadedProject);
      setCanUndo(false);
      setCanRedo(false);
      setSelectedIds([]);
      setActiveSide("front");
    } catch (err: any) {
      if (err?.message && err.message !== "No file selected.") {
        alert(err.message);
      }
    }
  };

  const { openPrintDialog } = usePrint();

  // Print Handler: Render A6 Sheet at 300 DPI and send to Centralized Print Pipeline
  const handlePrint = async () => {
    try {
      if (openPrintDialog) {
        const canvas = await renderA6SheetToCanvas(project, {
          dpi: 300,
          showCuttingGuides: project.cuttingGuides,
        });
        openPrintDialog({
          type: "canvases",
          title: `${project.name} (A6 Print)`,
          canvases: [canvas],
          defaultPaperSize: "a6",
          defaultOrientation: project.orientation,
          hasCuttingGuides: project.cuttingGuides,
        });
        return;
      }

      const pdfBytes = await exportProjectToPdf(project, "full-a6");
      const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });

      if (onSendToPrint) {
        onSendToPrint({
          pdfBlob,
          title: `${project.name} (A6 Print)`,
          pageFormat: "A6",
        });
      } else {
        // Fallback to direct high-res PDF preview/download
        const url = URL.createObjectURL(pdfBlob);
        const win = window.open(url, "_blank");
        if (!win) {
          const a = document.createElement("a");
          a.href = url;
          a.download = `${project.name}-A6-print.pdf`;
          a.click();
        }
      }
    } catch (err) {
      alert(`Print preparation failed: ${(err as Error).message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950 flex flex-col select-none overflow-hidden text-neutral-200">
      {/* =========================================================
          TOP APPLICATION TITLE BAR
         ========================================================= */}
      <div className="h-12 border-b border-neutral-800 px-4 flex items-center justify-between bg-neutral-900/95 shrink-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <h1 className="text-sm font-extrabold text-white tracking-wide">
              OMNISCAN ID & SERVICE CARD DESIGNER
            </h1>
          </div>

          <div className="h-4 w-px bg-neutral-800" />

          {/* Project Title Input */}
          <input
            type="text"
            value={project.name}
            onChange={(e) =>
              setProject((prev) => ({ ...prev, name: e.target.value }))
            }
            className="bg-transparent border-b border-transparent hover:border-neutral-700 focus:border-sky-500 px-1 py-0.5 text-xs text-neutral-300 font-semibold outline-none transition-colors"
          />

          <span className="text-[10px] font-mono text-neutral-400 bg-neutral-800/80 px-2 py-0.5 rounded-full">
            Dual-Card ISO A6 (74 × 105 mm)
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Template Preset Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTemplateMenuOpen(!isTemplateMenuOpen)}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-neutral-700/60"
            >
              <LayoutTemplate className="w-3.5 h-3.5 text-sky-400" />
              <span>Templates</span>
            </button>

            {isTemplateMenuOpen && (
              <div className="absolute right-0 top-9 w-72 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-2 z-50 text-xs space-y-1 max-h-96 overflow-y-auto">
                <div className="px-2 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Preset Starter Cards</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTemplateMenuOpen(false);
                      setIsPresetManagerOpen(true);
                    }}
                    className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold lowercase tracking-normal"
                  >
                    Manage
                  </button>
                </div>
                {getAllPresets().map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPresetById(preset.slotId || preset.id)}
                    className="w-full text-left p-2 rounded-lg hover:bg-neutral-800 text-neutral-200 block transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold block text-white group-hover:text-sky-400">
                        {preset.name}
                      </span>
                      {preset.isReplacedSlot && (
                        <span className="text-[9px] bg-sky-500/20 text-sky-300 border border-sky-500/40 px-1.5 py-0.5 rounded font-mono font-bold">
                          Replaced
                        </span>
                      )}
                      {preset.isCustom && !preset.isReplacedSlot && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono font-bold">
                          Custom
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400 line-clamp-2 mt-0.5">
                      {preset.description}
                    </span>
                  </button>
                ))}
                <div className="pt-1.5 mt-1 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsTemplateMenuOpen(false);
                      setIsPresetManagerOpen(true);
                    }}
                    className="w-full text-center py-1.5 px-2 bg-neutral-800/90 hover:bg-neutral-800 text-sky-300 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <FolderKanban className="w-3.5 h-3.5" />
                    <span>Manage / Replace Presets...</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Manage Presets Button */}
          <button
            type="button"
            onClick={() => setIsPresetManagerOpen(true)}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-amber-600/40"
            title="Manage Presets and Replace Default Starter Slots"
          >
            <FolderKanban className="w-3.5 h-3.5 text-amber-400" />
            <span>Presets</span>
          </button>

          {/* Keyboard Shortcuts (?) Button */}
          <button
            type="button"
            onClick={() => setIsShortcutsModalOpen(true)}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-sky-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-sky-600/40"
            title="Keyboard Shortcuts Reference (?)"
          >
            <Keyboard className="w-3.5 h-3.5 text-sky-400" />
            <span>Shortcuts</span>
          </button>

          {/* Open .ocard Native Project */}
          <button
            type="button"
            onClick={handleOpenProject}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-neutral-700/60"
            title="Open saved .ocard project file (Ctrl+O)"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Open .ocard</span>
          </button>

          {/* Save Project as .ocard */}
          <button
            type="button"
            onClick={handleSaveProject}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-sky-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-sky-600/50"
            title="Save editable project file as .ocard (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5 text-sky-400" />
            <span>Save .ocard</span>
          </button>

          {/* CorelDRAW / Vector Import */}
          <button
            type="button"
            onClick={() => setIsVectorImportOpen(true)}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-neutral-700/60"
            title="Import SVG vector shapes or CorelDRAW exports"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span>Import Vector / CDR</span>
          </button>

          {/* Explicit PDF Document Import */}
          <button
            type="button"
            onClick={() => {
              setSelectedPdfFile(null);
              setIsPdfImportOpen(true);
            }}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-neutral-700/60"
            title="Import single or multiple PDF pages into Front or Back card"
          >
            <FileText className="w-3.5 h-3.5 text-red-400" />
            <span>Import PDF</span>
          </button>

          {/* Export Print-Ready PDF / Images */}
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Export 300 DPI</span>
          </button>

          {/* Centralized Print Dialog */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print A6 Sheet</span>
          </button>

          <div className="h-4 w-px bg-neutral-800" />

          {/* Close Studio */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            title="Close Card Designer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* =========================================================
          HORIZONTAL TOOLBAR
         ========================================================= */}
      <CardDesignerToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        project={project}
        setProject={setProject}
        activeSide={activeSide}
        setActiveSide={setActiveSide}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCommitHistory={commitHistory}
        zoom={zoom}
        setZoom={setZoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitPage={handleFitPage}
        onActualSize={handleResetZoom}
        onGroupSelected={handleGroupSelected}
        onUngroupSelected={handleUngroupSelected}
        onBringForward={() => handleReorderSelected("up")}
        onSendBackward={() => handleReorderSelected("down")}
        onMirrorHorizontal={handleFlipHorizontal}
        onMirrorVertical={handleFlipVertical}
        onSelectTemplate={(tmplId) => handleSelectPresetById(tmplId)}
        onSelectPresetItem={(preset) => handleSelectPresetById(preset.slotId || preset.id)}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        onOpenPresetManager={() => setIsPresetManagerOpen(true)}
        onSaveProject={handleSaveProject}
        onLoadProject={handleOpenProject}
        onOpenExportModal={() => setIsExportOpen(true)}
        onOpenPrintDialog={handlePrint}
        onAddText={handleAddText}
        onAddShape={handleAddShape}
        onAddBarcode={handleAddBarcode}
        onAddQrCode={handleAddQrCode}
        onTriggerImageUpload={handleTriggerImageUpload}
        onTriggerSignatureUpload={handleTriggerSignatureUpload}
        onTriggerCrop={handleTriggerCrop}
        onAddObject={handleAddObject}
        onOpenImportModal={() => setIsVectorImportOpen(true)}
        onOpenPdfImport={() => {
          setSelectedPdfFile(null);
          setIsPdfImportOpen(true);
        }}
      />

      {/* =========================================================
          MAIN WORKSPACE LAYOUT (Layers Panel + Canvas + Inspector)
         ========================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Layers Panel */}
        <CardDesignerLayersPanel
          project={project}
          setProject={setProject}
          activeSide={activeSide}
          setActiveSide={setActiveSide}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          onCommitHistory={commitHistory}
        />

        {/* Center: Dual-Card Vector Canvas */}
        <CardDesignerCanvas
          project={project}
          setProject={setProject}
          activeSide={activeSide}
          setActiveSide={setActiveSide}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          zoom={zoom}
          setZoom={setZoom}
          panOffset={panOffset}
          setPanOffset={setPanOffset}
          onCommitHistory={commitHistory}
          onEditCrop={handleOpenCropForObject}
          onDropFiles={handleDropFiles}
          onRevertImageAdjustments={handleRevertImageAdjustments}
          onReplaceImage={handleReplaceImage}
          onDuplicateSelected={handleDuplicateSelected}
          onDeleteSelected={handleDeleteSelected}
          onGroupSelected={handleGroupSelected}
          onUngroupSelected={handleUngroupSelected}
          onReorderSelected={handleReorderSelected}
        />

        {/* Right: Properties Inspector Sidebar */}
        <CardDesignerInspector
          project={project}
          setProject={setProject}
          activeSide={activeSide}
          setActiveSide={setActiveSide}
          selectedIds={selectedIds}
          onCommitHistory={commitHistory}
          onOpenCropModal={handleOpenCropForObject}
          onRevertImageAdjustments={handleRevertImageAdjustments}
          onReplaceImage={handleReplaceImage}
          onOpenBackgroundStudio={(obj) => setBgStudioTargetObject(obj)}
          onOpenCardBackgroundStudio={(side) => setBgStudioTargetSide(side)}
        />
      </div>

      {/* =========================================================
          MODALS & OVERLAYS
         ========================================================= */}
      {/* High-Precision Crop & Deskew Modal (CR80 Auto-Fit & Revert/Reset) */}
      {cropModalTarget && (
        <CardDesignerCropModal
          target={cropModalTarget}
          onClose={() => setCropModalTarget(null)}
          onConfirm={handleConfirmCrop}
          cardWidthMm={project.cardWidthMm}
          cardHeightMm={project.cardHeightMm}
        />
      )}

      {/* Vector & CorelDRAW Import Modal */}
      {isVectorImportOpen && (
        <CardDesignerVectorImportModal
          activeSide={activeSide}
          onClose={() => setIsVectorImportOpen(false)}
          onImportObjects={(newObjects, targetSide) => {
            setProject((prev) => ({
              ...prev,
              [targetSide]: {
                ...prev[targetSide],
                objects: [...prev[targetSide].objects, ...newObjects],
              },
            }));
            setSelectedIds(newObjects.map((o) => o.id));
            commitHistory();
          }}
        />
      )}

      {/* High-Resolution Export Modal */}
      {isExportOpen && (
        <CardDesignerExportModal
          project={project}
          onClose={() => setIsExportOpen(false)}
        />
      )}

      {/* Centralized PDF Page Importer */}
      <PdfImportDialog
        isOpen={isPdfImportOpen}
        onClose={() => {
          setIsPdfImportOpen(false);
          setSelectedPdfFile(null);
        }}
        initialFile={selectedPdfFile}
        title="Import PDF Pages into Card Design"
        description="Select any PDF page to import as an independent 300 DPI high-resolution object."
        selectionMode="both"
        showSideSelector={true}
        initialSide={activeSide}
        showDualSideButtons={true}
        primaryButtonLabel={`Import to ${activeSide === "front" ? "Front" : "Back"} Card`}
        onImportSingle={(result) => handlePdfImportToCard(result, result.side || activeSide)}
        onImportMultiple={(results) => handleMultiplePdfImportToCard(results, activeSide)}
      />

      {/* Centralized Background Studio Modal for Card Image Objects */}
      {bgStudioTargetObject && (
        <UnifiedBackgroundStudioModal
          isOpen={true}
          onClose={() => setBgStudioTargetObject(null)}
          initialImage={bgStudioTargetObject.src || ""}
          title={`Background Studio: ${bgStudioTargetObject.name || "Card Image"}`}
          subtitle="Isolate Subject • Multi-Layer Composition • High-Res Vector Compatibility"
          onApply={(finalUrl) => {
            setProject((prev) => {
              const updateList = (list: CardObject[]) =>
                list.map((o) =>
                  o.id === bgStudioTargetObject.id ? { ...o, src: finalUrl } : o
                );
              return {
                ...prev,
                front: { ...prev.front, objects: updateList(prev.front.objects) },
                back: { ...prev.back, objects: updateList(prev.back.objects) },
              };
            });
            setBgStudioTargetObject(null);
            commitHistory();
          }}
        />
      )}

      {/* Centralized Background Studio Modal for Card Side Background */}
      {bgStudioTargetSide && (
        <UnifiedBackgroundStudioModal
          isOpen={true}
          onClose={() => setBgStudioTargetSide(null)}
          initialImage={project[bgStudioTargetSide].background.imageUrl || ""}
          title={`${bgStudioTargetSide === "front" ? "Front" : "Back"} Card Background Designer`}
          subtitle="Generate or Composite Background Textures, Gradients, Colors & Custom Graphics"
          onApply={(finalUrl) => {
            setProject((prev) => ({
              ...prev,
              [bgStudioTargetSide]: {
                ...prev[bgStudioTargetSide],
                background: {
                  ...prev[bgStudioTargetSide].background,
                  type: "image",
                  imageUrl: finalUrl,
                },
              },
            }));
            setBgStudioTargetSide(null);
            commitHistory();
          }}
        />
      )}

      {/* Keyboard Shortcuts Reference Modal */}
      <CardDesignerKeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Preset Manager Modal (Replace Default Starter Slots & Custom Presets) */}
      <CardDesignerPresetManagerModal
        isOpen={isPresetManagerOpen}
        onClose={() => setIsPresetManagerOpen(false)}
        currentProject={project}
        onApplyPreset={(loaded) => handleApplyPreset(loaded)}
        onLoadPreset={(loaded) => handleApplyPreset(loaded)}
      />
    </div>
  );
};
