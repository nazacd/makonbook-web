// The fictional API's assignments (spec 23): teachers give groups homework,
// level checks and exams; students take them; results; notifications.
// Required by api.cjs, which passes what it shares (people, assessments…).
// Made-up questions and classmates only.

const DAY = 86400e3;
const iso = (t) => new Date(t).toISOString();

module.exports = function assignments(ctx) {
  const { people, roster, assessments, attempts, packages, courses, prog, findLesson, json, err } = ctx;

  // A small made-up bank per subject: skills and difficulties to draw from.
  const SKILLS = {
    math: [['Algebra', 'Linear equations in one variable'], ['Algebra', 'Linear functions'], ['Advanced Math', 'Nonlinear functions'], ['Problem-Solving and Data Analysis', 'Percentages']],
    english: [['Craft and Structure', 'Words in Context'], ['Information and Ideas', 'Central Ideas and Details'], ['Standard English Conventions', 'Boundaries'], ['Expression of Ideas', 'Transitions']],
  };
  const DIFFS = ['easy', 'medium', 'hard'];
  const bank = { math: [], english: [] };
  for (const subject of ['math', 'english']) {
    for (let i = 0; i < 30; i++) {
      const [domain, skill] = SKILLS[subject][i % 4];
      const difficulty = DIFFS[Math.floor(i / 4) % 3];
      const id = `b${subject === 'math' ? 1 : 2}000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
      const grid = subject === 'math' && i % 5 === 4;
      bank[subject].push({
        id, type: grid ? 'grid_in' : 'mcq', domain, skill, difficulty, figures: [],
        passage: subject === 'english' ? `A fictional passage number ${i + 1}. The *made-up* town kept its old customs, and ______ the new ones too.` : null,
        stem: subject === 'math' ? (grid ? `If \\(${i + 2}x = ${(i + 2) * 3}\\), what is \\(x\\)?` : `Which value of \\(x\\) satisfies \\(x + ${i} = ${i + 4}\\)?`) : 'Which choice completes the text so that it conforms to the conventions of Standard English?',
        choices: grid ? null : subject === 'math' ? { A: '\\(2\\)', B: '\\(4\\)', C: '\\(6\\)', D: '\\(8\\)' } : { A: 'adopted', B: 'adopting', C: 'adopts', D: 'to adopt' },
        correct: grid ? null : subject === 'math' ? 'B' : 'A',
        accepted: grid ? ['3'] : null,
        explanation: 'A fictional explanation: work it through step by step.',
      });
    }
  }
  const byId = new Map([...bank.math, ...bank.english].map((q) => [q.id, q]));
  const subjectOf = (id) => (byId.get(id)?.id.startsWith('b1') ? 'math' : 'english');
  const full = (q, position) => ({ id: q.id, position, type: q.type, passage: q.passage, stem: q.stem, choices: q.choices, figures: q.figures, correct: q.correct, accepted: q.accepted, explanation: q.explanation, domain: q.domain, skill: q.skill, difficulty: q.difficulty });
  const right = (q, given) => given != null && (q.type === 'mcq' ? given === q.correct : (q.accepted || []).includes(String(given).trim()));

  const groupById = (gid) => Object.values(people).flatMap((p) => p.groups).find((g) => g.id === gid);
  const teaches = (me, gid) => me.kind === 'teacher' && me.groups.some((g) => g.id === gid);
  // A group's students now: the made-up classmates, and the demo student in their own groups.
  const rosterOf = (gid) => {
    const list = roster.map(([client_id, first_name, last_name]) => ({ client_id, first_name, last_name, login: null }));
    for (const p of Object.values(people)) if (p.kind === 'student' && p.groups.some((g) => g.id === gid)) list.push({ client_id: p.id, first_name: p.first_name, last_name: p.last_name, login: p.login });
    return list.sort((a, b) => a.last_name.localeCompare(b.last_name));
  };

  const list = new Map(); // id -> assignment
  const notes = new Map(); // login -> [notification]
  let noteId = 1;
  const notify = (login, n) => { const l = notes.get(login) || []; l.unshift({ id: noteId++, created_at: iso(Date.now()), read_at: null, ...n }); notes.set(login, l); };

  function lessonOf(course, lessonId) {
    const c = courses[course]; if (!c) return null;
    for (const u of c.units) for (const l of u.lessons) if (l.id === lessonId) return { course, lesson_id: l.id, title: l.title, unit_id: u.id, unit_title: u.title, l };
    return null;
  }
  function testOf(code, sections) {
    const pkg = packages[code]; if (!pkg) return null;
    const count = (s) => pkg.sections.filter((x) => x.subject === s).reduce((n, x) => n + x.modules.reduce((m, mod) => m + mod.questions.length, 0), 0);
    return { code, title: pkg.title, sections, english: count('english'), math: count('math') };
  }

  function create(input, teacherId) {
    const g = groupById(input.group_id);
    const now = Date.now();
    const lesson = input.lesson_id ? lessonOf(input.course, input.lesson_id) : null;
    const test = input.kind === 'exam' ? testOf(input.test, input.sections) : null;
    const subject = lesson ? courses[input.course].subject : test ? (input.sections.includes('math') && !input.sections.includes('english') ? 'math' : 'english') : input.subject || subjectOf(input.question_ids?.[0]);
    const hw = lesson && input.homework_index != null ? lesson.l.homework[input.homework_index] : null;
    const title = (input.title || '').trim() || (input.kind === 'exam' ? test.title : input.kind === 'level_check' ? `${lesson.title} · Level check` : hw ? hw.title : 'Homework');
    const a = {
      id: `a5${Math.random().toString(16).slice(2, 8)}-0000-4000-8000-${String(list.size + 1).padStart(12, '0')}`,
      group_id: g.id, group_name: g.name, teacher_id: teacherId, kind: input.kind, title, instructions: input.instructions || '', subject,
      lesson: lesson ? { course: lesson.course, lesson_id: lesson.lesson_id, title: lesson.title, unit_id: lesson.unit_id, unit_title: lesson.unit_title } : null,
      homework_index: input.homework_index ?? null, test, skills: input.skills || (hw ? hw.skills : lesson ? lesson.l.level_check.skills : []), mix: input.mix || null,
      question_ids: input.kind === 'exam' ? [] : input.question_ids, opens_at: input.opens_at || iso(now), due_at: input.due_at, closed_at: null, created_at: iso(now), updated_at: iso(now),
    };
    list.set(a.id, a);
    for (const s of rosterOf(g.id)) if (s.login) notify(s.login, { kind: 'assignment', title: `New ${a.kind === 'level_check' ? 'level check' : a.kind}: ${a.title}`, body: `${g.name} · due ${new Date(a.due_at).toUTCString().slice(5, 22)}`, link: a.kind === 'homework' ? '/homework' : a.kind === 'level_check' ? '/level-checks' : '/exams' });
    return a;
  }

  // Seed: what the demo teacher gave the English group, and one from the math teacher.
  const seed = () => {
    const now = Date.now();
    const eng = Object.keys(courses).find((k) => k.startsWith('english-pre-sat')) || 'english-pre-sat';
    const c = courses[eng]; const l1 = c.units[0].lessons[0]; const l2 = c.units[0].lessons[1] || l1;
    const pick = (subject, n, from = 0) => bank[subject].slice(from, from + n).map((q) => q.id);
    create({ group_id: 502, kind: 'homework', course: eng, lesson_id: l1.id, homework_index: 0, question_ids: pick('english', 4), due_at: iso(now + 2 * DAY), opens_at: iso(now - DAY), instructions: 'Read the passage twice before you answer.' }, 77);
    create({ group_id: 502, kind: 'level_check', course: eng, lesson_id: l2.id, question_ids: pick('english', 6, 4), due_at: iso(now + 5 * DAY), opens_at: iso(now - 3 * 3600e3) }, 77);
    create({ group_id: 502, kind: 'exam', test: 'DAY1', sections: ['english', 'math'], due_at: iso(now + 7 * DAY), opens_at: iso(now - 2 * DAY) }, 77);
    create({ group_id: 502, kind: 'homework', subject: 'english', skills: ['Boundaries'], mix: { easy: 2, medium: 1, hard: 0 }, question_ids: pick('english', 3, 10), title: 'Commas and boundaries', due_at: iso(now - DAY), opens_at: iso(now - 4 * DAY) }, 77);
    create({ group_id: 501, kind: 'homework', subject: 'math', skills: ['Linear functions'], mix: { easy: 3, medium: 2, hard: 0 }, question_ids: pick('math', 5), title: 'Linear functions warm-up', due_at: iso(now + DAY), opens_at: iso(now - DAY) }, 99);
    create({ group_id: 502, kind: 'homework', subject: 'english', skills: ['Transitions'], mix: { easy: 0, medium: 2, hard: 1 }, question_ids: pick('english', 3, 20), title: 'Transitions (next week)', due_at: iso(now + 9 * DAY), opens_at: iso(now + 2 * DAY) }, 77);
    for (const n of notes.values()) for (const x of n.slice(2)) x.read_at = iso(Date.now());
  };
  seed();

  const statusOf = (a) => (a.closed_at ? 'closed' : Date.parse(a.opens_at) > Date.now() ? 'scheduled' : Date.parse(a.due_at) < Date.now() ? 'overdue' : 'open');
  const questionsOf = (a) => (a.kind === 'exam' ? a.test.sections.reduce((n, s) => n + a.test[s], 0) : a.question_ids.length);

  // A made-up classmate's work: done or not, how well, how fast.
  const fakeWork = (a, s) => {
    const k = (s.client_id * 7 + a.title.length) % 10;
    if (statusOf(a) === 'scheduled' || k >= 7) return null;
    const ids = a.question_ids;
    const answers = {}; const times = {};
    ids.forEach((id, i) => { const q = byId.get(id); const ok = (k + i) % 3 !== 0; answers[id] = (k + i) % 7 === 6 ? null : ok ? (q.type === 'mcq' ? q.correct : q.accepted[0]) : q.type === 'mcq' ? ['A', 'B', 'C', 'D'].find((x) => x !== q.correct && (k + i) % 4 === ['A', 'B', 'C', 'D'].indexOf(x)) || 'C' : '7'; times[id] = 30 + ((k * 13 + i * 17) % 90); });
    const due = Date.parse(a.due_at); const finished = k === 5 ? due + 3600e3 : Math.min(Date.now() - 3600e3 * (k + 1), due - 3600e3);
    return { answers, times, finished_at: iso(Math.max(Date.parse(a.opens_at) + 60e3, finished)), tries: 1 + (k % 2), inProgress: k === 6 };
  };

  function standing(a, s) {
    const base = { status: 'new', assessment_id: null, attempt_id: null, started_at: null, finished_at: null, late: false, percent: null, correct: null, total: null, passed: null, scores: null, total_score: null, tries: 0, best: null };
    if (a.kind === 'exam') {
      const mine = s.login ? [...attempts.entries()].filter(([k, x]) => k.startsWith(`${s.login}:`) && x.test === a.test.code && Date.parse(x.finished_at) >= Date.parse(a.opens_at) && a.test.sections.every((sec) => x.sections.includes(sec))).map(([, x]) => x).sort((x, y) => x.finished_at.localeCompare(y.finished_at)) : [];
      let first = mine[0];
      if (!s.login) { const f = fakeWork(a, s); if (f && !f.inProgress) first = { id: `0000000c-0000-4000-8000-${String(s.client_id).padStart(12, '0')}`, started_at: iso(Date.parse(f.finished_at) - 3600e3 * 2), finished_at: f.finished_at, scores: { english: { raw: 3, questions: 6, score: 500 + (s.client_id % 4) * 50 }, math: { raw: 4, questions: 6, score: 550 + (s.client_id % 3) * 50 } } }; }
      if (!first) return base;
      const scores = Object.fromEntries(a.test.sections.map((sec) => [sec, first.scores[sec]]));
      const total = a.test.sections.reduce((n, sec) => n + (first.scores[sec]?.score || 0), 0);
      return { ...base, status: 'done', attempt_id: first.id, started_at: first.started_at, finished_at: first.finished_at, late: Date.parse(first.finished_at) > Date.parse(a.due_at), scores, total_score: total, tries: Math.max(1, mine.length), best: total };
    }
    if (!s.login) {
      const f = fakeWork(a, s); if (!f) return base;
      if (f.inProgress) return { ...base, status: 'in_progress', started_at: iso(Date.now() - 1800e3) };
      const qs = a.question_ids.map((id) => byId.get(id)); const correct = qs.filter((q) => right(q, f.answers[q.id])).length; const percent = Math.floor((100 * correct) / qs.length);
      return { ...base, status: 'done', started_at: iso(Date.parse(f.finished_at) - 1200e3), finished_at: f.finished_at, late: Date.parse(f.finished_at) > Date.parse(a.due_at), percent, correct, total: qs.length, passed: a.kind === 'homework' ? true : percent >= 70, tries: f.tries, best: Math.min(100, percent + (f.tries > 1 ? 15 : 0)) };
    }
    const mine = [...assessments.values()].filter((x) => x.owner === s.login && x.assignment?.id === a.id);
    const done = mine.filter((x) => x.finished_at).sort((x, y) => x.finished_at.localeCompare(y.finished_at));
    const open = mine.find((x) => !x.finished_at);
    const first = done[0];
    if (!first) return open ? { ...base, status: 'in_progress', assessment_id: open.id, started_at: open.created_at } : base;
    return { ...base, status: open ? 'in_progress' : 'done', assessment_id: open ? open.id : first.id, started_at: first.created_at, finished_at: first.finished_at, late: Date.parse(first.finished_at) > Date.parse(a.due_at), percent: first.result.percent, correct: first.result.correct, total: first.result.total, passed: first.result.passed, tries: done.length, best: Math.max(...done.map((x) => x.result.percent)) };
  }
  // Statuses as the student list says them: done once a first one finished, even while practising again.
  const studentStanding = (a, s) => { const st = standing(a, s); return st.finished_at ? { ...st, status: 'done' } : st; };

  function summary(a) {
    const rs = rosterOf(a.group_id).map((s) => studentStanding(a, s));
    const done = rs.filter((x) => x.status === 'done');
    const avg = (xs) => (xs.length ? Math.round((10 * xs.reduce((n, x) => n + x, 0)) / xs.length) / 10 : null);
    return { students: rs.length, done: done.length, late: done.filter((x) => x.late).length, in_progress: rs.filter((x) => x.status === 'in_progress').length, average_percent: a.kind === 'exam' ? null : avg(done.map((x) => x.percent)), average_score: a.kind === 'exam' ? avg(done.map((x) => x.total_score)) : null };
  }
  const out = (a) => { const { question_ids: _q, ...rest } = a; return { ...rest, status: statusOf(a), questions: questionsOf(a), summary: summary(a) }; };
  const detail = (a) => ({ ...out(a), items: a.question_ids.map((id, i) => full(byId.get(id), i + 1)), images: {} });
  const studentOut = (a, me) => ({ id: a.id, kind: a.kind, status: statusOf(a), title: a.title, instructions: a.instructions, subject: a.subject, group_id: a.group_id, group_name: a.group_name, lesson: a.lesson, test: a.test, questions: questionsOf(a), opens_at: a.opens_at, due_at: a.due_at, closed_at: a.closed_at, mine: studentStanding(a, { client_id: me.id, login: me.login }) });

  function draw(body) {
    let subject = body.subject; let skills = body.skills || []; let mix = body.mix || null;
    if (body.question_ids?.length) {
      const qs = body.question_ids.map((id) => byId.get(id)); if (qs.some((q) => !q)) return { error: [422, 'invalid_assignment', 'a question is not in the bank'] };
      return { subject: subject || subjectOf(qs[0].id), skills, mix: null, items: qs.map(full), images: {} };
    }
    if (body.lesson_id) {
      const l = lessonOf(body.course, body.lesson_id); if (!l) return { error: [404, 'not_found', 'no such lesson'] };
      subject = courses[body.course].subject;
      if (body.homework_index != null) { const h = l.l.homework[body.homework_index]; if (!h) return { error: [404, 'not_found', 'no such set'] }; skills = h.skills; mix = { easy: 0, medium: 0, hard: 0, [h.difficulty]: h.questions }; }
      else { skills = l.l.level_check.skills; mix = l.l.level_check.mix; }
    }
    if (!subject || !mix) return { error: [422, 'invalid_assignment', 'name a lesson, or skills and a mix, or questions'] };
    const pool = bank[subject].filter((q) => !skills.length || skills.some((s) => s.toLowerCase() === q.skill.toLowerCase()));
    const src = pool.length ? pool : bank[subject];
    const shuffled = [...src].sort(() => Math.random() - 0.5); const picked = [];
    for (const d of DIFFS) { let n = mix[d] || 0; for (const q of shuffled) { if (!n) break; if (q.difficulty === d && !picked.includes(q)) { picked.push(q); n--; } } for (const q of shuffled) { if (!n) break; if (!picked.includes(q)) { picked.push(q); n--; } } }
    if (!picked.length) return { error: [409, 'no_questions', 'no approved questions for this'] };
    picked.sort((x, y) => DIFFS.indexOf(x.difficulty) - DIFFS.indexOf(y.difficulty));
    return { subject, skills, mix, items: picked.map(full), images: {} };
  }

  function results(a) {
    const students = rosterOf(a.group_id).map((s) => ({ client_id: s.client_id, first_name: s.first_name, last_name: s.last_name, ...studentStanding(a, s) }));
    const works = rosterOf(a.group_id).map((s) => {
      if (s.login) { const first = [...assessments.values()].filter((x) => x.owner === s.login && x.assignment?.id === a.id && x.finished_at).sort((x, y) => x.finished_at.localeCompare(y.finished_at))[0]; return first ? { answers: first.answers, times: first.times || {} } : null; }
      const f = fakeWork(a, s); return f && !f.inProgress ? f : null;
    }).filter(Boolean);
    let questions = [];
    if (a.kind !== 'exam') {
      questions = a.question_ids.map((id, i) => {
        const q = byId.get(id); const answers = q.type === 'mcq' ? { A: 0, B: 0, C: 0, D: 0, blank: 0 } : { correct: 0, wrong: 0, blank: 0 }; let correct = 0; const secs = [];
        for (const w of works) { const g = w.answers[id] ?? null; if (right(q, g)) correct++; if (g == null) answers.blank++; else if (q.type === 'mcq') answers[g] = (answers[g] || 0) + 1; else answers[right(q, g) ? 'correct' : 'wrong']++; if (w.times[id]) secs.push(w.times[id]); }
        return { question_id: id, position: i + 1, subject: a.subject, module: null, skill: q.skill, difficulty: q.difficulty, answered: works.length, correct, answers, avg_seconds: secs.length ? Math.round(secs.reduce((x, y) => x + y, 0) / secs.length) : null };
      });
    } else {
      const pkg = packages[a.test.code]; let pos = 0;
      for (const sec of pkg.sections) if (a.test.sections.includes(sec.subject)) for (const m of sec.modules) for (const q of m.questions) { pos++; const n = students.filter((s) => s.status === 'done').length; const c = Math.round(n * (0.3 + ((pos * 37) % 60) / 100)); questions.push({ question_id: q.id, position: pos, subject: sec.subject, module: m.module, skill: q.skill, difficulty: q.difficulty, answered: n, correct: Math.min(n, c), answers: q.type === 'mcq' ? { A: Math.min(n, c), B: Math.max(0, n - c - 1), C: n - c > 0 ? 1 : 0, D: 0, blank: 0 } : { correct: Math.min(n, c), wrong: n - Math.min(n, c), blank: 0 }, avg_seconds: 40 + ((pos * 23) % 80) }); }
    }
    const bySkill = new Map(); for (const q of questions) { const x = bySkill.get(q.skill) || { skill: q.skill, wrong: 0, total: 0 }; x.wrong += q.answered - q.correct; x.total += q.answered; bySkill.set(q.skill, x); }
    return { assignment: out(a), students, questions, skills: [...bySkill.values()].sort((x, y) => y.wrong - x.wrong) };
  }

  function groupRoadmap(gid) {
    const g = groupById(gid); const d = g.discipline.toUpperCase();
    const subj = /MATH/.test(d) ? 'math' : /ENG/.test(d) ? 'english' : null; const lvl = /FOUND/.test(d) ? 'foundation' : /PRE ?-?SAT/.test(d) ? 'pre-sat' : /ADV/.test(d) ? 'advanced' : subj ? 'foundation' : null;
    const id = subj && lvl ? `${subj}-${lvl}` : null; const c = id && courses[id];
    if (!c) return { courses: [], students: rosterOf(gid).map((s) => ({ client_id: s.client_id, first_name: s.first_name, last_name: s.last_name, courses: {} })) };
    const lessons = c.countries.flatMap((k) => k.units).map((uid) => c.units.find((u) => u.id === uid)).flatMap((u) => u.lessons.map((l) => ({ id: l.id, title: l.title, unit_id: u.id, unit_title: u.title, university: u.stop.university, homework_sets: l.homework.length, l })));
    const students = rosterOf(gid).map((s) => {
      const k = s.client_id % 7; let prevDone = true; let done = 0; let current = null;
      const ls = lessons.map((x, i) => {
        let passed; let best; let hw;
        if (s.login) { const p = prog(s.login, x.id); passed = p.passed; best = p.best; hw = p.hw.size; } else { const reach = 2 + k; passed = i < reach; best = i < reach ? 70 + ((i * 11 + k) % 30) : i === reach ? 50 : null; hw = i < reach ? x.homework_sets : i === reach ? Math.min(1, x.homework_sets) : 0; }
        const isDone = passed && hw >= x.homework_sets; const status = isDone ? 'done' : prevDone ? 'open' : 'locked';
        if (isDone) done++; else if (!current) current = x.id; prevDone = prevDone && isDone;
        return { status, passed, best, homework_done: hw };
      });
      return { client_id: s.client_id, first_name: s.first_name, last_name: s.last_name, courses: { [id]: { lessons_done: done, lessons_total: lessons.length, current_lesson_id: current, lessons: ls } } };
    });
    return { courses: [{ id, subject: c.subject, level: c.level, title: `${c.subject === 'math' ? 'Math' : 'English'} · ${{ foundation: 'Foundation', 'pre-sat': 'Pre-SAT', advanced: 'Advanced' }[c.level]}`, lessons: lessons.map(({ l: _l, ...x }) => x) }], students };
  }

  // Starting an assigned homework or level check: the student's open one, or a new assessment.
  function start(a, me) {
    const open = [...assessments.values()].find((x) => x.owner === me.login && x.assignment?.id === a.id && !x.finished_at);
    if (open) return open;
    if (a.closed_at) return { error: [409, 'assignment_closed', 'the teacher closed it'] };
    const qs = a.question_ids.map((id, i) => ({ ...full(byId.get(id), i + 1) }));
    const x = { id: `as${Math.random().toString(16).slice(2, 8)}-0000-4000-8000-${String(assessments.size + 1).padStart(12, '0')}`, owner: me.login, kind: a.kind, roadmap_id: a.lesson ? a.lesson.course : null, lesson_id: a.lesson ? a.lesson.lesson_id : null, homework_index: a.homework_index, assignment: { id: a.id, kind: a.kind, title: a.title, due_at: a.due_at }, title: a.title, subject: a.subject, created_at: iso(Date.now()), finished_at: null, questions: qs, answers: {}, times: {}, result: null };
    assessments.set(x.id, x); return x;
  }

  return function handle(req, res, url, body, me) {
    const q = new URL(req.url, 'http://x').searchParams; let m;
    if (url === '/v1/me/notifications') return json(res, 200, { items: notes.get(me.login) || [], unread: (notes.get(me.login) || []).filter((n) => !n.read_at).length });
    if (url === '/v1/me/notifications/read' && req.method === 'PUT') { const l = notes.get(me.login) || []; if (!body.all && !Array.isArray(body.ids)) return err(res, 400, 'bad_request', 'ids or all'); for (const n of l) if (body.all || body.ids.includes(n.id)) n.read_at = n.read_at || iso(Date.now()); return json(res, 200, { unread: l.filter((n) => !n.read_at).length }); }
    if (url === '/v1/me/assignments') {
      if (me.kind !== 'student' || me.status === 'registered') return json(res, 200, { assignments: [] });
      const mine = [...list.values()].filter((a) => me.groups.some((g) => g.id === a.group_id)).map((a) => studentOut(a, me)).filter((a) => a.status !== 'closed' || a.mine.status !== 'new');
      return json(res, 200, { assignments: mine.sort((x, y) => x.due_at.localeCompare(y.due_at)) });
    }
    if ((m = url.match(/^\/v1\/me\/assignments\/([^/]+)\/start$/)) && req.method === 'POST') {
      const a = list.get(m[1]); if (!a || me.kind !== 'student' || !me.groups.some((g) => g.id === a.group_id)) return err(res, 404, 'not_found', 'no such assignment');
      if (a.kind === 'exam') return err(res, 409, 'not_an_assessment', 'take the mock test');
      if (statusOf(a) === 'scheduled') return err(res, 409, 'not_open', 'not open yet');
      const x = start(a, me); if (x.error) return err(res, ...x.error);
      return json(res, 200, ctx.assessmentOut(x));
    }
    // Students' practice (spec 22.8): topics, questions, practice sets.
    if (url.startsWith('/v1/me/practice/')) {
      if (me.kind !== 'student') return err(res, 403, 'forbidden', 'only students practise');
      const mine = () => [...assessments.values()].filter((x) => x.owner === me.login && x.kind === 'practice');
      const perDay = me.status === 'registered' ? 40 : null;
      if (url === '/v1/me/practice/topics') { const subjects = {}; for (const s of ['math', 'english']) { const doms = new Map(); for (const [d, sk] of SKILLS[s]) { const qs = bank[s].filter((x) => x.skill === sk); const l = doms.get(d) || []; l.push({ skill: sk, easy: qs.filter((x) => x.difficulty === 'easy').length, medium: qs.filter((x) => x.difficulty === 'medium').length, hard: qs.filter((x) => x.difficulty === 'hard').length, total: qs.length }); doms.set(d, l); } subjects[s] = [...doms].map(([domain, skills]) => ({ domain, skills })); } return json(res, 200, { subjects }); }
      if (url === '/v1/me/practice/questions') {
        const subject = q.get('subject'); const skill = (q.get('skill') || '').toLowerCase(); const diff = q.get('difficulty'); const text = (q.get('q') || '').toLowerCase(); const lim = Number(q.get('limit') || 30); const off = Number(q.get('offset') || 0);
        const found = (bank[subject] || []).filter((x) => (!skill || x.skill.toLowerCase() === skill) && (!diff || x.difficulty === diff) && (!text || `${x.passage || ''} ${x.stem}`.toLowerCase().includes(text)));
        const page = found.slice(off, off + lim);
        const doneIds = new Set([...assessments.values()].filter((x) => x.owner === me.login && x.finished_at).flatMap((x) => x.questions.map((y) => y.id)));
        return json(res, 200, { total: found.length, done: page.filter((x) => doneIds.has(x.id)).map((x) => x.id), questions: page.map((x) => ({ id: x.id, type: x.type, domain: x.domain, skill: x.skill, difficulty: x.difficulty, preview: `${x.passage ? x.passage + ' ' : ''}${x.stem}`.replace(/\\\(|\\\)|\*/g, '').slice(0, 140) })) });
      }
      if (url === '/v1/me/practice/sets' && req.method === 'GET') {
        return json(res, 200, { free_questions_a_day: perDay, sets: mine().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50).map((x) => ({ id: x.id, practice: x.practice, questions: x.questions.length, created_at: x.created_at, finished_at: x.finished_at, correct: x.result?.correct ?? null, total: x.result?.total ?? null, percent: x.result?.percent ?? null })) });
      }
      if (url === '/v1/me/practice/sets' && req.method === 'POST') {
        const open = mine().find((x) => !x.finished_at);
        if (open) { res.writeHead(409, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'practice_open', message: 'finish or discard the practice set you started first' }, open: ctx.assessmentOut(open) })); return true; }
        const subject = body.subject; if (!['math', 'english'].includes(subject)) return err(res, 422, 'invalid_practice', 'subject is math or english');
        let picked;
        if (body.question_ids?.length) picked = body.question_ids.map((id) => byId.get(id)).filter(Boolean);
        else {
          const count = body.count; if (!(count >= 1 && count <= 50)) return err(res, 422, 'invalid_practice', 'count is 1 to 50');
          const skills = (body.skills || []).map((x) => x.toLowerCase()); const diff = body.difficulty || 'mixed';
          const pool = bank[subject].filter((x) => !skills.length || skills.includes(x.skill.toLowerCase()));
          const at = (d) => pool.filter((x) => x.difficulty === d).sort(() => Math.random() - 0.5);
          picked = diff === 'mixed' ? [...at('easy').slice(0, Math.floor(count / 3)), ...at('medium').slice(0, count - 2 * Math.floor(count / 3)), ...at('hard').slice(0, Math.floor(count / 3))] : at(diff).slice(0, count);
          if (picked.length < count) picked = [...picked, ...pool.filter((x) => !picked.includes(x)).slice(0, count - picked.length)];
        }
        if (!picked.length) return err(res, 409, 'no_questions', 'there are no questions for this yet');
        if (perDay != null) { const today = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10); const used = mine().filter((x) => new Date(Date.parse(x.created_at) + 5 * 3600e3).toISOString().slice(0, 10) === today).reduce((n, x) => n + x.questions.length, 0); if (used + picked.length > perDay) return err(res, 403, 'practice_limit', 'free accounts practise up to 40 questions a day'); }
        const skills = body.question_ids?.length ? [] : body.skills || [];
        const label = { math: 'Math', english: 'Reading and Writing' }[subject];
        const title = body.question_ids?.length === 1 ? `${label} · one question` : skills.length === 1 ? skills[0] : skills.length > 1 ? `${label} · ${skills.length} topics` : `${label} · ${picked.length} questions`;
        const practice = { title, subject, skills, difficulty: body.difficulty || 'mixed', seconds_per_question: body.seconds_per_question || 0 };
        const x = { id: `ps${Math.random().toString(16).slice(2, 8)}-0000-4000-8000-${String(assessments.size + 1).padStart(12, '0')}`, owner: me.login, kind: 'practice', roadmap_id: null, lesson_id: null, homework_index: null, assignment: null, title, subject, created_at: iso(Date.now()), finished_at: null, questions: picked.map((y, i) => full(y, i + 1)), answers: {}, times: {}, result: null, practice };
        assessments.set(x.id, x);
        return json(res, 201, ctx.assessmentOut(x));
      }
      const dm = url.match(/^\/v1\/me\/practice\/sets\/([^/]+)$/);
      if (dm && req.method === 'DELETE') { const x = assessments.get(dm[1]); if (!x || x.owner !== me.login || x.kind !== 'practice' || x.finished_at) return err(res, 404, 'not_found', 'no such set'); assessments.delete(dm[1]); return json(res, 204); }
      return false;
    }
    if (!url.startsWith('/v1/teacher/assignments') && !['/v1/teacher/questions', '/v1/teacher/taxonomy', '/v1/teacher/curriculum'].includes(url) && !/^\/v1\/teacher\/groups\/\d+\/roadmap$/.test(url)) return false;
    if (me.kind !== 'teacher') return err(res, 403, 'forbidden', 'teachers only');
    if (url === '/v1/teacher/assignments' && req.method === 'GET') { const gid = Number(q.get('group_id')) || null; if (gid && !teaches(me, gid)) return err(res, 403, 'forbidden', 'not your group'); return json(res, 200, { assignments: [...list.values()].filter((a) => teaches(me, a.group_id) && (!gid || a.group_id === gid)).sort((x, y) => y.created_at.localeCompare(x.created_at)).map(out) }); }
    if (url === '/v1/teacher/assignments' && req.method === 'POST') {
      if (!teaches(me, body.group_id)) return err(res, 403, 'forbidden', 'not your group');
      const fields = {};
      if (!['homework', 'level_check', 'exam'].includes(body.kind)) fields.kind = 'homework, level_check or exam';
      if (!body.due_at || Date.parse(body.due_at) <= Date.parse(body.opens_at || iso(Date.now()))) fields.due_at = 'the deadline must be after the opening';
      if (body.kind === 'exam' && (!packages[body.test] || !body.sections?.length)) fields.test = 'a published test and its sections';
      if (body.kind !== 'exam' && !(body.question_ids?.length >= 1 && body.question_ids.length <= 60)) fields.question_ids = '1–60 questions';
      if (body.kind === 'level_check' && !body.lesson_id) fields.lesson_id = 'a level check comes from a lesson';
      if ((body.title || '').length > 120) fields.title = 'at most 120 characters';
      if (Object.keys(fields).length) { res.writeHead(422, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { code: 'invalid_assignment', message: 'fix the marked fields', fields, request_id: 'req_demo' } })); }
      return json(res, 201, detail(create(body, me.id)));
    }
    if (url === '/v1/teacher/assignments/draw' && req.method === 'POST') { const r = draw(body); return r.error ? err(res, ...r.error) : json(res, 200, r); }
    if ((m = url.match(/^\/v1\/teacher\/assignments\/([^/]+)(\/results(?:\/(\d+))?)?$/))) {
      const a = list.get(m[1]); if (!a) return err(res, 404, 'not_found', 'no such assignment'); if (!teaches(me, a.group_id)) return err(res, 403, 'forbidden', 'not your group');
      if (m[3]) {
        const s = rosterOf(a.group_id).find((x) => x.client_id === Number(m[3])); if (!s) return err(res, 404, 'not_found', 'not in the group');
        if (a.kind === 'exam') { const st = standing(a, s); if (!st.attempt_id) return json(res, 200, { assessment: null, attempt: null }); const real = s.login && [...attempts.values()].find((x) => x.id === st.attempt_id); const pkg = packages[a.test.code]; const answers = real?.answers || pkg.sections.filter((x) => a.test.sections.includes(x.subject)).flatMap((x) => x.modules.flatMap((mod) => mod.questions.map((qq, i) => ({ subject: x.subject, module: mod.module, position: qq.position, answer: (i + s.client_id) % 3 ? (qq.correct || (qq.accepted || [''])[0]) : 'A', seconds: 30 + i * 9 })))); return json(res, 200, { assessment: null, attempt: { id: st.attempt_id, test: a.test.code, title: pkg.title, version: pkg.version, sections: a.test.sections, started_at: st.started_at, finished_at: st.finished_at, scores: st.scores, total: a.test.sections.length === 2 ? st.total_score : null, answers } }); }
        let x = s.login && [...assessments.values()].filter((y) => y.owner === s.login && y.assignment?.id === a.id && y.finished_at).sort((p, r) => p.finished_at.localeCompare(r.finished_at))[0];
        if (!x && !s.login) { const f = fakeWork(a, s); if (f && !f.inProgress) { const qs = a.question_ids.map((id, i) => full(byId.get(id), i + 1)); const items = qs.map((qq) => ({ question_id: qq.id, given: f.answers[qq.id] ?? null, correct: right(qq, f.answers[qq.id]), correct_answer: qq.correct || qq.accepted[0], explanation: qq.explanation })); const c = items.filter((i) => i.correct).length; const percent = Math.floor((100 * c) / qs.length); x = { id: `0000000d-0000-4000-8000-${String(s.client_id).padStart(12, '0')}`, kind: a.kind, roadmap_id: a.lesson?.course ?? null, lesson_id: a.lesson?.lesson_id ?? null, homework_index: a.homework_index, assignment: { id: a.id, kind: a.kind, title: a.title, due_at: a.due_at }, title: a.title, subject: a.subject, created_at: f.finished_at, finished_at: f.finished_at, questions: qs, answers: f.answers, times: f.times, result: { percent, correct: c, total: qs.length, passed: a.kind === 'homework' || percent >= 70, lesson_done: false, items } }; } }
        return json(res, 200, { assessment: x ? ctx.assessmentOut(x) : null, attempt: null });
      }
      if (m[2]) return json(res, 200, results(a));
      if (req.method === 'GET') return json(res, 200, detail(a));
      if (req.method === 'PUT') { if (!body.title?.trim() || Date.parse(body.due_at) <= Date.parse(body.opens_at)) { res.writeHead(422, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { code: 'invalid_assignment', message: 'fix the marked fields', fields: body.title?.trim() ? { due_at: 'the deadline must be after the opening' } : { title: 'a title is needed' } } })); } Object.assign(a, { title: body.title.trim(), instructions: body.instructions || '', opens_at: body.opens_at, due_at: body.due_at, closed_at: body.closed ? a.closed_at || iso(Date.now()) : null, updated_at: iso(Date.now()) }); return json(res, 200, detail(a)); }
      if (req.method === 'DELETE') { if (rosterOf(a.group_id).some((s) => standing(a, s).status !== 'new')) return err(res, 409, 'has_work', 'a student has started it'); list.delete(a.id); return json(res, 204); }
    }
    if (url === '/v1/teacher/questions') { const subject = q.get('subject'); const skill = (q.get('skill') || '').toLowerCase(); const diff = q.get('difficulty'); const text = (q.get('q') || '').toLowerCase(); const found = (bank[subject] || []).filter((x) => (!skill || x.skill.toLowerCase() === skill) && (!diff || x.difficulty === diff) && (!text || `${x.passage || ''} ${x.stem}`.toLowerCase().includes(text))); return json(res, 200, { total: found.length, questions: found.slice(0, 30).map((x) => ({ id: x.id, type: x.type, domain: x.domain, skill: x.skill, difficulty: x.difficulty, preview: `${x.passage ? x.passage + ' ' : ''}${x.stem}`.replace(/\\\(|\\\)|\*/g, '').slice(0, 140) })) }); }
    if (url === '/v1/teacher/taxonomy') { const subjects = {}; for (const s of ['math', 'english']) { const doms = new Map(); for (const [d, sk] of SKILLS[s]) { const qs = bank[s].filter((x) => x.skill === sk); const l = doms.get(d) || []; l.push({ skill: sk, easy: qs.filter((x) => x.difficulty === 'easy').length, medium: qs.filter((x) => x.difficulty === 'medium').length, hard: qs.filter((x) => x.difficulty === 'hard').length, total: qs.length }); doms.set(d, l); } subjects[s] = [...doms].map(([domain, skills]) => ({ domain, skills })); } return json(res, 200, { subjects }); }
    if (url === '/v1/teacher/curriculum') { const order = ['math-foundation', 'math-pre-sat', 'math-advanced', 'english-foundation', 'english-pre-sat', 'english-advanced']; return json(res, 200, { courses: order.filter((id) => courses[id]).map((id) => { const c = courses[id]; return { id, subject: c.subject, level: c.level, title: `${c.subject === 'math' ? 'Math' : 'English'} · ${{ foundation: 'Foundation', 'pre-sat': 'Pre-SAT', advanced: 'Advanced' }[c.level]}`, units: c.units.map((u) => ({ id: u.id, title: u.title, university: u.stop.university, lessons: u.lessons.map((l) => ({ id: l.id, title: l.title, skills: l.skills, level_check: l.level_check, homework: l.homework.map((h, i) => ({ index: i, title: h.title, difficulty: h.difficulty, questions: h.questions, skills: h.skills })) })) })) }; }) }); }
    if ((m = url.match(/^\/v1\/teacher\/groups\/(\d+)\/roadmap$/))) { const gid = Number(m[1]); if (!teaches(me, gid)) return err(res, 403, 'forbidden', 'not your group'); return json(res, 200, groupRoadmap(gid)); }
    return err(res, 404, 'not_found', 'no such route');
  };
};
