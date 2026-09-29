"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { saveRecord } from "@/server/actions/crud";
import type { SelectOption } from "@/lib/listTypes";

export function TaskComments({
  taskId,
  staff,
}: {
  taskId: number;
  staff: SelectOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [recipient, setRecipient] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-subtle/60 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Titlu" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Notifică (opțional)">
          <Select value={recipient} onChange={setRecipient} options={staff} />
        </Field>
      </div>
      <Field label="Comentariu">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <Button
        size="sm"
        loading={saving}
        onClick={async () => {
          if (!title.trim()) return toast.error("Titlul este obligatoriu.");
          setSaving(true);
          const res = await saveRecord("note", null, {
            title,
            body,
            recipientId: recipient,
            taskId: String(taskId),
          });
          setSaving(false);
          if (!res.ok) return toast.error(res.error ?? "Eroare");
          toast.success("Comentariu adăugat");
          setTitle("");
          setBody("");
          setRecipient(null);
          router.refresh();
        }}
      >
        <Send className="h-4 w-4" /> Adaugă comentariu
      </Button>
    </div>
  );
}
