import type { CurriculumState, PlanCourse, StudyPlan } from "../curriculum";

const c = (courseNo: string, title: string, credits: number): PlanCourse => ({ type: "course", courseNo, title, credits });

export const COOP: StudyPlan = {
  id: "coop",
  name: "แผนสหกิจศึกษา",
  minCredits: 135,
  terms: [
    {
      year: 3,
      semester: 1,
      items: [
        c("204321", "Database Systems", 3),
        c("204341", "Software Engineering", 3),
        c("204361", "Computer Networks", 3),
        c("204451", "Algorithms", 3),
        { type: "slot", kind: "ge", credits: 3 },
        { type: "slot", kind: "minor", credits: 3 },
      ],
    },
    {
      year: 3,
      semester: 2,
      items: [
        c("204306", "Seminar", 1),
        c("204315", "Operating Systems", 3),
        c("204490", "Co-op Preparation", 3),
        { type: "slot", kind: "major-elective", credits: 3 },
        { type: "slot", kind: "minor", credits: 6 },
        { type: "slot", kind: "free", credits: 3 },
      ],
    },
    { year: 4, semester: 1, items: [c("204390", "Project Seminar", 1), c("204496", "Co-op Training", 6)] },
  ],
};

export const STATE: CurriculumState = {
  data: {
    title: "วิทยาการคอมพิวเตอร์ (64)",
    university: "มหาวิทยาลัยเชียงใหม่",
    faculty: "วิทยาศาสตร์",
    major: "วิทยาการคอมพิวเตอร์",
    cohortFrom: 64,
    plans: [COOP],
    electives: {},
  },
  source: { title: "t", readAt: "2026-11-14", provenance: "link" },
  cohort: 67,
  planId: "coop",
  passed: [],
  doneSlots: [],
};
