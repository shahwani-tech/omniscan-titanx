/**
 * OMNISCAN TITAN X - Fast Searchable Command Palette (Ctrl+K)
 */

import React, { useState, useEffect } from "react";
import {
  Search,
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
  Activity,
  RotateCw,
  Plus,
  Trash2,
  X,
  Command,
} from "lucide-react";

interface CommandItem {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = commands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden text-neutral-200 text-xs">
        {/* Search Input Bar */}
        <div className="flex items-center px-3.5 py-3 border-b border-neutral-800 bg-neutral-850">
          <Search className="w-4 h-4 text-sky-400 mr-2.5" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search action (e.g. OCR, Deskew, Export PDF/A)..."
            className="flex-1 bg-transparent border-none text-sm text-white focus:outline-none placeholder:text-neutral-500 font-sans"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] bg-neutral-800 rounded border border-neutral-700 text-neutral-400 font-mono">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div className="max-h-80 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-neutral-500">
              No matching commands found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                    isSelected
                      ? "bg-sky-600/20 text-sky-300 border border-sky-500/40 shadow-sm"
                      : "hover:bg-neutral-800 text-neutral-300 border border-transparent"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <span className={isSelected ? "text-sky-400" : "text-neutral-400"}>
                      {item.icon}
                    </span>
                    <span className="font-medium text-xs text-white">{item.title}</span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      [{item.category}]
                    </span>
                  </div>

                  {item.shortcut && (
                    <kbd className="text-[10px] font-mono bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-700">
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 bg-neutral-850 border-t border-neutral-800 flex items-center justify-between text-[10px] text-neutral-400">
          <span>Navigate with ↑ ↓ and press Enter</span>
          <span>Titan Command Hub</span>
        </div>
      </div>
    </div>
  );
};
