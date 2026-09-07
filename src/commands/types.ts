/**
 * OMNISCAN TITAN X - Centralized Keyboard Command & Shortcut Types
 */

export type CommandCategory =
  | "Global"
  | "File"
  | "Edit"
  | "View"
  | "Navigation"
  | "Tools"
  | "PDF"
  | "Crop"
  | "Image"
  | "Passport Studio"
  | "ID Card Studio"
  | "A6 Studio"
  | "Batch & Intelligence"
  | "Security"
  | "Sliders & Inputs";

export type CommandScope =
  | "global"
  | "canvas"
  | "pdf"
  | "crop"
  | "photo-studio"
  | "idcard-studio"
  | "a6-studio"
  | "modal";

export interface CommandDefinition {
  id: string;
  label: string;
  description: string;
  category: CommandCategory;
  defaultShortcut: string;
  alternativeShortcuts?: string[];
  scope: CommandScope;
  priority?: number;
  preventDefault?: boolean;
  allowInInputs?: boolean;
  icon?: string;
  keywords?: string[];
}

export interface ResolvedCommand extends CommandDefinition {
  currentShortcut: string;
  isCustomized: boolean;
  isEnabled: boolean;
}

export interface ShortcutConflict {
  shortcut: string;
  commandId: string;
  conflictingWith: {
    id: string;
    label: string;
    scope: CommandScope;
    category: CommandCategory;
  };
}

export interface ShortcutSettingsData {
  version: number;
  customBindings: Record<string, string>;
  lastUpdated: string;
}
