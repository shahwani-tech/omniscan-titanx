/**
 * Barcode and QR Code Generator for ID & Service Card Designer
 * Renders high-resolution vector/canvas representations for identity cards.
 */

import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { BarcodeType } from "./types";

/**
 * Generate QR Code as high-resolution Data URL (PNG)
 */
export async function generateQrCodeDataUrl(
  text: string,
  options?: {
    foregroundColor?: string;
    backgroundColor?: string;
    width?: number;
  }
): Promise<string> {
  const fg = options?.foregroundColor || "#000000";
  const bg = options?.backgroundColor || "#ffffff";
  const width = options?.width || 512;

  try {
    return await QRCode.toDataURL(text || "ID-VERIFICATION-SECURE", {
      width,
      margin: 1,
      color: {
        dark: fg,
        light: bg === "transparent" ? "#00000000" : bg,
      },
      errorCorrectionLevel: "H",
    });
  } catch (err) {
    console.error("Failed to generate QR code:", err);
    // Fallback simple 1x1 data URL
    return "";
  }
}

/**
 * Generate 1D Barcode as high-resolution Data URL (PNG)
 */
export function generateBarcodeDataUrl(
  value: string,
  format: BarcodeType = "code128",
  options?: {
    displayValue?: boolean;
    lineColor?: string;
    background?: string;
    height?: number;
  }
): string {
  try {
    const canvas = document.createElement("canvas");
    let jsFormat = "CODE128";
    if (format === "ean13") jsFormat = "EAN13";
    else if (format === "upc") jsFormat = "UPC";
    else if (format === "code39") jsFormat = "CODE39";

    const cleanValue = value ? value.trim() : "EMP-908241";

    JsBarcode(canvas, cleanValue, {
      format: jsFormat,
      displayValue: options?.displayValue ?? true,
      lineColor: options?.lineColor || "#000000",
      background: options?.background === "transparent" ? "#00000000" : options?.background || "#ffffff",
      fontSize: 14,
      font: "monospace",
      textMargin: 3,
      margin: 8,
      height: options?.height || 50,
      width: 2,
    });

    return canvas.toDataURL("image/png");
  } catch (err) {
    console.warn("Barcode generation error with specific format, falling back to CODE128:", err);
    try {
      const fallbackCanvas = document.createElement("canvas");
      JsBarcode(fallbackCanvas, value || "CARD-12345", {
        format: "CODE128",
        displayValue: options?.displayValue ?? true,
        height: options?.height || 50,
        margin: 8,
      });
      return fallbackCanvas.toDataURL("image/png");
    } catch {
      return "";
    }
  }
}
