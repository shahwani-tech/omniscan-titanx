/**
 * OMNISCAN TITAN X - Super Admin Authentication & Session Management
 * Enforces rate limiting, brute-force lockout, strong password policy,
 * and timing-safe authentication.
 */

import { hashPassword, verifyPassword, generateToken } from "./crypto";
import { loadStoredSecurityData, saveStoredSecurityData } from "./storage";
import { FailedAttemptTracker, ActiveSession } from "./types";
import { logAuditEvent } from "./auditService";
import { dispatchDiscordSecurityNotification } from "./discordService";

const failedAttemptsMap = new Map<string, FailedAttemptTracker>();
const activeSessionsMap = new Map<string, ActiveSession>();

export interface PasswordPolicyCheckResult {
  isValid: boolean;
  errors: string[];
}

export function validatePasswordPolicy(password: string): PasswordPolicyCheckResult {
  const errors: string[] = [];

  if (!password || password.length < 10) {
    errors.push("Password must be at least 10 characters in length.");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter (A-Z).");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter (a-z).");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one numeric digit (0-9).");
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    errors.push("Password must contain at least one special symbol (!@#$%^&*...).");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function checkRateLimit(ipKey: string): { isLocked: boolean; remainingMinutes: number } {
  const now = Date.now();
  const tracker = failedAttemptsMap.get(ipKey);

  if (!tracker) {
    return { isLocked: false, remainingMinutes: 0 };
  }

  if (tracker.lockedUntil > now) {
    const remainingMs = tracker.lockedUntil - now;
    return {
      isLocked: true,
      remainingMinutes: Math.ceil(remainingMs / (60 * 1000)),
    };
  }

  // Lockout expired, reset if beyond time window
  if (now - tracker.lastFailedAt > 15 * 60 * 1000) {
    failedAttemptsMap.delete(ipKey);
  }

  return { isLocked: false, remainingMinutes: 0 };
}

function recordFailedAttempt(ipKey: string): void {
  const now = Date.now();
  const data = loadStoredSecurityData();
  const maxAttempts = data.policy.maxFailedLoginAttempts || 5;
  const lockoutDurationMs = (data.policy.lockoutDurationMinutes || 15) * 60 * 1000;

  const tracker = failedAttemptsMap.get(ipKey) || {
    count: 0,
    firstFailedAt: now,
    lastFailedAt: now,
    lockedUntil: 0,
  };

  tracker.count += 1;
  tracker.lastFailedAt = now;

  if (tracker.count >= maxAttempts) {
    tracker.lockedUntil = now + lockoutDurationMs;
    logAuditEvent(
      "security",
      "BRUTE_FORCE_LOCKOUT_ENGAGED",
      "security_alert",
      "SYSTEM",
      { ipAddress: ipKey, failedCount: tracker.count, lockoutMinutes: data.policy.lockoutDurationMinutes }
    );
    dispatchDiscordSecurityNotification("failed_login", {
      "IP Address": ipKey,
      "Failed Attempts": String(tracker.count),
      "Lockout Duration": `${data.policy.lockoutDurationMinutes} minutes`,
    }).catch(() => {});
  }

  failedAttemptsMap.set(ipKey, tracker);
}

function resetFailedAttempts(ipKey: string): void {
  failedAttemptsMap.delete(ipKey);
}

/**
 * First-Time Super Admin Setup: Initializes Master Password
 */
export async function initializeSuperAdminPassword(
  newPassword: string,
  confirmPassword: string,
  ipAddress = "127.0.0.1"
): Promise<{ success: boolean; message: string; sessionToken?: string; recoveryCode?: string }> {
  const data = loadStoredSecurityData();

  if (data.isConfigured && data.passwordHash) {
    return {
      success: false,
      message: "Super Admin master credentials have already been configured on this system.",
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      success: false,
      message: "Password and confirmation password do not match.",
    };
  }

  const policy = validatePasswordPolicy(newPassword);
  if (!policy.isValid) {
    return {
      success: false,
      message: policy.errors.join(" "),
    };
  }

  const hash = hashPassword(newPassword);
  const recoveryCode = generateToken(16).toUpperCase();
  const recoveryHash = hashPassword(recoveryCode);

  data.isConfigured = true;
  data.passwordHash = hash;
  data.recoveryKeyHash = recoveryHash;

  saveStoredSecurityData(data);

  logAuditEvent(
    "auth",
    "SUPER_ADMIN_INITIAL_SETUP_COMPLETED",
    "info",
    "SUPER_ADMIN",
    { ipAddress }
  );

  dispatchDiscordSecurityNotification("registration", {
    "Status": "Configured & Sealed",
    "Time": new Date().toISOString(),
  }).catch(() => {});

  // Automatically issue initial session
  const sessionToken = createSession(ipAddress);

  return {
    success: true,
    message: "Super Admin credentials provisioned successfully.",
    sessionToken,
    recoveryCode,
  };
}

/**
 * Authenticate Super Admin with Master Password
 */
export async function authenticateSuperAdmin(
  password: string,
  ipAddress = "127.0.0.1"
): Promise<{ success: boolean; message: string; sessionToken?: string; sessionExpiresAt?: string }> {
  const rateLimit = checkRateLimit(ipAddress);
  if (rateLimit.isLocked) {
    return {
      success: false,
      message: `Authentication access temporarily locked due to repeated failed attempts. Try again in ${rateLimit.remainingMinutes} minute(s).`,
    };
  }

  const data = loadStoredSecurityData();

  // If unconfigured, instruct to run initial setup
  if (!data.isConfigured || !data.passwordHash) {
    return {
      success: false,
      message: "Super Admin account requires initial provisioning setup.",
    };
  }

  const isValid = verifyPassword(password, data.passwordHash);

  if (!isValid) {
    recordFailedAttempt(ipAddress);
    logAuditEvent(
      "auth",
      "FAILED_SUPER_ADMIN_AUTHENTICATION",
      "warning",
      "UNKNOWN",
      { ipAddress }
    );
    // Generic message to avoid information disclosure
    return {
      success: false,
      message: "Authentication failed. Verification credentials rejected.",
    };
  }

  // Success
  resetFailedAttempts(ipAddress);

  const sessionToken = createSession(ipAddress);
  const session = activeSessionsMap.get(sessionToken);

  logAuditEvent(
    "auth",
    "SUPER_ADMIN_LOGIN_SUCCESS",
    "info",
    "SUPER_ADMIN",
    { ipAddress }
  );

  return {
    success: true,
    message: "Authenticated successfully.",
    sessionToken,
    sessionExpiresAt: session ? new Date(session.expiresAt).toISOString() : undefined,
  };
}

/**
 * Validate current password (for destructive actions or change password)
 */
export function verifyCurrentPassword(password: string): boolean {
  const data = loadStoredSecurityData();
  if (!data.passwordHash) return false;
  return verifyPassword(password, data.passwordHash);
}

/**
 * Change Super Admin Password
 */
export async function changeSuperAdminPassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
  ipAddress = "127.0.0.1"
): Promise<{ success: boolean; message: string }> {
  const data = loadStoredSecurityData();

  if (!data.passwordHash) {
    return { success: false, message: "Super Admin is not configured." };
  }

  if (!verifyPassword(currentPassword, data.passwordHash)) {
    logAuditEvent(
      "security",
      "PASSWORD_CHANGE_REJECTED_BAD_CURRENT",
      "warning",
      "SUPER_ADMIN",
      { ipAddress }
    );
    return { success: false, message: "Current master password is incorrect." };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, message: "New password and confirmation do not match." };
  }

  if (currentPassword === newPassword) {
    return { success: false, message: "New password must be different from current password." };
  }

  const policy = validatePasswordPolicy(newPassword);
  if (!policy.isValid) {
    return { success: false, message: policy.errors.join(" ") };
  }

  data.passwordHash = hashPassword(newPassword);
  saveStoredSecurityData(data);

  // Invalidate all existing sessions except maybe current, or invalidate all to enforce fresh re-login
  activeSessionsMap.clear();

  logAuditEvent(
    "security",
    "SUPER_ADMIN_PASSWORD_ROTATED",
    "security_alert",
    "SUPER_ADMIN",
    { ipAddress }
  );

  return {
    success: true,
    message: "Super Admin master password changed successfully. All active sessions terminated.",
  };
}

/**
 * Create a new Super Admin session
 */
export function createSession(ipAddress = "127.0.0.1"): string {
  const data = loadStoredSecurityData();
  const timeoutMs = (data.policy.sessionTimeoutMinutes || 15) * 60 * 1000;
  const token = generateToken(32);
  const now = Date.now();

  const session: ActiveSession = {
    token,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + timeoutMs,
    ipAddress,
  };

  activeSessionsMap.set(token, session);
  return token;
}

/**
 * Validate active session token and refresh activity timer
 */
export function validateSession(token: string): boolean {
  if (!token) return false;
  const session = activeSessionsMap.get(token);
  if (!session) return false;

  const now = Date.now();
  if (session.expiresAt < now) {
    activeSessionsMap.delete(token);
    return false;
  }

  // Refresh activity expiration
  const data = loadStoredSecurityData();
  const timeoutMs = (data.policy.sessionTimeoutMinutes || 15) * 60 * 1000;
  session.lastActivityAt = now;
  session.expiresAt = now + timeoutMs;
  return true;
}

/**
 * Invalidate a session (Logout or Lock)
 */
export function invalidateSession(token: string): void {
  activeSessionsMap.delete(token);
}

/**
 * Invalidate all sessions
 */
export function invalidateAllSessions(): void {
  activeSessionsMap.clear();
}
