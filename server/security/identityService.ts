/**
 * OMNISCAN TITAN X - Installation Identity & Application Branding Service
 * Governs unique workstation identity, tenant classification, and dynamic branding.
 */

import { ApplicationBrandingConfig, InstallationIdentity } from "../../src/types/security";
import { loadStoredSecurityData, saveStoredSecurityData } from "./storage";
import { generateSecureId } from "./crypto";
import { logAuditEvent } from "./auditService";
import { dispatchDiscordSecurityNotification } from "./discordService";

export function getApplicationBranding(): ApplicationBrandingConfig {
  const data = loadStoredSecurityData();
  return data.branding;
}

export function updateApplicationName(
  newName: string,
  organizationName?: string,
  supportContact?: string,
  supportEmail?: string,
  actor = "SUPER_ADMIN"
): ApplicationBrandingConfig {
  const cleanName = (newName || "").trim();

  if (cleanName.length < 2 || cleanName.length > 50) {
    throw new Error("Application name must be between 2 and 50 characters.");
  }

  // Prevent HTML tags or script injection in branding
  if (/<[^>]*>/g.test(cleanName)) {
    throw new Error("Application name contains invalid characters.");
  }

  const data = loadStoredSecurityData();
  const oldName = data.branding.applicationName;
  const nowIso = new Date().toISOString();

  data.branding.applicationName = cleanName;
  if (organizationName !== undefined) data.branding.organizationName = organizationName.trim();
  if (supportContact !== undefined) data.branding.supportContact = supportContact.trim();
  if (supportEmail !== undefined) data.branding.supportEmail = supportEmail.trim();
  data.branding.lastRenamedAt = nowIso;

  data.branding.renameHistory.unshift({
    previousName: oldName,
    newName: cleanName,
    timestamp: nowIso,
    actor,
  });

  // Also update central installation record if matched
  const instRecord = data.centralInstallations.find(
    (c) => c.installationId === data.installation.installationId
  );
  if (instRecord) {
    instRecord.previousNames.push(instRecord.applicationName);
    instRecord.applicationName = cleanName;
    instRecord.updatedDate = nowIso;
  }

  saveStoredSecurityData(data);

  logAuditEvent(
    "branding",
    "APPLICATION_NAME_CHANGED",
    "info",
    actor,
    { oldName, newName: cleanName }
  );

  dispatchDiscordSecurityNotification("rename", {
    "Previous Name": oldName,
    "New Name": cleanName,
    "Updated By": actor,
  }).catch(() => {});

  return data.branding;
}

export function getInstallationIdentity(): InstallationIdentity {
  const data = loadStoredSecurityData();
  return data.installation;
}

export function regenerateInstallationIdentity(
  reason: string,
  actor = "SUPER_ADMIN"
): InstallationIdentity {
  const data = loadStoredSecurityData();
  const oldId = data.installation.installationId;
  const newId = generateSecureId("TITAN-INST", 8);
  const nowIso = new Date().toISOString();

  data.installation.installationId = newId;
  data.installation.lastSeenAt = nowIso;

  data.installation.identityHistory.unshift({
    timestamp: nowIso,
    event: "renamed",
    description: `Installation identifier rotated from ${oldId} to ${newId}. Reason: ${reason}`,
  });

  saveStoredSecurityData(data);

  logAuditEvent(
    "security",
    "INSTALLATION_IDENTITY_ROTATED",
    "security_alert",
    actor,
    { oldId, newId, reason }
  );

  return data.installation;
}
