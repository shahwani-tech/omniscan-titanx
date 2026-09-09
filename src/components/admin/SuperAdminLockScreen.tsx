/**
 * OMNISCAN TITAN X - Enterprise Lock & Expiration Screen
 * Modal barrier rendering when application license is expired, locked, or tampered.
 * Completely seals the application UI and provides Super Admin authenticated unlock.
 */

import React, { useState } from "react";
import {
  Lock,
  ShieldAlert,
  Clock,
  KeyRound,
  AlertTriangle,
  Copy,
  Check,
  Building,
  Mail,
  HelpCircle,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { PublicLicenseStatusResponse } from "../../types/security";
import { licenseService } from "../../services/security/LicenseService";

interface SuperAdminLockScreenProps {
  status: PublicLicenseStatusResponse;
  onUnlocked: () => void;
  onOpenSuperAdminPanel: () => void;
}

export const SuperAdminLockScreen: React.FC<SuperAdminLockScreenProps> = ({
  status,
  onUnlocked,
  onOpenSuperAdminPanel,
}) => {
  const [unlockPassword, setUnlockPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    if (status.installationId) {
      navigator.clipboard.writeText(status.installationId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2500);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword.trim()) {
      setErrorMsg("Please enter the Super Admin master password.");
      return;
    }

    setIsVerifying(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/admin/config/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: unlockPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Authentication failed. Invalid master password.");
        setIsVerifying(false);
        return;
      }

      // Re-fetch status to clear lock
      await licenseService.fetchStatus();
      setUnlockPassword("");
      onUnlocked();
      onOpenSuperAdminPanel();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reach security authentication service.");
    } finally {
      setIsVerifying(false);
    }
  };

  const formattedExpiry = new Date(status.expiresAt).toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: status.timeZone || undefined,
  });

  const isSuspended = status.licenseStatus === "suspended";
  const isExpired = status.licenseStatus === "expired";
  const isLocked = status.licenseStatus === "locked";

  let statusBadgeLabel = "LICENSE EXPIRED";
  let statusBadgeClass = "bg-rose-950/80 text-rose-300 border-rose-800/80";

  if (isSuspended) {
    statusBadgeLabel = "INSTALLATION SUSPENDED";
    statusBadgeClass = "bg-amber-950/80 text-amber-300 border-amber-800/80";
  } else if (isLocked) {
    statusBadgeLabel = "SYSTEM LOCKED";
    statusBadgeClass = "bg-red-950/80 text-red-300 border-red-800/80";
  }

  return (
    <div
      id="omniscan-security-lockout-barrier"
      className="fixed inset-0 z-[999999] bg-neutral-950/95 backdrop-blur-xl flex items-center justify-center p-4 select-none text-neutral-200"
    >
      <div className="max-w-xl w-full bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header Ribbon */}
        <div className="bg-neutral-900/90 border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white tracking-wide">
                {status.applicationName || "OmniScan Titan X"}
              </h1>
              <p className="text-[11px] text-neutral-400">Enterprise Security Barrier</p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase border ${statusBadgeClass}`}
          >
            {statusBadgeLabel}
          </span>
        </div>

        {/* Lock Screen Body */}
        <div className="p-6 space-y-5">
          {/* Main Notice Box */}
          <div className="rounded-xl bg-neutral-950/60 border border-neutral-800/80 p-4 space-y-3">
            <div className="flex items-start space-x-3">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-white">Application Access Restricted</p>
                <p className="text-neutral-400 leading-relaxed">
                  {status.lockReason ||
                    "This workstation has exceeded its allocated operational license timeframe or has been placed on administrative hold."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800/60 text-[11px]">
              <div>
                <span className="text-neutral-500 block">Expiration Timestamp:</span>
                <span className="text-neutral-300 font-mono flex items-center space-x-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="truncate">{formattedExpiry}</span>
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Time Zone:</span>
                <span className="text-neutral-300 font-mono mt-0.5 block truncate">
                  {status.timeZone || "UTC"}
                </span>
              </div>
            </div>
          </div>

          {/* Installation Reference Card */}
          <div className="rounded-lg bg-neutral-950/40 border border-neutral-800/60 p-3 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                Installation ID
              </span>
              <p className="font-mono text-neutral-300 select-all text-[11px]">
                {status.installationId}
              </p>
            </div>
            <button
              onClick={handleCopyId}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors text-xs"
              title="Copy Installation ID"
            >
              {copiedId ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy ID</span>
                </>
              )}
            </button>
          </div>

          {/* Authenticated Unlock Form */}
          <form onSubmit={handleUnlock} className="space-y-3 pt-2">
            <label className="block text-xs font-medium text-neutral-300">
              Super Admin Master Password:
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                placeholder="Enter authorized administrator password..."
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-3 pr-10 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
                disabled={isVerifying}
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

            {errorMsg && (
              <div className="flex items-center space-x-2 text-rose-400 text-xs bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-lg">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying || !unlockPassword}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:pointer-events-none text-white font-medium text-xs shadow-lg shadow-sky-600/20 transition-colors"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Authorization...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Unlock & Open Super Admin</span>
                </>
              )}
            </button>
          </form>

          {/* Contact / Support Footer */}
          <div className="pt-3 border-t border-neutral-800/80 text-[11px] text-neutral-500 flex flex-col space-y-1">
            <span className="font-semibold text-neutral-400">License Support & Procurement:</span>
            <div className="flex items-center space-x-4 text-neutral-400">
              {status.supportContact && (
                <span className="flex items-center space-x-1">
                  <Building className="w-3 h-3 text-neutral-500" />
                  <span>{status.supportContact}</span>
                </span>
              )}
              {status.supportEmail && (
                <span className="flex items-center space-x-1">
                  <Mail className="w-3 h-3 text-neutral-500" />
                  <a
                    href={`mailto:${status.supportEmail}`}
                    className="text-sky-400 hover:underline"
                  >
                    {status.supportEmail}
                  </a>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
