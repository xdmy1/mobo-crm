"use client";

// Toast-uri de succes/eroare cu suport de „Anulează” (undo 5s) [NOU].
// Intră și ies prin tranziții CSS (întreruptibile), cronometrul se oprește cât
// ții cursorul pe ele sau cât tabul e ascuns — ca „Anulează” să nu expire pe nevăzute.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

interface ToastItem {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
  undo?: () => void;
  ttl: number;
  leaving?: boolean;
}

interface ToastApi {
  success: (text: string, undo?: () => void) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const ToastCtx = createContext<ToastApi>({
  success: () => {},
  error: () => {},
  info: () => {},
});

export function useToast() {
  return useContext(ToastCtx);
}

const noopSubscribe = () => () => {};
const EXIT_MS = 180;
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const idRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), EXIT_MS);
  }, []);

  const push = useCallback(
    (kind: ToastItem["kind"], text: string, undo?: () => void) => {
      const id = idRef.current++;
      const ttl = undo ? 5000 : kind === "error" ? 6000 : 3200;
      setItems((xs) => {
        // același mesaj apărut de două ori la rând nu se dublează pe ecran
        const next = xs.filter((x) => !(x.text === text && x.kind === kind && !x.undo));
        return [...next, { id, kind, text, undo, ttl }].slice(-MAX_VISIBLE);
      });
    },
    []
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (t, undo) => push("success", t, undo),
      error: (t) => push("error", t),
      info: (t) => push("info", t),
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed bottom-5 right-5 z-[200] flex w-full max-w-sm flex-col items-end gap-2 pl-10"
          >
            {items.map((t) => (
              <ToastView key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
            ))}
          </div>,
          document.body
        )}
    </ToastCtx.Provider>
  );
}

function ToastView({ item: t, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(t.ttl);
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (paused || t.leaving) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => dismissRef.current(), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - startedAt));
    };
  }, [paused, t.leaving]);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <div
      role="status"
      data-leaving={t.leaving ? "" : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="toast pointer-events-auto flex w-auto max-w-full items-center gap-2.5 rounded-xl border border-white/10 bg-ink py-2.5 pl-3.5 pr-2.5 text-[13px] font-medium text-white shadow-pop"
    >
      {t.kind === "success" && <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-brand" />}
      {t.kind === "error" && <AlertCircle className="h-4 w-4 shrink-0 text-[#ff8a7a]" />}
      {t.kind === "info" && <Info className="h-4 w-4 shrink-0 text-white/70" />}
      <span className="min-w-0 break-words">{t.text}</span>
      {t.undo && (
        <button
          className="shrink-0 cursor-pointer rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold text-lime-brand transition-[background-color,transform] duration-150 hover:bg-white/20 active:scale-95"
          onClick={() => {
            t.undo?.();
            onDismiss();
          }}
        >
          Anulează
        </button>
      )}
      <button
        className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        onClick={onDismiss}
        aria-label="Închide"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
