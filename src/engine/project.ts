/**
 * OMNISCAN TITAN X - Project Packaging & Crash Recovery Engine
 * .titanproj Zip Archive Storage, Autosave Snapshots & Session Recovery
 */

import JSZip from "jszip";
import { OmniDocument, OmniPage } from "../types";

const RECOVERY_STORAGE_KEY = "titan_x_autosave_session";

/**
 * Save complete document as a portable .titanproj ZIP package
 */
export async function exportTitanProject(
  doc: OmniDocument,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  const zip = new JSZip();
  onProgress?.(0.1, "Packaging project manifest...");

  // Manifest containing full state, metadata, OCR, annotations, filters
  const manifest = {
    version: "2.5.0",
    name: doc.name,
    createdAt: doc.createdAt,
    updatedAt: new Date().toISOString(),
    metadata: doc.metadata,
    tags: doc.tags,
    pagesCount: doc.pages.length,
    pagesMetadata: doc.pages.map((p) => ({
      id: p.id,
      pageNumber: p.pageNumber,
      width: p.width,
      height: p.height,
      dpi: p.dpi,
      isBlank: p.isBlank,
      filters: p.filters,
      ocr: p.ocr,
      annotations: p.annotations,
      redactions: p.redactions,
      formFields: p.formFields,
      intelligence: p.intelligence,
    })),
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // Store page image assets
  const pagesFolder = zip.folder("pages");
  const total = doc.pages.length;

  for (let i = 0; i < total; i++) {
    const p = doc.pages[i];
    onProgress?.(
      0.15 + (i / total) * 0.75,
      `Archiving lossless source image for Page ${i + 1}...`
    );

    // Save original lossless source
    const origBase64 = p.originalDataUrl.replace(/^data:image\/\w+;base64,/, "");
    pagesFolder?.file(`page_${p.pageNumber}_orig.jpg`, origBase64, { base64: true });

    // Save processed render
    const procBase64 = p.processedDataUrl.replace(/^data:image\/\w+;base64,/, "");
    pagesFolder?.file(`page_${p.pageNumber}_proc.jpg`, procBase64, { base64: true });
  }

  onProgress?.(0.95, "Compressing Titan Project Archive...");
  const content = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  onProgress?.(1.0, "Package Ready!");
  return content;
}

/**
 * Import a .titanproj archive file and restore document
 */
export async function importTitanProject(
  file: File | Blob,
  onProgress?: (progress: number, message: string) => void
): Promise<OmniDocument> {
  onProgress?.(0.1, "Reading Titan archive...");
  const zip = await JSZip.loadAsync(file);

  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    throw new Error("Invalid .titanproj archive: manifest.json missing");
  }

  const manifestJson = await manifestFile.async("string");
  const manifest = JSON.parse(manifestJson);

  const pages: OmniPage[] = [];
  const total = manifest.pagesMetadata.length;

  for (let i = 0; i < total; i++) {
    const meta = manifest.pagesMetadata[i];
    onProgress?.(
      0.15 + (i / total) * 0.75,
      `Unpacking Page ${meta.pageNumber} images...`
    );

    const origFile = zip.file(`pages/page_${meta.pageNumber}_orig.jpg`);
    const procFile = zip.file(`pages/page_${meta.pageNumber}_proc.jpg`);

    let origUrl = "";
    let procUrl = "";

    if (origFile) {
      const b64 = await origFile.async("base64");
      origUrl = `data:image/jpeg;base64,${b64}`;
    }
    if (procFile) {
      const b64 = await procFile.async("base64");
      procUrl = `data:image/jpeg;base64,${b64}`;
    } else {
      procUrl = origUrl;
    }

    pages.push({
      id: meta.id,
      pageNumber: meta.pageNumber,
      originalDataUrl: origUrl,
      processedDataUrl: procUrl,
      thumbnailDataUrl: procUrl,
      width: meta.width,
      height: meta.height,
      dpi: meta.dpi || 300,
      sizeBytes: Math.round(procUrl.length * 0.75),
      isBlank: meta.isBlank || false,
      blankScore: meta.blankScore || 0,
      filters: meta.filters,
      ocr: meta.ocr,
      annotations: meta.annotations || [],
      redactions: meta.redactions || [],
      formFields: meta.formFields || [],
      intelligence: meta.intelligence,
      isModified: false,
      lastModifiedAt: new Date().toISOString(),
    });
  }

  onProgress?.(1.0, "Project Restored!");

  return {
    id: `doc-${Date.now()}`,
    name: manifest.name || "Imported Titan Project",
    createdAt: manifest.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pages,
    activePageIndex: 0,
    selectedPageIds: pages.length > 0 ? [pages[0].id] : [],
    metadata: manifest.metadata,
    tags: manifest.tags || ["Project"],
    isDirty: false,
  };
}

export const packageTitanProject = exportTitanProject;
export const extractTitanProject = importTitanProject;

/**
 * Save snapshot to localStorage for instant crash recovery
 */
export function saveAutosaveSnapshot(doc: OmniDocument): void {
  try {
    // Save lightweight version without full heavy base64 strings if space is tight
    const summary = {
      id: doc.id,
      name: doc.name,
      updatedAt: new Date().toISOString(),
      activePageIndex: doc.activePageIndex,
      pagesCount: doc.pages.length,
      metadata: doc.metadata,
      tags: doc.tags,
      pages: doc.pages.map((p) => ({
        id: p.id,
        pageNumber: p.pageNumber,
        width: p.width,
        height: p.height,
        dpi: p.dpi,
        filters: p.filters,
        ocr: p.ocr,
        annotations: p.annotations,
        redactions: p.redactions,
        formFields: p.formFields,
        intelligence: p.intelligence,
        // Include thumbnail data
        thumbnailDataUrl: p.thumbnailDataUrl,
        processedDataUrl: p.processedDataUrl.length < 500000 ? p.processedDataUrl : p.thumbnailDataUrl,
        originalDataUrl: p.originalDataUrl.length < 500000 ? p.originalDataUrl : p.thumbnailDataUrl,
      })),
    };
    localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(summary));
  } catch (e) {
    console.warn("Could not save localStorage snapshot (storage quota):", e);
  }
}

/**
 * Check if a crash recovery snapshot is available
 */
export function getAvailableRecoverySnapshot(): Partial<OmniDocument> | null {
  try {
    const raw = localStorage.getItem(RECOVERY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Clear recovery snapshot after clean save or reset
 */
export function clearRecoverySnapshot(): void {
  try {
    localStorage.removeItem(RECOVERY_STORAGE_KEY);
  } catch (e) {
    // Ignore
  }
}
