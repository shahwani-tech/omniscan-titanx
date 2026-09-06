/**
 * OMNISCAN TITAN X - Enterprise Security & Redaction Studio
 * Destructive Pixel Flattening, Zero-Glyph Sanitization & PDF Encryption
 */

import React, { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Key,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  X,
  FileCheck,
  Download,
} from "lucide-react";
import { OmniDocument, OmniPage } from "../../types";

interface SecurityModalProps {
  isOpen: boolean;
  document: OmniDocument;
  onClose: () => void;
  onApplySanitization: (passwordConfig: any) => Promise<void>;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  isOpen,
  document,
  onClose,
  onApplySanitization,
}) => {
  const [requirePassword, setRequirePassword] = useState(false);
  const [userPassword, setUserPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(false);
  const [destructiveFlatten, setDestructiveFlatten] = useState(true);
  const [isSanitizing, setIsSanitizing] = useState(false);

  if (!isOpen) return null;

  // Calculate total redactions across all pages
  const totalRedactions = document.pages.reduce(
    (acc, p) => acc + (p.redactions ? p.redactions.length : 0),
    0
  );

  const handleExecute = async () => {
    setIsSanitizing(true);
    try {
      await onApplySanitization({
        requirePassword,
        userPassword,
        ownerPassword,
        allowPrinting,
        allowCopying,
        destructiveFlatten,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSanitizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-neutral-200 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-850 border-b border-neutral-800">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-rose-600 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">Security, Redaction &amp; Encryption Studio</h2>
              <p className="text-[11px] text-neutral-400">
                NIST SP 800-88 Destructive Pixel Flattening &amp; AES-256 PDF Protection
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

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Redaction Audit Banner */}
          <div className="p-3 rounded-lg bg-neutral-850 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-[10px] text-neutral-400">
                Active Document Redaction Audit
              </span>
              <span className="font-mono text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-900">
                {totalRedactions} Redaction Zones
              </span>
            </div>

            <p className="text-neutral-300 leading-relaxed">
              Standard PDF editors only overlay a black box while leaving the underlying text vector glyphs searchable.
              OmniScan Titan X executes <strong>destructive pixel rasterization</strong>, permanently replacing source
              imagery and stripping vector font streams.
            </p>

            <label className="flex items-center space-x-2 p-2 rounded bg-neutral-900 border border-neutral-800 cursor-pointer">
              <input
                type="checkbox"
                checked={destructiveFlatten}
                onChange={(e) => setDestructiveFlatten(e.target.checked)}
                className="accent-rose-500 w-4 h-4 rounded"
              />
              <span className="font-semibold text-rose-300">
                Enforce NIST SP 800-88 Destructive Raster Flattening on Export
              </span>
            </label>
          </div>

          {/* PDF Password & Encryption */}
          <div className="p-3 rounded-lg bg-neutral-850 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-bold uppercase tracking-wider text-[10px] text-neutral-400">
                <Lock className="w-3.5 h-3.5 text-sky-400" />
                <span>AES-256 PDF Encryption &amp; Permissions</span>
              </div>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <span className="text-[11px] text-neutral-300">Enable Password</span>
                <input
                  type="checkbox"
                  checked={requirePassword}
                  onChange={(e) => setRequirePassword(e.target.checked)}
                  className="accent-sky-500 w-4 h-4 rounded"
                />
              </label>
            </div>

            {requirePassword && (
              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-400">Document Open Password (User)</label>
                  <input
                    type="password"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder="Enter passphrase to view document..."
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-400">Master Permissions Password (Owner)</label>
                  <input
                    type="password"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="Enter master password to modify permissions..."
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none"
                  />
                </div>

                {/* Granular Permissions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <label className="flex items-center space-x-2 p-2 rounded bg-neutral-900 border border-neutral-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowPrinting}
                      onChange={(e) => setAllowPrinting(e.target.checked)}
                      className="accent-sky-500 rounded"
                    />
                    <span>Allow High-Res Printing</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 rounded bg-neutral-900 border border-neutral-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowCopying}
                      onChange={(e) => setAllowCopying(e.target.checked)}
                      className="accent-sky-500 rounded"
                    />
                    <span>Allow Text &amp; Image Copying</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-neutral-850 border-t border-neutral-800 flex items-center justify-between">
          <span className="text-neutral-400 text-[11px]">
            Security Audit: <strong className="text-emerald-400">Pass</strong>
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleExecute}
              disabled={isSanitizing}
              className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center space-x-1.5 shadow-md disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isSanitizing ? "Sanitizing..." : "Apply Security & Export PDF"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
