import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-title font-bold">เก็บแผนไว้ในบัญชี</h1>
      <p className="mt-1 mb-4 text-sm text-muted">
        ไม่ต้องเข้าสู่ระบบก็ใช้ได้ แผนจะเก็บในเบราว์เซอร์นี้ เข้าสู่ระบบเมื่ออยากเปิดแผนเดียวกันจากหลายเครื่อง
      </p>
      <div className="mb-5 rounded-xl bg-accent-soft p-3 text-sm text-ink" role="note">
        <strong>บัญชีนี้แยกจาก CMU Account และ reg</strong> ห้ามใช้รหัสผ่าน CMU หรือ reg ที่นี่ ตั้งรหัสผ่านใหม่สำหรับ MorPlan เท่านั้น
      </div>
      <LoginForm />
    </main>
  );
}
