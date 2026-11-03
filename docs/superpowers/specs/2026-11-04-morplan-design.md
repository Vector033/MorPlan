# MorPlan design

Date: 2026-11-04 · Status: approved by the owner up front (owner pre-authorised autonomous work for this session)

## Intent

CMU students plan their timetable across several browser tabs and notes, checking class-time and exam-date clashes by hand, and hunt through long PDFs to answer rule questions ("when is the last day to withdraw?", "what GPA puts me on probation?"). MorPlan puts course sections on a drag-and-drop weekly calendar that flags clashes immediately, keeps several plans side by side, and answers rule questions in Thai with citations to the official document and page.

It is the owner's flagship portfolio project for co-op applications (Nov 2026 – Feb 2027), so beyond working it must show: a smooth, keyboard-accessible calendar, a well-tested clash algorithm, and a RAG system with measured quality.

## Goals

1. Course search by code or title showing section, times, room, instructor, exam dates.
2. Weekly calendar with drag-and-drop placement; instant warnings for class-time clashes and midterm/final clashes.
3. Plans A/B/C, compare side by side, read-only share link, export PNG and `.ics`.
4. Thai Q&A over public regulations with document + page citations, an explicit "ไม่พบ" when the answer is not in the documents, and a "ตรวจสอบกับประกาศทางการอีกครั้ง" notice on every answer.
5. Fully usable on a phone.

## Non-goals (this round)

Registering on the student's behalf, course/instructor reviews, a native app.

## Anti-goals (failure even if it works)

- Asking for, or ever handling, a student's reg username/password.
- Looking like an official CMU system (no CMU logo; a visible "ไม่ใช่ระบบทางการ" notice).
- Republishing the section data reg stopped publishing for PDPA reasons.
- Rule answers that sound authoritative but are not grounded in a cited page.

## Constraints and findings

- **reg course search is login-only.** Since PDPA, `www1.reg.cmu.ac.th/registrationoffice/searchcourse.php` shows a notice that section data needs a reg login. robots.txt allows crawling, but the data is not public.
- **Exam timetables are public.** `timetable_exam.php?type=MIDTERM|FINAL&term=269` is a plain HTML table: rows are dates (`JAN 18`), columns are the three slots `0800-1100`, `1200-1500`, `1530-1830`, cells list course numbers. Notes: TuF pattern includes Tu-only/Fr-only, MTh includes Mo-only/Th-only; the regular schedule does not apply to yearly-system courses; sections 70X/80X use the same schedule; courses taught outside the regular pattern have instructor-set exams.
- **Regulation documents are public PDFs** at `www.reg.cmu.ac.th/webreg/reg-files/...`. The central ones (undergraduate regulations 2566, exam regulations 2564, standards 2566, amendment 2564) are **scanned images** and need Thai OCR; others have a text layer but with font-mapping damage (dropped tone marks, `ำ`/`า` confusion) that needs normalisation.
- Node 26 + npm 11 (install scripts need `allowScripts`), Docker available, FactFit's Supabase already occupies ports 5432x.

## Approaches considered

### Course data

| Option | Trade-off |
|---|---|
| **Paste/upload the reg results page the student opened themselves (chosen)** | No credentials touch MorPlan; data stays the student's. Parser is written blind until a real sample arrives, so it must be tolerant and have a manual-entry fallback. |
| Bookmarklet on the reg page | Smoother, but untestable without a login and closer to automating a login-only system. |
| Manual entry + demo data only | Safest, but weak for real users. Kept as the fallback path. |

Imported sections are stored **per user / per browser**, never pooled into a shared public catalogue (anti-goal 3). Exam slots come from the public timetable and are shared.

### LLM

Gemini (owner's choice, same as FactFit) for answer generation and optionally embeddings. No key exists yet, so the system must work without one: local multilingual embeddings and an extractive answer mode (top passages + citations, threshold-based "ไม่พบ").

### Database / auth

Supabase local (Auth + Postgres + pgvector) with Drizzle, like FactFit (owner's choice), on its own port range (553xx). Plans work without an account (browser storage); signing in syncs them to the database.

## Decided design

### Stack

Next.js 16 (App Router) + TypeScript + Tailwind 4, `@dnd-kit/core` for drag-and-drop, Supabase (`@supabase/ssr`) + Drizzle + postgres-js, zod. Python only for document OCR/extraction (`ingest/`). Vitest (+ fast-check) and Playwright. GitHub Actions CI. UI copy in Thai.

### Domain model (pure TS in `src/lib/core`)

- `Meeting { days: Day[]; start: number; end: number; room?: string }`, minutes since midnight, `Day = "Mo"|"Tu"|"We"|"Th"|"Fr"|"Sa"|"Su"`.
- `Section { id; courseNo; title; credits; section (lec), labSection?; meetings: Meeting[]; instructors: string[]; midterm?: ExamSlot; final?: ExamSlot; note? }`, with `ExamSlot { date: "YYYY-MM-DD"; start; end }`.
- `Plan { id; name; term; sectionIds: string[] }`, `Workspace { term; pool: Section[]; plans: Plan[]; activePlanId }`.
- `findConflicts(sections): Conflict[]` covers class-time overlaps (shared day, `a.start < b.end && b.start < a.end`; touching ends are not clashes), midterm clashes, and final clashes. It also reports a second section of an already-placed course as a "duplicate course". `exactly-adjacent` is fine; TBA meetings never clash.
- Day-pattern parsing: `MTh`, `TuF`, `MWF`, `TT`, `M-F`, `Mo`, `Tu`, `TBA`, etc. → `Day[]` (the reg search form lists every pattern; all must parse).
- Exam lookup: map course number → slot from the public timetable, so sections get exam slots without the student typing them.

### reg import parser

`parseRegImport(input: string): { sections: Section[]; warnings: string[] }` accepts either saved HTML or text copied from a reg results table. It looks for rows with a 6-digit course number and a 3-digit section, then a day pattern, a `HHMM-HHMM` time, a room, and instructor names. It tolerates tabs, repeated whitespace, and rows split across lines. Unknown rows become warnings, never silent drops. A real sample in `samples/` (owner may add one) becomes a fixture test.

### Calendar interaction

- Grid Mon–Sun (Sat/Sun columns only when used), 08:00–21:00, 30-minute rows.
- Dragging a course from the pool (or a placed block) shows **every section of that course as a ghost slot** on the grid. Dropping on a ghost picks that section, dropping on a placed block of the same course swaps sections, and dropping on the pool removes the course.
- Keyboard: focus a block or pool item, press Space/Enter to pick it up, use arrows to move between that course's sections, press Space/Enter to drop, Esc to cancel, and Delete to remove. Live-region announcements are in Thai.
- Clashes: red outline + hatched overlap + a clash list panel; exam clashes shown in an exam list.
- Mobile: day-tabs view (one day at a time) with tap-to-add from search instead of drag, same clash logic.

### Plans, share, export

- Up to 5 plans per workspace (A–E). Compare view: credits, clash count, days with class, earliest start, latest end, free days, next to mini calendars.
- Share: `POST /api/share` stores an immutable snapshot (sections + plan) and returns `/s/<id>` (nanoid 10). Read-only page plus "copy into my plans".
- Export: `.ics` (weekly `RRULE` from term start to last class day per the academic calendar, plus exam events, Asia/Bangkok) and PNG of the grid.

### Auth

Supabase email/password (local: auto-confirm). Signed-in users' workspaces are stored in `workspaces` (jsonb); the first sign-in uploads the browser workspace.

### Regulation Q&A (RAG)

- Corpus manifest `data/docs.json` (URL, title, kind, year). PDFs are downloaded by script into `data/raw/` (gitignored, not redistributed).
- Extraction: PyMuPDF text layer when present; Tesseract `tha+eng` OCR otherwise. Thai normalisation fixes the known font-mapping damage. Output: `data/pages.jsonl` (`docId, page, text`), committed so the app and eval do not need Python.
- Chunking strategies, compared in eval: `fixed` (≈700 chars, 150 overlap), `clause` (split on `ข้อ N` regulation clauses, merged to a size cap), `paragraph` (paragraph/sentence windows using `Intl.Segmenter`).
- Retrieval: BM25 over Thai word tokens (`Intl.Segmenter("th", {granularity: "word"})`), dense cosine over embeddings in pgvector, hybrid = reciprocal-rank fusion (k = 60).
- Embeddings: provider interface. `local` = `Xenova/multilingual-e5-small` via `@huggingface/transformers` (default, free, offline); `gemini` = `gemini-embedding-001` when a key exists.
- Answering: Gemini with a grounded prompt (answer only from the given passages, cite `[n]`, or reply exactly `ไม่พบ`). Without a key: extractive mode. Both abstain when the best fused score is under a tuned threshold. Every answer ends with "ตรวจสอบกับประกาศทางการอีกครั้ง" and lists document title + page with a link to the official PDF page (`#page=N`).
- Eval (`eval/`): ≥100 Thai questions (`eval/questions.jsonl`: `id, question, answer, docId, pages[], answerable`), with ~20% unanswerable. Metrics: recall@1/3/5/10 and MRR per chunking × retriever, abstention accuracy, faithfulness (LLM judge when a key exists, otherwise skipped and reported as such), latency p50/p95 and cost per question. Results are written to `eval/results/*.json` + a Markdown table for the README. Questions are drafted with AI help from the documents and must be spot-checked by a human. The README says so.

### Pages

`/` planner (search + pool + calendar + clash panel + plan tabs), `/compare`, `/import`, `/ask`, `/s/[id]`, `/login`, `/about` (disclaimer, data sources, privacy). A persistent "ไม่ใช่ระบบทางการของ มช." notice in the header/footer.

### Testing and CI

Vitest: conflicts (example + property tests), day patterns, import parser, exam timetable parser, ics, BM25/tokeniser, chunkers, RRF. Playwright: drag-and-drop and keyboard placement, clash warning, share link read-only. CI: lint, typecheck, unit tests, build; e2e job runs against the app with a local Supabase.

## Left to the builder

Visual design details, exact Thai copy, the abstention threshold value (tuned on eval), and how far the mobile drag interaction goes beyond tap-to-add.
