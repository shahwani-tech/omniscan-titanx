/**
 * OMNISCAN TITAN X - Encrypted PDF Password Unlock Modal
 */

import React, { useState } from "react";
import { Lock, KeyRound, Eye, EyeOff, AlertTriangle, X } from "lucide-react";

interface PasswordModalProps {
  isOpen: boolean;
  fileName: string;
  errorMessage?: string;
  onClose: () => void;
  onSubmitPassword: (password: string) => Promise<void>;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  fileName,
  errorMessage,
  onClose,
  onSubmitPassword,
}) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setIsSubmitting(true);
    try {
      await onSubmitPassword(password);
      setPassword("");
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-neutral-200 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-850 border-b border-neutral-800">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">Password Protected PDF</h2>
              <p className="text-[11px] text-neutral-400 truncate max-w-[260px]">{fileName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-neutral-750 text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-neutral-300 leading-relaxed">
            This document is encrypted with a password. Please enter the password to unlock and import the pages:
          </p>

          {errorMessage && (
            <div className="flex items-center space-x-2 p-2.5 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400">
              Document Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full px-3 py-2 pr-10 rounded-lg bg-neutral-950 border border-neutral-750 text-white text-xs placeholder:text-neutral-600 focus:outline-none focus:border-sky-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-1"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold transition-all shadow-md active:scale-95"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Decrypting..." : "Unlock Document"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
