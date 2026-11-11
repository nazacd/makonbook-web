// Vocabulary, social, for the fictional API (makonbook-api spec 11.4–11.6):
// game results, the month's leaderboard, students' decks, moderation.
// Everyone in it is made up.

const crypto = require('node:crypto');

const games = new Map(); // login -> [result]
const decks = new Map(); // id -> deck
let reviewsOf = () => [];

const short = (first, last) => `${first} ${(last || '')[0] || ''}.`.trim();
const word = (w, d, e = '', p = null) => ({ id: crypto.randomUUID(), word: w, part_of_speech: p, definition: d, example: e, image: null });
const seed = (owner, title, description, words, adds) => {
  const id = crypto.randomUUID();
  decks.set(id, { id, owner, ownerName: owner, title, description, published_at: new Date(Date.now() - 86400e3 * adds).toISOString(), hidden: false, hidden_reason: null, words, adds: new Set(Array.from({ length: adds }, (_, i) => `someone-${i}`)), reports: new Map(), deleted: false });
};
seed('Madina K.', 'Words from The Great Gatsby', 'Every hard word in chapters 1–3.', [word('languid', 'Slow and relaxed, without energy.', 'A languid breeze moved the curtains.', 'adjective'), word('supercilious', 'Behaving as if better than others.', 'He gave a supercilious smile.', 'adjective'), word('fortitude', 'Courage in pain or trouble.', 'She faced the news with fortitude.', 'noun'), word('incredulous', 'Unable to believe something.', 'They stared, incredulous.', 'adjective'), word('meander', 'To wander slowly without a clear path.', 'The river meanders through the valley.', 'verb'), word('vestige', 'A last small trace of something.', 'Not a vestige of the old wall remained.', 'noun')], 41);
seed('Jasur R.', 'Science passage verbs', 'Verbs that keep coming up in the science passages.', [word('corroborate', 'To support with evidence.', 'New data corroborate the theory.', 'verb'), word('posit', 'To put forward as a fact to argue from.', 'The author posits a link between sleep and memory.', 'verb'), word('mitigate', 'To make less severe.', 'Trees mitigate the heat of cities.', 'verb'), word('elucidate', 'To make clear; explain.', 'The diagram elucidates the process.', 'verb'), word('refute', 'To prove wrong.', 'The study refutes an older claim.', 'verb')], 27);
seed('Nilufar T.', 'Tone words for R&W', 'For “which choice best describes the tone” questions.', [word('wry', 'Dry and mildly mocking.', 'She made a wry remark about the weather.', 'adjective'), word('earnest', 'Serious and sincere.', 'His earnest plea moved the jury.', 'adjective'), word('ambivalent', 'Having mixed feelings.', 'The critic seems ambivalent about the film.', 'adjective'), word('reverent', 'Showing deep respect.', 'A reverent silence filled the hall.', 'adjective'), word('sardonic', 'Grimly mocking.', 'He gave a sardonic laugh.', 'adjective')], 12);

const OTHERS_ALL = [['Madina', 'Karimova', 412], ['Jasur', 'Rahimov', 388], ['Aziza', 'Tursunova', 301], ['Bekzod', 'Yusupov', 255], ['Diyor', 'Qodirov', 190], ['Laylo', 'Ergasheva', 166], ['Sardor', 'Aliyev', 120], ['Kamila', 'Nazarova', 87], ['Otabek', 'Saidov', 54], ['Zarina', 'Ismoilova', 23]];
const OTHERS_GROUP = [['Ali', 'Valiyev', 214], ['Nilufar', 'Tosheva', 143], ['Bekzod', 'Yusupov', 255], ['Madina', 'Karimova', 412]];

const tz = (t) => new Date(new Date(t).getTime() + 5 * 3600e3).toISOString().slice(0, 10);
function pointsOf(login) {
  const month = tz(Date.now()).slice(0, 7);
  const days = new Set(reviewsOf(login).filter((r) => tz(r.reviewed_at).startsWith(month)).map((r) => `${r.word_id}|${tz(r.reviewed_at)}`));
  const perDay = new Map();
  for (const g of games.get(login) || []) if (tz(g.played_at).startsWith(month)) perDay.set(tz(g.played_at), (perDay.get(tz(g.played_at)) || 0) + g.points);
  return days.size + [...perDay.values()].reduce((a, b) => a + b, 0);
}

function deckOut(d, login, teacher, withWords) {
  const mine = !teacher && d.owner === login;
  return {
    id: d.id, title: d.title, description: d.description, owner: mine ? 'You' : d.ownerName, mine, added: d.adds.has(login), published: !!d.published_at, published_at: d.published_at,
    hidden: d.hidden, hidden_reason: mine || teacher ? d.hidden_reason : null, adds: d.adds.size, word_count: d.words.length,
    reports: teacher ? [...d.reports.values()].filter((r) => !r.resolved).length : null, words: withWords ? d.words : [],
  };
}

function route(url, req, res, body, me, json, err) {
  const login = me.login;
  const student = me.kind === 'student';
  const teacher = me.kind === 'teacher';
  const q = new URL(req.url, 'http://x').searchParams;

  if (url === '/v1/vocab/games' && req.method === 'POST') {
    if (!student) return err(res, 403, 'forbidden', 'only students'), true;
    const list = games.get(login) || [];
    let added = 0;
    for (const g of body.results || []) {
      if (list.some((x) => x.id === g.id)) continue;
      const day = tz(g.played_at);
      const had = list.filter((x) => tz(x.played_at) === day).reduce((a, x) => a + x.points, 0);
      list.push({ ...g, points: Math.max(0, Math.min(g.score * 2, 100 - had)) });
      added++;
    }
    games.set(login, list);
    return json(res, 200, { received: (body.results || []).length, added }), true;
  }
  if (url === '/v1/me/vocab/games') {
    const list = games.get(login) || [];
    const stat = (k) => {
      const mine = list.filter((g) => g.game === k);
      if (!mine.length) return { plays: 0, best: null };
      return { plays: mine.length, best: k === 'pairs' ? Math.min(...mine.map((g) => g.duration_ms + (g.mistakes || 0) * 5000)) : Math.max(...mine.map((g) => g.score)) };
    };
    return json(res, 200, { games: { pairs: stat('pairs'), unscramble: stat('unscramble'), gap: stat('gap') } }), true;
  }
  if (url === '/v1/vocab/leaderboard') {
    const scope = q.get('scope') || 'all';
    if (scope === 'groups' && !student) return err(res, 403, 'forbidden', 'students only'), true;
    if (scope === 'groups' && me.status === 'registered') return err(res, 403, 'enrolled_only', 'for SAT MAKON students'), true;
    const others = (scope === 'groups' ? OTHERS_GROUP : OTHERS_ALL).map(([f, l, p]) => ({ name: scope === 'groups' ? `${f} ${l}` : short(f, l), points: p, me: false, photo_url: null }));
    const mine = student ? pointsOf(login) : 0;
    const rows = [...others, ...(mine > 0 ? [{ name: scope === 'groups' ? `${me.first_name} ${me.last_name}` : short(me.first_name, me.last_name), points: mine, me: true, photo_url: me.photo_url || null }] : [])].sort((a, b) => b.points - a.points);
    let rank = 0;
    const entries = rows.map((r, i) => ({ ...r, rank: i && r.points === rows[i - 1].points ? rank : (rank = i + 1) }));
    return json(res, 200, { scope, month: tz(Date.now()).slice(0, 7), entries: entries.slice(0, 50), me: entries.find((e) => e.me) || null, learners: entries.length }), true;
  }
  const tg = /^\/v1\/teacher\/groups\/(\d+)\/vocab\/games$/.exec(url);
  if (tg) {
    if (!teacher) return err(res, 403, 'forbidden', 'not a teacher'), true;
    const real = [...games.values()].flat().map((g) => ({ ...g, client_id: 2001, first_name: 'Ali', last_name: 'Valiyev', missed: [] }));
    const fake = [
      { id: crypto.randomUUID(), client_id: 2002, first_name: 'Madina', last_name: 'Karimova', game: 'gap', score: 8, total: 10, mistakes: 2, duration_ms: 95000, played_at: new Date(Date.now() - 3600e3 * 3).toISOString(), missed: [{ id: 'm1', word: 'ephemeral', definition: 'Lasting a very short time.' }, { id: 'm2', word: 'candid', definition: 'Truthful and straightforward.' }] },
      { id: crypto.randomUUID(), client_id: 2003, first_name: 'Jasur', last_name: 'Rahimov', game: 'pairs', score: 10, total: 10, mistakes: 0, duration_ms: 31000, played_at: new Date(Date.now() - 86400e3).toISOString(), missed: [] },
    ];
    return json(res, 200, { games: [...real, ...fake].sort((a, b) => b.played_at.localeCompare(a.played_at)) }), true;
  }

  if (url === '/v1/me/vocab/decks') {
    if (!student) return err(res, 403, 'forbidden', 'only students'), true;
    const list = [...decks.values()].filter((d) => !d.deleted && (d.owner === login || (d.adds.has(login) && d.published_at && !d.hidden)));
    list.sort((a, b) => (b.owner === login) - (a.owner === login));
    return json(res, 200, { decks: list.map((d) => deckOut(d, login, false, true)) }), true;
  }
  if (url === '/v1/vocab/decks' && req.method === 'GET') {
    const moderation = teacher && q.get('moderation') === '1';
    const s = (q.get('q') || '').toLowerCase();
    let list = [...decks.values()].filter((d) => !d.deleted && d.published_at);
    list = moderation ? list.filter((d) => d.hidden || [...d.reports.values()].some((r) => !r.resolved)) : list.filter((d) => !d.hidden);
    if (s) list = list.filter((d) => d.title.toLowerCase().includes(s) || d.description.toLowerCase().includes(s));
    list.sort((a, b) => b.adds.size - a.adds.size);
    return json(res, 200, { decks: list.map((d) => deckOut(d, login, teacher, false)) }), true;
  }
  const check = (input) => {
    if (!input.title || !input.title.trim()) return 'the title is needed';
    const seen = new Set();
    for (const w of input.words || []) {
      if (!w.word || !w.definition) return 'each word needs its meaning';
      if (seen.has(w.word.toLowerCase())) return `“${w.word}” is in the deck twice`;
      seen.add(w.word.toLowerCase());
    }
    return null;
  };
  const toWords = (old, input) => (input.words || []).map((w) => {
    const keep = old.find((o) => o.id === w.id) || old.find((o) => o.word.toLowerCase() === w.word.toLowerCase());
    return { id: keep ? keep.id : crypto.randomUUID(), word: w.word, part_of_speech: w.part_of_speech || null, definition: w.definition, example: w.example || '', image: null };
  });
  if (url === '/v1/vocab/decks' && req.method === 'POST') {
    if (!student) return err(res, 403, 'forbidden', 'only students'), true;
    const bad = check(body);
    if (bad) return err(res, 422, 'invalid_deck', bad), true;
    const id = crypto.randomUUID();
    decks.set(id, { id, owner: login, ownerName: short(me.first_name, me.last_name), title: body.title.trim(), description: (body.description || '').trim(), published_at: null, hidden: false, hidden_reason: null, words: toWords([], body), adds: new Set(), reports: new Map(), deleted: false });
    return json(res, 201, { id }), true;
  }
  const m = /^\/v1\/vocab\/decks\/([^/]+)(?:\/(published|added|report|hidden))?$/.exec(url);
  if (!m) return false;
  const d = decks.get(m[1]);
  const visible = d && !d.deleted && (d.owner === login || teacher || (d.published_at && !d.hidden));
  if (!visible) return err(res, 404, 'not_found', 'no such deck'), true;
  const owner = student && d.owner === login;
  const sub = m[2];
  if (!sub && req.method === 'GET') {
    const out = { deck: deckOut(d, login, teacher, true) };
    if (teacher) out.report_reasons = [...d.reports.values()].filter((r) => !r.resolved).map((r) => r.reason);
    return json(res, 200, out), true;
  }
  if (!sub && req.method === 'PUT') {
    if (!owner) return err(res, 403, 'forbidden', 'not yours'), true;
    const bad = check(body);
    if (bad) return err(res, 422, 'invalid_deck', bad), true;
    Object.assign(d, { title: body.title.trim(), description: (body.description || '').trim(), words: toWords(d.words, body) });
    if (d.words.length < 5) d.published_at = null;
    return json(res, 204), true;
  }
  if (!sub && req.method === 'DELETE') {
    if (!owner) return err(res, 403, 'forbidden', 'not yours'), true;
    d.deleted = true;
    return json(res, 204), true;
  }
  if (sub === 'published') {
    if (!owner) return err(res, 403, 'forbidden', 'not yours'), true;
    if (req.method === 'PUT' && d.words.length < 5) return err(res, 422, 'deck_too_small', 'a deck needs at least 5 words to be shared'), true;
    d.published_at = req.method === 'PUT' ? d.published_at || new Date().toISOString() : null;
    return json(res, 204), true;
  }
  if (sub === 'added') {
    if (d.owner === login) return err(res, 409, 'own_deck', 'that is your own deck'), true;
    if (req.method === 'PUT') d.adds.add(login);
    else d.adds.delete(login);
    return json(res, 204), true;
  }
  if (sub === 'report') {
    if (d.owner === login) return err(res, 409, 'own_deck', 'that is your own deck'), true;
    if (!body.reason) return err(res, 422, 'invalid_deck', 'say what is wrong'), true;
    d.reports.set(login, { reason: body.reason, resolved: false });
    if ([...d.reports.values()].filter((r) => !r.resolved).length >= 3) Object.assign(d, { hidden: true, hidden_reason: 'Reported by students; a teacher will look at it.' });
    return json(res, 204), true;
  }
  if (sub === 'hidden') {
    if (!teacher) return err(res, 403, 'forbidden', 'teachers only'), true;
    if (req.method === 'PUT') {
      if (!body.reason) return err(res, 422, 'invalid_deck', 'give a reason'), true;
      Object.assign(d, { hidden: true, hidden_reason: body.reason });
    } else Object.assign(d, { hidden: false, hidden_reason: null });
    for (const r of d.reports.values()) r.resolved = true;
    return json(res, 204), true;
  }
  return false;
}

module.exports = { route, init: (getReviews) => { reviewsOf = getReviews; } };
