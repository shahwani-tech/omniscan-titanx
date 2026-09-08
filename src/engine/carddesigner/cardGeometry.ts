/**
 * cardGeometry.ts
 * 
 * Precise coordinate geometry for standard ID-1/CR-80 and custom card boundaries:
 * - Computes true card cut-line bounds relative to sheet zones
 * - Computes relative object positions against the true card boundary
 * - Alignment and distribution mathematics
 */

import { CardDesignerProject, CardObject } from "./types";

export interface TrueCardBounds {
  x: number; // mm relative to the zone top-left
  y: number; // mm relative to the zone top-left
  width: number; // mm
  height: number; // mm
  right: number; // mm
  bottom: number; // mm
  centerX: number; // mm
  centerY: number; // mm
}

/**
 * Get effective width and height of the true card boundary based on orientation.
 */
export function getTrueCardDimensions(project: CardDesignerProject): { widthMm: number; heightMm: number } {
  let w = project.trueCardWidthMm || 85.6;
  let h = project.trueCardHeightMm || 54.0;

  if (project.trueCardOrientation === "portrait") {
    if (w > h) {
      const temp = w;
      w = h;
      h = temp;
    }
  } else {
    // Landscape
    if (h > w) {
      const temp = w;
      w = h;
      h = temp;
    }
  }

  return { widthMm: w, heightMm: h };
}

/**
 * Get the exact rectangle of the true card boundary within each card zone (Front or Back).
 */
export function getTrueCardBoundsInZone(project: CardDesignerProject): TrueCardBounds {
  const { widthMm, heightMm } = getTrueCardDimensions(project);

  const zoneWidth = project.cardWidthMm || 105;
  const zoneHeight = project.cardHeightMm || 74;

  const x = Math.max(0, Math.round(((zoneWidth - widthMm) / 2) * 100) / 100);
  const y = Math.max(0, Math.round(((zoneHeight - heightMm) / 2) * 100) / 100);

  return {
    x,
    y,
    width: widthMm,
    height: heightMm,
    right: x + widthMm,
    bottom: y + heightMm,
    centerX: x + widthMm / 2,
    centerY: y + heightMm / 2,
  };
}

/**
 * Calculate object coordinates relative to the true card cut-line.
 */
export function getObjectCardRelativeCoords(
  obj: CardObject,
  project: CardDesignerProject
): { relX: number; relY: number; width: number; height: number } {
  const cardBounds = getTrueCardBoundsInZone(project);
  const relX = Math.round((obj.x - cardBounds.x) * 10) / 10;
  const relY = Math.round((obj.y - cardBounds.y) * 10) / 10;

  return {
    relX,
    relY,
    width: Math.round(obj.width * 10) / 10,
    height: Math.round(obj.height * 10) / 10,
  };
}

/**
 * Convert relative card coordinates to zone coordinates.
 */
export function zoneCoordsFromCardRelative(
  relX: number,
  relY: number,
  project: CardDesignerProject
): { x: number; y: number } {
  const cardBounds = getTrueCardBoundsInZone(project);
  return {
    x: Math.round((cardBounds.x + relX) * 10) / 10,
    y: Math.round((cardBounds.y + relY) * 10) / 10,
  };
}

/**
 * Align an object relative to the true card cut-line boundary.
 */
export function alignObjectToCardBoundary(
  obj: CardObject,
  alignment:
    | "center-both"
    | "center-h"
    | "center-v"
    | "left"
    | "right"
    | "top"
    | "bottom",
  project: CardDesignerProject
): Partial<CardObject> {
  const card = getTrueCardBoundsInZone(project);

  let newX = obj.x;
  let newY = obj.y;

  switch (alignment) {
    case "center-both":
      newX = card.x + (card.width - obj.width) / 2;
      newY = card.y + (card.height - obj.height) / 2;
      break;
    case "center-h":
      newX = card.x + (card.width - obj.width) / 2;
      break;
    case "center-v":
      newY = card.y + (card.height - obj.height) / 2;
      break;
    case "left":
      newX = card.x;
      break;
    case "right":
      newX = card.right - obj.width;
      break;
    case "top":
      newY = card.y;
      break;
    case "bottom":
      newY = card.bottom - obj.height;
      break;
  }

  return {
    x: Math.round(newX * 10) / 10,
    y: Math.round(newY * 10) / 10,
  };
}

/**
 * Distribute 3+ objects with equal spacing along horizontal or vertical axis.
 */
export function distributeObjectsEvenly(
  objects: CardObject[],
  axis: "horizontal" | "vertical"
): Array<{ id: string; x?: number; y?: number }> {
  if (objects.length < 3) return [];

  const sorted = [...objects].sort((a, b) => (axis === "horizontal" ? a.x - b.x : a.y - b.y));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const totalSpan = axis === "horizontal"
    ? (last.x + last.width) - first.x
    : (last.y + last.height) - first.y;

  const totalObjectSpan = sorted.reduce(
    (sum, o) => sum + (axis === "horizontal" ? o.width : o.height),
    0
  );

  const availableGap = totalSpan - totalObjectSpan;
  const gap = availableGap / (sorted.length - 1);

  let currentPos = axis === "horizontal" ? first.x : first.y;
  const results: Array<{ id: string; x?: number; y?: number }> = [];

  sorted.forEach((obj, idx) => {
    if (idx === 0) {
      currentPos += (axis === "horizontal" ? obj.width : obj.height) + gap;
      return;
    }
    if (idx === sorted.length - 1) return;

    if (axis === "horizontal") {
      results.push({ id: obj.id, x: Math.round(currentPos * 10) / 10 });
      currentPos += obj.width + gap;
    } else {
      results.push({ id: obj.id, y: Math.round(currentPos * 10) / 10 });
      currentPos += obj.height + gap;
    }
  });

  return results;
}
