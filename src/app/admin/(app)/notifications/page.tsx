import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { Card } from "@/components/ui/Misc";
import { NotificationsList } from "./NotificationsList";

export const metadata = { title: "Notificări — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const filter = sp.filter;

  const notifications = await prisma.notification.findMany({
    where: {
      staffId: user.id,
      ...(filter === "unread" ? { read: false } : {}),
      ...(filter === "read" ? { read: true } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Toate notificările"
        subtitle={`${notifications.length} ${notifications.length === 1 ? "notificare" : "notificări"}`}
      />
      <Card>
        <NotificationsList
          filter={filter ?? "all"}
          items={notifications.map((n) => ({
            id: n.id,
            text: n.text,
            link: n.link,
            read: n.read,
            when: fmtDateTime(n.createdAt),
          }))}
        />
      </Card>
    </div>
  );
}
