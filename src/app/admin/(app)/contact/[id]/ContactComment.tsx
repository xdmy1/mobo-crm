"use client";

// „Comentariu” — sus în fișa clientului, sub nume: primul lucru pe care îl vede cine o deschide.
// A luat locul lui „Ce urmează?” (etapa se schimbă deja din bara de parcurs).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { saveRecord } from "@/server/actions/crud";

export function ContactComment({ contactId, value }: { contactId: number; value: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  function open() {
    setDraft(value ?? "");
    setEditing(true);
  }

  function save() {
    const next = draft.trim();
    if (next === (value ?? "").trim()) return setEditing(false);
    startTransition(async () => {
      const res = await saveRecord("contact", contactId, { comment: next || null });
      if (!res.ok) return void toast.error(res.error ?? "Eroare la salvare");
      toast.success(next ? "Comentariu salvat" : "Comentariu șters");
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-lg border border-warn/45 bg-warn/[0.07] p-2.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          <MessageSquareText className="h-3.5 w-3.5 text-warn" /> Comentariu
        </p>
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
            if (e.key === "Escape") {
              e.stopPropagation();
              setEditing(false);
            }
          }}
          placeholder="ex. vrea bucătărie albă, revine după renovare în martie"
          className="min-h-[96px] bg-card text-[13px]"
        />
        <div className="flex items-center justify-end gap-1.5">
          <span className="mr-auto text-[11px] text-muted">⌘↵ salvează</span>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
            Renunță
          </Button>
          <Button size="sm" variant="outline" onClick={save} loading={pending}>
            Salvează
          </Button>
        </div>
      </div>
    );
  }

  if (!value?.trim()) {
    return (
      <button
        type="button"
        onClick={open}
        title="Scrie ce trebuie să știe oricine deschide fișa"
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border-strong/80 px-3 py-2.5 text-left text-[13px] text-muted transition-[background-color,border-color,color] duration-150 hover:border-warn/60 hover:bg-warn/[0.05] hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" /> Adaugă un comentariu
      </button>
    );
  }

  return (
    <div className="group relative rounded-lg border border-warn/45 bg-warn/[0.08] px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <MessageSquareText className="h-3.5 w-3.5 text-warn" /> Comentariu
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words pr-6 text-[13px] leading-relaxed text-foreground/90">{value}</p>
      <button
        type="button"
        onClick={open}
        title="Editează comentariul"
        className="absolute right-1.5 top-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-md text-muted transition-[background-color,color,transform] duration-150 hover:bg-foreground/[0.07] hover:text-foreground active:scale-90"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
