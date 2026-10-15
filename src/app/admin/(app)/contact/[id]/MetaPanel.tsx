// Blocul „Meta” din fișa clientului: de unde a venit (formular Facebook / Messenger / Instagram DM),
// reclama și istoricul mesajelor primite prin webhook. Apare doar la clienții intrați din Meta.

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { MetaLeadKind, MetaPlatform } from "@prisma/client";
import { Badge, Collapse } from "@/components/ui/Misc";
import { MetaTile, PlatformLogo } from "@/components/meta/MetaBrand";

export interface MetaLeadView {
  id: number;
  kind: MetaLeadKind;
  platform: MetaPlatform;
  adName: string | null;
  adId: string | null;
  formId: string | null;
  createdText: string;
  /** Tip / Buget din formular */
  details: Array<{ label: string; value: string }>;
  messages: Array<{ id: number; text: string; whenText: string }>;
}

const INBOX_URL = "https://business.facebook.com/latest/inbox/all";

function kindLabel(kind: MetaLeadKind, platform: MetaPlatform): string {
  if (kind === "LEADGEN") return "Formular instant Facebook";
  return platform === "INSTAGRAM" ? "Instagram DM" : "Messenger";
}

export function MetaPanel({ leads }: { leads: MetaLeadView[] }) {
  if (leads.length === 0) return null;
  const messages = leads.reduce((n, l) => n + l.messages.length, 0);
  return (
    <Collapse
      title="Meta"
      icon={<MetaTile size="sm" className="shadow-none" />}
      defaultOpen
      count={messages || undefined}
      extra={
        <Link href="/admin/meta" className="text-[12px] font-medium text-muted hover:text-foreground">
          toate lead-urile din Meta Ads
        </Link>
      }
    >
      <div className="divide-y divide-border">
        {leads.map((lead) => (
          <div key={lead.id} className="flex gap-3 px-4 py-3">
            <PlatformLogo platform={lead.platform} className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]">
                <Badge color={lead.kind === "LEADGEN" ? "blue" : lead.platform === "INSTAGRAM" ? "amber" : "gray"} dot>
                  {kindLabel(lead.kind, lead.platform)}
                </Badge>
                <span className="text-muted">
                  {lead.adName ? `Reclamă: ${lead.adName}` : lead.adId ? `Reclamă ${lead.adId}` : "fără reclamă (organic)"}
                </span>
                <span className="text-muted">· {lead.createdText}</span>
                {lead.kind === "MESSAGE" && (
                  <a
                    href={INBOX_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-info hover:underline"
                  >
                    Răspunde în Inbox <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {lead.details.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {lead.details.map((d) => (
                    <span key={d.label} className="rounded-md bg-foreground/[0.06] px-2 py-0.5 text-[12px]">
                      {d.label}: {d.value}
                    </span>
                  ))}
                </div>
              )}
              {lead.messages.length > 0 && (
                <ol className="space-y-1.5">
                  {lead.messages.map((m) => (
                    <li key={m.id} className="flex items-start gap-2 text-[13px]">
                      <span className="mt-0.5 shrink-0 text-[11px] tabular-nums text-muted">{m.whenText}</span>
                      <span className="rounded-lg rounded-tl-sm bg-subtle px-2.5 py-1">{m.text}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        ))}
      </div>
    </Collapse>
  );
}
