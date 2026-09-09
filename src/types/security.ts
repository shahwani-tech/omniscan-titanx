/**
 * OMNISCAN TITAN X - Security, Licensing & Installation Management Domain Types
 * Strict production-grade types for Super Admin, Licensing, Audit, and Central Management
 */

export type LicenseStatus = "active" | "expiring_soon" | "expired" | "locked" | "suspended";

export type LicenseDurationUnit = "days" | "months" | "exact";

export interface LicenseConfig {
  licenseId: string;
  status: LicenseStatus;
  issuedAt: string; // ISO string
  startsAt: string; // ISO string
  expiresAt: string; // ISO string
  timeZone: string;
  durationUnit: LicenseDurationUnit;
  durationValue: number; // e.g. 3 (days or months)
  gracePeriodHours: number; // 0 = disabled
  gracePeriodEnabled: boolean;
  lastValidatedServerTime: string; // ISO string
  immediateLockReason?: string;
  lockdownTimestamp?: string;
}

export interface LicenseTimeRemaining {
  totalMilliseconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  isInGracePeriod: boolean;
  status: LicenseStatus;
}

export interface ExpirationHistoryEntry {
  id: string;
  timestamp: string;
  previousExpiresAt: string;
  newExpiresAt: string;
  action: "created" | "extended" | "replaced" | "locked" | "unlocked" | "grace_applied";
  reason: string;
  actor: string;
}

export interface ApplicationBrandingConfig {
  applicationName: string;
  organizationName: string;
  supportContact: string;
  supportEmail: string;
  lastRenamedAt: string;
  renameHistory: Array<{
    previousName: string;
    newName: string;
    timestamp: string;
    actor: string;
  }>;
}

export interface InstallationIdentity {
  installationId: string; // e.g. TITAN-INST-XXXX-XXXX-XXXX
  tenantId: string; // e.g. TENANT-CORP-01
  licenseId: string;
  backendConnectionId: string;
  hardwareFingerprintHash: string;
  firstInstalledAt: string;
  lastSeenAt: string;
  appVersion: string;
  platform: string;
  identityHistory: Array<{
    timestamp: string;
    event: "installed" | "renamed" | "license_rebound" | "fingerprint_updated";
    description: string;
  }>;
}

export interface SecurityPolicyConfig {
  sessionTimeoutMinutes: number; // default 15
  maxFailedLoginAttempts: number; // default 5
  lockoutDurationMinutes: number; // default 15
  requireStrongPassword: boolean;
  preventScreenCapture: boolean;
  offlineGraceAllowedHours: number; // default 24
  monotonicClockSkewToleranceMinutes: number; // default 10
}

export interface DiscordIntegrationConfig {
  enabled: boolean;
  hasBotTokenConfigured: boolean; // Server-side boolean only, NEVER exposes token
  channelId?: string;
  notifyOnRegistration: boolean;
  notifyOnExpiringSoon: boolean;
  notifyOnExpired: boolean;
  notifyOnLockdown: boolean;
  notifyOnFailedLogins: boolean;
  notifyOnRename: boolean;
  lastNotificationSentAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: "auth" | "license" | "branding" | "security" | "central" | "system";
  action: string;
  severity: "info" | "warning" | "security_alert" | "critical";
  actor: string;
  ipAddress?: string;
  details: Record<string, any>;
}

export interface PublicLicenseStatusResponse {
  isConfigured: boolean; // false if initial setup needed
  isLocked: boolean;
  lockReason?: string;
  licenseStatus: LicenseStatus;
  applicationName: string;
  installationId: string;
  tenantId: string;
  expiresAt: string;
  timeZone: string;
  serverTime: string;
  remainingTime: LicenseTimeRemaining;
  gracePeriodEnabled: boolean;
  gracePeriodHours: number;
  offlineGraceAllowed: boolean;
  supportContact: string;
  supportEmail: string;
  signedAuthorizationToken?: string; // HMAC token for offline validation
}

export interface SuperAdminSession {
  token: string;
  expiresAt: string;
  role: "super_admin";
  issuedAt: string;
}

export interface CentralInstallationRecord {
  installationId: string;
  tenantId: string;
  applicationName: string;
  previousNames: string[];
  licenseStatus: LicenseStatus;
  licenseStartDate: string;
  licenseExpirationDate: string;
  lastSuccessfulConnection: string;
  appVersion: string;
  connectionStatus: "online" | "offline" | "unreachable";
  approvalStatus: "approved" | "pending" | "rejected";
  suspensionStatus: "active" | "suspended";
  revocationStatus: "valid" | "revoked";
  createdDate: string;
  updatedDate: string;
  notes?: string;
}
