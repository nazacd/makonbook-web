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
      { id: 504, name: 'MS NODIRA IV ALI VALIYEV 12:00 TT', discipline: 'PRE SAT ENGLISH', learning_type: 'INDIVIDUAL', office: 'NOVZA', session: null, schedule: [sched(['tue', 'thu'], '12:00', '13:00', '4', ['NODIRA ALIYEVA'])] },
      { id: 505, name: 'MS NODIRA DEMO OPEN ALL DAY', discipline: 'SAT PRACTICE', learning_type: 'GROUP', office: 'NOVZA', session: null, schedule: [sched(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], '00:00', '23:59', '1', ['NODIRA ALIYEVA'])] }] },
};
const tokens = new Map();
// Accounts (fictional): every existing person is enrolled with the shared
// password; sign-ups get negative ids and status "registered". SMS and email
// codes are always 123456 here. Google sign-in skips Google and comes back
// with a made-up account (/v1/auth/google/start?as=name&email=…); Telegram's
// page is a small form at /v1/auth/telegram/mock (Telegram id, name, phone).
for (const [login, p] of Object.entries(people)) Object.assign(p, { status: 'enrolled', phone: p.kind === 'teacher' ? '+998901110077' : `+99890111${String(p.id).padStart(4, '0')}`, google: false, telegram: false, photo_url: null, has_password: true, email: null, login });
const passwords = new Map(); // login -> own password (sign-ups, resets)
const codes = new Map(); // phone:purpose -> { code, at }
const tickets = new Map(); // ticket -> { phone, purpose } | { google: { sub, first_name, last_name, email } }
const googleLinks = new Map(); // sub -> login
const tgLinks = new Map(); // telegram id -> login
const tgStates = new Map(); // state -> { purpose, person, ret }
const photos = new Map(); // id -> { type, data } (uploaded photos)
const byEmail = (email) => (email ? Object.values(people).find((p) => p.email === String(email).toLowerCase()) : undefined);
// Telegram's numbers come without "+", from any country.
const normAny = (raw) => { const d = String(raw || '').replace(/\D/g, ''); return d.length >= 7 ? '+' + (d.length === 9 ? '998' + d : d) : null; };
function newPerson({ first, last, phone = null, email = null, photo = false }) {
  const id = nextSelfId--; const login = 'u' + -id;
  const p = { kind: 'student', id, first_name: first || 'New', last_name: last || 'Student', username: null, must_change_password: false, status: 'registered', phone, email, google: false, telegram: false, has_password: false, photo_url: photo ? `/v1/photos/p${-id}` : null, groups: [], login };
  people[login] = p; return p;
}
function linkTelegram(p, id) { if (!tgLinks.has(id) && !p.telegram) { tgLinks.set(id, p.login); p.telegram = true; } }
// A proven number for a person without one: theirs if nobody has it, else
// they're merged into the account that has it (its email replaced by theirs).
function applyPhone(me, phone, tgId) {
  const owner = byPhone(phone);
  if (!owner) { me.phone = phone; if (tgId) linkTelegram(me, tgId); return me; }
  for (const [sub, l] of googleLinks) if (l === me.login) { googleLinks.set(sub, owner.login); owner.google = true; }
  for (const [tid, l] of tgLinks) if (l === me.login) { if (owner.telegram) tgLinks.delete(tid); else { tgLinks.set(tid, owner.login); owner.telegram = true; } }
  if (tgId) linkTelegram(owner, tgId);
  if (me.email) owner.email = me.email;
  if (!owner.photo_url) owner.photo_url = me.photo_url;
  for (const [t, l] of tokens) if (l === me.login) tokens.delete(t);
  delete people[me.login]; passwords.delete(me.login);
  return owner;
}
function sendSms(res, phone, purpose) {
  const k = `${phone}:${purpose}`; const last = codes.get(k);
  if (last && Date.now() - last.at < 60e3) return err(res, 429, 'rate_limited', 'wait a minute', { 'Retry-After': '60' });
  codes.set(k, { code: '123456', at: Date.now(), tries: 0 }); console.log(`SMS to ${phone}: 123456 (${purpose})`);
  return json(res, 200, { resend_in: 60, expires_in: 600 });
}
function checkSms(res, phone, purpose, code) {
  const c = phone && codes.get(`${phone}:${purpose}`);
  if (!c) return err(res, 410, 'code_expired', 'ask for a new code');
  if (String(code).trim() !== c.code) { c.tries++; if (c.tries >= 5) { codes.delete(`${phone}:${purpose}`); return err(res, 429, 'too_many_tries', 'too many tries'); } return err(res, 422, 'invalid_code', `wrong code, ${5 - c.tries} tries left`); }
  codes.delete(`${phone}:${purpose}`); return null;
}
let nextSelfId = -1000001;
const newTicket = (v) => { const t = 'tk_' + Math.random().toString(36).slice(2); tickets.set(t, v); return t; };
const normPhone = (raw) => { const d = String(raw || '').replace(/\D/g, ''); const n = d.length === 9 ? '998' + d : d; return /^998\d{9}$/.test(n) ? '+' + n : null; };
const byPhone = (phone) => (phone ? Object.values(people).find((p) => p.phone === phone) : undefined);
const signIn = (res, p, extra = {}) => { const token = 'tok_' + Math.random().toString(36).slice(2); tokens.set(token, p.login); return json(res, 200, { token, expires_at: '2026-12-31T00:00:00Z', user: p, ...extra }); };
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
packages.DAY11 = { ...packages.DAY1, code: 'DAY11', title: 'DAY11', version: 1 };
const catalog = { tests: [
  { code: 'DAY1', title: 'DAY1', english: 6, math: 6, questions: 12, approved: 12, version: 2, bytes: 120000, published_at: '2026-10-01T00:00:00Z' },
  { code: 'DAY2', title: 'DAY2', english: 6, math: 6, questions: 12, approved: 12, version: 1, bytes: 120000, published_at: '2026-10-02T00:00:00Z' },
  { code: 'DAY11', title: 'DAY11', english: 6, math: 6, questions: 12, approved: 12, version: 1, bytes: 120000, published_at: '2026-10-05T00:00:00Z' },
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
const parked = new Map(); // id -> parked question (with login)
const reports = new Map(); // id -> report
const goals = new Map(); // login -> goals
let seq = 0;

// --- Teacher: lessons, attendance sessions, groups' results ---
const roster = [[2001, 'Ali', 'Valiyev'], [2002, 'Madina', 'Karimova'], [2003, 'Jasur', 'Rahimov'], [2004, 'Nilufar', 'Tosheva'], [2005, 'Bekzod', 'Yusupov']];
const sessions = new Map();
const today = () => { const d = new Date(Date.now() + 5 * 3600e3); return d.toISOString().slice(0, 10); };
function lessonsFor(date) {
  return [
    { group_id: 502, group_name: 'MS NODIRA PRE SAT ENGLISH 14:00 MWF', discipline: 'PRE SAT ENGLISH', office: 'NOVZA', classroom: '7', begin_time: '14:00', end_time: '15:30', starts_at: `${date}T14:00:00+05:00`, ends_at: `${date}T15:30:00+05:00`, students: 5, attendance_enabled: true, learning_type: 'GROUP', session: [...sessions.values()].filter((x) => x.group_id === 502 && x.date === date).map((x) => ({ id: x.id, status: x.status }))[0] || null },
    { group_id: 505, group_name: 'MS NODIRA DEMO OPEN ALL DAY', discipline: 'SAT PRACTICE', office: 'NOVZA', classroom: '1', begin_time: '00:00', end_time: '23:59', starts_at: `${date}T00:00:00+05:00`, ends_at: `${date}T23:59:00+05:00`, students: 5, attendance_enabled: true, learning_type: 'GROUP', session: [...sessions.values()].filter((x) => x.group_id === 505 && x.date === date).map((x) => ({ id: x.id, status: x.status }))[0] || null },
    { group_id: 504, group_name: 'MS NODIRA IV ALI VALIYEV 12:00 TT', discipline: 'PRE SAT ENGLISH', office: 'NOVZA', classroom: '4', begin_time: '12:00', end_time: '13:00', starts_at: `${date}T12:00:00+05:00`, ends_at: `${date}T13:00:00+05:00`, students: 1, attendance_enabled: false, learning_type: 'INDIVIDUAL', session: null },
  ];
}
function counts(marks) { const c = { total: marks.length, present: 0, late: 0, absent: 0, pending: 0 }; for (const m of marks) c[m.state]++; return c; }
const sessionOut = (x) => ({ ...x, counts: counts(x.marks) });
const groupPractice = { students: roster.map(([client_id, first_name, last_name], i) => ({ client_id, first_name, last_name, attempts: i < 3 ? [
  { id: `0000000a-0000-4000-8000-00000000000${i}`, test: 'DAY2', title: 'DAY2', version: 1, sections: ['english', 'math'], started_at: new Date(Date.now() - 3600e3 * (i + 1)).toISOString(), finished_at: new Date(Date.now() - 3600e3 * i - 1800e3).toISOString(), scores: { english: { raw: 4, questions: 6, score: 600 }, math: { raw: 3 + i, questions: 6, score: 500 + 100 * i } }, total: 1100 + 100 * i },
  { id: `0000000b-0000-4000-8000-00000000000${i}`, test: 'DAY1', title: 'DAY1', version: 2, sections: ['math'], started_at: new Date(Date.now() - 86400e3 * 3).toISOString(), finished_at: new Date(Date.now() - 86400e3 * 3 + 3600e3).toISOString(), scores: { math: { raw: 2, questions: 6, score: 400 } }, total: null },
] : [] })) };
const groupVocab = { words: 1220, students: roster.map(([client_id, first_name, last_name], i) => ({ client_id, first_name, last_name, started: i * 20, learned: i * 7, reviews_week: i < 3 ? 30 - i * 10 : 0, last_review: i < 4 ? new Date(Date.now() - 86400e3 * i).toISOString() : null })) };

const err = (res, status, code, message, extra = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...extra }); res.end(JSON.stringify({ error: { code, message, request_id: 'req_demo' } })); };
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  // Pictures come as their own bytes; everything else is JSON.
  const isImage = /^image\//.test(req.headers['content-type'] || '');
  const body = chunks.length && !isImage ? JSON.parse(raw.toString()) : {};
  const auth = req.headers.authorization?.replace(/^Bearer /, '');
  const url = req.url.split('?')[0];
  if (url === '/v1/app/config') return json(res, 200, { min_app_version: { android: '1.0.0', ios: '1.0.0' }, signup: true, google: true, reset: true, email: true, telegram: true });
  if (url === '/v1/auth/email/start' && req.method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err(res, 422, 'invalid_email', 'not an email address');
    codes.set(`${email}:email`, { code: '123456', at: Date.now(), tries: 0 }); console.log(`email to ${email}: 123456`);
    return json(res, 200, { resend_in: 60, expires_in: 600 });
  }
  // Email: an account with it signs in; a new address gets a ticket for /v1/auth/signup.
  if (url === '/v1/auth/email/verify' && req.method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase(); const c = codes.get(`${email}:email`);
    if (!c) return err(res, 410, 'code_expired', 'ask for a new code');
    if (String(body.code).trim() !== c.code) return err(res, 422, 'invalid_code', 'wrong code');
    codes.delete(`${email}:email`);
    const owner = byEmail(email); if (owner) return signIn(res, owner, { status: 'signed_in' });
    return json(res, 200, { status: 'new', email_ticket: newTicket({ email }) });
  }
  if (url === '/v1/auth/signup' && req.method === 'POST') {
    const t = tickets.get(body.email_ticket); if (!t?.email) return err(res, 422, 'invalid_ticket', 'check the email again');
    const fn = String(body.first_name || '').trim(); const ln = String(body.last_name || '').trim();
    if (!fn || !ln) return err(res, 422, 'invalid_profile', 'name and surname are needed');
    if (String(body.password || '').length < 8) return err(res, 422, 'weak_password', 'password must be 8–128 characters');
    if (byEmail(t.email)) return err(res, 409, 'email_taken', 'an account has this email');
    tickets.delete(body.email_ticket);
    const p = newPerson({ first: fn, last: ln, email: t.email }); passwords.set(p.login, body.password); p.has_password = true;
    return signIn(res, p);
  }
  // Telegram (fictional): instead of oauth.telegram.org, /v1/auth/telegram/mock
  // is a little form (Telegram id, name, phone or none) standing in for
  // Telegram's page; it comes back through the callback like the real flow.
  if (url === '/v1/auth/telegram/start' && req.method === 'POST') {
    let person = null;
    if (body.purpose === 'verify') { person = tokens.get(auth); if (!person || !people[person]) return err(res, 401, 'unauthorized', 'session ended'); }
    else if (body.purpose !== 'signin') return err(res, 422, 'invalid_request', 'purpose is signin or verify');
    const state = 's' + Math.random().toString(36).slice(2, 10); tgStates.set(state, { purpose: body.purpose, person, ret: typeof body.return === 'string' && body.return.startsWith('/') ? body.return : '/' });
    return json(res, 200, { url: `/v1/auth/telegram/mock?state=${state}` });
  }
  if (url === '/v1/auth/telegram/mock') {
    const state = new URL(req.url, 'http://x').searchParams.get('state') || '';
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>Telegram (mock)</title><body style="font:16px system-ui;max-width:360px;margin:40px auto;padding:0 16px"><h2>Log in with Telegram (mock)</h2><form action="/v1/auth/telegram/callback"><input type="hidden" name="state" value="${state}"><p><label>Telegram id <input name="id" value="555"></label></p><p><label>Name <input name="name" value="Bekzod Toshev"></label></p><p><label>Phone (empty: not shared) <input name="phone" value="998954445566"></label></p><p><button>Confirm</button> <button name="error" value="telegram_denied">Cancel</button></p></form>`);
  }
  if (url === '/v1/auth/telegram/callback') {
    const q = new URL(req.url, 'http://x').searchParams; const st = tgStates.get(q.get('state') || ''); tgStates.delete(q.get('state') || '');
    const go = (to) => { res.writeHead(302, { location: to }); res.end(); };
    if (!st) return go('/auth/telegram?error=telegram_failed');
    if (q.get('error')) return go(`/auth/telegram?error=${encodeURIComponent(q.get('error'))}`);
    const [given, ...rest] = String(q.get('name') || 'Telegram User').trim().split(/\s+/);
    const claims = { id: String(q.get('id') || '555'), given_name: given, family_name: rest.join(' '), phone: q.get('phone') ? normAny(q.get('phone')) : null };
    const ticket = newTicket({ tg: claims, purpose: st.purpose, person: st.person });
    return go(`/auth/telegram?ticket=${ticket}&purpose=${st.purpose}&return=${encodeURIComponent(st.ret)}`);
  }
  if (url === '/v1/auth/telegram/ticket' && req.method === 'POST') {
    const t = tickets.get(body.ticket); if (!t?.tg || t.purpose !== 'signin') return err(res, 422, 'invalid_ticket', 'start again'); tickets.delete(body.ticket);
    const c = t.tg; let p = people[tgLinks.get(c.id)];
    if (p) { if (!p.phone && c.phone && !byPhone(c.phone)) p.phone = c.phone; return signIn(res, p); }
    p = c.phone && byPhone(c.phone);
    if (!p) p = newPerson({ first: c.given_name, last: c.family_name, phone: c.phone, photo: true });
    linkTelegram(p, c.id); return signIn(res, p);
  }
  if (url === '/v1/auth/google/start') {
    const sp = new URL(req.url, 'http://x').searchParams; const ret = sp.get('return') || '/'; const as = sp.get('as') || 'malika';
    const t = newTicket({ google: { sub: 'g-' + as, first_name: as === 'malika' ? 'Malika' : as[0].toUpperCase() + as.slice(1), last_name: 'Yusupova', email: sp.get('email') || `${as}@example.com` } });
    res.writeHead(302, { location: `/auth/google#ticket=${t}&return=${encodeURIComponent(ret.startsWith('/') ? ret : '/')}` }); return res.end();
  }
  // Google: linked, or an account with the same email, signs in; else a new account without a phone.
  if (url === '/v1/auth/google/ticket' && req.method === 'POST') {
    const t = tickets.get(body.ticket); if (!t?.google) return err(res, 422, 'invalid_ticket', 'start again'); tickets.delete(body.ticket);
    const g = t.google; let p = people[googleLinks.get(g.sub)] || byEmail(g.email);
    if (!p) p = newPerson({ first: g.first_name, last: g.last_name, email: g.email, photo: true });
    googleLinks.set(g.sub, p.login); p.google = true; return signIn(res, p);
  }
  if (url === '/v1/auth/phone/start' && req.method === 'POST') {
    if (body.purpose !== 'reset') return err(res, 422, 'invalid_request', 'purpose is reset');
    const phone = normPhone(body.phone); if (!phone) return err(res, 422, 'invalid_phone', 'an Uzbek mobile number is needed');
    return sendSms(res, phone, 'reset');
  }
  if (url === '/v1/auth/phone/verify' && req.method === 'POST') {
    const phone = normPhone(body.phone); const bad = checkSms(res, phone, 'reset', body.code); if (bad) return bad;
    return json(res, 200, { ticket: newTicket({ phone, purpose: 'reset' }) });
  }
  if (url === '/v1/auth/reset' && req.method === 'POST') {
    const t = tickets.get(body.ticket); if (!t || t.purpose !== 'reset') return err(res, 422, 'invalid_ticket', 'verify the phone again');
    const p = byPhone(t.phone); if (!p) return err(res, 404, 'no_account', 'no account has this number');
    if (String(body.password || '').length < 8) return err(res, 422, 'weak_password', 'password must be 8–128 characters');
    tickets.delete(body.ticket); passwords.set(p.login, body.password); p.has_password = true; p.must_change_password = false;
    return signIn(res, p);
  }
  if (url.startsWith('/v1/photos/') && photos.has(url.slice('/v1/photos/'.length))) {
    const ph = photos.get(url.slice('/v1/photos/'.length)); res.writeHead(200, { 'content-type': ph.type, 'cache-control': 'public, max-age=31536000, immutable' }); return res.end(ph.data);
  }
  if (url.startsWith('/v1/photos/')) {
    const hue = [...url].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360;
    res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'max-age=86400' });
    return res.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="hsl(${hue} 55% 55%)"/><circle cx="32" cy="25" r="11" fill="#fff" opacity=".9"/><path d="M12 58c3-12 11-18 20-18s17 6 20 18z" fill="#fff" opacity=".9"/></svg>`);
  }
  if (url === '/v1/auth/login' && req.method === 'POST') {
    const id = body.login?.trim(); const p = people[id] ?? byPhone(normPhone(id)) ?? Object.values(people).find((x) => x.email && x.email === String(id).toLowerCase());
    const want = p && (passwords.get(p.login) ?? (p.status === 'registered' ? null : PW));
    if (!p || !want || body.password !== want) return err(res, 401, 'invalid_credentials', 'wrong login or password');
    return signIn(res, p);
  }
  const login = tokens.get(auth); const me = login && people[login];
  if (!me) return err(res, 401, 'unauthorized', 'session ended');
  if (url === '/v1/auth/logout') { tokens.delete(auth); return json(res, 204); }
  if (url === '/v1/me') return json(res, 200, me);
  if (url === '/v1/me/profile' && req.method === 'PUT') {
    for (const k of ['first_name', 'last_name']) {
      const v = body[k] == null ? null : String(body[k]).trim();
      if (v === '' || (v && v.length > 60)) return err(res, 422, 'invalid_profile', 'names are 1–60 characters');
    }
    if (body.first_name) me.first_name = body.first_name.trim(); if (body.last_name) me.last_name = body.last_name.trim();
    return json(res, 200, me);
  }
  if (url === '/v1/auth/password') {
    const want = passwords.get(me.login) ?? (me.has_password || me.status !== 'registered' ? PW : null);
    if (want != null && body.current_password !== want) return err(res, 403, 'wrong_password', 'wrong password');
    passwords.set(me.login, body.new_password); me.has_password = true;
    if ((body.new_password || '').length < 8) return err(res, 422, 'weak_password', 'password must be 8–128 characters');
    me.must_change_password = false; return json(res, 204);
  }
  if (me.must_change_password) return err(res, 403, 'password_change_required', 'change the password first');
  if (url === '/v1/auth/username') { if (body.username === 'taken') return err(res, 409, 'username_taken', 'taken'); me.username = body.username; return json(res, 200, { username: body.username }); }
  if (url === '/v1/me/photo' && req.method === 'PUT') {
    if (!isImage) return err(res, 422, 'invalid_photo', 'send the picture as image/jpeg, png or webp');
    if (raw.length > 512 * 1024) return err(res, 413, 'photo_too_large', 'at most 512 KB');
    const jpeg = raw[0] === 0xff && raw[1] === 0xd8; const png = raw[0] === 0x89 && raw[1] === 0x50;
    if (!jpeg && !png) return err(res, 422, 'invalid_photo', 'not a JPEG or PNG');
    const id = 'up' + Math.random().toString(36).slice(2, 12); photos.set(id, { type: jpeg ? 'image/jpeg' : 'image/png', data: raw });
    if (me.photo_url) photos.delete(me.photo_url.slice('/v1/photos/'.length));
    me.photo_url = `/v1/photos/${id}`; me.photo_chosen = true; return json(res, 200, me);
  }
  if (url === '/v1/me/photo' && req.method === 'DELETE') {
    if (me.photo_url) photos.delete(me.photo_url.slice('/v1/photos/'.length));
    me.photo_url = null; me.photo_chosen = true; return json(res, 200, me);
  }
  if (url === '/v1/me/phone/start' && req.method === 'POST') {
    if (me.phone) return err(res, 409, 'phone_already_set', 'this account has a phone number');
    const phone = normPhone(body.phone); if (!phone) return err(res, 422, 'invalid_phone', 'an Uzbek mobile number is needed');
    return sendSms(res, phone, 'verify:' + me.login);
  }
  if (url === '/v1/me/phone/verify' && req.method === 'POST') {
    if (me.phone) return err(res, 409, 'phone_already_set', 'this account has a phone number');
    const phone = normPhone(body.phone); const bad = checkSms(res, phone, 'verify:' + me.login, body.code); if (bad) return bad;
    return signIn(res, applyPhone(me, phone, null));
  }
  if (url === '/v1/me/phone/telegram' && req.method === 'POST') {
    const t = tickets.get(body.ticket); if (!t?.tg || t.purpose !== 'verify' || t.person !== me.login) return err(res, 422, 'invalid_ticket', 'start again'); tickets.delete(body.ticket);
    if (me.phone) return err(res, 409, 'phone_already_set', 'this account has a phone number');
    if (!t.tg.phone) return err(res, 422, 'telegram_no_phone', 'the number was not shared');
    return signIn(res, applyPhone(me, t.tg.phone, t.tg.id));
  }
  // No phone yet: everything with content stays shut.
  if (me.status === 'registered' && !me.phone && /^\/v1\/(practice|vocab|learning|me\/(practice|vocab|goals|parked|questions|reports|issues))/.test(url)) return err(res, 403, 'phone_required', 'prove a phone number first');
  if (url === '/v1/me/attendance') return me.kind === 'student' ? json(res, 200, attendance) : err(res, 403, 'forbidden', 'not a student');
  if (url === '/v1/practice/tests') {
    if (me.status !== 'registered') return json(res, 200, catalog);
    const open = (code) => /^DAY([1-9]|10)$/i.test(code);
    return json(res, 200, { tests: catalog.tests.map((t) => (open(t.code) ? t : { ...t, version: null, bytes: null, enrolled_only: true })) });
  }
  const pm = /^\/v1\/practice\/tests\/([^/]+)\/package$/.exec(url);
  const enrolledOnly = (code) => me.status === 'registered' && !/^DAY([1-9]|10)$/i.test(code || '');
  if (pm && enrolledOnly(decodeURIComponent(pm[1]))) return err(res, 403, 'enrolled_only', 'for SATMAKON students');
  if (url === '/v1/practice/attempts' && req.method === 'POST' && enrolledOnly(body.test)) return err(res, 403, 'enrolled_only', 'for SATMAKON students');
  if (pm) { const pkg = packages[decodeURIComponent(pm[1])]; if (!pkg) return err(res, 404, 'not_found', 'no such test'); return json(res, 200, { package: pkg, images: {}, expires_at: new Date(Date.now() + 6 * 3600e3).toISOString() }); }
  // Question statistics, Ask later, issue reports and goals (fictional data).
  const statsMatch = /^\/v1\/practice\/tests\/([^/]+)\/stats$/.exec(url);
  if (statsMatch) {
    const pkg = packages[decodeURIComponent(statsMatch[1])]; if (!pkg) return err(res, 404, 'not_found', 'no such test');
    const questions = pkg.sections.flatMap((s) => s.modules.flatMap((m) => m.questions)).map((q, i) => ({ id: q.id, answered: 40 + (i * 7) % 30, correct: 8 + (i * 13) % 30 }));
    return json(res, 200, { questions });
  }
  if (url === '/v1/practice/reports' && req.method === 'POST') {
    if (me.kind !== 'student') return err(res, 403, 'forbidden', 'not a student');
    if (!body.id || !['question', 'technical'].includes(body.kind)) return err(res, 422, 'invalid_report', 'bad report');
    const seen = reports.has(body.id); reports.set(body.id, { ...body, login }); return json(res, seen ? 200 : 201, { id: body.id });
  }
  if (url === '/v1/me/parked' && req.method === 'GET') {
    if (me.kind !== 'student') return err(res, 403, 'forbidden', 'not a student');
    return json(res, 200, { items: [...parked.values()].filter((p) => p.login === login).map(({ login: _l, ...p }) => p).sort((a, b) => b.created_at.localeCompare(a.created_at)) });
  }
  const pk = /^\/v1\/me\/parked\/([^/]+)$/.exec(url);
  if (pk) {
    if (me.kind !== 'student') return err(res, 403, 'forbidden', 'not a student');
    const id = decodeURIComponent(pk[1]); const old = parked.get(id);
    if (old && old.login !== login) return err(res, 404, 'not_found', 'not yours');
    if (req.method === 'DELETE') { if (!old) return err(res, 404, 'not_found', 'none'); parked.delete(id); return json(res, 204); }
    if (!body.folder || !String(body.folder).trim()) return err(res, 422, 'invalid_parked', 'folder is empty');
    const now = new Date().toISOString();
    const item = { ...body, folder: String(body.folder).trim().slice(0, 40), id, login, created_at: old?.created_at ?? now, updated_at: now };
    parked.set(id, item); const { login: _l, ...out } = item; return json(res, 200, out);
  }
  const tp = /^\/v1\/teacher\/groups\/(\d+)\/parked$/.exec(url);
  if (tp) {
    if (me.kind !== 'teacher') return err(res, 403, 'forbidden', 'not a teacher');
    return json(res, 200, { items: [...parked.values()].map(({ login: l, ...p }) => ({ ...p, student: { id: people[l]?.id ?? 0, first_name: people[l]?.first_name ?? '', last_name: people[l]?.last_name ?? '' } })) });
  }
  if (url === '/v1/me/goals') {
    if (me.kind !== 'student') return err(res, 403, 'forbidden', 'not a student');
    if (req.method === 'PUT') {
      const ok = (v) => v == null || (Number.isInteger(v) && v >= 200 && v <= 800 && v % 10 === 0);
      if (!ok(body.target_math) || !ok(body.target_rw)) return err(res, 422, 'invalid_goals', 'scores are 200–800, in tens');
      if (body.exam_date && body.exam_date < new Date().toISOString().slice(0, 10)) return err(res, 422, 'invalid_goals', 'the exam date is in the past');
      const g = { target_math: body.target_math ?? null, target_rw: body.target_rw ?? null, exam_date: body.exam_date ?? null, updated_at: new Date().toISOString() };
      goals.set(login, g);
    }
    const g = goals.get(login) ?? { target_math: null, target_rw: null, exam_date: null, updated_at: null };
    return json(res, 200, { ...g, target_total: g.target_math != null && g.target_rw != null ? g.target_math + g.target_rw : null });
  }
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
  if (url === '/v1/teacher/lessons') { if (me.kind !== 'teacher') return err(res, 403, 'forbidden', 'not a teacher'); const date = new URL(req.url, 'http://x').searchParams.get('date') || today(); return json(res, 200, { date, lessons: lessonsFor(date) }); }
  if (url === '/v1/attendance/sessions' && req.method === 'POST') {
    if (me.kind !== 'teacher') return err(res, 403, 'forbidden', 'not a teacher');
    const date = body.date || today(); const lesson = lessonsFor(date).find((l) => l.group_id === body.group_id);
    if (!lesson) return err(res, 404, 'not_found', 'not your lesson'); if (!lesson.attendance_enabled) return err(res, 422, 'attendance_disabled', 'one-to-one');
    let x = [...sessions.values()].find((y) => y.group_id === body.group_id && y.date === date);
    if (!x) { const id = `a0000000-0000-4000-8000-${String(sessions.size + 1).padStart(12, '0')}`; x = { id, group_id: lesson.group_id, group_name: lesson.group_name, date, starts_at: lesson.starts_at, ends_at: lesson.ends_at, late_after: lesson.starts_at.replace('T00:00', 'T00:10').replace('T14:00', 'T14:10'), opened_at: new Date().toISOString(), finished_at: null, status: 'open', editable_until: new Date(Date.now() + 86400e3).toISOString(), qr: { secret: 'c2VjcmV0LXNlY3JldC1zZWNyZXQtc2VjcmV0', window_seconds: 10, server_time: new Date().toISOString() }, marks: roster.map(([client_id, first_name, last_name], i) => ({ client_id, first_name, last_name, state: i === 0 ? 'present' : 'pending', source: i === 0 ? 'scan' : null, scanned_at: i === 0 ? new Date().toISOString() : null })) }; sessions.set(id, x); }
    return json(res, 200, sessionOut({ ...x, qr: { ...x.qr, server_time: new Date().toISOString() } }));
  }
  const sm = /^\/v1\/attendance\/sessions\/([^/]+)(\/finish|\/marks\/(\d+))?$/.exec(url);
  if (sm) {
    const x = sessions.get(sm[1]); if (!x) return err(res, 404, 'not_found', 'no such session');
    if (sm[2] === '/finish') { if (x.status === 'open') { x.status = 'finished'; x.finished_at = new Date().toISOString(); delete x.qr; for (const m of x.marks) if (m.state === 'pending') { m.state = 'absent'; m.source = 'auto'; } } return json(res, 200, sessionOut(x)); }
    if (sm[3]) { const m = x.marks.find((y) => y.client_id === Number(sm[3])); if (!m) return err(res, 403, 'not_in_roster', 'not in roster'); if (m.source === 'admin') return err(res, 409, 'set_by_admin', 'the office set it'); m.state = body.state; m.source = 'teacher'; return json(res, 200, sessionOut(x)); }
    if (x.status === 'open' && x.marks[1].state === 'pending' && Date.now() - Date.parse(x.opened_at) > 4000) { x.marks[1].state = 'late'; x.marks[1].source = 'scan'; x.marks[1].scanned_at = new Date().toISOString(); }
    return json(res, 200, sessionOut(x.qr ? { ...x, qr: { ...x.qr, server_time: new Date().toISOString() } } : x));
  }
  const gm = /^\/v1\/teacher\/groups\/(\d+)\/(practice|vocab)$/.exec(url);
  if (gm) { if (me.kind !== 'teacher') return err(res, 403, 'forbidden', 'not a teacher'); return json(res, 200, gm[2] === 'practice' ? groupPractice : groupVocab); }
  if (url === '/v1/me/parent-code') return me.kind === 'student' ? json(res, 200, { code: '48213' }) : err(res, 403, 'forbidden', 'not a student');
  err(res, 404, 'not_found', 'no such route');
}).listen(8081, '127.0.0.1', () => console.log('mock api on 8081'));
