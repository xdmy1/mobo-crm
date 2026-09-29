import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmailConfigForm } from "./EmailConfigForm";

export const metadata = { title: "Configurare Email — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function EmailConfigPage() {
  await requireUser();
  const cfg = await prisma.emailConfig.findUnique({ where: { id: 1 } });
  return (
    <EmailConfigForm
      config={{
        host: cfg?.host ?? "",
        port: cfg?.port ?? 587,
        user: cfg?.user ?? "",
        pass: cfg?.pass ?? "",
        from: cfg?.from ?? "",
        secure: cfg?.secure ?? false,
      }}
    />
  );
}
