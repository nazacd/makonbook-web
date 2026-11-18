// The fictional API's competitions (spec 26): timed contests, one attempt
// each, the server's clock, answers hidden until the end. Required by
// api.cjs with what it shares (assessments, the made-up bank…). Made-up
// competitions, questions and participants only.

const MIN = 60e3;
const DAY = 86400e3;
const GRACE = 30e3;
const iso = (t) => new Date(t).toISOString();

module.exports = function competitions(ctx) {
  const { assessments, json, err, bank, full, roster, answerLog } = ctx;
  const t0 = Date.now();
  const pick = (subject, n, from = 0) => (subject === 'mixed' ? [...bank.math.slice(from, from + Math.ceil(n / 2)), ...bank.english.slice(from, from + Math.floor(n / 2))] : bank[subject].slice(from, from + n)).map((q) => q.id);
  const list = [
    { id: 'c0000000-0000-4000-8000-000000000001', title: 'Weekly Math Sprint', description: 'Eight math questions across algebra and data. A warm-up for the weekend.', prize: '', subject: 'math', source: 'bank', question_ids: pick('math', 8), starts_at: iso(t0 - 60 * MIN), ends_at: iso(t0 + 2 * DAY), minutes: 10 },
    { id: 'c0000000-0000-4000-8000-000000000002', title: 'Lightning round', description: 'Five questions, two minutes. How fast can you go?', prize: '', subject: 'english', source: 'bank', question_ids: pick('english', 5, 10), starts_at: iso(t0 - 5 * MIN), ends_at: iso(t0 + 6 * 60 * MIN), minutes: 2 },
    { id: 'c0000000-0000-4000-8000-000000000003', title: 'Reading & Writing Cup', description: 'Questions written for this cup and seen nowhere else. Fair for everyone.', prize: 'Top three: a book of your choice from the SAT MAKON library', subject: 'english', source: 'reserved', question_ids: pick('english', 12, 15), starts_at: iso(t0 + 3 * DAY), ends_at: iso(t0 + 3 * DAY + 3 * 60 * MIN), minutes: 30 },
    { id: 'c0000000-0000-4000-8000-000000000004', title: 'Evening challenge', description: '', prize: '', subject: 'math', source: 'bank', question_ids: pick('math', 6, 12), starts_at: iso(t0 + 40 * MIN), ends_at: iso(t0 + 4 * 60 * MIN), minutes: 12 },
    { id: 'c0000000-0000-4000-8000-000000000005', title: 'October Mixed Challenge', description: 'Math and Reading & Writing together.', prize: 'A SAT MAKON notebook for the first five', subject: 'mixed', source: 'reserved', question_ids: pick('mixed', 10, 20), starts_at: iso(t0 - 9 * DAY), ends_at: iso(t0 - 8 * DAY), minutes: 20 },
  ];
  const byId = new Map([...bank.math, ...bank.english].map((q) => [q.id, q]));
  // Made-up participants already on the boards (name, right answers, seconds).
  const others = new Map();
  for (const c of list) {
    const n = Date.parse(c.starts_at) > t0 ? 0 : c.id.endsWith('2') ? 3 : 14;
    others.set(c.id, roster.slice(0, n).map(([, first, last], i) => ({ name: `${first} ${last[0]}.`, correct: Math.max(0, c.question_ids.length - Math.floor(i / 2) - (i % 3)), seconds: Math.min(c.minutes * 60, 120 + i * 37), finished_at: iso(Date.parse(c.starts_at) + (i + 1) * 9 * MIN) })));
  }
  const ended = (c) => Date.now() >= Date.parse(c.ends_at);
  const statusOf = (c) => (Date.now() < Date.parse(c.starts_at) ? 'upcoming' : ended(c) ? 'ended' : 'live');
  const deadlineOf = (c, a) => Math.min(Date.parse(a.created_at) + c.minutes * MIN, Date.parse(c.ends_at));
  const attempts = (c) => [...assessments.values()].filter((a) => a.kind === 'competition' && a.competition_id === c.id);
  const attemptOf = (c, me) => attempts(c).find((a) => a.owner === me.login);

  // Grades an attempt with what it has saved.
  function grade(a, at) {
    const items = a.questions.map((q) => { const given = a.answers[q.id] ?? null; const ok = given != null && (q.type === 'mcq' ? given === q.correct : (q.accepted || []).includes(String(given).trim()));
      return { question_id: q.id, given, correct: ok, correct_answer: q.type === 'mcq' ? q.correct : (q.accepted || [''])[0], explanation: q.explanation }; });
    const correct = items.filter((x) => x.correct).length;
    a.finished_at = iso(at); a.result = { percent: Math.round((100 * correct) / items.length), correct, total: items.length, passed: true, lesson_done: false, items };
    const log = answerLog.get(a.owner) || []; for (const it of items) if (it.given) log.push({ question_id: it.question_id, assessment_id: a.id, correct: it.correct, seconds: (a.times || {})[it.question_id] || null, at: a.finished_at }); answerLog.set(a.owner, log);
  }
  // Attempts whose time and grace are over are graded when anything reads them.
  const finishExpired = (c) => { for (const a of attempts(c)) if (!a.finished_at && Date.now() > deadlineOf(c, a) + GRACE) grade(a, deadlineOf(c, a)); };

  const out = (c, me) => {
    finishExpired(c);
    const a = me.kind === 'student' ? attemptOf(c, me) : null;
    return { id: c.id, title: c.title, description: c.description, prize: c.prize, subject: c.subject, source: c.source, starts_at: c.starts_at, ends_at: c.ends_at, minutes: c.minutes, questions: c.question_ids.length, published: true, status: statusOf(c),
      participants: others.get(c.id).length + attempts(c).filter((x) => x.finished_at).length,
      mine: a ? { assessment_id: a.id, finished: !!a.finished_at, correct: a.result?.correct ?? null, total: a.result?.total ?? null, deadline: iso(deadlineOf(c, a)), finished_at: a.finished_at } : null };
  };
  const board = (c, me) => {
    finishExpired(c);
    const rows = [...others.get(c.id).map((o) => ({ ...o, photo_url: null, me: false })),
      ...attempts(c).filter((a) => a.finished_at).map((a) => ({ name: `${a.owner_name}`, photo_url: null, correct: a.result.correct, seconds: Math.min(c.minutes * 60, Math.round((Date.parse(a.finished_at) - Date.parse(a.created_at)) / 1000)), finished_at: a.finished_at, me: a.owner === me.login }))];
    rows.sort((x, y) => y.correct - x.correct || x.seconds - y.seconds || x.finished_at.localeCompare(y.finished_at));
    let rank = 0;
    const entries = rows.map((r, i) => { if (i === 0 || r.correct !== rows[i - 1].correct || r.seconds !== rows[i - 1].seconds) rank = i + 1; return { rank, name: r.name, photo_url: r.photo_url, correct: r.correct, total: c.question_ids.length, seconds: r.seconds, me: r.me }; });
    return { entries: entries.slice(0, 100), me: entries.find((e) => e.me) || null, participants: entries.length };
  };

  // The demo student took part in the ended one.
  {
    const c = list[4]; const created = Date.parse(c.starts_at) + 30 * MIN;
    const a = { id: 'cmp00000-0000-4000-8000-000000000001', owner: 'demo.student', owner_name: 'Demo S.', kind: 'competition', competition_id: c.id, roadmap_id: null, lesson_id: null, homework_index: null, assignment: null, title: c.title, subject: 'math', created_at: iso(created), finished_at: null, questions: c.question_ids.map((id, i) => full(byId.get(id), i + 1)), answers: {}, times: {}, result: null };
    a.questions.forEach((q, i) => { if (i % 3 !== 2) a.answers[q.id] = q.type === 'mcq' ? (i % 4 === 3 ? 'C' : q.correct) : '3'; });
    assessments.set(a.id, a); grade(a, created + 14 * MIN);
  }

  return {
    // What api.cjs adds to an assessment of kind competition: its brief; until the end, no keys.
    decorate(a, base) {
      const c = list.find((x) => x.id === a.competition_id);
      const brief = { id: c.id, title: c.title, ends_at: c.ends_at, deadline: iso(deadlineOf(c, a)), server_time: iso(Date.now()), ended: ended(c) };
      if (brief.ended || !a.finished_at) return { ...base, competition: brief };
      return { ...base, competition: brief, questions: base.questions.map(({ correct, accepted, explanation, ...q }) => q), result: { ...base.result, items: [] } };
    },
    // Whether an attempt's time (and grace) is over.
    late(a) {
      const c = list.find((x) => x.id === a.competition_id);
      return Date.now() > deadlineOf(c, a) + GRACE;
    },
    route(url, req, res, me) {
      if (!url.startsWith('/v1/competitions')) return false;
      if (url === '/v1/competitions') return json(res, 200, { competitions: [...list].sort((x, y) => y.starts_at.localeCompare(x.starts_at)).map((c) => out(c, me)), server_time: iso(Date.now()) });
      const m = url.match(/^\/v1\/competitions\/([^/]+)(\/board|\/start)?$/);
      const c = m && list.find((x) => x.id === m[1]);
      if (!c) return err(res, 404, 'not_found', 'no such competition');
      if (!m[2]) return json(res, 200, { competition: out(c, me), server_time: iso(Date.now()) });
      if (m[2] === '/board') return json(res, 200, board(c, me));
      if (req.method !== 'POST') return err(res, 405, 'method_not_allowed', 'POST');
      if (me.kind !== 'student') return err(res, 403, 'forbidden', 'students take part');
      if (me.status === 'registered' && !me.phone) return err(res, 403, 'phone_required', 'prove a phone number first');
      finishExpired(c);
      const open = attemptOf(c, me);
      if (open?.finished_at) return err(res, 409, 'already_attempted', 'you have taken part already: one attempt each');
      if (open) return json(res, 200, ctx.assessmentOut(open));
      if (statusOf(c) !== 'live') return err(res, 409, 'not_live', 'this competition isn’t open now');
      const a = { id: `cmp${Math.random().toString(16).slice(2, 7)}-0000-4000-8000-${String(assessments.size + 1).padStart(12, '0')}`, owner: me.login, owner_name: `${me.first_name} ${(me.last_name || '?')[0]}.`, kind: 'competition', competition_id: c.id, roadmap_id: null, lesson_id: null, homework_index: null, assignment: null, title: c.title, subject: c.subject === 'english' ? 'english' : 'math', created_at: iso(Date.now()), finished_at: null, questions: c.question_ids.map((id, i) => full(byId.get(id), i + 1)), answers: {}, times: {}, result: null };
      assessments.set(a.id, a);
      return json(res, 200, ctx.assessmentOut(a));
    },
  };
};
