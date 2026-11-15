/** Storage bounds for a curriculum: the workspace schema validates against these, and the check functions make their output fit. */
export const LIMITS = {
  text: 200,
  rules: 4000,
  credits: 30,
  planCredits: 500,
  cohort: 99,
  plans: 8,
  terms: 20,
  items: 20,
  electives: 400,
  groups: 12,
  groupCodes: 200,
} as const;
