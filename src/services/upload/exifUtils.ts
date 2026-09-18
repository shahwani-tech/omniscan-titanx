/**
 * OMNISCAN TITAN X - EXIF Orientation Extraction & Geometric Normalization
 * Reads EXIF Orientation tags (1-8) from JPEG binary data and applies
 * canonical Canvas 2D orientation transforms before any downstream processing.
 */

export interface ExifNormalizationResult {
  dataUrl: string;
  blob?: Blob;
  width: number;
  height: number;
  orientation: number;
  wasRotated: boolean;
}

/**
 * Extract EXIF Orientation Tag (1-8) from a JPEG ArrayBuffer.
 * Returns 1 (normal) if not found, not JPEG, or unoriented.
 */
export function getExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);

  // Check JPEG SOI (0xFFD8)
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) {
    return 1;
  }

  let offset = 2;
  const length = view.byteLength;

  while (offset < length) {
    // Prevent out-of-bounds
    if (offset + 4 > length) break;

    const marker = view.getUint16(offset, false);
    offset += 2;

    // Stop at Start of Scan (SOS) or End of Image (EOI)
    if (marker === 0xffda || marker === 0xffd9) {
      break;
    }

    // APP1 marker (0xFFE1) contains EXIF metadata
    if (marker === 0xffe1) {
      const app1Length = view.getUint16(offset, false);
      offset += 2;

      // Check for "Exif\0\0" header (0x45786966 0x0000)
      if (offset + 6 <= length) {
        const exifHeader = view.getUint32(offset, false);
        const exifZero = view.getUint16(offset + 4, false);

        if (exifHeader === 0x45786966 && exifZero === 0x0000) {
          const tiffStart = offset + 6;

          // Check TIFF byte order: 0x4949 ('II' Little Endian) or 0x4D4D ('MM' Big Endian)
          if (tiffStart + 8 <= length) {
            const byteOrder = view.getUint16(tiffStart, false);
            const isLittle = byteOrder === 0x4949;

            if (byteOrder === 0x4949 || byteOrder === 0x4d4d) {
              const magic = view.getUint16(tiffStart + 2, isLittle);
              if (magic === 42) {
                const ifd0Offset = view.getUint32(tiffStart + 4, isLittle);
                let entryOffset = tiffStart + ifd0Offset;

                if (entryOffset + 2 <= length) {
                  const numEntries = view.getUint16(entryOffset, isLittle);
                  entryOffset += 2;

                  for (let i = 0; i < numEntries; i++) {
                    if (entryOffset + 12 > length) break;

                    const tag = view.getUint16(entryOffset, isLittle);
                    // Orientation Tag ID = 0x0112 (274)
                    if (tag === 0x0112) {
                      const val = view.getUint16(entryOffset + 8, isLittle);
                      if (val >= 1 && val <= 8) {
                        return val;
                      }
                    }
                    entryOffset += 12;
                  }
                }
              }
            }
          }
        }
      }
      offset += app1Length - 2;
    } else {
      // Skip generic marker segment
      if (offset + 2 > length) break;
      const markerLength = view.getUint16(offset, false);
      offset += markerLength;
    }
  }

  return 1;
}

/**
 * Normalizes an image file or blob according to its EXIF orientation.
 * If the image requires rotation or flipping, it is redrawn to a Canvas 2D
 * context with the exact transformation applied.
 */
export async function normalizeImageExifOrientation(
  fileOrBlob: File | Blob
): Promise<ExifNormalizationResult> {
  const isJpeg =
    fileOrBlob.type === "image/jpeg" ||
    fileOrBlob.type === "image/jpg" ||
    (fileOrBlob instanceof File && /\.(jpe?g)$/i.test(fileOrBlob.name));

  let orientation = 1;

  if (isJpeg) {
    try {
      const buffer = await fileOrBlob.arrayBuffer();
      orientation = getExifOrientation(buffer);
    } catch (e) {
      console.warn("Could not read EXIF data:", e);
      orientation = 1;
    }
  }

  // Load image to retrieve dimensions and pixels
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed reading file to DataURL"));
    reader.readAsDataURL(fileOrBlob);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (e) => reject(e);
    image.src = rawDataUrl;
  });

  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;

  // Orientation 1 = Normal (no transformation needed)
  if (orientation <= 1) {
    return {
      dataUrl: rawDataUrl,
      width: naturalWidth,
      height: naturalHeight,
      orientation: 1,
      wasRotated: false,
    };
  }

  // Determine output canvas dimensions and transformation matrix
  // Orientations 5, 6, 7, 8 swap width and height
  const isTransposed = orientation >= 5 && orientation <= 8;
  const canvasWidth = isTransposed ? naturalHeight : naturalWidth;
  const canvasHeight = isTransposed ? naturalWidth : naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return {
      dataUrl: rawDataUrl,
      width: naturalWidth,
      height: naturalHeight,
      orientation,
      wasRotated: false,
    };
  }

  // Apply Canonical EXIF 1-8 2D Matrix Transforms
  switch (orientation) {
    case 2: // Flip Horizontal
      ctx.translate(canvasWidth, 0);
      ctx.scale(-1, 1);
      break;
    case 3: // Rotate 180°
      ctx.translate(canvasWidth, canvasHeight);
      ctx.rotate(Math.PI);
      break;
    case 4: // Flip Vertical
      ctx.translate(0, canvasHeight);
      ctx.scale(1, -1);
      break;
    case 5: // Transpose: Rotate 90° CW + Flip Horizontal
      ctx.scale(1, -1);
      ctx.rotate(-0.5 * Math.PI);
      break;
    case 6: // Rotate 90° CW (standard right-handed phone camera)
      ctx.translate(canvasWidth, 0);
      ctx.rotate(0.5 * Math.PI);
      break;
    case 7: // Transverse: Rotate 90° CCW + Flip Horizontal
      ctx.translate(canvasWidth, canvasHeight);
      ctx.scale(-1, 1);
      ctx.rotate(0.5 * Math.PI);
      break;
    case 8: // Rotate 90° CCW / 270° CW (left-handed phone camera)
      ctx.translate(0, canvasHeight);
      ctx.rotate(-0.5 * Math.PI);
      break;
  }

  ctx.drawImage(img, 0, 0);

  const isPng =
    fileOrBlob.type === "image/png" ||
    (fileOrBlob instanceof File && /\.png$/i.test(fileOrBlob.name)) ||
    rawDataUrl.startsWith("data:image/png");

  const correctedDataUrl = isPng
    ? canvas.toDataURL("image/png")
    : canvas.toDataURL("image/jpeg", 0.95);

  return {
    dataUrl: correctedDataUrl,
    width: canvasWidth,
    height: canvasHeight,
    orientation,
    wasRotated: true,
  };
}
