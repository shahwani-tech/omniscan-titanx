/**
 * OMNISCAN TITAN X - Background Color Utilities
 * Comprehensive Color Conversion (HEX, RGB, HSL), Preset Management & Storage
 */

import { ColorRGB, ColorHSL } from "./types";

export function isValidHex(hex: string): boolean {
  return /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(hex.trim());
}

export function normalizeHex(hex: string, fallback = "#FFFFFF"): string {
  let clean = hex.trim();
  if (!clean.startsWith("#")) clean = "#" + clean;
  if (/^#[A-Fa-f0-9]{3}$/.test(clean)) {
    const r = clean[1];
    const g = clean[2];
    const b = clean[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^#[A-Fa-f0-9]{6}$/.test(clean)) {
    return clean.toUpperCase();
  }
  return fallback;
}

export function hexToRgb(hex: string): ColorRGB {
  const norm = normalizeHex(hex);
  const r = parseInt(norm.slice(1, 3), 16);
  const g = parseInt(norm.slice(3, 5), 16);
  const b = parseInt(norm.slice(5, 7), 16);
  return {
    r: isNaN(r) ? 255 : r,
    g: isNaN(g) ? 255 : g,
    b: isNaN(b) ? 255 : b,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const cr = Math.max(0, Math.min(255, Math.round(r)));
  const cg = Math.max(0, Math.min(255, Math.round(g)));
  const cb = Math.max(0, Math.min(255, Math.round(b)));
  return (
    "#" +
    cr.toString(16).padStart(2, "0") +
    cg.toString(16).padStart(2, "0") +
    cb.toString(16).padStart(2, "0")
  ).toUpperCase();
}

export function rgbToHsl(r: number, g: number, b: number): ColorHSL {
  const normR = Math.max(0, Math.min(255, r)) / 255;
  const normG = Math.max(0, Math.min(255, g)) / 255;
  const normB = Math.max(0, Math.min(255, b)) / 255;

  const max = Math.max(normR, normG, normB);
  const min = Math.min(normR, normG, normB);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case normR:
        h = (normG - normB) / d + (normG < normB ? 6 : 0);
        break;
      case normG:
        h = (normB - normR) / d + 2;
        break;
      case normB:
        h = (normR - normG) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToRgb(h: number, s: number, l: number): ColorRGB {
  const normH = ((h % 360) + 360) % 360 / 360;
  const normS = Math.max(0, Math.min(100, s)) / 100;
  const normL = Math.max(0, Math.min(100, l)) / 100;

  if (normS === 0) {
    const val = Math.round(normL * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let nt = t;
    if (nt < 0) nt += 1;
    if (nt > 1) nt -= 1;
    if (nt < 1 / 6) return p + (q - p) * 6 * nt;
    if (nt < 1 / 2) return q;
    if (nt < 2 / 3) return p + (q - p) * (2 / 3 - nt) * 6;
    return p;
  };

  const q = normL < 0.5 ? normL * (1 + normS) : normL + normS - normL * normS;
  const p = 2 * normL - q;

  const r = Math.round(hue2rgb(p, q, normH + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, normH) * 255);
  const b = Math.round(hue2rgb(p, q, normH - 1 / 3) * 255);

  return { r, g, b };
}

export function hslToHex(h: number, s: number, l: number): string {
  const rgb = hslToRgb(h, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

// -------------------------------------------------------------
// Preset Colors Palette
// -------------------------------------------------------------
export const PRESET_BACKGROUND_COLORS = [
  { label: "Pure White", hex: "#FFFFFF", desc: "ICAO Official White" },
  { label: "Embassy Blue", hex: "#E0F2FE", desc: "Consular Light Blue" },
  { label: "Deep Royal Blue", hex: "#1D4ED8", desc: "Formal Badge Blue" },
  { label: "Light Gray", hex: "#F3F4F6", desc: "High-Key Gray" },
  { label: "Consular Cream", hex: "#FAFAF9", desc: "Warm Ivory" },
  { label: "Studio Slate", hex: "#475569", desc: "Neutral Medium Gray" },
  { label: "Dark Gray", hex: "#1F2937", desc: "Charcoal Studio" },
  { label: "Obsidian Black", hex: "#0B0F17", desc: "Deep Black" },
  { label: "Crimson Red", hex: "#BE123C", desc: "Vibrant Studio Red" },
  { label: "Emerald Green", hex: "#047857", desc: "Corporate Green" },
];

const RECENT_COLORS_STORAGE_KEY = "omniscan_recent_bg_colors";
const MAX_RECENT_COLORS = 12;

export function getRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_COLORS_STORAGE_KEY);
    if (!raw) return ["#FFFFFF", "#E0F2FE", "#F3F4F6", "#FAFAF9"];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((c) => typeof c === "string" && isValidHex(c)).slice(0, MAX_RECENT_COLORS);
    }
  } catch {
    // fallback
  }
  return ["#FFFFFF", "#E0F2FE", "#F3F4F6", "#FAFAF9"];
}

export function addRecentColor(hex: string): string[] {
  const norm = normalizeHex(hex);
  const current = getRecentColors().filter((c) => c.toUpperCase() !== norm.toUpperCase());
  const updated = [norm, ...current].slice(0, MAX_RECENT_COLORS);
  try {
    localStorage.setItem(RECENT_COLORS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}
