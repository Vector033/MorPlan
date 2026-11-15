import type { Metadata } from "next";
import { CurriculumGate } from "@/components/curriculum/curriculum-gate";

export const metadata: Metadata = { title: "หลักสูตร" };

export default function CurriculumPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-3 py-6 sm:px-4">
      <header className="pb-2">
        <h1 className="text-title font-bold sm:text-display">หลักสูตรของฉัน</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          เลือกมหาวิทยาลัย คณะ สาขา และรหัสปีที่เข้า แล้ว MorPlan จะหาแผนการเรียนมาให้ตรวจ{" "}
          <strong className="text-ink">ไม่ต้องใส่รหัสผ่านหรือผลการเรียน</strong>
        </p>
      </header>
      <CurriculumGate />
    </main>
  );
}
