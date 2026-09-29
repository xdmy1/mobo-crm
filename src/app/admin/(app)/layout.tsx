import { requireUser, can } from "@/lib/auth";
import { financeUnlockedUntil, hasFinancePermission } from "@/lib/financeAccess";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const hasPermission = hasFinancePermission(user);
  const unlockedUntil = hasPermission && user.totpEnabled ? await financeUnlockedUntil() : null;
  return (
    <AppShell
      userName={user.fullName || user.username}
      userRole={user.roleName}
      canFinances={can(user, "readAll-finances")}
      finance={{ hasPermission, totpEnabled: user.totpEnabled, unlockedUntil }}
    >
      {children}
    </AppShell>
  );
}
