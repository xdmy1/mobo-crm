"use client";

// Drawer lateral din dreapta + Modal centrat + dialog de confirmare.
// Toate au animație de intrare ȘI de ieșire, blochează scroll-ul paginii,
// mută focusul în interior la deschidere și îl redau elementului de pornire la închidere.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "./Button";
import { usePresence } from "@/lib/usePresence";
import { cn } from "@/lib/cn";

// Escape închide doar suprapunerea de deasupra (ex. confirmarea, nu și drawer-ul de sub ea)
const escapeStack: symbol[] = [];
function useEscape(onClose: () => void, active: boolean) {
  // onClose e de obicei o funcție inline; o ținem într-un ref ca ordinea din stivă
  // să depindă doar de momentul deschiderii, nu de re-randări
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    if (!active) return;
    const token = Symbol("overlay");
    escapeStack.push(token);
    const fn = (e: KeyboardEvent) => {
      // un select deschis în interior își consumă singur Escape-ul (preventDefault în captură)
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (escapeStack[escapeStack.length - 1] !== token) return;
      e.preventDefault();
      latest.current();
    };
    document.addEventListener("keydown", fn);
    return () => {
      document.removeEventListener("keydown", fn);
      escapeStack.splice(escapeStack.indexOf(token), 1);
    };
  }, [active]);
}

// mai multe suprapuneri pot fi deschise simultan (drawer + confirmare)
let scrollLocks = 0;
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    scrollLocks++;
    document.body.style.overflow = "hidden";
    return () => {
      scrollLocks--;
      if (scrollLocks === 0) document.body.style.overflow = "";
    };
  }, [active]);
}

/** Focus în panou la deschidere, înapoi pe declanșator la închidere. */
function useFocusReturn(open: boolean, panel: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => {
      const el = panel.current;
      if (!el || el.contains(document.activeElement)) return;
      const target = el.querySelector<HTMLElement>(
        "[data-autofocus], input:not([type=hidden]):not([disabled]), textarea:not([disabled])"
      );
      (target ?? el).focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(raf);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, panel]);
}

const backdrop = "overlay-backdrop bg-[#0f100c]/40 backdrop-blur-[2px]";
const closeBtn =
  "grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition-[background-color,color,transform] duration-150 hover:bg-foreground/[0.06] hover:text-foreground active:scale-95";

/** titlul afișat rămâne cel din momentul deschiderii cât durează animația de ieșire */
function useFrozenWhileClosing(open: boolean, value: string | undefined) {
  const [shown, setShown] = useState(value);
  if (open && shown !== value) setShown(value);
  return open ? value : shown;
}

/**
 * Conținutul „îngheață” pe durata ieșirii: părintele își golește de obicei starea
 * în clipa închiderii (ex. rândul editat devine null), iar fără asta textul
 * ar sări cu un cadru înainte să dispară.
 */
function useLastOpen<T>(open: boolean, value: T): T {
  const last = useRef(value);
  useEffect(() => {
    if (open) last.current = value;
  });
  // eslint-disable-next-line react-hooks/refs -- citire intenționată: valoarea din ultima randare „deschisă”
  return open ? value : last.current;
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const { mounted, state } = usePresence(open, 180);
  const panel = useRef<HTMLDivElement>(null);
  const shownTitle = useFrozenWhileClosing(open, title);
  const view = useLastOpen(open, { children, footer });
  useEscape(onClose, open);
  useScrollLock(mounted);
  useFocusReturn(open, panel);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div
      className={cn("fixed inset-0 z-[100]", !open && "pointer-events-none")}
      data-state={state}
    >
      <div className={`absolute inset-0 ${backdrop}`} onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={shownTitle}
        tabIndex={-1}
        className="overlay-drawer absolute bottom-0 right-0 top-0 flex w-full flex-col border-l border-border bg-card shadow-pop outline-none sm:bottom-2 sm:right-2 sm:top-2 sm:w-[calc(100%-1rem)] sm:rounded-2xl sm:border"
        style={{ maxWidth: width }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-[15px] font-semibold">{shownTitle}</h2>
          <button onClick={onClose} className={closeBtn} aria-label="Închide">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{view.children}</div>
        {view.footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-subtle/60 px-5 py-3 sm:rounded-b-2xl">
            {view.footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 520,
  instant,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  /** fără animație — pentru acțiuni pornite din tastatură (paleta ⌘K) */
  instant?: boolean;
}) {
  const { mounted, state } = usePresence(open, instant ? 0 : 130);
  const panel = useRef<HTMLDivElement>(null);
  const shownTitle = useFrozenWhileClosing(open, title);
  const view = useLastOpen(open, { children, footer });
  useEscape(onClose, open);
  useScrollLock(mounted);
  useFocusReturn(open, panel);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overscroll-contain p-4 pt-[10vh]",
        !open && "pointer-events-none"
      )}
      data-state={state}
      data-instant={instant ? "" : undefined}
    >
      <div className={`fixed inset-0 ${backdrop}`} onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={shownTitle}
        tabIndex={-1}
        className="overlay-modal relative w-full rounded-2xl border border-border bg-card shadow-pop outline-none"
        style={{ maxWidth: width }}
      >
        {shownTitle && (
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="text-[15px] font-semibold">{shownTitle}</h2>
            <button onClick={onClose} className={closeBtn} aria-label="Închide">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{view.children}</div>
        {view.footer && (
          <div className="flex items-center justify-end gap-2 rounded-b-2xl border-t border-border bg-subtle/60 px-5 py-3">
            {view.footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Confirmare",
  message,
  confirmLabel = "Șterge",
  danger = true,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={420}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Anulează
          </Button>
          <Button
            data-autofocus
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3.5 pt-1">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
            danger ? "bg-danger/10 text-danger" : "bg-foreground/[0.06] text-foreground"
          }`}
        >
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <div className="mt-1 text-sm text-muted">{message}</div>
        </div>
      </div>
    </Modal>
  );
}
