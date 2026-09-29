import { redirect } from "next/navigation";
import { CalendarDays, Calculator, KanbanSquare } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Autentificare — MOBO CRM" };

const HIGHLIGHTS = [
  { icon: KanbanSquare, text: "Vânzări și producere pe borduri kanban, în timp real" },
  { icon: Calculator, text: "Estimări tehnice, contracte și oferte generate automat" },
  { icon: CalendarDays, text: "Livrări, termene și sarcini într-un singur calendar" },
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/admin/calendar");
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Panoul de brand */}
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full opacity-[0.16]"
          style={{ background: "radial-gradient(closest-side, #ccdf10 0%, transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logomobo.png" alt="Mobo kitchens & home" className="relative h-10 w-auto self-start" />
        <div className="relative max-w-md">
          <h1 className="text-[34px] font-semibold leading-[1.1] tracking-tight">
            Tot fluxul Mobo,
            <br />
            <span className="text-lime-brand">de la lead la montaj.</span>
          </h1>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="flex items-center gap-3 text-sm text-white/70">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-lime-brand">
                  <h.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </span>
                {h.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">
          © {new Date().getFullYear()} Mobo kitchens &amp; home
        </p>
      </div>

      {/* Formularul */}
      <div className="flex items-center justify-center bg-background px-5 py-12">
        <div className="w-full max-w-[380px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logomobo.png"
            alt="Mobo kitchens & home"
            className="mb-8 h-10 w-auto rounded-lg bg-ink p-1.5 lg:hidden"
          />
          <h2 className="text-2xl font-semibold tracking-tight">Bine ai revenit</h2>
          <p className="mt-1 text-sm text-muted">Autentifică-te pentru a continua în CRM.</p>
          <div className="mt-7">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
