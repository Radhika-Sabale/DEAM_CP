/**
 * @file Toast.tsx
 * Accessible toast notification component and container providing WCAG-compliant
 * multi-channel signaling (never relying on color alone) and pausable auto-dismiss.
 */

import {
  type FC,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { selectToasts, type ToastItem, useUiStore } from '../../store/uiStore';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  CloseIcon,
  InfoIcon,
} from './Icons';

const levelIcons: Record<ToastItem['level'], ReactNode> = {
  success: <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />,
  info: <InfoIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />,
  warning: <AlertCircleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />,
  error: <AlertCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />,
};

const levelLabels: Record<ToastItem['level'], string> = {
  success: 'Success',
  info: 'Information',
  warning: 'Warning',
  error: 'Error',
};

const levelClasses: Record<ToastItem['level'], string> = {
  success: 'border-green-300 bg-green-50 text-green-950 dark:border-green-800 dark:bg-green-950/80 dark:text-green-100',
  info: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/80 dark:text-blue-100',
  warning: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/80 dark:text-amber-100',
  error: 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/80 dark:text-red-100',
};

export interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export const Toast: FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef(toast.durationMs ?? 5000);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (toast.durationMs === 0) return;

    if (!isPaused) {
      startTimeRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        onDismiss(toast.id);
      }, remainingTimeRef.current);
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPaused, onDismiss, toast.durationMs, toast.id]);

  return (
    <div
      role="status"
      aria-live={toast.ariaLive ?? 'polite'}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg transition-all ${levelClasses[toast.level]}`}
    >
      {levelIcons[toast.level]}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {/* Accessible text label ensuring color is not the only signal */}
          <span className="text-xs font-bold uppercase tracking-wider underline">
            [{levelLabels[toast.level].toUpperCase()}]
          </span>
          {toast.title && (
            <span className="text-sm font-semibold truncate">
              {toast.title}
            </span>
          )}
        </div>
        <p className="text-sm leading-snug break-words">{toast.message}</p>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={`Dismiss ${levelLabels[toast.level]} notification`}
        className="rounded p-1 opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

export const ToastContainer: FC = () => {
  const toasts = useUiStore(selectToasts);
  const dismissToast = useUiStore((state) => state.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed top-4 right-4 z-50 flex flex-col gap-2.5"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
};
