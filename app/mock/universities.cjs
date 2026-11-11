// Universities for the mock (spec §24). Fictional by default: made-up names
// placed at real cities (their coordinates are geography), with made-up QS
// places and SAT figures. MOCK_UNIVERSITIES=<checkout of the private
// makonbook-universities repository> loads the real data and logos instead,
// on your machine only (it is never committed).
const fs = require('fs');
const path = require('path');

// [country, city, lat, lng]
const CITIES = [
  ['US', 'Boston', 42.36, -71.06], ['US', 'New York', 40.71, -74.01], ['US', 'Palo Alto', 37.44, -122.14], ['US', 'Chicago', 41.88, -87.63],
  ['US', 'Los Angeles', 34.05, -118.24], ['US', 'Seattle', 47.61, -122.33], ['US', 'Austin', 30.27, -97.74], ['US', 'Atlanta', 33.75, -84.39],
  ['US', 'Philadelphia', 39.95, -75.17], ['US', 'Ann Arbor', 42.28, -83.74], ['US', 'Pittsburgh', 40.44, -79.99], ['US', 'San Diego', 32.72, -117.16],
  ['CA', 'Toronto', 43.65, -79.38], ['CA', 'Vancouver', 49.28, -123.12], ['CA', 'Montreal', 45.5, -73.57], ['CA', 'Calgary', 51.05, -114.07],
  ['GB', 'London', 51.51, -0.13], ['GB', 'Edinburgh', 55.95, -3.19], ['GB', 'Manchester', 53.48, -2.24], ['GB', 'Oxford', 51.75, -1.26],
  ['GB', 'Cambridge', 52.21, 0.12], ['GB', 'Bristol', 51.45, -2.59], ['DE', 'Berlin', 52.52, 13.4], ['DE', 'Munich', 48.14, 11.58],
  ['DE', 'Heidelberg', 49.4, 8.67], ['DE', 'Hamburg', 53.55, 9.99], ['FR', 'Paris', 48.86, 2.35], ['FR', 'Lyon', 45.76, 4.84],
  ['NL', 'Amsterdam', 52.37, 4.9], ['NL', 'Delft', 52.01, 4.36], ['CH', 'Zurich', 47.38, 8.54], ['CH', 'Lausanne', 46.52, 6.63],
  ['IT', 'Milan', 45.46, 9.19], ['IT', 'Rome', 41.9, 12.5], ['ES', 'Madrid', 40.42, -3.7], ['ES', 'Barcelona', 41.39, 2.17],
  ['SE', 'Stockholm', 59.33, 18.07], ['DK', 'Copenhagen', 55.68, 12.57], ['FI', 'Helsinki', 60.17, 24.94], ['NO', 'Oslo', 59.91, 10.75],
  ['PL', 'Warsaw', 52.23, 21.01], ['CZ', 'Prague', 50.08, 14.44], ['AT', 'Vienna', 48.21, 16.37], ['BE', 'Leuven', 50.88, 4.7],
  ['TR', 'Istanbul', 41.01, 28.98], ['TR', 'Ankara', 39.93, 32.86], ['KR', 'Seoul', 37.57, 126.98], ['KR', 'Daejeon', 36.35, 127.38],
  ['JP', 'Tokyo', 35.68, 139.69], ['JP', 'Kyoto', 35.01, 135.77], ['JP', 'Osaka', 34.69, 135.5], ['CN', 'Beijing', 39.9, 116.41],
  ['CN', 'Shanghai', 31.23, 121.47], ['HK', 'Hong Kong', 22.32, 114.17], ['SG', 'Singapore', 1.35, 103.82], ['MY', 'Kuala Lumpur', 3.14, 101.69],
  ['AU', 'Sydney', -33.87, 151.21], ['AU', 'Melbourne', -37.81, 144.96], ['NZ', 'Auckland', -36.85, 174.76], ['AE', 'Abu Dhabi', 24.45, 54.38],
  ['QA', 'Doha', 25.29, 51.53], ['SA', 'Riyadh', 24.71, 46.68], ['KZ', 'Astana', 51.17, 71.45], ['RU', 'Moscow', 55.76, 37.62],
  ['IN', 'Bengaluru', 12.97, 77.59], ['BR', 'São Paulo', -23.55, -46.63], ['ZA', 'Cape Town', -33.92, 18.42], ['EG', 'Cairo', 30.04, 31.24],
  ['IL', 'Haifa', 32.79, 34.99], ['IE', 'Dublin', 53.35, -6.26],
];
const UZ = [['Tashkent', 41.31, 69.28], ['Samarkand', 39.65, 66.96], ['Bukhara', 39.77, 64.42], ['Namangan', 41.0, 71.67], ['Nukus', 42.46, 59.6]];
const FIRST = ['Northbridge', 'Meridian', 'Halcyon', 'Silverlake', 'Starling', 'Juniper', 'Cobalt', 'Lumen', 'Aurora', 'Westmere', 'Kestrel', 'Larkspur', 'Harrow Vale', 'Brightwater', 'Ashgrove', 'Corvina'];
const KIND = ['University', 'Institute of Technology', 'University of Science', 'College', 'Polytechnic'];

const slug = (s) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function fictional() {
  const out = [];
  let rank = 0;
  CITIES.forEach(([country, city, lat, lng], i) => {
    const n = 1 + (i % 3);
    for (let k = 0; k < n; k++) {
      rank += 1 + ((i * 7 + k * 3) % 9);
      const name = `${FIRST[(i * 3 + k * 5) % FIRST.length]} ${KIND[(i + k) % KIND.length]} of ${city}`;
      const base = Math.max(1050, 1560 - rank * 2);
      const sat =
        country === 'US' ? { policy: rank % 4 === 0 ? 'optional' : 'required', total: { p25: base - 60, p75: base + 20 }, math: null, rw: null, minimum: null, year: '2026-27' }
        : ['GB', 'SG', 'HK', 'CA'].includes(country) && rank < 500 ? { policy: 'accepted', total: null, math: null, rw: null, minimum: { total: Math.round((base - 40) / 10) * 10 }, year: '2026-27' }
        : null;
      out.push({
        id: slug(name), name, short_name: null, country, city, location: { lat: lat + (k * 0.04), lng: lng + (k * 0.05) },
        qs: { rank, display: rank > 500 ? `${Math.floor((rank - 1) / 10) * 10 + 1}-${Math.floor((rank - 1) / 10) * 10 + 10}` : String(rank) },
        logo_url: null, sat, has_details: false,
      });
    }
  });
  UZ.forEach(([city, lat, lng], i) => {
    for (const kind of i === 0 ? ['State University', 'International University', 'Institute of Technology'] : ['State University']) {
      const name = `${FIRST[(i + 9) % FIRST.length]} ${kind} of ${city}`;
      out.push({ id: slug(name), name, short_name: null, country: 'UZ', city, location: { lat, lng }, qs: null, logo_url: null, sat: null, has_details: false });
    }
  });
  return { universities: out, details: new Map(), logos: new Map() };
}

// The list's facts for browsing, read from a record as the API does (spec 24.5).
function factsOf(r) {
  if (!r) return undefined;
  const usd = (m) => (!m ? null : m.usd != null ? { min: Math.trunc(m.usd), max: Math.trunc(m.usd) } : m.usd_min != null && m.usd_max != null ? { min: Math.trunc(m.usd_min), max: Math.trunc(m.usd_max) } : null);
  const tuition = usd(r.tuition);
  return {
    type: r.type ?? null, website: r.website ?? null, tuition, living: usd(r.living_cost), acceptance_rate: r.admissions?.acceptance_rate?.value ?? null,
    english_bachelors: r.english_bachelors ?? null,
    aid: { need_based: r.aid?.need_based_international ?? null, full_need: r.aid?.meets_full_need_international ?? null, merit: r.aid?.merit_scholarships_international ?? null, scholarships: (r.aid?.scholarships ?? []).length },
    deadlines: (r.admissions?.deadlines ?? []).map((d) => d.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort(),
    region: r.region?.name ?? null, full: !!r.admissions_url && !!tuition,
  };
}

function real(dir) {
  const lines = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : []);
  const records = new Map(lines(path.join(dir, 'data', 'universities.jsonl')).map((r) => [r.id, r]));
  const countries = new Map(lines(path.join(dir, 'data', 'countries.jsonl')).map((c) => [c.code, c]));
  const logos = new Map();
  const universities = lines(path.join(dir, 'data', 'list.jsonl')).map((l) => {
    const r = { ...l, ...(records.get(l.id) ?? {}) };
    let logo_url = null;
    if (r.logo?.file && fs.existsSync(path.join(dir, r.logo.file))) {
      logos.set(r.id, { type: r.logo.file.endsWith('.svg') ? 'image/svg+xml' : 'image/png', data: fs.readFileSync(path.join(dir, r.logo.file)) });
      logo_url = `/v1/universities/${r.id}/logo?v=1`;
    }
    return {
      id: r.id, name: r.name, short_name: r.short_name ?? null, country: r.country, city: r.city ?? null, location: r.location ?? null,
      qs: r.qs ? { rank: r.qs.rank, display: r.qs.rank_display } : null, logo_url, sat: r.admissions?.sat ?? null, has_details: records.has(r.id),
      facts: factsOf(records.get(r.id)),
    };
  });
  const details = new Map([...records].map(([id, r]) => { const { doubts: _d, ...rest } = r; return [id, rest]; }));
  console.log(`universities from ${dir}: ${universities.length}, ${records.size} with details, ${logos.size} logos`);
  return { universities, details, logos, countries };
}

const data = process.env.MOCK_UNIVERSITIES ? real(process.env.MOCK_UNIVERSITIES) : fictional();
const byId = new Map(data.universities.map((u) => [u.id, u]));
const saved = new Map(); // login -> Map(id -> saved_at)

module.exports = {
  byId,
  /** The logo route (no sign-in); true when it answered. */
  logo(url, res) {
    const m = url.match(/^\/v1\/universities\/([a-z0-9-]+)\/logo$/);
    if (!m) return false;
    const lg = data.logos.get(m[1]);
    if (!lg) { res.writeHead(404, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'not_found', message: 'no logo' } })); return true; }
    res.writeHead(200, { 'content-type': lg.type, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox" });
    res.end(lg.data);
    return true;
  },
  /** The signed-in routes; true when it answered. */
  route(url, req, res, json, err, me) {
    if (url === '/v1/me/universities') {
      if (me.kind !== 'student') { err(res, 403, 'forbidden', 'students only'); return true; }
      json(res, 200, { saved: [...(saved.get(me.login) ?? new Map())].map(([id, at]) => ({ id, saved_at: at })).reverse() });
      return true;
    }
    const sm = url.match(/^\/v1\/me\/universities\/([a-z0-9-]+)$/);
    if (sm) {
      if (me.kind !== 'student') { err(res, 403, 'forbidden', 'students only'); return true; }
      const mine = saved.get(me.login) ?? new Map();
      if (req.method === 'PUT') {
        if (!byId.has(sm[1])) { err(res, 404, 'not_found', 'no such university'); return true; }
        if (!mine.has(sm[1])) mine.set(sm[1], new Date().toISOString());
      } else mine.delete(sm[1]);
      saved.set(me.login, mine);
      json(res, 204);
      return true;
    }
    if (url === '/v1/universities') { json(res, 200, { version: String(data.universities.length), universities: data.universities }); return true; }
    const m = url.match(/^\/v1\/universities\/([a-z0-9-]+)$/);
    if (!m) return false;
    const u = byId.get(m[1]);
    if (!u) { err(res, 404, 'not_found', 'no such university'); return true; }
    const d = data.details.get(u.id) ?? null;
    const c = d && data.countries?.get(u.country);
    json(res, 200, { ...u, details: d, country_details: c ? (({ doubts: _d, ...rest }) => rest)(c) : null });
    return true;
  },
};
