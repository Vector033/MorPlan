import type { Metadata } from "next";
import { AskForm } from "./ask-form";

export const metadata: Metadata = { title: "ถามระเบียบ" };

export default function AskPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-3 py-6 sm:px-4">
      <header className="pb-2">
        <h1 className="text-title font-bold sm:text-display">ถามเรื่องระเบียบการศึกษา</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          ตอบจากข้อบังคับ ประกาศ ปฏิทินการศึกษา และคู่มือของ<span className="whitespace-nowrap">มหาวิทยาลัยที่คุณเลือก</span>{" "}
          พร้อมอ้างอิง<span className="whitespace-nowrap">ชื่อเอกสารและหน้า</span>{" "}
          ถ้าเอกสารไม่มีคำตอบ <span className="whitespace-nowrap">ระบบจะตอบว่า “ไม่พบ”</span>
        </p>
      </header>
      <AskForm />
    </main>
  );
}
