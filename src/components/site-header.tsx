import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { NavLinks } from "./nav-links";

export async function SiteHeader() {
  const user = await getOptionalUser();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:h-14 sm:flex-nowrap sm:py-0">
        <Link href="/" className="flex items-baseline gap-1.5" aria-label="MorPlan หน้าแรก">
          <span className="text-lg font-bold tracking-tight">
            Mor<span className="text-accent">Plan</span>
          </span>
          <span className="rounded-full border border-line px-1.5 text-[10px] font-medium text-muted">
            ไม่ใช่ระบบทางการ
          </span>
        </Link>
        <div className="order-3 -mx-1 w-full sm:order-none sm:mx-0 sm:w-auto">
          <NavLinks />
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          {user ? (
            <form action="/auth/signout" method="post" className="flex items-center gap-2">
              <span className="hidden max-w-40 truncate text-muted md:inline" title={user.email}>
                {user.email}
              </span>
              <button className="btn-ghost whitespace-nowrap">ออกจากระบบ</button>
            </form>
          ) : (
            <Link href="/login" className="btn whitespace-nowrap">
              เข้าสู่ระบบ
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
