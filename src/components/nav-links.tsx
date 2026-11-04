"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "ตาราง" },
  { href: "/compare", label: "เทียบแผน" },
  { href: "/import", label: "นำเข้า" },
  { href: "/ask", label: "ถามระเบียบ" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="เมนูหลัก" className="flex items-center gap-0.5 overflow-x-auto text-sm">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 transition ${
              active ? "bg-ink text-white" : "text-muted hover:bg-stone-200/60 hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
