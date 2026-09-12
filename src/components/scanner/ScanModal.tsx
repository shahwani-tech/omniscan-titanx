/**
 * OMNISCAN TITAN X - Enterprise Document Acquisition & Scanner Studio
 * Flatbed, ADF Batch Feeder, TWAIN/WIA Emulation, Live Camera Detection
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Scan,
  Camera,
  Layers,
  Settings2,
  Play,
  RotateCw,
  Sparkles,
  CheckCircle2,
  X,
  Sliders,
  FileCheck,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import { ScannerProfile, OmniPage } from "../../types";
import { SCANNER_PROFILES, simulateScannerFeed } from "../../engine/scanner";
import { generateSampleInvoicePage, generateSampleContractPage } from "../../data/sampleDocuments";
import { DEFAULT_FILTERS } from "../../engine/vision";
import { enhanceOmniPageAdaptive } from "../../engine/autoProcessor";

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPagesAcquired: (newPages: OmniPage[]) => void;
}

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  onPagesAcquired,
}) => {
  const [source, setSource] = useState<"flatbed" | "adf" | "camera">("adf");
  const [profileId, setProfileId] = useState("profile-text-sharp");
  const [batchCount, setBatchCount] = useState(3);
  const [dpi, setDpi] = useState(300);
  const [colorMode, setColorMode] = useState<"color" | "grayscale" | "monochrome">("color");
  const [duplex, setDuplex] = useState(false);
  const [autoDeskew, setAutoDeskew] = useState(true);
  const [autoCrop, setAutoCrop] = useState(true);
  const [removeBlanks, setRemoveBlanks] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scannedPreviewPages, setScannedPreviewPages] = useState<OmniPage[]>([]);

  // Camera video ref
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    if (isOpen && source === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, source]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.warn("Camera not available or permitted:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  if (!isOpen) return null;

  const handleCaptureCamera = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    const newPage: OmniPage = {
      id: `cam-${Date.now()}`,
      pageNumber: scannedPreviewPages.length + 1,
      originalDataUrl: dataUrl,
      processedDataUrl: dataUrl,
      thumbnailDataUrl: dataUrl,
      width: canvas.width,
      height: canvas.height,
      dpi: 300,
      sizeBytes: Math.round(dataUrl.length * 0.75),
      isBlank: false,
      blankScore: 0,
      filters: {
        ...DEFAULT_FILTERS,
        backgroundWhiten: true,
        backgroundWhitenThreshold: 220,
        shadowRemoval: true,
      },
      annotations: [],
      redactions: [],
      formFields: [],
      isModified: true,
      lastModifiedAt: new Date().toISOString(),
    };

    try {
      const enhanced = await enhanceOmniPageAdaptive(newPage, {
        skipDeskew: !autoDeskew,
        skipCrop: !autoCrop,
      });
      setScannedPreviewPages((prev) => [...prev, enhanced]);
    } catch {
      setScannedPreviewPages((prev) => [...prev, newPage]);
    }
  };

  const handleExecuteScan = async () => {
    setIsScanning(true);
    setProgress(10);

    const selectedProfile = SCANNER_PROFILES.find((p) => p.id === profileId) || SCANNER_PROFILES[0];
    const targetCount = source === "flatbed" ? 1 : batchCount;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 20;
      });
    }, 300);

    try {
      const generated = await simulateScannerFeed(selectedProfile, targetCount);
      const enhancedList: OmniPage[] = [];
      for (const p of generated) {
        if (autoDeskew || autoCrop) {
          try {
            const opt = await enhanceOmniPageAdaptive(p, {
              skipDeskew: !autoDeskew,
              skipCrop: !autoCrop,
            });
            enhancedList.push(opt);
          } catch {
            enhancedList.push(p);
          }
        } else {
          enhancedList.push(p);
        }
      }
      clearInterval(interval);
      setProgress(100);
      setScannedPreviewPages((prev) => [...prev, ...enhancedList]);
    } catch (err) {
      console.error("Scan error:", err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleCommitAcquisition = () => {
    if (scannedPreviewPages.length > 0) {
      onPagesAcquired(scannedPreviewPages);
      setScannedPreviewPages([]);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-neutral-200 text-xs">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-850 border-b border-neutral-800">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-sky-600 flex items-center justify-center">
              <Scan className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">Document Acquisition &amp; Scanner Studio</h2>
              <p className="text-[11px] text-neutral-400">
                TWAIN / WIA / SANE Hardware Driver Emulator &amp; Camera Capture Rig
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-neutral-750 text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-y-auto">
          {/* Left Settings Panel (5 cols) */}
          <div className="md:col-span-5 p-4 border-r border-neutral-800 space-y-4 bg-neutral-850/50">
            {/* Input Source */}
            <div className="space-y-1.5">
              <label className="font-bold uppercase tracking-wider text-[10px] text-neutral-400">
                Acquisition Device Source
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => setSource("flatbed")}
                  className={`py-2 rounded border font-medium flex flex-col items-center space-y-1 ${
                    source === "flatbed"
                      ? "bg-sky-600 text-white border-sky-500"
                      : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750"
                  }`}
                >
                  <Scan className="w-4 h-4" />
                  <span>Flatbed</span>
                </button>
                <button
                  onClick={() => setSource("adf")}
                  className={`py-2 rounded border font-medium flex flex-col items-center space-y-1 ${
                    source === "adf"
                      ? "bg-sky-600 text-white border-sky-500"
                      : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750"
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>ADF Batch</span>
                </button>
                <button
                  onClick={() => setSource("camera")}
                  className={`py-2 rounded border font-medium flex flex-col items-center space-y-1 ${
                    source === "camera"
                      ? "bg-sky-600 text-white border-sky-500"
                      : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750"
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Camera</span>
                </button>
              </div>
            </div>

            {/* Profile Selection */}
            <div className="space-y-1.5">
              <label className="font-bold uppercase tracking-wider text-[10px] text-neutral-400">
                Hardware Acquisition Profile
              </label>
              <select
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none"
              >
                {SCANNER_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.dpi} DPI, {p.colorMode})
                  </option>
                ))}
              </select>
            </div>

            {/* Batch Count (if ADF) */}
            {source === "adf" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-300">ADF Hopper Batch Size</span>
                  <span className="font-mono text-sky-400 font-bold">{batchCount} Pages</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={batchCount}
                  onChange={(e) => setBatchCount(parseInt(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer h-1.5 bg-neutral-700 rounded-lg appearance-none"
                />
              </div>
            )}

            {/* Resolution & Color Depth */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400">Resolution (DPI)</label>
                <select
                  value={dpi}
                  onChange={(e) => setDpi(parseInt(e.target.value))}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none"
                >
                  <option value="150">150 DPI (Fast Draft)</option>
                  <option value="300">300 DPI (Archival Standard)</option>
                  <option value="600">600 DPI (High Precision)</option>
                  <option value="1200">1200 DPI (Forensic)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-neutral-400">Color Mode</label>
                <select
                  value={colorMode}
                  onChange={(e) => setColorMode(e.target.value as any)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none"
                >
                  <option value="color">24-bit TrueColor</option>
                  <option value="grayscale">8-bit Grayscale</option>
                  <option value="monochrome">1-bit Monochrome</option>
                </select>
              </div>
            </div>

            {/* Hardware Pipeline Toggles */}
            <div className="space-y-1.5 border-t border-neutral-800 pt-3">
              <label className="flex items-center justify-between p-1.5 rounded bg-neutral-800/80 cursor-pointer">
                <span>Auto-Deskew &amp; Align</span>
                <input
                  type="checkbox"
                  checked={autoDeskew}
                  onChange={(e) => setAutoDeskew(e.target.checked)}
                  className="accent-sky-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-1.5 rounded bg-neutral-800/80 cursor-pointer">
                <span>Auto-Detect Document Margins</span>
                <input
                  type="checkbox"
                  checked={autoCrop}
                  onChange={(e) => setAutoCrop(e.target.checked)}
                  className="accent-sky-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-1.5 rounded bg-neutral-800/80 cursor-pointer">
                <span>Discard Blank Pages</span>
                <input
                  type="checkbox"
                  checked={removeBlanks}
                  onChange={(e) => setRemoveBlanks(e.target.checked)}
                  className="accent-sky-500 rounded"
                />
              </label>
            </div>

            {/* Action Button */}
            {source === "camera" ? (
              <button
                onClick={handleCaptureCamera}
                disabled={!cameraActive}
                className="w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                <span>Capture Document Frame</span>
              </button>
            ) : (
              <button
                onClick={handleExecuteScan}
                disabled={isScanning}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center space-x-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                <span>{isScanning ? `Acquiring (${progress}%)...` : "Start Hardware Acquisition"}</span>
              </button>
            )}
          </div>

          {/* Right Live View & Acquired Gallery (7 cols) */}
          <div className="md:col-span-7 p-4 flex flex-col justify-between space-y-4 bg-neutral-900">
            {source === "camera" ? (
              <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden border border-neutral-800 flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                {/* Live contour detection boundary frame */}
                <div className="absolute inset-8 border-2 border-emerald-400/80 rounded border-dashed pointer-events-none flex items-center justify-center">
                  <span className="bg-black/70 px-2 py-1 rounded text-[10px] text-emerald-400 font-mono">
                    ALIGNED DOCUMENT BOUNDARY
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
                  <span>Acquired Queue ({scannedPreviewPages.length} pages ready)</span>
                  {scannedPreviewPages.length > 0 && (
                    <button
                      onClick={() => setScannedPreviewPages([])}
                      className="text-rose-400 hover:text-rose-300"
                    >
                      Clear Queue
                    </button>
                  )}
                </div>

                {scannedPreviewPages.length === 0 ? (
                  <div className="h-60 border-2 border-dashed border-neutral-800 rounded-lg flex flex-col items-center justify-center text-neutral-500 space-y-2">
                    <Scan className="w-10 h-10 text-neutral-600" />
                    <p className="text-xs">No pages acquired yet. Click "Start Hardware Acquisition".</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto custom-scrollbar p-1">
                    {scannedPreviewPages.map((p, idx) => (
                      <div
                        key={p.id}
                        className="relative rounded border border-neutral-700 bg-neutral-850 p-1.5 flex flex-col"
                      >
                        <img
                          src={p.thumbnailDataUrl || p.processedDataUrl}
                          alt={`Scan ${idx + 1}`}
                          className="w-full aspect-[3/4] object-contain rounded bg-neutral-950 mb-1"
                        />
                        <div className="flex items-center justify-between text-[10px] text-neutral-300 font-mono">
                          <span>Page {idx + 1}</span>
                          <span className="text-emerald-400 font-bold">✓ Ready</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Commit Button */}
            <div className="border-t border-neutral-800 pt-3 flex items-center justify-end space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCommitAcquisition}
                disabled={scannedPreviewPages.length === 0}
                className="px-5 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold disabled:opacity-40 transition-all flex items-center space-x-1.5 shadow-md"
              >
                <FileCheck className="w-4 h-4" />
                <span>Import {scannedPreviewPages.length} Pages into Studio</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
