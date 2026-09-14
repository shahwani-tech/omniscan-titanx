/**
 * OMNISCAN TITAN X - Centralized Shortcut Provider & Context Hook
 * Manages the single authoritative keyboard listener, dynamic scope stack,
 * priority handler registry, and shortcut customization store.
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

export interface ActionHandlerEntry {
  id: string;
  execute: () => void | Promise<void>;
  enabled?: () => boolean;
  priority?: number;
  scope?: CommandScope;
  registrationOrder: number;
}

export const COMMAND_ALIASES: Record<string, string> = {
  "file.export": "file.exportPdf",
  "file.exportPdf": "file.export",
  "file.new": "app.scan",
  "page.delete": "edit.delete",
  "edit.delete": "page.delete",
  "page.duplicate": "edit.duplicate",
  "edit.duplicate": "page.duplicate",
  "page.next": "pdf.nextPage",
  "pdf.nextPage": "page.next",
  "page.prev": "pdf.prevPage",
  "pdf.prevPage": "page.prev",
  "page.first": "pdf.firstPage",
  "pdf.firstPage": "page.first",
  "page.last": "pdf.lastPage",
  "pdf.lastPage": "page.last",
  "tool.hand": "tool.pan",
  "tool.pan": "tool.hand",
  "tool.filters": "studio.filters",
  "studio.filters": "tool.filters",
  "tool.deskew": "studio.autoDeskew",
  "studio.autoDeskew": "tool.deskew",
  "tool.autocrop": "studio.autoCrop",
  "studio.autoCrop": "tool.autocrop",
  "tool.ocr": "studio.ocr",
  "studio.ocr": "tool.ocr",
  "app.help": "app.shortcutHelp",
  "app.shortcutHelp": "app.help",
};

interface ShortcutContextValue {
  executeCommand: (id: string) => Promise<boolean>;
  getShortcut: (id: string) => string;
  getDisplayShortcut: (id: string) => string;
  registerAction: (
    id: string,
    execute: () => void | Promise<void>,
    enabled?: () => boolean,
    priority?: number,
    scope?: CommandScope
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

let globalRegistrationCounter = 0;

export const ShortcutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [customBindings, setCustomBindings] = useState<Record<string, string>>(() =>
    loadCustomBindings()
  );
  const [scopeStack, setScopeStack] = useState<CommandScope[]>(["global"]);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([]);

  // Registry of active execution handlers: commandId -> ActionHandlerEntry[]
  const handlersRef = useRef<Map<string, ActionHandlerEntry[]>>(new Map());

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

  // Helper to find best handler for a given command ID
  const resolveHandlerForCommand = useCallback(
    (id: string, activeScope: CommandScope): ActionHandlerEntry | null => {
      const candidates = handlersRef.current.get(id) || [];
      const aliasId = COMMAND_ALIASES[id];
      const aliasCandidates = aliasId ? handlersRef.current.get(aliasId) || [] : [];
      const allEntries = [...candidates, ...aliasCandidates];

      if (allEntries.length === 0) return null;

      // Filter to enabled entries
      const enabledEntries = allEntries.filter((e) => !e.enabled || e.enabled());
      if (enabledEntries.length === 0) return null;

      // Rank entries:
      // 1. Matches activeScope (+200 score)
      // 2. Base priority (default 0)
      // 3. Most recently registered (LIFO)
      const ranked = enabledEntries.map((entry) => {
        let score = entry.priority || 0;
        if (entry.scope && entry.scope === activeScope && activeScope !== "global") {
          score += 200;
        } else if (entry.scope && entry.scope !== "global" && entry.scope !== activeScope) {
          // Scoped to another inactive tool: heavily penalize so active scope takes precedence
          score -= 500;
        }
        return { entry, score };
      });

      ranked.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.entry.registrationOrder - a.entry.registrationOrder;
      });

      return ranked[0]?.entry || null;
    },
    []
  );

  // Register an action handler for a command ID
  const registerAction = useCallback(
    (
      id: string,
      execute: () => void | Promise<void>,
      enabled?: () => boolean,
      priority?: number,
      scope?: CommandScope
    ) => {
      const entry: ActionHandlerEntry = {
        id,
        execute,
        enabled,
        priority: priority ?? 0,
        scope,
        registrationOrder: ++globalRegistrationCounter,
      };

      const current = handlersRef.current.get(id) || [];
      handlersRef.current.set(id, [...current, entry]);

      return () => {
        const list = handlersRef.current.get(id);
        if (list) {
          const next = list.filter((item) => item !== entry);
          if (next.length === 0) {
            handlersRef.current.delete(id);
          } else {
            handlersRef.current.set(id, next);
          }
        }
      };
    },
    []
  );

  // Get effective shortcut for command
  const getShortcut = useCallback(
    (id: string): string => {
      if (customBindings[id]) return customBindings[id];
      const alias = COMMAND_ALIASES[id];
      if (alias && customBindings[alias]) return customBindings[alias];
      const def = MASTER_COMMAND_DEFINITIONS.find((c) => c.id === id || c.id === alias);
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
  const executeCommand = useCallback(
    async (id: string): Promise<boolean> => {
      const activeScope = scopeStack[scopeStack.length - 1] || "global";
      const handler = resolveHandlerForCommand(id, activeScope);

      if (!handler) {
        console.warn(`[ShortcutContext] No active handler registered for command: ${id} in scope ${activeScope}`);
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
    },
    [scopeStack, resolveHandlerForCommand]
  );

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

  // Reset a command shortcut to default
  const resetShortcut = useCallback((id: string) => {
    setCustomBindings((prev) => {
      const next = { ...prev };
      delete next[id];
      saveCustomBindings(next);
      return next;
    });
  }, []);

  // Reset all shortcuts to factory defaults
  const resetAllShortcuts = useCallback(() => {
    clearCustomBindings();
    setCustomBindings({});
  }, []);

  // Compute resolved commands for UI presentation
  const resolvedCommands = useMemo<ResolvedCommand[]>(() => {
    const activeScope = scopeStack[scopeStack.length - 1] || "global";

    return MASTER_COMMAND_DEFINITIONS.map((def) => {
      const isCustomized = !!customBindings[def.id];
      const currentShortcut = customBindings[def.id] || def.defaultShortcut;

      const handler = resolveHandlerForCommand(def.id, activeScope);
      const isEnabled = !!handler && (!handler.enabled || handler.enabled());

      return {
        ...def,
        currentShortcut,
        isCustomized,
        isEnabled,
      };
    });
  }, [customBindings, scopeStack, resolveHandlerForCommand]);

  // Ref to always access latest state in event listener without tearing down listener
  const stateRef = useRef({
    customBindings,
    scopeStack,
    isPaletteOpen,
    isHelpOpen,
    executeCommand,
    resolveHandlerForCommand,
  });

  useEffect(() => {
    stateRef.current = {
      customBindings,
      scopeStack,
      isPaletteOpen,
      isHelpOpen,
      executeCommand,
      resolveHandlerForCommand,
    };
  }, [customBindings, scopeStack, isPaletteOpen, isHelpOpen, executeCommand, resolveHandlerForCommand]);

  // Global Keydown Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { customBindings, scopeStack, isPaletteOpen, isHelpOpen, executeCommand, resolveHandlerForCommand } =
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

      // Allow native text entry in editable elements unless explicitly allowed or Escape
      const hasModifier = e.ctrlKey || e.metaKey;

      // Handle Arrow keys nudge for scoped tools if registered
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && !inInput) {
        const dir = e.key.replace("Arrow", "").toLowerCase();
        // Check for specific tool nudge
        const nudgeCmdId =
          activeScope === "crop"
            ? `crop.nudge${e.key.replace("Arrow", "")}`
            : activeScope === "photo-studio"
            ? `photo.nudge${e.key.replace("Arrow", "")}`
            : activeScope === "idcard-studio"
            ? `idcard.nudge${e.key.replace("Arrow", "")}`
            : activeScope === "a6-studio"
            ? `a6.nudge${e.key.replace("Arrow", "")}`
            : "tool.nudge";

        const nudgeHandler = resolveHandlerForCommand(nudgeCmdId, activeScope);
        if (nudgeHandler) {
          e.preventDefault();
          e.stopPropagation();
          nudgeHandler.execute();
          return;
        }
      }

      // Find matching commands
      // Filter commands that match either activeScope or global scope
      const matchingCandidates: { def: CommandDefinition; priority: number }[] = [];

      for (const def of MASTER_COMMAND_DEFINITIONS) {
        // Scope check
        const isScopeMatch = def.scope === activeScope || def.scope === "global";
        if (!isScopeMatch) continue;

        // Input guard: if inside text input, ignore single-key shortcuts unless allowInInputs is set
        if (inInput && !hasModifier && !def.allowInInputs) {
          continue;
        }

        const effectiveShortcut = customBindings[def.id] || def.defaultShortcut;
        if (matchesShortcut(e, effectiveShortcut, def.alternativeShortcuts)) {
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
        const handler = resolveHandlerForCommand(candidate.def.id, activeScope);
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

/**
 * Unified Hook for Tool and Modal Shortcut Integration
 * Automatically handles:
 * - Scoping (pushes scope when open/mounted, pops on close/unmount)
 * - Standard core actions: Undo, Redo, Delete, Duplicate, Copy, Paste, Zoom In/Out/Reset
 * - Dialog controls: Escape (cancel/close), Enter (apply/confirm)
 * - Arrow-key nudging (with Shift 10x and Alt 0.2x multipliers)
 * - Custom action registration with cleanup
 */
export interface UseToolShortcutsOptions {
  scope: CommandScope;
  isOpen?: boolean;
  priority?: number;
  actions?: Record<string, () => void | Promise<void>>;
  onEscape?: () => void;
  onEnter?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onRotateCw?: () => void;
  onRotateCcw?: () => void;
  onNudge?: (direction: "up" | "down" | "left" | "right", multiplier: number) => void;
}

export function useToolShortcuts({
  scope,
  isOpen = true,
  priority = 100,
  actions,
  onEscape,
  onEnter,
  onUndo,
  onRedo,
  onDelete,
  onDuplicate,
  onCopy,
  onPaste,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onRotateCw,
  onRotateCcw,
  onNudge,
}: UseToolShortcutsOptions) {
  const { pushScope, popScope, registerAction } = useShortcuts();

  // Stable refs for callbacks to avoid re-registering on every render
  const callbacksRef = useRef({
    actions,
    onEscape,
    onEnter,
    onUndo,
    onRedo,
    onDelete,
    onDuplicate,
    onCopy,
    onPaste,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    onRotateCw,
    onRotateCcw,
    onNudge,
  });

  useEffect(() => {
    callbacksRef.current = {
      actions,
      onEscape,
      onEnter,
      onUndo,
      onRedo,
      onDelete,
      onDuplicate,
      onCopy,
      onPaste,
      onZoomIn,
      onZoomOut,
      onResetZoom,
      onRotateCw,
      onRotateCcw,
      onNudge,
    };
  });

  useEffect(() => {
    if (!isOpen) return;

    pushScope(scope);

    const unregisters: (() => void)[] = [];

    // Core Dialog Actions
    if (onEscape) {
      unregisters.push(
        registerAction(
          "app.escape",
          () => callbacksRef.current.onEscape?.(),
          undefined,
          priority + 50,
          scope
        )
      );
      // Tool-specific close alias
      unregisters.push(
        registerAction(
          `${scope}.close`,
          () => callbacksRef.current.onEscape?.(),
          undefined,
          priority,
          scope
        )
      );
    }

    if (onEnter) {
      unregisters.push(
        registerAction(
          "app.confirm",
          () => callbacksRef.current.onEnter?.(),
          undefined,
          priority,
          scope
        )
      );
      unregisters.push(
        registerAction(
          `${scope}.apply`,
          () => callbacksRef.current.onEnter?.(),
          undefined,
          priority,
          scope
        )
      );
    }

    // Core Edit Actions
    if (onUndo) {
      unregisters.push(
        registerAction("edit.undo", () => callbacksRef.current.onUndo?.(), undefined, priority, scope)
      );
    }
    if (onRedo) {
      unregisters.push(
        registerAction("edit.redo", () => callbacksRef.current.onRedo?.(), undefined, priority, scope)
      );
    }
    if (onDelete) {
      unregisters.push(
        registerAction(
          "edit.delete",
          () => callbacksRef.current.onDelete?.(),
          undefined,
          priority,
          scope
        )
      );
      unregisters.push(
        registerAction(
          "page.delete",
          () => callbacksRef.current.onDelete?.(),
          undefined,
          priority,
          scope
        )
      );
    }
    if (onDuplicate) {
      unregisters.push(
        registerAction(
          "edit.duplicate",
          () => callbacksRef.current.onDuplicate?.(),
          undefined,
          priority,
          scope
        )
      );
    }
    if (onCopy) {
      unregisters.push(
        registerAction("edit.copy", () => callbacksRef.current.onCopy?.(), undefined, priority, scope)
      );
    }
    if (onPaste) {
      unregisters.push(
        registerAction("edit.paste", () => callbacksRef.current.onPaste?.(), undefined, priority, scope)
      );
    }

    // View & Zoom Actions
    if (onZoomIn) {
      unregisters.push(
        registerAction("view.zoomIn", () => callbacksRef.current.onZoomIn?.(), undefined, priority, scope)
      );
      unregisters.push(
        registerAction(
          `${scope}.zoomIn`,
          () => callbacksRef.current.onZoomIn?.(),
          undefined,
          priority,
          scope
        )
      );
    }
    if (onZoomOut) {
      unregisters.push(
        registerAction(
          "view.zoomOut",
          () => callbacksRef.current.onZoomOut?.(),
          undefined,
          priority,
          scope
        )
      );
      unregisters.push(
        registerAction(
          `${scope}.zoomOut`,
          () => callbacksRef.current.onZoomOut?.(),
          undefined,
          priority,
          scope
        )
      );
    }
    if (onResetZoom) {
      unregisters.push(
        registerAction(
          "view.fitPage",
          () => callbacksRef.current.onResetZoom?.(),
          undefined,
          priority,
          scope
        )
      );
      unregisters.push(
        registerAction(
          "view.actualSize",
          () => callbacksRef.current.onResetZoom?.(),
          undefined,
          priority,
          scope
        )
      );
      unregisters.push(
        registerAction(
          `${scope}.resetZoom`,
          () => callbacksRef.current.onResetZoom?.(),
          undefined,
          priority,
          scope
        )
      );
    }

    // Rotations
    if (onRotateCw) {
      unregisters.push(
        registerAction(
          `${scope}.rotateCw`,
          () => callbacksRef.current.onRotateCw?.(),
          undefined,
          priority,
          scope
        )
      );
      unregisters.push(
        registerAction(
          "pdf.rotateCw",
          () => callbacksRef.current.onRotateCw?.(),
          undefined,
          priority,
          scope
        )
      );
    }
    if (onRotateCcw) {
      unregisters.push(
        registerAction(
          `${scope}.rotateCcw`,
          () => callbacksRef.current.onRotateCcw?.(),
          undefined,
          priority,
          scope
        )
      );
      unregisters.push(
        registerAction(
          "pdf.rotateCcw",
          () => callbacksRef.current.onRotateCcw?.(),
          undefined,
          priority,
          scope
        )
      );
    }

    // Arrow Nudge Registration
    if (onNudge) {
      const directions: ("up" | "down" | "left" | "right")[] = ["up", "down", "left", "right"];
      directions.forEach((dir) => {
        const capitalized = dir.charAt(0).toUpperCase() + dir.slice(1);
        const prefix =
          scope === "crop"
            ? "crop"
            : scope === "photo-studio"
            ? "photo"
            : scope === "idcard-studio"
            ? "idcard"
            : scope === "a6-studio"
            ? "a6"
            : "tool";

        unregisters.push(
          registerAction(
            `${prefix}.nudge${capitalized}`,
            () => callbacksRef.current.onNudge?.(dir, 1),
            undefined,
            priority,
            scope
          )
        );
      });
    }

    // Custom actions dict
    if (actions) {
      Object.keys(actions).forEach((cmdId) => {
        unregisters.push(
          registerAction(
            cmdId,
            () => callbacksRef.current.actions?.[cmdId]?.(),
            undefined,
            priority,
            scope
          )
        );
      });
    }

    return () => {
      unregisters.forEach((unreg) => unreg());
      popScope(scope);
    };
  }, [
    isOpen,
    scope,
    priority,
    pushScope,
    popScope,
    registerAction,
    !!onEscape,
    !!onEnter,
    !!onUndo,
    !!onRedo,
    !!onDelete,
    !!onDuplicate,
    !!onCopy,
    !!onPaste,
    !!onZoomIn,
    !!onZoomOut,
    !!onResetZoom,
    !!onRotateCw,
    !!onRotateCcw,
    !!onNudge,
  ]);
}
