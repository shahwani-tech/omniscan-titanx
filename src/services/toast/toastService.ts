/**
 * OMNISCAN TITAN X - Non-Blocking Universal Toast Notification Service
 * Accessible, queued, auto-dismissible notifications for error, warning, success, info.
 */

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  title?: string;
  duration?: number; // duration in ms, 0 = persistent until dismissed
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration: number;
  createdAt: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();
  private timers: Map<string, number> = new Map();

  private notify() {
    const list = [...this.toasts];
    this.listeners.forEach((listener) => listener(list));
  }

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public show(type: ToastType, message: string, options?: ToastOptions): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const duration =
      options?.duration !== undefined
        ? options.duration
        : type === "error"
        ? 6000
        : type === "warning"
        ? 5000
        : 4000;

    const newToast: ToastItem = {
      id,
      type,
      message,
      title: options?.title,
      duration,
      createdAt: Date.now(),
    };

    // Keep max 5 toasts visible to prevent visual clutter
    if (this.toasts.length >= 5) {
      const oldest = this.toasts[0];
      this.dismiss(oldest.id);
    }

    this.toasts.push(newToast);
    this.notify();

    if (duration > 0) {
      const timer = window.setTimeout(() => {
        this.dismiss(id);
      }, duration);
      this.timers.set(id, timer);
    }

    return id;
  }

  public success(message: string, options?: ToastOptions): string {
    return this.show("success", message, options);
  }

  public error(message: string, options?: ToastOptions): string {
    return this.show("error", message, options);
  }

  public warning(message: string, options?: ToastOptions): string {
    return this.show("warning", message, options);
  }

  public info(message: string, options?: ToastOptions): string {
    return this.show("info", message, options);
  }

  public dismiss(id: string) {
    const timer = this.timers.get(id);
    if (timer) {
      window.clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  public clearAll() {
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers.clear();
    this.toasts = [];
    this.notify();
  }
}

export const toast = new ToastManager();
