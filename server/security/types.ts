/**
 * OMNISCAN TITAN X - Backend Security Engine Types
 */

import {
  LicenseConfig,
  ExpirationHistoryEntry,
  ApplicationBrandingConfig,
  InstallationIdentity,
  SecurityPolicyConfig,
  DiscordIntegrationConfig,
  AuditLogEntry,
  CentralInstallationRecord,
} from "../../src/types/security";

export interface StoredSecurityData {
  version: number;
  isConfigured: boolean;
  passwordHash?: string; // $pbkdf2$100000$<salt_hex>$<hash_hex>
  recoveryKeyHash?: string;
  installation: InstallationIdentity;
  branding: ApplicationBrandingConfig;
  license: LicenseConfig;
  expirationHistory: ExpirationHistoryEntry[];
  policy: SecurityPolicyConfig;
  discord: DiscordIntegrationConfig;
  auditLogs: AuditLogEntry[];
  centralInstallations: CentralInstallationRecord[];
  integrityHash: string; // HMAC-SHA256 of sensitive fields
}

export interface FailedAttemptTracker {
  count: number;
  firstFailedAt: number;
  lastFailedAt: number;
  lockedUntil: number; // timestamp
}

export interface ActiveSession {
  token: string;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  ipAddress: string;
}
