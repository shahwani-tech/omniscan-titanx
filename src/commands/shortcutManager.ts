/**
 * OMNISCAN TITAN X - Shortcut Parsing, Normalization, Platform Mapping & Conflict Detection
 */

import { MASTER_COMMAND_DEFINITIONS } from "./commandRegistry";
import { ShortcutConflict, CommandDefinition } from "./types";

const STORAGE_KEY = "omniscan_titan_shortcuts_config_v1";

/**
 * Check if the active platform is macOS
 */
export const isMacPlatform = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform || "");
};

/**
 * Check if target is a text/editable input element
 */
export const isEditableElement = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === "textarea" || target.isContentEditable) return true;
  if (tagName === "input") {
    const type = (target.getAttribute("type") || "text").toLowerCase();
    // Non-text inputs where shortcuts shouldn't be blocked
    if (["button", "checkbox", "radio", "range", "color", "file", "submit", "reset"].includes(type)) {
      return false;
    }
    return true;
  }
  return false;
};

/**
 * Normalize an arbitrary shortcut string (e.g., "cmd + shift + s", "ctrl+o") into standard canonical format
 */
export const normalizeShortcutString = (shortcut: string): string => {
  if (!shortcut) return "";
  const parts = shortcut
    .split("+")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  let hasCtrl = false;
  let hasCmd = false;
  let hasAlt = false;
  let hasShift = false;
  let key = "";

  for (const part of parts) {
    if (part === "ctrl" || part === "control") {
      hasCtrl = true;
    } else if (part === "cmd" || part === "command" || part === "meta") {
      hasCmd = true;
    } else if (part === "alt" || part === "option") {
      hasAlt = true;
    } else if (part === "shift") {
      hasShift = true;
    } else {
      // Key component
      if (part === "esc") key = "Escape";
      else if (part === "return") key = "Enter";
      else if (part === "del") key = "Delete";
      else if (part === "up") key = "ArrowUp";
      else if (part === "down") key = "ArrowDown";
      else if (part === "left") key = "ArrowLeft";
      else if (part === "right") key = "ArrowRight";
      else if (part === "pgup" || part === "pageup") key = "PageUp";
      else if (part === "pgdn" || part === "pagedown") key = "PageDown";
      else if (part === "plus" || part === "=") key = "+";
      else if (part === "minus") key = "-";
      else if (part.length === 1) key = part.toUpperCase();
      else key = part.charAt(0).toUpperCase() + part.slice(1);
    }
  }

  const result: string[] = [];
  // Unified modifier representation
  if (hasCtrl || hasCmd) {
    result.push("Ctrl");
  }
  if (hasAlt) {
    result.push("Alt");
  }
  if (hasShift) {
    result.push("Shift");
  }
  if (key) {
    result.push(key);
  }

  return result.join("+");
};

/**
 * Convert a real browser KeyboardEvent into our canonical normalized shortcut string
 */
export const getShortcutFromEvent = (e: KeyboardEvent): string => {
  const parts: string[] = [];

  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  if (ctrlOrMeta) {
    parts.push("Ctrl");
  }
  if (e.altKey) {
    parts.push("Alt");
  }
  if (e.shiftKey) {
    // Only include Shift modifier if the key itself isn't Shift
    if (e.key !== "Shift") {
      parts.push("Shift");
    }
  }

  // Key normalization
  let key = e.key;
  if (key === "Control" || key === "Meta" || key === "Alt" || key === "Shift") {
    // Modifier-only press, not a complete shortcut
    return "";
  }

  if (key === " ") key = "Space";
  else if (key === "Esc") key = "Escape";
  else if (key === "=" || key === "+") key = "+";
  else if (key === "-" || key === "_") key = "-";
  else if (key.length === 1) key = key.toUpperCase();

  parts.push(key);
  return parts.join("+");
};

/**
 * Format a shortcut string for display based on the user's OS (e.g., Cmd symbol on Mac)
 */
export const formatShortcutForDisplay = (shortcut: string): string => {
  if (!shortcut) return "";
  const isMac = isMacPlatform();
  if (!isMac) {
    return shortcut;
  }
  // Replace Ctrl with ⌘ on Mac for native feel
  return shortcut
    .replace(/Ctrl/g, "⌘")
    .replace(/Alt/g, "⌥")
    .replace(/Shift/g, "⇧")
    .replace(/\+/g, " ");
};

/**
 * Check if an event matches a target shortcut or any of its platform variations
 */
export const matchesShortcut = (e: KeyboardEvent, targetShortcut: string, altShortcuts?: string[]): boolean => {
  if (!targetShortcut) return false;
  const eventShortcut = getShortcutFromEvent(e);
  if (!eventShortcut) return false;

  const normalizedTarget = normalizeShortcutString(targetShortcut);
  if (eventShortcut === normalizedTarget) return true;

  if (altShortcuts && altShortcuts.length > 0) {
    for (const alt of altShortcuts) {
      if (eventShortcut === normalizeShortcutString(alt)) {
        return true;
      }
    }
  }

  // Handle special symbol equivalents (+ and =, - and _)
  if (eventShortcut === "+" && (normalizedTarget === "=" || normalizedTarget === "+")) return true;
  if (eventShortcut === "-" && (normalizedTarget === "-" || normalizedTarget === "_")) return true;

  return false;
};

/**
 * Load customized shortcut bindings from localStorage
 */
export const loadCustomBindings = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.customBindings === "object") {
      return parsed.customBindings;
    }
    return {};
  } catch (err) {
    console.warn("Could not load custom shortcuts from localStorage:", err);
    return {};
  }
};

/**
 * Save customized shortcut bindings to localStorage
 */
export const saveCustomBindings = (customBindings: Record<string, string>): void => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        customBindings,
        lastUpdated: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.warn("Could not save custom shortcuts to localStorage:", err);
  }
};

/**
 * Clear custom shortcuts
 */
export const clearCustomBindings = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Could not clear custom shortcuts:", err);
  }
};

/**
 * Detect conflict when user attempts to bind a new shortcut to a command
 */
export const detectConflict = (
  newShortcut: string,
  targetCommandId: string,
  currentBindings: Record<string, string>,
  allCommands: CommandDefinition[] = MASTER_COMMAND_DEFINITIONS
): ShortcutConflict | null => {
  const normalizedNew = normalizeShortcutString(newShortcut);
  if (!normalizedNew) return null;

  const targetCmd = allCommands.find((c) => c.id === targetCommandId);
  if (!targetCmd) return null;

  for (const cmd of allCommands) {
    if (cmd.id === targetCommandId) continue;

    const boundShortcut = currentBindings[cmd.id] || cmd.defaultShortcut;
    const normalizedBound = normalizeShortcutString(boundShortcut);

    if (normalizedBound === normalizedNew) {
      // Check if scopes conflict:
      // If either is global, or if they have the same scope, they conflict!
      const isScopeConflict =
        cmd.scope === "global" || targetCmd.scope === "global" || cmd.scope === targetCmd.scope;

      if (isScopeConflict) {
        return {
          shortcut: normalizedNew,
          commandId: targetCommandId,
          conflictingWith: {
            id: cmd.id,
            label: cmd.label,
            scope: cmd.scope,
            category: cmd.category,
          },
        };
      }
    }
  }

  return null;
};
