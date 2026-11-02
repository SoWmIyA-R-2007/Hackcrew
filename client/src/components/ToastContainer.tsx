import React from 'react';
import { ToastMessage } from '@/lib/types';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemoveToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onRemoveToast,
}) => {
  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 sm:w-96 pointer-events-none"
    >
      {toasts.map((toast) => {
        const icon =
          toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-ok" />
          ) : toast.type === 'warning' || toast.type === 'alert' ? (
            <AlertTriangle className="w-4 h-4 text-danger" />
          ) : (
            <Info className="w-4 h-4 text-accent" />
          );

        return (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto animate-rise flex items-start gap-3 bg-surface border border-rule-strong rounded-xl px-4 py-3 shadow-lg shadow-ink/10"
          >
            <span className="mt-0.5 shrink-0">{icon}</span>
            <div className="flex-1 min-w-0 text-sm">
              <p className="font-medium text-ink">{toast.title}</p>
              <p className="text-ink-2 mt-0.5">{toast.message}</p>
            </div>
            <button
              onClick={() => onRemoveToast(toast.id)}
              className="text-ink-3 hover:text-ink p-0.5 rounded cursor-pointer shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
