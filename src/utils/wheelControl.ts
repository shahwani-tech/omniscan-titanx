/**
 * Global Context-Aware Mouse-Wheel Control Utility
 *
 * Provides smooth, context-aware mouse wheel control across the entire project:
 * - Sliders (input[type="range"]) are adjusted by their configured step, min, and max.
 * - Number inputs (input[type="number"]) are adjusted by their step, min, and max.
 * - Native scrollbars and scrollable overflow containers retain normal native scrolling.
 * - Center-anchored PDF canvas zoom is fully preserved.
 * - Fast live previews are updated on each wheel tick, and full commits settle smoothly.
 */

// Track commit debounce timers for inputs undergoing wheel adjustments
const commitTimers = new WeakMap<HTMLInputElement, number>();
const fastPreviewActive = new WeakSet<HTMLInputElement>();

/**
 * Checks if the pointer coordinates fall within the native scrollbar area of an element.
 */
export function isPointerOverNativeScrollbar(
  element: HTMLElement | null,
  clientX: number,
  clientY: number
): boolean {
  if (!element || !(element instanceof HTMLElement)) return false;

  let curr: HTMLElement | null = element;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    const rect = curr.getBoundingClientRect();

    // Vertical scrollbar on the right (or left in RTL)
    const isScrollableY = curr.scrollHeight > curr.clientHeight + 1;
    const vScrollbarWidth = curr.offsetWidth - curr.clientWidth - curr.clientLeft;
    if (isScrollableY && vScrollbarWidth > 0) {
      const vScrollbarLeft = rect.right - vScrollbarWidth;
      if (
        clientX >= vScrollbarLeft &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return true;
      }
    }

    // Horizontal scrollbar on the bottom
    const isScrollableX = curr.scrollWidth > curr.clientWidth + 1;
    const hScrollbarHeight = curr.offsetHeight - curr.clientHeight - curr.clientTop;
    if (isScrollableX && hScrollbarHeight > 0) {
      const hScrollbarTop = rect.bottom - hScrollbarHeight;
      if (
        clientY >= hScrollbarTop &&
        clientY <= rect.bottom &&
        clientX >= rect.left &&
        clientX <= rect.right
      ) {
        return true;
      }
    }

    curr = curr.parentElement;
  }

  return false;
}

/**
 * Parses numeric step and precision from input element attributes.
 */
function getStepAndPrecision(input: HTMLInputElement, min: number, max: number) {
  const stepAttr = input.getAttribute("step");
  let step = 1;
  let precision = 0;

  if (stepAttr && stepAttr !== "any") {
    const parsedStep = parseFloat(stepAttr);
    if (!isNaN(parsedStep) && parsedStep > 0) {
      step = parsedStep;
      if (stepAttr.includes(".")) {
        precision = stepAttr.split(".")[1].length;
      }
    }
  } else {
    // If step is unspecified, infer appropriate step from min/max range
    const range = isFinite(max) && isFinite(min) ? max - min : 100;
    if (range <= 1) {
      step = 0.01;
      precision = 2;
    } else if (range <= 5) {
      step = 0.05;
      precision = 2;
    } else if (range <= 20) {
      step = 0.1;
      precision = 1;
    } else {
      step = 1;
      precision = 0;
    }
  }

  return { step, precision };
}

/**
 * Determines wheel direction:
 * Up / right -> +1 (increase)
 * Down / left -> -1 (decrease)
 */
function getWheelDirection(e: WheelEvent, isInverted = false): number {
  let dir = 0;
  if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
    dir = e.deltaY < 0 ? 1 : -1;
  } else {
    dir = e.deltaX > 0 ? 1 : -1;
  }
  return isInverted ? -dir : dir;
}

/**
 * Adjusts an <input type="range"> based on a WheelEvent.
 * Uses native property setter to properly trigger React's synthetic onChange.
 */
export function adjustRangeInputElement(input: HTMLInputElement, e: WheelEvent): boolean {
  if (input.disabled || input.readOnly) return false;

  const min = input.min !== "" ? parseFloat(input.min) : 0;
  const max = input.max !== "" ? parseFloat(input.max) : 100;
  if (min >= max) return false;

  const { step, precision } = getStepAndPrecision(input, min, max);
  const isInverted = input.getAttribute("data-inverted") === "true";
  const direction = getWheelDirection(e, isInverted);
  const multiplier = e.shiftKey ? 5 : 1;
  const delta = direction * step * multiplier;

  const currentVal = isNaN(parseFloat(input.value)) ? min : parseFloat(input.value);
  const rawNext = currentVal + delta;
  const nextVal = Math.min(
    max,
    Math.max(
      min,
      precision > 0 ? Number(rawNext.toFixed(precision)) : Math.round(rawNext)
    )
  );

  // Set the value using native property descriptor to notify React
  const proto = window.HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (nativeSetter) {
    nativeSetter.call(input, String(nextVal));
  } else {
    input.value = String(nextVal);
  }

  // If this is the start of interaction, fire pointerdown for components tracking active dragging
  if (!fastPreviewActive.has(input)) {
    fastPreviewActive.add(input);
    input.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
  }

  // Dispatch 'input' event immediately (triggers React onChange with fast preview)
  input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));

  // Settle debounce: after wheel motion stops, commit final state
  const existingTimer = commitTimers.get(input);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }
  const timer = window.setTimeout(() => {
    commitTimers.delete(input);
    fastPreviewActive.delete(input);
    // Dispatch change and pointerup to commit final high-res renders
    input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    input.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
  }, 160);
  commitTimers.set(input, timer);

  return true;
}

/**
 * Adjusts an <input type="number"> based on a WheelEvent.
 */
export function adjustNumberInputElement(input: HTMLInputElement, e: WheelEvent): boolean {
  if (input.disabled || input.readOnly) return false;

  const min = input.min !== "" ? parseFloat(input.min) : -Infinity;
  const max = input.max !== "" ? parseFloat(input.max) : Infinity;

  const { step, precision } = getStepAndPrecision(input, min, max);
  const direction = getWheelDirection(e);
  const multiplier = e.shiftKey ? 5 : 1;
  const delta = direction * step * multiplier;

  const currentVal = isNaN(parseFloat(input.value))
    ? isFinite(min)
      ? min
      : 0
    : parseFloat(input.value);
  const rawNext = currentVal + delta;
  const nextVal = Math.min(
    max,
    Math.max(
      min,
      precision > 0 ? Number(rawNext.toFixed(precision)) : Math.round(rawNext)
    )
  );

  const proto = window.HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (nativeSetter) {
    nativeSetter.call(input, String(nextVal));
  } else {
    input.value = String(nextVal);
  }

  input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));

  const existingTimer = commitTimers.get(input);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }
  const timer = window.setTimeout(() => {
    commitTimers.delete(input);
    input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  }, 160);
  commitTimers.set(input, timer);

  return true;
}

let isGlobalWheelInitialized = false;

/**
 * Initializes global context-aware wheel handling.
 * Attaches a single, capture-phase wheel listener to window.
 */
export function initGlobalWheelControl(): () => void {
  if (isGlobalWheelInitialized) {
    return () => {};
  }
  isGlobalWheelInitialized = true;

  const handleGlobalWheel = (e: WheelEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target || !(target instanceof Element)) return;

    // 1. If mouse is over a native scrollbar gutter, let native scrolling proceed
    if (isPointerOverNativeScrollbar(target, e.clientX, e.clientY)) {
      return;
    }

    // 2. Check if pointer is over or inside an <input type="range">
    const rangeInput = target.closest('input[type="range"]') as HTMLInputElement | null;
    if (rangeInput) {
      e.preventDefault();
      e.stopPropagation();
      adjustRangeInputElement(rangeInput, e);
      return;
    }

    // 3. Check if pointer is over or inside an <input type="number">
    const numberInput = target.closest('input[type="number"]') as HTMLInputElement | null;
    if (numberInput) {
      e.preventDefault();
      e.stopPropagation();
      adjustNumberInputElement(numberInput, e);
      return;
    }

    // 4. Check if pointer is over a custom split-view comparison handle or slider
    const splitSlider = target.closest('[data-split-slider="true"]') as HTMLElement | null;
    if (splitSlider) {
      // Let the element's own onWheel handle it if present
      return;
    }

    // 5. Normal buttons, text, empty areas, scrollable sidebars, and PDF canvas
    // are left completely untouched to perform their natural scrolling or intended tool behaviors.
  };

  window.addEventListener("wheel", handleGlobalWheel, { capture: true, passive: false });

  return () => {
    window.removeEventListener("wheel", handleGlobalWheel, { capture: true } as any);
    isGlobalWheelInitialized = false;
  };
}
