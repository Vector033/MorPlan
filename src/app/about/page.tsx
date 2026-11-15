import type { Metadata } from "next";
import type { ReactNode } from "react";
import docs from "../../../data/docs.json";

export const metadata: Metadata = { title: "เกี่ยวกับ" };

const KEEP_TOGETHER = [
  "สำนักทะเบียนและประมวลผล",
  "ภาคการศึกษาที่ 2/2569",
  "ระดับปริญญาตรี",
  "(โดยได้รับอักษรลำดับขั้น W)",
  "(การวัดผลยังไม่สิ้นสุด)",
  "พ.ศ. 2566",
  "พ.ศ. 2564",
  "พ.ศ. 2569",
];

function formatDocTitle(title: string): ReactNode {
  // Wrap Thai/year phrases in nowrap spans so lines never break mid-phrase (e.g. "ภาคการ / ศึกษาที่").
  const pattern = new RegExp(`(${KEEP_TOGETHER.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return title.split(pattern).map((part, i) =>
    KEEP_TOGETHER.includes(part) ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-[44rem] flex-col gap-8 px-4 py-8 text-base">
      <header className="pb-2">
        <h1 className="text-title font-bold sm:text-display">เกี่ยวกับ MorPlan</h1>
        <p className="mt-2 max-w-[65ch] text-base">
          ช่วยจัดตารางลงทะเบียนแบบเห็นเวลาเรียนและวันสอบชนทันที พร้อมเทียบหลายแผนก่อนกดยืนยัน{" "}
          (โปรเจกต์ของนักศึกษา <strong>ไม่ใช่ระบบทางการของมหาวิทยาลัยเชียงใหม่</strong> และไม่เกี่ยวข้องกับ
          <span className="whitespace-nowrap">สำนักทะเบียนและประมวลผล</span> ข้อมูลทั้งหมดอาจผิดพลาดหรือล้าสมัย{" "}
          <span className="inline-block">ตรวจสอบกับประกาศทางการอีกครั้งเสมอ</span>)
        </p>
      </header>

      <section>
        <h2 className="mb-3 border-t border-line pt-3 text-heading font-bold">ข้อมูลวิชาและตอนเรียน</h2>
        <p>
          หน้าค้นหากระบวนวิชาของ reg ต้องล็อกอินเพราะ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล MorPlan จึงไม่ดึงหรือเผยแพร่ข้อมูลตอนเรียน{" "}
          นักศึกษาคัดลอกผลค้นหาจาก reg ที่ตัวเองเปิดมาวางเอง ข้อมูลนั้นอยู่ในเบราว์เซอร์ของนักศึกษา (หรือในบัญชี MorPlan ของนักศึกษาเองถ้าเข้าสู่ระบบ){" "}
          <span className="inline-block">และไม่ถูกรวมเป็นฐานข้อมูลกลาง</span>
        </p>
        <p className="mt-2">
          MorPlan <strong>ไม่เคยขอ username หรือ password ของ reg หรือ CMU Account</strong>{" "}
          <span className="whitespace-nowrap">ถ้าเห็นหน้าไหนขอ อย่ากรอก</span>
        </p>
      </section>

      <section>
        <h2 className="mb-3 border-t border-line pt-3 text-heading font-bold">วันสอบ</h2>
        <p>
          ดึงจากตารางสอบกลางภาคและปลายภาคที่<span className="whitespace-nowrap">สำนักทะเบียนฯ</span> เผยแพร่สาธารณะ{" "}
          <span className="whitespace-nowrap">(timetable_exam.php)</span>{" "}
          <span className="whitespace-nowrap">วันละไม่กี่ครั้ง</span> และเก็บไว้ในไฟล์{" "}
          วิชาที่ภาควิชาหรือผู้สอนกำหนดวันสอบเอง<span className="inline-block">อาจไม่มีในตารางนี้</span>
        </p>
      </section>

      <section>
        <h2 className="mb-3 border-t border-line pt-3 text-heading font-bold">หลักสูตรและวิชาโท</h2>
        <p>
          หลักสูตร รายวิชาเลือก และบัญชีวิชาโทที่อ่านจากเว็บไซต์หรือเอกสารของมหาวิทยาลัย (ลิงก์ที่เป็นเว็บ .ac.th) จะถูกเก็บไว้กลางพร้อมลิงก์ต้นทางและวันที่อ่าน{" "}
          <span className="inline-block">เพื่อให้นักศึกษาคนถัดไปใช้ต่อได้โดยไม่ต้องอ่านใหม่</span>
        </p>
        <p className="mt-2">
          สิ่งที่อยู่กับนักศึกษาเองคือวิชาที่ผ่านแล้ว ไฟล์ที่อัปโหลด และข้อความที่วาง{" "}
          <span className="inline-block">เก็บในเบราว์เซอร์ของนักศึกษา ไม่ถูกรวมเป็นฐานข้อมูลกลาง</span>{" "}
          ไฟล์และข้อความที่วางจะถูกส่งไปที่เซิร์ฟเวอร์และ AI เพื่ออ่านเท่านั้น{" "}
          <span className="inline-block">ไม่ถูกเก็บไว้กลางและไม่แชร์ให้คนอื่น</span>
        </p>
        <p className="mt-2">
          หลักสูตรเหล่านี้อ่านโดย AI <strong>ตรวจสอบกับเอกสารของคณะอีกครั้ง</strong>{" "}
          <span className="inline-block">MorPlan ไม่ยืนยันว่าสำเร็จการศึกษาหรือครบวิชาโท</span>
        </p>
      </section>

      <section>
        <h2 className="mb-3 border-t border-line pt-3 text-heading font-bold">เอกสารที่ใช้ตอบคำถามเรื่องระเบียบ</h2>
        <p className="mb-2">
          เอกสารสาธารณะจากเว็บ<span className="whitespace-nowrap">สำนักทะเบียนฯ</span> แปลงเป็นข้อความด้วย OCR (Tesseract){" "}
          ซึ่งอาจอ่านตัวเลขหรือคำผิดได้ คำตอบทุกข้อจึงมี<span className="whitespace-nowrap">ลิงก์ไปหน้าเอกสารต้นฉบับ</span>
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          {docs.map((d) => (
            <li key={d.id}>
              <a className="link" href={d.url} target="_blank" rel="noreferrer">
                {formatDocTitle(d.title)}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 border-t border-line pt-3 text-heading font-bold">สถิติการใช้งาน</h2>
        <p>
          MorPlan นับจำนวนครั้งที่มีการนำเข้า สร้างลิงก์แชร์ หรือถามคำถาม แบบไม่ระบุตัวตน{" "}
          <span className="whitespace-nowrap">(ไม่เก็บ IP หรือเนื้อหา)</span>{" "}
          เพื่อดูว่ามีคนใช้จริงไหม <span className="whitespace-nowrap">คำถามที่ถามจะไม่ถูกเก็บ</span>
        </p>
      </section>
    </main>
  );
}
