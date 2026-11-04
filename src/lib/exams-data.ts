import type { TermExams } from "./core/exams";
import exams2569 from "../../data/exams/2-2569.json";

// Public exam timetable cached by scripts/fetch-exams.mts.
export const EXAMS: TermExams = exams2569 as TermExams;
