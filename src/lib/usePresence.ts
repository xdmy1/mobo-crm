"use client";

import { useEffect, useState } from "react";

/**
 * Ține un element montat cât durează animația de ieșire.
 * `state` se pune pe `data-state`, iar CSS-ul alege animația (vezi globals.css).
 */
export function usePresence(open: boolean, exitMs = 180) {
  const [mounted, setMounted] = useState(open);
  // montarea se face în timpul randării (fără efect), ca intrarea să nu piardă un cadru
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);

  return { mounted, state: open ? ("open" as const) : ("closed" as const) };
}
