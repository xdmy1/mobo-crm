import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { hasFinancePermission } from "@/lib/financeAccess";
import { PageHeader } from "@/components/layout/PageHeader";
import { personName } from "@/lib/people";
import { TwoFactorPanel } from "./TwoFactorPanel";

export const metadata = { title: "Securitate cont — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const user = await requireUser();
  const [me, colleagues] = await Promise.all([
    prisma.staff.findUnique({
      where: { id: user.id },
      select: { totpEnabledAt: true, totpRecoveryCodes: true },
    }),
    user.isAdmin
      ? prisma.staff.findMany({
          where: { totpEnabledAt: { not: null }, id: { not: user.id } },
          select: { id: true, firstName: true, lastName: true, username: true, totpEnabledAt: true },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Securitate cont"
        subtitle="Autentificarea în doi pași și accesul la stratul financiar"
      />
      <TwoFactorPanel
        enabledAt={me?.totpEnabledAt?.toISOString() ?? null}
        recoveryLeft={me?.totpRecoveryCodes.length ?? 0}
        financePermission={hasFinancePermission(user)}
        isAdmin={user.isAdmin}
        colleagues={colleagues.map((c) => ({
          id: c.id,
          name: personName(c),
          username: c.username,
          enabledAt: c.totpEnabledAt!.toISOString(),
        }))}
      />
    </div>
  );
}
