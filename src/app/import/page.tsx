import type { Metadata } from "next";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "นำเข้าวิชา" };

export default function ImportPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-3 py-6 sm:px-4">
      <header className="pb-2">
        <h1 className="text-title font-bold sm:text-display">นำเข้าวิชาจาก reg</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          หน้าค้นหารายวิชาของมหาวิทยาลัยส่วนใหญ่ต้องล็อกอินก่อน MorPlan จึงไม่ดึงข้อมูลเอง คุณคัดลอกหน้าผลค้นหามาวาง และ
          <strong className="text-ink"> MorPlan ไม่เคยขอ username หรือ password ของ reg</strong>
        </p>
      </header>

      <ImportForm />

      <p className="text-xs text-muted">
        ข้อมูลที่นำเข้าเก็บไว้ในเครื่องนี้ (หรือในบัญชีของคุณถ้าเข้าสู่ระบบ) MorPlan ไม่นำข้อมูลตอนเรียนของคุณไปเผยแพร่ต่อ สำหรับ มช.
        วันสอบเติมให้อัตโนมัติจากตารางสอบสาธารณะของสำนักทะเบียนฯ มหาวิทยาลัยอื่นยังไม่มีวันสอบอัตโนมัติ
      </p>
    </main>
  );
}
