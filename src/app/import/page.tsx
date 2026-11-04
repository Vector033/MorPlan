import type { Metadata } from "next";
import { ImportForm } from "./import-form";
import { ManualForm } from "./manual-form";

export const metadata: Metadata = { title: "นำเข้าวิชา" };

export default function ImportPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-3 py-6 sm:px-4">
      <header>
        <h1 className="text-2xl font-bold">นำเข้าวิชาจาก reg</h1>
        <p className="mt-1 text-sm text-muted">
          ตั้งแต่มี พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล หน้าค้นหากระบวนวิชาของ reg ต้องล็อกอินก่อน MorPlan จึงไม่ดึงข้อมูลเอง
          และ<strong className="text-ink"> ไม่เคยขอ username หรือ password ของ reg</strong>
        </p>
      </header>

      <ol className="card grid gap-3 p-4 text-sm sm:grid-cols-3">
        <li>
          <span className="font-semibold">1. เปิด reg ในอีกแท็บ</span>
          <p className="text-muted">
            ไปที่{" "}
            <a
              className="text-accent underline"
              href="https://www1.reg.cmu.ac.th/registrationoffice/searchcourse.php"
              target="_blank"
              rel="noreferrer"
            >
              หน้าค้นหากระบวนวิชา
            </a>{" "}
            แล้วล็อกอินที่เว็บ reg เอง
          </p>
        </li>
        <li>
          <span className="font-semibold">2. ค้นวิชาที่อยากลง</span>
          <p className="text-muted">ค้นทีละวิชาหรือทั้งกลุ่ม เช่น รหัส 204 ตารางผลลัพธ์ต้องมี section วัน และเวลา</p>
        </li>
        <li>
          <span className="font-semibold">3. คัดลอกมาวางที่นี่</span>
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
