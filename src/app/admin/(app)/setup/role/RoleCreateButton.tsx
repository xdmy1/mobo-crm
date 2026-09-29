"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createRole } from "@/server/actions/roles";

export function RoleCreateButton() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <>
      <Button variant="create" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Adaugă Rol Nou
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Adaugă Rol Nou"
        width={400}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Anulează
            </Button>
            <Button
              loading={saving}
              onClick={async () => {
                setSaving(true);
                const res = await createRole(name);
                setSaving(false);
                if (!res.ok) return toast.error(res.error ?? "Eroare");
                toast.success("Rol creat");
                setOpen(false);
                setName("");
                if (res.id) router.push(`/admin/setup/role/${res.id}`);
              }}
            >
              Creează
            </Button>
          </>
        }
      >
        <Field label="Nume rol" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
      </Modal>
    </>
  );
}
