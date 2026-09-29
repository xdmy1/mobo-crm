"use client";

import { useActionState } from "react";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { login } from "@/server/actions/auth";
import { fieldBase } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="username" className="text-[13px] font-medium text-foreground/85">
          Nume utilizator
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus
          className={cn(fieldBase, "h-10 px-3")}
          placeholder="admin"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-[13px] font-medium text-foreground/85">
          Parolă
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className={cn(fieldBase, "h-10 px-3")}
          placeholder="••••••••"
        />
      </div>
      {state?.error && (
        <p className="flex items-center gap-2 rounded-lg border border-danger/25 bg-danger/[0.07] px-3 py-2 text-[13px] font-medium text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="group flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-create text-sm font-semibold text-create-fg shadow-xs ring-1 ring-inset ring-black/[0.08] transition-[background-color,transform] hover:bg-create-hover active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Login
        {!pending && (
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        )}
      </button>
    </form>
  );
}
