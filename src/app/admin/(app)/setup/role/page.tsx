import Link from "next/link";
import { Eye } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { Badge, Card } from "@/components/ui/Misc";
import { PageHeader } from "@/components/layout/PageHeader";
import { RoleCreateButton } from "./RoleCreateButton";

export const metadata = { title: "Roluri și Permisiuni — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function RolesPage() {
  await requireUser();
  const roles = await prisma.role.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { permissions: true, staff: true } } },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lista Rolurilor"
        subtitle={`${roles.length} roluri · permisiunile se configurează pe fiecare rol`}
        actions={<RoleCreateButton />}
      />
      <Card flush>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border bg-subtle/60 text-left text-xs text-muted">
              <th className="px-4 py-2 font-medium">ID</th>
              <th className="px-4 py-2 font-medium">Nume</th>
              <th className="px-4 py-2 font-medium">Permisiuni</th>
              <th className="px-4 py-2 font-medium">Angajați</th>
              <th className="px-4 py-2 font-medium">Creat la</th>
              <th className="w-px px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="border-b border-border/70 transition-colors last:border-0 hover:bg-subtle/60">
                <td className="px-4 py-2 font-mono text-xs text-muted">{r.id}</td>
                <td className="px-4 py-2">
                  <Link
                    href={`/admin/setup/role/${r.id}`}
                    className="font-medium underline-offset-4 transition-colors hover:text-primary hover:underline"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <Badge color="gray">{r._count.permissions}</Badge>
                </td>
                <td className="px-4 py-2 tabular-nums">{r._count.staff}</td>
                <td className="px-4 py-2 tabular-nums text-muted">{fmtDateTime(r.createdAt)}</td>
                <td className="px-3 py-1.5 text-right">
                  <Link
                    href={`/admin/setup/role/${r.id}`}
                    title="Vezi"
                    aria-label="Vezi"
                    className="inline-grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
