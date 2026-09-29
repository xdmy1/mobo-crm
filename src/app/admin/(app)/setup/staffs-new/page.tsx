import { requireUser } from "@/lib/auth";
import { departmentOptions, roleOptions } from "@/server/options";
import { StaffNewForm } from "./StaffNewForm";

export const metadata = { title: "Angajat Nou — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function StaffNewPage() {
  await requireUser();
  const [departments, roles] = await Promise.all([
    departmentOptions(),
    roleOptions(),
  ]);
  return <StaffNewForm departments={departments} roles={roles} />;
}
