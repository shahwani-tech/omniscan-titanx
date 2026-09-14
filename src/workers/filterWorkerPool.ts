/**
 * OMNISCAN TITAN X - Web Worker Pool & Orchestrator
 * High-concurrency worker pool with automatic load balancing, zero-copy ArrayBuffer transfer,
 * and seamless fallback to main-thread execution if workers are disabled or unavailable.
 */

import { ImageFilterPipeline } from "../types";
import {
  applyPixelFiltersToBuffer,
  computeRadonDeskewFromBuffer,
  computeBlanknessFromBuffer,
} from "../engine/pixelCore";

interface PendingTask {
  id: string;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timer: any;
}

class FilterWorkerPool {
  private workers: Worker[] = [];
  private pendingTasks = new Map<string, PendingTask>();
  private nextWorkerIndex = 0;
  private isInitialized = false;
  private isSupported = typeof window !== "undefined" && typeof Worker !== "undefined";
  private poolSize: number;

  constructor(poolSize?: number) {
    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency) {
      this.poolSize = poolSize || Math.max(1, Math.min(4, Math.floor(navigator.hardwareConcurrency / 2)));
    } else {
      this.poolSize = poolSize || 2;
    }
  }

  private initWorkers(): void {
    if (this.isInitialized || !this.isSupported) return;
    this.isInitialized = true;

    try {
      for (let i = 0; i < this.poolSize; i++) {
        const worker = new Worker(
          new URL("./filterWorker.ts", import.meta.url),
          { type: "module" }
        );

        worker.onmessage = (e: MessageEvent) => {
          const { id, type, buffer, angle, result, error } = e.data;
          const task = this.pendingTasks.get(id);
          if (!task) return;

          this.pendingTasks.delete(id);
          clearTimeout(task.timer);

          if (type === "ERROR" || error) {
            task.reject(new Error(error || "Worker operation failed"));
          } else if (type === "PROCESS_PIXELS_SUCCESS") {
            task.resolve(buffer);
          } else if (type === "CALCULATE_DESKEW_SUCCESS") {
            task.resolve(angle);
          } else if (type === "ANALYZE_BLANKNESS_SUCCESS") {
            task.resolve(result);
          } else {
            task.resolve(e.data);
          }
        };

        worker.onerror = (err) => {
          console.warn("Filter worker encountered error:", err);
          // On fatal worker failure, mark unsupported for subsequent tasks if all fail
        };

        this.workers.push(worker);
      }
    } catch (e) {
      console.warn("Could not spawn filter Web Workers, using main-thread fallback:", e);
      this.isSupported = false;
      this.workers = [];
    }
  }

  private getNextWorker(): Worker | null {
    if (!this.isInitialized) {
      this.initWorkers();
    }
    if (!this.isSupported || this.workers.length === 0) {
      return null;
    }
    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  /**
   * Run 9-stage pixel filter pipeline in worker thread with zero-copy ArrayBuffer transfer
   */
  async runPixelFilters(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    filters: ImageFilterPipeline,
    isFast = false
  ): Promise<Uint8ClampedArray> {
    const worker = this.getNextWorker();

    if (!worker) {
      // Main-thread fallback
      applyPixelFiltersToBuffer(data, width, height, filters, isFast);
      return data;
    }

    return new Promise<Uint8ClampedArray>((resolve) => {
      const id = "task_" + Math.random().toString(36).slice(2, 11);
      // Clone buffer to allow transfer without detaching original if needed
      const buffer = data.buffer.slice(0);

      const timer = setTimeout(() => {
        // Timeout safeguard (5s) -> fallback to synchronous execution
        if (this.pendingTasks.has(id)) {
          this.pendingTasks.delete(id);
          console.warn("Worker timed out for filter task, falling back to main thread");
          applyPixelFiltersToBuffer(data, width, height, filters, isFast);
          resolve(data);
        }
      }, 5000);

      this.pendingTasks.set(id, {
        id,
        resolve: (returnedBuffer: ArrayBuffer) => {
          resolve(new Uint8ClampedArray(returnedBuffer));
        },
        reject: (err) => {
          console.warn("Worker filter error, executing on main thread:", err);
          applyPixelFiltersToBuffer(data, width, height, filters, isFast);
          resolve(data);
        },
        timer,
      });

      try {
        worker.postMessage(
          {
            id,
            type: "PROCESS_PIXELS",
            buffer,
            width,
            height,
            filters,
            isFast,
          },
          [buffer]
        );
      } catch (err) {
        // In case postMessage fails (e.g. transfer failed)
        clearTimeout(timer);
        this.pendingTasks.delete(id);
        applyPixelFiltersToBuffer(data, width, height, filters, isFast);
        resolve(data);
      }
    });
  }

  /**
   * Run Radon deskew angle calculation in background thread
   */
  async calculateDeskew(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): Promise<number> {
    const worker = this.getNextWorker();

    if (!worker) {
      return computeRadonDeskewFromBuffer(data, width, height);
    }

    return new Promise<number>((resolve) => {
      const id = "deskew_" + Math.random().toString(36).slice(2, 11);
      const buffer = data.buffer.slice(0);

      const timer = setTimeout(() => {
        if (this.pendingTasks.has(id)) {
          this.pendingTasks.delete(id);
          console.warn("Worker timed out for deskew task, falling back to main thread");
          resolve(computeRadonDeskewFromBuffer(data, width, height));
        }
      }, 5000);

      this.pendingTasks.set(id, {
        id,
        resolve,
        reject: () => {
          resolve(computeRadonDeskewFromBuffer(data, width, height));
        },
        timer,
      });

      try {
        worker.postMessage(
          {
            id,
            type: "CALCULATE_DESKEW",
            buffer,
            width,
            height,
          },
          [buffer]
        );
      } catch {
        clearTimeout(timer);
        this.pendingTasks.delete(id);
        resolve(computeRadonDeskewFromBuffer(data, width, height));
      }
    });
  }

  /**
   * Run blankness check in background thread
   */
  async analyzeBlankness(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): Promise<{ isBlank: boolean; score: number }> {
    const worker = this.getNextWorker();

    if (!worker) {
      return computeBlanknessFromBuffer(data, width, height);
    }

    return new Promise<{ isBlank: boolean; score: number }>((resolve) => {
      const id = "blank_" + Math.random().toString(36).slice(2, 11);
      const buffer = data.buffer.slice(0);

      const timer = setTimeout(() => {
        if (this.pendingTasks.has(id)) {
          this.pendingTasks.delete(id);
          resolve(computeBlanknessFromBuffer(data, width, height));
        }
      }, 4000);

      this.pendingTasks.set(id, {
        id,
        resolve,
        reject: () => {
          resolve(computeBlanknessFromBuffer(data, width, height));
        },
        timer,
      });

      try {
        worker.postMessage(
          {
            id,
            type: "ANALYZE_BLANKNESS",
            buffer,
            width,
            height,
          },
          [buffer]
        );
      } catch {
        clearTimeout(timer);
        this.pendingTasks.delete(id);
        resolve(computeBlanknessFromBuffer(data, width, height));
      }
    });
  }

  /**
   * Clean up all worker threads
   */
  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.pendingTasks.clear();
    this.isInitialized = false;
  }
}

export const globalWorkerPool = new FilterWorkerPool();

export const runPixelFiltersAsync = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  filters: ImageFilterPipeline,
  isFast = false
) => globalWorkerPool.runPixelFilters(data, width, height, filters, isFast);

export const calculateDeskewAsync = (
  data: Uint8ClampedArray,
  width: number,
  height: number
) => globalWorkerPool.calculateDeskew(data, width, height);

export const analyzeBlanknessAsync = (
  data: Uint8ClampedArray,
  width: number,
  height: number
) => globalWorkerPool.analyzeBlankness(data, width, height);
