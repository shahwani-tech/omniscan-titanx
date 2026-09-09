/**
 * OMNISCAN TITAN X - Super Admin Client Authentication Service
 * In-memory session token management (never stored in localStorage),
 * inactivity session timeout, and secure API dispatcher.
 */

type AuthStateListener = (isAuthenticated: boolean) => void;

class SuperAdminAuthService {
  private sessionToken: string | null = null;
  private sessionExpiresAt: number | null = null;
  private inactivityTimerId: any = null;
  private listeners: Set<AuthStateListener> = new Set();
  private sessionTimeoutMinutes = 15;

  constructor() {
    this.setupActivityListeners();
  }

  private setupActivityListeners() {
    const resetTimer = () => {
      if (this.sessionToken) {
        this.startInactivityTimer();
      }
    };

    window.addEventListener("mousedown", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("touchstart", resetTimer);
  }

  private startInactivityTimer() {
    if (this.inactivityTimerId) {
      clearTimeout(this.inactivityTimerId);
    }
    const timeoutMs = this.sessionTimeoutMinutes * 60 * 1000;
    this.inactivityTimerId = setTimeout(() => {
      this.lockSession("Session timed out due to inactivity.");
    }, timeoutMs);
  }

  public subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    listener(this.isAuthenticated());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const authed = this.isAuthenticated();
    this.listeners.forEach((l) => l(authed));
  }

  public isAuthenticated(): boolean {
    if (!this.sessionToken) return false;
    if (this.sessionExpiresAt && Date.now() > this.sessionExpiresAt) {
      this.lockSession("Session expired.");
      return false;
    }
    return true;
  }

  public getSessionToken(): string | null {
    return this.isAuthenticated() ? this.sessionToken : null;
  }

  public setSession(token: string, expiresAtIso?: string, timeoutMinutes = 15) {
    this.sessionToken = token;
    this.sessionTimeoutMinutes = timeoutMinutes;
    this.sessionExpiresAt = expiresAtIso ? new Date(expiresAtIso).getTime() : Date.now() + timeoutMinutes * 60 * 1000;
    this.startInactivityTimer();
    this.notifyListeners();
  }

  public async login(password: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.error || data.message || "Authentication failed.",
        };
      }

      this.setSession(data.sessionToken, data.sessionExpiresAt);
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, message: err.message || "Network error" };
    }
  }

  public async setup(newPassword: string, confirmPassword: string): Promise<{ success: boolean; message: string; recoveryCode?: string }> {
    try {
      const res = await fetch("/api/admin/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.error || data.message || "Setup failed.",
        };
      }

      if (data.sessionToken) {
        this.setSession(data.sessionToken);
      }
      return { success: true, message: data.message, recoveryCode: data.recoveryCode };
    } catch (err: any) {
      return { success: false, message: err.message || "Network error" };
    }
  }

  public async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<{ success: boolean; message: string }> {
    const token = this.getSessionToken();
    if (!token) return { success: false, message: "Authentication required." };

    try {
      const res = await fetch("/api/admin/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, message: data.error || data.message || "Password change failed." };
      }

      // Password rotation invalidates sessions; user must re-login
      this.lockSession("Password changed. Please authenticate with your new master password.");
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, message: err.message || "Network error" };
    }
  }

  public async unlockApplication(password: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch("/api/admin/config/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, message: data.error || "Unlock verification failed." };
      }

      return { success: true, message: "Application unlocked successfully." };
    } catch (err: any) {
      return { success: false, message: err.message || "Network error" };
    }
  }

  public lockSession(_reason?: string) {
    if (this.sessionToken) {
      fetch("/api/admin/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.sessionToken}`,
        },
      }).catch(() => {});
    }

    this.sessionToken = null;
    this.sessionExpiresAt = null;
    if (this.inactivityTimerId) {
      clearTimeout(this.inactivityTimerId);
      this.inactivityTimerId = null;
    }
    this.notifyListeners();
  }
}

export const superAdminAuthService = new SuperAdminAuthService();
