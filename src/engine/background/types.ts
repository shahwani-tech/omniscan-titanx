/**
 * OMNISCAN TITAN X - Centralized Background & Compositing Architecture
 * Universal Types & State Models for Non-Destructive Multi-Layer Background Systems
 */

import type { BackgroundRemovalOptions, BackgroundRemovalResult, ShadowRemovalLevel, ManualBrushStroke } from "../backgroundRemover";
export type { BackgroundRemovalOptions, BackgroundRemovalResult, ShadowRemovalLevel, ManualBrushStroke };

export type BackgroundMode = "original" | "transparent" | "color" | "image" | "gradient" | "preset";

export type ImageFitMode = "contain" | "cover" | "fill" | "stretch" | "center" | "original" | "custom" | "crop" | "tile";

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
  blur?: number;        // Blur in pixels (0-20px) for bokeh/depth effect
  brightness?: number;  // -100 to +100 (default 0)
  contrast?: number;    // -100 to +100 (default 0)
  saturation?: number;  // -100 to +100 (default 0)
  temperature?: number; // -100 (Cool) to +100 (Warm) (default 0)
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
  checkHealth?: () => Promise<{ ok: boolean; configured?: boolean; latencyMs?: number; message?: string }>;
  removeBackground: (input: BackgroundRemovalInput) => Promise<BackgroundRemovalResult>;
}

export type RemovalJobStatus = "idle" | "processing" | "completed" | "failed" | "unconfigured";

export interface BackgroundStudioState {
  // Source & Layers (Separate, Non-Destructive)
  originalImage: string;
  originalHasTransparency?: boolean;
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
    isUnconfigured?: boolean;
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
  blur: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
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
  // Solid Standard
  {
    id: "icao-white",
    name: "Pure White",
    category: "passport",
    mode: "color",
    color: "#FFFFFF",
    description: "Official ICAO standard for US, Schengen & global passports",
  },
  {
    id: "off-white",
    name: "Off White",
    category: "passport",
    mode: "color",
    color: "#F5F5F5",
    description: "Soft high-key neutral passport & ID photo background",
  },
  {
    id: "light-grey",
    name: "Light Grey",
    category: "passport",
    mode: "color",
    color: "#E0E0E0",
    description: "Standard compliant neutral gray for Canadian & UK passports",
  },
  {
    id: "medium-grey",
    name: "Medium Grey",
    category: "passport",
    mode: "color",
    color: "#9E9E9E",
    description: "Formal corporate ID & badge neutral slate",
  },
  {
    id: "sky-blue",
    name: "Sky Blue",
    category: "passport",
    mode: "color",
    color: "#87CEEB",
    description: "Standard for US visa, consular, and Malaysian photo requirements",
  },
  {
    id: "cream-ivory",
    name: "Cream",
    category: "passport",
    mode: "color",
    color: "#FFF8E7",
    description: "Warm consular ivory tone for badges and IDs",
  },
  // Studio & Dark
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
  // Gradient Studio
  {
    id: "white-to-light-grey",
    name: "White to Light Grey",
    category: "gradient",
    mode: "gradient",
    gradient: {
      color1: "#FFFFFF",
      color2: "#D1D5DB",
      type: "linear",
      angle: 180,
    },
    description: "Classic top-to-bottom studio portrait illumination",
  },
  {
    id: "soft-studio-gradient",
    name: "Soft Studio Radial",
    category: "gradient",
    mode: "gradient",
    gradient: {
      color1: "#FFFFFF",
      color2: "#9CA3AF",
      type: "radial",
      angle: 0,
    },
    description: "Soft center spotlight feathering into neutral gray",
  },
  {
    id: "corporate-blue-gradient",
    name: "Professional Blue Gradient",
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
    name: "Studio Grey Gradient",
    category: "gradient",
    mode: "gradient",
    gradient: {
      color1: "#E2E8F0",
      color2: "#94A3B8",
      type: "linear",
      angle: 180,
    },
    description: "Subtle top-to-bottom soft vignette",
  },
];
