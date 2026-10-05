"use client";

// Scheletul aplicației: sidebar cu navigație grupată + bară de sus
// (căutare ⌘K, creare rapidă, notificări, temă, utilizator).

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  BellRing,
  Building2,
  Calculator,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  CornerDownLeft,
  FileSignature,
  FileText,
  FolderKanban,
  GraduationCap,
  Hammer,
  Handshake,
  LayoutDashboard,
  Lock,
  LockOpen,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Moon,
  Package,
  PanelLeft,
  Paperclip,
  Plus,
  Presentation,
  Search,
  Settings,
  ShieldCheck,
  SquareCheckBig,
  Sun,
  Trash2,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  deleteNotification,
  getMyNotifications,
  globalSearch,
  markAllRead,
} from "@/server/actions/notifications";
import { lockFinances } from "@/server/actions/security";
import { Modal } from "@/components/ui/Overlay";
import { FinanceUnlockForm } from "@/components/finance/FinanceUnlockForm";
import { FINANCE_UNLOCK_MINUTES, type FinanceShellState } from "@/lib/financeShared";
import { Avatar } from "@/components/ui/Misc";
import { useToast } from "@/components/ui/Toast";
import { TooltipLayer } from "@/components/ui/Tooltip";
import { MessageAlert } from "@/components/layout/MessageAlert";
import { usePresence } from "@/lib/usePresence";
import { cn } from "@/lib/cn";
import { CrumbProvider, useCrumbLeaf } from "./Crumb";

interface NavLink {
  label: string;
  href: string;
  icon: LucideIcon;
}
interface NavGroup {
  label?: string;
  items: NavLink[];
}

const NAV: NavGroup[] = [
  {
    items: [
      { label: "Calendar", href: "/admin/calendar", icon: CalendarDays },
      {
        label: "Bord Central",
        href: "/admin/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Borduri",
    items: [
      { label: "Bord Vânzări", href: "/admin/contact/kanban", icon: Handshake },
      {
        label: "Bord Producere",
        href: "/admin/opportunity/kanban",
        icon: Hammer,
      },
      { label: "Bord Finanțe", href: "/admin/finances", icon: Wallet },
    ],
  },
  {
    label: "Bord Tehnic",
    items: [
      { label: "Estimare", href: "/admin/quote", icon: Calculator },
      { label: "Produse", href: "/admin/products", icon: Package },
    ],
  },
  {
    label: "Bord Clienți",
    items: [
      { label: "Persoane Fizice", href: "/admin/contact", icon: Users },
      { label: "Persoane Juridice", href: "/admin/company", icon: Building2 },
      { label: "Proiecte", href: "/admin/opportunity", icon: FolderKanban },
      { label: "Contracte", href: "/admin/contracts", icon: FileSignature },
      { label: "Oferte", href: "/admin/offers", icon: FileText },
    ],
  },
  {
    label: "Extra",
    items: [
      { label: "Mesaj", href: "/admin/note", icon: MessageSquare },
      { label: "Atașare", href: "/admin/attachment", icon: Paperclip },
      { label: "Sarcini", href: "/admin/task", icon: SquareCheckBig },
      { label: "Email", href: "/admin/email", icon: Mail },
      { label: "Ghid rapid", href: "/admin/ghid", icon: GraduationCap },
      { label: "Setup", href: "/admin/setup", icon: Settings },
    ],
  },
];

const QUICK_ACTIONS: Array<{ label: string; href: string }> = [
  { label: "Creează client nou", href: "/admin/contact?new=1" },
  { label: "Creează proiect nou", href: "/admin/opportunity?new=1" },
  { label: "Estimare tehnică nouă", href: "/admin/quote?new=1" },
  { label: "Creează produs", href: "/admin/products?new=1" },
  { label: "Creează sarcină", href: "/admin/task?new=1" },
  { label: "Creează mesaj", href: "/admin/note?new=1" },
];

const SHORTCUTS: Array<[string, string]> = [
  ["⌘K / Ctrl+K", "Căutare globală și comenzi rapide"],
  ["/", "Sari în căutarea listei curente"],
  ["?", "Arată / ascunde această fereastră"],
  ["Enter sau ⌘↵", "Salvează formularul deschis"],
  ["Esc", "Închide fereastra sau lista de deasupra"],
  ["↑ ↓ Enter", "Alege dintr-o listă derulantă fără mouse"],
  ["⌘-click pe un rând", "Deschide fișa într-un tab nou"],
];

const EXTRA_PAGES: Array<{ label: string; href: string }> = [
  { label: "Vizualizare PDF (Prezentare / Ghid)", href: "/admin/pdf-view" },
  { label: "Toate notificările", href: "/admin/notifications" },
  {
    label: "Setări de Calcule (catalog prețuri)",
    href: "/admin/setup/settings",
  },
  { label: "Roluri și Permisiuni", href: "/admin/setup/role" },
  { label: "Lista Angajați", href: "/admin/setup/staffs" },
  { label: "Securitate cont (2FA)", href: "/admin/security" },
  {
    label: "Organizație / Setarea Companiei",
    href: "/admin/setup/organization",
  },
];

interface NotifItem {
  id: number;
  text: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const iconBtn =
  "relative grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition-[background-color,color,transform] duration-150 hover:bg-foreground/[0.06] hover:text-foreground active:scale-95";
// meniurile cresc din colțul butonului care le-a deschis
const menuPanel =
  "absolute right-0 top-full z-50 mt-2 origin-top-right overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-pop animate-menu-in";

const STORE_EVENT = "mobo-crm:store";

// ceas de 1s pentru countdown-ul stratului financiar (store extern, ca să nu punem setState într-un effect)
let clockTick = 0;
function subscribeClock(cb: () => void) {
  clockTick = Date.now();
  const id = setInterval(() => {
    clockTick = Date.now();
    cb();
  }, 1000);
  return () => clearInterval(id);
}
const subscribeNothing = () => () => {};
const getClock = () => clockTick;
const getServerClock = () => 0;

function subscribeStore(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(STORE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(STORE_EVENT, cb);
  };
}

/** Preferință booleană din localStorage, sigură la hidratare. */
function useStoredFlag(key: string, onValue: string, offValue: string) {
  const value = useSyncExternalStore(
    subscribeStore,
    () => {
      try {
        return localStorage.getItem(key) === onValue;
      } catch {
        return false;
      }
    },
    () => false,
  );
  const set = (next: boolean) => {
    try {
      localStorage.setItem(key, next ? onValue : offValue);
    } catch {}
    window.dispatchEvent(new Event(STORE_EVENT));
  };
  return [value, set] as const;
}

type MenuName = "notif" | "user" | "create";

interface ShellProps {
  userName: string;
  userRole: string | null;
  canFinances: boolean;
  /** stratul financiar: lacătul din bara de sus */
  finance: FinanceShellState;
  children: ReactNode;
}

export function AppShell(props: ShellProps) {
  return (
    <CrumbProvider>
      <Shell {...props} />
    </CrumbProvider>
  );
}

function Shell({ userName, userRole, canFinances, finance, children }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  const [collapsed, setCollapsed] = useStoredFlag(
    "mobo-crm:sidebar",
    "collapsed",
    "open",
  );
  const [dark, setDark] = useStoredFlag("mobo-crm:theme", "dark", "light");
  // meniurile se închid singure la navigare: sunt „deschise” doar pe ruta pe care au fost deschise
  const [menuState, setMenuState] = useState<{
    name: MenuName;
    path: string;
  } | null>(null);
  const menu = menuState?.path === pathname ? menuState.name : null;
  const [mobilePath, setMobilePath] = useState<string | null>(null);
  const mobileOpen = mobilePath === pathname;
  const mobileSheet = usePresence(mobileOpen, 200);
  const crumbLeaf = useCrumbLeaf();
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  // countdown-ul deblocării: ceasul pornește doar pe client (ora serverului ≠ ora clientului la hidratare)
  const tick = useSyncExternalStore(
    finance.unlockedUntil ? subscribeClock : subscribeNothing,
    getClock,
    getServerClock,
  );
  const now = tick > 0 ? tick : null;
  const remainingMs = finance.unlockedUntil && now != null ? finance.unlockedUntil - now : null;
  const financeExpired = remainingMs != null && remainingMs <= 0;
  useEffect(() => {
    // la expirare paginile financiare se închid singure
    if (financeExpired) router.refresh();
  }, [financeExpired, router]);
  const financeCountdown =
    remainingMs != null && remainingMs > 0
      ? `${Math.floor(remainingMs / 60000)}:${String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0")}`
      : null;

  const lockNow = async () => {
    const res = await lockFinances();
    if (!res.ok) return toast.error(res.error ?? "Eroare");
    toast.success("Finanțe blocate");
    router.refresh();
  };

  // „?” arată scurtăturile (dacă nu tastezi într-un câmp)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "?" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      setHelpOpen((v) => !v);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const closeMenu = () => setMenuState(null);
  const toggleMenu = (name: MenuName) =>
    setMenuState((m) =>
      m?.name === name && m.path === pathname ? null : { name, path: pathname },
    );
  const setMobileOpen = (open: boolean) =>
    setMobilePath(open ? pathname : null);

  const groups = NAV.map((g) => ({
    ...g,
    items: canFinances
      ? g.items
      : g.items.filter((i) => i.href !== "/admin/finances"),
  }));
  const allLinks = groups.flatMap((g) =>
    g.items.map((i) => ({ ...i, group: g.label })),
  );

  // elementul activ = cel mai lung href care e prefix al rutei curente
  const active = allLinks
    .filter((l) => pathname === l.href || pathname.startsWith(l.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];

  const toggleCollapsed = () => setCollapsed(!collapsed);

  const toggleTheme = () => {
    const next = !dark;
    const root = document.documentElement;
    // culorile trec lin dintr-o temă în alta (doar pe durata comutării)
    root.classList.add("theme-switching");
    setTimeout(() => root.classList.remove("theme-switching"), 260);
    if (next) root.dataset.theme = "dark";
    else delete root.dataset.theme;
    setDark(next);
  };

  const loadNotifs = useCallback(
    () =>
      getMyNotifications().then((res) => {
        setNotifs(res.items);
        setUnread(res.unread);
      }),
    [],
  );

  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 30000);
    return () => clearInterval(t);
  }, [loadNotifs]);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.getRegistration().then(async (reg) => {
        const sub = await reg?.pushManager?.getSubscription();
        setPushEnabled(!!sub);
      });
    }
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (topRef.current?.contains(e.target as Node)) return;
      setMenuState(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuState(null);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function enablePush() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        toast.error("Browserul nu suportă notificări push.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.info("Permisiunea pentru notificări a fost refuzată.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        toast.error("Cheile VAPID nu sunt configurate pe server.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(key),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setPushEnabled(true);
      toast.success("Notificările push au fost activate.");
    } catch {
      toast.error("Nu s-au putut activa notificările push.");
    }
  }

  const sidebar = (mobile: boolean) => {
    const mini = collapsed && !mobile;
    return (
      <div className="flex h-full flex-col bg-sidebar text-sidebar-fg">
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-sidebar-border",
            mini ? "justify-center px-2" : "justify-between px-4",
          )}
        >
          <Link
            href="/admin/dashboard"
            title="Mobo kitchens & home"
            className="flex items-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mini ? "/mobo-icon.png" : "/logomobo.png"}
              alt="Mobo kitchens & home"
              className={mini ? "h-8 w-8 rounded-lg" : "h-8 w-auto"}
            />
          </Link>
          {mobile && (
            <button
              onClick={() => setMobileOpen(false)}
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-sidebar-fg transition-colors hover:bg-sidebar-hover hover:text-white"
              aria-label="Închide meniul"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <NavList groups={groups} activeHref={active?.href} mini={mini} />

        <div
          className={cn(
            "shrink-0 border-t border-sidebar-border",
            mini ? "p-2" : "p-3",
          )}
        >
          <div
            className={cn(
              "flex items-center rounded-lg",
              mini ? "justify-center py-1" : "gap-2.5 px-1.5 py-1",
            )}
          >
            <Avatar name={userName} size={32} />
            {!mini && (
              <>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-[13px] font-medium text-sidebar-fg-strong">
                    {userName}
                  </p>
                  <p className="truncate text-[11px] text-sidebar-fg/65">
                    {userRole ?? "Utilizator"}
                  </p>
                </div>
                <Link
                  href="/admin/security"
                  title="Securitate cont (2FA)"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sidebar-fg/80 transition-colors hover:bg-sidebar-hover hover:text-white"
                >
                  <ShieldCheck className="h-4 w-4" />
                </Link>
                <a
                  href="/admin/auth/logout"
                  title="Deconectare"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sidebar-fg/80 transition-colors hover:bg-sidebar-hover hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      {/* Sidebar desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 ease-out lg:block print:hidden",
          collapsed ? "w-[60px]" : "w-[244px]",
        )}
      >
        {sidebar(false)}
      </aside>

      {/* Sidebar mobil */}
      {mobileSheet.mounted && (
        <div
          className={cn(
            "fixed inset-0 z-[80] lg:hidden print:hidden",
            !mobileOpen && "pointer-events-none",
          )}
          data-state={mobileSheet.state}
        >
          <div
            className="overlay-backdrop absolute inset-0 bg-[#0f100c]/50 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="overlay-sheet absolute inset-y-0 left-0 w-[264px] shadow-pop">
            {sidebar(true)}
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-200 ease-out print:pl-0",
          collapsed ? "lg:pl-[60px]" : "lg:pl-[244px]",
        )}
      >
        {/* Topbar */}
        <header
          ref={topRef}
          className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md lg:px-5 print:hidden"
        >
          <button
            onClick={() => setMobileOpen(true)}
            className={cn(iconBtn, "lg:hidden")}
            aria-label="Deschide meniul"
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={toggleCollapsed}
            className={cn(iconBtn, "hidden lg:grid")}
            data-tip={collapsed ? "Extinde meniul lateral" : "Restrânge meniul la pictograme"}
            aria-label="Comută meniul lateral"
          >
            <PanelLeft className="h-[18px] w-[18px]" />
          </button>

          <div className="hidden min-w-0 items-center gap-1.5 text-[13px] text-muted md:flex">
            {active ? (
              <>
                {active.group && (
                  <>
                    <span className="truncate">{active.group}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </>
                )}
                {crumbLeaf ? (
                  <>
                    <Link
                      href={active.href}
                      className="truncate transition-colors hover:text-foreground"
                    >
                      {active.label}
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate font-medium text-foreground">
                      {crumbLeaf}
                    </span>
                  </>
                ) : (
                  <span className="truncate font-medium text-foreground">
                    {active.label}
                  </span>
                )}
              </>
            ) : (
              <span className="font-medium text-foreground">MOBO CRM</span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => {
                closeMenu();
                setPaletteOpen(true);
              }}
              className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border-strong/70 bg-card px-2.5 text-[13px] text-muted shadow-xs transition-colors hover:border-border-strong hover:text-foreground sm:w-72"
              data-tip="Caută clienți, proiecte, estimări sau rulează o comandă"
              data-tip-kbd="⌘K"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="hidden flex-1 truncate text-left sm:inline">
                Caută sau rulează o comandă…
              </span>
              <kbd className="hidden rounded-md border border-border bg-subtle px-1.5 py-px font-sans text-[11px] font-medium text-muted sm:inline">
                ⌘K
              </kbd>
            </button>

            <div className="relative">
              <button
                onClick={() => toggleMenu("create")}
                data-tip={menu === "create" ? undefined : "Creează rapid: client, proiect, estimare, sarcină…"}
                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-create px-3 text-[13px] font-medium text-create-fg shadow-xs ring-1 ring-inset ring-black/[0.08] transition-[background-color,transform] duration-150 hover:bg-create-hover active:scale-[0.97]"
              >
                <Plus
                  className={cn(
                    "h-4 w-4 transition-transform duration-200 ease-[var(--ease-out-strong)]",
                    menu === "create" && "rotate-45",
                  )}
                />
                <span className="hidden sm:inline">Nou</span>
              </button>
              {menu === "create" && (
                <div className={cn(menuPanel, "w-60 p-1")}>
                  {QUICK_ACTIONS.map((a) => (
                    <Link
                      key={a.href}
                      href={a.href}
                      onClick={closeMenu}
                      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors hover:bg-foreground/[0.05]"
                    >
                      <Plus className="h-3.5 w-3.5 text-muted" />
                      {a.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {finance.hasPermission &&
              (finance.unlockedUntil && !financeExpired ? (
                <button
                  onClick={lockNow}
                  className="hidden h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-lime-brand/60 bg-lime-brand/15 px-2.5 text-xs font-semibold text-primary transition-[background-color,transform] duration-150 hover:bg-lime-brand/30 active:scale-95 sm:flex"
                  data-tip="Finanțe deblocate. Click pentru a bloca acum."
                  aria-label="Blochează finanțele"
                >
                  <LockOpen className="h-3.5 w-3.5" />
                  <span className="tabular-nums">{financeCountdown ?? "Finanțe"}</span>
                </button>
              ) : (
                <button
                  onClick={() => setFinanceOpen(true)}
                  className="hidden h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted transition-[background-color,color,transform] duration-150 hover:bg-foreground/[0.06] hover:text-foreground active:scale-95 sm:flex"
                  data-tip="Deblochează stratul financiar (parolă + cod 2FA)"
                  aria-label="Deblochează finanțele"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Finanțe
                </button>
              ))}

            <span className="mx-1 hidden h-5 w-px bg-border sm:block" />

            <Link
              href="/admin/pdf-view"
              className={cn(iconBtn, "hidden sm:grid")}
              title="Vizualizare PDF (Prezentare / Ghid)"
            >
              <Presentation className="h-[18px] w-[18px]" />
            </Link>

            {!pushEnabled && (
              <button
                onClick={enablePush}
                className={cn(iconBtn, "hidden sm:grid")}
                title="Activează notificările push"
              >
                <BellRing className="h-[18px] w-[18px]" />
              </button>
            )}

            <button
              onClick={() => setHelpOpen(true)}
              className={cn(iconBtn, "hidden sm:grid")}
              data-tip="Ajutor: scurtături și ghidul rapid"
              data-tip-kbd="?"
              aria-label="Ajutor"
            >
              <CircleHelp className="h-[18px] w-[18px]" />
            </button>

            <button
              onClick={toggleTheme}
              className={iconBtn}
              data-tip={dark ? "Treci pe tema deschisă" : "Treci pe tema închisă"}
            >
              <Sun
                className={cn(
                  "col-start-1 row-start-1 h-[18px] w-[18px] transition-[opacity,transform] duration-300 ease-[var(--ease-out-strong)]",
                  dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0",
                )}
              />
              <Moon
                className={cn(
                  "col-start-1 row-start-1 h-[18px] w-[18px] transition-[opacity,transform] duration-300 ease-[var(--ease-out-strong)]",
                  dark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100",
                )}
              />
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  toggleMenu("notif");
                  if (menu !== "notif" && unread > 0)
                    markAllRead().then(loadNotifs);
                }}
                className={iconBtn}
                data-tip={menu === "notif" ? undefined : unread > 0 ? `Notificări — ${unread} necitite` : "Notificări"}
              >
                <Bell className="h-[18px] w-[18px]" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center">
                    <span className="absolute inset-0 rounded-full bg-danger animate-ping-soft" />
                    <span
                      key={unread}
                      className="relative grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white ring-2 ring-background animate-check-in"
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  </span>
                )}
              </button>
              {menu === "notif" && (
                <div className={cn(menuPanel, "w-96 max-w-[92vw]")}>
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="text-sm font-semibold">Notificări</span>
                    <Link
                      href="/admin/notifications"
                      onClick={closeMenu}
                      className="text-xs font-medium text-muted transition-colors hover:text-foreground"
                    >
                      Toate notificările
                    </Link>
                  </div>
                  <ul className="max-h-96 overflow-y-auto">
                    {notifs.length === 0 && (
                      <li className="flex flex-col items-center gap-2 px-4 py-10 text-[13px] text-muted">
                        <Bell className="h-5 w-5 opacity-50" />
                        Nu există notificări
                      </li>
                    )}
                    {notifs.map((n) => (
                      <li
                        key={n.id}
                        className="group flex items-start gap-2.5 border-b border-border/70 px-4 py-3 text-[13px] last:border-0 hover:bg-subtle/70"
                      >
                        <span
                          className={cn(
                            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                            n.read
                              ? "bg-transparent"
                              : "bg-lime-brand ring-2 ring-lime-brand/25",
                          )}
                        />
                        <button
                          className="min-w-0 flex-1 cursor-pointer text-left leading-snug"
                          onClick={() => {
                            closeMenu();
                            if (n.link) router.push(n.link);
                          }}
                        >
                          {n.text}
                        </button>
                        <button
                          onClick={async () => {
                            await deleteNotification(n.id);
                            loadNotifs();
                          }}
                          className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-md text-muted opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                          title="Șterge notificarea"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="relative lg:hidden">
              <button
                onClick={() => toggleMenu("user")}
                className="ml-0.5 cursor-pointer rounded-full transition-transform hover:scale-105"
                title={userName}
              >
                <Avatar name={userName} size={32} />
              </button>
              {menu === "user" && (
                <div className={cn(menuPanel, "w-56 p-1")}>
                  <div className="px-2.5 py-2">
                    <p className="truncate text-[13px] font-medium">
                      {userName}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {userRole ?? "Utilizator"}
                    </p>
                  </div>
                  <div className="my-1 border-t border-border" />
                  {finance.hasPermission && (
                    <button
                      onClick={() => {
                        closeMenu();
                        if (finance.unlockedUntil && !financeExpired) lockNow();
                        else setFinanceOpen(true);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors hover:bg-foreground/[0.05]"
                    >
                      {finance.unlockedUntil && !financeExpired ? (
                        <>
                          <LockOpen className="h-4 w-4 text-primary" /> Blochează finanțele
                          {financeCountdown && <span className="ml-auto text-xs tabular-nums text-muted">{financeCountdown}</span>}
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" /> Deblochează finanțele
                        </>
                      )}
                    </button>
                  )}
                  <Link
                    href="/admin/security"
                    onClick={closeMenu}
                    className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors hover:bg-foreground/[0.05]"
                  >
                    <ShieldCheck className="h-4 w-4" /> Securitate cont
                  </Link>
                  <a
                    href="/admin/auth/logout"
                    className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-danger transition-colors hover:bg-danger/[0.07]"
                  >
                    <LogOut className="h-4 w-4" /> Deconectare
                  </a>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1680px] flex-1 px-3 py-5 lg:px-6 lg:py-6">
          <div key={pathname} className="animate-page-in">
            {children}
          </div>
        </main>
      </div>

      <TooltipLayer />
      <MessageAlert />
      <Modal open={financeOpen} onClose={() => setFinanceOpen(false)} title="Deblochează finanțele" width={420}>
        <p className="mb-4 text-[13px] leading-relaxed text-muted">
          Stratul financiar se deschide pentru {FINANCE_UNLOCK_MINUTES} minute, apoi se blochează singur.
          Deblocarea se scrie în jurnalul de audit.
        </p>
        <FinanceUnlockForm totpEnabled={finance.totpEnabled} onDone={() => setFinanceOpen(false)} />
      </Modal>
      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Scurtături" width={460} instant>
        <ul className="divide-y divide-border/70">
          {SHORTCUTS.map(([keys, what]) => (
            <li key={keys} className="flex items-center justify-between gap-3 py-2 text-[13px]">
              <span className="text-foreground/85">{what}</span>
              <kbd className="shrink-0 rounded-md border border-border bg-subtle px-1.5 py-0.5 font-sans text-[11px] font-medium">
                {keys}
              </kbd>
            </li>
          ))}
        </ul>
        <Link
          href="/admin/ghid"
          onClick={() => setHelpOpen(false)}
          className="mt-3 flex items-center justify-between rounded-lg bg-lime-brand/20 px-3 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-lime-brand/30"
        >
          <span className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" /> Ești nou? Deschide Ghidul rapid — 5 minute, cu demonstrații
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Modal>
      <CommandPalette
        open={paletteOpen}
        onOpen={() => setPaletteOpen(true)}
        onClose={() => setPaletteOpen(false)}
        pages={[
          ...allLinks.map((l) => ({ label: l.label, href: l.href })),
          ...EXTRA_PAGES,
        ]}
      />
    </div>
  );
}

/* ───────────── Navigația din sidebar, cu indicator activ care alunecă ───────────── */

function NavList({
  groups,
  activeHref,
  mini,
}: {
  groups: NavGroup[];
  activeHref?: string;
  mini: boolean;
}) {
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ y: number; h: number; animate: boolean } | null>(null);

  useLayoutEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    if (!el) {
      setPill(null);
      return;
    }
    // prima poziționare e instantanee; la navigările următoare pastila alunecă
    setPill((p) => ({ y: el.offsetTop, h: el.offsetHeight, animate: p !== null }));
  }, [activeHref, mini, groups.length]);

  return (
    <nav
      ref={navRef}
      data-tip-side={mini ? "right" : undefined}
      className={cn(
        "sidebar-scroll relative flex-1 overflow-y-auto py-3",
        mini ? "px-2" : "px-3",
      )}
    >
      {pill && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0 rounded-lg bg-white/[0.09]",
            mini ? "left-2 right-2" : "left-3 right-3",
            pill.animate &&
              "transition-transform duration-[220ms] ease-[var(--ease-out-strong)]",
          )}
          style={{ height: pill.h, transform: `translateY(${pill.y}px)` }}
        >
          <span
            className={cn(
              "absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-lime-brand",
              mini ? "-left-2" : "-left-3",
            )}
          />
        </span>
      )}
      {groups.map((g, gi) => (
        <div key={g.label ?? gi} className={gi > 0 ? "mt-4" : ""}>
          {g.label &&
            (mini ? (
              <div className="mx-2 mb-2 border-t border-sidebar-border" />
            ) : (
              <p className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-sidebar-fg/55">
                {g.label}
              </p>
            ))}
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const isActive = activeHref === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    data-tip={mini ? item.label : undefined}
                    data-active={isActive}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group flex items-center rounded-lg text-[13px] font-medium transition-colors duration-150",
                      mini ? "h-8 justify-center" : "h-8 gap-2.5 px-2.5",
                      isActive
                        ? "text-white"
                        : "hover:bg-sidebar-hover hover:text-sidebar-fg-strong",
                    )}
                  >
                    <Icon
                      className={cn(
                        "relative h-[17px] w-[17px] shrink-0 transition-colors duration-150",
                        isActive
                          ? "text-lime-brand"
                          : "text-sidebar-fg/80 group-hover:text-sidebar-fg-strong",
                      )}
                      strokeWidth={1.9}
                    />
                    {!mini && <span className="relative truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/* ───────────── Paleta de comenzi ⌘K: acțiuni + navigare + căutare ───────────── */

interface PaletteItem {
  kind: string;
  label: string;
  sub?: string;
  href: string;
  action?: boolean;
}

function CommandPalette({
  open,
  onOpen,
  onClose,
  pages,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  pages: Array<{ label: string; href: string }>;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onOpen]);

  // conținutul se montează doar cât e deschisă paleta → starea se resetează singură la închidere
  return (
    <Modal open={open} onClose={onClose} width={640} instant>
      <PaletteBody pages={pages} onClose={onClose} />
    </Modal>
  );
}

function readRecents(): PaletteItem[] {
  try {
    return JSON.parse(localStorage.getItem("mobo:recents") ?? "[]");
  } catch {
    return [];
  }
}

function PaletteBody({
  pages,
  onClose,
}: {
  pages: Array<{ label: string; href: string }>;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ q: string; items: PaletteItem[] }>({
    q: "",
    items: [],
  });
  const [selected, setSelected] = useState(0);
  const router = useRouter();
  const [recents] = useState<PaletteItem[]>(readRecents);
  // rezultatele unei căutări vechi nu se afișează pentru un text nou
  const results = found.q === q.trim() ? found.items : [];

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const localItems: PaletteItem[] = [
    ...QUICK_ACTIONS.filter((a) => !q || norm(a.label).includes(norm(q))).map(
      (a) => ({ kind: "Acțiune", label: a.label, href: a.href, action: true }),
    ),
    ...pages
      .filter((p) => q && norm(p.label).includes(norm(q)))
      .map((p) => ({ kind: "Pagină", label: p.label, href: p.href })),
  ];

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const t = setTimeout(async () => {
      const r = await globalSearch(term);
      setFound({
        q: term,
        items: r.map((x) => ({
          kind: x.kind,
          label: x.label,
          sub: x.sub,
          href: x.href,
        })),
      });
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const allItems: PaletteItem[] = q
    ? [...localItems, ...results]
    : [...localItems.slice(0, 6), ...recents.slice(0, 5)];

  const close = onClose;

  const go = (item: PaletteItem) => {
    if (!item.action) {
      try {
        const next = [
          item,
          ...recents.filter((r) => r.href !== item.href),
        ].slice(0, 8);
        localStorage.setItem("mobo:recents", JSON.stringify(next));
      } catch {}
    }
    close();
    router.push(item.href);
  };

  return (
    <div className="-mx-5 -my-4">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <Search className="h-[18px] w-[18px] shrink-0 text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSelected(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelected((s) => Math.min(allItems.length - 1, s + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((s) => Math.max(0, s - 1));
            }
            if (e.key === "Enter" && allItems[selected]) {
              e.preventDefault();
              go(allItems[selected]);
            }
          }}
          placeholder="Caută client, telefon, ID sau tastează o comandă…"
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted/60"
        />
        <kbd className="shrink-0 rounded-md border border-border bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-muted">
          Esc
        </kbd>
      </div>
      <ul className="max-h-[52vh] overflow-y-auto p-2">
        {!q && allItems.length > 0 && (
          <li className="px-2.5 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted/80">
            Acțiuni rapide
          </li>
        )}
        {q && allItems.length === 0 && (
          <li className="px-2 py-8 text-center text-[13px] text-muted">
            Nu există rezultate pentru „{q}”
          </li>
        )}
        {allItems.map((r, i) => (
          <li key={`${r.href}-${i}`}>
            {!q &&
              i === Math.min(6, localItems.length) &&
              recents.length > 0 && (
                <p className="px-2.5 pb-1.5 pt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted/80">
                  Vizitate recent
                </p>
              )}
            <button
              onClick={() => go(r)}
              onMouseEnter={() => setSelected(i)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                i === selected && "bg-foreground/[0.055]",
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-md border",
                  r.action
                    ? "border-lime-brand/50 bg-lime-brand/20 text-primary"
                    : "border-border bg-subtle text-muted",
                )}
              >
                {r.action ? (
                  <Plus className="h-3.5 w-3.5" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">
                  {r.label}
                </span>
                {r.sub && (
                  <span className="block truncate text-xs text-muted">
                    {r.sub}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[11px] text-muted/80">
                {r.kind}
              </span>
              {i === selected && (
                <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted/70" />
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-4 rounded-b-2xl border-t border-border bg-subtle/60 px-4 py-2 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <kbd className="rounded border border-border bg-card px-1">↑↓</kbd>{" "}
          navighează
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="rounded border border-border bg-card px-1">↵</kbd>{" "}
          deschide
        </span>
      </div>
    </div>
  );
}

function urlB64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i)
    outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
