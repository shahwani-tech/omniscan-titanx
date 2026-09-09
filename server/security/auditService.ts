/**
 * OMNISCAN TITAN X - Security Audit Logging Service
 */

import { AuditLogEntry } from "../../src/types/security";
import { generateSecureId } from "./crypto";
import { loadStoredSecurityData, saveStoredSecurityData } from "./storage";

export function logAuditEvent(
  category: AuditLogEntry["category"],
  action: string,
  severity: AuditLogEntry["severity"],
  actor: string,
  details: Record<string, any> = {},
  ipAddress?: string
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: generateSecureId("AUD", 4),
    timestamp: new Date().toISOString(),
    category,
    action,
    severity,
    actor,
    ipAddress,
    details,
  };

  try {
    const data = loadStoredSecurityData();
    data.auditLogs.unshift(entry);
    // Cap audit logs at 1,000 entries to prevent unbounded growth
    if (data.auditLogs.length > 1000) {
      data.auditLogs = data.auditLogs.slice(0, 1000);
    }
    saveStoredSecurityData(data);
  } catch (err) {
    console.error("Failed to append audit log entry:", err);
  }

  return entry;
}

export function getAuditLogs(limit = 100, category?: string): AuditLogEntry[] {
  const data = loadStoredSecurityData();
  let logs = data.auditLogs;
  if (category) {
    logs = logs.filter((l) => l.category === category);
  }
  return logs.slice(0, limit);
}
