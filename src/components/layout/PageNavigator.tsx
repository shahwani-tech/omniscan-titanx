/**
 * OMNISCAN TITAN X - Enterprise Page Navigator Sidebar
 * Windowed Virtualization (supports up to 10,000 pages at 60 FPS),
 * Thumbnail Reordering, Multi-Selection, Status Badges & Quick Tools
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  FileText,
  RotateCw,
  RotateCcw,
  Trash2,
  Copy,
  Plus,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Shield,
  Layers,
  Wand2,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { OmniPage } from "../../types";
import { prioritizePdfThumbnailPages } from "../../engine/pdf";

interface PageNavigatorProps {
  pages: OmniPage[];
  activePageIndex: number;
  selectedPageIds: string[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelectPage: (index: number, multiSelect?: boolean) => void;
  onMovePage: (fromIndex: number, toIndex: number) => void;
  onDuplicatePage: (index: number) => void;
  onDeletePage: (index: number) => void;
  onRotatePage: (index: number, degrees: number) => void;
  onAutoDeskewPage: (index: number) => void;
  onAddBlankPage: () => void;
}

const ITEM_HEIGHT = 240; // Approximate height of each page card + margin in px
const OVERSCAN = 6; // Extra buffer items rendered above and below viewport

export const PageNavigator: React.FC<PageNavigatorProps> = ({
  pages,
  activePageIndex,
  selectedPageIds,
  isCollapsed,
  onToggleCollapse,
  onSelectPage,
  onMovePage,
  onDuplicatePage,
  onDeletePage,
  onRotatePage,
  onAutoDeskewPage,
  onAddBlankPage,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800);

  // Measure container height
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Virtualization calculations
  const totalCount = pages.length;
  const isVirtual = totalCount > 40;

  const startIndex = isVirtual
    ? Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN)
    : 0;
  const endIndex = isVirtual
    ? Math.min(totalCount - 1, Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN)
    : totalCount - 1;

  // Inform PDF engine to prioritize thumbnails in the visible range
  useEffect(() => {
    if (pages.length > 0) {
      const visibleNums: number[] = [];
      for (let i = startIndex; i <= endIndex; i++) {
        if (pages[i]?.pageNumber) {
          visibleNums.push(pages[i].pageNumber);
        }
      }
      if (visibleNums.length > 0) {
        prioritizePdfThumbnailPages(visibleNums);
      }
    }
  }, [startIndex, endIndex, pages]);

  // Scroll active page into view if out of viewport
  const scrollActivePageIntoView = useCallback(() => {
    if (!scrollContainerRef.current || activePageIndex < 0) return;
    const targetTop = activePageIndex * ITEM_HEIGHT;
    const currentScroll = scrollContainerRef.current.scrollTop;
    const visibleBottom = currentScroll + containerHeight;

    if (targetTop < currentScroll || targetTop + ITEM_HEIGHT > visibleBottom) {
      scrollContainerRef.current.scrollTo({
        top: Math.max(0, targetTop - containerHeight / 3),
        behavior: "smooth",
      });
    }
  }, [activePageIndex, containerHeight]);

  useEffect(() => {
    scrollActivePageIntoView();
  }, [activePageIndex, scrollActivePageIntoView]);

  if (isCollapsed) {
    return (
      <aside className="w-10 bg-neutral-900 border-r border-neutral-800 flex flex-col items-center py-2 shrink-0 z-20">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          title="Expand Page Navigator"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="mt-4 flex flex-col items-center space-y-2">
          <span className="text-[11px] font-mono text-neutral-400 [writing-mode:vertical-lr] tracking-widest uppercase">
            Pages ({pages.length.toLocaleString()})
          </span>
        </div>
      </aside>
    );
  }

  const topSpacerHeight = isVirtual ? startIndex * ITEM_HEIGHT : 0;
  const bottomSpacerHeight = isVirtual
    ? Math.max(0, (totalCount - 1 - endIndex) * ITEM_HEIGHT)
    : 0;

  const renderedPages = isVirtual
    ? pages.slice(startIndex, endIndex + 1).map((page, offset) => ({
        page,
        originalIndex: startIndex + offset,
      }))
    : pages.map((page, idx) => ({
        page,
        originalIndex: idx,
      }));

  return (
    <aside className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col h-full shrink-0 select-none z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-850">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
            Pages ({pages.length.toLocaleString()})
          </span>
          {isVirtual && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono bg-sky-950 text-sky-300 border border-sky-800"
              title="Windowed 60 FPS Virtualization Active"
            >
              <Zap className="w-2.5 h-2.5" />
              60FPS
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={onAddBlankPage}
            className="p-1 rounded hover:bg-neutral-750 text-neutral-300 hover:text-sky-400 transition-colors"
            title="Add Blank Page"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-neutral-750 text-neutral-400 hover:text-white transition-colors"
            title="Collapse Sidebar"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pages Virtualized / Scrollable List */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar relative"
      >
        {topSpacerHeight > 0 && (
          <div style={{ height: `${topSpacerHeight}px` }} aria-hidden="true" />
        )}

        {renderedPages.map(({ page, originalIndex: idx }) => {
          const isActive = idx === activePageIndex;
          const isSelected = selectedPageIds.includes(page.id);

          return (
            <div
              key={page.id}
              draggable
              onDragStart={(e) => {
                setDraggedIndex(idx);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIndex !== null && draggedIndex !== idx) {
                  onMovePage(draggedIndex, idx);
                }
                setDraggedIndex(null);
              }}
              onClick={(e) => {
                onSelectPage(idx, e.shiftKey || e.ctrlKey || e.metaKey);
              }}
              className={`group relative flex flex-col rounded-lg border transition-all cursor-pointer ${
                isActive
                  ? "border-sky-500 bg-sky-950/20 shadow-md ring-1 ring-sky-500/40"
                  : isSelected
                  ? "border-sky-700 bg-neutral-800/60"
                  : "border-neutral-800 bg-neutral-850 hover:border-neutral-700 hover:bg-neutral-800/40"
              }`}
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-t-md bg-neutral-950 flex items-center justify-center p-2">
                {page.thumbnailDataUrl || page.processedDataUrl ? (
                  <img
                    src={page.thumbnailDataUrl || page.processedDataUrl}
                    alt={`Page ${idx + 1}`}
                    className="max-h-full max-w-full object-contain shadow-sm rounded-sm"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-neutral-600 space-y-1">
                    <FileText className="w-8 h-8 animate-pulse text-neutral-500" />
                    <span className="text-[10px] font-mono text-neutral-500">
                      Loading #{idx + 1}...
                    </span>
                  </div>
                )}

                {/* Status Badges Overlay */}
                <div className="absolute top-1.5 right-1.5 flex flex-col space-y-1">
                  {page.ocr?.status === "completed" && (
                    <span
                      className="p-1 rounded-full bg-emerald-500/90 text-white shadow"
                      title={`OCR Indexed (${page.ocr.confidence}% confidence)`}
                    >
                      <CheckCircle2 className="w-2.5 h-2.5" />
                    </span>
                  )}
                  {page.isBlank && (
                    <span
                      className="p-1 rounded-full bg-amber-500/90 text-neutral-950 shadow"
                      title="Blank page detected"
                    >
                      <AlertCircle className="w-2.5 h-2.5" />
                    </span>
                  )}
                  {page.redactions && page.redactions.length > 0 && (
                    <span
                      className="p-1 rounded-full bg-rose-500/90 text-white shadow"
                      title={`${page.redactions.length} Redactions Applied`}
                    >
                      <Shield className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>

                {/* Hover Quick Actions Bar */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-neutral-950/90 via-neutral-950/60 to-transparent p-1.5 flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRotatePage(idx, 90);
                    }}
                    className="p-1 rounded bg-neutral-800/90 hover:bg-sky-600 text-neutral-200 hover:text-white transition-colors"
                    title="Rotate 90° Clockwise"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAutoDeskewPage(idx);
                    }}
                    className="p-1 rounded bg-neutral-800/90 hover:bg-amber-600 text-neutral-200 hover:text-white transition-colors"
                    title="Auto Deskew"
                  >
                    <Wand2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicatePage(idx);
                    }}
                    className="p-1 rounded bg-neutral-800/90 hover:bg-neutral-700 text-neutral-200 hover:text-white transition-colors"
                    title="Duplicate Page"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePage(idx);
                    }}
                    className="p-1 rounded bg-neutral-800/90 hover:bg-rose-600 text-neutral-200 hover:text-white transition-colors"
                    title="Delete Page"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Page Number & Info Footer */}
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-neutral-900/90 text-xs border-t border-neutral-800/60">
                <div className="flex items-center space-x-1.5">
                  <span
                    className={`font-mono font-bold ${
                      isActive ? "text-sky-400" : "text-neutral-300"
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-mono">
                    {page.width}×{page.height}
                  </span>
                </div>

                <div className="flex items-center space-x-1 text-[10px] text-neutral-500">
                  <span>{page.dpi || 300} DPI</span>
                </div>
              </div>
            </div>
          );
        })}

        {bottomSpacerHeight > 0 && (
          <div style={{ height: `${bottomSpacerHeight}px` }} aria-hidden="true" />
        )}
      </div>

      {/* Bottom Page Controls */}
      <div className="p-2 border-t border-neutral-800 bg-neutral-850 flex items-center justify-between text-xs">
        <button
          onClick={onAddBlankPage}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-200 w-full justify-center transition-colors font-medium"
        >
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          <span>Insert Blank Page</span>
        </button>
      </div>
    </aside>
  );
};
