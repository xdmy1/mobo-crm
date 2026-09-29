import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-28 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card text-muted shadow-xs">
        <Compass className="h-6 w-6" />
      </span>
      <p className="mt-2 font-mono text-xs font-medium text-muted">Eroare 404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Se pare că te-ai pierdut!</h1>
      <p className="text-[13px] text-muted">Pagina nu a fost găsită.</p>
      <Link href="/admin/dashboard" className="mt-3">
        <Button variant="primary">Înapoi spre Dashboard</Button>
      </Link>
    </div>
  );
}
