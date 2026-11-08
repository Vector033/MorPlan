import Link from "next/link";
import { getOptionalUser } from "@/lib/auth";
import { NavLinks } from "./nav-links";

export async function SiteHeader() {
  const user = await getOptionalUser();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="MorPlan หน้าแรก">
            <span className="grid size-8 place-items-center rounded-xl bg-accent text-sm font-bold text-white" aria-hidden>
              M
            </span>
            <span className="text-lg font-bold tracking-tight">MorPlan</span>
            <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium text-muted">ไม่ใช่ระบบทางการ</span>
          </Link>
          <div className="mx-auto">
            <NavLinks variant="top" />
          </div>
          <div className="ml-auto flex items-center gap-2 text-sm sm:ml-0">
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
      <NavLinks variant="bottom" />
    </>
  );
}
