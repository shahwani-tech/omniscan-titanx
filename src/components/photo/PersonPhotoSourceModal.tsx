/**
 * OMNISCAN TITAN X - Person Photo Source Modal
 * Selects or captures photo specifically for a multi-person group,
 * with device file upload, document pages picker, webcam capture, and sample portraits.
 */

import React, { useState, useRef, useEffect } from "react";
import { OmniPage } from "../../types";
import { MultiPersonSlotGroup } from "../../engine/multiPersonLayout";
import {
  Upload,
  Camera,
  FileText,
  User,
  Sparkles,
  X,
  Check,
  Crop,
  Wand2,
} from "lucide-react";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/bmp";

interface PersonPhotoSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: MultiPersonSlotGroup | null;
  pages?: OmniPage[];
  onSelectPhoto: (dataUrl: string, immediateCrop?: boolean) => void;
  onOpenCropForPerson?: () => void;
  showToast?: (message: string) => void;
}

export const PersonPhotoSourceModal: React.FC<PersonPhotoSourceModalProps> = ({
  isOpen,
  onClose,
  person,
  pages = [],
  onSelectPhoto,
  onOpenCropForPerson,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<"upload" | "document" | "camera" | "samples">("upload");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen || activeTab !== "camera") {
      stopCamera();
    }
  }, [isOpen, activeTab]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.warn("Camera stream failed:", err);
      setCameraError("Camera unavailable or permission denied.");
    }
  };

  const captureCamera = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      stopCamera();
      onSelectPhoto(dataUrl, true);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        onSelectPhoto(event.target.result, true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        onSelectPhoto(event.target.result, true);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen || !person) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
              style={{ backgroundColor: person.color }}
            />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Select Photo for {person.label}</span>
                <span className="text-xs px-2 py-0.5 rounded font-mono text-neutral-300 bg-neutral-800">
                  {person.slotCount} slot{person.slotCount > 1 ? "s" : ""}
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400">
                Upload or capture a biometric portrait for this print group
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Photo Status Banner (if exists) */}
        {person.photoUrl && (
          <div className="px-5 py-2.5 bg-neutral-950/80 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <img
                src={person.photoUrl}
                alt={person.label}
                className="w-8 h-10 object-cover rounded border border-neutral-700"
              />
              <div>
                <span className="text-xs font-semibold text-emerald-400 flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Photo currently set ({person.status})</span>
                </span>
                <span className="text-[10px] text-neutral-400 block">
                  Click 'Re-crop / Retouch' to adjust or select new photo below
                </span>
              </div>
            </div>

            {onOpenCropForPerson && (
              <button
                onClick={() => {
                  onClose();
                  onOpenCropForPerson();
                }}
                className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold flex items-center space-x-1 transition-colors"
              >
                <Crop className="w-3 h-3" />
                <span>Re-crop</span>
              </button>
            )}
          </div>
        )}

        {/* Source Tabs */}
        <div className="px-5 pt-3 pb-1 flex items-center space-x-2 border-b border-neutral-800">
          <button
            onClick={() => setActiveTab("upload")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors ${
              activeTab === "upload"
                ? "bg-neutral-800 text-white font-bold"
                : "text-neutral-400 hover:text-white hover:bg-neutral-850"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>

          {pages.length > 0 && (
            <button
              onClick={() => setActiveTab("document")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors ${
                activeTab === "document"
                  ? "bg-neutral-800 text-white font-bold"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-850"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Document Pages ({pages.length})</span>
            </button>
          )}

          <button
            onClick={() => {
              setActiveTab("camera");
              startCamera();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors ${
              activeTab === "camera"
                ? "bg-neutral-800 text-white font-bold"
                : "text-neutral-400 hover:text-white hover:bg-neutral-850"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera</span>
          </button>

          <button
            onClick={() => setActiveTab("samples")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors ${
              activeTab === "samples"
                ? "bg-neutral-800 text-white font-bold"
                : "text-neutral-400 hover:text-white hover:bg-neutral-850"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sample ID</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 flex-1 min-h-[220px]">
          {/* 1. Upload File */}
          {activeTab === "upload" && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-neutral-700 hover:border-sky-500 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-neutral-950/40 hover:bg-neutral-950"
            >
              <div className="w-12 h-12 rounded-full bg-sky-950/60 border border-sky-600/40 flex items-center justify-center text-sky-400 mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-white mb-1">
                Drop portrait photo here or click to browse
              </p>
              <p className="text-xs text-neutral-400 max-w-xs">
                Supports JPG, PNG, WEBP, and PDF documents. Will open in Biometric Crop Studio.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES}
                className="hidden"
                onChange={handleFile}
              />
            </div>
          )}

          {/* 2. Document Pages */}
          {activeTab === "document" && (
            <div className="space-y-2">
              <span className="text-xs text-neutral-400 block">
                Select an existing scanned page from current session:
              </span>
              <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1 custom-scrollbar">
                {pages.map((pg, idx) => (
                  <button
                    key={pg.id}
                    onClick={() => onSelectPhoto(pg.processedDataUrl || pg.originalDataUrl, true)}
                    className="relative aspect-[3/4] rounded-lg overflow-hidden border border-neutral-800 hover:border-sky-500 transition-all hover:scale-102 group"
                  >
                    <img
                      src={pg.thumbnailDataUrl || pg.processedDataUrl}
                      alt={`Page ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-[10px] font-bold text-white bg-sky-600 px-1.5 py-0.5 rounded">
                        Use Page
                      </span>
                    </div>
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] font-mono text-center text-white py-0.5">
                      #{idx + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Camera */}
          {activeTab === "camera" && (
            <div className="flex flex-col items-center space-y-3">
              {cameraError ? (
                <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs text-center">
                  {cameraError}
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden aspect-[4/3] w-full max-w-sm bg-black border border-neutral-800">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-36 h-48 border-2 border-sky-400 border-dashed rounded-full opacity-60" />
                  </div>
                </div>
              )}

              {isCameraActive && (
                <button
                  onClick={captureCamera}
                  className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs flex items-center space-x-2 transition-colors shadow-lg"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capture Photo for {person.label}</span>
                </button>
              )}
            </div>
          )}

          {/* 4. Sample Portraits */}
          {activeTab === "samples" && (
            <div className="space-y-3">
              <span className="text-xs text-neutral-400 block">
                Select a standard biometric sample for testing:
              </span>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() =>
                    onSelectPhoto(
                      `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><rect width="100%" height="100%" fill="%23f1f5f9"/><circle cx="300" cy="300" r="160" fill="%23cbd5e1"/><ellipse cx="300" cy="720" rx="260" ry="220" fill="%231e293b"/><text x="300" y="320" font-family="sans-serif" font-size="28" font-weight="bold" fill="%23475569" text-anchor="middle">MALE SUIT</text></svg>`,
                      true
                    )
                  }
                  className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-sky-500 text-center transition-colors group"
                >
                  <div className="text-xs font-bold text-white group-hover:text-sky-400">Male Suit</div>
                  <div className="text-[10px] text-neutral-400">Formal Tie</div>
                </button>

                <button
                  onClick={() =>
                    onSelectPhoto(
                      `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><rect width="100%" height="100%" fill="%23f8fafc"/><circle cx="300" cy="300" r="160" fill="%23e2e8f0"/><ellipse cx="300" cy="720" rx="260" ry="220" fill="%23047857"/><text x="300" y="320" font-family="sans-serif" font-size="28" font-weight="bold" fill="%23334155" text-anchor="middle">FEMALE BLAZER</text></svg>`,
                      true
                    )
                  }
                  className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-sky-500 text-center transition-colors group"
                >
                  <div className="text-xs font-bold text-white group-hover:text-sky-400">Female Blazer</div>
                  <div className="text-[10px] text-neutral-400">Executive</div>
                </button>

                <button
                  onClick={() =>
                    onSelectPhoto(
                      `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><rect width="100%" height="100%" fill="%23e2e8f0"/><circle cx="300" cy="300" r="160" fill="%2394a3b8"/><ellipse cx="300" cy="720" rx="260" ry="220" fill="%23334155"/><text x="300" y="320" font-family="sans-serif" font-size="28" font-weight="bold" fill="%231e293b" text-anchor="middle">ID CARD</text></svg>`,
                      true
                    )
                  }
                  className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-sky-500 text-center transition-colors group"
                >
                  <div className="text-xs font-bold text-white group-hover:text-sky-400">ID Portrait</div>
                  <div className="text-[10px] text-neutral-400">Neutral Gray</div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
