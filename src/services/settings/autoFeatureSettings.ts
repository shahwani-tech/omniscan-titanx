/**
 * OMNISCAN TITAN X - Auto Features & Engine Configuration Service
 * Persistent user settings for edge detection, deskew, classification, EXIF, and blank detection.
 * Persisted in localStorage under "omniscan.autoFeatures.settings".
 */

export interface AutoFeatureSettings {
  // AUTO DETECTION
  autoEdgeDetection: boolean;
  edgeSensitivity: "conservative" | "standard" | "aggressive";

  autoDeskew: boolean;
  deskewMaxAngle: 5 | 10 | 45;

  autoColorEnhance: boolean;
  colorEnhanceMode: "content-aware" | "always-enhance" | "off";

  autoBlankPageRemoval: boolean;
  blankSensitivity: "conservative" | "standard" | "aggressive";
  blankAction: "auto-remove" | "flag-for-review";

  autoRotateExif: boolean;
  autoClassification: boolean;
  autoWhiteBalance: boolean;

  // BEHAVIOR OPTIONS
  runOnUpload: boolean;
  showConfidenceBadges: boolean;
  showSuggestions: boolean;
}

export const STORAGE_KEY_AUTO_FEATURES = "omniscan.autoFeatures.settings";

export const DEFAULT_AUTO_FEATURE_SETTINGS: AutoFeatureSettings = {
  // Auto Detection
  autoEdgeDetection: true,
  edgeSensitivity: "standard",

  autoDeskew: true,
  deskewMaxAngle: 10,

  autoColorEnhance: true,
  colorEnhanceMode: "content-aware",

  autoBlankPageRemoval: true,
  blankSensitivity: "standard",
  blankAction: "flag-for-review",

  autoRotateExif: true,
  autoClassification: true,
  autoWhiteBalance: true,

  // Behavior Options
  runOnUpload: true,
  showConfidenceBadges: true,
  showSuggestions: true,
};

let cachedSettings: AutoFeatureSettings | null = null;
const listeners = new Set<(settings: AutoFeatureSettings) => void>();

/**
 * Retrieve current auto feature settings from memory cache or localStorage
 */
export function getAutoFeatureSettings(): AutoFeatureSettings {
  if (cachedSettings) return cachedSettings;

  if (typeof window === "undefined" || !window.localStorage) {
    return { ...DEFAULT_AUTO_FEATURE_SETTINGS };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTO_FEATURES);
    if (!raw) {
      cachedSettings = { ...DEFAULT_AUTO_FEATURE_SETTINGS };
      return cachedSettings;
    }
    const parsed = JSON.parse(raw);
    cachedSettings = { ...DEFAULT_AUTO_FEATURE_SETTINGS, ...parsed };
    return cachedSettings;
  } catch (err) {
    console.warn("Failed to read auto feature settings from localStorage:", err);
    cachedSettings = { ...DEFAULT_AUTO_FEATURE_SETTINGS };
    return cachedSettings;
  }
}

/**
 * Save updated auto feature settings to localStorage and notify subscribers
 */
export function saveAutoFeatureSettings(updated: Partial<AutoFeatureSettings>): AutoFeatureSettings {
  const current = getAutoFeatureSettings();
  const next: AutoFeatureSettings = { ...current, ...updated };
  cachedSettings = next;

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_KEY_AUTO_FEATURES, JSON.stringify(next));
    } catch (err) {
      console.warn("Failed to persist auto feature settings to localStorage:", err);
    }
  }

  listeners.forEach((fn) => {
    try {
      fn(next);
    } catch (e) {
      console.error("Error in auto feature settings listener:", e);
    }
  });

  return next;
}

/**
 * Reset all auto feature settings to factory defaults
 */
export function resetAutoFeatureSettings(): AutoFeatureSettings {
  cachedSettings = { ...DEFAULT_AUTO_FEATURE_SETTINGS };
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.removeItem(STORAGE_KEY_AUTO_FEATURES);
    } catch (err) {
      console.warn("Failed to reset auto feature settings:", err);
    }
  }

  listeners.forEach((fn) => {
    try {
      fn(cachedSettings!);
    } catch (e) {
      console.error("Error in auto feature settings listener:", e);
    }
  });

  return { ...DEFAULT_AUTO_FEATURE_SETTINGS };
}

/**
 * Subscribe to live changes in auto feature settings
 */
export function subscribeAutoFeatureSettings(fn: (settings: AutoFeatureSettings) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
