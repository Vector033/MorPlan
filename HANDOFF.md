# MorPlan handoff (session 2026-11-07 → 11-09)

อ่านไฟล์นี้ต่อจาก `CLAUDE.md` แล้วเริ่มงานได้เลย ตอบเป็นภาษาไทย

## เริ่ม session ใหม่: เปิด skill พวกนี้ก่อน

- **ลด token:** `caveman:caveman` (ตอบสั้น คำง่าย) และ `ponytail:ponytail` (โค้ดน้อยที่สุดที่ครบงาน, ท้ายคำตอบบอกสิ่งที่ข้าม/ความเสี่ยง) ผู้ใช้ขอให้คุยสั้นเพื่อประหยัด token
- **ดีไซน์ (ชุด ai-design-skills ใน `~/.claude/skills`):** `better-interface` (รีวิวรวม), `better-ui`, `better-layout`, `better-typography`, `better-colors`, `better-writing`, `better-accessibility`, `break-ui` (ข้อมูลแย่สุด), `no-ai-design-slop` (ใช้ระหว่างทำ), `audit-ai-design-slop` (รีวิวอย่างเดียว), `animate` / `review-animations` / `improve-animations`, `form-design`, `loading-states`, `error-handling-ux`, `responsive-design`
- **รีวิวโค้ด:** `ponytail:ponytail-review`, `ponytail:ponytail-audit`

## กติกาจากผู้ใช้ (ยังใช้อยู่)

- ห้ามขอหรือรับรหัสผ่าน reg / CMU เด็ดขาด
- **ถามก่อน deploy ทุกครั้ง** · push ขึ้น `main` ได้เลย
- ก่อน commit ต้องผ่าน: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run typecheck`
- e2e ต้องมี Supabase local: เปิด Docker Desktop → `npx supabase start -x studio,storage-api,imgproxy,realtime,edge-runtime,logflare,vector,supavisor,postgres-meta` → เสร็จแล้ว `npx supabase stop`
- Deploy: `npx vercel@latest deploy --prod --yes` (GitHub auto-deploy ไม่ได้ต่อ) แล้วเช็ก `E2E_BASE_URL=https://morplan.vercel.app npm run test:e2e`

## สิ่งที่ทำใน session นี้ (ทุกอย่าง deploy แล้ว)

| commit | งาน |
|---|---|
| 97706c7 | motion: magnetic snap ตอนวาง, สั่นเฉพาะชนใหม่ + แถบเตือนชนด้านบน, แถบเลื่อนใต้แท็บแผน + cross-fade (View Transitions), หน่วยกิตนับขึ้น, ลิ้นชัก "ถามระเบียบ" (`<dialog>`) |
| 6328d7a | `OpenAiCompatProvider` ใน `src/lib/rag/llm.ts` (FreeLLMAPI `127.0.0.1:31415`, local only, `LLM_PROVIDER=freellmapi`) + `EVAL_LLM_MODELS` เทียบโมเดล judge คงที่ `claude-sonnet-4-5` → `eval/results/llm-compare.*` · `/api/ask` ถอยไป extractive ถ้า LLM ล่ม |
| 569e902 | parser นำเข้า: บรรทัดไม่มีชื่อวิชาไม่เอาโค้ดวัน ("MTh") ไปเป็นชื่อ |
| bd20f9b | **redesign "soft campus"**: พื้น lavender `#f4f3f9`, การ์ดขาวมน + เงาบาง, accent ชมพูบานเย็น `#c0179f` สีเดียว, **แดงไว้แค่วิชาชน**, บล็อกวิชาพาสเทล (`COURSE_COLORS` ใน `src/lib/ui.ts`), เมนู pill บนคอม + bottom nav ไอคอนบนมือถือ (`src/components/nav-links.tsx`) · token ทั้งหมดอยู่ใน `src/app/globals.css` |
| 08f7ffe | รูปจากเว็บจริง `docs/screenshots/*.png` (2x) ด้วย `npx tsx scripts/screenshots.mts [baseUrl]` · แก้ e2e คีย์บอร์ดที่ flaky บน prod |
| 1c01508 | **บัญชีผู้ใช้**: `/account` 3 แท็บ (โปรไฟล์ / ความปลอดภัย / ข้อมูลของฉัน), เปลี่ยน/ตั้งรหัสผ่าน (เช็กรหัสเดิม + ออกจากเครื่องอื่น), ออกจากระบบทุกเครื่อง, ลบบัญชี (พิมพ์อีเมลยืนยัน, แผน cascade) · ปุ่ม Google (`/auth/callback`, PKCE, `safeNext`) · `PasswordField` ปุ่มดู/ซ่อนรหัส · e2e `e2e/account.spec.ts` (local only) |

ผล eval (85 ข้อ, judge Sonnet 4.5): Typhoon 2.5 faithfulness 67.9% / correctness 75.0% · Haiku 4.5 82.4% / 88.2% · gpt-oss-120b และ gemini-3-flash โดนโควตาฟรี 429 จึงตัดออก (อยู่ใน `excluded`)

## Google login

- Google Cloud project `vector033-projects` ใช้ร่วมทุกงาน, OAuth client แยกต่อระบบ auth (MorPlan 1 ตัว; HarnKan/SlipJot/FactFit ใช้ Supabase เดียวกัน = 1 ตัว)
- Supabase prod ใส่ client แล้ว, Vercel prod มี `AUTH_GOOGLE_ENABLED=true` · local ปิดไว้ (`supabase/config.toml` `[auth.external.google] enabled=false`)
- เช็กแล้ว: ปุ่มพาไป accounts.google.com, redirect_uri ถูก · หน้า Google แสดงโดเมน `…supabase.co` (ต้อง custom domain ถึงจะเปลี่ยน, เสียเงิน)
- ไฟล์ `client_secret_MorePlan.json` อยู่ใน root ของ repo: gitignore แล้ว **ห้าม commit/อ่าน** ผู้ใช้ควรย้ายออกหรือลบ

## Seed หลักสูตรกลาง (owner เท่านั้น)

ต้องใส่ `--conditions=react-server` เพราะ store import `server-only` · ไม่ใส่ `--yes` = preview ไม่เขียน · อ่าน `DATABASE_URL` จาก `.env.local` (prod: ตั้ง env เองแล้วใส่ `--allow-remote`) · seed ซ้ำจะข้าม ถ้าอยากแทนที่ใส่ `--replace`
```
S="npx tsx --conditions=react-server scripts/seed-curriculum.mts"; B="https://www.cs.science.cmu.ac.th/staff/sutasinee/testprogram/doku.php?id="
$S --kind curriculum --university "มหาวิทยาลัยเชียงใหม่" --faculty "วิทยาศาสตร์" --major "วิทยาการคอมพิวเตอร์" --cohort-from 64 --url "${B}start" --yes
$S --kind electives --university "มหาวิทยาลัยเชียงใหม่" --faculty "วิทยาศาสตร์" --major "วิทยาการคอมพิวเตอร์" --cohort-from 64 --parent <id> --url "${B}64_major_elective" --yes
$S --kind minors --university "มหาวิทยาลัยเชียงใหม่" --file "C:/Users/User/Desktop/cmu-reg-u-2-1.pdf" --title "บัญชีวิชาโท มหาวิทยาลัยเชียงใหม่ พ.ศ. 2565" --yes
```
seed ลง local แล้ว (curriculum -CMdK4aE0L, electives qVgD0UdKPn, minors ImpaWH6VSM) · **seed prod เป็นขั้นตอนของ owner ยังไม่ได้รัน**

## งานค้าง / ต้องเช็ก

1. **ผู้ใช้ลองเอง:** ล็อกอิน Google จริง → `/account` ขึ้น Google "ใช้งานอยู่" → ลองลบบัญชีบน prod (ลบด้วย SQL `delete from auth.users` ผ่าน DB user ของแอป; สิทธิ์บน prod ยังไม่ได้ยืนยัน เพราะอ่าน prod DB ถูกบล็อก; prod ไม่มี `SUPABASE_SECRET_KEY`)
2. **คำถามตัวอย่าง "เกรดเฉลี่ยต่ำกว่าเท่าไหร่ถึงพ้นสภาพนักศึกษา" บน prod (BM25) ตอบ "ไม่พบ"** → แก้ retrieval/query rewrite หรือเปลี่ยนคำถามตัวอย่าง (`src/app/ask/ask-form.tsx`)
3. รัน eval gpt-oss-120b / gemini-3-flash ใหม่ตอนโควตาคืน: `EVAL_LLM_MODELS=gpt-oss-120b EVAL_LLM_DELAY_MS=4000 npm run eval`
4. ยังไม่ได้รัน skill `break-ui`, `audit-ai-design-slop`, `better-writing` กับดีไซน์ใหม่
5. Portfolio: ผู้ใช้จะรวม 5 งานใน session แยก · ร่าง MorPlan case study อยู่ branch `morplan-case-draft` ใน `Desktop\portfolio` (ยังไม่ push) · รูปใช้จาก `docs/screenshots/`
6. ตัวเลขผู้ใช้จริง: ตัวนับ anonymous บน prod มีปนจากการรัน e2e/แคปรูป ให้หักออก
7. README "Status": real reg sample, Thai OCR ตัวเลข, beta users

## กับดักที่เจอ (กันเสียเวลา)

- ไฟล์ส่วนใหญ่เป็น **CRLF**: script แทนข้อความด้วย `\n` จะไม่ match → ใช้ Edit tool หรือ normalize ก่อน
- **ห้ามใส่ backtick ใน `node -e "..."` / heredoc ไม่ quote** บน bash: shell รันเป็นคำสั่ง (เคยรัน screenshot script โดยไม่ตั้งใจ)
- React 19 **ล้างฟอร์มเองหลัง action** แม้ error → ใช้ `submitKeepingValues` (`src/components/submit-keeping-values.ts`)
- Next มี `role="alert"` ของ route announcer → ใน e2e ใช้ `page.locator("main").getByRole("alert")`
- Thai text ใน PDF ดึงด้วย pdftotext ไม่ได้ (font ไม่มี ToUnicode) → render ด้วย Docker image `morplan-ingest` (PyMuPDF)
- รีสตาร์ต dev server หลังแก้ `src/lib/rag/*` (Retrieval singleton อยู่บน globalThis)
- dev server พอร์ต 3100 (`morplan-dev` ใน `Desktop\.claude\launch.json`), Supabase local 553xx
