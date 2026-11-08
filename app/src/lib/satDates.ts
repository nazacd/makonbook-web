// The SAT's test days, for onboarding's "When are you taking the SAT?" (the
// same days worldwide). Check satsuite.collegeboard.org/sat/dates-deadlines
// and update this list each year; days College Board hasn't confirmed yet are
// marked expected.
export const SAT_DATES: { date: string; expected?: boolean }[] = [
  { date: '2026-12-05' },
  { date: '2027-03-13', expected: true },
  { date: '2027-05-01', expected: true },
  { date: '2027-06-05', expected: true },
];
