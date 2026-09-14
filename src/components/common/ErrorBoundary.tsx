/**
 * OMNISCAN TITAN X - Enterprise Fault-Tolerant Error Boundary
 * Prevents white-screen crashes, isolates component failures, and provides state recovery.
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertOctagon, RefreshCw, Download, FileText, ArrowLeft } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[OmniScan ErrorBoundary] Uncaught UI error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    if (this.props.onReset) {
      this.props.onReset();
      this.setState({ hasError: false, error: null, errorInfo: null });
    } else {
      window.location.reload();
    }
  };

  private handleExportDiagnostics = () => {
    const report = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      errorName: this.state.error?.name,
      errorMessage: this.state.error?.message,
      errorStack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `omniscan-crash-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[999999] bg-neutral-950/95 backdrop-blur-md text-neutral-100 flex items-center justify-center p-6 select-none font-sans overflow-auto">
          <div className="max-w-xl w-full bg-neutral-900 border-2 border-neutral-700 rounded-2xl p-6 shadow-2xl space-y-5 text-neutral-100 relative z-10">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-rose-950/90 border border-rose-600/80 flex items-center justify-center text-rose-400 shrink-0 shadow-lg">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  {this.props.fallbackTitle || "Document Workspace Protection Triggered"}
                </h1>
                <p className="text-xs text-neutral-400">
                  A component rendering fault was safely intercepted. Your document data remains intact in memory.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="bg-black/70 border border-neutral-800 rounded-lg p-3 text-xs font-mono text-rose-300 overflow-x-auto max-h-40 leading-relaxed">
              <div className="font-bold text-rose-400 mb-1">
                {this.state.error?.name || "Application Crash"}: {this.state.error?.message || "An unexpected rendering fault occurred."}
              </div>
              {this.state.error?.stack && (
                <pre className="text-[10px] text-neutral-400 whitespace-pre-wrap font-mono mt-2 max-h-24 overflow-y-auto">
                  {this.state.error.stack.split("\n").slice(0, 6).join("\n")}
                </pre>
              )}
            </div>

            {/* Recovery Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                onClick={this.handleReload}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors shadow-lg shadow-sky-600/30 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recover Studio &amp; Continue</span>
              </button>

              <button
                onClick={this.handleExportDiagnostics}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-200 hover:text-white font-medium text-xs transition-colors border border-neutral-700 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save Crash Diagnostic Log</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
