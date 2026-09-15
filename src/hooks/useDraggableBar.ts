import { useState, useEffect, useRef, useCallback } from "react";

export type DockEdge = "none" | "top" | "bottom" | "left" | "right";
export type DefaultDockPosition = "top-center" | "bottom-center" | "top-left" | "top-right";

export interface StoredBarState {
  x: number;
  y: number;
  dockEdge?: DockEdge;
  orientation?: "horizontal" | "vertical";
  isCollapsed?: boolean;
  timestamp?: number;
}

export interface UseDraggableBarOptions {
  storageKey: string;
  defaultDock?: DefaultDockPosition;
  defaultY?: number;
  initialOrientation?: "horizontal" | "vertical";
  initialCollapsed?: boolean;
  canSwitchOrientation?: boolean;
  minVisibleMargin?: number; // Minimum pixels that must remain visible inside container (default: 40px)
  snapThreshold?: number; // Distance in pixels to trigger magnetic edge snap (default: 20px)
  onPositionChange?: (pos: { x: number; y: number }) => void;
  onDockChange?: (dock: DockEdge) => void;
  onOrientationChange?: (orientation: "horizontal" | "vertical") => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export interface UseDraggableBarReturn {
  barRef: React.RefObject<HTMLDivElement | null>;
  position: { x: number; y: number } | null;
  dragDelta: { x: number; y: number };
  isDragging: boolean;
  dockEdge: DockEdge;
  candidateSnapEdge: DockEdge;
  orientation: "horizontal" | "vertical";
  isCollapsed: boolean;
  handlePointerDown: (e: React.PointerEvent) => void;
  resetPosition: () => void;
  setDock: (dock: DockEdge) => void;
  setOrientation: (orientation: "horizontal" | "vertical") => void;
  toggleOrientation: () => void;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  containerStyle: React.CSSProperties;
}

export function useDraggableBar({
  storageKey,
  defaultDock = "top-center",
  defaultY = 12,
  initialOrientation = "horizontal",
  initialCollapsed = false,
  canSwitchOrientation = true,
  minVisibleMargin = 40,
  snapThreshold = 20,
  onPositionChange,
  onDockChange,
  onOrientationChange,
  onCollapsedChange,
}: UseDraggableBarOptions): UseDraggableBarReturn {
  const barRef = useRef<HTMLDivElement | null>(null);

  // Read initial stored state from localStorage immediately (synchronously on mount)
  const getInitialState = (): {
    pos: { x: number; y: number } | null;
    dock: DockEdge;
    orient: "horizontal" | "vertical";
    collapsed: boolean;
  } => {
    if (typeof window === "undefined") {
      return { pos: null, dock: "none", orient: initialOrientation, collapsed: initialCollapsed };
    }
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: StoredBarState = JSON.parse(stored);
        if (
          typeof parsed.x === "number" &&
          !Number.isNaN(parsed.x) &&
          typeof parsed.y === "number" &&
          !Number.isNaN(parsed.y)
        ) {
          return {
            pos: { x: parsed.x, y: parsed.y },
            dock: parsed.dockEdge || "none",
            orient: parsed.orientation || initialOrientation,
            collapsed: typeof parsed.isCollapsed === "boolean" ? parsed.isCollapsed : initialCollapsed,
          };
        }
      }
    } catch {
      // Ignore corrupted localStorage data
    }
    return { pos: null, dock: "none", orient: initialOrientation, collapsed: initialCollapsed };
  };

  const initialValues = useRef(getInitialState()).current;

  const [position, setPosition] = useState<{ x: number; y: number } | null>(initialValues.pos);
  const [dockEdge, setDockEdge] = useState<DockEdge>(initialValues.dock);
  const [orientation, setOrientationState] = useState<"horizontal" | "vertical">(initialValues.orient);
  const [isCollapsed, setIsCollapsedState] = useState<boolean>(initialValues.collapsed);

  // Active dragging state (GPU-accelerated via dragDelta transform)
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragDelta, setDragDelta] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [candidateSnapEdge, setCandidateSnapEdge] = useState<DockEdge>("none");

  // Drag tracking refs
  const startPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastPointerRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const activePointerIdRef = useRef<number | null>(null);

  // Persist state to localStorage on demand (strictly on pointerup or explicit setting change)
  const persistState = useCallback(
    (pos: { x: number; y: number } | null, dock: DockEdge, orient: "horizontal" | "vertical", coll: boolean) => {
      if (typeof window === "undefined" || !pos) return;
      try {
        const stateToStore: StoredBarState = {
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          dockEdge: dock,
          orientation: orient,
          isCollapsed: coll,
          timestamp: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(stateToStore));
      } catch (err) {
        console.warn(`[useDraggableBar] Failed to persist ${storageKey}:`, err);
      }
    },
    [storageKey]
  );

  // Helper to compute default position within parent container
  const computeDefaultPosition = useCallback(
    (parentWidth: number, parentHeight: number, barWidth: number, barHeight: number): { x: number; y: number } => {
      switch (defaultDock) {
        case "top-center":
          return {
            x: Math.max(8, Math.round((parentWidth - barWidth) / 2)),
            y: defaultY,
          };
        case "bottom-center":
          return {
            x: Math.max(8, Math.round((parentWidth - barWidth) / 2)),
            y: Math.max(8, parentHeight - barHeight - defaultY),
          };
        case "top-left":
          return { x: 12, y: defaultY };
        case "top-right":
          return { x: Math.max(12, parentWidth - barWidth - 12), y: defaultY };
        default:
          return {
            x: Math.max(8, Math.round((parentWidth - barWidth) / 2)),
            y: defaultY,
          };
      }
    },
    [defaultDock, defaultY]
  );

  // Validate and clamp position against parent container bounds
  const validateAndClampPosition = useCallback(
    (
      currentPos: { x: number; y: number } | null,
      parentElem: HTMLElement,
      currentDock: DockEdge
    ): { x: number; y: number } => {
      const parentRect = parentElem.getBoundingClientRect();
      const parentWidth = parentRect.width;
      const parentHeight = parentRect.height;

      const barElem = barRef.current;
      const barWidth = barElem?.offsetWidth || 300;
      const barHeight = barElem?.offsetHeight || 44;

      if (!currentPos || parentWidth <= 0 || parentHeight <= 0) {
        return computeDefaultPosition(parentWidth, parentHeight, barWidth, barHeight);
      }

      // Check if docked to right or bottom to preserve docking alignment across resizes
      if (currentDock === "right") {
        return {
          x: Math.max(8, parentWidth - barWidth - 8),
          y: Math.max(8, Math.min(parentHeight - barHeight - 8, currentPos.y)),
        };
      }
      if (currentDock === "bottom") {
        return {
          x: Math.max(8, Math.min(parentWidth - barWidth - 8, currentPos.x)),
          y: Math.max(8, parentHeight - barHeight - 8),
        };
      }

      // Completely off-screen check:
      const completelyOffScreen =
        currentPos.x > parentWidth + 100 ||
        currentPos.x < -barWidth - 100 ||
        currentPos.y > parentHeight + 100 ||
        currentPos.y < -barHeight - 100;

      if (completelyOffScreen) {
        return computeDefaultPosition(parentWidth, parentHeight, barWidth, barHeight);
      }

      // Partially out-of-bounds check (ensure at least minVisibleMargin px remains in view)
      const minX = -barWidth + minVisibleMargin;
      const maxX = parentWidth - minVisibleMargin;
      const minY = 0;
      const maxY = parentHeight - minVisibleMargin;

      const clampedX = Math.max(minX, Math.min(maxX, currentPos.x));
      const clampedY = Math.max(minY, Math.min(maxY, currentPos.y));

      return { x: clampedX, y: clampedY };
    },
    [computeDefaultPosition, minVisibleMargin]
  );

  // ResizeObserver on parent container to automatically nudge back into bounds on resize
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const parent = bar.parentElement || document.body;

    const handleResize = () => {
      setPosition((prevPos) => {
        const clamped = validateAndClampPosition(prevPos, parent, dockEdge);
        if (!prevPos || Math.abs(prevPos.x - clamped.x) > 1 || Math.abs(prevPos.y - clamped.y) > 1) {
          return clamped;
        }
        return prevPos;
      });
    };

    // Initial check on mount
    handleResize();

    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => {
        handleResize();
      });
      ro.observe(parent);
    } catch {
      // Fallback
    }

    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [validateAndClampPosition, dockEdge]);

  // Pointer move & up handlers
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const bar = barRef.current;
      if (!bar) return;
      const parent = bar.parentElement || document.body;
      const parentRect = parent.getBoundingClientRect();

      const dx = e.clientX - startPointerRef.current.x;
      const dy = e.clientY - startPointerRef.current.y;

      const candidateX = startPosRef.current.x + dx;
      const candidateY = startPosRef.current.y + dy;

      const barWidth = bar.offsetWidth || 300;
      const barHeight = bar.offsetHeight || 44;
      const parentWidth = parentRect.width;
      const parentHeight = parentRect.height;

      // Minimum visible area constraint enforcement
      const minX = -barWidth + minVisibleMargin;
      const maxX = parentWidth - minVisibleMargin;
      const minY = 0;
      const maxY = parentHeight - minVisibleMargin;

      const clampedCandidateX = Math.max(minX, Math.min(maxX, candidateX));
      const clampedCandidateY = Math.max(minY, Math.min(maxY, candidateY));

      const effectiveDx = clampedCandidateX - startPosRef.current.x;
      const effectiveDy = clampedCandidateY - startPosRef.current.y;

      // Velocity & Dwell tracking for escapable magnetic snap
      const now = Date.now();
      const dt = Math.max(1, now - lastPointerRef.current.time);
      const dist = Math.hypot(e.clientX - lastPointerRef.current.x, e.clientY - lastPointerRef.current.y);
      const speed = dist / dt; // px/ms
      lastPointerRef.current = { x: e.clientX, y: e.clientY, time: now };

      // Snap detection: trigger when within snapThreshold and moving deliberately (<0.7 px/ms)
      let snap: DockEdge = "none";
      if (speed < 0.7) {
        if (clampedCandidateY <= snapThreshold) {
          snap = "top";
        } else if (parentHeight - (clampedCandidateY + barHeight) <= snapThreshold) {
          snap = "bottom";
        } else if (clampedCandidateX <= snapThreshold) {
          snap = "left";
        } else if (parentWidth - (clampedCandidateX + barWidth) <= snapThreshold) {
          snap = "right";
        }
      }

      setCandidateSnapEdge(snap);
      setDragDelta({ x: effectiveDx, y: effectiveDy });
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      if (activePointerIdRef.current !== null && barRef.current) {
        try {
          barRef.current.releasePointerCapture(activePointerIdRef.current);
        } catch {
          // ignore
        }
        activePointerIdRef.current = null;
      }

      const bar = barRef.current;
      if (!bar) return;
      const parent = bar.parentElement || document.body;
      const parentRect = parent.getBoundingClientRect();
      const parentWidth = parentRect.width;
      const parentHeight = parentRect.height;
      const barWidth = bar.offsetWidth || 300;
      const barHeight = bar.offsetHeight || 44;

      const finalCandidateX = startPosRef.current.x + dragDelta.x;
      const finalCandidateY = startPosRef.current.y + dragDelta.y;

      let finalX = finalCandidateX;
      let finalY = finalCandidateY;
      let finalDock: DockEdge = candidateSnapEdge;
      let newOrient = orientation;

      // Apply magnetic snap docking if active
      if (candidateSnapEdge === "top") {
        finalY = 12;
        if (canSwitchOrientation && orientation === "vertical") {
          newOrient = "horizontal";
          setOrientationState("horizontal");
          onOrientationChange?.("horizontal");
        }
      } else if (candidateSnapEdge === "bottom") {
        finalY = Math.max(12, parentHeight - barHeight - 12);
        if (canSwitchOrientation && orientation === "vertical") {
          newOrient = "horizontal";
          setOrientationState("horizontal");
          onOrientationChange?.("horizontal");
        }
      } else if (candidateSnapEdge === "left") {
        finalX = 8;
        if (canSwitchOrientation && orientation === "horizontal") {
          newOrient = "vertical";
          setOrientationState("vertical");
          onOrientationChange?.("vertical");
        }
      } else if (candidateSnapEdge === "right") {
        finalX = Math.max(8, parentWidth - barWidth - 8);
        if (canSwitchOrientation && orientation === "horizontal") {
          newOrient = "vertical";
          setOrientationState("vertical");
          onOrientationChange?.("vertical");
        }
      } else {
        // Enforce boundary clamping on drop
        finalX = Math.max(8, Math.min(parentWidth - barWidth - 8, finalCandidateX));
        finalY = Math.max(8, Math.min(parentHeight - barHeight - 8, finalCandidateY));
        finalDock = "none";
      }

      const newPos = { x: Math.round(finalX), y: Math.round(finalY) };
      setPosition(newPos);
      setDockEdge(finalDock);
      setDragDelta({ x: 0, y: 0 });
      setCandidateSnapEdge("none");

      onPositionChange?.(newPos);
      onDockChange?.(finalDock);

      // Persist to localStorage strictly on pointerup
      persistState(newPos, finalDock, newOrient, isCollapsed);
    };

    window.addEventListener("pointermove", handleGlobalPointerMove, { passive: false });
    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerUp);

    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerUp);
    };
  }, [
    isDragging,
    dragDelta,
    candidateSnapEdge,
    orientation,
    canSwitchOrientation,
    isCollapsed,
    minVisibleMargin,
    snapThreshold,
    onPositionChange,
    onDockChange,
    onOrientationChange,
    persistState,
  ]);

  // Drag handle pointer down handler
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only drag on primary mouse click or touch
      if (e.button !== 0) return;

      e.stopPropagation();
      e.preventDefault();

      const bar = barRef.current;
      if (!bar) return;
      const parent = bar.parentElement || document.body;
      const parentRect = parent.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();

      const currentX = barRect.left - parentRect.left;
      const currentY = barRect.top - parentRect.top;

      startPointerRef.current = { x: e.clientX, y: e.clientY };
      startPosRef.current = { x: currentX, y: currentY };
      lastPointerRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };

      isDraggingRef.current = true;
      setIsDragging(true);
      setDragDelta({ x: 0, y: 0 });
      setCandidateSnapEdge("none");

      // Pointer capture ensures smooth 60fps tracking even if cursor leaves the bar
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
        activePointerIdRef.current = e.pointerId;
      } catch {
        // ignore
      }
    },
    []
  );

  // Reset position to default location & orientation
  const resetPosition = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }

    const bar = barRef.current;
    const parent = bar?.parentElement || document.body;
    const parentRect = parent.getBoundingClientRect();
    const barWidth = bar?.offsetWidth || 300;
    const barHeight = bar?.offsetHeight || 44;

    const defPos = computeDefaultPosition(parentRect.width, parentRect.height, barWidth, barHeight);
    setPosition(defPos);
    setDockEdge("none");
    setCandidateSnapEdge("none");
    setDragDelta({ x: 0, y: 0 });
    setOrientationState(initialOrientation);
    setIsCollapsedState(initialCollapsed);

    onPositionChange?.(defPos);
    onDockChange?.("none");
    onOrientationChange?.(initialOrientation);
    onCollapsedChange?.(initialCollapsed);
  }, [
    storageKey,
    computeDefaultPosition,
    initialOrientation,
    initialCollapsed,
    onPositionChange,
    onDockChange,
    onOrientationChange,
    onCollapsedChange,
  ]);

  const setDock = useCallback(
    (dock: DockEdge) => {
      const bar = barRef.current;
      if (!bar) return;
      const parent = bar.parentElement || document.body;
      const parentRect = parent.getBoundingClientRect();
      const barWidth = bar.offsetWidth || 300;
      const barHeight = bar.offsetHeight || 44;

      let newX = position?.x ?? 0;
      let newY = position?.y ?? 12;
      let newOrient = orientation;

      if (dock === "top") {
        newY = 12;
        newX = Math.round((parentRect.width - barWidth) / 2);
        if (canSwitchOrientation) newOrient = "horizontal";
      } else if (dock === "bottom") {
        newY = Math.max(12, parentRect.height - barHeight - 12);
        newX = Math.round((parentRect.width - barWidth) / 2);
        if (canSwitchOrientation) newOrient = "horizontal";
      } else if (dock === "left") {
        newX = 8;
        if (canSwitchOrientation) newOrient = "vertical";
      } else if (dock === "right") {
        newX = Math.max(8, parentRect.width - barWidth - 8);
        if (canSwitchOrientation) newOrient = "vertical";
      }

      const newPos = { x: newX, y: newY };
      setPosition(newPos);
      setDockEdge(dock);
      setOrientationState(newOrient);
      onPositionChange?.(newPos);
      onDockChange?.(dock);
      onOrientationChange?.(newOrient);

      persistState(newPos, dock, newOrient, isCollapsed);
    },
    [position, orientation, canSwitchOrientation, isCollapsed, onPositionChange, onDockChange, onOrientationChange, persistState]
  );

  const setOrientation = useCallback(
    (orient: "horizontal" | "vertical") => {
      setOrientationState(orient);
      onOrientationChange?.(orient);
      persistState(position, dockEdge, orient, isCollapsed);
    },
    [position, dockEdge, isCollapsed, onOrientationChange, persistState]
  );

  const toggleOrientation = useCallback(() => {
    if (!canSwitchOrientation) return;
    setOrientationState((prev) => {
      const next = prev === "horizontal" ? "vertical" : "horizontal";
      onOrientationChange?.(next);
      persistState(position, dockEdge, next, isCollapsed);
      return next;
    });
  }, [canSwitchOrientation, position, dockEdge, isCollapsed, onOrientationChange, persistState]);

  const setIsCollapsed = useCallback(
    (updater: boolean | ((prev: boolean) => boolean)) => {
      setIsCollapsedState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        onCollapsedChange?.(next);
        persistState(position, dockEdge, orientation, next);
        return next;
      });
    },
    [position, dockEdge, orientation, onCollapsedChange, persistState]
  );

  // CSS transform: during drag, use translate3d(dx, dy, 0) for 60fps GPU performance without reflow
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    left: position ? `${position.x}px` : undefined,
    top: position ? `${position.y}px` : `${defaultY}px`,
    ...(position
      ? {}
      : {
          left: defaultDock === "top-center" || defaultDock === "bottom-center" ? "50%" : "12px",
          transform:
            defaultDock === "top-center" || defaultDock === "bottom-center"
              ? "translateX(-50%)"
              : undefined,
        }),
    transform: isDragging
      ? `translate3d(${dragDelta.x}px, ${dragDelta.y}px, 0) scale(1.01)`
      : undefined,
    willChange: isDragging ? "transform" : "auto",
    transition: isDragging ? "none" : "box-shadow 150ms ease-out, border-color 150ms ease-out, transform 150ms ease-out",
  };

  return {
    barRef,
    position,
    dragDelta,
    isDragging,
    dockEdge,
    candidateSnapEdge,
    orientation,
    isCollapsed,
    handlePointerDown,
    resetPosition,
    setDock,
    setOrientation,
    toggleOrientation,
    setIsCollapsed,
    containerStyle,
  };
}
