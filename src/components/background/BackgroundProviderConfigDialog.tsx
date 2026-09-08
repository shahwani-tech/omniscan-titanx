/**
 * OMNISCAN TITAN X - Background Removal Provider Configuration Dialog
 * Configure GitHub Repository backend endpoint, check live connectivity,
 * switch providers (Local Biometric AI vs GitHub Remote), and adjust timeout/model.
 */

import React, { useState } from "react";
import {
  backgroundRemovalService,
  GitHubBackgroundRemovalProvider,
} from "../../engine/background/BackgroundRemovalService";
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Cpu,
  Globe,
  Lock,
} from "lucide-react";

interface BackgroundProviderConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProviderChanged?: () => void;
}

export const BackgroundProviderConfigDialog: React.FC<BackgroundProviderConfigDialogProps> = ({
  isOpen,
  onClose,
  onProviderChanged,
}) => {
  const githubProvider = backgroundRemovalService.getGitHubProvider();
  const currentConfig = githubProvider.getConfig();

  const [activeProviderId, setActiveProviderId] = useState<string>(
    backgroundRemovalService.getActiveProviderId()
  );
  const [endpointUrl, setEndpointUrl] = useState<string>(currentConfig.endpointUrl);
  const [apiKey, setApiKey] = useState<string>(currentConfig.apiKey || "");
  const [timeoutSec, setTimeoutSec] = useState<number>(Math.round((currentConfig.timeoutMs || 30000) / 1000));
  const [modelName, setModelName] = useState<string>(currentConfig.modelName || "birefnet-general");

  const [testStatus, setTestStatus] = useState<{
    testing: boolean;
    success?: boolean;
    latencyMs?: number;
    message?: string;
  }>({ testing: false });

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    // Temporarily save config to provider to test
    githubProvider.updateConfig({
      endpointUrl,
      apiKey,
      timeoutMs: timeoutSec * 1000,
      modelName,
    });

    setTestStatus({ testing: true });
    try {
      const result = await githubProvider.checkHealth();
      setTestStatus({
        testing: false,
        success: result.ok,
        latencyMs: result.latencyMs,
        message: result.message,
      });
    } catch (err: any) {
      setTestStatus({
        testing: false,
        success: false,
        message: err.message || "Failed to reach endpoint.",
      });
    }
  };

  const handleSave = () => {
    githubProvider.updateConfig({
      endpointUrl,
      apiKey,
      timeoutMs: timeoutSec * 1000,
      modelName,
    });
    backgroundRemovalService.setActiveProvider(activeProviderId);
    if (onProviderChanged) onProviderChanged();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-80 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl flex flex-col w-full max-w-lg overflow-hidden text-xs text-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-neutral-850">
          <div className="flex items-center space-x-2.5">
            <Server className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-white uppercase tracking-wider text-sm">
                Background Engine Providers
              </h3>
              <p className="text-[11px] text-neutral-400">
                Switch between Offline Local Engine and GitHub / Remote AI Backends
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Active Provider Selection */}
          <div>
            <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-2">
              Select Active Processing Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              {/* Local Provider Card */}
              <button
                type="button"
                onClick={() => setActiveProviderId("local")}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  activeProviderId === "local"
                    ? "bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500"
                    : "bg-neutral-950 border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <div className="flex items-center space-x-2 mb-1.5">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white text-[12px]">Local Biometric AI</span>
                </div>
                <p className="text-[10px] text-neutral-400 mb-2">
                  Built-in browser engine. 100% offline, zero network latency, anatomical anchor detection.
                </p>
                <span className="text-[9px] font-mono text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Ready (Always Connected)</span>
                </span>
              </button>

              {/* GitHub Remote Provider Card */}
              <button
                type="button"
                onClick={() => setActiveProviderId("github")}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  activeProviderId === "github"
                    ? "bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500"
                    : "bg-neutral-950 border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <div className="flex items-center space-x-2 mb-1.5">
                  <Globe className="w-4 h-4 text-sky-400" />
                  <span className="font-bold text-white text-[12px]">GitHub / Remote Backend</span>
                </div>
                <p className="text-[10px] text-neutral-400 mb-2">
                  Connect to your custom BiRefNet, RMBG, or Python service running in VS Code or remote server.
                </p>
                <span className="text-[9px] font-mono text-sky-400 flex items-center space-x-1">
                  <span>Configurable Endpoint</span>
                </span>
              </button>
            </div>
          </div>

          {/* GitHub Backend Configuration Fields */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-neutral-850">
              <span className="font-bold text-white text-[11px] uppercase tracking-wider">
                GitHub Repository Backend Settings
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">REST API</span>
            </div>

            {/* Endpoint URL */}
            <div>
              <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-1">
                API Endpoint URL
              </label>
              <input
                type="text"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="http://localhost:5000/api/background/remove"
                className="w-full bg-neutral-900 border border-neutral-750 rounded px-2.5 py-1.5 font-mono text-xs text-emerald-400 outline-none focus:border-emerald-500"
              />
              <span className="text-[9px] text-neutral-500 mt-0.5 block">
                Standard endpoint receiving POST JSON with <code className="text-neutral-400">{`{ image, options }`}</code>
              </span>
            </div>

            {/* Optional API Key / Bearer */}
            <div>
              <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-1">
                API Key / Auth Token (Optional)
              </label>
              <div className="flex items-center bg-neutral-900 border border-neutral-750 rounded px-2.5 py-1.5">
                <Lock className="w-3.5 h-3.5 text-neutral-500 mr-1.5" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Bearer token or secret key"
                  className="w-full bg-transparent font-mono text-xs text-neutral-200 outline-none"
                />
              </div>
            </div>

            {/* Model Name & Timeout */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-1">
                  Model Identifier
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="birefnet-general"
                  className="w-full bg-neutral-900 border border-neutral-750 rounded px-2 py-1 font-mono text-xs text-neutral-200 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-1">
                  Timeout (Seconds)
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={timeoutSec}
                  onChange={(e) => setTimeoutSec(Number(e.target.value))}
                  className="w-full bg-neutral-900 border border-neutral-750 rounded px-2 py-1 font-mono text-xs text-neutral-200 outline-none"
                />
              </div>
            </div>

            {/* Test Connection Button & Status Output */}
            <div className="pt-2 border-t border-neutral-850">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus.testing}
                className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded font-medium flex items-center justify-center space-x-2 transition-colors border border-neutral-700"
              >
                {testStatus.testing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                ) : (
                  <Server className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>Test Backend Connectivity</span>
              </button>

              {testStatus.message && (
                <div
                  className={`mt-2 p-2 rounded-lg border text-[11px] flex items-start space-x-2 ${
                    testStatus.success
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                  }`}
                >
                  {testStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-semibold block">
                      {testStatus.success ? "Connection Verified" : "Backend Not Connected"}
                    </span>
                    <span className="text-[10px] opacity-90">{testStatus.message}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-800 bg-neutral-850">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg transition-colors"
          >
            Save Provider Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
