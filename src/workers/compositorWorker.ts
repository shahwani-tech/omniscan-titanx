/**
 * OMNISCAN TITAN X - Dedicated Canvas Compositor Web Worker
 * Performs multi-layer compositing, layer transforms, and adjustment filters
 * using OffscreenCanvas off the main thread.
 */

self.onmessage = async (event: MessageEvent) => {
  const { id, type, options, width, height, bgBitmap, fgBitmap, bgMode, bgColor, bgGradient, bgTransform, fgTransform } = event.data;

  if (type !== "COMPOSITE") return;

  try {
    if (typeof OffscreenCanvas === "undefined") {
      throw new Error("OffscreenCanvas not supported in this environment");
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire 2D context in worker");

    ctx.clearRect(0, 0, width, height);

    // Layer 1: Base color / gradient
    if (bgMode === "color" && bgColor && bgColor !== "transparent") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
    } else if (bgMode === "gradient" && bgGradient) {
      if (bgGradient.type === "linear") {
        const rad = (bgGradient.angle * Math.PI) / 180;
        const x1 = width / 2 - (Math.cos(rad) * width) / 2;
        const y1 = height / 2 - (Math.sin(rad) * height) / 2;
        const x2 = width / 2 + (Math.cos(rad) * width) / 2;
        const y2 = height / 2 + (Math.sin(rad) * height) / 2;
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, bgGradient.color1);
        grad.addColorStop(1, bgGradient.color2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      } else {
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.max(width, height) / 1.5;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, bgGradient.color1);
        grad.addColorStop(1, bgGradient.color2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
    } else if (bgMode === "image" && bgColor && bgColor !== "transparent") {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
    }

    // Layer 2: Background Image
    if (bgBitmap && bgMode === "image") {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, bgTransform?.opacity ?? 1));

      const cx = width / 2 + (bgTransform?.x || 0);
      const cy = height / 2 + (bgTransform?.y || 0);
      ctx.translate(cx, cy);

      if (bgTransform?.rotation) {
        ctx.rotate((bgTransform.rotation * Math.PI) / 180);
      }

      const filters: string[] = [];
      if (bgTransform?.blur && bgTransform.blur > 0) {
        filters.push(`blur(${bgTransform.blur}px)`);
      }
      if (bgTransform?.brightness !== undefined && bgTransform.brightness !== 0) {
        filters.push(`brightness(${1 + bgTransform.brightness / 100})`);
      }
      if (bgTransform?.contrast !== undefined && bgTransform.contrast !== 0) {
        filters.push(`contrast(${1 + bgTransform.contrast / 100})`);
      }
      if (bgTransform?.saturation !== undefined && bgTransform.saturation !== 0) {
        filters.push(`saturate(${1 + bgTransform.saturation / 100})`);
      }
      if (bgTransform?.temperature !== undefined && bgTransform.temperature !== 0) {
        if (bgTransform.temperature > 0) {
          filters.push(`sepia(${bgTransform.temperature * 0.35}%)`);
        } else {
          filters.push(`hue-rotate(${bgTransform.temperature * 0.25}deg)`);
        }
      }
      if (filters.length > 0 && "filter" in ctx) {
        (ctx as any).filter = filters.join(" ");
      }

      const sx = (bgTransform?.scaleX || 1) * (bgTransform?.scale || 1);
      const sy = (bgTransform?.scaleY || 1) * (bgTransform?.scale || 1);
      ctx.scale(sx, sy);

      // Draw background image
      ctx.drawImage(bgBitmap, -width / 2, -height / 2, width, height);
      ctx.restore();
    }

    // Layer 3: Foreground Subject
    if (fgBitmap) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, fgTransform?.opacity ?? 1));

      const fcx = width / 2 + (fgTransform?.x || 0);
      const fcy = height / 2 + (fgTransform?.y || 0);
      ctx.translate(fcx, fcy);

      if (fgTransform?.rotation) {
        ctx.rotate((fgTransform.rotation * Math.PI) / 180);
      }

      const fsx = (fgTransform?.scaleX || 1) * (fgTransform?.scale || 1);
      const fsy = (fgTransform?.scaleY || 1) * (fgTransform?.scale || 1);
      ctx.scale(fsx, fsy);

      ctx.drawImage(fgBitmap, -width / 2, -height / 2, width, height);
      ctx.restore();
    }

    const resultBlob = await canvas.convertToBlob({
      type: options?.exportFormat === "png" ? "image/png" : "image/jpeg",
      quality: options?.exportQuality || 0.95,
    });

    const arrayBuffer = await resultBlob.arrayBuffer();

    (self as any).postMessage(
      {
        id,
        type: "COMPOSITE_SUCCESS",
        buffer: arrayBuffer,
        mimeType: resultBlob.type,
      },
      [arrayBuffer]
    );
  } catch (err: any) {
    (self as any).postMessage({
      id,
      type: "COMPOSITE_ERROR",
      error: err?.message || "Worker compositing failed",
    });
  }
};
