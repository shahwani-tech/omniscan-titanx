/**
 * OMNISCAN TITAN X - Keyboard Shortcut Help & Customization Panel
 * Searchable, categorised, live key binding recorder, conflict detection,
 * reset to default, export/import shortcut profiles.
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useShortcuts } from "../../commands/ShortcutContext";
import { CommandCategory, ResolvedCommand } from "../../commands/types";
import {
  getShortcutFromEvent,
  formatShortcutForDisplay,
  isMacPlatform,
} from "../../commands/shortcutManager";
import {
  Keyboard,
  Search,
  X,
  RotateCcw,
  Check,
  AlertTriangle,
  Download,
  Upload,
  Edit2,
  Sparkles,
  Command,
  Info,
} from "lucide-react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    resolvedCommands,
    setCustomShortcut,
    resetShortcut,
    resetAllShortcuts,
    customBindings,
  } = useShortcuts();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [recordingCommandId, setRecordingCommandId] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMac = isMacPlatform();

  // Reset recording state when closed or opened
  useEffect(() => {
    if (!isOpen) {
      setRecordingCommandId(null);
      setRecordingError(null);
    }
  }, [isOpen]);

  // Key recorder listener
  useEffect(() => {
    if (!recordingCommandId) return;

    const handleRecordKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape cancels recording
      if (e.key === "Escape") {
        setRecordingCommandId(null);
        setRecordingError(null);
        return;
      }

      const recorded = getShortcutFromEvent(e);
      if (!recorded) return; // modifier-only keypress

      const res = setCustomShortcut(recordingCommandId, recorded);
      if (res.success) {
        setRecordingCommandId(null);
        setRecordingError(null);
        setSuccessMessage(`Assigned ${recorded} successfully`);
        setTimeout(() => setSuccessMessage(null), 2500);
      } else if (res.conflict) {
        setRecordingError(
          `Conflict: Already used by "${res.conflict.conflictingWith.label}" (${res.conflict.conflictingWith.category})`
        );
      }
    };

    window.addEventListener("keydown", handleRecordKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleRecordKeyDown, { capture: true });
    };
  }, [recordingCommandId, setCustomShortcut]);

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    resolvedCommands.forEach((c) => cats.add(c.category));
    return ["All", ...Array.from(cats)];
  }, [resolvedCommands]);

  // Filter commands by search and category
  const filteredCommands = useMemo(() => {
    return resolvedCommands.filter((cmd) => {
      const matchesCat = selectedCategory === "All" || cmd.category === selectedCategory;
      if (!matchesCat) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        cmd.label.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q) ||
        cmd.currentShortcut.toLowerCase().includes(q) ||
        (cmd.keywords && cmd.keywords.some((k) => k.toLowerCase().includes(q)))
      );
    });
  }, [resolvedCommands, selectedCategory, searchQuery]);

  // Export customized bindings as JSON
  const handleExportProfile = () => {
    const json = JSON.stringify(customBindings, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "omniscan-shortcuts-profile.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import customized bindings from JSON
  const handleImportProfile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (typeof parsed === "object" && parsed !== null) {
          let count = 0;
          for (const [cmdId, key] of Object.entries(parsed)) {
            if (typeof key === "string") {
              setCustomShortcut(cmdId, key);
              count++;
            }
          }
          setSuccessMessage(`Imported ${count} custom shortcuts`);
          setTimeout(() => setSuccessMessage(null), 3000);
        }
      } catch (err) {
        setRecordingError("Invalid shortcut JSON profile file");
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = "";
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts and Settings"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none"
    >
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-neutral-200">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-850">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/30">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Master Keyboard Shortcuts & Hotkey Architecture
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                  {resolvedCommands.length} commands
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Context-aware keybindings for rapid desktop document scanning, layout, and editing
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportProfile}
              title="Export shortcuts profile"
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg border border-neutral-700 transition"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import shortcuts profile"
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg border border-neutral-700 transition"
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportProfile}
              className="hidden"
            />

            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg border border-neutral-700 transition ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notification / Error / Success Banners */}
        {recordingError && (
          <div className="px-6 py-2 bg-red-950/80 border-b border-red-800/80 flex items-center justify-between text-xs text-red-300">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              {recordingError}
            </span>
            <button
              onClick={() => setRecordingError(null)}
              className="text-red-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="px-6 py-2 bg-emerald-950/80 border-b border-emerald-800/80 flex items-center justify-between text-xs text-emerald-300">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              {successMessage}
            </span>
          </div>
        )}

        {/* Search & Category Filter Bar */}
        <div className="px-6 py-3 border-b border-neutral-800 bg-neutral-900 flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search command name, category, or key..."
              className="w-full bg-neutral-800/80 border border-neutral-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-sky-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Reset all button */}
          {Object.keys(customBindings).length > 0 && (
            <button
              onClick={resetAllShortcuts}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-400 rounded-lg text-xs font-medium border border-neutral-700 transition shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset All ({Object.keys(customBindings).length})
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="px-6 py-2.5 bg-neutral-900/60 border-b border-neutral-800/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition-all font-medium text-[11px] ${
                selectedCategory === cat
                  ? "bg-sky-600 text-white shadow-sm"
                  : "bg-neutral-800/70 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Command Matrix List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
          {filteredCommands.length === 0 ? (
            <div className="py-16 text-center text-neutral-500">
              <Keyboard className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No matching commands found</p>
            </div>
          ) : (
            filteredCommands.map((cmd) => {
              const isRecording = recordingCommandId === cmd.id;
              const isCustom = cmd.isCustomized;

              return (
                <div
                  key={cmd.id}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-xl border transition-all ${
                    isRecording
                      ? "bg-sky-950/40 border-sky-500 shadow-md ring-1 ring-sky-500"
                      : "bg-neutral-850/60 hover:bg-neutral-800/60 border-neutral-800"
                  }`}
                >
                  <div className="flex-1 pr-4 mb-2 sm:mb-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white tracking-tight">
                        {cmd.label}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/60">
                        {cmd.category}
                      </span>
                      <span
                        className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded border ${
                          cmd.scope === "global"
                            ? "bg-neutral-800 text-neutral-400 border-neutral-700"
                            : "bg-sky-950 text-sky-400 border-sky-800"
                        }`}
                      >
                        {cmd.scope}
                      </span>
                      {isCustom && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-medium">
                          Customized
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">{cmd.description}</p>
                  </div>

                  {/* Shortcut Button & Recorder */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {isRecording ? (
                      <div className="flex items-center gap-2 bg-sky-900/40 border border-sky-500/60 px-3 py-1.5 rounded-lg text-xs animate-pulse text-sky-300 font-mono">
                        <span>Press any key combo...</span>
                        <button
                          onClick={() => setRecordingCommandId(null)}
                          className="hover:text-white p-0.5 rounded hover:bg-sky-800/50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setRecordingCommandId(cmd.id);
                          setRecordingError(null);
                        }}
                        title="Click to record a new shortcut"
                        className="group flex items-center gap-1.5 bg-neutral-800 hover:bg-neutral-750 px-2.5 py-1 rounded-lg border border-neutral-700 hover:border-sky-500/60 transition"
                      >
                        <kbd className="text-xs font-mono font-medium text-white group-hover:text-sky-300">
                          {formatShortcutForDisplay(cmd.currentShortcut)}
                        </kbd>
                        <Edit2 className="w-3 h-3 text-neutral-500 group-hover:text-sky-400 opacity-60 group-hover:opacity-100" />
                      </button>
                    )}

                    {/* Reset Button */}
                    {isCustom && (
                      <button
                        onClick={() => resetShortcut(cmd.id)}
                        title="Reset this shortcut to default"
                        className="p-1.5 text-neutral-500 hover:text-amber-400 hover:bg-neutral-800 rounded-lg transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-850 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 text-[10px] bg-neutral-800 rounded border border-neutral-700 text-neutral-300 font-mono">
                {isMac ? "⌘" : "Ctrl"}
              </kbd>{" "}
              Primary Modifier
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 text-[10px] bg-neutral-800 rounded border border-neutral-700 text-neutral-300 font-mono">
                ESC
              </kbd>{" "}
              Exit / Close
            </span>
          </div>

          <div className="text-[11px] text-neutral-500">
            Tip: Text inputs preserve native browser typing, cut, and copy.
          </div>
        </div>
      </div>
    </div>
  );
};
