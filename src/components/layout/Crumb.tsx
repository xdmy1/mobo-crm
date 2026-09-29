"use client";

// Ultimul element din breadcrumb (numele clientului / proiectului deschis).
// Paginile de detaliu randează <SetCrumb label="Ion Rusu" />, iar bara de sus îl afișează.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

interface Leaf {
  path: string;
  label: string;
}

const CrumbCtx = createContext<{
  leaf: Leaf | null;
  setLeaf: (leaf: Leaf | null) => void;
}>({ leaf: null, setLeaf: () => {} });

export function CrumbProvider({ children }: { children: ReactNode }) {
  const [leaf, setLeaf] = useState<Leaf | null>(null);
  return <CrumbCtx.Provider value={{ leaf, setLeaf }}>{children}</CrumbCtx.Provider>;
}

/** eticheta e valabilă doar pe ruta care a setat-o — la navigare dispare singură */
export function useCrumbLeaf(): string | null {
  const pathname = usePathname();
  const { leaf } = useContext(CrumbCtx);
  return leaf && leaf.path === pathname ? leaf.label : null;
}

export function SetCrumb({ label }: { label: string }) {
  const pathname = usePathname();
  const { setLeaf } = useContext(CrumbCtx);
  useEffect(() => {
    setLeaf({ path: pathname, label });
  }, [pathname, label, setLeaf]);
  return null;
}
