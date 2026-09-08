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
import { CardDesignerCropModal } from "./CardDesignerCropModal";
import { CardDesignerVectorImportModal } from "./CardDesignerVectorImportModal";
import { CardDesignerExportModal } from "./CardDesignerExportModal";
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
  const [cropTargetObject, setCropTargetObject] = useState<CardObject | null>(null);
  const [isVectorImportOpen, setIsVectorImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const [isPdfImportOpen, setIsPdfImportOpen] = useState(false);
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [bgStudioTargetObject, setBgStudioTargetObject] = useState<CardObject | null>(null);
  const [bgStudioTargetSide, setBgStudioTargetSide] = useState<CardSide | null>(null);

  // Sync history state
  const commitHistory = useCallback(() => {
    historyRef.current.push(project);
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

  // Global Keyboard Shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        handleDuplicateSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const currentSideObjs = activeSide === "front" ? project.front.objects : project.back.objects;
        setSelectedIds(currentSideObjs.map((o) => o.id));
      } else if (e.key === "Escape") {
        setSelectedIds([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    handleUndo,
    handleRedo,
    handleDeleteSelected,
    handleDuplicateSelected,
    activeSide,
    project,
  ]);

  // Add Object directly to active side
  const handleAddObject = (obj: CardObject) => {
    setProject((prev) => ({
      ...prev,
      [activeSide]: {
        ...prev[activeSide],
        objects: [...prev[activeSide].objects, obj],
      },
    }));
    setSelectedIds([obj.id]);
    commitHistory();
  };

  // Import single PDF page as independent editable CardObject
  const handlePdfImportToCard = (
    result: PdfImportPageResult,
    targetSide: CardSide = activeSide
  ) => {
    const side = result.side || targetSide;
    const existingObjs = side === "front" ? project.front.objects : project.back.objects;
    const maxZ = existingObjs.reduce((max, o) => Math.max(max, o.zIndex), 0);

    const newObj: CardObject = {
      id: `pdf-layer-${Date.now()}-${result.pageNum}`,
      name: `Imported PDF Page ${result.pageNum} (${result.fileName})`,
      type: "image",
      targetSide: side,
      x: 0,
      y: 0,
      width: project.config.widthMm,
      height: project.config.heightMm,
      rotation: 0,
      opacity: 1,
      zIndex: maxZ + 1,
      visible: true,
      locked: false,
      aspectRatioLocked: false,
      flipX: false,
      flipY: false,
      src: result.dataUrl,
      originalSrc: result.dataUrl,
      naturalWidth: result.width,
      naturalHeight: result.height,
    };

    setProject((prev) => ({
      ...prev,
      [side]: {
        ...prev[side],
        objects: [...prev[side].objects, newObj],
      },
    }));

    setSelectedIds([newObj.id]);
    commitHistory();
    setIsPdfImportOpen(false);
    setSelectedPdfFile(null);
  };

  // Import multiple PDF pages simultaneously
  const handleMultiplePdfImportToCard = (
    results: PdfImportPageResult[],
    targetSide: CardSide = activeSide
  ) => {
    if (results.length === 0) return;

    setProject((prev) => {
      let updatedFront = [...prev.front.objects];
      let updatedBack = [...prev.back.objects];

      results.forEach((res, idx) => {
        const side = res.side || targetSide;
        const currentList = side === "front" ? updatedFront : updatedBack;
        const maxZ = currentList.reduce((max, o) => Math.max(max, o.zIndex), 0);

        const newObj: CardObject = {
          id: `pdf-layer-${Date.now()}-${res.pageNum}-${idx}`,
          name: `Imported PDF Page ${res.pageNum} (${res.fileName})`,
          type: "image",
          targetSide: side,
          x: 0,
          y: 0,
          width: prev.config.widthMm,
          height: prev.config.heightMm,
          rotation: 0,
          opacity: 1,
          zIndex: maxZ + 1 + idx,
          visible: true,
          locked: false,
          aspectRatioLocked: false,
          flipX: false,
          flipY: false,
          src: res.dataUrl,
          originalSrc: res.dataUrl,
          naturalWidth: res.width,
          naturalHeight: res.height,
        };

        if (side === "front") {
          updatedFront.push(newObj);
        } else {
          updatedBack.push(newObj);
        }
      });

      return {
        ...prev,
        front: { ...prev.front, objects: updatedFront },
        back: { ...prev.back, objects: updatedBack },
      };
    });

    commitHistory();
    setIsPdfImportOpen(false);
    setSelectedPdfFile(null);
  };

  // Direct Drag & Drop Handler for Card Canvas
  const handleDropFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    const firstFile = files[0];
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

  // Switch Template
  const handleLoadTemplate = (type: "corporate" | "official" | "visitor" | "blank") => {
    let tpl: CardDesignerProject;
    if (type === "corporate") tpl = createCorporateEmployeeTemplate();
    else if (type === "official") tpl = createOfficialServiceTemplate();
    else if (type === "visitor") tpl = createVisitorAccessTemplate();
    else tpl = createDefaultProject();

    setProject(tpl);
    historyRef.current = new HistoryManager(tpl);
    setCanUndo(false);
    setCanRedo(false);
    setSelectedIds([]);
    setIsTemplateMenuOpen(false);
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
              <div className="absolute right-0 top-9 w-60 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl p-2 z-50 text-xs space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  Preset Starter Cards
                </div>
                <button
                  type="button"
                  onClick={() => handleLoadTemplate("corporate")}
                  className="w-full text-left p-2 rounded-lg hover:bg-neutral-800 text-neutral-200 block"
                >
                  <span className="font-semibold block text-white">Corporate Employee Card</span>
                  <span className="text-[10px] text-neutral-400">Portrait 74×105mm with photo & barcode</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadTemplate("official")}
                  className="w-full text-left p-2 rounded-lg hover:bg-neutral-800 text-neutral-200 block"
                >
                  <span className="font-semibold block text-white">Official Government / Service Card</span>
                  <span className="text-[10px] text-neutral-400">Official security seal & QR authentication</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadTemplate("visitor")}
                  className="w-full text-left p-2 rounded-lg hover:bg-neutral-800 text-neutral-200 block"
                >
                  <span className="font-semibold block text-white">Visitor / Access Badge</span>
                  <span className="text-[10px] text-neutral-400">High-contrast access zones & instructions</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadTemplate("blank")}
                  className="w-full text-left p-2 rounded-lg hover:bg-neutral-800 text-neutral-200 block border-t border-neutral-800 pt-1.5"
                >
                  <span className="font-semibold block text-amber-400">Blank Dual A6 Canvas</span>
                  <span className="text-[10px] text-neutral-400">Clean 74×105 mm front and back areas</span>
                </button>
              </div>
            )}
          </div>

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
          panOffset={panOffset}
          setPanOffset={setPanOffset}
          onCommitHistory={commitHistory}
          onEditCrop={(obj) => setCropTargetObject(obj)}
          onDropFiles={handleDropFiles}
        />

        {/* Right: Properties Inspector Sidebar */}
        <CardDesignerInspector
          project={project}
          setProject={setProject}
          activeSide={activeSide}
          setActiveSide={setActiveSide}
          selectedIds={selectedIds}
          onCommitHistory={commitHistory}
          onOpenCropModal={(obj) => setCropTargetObject(obj)}
          onOpenBackgroundStudio={(obj) => setBgStudioTargetObject(obj)}
          onOpenCardBackgroundStudio={(side) => setBgStudioTargetSide(side)}
        />
      </div>

      {/* =========================================================
          MODALS & OVERLAYS
         ========================================================= */}
      {/* 8-Point Crop Modal */}
      {cropTargetObject && (
        <CardDesignerCropModal
          object={cropTargetObject}
          onClose={() => setCropTargetObject(null)}
          onApplyCrop={(cropRect) => {
            setProject((prev) => {
              const updateList = (list: CardObject[]) =>
                list.map((o) =>
                  o.id === cropTargetObject.id ? { ...o, cropRect } : o
                );
              return {
                ...prev,
                front: { ...prev.front, objects: updateList(prev.front.objects) },
                back: { ...prev.back, objects: updateList(prev.back.objects) },
              };
            });
            setCropTargetObject(null);
            commitHistory();
          }}
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
    </div>
  );
};
