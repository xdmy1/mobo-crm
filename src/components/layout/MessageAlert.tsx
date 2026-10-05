"use client";

// Mesajele primite stau pe ecran până când destinatarul apasă „Am citit” sau „Deschide” —
// clopoțelul singur se scapă ușor („să nu fie scăpare, e important”).
// Cu tabul în fundal: notificare de sistem (dacă e permisă) și „(1)” în titlul tabului.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Check, MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/Misc";
import { Button } from "@/components/ui/Button";
import { getUnreadMessages, markMessageRead, type UnreadMessage } from "@/server/actions/messages";
import { fmtDateTime } from "@/lib/format";

const POLL_MS = 20_000;

function ago(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "acum";
  if (min < 60) return `acum ${min} min`;
  return fmtDateTime(iso);
}

export function MessageAlert() {
  const router = useRouter();
  const [items, setItems] = useState<UnreadMessage[]>([]);
  const [total, setTotal] = useState(0);
  // înainte de primul mesaj componenta nu randează nimic, deci valoarea diferită de pe server nu contează
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const seen = useRef<Set<number> | null>(null);
  const baseTitle = useRef<string | null>(null);

  const load = useCallback(
    () =>
      getUnreadMessages()
        .then((res) => {
          setItems(res.items);
          setTotal(res.total);
          // la prima încărcare doar memorăm ce există; notificăm doar ce sosește după
          const fresh = seen.current ? res.items.filter((m) => !seen.current!.has(m.id)) : [];
          seen.current = new Set([...(seen.current ?? []), ...res.items.map((m) => m.id)]);
          if (!fresh.length || !document.hidden) return;
          if (!("Notification" in window) || Notification.permission !== "granted") return;
          for (const m of fresh) {
            const n = new Notification(`Mesaj de la ${m.author}`, {
              body: [m.title, m.where].filter(Boolean).join(" · "),
              icon: "/icon-192.png",
              tag: `note-${m.id}`,
            });
            n.onclick = () => {
              window.focus();
              router.push(m.link);
              n.close();
            };
          }
        })
        .catch(() => {}),
    [router]
  );

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    const onVisible = () => !document.hidden && load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  // „(2) …” în titlul tabului cât timp există mesaje necitite
  useEffect(() => {
    const strip = (t: string) => t.replace(/^\(\d+\)\s+/, "");
    baseTitle.current = strip(document.title);
    document.title = total > 0 ? `(${total}) ${baseTitle.current}` : baseTitle.current;
  }, [total, items]);

  async function acknowledge(m: UnreadMessage, open: boolean) {
    setItems((list) => list.filter((x) => x.id !== m.id));
    setTotal((n) => Math.max(0, n - 1));
    await markMessageRead(m.id);
    if (open) router.push(m.link);
    load();
  }

  async function askPermission() {
    const p = await Notification.requestPermission();
    setPermission(p);
  }

  if (!items.length) return null;
  const more = total - items.length;

  return (
    <div
      role="region"
      aria-label="Mesaje necitite"
      className="pointer-events-none fixed right-3 top-[68px] z-[90] flex w-[calc(100%-1.5rem)] max-w-[380px] flex-col gap-2"
    >
      {items.map((m) => (
        <div
          key={m.id}
          role="alert"
          className="pointer-events-auto origin-top-right animate-menu-in overflow-hidden rounded-xl border border-border bg-card shadow-pop"
        >
          <div className="flex items-center gap-2 border-b border-border bg-warn/[0.09] px-3.5 py-2">
            <MessageSquare className="h-3.5 w-3.5 text-warn" />
            <span className="text-xs font-semibold">Mesaj nou pentru tine</span>
            <span className="ml-auto text-[11px] text-muted">{ago(m.createdAt)}</span>
          </div>
          <div className="flex gap-3 px-3.5 pt-3">
            <Avatar name={m.author} size={32} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-muted">
                <span className="font-semibold text-foreground">{m.author}</span>
                {m.where && <> · {m.where}</>}
              </p>
              <p className="mt-1 break-words text-[14px] font-semibold leading-snug">{m.title}</p>
              {m.body && (
                <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground/80">
                  {m.body}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-1.5 px-3.5 pb-3 pt-3">
            <Button size="sm" variant="ghost" onClick={() => acknowledge(m, false)} title="Confirmă că ai citit mesajul">
              <Check className="h-3.5 w-3.5" /> Am citit
            </Button>
            <Button size="sm" variant="outline" onClick={() => acknowledge(m, true)} title="Deschide pagina pe care e mesajul">
              Deschide
            </Button>
          </div>
        </div>
      ))}
      {(more > 0 || permission === "default") && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted shadow-sm">
          {more > 0 && <span>+{more} {more === 1 ? "mesaj necitit" : "mesaje necitite"}</span>}
          {permission === "default" && (
            <button
              type="button"
              onClick={askPermission}
              title="Primești mesajele ca notificare de sistem, chiar dacă tabul CRM e în fundal"
              className="ml-auto flex cursor-pointer items-center gap-1 font-medium text-foreground hover:underline"
            >
              <BellRing className="h-3.5 w-3.5" /> Anunță-mă și pe desktop
            </button>
          )}
        </div>
      )}
    </div>
  );
}
