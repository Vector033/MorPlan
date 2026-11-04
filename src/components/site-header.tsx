import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { NavLinks } from "./nav-links";

export async function SiteHeader() {
  const user = await getOptionalUser();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="flex items-baseline gap-1.5" aria-label="MorPlan หน้าแรก">
          <span className="text-lg font-bold tracking-tight">
            Mor<span className="text-accent">Plan</span>
          </span>
          <span className="hidden rounded-full border border-line px-1.5 text-[10px] font-medium text-muted sm:inline">
            ไม่ใช่ระบบทางการ
          </span>
        </Link>
        <NavLinks />
        <div className="ml-auto flex items-center gap-2 text-sm">
          {user ? (
            <form action="/auth/signout" method="post" className="flex items-center gap-2">
              <span className="hidden max-w-40 truncate text-muted md:inline" title={user.email}>
                {user.email}
              </span>
              <button className="btn-ghost">ออกจากระบบ</button>
            </form>
          ) : (
            <Link href="/login" className="btn">
              เข้าสู่ระบบ
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
