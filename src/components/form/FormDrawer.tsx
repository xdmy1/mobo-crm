"use client";

// Drawer generic de creare/editare, condus de FormConfig (serializabil).
// Confort: Enter / ⌘↵ salvează, prima eroare e adusă în vedere și focalizată,
// iar o închidere din greșeală nu aruncă ce ai tastat fără să te întrebe.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Sparkles, Upload } from "lucide-react";
import { Drawer } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Checkbox } from "@/components/ui/Input";
import { Select, MultiSelect, TagsInput } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { saveRecord } from "@/server/actions/crud";
import { findContactByPhone } from "@/server/actions/assist";
import { parseContactText } from "@/lib/smartPaste";
import type { ActionResult, FormConfig, FormFieldDef } from "@/lib/listTypes";

export type Values = Record<string, unknown>;

async function uploadFiles(files: File[]): Promise<
  Array<{ path: string; name: string; mime: string; size: number }>
> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error("Încărcarea fișierului a eșuat");
  return res.json();
}

export function FormDrawer({
  config,
  open,
  onClose,
  id = null,
  initial,
  onSaved,
  action,
  extraValues,
}: {
  config: FormConfig;
  open: boolean;
  onClose: () => void;
  id?: number | null;
  initial?: Values;
  onSaved?: (result: ActionResult) => void;
  /** acțiune custom în locul saveRecord generic */
  action?: (id: number | null, values: Values) => Promise<ActionResult>;
  /** valori ascunse adăugate la submit (ex. contactId preselectat) */
  extraValues?: Values;
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<Values>({});
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [pristine, setPristine] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  // asistență: completare din text lipit + verificare live a dublurilor după telefon
  const [pasteText, setPasteText] = useState("");
  const [flash, setFlash] = useState<string[]>([]);
  const [duplicate, setDuplicate] = useState<Awaited<ReturnType<typeof findContactByPhone>>>(null);
  const dedupeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkDuplicate = (phone: string) => {
    if (dedupeTimer.current) clearTimeout(dedupeTimer.current);
    if (phone.replace(/\D/g, "").length < 8) return setDuplicate(null);
    dedupeTimer.current = setTimeout(async () => setDuplicate(await findContactByPhone(phone)), 350);
  };

  const applyPaste = (text: string) => {
    setPasteText(text);
    const parsed = parseContactText(text);
    const filled = Object.entries(parsed).filter(([k, v]) => v && config.fields.some((f) => f.name === k));
    if (filled.length === 0) return;
    setValues((s) => ({ ...s, ...Object.fromEntries(filled) }));
    setFlash(filled.map(([k]) => k));
    setTimeout(() => setFlash([]), 1100);
    if (config.dedupePhoneField && parsed.phone) checkDuplicate(parsed.phone);
  };

  const defaults = useMemo(() => {
    const d: Values = {};
    for (const f of config.fields) {
      if (f.defaultValue !== undefined) d[f.name] = f.defaultValue;
      else if (f.type === "multiselect" || f.type === "tags") d[f.name] = [];
      else if (f.type === "checkbox") d[f.name] = false;
      else d[f.name] = "";
    }
    return d;
  }, [config.fields]);

  useEffect(() => {
    if (open) {
      const start = { ...defaults, ...(initial ?? {}) };
      setValues(start);
      setPristine(JSON.stringify(start));
      setFiles([]);
      setErrors({});
      setConfirmDiscard(false);
      setPasteText("");
      setDuplicate(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const set = (name: string, v: unknown) => {
    setValues((s) => ({ ...s, [name]: v }));
    if (!id && name === config.dedupePhoneField) checkDuplicate(String(v ?? ""));
    // eroarea unui câmp dispare de cum începi să-l corectezi
    if (errors[name])
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
  };

  const dirty = files.length > 0 || JSON.stringify(values) !== pristine;
  const requestClose = () => {
    if (loading) return;
    if (dirty && !confirmDiscard) setConfirmDiscard(true);
    else onClose();
  };

  async function submit() {
    const errs: Record<string, string> = {};
    for (const f of config.fields) {
      if (!f.required) continue;
      const v = values[f.name];
      const empty =
        v === "" ||
        v === null ||
        v === undefined ||
        (Array.isArray(v) && v.length === 0);
      if (f.type === "file") {
        if (files.length === 0 && !initial?.filePath) errs[f.name] = `Câmpul „${f.label}” este obligatoriu`;
      } else if (empty) {
        errs[f.name] = `Câmpul „${f.label}” este obligatoriu`;
      }
    }
    setErrors(errs);
    const firstInvalid = config.fields.find((f) => errs[f.name]);
    if (firstInvalid) {
      const row = formRef.current?.querySelector<HTMLElement>(
        `[data-field="${firstInvalid.name}"]`
      );
      row?.scrollIntoView({ block: "center", behavior: "smooth" });
      row?.querySelector<HTMLElement>("input, textarea, [role='combobox']")?.focus({
        preventScroll: true,
      });
      return;
    }

    setLoading(true);
    try {
      let payloads: Values[] = [{ ...values, ...(extraValues ?? {}) }];
      // upload fișiere — un record per fișier
      const fileField = config.fields.find((f) => f.type === "file");
      if (fileField && files.length > 0) {
        const uploaded = await uploadFiles(files);
        payloads = uploaded.map((u) => ({
          ...values,
          ...(extraValues ?? {}),
          filePath: u.path,
          mime: u.mime,
          size: u.size,
          name: values.name && String(values.name).trim() ? values.name : u.name,
        }));
      }
      let last: ActionResult = { ok: true };
      for (const p of payloads) {
        last = action ? await action(id, p) : await saveRecord(config.entity, id, p);
        if (!last.ok) break;
      }
      if (!last.ok) {
        toast.error(last.error ?? "Eroare la salvare");
      } else {
        toast.success(id ? "Salvat cu succes" : "Creat cu succes");
        onClose();
        onSaved?.(last);
        if (last.downloadUrl) window.open(last.downloadUrl, "_blank");
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Eroare");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={requestClose}
      title={id ? config.title.replace(/^Creează/, "Editează") : config.title}
      footer={
        confirmDiscard ? (
          <>
            <span className="mr-auto text-[13px] font-medium text-foreground/80 animate-fade-in">
              Ai modificări nesalvate. Renunți la ele?
            </span>
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>
              Continuă editarea
            </Button>
            <Button variant="dangerOutline" onClick={onClose}>
              Renunță
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={requestClose}>
              Închide
            </Button>
            <Button onClick={submit} loading={loading} title="Enter sau ⌘↵">
              {id ? "Salvează" : config.submitLabel ?? "Creează"}
            </Button>
          </>
        )
      }
    >
      <div
        ref={formRef}
        className="space-y-4"
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.defaultPrevented || loading) return;
          const el = e.target as HTMLElement;
          // ⌘↵ salvează de oriunde; Enter simplu doar din câmpurile pe un rând
          const plainInput = el.tagName === "INPUT" && !el.closest("[role='combobox']");
          if (e.metaKey || e.ctrlKey || plainInput) {
            e.preventDefault();
            submit();
          }
        }}
      >
        {config.smartPaste && !id && (
          <div className="rounded-xl border border-dashed border-border-strong/80 bg-subtle/50 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-foreground/80">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Completare rapidă
            </p>
            <Textarea
              value={pasteText}
              onChange={(e) => applyPaste(e.target.value)}
              placeholder="Lipește aici mesajul primit — ex. „Ion Popescu, 069 123 456, ion@mail.md” — și completez eu câmpurile"
              className="min-h-[58px] text-[13px]"
            />
          </div>
        )}
        {config.fields.map((f) => (
          <div
            key={f.name}
            data-field={f.name}
            className={flash.includes(f.name) ? "field-flash rounded-lg" : undefined}
          >
            {f.section && (
              <p className="mb-3 mt-2 border-b border-border pb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                {f.section}
              </p>
            )}
            <FieldRenderer
              def={f}
              value={values[f.name]}
              onChange={(v) => set(f.name, v)}
              error={errors[f.name]}
              files={files}
              setFiles={setFiles}
            />
            {f.name === config.dedupePhoneField && duplicate && !id && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/admin/contact/${duplicate.id}`);
                }}
                className="mt-2 flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-warn/40 bg-warn/[0.09] px-3 py-2 text-left text-[13px] transition-colors hover:bg-warn/[0.15] animate-rise-in"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-warn" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    Există deja: {duplicate.name} · {duplicate.humanId}
                  </span>
                  <span className="block text-xs text-muted">
                    {[duplicate.stage, duplicate.staff].filter(Boolean).join(" · ") || "client existent"} — deschide
                    fișa în loc să creezi o dublură
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
              </button>
            )}
          </div>
        ))}
      </div>
    </Drawer>
  );
}

export function FieldRenderer({
  def,
  value,
  onChange,
  error,
  files,
  setFiles,
}: {
  def: FormFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  files?: File[];
  setFiles?: (f: File[]) => void;
}) {
  const common = { label: def.label, required: def.required, help: def.help, error };
  switch (def.type) {
    case "textarea":
      return (
        <Field {...common}>
          <Textarea
            value={String(value ?? "")}
            placeholder={def.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      );
    case "select":
      return (
        <Field {...common}>
          <Select
            value={value != null && value !== "" ? String(value) : null}
            onChange={(v) => onChange(v)}
            options={def.options ?? []}
            placeholder={def.placeholder ?? "Selectează…"}
          />
        </Field>
      );
    case "multiselect":
      return (
        <Field {...common}>
          <MultiSelect
            values={Array.isArray(value) ? value.map(String) : []}
            onChange={(v) => onChange(v)}
            options={def.options ?? []}
            placeholder={def.placeholder ?? "Selectează…"}
          />
        </Field>
      );
    case "tags":
      return (
        <Field {...common}>
          <TagsInput
            values={Array.isArray(value) ? value.map(String) : []}
            onChange={(v) => onChange(v)}
          />
        </Field>
      );
    case "checkbox":
      return (
        <Field error={error}>
          <Checkbox
            checked={!!value}
            onChange={(v) => onChange(v)}
            label={def.label}
          />
        </Field>
      );
    case "radio":
      return (
        <Field {...common}>
          <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-subtle p-1">
            {(def.options ?? []).map((o) => {
              const active = String(value) === o.value;
              return (
                <label
                  key={o.value}
                  className={`cursor-pointer rounded-md px-3 py-1 text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  <input
                    type="radio"
                    checked={active}
                    onChange={() => onChange(o.value)}
                    className="sr-only"
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
        </Field>
      );
    case "file":
      return (
        <Field {...common}>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-subtle/60 px-4 py-6 text-center text-[13px] text-muted transition-colors hover:border-foreground/40 hover:bg-subtle hover:text-foreground">
            <Upload className="h-4 w-4" />
            {files && files.length > 0
              ? files.map((f) => f.name).join(", ")
              : "Încărcați fișiere (click sau trage aici)"}
            <input
              type="file"
              className="hidden"
              multiple={def.multiple !== false}
              accept={def.accept}
              onChange={(e) =>
                setFiles?.(e.target.files ? Array.from(e.target.files) : [])
              }
            />
          </label>
        </Field>
      );
    case "date":
      return (
        <Field {...common}>
          <Input
            type="date"
            value={value ? String(value).slice(0, 10) : ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      );
    default:
      return (
        <Field {...common}>
          <Input
            type={def.type === "number" ? "number" : def.type}
            value={String(value ?? "")}
            placeholder={def.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      );
  }
}
