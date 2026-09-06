/**
 * OMNISCAN TITAN X - Adaptive Performance & Hardware Acceleration Engine
 * Dynamic Resolution Scaling, Non-Blocking Frame Budgeting & Memory Guard
 */

import { PerformanceMode, PerformanceSettings } from "../types";

export function detectHardwareCapabilities(): PerformanceSettings["hardwareTelemetry"] {
  const cores = navigator.hardwareConcurrency || 4;
  // @ts-ignore
  const devMem = (navigator as any).deviceMemory || 4;

  let gpuTier: "low" | "medium" | "high" = "medium";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl) {
      // @ts-ignore
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        // @ts-ignore
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "";
        if (/apple|nvidia|radeon|geforce|direct3d11|m1|m2|m3/i.test(renderer)) {
          gpuTier = "high";
        } else if (/intel|mesa|swiftshader|llvmpipe/i.test(renderer)) {
          gpuTier = devMem >= 8 ? "medium" : "low";
        }
      }
    } else {
      gpuTier = "low";
    }
  } catch (e) {
    gpuTier = "medium";
  }

  return {
    cores,
    estimatedMemoryGb: devMem,
    gpuTier,
  };
}

export function getPerformanceSettings(mode: PerformanceMode = "auto"): PerformanceSettings {
  const telemetry = detectHardwareCapabilities();

  if (mode === "performance") {
    return {
      mode: "performance",
      previewScale: 0.35,
      debounceMs: 120,
      enableIntermediateCache: true,
      maxResolutionThreshold: 2048,
      hardwareTelemetry: telemetry,
    };
  }

  if (mode === "quality") {
    return {
      mode: "quality",
      previewScale: 0.75,
      debounceMs: 40,
      enableIntermediateCache: true,
      maxResolutionThreshold: 4096,
      hardwareTelemetry: telemetry,
    };
  }

  // AUTO Mode: Adapt to hardware
  const isLowEnd = telemetry.estimatedMemoryGb <= 4 || telemetry.cores <= 4 || telemetry.gpuTier === "low";

  return {
    mode: "auto",
    previewScale: isLowEnd ? 0.4 : 0.65,
    debounceMs: isLowEnd ? 100 : 50,
    enableIntermediateCache: true,
    maxResolutionThreshold: isLowEnd ? 2560 : 4096,
    hardwareTelemetry: telemetry,
  };
}
