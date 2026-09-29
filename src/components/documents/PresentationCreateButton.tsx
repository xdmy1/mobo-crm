"use client";

// Drawer „Creare Prezentare” — PPTX + PDF branduite Mobo [NOU].

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Presentation, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Overlay";
import { Field, Checkbox } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { createPresentation } from "@/server/actions/presentations";
import type { SelectOption } from "@/lib/listTypes";

export function PresentationCreateButton({
  contacts,
  fixedContactId,
  variant = "outline",
}: {
  contacts: SelectOption[];
  fixedContactId?: number;
  variant?: "create" | "outline" | "primary";
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState<string | null>(
    fixedContactId ? String(fixedContactId) : null
  );
  const [language, setLanguage] = useState("RO");
  const [fmtPptx, setFmtPptx] = useState(true);
  const [fmtPdf, setFmtPdf] = useState(true);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeStages, setIncludeStages] = useState(true);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!contactId) return toast.error("Selectați clientul.");
    if (!fmtPptx && !fmtPdf) return toast.error("Alegeți cel puțin un format.");
    setLoading(true);
    try {
      const res = await createPresentation({
        contactId,
        language,
        formats: [fmtPptx ? "pptx" : null, fmtPdf ? "pdf" : null].filter(
          Boolean
        ) as string[],
        includePhotos,
        includeStages,
      });
      if (!res.ok) return toast.error(res.error ?? "Eroare");
      toast.success("Prezentarea a fost generată — o găsești și în Oferte");
      for (const url of res.downloadUrls ?? []) window.open(url, "_blank");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Eroare la generarea prezentării. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Presentation className="h-4 w-4" /> Creare Prezentare
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Creare Prezentare"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Închide
            </Button>
            <Button onClick={submit} loading={loading}>
              <Sparkles className="h-4 w-4" /> Generează
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="rounded-lg bg-create/10 px-3 py-2 text-[13px] text-primary">
            Generează o prezentare de ofertă branduită Mobo din proiectele și
            estimările clientului: copertă, „De ce Mobo”, un slide per proiect cu
            specificații și preț, rezumatul investiției, graficul de plăți și
            pagina de contact.
          </p>
          <Field label="Client" required>
            <Select
              value={contactId}
              onChange={setContactId}
              options={contacts}
              disabled={!!fixedContactId}
              placeholder="Selectează clientul…"
            />
          </Field>
          <Field label="Limba" required>
            <div className="flex gap-4">
              {["RO", "RU"].map((l) => (
                <label
                  key={l}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-sm"
                >
                  <input
                    type="radio"
                    checked={language === l}
                    onChange={() => setLanguage(l)}
                    className="h-4 w-4 accent-[var(--invert)]"
                  />
                  {l}
                </label>
              ))}
            </div>
          </Field>
          <div>
            <p className="mb-2 text-[13px] font-semibold text-foreground/70">
              Formate generate
            </p>
            <div className="space-y-2">
              <Checkbox
                checked={fmtPptx}
                onChange={setFmtPptx}
                label="PowerPoint (.pptx) — editabil, pentru prezentat la birou"
              />
              <Checkbox
                checked={fmtPdf}
                onChange={setFmtPdf}
                label="PDF — de trimis clientului pe WhatsApp / email"
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold text-foreground/70">
              Conținut
            </p>
            <div className="space-y-2">
              <Checkbox
                checked={includePhotos}
                onChange={setIncludePhotos}
                label="Include fotografii cu lucrări Mobo"
              />
              <Checkbox
                checked={includeStages}
                onChange={setIncludeStages}
                label="Include graficul de plăți (50% / 30% / 20%)"
              />
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
