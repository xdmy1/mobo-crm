"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** Comutator segmentat; „pastila” activă alunecă între opțiuni în loc să sară. */
export function Segmented({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number; ready: boolean }>({
    x: 0,
    w: 0,
    ready: false,
  });

  useLayoutEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>('[data-active="true"]');
    if (!el) return;
    const measure = () =>
      setThumb((t) => ({ x: el.offsetLeft, w: el.offsetWidth, ready: t.w > 0 }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value, options.length]);

  return (
    <div
      ref={wrap}
      role="tablist"
      className={cn("relative inline-flex rounded-lg border border-border bg-subtle p-0.5", className)}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-0.5 left-0 top-0.5 rounded-md bg-card shadow-xs",
          // prima poziționare e instantanee; doar schimbările ulterioare se animă
          thumb.ready && "transition-[transform,width] duration-200 ease-[var(--ease-out-strong)]",
          thumb.w === 0 && "opacity-0"
        )}
        style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          data-active={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative z-10 h-8 cursor-pointer rounded-md px-3 text-[13px] font-medium transition-colors duration-150",
            value === o.value ? "text-foreground" : "text-muted hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
