import { requireUser } from "@/lib/auth";
import { getList, type ListParams } from "@/server/lists";
import {
  departmentOptions,
  designationOptions,
  employmentStatusOptions,
  roleOptions,
  shiftOptions,
} from "@/server/options";
import { ListShell } from "@/components/table/ListShell";
import type { FormConfig } from "@/lib/listTypes";

export const metadata = { title: "Lista Angajați — MOBO CRM" };
export const dynamic = "force-dynamic";

export default async function StaffsPage({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireUser();
  const params = await searchParams;
  const [list, departments, designations, statuses, shifts, roles] =
    await Promise.all([
      getList("staff", params),
      departmentOptions(),
      designationOptions(),
      employmentStatusOptions(),
      shiftOptions(),
      roleOptions(),
    ]);

  const form: FormConfig = {
    title: "Creează Angajat",
    entity: "staff",
    fields: [
      { name: "firstName", label: "Prenume", type: "text", required: true, section: "Informație utilizator" },
      { name: "lastName", label: "Nume", type: "text", required: true },
      { name: "username", label: "Nume utilizator", type: "text", required: true },
      { name: "password", label: "Parolă (lasă gol pentru a păstra)", type: "password" },
      { name: "email", label: "Email", type: "email" },
      { name: "street", label: "Strada", type: "text", section: "Informația de adresă" },
      { name: "city", label: "Oraș", type: "text" },
      { name: "zipCode", label: "Cod poștal", type: "text" },
      { name: "country", label: "Țară", type: "text" },
      { name: "joinDate", label: "Data alăturării", type: "date", section: "Informație angajat" },
      { name: "leaveDate", label: "Data plecării", type: "date" },
      { name: "employeeId", label: "ID Angajat", type: "text" },
      { name: "departmentId", label: "Departament", type: "select", options: departments },
      { name: "roleId", label: "Rol", type: "select", options: roles },
      { name: "designationId", label: "Desemnare", type: "select", options: designations },
      { name: "employmentStatusId", label: "Statusul angajatului", type: "select", options: statuses },
      { name: "shiftId", label: "Schimb / Tură", type: "select", options: shifts },
      { name: "active", label: "Activ", type: "checkbox", defaultValue: true },
    ],
  };

  return (
    <ListShell
      entity="staff"
      title="Lista Angajați"
      {...list}
      createForm={form}
      createLabel="Adaugă Angajat"
      editForm={form}
    />
  );
}
