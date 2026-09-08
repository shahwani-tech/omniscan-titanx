/**
 * OMNISCAN TITAN X - Centralized Background & Compositing Architecture
 * Universal Types & State Models for Non-Destructive Multi-Layer Background Systems
 */

import type { BackgroundRemovalOptions, BackgroundRemovalResult, ShadowRemovalLevel, ManualBrushStroke } from "../backgroundRemover";
export type { BackgroundRemovalOptions, BackgroundRemovalResult, ShadowRemovalLevel, ManualBrushStroke };

export type BackgroundMode = "original" | "transparent" | "color" | "image" | "gradient" | "preset";

export type ImageFitMode = "contain" | "cover" | "fill" | "center" | "original" | "custom";

export interface BackgroundTransform {
  x: number;          // Horizontal offset in pixels relative to center
  y: number;          // Vertical offset in pixels relative to center
  width: number;      // Rendered width
  height: number;     // Rendered height
  scale: number;      // Uniform scale factor (1 = 100%)
  scaleX: number;     // Scale X (negative for horizontal flip)
  scaleY: number;     // Scale Y (negative for vertical flip)
  rotation: number;   // Rotation angle in degrees (-180 to 180 or 0 to 360)
  opacity: number;    // Opacity (0 to 1)
  fitMode: ImageFitMode;
}

export interface BackgroundCrop {
  x: number;          // Normalized 0..1 or pixel coordinate
  y: number;
  width: number;
  height: number;
  aspectRatio: number | null; // e.g. 1, 4/3, 16/9, 35/45, null for free
  croppedDataUrl?: string;
}

export interface ForegroundTransform {
  x: number;          // Horizontal offset relative to center
  y: number;          // Vertical offset relative to center
  scale: number;      // Uniform scale factor (1 = 100%)
  scaleX: number;     // 1 or -1 for horizontal flip
  scaleY: number;     // 1 or -1 for vertical flip
  rotation: number;   // Degrees
  opacity: number;    // 0 to 1
}

export interface BackgroundGradient {
  color1: string;
  color2: string;
  type: "linear" | "radial";
  angle: number; // 0 to 360
}

export interface BackgroundPreset {
  id: string;
  name: string;
  category: "passport" | "studio" | "gradient" | "pattern";
  mode: BackgroundMode;
  color?: string;
  gradient?: BackgroundGradient;
  thumbnailUrl?: string;
  description?: string;
}

export interface BackgroundRemovalProviderConfig {
  endpointUrl: string;       // e.g. "/api/background/remove" or "http://localhost:5000/api/remove"
  apiKey?: string;
  timeoutMs: number;
  authHeader?: string;
  modelName?: string;
  additionalParams?: Record<string, string | number | boolean>;
}

export interface BackgroundRemovalInput {
  image: string | HTMLCanvasElement;
  options?: Partial<BackgroundRemovalOptions>;
  signal?: AbortSignal;
}

export interface BackgroundRemovalProvider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly isConfigured: boolean;
  readonly isLocal: boolean;
  checkHealth?: () => Promise<{ ok: boolean; latencyMs?: number; message?: string }>;
  removeBackground: (input: BackgroundRemovalInput) => Promise<BackgroundRemovalResult>;
}

export type RemovalJobStatus = "idle" | "processing" | "completed" | "failed" | "unconfigured";

export interface BackgroundStudioState {
  // Source & Layers (Separate, Non-Destructive)
  originalImage: string;
  foregroundImage: string | null; // Alpha-transparent subject cutout
  backgroundMode: BackgroundMode;
  backgroundColor: string;        // Hex representation (#FFFFFF)
  backgroundGradient?: BackgroundGradient;
  backgroundImage: string | null; // Data URL or Image URL of imported backdrop
  backgroundImageName?: string;
  backgroundTransform: BackgroundTransform;
  backgroundCrop: BackgroundCrop | null;
  foregroundTransform: ForegroundTransform;

  // Manual brush refinement
  manualStrokes: ManualBrushStroke[];

  // Processing state
  removalOptions: BackgroundRemovalOptions;
  removalState: {
    status: RemovalJobStatus;
    providerId: string;
    confidenceScore: number;
    errorMessage?: string;
    maskUrl?: string;
    edgeUrl?: string;
    transparentUrl?: string;
  };

  // Cached composite
  compositePreviewUrl: string | null;
}

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface ColorHSL {
  h: number;
  s: number;
  l: number;
}

export const DEFAULT_BACKGROUND_TRANSFORM: BackgroundTransform = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 1,
  fitMode: "cover",
};

export const DEFAULT_FOREGROUND_TRANSFORM: ForegroundTransform = {
  x: 0,
  y: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 1,
};

export const STANDARD_BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: "icao-white",
    name: "ICAO Pure White",
    category: "passport",
    mode: "color",
    color: "#FFFFFF",
    description: "Official standard for US, EU, and Schengen passport photos",
  },
  {
    id: "embassy-blue",
    name: "Embassy Light Blue",
    category: "passport",
    mode: "color",
    color: "#E0F2FE",
    description: "Diplomatic & Visa standard for Kuwait, Malaysia, and selected consulates",
  },
  {
    id: "standard-gray",
    name: "Studio Light Gray",
    category: "passport",
    mode: "color",
    color: "#F3F4F6",
    description: "Official standard for Canadian passport and high-key portraits",
  },
  {
    id: "off-white-cream",
    name: "Consular Off-White",
    category: "passport",
    mode: "color",
    color: "#FAFAF9",
    description: "Soft warm ivory backdrop for ID cards and badge verification",
  },
  {
    id: "studio-slate",
    name: "Studio Slate Dark",
    category: "studio",
    mode: "color",
    color: "#1E293B",
    description: "Modern professional dark badge and portrait backdrop",
  },
  {
    id: "pure-black",
    name: "Obsidian Black",
    category: "studio",
    mode: "color",
    color: "#0B0F17",
    description: "High-contrast theatrical dark background",
  },
  {
    id: "corporate-gradient",
    name: "Corporate Blue Gradient",
    category: "gradient",
    mode: "gradient",
    gradient: {
      color1: "#1E3A8A",
      color2: "#3B82F6",
      type: "linear",
      angle: 135,
    },
    description: "Executive badge & corporate card gradient",
  },
  {
    id: "clean-silver-gradient",
    name: "Silver Mist Gradient",
    category: "gradient",
    mode: "gradient",
    gradient: {
      color1: "#E2E8F0",
      color2: "#FFFFFF",
      type: "linear",
      angle: 180,
    },
    description: "Subtle top-to-bottom soft vignette",
  },
];
