import type { Emotion } from '@/components/mascot/Panda';
import type { Holiday, Season } from '@/lib/season';

// What Mako says. Deliberately rule-based, as in the old MakonBook: every
// line comes from data the student already sees on the dashboard (work due,
// the streak, the weakest skill, words due, the goals). He never claims to
// be an AI, never invents scores, never writes anything.

const pick = <T>(list: readonly T[]): T => list[(Math.random() * list.length) | 0]!;

export const LINES = {
  poke: [
    'Hehe, that tickles!',
    'Ready for a quick practice set?',
    'Small steps, big score.',
    'Bilim — kuch! Knowledge is power.',
    'One more question? I believe in you.',
    'Water, a stretch, then one more module?',
    'Your future self says thanks.',
    'Mistakes are just answers in disguise.',
    'Focus mode: on. Snacks: later.',
  ],
  love: ['Aww. I like studying with you.', 'Best study buddy ever.', 'You make this panda proud.'],
  angry: ['Hey! Stop poking me!', 'Okay, okay, too many pokes!', 'Grr. I am a serious panda.'],
  makeUp: ['…fine. Friends again?', 'Hmph. Apology accepted.', 'Let’s get back to studying.'],
  welcomeBack: ['Welcome back!', 'There you are! Shall we continue?', 'Missed you. Let’s go!'],
} as const;
export const say = pick;

export const SEASON_LINES: Record<Season, string> = {
  spring: 'Bahor keldi! Spring is the best time to grow.',
  summer: 'Yoz! Stay cool, stay curious.',
  autumn: 'Kuz, the season of harvest. Let’s harvest some points.',
  winter: 'Qish! Warm tea, warm brain.',
};

/** Hello by the time of day (the browser's clock), or the holiday's greeting. */
export function greeting(hour: number, holiday: Holiday | null): string {
  if (holiday) return `${holiday.greeting} ${holiday.english} Let’s make it a great day.`;
  if (hour >= 23 || hour < 5) return 'Late study session? Don’t forget to sleep: rest helps memory.';
  if (hour < 11) return 'Xayrli tong! Fresh mind, fresh start.';
  if (hour < 17) return 'Assalomu alaykum! Ready to learn something new?';
  return 'Xayrli kech! A short session still counts.';
}

export type MakoStep = { title: string; to?: string; onClick?: () => void };
export type MakoMood = { emotion: Emotion; headline: string; message: string; steps: MakoStep[] };

export type MakoInput = {
  now: number;
  /** The nearest work due (not finished), if any. */
  due?: { title: string; dueAt: number; path: string; inProgress: boolean } | null;
  /** Days in a row with an answer, and whether today is one of them. */
  streak: number;
  activeToday: boolean;
  /** The skill with the most mistakes waiting, if any. */
  weakest?: { skill: string; count: number; path: string } | null;
  wordsDue: number;
  hasGoal: boolean;
  /** In a SATMAKON group (else a free account on its roadmap). */
  hasGroup: boolean;
  holiday: Holiday | null;
  onSetGoal?: () => void;
};

const DUE_SOON = 24 * 3600_000;

/** Mako's mood, his line, and up to three next steps (the most meaningful thing wins). */
export function makoMood(i: MakoInput): MakoMood {
  const dueSoon = i.due && i.due.dueAt - i.now <= DUE_SOON ? i.due : null;
  const hour = new Date(i.now).getHours();

  const steps: MakoStep[] = [];
  const add = (step: MakoStep) => {
    if (steps.length < 3 && !steps.some((s) => s.to && s.to === step.to)) steps.push(step);
  };
  if (i.due) add({ title: i.due.inProgress ? `Finish ${i.due.title}` : i.due.title, to: i.due.path });
  if (i.weakest) add({ title: `Practise ${i.weakest.skill}`, to: i.weakest.path });
  if (i.wordsDue > 0) add({ title: `Review ${i.wordsDue} ${i.wordsDue === 1 ? 'word' : 'words'}`, to: '/words/study' });
  if (!i.hasGoal && i.onSetGoal) add({ title: 'Set your SAT goal', onClick: i.onSetGoal });
  if (!i.hasGroup) add({ title: 'Open your roadmap', to: '/roadmaps' });
  if (!steps.length) add({ title: 'Take a mock test', to: '/practice' });

  if (dueSoon) {
    const late = dueSoon.dueAt < i.now;
    return {
      emotion: 'worried',
      headline: late ? 'A deadline has passed' : 'A deadline is close',
      message: late ? `“${dueSoon.title}” was due. Your teacher still takes it, marked late.` : `“${dueSoon.title}” is due within 24 hours. Let’s get it done first.`,
      steps,
    };
  }
  if (i.holiday) return { emotion: 'celebrate', headline: i.holiday.greeting, message: `${i.holiday.english} A short session today still counts.`, steps };
  if (i.streak >= 2 && !i.activeToday) return { emotion: 'worried', headline: `Keep your ${i.streak}-day streak`, message: 'One short session today keeps it alive.', steps };
  if (i.weakest && i.weakest.count >= 3) {
    return { emotion: 'thinking', headline: `Let’s fix ${i.weakest.skill}`, message: `${i.weakest.count} questions missed there, more than anywhere else. A focused round helps most.`, steps };
  }
  if (!i.hasGroup || !i.hasGoal) return { emotion: 'greet', headline: 'Hi, I’m Mako!', message: 'I’ll point you to the most useful next step as you study.', steps };
  if (i.activeToday) return { emotion: 'happy', headline: 'Nice and steady', message: i.streak >= 2 ? `${i.streak} days in a row. Anything more today is a bonus.` : 'You’ve already done something today. Anything more is a bonus.', steps };
  return { emotion: 'happy', headline: greeting(hour, null), message: 'Pick a step and start today’s session.', steps };
}
