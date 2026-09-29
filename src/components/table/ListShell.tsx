"use client";

// „Table shell”-ul comun (§2 din spec): filtre, căutare, creare, coloane,
// CSV/XLSX, selecție + ștergere în masă, sortare, paginare.
// Confort: căutare pe măsură ce tastezi („/” o focalizează), rând întreg clicabil,
// bară de acțiuni în masă, stare „se încarcă” vizibilă, după creare ajungi direct în fișă.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Columns3,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Checkbox } from "@/components/ui/Input";
import { Select, MultiSelect } from "@/components/ui/Select";
import { Avatar, Badge, Empty } from "@/components/ui/Misc";
import { ConfirmDialog } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { FormDrawer } from "@/components/form/FormDrawer";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePresence } from "@/lib/usePresence";
import { cn } from "@/lib/cn";
import { deleteRecords, restoreRecords } from "@/server/actions/crud";
import type {
  Cell,
  ColumnDef,
  FilterDef,
  FormConfig,
  RowData,
} from "@/lib/listTypes";

function CellView({ cell }: { cell: Cell }) {
  if (cell === null || cell === undefined) return <span className="text-muted">—</span>;
  if (typeof cell === "string" || typeof cell === "number")
    return <>{String(cell)}</>;
  const inner = cell.badge ? (
    <Badge color={cell.badge}>{cell.t}</Badge>
  ) : (
    <>{cell.t}</>
  );
  const body = (
    <span className="inline-flex flex-col">
      {cell.href ? (
        <Link
          href={cell.href}
          className="font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          {inner}
        </Link>
      ) : (
        inner
      )}
      {cell.sub && <span className="text-xs text-muted">{cell.sub}</span>}
    </span>
  );
  if (!cell.avatar) return body;
  return (
    <span className="inline-flex items-center gap-2.5">
      <Avatar name={cell.t} size={24} />
      {body}
    </span>
  );
}

/** click pe un element interactiv din rând (link, buton, bifă) — nu deschide fișa */
const INTERACTIVE = "a, button, input, label, select, textarea, [role='button']";

export function ListShell({
  entity,
  columns,
  rows,
  total,
  page,
  pageSize,
  filters = [],
  searchPlaceholder = "Caută",
  createForm,
  createLabel,
  editForm,
  extraButtons,
  softDelete,
  title,
  hideSearch,
  emptyText,
  detailBase,
}: {
  entity: string;
  columns: ColumnDef[];
  rows: RowData[];
  total: number;
  page: number;
  pageSize: number;
  filters?: FilterDef[];
  searchPlaceholder?: string;
  createForm?: FormConfig;
  createLabel?: string;
  editForm?: FormConfig;
  extraButtons?: React.ReactNode;
  softDelete?: boolean;
  title?: string;
  hideSearch?: boolean;
  emptyText?: string;
  /** ex. „/admin/contact” — după creare utilizatorul ajunge direct în fișa nouă */
  detailBase?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [q, setQ] = useState(sp.get("q") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [colsOpen, setColsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<RowData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  // persistă coloanele ascunse per utilizator [NOU]
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`mobo:cols:${entity}`);
      if (saved) setHiddenCols(new Set(JSON.parse(saved)));
    } catch {}
  }, [entity]);

  // ?new=1 (din paleta ⌘K) deschide direct drawerul de creare [NOU]
  useEffect(() => {
    if (sp.get("new") === "1" && createForm) {
      setCreateOpen(true);
      const params = new URLSearchParams(sp.toString());
      params.delete("new");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);
  const toggleCol = (key: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(`mobo:cols:${entity}`, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    // inițializează filtrele din URL
    const f: Record<string, string[]> = {};
    for (const def of filters) {
      const v = sp.get(`f_${def.key}`);
      if (v) f[def.key] = v.split(",");
    }
    setPendingFilters(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      // tranziție: tabelul vechi rămâne pe ecran (ușor estompat) până sosește cel nou
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [sp, pathname, router]
  );

  const applyFilters = () => {
    const updates: Record<string, string | null> = { page: null };
    for (const def of filters) {
      const vals = pendingFilters[def.key] ?? [];
      updates[`f_${def.key}`] = vals.length ? vals.join(",") : null;
    }
    setParams(updates);
  };

  const doSearch = (value = q) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setParams({ q: value.trim() || null, page: null });
  };
  // căutare pe măsură ce tastezi; Enter o pornește imediat
  const onSearchChange = (value: string) => {
    setQ(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(value), 320);
  };

  // „/” sare în căutare (ca în Gmail / GitHub), dacă nu tastezi deja altundeva
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const sort = sp.get("sort");
  const dir = sp.get("dir") ?? "asc";
  const toggleSort = (key: string) => {
    if (sort !== key) setParams({ sort: key, dir: "asc" });
    else if (dir === "asc") setParams({ dir: "desc" });
    else setParams({ sort: null, dir: null });
  };

  const visibleColumns = columns.filter((c) => !hiddenCols.has(c.key));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleRow = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function runDelete(ids: number[]) {
    setDeleting(true);
    const res = await deleteRecords(entity, ids);
    setDeleting(false);
    setConfirmDelete(null);
    if (!res.ok) {
      toast.error(res.error ?? "Eroare la ștergere");
      return;
    }
    setSelected(new Set());
    if (softDelete) {
      toast.success(
        `${ids.length === 1 ? "Element șters" : `${ids.length} elemente șterse`}`,
        async () => {
          await restoreRecords(entity, ids);
          router.refresh();
        }
      );
    } else {
      toast.success(
        ids.length === 1 ? "Element șters" : `${ids.length} elemente șterse`
      );
    }
    router.refresh();
  }

  const exportQs = useMemo(() => {
    const params = new URLSearchParams(sp.toString());
    params.set("entity", entity);
    params.delete("page");
    return params.toString();
  }, [sp, entity]);

  const deleteNames =
    confirmDelete
      ?.map((id) => {
        const r = rows.find((x) => x.id === id);
        const first = r ? Object.values(r.cells)[0] : null;
        return typeof first === "object" && first ? first.t : String(first ?? id);
      })
      .slice(0, 5) ?? [];

  const pages = useMemo(() => {
    const out: (number | "…")[] = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - page) <= 2) out.push(p);
      else if (out[out.length - 1] !== "…") out.push("…");
    }
    return out;
  }, [page, totalPages]);

  const activeFilterCount = filters.filter((def) => sp.get(`f_${def.key}`)).length;
  const narrowed = activeFilterCount > 0 || !!sp.get("q");
  const bulkBar = usePresence(selected.size > 0, 160);

  const openRow = (r: RowData, e: React.MouseEvent) => {
    if (!r.viewHref) return;
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    // selectarea de text dintr-o celulă nu e un click
    if (window.getSelection()?.toString()) return;
    if (e.metaKey || e.ctrlKey) window.open(r.viewHref, "_blank");
    else router.push(r.viewHref);
  };
  const resetFilters = () => {
    const updates: Record<string, string | null> = { page: null };
    for (const def of filters) updates[`f_${def.key}`] = null;
    setPendingFilters({});
    setParams(updates);
  };

  const rowAction =
    "grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-foreground/[0.07] hover:text-foreground";
  const pageBtn =
    "grid h-8 min-w-8 cursor-pointer place-items-center rounded-lg px-2 text-[13px] font-medium transition-colors disabled:cursor-default disabled:opacity-40";

  return (
    <div className="space-y-5">
      <PageHeader
        title={title ?? "Listă"}
        subtitle={`${total} ${total === 1 ? "înregistrare" : "înregistrări"}`}
        actions={
          <>
            {extraButtons}
            {createForm && (
              <Button variant="create" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                {createLabel ?? createForm.title}
              </Button>
            )}
          </>
        }
      />

      <div className="rounded-xl border border-border bg-card shadow-xs">
        {/* Bara de instrumente */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          {!hideSearch && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/70" />
              <Input
                ref={searchRef}
                value={q}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") doSearch();
                  if (e.key === "Escape" && q) {
                    e.stopPropagation();
                    setQ("");
                    doSearch("");
                  }
                }}
                placeholder={searchPlaceholder}
                className="h-8 w-60 pl-8 pr-8 text-[13px]"
              />
              {q ? (
                <button
                  onClick={() => {
                    setQ("");
                    doSearch("");
                    searchRef.current?.focus();
                  }}
                  className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 cursor-pointer place-items-center rounded text-muted transition-colors hover:text-foreground"
                  aria-label="Golește căutarea"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-subtle px-1 text-[10px] font-medium leading-4 text-muted/80">
                  /
                </kbd>
              )}
            </div>
          )}
          {filters.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(filtersOpen && "bg-subtle")}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filtrează
              {activeFilterCount > 0 && (
                <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-invert px-1 text-[11px] font-semibold text-invert-fg">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          )}
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5" /> Resetează
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Button variant="outline" size="sm" onClick={() => setColsOpen((v) => !v)}>
                <Columns3 className="h-3.5 w-3.5" /> Coloane
              </Button>
              {colsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setColsOpen(false)} />
                  <div className="absolute right-0 z-50 mt-1.5 max-h-80 w-56 origin-top-right overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-pop animate-menu-in">
                    {columns.map((c) => (
                      <div key={c.key} className="rounded-md px-2.5 py-1.5 hover:bg-foreground/[0.05]">
                        <Checkbox
                          checked={!hiddenCols.has(c.key)}
                          onChange={() => toggleCol(c.key)}
                          label={c.label}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="relative">
              <Button variant="outline" size="sm" onClick={() => setExportOpen((v) => !v)}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 z-50 mt-1.5 w-48 origin-top-right rounded-xl border border-border bg-card p-1 shadow-pop animate-menu-in">
                    <a
                      href={`/api/export?${exportQs}&format=csv`}
                      onClick={() => setExportOpen(false)}
                      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors hover:bg-foreground/[0.05]"
                    >
                      <FileText className="h-4 w-4 text-muted" /> Descarcă CSV
                    </a>
                    <a
                      href={`/api/export?${exportQs}&format=xlsx`}
                      onClick={() => setExportOpen(false)}
                      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors hover:bg-foreground/[0.05]"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-muted" /> Descarcă XLSX
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {filtersOpen && filters.length > 0 && (
          <div className="flex flex-wrap items-end gap-3 border-t border-border bg-subtle/50 px-3 py-3 animate-fade-in">
            {filters.map((def) => (
              <div key={def.key} className="w-52">
                <p className="mb-1 text-xs font-medium text-muted">{def.label}</p>
                {def.text ? (
                  <Input
                    value={pendingFilters[def.key]?.[0] ?? ""}
                    onChange={(e) =>
                      setPendingFilters((s) => ({
                        ...s,
                        [def.key]: e.target.value ? [e.target.value] : [],
                      }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                    placeholder={def.label}
                  />
                ) : def.multi ? (
                  <MultiSelect
                    values={pendingFilters[def.key] ?? []}
                    onChange={(v) => setPendingFilters((s) => ({ ...s, [def.key]: v }))}
                    options={def.options}
                    placeholder={def.label}
                  />
                ) : (
                  <Select
                    value={pendingFilters[def.key]?.[0] ?? null}
                    onChange={(v) =>
                      setPendingFilters((s) => ({
                        ...s,
                        [def.key]: v ? [v] : [],
                      }))
                    }
                    options={def.options}
                    placeholder={def.label}
                  />
                )}
              </div>
            ))}
            <Button onClick={applyFilters}>Aplică filtrele</Button>
          </div>
        )}

        <div className="relative overflow-x-auto border-t border-border">
          {/* indicator discret cât se încarcă pagina/filtrul următor */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden transition-opacity duration-200",
              pending ? "opacity-100 delay-150" : "opacity-0"
            )}
          >
            <div className="loading-bar h-full w-1/3 rounded-full bg-lime-brand" />
          </div>
          <table
            className={cn(
              "w-full min-w-max text-[13px] transition-opacity duration-200",
              pending && "opacity-60 delay-150"
            )}
          >
            <thead>
              <tr className="border-b border-border bg-subtle/60 text-left">
                <th className="w-10 py-2 pl-4 pr-1">
                  <Checkbox checked={allSelected} indeterminate={selected.size > 0} onChange={toggleAll} />
                </th>
                {visibleColumns.map((c) => (
                  <th
                    key={c.key}
                    className={cn(
                      "whitespace-nowrap px-3 py-2 text-xs font-medium text-muted",
                      c.sortable && "cursor-pointer select-none transition-colors hover:text-foreground"
                    )}
                    onClick={() => c.sortable && toggleSort(c.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {c.sortable &&
                        (sort === c.key ? (
                          dir === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-foreground" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-foreground" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40" />
                        ))}
                    </span>
                  </th>
                ))}
                <th className="w-px px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length + 2}>
                    <Empty
                      text={narrowed ? "Niciun rezultat pentru căutarea sau filtrele curente" : emptyText}
                    >
                      {narrowed ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setQ("");
                            setPendingFilters({});
                            const updates: Record<string, string | null> = { q: null, page: null };
                            for (const def of filters) updates[`f_${def.key}`] = null;
                            setParams(updates);
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Arată tot
                        </Button>
                      ) : (
                        createForm && (
                          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                            <Plus className="h-3.5 w-3.5" /> {createLabel ?? createForm.title}
                          </Button>
                        )
                      )}
                    </Empty>
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={(e) => openRow(r, e)}
                  className={cn(
                    "group border-b border-border/70 transition-colors duration-100 last:border-0 hover:bg-subtle/60",
                    r.viewHref && "cursor-pointer",
                    selected.has(r.id) && "bg-lime-brand/[0.09] hover:bg-lime-brand/[0.12]"
                  )}
                >
                  <td className="py-2 pl-4 pr-1">
                    <Checkbox checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} />
                  </td>
                  {visibleColumns.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-3 py-2">
                      <CellView cell={r.cells[c.key] ?? null} />
                    </td>
                  ))}
                  <td className="px-3 py-1.5">
                    <div className="flex items-center justify-end gap-0.5 transition-opacity duration-150 [@media(hover:hover)]:opacity-55 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100">
                      {r.downloadHref && (
                        <a href={r.downloadHref} className={rowAction} title="Descarcă" aria-label="Descarcă">
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      {r.viewHref && (
                        <Link href={r.viewHref} className={rowAction} title="Vezi" aria-label="Vezi">
                          <Eye className="h-4 w-4" />
                        </Link>
                      )}
                      {editForm && r.canEdit !== false && (
                        <button className={rowAction} title="Editează" aria-label="Editează" onClick={() => setEditRow(r)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {r.canDelete !== false && (
                        <button
                          className={cn(rowAction, "hover:bg-danger/10 hover:text-danger")}
                          title="Șterge"
                          aria-label="Șterge"
                          onClick={() => setConfirmDelete([r.id])}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginare */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5">
          <span className="text-[13px] text-muted">
            {from}–{to} din {total} {total === 1 ? "item" : "itemi"}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setParams({ page: String(page - 1) })}
              className={cn(pageBtn, "text-muted hover:bg-foreground/[0.06] hover:text-foreground")}
              aria-label="Pagina anterioară"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pages.map((p, i) =>
              p === "…" ? (
                <span key={`e${i}`} className="px-1 text-muted">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setParams({ page: String(p) })}
                  className={cn(
                    pageBtn,
                    p === page
                      ? "bg-invert text-invert-fg"
                      : "text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                  )}
                >
                  {p}
                </button>
              )
            )}
            <button
              disabled={page >= totalPages}
              onClick={() => setParams({ page: String(page + 1) })}
              className={cn(pageBtn, "text-muted hover:bg-foreground/[0.06] hover:text-foreground")}
              aria-label="Pagina următoare"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <Select
              compact
              dropUp
              allowClear={false}
              className="ml-2 w-[124px]"
              value={String(pageSize)}
              onChange={(v) => setParams({ pageSize: v, page: null })}
              options={["10", "20", "50", "100"].map((n) => ({
                value: n,
                label: `${n} / pagină`,
              }))}
            />
          </div>
        </div>
      </div>

      {/* Drawere + confirmări */}
      {createForm && (
        <FormDrawer
          config={createForm}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSaved={(res) => {
            if (detailBase && res.id) router.push(`${detailBase}/${res.id}`);
          }}
        />
      )}
      {editForm && (
        <FormDrawer
          config={editForm}
          open={!!editRow}
          onClose={() => setEditRow(null)}
          id={editRow?.id ?? null}
          initial={editRow?.raw}
        />
      )}
      {/* Bară de acțiuni în masă — apare jos, lângă degetul mare / cursor, nu în antet */}
      {bulkBar.mounted && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4 print:hidden"
          data-state={bulkBar.state}
        >
          <div className="bulk-bar pointer-events-auto flex items-center gap-1 rounded-xl border border-white/10 bg-ink py-1.5 pl-4 pr-1.5 text-[13px] text-white shadow-pop">
            <span className="mr-2 font-medium tabular-nums">
              {selected.size} {selected.size === 1 ? "selectat" : "selectate"}
            </span>
            <button
              onClick={() => setSelected(new Set())}
              className="h-8 cursor-pointer rounded-lg px-2.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              Deselectează
            </button>
            <button
              onClick={() => setConfirmDelete([...selected])}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-danger px-3 font-medium text-white transition-[background-color,transform] duration-150 hover:bg-danger-hover active:scale-[0.97]"
            >
              <Trash2 className="h-3.5 w-3.5" /> Șterge
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && runDelete(confirmDelete)}
        loading={deleting}
        title="Confirmare ștergere"
        message={
          confirmDelete && confirmDelete.length === 1 ? (
            <>
              Sigur ștergi <b>{deleteNames[0]}</b>?
            </>
          ) : (
            <>
              Sigur ștergi <b>{confirmDelete?.length}</b> elemente (
              {deleteNames.join(", ")}
              {confirmDelete && confirmDelete.length > 5 ? "…" : ""})?
            </>
          )
        }
      />
    </div>
  );
}
