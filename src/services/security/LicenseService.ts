/**
 * OMNISCAN TITAN X - Client License & Tamper Detection Service
 * Validates server-authoritative license state, tracks monotonic time,
 * handles offline grace periods, and enforces application lock screens.
 */

import { PublicLicenseStatusResponse, LicenseStatus, LicenseTimeRemaining } from "../../types/security";

const OFFLINE_AUTH_STORAGE_KEY = "titan_sec_auth_cache_v1";
const MONOTONIC_CLOCK_STORAGE_KEY = "titan_sec_clock_highwater_v1";
const SKEW_TOLERANCE_MS = 10 * 60 * 1000; // 10 minutes allowed local clock skew

type LicenseListener = (status: PublicLicenseStatusResponse, isTampered: boolean) => void;

class LicenseService {
  private currentStatus: PublicLicenseStatusResponse | null = null;
  private isTampered = false;
  private tamperReason = "";
  private listeners: Set<LicenseListener> = new Set();
  private pollIntervalId: any = null;
  private countdownIntervalId: any = null;

  constructor() {
    this.initMonotonicTimeCheck();
    this.loadOfflineCache();
    this.startPeriodicSync();
  }

  private initMonotonicTimeCheck() {
    try {
      const now = Date.now();
      const savedHighWater = localStorage.getItem(MONOTONIC_CLOCK_STORAGE_KEY);
      if (savedHighWater) {
        const highWater = parseInt(savedHighWater, 10);
        if (!isNaN(highWater)) {
          // If system clock was turned backward more than allowed skew
          if (now < highWater - SKEW_TOLERANCE_MS) {
            this.isTampered = true;
            this.tamperReason = "System clock rollback detected. Workstation locked to protect license integrity.";
            console.warn("[Security Alert] Clock rollback detected:", { now, highWater });
          } else if (now > highWater) {
            localStorage.setItem(MONOTONIC_CLOCK_STORAGE_KEY, String(now));
          }
        }
      } else {
        localStorage.setItem(MONOTONIC_CLOCK_STORAGE_KEY, String(now));
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  private updateMonotonicClock(currentTimestamp: number) {
    try {
      const saved = localStorage.getItem(MONOTONIC_CLOCK_STORAGE_KEY);
      const highWater = saved ? parseInt(saved, 10) : 0;
      if (currentTimestamp > highWater) {
        localStorage.setItem(MONOTONIC_CLOCK_STORAGE_KEY, String(currentTimestamp));
      }
    } catch {}
  }

  private loadOfflineCache() {
    try {
      const cached = localStorage.getItem(OFFLINE_AUTH_STORAGE_KEY);
      if (cached) {
        const parsed: PublicLicenseStatusResponse = JSON.parse(cached);
        this.currentStatus = parsed;
      }
    } catch {}
  }

  private saveOfflineCache(status: PublicLicenseStatusResponse) {
    try {
      localStorage.setItem(OFFLINE_AUTH_STORAGE_KEY, JSON.stringify(status));
    } catch {}
  }

  public async fetchStatus(): Promise<PublicLicenseStatusResponse> {
    try {
      const res = await fetch("/api/admin/status", {
        headers: { "Cache-Control": "no-cache" },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const status: PublicLicenseStatusResponse = await res.json();

      // Check server time against monotonic clock
      const serverTimeMs = new Date(status.serverTime).getTime();
      this.updateMonotonicClock(serverTimeMs);

      // Verify if server indicates active but local clock was manipulated
      if (this.isTampered) {
        status.isLocked = true;
        status.lockReason = this.tamperReason;
        status.licenseStatus = "locked";
      }

      this.currentStatus = status;
      this.saveOfflineCache(status);
      this.notifyListeners();
      return status;
    } catch (err) {
      // Offline fallback
      return this.handleOfflineEvaluation();
    }
  }

  private handleOfflineEvaluation(): PublicLicenseStatusResponse {
    const now = Date.now();
    this.initMonotonicTimeCheck();

    if (this.currentStatus) {
      // Re-evaluate expiration locally
      const expMs = new Date(this.currentStatus.expiresAt).getTime();
      const graceMs = this.currentStatus.gracePeriodEnabled
        ? (this.currentStatus.gracePeriodHours || 0) * 60 * 60 * 1000
        : 0;

      const isExpired = now >= expMs + graceMs;
      const effectiveLocked = this.isTampered || isExpired || this.currentStatus.licenseStatus === "locked" || this.currentStatus.licenseStatus === "suspended";

      const remainingMs = Math.max(0, expMs + graceMs - now);
      const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
      const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000);

      this.currentStatus = {
        ...this.currentStatus,
        isLocked: effectiveLocked,
        lockReason: this.isTampered
          ? this.tamperReason
          : isExpired
          ? "Offline license timeframe expired."
          : this.currentStatus.lockReason,
        licenseStatus: effectiveLocked ? "expired" : this.currentStatus.licenseStatus,
        remainingTime: {
          totalMilliseconds: remainingMs,
          days,
          hours,
          minutes,
          seconds,
          isExpired,
          isInGracePeriod: now >= expMs && now < expMs + graceMs,
          status: effectiveLocked ? "expired" : this.currentStatus.licenseStatus,
        },
      };

      this.notifyListeners();
      return this.currentStatus;
    }

    // Default fallback when never connected
    const fallback: PublicLicenseStatusResponse = {
      isConfigured: false,
      isLocked: false,
      licenseStatus: "active",
      applicationName: "OmniScan Titan X",
      installationId: "PENDING-CONNECTION",
      tenantId: "DEFAULT",
      expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      serverTime: new Date(now).toISOString(),
      remainingTime: {
        totalMilliseconds: 86400000,
        days: 1,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: false,
        isInGracePeriod: false,
        status: "active",
      },
      gracePeriodEnabled: false,
      gracePeriodHours: 0,
      offlineGraceAllowed: true,
      supportContact: "System Administrator",
      supportEmail: "support@omniscan.local",
    };

    this.currentStatus = fallback;
    return fallback;
  }

  private startPeriodicSync() {
    this.fetchStatus();

    // Poll status from server every 15 seconds
    this.pollIntervalId = setInterval(() => {
      this.fetchStatus();
    }, 15000);

    // Update countdown ticker every second
    this.countdownIntervalId = setInterval(() => {
      if (this.currentStatus && !this.currentStatus.isLocked) {
        const expMs = new Date(this.currentStatus.expiresAt).getTime();
        const now = Date.now();
        const remainingMs = Math.max(0, expMs - now);

        if (remainingMs <= 0 && this.currentStatus.licenseStatus === "active") {
          // Trigger immediate status re-fetch upon expiration
          this.fetchStatus();
        } else if (this.currentStatus.remainingTime) {
          const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
          const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
          const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
          const seconds = Math.floor((remainingMs % (60 * 1000)) / 1000);

          this.currentStatus = {
            ...this.currentStatus,
            remainingTime: {
              ...this.currentStatus.remainingTime,
              totalMilliseconds: remainingMs,
              days,
              hours,
              minutes,
              seconds,
            },
          };
          this.notifyListeners();
        }
      }
    }, 1000);
  }

  public subscribe(listener: LicenseListener): () => void {
    this.listeners.add(listener);
    if (this.currentStatus) {
      listener(this.currentStatus, this.isTampered);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    if (this.currentStatus) {
      this.listeners.forEach((listener) => listener(this.currentStatus!, this.isTampered));
    }
  }

  public getStatus(): PublicLicenseStatusResponse | null {
    return this.currentStatus;
  }

  public isApplicationLocked(): boolean {
    if (this.isTampered) return true;
    return Boolean(this.currentStatus?.isLocked);
  }

  public destroy() {
    if (this.pollIntervalId) clearInterval(this.pollIntervalId);
    if (this.countdownIntervalId) clearInterval(this.countdownIntervalId);
    this.listeners.clear();
  }
}

export const licenseService = new LicenseService();
