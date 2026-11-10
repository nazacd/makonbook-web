import { Search, X } from 'lucide-react';
import { useId, useMemo, useState, type KeyboardEvent } from 'react';

import { countryName, type University } from '@/api/universities';
import { Flag } from '@/screens/roadmap/flags';

import { UniversityBadge } from './Crest';
import { qsLabel } from './UniversityCard';

// Finding the dream university: a search (name, short name, city or country),
// country chips, and the results. Moving through the results turns the globe
// to each one (onLook); choosing one is onSelect.

const fold = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);
const bare = (name: string) => fold(name).replace(/^the\s+/, '');
const SMALL = new Set(['of', 'the', 'and', 'for', 'at', 'in', 'de', 'la', 'le', 'du', 'des', 'der', 'und', 'zu']);
/** A name's initials, without the small words: "Massachusetts Institute of Technology" is "mit". */
const acronym = (name: string) => words(name.replace(/\(.*?\)/g, '')).filter((w) => !SMALL.has(w)).map((w) => w[0]).join('');
const rank = (u: University) => u.qs?.rank ?? 100000;

type Props = {
  universities: University[];
  onSelect: (u: University) => void;
  onLook: (place: { lat: number; lng: number; zoom?: number }) => void;
  onMatches: (ids: string[]) => void;
};

export function UniversityPicker({ universities, onSelect, onLook, onMatches }: Props) {
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();

  // Uzbekistan first, then the countries with the most universities.
  const countries = useMemo(() => {
    const n = new Map<string, number>();
    for (const u of universities) n.set(u.country, (n.get(u.country) ?? 0) + 1);
    const top = [...n.entries()].filter(([c]) => c !== 'UZ').sort((a, b) => b[1] - a[1]).slice(0, 11).map(([c]) => c);
    return n.has('UZ') ? ['UZ', ...top] : top;
  }, [universities]);

  const results = useMemo(() => {
    const q = fold(query.trim());
    const pool = country ? universities.filter((u) => u.country === country) : universities;
    if (!q) return pool.slice(0, country ? 30 : 8);
    // An exact name, short name or initials first ("MIT", "UCL"); then every
    // word typed starting a word of the name, city or country, best QS place
    // first; then the text anywhere in the name.
    const typed = words(q);
    const scored: Array<[number, University]> = [];
    for (const u of pool) {
      const name = bare(u.name);
      const short = fold(u.short_name ?? '');
      const own = [...words(u.name), ...words(u.short_name ?? ''), ...words(u.city ?? ''), ...words(countryName(u.country))];
      let s = -1;
      if (short === q || name === q.replace(/^the\s+/, '') || (q.length >= 2 && !q.includes(' ') && acronym(u.name) === q)) s = 0;
      else if (typed.every((t) => own.some((w) => w.startsWith(t)))) s = 1;
      else if (name.includes(q)) s = 2;
      if (s >= 0) scored.push([s, u]);
    }
    return scored.sort((a, b) => a[0] - b[0] || rank(a[1]) - rank(b[1])).slice(0, 30).map(([, u]) => u);
  }, [universities, query, country]);

  function look(u: University | undefined) {
    if (u?.location) onLook(u.location);
  }
  function type(v: string) {
    setQuery(v);
    setActive(0);
  }
  function pickCountry(c: string | null) {
    setCountry(c);
    setActive(0);
    const inside = c ? universities.filter((u) => u.country === c && u.location) : [];
    onMatches(inside.map((u) => u.id));
    if (inside.length) {
      // Its universities' middle (fine for a country; the globe only turns there).
      const lat = inside.reduce((s, u) => s + u.location!.lat, 0) / inside.length;
      const lng = Math.atan2(inside.reduce((s, u) => s + Math.sin((u.location!.lng * Math.PI) / 180), 0), inside.reduce((s, u) => s + Math.cos((u.location!.lng * Math.PI) / 180), 0)) * (180 / Math.PI);
      onLook({ lat, lng });
    }
  }
  function key(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.max(0, Math.min(results.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)));
      setActive(next);
      look(results[next]);
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      onSelect(results[active]);
    } else if (e.key === 'Escape') {
      type('');
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative shrink-0">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--onb-ink-3)]" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => {
            type(e.target.value);
            onMatches([]);
          }}
          onKeyDown={key}
          placeholder="Search universities, cities or countries"
          aria-label="Search universities"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
          autoComplete="off"
          className="field h-[52px] w-full rounded-full pl-11 pr-11 text-[15.5px] font-medium"
        />
        {query && (
          <button type="button" onClick={() => type('')} aria-label="Clear the search" className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--onb-ink-2)] hover:bg-white/10">
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="group" aria-label="Countries">
        {countries.map((c) => (
          <button key={c} type="button" aria-pressed={country === c} onClick={() => pickCountry(country === c ? null : c)} className="choice flex h-9 shrink-0 items-center gap-1.5 rounded-full pl-1.5 pr-3 text-[13px] font-semibold">
            <Flag code={c} size={22} className="ring-0" />
            {countryName(c)}
          </button>
        ))}
      </div>

      <ul id={listId} role="listbox" aria-label="Universities" className="flex min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
        {results.map((u, i) => (
          <li key={u.id} id={`${listId}-${u.id}`} role="option" aria-selected={i === active}>
            <button
              type="button"
              onClick={() => onSelect(u)}
              onPointerEnter={() => {
                setActive(i);
                look(u);
              }}
              className={`flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors ${i === active ? 'bg-white/10' : 'hover:bg-white/5'}`}>
              <UniversityBadge id={u.id} name={u.name} logo={u.logo_url} size={38} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold text-[var(--onb-ink)]">{u.name}</span>
                <span className="block truncate text-[12.5px] text-[var(--onb-ink-2)]">
                  {u.city ? `${u.city}, ` : ''}
                  {countryName(u.country)}
                </span>
              </span>
              {qsLabel(u) && <span className="shrink-0 text-[12px] font-bold text-[var(--onb-gold)] tabular">{qsLabel(u)}</span>}
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="px-3 py-4 text-center text-[13.5px] text-[var(--onb-ink-2)]">No university matches. Try its city or country.</li>}
      </ul>
    </div>
  );
}
