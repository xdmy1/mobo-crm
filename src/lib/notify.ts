import webpush from "web-push";
import { prisma } from "./db";

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@mobo.md",
      pub,
      priv
    );
    vapidConfigured = true;
  }
}

/** Creează o notificare in-app + trimite Web Push către abonamentele utilizatorului. */
export async function notify(
  staffId: number | null | undefined,
  text: string,
  link?: string
) {
  if (!staffId) return;
  await prisma.notification.create({ data: { staffId, text, link } });

  ensureVapid();
  if (!vapidConfigured) return;
  const subs = await prisma.pushSubscription.findMany({ where: { staffId } });
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({ title: "MOBO CRM", body: text, url: link || "/admin/calendar" })
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => {});
        }
      }
    })
  );
}
