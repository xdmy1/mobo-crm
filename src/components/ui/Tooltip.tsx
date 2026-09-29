"use client";

// Tooltip-uri pentru TOATĂ aplicația, dintr-un singur loc.
// Orice element cu `title="…"` sau `data-tip="…"` primește un tooltip frumos în locul celui nativ
// (opțional `data-tip-kbd="⌘K"` arată și scurtătura). Nu trebuie importat nimic în componente.
//
// Comportament: apare după o scurtă întârziere (nu la orice trecere a cursorului), dar odată ce
// unul e deschis, vecinii apar instant și fără animație — bara de unelte se „citește” dintr-o mișcare.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Tip {
  text: string;
  kbd?: string;
  x: number;
  y: number;
  /** deasupra (implicit), dedesubt, sau în dreapta elementului (meniul restrâns) */
  side: "top" | "bottom" | "right";
  instant: boolean;
}

const SHOW_DELAY = 420;
const WARM_WINDOW = 500; // cât timp după închidere următorul tooltip apare instant

export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef<Element | null>(null);
  const lastHidden = useRef(0);

  useEffect(() => {
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    const hide = () => {
      clear();
      if (current.current) lastHidden.current = Date.now();
      current.current = null;
      setTip(null);
    };

    const show = (el: HTMLElement) => {
      // tooltip-ul nativ se dezactivează: textul se mută din `title` în `data-tip`
      const title = el.getAttribute("title");
      if (title) {
        el.dataset.tip = title;
        if (!el.getAttribute("aria-label") && !el.textContent?.trim()) el.setAttribute("aria-label", title);
        el.removeAttribute("title");
      }
      const text = el.dataset.tip;
      if (!text) return;
      const r = el.getBoundingClientRect();
      const warm = Date.now() - lastHidden.current < WARM_WINDOW;
      const sideAttr = el.closest<HTMLElement>("[data-tip-side]")?.dataset.tipSide;
      const open = () => {
        if (sideAttr === "right") {
          // lipit de element, la 10px în dreapta lui, centrat pe verticală
          setTip({ text, kbd: el.dataset.tipKbd, x: r.right + 10, y: r.top + r.height / 2, side: "right", instant: warm });
          return;
        }
        const below = r.top < 64;
        // lângă marginea ecranului tooltip-ul se trage spre interior, ca textul să nu se rupă pe trei rânduri
        const x = Math.min(Math.max(r.left + r.width / 2, 140), window.innerWidth - 140);
        setTip({ text, kbd: el.dataset.tipKbd, x, y: below ? r.bottom + 8 : r.top - 8, side: below ? "bottom" : "top", instant: warm });
      };
      clear();
      if (warm) open();
      else timer.current = setTimeout(open, SHOW_DELAY);
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = (e.target as Element | null)?.closest?.<HTMLElement>("[data-tip], [title]");
      if (el === current.current) return;
      if (!el || el.closest("[data-no-tip]")) return hide();
      hide();
      current.current = el;
      show(el);
    };
    const onFocus = (e: FocusEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>("[data-tip], [title]");
      // doar focus din tastatură; un click nu trebuie să lase tooltip-ul agățat
      if (!el || !(e.target as HTMLElement).matches(":focus-visible")) return;
      current.current = el;
      show(el);
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", hide);
    document.addEventListener("keydown", hide);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      clear();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("keydown", hide);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
    };
  }, []);

  if (!tip || typeof document === "undefined") return null;
  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[300] w-max max-w-[264px]"
      style={{
        left: tip.x,
        top: tip.y,
        transform:
          tip.side === "right" ? "translate(0, -50%)" : `translate(-50%, ${tip.side === "bottom" ? "0" : "-100%"})`,
      }}
    >
      <div
        className={`flex items-center gap-2 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium leading-snug text-white shadow-pop ring-1 ring-white/10 ${
          tip.instant
            ? ""
            : tip.side === "right"
              ? "tooltip-in origin-left"
              : tip.side === "bottom"
                ? "tooltip-in origin-top"
                : "tooltip-in origin-bottom"
        }`}
      >
        <span>{tip.text}</span>
        {tip.kbd && (
          <kbd className="shrink-0 rounded border border-white/20 bg-white/10 px-1 font-sans text-[10px] font-medium text-white/80">
            {tip.kbd}
          </kbd>
        )}
      </div>
    </div>,
    document.body
  );
}
