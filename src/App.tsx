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
  PerspectiveQuad,
  PerspectivePreset,
} from "./types";
import { createInitialSampleDocument } from "./data/sampleDocuments";
import {
  processImagePipeline,
  calculateRadonDeskewAngle,
  detectDocumentBoundingBox,
  analyzeDataUrlBlankness,
  DEFAULT_FILTERS,
  clearDecodedImageCache,
} from "./engine/vision";
import {
  warpPagePerspective,
  PERSPECTIVE_PRESETS,
} from "./engine/perspectiveEngine";
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
import { executePhysicalPageCrop, NormalizedCropBox, detectAutoCropBounds } from "./engine/cropEngine";
import { rotatePagePhysical } from "./engine/rotationEngine";
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
import { StressTestModal } from "./components/diagnostics/StressTestModal";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { ToastContainer } from "./components/common/ToastContainer";
import { toast } from "./services/toast/toastService";
import { CamScannerFilterModal } from "./components/filters/CamScannerFilterModal";
import { PhotoPrintStudioModal } from "./components/photo/PhotoPrintStudioModal";
import { IdCardPrintStudioModal } from "./components/idcard/IdCardPrintStudioModal";
import { DocumentWorkspaceModal } from "./components/converter/DocumentWorkspaceModal";
import { PasswordModal } from "./components/modals/PasswordModal";
import { migrateLegacyLocalStorageSecrets } from "./engine/background/BackgroundRemovalService";
import { SplitPdfModal } from "./components/modals/SplitPdfModal";
import { ShortcutProvider, useShortcuts } from "./commands/ShortcutContext";
import { KeyboardShortcutsModal } from "./components/command/KeyboardShortcutsModal";
import { AutoFeaturesSettingsModal } from "./components/settings/AutoFeaturesSettingsModal";
import { getAutoFeatureSettings } from "./services/settings/autoFeatureSettings";
import { executeFilterPipeline } from "./engine/filters";
import { isRTL } from "./engine/i18n";
import { analyzeFile, ACCEPT_ALL_SUPPORTED } from "./services/upload/FileTypeRegistry";
import { parseDocumentFile, decodeImageFile } from "./services/upload/DocumentImportService";
import { pageBlobStore } from "./services/storage/PageBlobStore";
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
  Zap,
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
        creator: "OmniScan Pro Ultra",
        producer: "Titan X Professional PDF Kernel",
        creationDate: new Date().toISOString(),
        modificationDate: new Date().toISOString(),
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
  const [isAutoFeaturesModalOpen, setIsAutoFeaturesModalOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [isStressTestModalOpen, setIsStressTestModalOpen] = useState<boolean>(false);
  const [isFilterStudioModalOpen, setIsFilterStudioModalOpen] = useState<boolean>(false);
  const [isPhotoPrintStudioModalOpen, setIsPhotoPrintStudioModalOpen] = useState<boolean>(false);
  const [isIdCardStudioModalOpen, setIsIdCardStudioModalOpen] = useState<boolean>(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState<boolean>(false);
  const [idCardStudioInitialMode, setIdCardStudioInitialMode] = useState<"idcard" | "a6">("idcard");
  const [isSplitPdfModalOpen, setIsSplitPdfModalOpen] = useState<boolean>(false);
  const [blankRemovalConfirm, setBlankRemovalConfirm] = useState<{
    isOpen: boolean;
    blankIndices: number[];
  } | null>(null);
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

  // One-time security migration: remove any legacy plaintext API keys from localStorage
  useEffect(() => {
    migrateLegacyLocalStorageSecrets();
  }, []);

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
      if (isCancelled) return;
      if (!rendered) {
        // Fallback: clear pending render to unblock UI
        setDocument((prev) => ({
          ...prev,
          pages: prev.pages.map((p) =>
            p.id === activePage.id ? { ...p, isPendingRender: false } : p
          ),
        }));
        return;
      }

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
      // Guarantee that pending state is reset so user is never stuck in loading screen
      setDocument((prev) => ({
        ...prev,
        pages: prev.pages.map((p) =>
          p.id === activePage.id ? { ...p, isPendingRender: false } : p
        ),
      }));
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
              const origUrl = pg.originalDataUrl || (await pageBlobStore.resolvePageUrl(pg, "original"));
              const { processedDataUrl } = await executeFilterPipeline(origUrl, newFilters);
              const thumb = (await pageBlobStore.generateThumbnail(processedDataUrl, 240)) || processedDataUrl;
              let processedBlobId = pg.processedBlobId;
              let finalProcessedUrl = processedDataUrl;
              if (pg.originalBlobId || pg.processedBlobId) {
                processedBlobId = await pageBlobStore.saveDataUrl(pg.id, "processed", processedDataUrl);
                finalProcessedUrl = "";
              }
              return {
                ...pg,
                filters: { ...newFilters },
                processedBlobId,
                processedDataUrl: finalProcessedUrl,
                thumbnailDataUrl: thumb,
                isModified: true,
                lastModifiedAt: new Date().toISOString(),
              };
            })
          );
          setDocument((prev) => ({ ...prev, pages: updatedPages, updatedAt: new Date().toISOString() }));
        } else {
          const target = document.pages[targetIdx];
          if (target) {
            const origUrl = target.originalDataUrl || (await pageBlobStore.resolvePageUrl(target, "original"));
            const { processedDataUrl } = await executeFilterPipeline(origUrl, newFilters);
            const thumb = (await pageBlobStore.generateThumbnail(processedDataUrl, 240)) || processedDataUrl;
            let processedBlobId = target.processedBlobId;
            let finalProcessedUrl = processedDataUrl;
            if (target.originalBlobId || target.processedBlobId) {
              processedBlobId = await pageBlobStore.saveDataUrl(target.id, "processed", processedDataUrl);
              finalProcessedUrl = "";
            }
            setDocument((prev) => {
              const newPages = [...prev.pages];
              newPages[targetIdx] = {
                ...newPages[targetIdx],
                filters: { ...newFilters },
                processedBlobId,
                processedDataUrl: finalProcessedUrl,
                thumbnailDataUrl: thumb,
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
      let isMounted = true;
      const loadSourceImage = async () => {
        const srcUrl =
          activePage.originalDataUrl ||
          (await pageBlobStore.resolvePageUrl(activePage, "original"));
        if (!isMounted || !srcUrl) return;

        if (
          !cachedSourceImageRef.current ||
          cachedSourceImageRef.current.pageId !== activePage.id ||
          cachedSourceImageRef.current.sourceUrl !== srcUrl
        ) {
          const img = new Image();
          img.onload = () => {
            if (isMounted && activePageRef.current?.id === activePage.id) {
              cachedSourceImageRef.current = {
                pageId: activePage.id,
                sourceUrl: srcUrl,
                image: img,
              };
            }
          };
          img.src = srcUrl;
          if (img.complete && img.naturalWidth > 0) {
            cachedSourceImageRef.current = {
              pageId: activePage.id,
              sourceUrl: srcUrl,
              image: img,
            };
          }
        }
      };
      loadSourceImage();
      return () => {
        isMounted = false;
      };
    } else {
      cachedSourceImageRef.current = null;
      setActivePagePreviewUrl(null);
    }
  }, [
    activePage?.id,
    activePage?.originalDataUrl,
    activePage?.originalBlobId,
    activePage?.lastModifiedAt,
  ]);

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

      const sourceUrl =
        page.originalDataUrl ||
        (await pageBlobStore.resolvePageUrl(page, "original"));

      const result = await processImagePipeline(
        sourceUrl,
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
        let commitThumbnail = result.thumbnailDataUrl;
        if (!commitThumbnail || commitThumbnail.length > 32768) {
          commitThumbnail = (await pageBlobStore.generateThumbnail(result.processedDataUrl, 240)) || result.processedDataUrl;
        }

        let processedBlobId = page.processedBlobId;
        let finalProcessedUrl = result.processedDataUrl;
        if (page.originalBlobId || page.processedBlobId) {
          processedBlobId = await pageBlobStore.saveDataUrl(targetPageId, "processed", result.processedDataUrl);
          finalProcessedUrl = "";
        }

        setDocument((prev) => {
          const newPages = [...prev.pages];
          const pageIdx = newPages.findIndex((p) => p.id === targetPageId);
          if (pageIdx === -1) {
            return prev;
          }
          newPages[pageIdx] = {
            ...newPages[pageIdx],
            filters: filtersToRun,
            processedBlobId,
            processedDataUrl: finalProcessedUrl,
            thumbnailDataUrl: commitThumbnail,
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
      toast.success(
        `Auto-Optimized (${typeLabel} +${qualityDelta} pts): ${corrections}`
      );
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

      const settings = getAutoFeatureSettings();
      if (!settings.colorEnhance.enabled) {
        toast.info("Auto Color Enhancement is disabled in Auto Features settings.");
        return;
      }

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
        toast.success(
          `Auto-Optimized (${typeLabel} +${qualityDelta} pts): ${corrections}`
        );
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
      toast.success(`Successfully optimized all ${document.pages.length} pages adaptively.`);
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

    toast.success(`Successfully applied adjustments to all ${pageCount} pages.`);
  }, [activePage, document, recordHistorySnapshot]);

  // -------------------------------------------------------------
  // Auto Deskew & Auto Crop
  // -------------------------------------------------------------
  const handleAutoDeskew = useCallback(
    async (pageIdx = activePageIndex) => {
      const page = document.pages[pageIdx];
      if (!page) return;

      const settings = getAutoFeatureSettings();
      if (!settings.deskew.enabled) {
        toast.info("Auto Deskew is disabled in Auto Features settings.");
        return;
      }

      recordHistorySnapshot(document);
      setIsProcessing(true);
      setProcessingMessage("Running Ensemble Deskew (Radon + Hough + Run-Length)...");

      try {
        const sourceUrl = page.originalDataUrl || (await pageBlobStore.resolvePageUrl(page, "original"));
        const angle = await calculateRadonDeskewAngle(sourceUrl);

        if (Math.abs(angle) < 0.2) {
          toast.success(`Page ${pageIdx + 1} is already perfectly aligned (residual skew < 0.2°).`);
          return;
        }

        const newFilters = { ...page.filters, deskewAngle: Number(angle.toFixed(2)) };
        const { processedDataUrl } = await processImagePipeline(sourceUrl, newFilters);
        const thumb = (await pageBlobStore.generateThumbnail(processedDataUrl, 240)) || processedDataUrl;

        let processedBlobId = page.processedBlobId;
        let finalProcessedUrl = processedDataUrl;
        if (page.originalBlobId || page.processedBlobId) {
          processedBlobId = await pageBlobStore.saveDataUrl(page.id, "processed", processedDataUrl);
          finalProcessedUrl = "";
        }

        setDocument((prev) => {
          const newPages = [...prev.pages];
          newPages[pageIdx] = {
            ...newPages[pageIdx],
            filters: newFilters,
            processedBlobId,
            processedDataUrl: finalProcessedUrl,
            thumbnailDataUrl: thumb,
            isModified: true,
          };
          return { ...prev, pages: newPages, updatedAt: new Date().toISOString() };
        });

        if (pageIdx === activePageIndex) {
          latestFiltersRef.current = { ...newFilters };
        }

        setIsDirty(true);
        toast.success(`Deskewed Page ${pageIdx + 1} by ${angle > 0 ? "+" : ""}${angle.toFixed(2)}° (Ensemble Hough/Radon). Press Ctrl+Z to undo.`);
      } catch (err) {
        console.error("Auto deskew error:", err);
        toast.error("Auto deskew encountered an issue.");
      } finally {
        setIsProcessing(false);
        setProcessingMessage("");
      }
    },
    [document, activePageIndex, recordHistorySnapshot]
  );

  const handleAutoCrop = useCallback(
    async (pageIdx = activePageIndex) => {
      const page = document.pages[pageIdx];
      if (!page) return;

      const settings = getAutoFeatureSettings();
      if (!settings.edgeDetection.enabled) {
        toast.info("Auto Edge Detection is disabled in Auto Features settings.");
        return;
      }

      recordHistorySnapshot(document);
      setIsProcessing(true);
      setProcessingMessage("Detecting 7-pass document boundary contours...");

      try {
        const sourceUrl = page.originalDataUrl || (await pageBlobStore.resolvePageUrl(page, "original"));
        const cropBox = await detectAutoCropBounds(sourceUrl);

        // Check if detected crop actually isolates a boundary (not full frame)
        const isMeaningfulCrop =
          cropBox.x > 0.015 ||
          cropBox.y > 0.015 ||
          cropBox.width < 0.985 ||
          cropBox.height < 0.985;

        if (!isMeaningfulCrop) {
          toast.success(`Page ${pageIdx + 1} margins are already optimal.`);
          return;
        }

        // Physically crop page with lossless geometry transform
        const croppedPage = await executePhysicalPageCrop(page, cropBox);

        setDocument((prev) => {
          const newPages = [...prev.pages];
          newPages[pageIdx] = croppedPage;
          return { ...prev, pages: newPages, updatedAt: new Date().toISOString() };
        });

        setIsDirty(true);
        toast.success(`Auto-cropped Page ${pageIdx + 1} (${(cropBox.width * 100).toFixed(0)}% × ${(cropBox.height * 100).toFixed(0)}% frame). Press Ctrl+Z to undo.`);
      } catch (err) {
        console.error("Auto crop error:", err);
        toast.error("Auto crop encountered an issue.");
      } finally {
        setIsProcessing(false);
        setProcessingMessage("");
      }
    },
    [document, activePageIndex, recordHistorySnapshot]
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

  const handleApplyPerspectiveWarp = useCallback(
    async (
      quad: PerspectiveQuad,
      preset: PerspectivePreset = "natural",
      fineDeskew: boolean = false,
      scope: "current" | "selected" | "all" = "current"
    ) => {
      console.log("[App] handleApplyPerspectiveWarp invoked with quad:", JSON.stringify(quad), {
        preset,
        fineDeskew,
        scope,
      });
      recordHistorySnapshot(document);
      setIsProcessing(true);
      setProcessingMessage(
        scope === "all"
          ? `De-warping and flattening all ${document.pages.length} pages...`
          : scope === "selected"
          ? `De-warping ${selectedPageIds.length} selected pages...`
          : `De-warping page ${activePageIndex + 1}...`
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

        const presetDef = PERSPECTIVE_PRESETS.find((p) => p.id === preset);
        const targetAspectRatio = presetDef?.aspectRatio ?? null;

        const newPages = [...document.pages];
        for (const idx of targetIndices) {
          const pageToWarp = newPages[idx];
          if (pageToWarp) {
            const warpedPage = await warpPagePerspective(pageToWarp, quad, {
              targetAspectRatio,
              targetPreset: preset,
              fineDeskew,
            });

            try {
              const warpedUrl =
                warpedPage.originalDataUrl ||
                warpedPage.processedDataUrl ||
                (await pageBlobStore.resolvePageUrl(warpedPage, "original")) ||
                (await pageBlobStore.resolvePageUrl(warpedPage, "processed"));

              if (warpedUrl) {
                const classification = await classifyImageContent(warpedUrl);
                warpedPage.detectedContent = classification;
                warpedPage.filters = {
                  ...warpedPage.filters,
                  ...classification.recommendedFilters,
                  rotation: 0,
                  deskewAngle: 0,
                  cropBox: undefined,
                };
                warpedPage.filterSource = "auto-detected";
              }
              if (idx === activePageIndex) {
                latestFiltersRef.current = { ...warpedPage.filters };
              }
            } catch (classErr) {
              console.warn("Classification after perspective warp fallback:", classErr);
            }
            newPages[idx] = warpedPage;
          }
        }

        // Invalidate stale in-memory and decoded caches
        cachedSourceImageRef.current = null;
        clearDecodedImageCache();
        setActivePagePreviewUrl(null);

        setDocument((prev) => ({
          ...prev,
          pages: newPages,
          updatedAt: new Date().toISOString(),
          isDirty: true,
        }));
        setIsDirty(true);
        setActiveTool("select");
        toast.success("Document perspective successfully de-warped & flattened.");
      } catch (err) {
        console.error("Perspective warp error:", err);
        toast.error("Failed to execute perspective warp.");
      } finally {
        setIsProcessing(false);
        setProcessingMessage("");
      }
    },
    [document, activePageIndex, selectedPageIds, recordHistorySnapshot]
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
      if (index < 0 || index >= document.pages.length) return;
      const targetPage = document.pages[index];
      if (!targetPage) return;

      setActivePageIndex(index);

      setSelectedPageIds((prev) => {
        if (!multiSelect) {
          return [targetPage.id];
        }
        return prev.includes(targetPage.id)
          ? prev.filter((id) => id !== targetPage.id)
          : [...prev, targetPage.id];
      });
    },
    [document.pages]
  );

  const handleRotateActivePage = useCallback(
    async (degrees: number, pageIdx = activePageIndex) => {
      const page = document.pages[pageIdx];
      if (!page) return;

      recordHistorySnapshot(document);
      setIsProcessing(true);
      setProcessingMessage(`Rotating page ${pageIdx + 1} by ${degrees}°...`);

      try {
        const rotatedPage = await rotatePagePhysical(page, degrees);

        // Clear all cached URLs & decoded images for this page to prevent stale frame references
        cachedSourceImageRef.current = null;
        clearDecodedImageCache();
        setActivePagePreviewUrl(null);

        setDocument((prev) => {
          const newPages = [...prev.pages];
          newPages[pageIdx] = rotatedPage;
          return {
            ...prev,
            pages: newPages,
            updatedAt: new Date().toISOString(),
          };
        });

        if (pageIdx === activePageIndex) {
          latestFiltersRef.current = { ...rotatedPage.filters };
        }

        setIsDirty(true);
        toast.success(
          `Page ${pageIdx + 1} rotated ${degrees > 0 ? `+${degrees}` : degrees}° (${rotatedPage.width}×${rotatedPage.height}px)`
        );
      } catch (err) {
        console.error("Page rotation error:", err);
        toast.error("Failed to rotate page.");
      } finally {
        setIsProcessing(false);
        setProcessingMessage("");
      }
    },
    [document, activePageIndex, recordHistorySnapshot]
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

  const handleAddBlankPage = useCallback(async () => {
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
    const unmigratedBlank: OmniPage = {
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

    const blankPage = await pageBlobStore.migratePageToBlobs(unmigratedBlank);

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

  const handleInsertPhotoPage = useCallback(async (dataUrl: string) => {
    const photoPageId = `photo-${Date.now()}`;
    const unmigratedPhoto: OmniPage = {
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

    const newPage = await pageBlobStore.migratePageToBlobs(unmigratedPhoto);

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
        toast.error(`Could not open PDF file "${file.name}":\n${err?.message || String(err)}`);
      }
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  };

  const handleImportImages = useCallback(
    async (imgFiles: File[]) => {
      if (imgFiles.length === 0) return;
      setIsProcessing(true);
      setProcessingMessage(`Importing ${imgFiles.length} image(s)...`);

      const newPages: OmniPage[] = [];
      for (let i = 0; i < imgFiles.length; i++) {
        const file = imgFiles[i];
        setProcessingMessage(`Importing & indexing image ${i + 1} of ${imgFiles.length}...`);

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

        // Generate compact thumbnail (< 15KB)
        const maxDim = 240;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const tw = Math.max(1, Math.floor((img.width || 1) * scale));
        const th = Math.max(1, Math.floor((img.height || 1) * scale));
        const thumbCanvas = window.document.createElement("canvas");
        thumbCanvas.width = tw;
        thumbCanvas.height = th;
        const ctx = thumbCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, tw, th);
        }
        const thumbDataUrl = thumbCanvas.toDataURL("image/jpeg", 0.7);

        const unmigratedPage: OmniPage = {
          id: `imp-${Date.now()}-${i}`,
          pageNumber: document.pages.length + newPages.length + 1,
          originalDataUrl: dataUrl,
          processedDataUrl: dataUrl,
          thumbnailDataUrl: thumbDataUrl,
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
        };

        // Automatically invoke pageBlobStore.migratePageToBlobs for that page BEFORE it is added to application state
        const migratedPage = await pageBlobStore.migratePageToBlobs(unmigratedPage);
        newPages.push(migratedPage);

        // Cooperative yield every 5 images for responsive UI
        if (i % 5 === 0 && i > 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
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
    },
    [document, recordHistorySnapshot]
  );

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

            const unmigratedDocPage: OmniPage = {
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
            };
            const migratedDocPage = await pageBlobStore.migratePageToBlobs(unmigratedDocPage);
            docPages.push(migratedDocPage);
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
      await handleImportImages(imgFiles);
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
      toast.warning("No pages to print in current document.");
      return;
    }
    window.print();
  }, [document]);

  // Print File from Workspace (Native Print)
  const handlePrintFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const iframe = window.document.createElement("iframe");
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
    window.document.body.appendChild(iframe);
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
        toast.info("No blank pages were detected in this document.");
        return;
      }

      setBlankRemovalConfirm({ isOpen: true, blankIndices });
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
      toast.error("Failed to export PDF: " + String(err));
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
      toast.error("Invalid .titanproj archive");
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
      registerAction("settings.autoFeatures", () => setIsAutoFeaturesModalOpen((prev) => !prev)),
      registerAction("app.autoFeaturesSettings", () => setIsAutoFeaturesModalOpen((prev) => !prev)),
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
      registerAction("tool.hand", () => setActiveTool("pan")),
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
      registerAction("diagnostics.stressTest", () => setIsStressTestModalOpen(true)),
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
      id: "cmd-stress-test",
      title: "Run Extreme Scale Stress Test (10,000 files/pages)",
      category: "Diagnostics",
      icon: <Zap className="w-4 h-4 text-amber-400" />,
      action: () => setIsStressTestModalOpen(true),
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
        onOpenStressTest={() => setIsStressTestModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenKeyboardShortcuts={() => setIsKeyboardShortcutsModalOpen(true)}
        onOpenAutoFeaturesSettings={() => setIsAutoFeaturesModalOpen(true)}
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
          onViewModeChange={setViewMode}
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
          onApplyPerspectiveWarp={handleApplyPerspectiveWarp}
          isProcessing={isProcessing}
        />

        {/* Right Inspector Panel */}
        <InspectorPanel
          activePage={activePage}
          document={document}
          language={language}
          isCollapsed={isRightCollapsed}
          isProcessing={isProcessing}
          onToggleCollapse={() => setIsRightCollapsed(!isRightCollapsed)}
          onRotatePage={(deg) => handleRotateActivePage(deg)}
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
      />

      <KeyboardShortcutsModal
        isOpen={isKeyboardShortcutsModalOpen}
        onClose={() => setIsKeyboardShortcutsModalOpen(false)}
      />

      <AutoFeaturesSettingsModal
        isOpen={isAutoFeaturesModalOpen}
        onClose={() => setIsAutoFeaturesModalOpen(false)}
      />

      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        document={document}
        onClose={() => setIsDiagnosticsOpen(false)}
      />

      <StressTestModal
        isOpen={isStressTestModalOpen}
        onClose={() => setIsStressTestModalOpen(false)}
        onLoadSyntheticDocument={(syntheticPages) => {
          setDocument((prev) => ({
            ...prev,
            pages: syntheticPages,
            activePageIndex: 0,
          }));
          setActivePageIndex(0);
          setIsStressTestModalOpen(false);
          toast.success(`Mounted ${syntheticPages.length.toLocaleString()} pages into Virtualized Document Canvas`);
        }}
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

      {/* Non-blocking Blank Page Removal Confirmation Modal */}
      {blankRemovalConfirm?.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Remove Blank Pages
            </h3>
            <p className="text-sm text-neutral-300">
              Detected <span className="font-semibold text-white">{blankRemovalConfirm.blankIndices.length}</span> blank page(s)
              {" "}(Page {blankRemovalConfirm.blankIndices.map((i) => i + 1).join(", ")}).
            </p>
            <p className="text-xs text-neutral-400">
              Do you want to permanently remove these blank pages from the document?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBlankRemovalConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const toRemove = blankRemovalConfirm.blankIndices;
                  setBlankRemovalConfirm(null);
                  recordHistorySnapshot(document);
                  setDocument((prev) => {
                    const remaining = prev.pages.filter((_, idx) => !toRemove.includes(idx));
                    return {
                      ...prev,
                      pages: remaining.map((p, idx) => ({ ...p, pageNumber: idx + 1 })),
                      updatedAt: new Date().toISOString(),
                    };
                  });
                  setActivePageIndex(0);
                  setIsDirty(true);
                  toast.success(`Removed ${toRemove.length} blank page(s).`);
                }}
                className="px-4 py-2 rounded-lg text-sm bg-rose-600 text-white font-medium hover:bg-rose-500 shadow-lg shadow-rose-600/20"
              >
                Remove Pages
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notifications Stack */}
      <ToastContainer />
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <ShortcutProvider>
        <AppContent />
      </ShortcutProvider>
    </ErrorBoundary>
  );
}

export default App;
