import React, { useEffect, useState } from "react";
import { toast, ToastItem } from "../../services/toast/toastService";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe((updated) => {
      setToasts(updated);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Notifications"
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none max-w-sm sm:max-w-md w-full px-4 sm:px-0"
    >
      {toasts.map((item) => {
        const isError = item.type === "error";
        const isWarning = item.type === "warning";
        const isSuccess = item.type === "success";

        return (
          <div
            key={item.id}
            role={isError ? "alert" : "status"}
            aria-live={isError ? "assertive" : "polite"}
            aria-atomic="true"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 transform translate-y-0 text-xs font-medium animate-in fade-in slide-in-from-bottom-3 ${
              isError
                ? "bg-rose-950/95 border-rose-500/50 text-rose-100"
                : isWarning
                ? "bg-amber-950/95 border-amber-500/50 text-amber-100"
                : isSuccess
                ? "bg-emerald-950/95 border-emerald-500/50 text-emerald-100"
                : "bg-neutral-900/95 border-sky-500/50 text-sky-100"
            }`}
          >
            <span className="shrink-0 mt-0.5">
              {isError && <AlertCircle className="w-4 h-4 text-rose-400" />}
              {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400" />}
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {!isError && !isWarning && !isSuccess && <Info className="w-4 h-4 text-sky-400" />}
            </span>

            <div className="flex-1 min-w-0 pr-1">
              {item.title && <div className="font-bold mb-0.5 text-white">{item.title}</div>}
              <p className="leading-relaxed whitespace-pre-wrap break-words">{item.message}</p>
            </div>

            <button
              type="button"
              onClick={() => toast.dismiss(item.id)}
              aria-label="Dismiss notification"
              className="shrink-0 text-white/60 hover:text-white p-0.5 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-white/40"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </aside>
  );
};
