/**
 * OMNISCAN TITAN X - Persistent Security Storage Layer
 * Atomic file persistence with cryptographic HMAC integrity checking.
 */

import fs from "fs";
import path from "path";
import { StoredSecurityData } from "./types";
import { generateSecureId, computeHmac, verifyHmac } from "./crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "omniscan_security_store.json");

let inMemoryCache: StoredSecurityData | null = null;

function calculateDataIntegrity(data: StoredSecurityData): string {
  const payloadToHash = JSON.stringify({
    version: data.version,
    isConfigured: data.isConfigured,
    passwordHash: data.passwordHash || "",
    installationId: data.installation.installationId,
    tenantId: data.installation.tenantId,
    appName: data.branding.applicationName,
    licenseId: data.license.licenseId,
    licenseStatus: data.license.status,
    expiresAt: data.license.expiresAt,
  });
  return computeHmac(payloadToHash);
}

function createDefaultSecurityData(): StoredSecurityData {
  const now = new Date();
  // Default license: 30 days from now
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const nowIso = now.toISOString();

  const installationId = generateSecureId("TITAN-INST", 8);
  const licenseId = generateSecureId("LIC", 6);
  const backendConnectionId = generateSecureId("CONN", 8);

  const defaultData: StoredSecurityData = {
    version: 1,
    isConfigured: false, // requires first-time Super Admin password setup
    passwordHash: undefined,
    recoveryKeyHash: undefined,
    installation: {
      installationId,
      tenantId: "TENANT-ENTERPRISE-01",
      licenseId,
      backendConnectionId,
      hardwareFingerprintHash: computeHmac(installationId + process.platform),
      firstInstalledAt: nowIso,
      lastSeenAt: nowIso,
      appVersion: "2.5.0-Enterprise",
      platform: process.platform,
      identityHistory: [
        {
          timestamp: nowIso,
          event: "installed",
          description: `Initial installation initialized with ID ${installationId}`,
        },
      ],
    },
    branding: {
      applicationName: "OmniScan Titan X",
      organizationName: "Enterprise Workstation",
      supportContact: "OmniScan Global Systems Administrator",
      supportEmail: "admin@omniscan-titan.local",
      lastRenamedAt: nowIso,
      renameHistory: [],
    },
    license: {
      licenseId,
      status: "active",
      issuedAt: nowIso,
      startsAt: nowIso,
      expiresAt: thirtyDaysLater.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      durationUnit: "days",
      durationValue: 30,
      gracePeriodHours: 0,
      gracePeriodEnabled: false,
      lastValidatedServerTime: nowIso,
    },
    expirationHistory: [
      {
        id: generateSecureId("HIST", 4),
        timestamp: nowIso,
        previousExpiresAt: "",
        newExpiresAt: thirtyDaysLater.toISOString(),
        action: "created",
        reason: "Initial license allotment provisioned",
        actor: "System Provisioner",
      },
    ],
    policy: {
      sessionTimeoutMinutes: 15,
      maxFailedLoginAttempts: 5,
      lockoutDurationMinutes: 15,
      requireStrongPassword: true,
      preventScreenCapture: false,
      offlineGraceAllowedHours: 24,
      monotonicClockSkewToleranceMinutes: 10,
    },
    discord: {
      enabled: false,
      hasBotTokenConfigured: Boolean(process.env.DISCORD_BOT_TOKEN),
      channelId: process.env.DISCORD_CHANNEL_ID || "",
      notifyOnRegistration: true,
      notifyOnExpiringSoon: true,
      notifyOnExpired: true,
      notifyOnLockdown: true,
      notifyOnFailedLogins: true,
      notifyOnRename: true,
    },
    auditLogs: [
      {
        id: generateSecureId("AUD", 4),
        timestamp: nowIso,
        category: "system",
        action: "INITIAL_PROVISIONING",
        severity: "info",
        actor: "SYSTEM",
        details: { installationId, licenseId },
      },
    ],
    centralInstallations: [
      {
        installationId,
        tenantId: "TENANT-ENTERPRISE-01",
        applicationName: "OmniScan Titan X",
        previousNames: [],
        licenseStatus: "active",
        licenseStartDate: nowIso,
        licenseExpirationDate: thirtyDaysLater.toISOString(),
        lastSuccessfulConnection: nowIso,
        appVersion: "2.5.0-Enterprise",
        connectionStatus: "online",
        approvalStatus: "approved",
        suspensionStatus: "active",
        revocationStatus: "valid",
        createdDate: nowIso,
        updatedDate: nowIso,
        notes: "Primary local production installation",
      },
    ],
    integrityHash: "",
  };

  defaultData.integrityHash = calculateDataIntegrity(defaultData);
  return defaultData;
}

export function loadStoredSecurityData(): StoredSecurityData {
  if (inMemoryCache) {
    return inMemoryCache;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(STORE_PATH)) {
      const initial = createDefaultSecurityData();
      saveStoredSecurityData(initial);
      inMemoryCache = initial;
      return initial;
    }

    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed: StoredSecurityData = JSON.parse(raw);

    // Verify cryptographic integrity
    const expectedHash = calculateDataIntegrity(parsed);
    if (parsed.integrityHash && !verifyHmac(expectedHash, parsed.integrityHash)) {
      console.warn("Security store integrity mismatch detected! State may have been modified outside runtime.");
    }

    // Always update dynamic discord token presence
    parsed.discord.hasBotTokenConfigured = Boolean(process.env.DISCORD_BOT_TOKEN);

    inMemoryCache = parsed;
    return parsed;
  } catch (err) {
    console.error("Failed to read security store, initializing recovery defaults:", err);
    const fallback = createDefaultSecurityData();
    inMemoryCache = fallback;
    return fallback;
  }
}

export function saveStoredSecurityData(data: StoredSecurityData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    data.integrityHash = calculateDataIntegrity(data);

    // Atomic write: write to temp file then rename
    const tempPath = `${STORE_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { encoding: "utf8" });
    fs.renameSync(tempPath, STORE_PATH);

    inMemoryCache = data;
  } catch (err) {
    console.error("Failed to persist security store atomically:", err);
    throw new Error("Persistence error: Could not write security state to disk");
  }
}
