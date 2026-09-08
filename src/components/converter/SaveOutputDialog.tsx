/**
 * OMNISCAN TITAN X - Save Output & Rename Dialog Modal
 * Allows renaming, selecting format/extension, numbering styles,
 * live preview of final name, and collision safety before file saving.
 */

import React, { useState, useEffect } from "react";
import {
  FileText,
  Download,
  X,
  Check,
  AlertCircle,
  Hash,
  Tag,
  FolderDown,
  Sparkles,
} from "lucide-react";
import { SupportedOutputFormat } from "../../services/converter/ConversionTypes";
import { FileNamingManager } from "../../services/converter/FileNamingManager";

interface SaveOutputDialogProps {
  isOpen: boolean;
  defaultName: string;
  defaultExtension: SupportedOutputFormat;
  allowedExtensions?: SupportedOutputFormat[];
  itemCount?: number;
  onConfirm: (finalName: string, selectedFormat: SupportedOutputFormat) => void;
  onClose: () => void;
}

export const SaveOutputDialog: React.FC<SaveOutputDialogProps> = ({
  isOpen,
  defaultName,
  defaultExtension,
  allowedExtensions = ["pdf", "docx", "xlsx", "pptx", "jpg", "png", "webp", "zip"],
  itemCount = 1,
  onConfirm,
  onClose,
}) => {
  const [baseName, setBaseName] = useState("");
  const [extension, setExtension] = useState<SupportedOutputFormat>(defaultExtension);
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [numberingStyle, setNumberingStyle] = useState<
    "none" | "underscore_two_digit" | "dash_two_digit" | "parentheses" | "raw"
  >(itemCount > 1 ? "underscore_two_digit" : "none");

  useEffect(() => {
    if (isOpen) {
      setBaseName(FileNamingManager.getBaseName(defaultName || "Converted_Document"));
      setExtension(defaultExtension);
      setPrefix("");
      setSuffix("");
      setNumberingStyle(itemCount > 1 ? "underscore_two_digit" : "none");
    }
  }, [isOpen, defaultName, defaultExtension, itemCount]);

  if (!isOpen) return null;

  const previewName = FileNamingManager.generateOutputName({
    baseName: baseName || "Document",
    extension,
    prefix,
    suffix,
    pageNumber: 1,
    totalPages: itemCount,
    numberingStyle: itemCount > 1 ? numberingStyle : "none",
  });

  const previewLastName =
    itemCount > 1
      ? FileNamingManager.generateOutputName({
          baseName: baseName || "Document",
          extension,
          prefix,
          suffix,
          pageNumber: itemCount,
          totalPages: itemCount,
          numberingStyle,
        })
      : null;

  const handleSave = () => {
    onConfirm(previewName, extension);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
              <FolderDown className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Save & Rename Output</h3>
              <p className="text-[11px] text-neutral-400">
                Customize file name, extension, and numbering before exporting
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Main File Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300 flex items-center justify-between">
              <span>File Name</span>
              <span className="text-[10px] text-neutral-500">OS-safe sanitization active</span>
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={baseName}
                onChange={(e) => setBaseName(e.target.value)}
                placeholder="Enter file name..."
                className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none"
              />
              <select
                value={extension}
                onChange={(e) => setExtension(e.target.value as SupportedOutputFormat)}
                className="bg-neutral-950 border border-neutral-800 focus:border-sky-500 rounded-lg px-3 py-2 text-sm text-sky-400 font-mono font-medium outline-none cursor-pointer"
              >
                {allowedExtensions.map((ext) => (
                  <option key={ext} value={ext}>
                    .{ext.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Optional Prefix and Suffix */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-neutral-400 flex items-center space-x-1">
                <Tag className="w-3 h-3 text-neutral-500" />
                <span>Prefix (Optional)</span>
              </label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="e.g. FINAL"
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-600 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-neutral-400 flex items-center space-x-1">
                <Tag className="w-3 h-3 text-neutral-500" />
                <span>Suffix (Optional)</span>
              </label>
              <input
                type="text"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                placeholder="e.g. v2"
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-sky-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-600 outline-none"
              />
            </div>
          </div>

          {/* Multi-item Numbering Style */}
          {itemCount > 1 && (
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-medium text-neutral-400 flex items-center space-x-1">
                <Hash className="w-3 h-3 text-neutral-500" />
                <span>Batch Numbering Format ({itemCount} items)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "underscore_two_digit", label: "_01, _02" },
                  { id: "dash_two_digit", label: "-01, -02" },
                  { id: "parentheses", label: " (1), (2)" },
                ].map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setNumberingStyle(style.id as any)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                      numberingStyle === style.id
                        ? "bg-sky-500/20 border-sky-500/50 text-sky-300"
                        : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live Preview Box */}
          <div className="bg-neutral-950 border border-neutral-800/80 rounded-lg p-3 space-y-1.5">
            <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Output Preview</span>
            </div>
            <div className="text-xs font-mono text-emerald-400 truncate select-all">{previewName}</div>
            {previewLastName && (
              <div className="text-[11px] font-mono text-neutral-500 truncate">... {previewLastName}</div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end space-x-2.5 px-5 py-3.5 border-t border-neutral-800 bg-neutral-950/70">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Confirm & Save File</span>
          </button>
        </div>
      </div>
    </div>
  );
};
