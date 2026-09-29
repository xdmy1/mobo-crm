import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  const body = await req.json();
  const { endpoint, keys } = body ?? {};
  if (!endpoint || !keys?.p256dh || !keys?.auth)
    return NextResponse.json({ error: "Abonament invalid" }, { status: 400 });
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { staffId: user.id, p256dh: keys.p256dh, auth: keys.auth },
    create: { staffId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
  return NextResponse.json({ ok: true });
}
