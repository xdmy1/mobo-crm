// Siglele Meta / Facebook / Instagram folosite în secțiunea „Meta Leads” și pe fișa clientului.
// Sunt SVG-uri inline (fără fișiere externe), colorate cu culorile oficiale ale platformelor.

import type { MetaPlatform } from "@prisma/client";
import { cn } from "@/lib/cn";

export function MetaLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.485-1.519a2.27 2.27 0 0 1 1.136-.3z" />
    </svg>
  );
}

export function FacebookLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        fill="#fff"
        d="M15.6 7.6h-1.5c-.7 0-1 .4-1 1.1V10h2.4l-.4 2.6h-2V20h-2.8v-7.4H8.3V10h2V8.4C10.3 6.3 11.5 5 13.6 5c.9 0 1.7.1 2 .1v2.5z"
      />
    </svg>
  );
}

export function InstagramLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <defs>
        <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="10%" stopColor="#fdf497" />
          <stop offset="50%" stopColor="#fd5949" />
          <stop offset="70%" stopColor="#d6249f" />
          <stop offset="100%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="url(#ig-grad)" />
      <rect x="6" y="6" width="12" height="12" rx="3.5" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.9" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="15.7" cy="8.3" r="0.9" fill="#fff" />
    </svg>
  );
}

/** sigla potrivită platformei (Facebook / Instagram) */
export function PlatformLogo({ platform, className }: { platform: MetaPlatform; className?: string }) {
  return platform === "INSTAGRAM" ? <InstagramLogo className={className} /> : <FacebookLogo className={className} />;
}

/** pătrățelul cu sigla Meta (albastru Meta) — în meniu, în antetul paginii și pe fișa clientului */
export function MetaTile({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-11 w-11 rounded-xl" : size === "sm" ? "h-6 w-6 rounded-md" : "h-8 w-8 rounded-lg";
  const logo = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center bg-gradient-to-br from-[#0081fb] to-[#0064e0] text-white shadow-xs",
        dims,
        className
      )}
    >
      <MetaLogo className={logo} />
    </span>
  );
}

/** icoana pentru meniul lateral — aceeași semnătură ca icoanele lucide (className) */
export function MetaNavIcon({ className }: { className?: string }) {
  return <MetaLogo className={className} />;
}

export const PLATFORM_LABEL: Record<MetaPlatform, string> = { FACEBOOK: "Facebook", INSTAGRAM: "Instagram" };
