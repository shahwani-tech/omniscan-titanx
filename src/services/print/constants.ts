/**
 * Standard Paper Sizes, Default Configurations, and Margins
 */
import { PaperSizeOption, PrintSettings, TemporaryDriverPreferences } from "../../types/print";

export const STANDARD_PAPER_SIZES: PaperSizeOption[] = [
  {
    id: "a4",
    name: "A4 (210 × 297 mm)",
    widthMm: 210,
    heightMm: 297,
    widthInches: 8.27,
    heightInches: 11.69,
  },
  {
    id: "letter",
    name: "Letter (8.5 × 11 in)",
    widthMm: 215.9,
    heightMm: 279.4,
    widthInches: 8.5,
    heightInches: 11.0,
  },
  {
    id: "photo_4x6",
    name: "4 × 6 in Photo (100 × 150 mm)",
    widthMm: 101.6,
    heightMm: 152.4,
    widthInches: 4.0,
    heightInches: 6.0,
  },
  {
    id: "a6",
    name: "A6 Postcard (105 × 148 mm)",
    widthMm: 105,
    heightMm: 148,
    widthInches: 4.13,
    heightInches: 5.83,
  },
  {
    id: "legal",
    name: "Legal (8.5 × 14 in)",
    widthMm: 215.9,
    heightMm: 355.6,
    widthInches: 8.5,
    heightInches: 14.0,
  },
  {
    id: "photo_5x7",
    name: "5 × 7 in Photo (127 × 178 mm)",
    widthMm: 127,
    heightMm: 177.8,
    widthInches: 5.0,
    heightInches: 7.0,
  },
  {
    id: "a5",
    name: "A5 (148 × 210 mm)",
    widthMm: 148,
    heightMm: 210,
    widthInches: 5.83,
    heightInches: 8.27,
  },
  {
    id: "a3",
    name: "A3 (297 × 420 mm)",
    widthMm: 297,
    heightMm: 420,
    widthInches: 11.69,
    heightInches: 16.54,
  },
];

export const DEFAULT_TEMPORARY_PREFERENCES: TemporaryDriverPreferences = {
  quality: "normal",
  mediaType: "plain",
  paperSource: "Auto Select",
  resolutionDpi: 300,
  borderless: false,
  colorManagement: "driver",
  inkSaving: false,
  isTemporary: true,
};

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  printerName: "",
  copies: 1,
  collate: true,
  paperSizeId: "a4",
  orientation: "portrait",
  colorMode: "color",
  quality: "normal",
  scaling: "fit",
  customScalePercent: 100,
  centerHorizontally: true,
  centerVertically: true,
  marginType: "normal",
  customMarginsMm: { top: 5, right: 5, bottom: 5, left: 5 },
  pageRangeMode: "all",
  customPageRange: "",
  duplex: "none",
  paperSource: "Auto Select",
  borderless: false,
  printBackground: true,
  cuttingGuides: false,
  cropMarks: false,
  bleedMm: 0,
  imageInterpolation: "high",
  temporaryPreferences: { ...DEFAULT_TEMPORARY_PREFERENCES },
};
