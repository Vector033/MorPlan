import type { Metadata } from "next";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "นำเข้าวิชา" };

export default function ImportPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-3 py-6 sm:px-4">
      <header className="pb-2">
        <h1 className="text-title font-bold sm:text-display">นำเข้าวิชาจาก reg</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          หน้าค้นหารายวิชาของมหาวิทยาลัยส่วนใหญ่ต้องล็อกอินก่อน MorPlan จึงไม่ดึงข้อมูลเอง{" "}
          ให้คุณคัดลอก<span className="whitespace-nowrap">หน้าผลค้นหามาวาง</span>{" "}
          <strong className="text-ink">
            โดย MorPlan ไม่เคยขอ <span className="whitespace-nowrap">username หรือ password</span>{" "}
            <span className="whitespace-nowrap">ของ reg</span>
          </strong>
        </p>
      </header>

      <ImportForm />

      <p className="max-w-3xl text-xs text-muted">
        ข้อมูลที่นำเข้าเก็บไว้ในเครื่องนี้ (หรือในบัญชีของคุณถ้าเข้าสู่ระบบ) โดย MorPlan ไม่นำข้อมูลตอนเรียนของคุณไปเผยแพร่ต่อ{" "}
        สำหรับ มช. เติมวันสอบให้อัตโนมัติจากตารางสอบสาธารณะ<span className="whitespace-nowrap">ของสำนักทะเบียนฯ</span>{" "}
        <span className="whitespace-nowrap">(มหาวิทยาลัยอื่น</span>{" "}
        <span className="whitespace-nowrap">ยังไม่มีวันสอบอัตโนมัติ)</span>
      </p>
    </main>
  );
}
