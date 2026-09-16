/**
 * OMNISCAN TITAN X - Auto Features & Engine Configuration Service
 * Persistent user settings for edge detection, deskew, classification, EXIF, and blank detection.
 * Persisted in localStorage under "omniscan.autoFeatures.settings".
 */

export interface EdgeDetectionSetting {
  enabled: boolean;
  sensitivity: "conservative" | "standard" | "aggressive";
}

export interface DeskewSetting {
  enabled: boolean;
  maxAngle: 5 | 10 | 45;
}

export interface ColorEnhanceSetting {
  enabled: boolean;
  mode: "content-aware" | "always-enhance";
}

export interface BlankPageSetting {
  enabled: boolean;
  sensitivity: "conservative" | "standard" | "aggressive";
  action: "flag" | "remove";
}

export interface AutoFeatureToggle {
  enabled: boolean;
}

export interface AutoFeatureSettings {
  edgeDetection: EdgeDetectionSetting;
  deskew: DeskewSetting;
  colorEnhance: ColorEnhanceSetting;
  blankPage: BlankPageSetting;
  autoRotate: AutoFeatureToggle;
  classification: AutoFeatureToggle;
  whiteBalance: AutoFeatureToggle;

  runOnUpload: boolean;
  showConfidenceBadges: boolean;
  showSuggestions: boolean;

  // Flattened aliases for backward compatibility and fast direct access
  autoEdgeDetection: boolean;
  edgeSensitivity: "conservative" | "standard" | "aggressive";

  autoDeskew: boolean;
  deskewMaxAngle: 5 | 10 | 45;

  autoColorEnhance: boolean;
  colorEnhanceMode: "content-aware" | "always-enhance";

  autoBlankPageRemoval: boolean;
  blankSensitivity: "conservative" | "standard" | "aggressive";
  blankAction: "flag" | "remove";

  autoRotateExif: boolean;
  autoClassification: boolean;
  autoWhiteBalance: boolean;
}

export const STORAGE_KEY_AUTO_FEATURES = "omniscan.autoFeatures.settings";

export const DEFAULT_RAW_SETTINGS = {
  edgeDetection: {
    enabled: true,
    sensitivity: "standard" as const,
  },
  deskew: {
    enabled: true,
    maxAngle: 10 as const,
  },
  colorEnhance: {
    enabled: true,
    mode: "content-aware" as const,
  },
  blankPage: {
    enabled: true,
    sensitivity: "standard" as const,
    action: "flag" as const,
  },
  autoRotate: { enabled: true },
  classification: { enabled: true },
  whiteBalance: { enabled: true },
  runOnUpload: true,
  showConfidenceBadges: true,
  showSuggestions: true,
};

/**
 * Normalizes any partial or legacy flat settings into complete synced AutoFeatureSettings
 */
export function normalizeSettings(raw: any): AutoFeatureSettings {
  const edgeEnabled =
    typeof raw?.edgeDetection?.enabled === "boolean"
      ? raw.edgeDetection.enabled
      : typeof raw?.autoEdgeDetection === "boolean"
      ? raw.autoEdgeDetection
      : DEFAULT_RAW_SETTINGS.edgeDetection.enabled;

  const edgeSens =
    raw?.edgeDetection?.sensitivity || raw?.edgeSensitivity || DEFAULT_RAW_SETTINGS.edgeDetection.sensitivity;

  const deskewEnabled =
    typeof raw?.deskew?.enabled === "boolean"
      ? raw.deskew.enabled
      : typeof raw?.autoDeskew === "boolean"
      ? raw.autoDeskew
      : DEFAULT_RAW_SETTINGS.deskew.enabled;

  const deskewAngle =
    raw?.deskew?.maxAngle || raw?.deskewMaxAngle || DEFAULT_RAW_SETTINGS.deskew.maxAngle;

  const colorEnabled =
    typeof raw?.colorEnhance?.enabled === "boolean"
      ? raw.colorEnhance.enabled
      : typeof raw?.autoColorEnhance === "boolean"
      ? raw.autoColorEnhance
      : DEFAULT_RAW_SETTINGS.colorEnhance.enabled;

  const colorMode =
    raw?.colorEnhance?.mode ||
    (raw?.colorEnhanceMode === "always-enhance" ? "always-enhance" : "content-aware") ||
    DEFAULT_RAW_SETTINGS.colorEnhance.mode;

  const blankEnabled =
    typeof raw?.blankPage?.enabled === "boolean"
      ? raw.blankPage.enabled
      : typeof raw?.autoBlankPageRemoval === "boolean"
      ? raw.autoBlankPageRemoval
      : DEFAULT_RAW_SETTINGS.blankPage.enabled;

  const blankSens =
    raw?.blankPage?.sensitivity || raw?.blankSensitivity || DEFAULT_RAW_SETTINGS.blankPage.sensitivity;

  const blankActRaw = raw?.blankPage?.action || raw?.blankAction;
  const blankAct: "flag" | "remove" =
    blankActRaw === "remove" || blankActRaw === "auto-remove" ? "remove" : "flag";

  const rotateEnabled =
    typeof raw?.autoRotate?.enabled === "boolean"
      ? raw.autoRotate.enabled
      : typeof raw?.autoRotateExif === "boolean"
      ? raw.autoRotateExif
      : DEFAULT_RAW_SETTINGS.autoRotate.enabled;

  const classEnabled =
    typeof raw?.classification?.enabled === "boolean"
      ? raw.classification.enabled
      : typeof raw?.autoClassification === "boolean"
      ? raw.autoClassification
      : DEFAULT_RAW_SETTINGS.classification.enabled;

  const wbEnabled =
    typeof raw?.whiteBalance?.enabled === "boolean"
      ? raw.whiteBalance.enabled
      : typeof raw?.autoWhiteBalance === "boolean"
      ? raw.autoWhiteBalance
      : DEFAULT_RAW_SETTINGS.whiteBalance.enabled;

  const runOnUpload =
    typeof raw?.runOnUpload === "boolean" ? raw.runOnUpload : DEFAULT_RAW_SETTINGS.runOnUpload;
  const showConfidenceBadges =
    typeof raw?.showConfidenceBadges === "boolean"
      ? raw.showConfidenceBadges
      : DEFAULT_RAW_SETTINGS.showConfidenceBadges;
  const showSuggestions =
    typeof raw?.showSuggestions === "boolean"
      ? raw.showSuggestions
      : DEFAULT_RAW_SETTINGS.showSuggestions;

  return {
    edgeDetection: {
      enabled: edgeEnabled,
      sensitivity: edgeSens,
    },
    deskew: {
      enabled: deskewEnabled,
      maxAngle: deskewAngle,
    },
    colorEnhance: {
      enabled: colorEnabled,
      mode: colorMode,
    },
    blankPage: {
      enabled: blankEnabled,
      sensitivity: blankSens,
      action: blankAct,
    },
    autoRotate: { enabled: rotateEnabled },
    classification: { enabled: classEnabled },
    whiteBalance: { enabled: wbEnabled },

    runOnUpload,
    showConfidenceBadges,
    showSuggestions,

    // Synced flat properties
    autoEdgeDetection: edgeEnabled,
    edgeSensitivity: edgeSens,

    autoDeskew: deskewEnabled,
    deskewMaxAngle: deskewAngle,

    autoColorEnhance: colorEnabled,
    colorEnhanceMode: colorMode,

    autoBlankPageRemoval: blankEnabled,
    blankSensitivity: blankSens,
    blankAction: blankAct,

    autoRotateExif: rotateEnabled,
    autoClassification: classEnabled,
    autoWhiteBalance: wbEnabled,
  };
}

export const DEFAULT_AUTO_FEATURE_SETTINGS: AutoFeatureSettings = normalizeSettings(DEFAULT_RAW_SETTINGS);

let cachedSettings: AutoFeatureSettings | null = null;
const listeners = new Set<(settings: AutoFeatureSettings) => void>();

/**
 * Retrieve current auto feature settings from memory cache or localStorage
 */
export function getAutoFeatureSettings(): AutoFeatureSettings {
  if (cachedSettings) return cachedSettings;

  if (typeof window === "undefined" || !window.localStorage) {
    cachedSettings = { ...DEFAULT_AUTO_FEATURE_SETTINGS };
    return cachedSettings;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTO_FEATURES);
    if (!raw) {
      cachedSettings = { ...DEFAULT_AUTO_FEATURE_SETTINGS };
      return cachedSettings;
    }
    const parsed = JSON.parse(raw);
    cachedSettings = normalizeSettings(parsed);
    return cachedSettings;
  } catch (err) {
    console.warn("Failed to read auto feature settings from localStorage:", err);
    cachedSettings = { ...DEFAULT_AUTO_FEATURE_SETTINGS };
    return cachedSettings;
  }
}

/**
 * Save updated auto feature settings to localStorage and notify subscribers.
 * The saved JSON strictly follows the specified nested format.
 */
export function saveAutoFeatureSettings(updated: Partial<AutoFeatureSettings> | any): AutoFeatureSettings {
  const current = getAutoFeatureSettings();

  // Handle both flat and nested updates
  const mergedRaw: any = {
    edgeDetection: {
      ...current.edgeDetection,
      ...(updated.edgeDetection || {}),
    },
    deskew: {
      ...current.deskew,
      ...(updated.deskew || {}),
    },
    colorEnhance: {
      ...current.colorEnhance,
      ...(updated.colorEnhance || {}),
    },
    blankPage: {
      ...current.blankPage,
      ...(updated.blankPage || {}),
    },
    autoRotate: {
      ...current.autoRotate,
      ...(updated.autoRotate || {}),
    },
    classification: {
      ...current.classification,
      ...(updated.classification || {}),
    },
    whiteBalance: {
      ...current.whiteBalance,
      ...(updated.whiteBalance || {}),
    },
    runOnUpload: updated.runOnUpload !== undefined ? updated.runOnUpload : current.runOnUpload,
    showConfidenceBadges:
      updated.showConfidenceBadges !== undefined ? updated.showConfidenceBadges : current.showConfidenceBadges,
    showSuggestions:
      updated.showSuggestions !== undefined ? updated.showSuggestions : current.showSuggestions,
  };

  // Check flat properties if provided
  if (updated.autoEdgeDetection !== undefined) mergedRaw.edgeDetection.enabled = updated.autoEdgeDetection;
  if (updated.edgeSensitivity !== undefined) mergedRaw.edgeDetection.sensitivity = updated.edgeSensitivity;

  if (updated.autoDeskew !== undefined) mergedRaw.deskew.enabled = updated.autoDeskew;
  if (updated.deskewMaxAngle !== undefined) mergedRaw.deskew.maxAngle = updated.deskewMaxAngle;

  if (updated.autoColorEnhance !== undefined) mergedRaw.colorEnhance.enabled = updated.autoColorEnhance;
  if (updated.colorEnhanceMode !== undefined) mergedRaw.colorEnhance.mode = updated.colorEnhanceMode;

  if (updated.autoBlankPageRemoval !== undefined) mergedRaw.blankPage.enabled = updated.autoBlankPageRemoval;
  if (updated.blankSensitivity !== undefined) mergedRaw.blankPage.sensitivity = updated.blankSensitivity;
  if (updated.blankAction !== undefined) {
    mergedRaw.blankPage.action =
      updated.blankAction === "remove" || updated.blankAction === "auto-remove" ? "remove" : "flag";
  }

  if (updated.autoRotateExif !== undefined) mergedRaw.autoRotate.enabled = updated.autoRotateExif;
  if (updated.autoClassification !== undefined) mergedRaw.classification.enabled = updated.autoClassification;
  if (updated.autoWhiteBalance !== undefined) mergedRaw.whiteBalance.enabled = updated.autoWhiteBalance;

  const next = normalizeSettings(mergedRaw);
  cachedSettings = next;

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      // Persist the clean nested specification object to localStorage
      const persistencePayload = {
        edgeDetection: {
          enabled: next.edgeDetection.enabled,
          sensitivity: next.edgeDetection.sensitivity,
        },
        deskew: {
          enabled: next.deskew.enabled,
          maxAngle: next.deskew.maxAngle,
        },
        colorEnhance: {
          enabled: next.colorEnhance.enabled,
          mode: next.colorEnhance.mode,
        },
        blankPage: {
          enabled: next.blankPage.enabled,
          sensitivity: next.blankPage.sensitivity,
          action: next.blankPage.action,
        },
        autoRotate: { enabled: next.autoRotate.enabled },
        classification: { enabled: next.classification.enabled },
        whiteBalance: { enabled: next.whiteBalance.enabled },
        runOnUpload: next.runOnUpload,
        showConfidenceBadges: next.showConfidenceBadges,
        showSuggestions: next.showSuggestions,
      };

      localStorage.setItem(STORAGE_KEY_AUTO_FEATURES, JSON.stringify(persistencePayload));
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
