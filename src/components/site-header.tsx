import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { NavLinks } from "./nav-links";

export async function SiteHeader() {
  const user = await getOptionalUser();
  return (
    <header className="z-30 bg-ink text-white sm:sticky sm:top-0">
      <div className="mx-auto flex max-w-7xl flex-wrap items-stretch gap-x-6 px-4 sm:h-14 sm:flex-nowrap">
        <Link href="/" className="flex items-center gap-2 py-3 sm:py-0" aria-label="MorPlan หน้าแรก">
          <span className="grid size-7 place-items-center bg-accent text-sm font-bold" aria-hidden>
            M
          </span>
          <span className="text-lg font-bold tracking-tight">MorPlan</span>
          <span className="border border-white/40 px-1.5 py-px text-[10px] font-medium text-white/70">ไม่ใช่ระบบทางการ</span>
        </Link>
        <div className="order-3 -mx-4 w-[calc(100%+2rem)] border-t border-white/15 sm:order-none sm:mx-0 sm:w-auto sm:border-0">
          <NavLinks />
        </div>
        <div className="ml-auto flex items-center gap-2 py-3 text-sm sm:py-0">
          {user ? (
            <form action="/auth/signout" method="post" className="flex items-center gap-3">
              <span className="hidden max-w-40 truncate text-white/60 md:inline" title={user.email}>
                {user.email}
              </span>
              <button className="whitespace-nowrap text-white/80 underline-offset-4 hover:text-white hover:underline">
                ออกจากระบบ
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="whitespace-nowrap border border-white px-3 py-1.5 font-medium hover:bg-white hover:text-ink"
            >
              เข้าสู่ระบบ
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
