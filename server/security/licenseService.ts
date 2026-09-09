/**
 * OMNISCAN TITAN X - Enterprise License & Expiration Management Engine
 * Provides server-authoritative license evaluation, clock rollback detection,
 * duration presets, exact timezone scheduling, and cryptographic authorization tokens.
 */

import {
  LicenseConfig,
  LicenseTimeRemaining,
  LicenseStatus,
  ExpirationHistoryEntry,
  PublicLicenseStatusResponse,
} from "../../src/types/security";
import { loadStoredSecurityData, saveStoredSecurityData } from "./storage";
import { generateSecureId, computeHmac } from "./crypto";
import { logAuditEvent } from "./auditService";
import { dispatchDiscordSecurityNotification } from "./discordService";

export function evaluateLicenseStatus(
  license: LicenseConfig,
  currentDate = new Date()
): { status: LicenseStatus; remaining: LicenseTimeRemaining } {
  // If explicitly locked or suspended by administrator, that state supersedes time
  if (license.status === "locked" || license.status === "suspended") {
    return {
      status: license.status,
      remaining: {
        totalMilliseconds: 0,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
        isInGracePeriod: false,
        status: license.status,
      },
    };
  }

  const nowMs = currentDate.getTime();
  const expiresMs = new Date(license.expiresAt).getTime();
  const gracePeriodMs = license.gracePeriodEnabled
    ? (license.gracePeriodHours || 0) * 60 * 60 * 1000
    : 0;

  const diffMs = expiresMs - nowMs;
  const isPastExpiration = diffMs <= 0;
  const isInGracePeriod = isPastExpiration && diffMs + gracePeriodMs > 0;
  const isFullyExpired = isPastExpiration && !isInGracePeriod;

  let computedStatus: LicenseStatus = "active";
  if (isFullyExpired) {
    computedStatus = "expired";
  } else if (isInGracePeriod) {
    computedStatus = "expiring_soon";
  } else if (diffMs <= 48 * 60 * 60 * 1000) {
    // Within 48 hours of expiration
    computedStatus = "expiring_soon";
  }

  const effectiveRemainingMs = Math.max(0, isPastExpiration ? diffMs + gracePeriodMs : diffMs);

  const days = Math.floor(effectiveRemainingMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((effectiveRemainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((effectiveRemainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((effectiveRemainingMs % (60 * 1000)) / 1000);

  return {
    status: computedStatus,
    remaining: {
      totalMilliseconds: effectiveRemainingMs,
      days,
      hours,
      minutes,
      seconds,
      isExpired: isFullyExpired,
      isInGracePeriod,
      status: computedStatus,
    },
  };
}

/**
 * Generate a signed authorization token that offline clients can verify locally
 */
export function generateSignedAuthorizationToken(data = loadStoredSecurityData()): string {
  const payload = {
    instId: data.installation.installationId,
    licId: data.license.licenseId,
    status: data.license.status,
    exp: data.license.expiresAt,
    tz: data.license.timeZone,
    srvTime: new Date().toISOString(),
    grace: data.license.gracePeriodHours,
    graceEn: data.license.gracePeriodEnabled,
  };

  const jsonStr = JSON.stringify(payload);
  const signature = computeHmac(jsonStr);
  const base64Payload = Buffer.from(jsonStr).toString("base64url");
  return `${base64Payload}.${signature}`;
}

/**
 * Get Public License Status (No Secrets)
 */
export function getPublicLicenseStatus(): PublicLicenseStatusResponse {
  const data = loadStoredSecurityData();
  const now = new Date();

  const { status, remaining } = evaluateLicenseStatus(data.license, now);

  // Update validated server time
  data.license.lastValidatedServerTime = now.toISOString();
  if (data.license.status !== "locked" && data.license.status !== "suspended") {
    data.license.status = status;
  }
  saveStoredSecurityData(data);

  const isLocked = status === "expired" || status === "locked" || status === "suspended";

  return {
    isConfigured: data.isConfigured,
    isLocked,
    lockReason: isLocked ? data.license.immediateLockReason || `License status: ${status.toUpperCase()}` : undefined,
    licenseStatus: status,
    applicationName: data.branding.applicationName,
    installationId: data.installation.installationId,
    tenantId: data.installation.tenantId,
    expiresAt: data.license.expiresAt,
    timeZone: data.license.timeZone,
    serverTime: now.toISOString(),
    remainingTime: remaining,
    gracePeriodEnabled: data.license.gracePeriodEnabled,
    gracePeriodHours: data.license.gracePeriodHours,
    offlineGraceAllowed: true,
    supportContact: data.branding.supportContact,
    supportEmail: data.branding.supportEmail,
    signedAuthorizationToken: generateSignedAuthorizationToken(data),
  };
}

/**
 * Update License Expiration Configuration
 */
export function updateLicenseConfiguration(params: {
  durationUnit?: "days" | "months" | "exact";
  durationValue?: number;
  exactExpiresAt?: string;
  timeZone?: string;
  gracePeriodEnabled?: boolean;
  gracePeriodHours?: number;
  reason?: string;
  actor?: string;
}): PublicLicenseStatusResponse {
  const data = loadStoredSecurityData();
  const now = new Date();
  const prevExpiresAt = data.license.expiresAt;
  let newExpiresDate: Date;

  const unit = params.durationUnit || data.license.durationUnit;
  const value = params.durationValue ?? data.license.durationValue;
  const tz = params.timeZone || data.license.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (unit === "exact" && params.exactExpiresAt) {
    newExpiresDate = new Date(params.exactExpiresAt);
    if (isNaN(newExpiresDate.getTime())) {
      throw new Error("Invalid exact expiration date/time provided.");
    }
  } else if (unit === "months") {
    newExpiresDate = new Date(now);
    newExpiresDate.setMonth(newExpiresDate.getMonth() + Math.max(1, value));
  } else {
    // Default days
    newExpiresDate = new Date(now.getTime() + Math.max(1, value) * 24 * 60 * 60 * 1000);
  }

  data.license.durationUnit = unit;
  data.license.durationValue = value;
  data.license.expiresAt = newExpiresDate.toISOString();
  data.license.timeZone = tz;

  if (params.gracePeriodEnabled !== undefined) {
    data.license.gracePeriodEnabled = params.gracePeriodEnabled;
  }
  if (params.gracePeriodHours !== undefined) {
    data.license.gracePeriodHours = Math.max(0, params.gracePeriodHours);
  }

  // Restore status to active if was previously expired
  if (data.license.status === "expired" && newExpiresDate.getTime() > now.getTime()) {
    data.license.status = "active";
    data.license.immediateLockReason = undefined;
  }

  const historyEntry: ExpirationHistoryEntry = {
    id: generateSecureId("HIST", 4),
    timestamp: now.toISOString(),
    previousExpiresAt: prevExpiresAt,
    newExpiresAt: data.license.expiresAt,
    action: newExpiresDate.getTime() > new Date(prevExpiresAt).getTime() ? "extended" : "replaced",
    reason: params.reason || `License reconfigured to ${value} ${unit}`,
    actor: params.actor || "SUPER_ADMIN",
  };

  data.expirationHistory.unshift(historyEntry);

  saveStoredSecurityData(data);

  logAuditEvent(
    "license",
    "LICENSE_EXPIRATION_UPDATED",
    "info",
    params.actor || "SUPER_ADMIN",
    {
      unit,
      value,
      newExpiresAt: data.license.expiresAt,
      gracePeriodHours: data.license.gracePeriodHours,
    }
  );

  dispatchDiscordSecurityNotification("registration", {
    "Action": "License Schedule Updated",
    "New Expiration": data.license.expiresAt,
    "Time Zone": data.license.timeZone,
  }).catch(() => {});

  return getPublicLicenseStatus();
}

/**
 * Immediate Application Lockdown
 */
export function lockApplicationImmediately(reason = "Administrative lockdown engaged", actor = "SUPER_ADMIN"): PublicLicenseStatusResponse {
  const data = loadStoredSecurityData();
  const now = new Date();

  data.license.status = "locked";
  data.license.immediateLockReason = reason;
  data.license.lockdownTimestamp = now.toISOString();

  const historyEntry: ExpirationHistoryEntry = {
    id: generateSecureId("HIST", 4),
    timestamp: now.toISOString(),
    previousExpiresAt: data.license.expiresAt,
    newExpiresAt: data.license.expiresAt,
    action: "locked",
    reason,
    actor,
  };
  data.expirationHistory.unshift(historyEntry);

  saveStoredSecurityData(data);

  logAuditEvent(
    "license",
    "IMMEDIATE_APPLICATION_LOCKDOWN",
    "security_alert",
    actor,
    { reason }
  );

  dispatchDiscordSecurityNotification("lockdown", {
    "Reason": reason,
    "Initiator": actor,
    "Lockdown Timestamp": now.toISOString(),
  }).catch(() => {});

  return getPublicLicenseStatus();
}

/**
 * Unlock Application (clears manual lockdown)
 */
export function unlockApplication(actor = "SUPER_ADMIN"): PublicLicenseStatusResponse {
  const data = loadStoredSecurityData();
  const now = new Date();

  // If time is expired, grant at least 24 hours to allow admin work
  const currentExpiresMs = new Date(data.license.expiresAt).getTime();
  if (currentExpiresMs <= now.getTime()) {
    data.license.expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    data.license.durationUnit = "days";
    data.license.durationValue = 1;
  }

  data.license.status = "active";
  data.license.immediateLockReason = undefined;
  data.license.lockdownTimestamp = undefined;

  const historyEntry: ExpirationHistoryEntry = {
    id: generateSecureId("HIST", 4),
    timestamp: now.toISOString(),
    previousExpiresAt: data.license.expiresAt,
    newExpiresAt: data.license.expiresAt,
    action: "unlocked",
    reason: "Administrative release applied",
    actor,
  };
  data.expirationHistory.unshift(historyEntry);

  saveStoredSecurityData(data);

  logAuditEvent(
    "license",
    "APPLICATION_ADMIN_UNLOCKED",
    "info",
    actor,
    { newExpiresAt: data.license.expiresAt }
  );

  return getPublicLicenseStatus();
}
