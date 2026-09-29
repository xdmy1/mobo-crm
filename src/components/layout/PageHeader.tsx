import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  badge,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** link „înapoi” afișat în stânga titlului (pagini de detaliu) */
  back?: { href: string; label?: string };
  badge?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        {back && (
          <Link
            href={back.href}
            title={back.label ?? "Înapoi"}
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border-strong/70 bg-card text-muted shadow-xs transition-colors hover:bg-subtle hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-[22px] font-semibold leading-8 tracking-tight">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

const tones = {
  neutral: "bg-foreground/[0.06] text-foreground/70",
  lime: "bg-lime-brand/25 text-primary dark:bg-lime-brand/15",
  green: "bg-success/10 text-success",
  blue: "bg-info/10 text-info",
  amber: "bg-warn/[0.13] text-warn",
  red: "bg-danger/10 text-danger",
} as const;

export function StatCard({
  label,
  value,
  sub,
  href,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  href?: string;
  icon?: LucideIcon;
  tone?: keyof typeof tones;
}) {
  const inner = (
    <div
      className={cn(
        "h-full rounded-xl border border-border bg-card p-4 shadow-xs transition-[border-color,box-shadow]",
        href && "hover:border-border-strong hover:shadow-sm"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[13px] font-medium text-muted">{label}</p>
        {Icon && (
          <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", tones[tone])}>
            <Icon className="h-[15px] w-[15px]" strokeWidth={2} />
          </span>
        )}
      </div>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
      {sub && <p className="mt-1.5 truncate text-xs text-muted">{sub}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block min-w-0">
      {inner}
    </Link>
  ) : (
    <div className="min-w-0">{inner}</div>
  );
}
