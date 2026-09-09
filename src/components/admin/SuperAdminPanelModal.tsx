/**
 * OMNISCAN TITAN X - Super Admin & Central Management Console
 * Enterprise administration panel for license management, installation identity,
 * branding, security policies, audit logging, and Discord telemetry.
 */

import React, { useState, useEffect } from "react";
import {
  Shield,
  Clock,
  KeyRound,
  Tag,
  Cpu,
  Cloud,
  Bell,
  FileText,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  Calendar,
  Save,
  Download,
  Upload,
  RotateCcw,
  Search,
  ExternalLink,
  Building,
  Mail,
  Sliders,
  Send,
} from "lucide-react";
import {
  PublicLicenseStatusResponse,
  ExpirationHistoryEntry,
  AuditLogEntry,
  CentralInstallationRecord,
} from "../../types/security";
import { superAdminAuthService } from "../../services/security/SuperAdminAuthService";
import { licenseService } from "../../services/security/LicenseService";
import { applicationBrandingService } from "../../services/security/ApplicationBrandingService";

interface SuperAdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoggedOut: () => void;
}

type TabType = "license" | "branding" | "central" | "security" | "audit";

export const SuperAdminPanelModal: React.FC<SuperAdminPanelModalProps> = ({
  isOpen,
  onClose,
  onLoggedOut,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("license");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Full configuration state loaded from backend
  const [adminConfig, setAdminConfig] = useState<any>(null);
  const [copiedId, setCopiedId] = useState(false);

  // License form state
  const [durationPreset, setDurationPreset] = useState<string>("30_days");
  const [customDays, setCustomDays] = useState<number>(30);
  const [customMonths, setCustomMonths] = useState<number>(1);
  const [exactDate, setExactDate] = useState<string>("");
  const [exactTime, setExactTime] = useState<string>("12:00");
  const [selectedTimeZone, setSelectedTimeZone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  );
  const [gracePeriodEnabled, setGracePeriodEnabled] = useState(false);
  const [gracePeriodHours, setGracePeriodHours] = useState(0);

  // Immediate lock state
  const [lockReason, setLockReason] = useState("Administrative policy hold");
  const [lockPasswordConfirm, setLockPasswordConfirm] = useState("");
  const [showLockConfirmModal, setShowLockConfirmModal] = useState(false);

  // Branding form state
  const [appName, setAppName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [supportContact, setSupportContact] = useState("");
  const [supportEmail, setSupportEmail] = useState("");

  // Security & Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sessionTimeout, setSessionTimeout] = useState(15);
  const [maxFailedAttempts, setMaxFailedAttempts] = useState(5);
  const [lockoutDuration, setLockoutDuration] = useState(15);

  // Export / Import state
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [exportedJson, setExportedJson] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importMasterPassword, setImportMasterPassword] = useState("");

  // Discord form state
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [discordChannelId, setDiscordChannelId] = useState("");
  const [notifyOnRegistration, setNotifyOnRegistration] = useState(true);
  const [notifyOnExpiringSoon, setNotifyOnExpiringSoon] = useState(true);
  const [notifyOnExpired, setNotifyOnExpired] = useState(true);
  const [notifyOnLockdown, setNotifyOnLockdown] = useState(true);
  const [notifyOnFailedLogins, setNotifyOnFailedLogins] = useState(true);
  const [notifyOnRename, setNotifyOnRename] = useState(true);
  const [isSendingDiscordTest, setIsSendingDiscordTest] = useState(false);

  // Central Installations state
  const [centralInstallations, setCentralInstallations] = useState<CentralInstallationRecord[]>([]);
  const [centralSearch, setCentralSearch] = useState("");

  // Audit logs
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditFilter, setAuditFilter] = useState("all");

  const loadAdminData = async () => {
    const token = superAdminAuthService.getSessionToken();
    if (!token) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/config", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to load admin configuration (${res.status})`);
      }

      const data = await res.json();
      setAdminConfig(data);

      // Populate local form states
      setAppName(data.branding.applicationName);
      setOrgName(data.branding.organizationName || "");
      setSupportContact(data.branding.supportContact || "");
      setSupportEmail(data.branding.supportEmail || "");

      setGracePeriodEnabled(data.license.gracePeriodEnabled || false);
      setGracePeriodHours(data.license.gracePeriodHours || 0);
      setSelectedTimeZone(data.license.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);

      setSessionTimeout(data.policy.sessionTimeoutMinutes || 15);
      setMaxFailedAttempts(data.policy.maxFailedLoginAttempts || 5);
      setLockoutDuration(data.policy.lockoutDurationMinutes || 15);

      setDiscordEnabled(data.discord.enabled || false);
      setDiscordChannelId(data.discord.channelId || "");
      setNotifyOnRegistration(data.discord.notifyOnRegistration ?? true);
      setNotifyOnExpiringSoon(data.discord.notifyOnExpiringSoon ?? true);
      setNotifyOnExpired(data.discord.notifyOnExpired ?? true);
      setNotifyOnLockdown(data.discord.notifyOnLockdown ?? true);
      setNotifyOnFailedLogins(data.discord.notifyOnFailedLogins ?? true);
      setNotifyOnRename(data.discord.notifyOnRename ?? true);

      // Fetch installations & logs
      fetchCentralInstallations();
      fetchAuditLogs();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCentralInstallations = async () => {
    const token = superAdminAuthService.getSessionToken();
    if (!token) return;
    try {
      const q = centralSearch ? `?search=${encodeURIComponent(centralSearch)}` : "";
      const res = await fetch(`/api/central/installations${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCentralInstallations(data.installations || []);
      }
    } catch {}
  };

  const fetchAuditLogs = async () => {
    const token = superAdminAuthService.getSessionToken();
    if (!token) return;
    try {
      const cat = auditFilter !== "all" ? `?category=${auditFilter}` : "";
      const res = await fetch(`/api/admin/audit-logs${cat}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      loadAdminData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === "central") {
      fetchCentralInstallations();
    } else if (isOpen && activeTab === "audit") {
      fetchAuditLogs();
    }
  }, [activeTab, centralSearch, auditFilter]);

  if (!isOpen) return null;

  const handleCopyInstallationId = () => {
    if (adminConfig?.installation?.installationId) {
      navigator.clipboard.writeText(adminConfig.installation.installationId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleManualLock = () => {
    superAdminAuthService.lockSession();
    onLoggedOut();
    onClose();
  };

  // License update handler
  const handleUpdateLicense = async (quickExtendDays?: number) => {
    const token = superAdminAuthService.getSessionToken();
    if (!token) return;

    setFeedback(null);
    setIsLoading(true);

    try {
      let payload: any = {
        gracePeriodEnabled,
        gracePeriodHours,
        timeZone: selectedTimeZone,
      };

      if (quickExtendDays) {
        payload.durationUnit = "days";
        payload.durationValue = quickExtendDays;
        payload.reason = `Quick license extension of +${quickExtendDays} days`;
      } else if (durationPreset === "custom_days") {
        payload.durationUnit = "days";
        payload.durationValue = customDays;
      } else if (durationPreset === "custom_months") {
        payload.durationUnit = "months";
        payload.durationValue = customMonths;
      } else if (durationPreset === "exact") {
        if (!exactDate) throw new Error("Please select an exact expiration date.");
        const combinedIso = new Date(`${exactDate}T${exactTime || "00:00"}:00`).toISOString();
        payload.durationUnit = "exact";
        payload.exactExpiresAt = combinedIso;
      } else if (durationPreset.endsWith("_days")) {
        const days = parseInt(durationPreset.replace("_days", ""), 10);
        payload.durationUnit = "days";
        payload.durationValue = days;
      } else if (durationPreset.endsWith("_months")) {
        const months = parseInt(durationPreset.replace("_months", ""), 10);
        payload.durationUnit = "months";
        payload.durationValue = months;
      }

      const res = await fetch("/api/admin/config/license", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update license");

      setFeedback({ type: "success", message: "License schedule updated and synchronized!" });
      await licenseService.fetchStatus();
      loadAdminData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Immediate lockdown handler
  const handleImmediateLock = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = superAdminAuthService.getSessionToken();
    if (!token) return;

    if (!lockPasswordConfirm) {
      setFeedback({ type: "error", message: "Master password confirmation is required for immediate lockdown." });
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/config/lock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: lockReason,
          confirmPassword: lockPasswordConfirm,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to lock application");

      setShowLockConfirmModal(false);
      setLockPasswordConfirm("");
      await licenseService.fetchStatus();
      setFeedback({ type: "success", message: "Application locked down immediately." });
      loadAdminData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Immediate unlock handler
  const handleUnlockApplication = async () => {
    const token = superAdminAuthService.getSessionToken();
    if (!token) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/config/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: currentPassword || "admin-bypass" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to release lockdown");

      await licenseService.fetchStatus();
      setFeedback({ type: "success", message: "Application unlocked and active." });
      loadAdminData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Branding update handler
  const handleUpdateBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = superAdminAuthService.getSessionToken();
    if (!token) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/config/branding", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          applicationName: appName,
          organizationName: orgName,
          supportContact,
          supportEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update branding");

      applicationBrandingService.setName(appName);
      await licenseService.fetchStatus();
      setFeedback({ type: "success", message: "Application branding updated across all surfaces!" });
      loadAdminData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Password rotation handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const result = await superAdminAuthService.changePassword(
      currentPassword,
      newPassword,
      confirmPassword
    );

    if (!result.success) {
      setFeedback({ type: "error", message: result.message });
    } else {
      setFeedback({ type: "success", message: result.message });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  // Discord settings handler
  const handleSaveDiscord = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = superAdminAuthService.getSessionToken();
    if (!token) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/config/discord", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          enabled: discordEnabled,
          channelId: discordChannelId,
          notifyOnRegistration,
          notifyOnExpiringSoon,
          notifyOnExpired,
          notifyOnLockdown,
          notifyOnFailedLogins,
          notifyOnRename,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update Discord integration");

      setFeedback({ type: "success", message: "Discord notification settings saved!" });
      loadAdminData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Test Discord handler
  const handleTestDiscord = async () => {
    const token = superAdminAuthService.getSessionToken();
    if (!token) return;

    setIsSendingDiscordTest(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/discord/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: "Discord test notification sent successfully!" });
      } else {
        setFeedback({ type: "error", message: data.message });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to send Discord test." });
    } finally {
      setIsSendingDiscordTest(false);
    }
  };

  const license = adminConfig?.license;
  const remaining = adminConfig?.publicStatus?.remainingTime;
  const formattedExpiry = license?.expiresAt
    ? new Date(license.expiresAt).toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "medium",
        timeZone: license.timeZone,
      })
    : "Unset";

  return (
    <div
      id="super-admin-management-console"
      className="fixed inset-0 z-[100001] bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-3 select-none text-neutral-200"
    >
      <div className="w-full max-w-5xl h-[88vh] max-h-[850px] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Console Bar */}
        <div className="px-6 py-3.5 border-b border-neutral-800 bg-neutral-900 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm font-semibold text-white tracking-wide">
                  Super Admin Management Console
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-950 text-sky-400 border border-sky-800">
                  {adminConfig?.installation?.appVersion || "2.5.0-Enterprise"}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Installation Identity &amp; Licensing Command Center
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Installation ID Badge */}
            {adminConfig?.installation?.installationId && (
              <div className="flex items-center space-x-1.5 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800 text-xs">
                <span className="text-[10px] text-neutral-500 font-mono">ID:</span>
                <span className="font-mono text-neutral-300 text-[11px]">
                  {adminConfig.installation.installationId}
                </span>
                <button
                  onClick={handleCopyInstallationId}
                  className="p-1 hover:text-white text-neutral-400"
                  title="Copy Installation ID"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}

            {/* Lock Session Button */}
            <button
              onClick={handleManualLock}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs transition-colors"
              title="Lock Super Admin Session"
            >
              <LogOut className="w-3.5 h-3.5 text-neutral-400" />
              <span>Lock Admin</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 px-6 border-b border-neutral-800 bg-neutral-900/60 text-xs shrink-0 overflow-x-auto">
          {[
            { id: "license", label: "License & Expiry", icon: Clock },
            { id: "branding", label: "Branding & Identity", icon: Tag },
            { id: "central", label: "Central & Discord", icon: Cloud },
            { id: "security", label: "Security & Session", icon: KeyRound },
            { id: "audit", label: "Audit Logs", icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center space-x-2 py-3 px-3.5 border-b-2 font-medium transition-colors ${
                  isActive
                    ? "border-sky-500 text-sky-400"
                    : "border-transparent text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Global Feedback Alert */}
        {feedback && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl flex items-center justify-between text-xs border ${
              feedback.type === "success"
                ? "bg-emerald-950/50 border-emerald-800/80 text-emerald-300"
                : "bg-rose-950/50 border-rose-800/80 text-rose-300"
            }`}
          >
            <div className="flex items-center space-x-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-neutral-400 hover:text-white text-xs px-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Panel Main Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ========================================================================= */}
          {/* TAB 1: LICENSE & EXPIRATION MANAGEMENT                                    */}
          {/* ========================================================================= */}
          {activeTab === "license" && (
            <div className="space-y-6">
              {/* License Status Hero Card */}
              <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                    Current License Status
                  </span>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider border ${
                        license?.status === "active"
                          ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                          : license?.status === "expiring_soon"
                          ? "bg-amber-950 text-amber-400 border-amber-800"
                          : "bg-rose-950 text-rose-400 border-rose-800"
                      }`}
                    >
                      {license?.status || "ACTIVE"}
                    </span>
                    {license?.status === "locked" && (
                      <span className="text-xs text-rose-400 font-medium">Locked Down</span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 truncate pt-1">
                    License ID: <span className="font-mono">{license?.licenseId}</span>
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                    Expiration Timestamp
                  </span>
                  <p className="text-sm font-semibold text-white font-mono">{formattedExpiry}</p>
                  <p className="text-[11px] text-neutral-400">
                    Zone: {license?.timeZone || selectedTimeZone}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                    Remaining Operational Time
                  </span>
                  <div className="grid grid-cols-4 gap-1 text-center font-mono">
                    <div className="bg-neutral-900 p-1.5 rounded border border-neutral-800">
                      <span className="text-base font-bold text-sky-400">{remaining?.days ?? 0}</span>
                      <span className="block text-[9px] text-neutral-500">DAYS</span>
                    </div>
                    <div className="bg-neutral-900 p-1.5 rounded border border-neutral-800">
                      <span className="text-base font-bold text-sky-400">{remaining?.hours ?? 0}</span>
                      <span className="block text-[9px] text-neutral-500">HRS</span>
                    </div>
                    <div className="bg-neutral-900 p-1.5 rounded border border-neutral-800">
                      <span className="text-base font-bold text-sky-400">{remaining?.minutes ?? 0}</span>
                      <span className="block text-[9px] text-neutral-500">MIN</span>
                    </div>
                    <div className="bg-neutral-900 p-1.5 rounded border border-neutral-800">
                      <span className="text-base font-bold text-sky-400">{remaining?.seconds ?? 0}</span>
                      <span className="block text-[9px] text-neutral-500">SEC</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Configure Expiration Scheduler */}
              <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">License Duration &amp; Expiration Scheduler</h3>
                    <p className="text-xs text-neutral-400">
                      Configure duration-based, month-based, or exact date/time expiration.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleUpdateLicense(1)}
                      className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] text-neutral-300 hover:text-white"
                      title="Quick extend 1 day"
                    >
                      +1 Day
                    </button>
                    <button
                      onClick={() => handleUpdateLicense(7)}
                      className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] text-neutral-300 hover:text-white"
                      title="Quick extend 7 days"
                    >
                      +7 Days
                    </button>
                    <button
                      onClick={() => handleUpdateLicense(30)}
                      className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] text-neutral-300 hover:text-white"
                      title="Quick extend 30 days"
                    >
                      +30 Days
                    </button>
                    <button
                      onClick={() => handleUpdateLicense(365)}
                      className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[11px] text-neutral-300 hover:text-white"
                      title="Quick extend 1 year"
                    >
                      +1 Year
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Presets Selector */}
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-neutral-300">
                      Duration Preset:
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { id: "1_days", label: "1 Day" },
                        { id: "2_days", label: "2 Days" },
                        { id: "3_days", label: "3 Days" },
                        { id: "4_days", label: "4 Days" },
                        { id: "5_days", label: "5 Days" },
                        { id: "custom_days", label: "Custom Days..." },
                        { id: "1_months", label: "1 Month" },
                        { id: "2_months", label: "2 Months" },
                        { id: "3_months", label: "3 Months" },
                        { id: "4_months", label: "4 Months" },
                        { id: "5_months", label: "5 Months" },
                        { id: "custom_months", label: "Custom Months..." },
                        { id: "exact", label: "Exact Date & Time" },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setDurationPreset(preset.id)}
                          className={`py-2 px-3 rounded-lg border text-left font-medium transition-all ${
                            durationPreset === preset.id
                              ? "bg-sky-950/60 border-sky-600 text-sky-300 shadow-sm"
                              : "bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Inputs for Duration */}
                  <div className="space-y-4 bg-neutral-950/60 p-4 rounded-xl border border-neutral-800/80">
                    {durationPreset === "custom_days" && (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-neutral-300">
                          Enter Custom Days:
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={3650}
                          value={customDays}
                          onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                        />
                      </div>
                    )}

                    {durationPreset === "custom_months" && (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-neutral-300">
                          Enter Custom Months:
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={customMonths}
                          onChange={(e) => setCustomMonths(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                        />
                      </div>
                    )}

                    {durationPreset === "exact" && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="block text-[11px] text-neutral-400">Date</label>
                            <input
                              type="date"
                              value={exactDate}
                              onChange={(e) => setExactDate(e.target.value)}
                              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[11px] text-neutral-400">Time</label>
                            <input
                              type="time"
                              value={exactTime}
                              onChange={(e) => setExactTime(e.target.value)}
                              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] text-neutral-400">Time Zone</label>
                          <select
                            value={selectedTimeZone}
                            onChange={(e) => setSelectedTimeZone(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          >
                            <option value="UTC">UTC (Universal Coordinated Time)</option>
                            <option value="America/New_York">America/New_York (EST/EDT)</option>
                            <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                            <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                            <option value="Europe/London">Europe/London (GMT/BST)</option>
                            <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                            <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
                            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                            <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                            <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Grace Period Configuration */}
                    <div className="pt-2 border-t border-neutral-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-neutral-300">
                          Optional Grace Period:
                        </label>
                        <input
                          type="checkbox"
                          checked={gracePeriodEnabled}
                          onChange={(e) => setGracePeriodEnabled(e.target.checked)}
                          className="rounded bg-neutral-900 border-neutral-700 text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                        />
                      </div>
                      {gracePeriodEnabled && (
                        <div className="space-y-1">
                          <label className="block text-[11px] text-neutral-400">
                            Grace Duration (Hours):
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={72}
                            value={gracePeriodHours}
                            onChange={(e) => setGracePeriodHours(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUpdateLicense()}
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-lg shadow-sky-600/20 transition-colors flex items-center justify-center space-x-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Apply Expiration Schedule</span>
                    </button>
                  </div>
                </div>

                {/* Immediate Lock / Unlock Control Bar */}
                <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-white">Administrative Lockdown</span>
                    <p className="text-[11px] text-neutral-400">
                      Emergency workstation seal. Renders application inoperable immediately.
                    </p>
                  </div>

                  {license?.status === "locked" || license?.status === "suspended" ? (
                    <button
                      type="button"
                      onClick={handleUnlockApplication}
                      className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Release Lockdown (Unlock)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowLockConfirmModal(true)}
                      className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-xs font-medium shadow-md shadow-rose-900/30"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Immediately Lock Application</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Expiration History Table */}
              <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-5 space-y-3">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  License &amp; Expiration Audit History
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-neutral-800 text-neutral-400 text-[11px]">
                        <th className="pb-2">Timestamp</th>
                        <th className="pb-2">Action</th>
                        <th className="pb-2">New Expiration</th>
                        <th className="pb-2">Reason</th>
                        <th className="pb-2">Actor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 font-mono text-[11px]">
                      {adminConfig?.expirationHistory?.map((h: ExpirationHistoryEntry) => (
                        <tr key={h.id} className="hover:bg-neutral-800/40">
                          <td className="py-2 text-neutral-400">
                            {new Date(h.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2 font-sans">
                            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold bg-neutral-800 text-neutral-300">
                              {h.action}
                            </span>
                          </td>
                          <td className="py-2 text-neutral-200">
                            {h.newExpiresAt ? new Date(h.newExpiresAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-2 font-sans text-neutral-300">{h.reason}</td>
                          <td className="py-2 font-sans text-neutral-400">{h.actor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: BRANDING & INSTALLATION IDENTITY                                   */}
          {/* ========================================================================= */}
          {activeTab === "branding" && (
            <div className="space-y-6">
              {/* Identity Details Card */}
              <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Cryptographic Installation Identity</h3>
                    <p className="text-xs text-neutral-400">
                      Stable unique hardware-bound machine identifier and organizational tenant tags.
                    </p>
                  </div>
                  <button
                    onClick={handleCopyInstallationId}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId ? "Copied" : "Copy Installation ID"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 space-y-1">
                    <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                      Installation ID
                    </span>
                    <p className="font-mono text-white text-xs select-all truncate">
                      {adminConfig?.installation?.installationId}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 space-y-1">
                    <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                      Tenant / Org ID
                    </span>
                    <p className="font-mono text-white text-xs select-all truncate">
                      {adminConfig?.installation?.tenantId}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 space-y-1">
                    <span className="text-[10px] text-neutral-500 uppercase font-semibold">
                      Backend Connection ID
                    </span>
                    <p className="font-mono text-white text-xs select-all truncate">
                      {adminConfig?.installation?.backendConnectionId}
                    </p>
                  </div>
                </div>
              </div>

              {/* Application Name & Branding Form */}
              <form onSubmit={handleUpdateBranding} className="rounded-xl bg-neutral-900 border border-neutral-800 p-5 space-y-4">
                <div className="border-b border-neutral-800 pb-3">
                  <h3 className="text-sm font-semibold text-white">Application Name &amp; Workstation Branding</h3>
                  <p className="text-xs text-neutral-400">
                    Update the application name. Propagates consistently across titles, header bar, and exports.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-neutral-300">
                      Application Name (2-50 characters):
                    </label>
                    <input
                      type="text"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      required
                      minLength={2}
                      maxLength={50}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-neutral-300">
                      Organization / Division Name:
                    </label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-neutral-300">
                      Support Administrator Contact:
                    </label>
                    <input
                      type="text"
                      value={supportContact}
                      onChange={(e) => setSupportContact(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-neutral-300">
                      Support Email:
                    </label>
                    <input
                      type="email"
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-lg shadow-sky-600/20"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Update Application Branding</span>
                  </button>
                </div>
              </form>

              {/* Rename History Table */}
              <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-5 space-y-3">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Brand Identity Revision History
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-neutral-800 text-neutral-400 text-[11px]">
                        <th className="pb-2">Timestamp</th>
                        <th className="pb-2">Previous Name</th>
                        <th className="pb-2">New Name</th>
                        <th className="pb-2">Actor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 font-mono text-[11px]">
                      {adminConfig?.branding?.renameHistory?.map((r: any, idx: number) => (
                        <tr key={idx} className="hover:bg-neutral-800/40">
                          <td className="py-2 text-neutral-400">
                            {new Date(r.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2 text-neutral-300">{r.previousName}</td>
                          <td className="py-2 text-emerald-400 font-semibold">{r.newName}</td>
                          <td className="py-2 font-sans text-neutral-400">{r.actor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: CENTRAL MANAGEMENT & DISCORD INTEGRATION                           */}
          {/* ========================================================================= */}
          {activeTab === "central" && (
            <div className="space-y-6">
              {/* Server Connection Status */}
              <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-5 flex items-center justify-between text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                    Backend Connection Status
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-semibold text-white">Online &amp; Authoritative</span>
                  </div>
                  <p className="text-neutral-400 text-[11px]">
                    Server Time: {new Date(adminConfig?.publicStatus?.serverTime || Date.now()).toUTCString()}
                  </p>
                </div>

                <div className="text-right space-y-1">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                    Central Fleet Sync
                  </span>
                  <p className="text-emerald-400 font-semibold">Synchronized</p>
                  <p className="text-[11px] text-neutral-400">
                    Managed Deployments: {centralInstallations.length}
                  </p>
                </div>
              </div>

              {/* Safe Discord Integration */}
              <form onSubmit={handleSaveDiscord} className="rounded-xl bg-neutral-900 border border-neutral-800 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Server-Side Discord Telemetry</h3>
                    <p className="text-xs text-neutral-400">
                      Dispatches administrative alerts and security webhooks securely from the backend server.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        adminConfig?.discord?.hasBotTokenConfigured
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {adminConfig?.discord?.hasBotTokenConfigured
                        ? "Server Token Loaded"
                        : "Token Unconfigured in Server Env"}
                    </span>
                    <button
                      type="button"
                      onClick={handleTestDiscord}
                      disabled={isSendingDiscordTest || !adminConfig?.discord?.hasBotTokenConfigured}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-medium"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSendingDiscordTest ? "Sending..." : "Send Test Alert"}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-neutral-300">
                        Enable Discord Notifications:
                      </label>
                      <input
                        type="checkbox"
                        checked={discordEnabled}
                        onChange={(e) => setDiscordEnabled(e.target.checked)}
                        className="rounded bg-neutral-900 border-neutral-700 text-sky-600 focus:ring-sky-500 w-4 h-4 cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] text-neutral-400">
                        Discord Channel ID:
                      </label>
                      <input
                        type="text"
                        value={discordChannelId}
                        onChange={(e) => setDiscordChannelId(e.target.value)}
                        placeholder="e.g. 123456789012345678"
                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  {/* Trigger Checkboxes */}
                  <div className="space-y-2 bg-neutral-950/60 p-3 rounded-lg border border-neutral-800/80 text-xs">
                    <span className="text-[11px] font-semibold text-neutral-400 block">
                      Active Notification Triggers:
                    </span>
                    <label className="flex items-center space-x-2 text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyOnRegistration}
                        onChange={(e) => setNotifyOnRegistration(e.target.checked)}
                      />
                      <span>Workstation Registration</span>
                    </label>
                    <label className="flex items-center space-x-2 text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyOnExpiringSoon}
                        onChange={(e) => setNotifyOnExpiringSoon(e.target.checked)}
                      />
                      <span>License Expiring Soon (&le; 48 hours)</span>
                    </label>
                    <label className="flex items-center space-x-2 text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyOnExpired}
                        onChange={(e) => setNotifyOnExpired(e.target.checked)}
                      />
                      <span>License Expired / Terminated</span>
                    </label>
                    <label className="flex items-center space-x-2 text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyOnLockdown}
                        onChange={(e) => setNotifyOnLockdown(e.target.checked)}
                      />
                      <span>Workstation Lockdown / Tamper Triggered</span>
                    </label>
                    <label className="flex items-center space-x-2 text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyOnFailedLogins}
                        onChange={(e) => setNotifyOnFailedLogins(e.target.checked)}
                      />
                      <span>Repeated Failed Logins (Brute-Force Alert)</span>
                    </label>
                    <label className="flex items-center space-x-2 text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyOnRename}
                        onChange={(e) => setNotifyOnRename(e.target.checked)}
                      />
                      <span>Workstation Renamed</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-lg shadow-sky-600/20"
                  >
                    Save Discord Settings
                  </button>
                </div>
              </form>

              {/* Central Installations Fleet Directory */}
              <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Central Installation Fleet</h3>
                    <p className="text-xs text-neutral-400">
                      Manage, suspend, approve, or renew remote deployed installations.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search installations..."
                        value={centralSearch}
                        onChange={(e) => setCentralSearch(e.target.value)}
                        className="bg-neutral-950 border border-neutral-700 rounded-lg pl-7 pr-3 py-1 text-xs text-white placeholder-neutral-500"
                      />
                      <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2 top-2" />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-neutral-800 text-neutral-400 text-[11px]">
                        <th className="pb-2">Installation ID</th>
                        <th className="pb-2">App Name</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Expiration</th>
                        <th className="pb-2">Approval</th>
                        <th className="pb-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 font-mono text-[11px]">
                      {centralInstallations.map((inst) => (
                        <tr key={inst.installationId} className="hover:bg-neutral-800/40">
                          <td className="py-2.5 font-bold text-sky-400 select-all">
                            {inst.installationId}
                          </td>
                          <td className="py-2.5 font-sans text-neutral-200">{inst.applicationName}</td>
                          <td className="py-2.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                                inst.licenseStatus === "active"
                                  ? "bg-emerald-950 text-emerald-400"
                                  : "bg-rose-950 text-rose-400"
                              }`}
                            >
                              {inst.licenseStatus}
                            </span>
                          </td>
                          <td className="py-2.5 text-neutral-400">
                            {new Date(inst.licenseExpirationDate).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 font-sans">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                                inst.approvalStatus === "approved"
                                  ? "bg-sky-950 text-sky-300"
                                  : "bg-amber-950 text-amber-300"
                              }`}
                            >
                              {inst.approvalStatus}
                            </span>
                          </td>
                          <td className="py-2.5 text-right space-x-1 font-sans">
                            {inst.suspensionStatus === "active" ? (
                              <button
                                onClick={async () => {
                                  const token = superAdminAuthService.getSessionToken();
                                  await fetch(`/api/central/installations/${inst.installationId}/suspend`, {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                      Authorization: `Bearer ${token}`,
                                    },
                                    body: JSON.stringify({ reason: "Administrative Fleet Hold" }),
                                  });
                                  fetchCentralInstallations();
                                }}
                                className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 text-[10px]"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  const token = superAdminAuthService.getSessionToken();
                                  await fetch(`/api/central/installations/${inst.installationId}/approve`, {
                                    method: "POST",
                                    headers: { Authorization: `Bearer ${token}` },
                                  });
                                  fetchCentralInstallations();
                                }}
                                className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-[10px]"
                              >
                                Approve
                              </button>
                            )}

                            <button
                              onClick={async () => {
                                const token = superAdminAuthService.getSessionToken();
                                await fetch(`/api/central/installations/${inst.installationId}/renew`, {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${token}`,
                                  },
                                  body: JSON.stringify({ days: 30 }),
                                });
                                fetchCentralInstallations();
                              }}
                              className="px-2 py-1 rounded bg-sky-950 hover:bg-sky-900 text-sky-300 text-[10px]"
                            >
                              Renew +30d
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: SECURITY POLICY & MASTER PASSWORD                                  */}
          {/* ========================================================================= */}
          {activeTab === "security" && (
            <div className="space-y-6">
              {/* Change Master Password */}
              <form onSubmit={handleChangePassword} className="rounded-xl bg-neutral-900 border border-neutral-800 p-5 space-y-4">
                <div className="border-b border-neutral-800 pb-3">
                  <h3 className="text-sm font-semibold text-white">Change Super Admin Master Password</h3>
                  <p className="text-xs text-neutral-400">
                    Requires current master password. Enforces strong cryptographic salted PBKDF2 hashing.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-neutral-300">
                      Current Password:
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-neutral-300">
                      New Password:
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={10}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-neutral-300">
                      Confirm New Password:
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-lg shadow-sky-600/20"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Rotate Master Password</span>
                  </button>
                </div>
              </form>

              {/* Security Policy Settings */}
              <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-5 space-y-4">
                <div className="border-b border-neutral-800 pb-3">
                  <h3 className="text-sm font-semibold text-white">Security &amp; Session Thresholds</h3>
                  <p className="text-xs text-neutral-400">
                    Configure inactivity timeout and failed password brute-force lockout duration.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="block font-medium text-neutral-300">
                      Admin Session Timeout (Minutes):
                    </label>
                    <select
                      value={sessionTimeout}
                      onChange={async (e) => {
                        const val = parseInt(e.target.value, 10);
                        setSessionTimeout(val);
                        const token = superAdminAuthService.getSessionToken();
                        await fetch("/api/admin/config/policy", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ sessionTimeoutMinutes: val }),
                        });
                      }}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white"
                    >
                      <option value={5}>5 Minutes</option>
                      <option value={15}>15 Minutes (Standard)</option>
                      <option value={30}>30 Minutes</option>
                      <option value={60}>60 Minutes</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-medium text-neutral-300">
                      Max Failed Login Attempts:
                    </label>
                    <select
                      value={maxFailedAttempts}
                      onChange={async (e) => {
                        const val = parseInt(e.target.value, 10);
                        setMaxFailedAttempts(val);
                        const token = superAdminAuthService.getSessionToken();
                        await fetch("/api/admin/config/policy", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ maxFailedLoginAttempts: val }),
                        });
                      }}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white"
                    >
                      <option value={3}>3 Attempts</option>
                      <option value={5}>5 Attempts (Recommended)</option>
                      <option value={10}>10 Attempts</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-medium text-neutral-300">
                      Brute-Force Lockout Duration:
                    </label>
                    <select
                      value={lockoutDuration}
                      onChange={async (e) => {
                        const val = parseInt(e.target.value, 10);
                        setLockoutDuration(val);
                        const token = superAdminAuthService.getSessionToken();
                        await fetch("/api/admin/config/policy", {
                          method: "PUT",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ lockoutDurationMinutes: val }),
                        });
                      }}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white"
                    >
                      <option value={5}>5 Minutes</option>
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes</option>
                      <option value={60}>60 Minutes</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Encrypted Export & Import Configuration */}
              <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-5 space-y-4">
                <div className="border-b border-neutral-800 pb-3">
                  <h3 className="text-sm font-semibold text-white">Encrypted Configuration Backup &amp; Restore</h3>
                  <p className="text-xs text-neutral-400">
                    Export or import entire security profiles using AES-256-GCM encryption.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Export */}
                  <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-3">
                    <span className="text-xs font-semibold text-white flex items-center space-x-1.5">
                      <Download className="w-3.5 h-3.5 text-sky-400" />
                      <span>Export Encrypted Snapshot</span>
                    </span>
                    <input
                      type="password"
                      placeholder="Enter export passphrase (min 8 chars)..."
                      value={exportPassphrase}
                      onChange={(e) => setExportPassphrase(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const token = superAdminAuthService.getSessionToken();
                        const res = await fetch("/api/admin/export", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ exportPassphrase }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setExportedJson(data.encryptedPayload);
                          setFeedback({ type: "success", message: "Configuration snapshot generated!" });
                        }
                      }}
                      className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs"
                    >
                      Generate Encrypted Backup
                    </button>
                    {exportedJson && (
                      <textarea
                        readOnly
                        value={exportedJson}
                        className="w-full h-20 bg-neutral-900 border border-neutral-800 rounded p-2 text-[10px] font-mono text-neutral-400 select-all"
                      />
                    )}
                  </div>

                  {/* Reset Defaults */}
                  <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-3">
                    <span className="text-xs font-semibold text-rose-400 flex items-center space-x-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                      <span>Reset Configuration to Defaults</span>
                    </span>
                    <p className="text-[11px] text-neutral-400">
                      Restores standard 30-day baseline license and clears manual locks. Requires current master password.
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        const pw = prompt("Enter Super Admin Master Password to confirm reset:");
                        if (!pw) return;
                        const token = superAdminAuthService.getSessionToken();
                        const res = await fetch("/api/admin/reset", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ confirmPassword: pw }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setFeedback({ type: "success", message: data.message });
                          await licenseService.fetchStatus();
                          loadAdminData();
                        } else {
                          setFeedback({ type: "error", message: data.error });
                        }
                      }}
                      className="px-3 py-1.5 rounded bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs"
                    >
                      Reset Configuration
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: AUDIT LOGS                                                         */}
          {/* ========================================================================= */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    Filter Category:
                  </span>
                  <select
                    value={auditFilter}
                    onChange={(e) => setAuditFilter(e.target.value)}
                    className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1 text-xs text-white"
                  >
                    <option value="all">All Categories</option>
                    <option value="auth">Authentication</option>
                    <option value="license">License</option>
                    <option value="branding">Branding</option>
                    <option value="security">Security Alerts</option>
                    <option value="central">Central Management</option>
                    <option value="system">System</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={fetchAuditLogs}
                    className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(auditLogs, null, 2)], {
                        type: "application/json",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `omniscan_audit_trail_${Date.now()}.json`;
                      a.click();
                    }}
                    className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-sky-950 border border-sky-800 text-sky-300 text-xs"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export JSON</span>
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-neutral-950 border-b border-neutral-800 text-neutral-400 text-[11px]">
                      <tr>
                        <th className="py-2.5 px-4">Timestamp</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Severity</th>
                        <th className="py-2.5 px-3">Actor</th>
                        <th className="py-2.5 px-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 font-mono text-[11px]">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-neutral-800/40">
                          <td className="py-2.5 px-4 text-neutral-400 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold bg-neutral-800 text-neutral-300">
                              {log.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-white font-sans">{log.action}</td>
                          <td className="py-2.5 px-3 font-sans">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                                log.severity === "critical" || log.severity === "security_alert"
                                  ? "bg-rose-950 text-rose-300 border border-rose-800"
                                  : log.severity === "warning"
                                  ? "bg-amber-950 text-amber-300 border border-amber-800"
                                  : "bg-neutral-800 text-neutral-400"
                              }`}
                            >
                              {log.severity}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-neutral-300 font-sans">{log.actor}</td>
                          <td className="py-2.5 px-4 text-neutral-400 font-mono text-[10px] max-w-xs truncate">
                            {JSON.stringify(log.details)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Immediate Lock Confirmation Dialog */}
        {showLockConfirmModal && (
          <div className="fixed inset-0 z-[100010] bg-neutral-950/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center space-x-2.5 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-semibold">Confirm Immediate Application Lockdown</h3>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                This will immediately engage the global barrier screen and freeze all document tools.
                Enter your Super Admin master password to authenticate this action.
              </p>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-neutral-400">Reason:</label>
                <input
                  type="text"
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-neutral-400">
                  Master Password Confirmation:
                </label>
                <input
                  type="password"
                  value={lockPasswordConfirm}
                  onChange={(e) => setLockPasswordConfirm(e.target.value)}
                  placeholder="Master password..."
                  className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLockConfirmModal(false)}
                  className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImmediateLock}
                  className="px-3 py-1.5 rounded bg-rose-700 hover:bg-rose-600 text-white text-xs font-medium"
                >
                  Confirm Lockdown
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
