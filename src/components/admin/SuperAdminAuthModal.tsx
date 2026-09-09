/**
 * OMNISCAN TITAN X - Super Admin Authentication Gateway Modal
 * Triggered exclusively via internal focus-safe keyboard sequence.
 * Handles first-time master password initialization and authenticated login.
 */

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  Copy,
  Check,
  Lock,
} from "lucide-react";
import { superAdminAuthService } from "../../services/security/SuperAdminAuthService";
import { licenseService } from "../../services/security/LicenseService";

interface SuperAdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

export const SuperAdminAuthModal: React.FC<SuperAdminAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
}) => {
  const [isConfigured, setIsConfigured] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [copiedRecovery, setCopiedRecovery] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setConfirmPassword("");
      setErrorMsg("");
      setSuccessMsg("");
      setRecoveryCode("");

      // Check if system is configured
      const status = licenseService.getStatus();
      if (status) {
        setIsConfigured(status.isConfigured);
      } else {
        licenseService.fetchStatus().then((s) => setIsConfigured(s.isConfigured));
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasLength = password.length >= 10;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);
  const isFormValid = isConfigured
    ? password.length > 0
    : hasLength && hasUpper && hasLower && hasDigit && hasSpecial && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setIsLoading(true);

    try {
      if (!isConfigured) {
        // Initial setup
        const result = await superAdminAuthService.setup(password, confirmPassword);
        if (!result.success) {
          setErrorMsg(result.message);
          setIsLoading(false);
          return;
        }

        if (result.recoveryCode) {
          setRecoveryCode(result.recoveryCode);
          setSuccessMsg("Super Admin master credentials provisioned successfully!");
          setIsConfigured(true);
        } else {
          onAuthenticated();
          onClose();
        }
      } else {
        // Login
        const result = await superAdminAuthService.login(password);
        if (!result.success) {
          setErrorMsg(result.message);
          setIsLoading(false);
          return;
        }

        onAuthenticated();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to communicate with authentication gateway.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyRecovery = () => {
    if (recoveryCode) {
      navigator.clipboard.writeText(recoveryCode);
      setCopiedRecovery(true);
      setTimeout(() => setCopiedRecovery(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                {isConfigured ? "Super Admin Gateway" : "Super Admin Initial Setup"}
              </h2>
              <p className="text-[11px] text-neutral-400">Restricted Workstation Controller</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {recoveryCode ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-lg text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Super Admin master password created successfully!</span>
              </div>

              <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 space-y-2">
                <span className="text-[11px] font-semibold text-amber-400 block">
                  Important: Save Owner Recovery Key
                </span>
                <p className="text-[11px] text-neutral-400">
                  Store this key offline in a safe location. It is the only authorized mechanism to
                  reset master administrative credentials.
                </p>
                <div className="flex items-center justify-between bg-neutral-900 p-2 rounded border border-neutral-800 text-xs font-mono text-white">
                  <span>{recoveryCode}</span>
                  <button
                    onClick={handleCopyRecovery}
                    className="flex items-center space-x-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[11px]"
                  >
                    {copiedRecovery ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Key</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  onAuthenticated();
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-lg shadow-sky-600/20 transition-colors"
              >
                Proceed to Super Admin Panel
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isConfigured && (
                <div className="p-3 rounded-lg bg-sky-950/40 border border-sky-800/60 text-xs text-sky-200 space-y-1">
                  <p className="font-semibold">Initial Master Provisioning</p>
                  <p className="text-neutral-400 text-[11px]">
                    Create a strong master password to govern workstation licensing, identity, and
                    security policies.
                  </p>
                </div>
              )}

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-neutral-300">
                  {isConfigured ? "Master Password" : "New Master Password"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter master password..."
                    autoFocus
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-3 pr-10 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password (Setup only) */}
              {!isConfigured && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-neutral-300">
                    Confirm Master Password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm master password..."
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    disabled={isLoading}
                  />

                  {/* Password Strength Checklist */}
                  <div className="pt-2 grid grid-cols-2 gap-1 text-[10px] text-neutral-400">
                    <span className={hasLength ? "text-emerald-400" : ""}>
                      • At least 10 characters
                    </span>
                    <span className={hasUpper ? "text-emerald-400" : ""}>
                      • At least 1 uppercase
                    </span>
                    <span className={hasLower ? "text-emerald-400" : ""}>
                      • At least 1 lowercase
                    </span>
                    <span className={hasDigit ? "text-emerald-400" : ""}>
                      • At least 1 number
                    </span>
                    <span className={hasSpecial ? "text-emerald-400" : ""}>
                      • At least 1 symbol
                    </span>
                    <span
                      className={
                        password && confirmPassword && password === confirmPassword
                          ? "text-emerald-400"
                          : ""
                      }
                    >
                      • Passwords match
                    </span>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="flex items-center space-x-2 text-rose-400 text-xs bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-lg">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-3 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-neutral-300 text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !isFormValid}
                  className="flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:pointer-events-none text-white font-medium text-xs shadow-lg shadow-sky-600/20 transition-colors"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{isConfigured ? "Unlock Console" : "Complete Provisioning"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
