/**
 * OMNISCAN TITAN X - Centralized Multi-Installation Administration Engine
 * Enables authorized administration across workstation deployments,
 * supporting registration, revocation, license renewal, and suspension.
 */

import { CentralInstallationRecord, LicenseStatus } from "../../src/types/security";
import { loadStoredSecurityData, saveStoredSecurityData } from "./storage";
import { logAuditEvent } from "./auditService";

export function listCentralInstallations(searchQuery?: string): CentralInstallationRecord[] {
  const data = loadStoredSecurityData();
  let list = data.centralInstallations;

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(
      (inst) =>
        inst.installationId.toLowerCase().includes(q) ||
        inst.applicationName.toLowerCase().includes(q) ||
        inst.tenantId.toLowerCase().includes(q)
    );
  }

  return list;
}

export function approveInstallation(
  installationId: string,
  actor = "CENTRAL_ADMIN"
): CentralInstallationRecord {
  const data = loadStoredSecurityData();
  const inst = data.centralInstallations.find((i) => i.installationId === installationId);

  if (!inst) {
    throw new Error(`Installation ${installationId} not found in central registry.`);
  }

  inst.approvalStatus = "approved";
  inst.suspensionStatus = "active";
  inst.updatedDate = new Date().toISOString();

  saveStoredSecurityData(data);
  logAuditEvent("central", "INSTALLATION_APPROVED", "info", actor, { installationId });

  return inst;
}

export function suspendInstallation(
  installationId: string,
  reason = "Administrative policy hold",
  actor = "CENTRAL_ADMIN"
): CentralInstallationRecord {
  const data = loadStoredSecurityData();
  const inst = data.centralInstallations.find((i) => i.installationId === installationId);

  if (!inst) {
    throw new Error(`Installation ${installationId} not found in central registry.`);
  }

  inst.suspensionStatus = "suspended";
  inst.licenseStatus = "suspended";
  inst.notes = reason;
  inst.updatedDate = new Date().toISOString();

  // If this is the local installation, reflect into active license
  if (data.installation.installationId === installationId) {
    data.license.status = "suspended";
    data.license.immediateLockReason = reason;
  }

  saveStoredSecurityData(data);
  logAuditEvent("central", "INSTALLATION_SUSPENDED", "warning", actor, { installationId, reason });

  return inst;
}

export function revokeInstallation(
  installationId: string,
  reason = "Permanent authorization revocation",
  actor = "CENTRAL_ADMIN"
): CentralInstallationRecord {
  const data = loadStoredSecurityData();
  const inst = data.centralInstallations.find((i) => i.installationId === installationId);

  if (!inst) {
    throw new Error(`Installation ${installationId} not found in central registry.`);
  }

  inst.revocationStatus = "revoked";
  inst.licenseStatus = "locked";
  inst.notes = reason;
  inst.updatedDate = new Date().toISOString();

  // If this is the local installation, reflect into active license
  if (data.installation.installationId === installationId) {
    data.license.status = "locked";
    data.license.immediateLockReason = `REVOKED: ${reason}`;
  }

  saveStoredSecurityData(data);
  logAuditEvent("central", "INSTALLATION_REVOKED", "critical", actor, { installationId, reason });

  return inst;
}

export function renewInstallationLicense(
  installationId: string,
  additionalDays: number,
  actor = "CENTRAL_ADMIN"
): CentralInstallationRecord {
  const data = loadStoredSecurityData();
  const inst = data.centralInstallations.find((i) => i.installationId === installationId);

  if (!inst) {
    throw new Error(`Installation ${installationId} not found in central registry.`);
  }

  const currentExp = new Date(inst.licenseExpirationDate);
  const baseTime = currentExp.getTime() > Date.now() ? currentExp.getTime() : Date.now();
  const newExpDate = new Date(baseTime + additionalDays * 24 * 60 * 60 * 1000);

  inst.licenseExpirationDate = newExpDate.toISOString();
  inst.licenseStatus = "active";
  inst.suspensionStatus = "active";
  inst.updatedDate = new Date().toISOString();

  if (data.installation.installationId === installationId) {
    data.license.expiresAt = newExpDate.toISOString();
    data.license.status = "active";
    data.license.immediateLockReason = undefined;
  }

  saveStoredSecurityData(data);
  logAuditEvent("central", "INSTALLATION_LICENSE_RENEWED", "info", actor, {
    installationId,
    additionalDays,
    newExpiration: newExpDate.toISOString(),
  });

  return inst;
}
