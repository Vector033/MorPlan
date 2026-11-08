import type { Metadata } from "next";
import { ImportForm } from "./import-form";
import { ManualForm } from "./manual-form";

export const metadata: Metadata = { title: "นำเข้าวิชา" };

export default function ImportPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-3 py-6 sm:px-4">
      <header className="pb-2">
        <p className="eyebrow">ขั้นแรก</p>
        <h1 className="text-title font-bold sm:text-display">นำเข้าวิชาจาก reg</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          ตั้งแต่มี พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล หน้าค้นหากระบวนวิชาของ reg ต้องล็อกอินก่อน MorPlan จึงไม่ดึงข้อมูลเอง
          และ<strong className="text-ink"> ไม่เคยขอ username หรือ password ของ reg</strong>
        </p>
      </header>

      <ol className="grid overflow-hidden rounded-2xl border border-line bg-white text-sm shadow-md sm:grid-cols-3">
        <li className="p-4">
          <span className="block font-mono text-4xl font-bold">1</span>
          <span className="font-semibold">เปิด reg ในอีกแท็บ</span>
          <p className="text-muted">
            ไปที่{" "}
            <a
              className="link"
              href="https://www1.reg.cmu.ac.th/registrationoffice/searchcourse.php"
              target="_blank"
              rel="noreferrer"
            >
              หน้าค้นหากระบวนวิชา
            </a>{" "}
            แล้วล็อกอินที่เว็บ reg เอง
          </p>
        </li>
        <li className="border-t border-line p-4 sm:border-t-0 sm:border-l">
          <span className="block font-mono text-4xl font-bold">2</span>
          <span className="font-semibold">ค้นวิชาที่อยากลง</span>
          <p className="text-muted">ค้นทีละวิชาหรือทั้งกลุ่ม เช่น รหัส 204 ตารางผลลัพธ์ต้องมี section วัน และเวลา</p>
        </li>
        <li className="border-t border-line p-4 sm:border-t-0 sm:border-l">
          <span className="block font-mono text-4xl font-bold">3</span>
          <span className="font-semibold">คัดลอกมาวางที่นี่</span>
          <p className="text-muted">
            กด <span className="kbd">Ctrl</span>+<span className="kbd">A</span> แล้ว <span className="kbd">Ctrl</span>+
            <span className="kbd">C</span> หรือบันทึกหน้าเว็บ (<span className="kbd">Ctrl</span>+<span className="kbd">S</span>) แล้วอัปโหลดไฟล์
          </p>
        </li>
      </ol>

      <ImportForm />
      <ManualForm />

      <p className="text-xs text-muted">
        ข้อมูลที่นำเข้าถูกประมวลผลในเบราว์เซอร์ของคุณ และเก็บไว้ในเครื่องนี้ (หรือในบัญชีของคุณถ้าเข้าสู่ระบบ) MorPlan
        ไม่นำข้อมูลตอนเรียนของคุณไปเผยแพร่ต่อ วันสอบเติมให้อัตโนมัติจากตารางสอบสาธารณะของสำนักทะเบียนฯ
      </p>
    </main>
  );
}
