import { useState, useEffect, useMemo, createContext, useContext } from "react";

export type ViewportTier = "compact" | "standard" | "large" | "ultra";

export interface AdaptiveViewportMetrics {
  tier: ViewportTier;
  width: number;
  height: number;
  dpr: number;
  isHighDpi: boolean;
  
  // Toolbar Adaptive Metrics
  toolbarIconSize: number; // 16, 20, 24, 28 (scaled for high DPI)
  toolbarShowLabels: "none" | "primary" | "all";
  toolbarPaddingClass: string;
  toolbarButtonClass: string;
  toolbarCollapseOverflow: boolean;
  
  // Cropbar Adaptive Metrics
  cropbarPaddingClass: string;
  cropbarInputClass: string;
  cropbarSliderLengthClass: string;
  cropbarShowExtendedLabels: boolean;
  cropbarCompactMode: boolean;
}

const defaultMetrics: AdaptiveViewportMetrics = {
  tier: "standard",
  width: 1440,
  height: 900,
  dpr: 1,
  isHighDpi: false,
  toolbarIconSize: 20,
  toolbarShowLabels: "primary",
  toolbarPaddingClass: "px-2 py-1",
  toolbarButtonClass: "p-1.5 text-xs",
  toolbarCollapseOverflow: false,
  cropbarPaddingClass: "px-3 py-2",
  cropbarInputClass: "w-13 text-[11px]",
  cropbarSliderLengthClass: "w-28",
  cropbarShowExtendedLabels: true,
  cropbarCompactMode: false,
};

export const AdaptiveViewportContext = createContext<AdaptiveViewportMetrics>(defaultMetrics);

export function computeAdaptiveMetrics(width: number, height: number, dpr: number): AdaptiveViewportMetrics {
  let tier: ViewportTier = "standard";
  if (width < 1280) {
    tier = "compact";
  } else if (width <= 1920) {
    tier = "standard";
  } else if (width <= 2560) {
    tier = "large";
  } else {
    tier = "ultra";
  }

  const isHighDpi = dpr > 1;
  const dpiBonus = dpr >= 2 ? 2 : 0;

  let toolbarIconSize = 20 + dpiBonus;
  let toolbarShowLabels: "none" | "primary" | "all" = "primary";
  let toolbarPaddingClass = "px-2 py-1";
  let toolbarButtonClass = "p-1.5 text-xs";
  let toolbarCollapseOverflow = false;

  let cropbarPaddingClass = "px-3 py-2";
  let cropbarInputClass = "w-13 text-[11px]";
  let cropbarSliderLengthClass = "w-28";
  let cropbarShowExtendedLabels = true;
  let cropbarCompactMode = false;

  switch (tier) {
    case "compact":
      toolbarIconSize = 16 + (isHighDpi ? 1 : 0);
      toolbarShowLabels = "none";
      toolbarPaddingClass = "px-1.5 py-1";
      toolbarButtonClass = "p-1 text-[11px]";
      toolbarCollapseOverflow = true;

      cropbarPaddingClass = "px-2 py-1.5 text-[11px]";
      cropbarInputClass = "w-11 text-[10px]";
      cropbarSliderLengthClass = "w-16";
      cropbarShowExtendedLabels = false;
      cropbarCompactMode = true;
      break;

    case "standard":
      toolbarIconSize = 20 + dpiBonus;
      toolbarShowLabels = "primary";
      toolbarPaddingClass = "px-2.5 py-1.5";
      toolbarButtonClass = "p-1.5 text-xs";
      toolbarCollapseOverflow = false;

      cropbarPaddingClass = "px-3 py-2 text-xs";
      cropbarInputClass = "w-13 text-[11px]";
      cropbarSliderLengthClass = "w-28";
      cropbarShowExtendedLabels = true;
      cropbarCompactMode = false;
      break;

    case "large":
      toolbarIconSize = 24 + dpiBonus;
      toolbarShowLabels = "all";
      toolbarPaddingClass = "px-3.5 py-2";
      toolbarButtonClass = "px-2.5 py-1.5 text-xs";
      toolbarCollapseOverflow = false;

      cropbarPaddingClass = "px-4 py-2.5 text-sm";
      cropbarInputClass = "w-16 text-xs";
      cropbarSliderLengthClass = "w-40";
      cropbarShowExtendedLabels = true;
      cropbarCompactMode = false;
      break;

    case "ultra":
      toolbarIconSize = 28 + dpiBonus;
      toolbarShowLabels = "all";
      toolbarPaddingClass = "px-5 py-2.5";
      toolbarButtonClass = "px-3 py-2 text-sm";
      toolbarCollapseOverflow = false;

      cropbarPaddingClass = "px-5 py-3 text-base";
      cropbarInputClass = "w-20 text-sm";
      cropbarSliderLengthClass = "w-52";
      cropbarShowExtendedLabels = true;
      cropbarCompactMode = false;
      break;
  }

  return {
    tier,
    width,
    height,
    dpr,
    isHighDpi,
    toolbarIconSize,
    toolbarShowLabels,
    toolbarPaddingClass,
    toolbarButtonClass,
    toolbarCollapseOverflow,
    cropbarPaddingClass,
    cropbarInputClass,
    cropbarSliderLengthClass,
    cropbarShowExtendedLabels,
    cropbarCompactMode,
  };
}

/**
 * Custom hook to track viewport dimensions and calculate desktop-tier responsive metrics
 * using ResizeObserver on the root container element.
 */
export function useAdaptiveViewport(targetElementRef?: React.RefObject<HTMLElement | null>): AdaptiveViewportMetrics {
  // Check if context is already provided
  const context = useContext(AdaptiveViewportContext);

  const [dimensions, setDimensions] = useState<{ width: number; height: number; dpr: number }>(() => {
    if (typeof window === "undefined") {
      return { width: 1440, height: 900, dpr: 1 };
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
    };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Target the specific container or fall back to root or documentElement
    const getTarget = (): HTMLElement => {
      if (targetElementRef?.current) return targetElementRef.current;
      const root = document.getElementById("root");
      if (root) return root;
      return document.documentElement;
    };

    const target = getTarget();

    const updateDimensions = () => {
      const rect = target.getBoundingClientRect();
      const currentWidth = rect.width > 0 ? rect.width : window.innerWidth;
      const currentHeight = rect.height > 0 ? rect.height : window.innerHeight;
      const currentDpr = window.devicePixelRatio || 1;

      setDimensions((prev) => {
        if (
          Math.abs(prev.width - currentWidth) < 2 &&
          Math.abs(prev.height - currentHeight) < 2 &&
          prev.dpr === currentDpr
        ) {
          return prev;
        }
        return { width: currentWidth, height: currentHeight, dpr: currentDpr };
      });
    };

    // Initial measure
    updateDimensions();

    let resizeObserver: ResizeObserver | null = null;
    try {
      resizeObserver = new ResizeObserver(() => {
        updateDimensions();
      });
      resizeObserver.observe(target);
    } catch {
      // Fallback to window resize
    }

    const handleWindowResize = () => {
      updateDimensions();
    };

    window.addEventListener("resize", handleWindowResize, { passive: true });

    // Track DPR change (moving window between standard and Retina / 4K displays)
    let dprMediaQuery: MediaQueryList | null = null;
    const handleDprChange = () => {
      updateDimensions();
    };

    if (window.matchMedia) {
      dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      try {
        dprMediaQuery.addEventListener("change", handleDprChange);
      } catch {
        dprMediaQuery.addListener(handleDprChange);
      }
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener("resize", handleWindowResize);
      if (dprMediaQuery) {
        try {
          dprMediaQuery.removeEventListener("change", handleDprChange);
        } catch {
          dprMediaQuery.removeListener(handleDprChange);
        }
      }
    };
  }, [targetElementRef]);

  const metrics = useMemo(() => {
    return computeAdaptiveMetrics(dimensions.width, dimensions.height, dimensions.dpr);
  }, [dimensions.width, dimensions.height, dimensions.dpr]);

  // If context has active values different from default, use context; otherwise metrics
  if (context !== defaultMetrics) {
    return context;
  }

  return metrics;
}
