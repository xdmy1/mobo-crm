"use client";

// „Ce urmează?” — următoarea acțiune pe client, setată din două click-uri.
// În ziua respectivă clientul apare pe dashboard la „De urmărit”, deci nimeni nu mai ține minte pe hârtie.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Pencil } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { setNextAction } from "@/server/actions/assist";
import { fmtDate, ymdChisinau } from "@/lib/format";
import { cn } from "@/lib/cn";

const DAY = 86_400_000;
const QUICK: Array<{ label: string; days: number; tip: string }> = [
  { label: "Azi", days: 0, tip: "Îți apare azi pe dashboard" },
  { label: "Mâine", days: 1, tip: "Îți apare mâine pe dashboard" },
  { label: "+3 zile", days: 3, tip: "Peste 3 zile" },
  { label: "+1 săpt.", days: 7, tip: "Peste o săptămână" },
];

export function NextAction({
  contactId,
  text,
  date,
}: {
  contactId: number;
  text: string | null;
  /** ISO */
  date: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text ?? "");

  // „azi” și „mâine” se citesc o singură dată, la montare (randarea rămâne pură)
  const [today] = useState(() => ymdChisinau());
  const [tomorrow] = useState(() => ymdChisinau(new Date(Date.now() + DAY)));
  const day = date ? ymdChisinau(date) : null;
  const overdue = !!day && day < today;
  const when = !day ? null : day === today ? "Azi" : day === tomorrow ? "Mâine" : fmtDate(date);

  function save(nextText: string | null, nextDate: string | null, done?: string) {
    startTransition(async () => {
      const res = await setNextAction(contactId, nextText, nextDate);
      if (!res.ok) return void toast.error(res.error ?? "Eroare");
      if (done) toast.success(done);
      setEditing(false);
      router.refresh();
    });
  }

  if (day && !editing) {
    return (
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
          overdue ? "border-danger/30 bg-danger/[0.06]" : "border-border bg-subtle/60"
        )}
      >
        <CalendarClock className={cn("mt-0.5 h-4 w-4 shrink-0", overdue ? "text-danger" : "text-primary")} />
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-semibold", overdue ? "text-danger" : "text-foreground")}>
            {overdue ? `Întârziat · ${when}` : when}
          </p>
          <p className="break-words text-[13px] text-foreground/85">{text || "Revin la client"}</p>
        </div>
        <button
          onClick={() => save(null, null, "Făcut — acțiunea a fost închisă")}
          disabled={pending}
          title="Am făcut-o — închide acțiunea"
          className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted transition-[background-color,color,transform] duration-150 hover:bg-success/10 hover:text-success active:scale-90"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={() => {
            setDraft(text ?? "");
            setEditing(true);
          }}
          title="Schimbă acțiunea sau data"
          className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted transition-[background-color,color,transform] duration-150 hover:bg-foreground/[0.07] hover:text-foreground active:scale-90"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border-strong/80 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <CalendarClock className="h-3.5 w-3.5" /> Ce urmează cu acest client?
      </p>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="ex. sună pentru măsurare"
        className="h-8 text-[13px]"
      />
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button
            key={q.label}
            disabled={pending}
            title={q.tip}
            onClick={() =>
              save(draft, ymdChisinau(new Date(Date.now() + q.days * DAY)), `Notat pentru ${q.label.toLowerCase()}`)
            }
            className="h-7 cursor-pointer rounded-md border border-border-strong/70 bg-card px-2 text-xs font-medium shadow-xs transition-[background-color,border-color,transform] duration-150 hover:border-border-strong hover:bg-subtle active:scale-95 disabled:opacity-50"
          >
            {q.label}
          </button>
        ))}
        <input
          type="date"
          min={today}
          title="Alege altă dată"
          onChange={(e) => e.target.value && save(draft, e.target.value, `Notat pentru ${fmtDate(e.target.value)}`)}
          className="h-7 w-[118px] cursor-pointer rounded-md border border-border-strong/70 bg-card px-1.5 text-xs shadow-xs"
        />
        {editing && (
          <button onClick={() => setEditing(false)} className="h-7 cursor-pointer px-1.5 text-xs text-muted hover:text-foreground">
            Renunță
          </button>
        )}
      </div>
    </div>
  );
}
