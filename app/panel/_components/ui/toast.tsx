"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type ToastTone = "error" | "success";

type ToastProps = {
  message: string;
  tone?: ToastTone;
  /** Time on screen before it dismisses itself, in milliseconds. */
  duration?: number;
  onClose: () => void;
};

/** Floating panel notification; the timer or the close button dismisses it. */
export function Toast({ message, tone = "error", duration = 5000, onClose }: ToastProps) {
  // The parent may re-render while the toast is visible; the ref keeps those
  // renders from restarting the dismiss timer.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), duration);
    return () => clearTimeout(timer);
  }, [duration, message]);

  return (
    <div className={`wtoast${tone === "error" ? " is-error" : " is-success"}`} role={tone === "error" ? "alert" : "status"}>
      <p>{message}</p>
      <button type="button" className="wtoast-close" aria-label="Dismiss notification" onClick={onClose}>
        ×
      </button>
    </div>
  );
}

type ToastState = { id: number; message: string; tone: ToastTone };

/**
 * One toast at a time for client components: `showToast(message)` replaces any
 * visible message; render `toast` anywhere in the form — CSS positions it.
 */
export function useToast() {
  const [state, setState] = useState<ToastState | null>(null);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, tone: ToastTone = "error") => {
    nextId.current += 1;
    setState({ id: nextId.current, message, tone });
  }, []);

  const toast: ReactNode = state ? (
    <Toast key={state.id} message={state.message} tone={state.tone} onClose={() => setState(null)} />
  ) : null;

  return { toast, showToast };
}
