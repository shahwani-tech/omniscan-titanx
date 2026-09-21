/**
 * OMNISCAN TITAN X - Interactive Sheet Slot Overlay
 * Color-coded visual overlay on top of the print sheet preview.
 * Supports clicking, hover tooltips, drag & drop assignment, and context menu reassignment.
 */

import React, { useState, useEffect, useRef } from "react";
import { PhotoInstancePosition } from "../../types";
import { MultiPersonSlotGroup } from "../../engine/multiPersonLayout";
import { User, X, Check, MousePointerClick } from "lucide-react";

interface InteractiveSheetSlotOverlayProps {
  positions: PhotoInstancePosition[];
  slotMapping: string[]; // index -> personId or 'empty'
  persons: MultiPersonSlotGroup[];
  paperWidthInches: number;
  paperHeightInches: number;
  selectedSlotIndex: number | null;
  onSelectSlot: (index: number | null) => void;
  onAssignSlot: (slotIndex: number, personId: string | "empty") => void;
  showOverlays: boolean;
}

export const InteractiveSheetSlotOverlay: React.FC<InteractiveSheetSlotOverlayProps> = ({
  positions,
  slotMapping,
  persons,
  paperWidthInches,
  paperHeightInches,
  selectedSlotIndex,
  onSelectSlot,
  onAssignSlot,
  showOverlays,
}) => {
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    slotIndex: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };
    window.addEventListener("click", handleOutside);
    return () => window.removeEventListener("click", handleOutside);
  }, [contextMenu]);

  if (!showOverlays || positions.length === 0 || paperWidthInches <= 0 || paperHeightInches <= 0) {
    return null;
  }

  // Helper to get person details by id
  const getPerson = (personId: string): MultiPersonSlotGroup | undefined => {
    return persons.find((p) => p.id === personId);
  };

  // Calculate per-person total slots and slot instance index
  const getSlotTooltip = (index: number, personId: string) => {
    if (personId === "empty" || !personId) {
      return `Slot #${index + 1} — Unassigned (prints blank)`;
    }
    const person = getPerson(personId);
    if (!person) return `Slot #${index + 1}`;

    // Count which instance of this person this is
    let countSoFar = 0;
    for (let i = 0; i <= index; i++) {
      if (slotMapping[i] === personId) {
        countSoFar++;
      }
    }
    const totalSlotsForPerson = slotMapping.filter((p) => p === personId).length;
    return `${person.label} — Slot ${countSoFar} of ${totalSlotsForPerson}`;
  };

  const handleContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectSlot(index);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setContextMenu({
        x: Math.min(rect.width - 160, Math.max(10, e.clientX - rect.left)),
        y: Math.min(rect.height - 180, Math.max(10, e.clientY - rect.top)),
        slotIndex: index,
      });
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedPersonId = e.dataTransfer.getData("application/x-person-id");
    if (droppedPersonId) {
      onAssignSlot(targetIndex, droppedPersonId);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none select-none z-10"
      id="sheet-interactive-slot-overlay"
    >
      {positions.map((pos) => {
        const slotPersonId = slotMapping[pos.index] || "empty";
        const person = getPerson(slotPersonId);
        const isEmpty = slotPersonId === "empty" || !person;
        const isSelected = selectedSlotIndex === pos.index;
        const isHovered = hoveredSlotIndex === pos.index;

        const leftPercent = (pos.xInches / paperWidthInches) * 100;
        const topPercent = (pos.yInches / paperHeightInches) * 100;
        const widthPercent = (pos.widthInches / paperWidthInches) * 100;
        const heightPercent = (pos.heightInches / paperHeightInches) * 100;

        const borderColor = isEmpty ? "rgba(148, 163, 184, 0.4)" : person.color;
        const bgColor = isSelected
          ? isEmpty
            ? "rgba(148, 163, 184, 0.2)"
            : `${person.color}25`
          : isHovered
          ? isEmpty
            ? "rgba(148, 163, 184, 0.15)"
            : `${person.color}18`
          : "transparent";

        return (
          <div
            key={pos.id}
            id={`interactive-slot-${pos.index}`}
            className={`absolute pointer-events-auto transition-all duration-150 cursor-pointer flex flex-col justify-between p-1 rounded ${
              isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-neutral-900 shadow-xl" : ""
            }`}
            style={{
              left: `${leftPercent}%`,
              top: `${topPercent}%`,
              width: `${widthPercent}%`,
              height: `${heightPercent}%`,
              border: `2px ${isEmpty ? "dashed" : "solid"} ${borderColor}`,
              backgroundColor: bgColor,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectSlot(isSelected ? null : pos.index);
            }}
            onContextMenu={(e) => handleContextMenu(e, pos.index)}
            onMouseEnter={() => setHoveredSlotIndex(pos.index)}
            onMouseLeave={() => setHoveredSlotIndex(null)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, pos.index)}
            title={getSlotTooltip(pos.index, slotPersonId)}
          >
            {/* Top Badge: Person Label or Slot Index */}
            <div className="flex items-center justify-between w-full pointer-events-none slot-person-label interactive-slot-badge">
              <span
                className="text-[9px] font-bold px-1 py-0.2 rounded shadow-sm text-white truncate max-w-[85%]"
                style={{
                  backgroundColor: isEmpty ? "#64748B" : person.color,
                }}
              >
                {isEmpty ? `Empty #${pos.index + 1}` : person.label}
              </span>
              <span className="text-[8px] font-mono text-neutral-800/80 bg-white/70 px-0.5 rounded">
                #{pos.index + 1}
              </span>
            </div>

            {/* Hover Tooltip Overlay */}
            {isHovered && (
              <div className="absolute inset-x-1 bottom-1 pointer-events-none bg-neutral-950/90 backdrop-blur-sm border border-neutral-700 text-white rounded px-1.5 py-0.5 text-[9px] shadow-lg flex items-center justify-between z-20">
                <span className="truncate">{getSlotTooltip(pos.index, slotPersonId)}</span>
                <span className="text-[8px] text-sky-400 shrink-0 ml-1">Click to edit</span>
              </div>
            )}
          </div>
        );
      })}

      {/* Selected Slot Quick Bar */}
      {selectedSlotIndex !== null && positions[selectedSlotIndex] && (
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-auto bg-neutral-950/95 border border-sky-500/80 text-white rounded-lg px-3 py-1.5 shadow-2xl flex items-center space-x-2.5 z-30 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center space-x-1.5 text-xs">
            <MousePointerClick className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-semibold text-sky-200">
              Slot #{selectedSlotIndex + 1}:
            </span>
          </div>

          {/* Quick person selector */}
          <div className="flex items-center space-x-1">
            {persons.map((p) => {
              const isAssigned = slotMapping[selectedSlotIndex] === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onAssignSlot(selectedSlotIndex, p.id)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center space-x-1 transition-colors border ${
                    isAssigned
                      ? "text-white border-white shadow"
                      : "text-neutral-300 border-transparent hover:border-neutral-700 hover:text-white"
                  }`}
                  style={{
                    backgroundColor: isAssigned ? p.color : `${p.color}30`,
                  }}
                  title={`Assign to ${p.label}`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span>{p.label}</span>
                  {isAssigned && <Check className="w-2.5 h-2.5 ml-0.5" />}
                </button>
              );
            })}

            <button
              onClick={() => onAssignSlot(selectedSlotIndex, "empty")}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors border ${
                slotMapping[selectedSlotIndex] === "empty"
                  ? "bg-neutral-800 text-white border-neutral-600 font-bold"
                  : "text-neutral-400 hover:text-white border-neutral-800 hover:bg-neutral-800"
              }`}
              title="Mark slot as unassigned (prints blank)"
            >
              Unassign (Empty)
            </button>
          </div>

          <button
            onClick={() => onSelectSlot(null)}
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
            title="Deselect slot (Escape)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div
          className="absolute pointer-events-auto bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl p-1.5 z-40 text-xs w-48 animate-in fade-in zoom-in-95 duration-100"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 mb-1 flex items-center justify-between">
            <span>Assign Slot #{contextMenu.slotIndex + 1}</span>
            <button
              onClick={() => setContextMenu(null)}
              className="text-neutral-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-0.5">
            {persons.map((p) => {
              const isAssigned = slotMapping[contextMenu.slotIndex] === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    onAssignSlot(contextMenu.slotIndex, p.id);
                    setContextMenu(null);
                  }}
                  className={`w-full px-2 py-1.5 rounded flex items-center justify-between text-left transition-colors ${
                    isAssigned
                      ? "bg-neutral-800 text-white font-semibold"
                      : "hover:bg-neutral-800/60 text-neutral-300 hover:text-white"
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="truncate">{p.label}</span>
                  </div>
                  {isAssigned && <Check className="w-3 h-3 text-sky-400 shrink-0 ml-1" />}
                </button>
              );
            })}

            <div className="border-t border-neutral-800 my-1" />

            <button
              onClick={() => {
                onAssignSlot(contextMenu.slotIndex, "empty");
                setContextMenu(null);
              }}
              className={`w-full px-2 py-1.5 rounded flex items-center justify-between text-left transition-colors ${
                slotMapping[contextMenu.slotIndex] === "empty"
                  ? "bg-neutral-800 text-white font-semibold"
                  : "hover:bg-neutral-800/60 text-neutral-400 hover:text-white"
              }`}
            >
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full border border-dashed border-neutral-500 shrink-0" />
                <span>Unassign (Blank Slot)</span>
              </div>
              {slotMapping[contextMenu.slotIndex] === "empty" && (
                <Check className="w-3 h-3 text-neutral-400 shrink-0 ml-1" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
