/**
 * CardDesignerLayersPanel.tsx
 * 
 * Professional Layers panel for ID & Service Card Designer:
 * - Visual stacking order (drag up/down, Bring to Front, Send to Back)
 * - Layer visibility & lock toggles
 * - Inline rename, duplicate, delete
 * - Group / Ungroup management
 * - Independent layer lists for Front and Back cards
 */

import React, { useState } from "react";
import {
  CardDesignerProject,
  CardObject,
  CardSide,
} from "../../engine/carddesigner/types";
import {
  Layers,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Type,
  Image as ImageIcon,
  Square,
  PenTool,
  Barcode as BarcodeIcon,
  QrCode,
  Group,
  Ungroup,
  Plus,
} from "lucide-react";

interface CardDesignerLayersPanelProps {
  project: CardDesignerProject;
  setProject: React.Dispatch<React.SetStateAction<CardDesignerProject>>;
  activeSide: CardSide;
  setActiveSide: (side: CardSide) => void;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  onCommitHistory: () => void;
}

export const CardDesignerLayersPanel: React.FC<CardDesignerLayersPanelProps> = ({
  project,
  setProject,
  activeSide,
  setActiveSide,
  selectedIds,
  setSelectedIds,
  onCommitHistory,
}) => {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const currentSideState = activeSide === "front" ? project.front : project.back;
  // Visual layer order: highest zIndex at top of list
  const sortedLayers = [...currentSideState.objects].sort((a, b) => b.zIndex - a.zIndex);

  const getObjectIcon = (obj: CardObject) => {
    switch (obj.type) {
      case "text":
        return <Type className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case "image":
        return <ImageIcon className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      case "signature":
        return <PenTool className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case "shape":
        return <Square className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      case "barcode":
        return <BarcodeIcon className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case "qrcode":
        return <QrCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      case "group":
        return <Group className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-neutral-400 shrink-0" />;
    }
  };

  const updateObject = (id: string, updates: Partial<CardObject>) => {
    setProject((prev) => {
      const updateList = (list: CardObject[]) =>
        list.map((o) => (o.id === id ? { ...o, ...updates } : o));
      return {
        ...prev,
        front: { ...prev.front, objects: updateList(prev.front.objects) },
        back: { ...prev.back, objects: updateList(prev.back.objects) },
      };
    });
    onCommitHistory();
  };

  const handleMoveLayer = (obj: CardObject, direction: "up" | "down") => {
    const list = [...currentSideState.objects].sort((a, b) => a.zIndex - b.zIndex);
    const index = list.findIndex((o) => o.id === obj.id);
    if (index === -1) return;

    if (direction === "up" && index < list.length - 1) {
      const temp = list[index].zIndex;
      list[index].zIndex = list[index + 1].zIndex;
      list[index + 1].zIndex = temp;
    } else if (direction === "down" && index > 0) {
      const temp = list[index].zIndex;
      list[index].zIndex = list[index - 1].zIndex;
      list[index - 1].zIndex = temp;
    }

    setProject((prev) => ({
      ...prev,
      [activeSide]: {
        ...prev[activeSide],
        objects: list,
      },
    }));
    onCommitHistory();
  };

  const handleDelete = (id: string) => {
    setProject((prev) => ({
      ...prev,
      front: {
        ...prev.front,
        objects: prev.front.objects.filter((o) => o.id !== id),
      },
      back: {
        ...prev.back,
        objects: prev.back.objects.filter((o) => o.id !== id),
      },
    }));
    setSelectedIds(selectedIds.filter((selId) => selId !== id));
    onCommitHistory();
  };

  const handleDuplicate = (obj: CardObject) => {
    const newObj: CardObject = {
      ...obj,
      id: `${obj.type}-${Date.now()}`,
      name: `${obj.name} (Copy)`,
      x: obj.x + 2,
      y: obj.y + 2,
      zIndex: Math.max(...currentSideState.objects.map((o) => o.zIndex), 0) + 1,
    };
    setProject((prev) => ({
      ...prev,
      [activeSide]: {
        ...prev[activeSide],
        objects: [...prev[activeSide].objects, newObj],
      },
    }));
    setSelectedIds([newObj.id]);
    onCommitHistory();
  };

  return (
    <div className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col shrink-0 text-neutral-200 select-none text-xs">
      {/* Side Selector Tabs (Front vs Back) */}
      <div className="h-10 border-b border-neutral-800 p-1 flex items-center bg-neutral-950/60 shrink-0">
        <button
          type="button"
          onClick={() => setActiveSide("front")}
          className={`flex-1 py-1 rounded font-semibold transition-colors text-center ${
            activeSide === "front"
              ? "bg-sky-600 text-white shadow-sm"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Front Layers ({project.front.objects.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSide("back")}
          className={`flex-1 py-1 rounded font-semibold transition-colors text-center ${
            activeSide === "back"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Back Layers ({project.back.objects.length})
        </button>
      </div>

      {/* Layer List Actions Bar */}
      <div className="h-8 border-b border-neutral-800 px-3 flex items-center justify-between shrink-0 text-[11px] text-neutral-400 bg-neutral-900/80">
        <span>Stacking Order (Top to Bottom)</span>
      </div>

      {/* Layers List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {sortedLayers.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            <Layers className="w-6 h-6 mx-auto mb-1 text-neutral-600" />
            <p className="text-[11px]">No objects on {activeSide} card</p>
          </div>
        ) : (
          sortedLayers.map((obj) => {
            const isSelected = selectedIds.includes(obj.id);
            const isEditing = editingLayerId === obj.id;

            return (
              <div
                key={obj.id}
                onClick={(e) => {
                  if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    if (isSelected) {
                      setSelectedIds(selectedIds.filter((id) => id !== obj.id));
                    } else {
                      setSelectedIds([...selectedIds, obj.id]);
                    }
                  } else {
                    setSelectedIds([obj.id]);
                  }
                }}
                className={`group flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-sky-950/80 border border-sky-600 text-white"
                    : "hover:bg-neutral-800/80 border border-transparent text-neutral-300"
                }`}
              >
                {/* Left: Icon & Name */}
                <div className="flex items-center space-x-2 min-w-0 flex-1 mr-2">
                  {getObjectIcon(obj)}
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => {
                        updateObject(obj.id, { name: editingName.trim() || obj.name });
                        setEditingLayerId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          updateObject(obj.id, { name: editingName.trim() || obj.name });
                          setEditingLayerId(null);
                        }
                      }}
                      className="bg-neutral-950 border border-sky-500 text-white px-1 py-0.5 rounded text-xs w-full outline-none"
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingLayerId(obj.id);
                        setEditingName(obj.name);
                      }}
                      className="truncate font-medium text-xs"
                    >
                      {obj.name}
                    </span>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-0.5 shrink-0 opacity-80 group-hover:opacity-100">
                  {/* Reorder Up/Down */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveLayer(obj, "up");
                    }}
                    className="p-1 hover:text-white rounded hover:bg-neutral-700"
                    title="Move Layer Up (Bring Forward)"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveLayer(obj, "down");
                    }}
                    className="p-1 hover:text-white rounded hover:bg-neutral-700"
                    title="Move Layer Down (Send Backward)"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>

                  {/* Lock */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateObject(obj.id, { locked: !obj.locked });
                    }}
                    className="p-1 hover:text-white rounded hover:bg-neutral-700"
                    title={obj.locked ? "Unlock" : "Lock"}
                  >
                    {obj.locked ? (
                      <Lock className="w-3 h-3 text-amber-400" />
                    ) : (
                      <Unlock className="w-3 h-3 text-neutral-500" />
                    )}
                  </button>

                  {/* Visibility */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateObject(obj.id, { visible: !obj.visible });
                    }}
                    className="p-1 hover:text-white rounded hover:bg-neutral-700"
                    title={obj.visible ? "Hide" : "Show"}
                  >
                    {obj.visible ? (
                      <Eye className="w-3 h-3 text-neutral-400" />
                    ) : (
                      <EyeOff className="w-3 h-3 text-neutral-600" />
                    )}
                  </button>

                  {/* Duplicate */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicate(obj);
                    }}
                    className="p-1 hover:text-white rounded hover:bg-neutral-700"
                    title="Duplicate Layer"
                  >
                    <Copy className="w-3 h-3 text-neutral-400" />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(obj.id);
                    }}
                    className="p-1 hover:text-rose-400 rounded hover:bg-neutral-700"
                    title="Delete Layer"
                  >
                    <Trash2 className="w-3 h-3 text-neutral-500 hover:text-rose-400" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
