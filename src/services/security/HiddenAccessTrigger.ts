/**
 * OMNISCAN TITAN X - Internal Security Access Gateway
 * Focus-protected hardware sequence listener.
 */

function isFocusWithinEditable(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (target.isContentEditable) {
    return true;
  }

  const role = target.getAttribute("role");
  if (role === "textbox" || role === "searchbox") {
    return true;
  }

  // Check if inside content-editable ancestor
  const editableAncestor = target.closest('[contenteditable="true"]');
  if (editableAncestor) {
    return true;
  }

  return false;
}

export function setupHiddenAccessListener(onTrigger: () => void): () => void {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Modifier combination: Ctrl/Cmd + Shift + Alt
    const hasRequiredModifiers = (e.ctrlKey || e.metaKey) && e.shiftKey && e.altKey;

    if (!hasRequiredModifiers) {
      return;
    }

    // Keys: F12 or Backquote
    const isTargetKey = e.key === "F12" || e.code === "F12" || e.key === "`" || e.code === "Backquote";

    if (!isTargetKey) {
      return;
    }

    // Focus protection: if focused in editable element, ignore unless modifier combo was held intentionally
    if (isFocusWithinEditable(e.target)) {
      // Even if editable, the 4-key simultaneous combination (Ctrl+Shift+Alt+F12) requires explicit intent.
      // But we blur the input so no accidental keystroke gets written
      if (e.target instanceof HTMLElement) {
        e.target.blur();
      }
    }

    e.preventDefault();
    e.stopPropagation();

    onTrigger();
  };

  window.addEventListener("keydown", handleKeyDown, { capture: true });

  return () => {
    window.removeEventListener("keydown", handleKeyDown, { capture: true });
  };
}
