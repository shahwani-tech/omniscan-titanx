/**
 * OMNISCAN TITAN X - Super Admin & Central Management API Routes
 * Enterprise-grade REST endpoints with rate limiting, session auth,
 * and comprehensive audit telemetry.
 */

import { Router, Request, Response, NextFunction } from "express";
import {
  authenticateSuperAdmin,
  initializeSuperAdminPassword,
  changeSuperAdminPassword,
  validateSession,
  invalidateSession,
  verifyCurrentPassword,
} from "./security/authService";
import {
  getPublicLicenseStatus,
  updateLicenseConfiguration,
  lockApplicationImmediately,
  unlockApplication,
} from "./security/licenseService";
import {
  getApplicationBranding,
  updateApplicationName,
  getInstallationIdentity,
  regenerateInstallationIdentity,
} from "./security/identityService";
import { getAuditLogs, logAuditEvent } from "./security/auditService";
import { sendDiscordEmbed, DISCORD_COLORS } from "./security/discordService";
import {
  listCentralInstallations,
  approveInstallation,
  suspendInstallation,
  revokeInstallation,
  renewInstallationLicense,
} from "./security/centralAdminService";
import { loadStoredSecurityData, saveStoredSecurityData } from "./security/storage";
import { encryptPayload, decryptPayload } from "./security/crypto";

export const adminRouter = Router();

// Middleware: Require Super Admin Session
function requireSuperAdminSession(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized. Super Admin session token required." });
    return;
  }

  const token = authHeader.split(" ")[1];
  if (!validateSession(token)) {
    res.status(401).json({ error: "Session expired or invalid. Please re-authenticate." });
    return;
  }

  next();
}

// -------------------------------------------------------------
// Public Endpoints (Accessible by Client for License Evaluation)
// -------------------------------------------------------------

/**
 * GET /api/admin/status
 * Returns current public license state and server time. Contains NO secrets or password hashes.
 */
adminRouter.get("/admin/status", (_req: Request, res: Response) => {
  try {
    const status = getPublicLicenseStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to evaluate license state", details: err.message });
  }
});

/**
 * POST /api/admin/auth/setup
 * First-Time Super Admin Password Setup
 */
adminRouter.post("/admin/auth/setup", async (req: Request, res: Response) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";

    const result = await initializeSuperAdminPassword(newPassword, confirmPassword, ip);
    if (!result.success) {
      res.status(400).json({ error: result.message });
      return;
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to initialize credentials", details: err.message });
  }
});

/**
 * POST /api/admin/auth/login
 * Hidden Super Admin Authentication
 */
adminRouter.post("/admin/auth/login", async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";

    const result = await authenticateSuperAdmin(password, ip);
    if (!result.success) {
      res.status(401).json({ error: result.message });
      return;
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Authentication system error", details: err.message });
  }
});

/**
 * POST /api/admin/auth/logout
 * Terminates the active session
 */
adminRouter.post("/admin/auth/logout", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    invalidateSession(authHeader.split(" ")[1]);
  }
  res.json({ success: true, message: "Logged out successfully." });
});

// -------------------------------------------------------------
// Authenticated Super Admin Endpoints
// -------------------------------------------------------------

/**
 * GET /api/admin/config
 * Retrieves complete configuration for Super Admin console (no password hashes included)
 */
adminRouter.get("/admin/config", requireSuperAdminSession, (_req: Request, res: Response) => {
  try {
    const data = loadStoredSecurityData();
    const publicStatus = getPublicLicenseStatus();

    // Sanitized payload excluding password hashes
    res.json({
      isConfigured: data.isConfigured,
      installation: data.installation,
      branding: data.branding,
      license: data.license,
      policy: data.policy,
      discord: {
        ...data.discord,
        // Never return bot token
        hasBotTokenConfigured: Boolean(process.env.DISCORD_BOT_TOKEN),
      },
      expirationHistory: data.expirationHistory,
      publicStatus,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load admin configuration", details: err.message });
  }
});

/**
 * POST /api/admin/auth/change-password
 * Requires current password, new password, confirm new password
 */
adminRouter.post("/admin/auth/change-password", requireSuperAdminSession, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";

    const result = await changeSuperAdminPassword(currentPassword, newPassword, confirmPassword, ip);
    if (!result.success) {
      res.status(400).json({ error: result.message });
      return;
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to rotate master password", details: err.message });
  }
});

/**
 * PUT /api/admin/config/license
 * Configures duration presets, exact dates, grace periods
 */
adminRouter.put("/admin/config/license", requireSuperAdminSession, (req: Request, res: Response) => {
  try {
    const { durationUnit, durationValue, exactExpiresAt, timeZone, gracePeriodEnabled, gracePeriodHours, reason } = req.body;

    const updated = updateLicenseConfiguration({
      durationUnit,
      durationValue: durationValue !== undefined ? Number(durationValue) : undefined,
      exactExpiresAt,
      timeZone,
      gracePeriodEnabled,
      gracePeriodHours: gracePeriodHours !== undefined ? Number(gracePeriodHours) : undefined,
      reason,
      actor: "SUPER_ADMIN",
    });

    res.json({ success: true, license: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update license" });
  }
});

/**
 * POST /api/admin/config/lock
 * Immediately locks down application
 */
adminRouter.post("/admin/config/lock", requireSuperAdminSession, (req: Request, res: Response) => {
  try {
    const { reason, confirmPassword } = req.body;

    if (!confirmPassword || !verifyCurrentPassword(confirmPassword)) {
      res.status(403).json({ error: "Verification failed. Master password required for immediate lockdown." });
      return;
    }

    const locked = lockApplicationImmediately(reason || "Manual Administrator Lockdown", "SUPER_ADMIN");
    res.json({ success: true, license: locked });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to engage lockdown", details: err.message });
  }
});

/**
 * POST /api/admin/config/unlock
 * Immediately unlocks application (also accessible via direct password verification)
 */
adminRouter.post("/admin/config/unlock", (req: Request, res: Response) => {
  try {
    const { password } = req.body;

    if (!password || !verifyCurrentPassword(password)) {
      res.status(403).json({ error: "Invalid master password provided." });
      return;
    }

    const unlocked = unlockApplication("SUPER_ADMIN");
    res.json({ success: true, license: unlocked });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to release lockdown", details: err.message });
  }
});

/**
 * PUT /api/admin/config/branding
 * Configures Application Name, Organization, Support
 */
adminRouter.put("/admin/config/branding", requireSuperAdminSession, (req: Request, res: Response) => {
  try {
    const { applicationName, organizationName, supportContact, supportEmail } = req.body;
    const updated = updateApplicationName(
      applicationName,
      organizationName,
      supportContact,
      supportEmail,
      "SUPER_ADMIN"
    );
    res.json({ success: true, branding: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to update branding" });
  }
});

/**
 * POST /api/admin/config/rotate-identity
 * Rotates the installation ID
 */
adminRouter.post("/admin/config/rotate-identity", requireSuperAdminSession, (req: Request, res: Response) => {
  try {
    const { reason, confirmPassword } = req.body;

    if (!confirmPassword || !verifyCurrentPassword(confirmPassword)) {
      res.status(403).json({ error: "Master password required to rotate installation identity." });
      return;
    }

    const updated = regenerateInstallationIdentity(reason || "Super Admin manual identity rotation", "SUPER_ADMIN");
    res.json({ success: true, installation: updated });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to rotate installation identity", details: err.message });
  }
});

/**
 * PUT /api/admin/config/policy
 * Updates session and security policy
 */
adminRouter.put("/admin/config/policy", requireSuperAdminSession, (req: Request, res: Response) => {
  try {
    const data = loadStoredSecurityData();
    const { sessionTimeoutMinutes, maxFailedLoginAttempts, lockoutDurationMinutes, preventScreenCapture } = req.body;

    if (sessionTimeoutMinutes) data.policy.sessionTimeoutMinutes = Math.max(1, Number(sessionTimeoutMinutes));
    if (maxFailedLoginAttempts) data.policy.maxFailedLoginAttempts = Math.max(3, Number(maxFailedLoginAttempts));
    if (lockoutDurationMinutes) data.policy.lockoutDurationMinutes = Math.max(1, Number(lockoutDurationMinutes));
    if (preventScreenCapture !== undefined) data.policy.preventScreenCapture = Boolean(preventScreenCapture);

    saveStoredSecurityData(data);
    logAuditEvent("security", "SECURITY_POLICY_UPDATED", "info", "SUPER_ADMIN", data.policy);

    res.json({ success: true, policy: data.policy });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update policy", details: err.message });
  }
});

/**
 * PUT /api/admin/config/discord
 * Updates Discord alert event triggers
 */
adminRouter.put("/admin/config/discord", requireSuperAdminSession, (req: Request, res: Response) => {
  try {
    const data = loadStoredSecurityData();
    const { enabled, channelId, notifyOnRegistration, notifyOnExpiringSoon, notifyOnExpired, notifyOnLockdown, notifyOnFailedLogins, notifyOnRename } = req.body;

    if (enabled !== undefined) data.discord.enabled = Boolean(enabled);
    if (channelId !== undefined) data.discord.channelId = String(channelId).trim();
    if (notifyOnRegistration !== undefined) data.discord.notifyOnRegistration = Boolean(notifyOnRegistration);
    if (notifyOnExpiringSoon !== undefined) data.discord.notifyOnExpiringSoon = Boolean(notifyOnExpiringSoon);
    if (notifyOnExpired !== undefined) data.discord.notifyOnExpired = Boolean(notifyOnExpired);
    if (notifyOnLockdown !== undefined) data.discord.notifyOnLockdown = Boolean(notifyOnLockdown);
    if (notifyOnFailedLogins !== undefined) data.discord.notifyOnFailedLogins = Boolean(notifyOnFailedLogins);
    if (notifyOnRename !== undefined) data.discord.notifyOnRename = Boolean(notifyOnRename);

    saveStoredSecurityData(data);
    res.json({ success: true, discord: data.discord });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update Discord configuration", details: err.message });
  }
});

/**
 * POST /api/admin/discord/test
 * Sends a live test alert to Discord from backend
 */
adminRouter.post("/admin/discord/test", requireSuperAdminSession, async (_req: Request, res: Response) => {
  try {
    const result = await sendDiscordEmbed(
      "Test Notification Diagnostics",
      "Super Admin initiated a Discord telemetry test. Secure communication channel verified.",
      DISCORD_COLORS.INFO,
      [{ name: "Test Status", value: "Verified Active" }]
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/audit-logs
 * Retrieves security audit history
 */
adminRouter.get("/admin/audit-logs", requireSuperAdminSession, (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const category = req.query.category as string | undefined;
    const logs = getAuditLogs(limit, category);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to query audit logs", details: err.message });
  }
});

/**
 * POST /api/admin/export
 * Exports an encrypted configuration snapshot
 */
adminRouter.post("/admin/export", requireSuperAdminSession, (req: Request, res: Response) => {
  try {
    const { exportPassphrase } = req.body;
    if (!exportPassphrase || exportPassphrase.length < 8) {
      res.status(400).json({ error: "Passphrase with at least 8 characters is required to encrypt configuration." });
      return;
    }

    const data = loadStoredSecurityData();
    const exportableState = {
      branding: data.branding,
      license: data.license,
      policy: data.policy,
      discord: data.discord,
      exportedAt: new Date().toISOString(),
    };

    const encrypted = encryptPayload(JSON.stringify(exportableState), exportPassphrase);
    res.json({
      success: true,
      encryptedPayload: encrypted,
      exportedAt: exportableState.exportedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to export configuration", details: err.message });
  }
});

/**
 * POST /api/admin/import
 * Imports an encrypted configuration snapshot
 */
adminRouter.post("/admin/import", requireSuperAdminSession, (req: Request, res: Response) => {
  try {
    const { encryptedPayload, importPassphrase, confirmPassword } = req.body;

    if (!confirmPassword || !verifyCurrentPassword(confirmPassword)) {
      res.status(403).json({ error: "Master password confirmation required to import configuration." });
      return;
    }

    const decryptedJson = decryptPayload(encryptedPayload, importPassphrase);
    const parsed = JSON.parse(decryptedJson);

    const data = loadStoredSecurityData();
    if (parsed.branding) data.branding = { ...data.branding, ...parsed.branding };
    if (parsed.license) data.license = { ...data.license, ...parsed.license };
    if (parsed.policy) data.policy = { ...data.policy, ...parsed.policy };
    if (parsed.discord) data.discord = { ...data.discord, ...parsed.discord };

    saveStoredSecurityData(data);
    logAuditEvent("system", "CONFIGURATION_IMPORTED", "security_alert", "SUPER_ADMIN");

    res.json({ success: true, message: "Configuration imported successfully." });
  } catch (err: any) {
    res.status(400).json({ error: "Failed to decrypt or parse imported configuration. Check passphrase." });
  }
});

/**
 * POST /api/admin/reset
 * Resets configuration to defaults (Requires master password confirmation)
 */
adminRouter.post("/admin/reset", requireSuperAdminSession, (req: Request, res: Response) => {
  try {
    const { confirmPassword } = req.body;

    if (!confirmPassword || !verifyCurrentPassword(confirmPassword)) {
      res.status(403).json({ error: "Master password confirmation required to reset configuration." });
      return;
    }

    const data = loadStoredSecurityData();
    // Re-initialize default 30-day license
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    data.license.status = "active";
    data.license.durationUnit = "days";
    data.license.durationValue = 30;
    data.license.expiresAt = thirtyDaysLater.toISOString();
    data.license.gracePeriodEnabled = false;
    data.license.gracePeriodHours = 0;
    data.license.immediateLockReason = undefined;

    saveStoredSecurityData(data);
    logAuditEvent("system", "CONFIGURATION_RESET_TO_DEFAULTS", "critical", "SUPER_ADMIN");

    res.json({ success: true, message: "Configuration reset to standard defaults." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to reset configuration", details: err.message });
  }
});

// -------------------------------------------------------------
// Central Multi-Installation Management Endpoints
// -------------------------------------------------------------

/**
 * GET /api/central/installations
 * Lists all registered installations
 */
adminRouter.get("/central/installations", requireSuperAdminSession, (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const installations = listCentralInstallations(search);
    res.json({ installations });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to query installations", details: err.message });
  }
});

/**
 * POST /api/central/installations/:id/approve
 */
adminRouter.post("/central/installations/:id/approve", requireSuperAdminSession, (req: Request, res: Response) => {
  try {
    const updated = approveInstallation(req.params.id, "SUPER_ADMIN");
    res.json({ success: true, installation: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/central/installations/:id/suspend
 */
adminRouter.post("/central/installations/:id/suspend", requireSuperAdminSession, (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const updated = suspendInstallation(req.params.id, reason, "SUPER_ADMIN");
    res.json({ success: true, installation: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/central/installations/:id/revoke
 */
adminRouter.post("/central/installations/:id/revoke", requireSuperAdminSession, (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const updated = revokeInstallation(req.params.id, reason, "SUPER_ADMIN");
    res.json({ success: true, installation: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/central/installations/:id/renew
 */
adminRouter.post("/central/installations/:id/renew", requireSuperAdminSession, (req: Request, res: Response) => {
  try {
    const { days } = req.body;
    const updated = renewInstallationLicense(req.params.id, Number(days) || 30, "SUPER_ADMIN");
    res.json({ success: true, installation: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
