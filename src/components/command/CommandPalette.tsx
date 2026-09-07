/**
 * OMNISCAN TITAN X - Global Command Palette (Ctrl+K / Ctrl+Shift+P)
 * Real command execution via Master Command Registry & ShortcutContext,
 * category filtering, recent commands, shortcut badges, and settings bridge.
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useShortcuts } from "../../commands/ShortcutContext";
import { formatShortcutForDisplay } from "../../commands/shortcutManager";
import {
  Search,
  Command,
  Keyboard,
  Clock,
  Check,
  ChevronRight,
  FolderOpen,
  Save,
  Download,
  Printer,
  Crop,
  Layers,
  Sparkles,
  Palette,
  CreditCard,
  SplitSquareVertical,
  ShieldCheck,
  Activity,
  RotateCw,
  Plus,
  Trash2,
  Scan,
  FileSearch,
  MousePointer,
  Hand,
  ZoomIn,
  Type,
  Highlighter,
  PenTool,
  Square,
  Circle,
  ArrowRight,
  Stamp,
  ShieldAlert,
  Scissors,
  Wand2,
} from "lucide-react";

// Icon mapping helper
const getCommandIcon = (iconName?: string) => {
  switch (iconName) {
    case "Scan":
      return <Scan className="w-4 h-4" />;
    case "FolderOpen":
      return <FolderOpen className="w-4 h-4" />;
    case "Save":
      return <Save className="w-4 h-4" />;
    case "Download":
      return <Download className="w-4 h-4" />;
    case "Printer":
      return <Printer className="w-4 h-4" />;
    case "Crop":
      return <Crop className="w-4 h-4" />;
    case "Layers":
      return <Layers className="w-4 h-4" />;
    case "Sparkles":
      return <Sparkles className="w-4 h-4" />;
    case "Palette":
      return <Palette className="w-4 h-4" />;
    case "CreditCard":
      return <CreditCard className="w-4 h-4" />;
    case "SplitSquareVertical":
      return <SplitSquareVertical className="w-4 h-4" />;
    case "ShieldCheck":
      return <ShieldCheck className="w-4 h-4" />;
    case "Activity":
      return <Activity className="w-4 h-4" />;
    case "RotateCw":
      return <RotateCw className="w-4 h-4" />;
    case "Plus":
      return <Plus className="w-4 h-4" />;
    case "Trash2":
      return <Trash2 className="w-4 h-4" />;
    case "FileSearch":
      return <FileSearch className="w-4 h-4" />;
    case "MousePointer":
      return <MousePointer className="w-4 h-4" />;
    case "Hand":
      return <Hand className="w-4 h-4" />;
    case "ZoomIn":
      return <ZoomIn className="w-4 h-4" />;
    case "Type":
      return <Type className="w-4 h-4" />;
    case "Highlighter":
      return <Highlighter className="w-4 h-4" />;
    case "PenTool":
      return <PenTool className="w-4 h-4" />;
    case "Square":
      return <Square className="w-4 h-4" />;
    case "Circle":
      return <Circle className="w-4 h-4" />;
    case "ArrowRight":
      return <ArrowRight className="w-4 h-4" />;
    case "Stamp":
      return <Stamp className="w-4 h-4" />;
    case "ShieldAlert":
      return <ShieldAlert className="w-4 h-4" />;
    case "Scissors":
      return <Scissors className="w-4 h-4" />;
    case "Wand2":
      return <Wand2 className="w-4 h-4" />;
    default:
      return <Command className="w-4 h-4" />;
  }
};

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const {
    resolvedCommands,
    executeCommand,
    recentCommandIds,
    setIsHelpOpen,
    activeScopes,
  } = useShortcuts();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setSelectedCategory("All");
    }
  }, [isOpen]);

  // Scope filter: filter commands that belong to global or currently active scope
  const activeTopScope = activeScopes[activeScopes.length - 1] || "global";

  // Filter commands by active scope, category, and search query
  const filteredCommands = useMemo(() => {
    return resolvedCommands.filter((cmd) => {
      // Must be globally valid or valid in active scope
      const isScopeValid = cmd.scope === "global" || cmd.scope === activeTopScope;
      if (!isScopeValid) return false;

      if (selectedCategory !== "All" && cmd.category !== selectedCategory) {
        return false;
      }

      if (!query.trim()) return true;

      const q = query.toLowerCase();
      return (
        cmd.label.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q) ||
        cmd.currentShortcut.toLowerCase().includes(q) ||
        (cmd.keywords && cmd.keywords.some((k) => k.toLowerCase().includes(q)))
      );
    });
  }, [resolvedCommands, activeTopScope, selectedCategory, query]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length)
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredCommands[selectedIndex];
      if (target) {
        onClose();
        executeCommand(target.id);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const handleOpenHelp = () => {
    onClose();
    setIsHelpOpen(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="OmniScan Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 bg-black/80 backdrop-blur-sm p-4 select-none"
    >
      <div className="bg-neutral-900 border border-neutral-700/90 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden text-neutral-200">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-neutral-800 bg-neutral-850">
          <Search className="w-4 h-4 text-sky-400 mr-3 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search action (e.g. OCR, Crop, Passport, Deskew)..."
            className="flex-1 bg-transparent border-none text-sm text-white focus:outline-none placeholder:text-neutral-500 font-sans"
          />

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              onClick={handleOpenHelp}
              title="Open Keyboard Shortcuts Panel"
              className="px-2 py-1 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white rounded border border-neutral-700 text-[11px] flex items-center gap-1 transition"
            >
              <Keyboard className="w-3.5 h-3.5 text-sky-400" />
              <span>Keys</span>
            </button>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-neutral-800 rounded border border-neutral-700 text-neutral-400 font-mono">
              ESC
            </kbd>
          </div>
        </div>

        {/* Quick Context & Active Scope Indicator */}
        <div className="px-4 py-1.5 bg-neutral-950/60 border-b border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active Scope: <strong className="text-neutral-200 font-mono">{activeTopScope}</strong>
          </span>
          <span>
            Showing <strong className="text-white">{filteredCommands.length}</strong> available commands
          </span>
        </div>

        {/* Command List */}
        <div ref={listRef} className="max-h-96 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-neutral-500">
              <p>No matching commands found</p>
              <p className="text-[11px] text-neutral-600 mt-1">
                Try searching for "PDF", "Print", "Scan", or "Crop"
              </p>
            </div>
          ) : (
            filteredCommands.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isRecent = recentCommandIds.includes(item.id);

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onClose();
                    executeCommand(item.id);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all ${
                    isSelected
                      ? "bg-sky-600/20 text-sky-200 border border-sky-500/50 shadow-sm"
                      : "hover:bg-neutral-800/60 text-neutral-300 border border-transparent"
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 pr-2">
                    <div
                      className={`p-1.5 rounded-lg border ${
                        isSelected
                          ? "bg-sky-500/20 text-sky-400 border-sky-500/40"
                          : "bg-neutral-800 text-neutral-400 border-neutral-700/60"
                      }`}
                    >
                      {getCommandIcon(item.icon)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-white truncate">
                          {item.label}
                        </span>
                        {isRecent && (
                          <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 bg-neutral-800 text-neutral-400 rounded border border-neutral-700 font-mono">
                            <Clock className="w-2.5 h-2.5" /> Recent
                          </span>
                        )}
                        <span className="text-[10px] text-neutral-500 font-mono">
                          [{item.category}]
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate">{item.description}</p>
                    </div>
                  </div>

                  {item.currentShortcut && (
                    <kbd className="text-[11px] font-mono bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded border border-neutral-700/80 shadow-xs shrink-0">
                      {formatShortcutForDisplay(item.currentShortcut)}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2 border-t border-neutral-800 bg-neutral-850 flex items-center justify-between text-[11px] text-neutral-400">
          <div className="flex items-center space-x-3">
            <span>
              <kbd className="font-mono bg-neutral-800 px-1 py-0.5 rounded text-neutral-300">↑</kbd>{" "}
              <kbd className="font-mono bg-neutral-800 px-1 py-0.5 rounded text-neutral-300">↓</kbd>{" "}
              Navigate
            </span>
            <span>
              <kbd className="font-mono bg-neutral-800 px-1 py-0.5 rounded text-neutral-300">↵</kbd>{" "}
              Execute
            </span>
            <span>
              <kbd className="font-mono bg-neutral-800 px-1 py-0.5 rounded text-neutral-300">Esc</kbd>{" "}
              Close
            </span>
          </div>

          <button
            onClick={handleOpenHelp}
            className="hover:text-white flex items-center gap-1 text-sky-400 underline underline-offset-2"
          >
            Customize shortcuts
          </button>
        </div>
      </div>
    </div>
  );
};
