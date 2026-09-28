/**
 * OMNISCAN TITAN X - Multi-Person Photo Layout Engine
 * Supports splitting any print sheet into multiple person groups with custom slot allocations,
 * color coding, alternating/grouped/custom arrangements, slot validation, and session persistence.
 */

import { pageBlobStore } from "../services/storage/PageBlobStore";
import type { BackgroundStudioState } from "./background/types";

export type PersonPhotoStatus = "no-photo" | "uploaded" | "cropped" | "needs-background" | "ready";
export type MultiPersonLayoutMode = "grouped" | "alternating" | "custom";

export interface MultiPersonSlotGroup {
  id: string; // e.g. "person-1", "person-2"
  label: string; // e.g. "Person 1", "Person 2", or user custom name
  slotCount: number; // min: 0, max: sheet capacity (new persons start at 0)
  color: string; // Distinct border / tag color
  photoUrl: string | null; // Final photo URL
  rawPhotoUrl?: string | null; // Original uncropped photo
  croppedPhotoUrl?: string | null; // Cropped photo
  compositedPhotoUrl?: string | null; // Composited photo with independent background
  croppedBlobId?: string | null; // Unique storage ID for cropped blob
  compositedBlobId?: string | null; // Unique storage ID for composited blob
  bgStudioState?: BackgroundStudioState | null; // Independent Background Studio state
  cropWidth?: number; // Exact crop width in pixels (e.g. 413)
  cropHeight?: number; // Exact crop height in pixels (e.g. 531)
  cropState?: any;
  status: PersonPhotoStatus;
}

/**
 * STRICT PRIORITY photo resolver for a person.
 * Ensures composited photo (photo + background) is ALWAYS prioritized over cropped.
 * STRICT CROP ENFORCEMENT: Never falls back to rawPhotoUrl for printing!
 */
export function getPersonPrintImage(person: MultiPersonSlotGroup): string | null {
  if (person.compositedPhotoUrl) {
    return person.compositedPhotoUrl;
  }
  if (person.croppedPhotoUrl) {
    return person.croppedPhotoUrl;
  }
  // Allow photoUrl only if it is a processed/cropped photo (not the raw uncropped original)
  if (person.photoUrl && person.photoUrl !== person.rawPhotoUrl) {
    return person.photoUrl;
  }
  // STRICT: Do NOT return rawPhotoUrl. Uncropped raw photos must never appear on print sheet.
  return null;
}

export interface SlotAssignment {
  slotIndex: number;
  personId: string;
  personLabel: string;
}

/**
 * Builds explicit slot-by-slot assignments for all slots on the sheet.
 */
export function buildSlotAssignments(
  persons: MultiPersonSlotGroup[],
  totalCapacity: number,
  mode: MultiPersonLayoutMode = "grouped",
  customAssignments?: string[]
): SlotAssignment[] {
  const assignments: SlotAssignment[] = [];
  if (persons.length === 0 || totalCapacity <= 0) return assignments;

  const personMap = new Map<string, MultiPersonSlotGroup>();
  persons.forEach((p) => personMap.set(p.id, p));

  if (mode === "custom" && customAssignments && customAssignments.length > 0) {
    for (let i = 0; i < totalCapacity; i++) {
      const pid = customAssignments[i] || "empty";
      const p = personMap.get(pid);
      assignments.push({
        slotIndex: i,
        personId: pid,
        personLabel: p ? p.label : pid === "empty" ? "Unassigned" : pid,
      });
    }
    return assignments;
  }

  if (mode === "alternating") {
    const remainingCounts = new Map<string, number>();
    persons.forEach((p) => remainingCounts.set(p.id, Math.max(0, p.slotCount)));

    let slotIdx = 0;
    while (slotIdx < totalCapacity) {
      let anyAssigned = false;
      for (const p of persons) {
        const rem = remainingCounts.get(p.id) || 0;
        if (rem > 0 && slotIdx < totalCapacity) {
          assignments.push({
            slotIndex: slotIdx,
            personId: p.id,
            personLabel: p.label,
          });
          remainingCounts.set(p.id, rem - 1);
          slotIdx++;
          anyAssigned = true;
        }
      }
      if (!anyAssigned) break;
    }

    while (slotIdx < totalCapacity) {
      assignments.push({
        slotIndex: slotIdx,
        personId: "empty",
        personLabel: "Unassigned",
      });
      slotIdx++;
    }
    return assignments;
  }

  // Default: "grouped" mode
  let slotIdx = 0;
  for (const p of persons) {
    const count = Math.max(0, p.slotCount);
    for (let i = 0; i < count && slotIdx < totalCapacity; i++) {
      assignments.push({
        slotIndex: slotIdx,
        personId: p.id,
        personLabel: p.label,
      });
      slotIdx++;
    }
  }

  while (slotIdx < totalCapacity) {
    assignments.push({
      slotIndex: slotIdx,
      personId: "empty",
      personLabel: "Unassigned",
    });
    slotIdx++;
  }

  return assignments;
}

/**
 * Check if a person has a valid photo ready for sheet preview or printing.
 * A person is ready ONLY if they have a final composited photo or a cropped photo.
 * Raw uncropped photos NEVER count as ready for print.
 */
export function isPersonReady(person: MultiPersonSlotGroup): boolean {
  return !!(
    person.compositedPhotoUrl ||
    person.croppedPhotoUrl ||
    (person.photoUrl && person.photoUrl !== person.rawPhotoUrl)
  );
}

/**
 * Compute the specific status tag for UI badges:
 * - "no-photo": no photo at all (🔴 "Upload photo")
 * - "uploaded": uploaded not cropped (🟡 "Crop needed")
 * - "needs-background": cropped or photo present, but background not applied (🟡 "BG not set")
 * - "ready": composited with background or fully ready (🟢 "Ready ✓")
 */
export function getPersonStatus(person: MultiPersonSlotGroup): PersonPhotoStatus {
  if (person.compositedPhotoUrl || person.bgStudioState?.foregroundImage) {
    return "ready";
  }
  if (
    person.croppedPhotoUrl ||
    (person.photoUrl && person.photoUrl !== person.rawPhotoUrl)
  ) {
    return "needs-background";
  }
  if (person.rawPhotoUrl) {
    return "uploaded";
  }
  return "no-photo";
}

export interface MultiPersonState {
  enabled: boolean;
  mode: MultiPersonLayoutMode;
  persons: MultiPersonSlotGroup[];
  customSlotAssignments: string[]; // slot index -> personId or 'empty'
  showPersonLabelsOnSheet: boolean;
  showSlotOverlaysOnPreview: boolean;
  selectedSlotIndex: number | null;
}

// Dynamic max persons per sheet equals total sheet slots (A6/6x4=8, A4=30, A3=66)
export const MAX_PERSONS_PER_SHEET = 66;

export function getMaxPersonsAllowed(totalSheetSlots: number): number {
  return Math.max(1, totalSheetSlots);
}

export const PERSON_PALETTE = [
  "#0284C7", // 1: Sky Blue
  "#10B981", // 2: Emerald Green
  "#F59E0B", // 3: Amber Orange
  "#8B5CF6", // 4: Violet / Purple
  "#EC4899", // 5: Pink / Rose
  "#06B6D4", // 6: Cyan
  "#6366F1", // 7: Indigo
  "#84CC16", // 8: Lime
  "#D946EF", // 9: Fuchsia
  "#14B8A6", // 10: Teal
  "#EF4444", // 11: Red
  "#3B82F6", // 12: Blue
  "#22C55E", // 13: Green
  "#EAB308", // 14: Yellow
  "#A855F7", // 15: Purple
  "#F43F5E", // 16: Rose
  "#0EA5E9", // 17: Light Blue
  "#10B981", // 18: Mint
  "#F97316", // 19: Orange
  "#6366F1", // 20: Royal Indigo
  "#65A30D", // 21: Olive Lime
  "#C026D3", // 22: Magenta
  "#0D9488", // 23: Deep Teal
  "#DC2626", // 24: Crimson
  "#2563EB", // 25: Cobalt
  "#16A34A", // 26: Forest Green
  "#CA8A04", // 27: Gold
  "#9333EA", // 28: Amethyst
  "#E11D48", // 29: Ruby
  "#0891B2", // 30: Cerulean
];

export function getPersonColor(index: number): string {
  return PERSON_PALETTE[index % PERSON_PALETTE.length];
}

/**
 * Concurrency-limited image loader for multi-person print sheets.
 * Prevents 30+ simultaneous image loads from overwhelming the browser.
 */
export async function buildImageElements(
  persons: MultiPersonSlotGroup[],
  loadImgFn: (url: string) => Promise<HTMLImageElement>
): Promise<Record<string, HTMLImageElement>> {
  const BATCH_SIZE = 5;
  const elements: Record<string, HTMLImageElement> = {};

  for (let i = 0; i < persons.length; i += BATCH_SIZE) {
    const batch = persons.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (person) => {
        if (!isPersonReady(person)) return;
        const imgUrl = getPersonPrintImage(person);
        if (!imgUrl) return;
        try {
          const img = await loadImgFn(imgUrl);
          if (img) elements[person.id] = img;
        } catch (err) {
          console.warn("Failed to load image for person:", person.id, err);
        }
      })
    );
  }

  return elements;
}

/**
 * Distribute totalCapacity equally among numPersons.
 * If totalCapacity % numPersons !== 0, extra remainder slots are given to first persons.
 */
export function computeEqualSplit(totalCapacity: number, numPersons: number): number[] {
  if (numPersons <= 0) return [];
  const base = Math.floor(totalCapacity / numPersons);
  const remainder = totalCapacity % numPersons;
  const counts: number[] = [];
  for (let i = 0; i < numPersons; i++) {
    counts.push(base + (i < remainder ? 1 : 0));
  }
  return counts;
}

/**
 * Generate slot mapping array (length = totalCapacity) according to the selected layout mode.
 * Each slot contains personId or 'empty'.
 */
export function generateSlotMapping(
  mode: MultiPersonLayoutMode,
  persons: MultiPersonSlotGroup[],
  totalCapacity: number,
  customAssignments?: string[]
): string[] {
  const mapping: string[] = new Array(totalCapacity).fill("empty");
  if (persons.length === 0 || totalCapacity <= 0) return mapping;

  if (mode === "custom" && customAssignments && customAssignments.length > 0) {
    for (let i = 0; i < totalCapacity; i++) {
      if (i < customAssignments.length) {
        mapping[i] = customAssignments[i] || "empty";
      }
    }
    return mapping;
  }

  if (mode === "alternating") {
    // Interleaved distribution according to each person's slot count
    const remainingCounts = new Map<string, number>();
    persons.forEach((p) => remainingCounts.set(p.id, Math.max(0, p.slotCount)));

    let slotIdx = 0;
    while (slotIdx < totalCapacity) {
      let anyAssignedInCycle = false;
      for (const p of persons) {
        const remaining = remainingCounts.get(p.id) || 0;
        if (remaining > 0 && slotIdx < totalCapacity) {
          mapping[slotIdx] = p.id;
          remainingCounts.set(p.id, remaining - 1);
          slotIdx++;
          anyAssignedInCycle = true;
        }
      }
      if (!anyAssignedInCycle) break;
    }
    return mapping;
  }

  // Default: "grouped" mode
  // Place all of Person A, then Person B, etc.
  let currentIdx = 0;
  for (const p of persons) {
    for (let i = 0; i < p.slotCount && currentIdx < totalCapacity; i++) {
      mapping[currentIdx] = p.id;
      currentIdx++;
    }
  }

  return mapping;
}

/**
 * Validate slot counts against sheet capacity.
 */
export function validateSlotCounts(persons: MultiPersonSlotGroup[], maxCapacity: number) {
  const totalAssigned = persons.reduce((sum, p) => sum + Math.max(0, p.slotCount), 0);
  const remainingSlots = Math.max(0, maxCapacity - totalAssigned);
  const exceeds = totalAssigned > maxCapacity;
  return {
    valid: !exceeds,
    totalAssigned,
    remainingSlots,
    maxCapacity,
    exceeds,
    message: exceeds
      ? `Only ${maxCapacity} slots available on this sheet. Current total is ${totalAssigned}.`
      : remainingSlots > 0
      ? `${remainingSlots} slot${remainingSlots > 1 ? "s" : ""} unassigned (will print blank)`
      : `All ${maxCapacity} slots assigned`,
  };
}

/**
 * Proportional scaling when paper capacity changes (e.g. A4 -> A6).
 * Ensures at least 1 slot per person as long as totalCapacity >= numPersons.
 */
export function scaleSlotAssignments(
  persons: MultiPersonSlotGroup[],
  newCapacity: number
): MultiPersonSlotGroup[] {
  if (persons.length === 0) return [];
  if (newCapacity < persons.length) {
    return persons.slice(0, newCapacity).map((p) => ({ ...p, slotCount: 1 }));
  }

  const currentTotal = persons.reduce((sum, p) => sum + p.slotCount, 0);
  if (currentTotal === 0) {
    const equalCounts = computeEqualSplit(newCapacity, persons.length);
    return persons.map((p, idx) => ({ ...p, slotCount: equalCounts[idx] || 1 }));
  }

  let allocated = 0;
  const scaled = persons.map((p) => {
    const ratio = p.slotCount / currentTotal;
    const count = Math.max(1, Math.floor(ratio * newCapacity));
    allocated += count;
    return { ...p, slotCount: count };
  });

  // Distribute any remaining slots up to newCapacity
  let remaining = newCapacity - allocated;
  let idx = 0;
  while (remaining > 0) {
    scaled[idx % scaled.length].slotCount++;
    remaining--;
    idx++;
  }

  return scaled;
}

// -------------------------------------------------------------
// Session Persistence (Single-Use Isolation: Always start fresh)
// -------------------------------------------------------------
const SESSION_STORAGE_KEY = "OMNISCAN_MULTI_PERSON_LAYOUT_SESSION";

/**
 * Clean up all session storage data for multi-person layout.
 */
export function clearMultiPersonSession(): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    // ignore
  }
}

/**
 * Passport photo sessions are single-use by design.
 * We do not persist person photos or session data between tool openings.
 */
export async function saveMultiPersonSession(_state: MultiPersonState): Promise<void> {
  // Deliberately no-op to ensure clean, isolated single-use sessions without stale bleed.
  return;
}

/**
 * Always returns null to ensure a clean, fresh session on open.
 */
export function loadMultiPersonSession(): Partial<MultiPersonState> | null {
  clearMultiPersonSession();
  return null;
}
