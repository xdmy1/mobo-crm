"use client";

// Configurarea 2FA (QR → cod de confirmare → coduri de recuperare), dezactivarea, regenerarea codurilor
// și, pentru administrator, resetarea 2FA a unui coleg care și-a pierdut telefonul.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  KeyRound,
  Lock,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Badge, Card, Empty } from "@/components/ui/Misc";
import { ConfirmDialog, Modal } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { fmtDateTime } from "@/lib/format";
import { FINANCE_UNLOCK_MINUTES } from "@/lib/financeShared";
import {
  beginTotpSetup,
  confirmTotpSetup,
  disableTotp,
  regenerateRecoveryCodes,
  resetStaffTotp,
  type Credentials,
} from "@/server/actions/security";

interface Colleague {
  id: number;
  name: string;
  username: string;
  enabledAt: string;
}

export function TwoFactorPanel({
  enabledAt,
  recoveryLeft,
  financePermission,
  isAdmin,
  colleagues,
}: {
  enabledAt: string | null;
  recoveryLeft: number;
  financePermission: boolean;
  isAdmin: boolean;
  colleagues: Colleague[];
}) {
  const router = useRouter();
  const toast = useToast();
  const enabled = enabledAt != null;

  // configurare
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  // acțiuni protejate (parolă + cod)
  const [action, setAction] = useState<"disable" | "regenerate" | null>(null);
  const [resetTarget, setResetTarget] = useState<Colleague | null>(null);
  const [resetting, setResetting] = useState(false);

  async function start() {
    setStarting(true);
    const res = await beginTotpSetup();
    setStarting(false);
    if (!res.ok) return toast.error(res.error);
    setSetup({ secret: res.secret, qrDataUrl: res.qrDataUrl });
    setConfirmCode("");
  }

  async function confirm() {
    if (!confirmCode.trim()) return toast.error("Introdu codul din aplicație.");
    setConfirming(true);
    const res = await confirmTotpSetup(confirmCode);
    setConfirming(false);
    if (!res.ok) return toast.error(res.error);
    setSetup(null);
    setCodes(res.recoveryCodes);
    toast.success("Autentificarea în doi pași e activă");
  }

  async function reset() {
    if (!resetTarget) return;
    setResetting(true);
    const res = await resetStaffTotp(resetTarget.id);
    setResetting(false);
    if (!res.ok) return toast.error(res.error ?? "Eroare");
    toast.success(`2FA resetat pentru ${resetTarget.name}`);
    setResetTarget(null);
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card
          title={
            <span className="flex items-center gap-2">
              Autentificare în doi pași
              {enabled ? <Badge color="green" dot>Activă</Badge> : <Badge color="gray">Neconfigurată</Badge>}
            </span>
          }
        >
          {codes ? (
            <RecoveryCodes codes={codes} onDone={() => { setCodes(null); router.refresh(); }} />
          ) : setup ? (
            <div className="grid gap-5 sm:grid-cols-[220px_minmax(0,1fr)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setup.qrDataUrl}
                alt="Cod QR pentru aplicația de autentificare"
                width={220}
                height={220}
                className="h-[220px] w-[220px] rounded-xl border border-border bg-white p-2"
              />
              <div className="space-y-3.5">
                <ol className="list-decimal space-y-1.5 pl-4 text-[13px] leading-relaxed text-foreground/85">
                  <li>Deschide Google Authenticator, Authy sau 1Password pe telefon.</li>
                  <li>Scanează codul QR (sau introdu cheia manual).</li>
                  <li>Scrie mai jos codul de 6 cifre afișat de aplicație.</li>
                </ol>
                <details className="text-xs text-muted">
                  <summary className="cursor-pointer select-none">Cheia pentru introducere manuală</summary>
                  <code className="mt-1.5 block break-all rounded-md bg-subtle px-2 py-1.5 font-mono text-[12px] tracking-wider text-foreground">
                    {setup.secret.match(/.{1,4}/g)?.join(" ")}
                  </code>
                </details>
                <div className="flex flex-wrap items-end gap-2" onKeyDown={(e) => e.key === "Enter" && confirm()}>
                  <Field label="Cod din aplicație" className="w-[150px]">
                    <Input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123 456"
                      value={confirmCode}
                      onChange={(e) => setConfirmCode(e.target.value)}
                      className="font-mono tracking-[0.18em]"
                      data-autofocus
                    />
                  </Field>
                  <Button onClick={confirm} loading={confirming}>
                    <Check className="h-4 w-4" /> Activează
                  </Button>
                  <Button variant="ghost" onClick={() => setSetup(null)}>
                    Anulează
                  </Button>
                </div>
              </div>
            </div>
          ) : enabled ? (
            <div className="space-y-4">
              <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-muted">Activă din</dt>
                  <dd className="mt-0.5 font-medium">{fmtDateTime(enabledAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted">Coduri de recuperare rămase</dt>
                  <dd className={`mt-0.5 font-medium ${recoveryLeft <= 2 ? "text-warn" : ""}`}>
                    {recoveryLeft} din 8
                    {recoveryLeft <= 2 && " · regenerează-le"}
                  </dd>
                </div>
              </dl>
              <p className="text-[13px] leading-relaxed text-muted">
                Codurile de recuperare deschid contul dacă pierzi telefonul. Fiecare cod merge o singură dată.
              </p>
              <div className="flex flex-wrap gap-2 border-t border-border/70 pt-4">
                <Button variant="outline" onClick={() => setAction("regenerate")}>
                  <RotateCcw className="h-4 w-4" /> Regenerează codurile de recuperare
                </Button>
                <Button variant="dangerOutline" onClick={() => setAction("disable")}>
                  <ShieldOff className="h-4 w-4" /> Dezactivează 2FA
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lime-brand/25 text-primary dark:bg-lime-brand/15">
                  <Smartphone className="h-5 w-5" />
                </span>
                <p className="text-[13px] leading-relaxed text-foreground/85">
                  Pe lângă parolă, contul tău va cere un cod de 6 cifre generat de o aplicație de pe
                  telefon. Configurarea durează un minut și e obligatorie pentru stratul financiar.
                </p>
              </div>
              <Button onClick={start} loading={starting}>
                <ShieldCheck className="h-4 w-4" /> Configurează 2FA
              </Button>
            </div>
          )}
        </Card>

        {isAdmin && (
          <Card title="Resetare 2FA pentru colegi">
            {colleagues.length === 0 ? (
              <Empty compact text="Niciun coleg nu are 2FA configurat încă" />
            ) : (
              <ul className="divide-y divide-border/70">
                {colleagues.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-2 text-[13px]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted">
                        @{c.username} · activ din {fmtDateTime(c.enabledAt)}
                      </span>
                    </span>
                    <Button size="sm" variant="dangerOutline" onClick={() => setResetTarget(c)}>
                      Resetează
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 border-t border-border/70 pt-3 text-xs leading-relaxed text-muted">
              Pentru un coleg care și-a pierdut telefonul: după resetare își configurează 2FA din nou.
              Acțiunea se scrie în jurnalul de audit.
            </p>
          </Card>
        )}
      </div>

      <Card
        title={
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted" /> Stratul financiar
          </span>
        }
      >
        {financePermission ? (
          <ul className="space-y-3 text-[13px] leading-relaxed text-foreground/85">
            <li className="flex gap-2.5">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <span>
                Bordul Finanțe, plățile, account-urile, tranzacțiile, rapoartele contabile, exportul lor și
                backup-ul se deschid doar cu <b>parola + codul 2FA</b>, din lacătul din bara de sus.
              </span>
            </li>
            <li className="flex gap-2.5">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <span>
                Deblocarea ține <b>{FINANCE_UNLOCK_MINUTES} minute</b>, apoi se închide singură. O poți
                închide oricând din același lacăt.
              </span>
            </li>
            <li className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <span>
                Cât e blocat, nici administratorul nu vede mai mult decât un angajat obișnuit. Ceilalți
                angajați lucrează normal cu clienții, fără nicio urmă a datelor financiare.
              </span>
            </li>
            {!enabled && (
              <li className="rounded-lg border border-warn/30 bg-warn/[0.08] px-3 py-2 text-warn">
                Ai permisiuni financiare, dar fără 2FA stratul rămâne blocat. Configurează-l din stânga.
              </li>
            )}
          </ul>
        ) : (
          <p className="text-[13px] leading-relaxed text-muted">
            Rolul tău nu include modulele financiare. Poți configura 2FA pentru contul tău oricum.
          </p>
        )}
      </Card>

      <CredentialsModal
        open={action === "disable"}
        title="Dezactivează 2FA"
        description="Confirmă cu parola și un cod din aplicație. Contul rămâne fără al doilea pas, iar stratul financiar se blochează."
        confirmLabel="Dezactivează"
        danger
        onClose={() => setAction(null)}
        onSubmit={async (c) => {
          const res = await disableTotp(c);
          if (!res.ok) return res.error ?? "Eroare";
          toast.success("2FA dezactivat");
          setAction(null);
          router.refresh();
          return null;
        }}
      />
      <CredentialsModal
        open={action === "regenerate"}
        title="Coduri de recuperare noi"
        description="Codurile vechi nu vor mai funcționa. Confirmă cu parola și un cod din aplicație."
        confirmLabel="Generează"
        onClose={() => setAction(null)}
        onSubmit={async (c) => {
          const res = await regenerateRecoveryCodes(c);
          if (!res.ok) return res.error;
          setAction(null);
          setCodes(res.recoveryCodes);
          return null;
        }}
      />
      <ConfirmDialog
        open={resetTarget != null}
        onClose={() => setResetTarget(null)}
        onConfirm={reset}
        loading={resetting}
        title={`Resetezi 2FA pentru ${resetTarget?.name ?? ""}?`}
        message="Colegul va putea intra cu parola și va trebui să configureze 2FA din nou înainte de a debloca finanțele."
        confirmLabel="Resetează"
      />
    </div>
  );
}

/* ───────────── codurile de recuperare, afișate o singură dată ───────────── */

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Nu am putut copia. Notează codurile manual.");
    }
  }
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="rounded-lg border border-warn/30 bg-warn/[0.08] px-3.5 py-3 text-[13px] leading-relaxed">
        <b>Salvează aceste coduri acum.</b> Nu vor mai fi afișate. Fiecare deschide contul o singură dată
        dacă rămâi fără telefon.
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {codes.map((c) => (
          <li key={c} className="rounded-lg border border-border bg-subtle px-2.5 py-2 text-center font-mono text-[13px] font-semibold tracking-wider">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={copy}>
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copiat" : "Copiază codurile"}
        </Button>
        <Button onClick={onDone}>
          <Check className="h-4 w-4" /> Am salvat codurile
        </Button>
      </div>
    </div>
  );
}

/* ───────────── parolă + cod pentru acțiunile sensibile ───────────── */

function CredentialsModal({
  open,
  title,
  description,
  confirmLabel,
  danger,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  /** întoarce mesajul de eroare sau null la succes */
  onSubmit: (c: Credentials) => Promise<string | null>;
}) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!password || !code.trim()) return setError("Completează parola și codul.");
    setPending(true);
    setError(null);
    const err = await onSubmit({ password, code });
    setPending(false);
    if (err) {
      setError(err);
      setCode("");
      return;
    }
    setPassword("");
    setCode("");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={420}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Anulează
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={submit} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5" onKeyDown={(e) => e.key === "Enter" && submit()}>
        <p className="text-[13px] leading-relaxed text-muted">{description}</p>
        <Field label="Parola ta">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-autofocus
          />
        </Field>
        <Field label="Cod din aplicație" help="sau un cod de recuperare">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123 456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono tracking-[0.18em]"
          />
        </Field>
        {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
