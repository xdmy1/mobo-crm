"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, Inbox } from "lucide-react";
import type { BadgeColor } from "@/lib/listTypes";
import { cn } from "@/lib/cn";

export function Empty({
  text = "Nu există date",
  icon,
  compact,
  children,
}: {
  text?: string;
  icon?: ReactNode;
  compact?: boolean;
  /** acțiunea următoare (buton), ca starea goală să nu fie o fundătură */
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2.5 text-muted",
        compact ? "py-6" : "py-12"
      )}
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-subtle text-muted/70">
        {icon ?? <Inbox className="h-[18px] w-[18px]" />}
      </span>
      <span className="text-[13px]">{text}</span>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

const badgeColors: Record<BadgeColor, { wrap: string; dot: string }> = {
  green: { wrap: "bg-success/10 text-success", dot: "bg-success" },
  red: { wrap: "bg-danger/10 text-danger", dot: "bg-danger" },
  blue: { wrap: "bg-info/10 text-info", dot: "bg-info" },
  gray: { wrap: "bg-foreground/[0.06] text-foreground/70", dot: "bg-foreground/40" },
  amber: { wrap: "bg-warn/[0.13] text-warn", dot: "bg-warn" },
  lime: { wrap: "bg-lime-brand/25 text-primary dark:bg-lime-brand/15", dot: "bg-primary" },
};

export function Badge({
  color = "gray",
  children,
  dot,
}: {
  color?: BadgeColor;
  children: ReactNode;
  dot?: boolean;
}) {
  const c = badgeColors[color] ?? badgeColors.gray;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        c.wrap
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />}
      {children}
    </span>
  );
}

/**
 * Panou colapsabil (pagina client / proiect). Se deschide/închide cu înălțime animată.
 * `open` + `onOpenChange` îl fac controlat (ex. „Adaugă Acum” deschide panoul din afară).
 */
export function Collapse({
  title,
  icon,
  defaultOpen = false,
  open: controlled,
  onOpenChange,
  extra,
  count,
  children,
}: {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  extra?: ReactNode;
  /** numărul de înregistrări din panou, afișat lângă titlu */
  count?: number;
  children: ReactNode;
}) {
  const [inner, setInner] = useState(defaultOpen);
  const open = controlled ?? inner;
  // conținutul se montează la prima deschidere (panourile grele nu încarcă nimic cât sunt închise)
  // și rămâne montat după aceea, ca un formular început să nu se piardă la o închidere din greșeală
  const [mountedOnce, setMountedOnce] = useState(open);
  if (open && !mountedOnce) setMountedOnce(true);
  const toggle = () => {
    setInner(!open);
    onOpenChange?.(!open);
  };
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        className="flex cursor-pointer select-none items-center gap-2.5 px-4 py-3 transition-colors hover:bg-subtle/70 focus-visible:bg-subtle/70 focus-visible:outline-none"
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 text-muted transition-transform duration-200 ease-[var(--ease-out-strong)]",
            open && "rotate-90"
          )}
        />
        <span className="flex items-center gap-2 text-sm font-semibold">
          {title} {icon}
        </span>
        {count != null && count > 0 && (
          <span className="rounded-full bg-foreground/[0.06] px-1.5 text-xs font-medium tabular-nums text-muted">
            {count}
          </span>
        )}
        {extra && (
          <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
            {extra}
          </div>
        )}
      </div>
      <div className="collapse-grid" data-open={open}>
        {/* `inert` scoate conținutul închis din ordinea Tab-ului */}
        <div inert={!open}>
          {mountedOnce && <div className="border-t border-border px-4 py-4">{children}</div>}
        </div>
      </div>
    </div>
  );
}

export function Card({
  title,
  extra,
  children,
  className = "",
  flush,
}: {
  title?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
  /** fără padding pe conținut (tabele lipite de margini) */
  flush?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-xs", className)}>
      {(title || extra) && (
        <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {extra}
        </div>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

const avatarTones = [
  "bg-[#e8edc2] text-[#4a5200]",
  "bg-[#dde7f5] text-[#2c4a7a]",
  "bg-[#f3e1d6] text-[#7a4424]",
  "bg-[#e3ecdf] text-[#2f5a36]",
  "bg-[#ece1f1] text-[#5a3570]",
  "bg-[#f4e9c8] text-[#6b5210]",
];

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        avatarTones[hash % avatarTones.length]
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {initials || "?"}
    </span>
  );
}
