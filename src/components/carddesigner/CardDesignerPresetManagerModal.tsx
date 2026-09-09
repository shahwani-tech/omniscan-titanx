/**
 * CardDesignerPresetManagerModal.tsx
 * Manage, replace, and upload custom presets and templates with persistence.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  FolderKanban,
  X,
  Upload,
  RotateCcw,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Sparkles,
  FileCode,
  Image as ImageIcon,
  CheckCircle2,
  Download,
  Copy,
} from "lucide-react";
import { CardDesignerProject } from "../../engine/carddesigner/types";
import { createDefaultProject } from "../../engine/carddesigner/templates";
import {
  CardPresetItem,
  getAllPresets,
  replaceDefaultSlot,
  resetDefaultSlot,
  addCustomPreset,
  deleteCustomPreset,
  validateAndParsePresetFile,
  loadPresetProject,
} from "../../engine/carddesigner/presetStorage";
import { saveProjectToDisk } from "../../engine/carddesigner/projectFileManager";

interface CardDesignerPresetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject?: CardDesignerProject;
  onApplyPreset?: (project: CardDesignerProject) => void;
  onLoadPreset?: (project: CardDesignerProject) => void;
}

export const CardDesignerPresetManagerModal: React.FC<CardDesignerPresetManagerModalProps> = ({
  isOpen,
  onClose,
  currentProject,
  onApplyPreset,
  onLoadPreset,
}) => {
  const activeProject = currentProject || createDefaultProject();
  const applyHandler = onApplyPreset || onLoadPreset;
  const [activeTab, setActiveTab] = useState<"default-slots" | "custom-presets">("default-slots");
  const [presets, setPresets] = useState<CardPresetItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Replacement target state
  const [replacingSlotId, setReplacingSlotId] = useState<string | null>(null);

  // New custom preset form
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetDesc, setNewPresetDesc] = useState("");
  const [stagedProject, setStagedProject] = useState<CardDesignerProject | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshPresets = () => {
    setPresets(getAllPresets());
  };

  useEffect(() => {
    if (isOpen) {
      refreshPresets();
      setErrorMessage(null);
      setSuccessMessage(null);
      setReplacingSlotId(null);
      setStagedProject(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const defaultSlots = presets.filter((p) => p.slotId);
  const customPresets = presets.filter((p) => !p.slotId);

  // Handle file selection (either for replacing a default slot or adding a new preset)
  const handleFileSelect = async (file: File, targetSlotId?: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsProcessing(true);

    try {
      const { project, name, description } = await validateAndParsePresetFile(file);

      if (targetSlotId) {
        replaceDefaultSlot(targetSlotId, name, description, project);
        refreshPresets();
        setSuccessMessage(`Preset slot updated with "${name}". Changes saved to disk.`);
        setReplacingSlotId(null);
      } else {
        // Stage for new custom preset
        setStagedProject(project);
        setNewPresetName(name);
        setNewPresetDesc(description);
        setActiveTab("custom-presets");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to process preset file.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Replace default slot with currently open canvas project
  const handleReplaceWithCurrentCanvas = (slotId: string) => {
    const slot = defaultSlots.find((s) => s.slotId === slotId);
    const name = activeProject.name || (slot ? `${slot.originalName || slot.name} (Custom)` : "Custom Card");
    const desc = activeProject.description || "Customized from current studio canvas.";

    replaceDefaultSlot(slotId, name, desc, activeProject);
    refreshPresets();
    setSuccessMessage(`Default slot "${name}" replaced with current canvas project.`);
  };

  // Reset default slot back to factory preset
  const handleResetSlot = (slotId: string) => {
    resetDefaultSlot(slotId);
    refreshPresets();
    setSuccessMessage("Preset slot restored to original built-in default.");
  };

  // Save staged project or current canvas as new custom preset
  const handleSaveCustomPreset = () => {
    const projectToSave = stagedProject || activeProject;
    const name = newPresetName.trim() || projectToSave.name || "Custom ID Card Preset";
    const desc = newPresetDesc.trim() || projectToSave.description || "User-saved custom card preset";

    addCustomPreset(name, desc, projectToSave);
    refreshPresets();
    setStagedProject(null);
    setNewPresetName("");
    setNewPresetDesc("");
    setSuccessMessage(`Custom preset "${name}" added successfully.`);
  };

  const handleDeleteCustom = (id: string) => {
    deleteCustomPreset(id);
    refreshPresets();
    setSuccessMessage("Custom preset removed.");
  };

  const handleApply = (preset: CardPresetItem) => {
    const project = loadPresetProject(preset);
    if (applyHandler) {
      applyHandler(project);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".ocard,.json,image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFileSelect(file, replacingSlotId || undefined);
            }
          }}
        />

        {/* Modal Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Preset & Template Manager</h2>
              <p className="text-[11px] text-neutral-400">
                Replace built-in slots or upload and persist your custom templates
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

        {/* Notification Banners */}
        {errorMessage && (
          <div className="p-3 bg-red-950/80 border-b border-red-800/80 text-red-200 text-xs flex items-center space-x-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-white text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-950/80 border-b border-emerald-800/80 text-emerald-200 text-xs flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="flex-1">{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-400 hover:text-white text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-neutral-800 bg-neutral-950/40 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("default-slots")}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === "default-slots"
                ? "border-sky-500 text-sky-400"
                : "border-transparent text-neutral-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Default Preset Slots ({defaultSlots.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("custom-presets")}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === "custom-presets"
                ? "border-sky-500 text-sky-400"
                : "border-transparent text-neutral-400 hover:text-white"
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>My Custom Presets ({customPresets.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === "default-slots" && (
            <div className="space-y-3">
              <div className="text-xs text-neutral-400 leading-relaxed bg-neutral-950/50 p-3 rounded-xl border border-neutral-800 flex items-start space-x-2">
                <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-neutral-200">Replaceable Preset Slots:</strong> You can replace any of the 4 default presets with your own native .ocard project or card artwork file. When replaced, your custom design takes that slot&apos;s place everywhere in the studio. You can revert back to the original built-in template at any time.
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {defaultSlots.map((slot) => {
                  const isReplaced = !!slot.isReplacedSlot;
                  return (
                    <div
                      key={slot.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isReplaced
                          ? "bg-sky-950/20 border-sky-600/50"
                          : "bg-neutral-950/60 border-neutral-800"
                      } flex flex-col md:flex-row md:items-center justify-between gap-3`}
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-xs font-bold text-white">{slot.name}</h3>
                          {isReplaced ? (
                            <span className="px-2 py-0.5 bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded-full text-[10px] font-bold">
                              User Replaced
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded-full text-[10px] font-medium">
                              Built-in Factory
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 leading-snug">
                          {slot.description}
                        </p>
                        {isReplaced && slot.originalName && (
                          <div className="text-[10px] text-neutral-500">
                            Replaces original slot: <em>{slot.originalName}</em>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center flex-wrap gap-2 shrink-0">
                        {/* Apply Preset */}
                        <button
                          type="button"
                          onClick={() => handleApply(slot)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors"
                          title="Load this preset into canvas"
                        >
                          Apply
                        </button>

                        {/* Replace with Uploaded File */}
                        <button
                          type="button"
                          onClick={() => {
                            if (slot.slotId) {
                              setReplacingSlotId(slot.slotId);
                              fileInputRef.current?.click();
                            }
                          }}
                          className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-medium transition-colors border border-neutral-700 flex items-center space-x-1"
                          title="Upload .ocard or image to take this slot"
                        >
                          <Upload className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Replace File</span>
                        </button>

                        {/* Replace with Current Studio Project */}
                        <button
                          type="button"
                          onClick={() => slot.slotId && handleReplaceWithCurrentCanvas(slot.slotId)}
                          className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-medium transition-colors border border-neutral-700 flex items-center space-x-1"
                          title="Replace this slot with the project currently open on your canvas"
                        >
                          <Copy className="w-3.5 h-3.5 text-amber-400" />
                          <span>Use Canvas</span>
                        </button>

                        {/* Revert back to original default */}
                        {isReplaced && slot.slotId && (
                          <button
                            type="button"
                            onClick={() => handleResetSlot(slot.slotId!)}
                            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-red-950/60 text-red-300 hover:text-red-200 rounded-lg text-xs font-medium transition-colors border border-red-900/50 flex items-center space-x-1"
                            title="Restore this preset to original factory template"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "custom-presets" && (
            <div className="space-y-4">
              {/* Creator Card */}
              <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Plus className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-white">Add New Custom Preset</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Upload File button */}
                    <button
                      type="button"
                      onClick={() => {
                        setReplacingSlotId(null);
                        fileInputRef.current?.click();
                      }}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded-lg font-medium border border-neutral-700 flex items-center space-x-1"
                    >
                      <Upload className="w-3 h-3 text-sky-400" />
                      <span>Upload File</span>
                    </button>
                    {/* Use Canvas button */}
                    <button
                      type="button"
                      onClick={() => {
                        setStagedProject(activeProject);
                        setNewPresetName(activeProject.name || "Custom Card Preset");
                        setNewPresetDesc(activeProject.description || "Saved from current canvas design");
                      }}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded-lg font-medium border border-neutral-700 flex items-center space-x-1"
                    >
                      <Copy className="w-3 h-3 text-amber-400" />
                      <span>Use Current Canvas</span>
                    </button>
                  </div>
                </div>

                {stagedProject ? (
                  <div className="space-y-3 pt-2 border-t border-neutral-800/80">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                          Preset Name
                        </label>
                        <input
                          type="text"
                          value={newPresetName}
                          onChange={(e) => setNewPresetName(e.target.value)}
                          placeholder="e.g. Executive VIP Badge"
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-sky-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={newPresetDesc}
                          onChange={(e) => setNewPresetDesc(e.target.value)}
                          placeholder="e.g. Custom front photo with QR security"
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setStagedProject(null);
                          setNewPresetName("");
                          setNewPresetDesc("");
                        }}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCustomPreset}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Custom Preset</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-neutral-800 rounded-xl p-4 text-center text-xs text-neutral-400">
                    Upload a <strong>.ocard</strong> project file or image (PNG/JPG/SVG), or click <strong>Use Current Canvas</strong> to turn your active design into a reusable custom preset.
                  </div>
                )}
              </div>

              {/* Presets List */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider px-1">
                  Saved Custom Presets ({customPresets.length})
                </div>

                {customPresets.length === 0 ? (
                  <div className="p-8 text-center text-neutral-500 text-xs border border-neutral-800/80 rounded-xl bg-neutral-950/30">
                    No custom standalone presets yet. Upload a project file or save your active design above.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {customPresets.map((cp) => (
                      <div
                        key={cp.id}
                        className="p-3 rounded-xl border border-neutral-800 bg-neutral-950/60 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">{cp.name}</h4>
                          <p className="text-[11px] text-neutral-400 truncate">{cp.description}</p>
                          <div className="text-[10px] text-neutral-500">
                            Saved {new Date(cp.updatedAt).toLocaleDateString()}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleApply(cp)}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            Apply
                          </button>

                          {cp.projectData && (
                            <button
                              type="button"
                              onClick={() => saveProjectToDisk(cp.projectData!)}
                              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors border border-neutral-700"
                              title="Export / Download as .ocard"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteCustom(cp.id)}
                            className="p-1.5 bg-neutral-800 hover:bg-red-950/80 text-neutral-400 hover:text-red-300 rounded-lg transition-colors border border-neutral-700"
                            title="Delete custom preset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between text-xs text-neutral-400">
          <span>Presets are securely persisted in local storage and available whenever you open the studio.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
