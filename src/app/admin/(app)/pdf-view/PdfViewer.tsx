"use client";

import { useState } from "react";
import Link from "next/link";
import { FileWarning } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Segmented } from "@/components/ui/Segmented";

export function PdfViewer({
  availability,
}: {
  availability: Record<string, boolean>;
}) {
  const [lang, setLang] = useState("RO");
  const [doc, setDoc] = useState<"presentation" | "guide">("presentation");

  const fileName = `${doc}-${lang.toLowerCase()}.pdf`;
  const available = availability[fileName];

  return (
    <div className="flex h-[calc(100vh-104px)] flex-col gap-4">
      <PageHeader
        title="Vizualizare PDF"
        subtitle="Documentele se administrează în Setup → Organizație"
        actions={
          <>
            <Segmented
              value={doc}
              onChange={(v) => setDoc(v as "presentation" | "guide")}
              options={[
                { value: "presentation", label: "Prezentare" },
                { value: "guide", label: "Ghid" },
              ]}
            />
            <Segmented
              value={lang}
              onChange={setLang}
              options={[
                { value: "RO", label: "RO" },
                { value: "RU", label: "RU" },
              ]}
            />
          </>
        }
      />

      {available ? (
        <iframe
          src={`/api/files/${fileName}`}
          className="min-h-0 flex-1 rounded-xl border border-border bg-card shadow-xs"
          title={fileName}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-card text-muted">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-subtle">
            <FileWarning className="h-5 w-5" />
          </span>
          <p className="text-[13px]">
            Fișierul „{doc === "presentation" ? "Prezentare" : "Ghid"} ({lang})” nu a
            fost încărcat încă.
          </p>
          <Link
            href="/admin/setup/organization"
            className="text-[13px] font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
          >
            Încarcă-l din Setup → Organizație
          </Link>
        </div>
      )}
    </div>
  );
}
