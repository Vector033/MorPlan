import type { Metadata } from "next";
import docs from "../../../data/docs.json";

export const metadata: Metadata = { title: "เกี่ยวกับ" };

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 text-sm leading-relaxed">
      <header className="border-b-4 border-ink pb-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">เกี่ยวกับ MorPlan</h1>
        <p className="mt-2 text-base">
          MorPlan เป็นโปรเจกต์ของนักศึกษา <strong>ไม่ใช่ระบบทางการของมหาวิทยาลัยเชียงใหม่</strong>{" "}
          และไม่เกี่ยวข้องกับสำนักทะเบียนและประมวลผล ข้อมูลทั้งหมดอาจผิดพลาดหรือล้าสมัย ตรวจสอบกับประกาศทางการอีกครั้งเสมอ
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">ข้อมูลวิชาและตอนเรียน</h2>
        <p>
          หน้าค้นหากระบวนวิชาของ reg ต้องล็อกอินเพราะ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล MorPlan จึงไม่ดึงหรือเผยแพร่ข้อมูลตอนเรียน
          นักศึกษาคัดลอกผลค้นหาจาก reg ที่ตัวเองเปิดมาวางเอง ข้อมูลนั้นอยู่ในเบราว์เซอร์ของนักศึกษา
          (หรือในบัญชี MorPlan ของนักศึกษาเองถ้าเข้าสู่ระบบ) และไม่ถูกรวมเป็นฐานข้อมูลกลาง
        </p>
        <p className="mt-2">
          MorPlan <strong>ไม่เคยขอ username หรือ password ของ reg หรือ CMU Account</strong> ถ้าเห็นหน้าไหนขอ อย่ากรอก
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">วันสอบ</h2>
        <p>
          ดึงจากตารางสอบกลางภาคและปลายภาคที่สำนักทะเบียนฯ เผยแพร่สาธารณะ (timetable_exam.php) วันละไม่กี่ครั้ง และเก็บไว้ในไฟล์
          วิชาที่ภาควิชาหรือผู้สอนกำหนดวันสอบเองอาจไม่มีในตารางนี้
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">เอกสารที่ใช้ตอบคำถามเรื่องระเบียบ</h2>
        <p className="mb-2">
          เอกสารสาธารณะจากเว็บสำนักทะเบียนฯ แปลงเป็นข้อความด้วย OCR (Tesseract) ซึ่งอาจอ่านตัวเลขหรือคำผิดได้
          คำตอบทุกข้อจึงมีลิงก์ไปหน้าเอกสารต้นฉบับ
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {docs.map((d) => (
            <li key={d.id}>
              <a className="font-medium text-ink underline decoration-accent decoration-2 underline-offset-4 hover:text-accent" href={d.url} target="_blank" rel="noreferrer">
                {d.title}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">สถิติการใช้งาน</h2>
        <p>
          MorPlan นับจำนวนครั้งที่มีการนำเข้า สร้างลิงก์แชร์ หรือถามคำถาม แบบไม่ระบุตัวตน (ไม่เก็บ IP หรือเนื้อหา)
          เพื่อดูว่ามีคนใช้จริงไหม คำถามที่ถามจะไม่ถูกเก็บ
        </p>
      </section>
    </main>
  );
}
