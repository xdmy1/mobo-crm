"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Misc";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { saveRecord } from "@/server/actions/crud";
import type { SelectOption } from "@/lib/listTypes";

export function StaffNewForm({
  departments,
  roles,
}: {
  departments: SelectOption[];
  roles: SelectOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit() {
    if (!v.firstName || !v.lastName || !v.username || !v.password) {
      toast.error("Prenume, Nume, Nume utilizator și Parola sunt obligatorii.");
      return;
    }
    setSaving(true);
    const res = await saveRecord("staff", null, { ...v, active: true });
    setSaving(false);
    if (!res.ok) return toast.error(res.error ?? "Eroare");
    toast.success("Angajat creat");
    router.push("/admin/setup/staffs");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-[22px] font-semibold leading-8 tracking-tight">Adaugă Utilizator Nou</h1>

      <Card title="Informație utilizator">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Prenume" required>
            <Input onChange={set("firstName")} />
          </Field>
          <Field label="Nume" required>
            <Input onChange={set("lastName")} />
          </Field>
          <Field label="Nume utilizator" required>
            <Input onChange={set("username")} autoComplete="off" />
          </Field>
          <Field label="Parolă" required>
            <Input type="password" onChange={set("password")} autoComplete="new-password" />
          </Field>
          <Field label="Email">
            <Input type="email" onChange={set("email")} />
          </Field>
        </div>
      </Card>

      <Card title="Informația de adresă">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Strada">
            <Input onChange={set("street")} />
          </Field>
          <Field label="Oraș">
            <Input onChange={set("city")} />
          </Field>
          <Field label="Cod poștal">
            <Input onChange={set("zipCode")} />
          </Field>
          <Field label="Țară">
            <Input onChange={set("country")} />
          </Field>
        </div>
      </Card>

      <Card title="Informație angajat">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Data alăturării">
            <Input type="date" onChange={set("joinDate")} />
          </Field>
          <Field label="Data plecării">
            <Input type="date" onChange={set("leaveDate")} />
          </Field>
          <Field label="ID Angajat">
            <Input onChange={set("employeeId")} />
          </Field>
          <Field label="Departament">
            <Select
              value={v.departmentId ?? null}
              onChange={(x) => setV((s) => ({ ...s, departmentId: x }))}
              options={departments}
              placeholder="Selectează departament"
            />
          </Field>
          <Field label="Rol">
            <Select
              value={v.roleId ?? null}
              onChange={(x) => setV((s) => ({ ...s, roleId: x }))}
              options={roles}
              placeholder="Vă rog selectați"
            />
          </Field>
        </div>
      </Card>

      <Button onClick={submit} loading={saving} size="lg">
        <UserPlus className="h-4 w-4" /> Adaugă Lucrător Nou
      </Button>
    </div>
  );
}
