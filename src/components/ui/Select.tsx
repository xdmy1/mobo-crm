"use client";

// Select cu căutare + MultiSelect cu tag-uri, fără dependențe.

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import type { SelectOption } from "@/lib/listTypes";
import { cn } from "@/lib/cn";

function usePopover(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    // în faza de captură + preventDefault: Escape închide DOAR lista,
    // nu și drawer-ul/modalul în care se află select-ul
    function onEsc(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      close();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc, true);
    };
  }, [open, close]);
  return ref;
}

/** lista se deschide în sus când jos nu e loc (select-uri din josul drawerelor) */
function shouldDropUp(el: HTMLElement | null) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const below = window.innerHeight - r.bottom;
  return below < 300 && r.top > below;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const triggerBase =
  "flex w-full items-center justify-between gap-2 rounded-lg border bg-card px-3 text-left text-sm shadow-xs transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:border-lime-brand focus-visible:ring-[3px] focus-visible:ring-lime-brand/25";
const triggerIdle = "border-border-strong/70 hover:border-border-strong";
const triggerOpen = "border-lime-brand ring-[3px] ring-lime-brand/25";
const popover =
  "absolute z-50 w-full overflow-hidden rounded-xl border border-border bg-card shadow-pop animate-menu-in";
const optionBase =
  "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm";

function SearchRow({
  value,
  onChange,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
      <Search className="h-3.5 w-3.5 text-muted" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Caută…"
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted/60"
      />
    </div>
  );
}

function OptionList({
  id,
  options,
  isActive,
  highlighted,
  setHighlighted,
  onPick,
}: {
  id: string;
  options: SelectOption[];
  isActive: (v: string) => boolean;
  highlighted: number;
  setHighlighted: (i: number) => void;
  onPick: (o: SelectOption) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${highlighted}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  return (
    <ul ref={listRef} id={id} role="listbox" className="max-h-60 overflow-y-auto overscroll-contain p-1">
      {options.length === 0 && <li className="px-2.5 py-2 text-sm text-muted">Nu există date</li>}
      {options.map((o, i) => {
        const active = isActive(o.value);
        return (
          <li key={o.value} role="option" aria-selected={active}>
            <button
              type="button"
              tabIndex={-1}
              data-index={i}
              // mousemove (nu mouseenter): derularea din tastatură nu mută evidențierea sub cursor
              onMouseMove={() => highlighted !== i && setHighlighted(i)}
              onClick={() => onPick(o)}
              className={cn(
                optionBase,
                i === highlighted && "bg-foreground/[0.06]",
                active && "font-medium"
              )}
            >
              <span className="truncate">{o.label}</span>
              {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary animate-check-in" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Navigare din tastatură comună: ↑ ↓ Home End Enter Tab + tastare directă. */
function useListKeys({
  open,
  count,
  highlighted,
  setHighlighted,
  onOpen,
  onClose,
  onEnter,
  labels,
  typeahead,
}: {
  open: boolean;
  count: number;
  highlighted: number;
  setHighlighted: (i: number) => void;
  onOpen: () => void;
  onClose: () => void;
  onEnter: () => void;
  labels: string[];
  /** tastarea sare la opțiunea care începe cu literele apăsate (când nu există câmp de căutare) */
  typeahead: boolean;
}) {
  const buffer = useRef({ text: "", at: 0 });
  return (e: ReactKeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        onOpen();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlighted(Math.min(count - 1, highlighted + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlighted(Math.max(0, highlighted - 1));
        break;
      case "Home":
        e.preventDefault();
        setHighlighted(0);
        break;
      case "End":
        e.preventDefault();
        setHighlighted(count - 1);
        break;
      case "Enter":
        e.preventDefault();
        onEnter();
        break;
      case "Tab":
        onClose();
        break;
      default:
        if (typeahead && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          const now = Date.now();
          const b = buffer.current;
          b.text = now - b.at > 700 ? e.key : b.text + e.key;
          b.at = now;
          const i = labels.findIndex((l) => norm(l).startsWith(norm(b.text)));
          if (i >= 0) setHighlighted(i);
        }
    }
  };
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Selectează…",
  allowClear = true,
  disabled,
  className = "",
  compact,
  dropUp,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: SelectOption[];
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  /** deschide lista în sus (select-uri aflate în josul paginii) */
  dropUp?: boolean;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [up, setUp] = useState(!!dropUp);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const close = (refocus = false) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const ref = usePopover(open, () => close(true));

  const searchable = options.length > 6;
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(
    () => (q ? options.filter((o) => norm(o.label).includes(norm(q))) : options),
    [options, q]
  );

  const openMenu = () => {
    if (disabled) return;
    setQ("");
    setHighlighted(Math.max(0, options.findIndex((o) => o.value === value)));
    setUp(dropUp ?? shouldDropUp(triggerRef.current));
    setOpen(true);
  };

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const pick = (o: SelectOption) => {
    onChange(o.value);
    close(true);
  };

  const onKeyDown = useListKeys({
    open,
    count: filtered.length,
    highlighted,
    setHighlighted,
    onOpen: openMenu,
    onClose: () => close(),
    onEnter: () => filtered[highlighted] && pick(filtered[highlighted]),
    labels: filtered.map((o) => o.label),
    typeahead: !searchable,
  });

  return (
    <div ref={ref} className={cn("relative", className)} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        className={cn(
          triggerBase,
          compact ? "h-8 text-[13px]" : "h-9",
          open ? triggerOpen : triggerIdle,
          disabled ? "cursor-not-allowed bg-subtle opacity-70" : "cursor-pointer"
        )}
      >
        <span className={cn("truncate", !selected && "text-muted/70")}>
          {selected?.label ?? placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {allowClear && selected && !disabled && (
            <X
              className="h-3.5 w-3.5 rounded text-muted transition-colors hover:text-danger"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            />
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted/80" />
        </span>
      </button>

      {open && (
        <div
          className={cn(
            popover,
            "min-w-[180px]",
            up ? "bottom-full mb-1.5 origin-bottom" : "mt-1.5 origin-top"
          )}
        >
          {searchable && (
            <SearchRow
              value={q}
              onChange={(v) => {
                setQ(v);
                setHighlighted(0);
              }}
              inputRef={searchRef}
            />
          )}
          <OptionList
            id={listId}
            options={filtered}
            isActive={(v) => v === value}
            highlighted={highlighted}
            setHighlighted={setHighlighted}
            onPick={pick}
          />
        </div>
      )}
    </div>
  );
}

export function MultiSelect({
  values,
  onChange,
  options,
  placeholder = "Selectează…",
  className = "",
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [up, setUp] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const close = (refocus = false) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const ref = usePopover(open, () => close(true));

  const searchable = options.length > 6;
  const filtered = useMemo(
    () => (q ? options.filter((o) => norm(o.label).includes(norm(q))) : options),
    [options, q]
  );

  const openMenu = () => {
    setQ("");
    setHighlighted(0);
    setUp(shouldDropUp(triggerRef.current));
    setOpen(true);
  };

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  const listKeys = useListKeys({
    open,
    count: filtered.length,
    highlighted,
    setHighlighted,
    onOpen: openMenu,
    onClose: () => close(),
    onEnter: () => filtered[highlighted] && toggle(filtered[highlighted].value),
    labels: filtered.map((o) => o.label),
    typeahead: !searchable,
  });

  return (
    <div
      ref={ref}
      className={cn("relative", className)}
      onKeyDown={(e) => {
        if (!open && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          openMenu();
          return;
        }
        if (e.key === "Backspace" && !q && values.length) onChange(values.slice(0, -1));
        listKeys(e);
      }}
    >
      <div
        ref={triggerRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        tabIndex={0}
        onClick={() => (open ? close() : openMenu())}
        className={cn(
          "flex min-h-9 w-full cursor-pointer flex-wrap items-center gap-1 rounded-lg border bg-card px-2 py-1 text-sm shadow-xs transition-[border-color,box-shadow] duration-150 focus-visible:border-lime-brand focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-lime-brand/25",
          open ? triggerOpen : triggerIdle
        )}
      >
        {values.length === 0 && (
          <span className="px-1 text-muted/70">{placeholder}</span>
        )}
        {values.map((v) => {
          const o = options.find((x) => x.value === v);
          return (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-md bg-foreground/[0.07] py-0.5 pl-2 pr-1 text-xs font-medium animate-check-in"
            >
              {o?.label ?? v}
              <X
                className="h-3 w-3 cursor-pointer text-muted transition-colors hover:text-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(v);
                }}
              />
            </span>
          );
        })}
        <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted/80" />
      </div>

      {open && (
        <div
          className={cn(
            popover,
            "min-w-[200px]",
            up ? "bottom-full mb-1.5 origin-bottom" : "mt-1.5 origin-top"
          )}
        >
          {searchable && (
            <SearchRow
              value={q}
              onChange={(v) => {
                setQ(v);
                setHighlighted(0);
              }}
              inputRef={searchRef}
            />
          )}
          <OptionList
            id={listId}
            options={filtered}
            isActive={(v) => values.includes(v)}
            highlighted={highlighted}
            setHighlighted={setHighlighted}
            onPick={(o) => toggle(o.value)}
          />
        </div>
      )}
    </div>
  );
}

/** Tag input liber (pentru „Elemente” la camere). */
export function TagsInput({
  values,
  onChange,
  placeholder = "Adaugă și apasă Enter",
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim();
    if (t && !values.includes(t)) onChange([...values, t]);
    setText("");
  };
  return (
    <div className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border border-border-strong/70 bg-card px-2 py-1 text-sm shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-lime-brand focus-within:ring-[3px] focus-within:ring-lime-brand/25">
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded-md bg-foreground/[0.07] py-0.5 pl-2 pr-1 text-xs font-medium"
        >
          {v}
          <X
            className="h-3 w-3 cursor-pointer text-muted transition-colors hover:text-danger"
            onClick={() => onChange(values.filter((x) => x !== v))}
          />
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
          if (e.key === "Backspace" && !text && values.length)
            onChange(values.slice(0, -1));
        }}
        onBlur={add}
        placeholder={values.length === 0 ? placeholder : ""}
        className="min-w-[120px] flex-1 bg-transparent px-1 outline-none placeholder:text-muted/60"
      />
    </div>
  );
}

export function InlineSpin({ children }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted/30 border-t-foreground" />
      {children}
    </span>
  );
}
