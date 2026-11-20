// Fictional gamification (spec 27) for the mock: a ledger per login that
// grows as the mock hears of work (api.cjs calls `award`), the level curve,
// the streak, the quests and the achievements, like the real API's. Numbers
// are made up; the shapes are the contract's.

const TASHKENT = 'Asia/Tashkent';
const dayOf = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TASHKENT }); // yyyy-mm-dd
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const weekStart = (day) => { const d = new Date(`${day}T00:00:00Z`); const dow = (d.getUTCDay() + 6) % 7; return addDays(day, -dow); };

const TITLES = [[25, 'Master'], [18, 'Expert'], [12, 'Specialist'], [8, 'Strategist'], [5, 'Scholar'], [3, 'Learner'], [1, 'Starter']];
const floorOf = (level) => 25 * (level - 1) * (level + 2);
function levelOf(xp) { let l = 1; while (xp >= floorOf(l + 1)) l++; return l; }
const titleOf = (level) => TITLES.find(([at]) => level >= at)[1];

const DAILY = [
  { code: 'daily_right_10', title: '10 right answers', metric: 'right_answers', target: 10, reward_xp: 30 },
  { code: 'daily_reviews_10', title: '10 words reviewed', metric: 'reviews', target: 10, reward_xp: 30 },
  { code: 'daily_finish_1', title: 'One test or assessment finished', metric: 'finished', target: 1, reward_xp: 40 },
];
const WEEKLY = [
  { code: 'weekly_right_60', title: '60 right answers', metric: 'right_answers', target: 60, reward_xp: 90 },
  { code: 'weekly_reviews_60', title: '60 words reviewed', metric: 'reviews', target: 60, reward_xp: 90 },
  { code: 'weekly_days_5', title: '5 active days', metric: 'active_days', target: 5, reward_xp: 120 },
];
// The API's list (spec 27): code, title, description, the figure, the target, the tier, secret.
const A = 'advancement', G = 'goal', C = 'challenge';
const ACHIEVEMENTS = [
  ['first_xp', 'First Step', 'Earn your first XP.', 'xp_total', 1, A],
  ['pencil_age', 'Pencil Age', 'Finish your first mock test.', 'tests', 1, A],
  ['getting_words', 'Getting Words', 'Review your first word.', 'reviews', 1, A],
  ['open_book', 'Open Book', 'Read a page in the Library.', 'reading_days', 1, A],
  ['front_row', 'Front Row', 'Be at a lesson, scanned in.', 'lessons', 1, A],
  ['dream_set', 'Dream Set', 'Choose your dream university.', 'dream', 1, A],
  ['xp_500', 'Momentum', 'Earn 500 XP.', 'xp_total', 500, A],
  ['xp_1000', 'Four Digits', 'Earn 1,000 XP.', 'xp_total', 1000, A],
  ['level_5', 'Scholar', 'Reach level 5.', 'level', 5, G],
  ['level_10', 'Double Digits', 'Reach level 10.', 'level', 10, C],
  ['streak_3', 'Three-Day Spark', 'Three days in a row.', 'best_streak', 3, A],
  ['streak_7', 'Week Warrior', 'Seven days in a row.', 'best_streak', 7, G],
  ['streak_30', 'Month of Momentum', 'Thirty days in a row.', 'best_streak', 30, C],
  ['streak_100', 'Unbreakable', 'A hundred days in a row.', 'best_streak', 100, C],
  ['weekend_scholar', 'Weekend Scholar', 'Both days of a weekend.', 'weekend', 1, A],
  ['comeback', 'Comeback', 'Back after two weeks away.', 'comeback', 1, A, true],
  ['answers_100', 'Century', '100 right answers.', 'right_answers', 100, A],
  ['answers_500', 'Five Hundred', '500 right answers.', 'right_answers', 500, A],
  ['answers_2000', 'Two Thousand', '2,000 right answers.', 'right_answers', 2000, C],
  ['answers_10000', 'Ten Thousand', '10,000 right answers.', 'right_answers', 10000, C],
  ['tests_10', 'Marathon', 'Ten mock tests finished.', 'tests', 10, G],
  ['perfect_set', 'Perfect Set', 'Every question right in a set of ten or more.', 'best_percent', 100, G],
  ['on_target', 'On Target', 'A mock test at or above your target.', 'on_target', 1, G],
  ['club_1500', '1500 Club', 'A mock test of 1500 or more.', 'best_score', 1500, C],
  ['full_marks', 'Full Marks', 'A perfect 1600.', 'best_score', 1600, C, true],
  ['reviews_500', 'Wordsmith', '500 word reviews.', 'reviews', 500, A],
  ['reviews_2000', 'Lexicon', '2,000 word reviews.', 'reviews', 2000, G],
  ['night_owl', 'Night Owl', 'Studying after midnight.', 'night', 1, A, true],
  ['early_bird', 'Early Bird', 'Studying before seven in the morning.', 'early', 1, A, true],
  ['quests_5', 'Quest Habit', 'Five quests finished.', 'quests', 5, A],
  ['quests_25', 'Quest Regular', 'Twenty-five quests finished.', 'quests', 25, C],
  ['full_house', 'Full House', 'All three daily quests in one day.', 'full_days', 1, G],
  ['clean_sweep', 'Clean Sweep', 'All six quests in one week.', 'full_weeks', 1, C],
  ['bookworm', 'Bookworm', 'Reading on ten days.', 'reading_days', 10, G],
  ['regular', 'Regular', 'Twenty lessons, scanned in.', 'lessons', 20, G],
  ['contender', 'Contender', 'Take part in a competition.', 'competitions', 1, A],
].map(([code, title, description, key, target, tier, secret]) => ({ code, title, description, key, target, tier, secret: !!secret }));

const ledgers = new Map(); // login -> { events: Map(source_key -> event), quests: Map(code:period -> row), unlocked: Map(code -> at), right: number }
const ledger = (login) => { if (!ledgers.has(login)) ledgers.set(login, { events: new Map(), quests: new Map(), unlocked: new Map(), right: 0 }); return ledgers.get(login); };

function quest(L, def, period, periodStart) {
  const k = `${def.code}:${periodStart}`;
  if (!L.quests.has(k)) L.quests.set(k, { code: def.code, title: def.title, period, period_start: periodStart, metric: def.metric, progress: 0, target: def.target, reward_xp: def.reward_xp, done_at: null });
  return L.quests.get(k);
}
function currentQuests(L, day) {
  return [...DAILY.map((d) => quest(L, d, 'daily', day)), ...WEEKLY.map((d) => quest(L, d, 'weekly', weekStart(day)))];
}
function days(L) { return new Set([...L.events.values()].map((e) => dayOf(e.happened_at))); }
function streaks(L, today) {
  const active = days(L);
  let current = 0;
  for (let d = active.has(today) ? today : addDays(today, -1); active.has(d); d = addDays(d, -1)) current++;
  let best = 0;
  for (const d of active) { if (active.has(addDays(d, -1))) continue; let n = 0; for (let x = d; active.has(x); x = addDays(x, 1)) n++; best = Math.max(best, n); }
  return { current, best, active_today: active.has(today), active };
}
const total = (L) => [...L.events.values()].reduce((s, e) => s + e.amount, 0);

/** Every figure an achievement can look at, from the ledger (as the API's Facts). */
function figures(L, today) {
  const ev = [...L.events.values()];
  const st = streaks(L, today);
  const kind = (k) => ev.filter((e) => e.source_key.startsWith(k + ':'));
  const hourOf = (iso) => Number(new Date(iso).toLocaleString('en-US', { timeZone: TASHKENT, hour: 'numeric', hourCycle: 'h23' }));
  const quests = [...L.quests.values()].filter((q) => q.done_at);
  const byPeriod = {};
  for (const q of quests) byPeriod[q.period_start] = (byPeriod[q.period_start] || 0) + 1;
  const active = [...st.active].sort();
  let weekend = 0, comeback = 0;
  for (let i = 0; i < active.length; i++) {
    const d = new Date(`${active[i]}T00:00:00Z`);
    if (d.getUTCDay() === 0 && st.active.has(addDays(active[i], -1))) weekend = 1;
    if (i > 0 && (Date.parse(active[i]) - Date.parse(active[i - 1])) / 86400000 >= 15) comeback = 1;
  }
  const goals = L.goals || {};
  const bestScore = Math.max(0, ...kind('attempt').map((e) => e.score || 0));
  return {
    xp_total: total(L), level: levelOf(total(L)), best_streak: st.best, right_answers: L.right, quests: quests.length,
    tests: kind('attempt').length, competitions: ev.filter((e) => e.kind === 'competition').length, reading_days: kind('read').length,
    lessons: kind('attendance').length, reviews: kind('vocab').reduce((s, e) => s + (e.units || 0), 0),
    best_percent: Math.max(0, ...ev.filter((e) => e.source_key.startsWith('assessment:') && (e.questions || 0) >= 10).map((e) => e.percent || 0)),
    best_score: bestScore, night: ev.filter((e) => !e.source_key.startsWith('quest:') && hourOf(e.happened_at) < 4).length,
    early: ev.filter((e) => !e.source_key.startsWith('quest:') && hourOf(e.happened_at) >= 4 && hourOf(e.happened_at) < 7).length,
    full_days: Object.values(byPeriod).filter((n) => n === 3).length, full_weeks: Object.values(byPeriod).filter((n) => n === 6).length,
    dream: goals.university_id ? 1 : 0, on_target: goals.target_total && bestScore >= goals.target_total ? 1 : 0, weekend, comeback,
  };
}

/** The student's goals, for Dream Set and On Target (api.cjs keeps them in step). */
function setGoals(login, goals) { ledger(login).goals = goals; }

/** Record something done: `metrics` feed the quests ({ right_answers, reviews, finished }). */
function award(login, { source_key, title, amount, happened_at = new Date().toISOString(), metrics = {}, replace = false, kind, percent, questions, score, units }) {
  const L = ledger(login);
  const before = levelOf(total(L));
  const had = L.events.get(source_key);
  if (had && !replace) return;
  if (had) { L.right -= had.right || 0; }
  L.events.set(source_key, { source_key, title, amount, happened_at, right: metrics.right_answers || 0, kind, percent, questions, score, units: units ?? metrics.reviews ?? 0 });
  L.right += metrics.right_answers || 0;
  const day = dayOf(happened_at);
  // quests of that day and week
  const touched = currentQuests(L, day);
  const active = days(L);
  for (const q of touched) {
    if (q.done_at) continue;
    if (q.metric === 'active_days') { let n = 0; for (let i = 0; i < 7; i++) if (active.has(addDays(q.period_start, i))) n++; q.progress = n; }
    else q.progress = Math.min(q.target, q.progress + (metrics[q.metric] || 0) - ((had && had.metrics?.[q.metric]) || 0));
    if (q.progress >= q.target) {
      q.done_at = happened_at; // when the work was done, as the server does
      L.events.set(`quest:${q.code}:${q.period_start}`, { source_key: `quest:${q.code}:${q.period_start}`, title: `Quest: ${q.title}`, amount: q.reward_xp, happened_at, right: 0 });
    }
  }
  // achievements
  const state = figures(L, dayOf(new Date().toISOString()));
  for (const a of ACHIEVEMENTS) if (!L.unlocked.has(a.code) && state[a.key] >= a.target) L.unlocked.set(a.code, happened_at);
  L.leveledAt = levelOf(total(L)) > before ? happened_at : L.leveledAt;
}

function state(login, now = new Date()) {
  const L = ledger(login);
  const today = dayOf(now.toISOString());
  const xp = total(L);
  const level = levelOf(xp);
  const st = streaks(L, today);
  const quests = currentQuests(L, today);
  const strip = (q) => ({ code: q.code, title: q.title, progress: q.progress, target: q.target, reward_xp: q.reward_xp, done_at: q.done_at });
  const stateOf = figures(L, today);
  const tomorrow = new Date(`${addDays(today, 1)}T00:00:00+05:00`).toISOString();
  return {
    xp_total: xp,
    xp_today: [...L.events.values()].filter((e) => dayOf(e.happened_at) === today).reduce((s, e) => s + e.amount, 0),
    level,
    level_title: titleOf(level),
    level_floor: floorOf(level),
    next_level_xp: floorOf(level + 1),
    leveled_up_today: !!L.leveledAt && dayOf(L.leveledAt) === today && level > 1,
    streak: { current: st.current, best: st.best, active_today: st.active_today, at_risk: !st.active_today && st.current > 0, days: Array.from({ length: 14 }, (_, i) => { const d = addDays(today, i - 13); return { day: d, active: st.active.has(d) }; }) },
    quests: { daily: quests.filter((q) => q.period === 'daily').map(strip), weekly: quests.filter((q) => q.period === 'weekly').map(strip), resets_at: tomorrow },
    achievements: ACHIEVEMENTS.map((a) => {
      const at = L.unlocked.get(a.code) || null;
      const hidden = a.secret && !at;
      return { code: a.code, title: hidden ? '???' : a.title, description: hidden ? 'A secret. Keep going.' : a.description, tier: a.tier, secret: a.secret, unlocked_at: at, progress: hidden ? 0 : Math.min(a.target, stateOf[a.key] || 0), target: a.target };
    }),
    recent: [...L.events.values()].sort((a, b) => b.happened_at.localeCompare(a.happened_at)).slice(0, 12).map((e) => ({ title: e.title, amount: e.amount, happened_at: e.happened_at })),
  };
}

/** The demo student's past: a month of daily work, so the wall of achievements is full
 * (a 32-day streak to yesterday, 2,000+ right answers, every quest of every day). */
function seed(login) {
  if (ledgers.has(login)) return;
  const today = dayOf(new Date().toISOString());
  const at = (daysAgo, h = 18) => new Date(`${addDays(today, -daysAgo)}T${String(h).padStart(2, '0')}:00:00+05:00`).toISOString();
  for (let d = 32; d >= 1; d--) {
    const day = addDays(today, -d);
    award(login, { source_key: `vocab:${day}`, title: 'Word reviews', amount: 14 + (d % 5) * 4, happened_at: at(d, 9), metrics: { reviews: 14 + (d % 5) * 4 } });
    award(login, { source_key: `attempt:seed-${d}`, title: `Day ${1 + (d % 6)} mock test`, amount: 30 + 58 + (d % 7), happened_at: at(d, d === 3 ? 1 : 16), metrics: { right_answers: 58 + (d % 7), finished: 1 }, questions: 98, percent: Math.round(((58 + (d % 7)) * 100) / 98), score: 1280 + (d % 7) * 30 });
    award(login, { source_key: `assessment:seed-${d}`, title: 'Homework set finished', amount: 15 + 8 + (d % 3), happened_at: at(d, 19), metrics: { right_answers: 8 + (d % 3), finished: 1 }, questions: 10, percent: 80 + (d % 3) * 10 });
    if (d % 4 === 0) award(login, { source_key: `read:${day}`, title: 'A page read in the Library', amount: 5, happened_at: at(d, 21) });
  }
}

module.exports = { award, state, seed, dayOf, setGoals };
