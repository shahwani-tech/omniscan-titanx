/**
 * OMNISCAN TITAN X / PRO ULTRA - Unified Color Grading & Adjustment Studio Panel
 * Professional, Non-Destructive High-Precision Adjustments with Auto-Detection & Preset Grading
 */

import React from "react";
import { ImageFilterPipeline } from "../../types";
import { ContentClassificationResult } from "../../engine/autoClassifier";
import {
  OmniAdjustmentStudioPanel,
  DEFAULT_OMNI_PRESETS,
  AdjustmentPresetItem,
} from "./OmniAdjustmentStudioPanel";

export interface UnifiedColorGradingPanelProps {
  filters: ImageFilterPipeline;
  onChange: (updated: Partial<ImageFilterPipeline>, isCommit?: boolean) => void;
  onReset: () => void;
  imageSource?: string | HTMLImageElement | HTMLCanvasElement;
  compact?: boolean;
  showPresets?: boolean;
  showOptics?: boolean;
  showColorModes?: boolean;
  showGeometry?: boolean;
  idPrefix?: string;
  onAutoEnhanced?: (summary: string) => void;
  detectedContent?: ContentClassificationResult | null;
  filterSource?: "auto-detected" | "user-override";
  onReDetect?: () => void;
  onApplyToAllPages?: () => void;
  pageCount?: number;
}

export const UNIFIED_COLOR_PRESETS: AdjustmentPresetItem[] = DEFAULT_OMNI_PRESETS;

export const UnifiedColorGradingPanel: React.FC<UnifiedColorGradingPanelProps> = ({
  filters,
  onChange,
  onReset,
  imageSource,
  compact = false,
  showPresets = true,
  showOptics = true,
  showColorModes = true,
  showGeometry = true,
  idPrefix = "pdf-tone",
  onAutoEnhanced,
  detectedContent,
  filterSource = "auto-detected",
  onReDetect,
  onApplyToAllPages,
  pageCount,
}) => {
  return (
    <OmniAdjustmentStudioPanel
      filters={filters}
      onChange={onChange}
      onReset={onReset}
      imageSource={imageSource}
      title="Color Grading & Adjustments"
      showAutoEnhance={true}
      showResetAll={true}
      showHistogram={!compact}
      showPresets={showPresets}
      presets={UNIFIED_COLOR_PRESETS}
      sections={{
        tone: true,
        color: showColorModes,
        detail: true,
        optics: showOptics,
        alignment: showGeometry,
      }}
      idPrefix={idPrefix}
      detectedContent={detectedContent}
      filterSource={filterSource}
      onReDetect={onReDetect}
      onApplyToAllPages={onApplyToAllPages}
      pageCount={pageCount}
      onAutoEnhanced={onAutoEnhanced}
      className="w-full"
    />
  );
};
