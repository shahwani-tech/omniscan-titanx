/**
 * OMNISCAN TITAN X - Enterprise Page Navigator Sidebar
 * Thumbnail Reordering, Multi-Selection, Status Badges & Context Operations
 */

import React, { useState } from "react";
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
  MoreVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { OmniPage } from "../../types";

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
  const [contextMenuIndex, setContextMenuIndex] = useState<number | null>(null);

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
            Pages ({pages.length})
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col h-full shrink-0 select-none z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-850">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
            Pages ({pages.length})
          </span>
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
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {pages.map((page, idx) => {
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
                <img
                  src={page.thumbnailDataUrl || page.processedDataUrl}
                  alt={`Page ${idx + 1}`}
                  className="max-h-full max-w-full object-contain shadow-sm rounded-sm"
                  loading="lazy"
                />

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
                  <span className={`font-mono font-bold ${isActive ? "text-sky-400" : "text-neutral-300"}`}>
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
