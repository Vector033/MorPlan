import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { initialOf } from "@/lib/account";
import { requireAccount } from "@/lib/auth";
import { DeleteForm, PasswordForm, ProfileForm, ResetWorkspaceButton, SignOutButtons } from "./forms";

export const metadata: Metadata = { title: "ตั้งค่าบัญชี" };

const TABS = [
  { id: "profile", label: "โปรไฟล์" },
  { id: "security", label: "ความปลอดภัย" },
  { id: "data", label: "ข้อมูลของฉัน" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const thaiDate = (iso?: string, withTime = false) =>
  iso
    ? new Date(iso).toLocaleString("th-TH", {
        dateStyle: "long",
        ...(withTime ? { timeStyle: "short" } : {}),
        timeZone: "Asia/Bangkok",
      })
    : "–";

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab: Tab = TABS.some((t) => t.id === raw) ? (raw as Tab) : "profile";
  const account = await requireAccount(`/account?tab=${tab}`);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
      <header className="flex flex-wrap items-center gap-4 pb-5">
        <span className="grid size-14 shrink-0 place-items-center rounded-md bg-accent-soft text-2xl font-bold text-accent" aria-hidden>
          {initialOf(account.name, account.email)}
        </span>
        <div className="min-w-0">
          <h1 className="text-title font-bold">ตั้งค่าบัญชี</h1>
          <p className="truncate text-sm text-muted">{account.name ? `${account.name} · ${account.email}` : account.email}</p>
        </div>
      </header>

      <nav aria-label="หมวดการตั้งค่า" className="mb-5 flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-full bg-white p-1 text-sm shadow-sm ring-1 ring-line">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/account?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 ${tab === t.id ? "bg-ink font-semibold text-white" : "text-muted hover:bg-canvas hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "profile" && (
        <Card title="โปรไฟล์" description="ข้อมูลนี้เห็นแค่คุณ แผนที่แชร์เป็นลิงก์จะไม่แสดงชื่อหรืออีเมล">
          <Row label="ชื่อที่แสดง" description="ใช้ทักทายและแสดงที่มุมขวาบน ไม่บังคับ">
            <ProfileForm name={account.name} />
          </Row>
          <Row label="อีเมล" description="ใช้เข้าสู่ระบบและรับลิงก์ยืนยัน">
            <p className="font-medium break-all">{account.email}</p>
          </Row>
          <Row label="วิธีเข้าสู่ระบบ" description="Google ที่ใช้อีเมลเดียวกันจะเข้าบัญชีเดียวกันนี้">
            <ul className="flex flex-col gap-2 text-sm">
              <Method on={account.hasPassword} label="อีเมลและรหัสผ่าน" offText="ยังไม่ได้ตั้งรหัสผ่าน" />
              <Method on={account.methods.includes("google")} label="Google" offText="ยังไม่ได้เชื่อม" />
            </ul>
          </Row>
          <Row label="สมัครเมื่อ">
            <p>{thaiDate(account.createdAt)}</p>
          </Row>
        </Card>
      )}

      {tab === "security" && (
        <div className="flex flex-col gap-5">
          <Card
            title="ความปลอดภัย"
            description="บัญชี MorPlan แยกจากบัญชีมหาวิทยาลัยและระบบลงทะเบียน อย่าใช้รหัสผ่านเดียวกัน"
          >
            <Row
              label={account.hasPassword ? "เปลี่ยนรหัสผ่าน" : "ตั้งรหัสผ่าน"}
              description={
                account.hasPassword
                  ? "เปลี่ยนแล้ว เครื่องอื่นที่ยังเข้าสู่ระบบอยู่จะถูกออกจากระบบ"
                  : "บัญชีนี้สมัครด้วย Google ตั้งรหัสผ่านไว้เผื่อเข้าด้วยอีเมลได้"
              }
            >
              <PasswordForm hasPassword={account.hasPassword} email={account.email} />
            </Row>
            <Row label="เข้าสู่ระบบล่าสุด" description="ถ้าไม่ใช่คุณ ให้เปลี่ยนรหัสผ่านแล้วออกจากระบบทุกเครื่อง">
              <p>{thaiDate(account.lastSignInAt, true)}</p>
            </Row>
            <Row label="อุปกรณ์ที่เข้าสู่ระบบ" description="ออกจากทุกเบราว์เซอร์และทุกเครื่อง รวมเครื่องนี้">
              <SignOutButtons />
            </Row>
          </Card>
        </div>
      )}

      {tab === "data" && (
        <div className="flex flex-col gap-5">
          <Card title="ข้อมูลของฉัน" description="MorPlan เก็บเท่าที่จำเป็นต่อการเปิดแผนเดียวกันจากหลายเครื่อง">
            <Row label="สิ่งที่เก็บในบัญชี">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>อีเมล ชื่อที่แสดง และวันที่สมัคร</li>
                <li>แผนตารางเรียนทุกแผน วิชาที่นำเข้า และหลักสูตรที่เลือก</li>
              </ul>
            </Row>
            <Row label="ล้างข้อมูลพื้นที่ทำงาน" description="ลบแผน วิชา และหลักสูตรในบัญชีนี้ แต่ยังเก็บบัญชีไว้ กู้คืนไม่ได้">
              <ResetWorkspaceButton />
            </Row>
            <Row label="สิ่งที่ไม่เก็บ">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                <li>รหัสผ่านบัญชีมหาวิทยาลัยหรือระบบลงทะเบียน (ไม่เคยขอ)</li>
                <li>IP address: ตัวจำกัดการใช้งานเก็บเป็นค่าแฮชเท่านั้น</li>
              </ul>
            </Row>
          </Card>

          <section aria-labelledby="danger-h" className="card border-danger/30">
            <div className="px-5 pt-5 pb-2">
              <h2 id="danger-h" className="text-heading font-semibold text-danger">
                ลบบัญชี
              </h2>
              <p className="mt-1 text-sm text-muted">
                ลบบัญชีและแผนทุกแผนที่เก็บในบัญชีทันที กู้คืนไม่ได้ ลิงก์แชร์ที่เคยส่งให้เพื่อนเป็นสำเนาแยกและยังเปิดได้
              </p>
            </div>
            <div className="px-5 pt-2 pb-5">
              <DeleteForm email={account.email} />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card" aria-label={title}>
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-heading font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <div className="divide-y divide-line border-t border-line">{children}</div>
    </section>
  );
}

/** Label and help on the left, the control on the right; stacked on phones. */
function Row({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 px-5 py-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-8">
      <div>
        <h3 className="text-sm font-semibold">{label}</h3>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <div className="min-w-0 md:max-w-md">{children}</div>
    </div>
  );
}

function Method({ on, label, offText }: { on: boolean; label: string; offText: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xs border border-line px-3 py-2">
      <span className="font-medium">{label}</span>
      <span className={`chip shrink-0 whitespace-nowrap ${on ? "bg-ok-soft text-ok" : ""}`}>{on ? "ใช้งานอยู่" : offText}</span>
    </li>
  );
}
