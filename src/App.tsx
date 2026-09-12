/**
 * OMNISCAN TITAN X - Main Application Entrypoint
 * Autonomous Document Intelligence, Acquisition, Computer Vision, OCR & PDF Studio Platform
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  OmniDocument,
  OmniPage,
  AppLanguage,
  AppTheme,
  ViewMode,
  ActiveTool,
  ImageFilterPipeline,
  DocumentMetadata,
  OmniAnnotation,
  OmniRedaction,
} from "./types";
import { createInitialSampleDocument } from "./data/sampleDocuments";
import {
  processImagePipeline,
  calculateRadonDeskewAngle,
  detectDocumentBoundingBox,
  analyzeDataUrlBlankness,
  DEFAULT_FILTERS,
} from "./engine/vision";
import { runPageOCR } from "./engine/ocr";
import {
  exportDocumentToPDF,
  importPDFFile,
  renderPdfPageOnDemand,
  prioritizePdfThumbnailPages,
  destroyPdfDocument,
} from "./engine/pdf";
import { extractDocumentIntelligence, autoRedactPIIOnPage } from "./engine/intelligence";
import { packageTitanProject, extractTitanProject } from "./engine/project";
import { executePhysicalPageCrop, NormalizedCropBox } from "./engine/cropEngine";
import {
  classifyImageContent,
  ContentClassificationResult,
  getFallbackClassification,
} from "./engine/autoClassifier";
import {
  enhanceOmniPageAdaptive,
  diagnoseDocumentDefects,
  buildAdaptivePlan,
} from "./engine/autoProcessor";
import { HeaderBar } from "./components/layout/HeaderBar";
import { PageNavigator } from "./components/layout/PageNavigator";
import { InspectorPanel } from "./components/layout/InspectorPanel";
import { StatusBar } from "./components/layout/StatusBar";
import { DocumentCanvas } from "./components/canvas/DocumentCanvas";
import { ScanModal } from "./components/scanner/ScanModal";
import { BatchStudioModal, BatchConfig } from "./components/batch/BatchStudioModal";
import { DocumentCompareModal } from "./components/compare/DocumentCompareModal";
import { SecurityModal } from "./components/security/SecurityModal";
import { CommandPalette } from "./components/command/CommandPalette";
import { DiagnosticsModal } from "./components/diagnostics/DiagnosticsModal";
import { CamScannerFilterModal } from "./components/filters/CamScannerFilterModal";
import { PhotoPrintStudioModal } from "./components/photo/PhotoPrintStudioModal";
import { IdCardPrintStudioModal } from "./components/idcard/IdCardPrintStudioModal";
import { DocumentWorkspaceModal } from "./components/converter/DocumentWorkspaceModal";
import { PasswordModal } from "./components/modals/PasswordModal";
import { SplitPdfModal } from "./components/modals/SplitPdfModal";
import { ShortcutProvider, useShortcuts } from "./commands/ShortcutContext";
import { KeyboardShortcutsModal } from "./components/command/KeyboardShortcutsModal";
import { executeFilterPipeline } from "./engine/filters";
import { isRTL } from "./engine/i18n";
import { analyzeFile, ACCEPT_ALL_SUPPORTED } from "./services/upload/FileTypeRegistry";
import { parseDocumentFile, decodeImageFile } from "./services/upload/DocumentImportService";
import {
  Scan,
  Download,
  FolderOpen,
  Save,
  Wand2,
  Crop,
  FileSearch,
  Sparkles,
  Layers,
  SplitSquareVertical,
  ShieldCheck,
  Check,
  Activity,
  RotateCw,
  Plus,
  Trash2,
  Printer,
  Palette,
  CreditCard,
} from "lucide-react";

export function AppContent() {
  // Document State
  const [document, setDocument] = useState<OmniDocument>(() => {
    const initialPages = createInitialSampleDocument();
    return {
      id: "doc-" + Date.now(),
      name: "TITAN_Commercial_Contract_2026.titanproj",
      pages: initialPages,
      activePageIndex: 0,
      selectedPageIds: [],
      tags: [],
      isDirty: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        title: "Commercial Master Agreement & Tax Invoice 2026",
        author: "Titan Autonomous Document Intelligence",
        subject: "Accounts Payable & Enterprise NDA",
        keywords: "invoice, contract, msa, titan, defense",
        pdfAStandard: "PDF/A-2b",
      },
    };
  });

  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<OmniDocument[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // UI Modes & Settings
  const [theme, setTheme] = useState<AppTheme>("titan-dark");
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [zoom, setZoom] = useState<number>(1.0);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // Sidebar toggles
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(false);

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingMessage, setProcessingMessage] = useState<string>("");

  // Modals
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isKeyboardShortcutsModalOpen, setIsKeyboardShortcutsModalOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [isFilterStudioModalOpen, setIsFilterStudioModalOpen] = useState<boolean>(false);
  const [isPhotoPrintStudioModalOpen, setIsPhotoPrintStudioModalOpen] = useState<boolean>(false);
  const [isIdCardStudioModalOpen, setIsIdCardStudioModalOpen] = useState<boolean>(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState<boolean>(false);
  const [idCardStudioInitialMode, setIdCardStudioInitialMode] = useState<"idcard" | "a6">("idcard");
  const [isSplitPdfModalOpen, setIsSplitPdfModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [passwordModalState, setPasswordModalState] = useState<{
    isOpen: boolean;
    file: File | null;
    error?: string;
  }>({
    isOpen: false,
    file: null,
  });

  // Hidden File Input
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const activePage = document.pages[activePageIndex] || null;

  // Sync dark theme class on document element
  useEffect(() => {
    if (theme === "titan-dark") {
      window.document.documentElement.classList.add("dark");
    } else {
      window.document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Set RTL direction if language is Urdu or Arabic
  useEffect(() => {
    window.document.documentElement.dir = isRTL(language) ? "rtl" : "ltr";
  }, [language]);

  // Auto-classify active page if missing classification
  useEffect(() => {
    if (activePage && !activePage.detectedContent && activePage.originalDataUrl) {
      classifyImageContent(activePage.originalDataUrl)
        .then((classification) => {
          setDocument((prev) => {
            const newPages = [...prev.pages];
            const idx = newPages.findIndex((p) => p.id === activePage.id);
            if (idx !== -1 && !newPages[idx].detectedContent) {
              newPages[idx] = {
                ...newPages[idx],
                detectedContent: classification,
                filterSource: "auto-detected",
              };
              return { ...prev, pages: newPages };
            }
            return prev;
          });
        })
        .catch((err) => console.warn("Initial classification skipped:", err));
    }
  }, [activePage?.id, activePage?.originalDataUrl]);

  // Push snapshot to undo history
  const recordHistorySnapshot = useCallback((docToSave: OmniDocument) => {
    setHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      const updated = [...sliced, docToSave];
      if (updated.length > 30) updated.shift();
      return updated;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 29));
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevDoc = history[historyIndex - 1];
      if (prevDoc) {
        setDocument(prevDoc);
        setHistoryIndex((prev) => prev - 1);
        if (activePageIndex >= prevDoc.pages.length) {
          setActivePageIndex(Math.max(0, prevDoc.pages.length - 1));
        }
      }
    }
  }, [history, historyIndex, activePageIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextDoc = history[historyIndex + 1];
      if (nextDoc) {
        setDocument(nextDoc);
        setHistoryIndex((prev) => prev + 1);
        if (activePageIndex >= nextDoc.pages.length) {
          setActivePageIndex(Math.max(0, nextDoc.pages.length - 1));
        }
      }
    }
  }, [history, historyIndex, activePageIndex]);

  // Initial history snapshot on load
  useEffect(() => {
    if (history.length === 0 && document.pages.length > 0) {
      setHistory([document]);
      setHistoryIndex(0);
    }
  }, []);

  // Progressive PDF Thumbnail Synchronization
  useEffect(() => {
    const handleThumbReady = (e: any) => {
      const { pdfDocId, pageNum, thumbnailUrl, width, height, isBlank, blankScore } = e.detail || {};
      if (!pdfDocId || !pageNum || !thumbnailUrl) return;

      setDocument((prev) => {
        let updated = false;
        const newPages = prev.pages.map((p) => {
          if (p.pdfDocId === pdfDocId && p.pageNumber === pageNum) {
            updated = true;
            return {
              ...p,
              thumbnailDataUrl: thumbnailUrl,
              processedDataUrl: p.isPendingRender ? thumbnailUrl : p.processedDataUrl,
              originalDataUrl: p.isPendingRender ? thumbnailUrl : p.originalDataUrl,
              width: width || p.width,
              height: height || p.height,
              isBlank: isBlank ?? p.isBlank,
              blankScore: blankScore ?? p.blankScore,
            };
          }
          return p;
        });
        if (!updated) return prev;
        return { ...prev, pages: newPages };
      });
    };

    window.addEventListener("titan-pdf-thumbnail-ready", handleThumbReady);
    return () => window.removeEventListener("titan-pdf-thumbnail-ready", handleThumbReady);
  }, []);

  // Track in-flight on-demand page rendering requests to avoid duplicates
  const inFlightRenderingRef = useRef<Set<string>>(new Set());

  // Progressive High-Res On-Demand Rendering for Active Viewport Page
  useEffect(() => {
    const activePage = document.pages[activePageIndex];
    if (!activePage || !activePage.isPendingRender || !activePage.pdfDocId) return;

    const pageKey = `${activePage.pdfDocId}-${activePage.pageNumber}`;
    if (inFlightRenderingRef.current.has(pageKey)) return;

    inFlightRenderingRef.current.add(pageKey);
    let isCancelled = false;

    // Prioritize active page and surrounding pages in thumbnail/worker queue
    prioritizePdfThumbnailPages([
      activePage.pageNumber,
      activePage.pageNumber + 1,
      activePage.pageNumber - 1,
    ]);

    renderPdfPageOnDemand(activePage.pdfDocId, activePage.pageNumber).then((rendered) => {
      inFlightRenderingRef.current.delete(pageKey);
      if (isCancelled || !rendered) return;

      setDocument((prev) => ({
        ...prev,
        pages: prev.pages.map((p) =>
          p.id === activePage.id
            ? {
                ...p,
                processedDataUrl: rendered.dataUrl,
                originalDataUrl: rendered.dataUrl,
                thumbnailDataUrl: rendered.thumbnailUrl,
                width: rendered.width,
                height: rendered.height,
                isBlank: rendered.isBlank,
                blankScore: rendered.blankScore,
                isPendingRender: false,
              }
            : p
        ),
      }));

      // Classify page content automatically once high-res image is rendered
      classifyImageContent(rendered.thumbnailUrl).then((classification) => {
        setDocument((prev) => ({
          ...prev,
          pages: prev.pages.map((p) =>
            p.id === activePage.id && !p.detectedContent
              ? {
                  ...p,
                  detectedContent: classification,
                  filters: { ...classification.recommendedFilters },
                  filterSource: "auto-detected",
                }
              : p
          ),
        }));
      }).catch(() => {});
    }).catch((err) => {
      inFlightRenderingRef.current.delete(pageKey);
      console.warn(`On-demand render failed for page ${activePage.pageNumber}:`, err);
    });

    return () => {
      isCancelled = true;
    };
  }, [activePageIndex, document.pages[activePageIndex]?.id, document.pages[activePageIndex]?.isPendingRender, document.pages[activePageIndex]?.pdfDocId]);

  // -------------------------------------------------------------
  // CamScanner Filter Modal Apply (Single vs Batch All Pages)
  // -------------------------------------------------------------
  const handleApplyCamScannerFilters = useCallback(
    async (targetIdx: number, newFilters: ImageFilterPipeline, applyToAll: boolean) => {
      setIsProcessing(true);
      setProcessingMessage(applyToAll ? "Applying CamScanner Filters to all pages..." : "Applying Filters...");

      try {
        if (applyToAll) {
          const updatedPages = await Promise.all(
            document.pages.map(async (pg) => {
              const { processedDataUrl } = await executeFilterPipeline(pg.originalDataUrl, newFilters);
              return {
                ...pg,
                filters: { ...newFilters },
                processedDataUrl,
                thumbnailDataUrl: processedDataUrl,
                isModified: true,
                lastModifiedAt: new Date().toISOString(),
              };
            })
          );
          setDocument((prev) => ({ ...prev, pages: updatedPages, updatedAt: new Date().toISOString() }));
        } else {
          const target = document.pages[targetIdx];
          if (target) {
            const { processedDataUrl } = await executeFilterPipeline(target.originalDataUrl, newFilters);
            setDocument((prev) => {
              const newPages = [...prev.pages];
              newPages[targetIdx] = {
                ...newPages[targetIdx],
                filters: { ...newFilters },
                processedDataUrl,
                thumbnailDataUrl: processedDataUrl,
                isModified: true,
                lastModifiedAt: new Date().toISOString(),
              };
              return { ...prev, pages: newPages, updatedAt: new Date().toISOString() };
            });
          }
        }
        setIsDirty(true);
        setIsFilterStudioModalOpen(false);
      } catch (err) {
        console.error("Failed to apply CamScanner filters:", err);
      } finally {
        setIsProcessing(false);
        setProcessingMessage("");
      }
    },
    [document.pages]
  );

  // -------------------------------------------------------------
  // High-Performance Two-Stage Filter Pipeline & Original Source Caching
  // -------------------------------------------------------------
  const [activePagePreviewUrl, setActivePagePreviewUrl] = useState<string | null>(null);

  // Cached decoded HTMLImageElement for the active page to avoid repeated re-decoding
  const cachedSourceImageRef = useRef<{ pageId: string; sourceUrl: string; image: HTMLImageElement } | null>(null);

  // Concurrency and RAF tracking refs
  const activePageRef = useRef<OmniPage | null>(activePage);
  activePageRef.current = activePage;

  const activePageIndexRef = useRef<number>(activePageIndex);
  activePageIndexRef.current = activePageIndex;

  const renderJobIdRef = useRef<number>(0);
  const filterRafIdRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const isRenderingRef = useRef<boolean>(false);
  const pendingRenderRef = useRef<{ isCommit: boolean } | null>(null);
  const latestFiltersRef = useRef<ImageFilterPipeline>(activePage?.filters || DEFAULT_FILTERS);

  // Sync cache and cancel stale render tasks when active page changes
  useEffect(() => {
    if (activePage) {
      latestFiltersRef.current = { ...activePage.filters };
      setActivePagePreviewUrl(null);
      pendingRenderRef.current = null;

      // Cancel pending frames and settle timers
      if (filterRafIdRef.current !== null) {
        cancelAnimationFrame(filterRafIdRef.current);
        filterRafIdRef.current = null;
      }
      if (settleTimerRef.current !== null) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      renderJobIdRef.current++;

      // Pre-cache source image element
      if (
        !cachedSourceImageRef.current ||
        cachedSourceImageRef.current.pageId !== activePage.id ||
        cachedSourceImageRef.current.sourceUrl !== activePage.originalDataUrl
      ) {
        const img = new Image();
        img.onload = () => {
          if (activePageRef.current?.id === activePage.id) {
            cachedSourceImageRef.current = {
              pageId: activePage.id,
              sourceUrl: activePage.originalDataUrl,
              image: img,
            };
          }
        };
        img.src = activePage.originalDataUrl;
        if (img.complete && img.naturalWidth > 0) {
          cachedSourceImageRef.current = {
            pageId: activePage.id,
            sourceUrl: activePage.originalDataUrl,
            image: img,
          };
        }
      }
    } else {
      cachedSourceImageRef.current = null;
      setActivePagePreviewUrl(null);
    }
  }, [activePage?.id, activePage?.originalDataUrl]);

  const runFilterRender = useCallback(async (isCommit: boolean) => {
    const page = activePageRef.current;
    if (!page) return;
    const targetPageId = page.id;
    const targetPageIndex = activePageIndexRef.current;
    const filtersToRun = { ...latestFiltersRef.current };
    const jobId = ++renderJobIdRef.current;

    if (isRenderingRef.current) {
      pendingRenderRef.current = { isCommit };
      return;
    }

    isRenderingRef.current = true;

    try {
      const sourceImage =
        cachedSourceImageRef.current?.pageId === targetPageId
          ? cachedSourceImageRef.current.image
          : null;

      const result = await processImagePipeline(
        page.originalDataUrl,
        filtersToRun,
        !isCommit,
        { sourceImage, maxPreviewDimension: isCommit ? undefined : 850 }
      );

      // Verify token hasn't been superseded
      if (jobId !== renderJobIdRef.current || activePageRef.current?.id !== targetPageId) {
        return;
      }

      if (!isCommit) {
        // Stage 1: Ultra-fast visual preview without triggering heavy document mutations
        setActivePagePreviewUrl(result.processedDataUrl);
      } else {
        // Stage 2: Final quality commit - commit to document model and update thumbnails
        setDocument((prev) => {
          const newPages = [...prev.pages];
          const pageIdx = newPages.findIndex((p) => p.id === targetPageId);
          if (pageIdx === -1) {
            return prev;
          }
          newPages[pageIdx] = {
            ...newPages[pageIdx],
            filters: filtersToRun,
            processedDataUrl: result.processedDataUrl,
            thumbnailDataUrl: result.thumbnailDataUrl || result.processedDataUrl,
            isModified: true,
            lastModifiedAt: new Date().toISOString(),
          };
          return { ...prev, pages: newPages, updatedAt: new Date().toISOString() };
        });
        setActivePagePreviewUrl(null);
        setIsDirty(true);
      }
    } catch (err) {
      console.error("Filter pipeline error:", err);
    } finally {
      isRenderingRef.current = false;
      if (pendingRenderRef.current) {
        const next = pendingRenderRef.current;
        pendingRenderRef.current = null;
        runFilterRender(next.isCommit);
      }
    }
  }, []);

  const handleUpdateFilters = useCallback(
    (updatedFilters: Partial<ImageFilterPipeline>, isCommit: boolean = true) => {
      if (!activePageRef.current) return;
      latestFiltersRef.current = { ...latestFiltersRef.current, ...updatedFilters };

      // Mark filter source as manual user-override
      const currPage = activePageRef.current;
      if (currPage && currPage.filterSource !== "user-override") {
        setDocument((prev) => {
          const newPages = [...prev.pages];
          const idx = newPages.findIndex((p) => p.id === currPage.id);
          if (idx !== -1) {
            newPages[idx] = { ...newPages[idx], filterSource: "user-override" };
            return { ...prev, pages: newPages };
          }
          return prev;
        });
      }

      if (settleTimerRef.current !== null) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }

      if (!isCommit) {
        // Fast interactive dragging: throttle via requestAnimationFrame
        if (filterRafIdRef.current === null) {
          filterRafIdRef.current = requestAnimationFrame(() => {
            filterRafIdRef.current = null;
            runFilterRender(false);
          });
        }

        // Automatic commit fallback if pointerUp was missed
        settleTimerRef.current = window.setTimeout(() => {
          settleTimerRef.current = null;
          runFilterRender(true);
        }, 500);
      } else {
        // Immediate final commit
        if (filterRafIdRef.current !== null) {
          cancelAnimationFrame(filterRafIdRef.current);
          filterRafIdRef.current = null;
        }
        runFilterRender(true);
      }
    },
    [runFilterRender]
  );

  const handleResetFilters = useCallback(() => {
    if (!activePageRef.current) return;
    handleUpdateFilters(DEFAULT_FILTERS, true);
  }, [handleUpdateFilters]);

  // Optical CamScanner Content Auto-Detection & Preset Assignment
  const handleReDetectActivePageContent = useCallback(async () => {
    if (!activePage) return;
    setIsProcessing(true);
    setProcessingMessage("Running adaptive document analysis & defect diagnosis...");

    try {
      const enhancedPage = await enhanceOmniPageAdaptive(activePage);

      setDocument((prev) => {
        const newPages = [...prev.pages];
        const idx = newPages.findIndex((p) => p.id === activePage.id);
        if (idx === -1) return prev;
        newPages[idx] = enhancedPage;
        return { ...prev, pages: newPages, updatedAt: new Date().toISOString() };
      });

      latestFiltersRef.current = { ...enhancedPage.filters };
      setIsDirty(true);

      const qualityDelta = enhancedPage.adaptiveAnalysis?.qualityDelta ?? 0;
      const typeLabel = enhancedPage.detectedContent?.label || "Document";
      const corrections =
        enhancedPage.adaptiveAnalysis?.plan.appliedCorrections.join("; ") || "Tone & contrast enhanced";
      setToastMessage(
        `Auto-Optimized (${typeLabel} +${qualityDelta} pts): ${corrections}`
      );
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error("Adaptive auto-detect error:", err);
      // Fallback to legacy classification if needed
      try {
        const src = activePage.originalDataUrl || activePage.processedDataUrl;
        const classification = await classifyImageContent(src);
        setDocument((prev) => {
          const newPages = [...prev.pages];
          const idx = newPages.findIndex((p) => p.id === activePage.id);
          if (idx === -1) return prev;
          newPages[idx] = {
            ...newPages[idx],
            filters: { ...classification.recommendedFilters, rotation: newPages[idx].filters.rotation },
            detectedContent: classification,
            filterSource: "auto-detected",
            isModified: true,
          };
          return { ...prev, pages: newPages };
        });
        await runFilterRender(true);
      } catch (fallbackErr) {
        console.error("Fallback classification failed:", fallbackErr);
      }
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  }, [activePage, runFilterRender]);

  // End-Level Adaptive Document Optimization (Single Page)
  const handleAutoEnhanceActivePage = useCallback(
    async (pageIdx = activePageIndex) => {
      const page = document.pages[pageIdx];
      if (!page) return;

      recordHistorySnapshot(document);
      setIsProcessing(true);
      setProcessingMessage("Running adaptive document diagnosis & optimization...");

      try {
        const enhancedPage = await enhanceOmniPageAdaptive(page);
        setDocument((prev) => {
          const newPages = [...prev.pages];
          newPages[pageIdx] = enhancedPage;
          return { ...prev, pages: newPages, updatedAt: new Date().toISOString() };
        });

        if (pageIdx === activePageIndex) {
          latestFiltersRef.current = { ...enhancedPage.filters };
        }

        setIsDirty(true);

        const qualityDelta = enhancedPage.adaptiveAnalysis?.qualityDelta ?? 0;
        const typeLabel = enhancedPage.detectedContent?.label || "Document";
        const corrections =
          enhancedPage.adaptiveAnalysis?.plan.appliedCorrections.join("; ") ||
          "Tone, whitening & contrast enhanced";
        setToastMessage(
          `Auto-Optimized (${typeLabel} +${qualityDelta} pts): ${corrections}`
        );
        setTimeout(() => setToastMessage(null), 4000);
      } catch (err) {
        console.error("Adaptive enhancement error:", err);
      } finally {
        setIsProcessing(false);
        setProcessingMessage("");
      }
    },
    [document, activePageIndex, recordHistorySnapshot]
  );

  // End-Level Adaptive Document Optimization (All Pages)
  const handleAutoEnhanceAllPages = useCallback(async () => {
    if (document.pages.length === 0) return;

    recordHistorySnapshot(document);
    setIsProcessing(true);
    setProcessingMessage(`Optimizing all ${document.pages.length} pages adaptively...`);

    try {
      const updatedPages = [...document.pages];
      for (let i = 0; i < updatedPages.length; i++) {
        setProcessingMessage(`Optimizing page ${i + 1} of ${updatedPages.length}...`);
        try {
          updatedPages[i] = await enhanceOmniPageAdaptive(updatedPages[i]);
        } catch (e) {
          console.warn(`Skipped auto-enhance on page ${i + 1}:`, e);
        }
      }

      setDocument((prev) => ({
        ...prev,
        pages: updatedPages,
        updatedAt: new Date().toISOString(),
      }));

      if (updatedPages[activePageIndex]) {
        latestFiltersRef.current = { ...updatedPages[activePageIndex].filters };
      }

      setIsDirty(true);
      setToastMessage(`Successfully optimized all ${document.pages.length} pages adaptively.`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error("Batch adaptive optimization error:", err);
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  }, [document, activePageIndex, recordHistorySnapshot]);

  // Apply current page's filter and tone adjustments to all loaded pages
  const handleApplyFiltersToAllPages = useCallback(async () => {
    if (!activePage || document.pages.length <= 1) return;

    // Capture tone adjustments to copy (exclude geometry: cropBox, perspectivePoints, rotation)
    const sourceFilters = { ...latestFiltersRef.current };
    const { cropBox, perspectivePoints, rotation, ...toneSettings } = sourceFilters;

    recordHistorySnapshot(document);
    setIsProcessing(true);
    setProcessingMessage(`Applying settings to all ${document.pages.length} pages...`);

    const pageCount = document.pages.length;
    const targetPageId = activePage.id;

    // 1. Instantly update all pages' independent filter objects in document state
    const newPages = document.pages.map((p) => {
      if (p.id === targetPageId) return p;
      return {
        ...p,
        filters: {
          ...p.filters,
          ...toneSettings,
          // Retain each page's own geometry!
          rotation: p.filters.rotation,
          deskewAngle: p.filters.deskewAngle,
          cropBox: p.filters.cropBox,
          perspectivePoints: p.filters.perspectivePoints,
        },
        filterSource: "user-override" as const,
        isModified: true,
        lastModifiedAt: new Date().toISOString(),
      };
    });

    setDocument((prev) => ({
      ...prev,
      pages: newPages,
      updatedAt: new Date().toISOString(),
    }));
    setIsDirty(true);

    // 2. Process thumbnails and preview renders for each page asynchronously without blocking UI
    try {
      for (let i = 0; i < newPages.length; i++) {
        const p = newPages[i];
        if (p.id === targetPageId) continue;
        try {
          const res = await processImagePipeline(
            p.originalDataUrl,
            p.filters,
            false,
            { maxPreviewDimension: 1200 }
          );
          setDocument((prevDoc) => {
            const pagesCopy = [...prevDoc.pages];
            const pIdx = pagesCopy.findIndex((item) => item.id === p.id);
            if (pIdx !== -1) {
              pagesCopy[pIdx] = {
                ...pagesCopy[pIdx],
                processedDataUrl: res.processedDataUrl,
                thumbnailDataUrl: res.thumbnailDataUrl || res.processedDataUrl,
              };
            }
            return { ...prevDoc, pages: pagesCopy };
          });
        } catch (e) {
          console.warn("Async thumbnail render skipped for page:", p.id, e);
        }
      }
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }

    setToastMessage(`Successfully applied adjustments to all ${pageCount} pages.`);
    setTimeout(() => setToastMessage(null), 3500);
  }, [activePage, document, recordHistorySnapshot]);

  // -------------------------------------------------------------
  // Auto Deskew & Auto Crop
  // -------------------------------------------------------------
  const handleAutoDeskew = useCallback(
    async (pageIdx = activePageIndex) => {
      const page = document.pages[pageIdx];
      if (!page) return;

      setIsProcessing(true);
      setProcessingMessage("Calculating Radon/Hough Deskew Angle...");

      try {
        const angle = await calculateRadonDeskewAngle(page.originalDataUrl);
        const newFilters = { ...page.filters, deskewAngle: angle };
        const { processedDataUrl } = await processImagePipeline(page.originalDataUrl, newFilters);

        setDocument((prev) => {
          const newPages = [...prev.pages];
          newPages[pageIdx] = {
            ...newPages[pageIdx],
            filters: newFilters,
            processedDataUrl,
            thumbnailDataUrl: processedDataUrl,
            isModified: true,
          };
          return { ...prev, pages: newPages };
        });
        setIsDirty(true);
      } catch (err) {
        console.error(err);
      } finally {
        setIsProcessing(false);
        setProcessingMessage("");
      }
    },
    [document.pages, activePageIndex]
  );

  const handleAutoCrop = useCallback(
    async (pageIdx = activePageIndex) => {
      const page = document.pages[pageIdx];
      if (!page) return;

      setIsProcessing(true);
      setProcessingMessage("Detecting Document Margins & Contours...");

      try {
        const bbox = await detectDocumentBoundingBox(page.originalDataUrl);
        // Apply whitening and crop-oriented enhancement
        const newFilters = { ...page.filters, backgroundWhiten: true, shadowRemoval: true };
        const { processedDataUrl } = await processImagePipeline(page.originalDataUrl, newFilters);

        setDocument((prev) => {
          const newPages = [...prev.pages];
          newPages[pageIdx] = {
            ...newPages[pageIdx],
            filters: newFilters,
            processedDataUrl,
            thumbnailDataUrl: processedDataUrl,
            isModified: true,
          };
          return { ...prev, pages: newPages };
        });
        setIsDirty(true);
      } catch (err) {
        console.error(err);
      } finally {
        setIsProcessing(false);
        setProcessingMessage("");
      }
    },
    [document.pages, activePageIndex]
  );

  // -------------------------------------------------------------
  // Dedicated Physical PDF Page Crop Handler
  // -------------------------------------------------------------
  const handleApplyPageCrop = useCallback(
    async (cropBox: NormalizedCropBox, scope: "current" | "selected" | "all") => {
      if (document.pages.length === 0) return;
      recordHistorySnapshot(document);

      setIsProcessing(true);
      setProcessingMessage(
        scope === "all"
          ? `Cropping all ${document.pages.length} pages...`
          : scope === "selected"
          ? `Cropping ${selectedPageIds.length} selected pages...`
          : `Cropping page ${activePageIndex + 1}...`
      );

      try {
        let targetIndices: number[] = [];
        if (scope === "all") {
          targetIndices = document.pages.map((_, i) => i);
        } else if (scope === "selected" && selectedPageIds.length > 0) {
          targetIndices = document.pages
            .map((p, i) => (selectedPageIds.includes(p.id) ? i : -1))
            .filter((i) => i !== -1);
          if (targetIndices.length === 0) targetIndices = [activePageIndex];
        } else {
          targetIndices = [activePageIndex];
        }

        const newPages = [...document.pages];
        for (const idx of targetIndices) {
          const pageToCrop = newPages[idx];
          if (pageToCrop) {
            const croppedPage = await executePhysicalPageCrop(pageToCrop, cropBox);
            try {
              const classification = await classifyImageContent(
                croppedPage.originalDataUrl || croppedPage.processedDataUrl
              );
              croppedPage.detectedContent = classification;
              croppedPage.filters = {
                ...croppedPage.filters,
                ...classification.recommendedFilters,
                rotation: croppedPage.filters.rotation,
                deskewAngle: croppedPage.filters.deskewAngle,
              };
              croppedPage.filterSource = "auto-detected";
              if (idx === activePageIndex) {
                latestFiltersRef.current = { ...croppedPage.filters };
              }
            } catch (classErr) {
              console.warn("Classification after crop fallback:", classErr);
            }
            newPages[idx] = croppedPage;
          }
        }

        setDocument((prev) => ({
          ...prev,
          pages: newPages,
          updatedAt: new Date().toISOString(),
          isDirty: true,
        }));
        setIsDirty(true);
        setActiveTool("select");
      } catch (err) {
        console.error("Crop error:", err);
      } finally {
        setIsProcessing(false);
        setProcessingMessage("");
      }
    },
    [document, activePageIndex, recordHistorySnapshot]
  );

  // -------------------------------------------------------------
  // OCR Execution
  // -------------------------------------------------------------
  const handleRunOcr = useCallback(
    async (lang = "eng", pageIdx = activePageIndex) => {
      const page = document.pages[pageIdx];
      if (!page) return;

      setIsProcessing(true);
      setProcessingMessage(`Running ${lang.toUpperCase()} Multi-Language OCR...`);

      try {
        const result = await runPageOCR(page.processedDataUrl, lang, (p) => {
          setProcessingMessage(`Running OCR (${Math.round(p * 100)}%)...`);
        });

        setDocument((prev) => {
          const newPages = [...prev.pages];
          newPages[pageIdx] = {
            ...newPages[pageIdx],
            ocr: result,
            isModified: true,
          };
          return { ...prev, pages: newPages };
        });
        setIsDirty(true);
      } catch (err) {
        console.error("OCR error:", err);
      } finally {
        setIsProcessing(false);
        setProcessingMessage("");
      }
    },
    [document.pages, activePageIndex]
  );

  const handleUpdateOcrText = useCallback(
    (newText: string) => {
      if (!activePage || !activePage.ocr) return;
      setDocument((prev) => {
        const newPages = [...prev.pages];
        newPages[activePageIndex] = {
          ...newPages[activePageIndex],
          ocr: {
            ...newPages[activePageIndex].ocr!,
            text: newText,
          },
          isModified: true,
        };
        return { ...prev, pages: newPages };
      });
      setIsDirty(true);
    },
    [activePage, activePageIndex]
  );

  // -------------------------------------------------------------
  // Document Intelligence (Gemini + Local Fallback)
  // -------------------------------------------------------------
  const handleAnalyzeIntelligence = useCallback(
    async (pageIdx = activePageIndex) => {
      const page = document.pages[pageIdx];
      if (!page) return;

      setIsProcessing(true);
      setProcessingMessage("Extracting Semantic Intelligence & Entities...");

      try {
        // If OCR is not done yet, run quick OCR first
        let ocrText = page.ocr?.text;
        if (!ocrText) {
          const ocrResult = await runPageOCR(page.processedDataUrl, "eng");
          ocrText = ocrResult.text;
        }

        const intel = await extractDocumentIntelligence(page.processedDataUrl, ocrText);

        setDocument((prev) => {
          const newPages = [...prev.pages];
          newPages[pageIdx] = {
            ...newPages[pageIdx],
            intelligence: intel,
            isModified: true,
          };
          return { ...prev, pages: newPages };
        });
        setIsDirty(true);
      } catch (err) {
        console.error("Intelligence error:", err);
      } finally {
        setIsProcessing(false);
        setProcessingMessage("");
      }
    },
    [document.pages, activePageIndex]
  );

  const handleAutoRedactPII = useCallback(async () => {
    if (!activePage || !activePage.intelligence) return;

    const { updatedRedactions } = autoRedactPIIOnPage(
      activePage.intelligence,
      activePage.redactions || []
    );

    setDocument((prev) => {
      const newPages = [...prev.pages];
      newPages[activePageIndex] = {
        ...newPages[activePageIndex],
        redactions: updatedRedactions,
        isModified: true,
      };
      return { ...prev, pages: newPages };
    });
    setIsDirty(true);
  }, [activePage, activePageIndex]);

  // -------------------------------------------------------------
  // Page Management (Selection, Rotate, Duplicate, Delete, Add, Move)
  // -------------------------------------------------------------
  const handleSelectPage = useCallback(
    (index: number, multiSelect = false) => {
      setDocument((currentDoc) => {
        if (index < 0 || index >= currentDoc.pages.length) return currentDoc;
        const targetPage = currentDoc.pages[index];
        if (!targetPage) return currentDoc;

        setActivePageIndex(index);

        setSelectedPageIds((prev) => {
          if (!multiSelect) {
            return [targetPage.id];
          }
          return prev.includes(targetPage.id)
            ? prev.filter((id) => id !== targetPage.id)
            : [...prev, targetPage.id];
        });

        return currentDoc;
      });
    },
    []
  );

  const handleRotateActivePage = useCallback(
    async (degrees: number, pageIdx = activePageIndex) => {
      const page = document.pages[pageIdx];
      if (!page) return;

      const newRotation = (page.filters.rotation + degrees + 360) % 360;
      await handleUpdateFilters({ rotation: newRotation });
    },
    [document.pages, activePageIndex, handleUpdateFilters]
  );

  const handleDeletePage = useCallback((index: number) => {
    setDocument((prevDoc) => {
      if (prevDoc.pages.length === 0 || index < 0 || index >= prevDoc.pages.length) {
        return prevDoc;
      }
      const pageToDelete = prevDoc.pages[index];
      const newPages = prevDoc.pages.filter((_, idx) => idx !== index);
      const renumberedPages = newPages.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));

      // Clean up selection
      if (pageToDelete) {
        setSelectedPageIds((prevSelected) =>
          prevSelected.filter((id) => id !== pageToDelete.id)
        );
      }

      // Safe clamped active page index
      setActivePageIndex((prevActive) => {
        const nextCount = newPages.length;
        if (nextCount === 0) return 0;
        if (prevActive >= nextCount) return nextCount - 1;
        if (index < prevActive) return prevActive - 1;
        return prevActive;
      });

      return {
        ...prevDoc,
        pages: renumberedPages,
        updatedAt: new Date().toISOString(),
      };
    });
    setIsDirty(true);
  }, []);

  const handleDuplicatePage = useCallback(
    (index: number) => {
      setDocument((prev) => {
        const target = prev.pages[index];
        if (!target) return prev;

        const duplicate: OmniPage = {
          ...target,
          id: `page-${Date.now()}`,
          pageNumber: index + 2,
          isModified: true,
        };

        const newPages = [...prev.pages];
        newPages.splice(index + 1, 0, duplicate);
        const renumbered = newPages.map((p, idx) => ({ ...p, pageNumber: idx + 1 }));

        setActivePageIndex(index + 1);
        setSelectedPageIds([duplicate.id]);

        return {
          ...prev,
          pages: renumbered,
          updatedAt: new Date().toISOString(),
        };
      });
      setIsDirty(true);
    },
    []
  );

  const handleAddBlankPage = useCallback(() => {
    const canvas = window.document.createElement("canvas");
    canvas.width = 1275;
    canvas.height = 1650;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    const blankPageId = `blank-${Date.now()}`;
    const blankPage: OmniPage = {
      id: blankPageId,
      pageNumber: document.pages.length + 1,
      originalDataUrl: dataUrl,
      processedDataUrl: dataUrl,
      thumbnailDataUrl: dataUrl,
      width: 1275,
      height: 1650,
      dpi: 300,
      sizeBytes: 15000,
      isBlank: true,
      blankScore: 0.99,
      filters: { ...DEFAULT_FILTERS },
      annotations: [],
      redactions: [],
      formFields: [],
      isModified: true,
      lastModifiedAt: new Date().toISOString(),
    };

    setDocument((prev) => {
      const nextPages = [...prev.pages, blankPage];
      setActivePageIndex(nextPages.length - 1);
      setSelectedPageIds([blankPageId]);
      return {
        ...prev,
        pages: nextPages,
        updatedAt: new Date().toISOString(),
      };
    });
    setIsDirty(true);
  }, [document.pages.length]);

  const handleInsertPhotoPage = useCallback((dataUrl: string) => {
    const photoPageId = `photo-${Date.now()}`;
    const newPage: OmniPage = {
      id: photoPageId,
      pageNumber: document.pages.length + 1,
      originalDataUrl: dataUrl,
      processedDataUrl: dataUrl,
      thumbnailDataUrl: dataUrl,
      width: 1800,
      height: 1200,
      dpi: 300,
      sizeBytes: 150000,
      isBlank: false,
      blankScore: 0,
      filters: { ...DEFAULT_FILTERS },
      annotations: [],
      redactions: [],
      formFields: [],
      isModified: true,
      lastModifiedAt: new Date().toISOString(),
    };

    setDocument((prev) => {
      const nextPages = [...prev.pages, newPage];
      setActivePageIndex(nextPages.length - 1);
      setSelectedPageIds([photoPageId]);
      return {
        ...prev,
        pages: nextPages,
        updatedAt: new Date().toISOString(),
      };
    });
    setIsDirty(true);
  }, [document.pages.length]);

  const handleMovePage = useCallback((fromIndex: number, toIndex: number) => {
    setDocument((prev) => {
      const newPages = [...prev.pages];
      const [moved] = newPages.splice(fromIndex, 1);
      newPages.splice(toIndex, 0, moved);
      return {
        ...prev,
        pages: newPages.map((p, idx) => ({ ...p, pageNumber: idx + 1 })),
        updatedAt: new Date().toISOString(),
      };
    });
    setActivePageIndex(toIndex);
    setIsDirty(true);
  }, []);

  // -------------------------------------------------------------
  // Annotations & Redactions
  // -------------------------------------------------------------
  const handleAddAnnotation = useCallback(
    (pageIndex: number, annotation: OmniAnnotation) => {
      setDocument((prev) => {
        const newPages = [...prev.pages];
        newPages[pageIndex] = {
          ...newPages[pageIndex],
          annotations: [...newPages[pageIndex].annotations, annotation],
          isModified: true,
        };
        return { ...prev, pages: newPages };
      });
      setIsDirty(true);
    },
    []
  );

  const handleDeleteAnnotation = useCallback((pageIndex: number, id: string) => {
    setDocument((prev) => {
      const newPages = [...prev.pages];
      newPages[pageIndex] = {
        ...newPages[pageIndex],
        annotations: newPages[pageIndex].annotations.filter((a) => a.id !== id),
        isModified: true,
      };
      return { ...prev, pages: newPages };
    });
    setIsDirty(true);
  }, []);

  const handleAddRedaction = useCallback(
    (pageIndex: number, redaction: OmniRedaction) => {
      setDocument((prev) => {
        const newPages = [...prev.pages];
        newPages[pageIndex] = {
          ...newPages[pageIndex],
          redactions: [...(newPages[pageIndex].redactions || []), redaction],
          isModified: true,
        };
        return { ...prev, pages: newPages };
      });
      setIsDirty(true);
    },
    []
  );

  const handleDeleteRedaction = useCallback((pageIndex: number, id: string) => {
    setDocument((prev) => {
      const newPages = [...prev.pages];
      newPages[pageIndex] = {
        ...newPages[pageIndex],
        redactions: (newPages[pageIndex].redactions || []).filter((r) => r.id !== id),
        isModified: true,
      };
      return { ...prev, pages: newPages };
    });
    setIsDirty(true);
  }, []);

  // -------------------------------------------------------------
  // Import Files (PDF + Images) & Scan Handlers
  // -------------------------------------------------------------
  const handleProcessPdfFile = async (file: File, password?: string, appendOnly = false) => {
    setIsProcessing(true);
    setProcessingMessage(`Parsing and indexing PDF document "${file.name}"...`);

    try {
      const imported = await importPDFFile(file, { password });
      recordHistorySnapshot(document);

      const importedDoc: OmniDocument = {
        id: `doc-${Date.now()}`,
        name: file.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pages: imported.pages,
        activePageIndex: 0,
        selectedPageIds: [],
        tags: ["Imported", "PDF"],
        isDirty: true,
        metadata: {
          title: (imported.metadata?.title as string) || file.name.replace(/\.[^/.]+$/, ""),
          author: (imported.metadata?.author as string) || "Titan Document Intelligence",
          subject: (imported.metadata?.subject as string) || "",
          keywords: (imported.metadata?.keywords as string) || "",
          creator: (imported.metadata?.creator as string) || "OmniScan Titan X Studio",
          producer: (imported.metadata?.producer as string) || "OmniScan PDF Engine",
          creationDate: (imported.metadata?.creationDate as string) || new Date().toISOString(),
          modificationDate: new Date().toISOString(),
          pdfAStandard: "PDF/A-2b",
        },
      };

      // Run content classification immediately on Page 1 only (which is already rendered)
      // Remaining pages are classified on-demand when rendered to avoid main thread freeze
      if (imported.pages[0] && !imported.pages[0].detectedContent) {
        try {
          const classification = await classifyImageContent(
            imported.pages[0].thumbnailDataUrl || imported.pages[0].originalDataUrl
          );
          imported.pages[0].detectedContent = classification;
          imported.pages[0].filters = { ...classification.recommendedFilters };
          imported.pages[0].filterSource = "auto-detected";
        } catch {}
      }

      setDocument((prev) => {
        // If previous doc was initial sample or empty, replace it; otherwise append
        const isSample =
          !appendOnly &&
          prev.name.includes("TITAN_Commercial_Contract_2026") &&
          prev.pages.length <= 4;

        if (isSample || prev.pages.length === 0) {
          // Free previous cached PDF document resources
          prev.pages.forEach((p) => {
            if (p.pdfDocId && p.pdfDocId !== importedDoc.pages[0]?.pdfDocId) {
              destroyPdfDocument(p.pdfDocId);
            }
          });
          return importedDoc;
        } else {
          const appendedPages = [
            ...prev.pages,
            ...imported.pages.map((p, idx) => ({
              ...p,
              pageNumber: prev.pages.length + idx + 1,
            })),
          ];
          return {
            ...prev,
            pages: appendedPages,
            updatedAt: new Date().toISOString(),
          };
        }
      });

      if (!appendOnly) {
        setActivePageIndex(0);
      }
      setIsDirty(true);
      setPasswordModalState({ isOpen: false, file: null });
    } catch (err: any) {
      console.error("PDF import error:", err);
      if (
        err?.name === "PasswordException" ||
        err?.message?.includes("Password") ||
        err?.message?.includes("password")
      ) {
        setPasswordModalState({
          isOpen: true,
          file: file,
          error: password ? "Incorrect password. Please try again." : undefined,
        });
      } else {
        alert(`Could not open PDF file "${file.name}":\n${err?.message || String(err)}`);
      }
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  };

  const handleProcessFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const pdfFiles: File[] = [];
    const docFiles: File[] = [];
    const imgFiles: File[] = [];

    for (const f of fileArray) {
      const analysis = analyzeFile(f);
      if (analysis.category === "pdf") {
        pdfFiles.push(f);
      } else if (analysis.category === "document") {
        docFiles.push(f);
      } else if (analysis.category === "image") {
        imgFiles.push(f);
      }
    }

    // 1. Handle PDF files sequentially with detailed batch progress
    if (pdfFiles.length > 0) {
      for (let i = 0; i < pdfFiles.length; i++) {
        const pdfFile = pdfFiles[i];
        setProcessingMessage(
          `Importing PDF ${i + 1} of ${pdfFiles.length}: "${pdfFile.name}"...`
        );
        await handleProcessPdfFile(pdfFile, undefined, i > 0);
      }
    }

    // 2. Handle Text & Office Documents (DOCX, TXT, RTF, DOC)
    if (docFiles.length > 0) {
      setIsProcessing(true);
      setProcessingMessage(`Importing ${docFiles.length} document(s)...`);

      const docPages: OmniPage[] = [];
      for (const docFile of docFiles) {
        try {
          const parsedPages = await parseDocumentFile(docFile);
          for (let pIdx = 0; pIdx < parsedPages.length; pIdx++) {
            const parsed = parsedPages[pIdx];
            let classification: ContentClassificationResult;
            try {
              classification = await classifyImageContent(parsed.dataUrl);
            } catch {
              classification = getFallbackClassification();
            }

            docPages.push({
              id: `doc-${Date.now()}-${docFile.name}-${pIdx}`,
              pageNumber: document.pages.length + docPages.length + 1,
              originalDataUrl: parsed.dataUrl,
              processedDataUrl: parsed.dataUrl,
              thumbnailDataUrl: parsed.dataUrl,
              width: parsed.width || 1200,
              height: parsed.height || 1600,
              dpi: 300,
              sizeBytes: docFile.size,
              isBlank: false,
              blankScore: 0,
              filters: { ...classification.recommendedFilters },
              detectedContent: classification,
              filterSource: "auto-detected",
              annotations: [],
              redactions: [],
              formFields: [],
              isModified: true,
              lastModifiedAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.error(`Error parsing document ${docFile.name}:`, err);
        }
      }

      if (docPages.length > 0) {
        recordHistorySnapshot(document);
        setDocument((prev) => ({
          ...prev,
          pages: [...prev.pages, ...docPages],
        }));
        setActivePageIndex(document.pages.length);
        setIsDirty(true);
      }

      setIsProcessing(false);
      setProcessingMessage("");
    }

    // 3. Handle Image files (JPG, PNG, WEBP, BMP, TIFF, GIF, SVG)
    if (imgFiles.length > 0) {
      setIsProcessing(true);
      setProcessingMessage(`Importing ${imgFiles.length} image(s)...`);

      const newPages: OmniPage[] = [];
      for (let i = 0; i < imgFiles.length; i++) {
        const file = imgFiles[i];
        let dataUrl: string;
        try {
          const decoded = await decodeImageFile(file);
          dataUrl = decoded.dataUrl;
        } catch {
          dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        }

        const img = new Image();
        img.src = dataUrl;
        await new Promise((res) => (img.onload = res));

        // Auto-classify content (Text Document vs Photo/ID Card vs Mixed Content)
        let classification: ContentClassificationResult;
        try {
          classification = await classifyImageContent(dataUrl);
        } catch {
          classification = getFallbackClassification();
        }

        newPages.push({
          id: `imp-${Date.now()}-${i}`,
          pageNumber: document.pages.length + newPages.length + 1,
          originalDataUrl: dataUrl,
          processedDataUrl: dataUrl,
          thumbnailDataUrl: dataUrl,
          width: img.width || 1200,
          height: img.height || 1600,
          dpi: 300,
          sizeBytes: file.size,
          isBlank: false,
          blankScore: 0,
          filters: { ...classification.recommendedFilters },
          detectedContent: classification,
          filterSource: "auto-detected",
          annotations: [],
          redactions: [],
          formFields: [],
          isModified: true,
          lastModifiedAt: new Date().toISOString(),
        });
      }

      if (newPages.length > 0) {
        recordHistorySnapshot(document);
        setDocument((prev) => ({
          ...prev,
          pages: [...prev.pages, ...newPages],
        }));
        setActivePageIndex(document.pages.length);
        setIsDirty(true);
      }

      setIsProcessing(false);
      setProcessingMessage("");
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await handleProcessFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Drag and Drop File Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleProcessFiles(e.dataTransfer.files);
    }
  };

  // Print Document (Native Print)
  const handlePrintDocument = useCallback(() => {
    if (document.pages.length === 0) {
      alert("No pages to print in current document.");
      return;
    }
    window.print();
  }, [document]);

  // Print File from Workspace (Native Print)
  const handlePrintFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = url;
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.print();
      }
      setTimeout(() => {
        URL.revokeObjectURL(url);
        iframe.remove();
      }, 60000);
    };
    document.body.appendChild(iframe);
  }, []);

  // Auto-Remove Blank Pages
  const handleRemoveBlankPages = useCallback(async () => {
    if (document.pages.length === 0) return;
    setIsProcessing(true);
    setProcessingMessage("Analyzing pages for blank sheets...");

    try {
      const blankIndices: number[] = [];
      for (let i = 0; i < document.pages.length; i++) {
        const page = document.pages[i];
        const analysis = await analyzeDataUrlBlankness(page.processedDataUrl || page.originalDataUrl);
        if (analysis.isBlank || analysis.score > 0.90) {
          blankIndices.push(i);
        }
      }

      if (blankIndices.length === 0) {
        alert("No blank pages were detected in this document.");
        return;
      }

      const confirmRemove = window.confirm(
        `Detected ${blankIndices.length} blank page(s) (Page number(s): ${blankIndices
          .map((i) => i + 1)
          .join(", ")}).\n\nDo you want to remove these blank pages from the document?`
      );

      if (confirmRemove) {
        recordHistorySnapshot(document);
        setDocument((prev) => {
          const remaining = prev.pages.filter((_, idx) => !blankIndices.includes(idx));
          return {
            ...prev,
            pages: remaining.map((p, idx) => ({ ...p, pageNumber: idx + 1 })),
            updatedAt: new Date().toISOString(),
          };
        });
        setActivePageIndex(0);
        setIsDirty(true);
      }
    } catch (err) {
      console.error("Blank page removal error:", err);
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  }, [document, recordHistorySnapshot]);

  const handleAcquireScanPages = useCallback((acquired: OmniPage[]) => {
    setDocument((prev) => ({
      ...prev,
      pages: [...prev.pages, ...acquired],
    }));
    setActivePageIndex((prev) => prev);
    setIsDirty(true);
  }, []);

  // -------------------------------------------------------------
  // Export PDF/A & Save Project
  // -------------------------------------------------------------
  const handleExportPdf = useCallback(async () => {
    setIsProcessing(true);
    setProcessingMessage("Generating Validated PDF/A Document Package...");

    try {
      const pdfBytes = await exportDocumentToPDF(document, {
        pdfAStandard: document.metadata.pdfAStandard || "PDF/A-2b",
        embedSearchableTextLayer: true,
        destructiveRedaction: true,
      });

      // Download PDF
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${document.name.replace(/\.[^/.]+$/, "")}_ARCHIVAL_PDFA.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF Export error:", err);
      alert("Failed to export PDF: " + String(err));
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  }, [document]);

  const handleSaveProject = useCallback(async () => {
    setIsProcessing(true);
    setProcessingMessage("Packaging Titan Project Archive (.titanproj)...");

    try {
      const zipBlob = await packageTitanProject(document);
      const url = URL.createObjectURL(zipBlob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${document.name.replace(/\.[^/.]+$/, "")}.titanproj`;
      a.click();
      URL.revokeObjectURL(url);
      setIsDirty(false);
    } catch (err) {
      console.error("Project Save error:", err);
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  }, [document]);

  const handleOpenProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingMessage("Unpacking Titan Project...");

    try {
      const restored = await extractTitanProject(file);
      setDocument(restored);
      setActivePageIndex(0);
      setIsDirty(false);
    } catch (err) {
      console.error(err);
      alert("Invalid .titanproj archive");
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
      if (projectInputRef.current) projectInputRef.current.value = "";
    }
  };

  // -------------------------------------------------------------
  // Batch Execution Handler
  // -------------------------------------------------------------
  const handleExecuteBatch = async (config: BatchConfig) => {
    for (let i = 0; i < document.pages.length; i++) {
      if (config.autoDeskew) {
        await handleAutoDeskew(i);
      }
      if (config.autoCrop) {
        await handleAutoCrop(i);
      }
      if (config.executeOcr) {
        await handleRunOcr(config.ocrLanguage, i);
      }
    }
    setIsBatchModalOpen(false);
  };

  // -------------------------------------------------------------
  // Centralized Application Keyboard Shortcut Registration
  // -------------------------------------------------------------
  const { registerAction } = useShortcuts();

  useEffect(() => {
    const unregisterFns = [
      registerAction("file.open", () => fileInputRef.current?.click()),
      registerAction("file.save", handleSaveProject),
      registerAction("file.export", handleExportPdf),
      registerAction("file.print", handlePrintDocument),
      registerAction("edit.undo", handleUndo),
      registerAction("edit.redo", handleRedo),
      registerAction("view.commandPalette", () => setIsCommandPaletteOpen((prev) => !prev)),
      registerAction("view.keyboardShortcuts", () => setIsKeyboardShortcutsModalOpen((prev) => !prev)),
      registerAction("view.zoomIn", () => setZoom((prev) => Math.min(3.0, Number((prev + 0.1).toFixed(2))))),
      registerAction("view.zoomOut", () => setZoom((prev) => Math.max(0.2, Number((prev - 0.1).toFixed(2))))),
      registerAction("view.resetZoom", () => setZoom(1.0)),
      registerAction("view.fitWidth", () => setZoom(1.0)),
      registerAction("page.next", () =>
        setActivePageIndex((prev) => Math.min(document.pages.length - 1, prev + 1))
      ),
      registerAction("page.prev", () =>
        setActivePageIndex((prev) => Math.max(0, prev - 1))
      ),
      registerAction("page.first", () => setActivePageIndex(0)),
      registerAction("page.last", () =>
        setActivePageIndex(Math.max(0, document.pages.length - 1))
      ),
      registerAction("page.delete", () => handleDeletePage(activePageIndex)),
      registerAction("page.rotateCw", () => handleRotateActivePage(90)),
      registerAction("page.rotateCcw", () => handleRotateActivePage(-90)),
      registerAction("page.duplicate", () => handleDuplicatePage(activePageIndex)),
      registerAction("tool.select", () => setActiveTool("select")),
      registerAction("tool.hand", () => setActiveTool("hand")),
      registerAction("tool.crop", () => setActiveTool("crop")),
      registerAction("tool.filters", () => setIsFilterStudioModalOpen(true)),
      registerAction("tool.deskew", () => handleAutoDeskew()),
      registerAction("tool.autocrop", () => handleAutoCrop()),
      registerAction("tool.ocr", () => handleRunOcr("eng")),
      registerAction("studio.photoPrint", () => setIsPhotoPrintStudioModalOpen(true)),
      registerAction("studio.idCard", () => {
        setIdCardStudioInitialMode("idcard");
        setIsIdCardStudioModalOpen(true);
      }),
      registerAction("studio.a6HalfCard", () => {
        setIdCardStudioInitialMode("a6");
        setIsIdCardStudioModalOpen(true);
      }),
      registerAction("studio.batch", () => setIsBatchModalOpen(true)),
      registerAction("studio.compare", () => setIsCompareModalOpen(true)),
      registerAction("studio.converter", () => setIsWorkspaceModalOpen(true)),
      registerAction("studio.split", () => setIsSplitPdfModalOpen(true)),
      registerAction("app.help", () => setIsKeyboardShortcutsModalOpen(true)),
    ];

    return () => {
      unregisterFns.forEach((fn) => fn());
    };
  }, [
    document.pages.length,
    activePageIndex,
    handleSaveProject,
    handleExportPdf,
    handlePrintDocument,
    handleUndo,
    handleRedo,
    handleDeletePage,
    handleRotateActivePage,
    handleDuplicatePage,
    handleAutoDeskew,
    handleAutoCrop,
    handleRunOcr,
    registerAction,
  ]);

  // -------------------------------------------------------------
  // Command Palette Items
  // -------------------------------------------------------------
  const commandItems = [
    {
      id: "cmd-scan",
      title: "Acquire Scan (Hardware / Camera)",
      category: "Scan",
      icon: <Scan className="w-4 h-4" />,
      shortcut: "Ctrl+N",
      action: () => setIsScanModalOpen(true),
    },
    {
      id: "cmd-import",
      title: "Import PDF or Image Files",
      category: "File",
      icon: <FolderOpen className="w-4 h-4" />,
      shortcut: "Ctrl+O",
      action: () => fileInputRef.current?.click(),
    },
    {
      id: "cmd-export",
      title: "Export Validated PDF/A Archival",
      category: "File",
      icon: <Download className="w-4 h-4" />,
      shortcut: "Ctrl+E",
      action: handleExportPdf,
    },
    {
      id: "cmd-save",
      title: "Save Project (.titanproj)",
      category: "File",
      icon: <Save className="w-4 h-4" />,
      shortcut: "Ctrl+S",
      action: handleSaveProject,
    },
    {
      id: "cmd-deskew",
      title: "Auto-Deskew & Align Orientation",
      category: "CV Lab",
      icon: <Wand2 className="w-4 h-4" />,
      action: () => handleAutoDeskew(),
    },
    {
      id: "cmd-crop",
      title: "Auto-Detect Document Margins",
      category: "CV Lab",
      icon: <Crop className="w-4 h-4" />,
      action: () => handleAutoCrop(),
    },
    {
      id: "cmd-ocr",
      title: "Execute Multi-Language OCR",
      category: "OCR",
      icon: <FileSearch className="w-4 h-4" />,
      action: () => handleRunOcr("eng"),
    },
    {
      id: "cmd-intel",
      title: "Analyze Semantic Document Intelligence",
      category: "Intelligence",
      icon: <Sparkles className="w-4 h-4" />,
      action: () => handleAnalyzeIntelligence(),
    },
    {
      id: "cmd-filters",
      title: "CamScanner Document Filter Studio (16 Presets)",
      category: "Filters",
      icon: <Palette className="w-4 h-4" />,
      action: () => setIsFilterStudioModalOpen(true),
    },
    {
      id: "cmd-photo-print",
      title: "4×6\" Photo Print Studio & Passport Layout",
      category: "Print",
      icon: <Printer className="w-4 h-4" />,
      action: () => setIsPhotoPrintStudioModalOpen(true),
    },
    {
      id: "cmd-idcard-print",
      title: "ID Card / CNIC Print Studio (A4 Multi-Copy Layout)",
      category: "Print",
      icon: <CreditCard className="w-4 h-4" />,
      action: () => {
        setIdCardStudioInitialMode("idcard");
        setIsIdCardStudioModalOpen(true);
      },
    },
    {
      id: "cmd-workspace-converter",
      title: "All-in-One Document Workspace & File Converter (Merge, Split, Word, Excel, PPT, Image)",
      category: "Tools",
      icon: <Layers className="w-4 h-4 text-sky-400" />,
      action: () => setIsWorkspaceModalOpen(true),
    },
    {
      id: "cmd-a6-halfcard-print",
      title: "A6 Half-Card Layout Studio (74×105mm)",
      category: "Print",
      icon: <Layers className="w-4 h-4 text-indigo-400" />,
      action: () => {
        setIdCardStudioInitialMode("a6");
        setIsIdCardStudioModalOpen(true);
      },
    },
    {
      id: "cmd-batch",
      title: "Open Batch Automation Studio",
      category: "Batch",
      icon: <Layers className="w-4 h-4" />,
      action: () => setIsBatchModalOpen(true),
    },
    {
      id: "cmd-compare",
      title: "Compare Documents & Visual Diff",
      category: "Tools",
      icon: <SplitSquareVertical className="w-4 h-4" />,
      action: () => setIsCompareModalOpen(true),
    },
    {
      id: "cmd-security",
      title: "Security, Redaction & AES Encryption",
      category: "Security",
      icon: <ShieldCheck className="w-4 h-4" />,
      action: () => setIsSecurityModalOpen(true),
    },
    {
      id: "cmd-diagnostics",
      title: "System Diagnostics & Memory Telemetry",
      category: "Tools",
      icon: <Activity className="w-4 h-4" />,
      action: () => setIsDiagnosticsOpen(true),
    },
    {
      id: "cmd-rotate-cw",
      title: "Rotate Page 90° Clockwise",
      category: "Page",
      icon: <RotateCw className="w-4 h-4" />,
      action: () => handleRotateActivePage(90),
    },
    {
      id: "cmd-add-blank",
      title: "Insert Blank Page",
      category: "Page",
      icon: <Plus className="w-4 h-4" />,
      action: handleAddBlankPage,
    },
    {
      id: "cmd-del-page",
      title: "Delete Active Page",
      category: "Page",
      icon: <Trash2 className="w-4 h-4" />,
      action: () => handleDeletePage(activePageIndex),
    },
  ];

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col h-screen w-screen bg-neutral-950 text-neutral-100 font-sans overflow-hidden select-none relative"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-sky-950/80 backdrop-blur-md border-4 border-dashed border-sky-400 flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-150">
          <div className="p-6 rounded-2xl bg-neutral-900/90 border border-sky-500/50 shadow-2xl flex flex-col items-center space-y-3 text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center animate-bounce">
              <FolderOpen className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Drop PDF, Images, or Documents</h3>
            <p className="text-xs text-neutral-400">
              Supports PDF, JPG, PNG, WEBP, BMP, TIFF, SVG, DOCX, TXT, RTF into your active session
            </p>
          </div>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_ALL_SUPPORTED}
        onChange={handleFileImport}
        className="hidden"
      />
      <input
        ref={projectInputRef}
        type="file"
        accept=".titanproj,.zip"
        onChange={handleOpenProject}
        className="hidden"
      />

      {/* Top Application Header & Menu Bar */}
      <HeaderBar
        documentName={document.name}
        theme={theme}
        language={language}
        viewMode={viewMode}
        isProcessing={isProcessing}
        isDirty={isDirty}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        activeTool={activeTool}
        onSetActiveTool={setActiveTool}
        onThemeChange={setTheme}
        onLanguageChange={setLanguage}
        onViewModeChange={setViewMode}
        onOpenScanModal={() => setIsScanModalOpen(true)}
        onImportFile={() => fileInputRef.current?.click()}
        onExportPdf={handleExportPdf}
        onSaveProject={handleSaveProject}
        onOpenProject={() => projectInputRef.current?.click()}
        onRunOcr={() => handleRunOcr("eng")}
        onAutoDeskew={() => handleAutoDeskew()}
        onAutoCrop={() => handleAutoCrop()}
        onAutoEnhance={() => handleAutoEnhanceActivePage()}
        onAutoEnhanceAll={handleAutoEnhanceAllPages}
        onOpenCropMode={() => setActiveTool("crop")}
        onOpenFilterStudio={() => setIsFilterStudioModalOpen(true)}
        onOpenPhotoPrintStudio={() => setIsPhotoPrintStudioModalOpen(true)}
        onOpenIdCardStudio={() => {
          setIdCardStudioInitialMode("idcard");
          setIsIdCardStudioModalOpen(true);
        }}
        onOpenDocumentConverter={() => setIsWorkspaceModalOpen(true)}
        onOpenBatchStudio={() => setIsBatchModalOpen(true)}
        onOpenCompare={() => setIsCompareModalOpen(true)}
        onOpenSecurity={() => setIsSecurityModalOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenKeyboardShortcuts={() => setIsKeyboardShortcutsModalOpen(true)}
        onAnalyzeIntelligence={() => handleAnalyzeIntelligence()}
        onRotateActivePage={(deg) => handleRotateActivePage(deg)}
        onDeleteActivePage={() => handleDeletePage(activePageIndex)}
        onDuplicateActivePage={() => handleDuplicatePage(activePageIndex)}
        onAddBlankPage={handleAddBlankPage}
        onOpenSplitPdf={() => setIsSplitPdfModalOpen(true)}
        onPrintDocument={handlePrintDocument}
        onRemoveBlankPages={handleRemoveBlankPages}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* Main Workspace (3-Column Layout: Navigator | Canvas | Inspector) */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Page Navigator */}
        <PageNavigator
          pages={document.pages}
          activePageIndex={activePageIndex}
          selectedPageIds={selectedPageIds}
          isCollapsed={isLeftCollapsed}
          onToggleCollapse={() => setIsLeftCollapsed(!isLeftCollapsed)}
          onSelectPage={handleSelectPage}
          onMovePage={handleMovePage}
          onDuplicatePage={handleDuplicatePage}
          onDeletePage={handleDeletePage}
          onRotatePage={(idx, deg) => handleRotateActivePage(deg, idx)}
          onAutoDeskewPage={(idx) => handleAutoDeskew(idx)}
          onAddBlankPage={handleAddBlankPage}
        />

        {/* Center Document Canvas */}
        <DocumentCanvas
          pages={document.pages}
          activePageIndex={activePageIndex}
          viewMode={viewMode}
          activeTool={activeTool}
          zoom={zoom}
          document={{ ...document, selectedPageIds }}
          activePagePreviewUrl={activePagePreviewUrl}
          onZoomChange={setZoom}
          onSelectPage={handleSelectPage}
          onAddAnnotation={handleAddAnnotation}
          onAddRedaction={handleAddRedaction}
          onDeleteAnnotation={handleDeleteAnnotation}
          onDeleteRedaction={handleDeleteRedaction}
          onSetActiveTool={setActiveTool}
          onOpenScanModal={() => setIsScanModalOpen(true)}
          onImportFiles={() => fileInputRef.current?.click()}
          onAddBlankPage={handleAddBlankPage}
          onOpenPhotoPrintStudio={() => setIsPhotoPrintStudioModalOpen(true)}
          onApplyPageCrop={handleApplyPageCrop}
        />

        {/* Right Inspector Panel */}
        <InspectorPanel
          activePage={activePage}
          document={document}
          language={language}
          isCollapsed={isRightCollapsed}
          isProcessing={isProcessing}
          onToggleCollapse={() => setIsRightCollapsed(!isRightCollapsed)}
          onUpdateFilters={handleUpdateFilters}
          onResetFilters={handleResetFilters}
          onAutoDeskew={() => handleAutoDeskew()}
          onAutoCrop={() => handleAutoCrop()}
          onAutoEnhance={() => handleAutoEnhanceActivePage()}
          onAutoEnhanceAll={handleAutoEnhanceAllPages}
          onOpenCropMode={() => setActiveTool("crop")}
          onOpenFilterStudio={() => setIsFilterStudioModalOpen(true)}
          onOpenPhotoPrintStudio={() => setIsPhotoPrintStudioModalOpen(true)}
          onRunOcr={(lang) => handleRunOcr(lang)}
          onUpdateOcrText={handleUpdateOcrText}
          onAnalyzeIntelligence={() => handleAnalyzeIntelligence()}
          onAutoRedactPII={handleAutoRedactPII}
          onUpdateMetadata={(meta) => {
            setDocument((prev) => ({
              ...prev,
              metadata: { ...prev.metadata, ...meta },
            }));
            setIsDirty(true);
          }}
          onExportPdf={handleExportPdf}
          onApplyToAllPages={handleApplyFiltersToAllPages}
          onReDetectContent={handleReDetectActivePageContent}
        />
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        activePage={activePage}
        activePageIndex={activePageIndex}
        totalPages={document.pages.length}
        zoom={zoom}
        isProcessing={isProcessing}
        processingMessage={processingMessage}
        language={language}
        onZoomChange={setZoom}
        onFitWidth={() => setZoom(0.85)}
        onFitPage={() => setZoom(1.0)}
        onActualSize={() => setZoom(1.0)}
      />

      {/* Modals & Dialogs */}
      <ScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onPagesAcquired={handleAcquireScanPages}
      />

      <BatchStudioModal
        isOpen={isBatchModalOpen}
        pages={document.pages}
        onClose={() => setIsBatchModalOpen(false)}
        onExecuteBatch={handleExecuteBatch}
        onAddFiles={handleProcessFiles}
      />

      <DocumentCompareModal
        isOpen={isCompareModalOpen}
        pages={document.pages}
        onClose={() => setIsCompareModalOpen(false)}
      />

      <SecurityModal
        isOpen={isSecurityModalOpen}
        document={document}
        onClose={() => setIsSecurityModalOpen(false)}
        onApplySanitization={async () => {
          await handleExportPdf();
        }}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commandItems}
      />

      <KeyboardShortcutsModal
        isOpen={isKeyboardShortcutsModalOpen}
        onClose={() => setIsKeyboardShortcutsModalOpen(false)}
      />

      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        document={document}
        onClose={() => setIsDiagnosticsOpen(false)}
      />

      {/* CamScanner Advanced Filter Studio Modal */}
      {activePage && isFilterStudioModalOpen && (
        <CamScannerFilterModal
          page={activePage}
          pageIndex={activePageIndex}
          totalPages={document.pages.length}
          isOpen={isFilterStudioModalOpen}
          onClose={() => setIsFilterStudioModalOpen(false)}
          onApplyFilters={handleApplyCamScannerFilters}
        />
      )}

      {/* 4x6 Photo Print & Passport Studio Modal */}
      {isPhotoPrintStudioModalOpen && (
        <PhotoPrintStudioModal
          pages={document.pages}
          activePageIndex={activePageIndex}
          isOpen={isPhotoPrintStudioModalOpen}
          onClose={() => setIsPhotoPrintStudioModalOpen(false)}
          onInsertIntoDocument={handleInsertPhotoPage}
          onOpenScanModal={() => setIsScanModalOpen(true)}
        />
      )}

      {/* ID Card / CNIC Print Studio Modal (Includes A6 Half-Card Layout Mode) */}
      {isIdCardStudioModalOpen && (
        <IdCardPrintStudioModal
          pages={document.pages}
          activePageIndex={activePageIndex}
          isOpen={isIdCardStudioModalOpen}
          initialMode={idCardStudioInitialMode}
          onClose={() => {
            setIsIdCardStudioModalOpen(false);
            setIdCardStudioInitialMode("idcard");
          }}
          onInsertIntoDocument={(newPageUrls) => {
            newPageUrls.forEach((dataUrl) => {
              handleInsertPhotoPage(dataUrl);
            });
          }}
        />
      )}

      {/* Split PDF Studio Modal */}
      <SplitPdfModal
        isOpen={isSplitPdfModalOpen}
        document={document}
        onClose={() => setIsSplitPdfModalOpen(false)}
      />

      {/* All-in-One Document Workspace & File Converter Suite */}
      {isWorkspaceModalOpen && (
        <DocumentWorkspaceModal
          isOpen={isWorkspaceModalOpen}
          onClose={() => setIsWorkspaceModalOpen(false)}
          onOpenInPdfStudio={async (file) => {
            await handleProcessPdfFile(file);
            setIsWorkspaceModalOpen(false);
          }}
          onOpenInImageEditor={(_dataUrl) => {
            setIsWorkspaceModalOpen(false);
            setIsFilterStudioModalOpen(true);
          }}
          onOpenInPassportStudio={(_file) => {
            setIsWorkspaceModalOpen(false);
            setIsPhotoPrintStudioModalOpen(true);
          }}
          onOpenInIdCardStudio={(_file) => {
            setIsWorkspaceModalOpen(false);
            setIdCardStudioInitialMode("idcard");
            setIsIdCardStudioModalOpen(true);
          }}
          onPrintDocument={handlePrintFile}
        />
      )}

      {/* Password Protected PDF Decryption Modal */}
      <PasswordModal
        isOpen={passwordModalState.isOpen}
        fileName={passwordModalState.file?.name || "Encrypted Document.pdf"}
        errorMessage={passwordModalState.error}
        onClose={() => setPasswordModalState({ isOpen: false, file: null })}
        onSubmitPassword={async (password) => {
          if (passwordModalState.file) {
            await handleProcessPdfFile(passwordModalState.file, password);
          }
        }}
      />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-12 right-6 z-50 flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-neutral-900/95 border border-sky-500/60 text-white shadow-2xl text-xs font-medium backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <ShortcutProvider>
      <AppContent />
    </ShortcutProvider>
  );
}

export default App;
