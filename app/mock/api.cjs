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
  if (url === '/v1/me/parent-code') return me.kind === 'student' ? json(res, 200, { code: '48213' }) : err(res, 403, 'forbidden', 'not a student');
  err(res, 404, 'not_found', 'no such route');
}).listen(8081, '127.0.0.1', () => console.log('mock api on 8081'));
