import { NextResponse } from "next/server";
import { z } from "zod";
import { confirm } from "@/lib/curriculum/store";
import { guardMutation, LIMITS } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const cohort = z.number().int().min(0).max(99);
const body = z
  .object({ id: z.string().regex(/^[\w-]{10}$/), cohortFrom: cohort.optional(), cohortTo: cohort.optional() })
  .refine((b) => b.cohortFrom == null || b.cohortTo == null || b.cohortTo >= b.cohortFrom);

/** Share a pending read with every student of the university. */
export async function POST(request: Request) {
  const blocked = await guardMutation(request, LIMITS.curriculumConfirm);
  if (blocked) return blocked;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง ปีรหัสต้องอยู่ระหว่าง 0–99 และปีสิ้นสุดต้องไม่น้อยกว่าปีเริ่ม" }, { status: 400 });
  const { id, cohortFrom, cohortTo } = parsed.data;
  const result = await confirm(id, cohortFrom, cohortTo);
  if (result === "missing") return NextResponse.json({ error: "ไม่พบรายการที่รอยืนยัน" }, { status: 404 });
  if (result === "range") return NextResponse.json({ error: "ช่วงปีรหัสไม่ถูกต้อง ปีสิ้นสุดต้องไม่น้อยกว่าปีเริ่ม" }, { status: 422 });
  return NextResponse.json({ ok: true });
}
