import Link from "next/link";
import { initialOf } from "@/lib/account";
import { getOptionalUser } from "@/lib/auth";
import { NavLinks } from "./nav-links";

export async function SiteHeader() {
  const user = await getOptionalUser();
  return (
    <>
      <header className="fluted-glass sticky top-0 z-30 border-b border-line backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="MorPlan หน้าแรก">
            <span className="grid size-8 place-items-center rounded-sm bg-accent text-sm font-bold text-white" aria-hidden>
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
              <Link
                href="/account"
                className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 hover:bg-canvas"
                aria-label={`ตั้งค่าบัญชี (${user.email})`}
              >
                <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent" aria-hidden>
                  {initialOf(user.name ?? "", user.email)}
                </span>
                <span className="hidden max-w-36 truncate font-medium md:inline">{user.name || "บัญชี"}</span>
              </Link>
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
