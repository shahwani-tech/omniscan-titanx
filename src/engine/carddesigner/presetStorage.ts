/**
 * Preset Storage & Management Engine for ID & Service Card Designer
 * Supports default built-in presets, custom user presets, and slot replacement with local persistence.
 */

import { CardDesignerProject, CardObject } from "./types";
import {
  createDefaultProject,
  createCorporateEmployeeTemplate,
  createOfficialSecurityServiceTemplate,
  createVisitorAccessTemplate,
  createBlankProject,
  BUILTIN_TEMPLATES,
} from "./templates";
import { getTrueCardBoundsInZone } from "./cardGeometry";

export interface CardPresetItem {
  id: string;
  name: string;
  description: string;
  isCustom: boolean;
  isReplacedSlot?: boolean;
  slotId?: string; // e.g. "corporate-employee", "official-service", "visitor-access", "blank-dual-a6"
  originalName?: string;
  projectData?: CardDesignerProject;
  updatedAt: number;
}

const STORAGE_KEY = "omniscan_card_designer_presets_v1";

interface StoredPresetPayload {
  replacedSlots: Record<
    string,
    {
      name: string;
      description: string;
      projectData: CardDesignerProject;
      updatedAt: number;
    }
  >;
  customPresets: Array<{
    id: string;
    name: string;
    description: string;
    projectData: CardDesignerProject;
    updatedAt: number;
  }>;
}

const getStoredPayload = (): StoredPresetPayload => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { replacedSlots: {}, customPresets: [] };
    const parsed = JSON.parse(raw);
    return {
      replacedSlots: parsed.replacedSlots || {},
      customPresets: Array.isArray(parsed.customPresets) ? parsed.customPresets : [],
    };
  } catch (err) {
    console.warn("Failed to parse stored card presets from localStorage:", err);
    return { replacedSlots: {}, customPresets: [] };
  }
};

const saveStoredPayload = (payload: StoredPresetPayload): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error("Failed to save card presets to localStorage:", err);
  }
};

/**
 * Factory for creating fresh default project instances for built-in slots
 */
export const getFactoryDefaultProject = (slotId: string): CardDesignerProject => {
  switch (slotId) {
    case "corporate-employee":
      return createCorporateEmployeeTemplate();
    case "official-service":
      return createOfficialSecurityServiceTemplate();
    case "visitor-access":
      return createVisitorAccessTemplate();
    case "blank-dual-a6":
    default:
      return createBlankProject("Custom Card Design", "portrait");
  }
};

/**
 * Returns all active presets including replaced default slots and custom user presets
 */
export const getAllPresets = (): CardPresetItem[] => {
  const { replacedSlots, customPresets } = getStoredPayload();

  // 1. Built-in slots (or replaced versions)
  const defaultSlots: CardPresetItem[] = BUILTIN_TEMPLATES.map((tmpl) => {
    const replaced = replacedSlots[tmpl.id];
    if (replaced) {
      return {
        id: `slot-${tmpl.id}`,
        slotId: tmpl.id,
        name: replaced.name,
        description: replaced.description,
        isCustom: true,
        isReplacedSlot: true,
        originalName: tmpl.name,
        projectData: replaced.projectData,
        updatedAt: replaced.updatedAt,
      };
    }
    return {
      id: tmpl.id,
      slotId: tmpl.id,
      name: tmpl.name,
      description: tmpl.description,
      isCustom: false,
      isReplacedSlot: false,
      updatedAt: 0,
    };
  });

  // 2. Custom standalone presets
  const userPresets: CardPresetItem[] = customPresets.map((cp) => ({
    id: cp.id,
    name: cp.name,
    description: cp.description,
    isCustom: true,
    isReplacedSlot: false,
    projectData: cp.projectData,
    updatedAt: cp.updatedAt,
  }));

  return [...defaultSlots, ...userPresets];
};

/**
 * Load project data for any preset item (or preset/slot ID)
 */
export const loadPresetProject = (presetOrId: CardPresetItem | string): CardDesignerProject => {
  if (typeof presetOrId === "string") {
    const all = getAllPresets();
    const found = all.find((p) => p.slotId === presetOrId || p.id === presetOrId);
    if (found) {
      return loadPresetProject(found);
    }
    return getFactoryDefaultProject(presetOrId);
  }

  if (presetOrId.projectData) {
    // Return deep cloned copy so mutation doesn't affect stored preset
    return JSON.parse(JSON.stringify(presetOrId.projectData));
  }
  if (presetOrId.slotId) {
    return getFactoryDefaultProject(presetOrId.slotId);
  }
  return createDefaultProject();
};

/**
 * Replace an existing default slot with user-uploaded project
 */
export const replaceDefaultSlot = (
  slotId: string,
  name: string,
  description: string,
  projectData: CardDesignerProject
): void => {
  const payload = getStoredPayload();
  payload.replacedSlots[slotId] = {
    name,
    description,
    projectData: JSON.parse(JSON.stringify(projectData)),
    updatedAt: Date.now(),
  };
  saveStoredPayload(payload);
};

/**
 * Reset a default slot back to factory built-in preset
 */
export const resetDefaultSlot = (slotId: string): void => {
  const payload = getStoredPayload();
  if (payload.replacedSlots[slotId]) {
    delete payload.replacedSlots[slotId];
    saveStoredPayload(payload);
  }
};

/**
 * Add a new custom user preset
 */
export const addCustomPreset = (
  name: string,
  description: string,
  projectData: CardDesignerProject
): CardPresetItem => {
  const payload = getStoredPayload();
  const id = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newPreset = {
    id,
    name,
    description,
    projectData: JSON.parse(JSON.stringify(projectData)),
    updatedAt: Date.now(),
  };
  payload.customPresets.push(newPreset);
  saveStoredPayload(payload);

  return {
    id,
    name,
    description,
    isCustom: true,
    isReplacedSlot: false,
    projectData: newPreset.projectData,
    updatedAt: newPreset.updatedAt,
  };
};

/**
 * Delete a custom preset
 */
export const deleteCustomPreset = (id: string): void => {
  const payload = getStoredPayload();
  payload.customPresets = payload.customPresets.filter((p) => p.id !== id);
  saveStoredPayload(payload);
};

/**
 * Validate and parse an uploaded file into a usable CardDesignerProject.
 * Supports:
 * 1. .ocard native JSON projects
 * 2. Image files (PNG, JPG, WEBP, SVG) converted into card canvas layers
 */
export const validateAndParsePresetFile = async (
  file: File
): Promise<{ project: CardDesignerProject; name: string; description: string }> => {
  const fileName = file.name.toLowerCase();

  // 1. Native .ocard or .json project file
  if (fileName.endsWith(".ocard") || fileName.endsWith(".json")) {
    const text = await file.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error("Invalid file format: Not a valid JSON or .ocard file.");
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid .ocard project: Root element is not an object.");
    }

    // Validate core project properties
    if (!parsed.front || !Array.isArray(parsed.front.objects)) {
      throw new Error("Invalid .ocard project: Missing Front card layer objects.");
    }
    if (!parsed.back || !Array.isArray(parsed.back.objects)) {
      throw new Error("Invalid .ocard project: Missing Back card layer objects.");
    }

    // Fill in default missing fields if from older version
    const base = createBlankProject(parsed.name || file.name.replace(/\.(ocard|json)$/i, ""), parsed.orientation || "portrait");
    const project: CardDesignerProject = {
      ...base,
      ...parsed,
      id: parsed.id || `preset-project-${Date.now()}`,
      name: parsed.name || file.name.replace(/\.(ocard|json)$/i, ""),
      front: {
        background: parsed.front.background || base.front.background,
        objects: parsed.front.objects || [],
      },
      back: {
        background: parsed.back.background || base.back.background,
        objects: parsed.back.objects || [],
      },
      updatedAt: Date.now(),
    };

    return {
      project,
      name: project.name,
      description: parsed.description || `Imported from ${file.name}`,
    };
  }

  // 2. Image files (PNG, JPG, JPEG, WEBP, SVG)
  const isImage =
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|webp|svg)$/i.test(fileName);

  if (isImage) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image file data."));
      reader.readAsDataURL(file);
    });

    // Validate image loadability
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          reject(new Error("Image appears empty or corrupted."));
        } else {
          resolve();
        }
      };
      img.onerror = () => reject(new Error("Invalid or corrupted image format."));
      img.src = dataUrl;
    });

    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const baseProject = createBlankProject(baseName, "portrait");
    const bounds = getTrueCardBoundsInZone(baseProject);

    // Add image as front card artwork layer
    const imageObject: CardObject = {
      id: `img-preset-${Date.now()}`,
      name: `${baseName} (Card Artwork)`,
      type: "image",
      targetSide: "front",
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      rotation: 0,
      opacity: 1,
      zIndex: 1,
      locked: false,
      visible: true,
      aspectRatioLocked: true,
      flipX: false,
      flipY: false,
      src: dataUrl,
      fitMode: "contain",
    };

    baseProject.front.objects.push(imageObject);

    return {
      project: baseProject,
      name: baseName,
      description: `Custom artwork preset from ${file.name}`,
    };
  }

  throw new Error(
    "Unsupported file type. Please upload a valid .ocard project file or an image (PNG, JPG, SVG, WebP)."
  );
};
