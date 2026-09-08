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
  apiKey: "",
  authHeader: "",
  modelName: "birefnet-general",
};

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

  async checkHealth(): Promise<{ ok: boolean; latencyMs?: number; message?: string }> {
    return {
      ok: true,
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
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return {};
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(GITHUB_PROVIDER_STORAGE_KEY, JSON.stringify(this.config));
    } catch {
      // ignore
    }
  }

  async checkHealth(): Promise<{ ok: boolean; latencyMs?: number; message?: string }> {
    if (!this.isConfigured) {
      return {
        ok: false,
        message: "Endpoint URL is empty. Please enter your backend service URL.",
      };
    }

    const t0 = performance.now();
    try {
      // Check health endpoint (try /health or HEAD/GET on base endpoint)
      let healthUrl = this.config.endpointUrl;
      try {
        const urlObj = new URL(this.config.endpointUrl);
        urlObj.pathname = urlObj.pathname.replace(/\/remove\/?$/, "/health");
        healthUrl = urlObj.toString();
      } catch {
        // fallback
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      const headers: Record<string, string> = {
        Accept: "application/json, text/plain",
      };
      if (this.config.apiKey) {
        headers["Authorization"] = this.config.authHeader
          ? `${this.config.authHeader} ${this.config.apiKey}`
          : `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(healthUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      }).catch(async () => {
        // If /health fails, try OPTIONS or HEAD on primary endpoint
        return await fetch(this.config.endpointUrl, {
          method: "OPTIONS",
          headers,
          signal: controller.signal,
        });
      });

      clearTimeout(timer);
      const latencyMs = Math.round(performance.now() - t0);

      if (response.ok) {
        return {
          ok: true,
          latencyMs,
          message: `Backend connected successfully (${latencyMs}ms response time).`,
        };
      } else {
        return {
          ok: false,
          latencyMs,
          message: `Backend responded with HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - t0);
      return {
        ok: false,
        latencyMs,
        message:
          err.name === "AbortError"
            ? "Connection timed out (no response within 4 seconds)."
            : `Could not connect to ${this.config.endpointUrl}. Ensure the GitHub repository server is running.`,
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
    };

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), this.config.timeoutMs || 30000);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.config.apiKey) {
      headers["Authorization"] = this.config.authHeader
        ? `${this.config.authHeader} ${this.config.apiKey}`
        : `Bearer ${this.config.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(this.config.endpointUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: input.signal || controller.signal,
      });
    } catch (netErr: any) {
      clearTimeout(timeoutTimer);
      if (netErr.name === "AbortError") {
        throw new Error(
          `Background removal request timed out after ${(this.config.timeoutMs || 30000) / 1000}s.`
        );
      }
      throw new Error(
        `Failed to reach background removal backend at ${this.config.endpointUrl}. Is the service running? (${netErr.message || "Network Error"})`
      );
    } finally {
      clearTimeout(timeoutTimer);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Backend returned HTTP error ${response.status}: ${errText || response.statusText}`
      );
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
      // If github provider failed and local fallback is viable
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
