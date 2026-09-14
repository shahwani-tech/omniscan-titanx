/**
 * OMNISCAN TITAN X - Centralized Background Removal Provider Architecture
 * Clean abstraction decoupling UI from specific AI / model backends.
 * Supports Local In-Browser Biometric Matting, GitHub Remote/Local Backend,
 * and future API Providers without UI redesign.
 */

import {
  BackgroundRemovalProvider,
  BackgroundRemovalInput,
  BackgroundRemovalProviderConfig,
} from "./types";
import {
  removeBackground as localRemoveBackground,
  BackgroundRemovalResult,
  DEFAULT_BG_REMOVAL_OPTIONS,
} from "../backgroundRemover";

const GITHUB_PROVIDER_STORAGE_KEY = "omniscan_bg_provider_github_config";
const ACTIVE_PROVIDER_STORAGE_KEY = "omniscan_bg_active_provider_id";

export const DEFAULT_GITHUB_CONFIG: BackgroundRemovalProviderConfig = {
  endpointUrl: "http://localhost:5000/api/background/remove",
  timeoutMs: 30000,
  modelName: "birefnet-general",
};

/**
 * Security: Scans and removes any legacy plaintext API keys or auth headers
 * from localStorage to protect user credentials. Runs on startup.
 */
export function migrateLegacyLocalStorageSecrets(): void {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    // 1. Sanitize GitHub provider config in localStorage
    const rawGithub = localStorage.getItem(GITHUB_PROVIDER_STORAGE_KEY);
    if (rawGithub) {
      const parsed = JSON.parse(rawGithub);
      if (parsed && typeof parsed === "object") {
        let changed = false;
        if ("apiKey" in parsed) {
          delete parsed.apiKey;
          changed = true;
        }
        if ("authHeader" in parsed) {
          delete parsed.authHeader;
          changed = true;
        }
        if (changed) {
          localStorage.setItem(GITHUB_PROVIDER_STORAGE_KEY, JSON.stringify(parsed));
        }
      }
    }

    // 2. Audit all other keys in localStorage for legacy tokens or keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      // Skip known benign non-secret keys
      if (
        key.startsWith("omniscan_cropbar") ||
        key.startsWith("omniscan_keyboard_shortcuts") ||
        key.startsWith("omniscan_recent_colors") ||
        key.startsWith("omniscan_custom_presets") ||
        key.startsWith("omniscan_project_recovery")
      ) {
        continue;
      }
      try {
        const val = localStorage.getItem(key);
        if (val && (val.startsWith("{") || val.startsWith("["))) {
          const obj = JSON.parse(val);
          if (obj && typeof obj === "object" && !Array.isArray(obj)) {
            let modified = false;
            if ("apiKey" in obj) {
              delete obj.apiKey;
              modified = true;
            }
            if ("authHeader" in obj) {
              delete obj.authHeader;
              modified = true;
            }
            if ("secretKey" in obj) {
              delete obj.secretKey;
              modified = true;
            }
            if (modified) {
              localStorage.setItem(key, JSON.stringify(obj));
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  } catch (err) {
    console.warn("Storage secret sanitization notice:", err);
  }
}

/**
 * 1. Local Browser-Based Provider
 * Fully offline, high-precision skin locus, Sobel edge gradient,
 * anatomical Ray-casting, and hair matting engine.
 */
export class LocalBackgroundRemovalProvider implements BackgroundRemovalProvider {
  readonly id = "local";
  readonly name = "Local Biometric AI Engine";
  readonly description = "Offline browser engine with anatomical facial anchors, Sobel contour tracing, and fine hair matting.";
  readonly isConfigured = true;
  readonly isLocal = true;

  async checkHealth(): Promise<{ ok: boolean; configured?: boolean; latencyMs?: number; message?: string }> {
    return {
      ok: true,
      configured: true,
      latencyMs: 1,
      message: "Browser WebAssembly/Canvas processing ready (Zero Network Latency).",
    };
  }

  async removeBackground(input: BackgroundRemovalInput): Promise<BackgroundRemovalResult> {
    return await localRemoveBackground(input.image, input.options);
  }
}

/**
 * 2. GitHub Backend Integration Provider
 * Connects to external Python/FastAPI, Flask, or Node.js background removal repositories
 * running locally (e.g. localhost:5000) or on remote servers via standard REST protocol.
 */
export class GitHubBackgroundRemovalProvider implements BackgroundRemovalProvider {
  readonly id = "github";
  readonly name = "GitHub / Remote Removal Backend";
  readonly description = "External connected AI repository (BiRefNet, RMBG, InSPyReNet, MODNet, etc.) via REST API.";
  readonly isLocal = false;

  private config: BackgroundRemovalProviderConfig;

  constructor(initialConfig?: Partial<BackgroundRemovalProviderConfig>) {
    this.config = {
      ...DEFAULT_GITHUB_CONFIG,
      ...this.loadSavedConfig(),
      ...initialConfig,
    };
  }

  get isConfigured(): boolean {
    return Boolean(this.config.endpointUrl && this.config.endpointUrl.trim().length > 0);
  }

  getConfig(): BackgroundRemovalProviderConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<BackgroundRemovalProviderConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  private loadSavedConfig(): Partial<BackgroundRemovalProviderConfig> {
    try {
      const raw = localStorage.getItem(GITHUB_PROVIDER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Security: Remove any legacy plaintext secrets if found
        let hadSecrets = false;
        if ("apiKey" in parsed) {
          delete parsed.apiKey;
          hadSecrets = true;
        }
        if ("authHeader" in parsed) {
          delete parsed.authHeader;
          hadSecrets = true;
        }
        if (hadSecrets) {
          localStorage.setItem(GITHUB_PROVIDER_STORAGE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  }

  private saveConfig(): void {
    try {
      // Security: Only persist non-sensitive configuration to client-side localStorage.
      // API keys, tokens, and authorization headers MUST NEVER be stored in localStorage.
      const safeConfig: Partial<BackgroundRemovalProviderConfig> = {
        endpointUrl: this.config.endpointUrl,
        timeoutMs: this.config.timeoutMs,
        modelName: this.config.modelName,
        additionalParams: this.config.additionalParams,
      };
      localStorage.setItem(GITHUB_PROVIDER_STORAGE_KEY, JSON.stringify(safeConfig));
    } catch {
      // ignore
    }
  }

  async checkHealth(): Promise<{ ok: boolean; configured?: boolean; latencyMs?: number; message?: string }> {
    if (!this.isConfigured) {
      return {
        ok: false,
        message: "Endpoint URL is empty. Please enter your backend service URL.",
      };
    }

    const t0 = performance.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);

      // Route health check securely through local server proxy (/api/background/health)
      // to keep credentials strictly server-side and bypass client-side CORS limitations
      const response = await fetch("/api/background/health", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          endpointUrl: this.config.endpointUrl,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const latencyMs = Math.round(performance.now() - t0);

      if (response.ok) {
        const data = await response.json();
        return {
          ok: data.ok !== false,
          configured: data.configured !== false,
          latencyMs: data.latencyMs || latencyMs,
          message:
            data.message ||
            `Backend connected successfully (${latencyMs}ms response time).`,
        };
      } else {
        const errData = await response.json().catch(() => ({}));
        const isUnconfigured =
          response.status === 503 || errData?.code === "SERVICE_NOT_CONFIGURED";
        return {
          ok: false,
          configured: !isUnconfigured,
          latencyMs,
          message:
            errData.message ||
            (isUnconfigured
              ? "AI background removal isn't set up yet — this feature will be available once configured."
              : `Backend proxy returned HTTP ${response.status}`),
        };
      }
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - t0);
      return {
        ok: false,
        latencyMs,
        message:
          err.name === "AbortError"
            ? "Connection timed out (no response within 6 seconds)."
            : `Could not connect to background proxy. (${err.message || "Network Error"})`,
      };
    }
  }

  async removeBackground(input: BackgroundRemovalInput): Promise<BackgroundRemovalResult> {
    if (!this.isConfigured) {
      throw new Error(
        "GitHub Background Removal Provider is not configured. Please specify an endpoint URL in Background Settings."
      );
    }

    // Convert input image to data URL or Blob
    let base64DataUrl: string;
    let width = 0;
    let height = 0;

    if (typeof input.image === "string") {
      base64DataUrl = input.image;
      const img = new Image();
      img.src = base64DataUrl;
      await new Promise<void>((res) => {
        img.onload = () => res();
        img.onerror = () => res();
      });
      width = img.naturalWidth || img.width;
      height = img.naturalHeight || img.height;
    } else {
      width = input.image.width;
      height = input.image.height;
      base64DataUrl = input.image.toDataURL("image/png");
    }

    const payload = {
      image: base64DataUrl,
      options: {
        ...DEFAULT_BG_REMOVAL_OPTIONS,
        ...input.options,
      },
      model: this.config.modelName,
      params: this.config.additionalParams || {},
      endpointUrl: this.config.endpointUrl,
    };

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), this.config.timeoutMs || 45000);

    let response: Response;
    try {
      // Route background removal request securely through local Express server proxy (/api/background/remove)
      // to keep credentials (API keys / auth headers) strictly on the server side.
      response = await fetch("/api/background/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: input.signal || controller.signal,
      });
    } catch (netErr: any) {
      clearTimeout(timeoutTimer);
      if (netErr.name === "AbortError") {
        throw new Error(
          `Background removal request timed out after ${(this.config.timeoutMs || 45000) / 1000}s.`
        );
      }
      throw new Error(
        `Failed to reach background removal backend proxy at /api/background/remove. (${netErr.message || "Network Error"})`
      );
    } finally {
      clearTimeout(timeoutTimer);
    }

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      const isUnconfigured =
        response.status === 503 || errJson?.code === "SERVICE_NOT_CONFIGURED";
      const errMessage = isUnconfigured
        ? (errJson?.message || "AI background removal isn't set up yet — this feature will be available once configured.")
        : (errJson?.error || errJson?.message || `Background removal service error (${response.status}): ${response.statusText}`);
      const err = new Error(errMessage);
      (err as any).isUnconfigured = isUnconfigured;
      (err as any).status = response.status;
      throw err;
    }

    // Expected JSON response:
    // {
    //   transparentImage: string; // Data URL or Base64 PNG
    //   maskImage?: string;       // Data URL or Base64 PNG
    //   confidenceScore?: number; // 0..100
    // }
    const resData = await response.json();

    const transparentUrl = resData.transparentImage || resData.image || resData.result;
    if (!transparentUrl) {
      throw new Error("Invalid response from removal backend: missing transparent image payload.");
    }

    const maskUrl = resData.maskImage || resData.mask || "";
    const confidenceScore = typeof resData.confidenceScore === "number" ? resData.confidenceScore : 95;

    return {
      resultDataUrl: transparentUrl,
      transparentDataUrl: transparentUrl,
      maskDataUrl: maskUrl || transparentUrl,
      edgeDataUrl: maskUrl || transparentUrl,
      confidenceScore,
      width,
      height,
    };
  }
}

/**
 * Central Service Registry & Orchestrator
 */
class BackgroundRemovalServiceManager {
  private providers: Map<string, BackgroundRemovalProvider> = new Map();
  private activeProviderId = "local";

  constructor() {
    // Register standard providers
    const local = new LocalBackgroundRemovalProvider();
    const github = new GitHubBackgroundRemovalProvider();
    this.registerProvider(local);
    this.registerProvider(github);

    // Restore saved provider preference
    try {
      const saved = localStorage.getItem(ACTIVE_PROVIDER_STORAGE_KEY);
      if (saved && this.providers.has(saved)) {
        this.activeProviderId = saved;
      }
    } catch {
      // ignore
    }
  }

  registerProvider(provider: BackgroundRemovalProvider): void {
    this.providers.set(provider.id, provider);
  }

  getAllProviders(): BackgroundRemovalProvider[] {
    return Array.from(this.providers.values());
  }

  getProvider(id: string): BackgroundRemovalProvider | undefined {
    return this.providers.get(id);
  }

  getActiveProvider(): BackgroundRemovalProvider {
    return this.providers.get(this.activeProviderId) || this.providers.get("local")!;
  }

  getActiveProviderId(): string {
    return this.activeProviderId;
  }

  setActiveProvider(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider with id "${id}" not found.`);
    }
    this.activeProviderId = id;
    try {
      localStorage.setItem(ACTIVE_PROVIDER_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }

  getGitHubProvider(): GitHubBackgroundRemovalProvider {
    return this.providers.get("github") as GitHubBackgroundRemovalProvider;
  }

  async executeRemoval(input: BackgroundRemovalInput, preferredProviderId?: string): Promise<BackgroundRemovalResult> {
    const provider = preferredProviderId
      ? this.providers.get(preferredProviderId) || this.getActiveProvider()
      : this.getActiveProvider();

    try {
      return await provider.removeBackground(input);
    } catch (err: any) {
      // If the error was explicitly that the remote AI service is unconfigured,
      // bubble it up so the UI displays the clear unconfigured notification and fallback options
      if (err.isUnconfigured) {
        throw err;
      }

      // If github provider failed with a network error and local fallback is viable
      if (provider.id !== "local" && !input.signal?.aborted) {
        console.warn(`Provider "${provider.name}" failed (${err.message}). Falling back to Local Biometric AI...`);
        const local = this.providers.get("local")!;
        const fallbackResult = await local.removeBackground(input);
        return {
          ...fallbackResult,
          confidenceScore: Math.min(fallbackResult.confidenceScore, 90),
        };
      }
      throw err;
    }
  }
}

export const backgroundRemovalService = new BackgroundRemovalServiceManager();
