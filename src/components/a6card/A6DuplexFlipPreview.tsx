import React, { useState, useEffect, useRef, useId } from "react";
import {
  RotateCcw,
  BookOpen,
  FileText,
  Sparkles,
  ArrowRightLeft,
  Check,
  Eye,
  Sliders,
} from "lucide-react";
import {
  A6CardAdjustment,
  A6PaperOrientation,
  renderProcessedCardCanvas,
} from "../../engine/a6HalfCardLayout";

export interface A6DuplexFlipPreviewProps {
  frontImage: string;
  backImage: string;
  frontAdjustment?: A6CardAdjustment;
  backAdjustment?: A6CardAdjustment;
  orientation?: A6PaperOrientation;
  duplexBinding: "long-edge" | "short-edge";
  onBindingChange?: (binding: "long-edge" | "short-edge") => void;
  activeSide?: "front" | "back";
  onSideChange?: (side: "front" | "back") => void;
  className?: string;
  compact?: boolean;
}

export const A6DuplexFlipPreview: React.FC<A6DuplexFlipPreviewProps> = ({
  frontImage,
  backImage,
  frontAdjustment,
  backAdjustment,
  orientation = "portrait",
  duplexBinding,
  onBindingChange,
  activeSide = "front",
  onSideChange,
  className = "",
  compact = false,
}) => {
  const componentId = useId();
  // Card flipped state: false = showing front, true = showing back
  const [isFlipped, setIsFlipped] = useState<boolean>(activeSide === "back");
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Cached rendered thumbnails for front and back sides
  const [frontThumb, setFrontThumb] = useState<string>(frontImage);
  const [backThumb, setBackThumb] = useState<string>(backImage);
  const [isGeneratingThumbs, setIsGeneratingThumbs] = useState<boolean>(false);

  // Detect prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Sync isFlipped with external activeSide prop when changed by parent
  useEffect(() => {
    setIsFlipped(activeSide === "back");
  }, [activeSide]);

  // Debounced, lazy thumbnail generation with offscreen canvas
  useEffect(() => {
    let isCancelled = false;
    const timer = setTimeout(async () => {
      setIsGeneratingThumbs(true);
      try {
        // Target miniature resolution (maintaining ISO aspect ratio)
        const targetW = orientation === "portrait" ? 210 : 297;
        const targetH = orientation === "portrait" ? 297 : 210;

        let renderedFront = frontImage;
        let renderedBack = backImage;

        if (frontImage && frontAdjustment) {
          try {
            const canvas = await renderProcessedCardCanvas(
              frontImage,
              frontAdjustment,
              targetW,
              targetH
            );
            renderedFront = canvas.toDataURL("image/jpeg", 0.85);
          } catch {
            renderedFront = frontImage;
          }
        }

        if (backImage && backAdjustment) {
          try {
            const canvas = await renderProcessedCardCanvas(
              backImage,
              backAdjustment,
              targetW,
              targetH
            );
            renderedBack = canvas.toDataURL("image/jpeg", 0.85);
          } catch {
            renderedBack = backImage;
          }
        }

        if (!isCancelled) {
          setFrontThumb(renderedFront);
          setBackThumb(renderedBack);
        }
      } catch (err) {
        console.warn("Error rendering duplex preview thumbnails:", err);
      } finally {
        if (!isCancelled) setIsGeneratingThumbs(false);
      }
    }, 120);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [frontImage, backImage, frontAdjustment, backAdjustment, orientation]);

  // Handle flipping toggle
  const handleToggleFlip = () => {
    const nextFlipped = !isFlipped;
    setIsFlipped(nextFlipped);
    onSideChange?.(nextFlipped ? "back" : "front");
  };

  const handleSelectSide = (side: "front" | "back") => {
    setIsFlipped(side === "back");
    onSideChange?.(side);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggleFlip();
    }
  };

  // Physical card proportion dimensions
  const isPortrait = orientation === "portrait";
  // Responsive card dimensions in px
  const cardWidth = compact
    ? isPortrait ? 120 : 170
    : isPortrait ? 150 : 212;
  const cardHeight = compact
    ? isPortrait ? 170 : 120
    : isPortrait ? 212 : 150;

  // 3D Card transform based on binding axis
  const flipTransform = isFlipped
    ? duplexBinding === "long-edge"
      ? "rotateY(180deg)"
      : "rotateX(180deg)"
    : "rotateY(0deg) rotateX(0deg)";

  return (
    <div
      id={`a6-duplex-preview-${componentId}`}
      className={`flex flex-col bg-neutral-950/80 border border-neutral-800 rounded-xl p-3 select-none text-xs ${className}`}
      aria-label="3D Duplex Flip Print Preview"
    >
      {/* Header with Title & Binding Badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
          <span className="font-bold text-neutral-200 text-[11px] uppercase tracking-wide">
            Duplex Print Preview
          </span>
        </div>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${
            duplexBinding === "long-edge"
              ? "bg-indigo-950/80 text-indigo-300 border-indigo-800"
              : "bg-amber-950/80 text-amber-300 border-amber-800"
          }`}
          title={
            duplexBinding === "long-edge"
              ? "Long-Edge Binding: Flips along vertical axis (like turning a book page)"
              : "Short-Edge Binding: Flips along horizontal axis (like flipping a notepad)"
          }
        >
          {duplexBinding === "long-edge" ? "Long-Edge Flip" : "Short-Edge Flip"}
        </span>
      </div>

      {/* Reduced Motion Accessible Fallback: Side-by-Side View */}
      {prefersReducedMotion ? (
        <div className="space-y-2.5">
          <div className="text-[10px] text-neutral-400">
            Reduced motion mode active: side-by-side duplex view.
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* Front Card */}
            <div
              onClick={() => handleSelectSide("front")}
              className={`flex flex-col items-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                !isFlipped
                  ? "bg-indigo-950/50 border-indigo-500 shadow-md ring-1 ring-indigo-500/50"
                  : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
              }`}
            >
              <div
                className="relative bg-white rounded overflow-hidden shadow mb-1.5 border border-neutral-700"
                style={{
                  width: `${cardWidth * 0.75}px`,
                  height: `${cardHeight * 0.75}px`,
                }}
              >
                <img
                  src={frontThumb}
                  alt="Front Side Thumbnail"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[10px] font-semibold text-neutral-300">Front Side</span>
            </div>

            {/* Back Card */}
            <div
              onClick={() => handleSelectSide("back")}
              className={`flex flex-col items-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                isFlipped
                  ? "bg-violet-950/50 border-violet-500 shadow-md ring-1 ring-violet-500/50"
                  : "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
              }`}
            >
              <div
                className="relative bg-white rounded overflow-hidden shadow mb-1.5 border border-neutral-700"
                style={{
                  width: `${cardWidth * 0.75}px`,
                  height: `${cardHeight * 0.75}px`,
                }}
              >
                <img
                  src={backThumb}
                  alt="Back Side Thumbnail"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-[10px] font-semibold text-neutral-300">Back Side</span>
            </div>
          </div>
        </div>
      ) : (
        /* 3D Interactive Card Stage */
        <div className="flex flex-col items-center justify-center py-2.5">
          {/* 3D Perspective Stage */}
          <div
            className="relative flex items-center justify-center cursor-pointer select-none"
            style={{
              perspective: "1200px",
              width: `${cardWidth + 24}px`,
              height: `${cardHeight + 24}px`,
            }}
            onClick={handleToggleFlip}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="button"
            aria-label={`Interactive 3D card preview. Currently showing ${
              isFlipped ? "Back" : "Front"
            } side. Press Enter or Space to flip on ${duplexBinding}.`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Card Flipper Container with 3D Preservation */}
            <div
              className="relative transition-transform duration-600 ease-in-out select-none"
              style={{
                width: `${cardWidth}px`,
                height: `${cardHeight}px`,
                transformStyle: "preserve-3d",
                transform: flipTransform,
                transition: "transform 600ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {/* ======================================================== */}
              {/* FRONT FACE                                              */}
              {/* ======================================================== */}
              <div
                className={`absolute inset-0 rounded-lg overflow-hidden border border-neutral-700 bg-white shadow-xl transition-all duration-300 ${
                  isHovered && !isFlipped ? "ring-2 ring-indigo-500/60 shadow-2xl" : ""
                }`}
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(0deg)",
                }}
              >
                <img
                  src={frontThumb}
                  alt="Front Side Preview"
                  className="w-full h-full object-cover block select-none pointer-events-none"
                />

                {/* Subtle Specular Sheen Effect on 3D Card */}
                <div
                  className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-black/20 via-transparent to-white/20"
                  aria-hidden="true"
                />

                {/* Badge Overlay */}
                <div className="absolute top-1 left-1 bg-black/75 backdrop-blur-xs text-white px-1.5 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider">
                  FRONT
                </div>
              </div>

              {/* ======================================================== */}
              {/* BACK FACE                                               */}
              {/* ======================================================== */}
              <div
                className={`absolute inset-0 rounded-lg overflow-hidden border border-neutral-700 bg-white shadow-xl transition-all duration-300 ${
                  isHovered && isFlipped ? "ring-2 ring-violet-500/60 shadow-2xl" : ""
                }`}
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform:
                    duplexBinding === "long-edge" ? "rotateY(180deg)" : "rotateX(180deg)",
                }}
              >
                <img
                  src={backThumb}
                  alt="Back Side Preview"
                  className="w-full h-full object-cover block select-none pointer-events-none"
                />

                {/* Subtle Specular Sheen Effect on 3D Card */}
                <div
                  className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-black/20 via-transparent to-white/20"
                  aria-hidden="true"
                />

                {/* Badge Overlay */}
                <div className="absolute top-1 left-1 bg-black/75 backdrop-blur-xs text-white px-1.5 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider">
                  BACK
                </div>
              </div>
            </div>

            {/* Dynamic 3D Ground Shadow */}
            <div
              className="absolute -bottom-1.5 rounded-full bg-black/40 blur-xs transition-all duration-600 pointer-events-none"
              style={{
                width: `${cardWidth * 0.85}px`,
                height: "8px",
                transform: isHovered ? "scale(1.08)" : "scale(1.0)",
              }}
              aria-hidden="true"
            />
          </div>

          {/* Interactive Cue & Current Side Label */}
          <div className="mt-2 text-center">
            <span className="text-[11px] font-medium text-neutral-300">
              Showing:{" "}
              <strong
                className={isFlipped ? "text-violet-400 font-bold" : "text-indigo-400 font-bold"}
              >
                {isFlipped ? "Back Side" : "Front Side"}
              </strong>
            </span>
            <p className="text-[10px] text-neutral-500">
              Click card or button below to simulate physical flip
            </p>
          </div>
        </div>
      )}

      {/* Flip Button & Quick Side Controls */}
      <div className="flex items-center space-x-1.5 pt-2 border-t border-neutral-800">
        <button
          type="button"
          onClick={handleToggleFlip}
          className="flex-1 py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-sm cursor-pointer"
          title="Flip 3D Card (Space or Enter)"
          aria-label={`Preview physical flip to ${isFlipped ? "Front" : "Back"} side`}
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isFlipped ? "Flip to Front" : "Preview Flip (Back)"}</span>
        </button>

        <div className="flex rounded-lg bg-neutral-900 p-0.5 border border-neutral-800">
          <button
            type="button"
            onClick={() => handleSelectSide("front")}
            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
              !isFlipped
                ? "bg-indigo-600/40 text-indigo-300 border border-indigo-500/50"
                : "text-neutral-400 hover:text-white"
            }`}
            title="View Front Side"
            aria-label="View Front Side"
          >
            Front
          </button>
          <button
            type="button"
            onClick={() => handleSelectSide("back")}
            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
              isFlipped
                ? "bg-violet-600/40 text-violet-300 border border-violet-500/50"
                : "text-neutral-400 hover:text-white"
            }`}
            title="View Back Side"
            aria-label="View Back Side"
          >
            Back
          </button>
        </div>
      </div>

      {/* Flip Edge (Long / Short) Selector */}
      <div className="mt-2.5 pt-2 border-t border-neutral-850">
        <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1.5">
          <span className="flex items-center space-x-1 font-medium text-neutral-300">
            <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
            <span>Flip Edge (Long / Short):</span>
          </span>
          <span className="font-mono text-neutral-300">
            {duplexBinding === "long-edge" ? "Book (Long Edge)" : "Notepad (Short Edge)"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onBindingChange?.("long-edge")}
            className={`py-1.5 px-2 rounded-lg text-[10px] font-medium border flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              duplexBinding === "long-edge"
                ? "bg-indigo-950 text-indigo-300 border-indigo-600 shadow-sm"
                : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700"
            }`}
            title="Flip Edge (Long / Short): Sheet flips along long edge (standard portrait book)"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
            <span>Long Edge (Book)</span>
          </button>

          <button
            type="button"
            onClick={() => onBindingChange?.("short-edge")}
            className={`py-1.5 px-2 rounded-lg text-[10px] font-medium border flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              duplexBinding === "short-edge"
                ? "bg-indigo-950 text-indigo-300 border-indigo-600 shadow-sm"
                : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700"
            }`}
            title="Flip Edge (Long / Short): Sheet flips along short edge (calendar / notepad)"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>Short Edge (Pad)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
