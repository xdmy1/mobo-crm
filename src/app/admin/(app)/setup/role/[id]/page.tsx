import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PermissionMatrix } from "./PermissionMatrix";

export const dynamic = "force-dynamic";

// etichete prietenoase pentru module
const MODULE_LABELS: Record<string, string> = {
  contact: "Clienți (Persoane Fizice)",
  company: "Persoane Juridice",
  opportunity: "Proiecte",
  quote: "Estimări",
  product: "Produse",
  productCategory: "Categorii Produse",
  contract: "Contracte",
  offer: "Oferte",
  note: "Mesaje",
  attachment: "Atașamente",
  task: "Sarcini",
  email: "Email",
  dashboard: "Bord Central",
  finances: "Bord Finanțe",
  calendar: "Calendar",
  staff: "Angajați",
  role: "Roluri",
  permission: "Permisiuni",
  rolePermission: "Permisiuni pe rol",
  account: "Account-uri",
  transaction: "Tranzacții",
  room: "Camere",
  setup: "Setup / Nomenclatoare",
  calcSettings: "Setări de Calcule",
  notification: "Notificări",
  announcement: "Anunțuri",
  award: "Premii",
  organization: "Organizație",
};

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const roleId = parseInt(id, 10);
  if (isNaN(roleId)) notFound();

  const [role, allPermissions] = await Promise.all([
    prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    }),
    prisma.permission.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!role) notFound();

  const granted = new Set(role.permissions.map((rp) => rp.permission.name));
  const modules = new Map<string, string>();
  for (const p of allPermissions) {
    const mod = p.name.split("-").slice(1).join("-");
    if (!modules.has(mod)) modules.set(mod, MODULE_LABELS[mod] ?? mod);
  }

  return (
    <PermissionMatrix
      roleId={role.id}
      roleName={role.name}
      modules={[...modules.entries()].map(([key, label]) => ({ key, label }))}
      granted={[...granted]}
    />
  );
}
