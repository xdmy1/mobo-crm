"use client";

// Parolă + cod din aplicația de autentificare → stratul financiar se deschide 15 minute.
// Folosit în modalul din bara de sus și în pagina blocată.

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { unlockFinances } from "@/server/actions/security";
import { FINANCE_UNLOCK_MINUTES } from "@/lib/financeShared";

export function FinanceUnlockForm({
  totpEnabled,
  onDone,
}: {
  totpEnabled: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!totpEnabled) {
    return (
      <div className="space-y-3">
        <div className="flex gap-3 rounded-lg border border-warn/30 bg-warn/[0.08] px-3.5 py-3 text-[13px]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
          <p>
            Stratul financiar se deschide doar cu parola <b>și</b> un cod din aplicația de
            autentificare. Contul tău nu are încă autentificarea în doi pași configurată.
          </p>
        </div>
        <Link
          href="/admin/security"
          onClick={onDone}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-invert px-3.5 text-[13px] font-medium text-invert-fg shadow-xs transition-[background-color,transform] hover:bg-invert-hover active:scale-[0.98]"
        >
          <ShieldCheck className="h-4 w-4" /> Configurează 2FA
        </Link>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password || !code.trim()) return setError("Completează parola și codul.");
    setPending(true);
    setError(null);
    const res = await unlockFinances({ password, code });
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "Eroare");
      setCode("");
      return;
    }
    toast.success(`Finanțe deblocate pentru ${FINANCE_UNLOCK_MINUTES} minute`);
    setPassword("");
    setCode("");
    onDone?.();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Field label="Parola ta">
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-autofocus
        />
      </Field>
      <Field label="Cod din aplicație" help="6 cifre din Google Authenticator / Authy, sau un cod de recuperare">
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123 456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="font-mono tracking-[0.18em]"
        />
      </Field>
      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-danger/25 bg-danger/[0.07] px-3 py-2 text-[13px] font-medium text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
      <Button type="submit" loading={pending} className="w-full">
        <KeyRound className="h-4 w-4" /> Deblochează pentru {FINANCE_UNLOCK_MINUTES} minute
      </Button>
    </form>
  );
}
