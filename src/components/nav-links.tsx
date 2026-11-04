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
    <nav aria-label="เมนูหลัก" className="flex h-full items-stretch overflow-x-auto px-4 text-sm sm:px-0">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center whitespace-nowrap border-b-4 px-3 py-2.5 sm:py-0 ${
              active ? "border-accent font-semibold text-white" : "border-transparent text-white/65 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
