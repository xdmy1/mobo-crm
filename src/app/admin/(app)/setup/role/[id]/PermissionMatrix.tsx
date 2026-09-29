"use client";

// Matricea vizuală rol × modul [NOU] — Vizualizare / Creare / Editare / Ștergere.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Misc";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { Checkbox } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { deleteRole, setRolePermissions } from "@/server/actions/roles";

const ACTIONS: Array<{ key: string; label: string; perms: (m: string) => string[] }> = [
  { key: "read", label: "Vizualizare", perms: (m) => [`readAll-${m}`, `readSingle-${m}`] },
  { key: "create", label: "Creare", perms: (m) => [`create-${m}`] },
  { key: "update", label: "Editare", perms: (m) => [`update-${m}`] },
  { key: "delete", label: "Ștergere", perms: (m) => [`delete-${m}`] },
];

export function PermissionMatrix({
  roleId,
  roleName,
  modules,
  granted: initialGranted,
}: {
  roleId: number;
  roleName: string;
  modules: Array<{ key: string; label: string }>;
  granted: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [granted, setGranted] = useState<Set<string>>(new Set(initialGranted));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isChecked = (mod: string, action: (typeof ACTIONS)[number]) =>
    action.perms(mod).every((p) => granted.has(p));

  async function toggle(mod: string, action: (typeof ACTIONS)[number]) {
    const perms = action.perms(mod);
    const grant = !isChecked(mod, action);
    setGranted((s) => {
      const n = new Set(s);
      for (const p of perms) {
        if (grant) n.add(p);
        else n.delete(p);
      }
      return n;
    });
    const res = await setRolePermissions(roleId, perms, grant);
    if (!res.ok) {
      toast.error(res.error ?? "Eroare");
      router.refresh();
    }
  }

  async function toggleRow(mod: string) {
    const all = ACTIONS.flatMap((a) => a.perms(mod));
    const grant = !all.every((p) => granted.has(p));
    setGranted((s) => {
      const n = new Set(s);
      for (const p of all) {
        if (grant) n.add(p);
        else n.delete(p);
      }
      return n;
    });
    const res = await setRolePermissions(roleId, all, grant);
    if (!res.ok) {
      toast.error(res.error ?? "Eroare");
      router.refresh();
    }
  }

  const totalGranted = useMemo(() => granted.size, [granted]);

  return (
    <Card
      title={`ID: ${roleId} · ${roleName}`}
      extra={
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{totalGranted} permisiuni active</span>
          <Button
            variant="dangerOutline"
            size="sm"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" /> Șterge rolul
          </Button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="py-2 pr-3 font-medium">Modul</th>
              <th className="w-16 py-2 text-center font-medium">Tot</th>
              {ACTIONS.map((a) => (
                <th key={a.key} className="w-28 py-2 text-center font-medium">
                  {a.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr
                key={m.key}
                className="border-b border-border/70 last:border-0 hover:bg-subtle/60"
              >
                <td className="py-2 pr-3 font-medium">{m.label}</td>
                <td className="py-2 text-center">
                  <Checkbox
                    checked={ACTIONS.every((a) => isChecked(m.key, a))}
                    onChange={() => toggleRow(m.key)}
                  />
                </td>
                {ACTIONS.map((a) => (
                  <td key={a.key} className="py-2 text-center">
                    <Checkbox
                      checked={isChecked(m.key, a)}
                      onChange={() => toggle(m.key, a)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const res = await deleteRole(roleId);
          setConfirmDelete(false);
          if (!res.ok) return toast.error(res.error ?? "Eroare");
          toast.success("Rol șters");
          router.push("/admin/setup/role");
        }}
        title="Șterge rolul"
        message={
          <>
            Sigur ștergi rolul <b>{roleName}</b> și toate permisiunile lui?
          </>
        }
      />
    </Card>
  );
}
