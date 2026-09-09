/**
 * CardDesignerCanvas.tsx
 * 
 * Interactive vector canvas showing BOTH Front Card (top) and Back Card (underneath)
 * on the SAME physical A6 page (105 × 148 mm).
 * 
 * Features:
 * - Direct object manipulation (Move, 8-handle Resize, Rotate, Double-click Inline Edit)
 * - Millimeter-accurate geometry with metric rulers
 * - Magnetic alignment snap lines
 * - Rubber-band marquee selection
 * - Safe area (3mm) and Bleed (2mm) guide overlays
 * - Cutting guides visualization
 */

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Upload, Minus, Plus, Maximize2, Crop, RotateCcw, Copy, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import {
  CardDesignerProject,
  CardObject,
  CardSide,
  ActiveToolType,
  TransformHandle,
  SnapGuideLine,
} from "../../engine/carddesigner/types";
import { getTrueCardBoundsInZone } from "../../engine/carddesigner/cardGeometry";

interface CardDesignerCanvasProps {
  project: CardDesignerProject;
  setProject: React.Dispatch<React.SetStateAction<CardDesignerProject>>;
  activeSide: CardSide;
  setActiveSide: (side: CardSide) => void;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  activeTool: ActiveToolType;
  setActiveTool: (tool: ActiveToolType) => void;
  zoom: number;
  setZoom?: React.Dispatch<React.SetStateAction<number>>;
  panOffset: { x: number; y: number };
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  onCommitHistory: () => void;
  onEditCrop: (obj: CardObject) => void;
  onDropFiles?: (files: File[]) => void;
  onRevertImageAdjustments?: (obj: CardObject) => void;
  onReplaceImage?: (obj: CardObject) => void;
  onDuplicateSelected?: () => void;
  onDeleteSelected?: () => void;
  onGroupSelected?: () => void;
  onUngroupSelected?: () => void;
  onReorderSelected?: (dir: "up" | "down" | "top" | "bottom") => void;
}

// Convert mm to screen pixels at 100% zoom (assume 3.7795 px per mm for standard 96 DPI CSS screen display)
const SCREEN_PX_PER_MM = 3.7795;

export const CardDesignerCanvas: React.FC<CardDesignerCanvasProps> = ({
  project,
  setProject,
  activeSide,
  setActiveSide,
  selectedIds,
  setSelectedIds,
  activeTool,
  setActiveTool,
  zoom,
  setZoom,
  panOffset,
  setPanOffset,
  onCommitHistory,
  onEditCrop,
  onDropFiles,
  onRevertImageAdjustments,
  onReplaceImage,
  onDuplicateSelected,
  onDeleteSelected,
  onGroupSelected,
  onUngroupSelected,
  onReorderSelected,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragOverFile, setIsDragOverFile] = useState(false);

  // Floating Right-Click Context Menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetObject: CardObject;
  } | null>(null);

  const handleObjectContextMenu = useCallback(
    (e: React.MouseEvent, obj: CardObject) => {
      e.preventDefault();
      e.stopPropagation();
      if (!selectedIds.includes(obj.id)) {
        setSelectedIds([obj.id]);
      }
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        targetObject: obj,
      });
    },
    [selectedIds, setSelectedIds]
  );

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("click", handleCloseMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleCloseMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Viewport-Center Anchored Wheel Zoom (always zooms around center of viewport regardless of cursor position)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !setZoom) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.12 : 1 / 1.12;

      setZoom((prevZoom) => {
        const nextZoom = Math.min(4.0, Math.max(0.2, Math.round(prevZoom * factor * 100) / 100));
        if (nextZoom === prevZoom) return prevZoom;

        const ratio = nextZoom / prevZoom;

        // Viewport center is anchor: scale pan offset proportionally so centered content remains centered
        setPanOffset((prevPan) => ({
          x: Math.round(prevPan.x * ratio * 10) / 10,
          y: Math.round(prevPan.y * ratio * 10) / 10,
        }));

        return nextZoom;
      });
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [setZoom, setPanOffset]);

  // Spacebar pan mode listener
  const [isSpaceDown, setIsSpaceDown] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !e.repeat &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        setIsSpaceDown(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpaceDown(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Interaction State
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [activeHandle, setActiveHandle] = useState<TransformHandle | null>(null);
  const [isDraggingObject, setIsDraggingObject] = useState(false);
  const [dragStartPosMm, setDragStartPosMm] = useState({ x: 0, y: 0 });
  const [objectInitialTransforms, setObjectInitialTransforms] = useState<
    Map<string, { x: number; y: number; width: number; height: number; rotation: number }>
  >(new Map());

  // Marquee Selection
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStartPx, setMarqueeStartPx] = useState({ x: 0, y: 0 });
  const [marqueeCurrentPx, setMarqueeCurrentPx] = useState({ x: 0, y: 0 });

  // Snap Lines
  const [activeSnapLines, setActiveSnapLines] = useState<SnapGuideLine[]>([]);

  // Inline Text Editing
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState("");

  const mmToPx = (mm: number) => mm * SCREEN_PX_PER_MM * zoom;
  const pxToMm = (px: number) => px / (SCREEN_PX_PER_MM * zoom);

  // Helper to find object by ID across front and back
  const findObjectById = useCallback(
    (id: string): { obj: CardObject; side: CardSide } | null => {
      const frontObj = project.front.objects.find((o) => o.id === id);
      if (frontObj) return { obj: frontObj, side: "front" };
      const backObj = project.back.objects.find((o) => o.id === id);
      if (backObj) return { obj: backObj, side: "back" };
      return null;
    },
    [project]
  );

  // Helper to get selected objects
  const selectedObjects = selectedIds
    .map((id) => findObjectById(id)?.obj)
    .filter((o): o is CardObject => !!o);

  // Calculate bounding box of selection
  const selectionBounds = (() => {
    if (selectedObjects.length === 0) return null;
    const first = selectedObjects[0];
    const sidePos = first.targetSide === "front" ? project.frontPosMm : project.backPosMm;

    let minX = first.x + sidePos.x;
    let minY = first.y + sidePos.y;
    let maxX = first.x + first.width + sidePos.x;
    let maxY = first.y + first.height + sidePos.y;

    for (let i = 1; i < selectedObjects.length; i++) {
      const obj = selectedObjects[i];
      const sPos = obj.targetSide === "front" ? project.frontPosMm : project.backPosMm;
      minX = Math.min(minX, obj.x + sPos.x);
      minY = Math.min(minY, obj.y + sPos.y);
      maxX = Math.max(maxX, obj.x + obj.width + sPos.x);
      maxY = Math.max(maxY, obj.y + obj.height + sPos.y);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: selectedObjects.length === 1 ? selectedObjects[0].rotation : 0,
      singleObj: selectedObjects.length === 1 ? selectedObjects[0] : null,
    };
  })();

  // -------------------------------------------------------------
  // Pan & Canvas Dragging
  // -------------------------------------------------------------
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    // Middle click or Pan tool or Space key held or Shift+Left Click without selection
    if (e.button === 1 || activeTool === "pan" || isSpaceDown || (e.shiftKey && e.button === 0 && selectedIds.length === 0)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      try {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {}
      return;
    }

    if (e.button === 0) {
      // Click on blank canvas -> clear selection or start marquee
      if ((e.target as HTMLElement).dataset.canvasBackground === "true") {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          setSelectedIds([]);
        }
        setIsMarqueeSelecting(true);
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          setMarqueeStartPx({ x, y });
          setMarqueeCurrentPx({ x, y });
        }
      }
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (isMarqueeSelecting && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMarqueeCurrentPx({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      return;
    }

    if (isDraggingObject && selectionBounds) {
      const currentMouseMmX = pxToMm(e.clientX);
      const currentMouseMmY = pxToMm(e.clientY);
      const deltaX = currentMouseMmX - dragStartPosMm.x;
      const deltaY = currentMouseMmY - dragStartPosMm.y;

      // Snapping logic
      const snapLines: SnapGuideLine[] = [];
      let finalDeltaX = deltaX;
      let finalDeltaY = deltaY;

      if (project.snapToGrid && project.gridSizeMm > 0) {
        finalDeltaX = Math.round(finalDeltaX / project.gridSizeMm) * project.gridSizeMm;
        finalDeltaY = Math.round(finalDeltaY / project.gridSizeMm) * project.gridSizeMm;
      }

      // Magnetic Snapping to True Card Boundaries & Centerlines
      if (project.snapToCardBoundary !== false && selectedIds.length > 0) {
        const trueCard = getTrueCardBoundsInZone(project);
        const primaryInit = objectInitialTransforms.get(selectedIds[0]);
        if (primaryInit) {
          const rawX = primaryInit.x + deltaX;
          const rawY = primaryInit.y + deltaY;
          const allObjs = [...project.front.objects, ...project.back.objects];
          const primaryObj = allObjs.find((o) => o.id === selectedIds[0]);
          const objW = primaryObj?.width || primaryInit.width;
          const objH = primaryObj?.height || primaryInit.height;
          const snapDist = 1.0; // 1mm magnetic threshold

          // X Snapping (Left, Center, Right of True Card and Zone)
          const xTargets = [
            { pos: trueCard.x, label: "Card Left" },
            { pos: trueCard.centerX, label: "Card Center" },
            { pos: trueCard.right, label: "Card Right" },
            { pos: project.cardWidthMm / 2, label: "Zone Center" },
          ];

          for (const t of xTargets) {
            if (Math.abs(rawX - t.pos) < snapDist) {
              finalDeltaX = t.pos - primaryInit.x;
              snapLines.push({ type: "v", positionMm: t.pos, cardSide: activeSide });
              break;
            } else if (Math.abs(rawX + objW / 2 - t.pos) < snapDist) {
              finalDeltaX = t.pos - objW / 2 - primaryInit.x;
              snapLines.push({ type: "v", positionMm: t.pos, cardSide: activeSide });
              break;
            } else if (Math.abs(rawX + objW - t.pos) < snapDist) {
              finalDeltaX = t.pos - objW - primaryInit.x;
              snapLines.push({ type: "v", positionMm: t.pos, cardSide: activeSide });
              break;
            }
          }

          // Y Snapping (Top, Center, Bottom of True Card and Zone)
          const yTargets = [
            { pos: trueCard.y, label: "Card Top" },
            { pos: trueCard.centerY, label: "Card Center" },
            { pos: trueCard.bottom, label: "Card Bottom" },
            { pos: project.cardHeightMm / 2, label: "Zone Center" },
          ];

          for (const t of yTargets) {
            if (Math.abs(rawY - t.pos) < snapDist) {
              finalDeltaY = t.pos - primaryInit.y;
              snapLines.push({ type: "h", positionMm: t.pos, cardSide: activeSide });
              break;
            } else if (Math.abs(rawY + objH / 2 - t.pos) < snapDist) {
              finalDeltaY = t.pos - objH / 2 - primaryInit.y;
              snapLines.push({ type: "h", positionMm: t.pos, cardSide: activeSide });
              break;
            } else if (Math.abs(rawY + objH - t.pos) < snapDist) {
              finalDeltaY = t.pos - objH - primaryInit.y;
              snapLines.push({ type: "h", positionMm: t.pos, cardSide: activeSide });
              break;
            }
          }
        }
      }

      setProject((prev) => {
        const updateObjects = (objs: CardObject[]) =>
          objs.map((obj) => {
            if (!selectedIds.includes(obj.id) || obj.locked) return obj;
            const initial = objectInitialTransforms.get(obj.id);
            if (!initial) return obj;

            let newX = Math.round((initial.x + finalDeltaX) * 10) / 10;
            let newY = Math.round((initial.y + finalDeltaY) * 10) / 10;

            // Generous boundary allowing full bleed past edge
            newX = Math.max(-25, Math.min(project.cardWidthMm + 25, newX));
            newY = Math.max(-25, Math.min(project.cardHeightMm + 25, newY));

            return { ...obj, x: newX, y: newY };
          });

        return {
          ...prev,
          front: { ...prev.front, objects: updateObjects(prev.front.objects) },
          back: { ...prev.back, objects: updateObjects(prev.back.objects) },
        };
      });

      setActiveSnapLines(snapLines);
    } else if (activeHandle && selectionBounds && selectionBounds.singleObj) {
      // Resize / Rotate object
      const obj = selectionBounds.singleObj;
      const initial = objectInitialTransforms.get(obj.id);
      if (!initial) return;

      const currentMouseMmX = pxToMm(e.clientX);
      const currentMouseMmY = pxToMm(e.clientY);
      const deltaX = currentMouseMmX - dragStartPosMm.x;
      const deltaY = currentMouseMmY - dragStartPosMm.y;

      setProject((prev) => {
        const updateObj = (o: CardObject) => {
          if (o.id !== obj.id) return o;

          let newX = initial.x;
          let newY = initial.y;
          let newW = initial.width;
          let newH = initial.height;
          let newRot = initial.rotation;

          if (activeHandle === "rot") {
            // Calculate angle from center of object in viewport coordinates
            const cRect = containerRef.current?.getBoundingClientRect();
            if (cRect) {
              const stageCenterX = cRect.width / 2 + panOffset.x;
              const stageCenterY = cRect.height / 2 + panOffset.y;
              const sheetLeftPx = cRect.left + stageCenterX - sheetWidthPx / 2;
              const sheetTopPx = cRect.top + stageCenterY - sheetHeightPx / 2;
              const sidePos = o.targetSide === "front" ? project.frontPosMm : project.backPosMm;
              const centerClientX =
                sheetLeftPx + (sidePos.x + initial.x + initial.width / 2) * SCREEN_PX_PER_MM * zoom;
              const centerClientY =
                sheetTopPx + (sidePos.y + initial.y + initial.height / 2) * SCREEN_PX_PER_MM * zoom;
              const rad = Math.atan2(e.clientY - centerClientY, e.clientX - centerClientX);
              let deg = (rad * 180) / Math.PI + 90;
              if (deg < 0) deg += 360;
              if (e.shiftKey) deg = Math.round(deg / 15) * 15; // 15-degree increments
              newRot = Math.round(deg);
            }
          } else {
            if (activeHandle.includes("e")) newW = Math.max(2, initial.width + deltaX);
            if (activeHandle.includes("s")) newH = Math.max(2, initial.height + deltaY);
            if (activeHandle.includes("w")) {
              const diff = Math.min(deltaX, initial.width - 2);
              newX = initial.x + diff;
              newW = initial.width - diff;
            }
            if (activeHandle.includes("n")) {
              const diff = Math.min(deltaY, initial.height - 2);
              newY = initial.y + diff;
              newH = initial.height - diff;
            }

            if (o.aspectRatioLocked || e.shiftKey) {
              const aspect = initial.width / initial.height;
              if (activeHandle.includes("e") || activeHandle.includes("w")) {
                newH = newW / aspect;
              } else {
                newW = newH * aspect;
              }
            }
          }

          return {
            ...o,
            x: Math.round(newX * 10) / 10,
            y: Math.round(newY * 10) / 10,
            width: Math.round(newW * 10) / 10,
            height: Math.round(newH * 10) / 10,
            rotation: newRot,
          };
        };

        return {
          ...prev,
          front: { ...prev.front, objects: prev.front.objects.map(updateObj) },
          back: { ...prev.back, objects: prev.back.objects.map(updateObj) },
        };
      });
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }

    if (isMarqueeSelecting && containerRef.current) {
      setIsMarqueeSelecting(false);
      const cRect = containerRef.current.getBoundingClientRect();
      const minX = Math.min(marqueeStartPx.x, marqueeCurrentPx.x);
      const maxX = Math.max(marqueeStartPx.x, marqueeCurrentPx.x);
      const minY = Math.min(marqueeStartPx.y, marqueeCurrentPx.y);
      const maxY = Math.max(marqueeStartPx.y, marqueeCurrentPx.y);

      if (maxX - minX > 4 || maxY - minY > 4) {
        // Calculate page screen position inside container
        const stageCenterX = cRect.width / 2 + panOffset.x;
        const stageCenterY = cRect.height / 2 + panOffset.y;
        const sheetLeftPx = stageCenterX - sheetWidthPx / 2;
        const sheetTopPx = stageCenterY - sheetHeightPx / 2;

        const sidePos = activeSide === "front" ? project.frontPosMm : project.backPosMm;
        const sideXPx = sidePos.x * SCREEN_PX_PER_MM * zoom;
        const sideYPx = sidePos.y * SCREEN_PX_PER_MM * zoom;

        const currentSideObjs = activeSide === "front" ? project.front.objects : project.back.objects;
        const newlySelected: string[] = [];

        currentSideObjs.forEach((o) => {
          if (!o.visible || o.locked) return;
          const objLeft = sheetLeftPx + sideXPx + o.x * SCREEN_PX_PER_MM * zoom;
          const objTop = sheetTopPx + sideYPx + o.y * SCREEN_PX_PER_MM * zoom;
          const objRight = objLeft + o.width * SCREEN_PX_PER_MM * zoom;
          const objBottom = objTop + o.height * SCREEN_PX_PER_MM * zoom;

          // Check AABB overlap with marquee box
          const overlaps = !(
            objRight < minX ||
            objLeft > maxX ||
            objBottom < minY ||
            objTop > maxY
          );

          if (overlaps) {
            newlySelected.push(o.id);
          }
        });

        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          const combined = Array.from(new Set([...selectedIds, ...newlySelected]));
          setSelectedIds(combined);
        } else {
          setSelectedIds(newlySelected);
        }
      }
    }

    if (isDraggingObject || activeHandle) {
      setIsDraggingObject(false);
      setActiveHandle(null);
      setActiveSnapLines([]);
      onCommitHistory();
    }
  };

  // Window pointer move and up listeners so drag/pan/resize never drop when mouse moves fast
  useEffect(() => {
    if (!isPanning && !isDraggingObject && !activeHandle && !isMarqueeSelecting) return;

    const onWindowPointerMove = (e: PointerEvent) => {
      handleCanvasPointerMove(e as unknown as React.PointerEvent);
    };

    const onWindowPointerUp = (e: PointerEvent) => {
      handleCanvasPointerUp(e as unknown as React.PointerEvent);
    };

    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    return () => {
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
    };
  }, [isPanning, isDraggingObject, activeHandle, isMarqueeSelecting]);

  // -------------------------------------------------------------
  // Object Pointer Interaction
  // -------------------------------------------------------------
  const handleObjectPointerDown = (e: React.PointerEvent, obj: CardObject) => {
    e.stopPropagation();
    if (e.button !== 0 || activeTool === "pan") return;

    if (obj.locked) return;

    setActiveSide(obj.targetSide);

    // Multi-selection with Shift or Ctrl/Cmd
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      if (selectedIds.includes(obj.id)) {
        setSelectedIds(selectedIds.filter((id) => id !== obj.id));
      } else {
        setSelectedIds([...selectedIds, obj.id]);
      }
    } else {
      if (!selectedIds.includes(obj.id)) {
        setSelectedIds([obj.id]);
      }
    }

    // Start object drag
    setIsDraggingObject(true);
    setDragStartPosMm({
      x: pxToMm(e.clientX),
      y: pxToMm(e.clientY),
    });

    const initMap = new Map<string, { x: number; y: number; width: number; height: number; rotation: number }>();
    const allObjs = [...project.front.objects, ...project.back.objects];
    const targets = selectedIds.includes(obj.id) ? selectedIds : [obj.id];

    targets.forEach((id) => {
      const found = allObjs.find((o) => o.id === id);
      if (found) {
        initMap.set(id, {
          x: found.x,
          y: found.y,
          width: found.width,
          height: found.height,
          rotation: found.rotation,
        });
      }
    });
    setObjectInitialTransforms(initMap);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleHandlePointerDown = (e: React.PointerEvent, handle: TransformHandle) => {
    e.stopPropagation();
    if (e.button !== 0 || !selectionBounds) return;

    setActiveHandle(handle);
    setDragStartPosMm({
      x: pxToMm(e.clientX),
      y: pxToMm(e.clientY),
    });

    const initMap = new Map<string, { x: number; y: number; width: number; height: number; rotation: number }>();
    selectedObjects.forEach((o) => {
      initMap.set(o.id, {
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        rotation: o.rotation,
      });
    });
    setObjectInitialTransforms(initMap);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Double click for text inline editing or image crop
  const handleObjectDoubleClick = (e: React.MouseEvent, obj: CardObject) => {
    e.stopPropagation();
    if (obj.type === "text") {
      setEditingTextId(obj.id);
      setEditingTextValue(obj.text || "");
    } else if (obj.type === "image" || obj.type === "signature") {
      onEditCrop(obj);
    }
  };

  const handleSaveInlineText = () => {
    if (!editingTextId) return;
    setProject((prev) => {
      const updateObj = (o: CardObject) =>
        o.id === editingTextId ? { ...o, text: editingTextValue } : o;
      return {
        ...prev,
        front: { ...prev.front, objects: prev.front.objects.map(updateObj) },
        back: { ...prev.back, objects: prev.back.objects.map(updateObj) },
      };
    });
    setEditingTextId(null);
    onCommitHistory();
  };

  // Dimensions of physical A6 sheet
  const sheetWidthPx = mmToPx(project.pageWidthMm);
  const sheetHeightPx = mmToPx(project.pageHeightMm);

  // Position of Front and Back cards on the A6 page
  const frontXPx = mmToPx(project.frontPosMm.x);
  const frontYPx = mmToPx(project.frontPosMm.y);
  const backXPx = mmToPx(project.backPosMm.x);
  const backYPx = mmToPx(project.backPosMm.y);
  const cardWPx = mmToPx(project.cardWidthMm);
  const cardHPx = mmToPx(project.cardHeightMm);

  return (
    <div
      ref={containerRef}
      data-canvas-background="true"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOverFile(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOverFile(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOverFile(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onDropFiles) {
          onDropFiles(Array.from(e.dataTransfer.files));
        }
      }}
      className={`relative flex-1 bg-neutral-950 overflow-hidden flex items-center justify-center select-none ${
        activeTool === "pan" || isPanning ? "cursor-grab active:cursor-grabbing" : "cursor-default"
      }`}
    >
      {/* Drag & Drop File Overlay */}
      {isDragOverFile && (
        <div className="absolute inset-0 z-50 bg-indigo-950/80 backdrop-blur-sm border-2 border-dashed border-indigo-400 flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-150">
          <div className="p-5 rounded-2xl bg-neutral-900/95 border border-indigo-500/50 shadow-2xl flex flex-col items-center space-y-2 text-center max-w-sm">
            <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center animate-bounce">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-white">Drop File onto {activeSide.toUpperCase()} Card</p>
            <p className="text-xs text-neutral-400">
              Supports PDF, Corel SVG, PNG/JPG, WEBP, BMP, TIFF, DOCX, TXT
            </p>
          </div>
        </div>
      )}
      {/* Dynamic Grid Background Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.2) 1px, transparent 0)",
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          transform: `translate(${panOffset.x % (20 * zoom)}px, ${panOffset.y % (20 * zoom)}px)`,
        }}
      />

      {/* Primary Zoomable/Pannable Stage */}
      <div
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          transition: isPanning || isDraggingObject ? "none" : "transform 0.05s ease-out",
        }}
        className="relative"
      >
        {/* PHYSICAL A6 PAGE (105 × 148 mm) */}
        <div
          data-canvas-background="true"
          style={{
            width: `${sheetWidthPx}px`,
            height: `${sheetHeightPx}px`,
          }}
          className="relative bg-white shadow-2xl rounded-sm border border-neutral-700/80 overflow-visible"
        >
          {/* Header watermark label */}
          <div className="absolute -top-7 left-0 right-0 flex items-center justify-between text-[11px] font-mono text-neutral-400 select-none">
            <span className="font-bold tracking-wider text-sky-400">
              ISO A6 SHEET ({project.pageWidthMm} × {project.pageHeightMm} mm)
            </span>
            <span>
              Scale: {Math.round(zoom * 100)}% • Dual-Card Print Layout
            </span>
          </div>

          {/* Separation Fold Line between Front and Back cards */}
          <div
            className="absolute left-0 right-0 border-b-2 border-dashed border-amber-500/80 pointer-events-none z-20 flex items-center justify-between px-2"
            style={{
              top: `${(frontYPx + cardHPx + backYPx) / 2}px`,
            }}
          >
            <span className="text-[9px] font-mono font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded shadow-xs -translate-y-1/2">
              ✂ A6 FOLD / CUT LINE (74.0 mm)
            </span>
            <span className="text-[9px] font-mono font-bold text-neutral-500 bg-white/95 px-1.5 py-0.5 rounded border border-neutral-200 shadow-xs -translate-y-1/2">
              UPPER: FRONT • LOWER: BACK
            </span>
          </div>

          {/* =========================================================
              FRONT CARD WORKING AREA (TOP, 74 × 105 mm)
             ========================================================= */}
          <div
            id="front-card-area"
            onClick={(e) => {
              e.stopPropagation();
              setActiveSide("front");
            }}
            style={{
              position: "absolute",
              left: `${frontXPx}px`,
              top: `${frontYPx}px`,
              width: `${cardWPx}px`,
              height: `${cardHPx}px`,
              backgroundColor: project.front.background.color1 || "#ffffff",
            }}
            className={`transition-shadow overflow-hidden ${
              activeSide === "front"
                ? "ring-2 ring-sky-500/80 shadow-md"
                : "border border-neutral-200/90 hover:border-neutral-400"
            }`}
          >
            {/* Front Card Label Banner */}
            <div className="absolute top-1 left-2 z-20 pointer-events-none">
              <span className="text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded bg-sky-600/90 text-white shadow-sm">
                FRONT ZONE (UPPER) • {project.cardWidthMm} × {project.cardHeightMm} mm
              </span>
            </div>

            {/* True Card Cut-Line Frame & Bleed Guide */}
            <TrueCardGuide
              project={project}
              side="front"
              zoom={zoom}
            />

            {/* Render Front Card Objects */}
            {project.front.objects.map((obj) => (
              <RenderObjectElement
                key={obj.id}
                obj={obj}
                isSelected={selectedIds.includes(obj.id)}
                isEditing={editingTextId === obj.id}
                editingValue={editingTextValue}
                setEditingValue={setEditingTextValue}
                onSaveInlineText={handleSaveInlineText}
                zoom={zoom}
                onPointerDown={(e) => handleObjectPointerDown(e, obj)}
                onDoubleClick={(e) => handleObjectDoubleClick(e, obj)}
                onContextMenu={(e) => handleObjectContextMenu(e, obj)}
              />
            ))}
          </div>

          {/* =========================================================
              BACK CARD WORKING AREA (UNDERNEATH, 74 × 105 mm)
             ========================================================= */}
          <div
            id="back-card-area"
            onClick={(e) => {
              e.stopPropagation();
              setActiveSide("back");
            }}
            style={{
              position: "absolute",
              left: `${backXPx}px`,
              top: `${backYPx}px`,
              width: `${cardWPx}px`,
              height: `${cardHPx}px`,
              backgroundColor: project.back.background.color1 || "#ffffff",
            }}
            className={`transition-shadow overflow-hidden ${
              activeSide === "back"
                ? "ring-2 ring-indigo-500/80 shadow-md"
                : "border border-neutral-200/90 hover:border-neutral-400"
            }`}
          >
            {/* Back Card Label Banner */}
            <div className="absolute top-1 left-2 z-20 pointer-events-none">
              <span className="text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded bg-indigo-600/90 text-white shadow-sm">
                BACK ZONE (LOWER) • {project.cardWidthMm} × {project.cardHeightMm} mm
              </span>
            </div>

            {/* True Card Cut-Line Frame & Bleed Guide */}
            <TrueCardGuide
              project={project}
              side="back"
              zoom={zoom}
            />

            {/* Render Back Card Objects */}
            {project.back.objects.map((obj) => (
              <RenderObjectElement
                key={obj.id}
                obj={obj}
                isSelected={selectedIds.includes(obj.id)}
                isEditing={editingTextId === obj.id}
                editingValue={editingTextValue}
                setEditingValue={setEditingTextValue}
                onSaveInlineText={handleSaveInlineText}
                zoom={zoom}
                onPointerDown={(e) => handleObjectPointerDown(e, obj)}
                onDoubleClick={(e) => handleObjectDoubleClick(e, obj)}
                onContextMenu={(e) => handleObjectContextMenu(e, obj)}
              />
            ))}
          </div>

          {/* =========================================================
              TRANSFORM BOUNDING BOX & HANDLES (CorelDRAW Style)
             ========================================================= */}
          {selectionBounds && selectedObjects.length > 0 && !editingTextId && (
            <div
              style={{
                position: "absolute",
                left: `${mmToPx(selectionBounds.x)}px`,
                top: `${mmToPx(selectionBounds.y)}px`,
                width: `${mmToPx(selectionBounds.width)}px`,
                height: `${mmToPx(selectionBounds.height)}px`,
                transform:
                  selectionBounds.rotation !== 0
                    ? `rotate(${selectionBounds.rotation}deg)`
                    : "none",
                transformOrigin: "center center",
              }}
              className="border-2 border-sky-500 pointer-events-none z-30"
            >
              {/* Rotation Handle on Top */}
              <div
                onPointerDown={(e) => handleHandlePointerDown(e, "rot")}
                className="absolute -top-7 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-sky-600 rounded-full shadow cursor-grab active:cursor-grabbing pointer-events-auto flex items-center justify-center"
                title="Rotate Object"
              >
                <div className="w-1.5 h-1.5 bg-sky-600 rounded-full" />
              </div>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-sky-500 pointer-events-none" />

              {/* 8 Bounding Box Handles */}
              {[
                { h: "nw" as const, pos: "-top-1.5 -left-1.5 cursor-nwse-resize" },
                { h: "n" as const, pos: "-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize" },
                { h: "ne" as const, pos: "-top-1.5 -right-1.5 cursor-nesw-resize" },
                { h: "e" as const, pos: "top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize" },
                { h: "se" as const, pos: "-bottom-1.5 -right-1.5 cursor-nwse-resize" },
                { h: "s" as const, pos: "-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize" },
                { h: "sw" as const, pos: "-bottom-1.5 -left-1.5 cursor-nesw-resize" },
                { h: "w" as const, pos: "top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize" },
              ].map(({ h, pos }) => (
                <div
                  key={h}
                  onPointerDown={(e) => handleHandlePointerDown(e, h)}
                  className={`absolute w-3 h-3 bg-white border-2 border-sky-600 shadow-sm pointer-events-auto ${pos}`}
                />
              ))}
            </div>
          )}

          {/* Active Magnetic Snap Lines */}
          {activeSnapLines.map((line, idx) => (
            <div
              key={idx}
              className={`absolute pointer-events-none z-40 ${
                line.type === "h"
                  ? "left-0 right-0 border-b border-sky-400 border-dashed"
                  : "top-0 bottom-0 border-r border-sky-400 border-dashed"
              }`}
              style={
                line.type === "h"
                  ? { top: `${mmToPx(line.positionMm)}px` }
                  : { left: `${mmToPx(line.positionMm)}px` }
              }
            />
          ))}
        </div>
      </div>

      {/* Marquee Selection Rectangle */}
      {isMarqueeSelecting && (
        <div
          className="absolute border border-sky-400 bg-sky-500/15 pointer-events-none z-50"
          style={{
            left: `${Math.min(marqueeStartPx.x, marqueeCurrentPx.x)}px`,
            top: `${Math.min(marqueeStartPx.y, marqueeCurrentPx.y)}px`,
            width: `${Math.abs(marqueeCurrentPx.x - marqueeStartPx.x)}px`,
            height: `${Math.abs(marqueeCurrentPx.y - marqueeStartPx.y)}px`,
          }}
        />
      )}

      {/* Floating Canvas Zoom & View Controls */}
      <div className="absolute bottom-4 right-4 z-40 flex items-center bg-neutral-900/90 backdrop-blur-md border border-neutral-700/80 rounded-xl px-2 py-1 shadow-2xl space-x-1 text-xs text-white">
        <button
          type="button"
          onClick={() => setZoom && setZoom((z) => Math.max(0.2, Math.round((z - 0.15) * 100) / 100))}
          className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-300 hover:text-white transition-colors"
          title="Zoom Out (Ctrl -)"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (setZoom) setZoom(1.0);
            setPanOffset({ x: 0, y: 0 });
          }}
          className="px-2 py-1 hover:bg-neutral-800 rounded-lg font-mono text-[11px] font-medium text-sky-400"
          title="Reset to 100% Real Size"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setZoom && setZoom((z) => Math.min(4.0, Math.round((z + 0.15) * 100) / 100))}
          className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-300 hover:text-white transition-colors"
          title="Zoom In (Ctrl +)"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-neutral-700 mx-1" />
        <button
          type="button"
          onClick={() => {
            if (containerRef.current && setZoom) {
              const rect = containerRef.current.getBoundingClientRect();
              const pageW = project.pageWidthMm * SCREEN_PX_PER_MM;
              const pageH = project.pageHeightMm * SCREEN_PX_PER_MM;
              const fitRatio = Math.min((rect.width - 48) / pageW, (rect.height - 48) / pageH);
              setZoom(Math.min(3.0, Math.max(0.25, Math.round(fitRatio * 100) / 100)));
            }
            setPanOffset({ x: 0, y: 0 });
          }}
          className="px-2 py-1 hover:bg-neutral-800 rounded-lg text-[10px] font-semibold text-neutral-300 hover:text-white"
          title="Fit Page to Screen"
        >
          Fit Page
        </button>
        <button
          type="button"
          onClick={() => setPanOffset({ x: 0, y: 0 })}
          className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-300 hover:text-white"
          title="Center Canvas"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: "fixed",
            left: Math.min(contextMenu.x, window.innerWidth - 250),
            top: Math.min(contextMenu.y, window.innerHeight - 300),
            zIndex: 9999,
          }}
          className="w-60 bg-neutral-900/95 border border-neutral-700/80 rounded-xl shadow-2xl py-1.5 text-xs text-neutral-200 backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] font-bold text-neutral-400 border-b border-neutral-800 truncate">
            {contextMenu.targetObject.name}
          </div>

          {(contextMenu.targetObject.type === "image" || contextMenu.targetObject.type === "signature") && (
            <>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-sky-600 hover:text-white transition-colors"
                onClick={() => {
                  onEditCrop(contextMenu.targetObject);
                  setContextMenu(null);
                }}
              >
                <Crop className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-semibold">Crop & Adjust Image...</span>
              </button>

              {(contextMenu.targetObject.originalSrc || contextMenu.targetObject.appliedCropAdjustments || contextMenu.targetObject.cropRect) && (
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left flex items-center space-x-2 text-amber-300 hover:bg-amber-600 hover:text-white transition-colors"
                  onClick={() => {
                    onRevertImageAdjustments?.(contextMenu.targetObject);
                    setContextMenu(null);
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Revert to Original (Reset)</span>
                </button>
              )}

              <button
                type="button"
                className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-neutral-800 hover:text-white transition-colors"
                onClick={() => {
                  onReplaceImage?.(contextMenu.targetObject);
                  setContextMenu(null);
                }}
              >
                <Upload className="w-3.5 h-3.5 text-neutral-400" />
                <span>Replace Photo / Upload New...</span>
              </button>
              <div className="my-1 border-t border-neutral-800" />
            </>
          )}

          {onDuplicateSelected && (
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-neutral-800 hover:text-white transition-colors"
              onClick={() => {
                onDuplicateSelected();
                setContextMenu(null);
              }}
            >
              <div className="flex items-center space-x-2">
                <Copy className="w-3.5 h-3.5 text-neutral-400" />
                <span>Duplicate</span>
              </div>
              <span className="text-[10px] text-neutral-500">Ctrl+D</span>
            </button>
          )}

          {onReorderSelected && (
            <>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-neutral-800 hover:text-white transition-colors"
                onClick={() => {
                  onReorderSelected("top");
                  setContextMenu(null);
                }}
              >
                <ArrowUp className="w-3.5 h-3.5 text-neutral-400" />
                <span>Bring to Front</span>
              </button>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left flex items-center space-x-2 hover:bg-neutral-800 hover:text-white transition-colors"
                onClick={() => {
                  onReorderSelected("bottom");
                  setContextMenu(null);
                }}
              >
                <ArrowDown className="w-3.5 h-3.5 text-neutral-400" />
                <span>Send to Back</span>
              </button>
            </>
          )}

          {onDeleteSelected && (
            <>
              <div className="my-1 border-t border-neutral-800" />
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left flex items-center justify-between text-red-400 hover:bg-red-600 hover:text-white transition-colors"
                onClick={() => {
                  onDeleteSelected();
                  setContextMenu(null);
                }}
              >
                <div className="flex items-center space-x-2">
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </div>
                <span className="text-[10px] opacity-70">Del</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Sub-component for rendering individual vector/text/image object
 */
interface RenderObjectElementProps {
  obj: CardObject;
  isSelected: boolean;
  isEditing: boolean;
  editingValue: string;
  setEditingValue: (val: string) => void;
  onSaveInlineText: () => void;
  zoom: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const RenderObjectElement: React.FC<RenderObjectElementProps> = ({
  obj,
  isSelected,
  isEditing,
  editingValue,
  setEditingValue,
  onSaveInlineText,
  zoom,
  onPointerDown,
  onDoubleClick,
  onContextMenu,
}) => {
  if (!obj.visible) return null;

  const xPx = obj.x * SCREEN_PX_PER_MM * zoom;
  const yPx = obj.y * SCREEN_PX_PER_MM * zoom;
  const wPx = obj.width * SCREEN_PX_PER_MM * zoom;
  const hPx = obj.height * SCREEN_PX_PER_MM * zoom;

  const mirrorTransform = `${obj.flipX ? "scaleX(-1) " : ""}${obj.flipY ? "scaleY(-1) " : ""}`;

  const maskRadiusPx =
    obj.maskShape === "circle"
      ? "9999px"
      : obj.maskShape === "rounded-rect"
      ? `${(obj.maskCornerRadius || 3) * SCREEN_PX_PER_MM * zoom}px`
      : obj.cropRect?.shape === "circle"
      ? "9999px"
      : obj.cropRect?.shape === "rounded"
      ? `${(obj.cropRect.cornerRadius || 2) * SCREEN_PX_PER_MM * zoom}px`
      : "0px";

  return (
    <div
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      style={{
        position: "absolute",
        left: `${xPx}px`,
        top: `${yPx}px`,
        width: `${wPx}px`,
        height: `${hPx}px`,
        transform: `rotate(${obj.rotation || 0}deg) ${mirrorTransform}`,
        transformOrigin: "center center",
        opacity: obj.opacity ?? 1,
        zIndex: obj.zIndex,
        mixBlendMode: (obj.blendMode as React.CSSProperties["mixBlendMode"]) || "normal",
      }}
      className={`group transition-all ${
        isSelected ? "ring-1 ring-sky-400" : "hover:ring-1 hover:ring-sky-300/40"
      } ${obj.locked ? "pointer-events-none" : "cursor-move"}`}
    >
      {/* SHAPE OBJECT */}
      {obj.type === "shape" && (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: obj.fillColor || "transparent",
            borderColor: obj.strokeColor || "transparent",
            borderWidth: `${(obj.strokeWidth || 0) * SCREEN_PX_PER_MM * zoom}px`,
            borderStyle: obj.strokeStyle || "solid",
            borderRadius:
              obj.shapeType === "rounded-rect"
                ? `${(obj.cornerRadius || 2) * SCREEN_PX_PER_MM * zoom}px`
                : obj.shapeType === "circle"
                ? "9999px"
                : "0px",
          }}
        />
      )}

      {/* TEXT OBJECT */}
      {obj.type === "text" && (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: obj.textBackgroundColor || "transparent",
            color: obj.textColor || "#000000",
            fontSize: `${(obj.fontSize || 10) * zoom}px`,
            fontFamily: obj.fontFamily || "Plus Jakarta Sans, sans-serif",
            fontWeight: obj.fontWeight || "normal",
            fontStyle: obj.fontStyle || "normal",
            textDecoration: obj.textDecoration || "none",
            textAlign: obj.textAlign || "left",
            letterSpacing: `${(obj.letterSpacing || 0) * zoom}px`,
            lineHeight: obj.lineHeight || 1.3,
          }}
          className="flex flex-col justify-center select-none overflow-hidden"
        >
          {isEditing ? (
            <textarea
              autoFocus
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={onSaveInlineText}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSaveInlineText();
                }
              }}
              className="w-full h-full p-1 bg-white text-black border border-sky-500 text-xs resize-none outline-none"
            />
          ) : (
            <div className="whitespace-pre-wrap">{obj.text}</div>
          )}
        </div>
      )}

      {/* IMAGE, SIGNATURE, BARCODE, QR CODE */}
      {(obj.type === "image" ||
        obj.type === "signature" ||
        obj.type === "barcode" ||
        obj.type === "qrcode") &&
        obj.src && (
          <img
            src={obj.src}
            alt={obj.name}
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: obj.fitMode || "contain",
              borderRadius: maskRadiusPx,
              filter: obj.imageFilters
                ? `brightness(${100 + (obj.imageFilters.brightness || 0)}%) contrast(${
                    100 + (obj.imageFilters.contrast || 0)
                  }%) saturate(${100 + (obj.imageFilters.saturation || 0)}%) ${
                    obj.imageFilters.grayscale ? "grayscale(100%)" : ""
                  }`
                : "none",
            }}
            className="w-full h-full select-none"
          />
        )}
    </div>
  );
};

/**
 * True Card Guide Frame, Bleed Shading, and Corner Marks
 */
const TrueCardGuide: React.FC<{
  project: CardDesignerProject;
  side: CardSide;
  zoom: number;
}> = ({ project, side, zoom }) => {
  if (project.showCardBoundary === false) return null;

  const trueCard = getTrueCardBoundsInZone(project);
  const leftPx = trueCard.x * SCREEN_PX_PER_MM * zoom;
  const topPx = trueCard.y * SCREEN_PX_PER_MM * zoom;
  const widthPx = trueCard.width * SCREEN_PX_PER_MM * zoom;
  const heightPx = trueCard.height * SCREEN_PX_PER_MM * zoom;
  const cornerRadiusPx = (project.cardCornerRadiusMm ?? 3.18) * SCREEN_PX_PER_MM * zoom;
  const strokeColor = side === "front" ? "#0284c7" : "#6366f1";
  const badgeColor =
    side === "front"
      ? "bg-sky-700/90 text-sky-100"
      : "bg-indigo-700/90 text-indigo-100";

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden select-none">
      {/* Bleed Shading: 4 edge zones outside the true card cut-line */}
      {project.showBleedShading !== false && (
        <>
          <div
            className="absolute left-0 right-0 top-0 bg-neutral-900/10 backdrop-blur-[0.5px]"
            style={{ height: `${topPx}px` }}
          />
          <div
            className="absolute left-0 right-0 bottom-0 bg-neutral-900/10 backdrop-blur-[0.5px]"
            style={{
              height: `${
                (project.cardHeightMm - (trueCard.y + trueCard.height)) *
                SCREEN_PX_PER_MM *
                zoom
              }px`,
            }}
          />
          <div
            className="absolute left-0 bg-neutral-900/10 backdrop-blur-[0.5px]"
            style={{
              top: `${topPx}px`,
              height: `${heightPx}px`,
              width: `${leftPx}px`,
            }}
          />
          <div
            className="absolute right-0 bg-neutral-900/10 backdrop-blur-[0.5px]"
            style={{
              top: `${topPx}px`,
              height: `${heightPx}px`,
              width: `${
                (project.cardWidthMm - (trueCard.x + trueCard.width)) *
                SCREEN_PX_PER_MM *
                zoom
              }px`,
            }}
          />
        </>
      )}

      {/* True Card Cut-Line Frame */}
      <div
        style={{
          position: "absolute",
          left: `${leftPx}px`,
          top: `${topPx}px`,
          width: `${widthPx}px`,
          height: `${heightPx}px`,
          borderRadius: `${cornerRadiusPx}px`,
          border: `1.5px dashed ${strokeColor}`,
        }}
        className="pointer-events-none"
      >
        {/* Dimension Label Tag at bottom-right */}
        <div className="absolute -bottom-4 right-1 pointer-events-none">
          <span
            className={`text-[8px] font-mono font-bold tracking-tight px-1.5 py-0.5 rounded shadow-sm ${badgeColor}`}
          >
            {project.cardPreset && project.cardPreset !== "custom"
              ? project.cardPreset.toUpperCase()
              : "CARD"}{" "}
            CUT: {trueCard.width.toFixed(1)} × {trueCard.height.toFixed(1)} mm (R{" "}
            {project.cardCornerRadiusMm ?? 3.18}mm)
          </span>
        </div>

        {/* L-shaped corner crop marks */}
        <div
          className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t-2 border-l-2"
          style={{ borderColor: strokeColor }}
        />
        <div
          className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t-2 border-r-2"
          style={{ borderColor: strokeColor }}
        />
        <div
          className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b-2 border-l-2"
          style={{ borderColor: strokeColor }}
        />
        <div
          className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b-2 border-r-2"
          style={{ borderColor: strokeColor }}
        />

        {/* 3mm Safe Margin Guide within the true card boundary */}
        {project.showSafeArea && (
          <div
            style={{
              position: "absolute",
              left: `${3 * SCREEN_PX_PER_MM * zoom}px`,
              top: `${3 * SCREEN_PX_PER_MM * zoom}px`,
              right: `${3 * SCREEN_PX_PER_MM * zoom}px`,
              bottom: `${3 * SCREEN_PX_PER_MM * zoom}px`,
              borderRadius: `${Math.max(
                0,
                cornerRadiusPx - 3 * SCREEN_PX_PER_MM * zoom
              )}px`,
              border: "1px dotted rgba(245, 158, 11, 0.8)",
            }}
            title="Safe Margin (3mm inside cut-line)"
          />
        )}
      </div>
    </div>
  );
};
