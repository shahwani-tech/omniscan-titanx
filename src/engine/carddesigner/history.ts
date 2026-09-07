/**
 * History Manager for ID & Service Card Designer
 * Deep object-level snapshot management supporting 50 levels of undo/redo.
 */

import { CardDesignerProject } from "./types";

export class CardDesignerHistory {
  private past: CardDesignerProject[] = [];
  private future: CardDesignerProject[] = [];
  private maxSteps: number;

  constructor(initialOrMax?: CardDesignerProject | number, maxSteps: number = 50) {
    if (typeof initialOrMax === "number") {
      this.maxSteps = initialOrMax;
    } else {
      this.maxSteps = maxSteps;
    }
  }

  /**
   * Push a new snapshot into history
   */
  public push(currentState: CardDesignerProject) {
    // Deep clone to guarantee immutability
    const clone: CardDesignerProject = JSON.parse(JSON.stringify(currentState));
    this.past.push(clone);
    if (this.past.length > this.maxSteps) {
      this.past.shift();
    }
    // Clear redo tree on new user mutation
    this.future = [];
  }

  /**
   * Undo to previous state
   */
  public undo(currentState: CardDesignerProject): CardDesignerProject | null {
    if (this.past.length === 0) return null;
    const previous = this.past.pop()!;
    this.future.push(JSON.parse(JSON.stringify(currentState)));
    return previous;
  }

  /**
   * Redo to next state
   */
  public redo(currentState: CardDesignerProject): CardDesignerProject | null {
    if (this.future.length === 0) return null;
    const next = this.future.pop()!;
    this.past.push(JSON.parse(JSON.stringify(currentState)));
    return next;
  }

  public canUndo(): boolean {
    return this.past.length > 0;
  }

  public canRedo(): boolean {
    return this.future.length > 0;
  }

  public clear() {
    this.past = [];
    this.future = [];
  }
}

export { CardDesignerHistory as HistoryManager };
