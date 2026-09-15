/**
 * OMNISCAN TITAN X - Perspective Quadrangle Interactive Warp Overlay
 * CamScanner-Grade 4-Point Corner Pinning UI with 3x3 Perspective Grid,
 * Edge Midpoint Adjusters, Magnifying Loupe with Crosshair HUD, and Keyboard Nudge.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  PerspectiveQuad,
  PerspectiveCorner,
  Point,
  OmniPage,
} from "../../types";
import { calculatePerspectiveGridLines } from "../../engine/perspectiveEngine";
import { loadImage } from "../../engine/vision";

interface PerspectiveWarpOverlayProps {
  page: OmniPage;
  quad: PerspectiveQuad;
  onQuadChange: (newQuad: PerspectiveQuad) => void;
  imageUrl?: string;
  onCancel?: () => void;
}

type MidpointHandle = "top" | "right" | "bottom" | "left";

export const PerspectiveWarpOverlay: React.FC<PerspectiveWarpOverlayProps> = ({
  page,
  quad,
  onQuadChange,
  imageUrl,
  onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Active interaction states
  const [activeCorner, setActiveCorner] = useState<PerspectiveCorner | null>(null);
  const [activeMidpoint, setActiveMidpoint] = useState<MidpointHandle | null>(null);
  const [selectedCorner, setSelectedCorner] = useState<PerspectiveCorner>("topLeft");
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);
  const [snappedEdges, setSnappedEdges] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });

  // Cached image element for high-res loupe sampling
  const cachedImgRef = useRef<HTMLImageElement | null>(null);

  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialQuad: PerspectiveQuad;
  }>({
    startX: 0,
    startY: 0,
    initialQuad: quad,
  });

  const pageWidth = page.width || 800;
  const pageHeight = page.height || 1000;

  // Load source image for loupe sampling
  useEffect(() => {
    const src =
      imageUrl ||
      page.originalDataUrl ||
      page.processedDataUrl ||
      page.thumbnailDataUrl;

    if (src) {
      loadImage(src)
        .then((img) => {
          cachedImgRef.current = img;
        })
        .catch((err) => {
          console.warn("Could not cache image for warp loupe:", err);
        });
    }
  }, [imageUrl, page.originalDataUrl, page.processedDataUrl, page.thumbnailDataUrl]);

  // Update loupe canvas on drag
  useEffect(() => {
    if (!activeCorner || !pointerPos || !loupeCanvasRef.current || !cachedImgRef.current) {
      return;
    }

    const canvas = loupeCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = cachedImgRef.current;
    const cornerPt = quad[activeCorner];

    // Source coordinates in natural image pixels
    const centerSrcX = cornerPt.x * img.width;
    const centerSrcY = cornerPt.y * img.height;

    // Zoom factor for loupe (3.5x magnification)
    const zoom = 3.5;
    const sampleW = canvas.width / zoom;
    const sampleH = canvas.height / zoom;

    const srcX = centerSrcX - sampleW / 2;
    const srcY = centerSrcY - sampleH / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw magnified image
    ctx.imageSmoothingEnabled = false; // Sharp pixelated inspection
    ctx.drawImage(
      img,
      srcX,
      srcY,
      sampleW,
      sampleH,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // Draw crosshair reticle
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.lineWidth = 3;
    // Outer shadow crosshair
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, cy - 6);
    ctx.moveTo(cx, cy + 6);
    ctx.lineTo(cx, canvas.height);
    ctx.moveTo(0, cy);
    ctx.lineTo(cx - 6, cy);
    ctx.moveTo(cx + 6, cy);
    ctx.lineTo(canvas.width, cy);
    ctx.stroke();

    // Vibrant red/cyan crosshair
    ctx.strokeStyle = "#38bdf8"; // Sky 400
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, cy - 6);
    ctx.moveTo(cx, cy + 6);
    ctx.lineTo(cx, canvas.height);
    ctx.moveTo(0, cy);
    ctx.lineTo(cx - 6, cy);
    ctx.moveTo(cx + 6, cy);
    ctx.lineTo(canvas.width, cy);
    ctx.stroke();

    // Center circular aperture
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.strokeStyle = "#ef4444"; // Red 500
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [activeCorner, pointerPos, quad]);

  // Handle Corner Drag Start
  const handleCornerPointerDown = (
    e: React.PointerEvent,
    corner: PerspectiveCorner
  ) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setActiveCorner(corner);
    setSelectedCorner(corner);
    setActiveMidpoint(null);

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setPointerPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialQuad: { ...quad },
    };
  };

  // Handle Edge Midpoint Drag Start
  const handleMidpointPointerDown = (
    e: React.PointerEvent,
    midpoint: MidpointHandle
  ) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setActiveMidpoint(midpoint);
    setActiveCorner(null);

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialQuad: { ...quad },
    };
  };

  // Handle Pointer Move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeCorner && !activeMidpoint) return;
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      setPointerPos({
        x: clientX - rect.left,
        y: clientY - rect.top,
      });

      const deltaNormX = (clientX - dragStartRef.current.startX) / rect.width;
      const deltaNormY = (clientY - dragStartRef.current.startY) / rect.height;

      const initQuad = dragStartRef.current.initialQuad;

      if (activeCorner) {
        // Individual corner adjustment with magnetic snap to page edge boundaries
        const origPt = initQuad[activeCorner];
        let rawX = Math.max(0, Math.min(1, origPt.x + deltaNormX));
        let rawY = Math.max(0, Math.min(1, origPt.y + deltaNormY));

        // Magnetic snap threshold: 2.5% from canvas boundary
        const SNAP_THRESH = 0.025;
        let isSnappedX = false;
        let isSnappedY = false;

        if (rawX <= SNAP_THRESH) {
          rawX = 0;
          isSnappedX = true;
        } else if (rawX >= 1 - SNAP_THRESH) {
          rawX = 1;
          isSnappedX = true;
        }

        if (rawY <= SNAP_THRESH) {
          rawY = 0;
          isSnappedY = true;
        } else if (rawY >= 1 - SNAP_THRESH) {
          rawY = 1;
          isSnappedY = true;
        }

        setSnappedEdges({ x: isSnappedX, y: isSnappedY });

        onQuadChange({
          ...quad,
          [activeCorner]: { x: Math.round(rawX * 10000) / 10000, y: Math.round(rawY * 10000) / 10000 },
        });
      } else if (activeMidpoint) {
        // Midpoint adjustment: shift both adjacent corners
        const clampPt = (pt: Point) => ({
          x: Math.max(0, Math.min(1, Math.round((pt.x + deltaNormX) * 10000) / 10000)),
          y: Math.max(0, Math.min(1, Math.round((pt.y + deltaNormY) * 10000) / 10000)),
        });

        if (activeMidpoint === "top") {
          onQuadChange({
            ...quad,
            topLeft: clampPt(initQuad.topLeft),
            topRight: clampPt(initQuad.topRight),
          });
        } else if (activeMidpoint === "right") {
          onQuadChange({
            ...quad,
            topRight: clampPt(initQuad.topRight),
            bottomRight: clampPt(initQuad.bottomRight),
          });
        } else if (activeMidpoint === "bottom") {
          onQuadChange({
            ...quad,
            bottomLeft: clampPt(initQuad.bottomLeft),
            bottomRight: clampPt(initQuad.bottomRight),
          });
        } else if (activeMidpoint === "left") {
          onQuadChange({
            ...quad,
            topLeft: clampPt(initQuad.topLeft),
            bottomLeft: clampPt(initQuad.bottomLeft),
          });
        }
      }
    },
    [activeCorner, activeMidpoint, quad, onQuadChange]
  );

  // Handle Pointer Up
  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeCorner || activeMidpoint) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture was lost
      }
      setActiveCorner(null);
      setActiveMidpoint(null);
      setPointerPos(null);
      setSnappedEdges({ x: false, y: false });
    }
  };

  // Keyboard Nudge Support & Escape to Cancel
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel?.();
      return;
    }

    const step = e.shiftKey ? 0.01 : 0.002;
    let dx = 0;
    let dy = 0;

    if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "Tab") {
      e.preventDefault();
      const corners: PerspectiveCorner[] = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
      const nextIdx = (corners.indexOf(selectedCorner) + (e.shiftKey ? 3 : 1)) % 4;
      setSelectedCorner(corners[nextIdx]);
      return;
    } else {
      return;
    }

    e.preventDefault();
    const curr = quad[selectedCorner];
    const newX = Math.max(0, Math.min(1, curr.x + dx));
    const newY = Math.max(0, Math.min(1, curr.y + dy));

    onQuadChange({
      ...quad,
      [selectedCorner]: { x: Math.round(newX * 10000) / 10000, y: Math.round(newY * 10000) / 10000 },
    });
  };

  // Compute 3x3 Rule-of-Thirds Grid
  const { verticalLines, horizontalLines } = calculatePerspectiveGridLines(quad);

  // Calculate Edge Midpoint Positions
  const midTop: Point = {
    x: (quad.topLeft.x + quad.topRight.x) / 2,
    y: (quad.topLeft.y + quad.topRight.y) / 2,
  };
  const midRight: Point = {
    x: (quad.topRight.x + quad.bottomRight.x) / 2,
    y: (quad.topRight.y + quad.bottomRight.y) / 2,
  };
  const midBottom: Point = {
    x: (quad.bottomLeft.x + quad.bottomRight.x) / 2,
    y: (quad.bottomLeft.y + quad.bottomRight.y) / 2,
  };
  const midLeft: Point = {
    x: (quad.topLeft.x + quad.bottomLeft.x) / 2,
    y: (quad.topLeft.y + quad.bottomLeft.y) / 2,
  };

  // Polygon Points String for SVG
  const polygonPoints = `${quad.topLeft.x * 100},${quad.topLeft.y * 100} ${quad.topRight.x * 100},${quad.topRight.y * 100} ${quad.bottomRight.x * 100},${quad.bottomRight.y * 100} ${quad.bottomLeft.x * 100},${quad.bottomLeft.y * 100}`;

  // SVG Mask Path (EvenOdd rule to dark out region outside quadrilateral)
  const maskPath = `M 0 0 L 100 0 L 100 100 L 0 100 Z M ${quad.topLeft.x * 100} ${quad.topLeft.y * 100} L ${quad.topRight.x * 100} ${quad.topRight.y * 100} L ${quad.bottomRight.x * 100} ${quad.bottomRight.y * 100} L ${quad.bottomLeft.x * 100} ${quad.bottomLeft.y * 100} Z`;

  // Position of Loupe bubble relative to cursor
  const loupeTop = pointerPos ? (pointerPos.y > 140 ? pointerPos.y - 120 : pointerPos.y + 30) : 0;
  const loupeLeft = pointerPos ? Math.max(70, Math.min(pointerPos.x, (containerRef.current?.clientWidth || 800) - 70)) : 0;

  const currentCornerPoint = activeCorner ? quad[activeCorner] : quad[selectedCorner];
  const pixelX = Math.round(currentCornerPoint.x * pageWidth);
  const pixelY = Math.round(currentCornerPoint.y * pageHeight);

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="absolute inset-0 select-none z-30 pointer-events-auto outline-none"
      title="Perspective Quadrangle Warp Overlay - Drag 4 corners to match document boundaries. Tab to cycle, arrows to nudge."
    >
      {/* SVG Canvas for Mask, Grid, and Quadrangle Outline */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="quad-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="0.8" floodColor="#0284c7" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* Semi-transparent dark scrim outside the document boundaries */}
        <path
          d={maskPath}
          fill="rgba(5, 5, 5, 0.65)"
          fillRule="evenodd"
        />

        {/* Subtle highlight inside document quad */}
        <polygon
          points={polygonPoints}
          fill="rgba(2, 132, 199, 0.06)"
        />

        {/* 3x3 Rule-of-Thirds Perspective Grid Lines */}
        {verticalLines.map((line, idx) => (
          <line
            key={`v-${idx}`}
            x1={line.start.x * 100}
            y1={line.start.y * 100}
            x2={line.end.x * 100}
            y2={line.end.y * 100}
            stroke="rgba(255, 255, 255, 0.38)"
            strokeWidth="0.4"
            strokeDasharray="1.2 1.2"
          />
        ))}

        {horizontalLines.map((line, idx) => (
          <line
            key={`h-${idx}`}
            x1={line.start.x * 100}
            y1={line.start.y * 100}
            x2={line.end.x * 100}
            y2={line.end.y * 100}
            stroke="rgba(255, 255, 255, 0.38)"
            strokeWidth="0.4"
            strokeDasharray="1.2 1.2"
          />
        ))}

        {/* Magnetic Snap Guideline Indicators */}
        {(snappedEdges.x || snappedEdges.y) && (
          <rect
            x="0.2"
            y="0.2"
            width="99.6"
            height="99.6"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="0.6"
            strokeDasharray="1.5 1.5"
            className="opacity-90 animate-pulse"
          />
        )}

        {/* Quadrangle Outer Outline with Glow */}
        <polygon
          points={polygonPoints}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="0.8"
          strokeLinejoin="round"
          filter="url(#quad-glow)"
        />
      </svg>

      {/* 4 Edge Midpoint Handles */}
      {[
        { id: "top" as MidpointHandle, pt: midTop, label: "Top Edge" },
        { id: "right" as MidpointHandle, pt: midRight, label: "Right Edge" },
        { id: "bottom" as MidpointHandle, pt: midBottom, label: "Bottom Edge" },
        { id: "left" as MidpointHandle, pt: midLeft, label: "Left Edge" },
      ].map(({ id, pt, label }) => (
        <div
          key={`mid-${id}`}
          style={{
            left: `${pt.x * 100}%`,
            top: `${pt.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
          onPointerDown={(e) => handleMidpointPointerDown(e, id)}
          className={`absolute w-5 h-5 rounded-full flex items-center justify-center cursor-move transition-transform ${
            activeMidpoint === id ? "scale-125 z-40" : "hover:scale-110 z-30"
          }`}
          title={`Drag ${label} parallel`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-sky-400 border border-sky-200 shadow-md ring-2 ring-sky-950/80" />
        </div>
      ))}

      {/* 4 Interactive Corner Handles */}
      {[
        { id: "topLeft" as PerspectiveCorner, pt: quad.topLeft, label: "TL" },
        { id: "topRight" as PerspectiveCorner, pt: quad.topRight, label: "TR" },
        { id: "bottomRight" as PerspectiveCorner, pt: quad.bottomRight, label: "BR" },
        { id: "bottomLeft" as PerspectiveCorner, pt: quad.bottomLeft, label: "BL" },
      ].map(({ id, pt, label }) => {
        const isActive = activeCorner === id;
        const isSelected = selectedCorner === id;

        return (
          <div
            key={id}
            style={{
              left: `${pt.x * 100}%`,
              top: `${pt.y * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
            onPointerDown={(e) => handleCornerPointerDown(e, id)}
            onClick={() => setSelectedCorner(id)}
            className={`absolute w-8 h-8 flex items-center justify-center cursor-crosshair group ${
              isActive ? "z-50 scale-125" : isSelected ? "z-40 scale-110" : "z-30 hover:scale-115"
            } transition-transform duration-75`}
            title={`${label} Corner: (${Math.round(pt.x * 100)}%, ${Math.round(pt.y * 100)}%)`}
          >
            {/* Outer Glow Ring */}
            <div
              className={`absolute inset-0 rounded-full ${
                isActive
                  ? "bg-sky-400/40 animate-ping"
                  : isSelected
                  ? "bg-sky-500/30"
                  : "bg-sky-500/10 group-hover:bg-sky-500/25"
              }`}
            />

            {/* Target Reticle Ring */}
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-xl transition-colors ${
                isActive
                  ? "border-white bg-sky-500"
                  : isSelected
                  ? "border-sky-300 bg-sky-600"
                  : "border-sky-400 bg-neutral-900 group-hover:border-white"
              }`}
            >
              {/* Inner Center Dot */}
              <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
            </div>

            {/* Corner Badge Label */}
            <div
              className={`absolute -bottom-5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-tight shadow-lg transition-opacity ${
                isActive || isSelected
                  ? "opacity-100 bg-sky-600 text-white"
                  : "opacity-0 group-hover:opacity-100 bg-neutral-900/90 text-sky-300 border border-sky-700/50"
              }`}
            >
              {label}
            </div>
          </div>
        );
      })}

      {/* Magnifying Loupe Bubble (CamScanner-Grade Precision Crosshair Zoom) */}
      {activeCorner && pointerPos && (
        <div
          style={{
            top: `${loupeTop}px`,
            left: `${loupeLeft}px`,
            transform: "translate(-50%, -50%)",
          }}
          className="absolute z-50 flex flex-col items-center pointer-events-none animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Circular Zoom Lens */}
          <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-white shadow-2xl ring-4 ring-sky-600/60 bg-neutral-950">
            <canvas
              ref={loupeCanvasRef}
              width={112}
              height={112}
              className="w-full h-full block"
            />
          </div>

          {/* Coordinate HUD readout */}
          <div className="mt-1.5 px-2 py-0.5 rounded-full bg-neutral-900/95 border border-neutral-700 text-[10px] font-mono text-neutral-200 shadow-xl flex items-center space-x-2">
            <span className="text-sky-400 font-bold uppercase">{activeCorner}</span>
            <span>
              {pixelX} × {pixelY} px
            </span>
            {(snappedEdges.x || snappedEdges.y) && (
              <span className="text-emerald-400 font-bold bg-emerald-950/80 px-1 rounded text-[9px] border border-emerald-500/40">
                SNAPPED
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
