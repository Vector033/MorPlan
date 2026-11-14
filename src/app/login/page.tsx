import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/account";
import { getOptionalUser, googleEnabled } from "@/lib/auth";
import { GoogleButton } from "./google-button";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

const ERRORS: Record<string, string> = {
  google: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองใหม่อีกครั้ง หรือใช้อีเมลแทน",
  rate: "ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่",
};

const NOTICES: Record<string, string> = {
  "signed-out": "ออกจากระบบทุกเครื่องแล้ว",
  "password-changed": "เปลี่ยนรหัสผ่านแล้ว เข้าสู่ระบบด้วยรหัสใหม่",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const next = safeNext(one(sp.next));
  if (await getOptionalUser()) redirect(next);
  const error = ERRORS[one(sp.error) ?? ""];
  const notice = NOTICES[one(sp.message) ?? ""];

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-title font-bold">เก็บแผนไว้ในบัญชี</h1>
      <p className="mt-1 mb-4 text-sm text-muted">
        ไม่ต้องเข้าสู่ระบบก็ใช้ได้ แผนจะเก็บในเบราว์เซอร์นี้{" "}
        <span className="inline-block">เข้าสู่ระบบเมื่ออยากเปิดแผนเดียวกันจากหลายเครื่อง</span>
      </p>
      <div className="mb-5 rounded-xs bg-accent-soft p-3 text-sm text-ink" role="note">
        <strong>บัญชีนี้แยกจาก CMU Account และ reg</strong>{" "}
        <span className="inline-block">ห้ามใช้รหัสผ่าน CMU หรือ reg ที่นี่</span> ตั้งรหัสผ่านใหม่
        <span className="whitespace-nowrap">สำหรับ MorPlan เท่านั้น</span>
      </div>
      {(error || notice) && (
        <p
          className={`mb-4 rounded-xs px-3 py-2 text-sm text-ink ${error ? "bg-accent-soft font-medium" : "bg-white ring-1 ring-line"}`}
          role={error ? "alert" : "status"}
        >
          {error ?? notice}
        </p>
      )}
      <div className="card p-5">
        {googleEnabled() && (
          <>
            <GoogleButton next={next} />
            <div className="my-4 flex items-center gap-3 text-xs text-muted" aria-hidden>
              <span className="h-px flex-1 bg-line" />
              หรือใช้อีเมล
              <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}
        <LoginForm next={next} />
      </div>
    </main>
  );
}
