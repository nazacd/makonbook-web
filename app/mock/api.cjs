// A fictional MakonBook API for working on the app without the real one
// (`npm run dev:mock -w app`, then `VITE_API_URL=http://127.0.0.1:8081 npm run dev -w app`).
// Shaped by api/openapi.yaml; fictional people and groups only, nothing from
// the school. Sign in as demo.student, demo.teacher or temp.student (the
// temporary-password flow) with the password MB_DEMO_PASSWORD, default demo-pass.
const http = require('http');
const PW = process.env.MB_DEMO_PASSWORD || 'demo-pass';
const sched = (weekdays, begin, end, classroom, teachers) => ({ weekdays, begin_time: begin, end_time: end, classroom, teachers });
const people = {
  'demo.student': { kind: 'student', id: 1001, first_name: 'Diyora', last_name: 'Adilova', username: 'demo.student', must_change_password: false,
    groups: [
      { id: 501, name: 'MR SARVAR FOUND MATH 17:00 TTS', discipline: 'FOUNDATION MATH', learning_type: 'GROUP', office: 'NOVZA', session: null, schedule: [sched(['tue', 'thu', 'sat'], '17:00', '18:30', 'ROOM 11', ['SARVAR KARIMOV'])] },
      { id: 502, name: 'MS NODIRA PRE SAT ENGLISH 14:00 MWF', discipline: 'PRE SAT ENGLISH', learning_type: 'GROUP', office: 'NOVZA', session: null, schedule: [sched(['mon', 'wed', 'fri'], '14:00', '15:30', '7', ['NODIRA ALIYEVA'])] },
      { id: 503, name: 'IV DIYORA ADILOVA 10:00 SUN', discipline: 'ADV MATH', learning_type: 'INDIVIDUAL', office: 'NOVZA', session: null, schedule: [sched(['sun'], '10:00', '11:00', '3', ['SARVAR KARIMOV'])] },
    ] },
  'temp.student': { kind: 'student', id: 1002, first_name: 'Temur', last_name: 'Rashidov', username: null, must_change_password: true, groups: [] },
  'demo.teacher': { kind: 'teacher', id: 77, first_name: 'Nodira', last_name: 'Aliyeva', username: 'demo.teacher', must_change_password: false,
    groups: [{ id: 502, name: 'MS NODIRA PRE SAT ENGLISH 14:00 MWF', discipline: 'PRE SAT ENGLISH', learning_type: 'GROUP', office: 'NOVZA', session: null, schedule: [sched(['mon', 'wed', 'fri'], '14:00', '15:30', '7', ['NODIRA ALIYEVA'])] },
      { id: 504, name: 'MS NODIRA IV ALI VALIYEV 12:00 TT', discipline: 'PRE SAT ENGLISH', learning_type: 'INDIVIDUAL', office: 'NOVZA', session: null, schedule: [sched(['tue', 'thu'], '12:00', '13:00', '4', ['NODIRA ALIYEVA'])] }] },
};
const tokens = new Map();
function days(n, states) { const out = []; const d = new Date(); for (let i = 0; i < n; i++) { d.setDate(d.getDate() - 2); out.push({ date: d.toISOString().slice(0, 10), state: states[i % states.length] }); } return out; }
const attendance = { from: '2026-07-01', to: '2026-11-01', groups: [
  { group_id: 501, group_name: 'MR SARVAR FOUND MATH 17:00 TTS', discipline: 'FOUNDATION MATH', summary: { lessons: 20, present: 17, late: 1, absent: 2 }, days: days(20, ['present', 'present', 'late', 'present', 'absent', 'present', 'present', 'present', 'present', 'absent']) },
  { group_id: 502, group_name: 'MS NODIRA PRE SAT ENGLISH 14:00 MWF', discipline: 'PRE SAT ENGLISH', summary: { lessons: 12, present: 7, late: 0, absent: 5 }, days: days(12, ['present', 'absent', 'present', 'absent']) },
] };

// --- Practice (fictional questions; the shapes of api/openapi.yaml) ---
const q = (position, type, stem, extra) => ({ id: `00000000-0000-4000-8000-${String(position).padStart(12, '0')}`, version: 1, position, type, passage: null, choices: null, figures: [], correct: null, accepted: null, explanation: 'Because that is how the fictional example goes.', domain: 'Demo', skill: 'Demo skill', difficulty: 'medium', stem, ...extra });
const rwQuestions = (module) => [
  q(1, 'mcq', 'Which choice completes the text with the most logical transition?', { passage: 'The *fictional* town of Marlow kept its lighthouse long after ships stopped calling. **Nobody** could say why; the keeper simply came each evening, as his mother had.\n\n______, the light still turns.', choices: { A: 'Therefore', B: 'However', C: 'For example', D: 'Meanwhile' }, correct: 'A', explanation: 'The second sentence follows from the first, so a transition of consequence fits.' }),
  q(2, 'mcq', 'As used in the text, what does the word "called" most nearly mean?', { passage: 'Ships stopped calling at the harbour in the 1950s, when the new port opened down the coast.', choices: { A: 'Shouted', B: 'Named', C: 'Visited', D: 'Telephoned' }, correct: 'C' }),
  q(3, 'mcq', 'Which choice best states the main idea of the text?', { passage: 'A data table:\n\n| Year | Ships |\n| --- | --- |\n| 1940 | 120 |\n| 1950 | 15 |', choices: { A: 'Traffic fell sharply', B: 'Traffic rose sharply', C: 'The harbour closed in 1940', D: 'Ships grew larger' }, correct: 'A' }),
].map((x) => ({ ...x, id: x.id.replace('8000-', module === 1 ? '8001-' : '8002-') }));
const mathQuestions = (module) => [
  q(1, 'mcq', 'If \\(3x + 5 = 20\\), what is the value of \\(x\\)?', { choices: { A: '\\(3\\)', B: '\\(5\\)', C: '\\(15\\)', D: '\\(\\dfrac{25}{3}\\)' }, correct: 'B', explanation: 'Subtract 5 from both sides: \\(3x = 15\\), so \\(x = 5\\).' }),
  q(2, 'grid_in', 'A rectangle has a width of 4 and an area of 18. What is its length?', { accepted: ['4.5', '9/2'], explanation: '\\[ \\text{length} = \\dfrac{18}{4} = 4.5 \\]' }),
  q(3, 'mcq', 'The price of a fictional ticket is $29. Which expression gives the cost of \\(n\\) tickets?', { choices: { A: '\\(29n\\)', B: '\\(29 + n\\)', C: '\\(\\dfrac{29}{n}\\)', D: '\\(n - 29\\)' }, correct: 'A' }),
].map((x) => ({ ...x, id: x.id.replace('8000-', module === 1 ? '8003-' : '8004-') }));
const scale = (n) => Array.from({ length: n + 1 }, (_, i) => 200 + Math.round((600 * i) / n));
const packages = {
  DAY1: { format: 1, code: 'DAY1', title: 'DAY1', version: 2, published_at: '2026-10-01T00:00:00Z', images: {}, sections: [
    { subject: 'english', scale: scale(6), modules: [{ module: 1, minutes: 1, questions: rwQuestions(1) }, { module: 2, minutes: 1, questions: rwQuestions(2) }] },
    { subject: 'math', scale: scale(6), modules: [{ module: 1, minutes: 1, questions: mathQuestions(1) }, { module: 2, minutes: 1, questions: mathQuestions(2) }] } ] },
};
packages.DAY2 = { ...packages.DAY1, code: 'DAY2', title: 'DAY2', version: 1 };
const catalog = { tests: [
  { code: 'DAY1', title: 'DAY1', english: 6, math: 6, questions: 12, approved: 12, version: 2, bytes: 120000, published_at: '2026-10-01T00:00:00Z' },
  { code: 'DAY2', title: 'DAY2', english: 6, math: 6, questions: 12, approved: 12, version: 1, bytes: 120000, published_at: '2026-10-02T00:00:00Z' },
  { code: 'DAY3', title: 'DAY3', english: 54, math: 44, questions: 98, approved: 40, version: null, bytes: null, published_at: null },
] };
const attempts = new Map(); // id -> stored attempt (per login)
function grade(pkg, sections, answers) {
  const given = new Map(answers.map((a) => [`${a.subject}-${a.module}-${a.position}`, a.answer]));
  const scores = {};
  for (const s of pkg.sections) { if (!sections.includes(s.subject)) continue; let raw = 0, n = 0; for (const m of s.modules) for (const qq of m.questions) { n++; const g = (given.get(`${s.subject}-${m.module}-${qq.position}`) || '').trim(); if (qq.type === 'mcq' ? g.toUpperCase() === qq.correct : (qq.accepted || []).includes(g)) raw++; } scores[s.subject] = { raw, questions: n, score: s.scale[raw] }; }
  return scores;
}

// --- Vocabulary (fictional words) ---
const vw = (list, i, word, pos, definition, example) => ({ id: `0000000${list}-0000-4000-8000-${String(i).padStart(12, '0')}`, word, part_of_speech: pos, definition, example, image: null });
const deck = { version: 'demo-1', lists: [
  { slug: 'unit-1', title: 'SAT Words: Unit 1', words: [
    vw(1, 1, 'abate', 'verb', 'To become less strong or intense.', 'The storm abated by morning.'),
    vw(1, 2, 'candid', 'adjective', 'Truthful and straightforward.', 'Her candid reply surprised the committee.'),
    vw(1, 3, 'diligent', 'adjective', 'Working carefully and steadily.', 'A diligent student checks every answer.'),
    vw(1, 4, 'ephemeral', 'adjective', 'Lasting a very short time.', 'Fame on the internet is often ephemeral.'),
  ] },
  { slug: 'unit-2', title: 'SAT Words: Unit 2', words: [
    vw(2, 1, 'lucid', 'adjective', 'Clear and easy to understand.', 'The teacher gave a lucid explanation.'),
    vw(2, 2, 'meticulous', 'adjective', 'Very careful about details.', 'He kept meticulous notes.'),
    vw(2, 3, 'novel', 'adjective', 'New and original.', 'She proposed a novel approach to the problem.'),
  ] },
] };
const reviews = new Map(); // login -> [{seq, ...review}]
let seq = 0;

const err = (res, status, code, message, extra = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...extra }); res.end(JSON.stringify({ error: { code, message, request_id: 'req_demo' } })); };
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  const auth = req.headers.authorization?.replace(/^Bearer /, '');
  const url = req.url.split('?')[0];
  if (url === '/v1/auth/login' && req.method === 'POST') {
    const p = people[body.login?.trim()];
    if (!p || body.password !== PW) return err(res, 401, 'invalid_credentials', 'wrong login or password');
    const token = 'tok_' + Math.random().toString(36).slice(2); tokens.set(token, body.login.trim());
    return json(res, 200, { token, expires_at: '2026-12-01T00:00:00Z', user: p });
  }
  const login = tokens.get(auth); const me = login && people[login];
  if (!me) return err(res, 401, 'unauthorized', 'session ended');
  if (url === '/v1/auth/logout') { tokens.delete(auth); return json(res, 204); }
  if (url === '/v1/me') return json(res, 200, me);
  if (url === '/v1/auth/password') {
    if (body.current_password !== PW) return err(res, 403, 'wrong_password', 'wrong password');
    if ((body.new_password || '').length < 8) return err(res, 422, 'weak_password', 'password must be 8–128 characters');
    me.must_change_password = false; return json(res, 204);
  }
  if (me.must_change_password) return err(res, 403, 'password_change_required', 'change the password first');
  if (url === '/v1/auth/username') { if (body.username === 'taken') return err(res, 409, 'username_taken', 'taken'); me.username = body.username; return json(res, 200, { username: body.username }); }
  if (url === '/v1/me/attendance') return me.kind === 'student' ? json(res, 200, attendance) : err(res, 403, 'forbidden', 'not a student');
  if (url === '/v1/practice/tests') return json(res, 200, catalog);
  const pm = /^\/v1\/practice\/tests\/([^/]+)\/package$/.exec(url);
  if (pm) { const pkg = packages[decodeURIComponent(pm[1])]; if (!pkg) return err(res, 404, 'not_found', 'no such test'); return json(res, 200, { package: pkg, images: {}, expires_at: new Date(Date.now() + 6 * 3600e3).toISOString() }); }
  if (url === '/v1/practice/attempts' && req.method === 'POST') {
    if (me.kind !== 'student') return err(res, 403, 'forbidden', 'not a student');
    const key = `${login}:${body.id}`; if (attempts.has(key)) return json(res, 200, attempts.get(key));
    const pkg = packages[body.test]; if (!pkg || pkg.version !== body.version) return err(res, 422, 'invalid_attempt', 'no such test version');
    const scores = grade(pkg, body.sections, body.answers);
    const stored = { id: body.id, test: body.test, title: pkg.title, version: body.version, sections: body.sections, started_at: body.started_at, finished_at: body.finished_at, scores, total: scores.english && scores.math ? scores.english.score + scores.math.score : null, answers: body.answers };
    attempts.set(key, stored); const { answers: _a, ...out } = stored; return json(res, 200, out);
  }
  if (url === '/v1/me/practice/attempts') return me.kind === 'student' ? json(res, 200, { attempts: [...attempts.values()].filter((a) => [...attempts.keys()].some((k) => k === `${login}:${a.id}`)).sort((a, b) => b.finished_at.localeCompare(a.finished_at)) }) : err(res, 403, 'forbidden', 'not a student');
  if (url === '/v1/vocab/deck') { const have = new URL(req.url, 'http://x').searchParams.get('have'); return json(res, 200, have === deck.version ? { version: deck.version, unchanged: true } : { version: deck.version, unchanged: false, lists: deck.lists }); }
  if (/^\/v1\/vocab\/lists\/[^/]+\/images$/.test(url)) return json(res, 200, { images: {}, expires_at: new Date(Date.now() + 6 * 3600e3).toISOString() });
  if (url === '/v1/vocab/reviews' && req.method === 'POST') {
    if (me.kind !== 'student') return err(res, 403, 'forbidden', 'not a student');
    const mine = reviews.get(login) || []; let added = 0;
    for (const r of body.reviews || []) { if (!mine.some((x) => x.id === r.id)) { mine.push({ seq: ++seq, ...r }); added++; } }
    reviews.set(login, mine); return json(res, 200, { received: (body.reviews || []).length, added });
  }
  if (url === '/v1/me/vocab/reviews') { const after = Number(new URL(req.url, 'http://x').searchParams.get('after') || 0); const mine = (reviews.get(login) || []).filter((r) => r.seq > after); return json(res, 200, { reviews: mine.slice(0, 1000), next: mine.length > 1000 ? mine[999].seq : null }); }
  if (url === '/v1/me/parent-code') return me.kind === 'student' ? json(res, 200, { code: '48213' }) : err(res, 403, 'forbidden', 'not a student');
  err(res, 404, 'not_found', 'no such route');
}).listen(8081, '127.0.0.1', () => console.log('mock api on 8081'));
