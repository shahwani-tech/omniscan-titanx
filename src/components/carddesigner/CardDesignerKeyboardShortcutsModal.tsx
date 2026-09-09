/**
 * CardDesignerKeyboardShortcutsModal.tsx
 * Comprehensive interactive reference panel for all Card Designer shortcuts.
 */

import React, { useState } from "react";
import {
  Keyboard,
  X,
  Search,
  ZoomIn,
  Move,
  Layers,
  Copy,
  Undo2,
  Trash2,
  ArrowUpDown,
  FlipHorizontal,
} from "lucide-react";

interface CardDesignerKeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: "View & Zoom" | "Selection & Edit" | "Arrangement & Layering" | "Nudging";
}

const SHORTCUTS: ShortcutItem[] = [
  // View & Zoom
  { keys: ["+", "="], description: "Zoom in (viewport-center anchored)", category: "View & Zoom" },
  { keys: ["-"], description: "Zoom out (viewport-center anchored)", category: "View & Zoom" },
  { keys: ["0"], description: "Reset zoom to 100% (centered)", category: "View & Zoom" },
  { keys: ["Shift", "0"], description: "Fit physical A6 page to viewport", category: "View & Zoom" },
  { keys: ["Space", "Drag"], description: "Pan canvas view smoothly", category: "View & Zoom" },
  { keys: ["Wheel"], description: "Center-anchored scroll zooming", category: "View & Zoom" },

  // Selection & Edit
  { keys: ["Ctrl/Cmd", "A"], description: "Select all objects in active card", category: "Selection & Edit" },
  { keys: ["Delete", "Backspace"], description: "Delete selected object(s)", category: "Selection & Edit" },
  { keys: ["Ctrl/Cmd", "D"], description: "Duplicate selected object(s)", category: "Selection & Edit" },
  { keys: ["Ctrl/Cmd", "C"], description: "Copy selected object(s) to internal clipboard", category: "Selection & Edit" },
  { keys: ["Ctrl/Cmd", "V"], description: "Paste copied object(s) onto active card", category: "Selection & Edit" },
  { keys: ["Ctrl/Cmd", "Z"], description: "Undo last modification", category: "Selection & Edit" },
  { keys: ["Ctrl/Cmd", "Shift", "Z"], description: "Redo modification (or Ctrl/Cmd + Y)", category: "Selection & Edit" },
  { keys: ["Ctrl/Cmd", "S"], description: "Save project as native .ocard file", category: "Selection & Edit" },
  { keys: ["Ctrl/Cmd", "O"], description: "Open native .ocard project file", category: "Selection & Edit" },
  { keys: ["Escape"], description: "Deselect all / close open tool panels", category: "Selection & Edit" },

  // Arrangement & Layering
  { keys: ["Ctrl/Cmd", "G"], description: "Group selected objects together", category: "Arrangement & Layering" },
  { keys: ["Ctrl/Cmd", "Shift", "G"], description: "Ungroup selected group", category: "Arrangement & Layering" },
  { keys: ["Ctrl/Cmd", "]"], description: "Bring forward one layer", category: "Arrangement & Layering" },
  { keys: ["Ctrl/Cmd", "["], description: "Send backward one layer", category: "Arrangement & Layering" },
  { keys: ["Ctrl/Cmd", "Shift", "]"], description: "Bring to absolute front (top layer)", category: "Arrangement & Layering" },
  { keys: ["Ctrl/Cmd", "Shift", "["], description: "Send to absolute back (bottom layer)", category: "Arrangement & Layering" },
  { keys: ["H"], description: "Flip / Mirror selected object horizontally", category: "Arrangement & Layering" },
  { keys: ["Shift", "V"], description: "Flip / Mirror selected object vertically", category: "Arrangement & Layering" },

  // Nudging
  { keys: ["↑", "↓", "←", "→"], description: "Standard nudge by 1.0 mm", category: "Nudging" },
  { keys: ["Shift", "Arrows"], description: "Large nudge by 5.0 mm", category: "Nudging" },
  { keys: ["Alt/Opt", "Arrows"], description: "Micro / fine nudge by 0.1 mm", category: "Nudging" },
];

export const CardDesignerKeyboardShortcutsModal: React.FC<
  CardDesignerKeyboardShortcutsModalProps
> = ({ isOpen, onClose }) => {
  const [filter, setFilter] = useState("");

  if (!isOpen) return null;

  const filtered = SHORTCUTS.filter(
    (s) =>
      s.description.toLowerCase().includes(filter.toLowerCase()) ||
      s.keys.some((k) => k.toLowerCase().includes(filter.toLowerCase())) ||
      s.category.toLowerCase().includes(filter.toLowerCase())
  );

  const categories = Array.from(new Set(filtered.map((s) => s.category)));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Card Designer Keyboard Shortcuts</h2>
              <p className="text-[11px] text-neutral-400">
                CorelDRAW and Illustrator standard vector shortcuts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-neutral-800/80 bg-neutral-900 flex items-center space-x-2">
          <Search className="w-4 h-4 text-neutral-500 shrink-0" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search shortcuts (e.g. zoom, duplicate, nudge, flip)..."
            className="w-full bg-transparent text-xs text-white placeholder:text-neutral-500 outline-none"
            autoFocus
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="text-[11px] text-neutral-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Shortcuts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {categories.length === 0 ? (
            <div className="text-center py-10 text-neutral-500 text-xs">
              No shortcuts found matching &ldquo;{filter}&rdquo;
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat} className="space-y-2">
                <h3 className="text-[11px] font-bold text-sky-400 uppercase tracking-wider px-1">
                  {cat}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filtered
                    .filter((s) => s.category === cat)
                    .map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-2.5 flex items-center justify-between space-x-3"
                      >
                        <span className="text-xs text-neutral-300 leading-snug">
                          {item.description}
                        </span>
                        <div className="flex items-center space-x-1 shrink-0">
                          {item.keys.map((k, kIdx) => (
                            <kbd
                              key={kIdx}
                              className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded-md text-[11px] font-mono font-bold text-neutral-200 shadow-sm"
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between text-[11px] text-neutral-400">
          <span>Shortcuts are inactive while typing inside text fields or editing text objects.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
