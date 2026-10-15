import { NextRequest, NextResponse, after } from "next/server";
import { verifyMetaSignature } from "@/lib/meta/signature";
import { processMetaWebhook } from "@/server/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook Meta — Facebook Lead Ads (`leadgen`), Messenger și Instagram DM (`messages`,
 * `messaging_postbacks`, `messaging_referrals`). Configurare: docs/meta-webhook.md.
 *
 * GET  = verificarea abonării (hub.mode / hub.verify_token / hub.challenge).
 * POST = livrarea evenimentelor: semnătura X-Hub-Signature-256 e validată pe body-ul brut,
 *        răspundem 200 imediat, iar procesarea rulează după răspuns (`after`).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const token = process.env.META_VERIFY_TOKEN;
  if (q.get("hub.mode") === "subscribe" && token && q.get("hub.verify_token") === token) {
    return new NextResponse(q.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "META_APP_SECRET nu este configurat" }, { status: 503 });

  const raw = new Uint8Array(await req.arrayBuffer());
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), secret)) {
    return NextResponse.json({ ok: false, error: "Semnătură invalidă" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.from(raw).toString("utf8"));
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalid" }, { status: 400 });
  }

  after(async () => {
    try {
      await processMetaWebhook(body);
    } catch (err) {
      console.error("[meta] procesarea webhook-ului a eșuat:", err);
    }
  });
  return NextResponse.json({ ok: true });
}
