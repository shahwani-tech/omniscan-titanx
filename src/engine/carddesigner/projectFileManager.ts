/**
 * projectFileManager.ts
 * 
 * Native Project File Management for OMNISCAN ID & Service Card Designer:
 * - Native structured format (.ocard, .omniscanproj, .json)
 * - Self-contained portable storage (embeds all vectors, fonts, images, dimensions, layers)
 * - Backwards-compatibility normalizer for past and future versions
 */

import { CardDesignerProject, OCardProjectFile } from "./types";

export const PROJECT_FILE_EXTENSION = ".ocard";
export const COMPATIBLE_EXTENSIONS = [".ocard", ".omniscanproj", ".json"];

/**
 * Save and download the current project as a native .ocard project file.
 */
export function saveProjectToDisk(project: CardDesignerProject): void {
  const fileData: OCardProjectFile = {
    format: "omniscan-card-project",
    version: "2.0.0",
    app: "OMNISCAN PRO ULTRA",
    exportedAt: new Date().toISOString(),
    project: {
      ...project,
      updatedAt: Date.now(),
    },
  };

  const jsonString = JSON.stringify(fileData, null, 2);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const sanitizedName = (project.name || "card-design")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizedName || "card-design"}${PROJECT_FILE_EXTENSION}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Parse and normalize a project file string into a valid CardDesignerProject.
 * Handles schema upgrades and version backwards-compatibility seamlessly.
 */
export function parseProjectJson(rawText: string): CardDesignerProject {
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error("Invalid project file: Not a valid JSON structure.");
  }

  // Extract project payload if wrapped in OCardProjectFile envelope
  let proj: any = parsed;
  if (parsed && typeof parsed === "object" && parsed.project) {
    proj = parsed.project;
  }

  // Basic validation
  if (!proj || typeof proj !== "object") {
    throw new Error("Invalid project file: Project object missing or corrupted.");
  }

  if (!proj.front || !Array.isArray(proj.front.objects)) {
    throw new Error("Invalid project file: Front card structure missing or corrupted.");
  }

  if (!proj.back || !Array.isArray(proj.back.objects)) {
    throw new Error("Invalid project file: Back card structure missing or corrupted.");
  }

  // Normalization with backwards compatibility defaults
  const isPortrait = proj.orientation === "portrait";
  const pageWidthMm = proj.pageWidthMm || (isPortrait ? 105 : 148);
  const pageHeightMm = proj.pageHeightMm || (isPortrait ? 148 : 105);

  const trueCardWidthMm = typeof proj.trueCardWidthMm === "number" && proj.trueCardWidthMm > 0
    ? proj.trueCardWidthMm
    : 85.6; // Standard CR-80 width (85.6 mm)

  const trueCardHeightMm = typeof proj.trueCardHeightMm === "number" && proj.trueCardHeightMm > 0
    ? proj.trueCardHeightMm
    : 54.0; // Standard CR-80 height (54.0 mm)

  const normalizedProject: CardDesignerProject = {
    id: proj.id || `card-proj-${Date.now()}`,
    name: proj.name || "Imported Card Design",
    createdAt: proj.createdAt || Date.now(),
    updatedAt: Date.now(),
    pageFormat: proj.pageFormat || "A6",
    orientation: proj.orientation || "portrait",
    pageWidthMm,
    pageHeightMm,
    cardWidthMm: proj.cardWidthMm || (isPortrait ? 105 : 105),
    cardHeightMm: proj.cardHeightMm || (isPortrait ? 74 : 74),

    // Exact card boundary specifications
    trueCardWidthMm,
    trueCardHeightMm,
    trueCardOrientation: proj.trueCardOrientation || (trueCardWidthMm >= trueCardHeightMm ? "landscape" : "portrait"),
    cardPreset: proj.cardPreset || (Math.abs(trueCardWidthMm - 85.6) < 0.5 ? "id1_cr80" : "custom"),
    showCardBoundary: proj.showCardBoundary !== false,
    showBleedShading: proj.showBleedShading !== false,
    cardCornerRadiusMm: typeof proj.cardCornerRadiusMm === "number" ? proj.cardCornerRadiusMm : 3.18,

    frontPosMm: proj.frontPosMm || (isPortrait
      ? { x: 0, y: 0 }
      : { x: 5, y: Math.max(0, (pageHeightMm - 74) / 2) }),

    backPosMm: proj.backPosMm || (isPortrait
      ? { x: 0, y: 74 }
      : { x: 5 + 105 + 8, y: Math.max(0, (pageHeightMm - 74) / 2) }),

    safeAreaMarginMm: typeof proj.safeAreaMarginMm === "number" ? proj.safeAreaMarginMm : 3,
    bleedMarginMm: typeof proj.bleedMarginMm === "number" ? proj.bleedMarginMm : 2,
    cuttingGuides: proj.cuttingGuides !== false,
    showBleed: !!proj.showBleed,
    showSafeArea: proj.showSafeArea !== false,
    showRulers: proj.showRulers !== false,
    showGrid: !!proj.showGrid,
    snapToGrid: proj.snapToGrid !== false,
    snapToObjects: proj.snapToObjects !== false,
    snapToCardBoundary: proj.snapToCardBoundary !== false,
    gridSizeMm: typeof proj.gridSizeMm === "number" ? proj.gridSizeMm : 2,

    guides: proj.guides || {
      horizontal: [],
      vertical: [],
    },

    front: {
      background: proj.front.background || { type: "solid", color1: "#ffffff" },
      objects: proj.front.objects.map(normalizeObject),
    },

    back: {
      background: proj.back.background || { type: "solid", color1: "#ffffff" },
      objects: proj.back.objects.map(normalizeObject),
    },
  };

  return normalizedProject;
}

function normalizeObject(obj: any): any {
  return {
    ...obj,
    id: obj.id || `obj-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name: obj.name || "Object",
    x: typeof obj.x === "number" ? obj.x : 0,
    y: typeof obj.y === "number" ? obj.y : 0,
    width: typeof obj.width === "number" ? obj.width : 20,
    height: typeof obj.height === "number" ? obj.height : 20,
    rotation: typeof obj.rotation === "number" ? obj.rotation : 0,
    opacity: typeof obj.opacity === "number" ? obj.opacity : 1,
    zIndex: typeof obj.zIndex === "number" ? obj.zIndex : 1,
    visible: obj.visible !== false,
    locked: !!obj.locked,
    aspectRatioLocked: !!obj.aspectRatioLocked,
    flipX: !!obj.flipX,
    flipY: !!obj.flipY,
    blendMode: obj.blendMode || "normal",
  };
}

/**
 * Open file picker dialog to let the user select a .ocard or .omniscanproj project.
 */
export function openProjectFileDialog(): Promise<CardDesignerProject> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ocard,.omniscanproj,.json,application/json";

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) {
        reject(new Error("No file selected."));
        return;
      }

      const file = target.files[0];
      try {
        const text = await file.text();
        const project = parseProjectJson(text);
        resolve(project);
      } catch (err: any) {
        reject(new Error(`Failed to load project "${file.name}": ${err.message}`));
      }
    };

    input.click();
  });
}
