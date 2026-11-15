/** Storage bounds for a curriculum: the workspace schema validates against these, and the check functions make their output fit. */
export const LIMITS = {
  text: 200,
  url: 500,
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
  passed: 400,
  doneSlots: 200,
} as const;

/** A stored course code: มช. codes are 6 digits; other universities use 7–8 digits or letters ("01204111", "ITCS101"). */
export const COURSE_NO = /^[0-9A-Z]{2,12}$/;

/** A document or page title as stored: whitespace collapsed, cut to the text limit. */
export const boundTitle = (title: string): string => title.replace(/\s+/g, " ").trim().slice(0, LIMITS.text);
