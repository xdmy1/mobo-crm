import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { OrganizationForm } from "./OrganizationForm";

export const metadata = { title: "Organizație — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function OrganizationPage() {
  await requireUser();
  const org = await prisma.organization.findUnique({ where: { id: 1 } });
  return (
    <OrganizationForm
      org={{
        name: org?.name ?? "Mobo kitchens & home",
        idno: org?.idno ?? "",
        vatCode: org?.vatCode ?? "",
        address: org?.address ?? "",
        phone: org?.phone ?? "",
        email: org?.email ?? "",
        iban: org?.iban ?? "",
        bic: org?.bic ?? "",
        bankName: org?.bankName ?? "",
        partnerPercent: org?.partnerPercent ?? 10,
        designerPercent: org?.designerPercent ?? 5,
        qcDefault: org?.qcDefault ?? 1200,
      }}
    />
  );
}
