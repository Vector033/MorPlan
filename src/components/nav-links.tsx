"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 20px line icons, drawn on the same 24 grid so they share stroke weight.
const ICONS: Record<string, React.ReactNode> = {
  "/": (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  "/compare": (
    <>
      <rect x="3.5" y="4" width="7" height="16" rx="2" />
      <rect x="13.5" y="4" width="7" height="16" rx="2" />
    </>
  ),
  "/import": <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />,
  "/curriculum": (
    <>
      <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  "/ask": <path d="M5 18.5V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9l-4 2.5Z" />,
};

const LINKS = [
  { href: "/", label: "ตาราง" },
  { href: "/compare", label: "เทียบแผน" },
  { href: "/import", label: "นำเข้า" },
  { href: "/curriculum", label: "หลักสูตร" },
  { href: "/ask", label: "ถามระเบียบ" },
];

/** "top": pill group in the header (sm and up). "bottom": thumb-reach bar on phones. */
export function NavLinks({ variant }: { variant: "top" | "bottom" }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  if (variant === "bottom") {
    return (
      <nav
        aria-label="เมนูหลัก"
        className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between gap-1 rounded-full border border-line bg-white/95 p-1.5 shadow-lg backdrop-blur sm:hidden"
        style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
      >
        {LINKS.map((l) => {
          const active = isActive(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-full text-sm font-semibold ${
                active ? "flex-[1.6] bg-accent px-3 text-white" : "flex-1 text-muted hover:text-ink"
              }`}
            >
              <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {ICONS[l.href]}
              </svg>
              <span className={active ? "whitespace-nowrap" : "sr-only"}>{l.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="เมนูหลัก" className="hidden items-center gap-0.5 rounded-full bg-canvas p-1 text-sm sm:flex">
      {LINKS.map((l) => {
        const active = isActive(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 ${
              active ? "bg-ink font-semibold text-white" : "text-muted hover:bg-white hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
