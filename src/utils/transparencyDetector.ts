/**
 * OMNISCAN TITAN X - Transparency & Alpha Channel Detection Utility
 * Fast, non-destructive canvas pixel analysis to check for existing transparent areas.
 */

export interface TransparencyCheckResult {
  hasTransparency: boolean;
  transparentPixelCount: number;
  totalSampledPixels: number;
  transparencyPercentage: number;
  isPng: boolean;
}

export async function detectImageTransparency(imageUrlOrDataUrl: string): Promise<TransparencyCheckResult> {
  const fallbackResult: TransparencyCheckResult = {
    hasTransparency: false,
    transparentPixelCount: 0,
    totalSampledPixels: 0,
    transparencyPercentage: 0,
    isPng: false,
  };

  if (!imageUrlOrDataUrl || typeof imageUrlOrDataUrl !== "string") {
    return fallbackResult;
  }

  const isPng =
    imageUrlOrDataUrl.startsWith("data:image/png") ||
    /\.png(\?.*)?$/i.test(imageUrlOrDataUrl);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const maxDimension = 200;
        let w = img.naturalWidth || img.width || 100;
        let h = img.naturalHeight || img.height || 100;

        if (w > maxDimension || h > maxDimension) {
          const ratio = maxDimension / Math.max(w, h);
          w = Math.max(1, Math.round(w * ratio));
          h = Math.max(1, Math.round(h * ratio));
        }

        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve({ ...fallbackResult, isPng });
          return;
        }

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        let transparentCount = 0;
        const totalPixels = w * h;

        // Check the alpha channel (every 4th byte)
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 250) {
            transparentCount++;
          }
        }

        // Deem transparent if > 0.5% of pixels have alpha < 250
        const percentage = Math.round((transparentCount / totalPixels) * 100);
        const hasTransparency = transparentCount > totalPixels * 0.005;

        resolve({
          hasTransparency,
          transparentPixelCount: transparentCount,
          totalSampledPixels: totalPixels,
          transparencyPercentage: percentage,
          isPng,
        });
      } catch (err) {
        console.warn("Transparency analysis failed, falling back to false:", err);
        resolve({ ...fallbackResult, isPng });
      }
    };

    img.onerror = () => {
      resolve({ ...fallbackResult, isPng });
    };

    img.src = imageUrlOrDataUrl;
  });
}
