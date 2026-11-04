import type { Metadata } from "next";
import { AskForm } from "./ask-form";

export const metadata: Metadata = { title: "ถามระเบียบ" };

export default function AskPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-3 py-6 sm:px-4">
      <header>
        <h1 className="text-2xl font-bold">ถามเรื่องระเบียบการศึกษา</h1>
        <p className="mt-1 text-sm text-muted">
          ตอบจากข้อบังคับ ประกาศ ปฏิทินการศึกษา และคู่มือของสำนักทะเบียนฯ ที่เผยแพร่สาธารณะ พร้อมอ้างอิงชื่อเอกสารและหน้า
          ถ้าเอกสารไม่มีคำตอบ ระบบจะตอบว่า “ไม่พบ”
        </p>
      </header>
      <AskForm />
    </main>
  );
}
