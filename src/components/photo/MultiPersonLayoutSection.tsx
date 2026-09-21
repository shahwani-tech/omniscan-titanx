/**
 * OMNISCAN TITAN X - Multi-Person Layout Section
 * Manages multiple person groups, slot count controls, distribution bar,
 * quick split presets, layout modes, and per-person photo status.
 */

import React, { useState } from "react";
import {
  MultiPersonSlotGroup,
  MultiPersonLayoutMode,
  MAX_PERSONS_PER_SHEET,
  validateSlotCounts,
  computeEqualSplit,
} from "../../engine/multiPersonLayout";
import {
  Users,
  Plus,
  Trash2,
  Upload,
  Crop,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Palette,
  Columns,
  Layers,
  Move,
  Info,
  Check,
} from "lucide-react";

interface MultiPersonLayoutSectionProps {
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  persons: MultiPersonSlotGroup[];
  totalSheetCapacity: number;
  layoutMode: MultiPersonLayoutMode;
  onChangeLayoutMode: (mode: MultiPersonLayoutMode) => void;
  onAddPerson: () => void;
  onRemovePerson: (personId: string) => void;
  onUpdatePersonLabel: (personId: string, label: string) => void;
  onUpdatePersonSlotCount: (personId: string, count: number) => void;
  onOpenPhotoPicker: (person: MultiPersonSlotGroup) => void;
  onOpenBgStudio?: (person: MultiPersonSlotGroup) => void;
  onOpenBgComposer?: (person: MultiPersonSlotGroup) => void;
  onSplitEqual: () => void;
  showPersonLabelsOnSheet: boolean;
  onToggleShowPersonLabels: (show: boolean) => void;
  showToast: (message: string) => void;
}

export const MultiPersonLayoutSection: React.FC<MultiPersonLayoutSectionProps> = ({
  enabled,
  onToggleEnabled,
  persons,
  totalSheetCapacity,
  layoutMode,
  onChangeLayoutMode,
  onAddPerson,
  onRemovePerson,
  onUpdatePersonLabel,
  onUpdatePersonSlotCount,
  onOpenPhotoPicker,
  onOpenBgStudio,
  onOpenBgComposer,
  onSplitEqual,
  showPersonLabelsOnSheet,
  onToggleShowPersonLabels,
  showToast,
}) => {
  const [promptResplit, setPromptResplit] = useState<{
    current: string;
    equal: string;
  } | null>(null);

  const validation = validateSlotCounts(persons, totalSheetCapacity);
  const remainingSlots = validation.remainingSlots;
  const isFull = validation.totalAssigned >= totalSheetCapacity;
  const maxPersonsAllowed = Math.min(MAX_PERSONS_PER_SHEET, totalSheetCapacity);

  // Check how many persons have "Ready" status
  const readyCount = persons.filter((p) => p.status === "ready" && p.photoUrl).length;
  const allReady = persons.length > 0 && readyCount === persons.length;

  const handleSlotCountChange = (person: MultiPersonSlotGroup, delta: number) => {
    const nextVal = person.slotCount + delta;
    if (nextVal < 1) {
      showToast("Minimum 1 slot per person. Use the (×) button to remove.");
      return;
    }
    if (delta > 0 && remainingSlots <= 0) {
      showToast(`Only ${totalSheetCapacity} slots available on this sheet.`);
      return;
    }
    const maxPossible = person.slotCount + remainingSlots;
    const finalVal = Math.min(nextVal, maxPossible);
    onUpdatePersonSlotCount(person.id, finalVal);
  };

  const handleManualSlotCountInput = (person: MultiPersonSlotGroup, val: number) => {
    if (isNaN(val) || val < 1) return;
    const maxPossible = person.slotCount + remainingSlots;
    if (val > maxPossible) {
      showToast(`Only ${maxPossible} slots can be allocated to this person.`);
      onUpdatePersonSlotCount(person.id, maxPossible);
    } else {
      onUpdatePersonSlotCount(person.id, val);
    }
  };

  const getStatusBadge = (person: MultiPersonSlotGroup) => {
    const hasPhoto = Boolean(
      person.compositedPhotoUrl ||
      person.photoUrl ||
      person.croppedPhotoUrl ||
      person.rawPhotoUrl
    );

    if (!hasPhoto) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-rose-950/70 text-rose-300 border border-rose-800 flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          <span>Upload photo</span>
        </span>
      );
    }
    if (person.compositedPhotoUrl || (person.bgStudioState && (person.photoUrl || person.croppedPhotoUrl))) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800 flex items-center space-x-1">
          <CheckCircle2 className="w-2.5 h-2.5" />
          <span>Ready ✓</span>
        </span>
      );
    }
    if (person.croppedPhotoUrl || (person.photoUrl && person.cropState)) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800 flex items-center space-x-1">
          <AlertCircle className="w-2.5 h-2.5" />
          <span>BG not set</span>
        </span>
      );
    }
    if (person.rawPhotoUrl) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-950/60 text-amber-400 border border-amber-800 flex items-center space-x-1">
          <Clock className="w-2.5 h-2.5" />
          <span>Crop needed</span>
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800 flex items-center space-x-1">
        <CheckCircle2 className="w-2.5 h-2.5" />
        <span>Ready ✓</span>
      </span>
    );
  };

  return (
    <div className="bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden shadow-lg space-y-3 p-3">
      {/* Header & Toggle */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-850">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-sky-950/80 border border-sky-700/50 flex items-center justify-center text-sky-400 shadow-sm">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-white">Multi-Person Layout</span>
              {persons.length > 1 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-900/60 text-sky-300 font-mono">
                  {persons.length} Persons
                </span>
              )}
            </div>
            <p className="text-[10px] text-neutral-400">
              Combine different passport photos on a single print sheet
            </p>
          </div>
        </div>

        {/* Add Person Button */}
        <button
          onClick={onAddPerson}
          disabled={persons.length >= maxPersonsAllowed || remainingSlots <= 0}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all shadow ${
            persons.length >= maxPersonsAllowed || remainingSlots <= 0
              ? "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700"
              : "bg-sky-600 hover:bg-sky-500 text-white hover:shadow-sky-500/20 active:scale-98"
          }`}
          title={
            remainingSlots <= 0
              ? "Sheet full: reduce slots on other persons first"
              : `Add new person (Max ${maxPersonsAllowed})`
          }
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Add Person</span>
        </button>
      </div>

      {/* Visual Slot Distribution Bar */}
      <div className="space-y-1.5 bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-850">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-neutral-400 font-medium">Slot Distribution</span>
          <span className="font-mono text-xs">
            <span
              className={
                validation.exceeds
                  ? "text-rose-400 font-bold"
                  : remainingSlots === 0
                  ? "text-emerald-400 font-bold"
                  : "text-neutral-300"
              }
            >
              {validation.totalAssigned}
            </span>
            <span className="text-neutral-500"> / {totalSheetCapacity} slots used</span>
            {remainingSlots > 0 && (
              <span className="text-amber-400/90 ml-1.5 font-sans text-[10px]">
                ({remainingSlots} unassigned)
              </span>
            )}
          </span>
        </div>

        {/* Multi-Segment Color Bar */}
        <div className="h-3 w-full bg-neutral-800 rounded-full overflow-hidden flex border border-neutral-700/60 shadow-inner">
          {persons.map((p) => {
            const widthPct = Math.max(0, (p.slotCount / totalSheetCapacity) * 100);
            return (
              <div
                key={p.id}
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: p.color,
                }}
                className="h-full transition-all duration-300 relative group cursor-pointer hover:opacity-90 border-r border-black/30"
                title={`${p.label}: ${p.slotCount} slots (${Math.round(widthPct)}%)`}
              />
            );
          })}
          {remainingSlots > 0 && (
            <div
              style={{
                width: `${(remainingSlots / totalSheetCapacity) * 100}%`,
              }}
              className="h-full bg-neutral-800/80 repeating-linear-gradient flex items-center justify-center text-[8px] text-neutral-500 font-mono"
              title={`${remainingSlots} slots unassigned (prints blank)`}
            />
          )}
        </div>

        {/* Person Legend & Distribution Counts */}
        <div className="flex flex-wrap gap-2 pt-1">
          {persons.map((p) => (
            <div
              key={p.id}
              className="flex items-center space-x-1.5 text-[10px] text-neutral-300 bg-neutral-950/70 px-2 py-0.5 rounded border border-neutral-800"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <span className="font-medium truncate max-w-[80px]">{p.label}:</span>
              <span className="font-mono text-white font-semibold">{p.slotCount}</span>
            </div>
          ))}
          {remainingSlots > 0 && (
            <div className="flex items-center space-x-1 text-[10px] text-neutral-400 bg-neutral-950/50 px-2 py-0.5 rounded border border-dashed border-neutral-800">
              <span className="w-2 h-2 rounded-full border border-dashed border-neutral-500 shrink-0" />
              <span>Blank: {remainingSlots}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Split Presets & Layout Modes */}
      <div className="grid grid-cols-2 gap-2">
        {/* Quick Split Buttons */}
        <div className="bg-neutral-900/50 p-2 rounded-lg border border-neutral-850 space-y-1">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
            Split Presets
          </span>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={onSplitEqual}
              className="flex-1 py-1 px-2 rounded bg-neutral-800 hover:bg-neutral-700 text-sky-400 hover:text-sky-300 text-[11px] font-semibold transition-colors border border-neutral-700 flex items-center justify-center space-x-1"
              title="Divide slots equally among all persons (Ctrl+E)"
            >
              <Sparkles className="w-3 h-3" />
              <span>Split Equal</span>
            </button>
          </div>
        </div>

        {/* Layout Modes */}
        <div className="bg-neutral-900/50 p-2 rounded-lg border border-neutral-850 space-y-1">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
            Layout Arrangement
          </span>
          <div className="flex items-center space-x-1 bg-neutral-950 rounded p-0.5 border border-neutral-800">
            <button
              onClick={() => onChangeLayoutMode("grouped")}
              className={`flex-1 py-1 rounded text-[10px] font-medium flex items-center justify-center space-x-1 transition-colors ${
                layoutMode === "grouped"
                  ? "bg-sky-600 text-white font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
              title="Group all of Person A together, then Person B"
            >
              <Layers className="w-3 h-3" />
              <span>Grouped</span>
            </button>
            <button
              onClick={() => onChangeLayoutMode("alternating")}
              className={`flex-1 py-1 rounded text-[10px] font-medium flex items-center justify-center space-x-1 transition-colors ${
                layoutMode === "alternating"
                  ? "bg-sky-600 text-white font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
              title="Alternate photos between persons across the grid"
            >
              <Columns className="w-3 h-3" />
              <span>Alternate</span>
            </button>
            <button
              onClick={() => onChangeLayoutMode("custom")}
              className={`flex-1 py-1 rounded text-[10px] font-medium flex items-center justify-center space-x-1 transition-colors ${
                layoutMode === "custom"
                  ? "bg-sky-600 text-white font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
              title="Click or drag individual slots in the preview to customize"
            >
              <Move className="w-3 h-3" />
              <span>Custom</span>
            </button>
          </div>
        </div>
      </div>

      {/* Per-Person Rows */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-neutral-400 uppercase tracking-wider px-1">
          <span>Person Groups ({persons.length})</span>
          <span className="text-[10px] text-neutral-500 font-normal">
            Drag cards to preview slots
          </span>
        </div>

        <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-0.5">
          {persons.map((person, idx) => {
            const displayPhoto =
              person.compositedPhotoUrl ||
              person.photoUrl ||
              person.croppedPhotoUrl ||
              person.rawPhotoUrl;
            const hasPhoto = Boolean(displayPhoto);

            return (
              <div
                key={person.id}
                id={`person-row-${person.id}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-person-id", person.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-xl p-2.5 flex items-center justify-between space-x-2.5 transition-colors group cursor-grab active:cursor-grabbing shadow-sm"
              >
                {/* Left: Person Photo Thumbnail */}
                <div
                  onClick={() => onOpenPhotoPicker(person)}
                  className="relative w-10 h-12 rounded-lg bg-neutral-950 border border-neutral-700 overflow-hidden shrink-0 cursor-pointer group-hover:border-sky-500 transition-colors flex items-center justify-center shadow-inner"
                  title="Click to change or retouch photo"
                >
                  {hasPhoto ? (
                    <img
                      src={displayPhoto!}
                      alt={person.label}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-neutral-500 p-1">
                      <Upload className="w-3.5 h-3.5 mb-0.5 text-neutral-400" />
                      <span className="text-[8px] font-bold">Add</span>
                    </div>
                  )}
                  {/* Person Color Indicator */}
                  <span
                    className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full border border-black/40 shadow-sm"
                    style={{ backgroundColor: person.color }}
                  />
                </div>

                {/* Independent Background Preview Thumbnail */}
                <div
                  onClick={() => onOpenBgComposer?.(person)}
                  className="relative w-8 h-12 rounded-lg bg-neutral-950 border border-neutral-750 overflow-hidden shrink-0 cursor-pointer hover:border-violet-400 transition-all flex flex-col items-center justify-center shadow-inner group/bg"
                  title={
                    person.bgStudioState?.backgroundMode === "color"
                      ? `Background: Solid ${person.bgStudioState.backgroundColor} (Click to edit)`
                      : person.bgStudioState?.backgroundMode === "gradient"
                      ? `Background: Gradient (Click to edit)`
                      : person.bgStudioState?.backgroundMode === "image"
                      ? `Background: Custom Image (Click to edit)`
                      : "Independent Background (Click to edit)"
                  }
                >
                  {person.bgStudioState?.backgroundMode === "color" ? (
                    <div
                      className="w-full h-full"
                      style={{ backgroundColor: person.bgStudioState.backgroundColor }}
                    />
                  ) : person.bgStudioState?.backgroundMode === "gradient" && person.bgStudioState.backgroundGradient ? (
                    <div
                      className="w-full h-full"
                      style={{
                        background:
                          person.bgStudioState.backgroundGradient.type === "radial"
                            ? `radial-gradient(circle, ${person.bgStudioState.backgroundGradient.color1}, ${person.bgStudioState.backgroundGradient.color2})`
                            : `linear-gradient(${person.bgStudioState.backgroundGradient.angle || 135}deg, ${person.bgStudioState.backgroundGradient.color1}, ${person.bgStudioState.backgroundGradient.color2})`,
                      }}
                    />
                  ) : person.bgStudioState?.backgroundMode === "image" && person.bgStudioState.backgroundImage ? (
                    <img
                      src={person.bgStudioState.backgroundImage}
                      alt="BG"
                      className="w-full h-full object-cover"
                    />
                  ) : person.bgStudioState?.backgroundMode === "transparent" ? (
                    <div className="w-full h-full bg-[radial-gradient(#404040_1px,transparent_1px)] [background-size:4px_4px]" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-neutral-500 p-0.5 group-hover/bg:text-violet-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="text-[7px] font-medium leading-none mt-0.5">BG</span>
                    </div>
                  )}
                </div>

                {/* Center: Person Name Input & Status */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={person.label}
                      onChange={(e) => onUpdatePersonLabel(person.id, e.target.value)}
                      placeholder={`Person ${idx + 1}`}
                      className="w-full bg-neutral-950/80 border border-neutral-750 focus:border-sky-500 rounded px-2 py-0.5 text-xs text-white font-medium focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(person)}
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {person.slotCount} slot{person.slotCount > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Right: Slot Count Stepper */}
                <div className="flex items-center space-x-1 shrink-0 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => handleSlotCountChange(person, -1)}
                    disabled={person.slotCount <= 1}
                    className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-colors ${
                      person.slotCount <= 1
                        ? "text-neutral-600 cursor-not-allowed"
                        : "text-neutral-300 hover:text-white hover:bg-neutral-800"
                    }`}
                    title="Decrease slots"
                  >
                    -
                  </button>

                  <input
                    type="number"
                    min="1"
                    max={person.slotCount + remainingSlots}
                    value={person.slotCount}
                    onChange={(e) => handleManualSlotCountInput(person, Number(e.target.value))}
                    className="w-10 bg-transparent text-center text-xs font-mono font-bold text-white focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => handleSlotCountChange(person, 1)}
                    disabled={remainingSlots <= 0}
                    className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-colors ${
                      remainingSlots <= 0
                        ? "text-neutral-600 cursor-not-allowed"
                        : "text-neutral-300 hover:text-white hover:bg-neutral-800"
                    }`}
                    title={
                      remainingSlots <= 0
                        ? "Sheet full: reduce other persons first"
                        : "Increase slots"
                    }
                  >
                    +
                  </button>
                </div>

                {/* Upload / Retouch Button */}
                <button
                  type="button"
                  onClick={() => onOpenPhotoPicker(person)}
                  className={`p-1.5 rounded-lg border text-xs font-medium flex items-center space-x-1 shrink-0 transition-colors ${
                    hasPhoto
                      ? "bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border-neutral-700"
                      : "bg-sky-600 hover:bg-sky-500 text-white border-sky-400 font-bold shadow"
                  }`}
                  title={hasPhoto ? "Re-crop / retouch photo" : "Upload photo for this person"}
                >
                  {hasPhoto ? <Crop className="w-3.5 h-3.5 text-sky-400" /> : <Upload className="w-3.5 h-3.5" />}
                  <span className="text-[11px] hidden sm:inline">
                    {hasPhoto ? "Crop" : "Upload"}
                  </span>
                </button>

                {/* Edit BG Button per person */}
                {(() => {
                  const isCropped = Boolean(
                    person.croppedPhotoUrl ||
                    person.compositedPhotoUrl ||
                    (person.photoUrl && person.photoUrl !== person.rawPhotoUrl) ||
                    person.status === "cropped" ||
                    person.status === "needs-background" ||
                    person.status === "ready"
                  );

                  const isBgSet = Boolean(
                    person.compositedPhotoUrl ||
                    (person.bgStudioState &&
                      (person.bgStudioState.backgroundMode !== "transparent" ||
                        person.bgStudioState.backgroundColor !== "#FFFFFF" ||
                        person.bgStudioState.backgroundImage ||
                        person.bgStudioState.backgroundGradient))
                  );

                  return (
                    <button
                      type="button"
                      disabled={!isCropped}
                      onClick={() => isCropped && (onOpenBgStudio || onOpenBgComposer)?.(person)}
                      className={`p-1.5 rounded-lg border text-xs font-medium flex items-center space-x-1 shrink-0 transition-all ${
                        !isCropped
                          ? "opacity-50 cursor-not-allowed bg-neutral-900 text-neutral-600 border-neutral-800"
                          : isBgSet
                          ? "bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border-emerald-700 font-semibold shadow-sm"
                          : "bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border-neutral-700 hover:border-violet-500 hover:text-violet-300"
                      }`}
                      title={
                        !isCropped
                          ? "Crop photo first before setting background"
                          : isBgSet
                          ? `Edit background for ${person.label} (Background active)`
                          : `Edit background for ${person.label}`
                      }
                    >
                      <Palette
                        className={`w-3.5 h-3.5 ${
                          !isCropped
                            ? "text-neutral-600"
                            : isBgSet
                            ? "text-emerald-400"
                            : "text-violet-400"
                        }`}
                      />
                      <span className="text-[11px] hidden sm:inline">
                        {isBgSet ? "Edit BG ✓" : "Edit BG"}
                      </span>
                    </button>
                  );
                })()}

                {/* Remove Person Button */}
                {persons.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemovePerson(person.id)}
                    className="p-1.5 text-neutral-500 hover:text-rose-400 rounded-lg hover:bg-neutral-800 transition-colors shrink-0"
                    title={`Remove ${person.label}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sheet Label Toggle Option */}
      <div className="pt-2 border-t border-neutral-850 flex items-center justify-between text-xs text-neutral-300">
        <label className="flex items-center space-x-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showPersonLabelsOnSheet}
            onChange={(e) => onToggleShowPersonLabels(e.target.checked)}
            className="rounded border-neutral-700 bg-neutral-900 text-sky-500 focus:ring-sky-500 w-3.5 h-3.5"
          />
          <span className="text-[11px] text-neutral-300 font-medium">
            Print person labels below each photo
          </span>
        </label>
        <span className="text-[10px] text-neutral-500">
          {readyCount}/{persons.length} ready
        </span>
      </div>

      {/* Print Readiness Warning (if any person lacks photo) */}
      {!allReady && (
        <div className="p-2 bg-amber-950/30 border border-amber-800/50 rounded-lg flex items-center space-x-2 text-amber-300 text-[11px]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>
            {persons.length - readyCount} person(s) still need a photo before printing.
          </span>
        </div>
      )}
    </div>
  );
};
