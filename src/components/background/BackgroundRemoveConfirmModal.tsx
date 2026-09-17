import React, { useEffect, useState } from "react";
import { Sparkles, X, ShieldAlert, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { detectImageTransparency, TransparencyCheckResult } from "../../utils/transparencyDetector";

export interface BackgroundRemoveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  imageUrl?: string;
  imageLabel?: string;
  isProcessing?: boolean;
}

export const BackgroundRemoveConfirmModal: React.FC<BackgroundRemoveConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  imageUrl,
  imageLabel,
  isProcessing = false,
}) => {
  const [transparencyInfo, setTransparencyInfo] = useState<TransparencyCheckResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [hasConfirmed, setHasConfirmed] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setHasConfirmed(false);
      return;
    }

    if (imageUrl) {
      let isMounted = true;
      setIsAnalyzing(true);
      detectImageTransparency(imageUrl).then((result) => {
        if (isMounted) {
          setTransparencyInfo(result);
          setIsAnalyzing(false);
        }
      });
      return () => {
        isMounted = false;
      };
    } else {
      setTransparencyInfo(null);
      setIsAnalyzing(false);
    }
  }, [isOpen, imageUrl]);

  // Keyboard shortcut: ESC to Cancel
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const handleConfirmClick = () => {
    if (hasConfirmed || isProcessing) return;
    setHasConfirmed(true);
    onConfirm();
  };

  const handleCancelClick = () => {
    if (isProcessing) return;
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          handleCancelClick();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bg-confirm-title"
    >
      <div
        id="bg-remove-confirm-popup"
        className="bg-neutral-900 border border-neutral-700/80 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 id="bg-confirm-title" className="text-sm font-bold text-white tracking-wide">
                Remove Background?
              </h3>
              {imageLabel && (
                <p className="text-[10px] text-neutral-400 font-medium">{imageLabel}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleCancelClick}
            disabled={isProcessing}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
            title="Keep Original / Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Image Thumbnail Preview with checkerboard */}
          {imageUrl && (
            <div className="flex flex-col items-center">
              <div
                className="relative rounded-xl overflow-hidden border border-neutral-700/80 max-h-40 max-w-[200px] w-full flex items-center justify-center"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg, #1e1e1e 25%, transparent 25%), linear-gradient(-45deg, #1e1e1e 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e1e1e 75%), linear-gradient(-45deg, transparent 75%, #1e1e1e 75%)",
                  backgroundSize: "16px 16px",
                  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                  backgroundColor: "#121212",
                }}
              >
                <img
                  src={imageUrl}
                  alt="Subject Preview"
                  className="max-h-40 w-auto object-contain select-none"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}

          {/* Transparency & Image Detection Report */}
          {isAnalyzing ? (
            <div className="text-[11px] text-neutral-400 flex items-center space-x-2 justify-center py-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Analyzing image channels...</span>
            </div>
          ) : transparencyInfo?.hasTransparency ? (
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200/90 flex items-start space-x-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-[11px]">
                <strong className="text-amber-300 block font-semibold">
                  PNG with Transparency Detected
                </strong>
                <span>
                  This image already contains transparent regions ({transparencyInfo.transparencyPercentage}%). You can keep the original as-is, or run background removal to re-segment the subject.
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-800/60 border border-neutral-700/50 rounded-xl p-3 text-xs text-neutral-300 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-[11px]">
                <strong className="text-neutral-200 block font-semibold">
                  Original Source Image ({transparencyInfo?.isPng ? "PNG" : "Standard"})
                </strong>
                <span>
                  The full background is currently intact. Running background removal will isolate the foreground subject into a transparent layer.
                </span>
              </div>
            </div>
          )}

          {/* Non-destructive guarantee notice */}
          <p className="text-[10px] text-neutral-400 text-center leading-relaxed">
            Your original image will not be destroyed. You can cancel or revert at any time.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-neutral-950/60 border-t border-neutral-800 flex items-center space-x-2.5">
          <button
            id="btn-confirm-keep-original"
            onClick={handleCancelClick}
            disabled={isProcessing}
            className="flex-1 py-2 px-3 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 font-semibold text-xs transition-colors flex items-center justify-center space-x-1 disabled:opacity-50"
          >
            <ImageIcon className="w-3.5 h-3.5 mr-1 text-neutral-400" />
            <span>Keep Original / Cancel</span>
          </button>

          <button
            id="btn-confirm-remove-bg"
            onClick={handleConfirmClick}
            disabled={hasConfirmed || isProcessing}
            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-lg shadow-emerald-950/50 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isProcessing ? "Processing..." : "Remove Background"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
