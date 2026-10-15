"use client";

// Butoanele unui lead din „Meta Ads”: devine client doar la apăsarea „Creează client”; „Respinge” îl ascunde.

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArchiveRestore, ArrowUpRight, UserPlus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { archiveMetaLead, convertMetaLead } from "@/server/actions/meta";

export function MetaLeadActions({ id, contactId, archived }: { id: number; contactId: number | null; archived: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const convert = () =>
    startTransition(async () => {
      const res = await convertMetaLead(id);
      if (!res.ok) return void toast.error(res.error ?? "Eroare");
      toast.success("Client creat în Bord Vânzări (etapa Lead)");
      router.refresh();
      if (res.redirect) router.push(res.redirect);
    });
  const archive = (value: boolean) =>
    startTransition(async () => {
      const res = await archiveMetaLead(id, value);
      if (!res.ok) return void toast.error(res.error ?? "Eroare");
      toast.success(value ? "Lead respins" : "Lead readus în listă");
      router.refresh();
    });

  if (contactId) {
    return (
      <Link href={`/admin/contact/${contactId}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-strong/70 bg-card px-2.5 text-[13px] font-medium shadow-xs transition-colors hover:bg-subtle">
        Deschide clientul <ArrowUpRight className="h-3.5 w-3.5 text-muted" />
      </Link>
    );
  }
  if (archived) {
    return (
      <Button variant="outline" size="sm" loading={pending} onClick={() => archive(false)}>
        <ArchiveRestore className="h-3.5 w-3.5" /> Readu în listă
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="create" size="sm" loading={pending} onClick={convert}>
        <UserPlus className="h-3.5 w-3.5" /> Creează client
      </Button>
      <Button variant="ghost" size="sm" loading={pending} onClick={() => archive(true)} title="Lead greșit sau spam — îl ascunde din listă">
        <XCircle className="h-3.5 w-3.5" /> Respinge
      </Button>
    </div>
  );
}
