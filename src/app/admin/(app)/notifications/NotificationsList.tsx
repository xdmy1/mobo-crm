"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Circle, CircleCheck, Trash2 } from "lucide-react";
import { Empty } from "@/components/ui/Misc";
import {
  deleteNotification,
  markNotificationRead,
} from "@/server/actions/notifications";

interface Item {
  id: number;
  text: string;
  link: string | null;
  read: boolean;
  when: string;
}

export function NotificationsList({
  items,
  filter,
}: {
  items: Item[];
  filter: string;
}) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-border bg-subtle p-0.5">
        {[
          { key: "all", label: "Toate" },
          { key: "unread", label: "Necitite" },
          { key: "read", label: "Citite" },
        ].map((f) => (
          <Link
            key={f.key}
            href={`/admin/notifications${f.key === "all" ? "" : `?filter=${f.key}`}`}
            className={`flex h-8 items-center rounded-md px-3 text-[13px] font-medium transition-colors ${
              filter === f.key
                ? "bg-card text-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <Empty text="Nu există notificări" />
      ) : (
        <ul className="-mx-4 divide-y divide-border/70 border-t border-border">
          {items.map((n) => (
            <li
              key={n.id}
              className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-subtle/60 ${n.read ? "" : "bg-lime-brand/[0.09]"}`}
            >
              <button
                title={n.read ? "Marchează necitit" : "Marchează citit"}
                onClick={async () => {
                  await markNotificationRead(n.id, !n.read);
                  router.refresh();
                }}
                className="mt-0.5 shrink-0 cursor-pointer text-muted transition-colors hover:text-foreground"
              >
                {n.read ? (
                  <CircleCheck className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4 fill-lime-brand text-[#9aa80c]" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                {n.link ? (
                  <Link href={n.link} className="text-[13px] font-medium underline-offset-4 hover:underline">
                    {n.text}
                  </Link>
                ) : (
                  <p className="text-[13px] font-medium">{n.text}</p>
                )}
                <p className="text-xs text-muted">{n.when}</p>
              </div>
              <button
                onClick={async () => {
                  await deleteNotification(n.id);
                  router.refresh();
                }}
                className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
