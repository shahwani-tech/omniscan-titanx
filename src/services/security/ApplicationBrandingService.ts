/**
 * OMNISCAN TITAN X - Dynamic Application Branding Service
 * Synchronizes application title across window, header bar, and export metadata.
 */

type BrandingListener = (name: string) => void;

class ApplicationBrandingService {
  private currentName = "OmniScan Titan X";
  private listeners: Set<BrandingListener> = new Set();

  constructor() {
    this.updateDocumentTitle(this.currentName);
  }

  public getName(): string {
    return this.currentName;
  }

  public setName(name: string) {
    if (!name || name === this.currentName) return;
    this.currentName = name;
    this.updateDocumentTitle(name);
    this.notifyListeners();
  }

  private updateDocumentTitle(name: string) {
    if (typeof document !== "undefined") {
      document.title = `${name} - Enterprise Document Suite`;
    }
  }

  public subscribe(listener: BrandingListener): () => void {
    this.listeners.add(listener);
    listener(this.currentName);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l(this.currentName));
  }
}

export const applicationBrandingService = new ApplicationBrandingService();
