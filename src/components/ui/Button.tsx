"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "create" | "danger" | "ghost" | "dark" | "outline" | "dangerOutline";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-invert text-invert-fg hover:bg-invert-hover shadow-xs",
  dark: "bg-invert text-invert-fg hover:bg-invert-hover shadow-xs",
  create:
    "bg-create text-create-fg hover:bg-create-hover shadow-xs ring-1 ring-inset ring-black/[0.08]",
  danger: "bg-danger text-white hover:bg-danger-hover shadow-xs",
  ghost: "text-foreground/80 hover:bg-foreground/[0.06] hover:text-foreground",
  outline:
    "border border-border-strong/70 bg-card text-foreground shadow-xs hover:bg-subtle hover:border-border-strong",
  dangerOutline:
    "border border-border-strong/70 bg-card text-danger shadow-xs hover:bg-danger/[0.07] hover:border-danger/40",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5 rounded-lg",
  md: "h-9 px-3.5 text-[13px] gap-2 rounded-lg",
  lg: "h-10 px-4 text-sm gap-2 rounded-[10px]",
  icon: "h-8 w-8 p-0 justify-center rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap font-medium",
        "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";
