import Link from "next/link";
import {
  Building2,
  ChevronRight,
  DatabaseBackup,
  Megaphone,
  Scale,
  Trophy,
  Users,
  Calculator,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Setup — MOBO CRM" };

const TILES = [
  { label: "Bilanț", href: "/admin/setup/balance-sheet", icon: Scale },
  { label: "Lista Angajați", href: "/admin/setup/staffs", icon: Users },
  { label: "Anunț", href: "/admin/setup/announcement", icon: Megaphone },
  { label: "Premiu", href: "/admin/setup/award", icon: Trophy },
  { label: "Setarea Companiei", href: "/admin/setup/organization", icon: Building2 },
  { label: "Setări de Calcule", href: "/admin/setup/settings", icon: Calculator },
  { label: "Roluri și Permisiuni", href: "/admin/setup/role", icon: ShieldCheck },
  { label: "Configurare Email", href: "/admin/setup/email-config", icon: Mail },
  {
    label: "Backup baza de date",
    href: "/api/backup",
    icon: DatabaseBackup,
    download: true,
  },
];

export default async function SetupIndexPage() {
  await requireUser();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold leading-8 tracking-tight">Setup</h1>
        <p className="mt-0.5 text-[13px] text-muted">Configurarea companiei, a echipei și a nomenclatoarelor</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TILES.map((t) =>
          t.download ? (
            <a
              key={t.href}
              href={t.href}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm"
              title="Descarcă un backup JSON complet al bazei de date (doar admin)"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-lime-brand/25 text-primary transition-colors group-hover:bg-lime-brand/45">
                <t.icon className="h-5 w-5" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{t.label}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5" />
            </a>
          ) : (
            <Link
              key={t.href}
              href={t.href}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-lime-brand/25 text-primary transition-colors group-hover:bg-lime-brand/45">
                <t.icon className="h-5 w-5" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{t.label}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )
        )}
      </div>
    </div>
  );
}
