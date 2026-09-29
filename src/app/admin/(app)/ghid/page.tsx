import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = { title: "Ghid rapid — MOBO CRM" };

// Ghidul e o singură pagină de citit într-un minut: drumul unui client, unde găsești fiecare lucru, scurtături.

const STEPS: Array<{ title: string; body: string; href: string; cta: string }> = [
  {
    title: "Clientul intră",
    body: "De pe mobo.md ajunge singur în coloana Lead. Pe unul nou îl adaugi din „Nou” sau din Persoane Fizice. Lipește mesajul primit și numele, telefonul și emailul se completează singure.",
    href: "/admin/contact/kanban",
    cta: "Bord Vânzări",
  },
  {
    title: "Îl suni și notezi ce urmează",
    body: "În fișa clientului scrii următorul pas și apeși Azi, Mâine sau +3 zile. În ziua aceea clientul apare sus pe Bord Central, cu telefonul lângă.",
    href: "/admin/dashboard",
    cta: "Bord Central",
  },
  {
    title: "Măsurare și camere",
    body: "Adaugi camerele în fișa clientului și tragi cardul în coloana Măsurare. Istoricul etapelor se scrie singur.",
    href: "/admin/contact",
    cta: "Persoane Fizice",
  },
  {
    title: "Estimarea",
    body: "„Proiect nou” din fișa clientului te duce în calculator. Prețul apare pe loc, iar clientul trece automat în Calcule.",
    href: "/admin/quote",
    cta: "Estimare",
  },
  {
    title: "Oferta și prezentarea",
    body: "Se generează din estimare, în română sau rusă, din același șablon Mobo. Clientul trece în Prezentare.",
    href: "/admin/offers",
    cta: "Oferte",
  },
  {
    title: "Contractul",
    body: "Vine precompletat cu camerele, proiectele și prețul. După semnare, proiectul apare singur pe Bordul Producere.",
    href: "/admin/contracts",
    cta: "Contracte",
  },
];

const PLACES: Array<[string, string, string]> = [
  ["Bord Vânzări", "/admin/contact/kanban", "clienții pe etape, de la Lead la Contractat"],
  ["Bord Producere", "/admin/opportunity/kanban", "proiectele semnate, pe etape de producție"],
  ["Bord Finanțe", "/admin/finances", "încasări, datorii, profit; se deschide cu parola și codul 2FA, din lacătul din bara de sus"],
  ["Estimare", "/admin/quote", "calculatorul de preț și toate estimările"],
  ["Contracte și Oferte", "/admin/contracts", "documentele generate, de descărcat sau retrimis"],
  ["Calendar și Sarcini", "/admin/calendar", "termene, livrări și ce ai de făcut"],
  ["Setup", "/admin/setup", "angajați, roluri, nomenclatoare, prețuri"],
];

const SHORTCUTS: Array<[string, string]> = [
  ["⌘ K", "Caută orice sau creează ceva nou, de oriunde"],
  ["/", "Sari în căutarea listei curente"],
  ["⌘ ↵", "Salvează formularul deschis"],
  ["Esc", "Închide fereastra de deasupra"],
  ["⌘ click", "Deschide un rând într-un tab nou"],
  ["?", "Lista completă de scurtături"],
];

export default async function GuidePage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-[860px] space-y-8">
      <PageHeader title="Ghid rapid" subtitle={`Bun venit, ${user.firstName}. Tot ce ai nevoie, pe o pagină.`} />

      <section className="rounded-xl border border-border bg-card shadow-xs">
        <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">Drumul unui client</h2>
        <ol className="divide-y divide-border/70">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4 px-5 py-4">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-lime-brand/25 text-[13px] font-semibold text-primary dark:bg-lime-brand/15">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[14px] font-semibold">{s.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.body}</p>
                <Link
                  href={s.href}
                  className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-primary underline-offset-4 hover:underline"
                >
                  {s.cta} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card shadow-xs">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">Unde găsesc</h2>
          <ul className="divide-y divide-border/70">
            {PLACES.map(([label, href, what]) => (
              <li key={href} className="px-5 py-2.5 text-[13px] leading-snug">
                <Link href={href} className="font-medium underline-offset-4 hover:text-primary hover:underline">
                  {label}
                </Link>
                <span className="text-muted"> · {what}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card shadow-xs">
          <h2 className="border-b border-border px-5 py-3 text-sm font-semibold">Scurtături</h2>
          <ul className="divide-y divide-border/70">
            {SHORTCUTS.map(([keys, what]) => (
              <li key={keys} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                <span className="text-foreground/85">{what}</span>
                <kbd className="shrink-0 rounded-md border border-border bg-subtle px-1.5 py-0.5 font-sans text-[11px] font-medium">
                  {keys}
                </kbd>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="text-[13px] text-muted">
        Ține cursorul pe orice buton și îți spune ce face. Un rând din orice listă se deschide cu un click.
      </p>
    </div>
  );
}
