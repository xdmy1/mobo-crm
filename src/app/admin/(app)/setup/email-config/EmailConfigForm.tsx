"use client";

import { useState } from "react";
import { Save, SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Misc";
import { Field, Input, Checkbox } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { saveEmailConfig, sendTestEmail } from "@/server/actions/settings";

interface Cfg {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

export function EmailConfigForm({ config }: { config: Cfg }) {
  const toast = useToast();
  const [v, setV] = useState<Cfg>(config);
  const [testTo, setTestTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  return (
    <Card title="Configurare Email (SMTP)">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Host SMTP" required>
          <Input
            value={v.host}
            onChange={(e) => setV({ ...v, host: e.target.value })}
            placeholder="smtp.gmail.com"
          />
        </Field>
        <Field label="Port">
          <Input
            type="number"
            value={v.port}
            onChange={(e) => setV({ ...v, port: parseInt(e.target.value) || 587 })}
          />
        </Field>
        <Field label="Utilizator" required>
          <Input value={v.user} onChange={(e) => setV({ ...v, user: e.target.value })} />
        </Field>
        <Field label="Parolă">
          <Input
            type="password"
            value={v.pass}
            onChange={(e) => setV({ ...v, pass: e.target.value })}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Expeditor (From)">
          <Input
            value={v.from}
            onChange={(e) => setV({ ...v, from: e.target.value })}
            placeholder="Mobo CRM <crm@mobo.md>"
          />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox
            checked={v.secure}
            onChange={(secure) => setV({ ...v, secure })}
            label="Conexiune securizată (SSL/TLS, port 465)"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button
          loading={saving}
          onClick={async () => {
            setSaving(true);
            const res = await saveEmailConfig(v);
            setSaving(false);
            if (!res.ok) return toast.error(res.error ?? "Eroare");
            toast.success("Configurare salvată");
          }}
        >
          <Save className="h-4 w-4" /> Salvează
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Input
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="email@test.md"
            className="w-56"
          />
          <Button
            variant="outline"
            loading={testing}
            onClick={async () => {
              if (!testTo) return toast.error("Introduceți adresa de test.");
              setTesting(true);
              const res = await sendTestEmail(testTo);
              setTesting(false);
              if (!res.ok) return toast.error(res.error ?? "Eroare");
              toast.success("Email de test trimis");
            }}
          >
            <SendHorizonal className="h-4 w-4" /> Test
          </Button>
        </div>
      </div>
    </Card>
  );
}
