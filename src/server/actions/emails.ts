"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth";
import { sendEmail } from "@/lib/mail";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/lib/listTypes";

export async function sendCrmEmail(
  _id: number | null,
  values: Record<string, unknown>
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Neautentificat" };
  if (!can(user, "create-email"))
    return { ok: false, error: "Nu ai permisiunea necesară." };

  const to = String(values.to ?? "").trim();
  const subject = String(values.subject ?? "").trim();
  const body = String(values.body ?? "");
  if (!to || !subject)
    return { ok: false, error: "Destinatarul și subiectul sunt obligatorii." };

  const email = await prisma.email.create({
    data: {
      to,
      subject,
      body,
      staffId: user.id,
      contactId: values.contactId ? parseInt(String(values.contactId), 10) : null,
      companyId: values.companyId ? parseInt(String(values.companyId), 10) : null,
      opportunityId: values.opportunityId
        ? parseInt(String(values.opportunityId), 10)
        : null,
      quoteId: values.quoteId ? parseInt(String(values.quoteId), 10) : null,
      status: "PROGRAMAT",
    },
  });

  try {
    await sendEmail(to, subject, body);
    await prisma.email.update({
      where: { id: email.id },
      data: { status: "TRIMIS" },
    });
  } catch (e) {
    await prisma.email.update({
      where: { id: email.id },
      data: {
        status: "ESUAT",
        error: e instanceof Error ? e.message : "Eroare SMTP",
      },
    });
    revalidatePath("/admin/email");
    return {
      ok: false,
      error: `Emailul a fost salvat, dar trimiterea a eșuat: ${
        e instanceof Error ? e.message : "eroare SMTP"
      }`,
    };
  }

  await audit(user.id, "send", "email", email.id);
  revalidatePath("/admin/email");
  return { ok: true, id: email.id };
}
