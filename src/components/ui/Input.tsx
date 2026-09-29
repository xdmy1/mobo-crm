"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Check, HelpCircle, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

export const fieldBase =
  "w-full rounded-lg border border-border-strong/70 bg-card text-sm text-foreground shadow-xs placeholder:text-muted/70 " +
  "transition-[border-color,box-shadow] duration-150 hover:border-border-strong " +
  "focus:border-lime-brand focus:outline-none focus:ring-[3px] focus:ring-lime-brand/25 " +
  "disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-70";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} className={cn(fieldBase, "h-9 px-3", className)} {...rest} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...rest }, ref) => (
  <textarea
    ref={ref}
    className={cn(fieldBase, "min-h-[90px] px-3 py-2 leading-relaxed", className)}
    {...rest}
  />
));
Textarea.displayName = "Textarea";

export function Field({
  label,
  required,
  help,
  error,
  children,
  className = "",
}: {
  label?: string;
  required?: boolean;
  help?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="flex items-center gap-1 text-[13px] font-medium text-foreground/85">
          {label}
          {required && <span className="text-danger">*</span>}
          {help && (
            <span className="group relative inline-flex">
              <HelpCircle className="h-3.5 w-3.5 cursor-help text-muted/70" />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[220px] -translate-x-1/2 origin-bottom scale-95 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-normal text-white opacity-0 shadow-pop transition-[opacity,transform] duration-150 ease-[var(--ease-out-strong)] group-hover:scale-100 group-hover:opacity-100 group-hover:delay-200">
                {help}
              </span>
            </span>
          )}
        </label>
      )}
      {children}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  indeterminate,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  indeterminate?: boolean;
}) {
  const mixed = !!indeterminate && !checked;
  return (
    <label className="group inline-flex cursor-pointer select-none items-center gap-2 text-sm">
      <span className="relative inline-flex h-4 w-4 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          ref={(el) => {
            if (el) el.indeterminate = mixed;
          }}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 cursor-pointer appearance-none rounded-[5px] border border-border-strong bg-card shadow-xs transition-[background-color,border-color,transform] duration-150 active:scale-90 checked:border-invert checked:bg-invert indeterminate:border-invert indeterminate:bg-invert group-hover:border-foreground/50"
        />
        {checked && (
          <Check className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-invert-fg animate-check-in" strokeWidth={3.2} />
        )}
        {mixed && (
          <Minus className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-invert-fg animate-check-in" strokeWidth={3.2} />
        )}
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}
