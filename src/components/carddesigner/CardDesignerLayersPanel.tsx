/**
 * CardDesignerLayersPanel.tsx
 * 
 * Professional Layers panel for ID & Service Card Designer:
 * - Visual layer thumbnails (images, vector shapes, text, barcodes)
 * - Search and filter layers by name or type
 * - Inline rename on double-click or edit button
 * - Group collapsing & hierarchy display
 * - Instant layer reordering (Bring to Front, Send to Back, Move Up/Down)
 * - Layer visibility & lock toggles
 * - Independent layer lists for Front and Back cards
 */

import React, { useState, useMemo } from "react";
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
  ChevronsUp,
  ChevronsDown,
  Type,
  Image as ImageIcon,
  Square,
  PenTool,
  Barcode as BarcodeIcon,
  QrCode,
  Folder,
  FolderOpen,
  Group as GroupIcon,
  Ungroup,
  Search,
  X,
  Edit2,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const currentSideState = activeSide === "front" ? project.front : project.back;

  // Visual layer order: highest zIndex at top of list
  const sortedLayers = useMemo(() => {
    return [...currentSideState.objects].sort((a, b) => b.zIndex - a.zIndex);
  }, [currentSideState.objects]);

  // Filter layers by search query
  const filteredLayers = useMemo(() => {
    if (!searchQuery.trim()) return sortedLayers;
    const q = searchQuery.toLowerCase().trim();
    return sortedLayers.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.type.toLowerCase().includes(q) ||
        (o.text && o.text.toLowerCase().includes(q))
    );
  }, [sortedLayers, searchQuery]);

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  /**
   * Render rich visual thumbnail for each layer
   */
  const renderLayerThumbnail = (obj: CardObject) => {
    switch (obj.type) {
      case "image":
      case "signature":
        return obj.src ? (
          <img
            src={obj.src}
            alt=""
            className="w-5 h-5 rounded object-cover bg-neutral-800 border border-neutral-700 shrink-0"
          />
        ) : (
          <div className="w-5 h-5 rounded bg-sky-950/80 border border-sky-700/50 flex items-center justify-center shrink-0">
            <ImageIcon className="w-3 h-3 text-sky-400" />
          </div>
        );

      case "shape":
        return (
          <div
            style={{
              backgroundColor: obj.fillColor && obj.fillColor !== "transparent" ? obj.fillColor : "#3b82f6",
              borderColor: obj.strokeColor || "#60a5fa",
              borderRadius: obj.shapeType === "circle" ? "9999px" : obj.shapeType === "rounded-rect" ? "3px" : "1px",
            }}
            className="w-5 h-5 border shrink-0 shadow-inner"
            title={`${obj.shapeType} shape`}
          />
        );

      case "text":
        return (
          <div
            style={{
              backgroundColor: obj.textBackgroundColor && obj.textBackgroundColor !== "transparent" ? obj.textBackgroundColor : "rgba(16, 185, 129, 0.15)",
              color: obj.textColor || "#10b981",
            }}
            className="w-5 h-5 rounded border border-emerald-600/40 flex items-center justify-center font-bold text-[10px] shrink-0"
            title="Text Object"
          >
            T
          </div>
        );

      case "barcode":
      case "qrcode":
        return (
          <div className="w-5 h-5 rounded bg-rose-950/80 border border-rose-600/40 flex items-center justify-center shrink-0">
            {obj.type === "barcode" ? (
              <BarcodeIcon className="w-3 h-3 text-rose-400" />
            ) : (
              <QrCode className="w-3 h-3 text-purple-400" />
            )}
          </div>
        );

      default:
        return (
          <div className="w-5 h-5 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center shrink-0">
            <Layers className="w-3 h-3 text-neutral-400" />
          </div>
        );
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

  const handleMoveLayer = (obj: CardObject, action: "top" | "up" | "down" | "bottom") => {
    const list = [...currentSideState.objects].sort((a, b) => a.zIndex - b.zIndex);
    const index = list.findIndex((o) => o.id === obj.id);
    if (index === -1) return;

    if (action === "up" && index < list.length - 1) {
      const temp = list[index].zIndex;
      list[index].zIndex = list[index + 1].zIndex;
      list[index + 1].zIndex = temp;
    } else if (action === "down" && index > 0) {
      const temp = list[index].zIndex;
      list[index].zIndex = list[index - 1].zIndex;
      list[index - 1].zIndex = temp;
    } else if (action === "top" && index < list.length - 1) {
      const maxZ = Math.max(...list.map((o) => o.zIndex), 0);
      list[index].zIndex = maxZ + 1;
    } else if (action === "bottom" && index > 0) {
      const minZ = Math.min(...list.map((o) => o.zIndex), 0);
      list[index].zIndex = minZ - 1;
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

  // Group / Ungroup Selected Objects
  const handleGroupSelected = () => {
    if (selectedIds.length < 2) return;
    const newGroupId = `grp-${Date.now()}`;
    setProject((prev) => {
      const updateList = (list: CardObject[]) =>
        list.map((o) => (selectedIds.includes(o.id) ? { ...o, groupId: newGroupId } : o));
      return {
        ...prev,
        [activeSide]: {
          ...prev[activeSide],
          objects: updateList(prev[activeSide].objects),
        },
      };
    });
    onCommitHistory();
  };

  const handleUngroupSelected = () => {
    if (selectedIds.length === 0) return;
    setProject((prev) => {
      const updateList = (list: CardObject[]) =>
        list.map((o) => (selectedIds.includes(o.id) ? { ...o, groupId: undefined } : o));
      return {
        ...prev,
        [activeSide]: {
          ...prev[activeSide],
          objects: updateList(prev[activeSide].objects),
        },
      };
    });
    onCommitHistory();
  };

  const primarySelected = selectedIds.length > 0
    ? currentSideState.objects.find((o) => o.id === selectedIds[0])
    : null;

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
          Front ({project.front.objects.length})
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
          Back ({project.back.objects.length})
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="px-2 py-1.5 border-b border-neutral-800 bg-neutral-900/90 flex items-center space-x-1.5">
        <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        <input
          type="text"
          placeholder="Filter layers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent text-neutral-200 placeholder-neutral-500 text-xs w-full outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-neutral-400 hover:text-white p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Quick Stacking Actions & Multi-Select Group Bar */}
      <div className="h-8 border-b border-neutral-800 px-2 flex items-center justify-between shrink-0 text-[11px] text-neutral-400 bg-neutral-950/40">
        <span>Order ({filteredLayers.length})</span>
        <div className="flex items-center space-x-0.5">
          {primarySelected && (
            <>
              <button
                type="button"
                onClick={() => handleMoveLayer(primarySelected, "top")}
                className="p-1 hover:text-white hover:bg-neutral-800 rounded"
                title="Bring to Top / Front"
              >
                <ChevronsUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleMoveLayer(primarySelected, "up")}
                className="p-1 hover:text-white hover:bg-neutral-800 rounded"
                title="Move Up One Layer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleMoveLayer(primarySelected, "down")}
                className="p-1 hover:text-white hover:bg-neutral-800 rounded"
                title="Move Down One Layer"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleMoveLayer(primarySelected, "bottom")}
                className="p-1 hover:text-white hover:bg-neutral-800 rounded"
                title="Send to Bottom / Back"
              >
                <ChevronsDown className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {selectedIds.length > 1 && (
            <button
              type="button"
              onClick={handleGroupSelected}
              className="p-1 text-amber-400 hover:text-amber-300 hover:bg-neutral-800 rounded ml-1"
              title="Group Selected Layers"
            >
              <GroupIcon className="w-3.5 h-3.5" />
            </button>
          )}

          {primarySelected?.groupId && (
            <button
              type="button"
              onClick={handleUngroupSelected}
              className="p-1 text-amber-400 hover:text-amber-300 hover:bg-neutral-800 rounded ml-1"
              title="Ungroup Layer"
            >
              <Ungroup className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Layers List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {filteredLayers.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            <Layers className="w-6 h-6 mx-auto mb-1 text-neutral-600" />
            <p className="text-[11px]">
              {searchQuery ? "No matching layers found" : `No objects on ${activeSide} card`}
            </p>
          </div>
        ) : (
          filteredLayers.map((obj) => {
            const isSelected = selectedIds.includes(obj.id);
            const isEditing = editingLayerId === obj.id;
            const isGrouped = !!obj.groupId;

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
                    ? "bg-sky-950/80 border border-sky-600 text-white shadow-sm"
                    : "hover:bg-neutral-800/80 border border-transparent text-neutral-300"
                } ${isGrouped ? "ml-2 border-l-2 border-amber-500/50 pl-2" : ""}`}
              >
                {/* Left: Thumbnail & Name */}
                <div className="flex items-center space-x-2 min-w-0 flex-1 mr-2">
                  {renderLayerThumbnail(obj)}
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
                        } else if (e.key === "Escape") {
                          setEditingLayerId(null);
                        }
                      }}
                      className="bg-neutral-950 border border-sky-500 text-white px-1 py-0.5 rounded text-xs w-full outline-none"
                    />
                  ) : (
                    <div className="min-w-0 flex-1 flex flex-col">
                      <span
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingLayerId(obj.id);
                          setEditingName(obj.name);
                        }}
                        className="truncate font-medium text-xs leading-tight"
                        title={obj.name}
                      >
                        {obj.name}
                      </span>
                      {isGrouped && (
                        <span className="text-[9px] text-amber-400/80 font-mono">Grouped</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                  {/* Inline Rename Trigger */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingLayerId(obj.id);
                      setEditingName(obj.name);
                    }}
                    className="p-1 hover:text-white rounded"
                    title="Rename Layer"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>

                  {/* Duplicate */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicate(obj);
                    }}
                    className="p-1 hover:text-white rounded"
                    title="Duplicate Layer"
                  >
                    <Copy className="w-3 h-3" />
                  </button>

                  {/* Visibility */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateObject(obj.id, { visible: !obj.visible });
                    }}
                    className="p-1 hover:text-white rounded"
                    title={obj.visible ? "Hide Layer" : "Show Layer"}
                  >
                    {obj.visible ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3 text-neutral-500" />
                    )}
                  </button>

                  {/* Lock */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateObject(obj.id, { locked: !obj.locked });
                    }}
                    className="p-1 hover:text-white rounded"
                    title={obj.locked ? "Unlock Layer" : "Lock Layer"}
                  >
                    {obj.locked ? (
                      <Lock className="w-3 h-3 text-amber-400" />
                    ) : (
                      <Unlock className="w-3 h-3 text-neutral-500" />
                    )}
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(obj.id);
                    }}
                    className="p-1 hover:text-rose-400 rounded"
                    title="Delete Layer"
                  >
                    <Trash2 className="w-3 h-3" />
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

