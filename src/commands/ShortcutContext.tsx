/**
 * OMNISCAN TITAN X - Centralized Shortcut Provider & Context Hook
 * Manages the single authoritative keyboard listener, dynamic scope stack,
 * action dispatcher, and shortcut customization store.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { MASTER_COMMAND_DEFINITIONS } from "./commandRegistry";
import {
  CommandScope,
  ResolvedCommand,
  ShortcutConflict,
  CommandDefinition,
} from "./types";
import {
  getShortcutFromEvent,
  matchesShortcut,
  isEditableElement,
  loadCustomBindings,
  saveCustomBindings,
  clearCustomBindings,
  detectConflict,
  formatShortcutForDisplay,
} from "./shortcutManager";

interface ActionHandler {
  execute: () => void | Promise<void>;
  enabled?: () => boolean;
  priority?: number;
}

interface ShortcutContextValue {
  executeCommand: (id: string) => Promise<boolean>;
  getShortcut: (id: string) => string;
  getDisplayShortcut: (id: string) => string;
  registerAction: (
    id: string,
    execute: () => void | Promise<void>,
    enabled?: () => boolean,
    priority?: number
  ) => () => void;
  pushScope: (scope: CommandScope) => void;
  popScope: (scope: CommandScope) => void;
  activeScopes: CommandScope[];
  customBindings: Record<string, string>;
  setCustomShortcut: (
    id: string,
    newShortcut: string
  ) => { success: boolean; conflict?: ShortcutConflict };
  resetShortcut: (id: string) => void;
  resetAllShortcuts: () => void;
  isPaletteOpen: boolean;
  setIsPaletteOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  recentCommandIds: string[];
  resolvedCommands: ResolvedCommand[];
}

const ShortcutContext = createContext<ShortcutContextValue | null>(null);

export const ShortcutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [customBindings, setCustomBindings] = useState<Record<string, string>>(() =>
    loadCustomBindings()
  );
  const [scopeStack, setScopeStack] = useState<CommandScope[]>(["global"]);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([]);

  // Registry of active execution handlers: commandId -> ActionHandler
  const handlersRef = useRef<Map<string, ActionHandler>>(new Map());

  // Push / pop scopes
  const pushScope = useCallback((scope: CommandScope) => {
    setScopeStack((prev) => {
      if (prev[prev.length - 1] === scope) return prev;
      return [...prev, scope];
    });
  }, []);

  const popScope = useCallback((scope: CommandScope) => {
    setScopeStack((prev) => {
      const idx = prev.lastIndexOf(scope);
      if (idx <= 0) return prev; // never remove base 'global' scope
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  }, []);

  // Register an action handler for a command ID
  const registerAction = useCallback(
    (
      id: string,
      execute: () => void | Promise<void>,
      enabled?: () => boolean,
      priority?: number
    ) => {
      handlersRef.current.set(id, { execute, enabled, priority });
      return () => {
        // Only unregister if the current handler is the one we registered
        const current = handlersRef.current.get(id);
        if (current && current.execute === execute) {
          handlersRef.current.delete(id);
        }
      };
    },
    []
  );

  // Get effective shortcut for command
  const getShortcut = useCallback(
    (id: string): string => {
      if (customBindings[id]) return customBindings[id];
      const def = MASTER_COMMAND_DEFINITIONS.find((c) => c.id === id);
      return def ? def.defaultShortcut : "";
    },
    [customBindings]
  );

  const getDisplayShortcut = useCallback(
    (id: string): string => {
      const raw = getShortcut(id);
      return formatShortcutForDisplay(raw);
    },
    [getShortcut]
  );

  // Execute a command by ID programmatically
  const executeCommand = useCallback(async (id: string): Promise<boolean> => {
    const handler = handlersRef.current.get(id);
    if (!handler) {
      console.warn(`[ShortcutContext] No handler registered for command: ${id}`);
      return false;
    }

    if (handler.enabled && !handler.enabled()) {
      return false;
    }

    try {
      await handler.execute();
      setRecentCommandIds((prev) => {
        const filtered = prev.filter((item) => item !== id);
        return [id, ...filtered].slice(0, 10);
      });
      return true;
    } catch (err) {
      console.error(`[ShortcutContext] Error executing command ${id}:`, err);
      return false;
    }
  }, []);

  // Customize a shortcut
  const setCustomShortcut = useCallback(
    (id: string, newShortcut: string) => {
      const conflict = detectConflict(newShortcut, id, customBindings);
      if (conflict) {
        return { success: false, conflict };
      }

      setCustomBindings((prev) => {
        const next = { ...prev, [id]: newShortcut };
        saveCustomBindings(next);
        return next;
      });
      return { success: true };
    },
    [customBindings]
  );

  // Reset a specific shortcut
  const resetShortcut = useCallback((id: string) => {
    setCustomBindings((prev) => {
      const next = { ...prev };
      delete next[id];
      saveCustomBindings(next);
      return next;
    });
  }, []);

  // Reset all shortcuts
  const resetAllShortcuts = useCallback(() => {
    clearCustomBindings();
    setCustomBindings({});
  }, []);

  // Resolved command list for palette and help panel
  const resolvedCommands = useMemo<ResolvedCommand[]>(() => {
    return MASTER_COMMAND_DEFINITIONS.map((def) => {
      const shortcut = customBindings[def.id] || def.defaultShortcut;
      const isCustomized = Boolean(customBindings[def.id]);
      const handler = handlersRef.current.get(def.id);
      const isEnabled = handler ? (handler.enabled ? handler.enabled() : true) : true;

      return {
        ...def,
        currentShortcut: shortcut,
        isCustomized,
        isEnabled,
      };
    });
  }, [customBindings]);

  // Keep references fresh for the global keydown listener without re-binding on every render
  const stateRef = useRef({
    customBindings,
    scopeStack,
    isPaletteOpen,
    isHelpOpen,
    executeCommand,
  });

  useEffect(() => {
    stateRef.current = {
      customBindings,
      scopeStack,
      isPaletteOpen,
      isHelpOpen,
      executeCommand,
    };
  }, [customBindings, scopeStack, isPaletteOpen, isHelpOpen, executeCommand]);

  // Global Keydown Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { customBindings, scopeStack, isPaletteOpen, isHelpOpen, executeCommand } =
        stateRef.current;

      const inInput = isEditableElement(e.target);

      // Fast check for Command Palette or Help Shortcuts, which can open even inside inputs
      const isPaletteShortcut =
        matchesShortcut(e, "Ctrl+K", ["Cmd+K", "Ctrl+Shift+P", "Cmd+Shift+P"]) ||
        (customBindings["app.commandPalette"] &&
          matchesShortcut(e, customBindings["app.commandPalette"]));

      if (isPaletteShortcut) {
        e.preventDefault();
        e.stopPropagation();
        setIsPaletteOpen((prev) => !prev);
        return;
      }

      const isHelpShortcut =
        matchesShortcut(e, "Ctrl+/", ["Cmd+/", "F1"]) ||
        (customBindings["app.shortcutHelp"] &&
          matchesShortcut(e, customBindings["app.shortcutHelp"]));

      if (isHelpShortcut) {
        e.preventDefault();
        e.stopPropagation();
        setIsHelpOpen((prev) => !prev);
        return;
      }

      // If Command Palette or Help Modal is open:
      // Let those components handle their own internal keys (Esc, ArrowUp, ArrowDown, Enter)
      if (isPaletteOpen || isHelpOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setIsPaletteOpen(false);
          setIsHelpOpen(false);
        }
        return;
      }

      // Current active top scope
      const activeScope = scopeStack[scopeStack.length - 1] || "global";

      // If inside editable element (input/textarea) and NOT a shortcut with modifier (like Ctrl+Z/S):
      // Allow native text entry unless command explicitly allows in inputs
      const hasModifier = e.ctrlKey || e.metaKey;

      // Find matching commands
      // Filter commands that match either activeScope or global scope
      const matchingCandidates: { def: CommandDefinition; priority: number }[] = [];

      for (const def of MASTER_COMMAND_DEFINITIONS) {
        // Scope check
        const isScopeMatch = def.scope === activeScope || def.scope === "global";
        if (!isScopeMatch) continue;

        // Input guard
        if (inInput && !hasModifier && !def.allowInInputs) {
          continue;
        }

        const effectiveShortcut = customBindings[def.id] || def.defaultShortcut;
        if (matchesShortcut(e, effectiveShortcut, def.alternativeShortcuts)) {
          // Priority calculation: scoped tools have higher priority than global
          let priority = def.priority || 0;
          if (def.scope === activeScope && activeScope !== "global") {
            priority += 50; // Boost active tool priority
          }
          matchingCandidates.push({ def, priority });
        }
      }

      if (matchingCandidates.length === 0) {
        return;
      }

      // Sort by priority descending
      matchingCandidates.sort((a, b) => b.priority - a.priority);

      // Execute highest priority command that has an enabled handler
      for (const candidate of matchingCandidates) {
        const handler = handlersRef.current.get(candidate.def.id);
        if (handler) {
          if (!handler.enabled || handler.enabled()) {
            if (candidate.def.preventDefault !== false) {
              e.preventDefault();
              e.stopPropagation();
            }
            executeCommand(candidate.def.id);
            return;
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, []);

  const value = useMemo<ShortcutContextValue>(
    () => ({
      executeCommand,
      getShortcut,
      getDisplayShortcut,
      registerAction,
      pushScope,
      popScope,
      activeScopes: scopeStack,
      customBindings,
      setCustomShortcut,
      resetShortcut,
      resetAllShortcuts,
      isPaletteOpen,
      setIsPaletteOpen,
      isHelpOpen,
      setIsHelpOpen,
      recentCommandIds,
      resolvedCommands,
    }),
    [
      executeCommand,
      getShortcut,
      getDisplayShortcut,
      registerAction,
      pushScope,
      popScope,
      scopeStack,
      customBindings,
      setCustomShortcut,
      resetShortcut,
      resetAllShortcuts,
      isPaletteOpen,
      isHelpOpen,
      recentCommandIds,
      resolvedCommands,
    ]
  );

  return <ShortcutContext.Provider value={value}>{children}</ShortcutContext.Provider>;
};

export const useShortcuts = (): ShortcutContextValue => {
  const ctx = useContext(ShortcutContext);
  if (!ctx) {
    throw new Error("useShortcuts must be used within a ShortcutProvider");
  }
  return ctx;
};
