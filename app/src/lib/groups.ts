// Copied from makonbook-mobile/src/lib/groups.ts (docs/handoff.md section 5):
// how a HolliHop group name becomes a class title. Keep in step. The only
// differences are `!` assertions for this repo's noUncheckedIndexedAccess.

import type { Weekday } from '@/api/types';

// How a class is named on screen. HolliHop's group names are working labels
// ("MR SARVAR FOUND MATH 17:00 TTS"), never titles: the subject and level come
// from the group's discipline (falling back to the name), the teacher from the
// "MR/MS" prefix, and the students of a private lesson from "IV NAME" or
// "& NAME". Days and time always come from the schedule, never from the name.
// The raw name stays available for the class screen.

export type Subject = 'Math' | 'English';
export type Level = 'foundation' | 'presat' | 'advanced';

export type ClassName = {
  subject: Subject | null;
  level: Level | null;
  /** "Mr Sarvar", or null when the name has no MR/MS prefix. */
  teacher: string | null;
  /** A private (one-to-one or pair) lesson. */
  isPrivate: boolean;
  /** Students named in a private lesson's group name, normal case. */
  students: string[];
  /** "Foundation Math", "Math 1:1" is shown as "Math" with a 1:1 mark. */
  title: string;
  raw: string;
};

const LEVEL_NAME: Record<Level, string> = { foundation: 'Foundation', presat: 'Pre-SAT', advanced: 'Advanced' };

// Words that end a list of names: times ("17:00", "10;30") and day codes.
const STOP = /^(\d{1,2}[:;.]\d{2}|TTS|MWF|TT|MW|SAT|SUN|DAILY)$/;

/** "ROOM 11" -> "11": some rooms are stored with the word, most as just the number. Display only. */
export function roomNumber(classroom: string): string {
  return classroom.replace(/^(room|xona|kab\.?|каб\.?|кабинет)\s*/i, '').trim() || classroom;
}

/** A class as a teacher tells it apart: individual lessons by their students ("IV · Diyora Adilova"). */
export function teacherTitle(name: ClassName): string {
  return name.isPrivate && name.students.length ? `IV · ${name.students.join(', ')}` : name.title;
}

/** "DIYORA ADILOVA" -> "Diyora Adilova"; keeps Uzbek apostrophes (oʻ, gʻ) in the word. */
export function normalCase(text: string): string {
  return text
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part) => (/^[\s-]+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

function subjectOf(text: string): Subject | null {
  if (/\bMATH/.test(text)) return 'Math';
  if (/\b(ENGLISH|ENG|READING|WRITING|VERBAL|RW)\b/.test(text)) return 'English';
  return null;
}

function levelOf(text: string): Level | null {
  if (/\bFOUND/.test(text)) return 'foundation';
  if (/\bPRE\b|\bPRE[- ]?SAT\b/.test(text)) return 'presat';
  if (/\bADV/.test(text)) return 'advanced';
  return null;
}

export function parseClassName(name: string, discipline = ''): ClassName {
  const upper = name.toUpperCase().trim();
  const disc = discipline.toUpperCase();
  const words = upper.split(/\s+/);

  let teacher: string | null = null;
  let rest = words;
  if (/^(MR|MS|MRS|MISS)\.?$/.test(words[0] ?? '') && words[1]) {
    teacher = `${normalCase(words[0]!.replace('.', ''))} ${normalCase(words[1])}`;
    rest = words.slice(2);
  }

  // "IV IBROHIM ..." or "& TEMURMALIK ...": the names up to the time or days.
  const students: string[] = [];
  const marker = rest.findIndex((w) => w === 'IV' || w === '&');
  if (marker !== -1) {
    for (let i = marker + 1; i < rest.length; i++) {
      const w = rest[i]!;
      if (STOP.test(w) || subjectOf(w) || levelOf(w)) break;
      if (w === '&' || w === 'IV') continue;
      students.push(normalCase(w));
    }
  }
  const isPrivate = students.length > 0;

  const subject = subjectOf(disc) ?? subjectOf(upper);
  const level = levelOf(disc) ?? levelOf(upper);

  let title: string;
  if (subject && isPrivate) title = subject;
  else if (subject) title = level ? `${LEVEL_NAME[level]} ${subject}` : subject;
  else title = normalCase(rest.filter((w) => !STOP.test(w)).join(' ') || name);

  return { subject, level, teacher, isPrivate, students, title, raw: name };
}

const LETTER: Record<Weekday, string> = { mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S' };
const ORDER: Record<Weekday, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

/** Days as small letters: tue/thu/sat -> "T T S". */
export function dayLetters(days: Weekday[]): string {
  return [...days].sort((a, b) => ORDER[a] - ORDER[b]).map((d) => LETTER[d]).join(' ');
}

/** "Tue, Thu, Sat" for screen readers, where single letters are ambiguous. */
export function daysSpoken(days: Weekday[]): string {
  const NAMES: Record<Weekday, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
  return [...days].sort((a, b) => ORDER[a] - ORDER[b]).map((d) => NAMES[d]).join(', ');
}
