"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Settings } from "lucide-react";

interface Group {
  label: string;
  items: Array<{ label: string; href: string }>;
}

const S = "/admin/setup";

const MENU: Array<{ label: string; href: string } | Group> = [
  { label: "Setări de Calcule", href: `${S}/settings` },
  { label: "Categorii Produse", href: `${S}/product-category` },
  {
    label: "Angajat Manage",
    items: [
      { label: "Angajat Nou", href: `${S}/staffs-new` },
      { label: "Lista Angajați", href: `${S}/staffs` },
      { label: "Roluri și Permisiuni", href: `${S}/role` },
      { label: "Desemnare", href: `${S}/designation` },
      { label: "Statusul Angajatului", href: `${S}/employment-status` },
      { label: "Departament", href: `${S}/department` },
      { label: "Schimburi", href: `${S}/shift` },
    ],
  },
  { label: "Cauzele Eșecului", href: `${S}/failure-cause` },
  {
    label: "Client Setup",
    items: [
      { label: "Sursă Client", href: `${S}/contact-source` },
      { label: "Etapa", href: `${S}/contact-stage` },
      { label: "Partener", href: `${S}/partner` },
      { label: "Proiectant / Designer", href: `${S}/designer` },
    ],
  },
  {
    label: "Persoană Juridică Setup",
    items: [
      { label: "Tipul Companiei", href: `${S}/company-type` },
      { label: "Industrie", href: `${S}/industry` },
    ],
  },
  {
    label: "Proiect Setup",
    items: [
      { label: "Lista de Proiecte", href: `${S}/opportunity-source` },
      { label: "Tipul Proiectului", href: `${S}/opportunity-type` },
      { label: "Etapa de Proiectare", href: `${S}/opportunity-stage` },
    ],
  },
  {
    label: "Camere",
    items: [
      { label: "Cameră", href: `${S}/room` },
      { label: "Succesiune Producție", href: `${S}/production-sequence` },
    ],
  },
  {
    label: "Sarcini Setup",
    items: [
      { label: "Starea Sarcinii", href: `${S}/task-status` },
      { label: "Tip de Sarcină", href: `${S}/task-type` },
      { label: "Prioritate de Sarcină", href: `${S}/task-priority` },
    ],
  },
  {
    label: "Estimare Setup",
    items: [{ label: "Etapa Estimării", href: `${S}/quote-stage` }],
  },
  { label: "Anunț", href: `${S}/announcement` },
  {
    label: "Account Manage",
    items: [
      { label: "Account", href: `${S}/account` },
      { label: "Lista de tranzacții", href: `${S}/transaction` },
    ],
  },
  {
    label: "Bord Finanțe Report",
    items: [
      { label: "Balanță de Probă", href: `${S}/trial-balance` },
      { label: "Bilanț", href: `${S}/balance-sheet` },
      { label: "Adeverință de Venit", href: `${S}/income-statement` },
    ],
  },
  { label: "Premiu", href: `${S}/award` },
  { label: "Organizație", href: `${S}/organization` },
  { label: "Configurare Email", href: `${S}/email-config` },
];

export function SetupSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState<Set<string>>(() => {
    // deschide grupul care conține ruta curentă
    const s = new Set<string>();
    for (const item of MENU) {
      if ("items" in item && item.items.some((i) => pathname.startsWith(i.href)))
        s.add(item.label);
    }
    return s;
  });

  return (
    <aside className="w-full shrink-0 self-start rounded-xl border border-border bg-card p-2 shadow-xs lg:sticky lg:top-[76px] lg:w-60">
      <Link
        href="/admin/setup"
        className={`mb-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-colors hover:bg-foreground/[0.05] ${
          pathname === "/admin/setup" ? "bg-foreground/[0.06]" : ""
        }`}
      >
        <Settings className="h-4 w-4 text-muted" /> Setup
      </Link>
      <nav className="max-h-[calc(100vh-170px)] space-y-0.5 overflow-y-auto border-t border-border pt-1.5">
        {MENU.map((item) =>
          "items" in item ? (
            <div key={item.label}>
              <button
                onClick={() =>
                  setOpen((s) => {
                    const n = new Set(s);
                    if (n.has(item.label)) n.delete(item.label);
                    else n.add(item.label);
                    return n;
                  })
                }
                className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
              >
                {item.label}
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted transition-transform ${
                    open.has(item.label) ? "rotate-180" : ""
                  }`}
                />
              </button>
              {open.has(item.label) && (
                <div className="my-0.5 ml-4 space-y-0.5 border-l border-border pl-2">
                  {item.items.map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      className={`block rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                        pathname === c.href
                          ? "bg-lime-brand/25 font-medium text-foreground"
                          : "text-muted hover:bg-foreground/[0.05] hover:text-foreground"
                      }`}
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                pathname === item.href
                  ? "bg-lime-brand/25 text-foreground"
                  : "text-foreground/80 hover:bg-foreground/[0.05] hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          )
        )}
      </nav>
    </aside>
  );
}
