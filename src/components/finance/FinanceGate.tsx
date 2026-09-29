"use client";

// Ce vede o pagină financiară cât stratul e blocat: explicația + formularul de deblocare.

import { Lock } from "lucide-react";
import { FinanceUnlockForm } from "./FinanceUnlockForm";
import { FINANCE_UNLOCK_MINUTES } from "@/lib/financeShared";

export function FinanceGate({ title, totpEnabled }: { title: string; totpEnabled: boolean }) {
  return (
    <div className="mx-auto max-w-[440px] pt-4 animate-rise-in sm:pt-10">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-lime-brand/25 text-primary dark:bg-lime-brand/15">
          <Lock className="h-5 w-5" strokeWidth={2} />
        </span>
        <h1 className="mt-4 text-[18px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Stratul financiar e blocat. Se deschide cu parola ta și codul din aplicația de
          autentificare, pentru {FINANCE_UNLOCK_MINUTES} minute. Fiecare deblocare se scrie în
          jurnalul de audit.
        </p>
        <div className="mt-5">
          <FinanceUnlockForm totpEnabled={totpEnabled} />
        </div>
      </div>
    </div>
  );
}
