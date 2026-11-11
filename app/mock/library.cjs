// The Library for the mock (spec §25). Fictional by default: a few made-up
// books whose PDFs and covers are drawn here. MOCK_LIBRARY=<checkout of the
// private makonbook-library repository> loads the real books instead, on your
// machine only (they are never committed).
const fs = require('fs');
const path = require('path');

const FICTION = [
  ['lines-and-slopes', 'Lines and Slopes', 'math', 24, 'A made-up guide to straight lines: slope, intercepts and the stories they tell. For trying the reader out.'],
  ['curves-ahead', 'Curves Ahead', 'math', 18, 'A made-up guide to quadratics and other curves, with nothing real in it.'],
  ['commas-and-company', 'Commas and Company', 'english', 31, 'A made-up guide to punctuation, written to fill a shelf.'],
  ['reading-between', 'Reading Between the Lines', 'english', 12, 'A made-up guide to inference questions.'],
  ['the-clock', 'Beating the Clock', 'math', 9, 'A made-up guide to pacing a timed test.'],
];

/** A small valid PDF: `pages` A4 pages, each with the title and its number (Helvetica, not embedded). */
function pdf(title, pages) {
  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const esc = (s) => s.replace(/[\\()]/g, '\\$&');
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(''); // the page tree, filled in below
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const kids = [];
  for (let n = 1; n <= pages; n++) {
    const lines = Array.from({ length: 26 }, (_, i) => `BT /F1 11 Tf 72 ${660 - i * 20} Td (${esc(`Line ${i + 1} of page ${n}: made-up text, only here to fill the page.`)}) Tj ET`).join('\n');
    const stream = `0.24 0 0.56 rg 0 760 595 82 re f\nBT /F1 22 Tf 1 1 1 rg 72 792 Td (${esc(title)}) Tj ET\n0.1 0.1 0.15 rg\nBT /F1 14 Tf 72 720 Td (${esc(n === 1 ? 'A made-up book for the mock' : `Chapter ${Math.ceil(n / 4)}`)}) Tj ET\n${lines}\nBT /F1 10 Tf 290 40 Td (${n}) Tj ET`;
    const content = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[1] = `<< /Type /Pages /Count ${pages} /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] >>`;
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}

const cover = (title, subject) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="${subject === 'math' ? '#3e008e' : '#0f5c63'}"/><rect x="24" y="24" width="252" height="352" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2"/><text x="150" y="190" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="26" fill="#fff">${title.split(' ').slice(0, 2).join(' ')}</text><text x="150" y="222" text-anchor="middle" font-family="sans-serif" font-size="16" fill="rgba(255,255,255,0.8)">${title.split(' ').slice(2).join(' ')}</text><text x="150" y="350" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="12" letter-spacing="4" fill="rgba(255,255,255,0.7)">MOCK LIBRARY</text></svg>`);

function fictional() {
  return FICTION.map(([id, title, subject, pages, description]) => {
    const file = pdf(title, pages);
    return { book: { id, title, author: 'Mock Press', subject, description, pages, bytes: file.length, cover_url: `/v1/library/${id}/cover?v=1` }, file, cover: { type: 'image/svg+xml', data: cover(title, subject) } };
  });
}

function real(dir) {
  const names = fs.readdirSync(path.join(dir, 'books')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  const out = names.map((name) => {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'books', `${name}.json`), 'utf8'));
    const file = fs.readFileSync(path.join(dir, 'books', `${name}.pdf`));
    const id = name.replace(/^\d+-/, '');
    const ext = ['png', 'jpg', 'jpeg', 'webp'].find((e) => fs.existsSync(path.join(dir, 'covers', `${name}.${e}`)));
    return {
      book: { id, title: meta.title, author: meta.author, subject: meta.subject, description: meta.description, pages: meta.pages, bytes: file.length, cover_url: ext ? `/v1/library/${id}/cover?v=1` : null },
      file,
      cover: ext ? { type: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg', data: fs.readFileSync(path.join(dir, 'covers', `${name}.${ext}`)) } : null,
    };
  });
  console.log(`library from ${dir}: ${out.length} books`);
  return out;
}

const shelf = process.env.MOCK_LIBRARY ? real(process.env.MOCK_LIBRARY) : fictional();
const byId = new Map(shelf.map((s) => [s.book.id, s]));
const progress = new Map(); // `${login}:${book}` -> { page, updated_at }
// A few made-up readers, so the counts aren't all zero.
shelf.forEach((s, i) => { for (let k = 0; k < (i * 7 + 3) % 11; k++) progress.set(`reader${k}:${s.book.id}`, { page: 1, updated_at: new Date().toISOString() }); });
const views = (id) => [...progress.keys()].filter((k) => k.endsWith(`:${id}`)).length;

module.exports = {
  /** The cover route (no sign-in); true when it answered. */
  cover(url, res) {
    const m = url.match(/^\/v1\/library\/([a-z0-9-]+)\/cover$/);
    if (!m) return false;
    const c = byId.get(m[1])?.cover;
    if (!c) { res.writeHead(404, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'not_found', message: 'no cover' } })); return true; }
    res.writeHead(200, { 'content-type': c.type, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' });
    res.end(c.data);
    return true;
  },
  /** The signed-in routes; true when it answered. */
  route(url, req, res, body, login, json, err) {
    if (url === '/v1/library') {
      json(res, 200, { books: shelf.map((s) => ({ ...s.book, views: views(s.book.id), progress: progress.get(`${login}:${s.book.id}`) ?? null })) });
      return true;
    }
    const m = url.match(/^\/v1\/library\/([a-z0-9-]+)\/(file|progress)$/);
    if (!m) return false;
    const s = byId.get(m[1]);
    if (!s) { err(res, 404, 'not_found', 'no such book'); return true; }
    if (m[2] === 'file') {
      res.writeHead(200, { 'content-type': 'application/pdf', 'content-length': s.file.length, 'cache-control': 'private, max-age=3600', 'content-disposition': `${req.url.includes('download=') ? 'attachment' : 'inline'}; filename="${s.book.title}.pdf"` });
      res.end(s.file);
      return true;
    }
    if (req.method !== 'PUT') return false;
    if (!Number.isInteger(body.page) || body.page < 1 || body.page > s.book.pages) { err(res, 422, 'invalid_page', 'the book has no such page'); return true; }
    const p = { page: body.page, updated_at: new Date().toISOString() };
    progress.set(`${login}:${s.book.id}`, p);
    json(res, 200, p);
    return true;
  },
};
