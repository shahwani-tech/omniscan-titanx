/**
 * CardDesignerVectorImportModal.tsx
 * 
 * Vector & CorelDRAW Export Importer:
 * - SVG Vector Extraction: Parses <rect>, <circle>, <text>, <image>, <path> into native editable layers
 * - High-Resolution PDF Importer: Renders PDF vector pages at 300 DPI
 * - Transparent PNG Signature Importer: Preserves alpha transparency
 * - Honest CorelDRAW CDR Guidance: Transparently explains binary .cdr format limitations and provides exact export steps
 */

import React, { useState } from "react";
import { CardObject, CardSide } from "../../engine/carddesigner/types";
import {
  parseSvgToCardObjects,
  importPdfPageAsCardObject,
  importSignaturePng,
} from "../../engine/carddesigner/vectorImporter";
import {
  FileCode,
  UploadCloud,
  X,
  CheckCircle,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  PenTool,
  Info,
} from "lucide-react";

interface CardDesignerVectorImportModalProps {
  activeSide: CardSide;
  onImportObjects: (objects: CardObject[], targetSide: CardSide) => void;
  onClose: () => void;
}

export const CardDesignerVectorImportModal: React.FC<CardDesignerVectorImportModalProps> = ({
  activeSide,
  onImportObjects,
  onClose,
}) => {
  const [targetSide, setTargetSide] = useState<CardSide>(activeSide);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cdrNoticeOpen, setCdrNoticeOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const handleFile = async (file: File) => {
    setStatusMessage(null);
    setCdrNoticeOpen(false);

    const fileName = file.name.toLowerCase();

    // 1. CorelDRAW native CDR file detection
    if (fileName.endsWith(".cdr")) {
      setCdrNoticeOpen(true);
      return;
    }

    setIsProcessing(true);

    try {
      // 2. SVG file (CorelDRAW / Illustrator export)
      if (fileName.endsWith(".svg")) {
        const text = await file.text();
        const result = parseSvgToCardObjects(text, targetSide);
        if (result.success && result.objects.length > 0) {
          onImportObjects(result.objects, targetSide);
          setStatusMessage({
            type: "success",
            text: `Successfully extracted ${result.objects.length} editable vector elements into ${targetSide} card!`,
          });
          setTimeout(() => onClose(), 1200);
        } else {
          setStatusMessage({
            type: "error",
            text: result.message || "Could not extract vector elements from SVG.",
          });
        }
      }
      // 3. PDF Document
      else if (fileName.endsWith(".pdf")) {
        const result = await importPdfPageAsCardObject(file, 1, targetSide);
        if (result.success && result.objects.length > 0) {
          onImportObjects(result.objects, targetSide);
          setStatusMessage({
            type: "success",
            text: `Imported PDF page at 300 DPI print quality into ${targetSide} card!`,
          });
          setTimeout(() => onClose(), 1200);
        } else {
          setStatusMessage({
            type: "error",
            text: result.message || "Failed to render PDF page.",
          });
        }
      }
      // 4. PNG Signature / Logo Image
      else if (fileName.endsWith(".png") || fileName.endsWith(".jpg") || fileName.endsWith(".webp")) {
        const result = await importSignaturePng(file, targetSide);
        if (result.success && result.objects.length > 0) {
          onImportObjects(result.objects, targetSide);
          setStatusMessage({
            type: "success",
            text: `Imported transparent PNG with alpha channel preserved into ${targetSide} card!`,
          });
          setTimeout(() => onClose(), 1200);
        }
      } else {
        setStatusMessage({
          type: "error",
          text: "Unsupported file format. Please upload SVG, PDF, PNG, or JPG.",
        });
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: `Error processing file: ${(err as Error).message}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 select-none">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col text-neutral-200">
        {/* Header */}
        <div className="h-12 border-b border-neutral-800 px-4 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center space-x-2">
            <FileCode className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">
              Vector & CorelDRAW Export Importer
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Target Side Selector */}
          <div className="flex items-center justify-between bg-neutral-950 p-2 rounded-xl border border-neutral-800 text-xs">
            <span className="text-neutral-400 font-medium ml-1">Import Into:</span>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setTargetSide("front")}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  targetSide === "front"
                    ? "bg-sky-600 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Front Card
              </button>
              <button
                type="button"
                onClick={() => setTargetSide("back")}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  targetSide === "back"
                    ? "bg-indigo-600 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Back Card
              </button>
            </div>
          </div>

          {/* Dropzone */}
          <label className="border-2 border-dashed border-neutral-700 hover:border-indigo-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-neutral-950/50 group">
            <UploadCloud className="w-10 h-10 text-indigo-400 group-hover:scale-110 transition-transform mb-3" />
            <span className="text-sm font-bold text-white mb-1">
              Click to browse or drop vector file
            </span>
            <span className="text-xs text-neutral-400 max-w-sm">
              Supports CorelDRAW-exported <b>SVG</b> (extracts vector shapes & text), <b>PDF</b> (rendered at 300 DPI), and transparent <b>PNG</b> signatures/logos.
            </span>
            <input
              type="file"
              accept=".svg,.pdf,.png,.jpg,.jpeg,.webp,.cdr"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
          </label>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl flex items-center space-x-2 text-xs font-semibold ${
                statusMessage.type === "success"
                  ? "bg-emerald-950/70 border border-emerald-600 text-emerald-300"
                  : "bg-rose-950/70 border border-rose-600 text-rose-300"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* CorelDRAW CDR Honest Guidance Notice */}
          {cdrNoticeOpen && (
            <div className="bg-amber-950/60 border border-amber-600/70 rounded-xl p-4 text-xs space-y-2 text-amber-200">
              <div className="flex items-center space-x-2 font-bold text-amber-400">
                <Info className="w-4 h-4 shrink-0" />
                <span>CorelDRAW (.CDR) Binary File Detected</span>
              </div>
              <p className="leading-relaxed">
                CorelDRAW’s native <code>.cdr</code> file format is a closed, proprietary binary archive that cannot be parsed natively in client-side web browsers without CorelDRAW.
              </p>
              <div className="bg-neutral-950/80 p-2.5 rounded-lg border border-amber-900/50 space-y-1">
                <span className="font-semibold text-white block">Recommended Workflow (100% Vector Fidelity):</span>
                <ol className="list-decimal list-inside space-y-0.5 text-neutral-300">
                  <li>In CorelDRAW, select <b>File &gt; Export</b> (or Save As).</li>
                  <li>Choose <b>SVG (Scalable Vector Graphics)</b> or <b>PDF</b>.</li>
                  <li>Drag the exported <code>.svg</code> or <code>.pdf</code> file here.</li>
                </ol>
                <span className="text-[11px] text-sky-400 block pt-1">
                  ✓ Omniscan will automatically extract all shapes, rectangles, circles, texts, and images into editable card layers!
                </span>
              </div>
            </div>
          )}

          {/* Supported Format Badges */}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center text-[11px]">
            <div className="p-2 bg-neutral-950 rounded-lg border border-neutral-800">
              <span className="font-bold text-indigo-400 block">SVG Vector</span>
              <span className="text-neutral-500">Extracts shapes & text</span>
            </div>
            <div className="p-2 bg-neutral-950 rounded-lg border border-neutral-800">
              <span className="font-bold text-sky-400 block">Print PDF</span>
              <span className="text-neutral-500">300 DPI High-Res layer</span>
            </div>
            <div className="p-2 bg-neutral-950 rounded-lg border border-neutral-800">
              <span className="font-bold text-amber-400 block">PNG Alpha</span>
              <span className="text-neutral-500">Transparent signatures</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
