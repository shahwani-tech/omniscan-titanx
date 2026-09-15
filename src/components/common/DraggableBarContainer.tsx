import React, { useState, useEffect, useRef } from "react";
import {
  GripVertical,
  RotateCcw,
  LayoutGrid,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  useDraggableBar,
  DockEdge,
  DefaultDockPosition,
  UseDraggableBarReturn,
} from "../../hooks/useDraggableBar";

export interface DraggableBarRenderProps extends UseDraggableBarReturn {
  dragHandleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
    onDoubleClick: () => void;
    className: string;
    title: string;
  };
}

export interface DraggableBarContainerProps {
  storageKey: string;
  barTitle?: string;
  defaultDock?: DefaultDockPosition;
  defaultY?: number;
  initialOrientation?: "horizontal" | "vertical";
  defaultOrientation?: "horizontal" | "vertical";
  canSwitchOrientation?: boolean;
  initialCollapsed?: boolean;
  minVisibleMargin?: number;
  snapThreshold?: number;
  zIndex?: number;
  className?: string;
  showBuiltinHandle?: boolean;
  onOrientationChange?: (orientation: "horizontal" | "vertical") => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  children: React.ReactNode | ((props: DraggableBarRenderProps) => React.ReactNode);
}

export const DraggableBarContainer: React.FC<DraggableBarContainerProps> = ({
  storageKey,
  barTitle = "Toolbar",
  defaultDock = "top-center",
  defaultY = 12,
  initialOrientation = "horizontal",
  defaultOrientation,
  canSwitchOrientation = true,
  initialCollapsed = false,
  minVisibleMargin = 40,
  snapThreshold = 24,
  zIndex = 30,
  className = "",
  showBuiltinHandle = false,
  onOrientationChange,
  onCollapsedChange,
  children,
}) => {
  const draggable = useDraggableBar({
    storageKey,
    defaultDock,
    defaultY,
    initialOrientation: defaultOrientation || initialOrientation,
    canSwitchOrientation,
    initialCollapsed,
    minVisibleMargin,
    snapThreshold,
    onOrientationChange,
    onCollapsedChange,
  });

  const {
    barRef,
    isDragging,
    dockEdge,
    candidateSnapEdge,
    orientation,
    isCollapsed,
    handlePointerDown,
    resetPosition,
    setDock,
    setOrientation,
    setIsCollapsed,
    containerStyle,
  } = draggable;

  const [contextMenuOpen, setContextMenuOpen] = useState<boolean>(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  // Close context menu on outside click or escape
  useEffect(() => {
    if (!contextMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenuOpen(false);
    };

    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenuOpen]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const bar = barRef.current;
    if (bar) {
      const rect = bar.getBoundingClientRect();
      setContextMenuPos({
        x: Math.max(10, e.clientX - rect.left),
        y: Math.max(10, e.clientY - rect.top),
      });
      setContextMenuOpen(true);
    }
  };

  const dragHandleProps = {
    onPointerDown: handlePointerDown,
    onContextMenu: handleContextMenu,
    onDoubleClick: resetPosition,
    className:
      "cursor-grab active:cursor-grabbing select-none transition-colors hover:text-sky-400 group p-1 rounded hover:bg-neutral-800/80 flex items-center justify-center",
    title: `${barTitle} Handle (Drag anywhere, double-click to reset, right-click for docking options)`,
  };

  return (
    <div
      ref={barRef}
      style={{
        ...containerStyle,
        zIndex,
      }}
      onPointerDown={(e) => {
        // Prevent clicking inside bar from triggering canvas pan or selection
        e.stopPropagation();
      }}
      className={`draggable-bar-wrapper select-none transition-shadow duration-150 ${
        isDragging
          ? "ring-2 ring-sky-500/80 shadow-[0_20px_50px_rgba(0,0,0,0.85)] scale-[1.01] cursor-grabbing"
          : "hover:ring-1 hover:ring-neutral-700/60"
      } ${className}`}
    >
      {/* Magnetic Edge Snap Indicator Guide */}
      {isDragging && candidateSnapEdge !== "none" && (
        <div
          className={`absolute pointer-events-none z-50 rounded-full transition-all duration-100 ${
            candidateSnapEdge === "top"
              ? "-top-2 left-0 right-0 h-1.5 bg-sky-400 shadow-[0_0_12px_#38bdf8] animate-pulse"
              : candidateSnapEdge === "bottom"
              ? "-bottom-2 left-0 right-0 h-1.5 bg-sky-400 shadow-[0_0_12px_#38bdf8] animate-pulse"
              : candidateSnapEdge === "left"
              ? "-left-2 top-0 bottom-0 w-1.5 bg-sky-400 shadow-[0_0_12px_#38bdf8] animate-pulse"
              : "-right-2 top-0 bottom-0 w-1.5 bg-sky-400 shadow-[0_0_12px_#38bdf8] animate-pulse"
          }`}
        />
      )}

      {/* Optional Built-in Handle header if component doesn't have its own */}
      {showBuiltinHandle && (
        <div
          {...dragHandleProps}
          className="flex items-center justify-between px-2 py-1 bg-neutral-900/90 border-b border-neutral-800 text-[11px] text-neutral-400 cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center space-x-1.5">
            <GripVertical className="w-3.5 h-3.5 text-neutral-400 group-hover:text-sky-400" />
            <span className="font-semibold text-neutral-300">{barTitle}</span>
          </div>

          <div className="flex items-center space-x-1" onPointerDown={(e) => e.stopPropagation()}>
            {canSwitchOrientation && (
              <button
                type="button"
                onClick={() => setOrientation(orientation === "horizontal" ? "vertical" : "horizontal")}
                className="p-1 hover:text-white rounded hover:bg-neutral-800 transition-colors"
                title={`Switch to ${orientation === "horizontal" ? "Vertical" : "Horizontal"}`}
              >
                <LayoutGrid className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={resetPosition}
              className="p-1 hover:text-sky-300 rounded hover:bg-neutral-800 transition-colors"
              title="Reset position to default"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Bar Content */}
      {typeof children === "function"
        ? children({ ...draggable, dragHandleProps })
        : children}

      {/* Right-Click Context Menu for Rapid Docking & Position Reset */}
      {contextMenuOpen && (
        <div
          ref={contextMenuRef}
          style={{
            position: "absolute",
            left: `${contextMenuPos.x}px`,
            top: `${contextMenuPos.y}px`,
          }}
          className="z-50 min-w-[210px] bg-neutral-900/98 backdrop-blur-2xl border border-neutral-750 shadow-2xl rounded-xl p-1 text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-100 select-none"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 mb-1 flex items-center justify-between">
            <span>{barTitle} Layout</span>
            {dockEdge !== "none" && (
              <span className="text-sky-400 text-[9px] font-mono capitalize">Docked: {dockEdge}</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              resetPosition();
              setContextMenuOpen(false);
            }}
            className="w-full flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-neutral-800 hover:text-white text-left transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Reset Position to Default</span>
          </button>

          <div className="h-px bg-neutral-800 my-1" />

          <div className="px-2 py-0.5 text-[9px] font-semibold text-neutral-500 uppercase">Dock to Edge</div>

          <button
            type="button"
            onClick={() => {
              setDock("top");
              setContextMenuOpen(false);
            }}
            className="w-full flex items-center space-x-2 px-2 py-1 rounded-lg hover:bg-neutral-800 hover:text-white text-left transition-colors text-[11px]"
          >
            <ArrowUp className="w-3 h-3 text-sky-400" />
            <span>Dock to Top Center</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDock("bottom");
              setContextMenuOpen(false);
            }}
            className="w-full flex items-center space-x-2 px-2 py-1 rounded-lg hover:bg-neutral-800 hover:text-white text-left transition-colors text-[11px]"
          >
            <ArrowDown className="w-3 h-3 text-sky-400" />
            <span>Dock to Bottom Center</span>
          </button>

          {canSwitchOrientation && (
            <>
              <button
                type="button"
                onClick={() => {
                  setDock("left");
                  setContextMenuOpen(false);
                }}
                className="w-full flex items-center space-x-2 px-2 py-1 rounded-lg hover:bg-neutral-800 hover:text-white text-left transition-colors text-[11px]"
              >
                <ArrowLeft className="w-3 h-3 text-sky-400" />
                <span>Dock to Left (Vertical)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDock("right");
                  setContextMenuOpen(false);
                }}
                className="w-full flex items-center space-x-2 px-2 py-1 rounded-lg hover:bg-neutral-800 hover:text-white text-left transition-colors text-[11px]"
              >
                <ArrowRight className="w-3 h-3 text-sky-400" />
                <span>Dock to Right (Vertical)</span>
              </button>

              <div className="h-px bg-neutral-800 my-1" />

              <button
                type="button"
                onClick={() => {
                  setOrientation(orientation === "horizontal" ? "vertical" : "horizontal");
                  setContextMenuOpen(false);
                }}
                className="w-full flex items-center space-x-2 px-2 py-1 rounded-lg hover:bg-neutral-800 hover:text-white text-left transition-colors text-[11px]"
              >
                <LayoutGrid className="w-3 h-3 text-indigo-400" />
                <span>Switch to {orientation === "horizontal" ? "Vertical" : "Horizontal"}</span>
              </button>
            </>
          )}

          <div className="h-px bg-neutral-800 my-1" />

          <button
            type="button"
            onClick={() => {
              setIsCollapsed((prev) => !prev);
              setContextMenuOpen(false);
            }}
            className="w-full flex items-center space-x-2 px-2 py-1 rounded-lg hover:bg-neutral-800 hover:text-white text-left transition-colors text-[11px]"
          >
            {isCollapsed ? (
              <>
                <ChevronDown className="w-3 h-3 text-emerald-400" />
                <span>Expand Bar</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3 h-3 text-neutral-400" />
                <span>Collapse Bar</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
