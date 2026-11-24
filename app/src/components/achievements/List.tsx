import { useState } from 'react';

import { xp, type Gamification } from '@/api/gamification';
import { GROUPS, groupOf, iconOf } from '@/components/achievements/catalogue';
import { ItemIcon } from '@/components/achievements/Icons';
import { relativeDay } from '@/lib/schedule';

// The achievements as slabs, by group, for reading and for keyboards: the
// icon alone at the left (no frame; those belong to the tree), the coloured
// header, the name, what it takes and how far along. A filter narrows it to
// the earned ones or the ones still to do.

type Achievement = Gamification['achievements'][number];
type Filter = 'all' | 'earned' | 'todo';

const head = (a: Achievement, on: boolean) => (on ? (a.tier === 'challenge' ? 'Challenge complete!' : 'Achievement unlocked!') : a.tier === 'challenge' ? 'Challenge' : a.tier === 'goal' ? 'Goal' : 'Achievement');

export function AchievementList({ g, now }: { g: Gamification; now: number }) {
  const [filter, setFilter] = useState<Filter>('all');
  const earned = g.achievements.filter((a) => a.unlocked_at).length;
  const counts: Record<Filter, number> = { all: g.achievements.length, earned, todo: g.achievements.length - earned };
  const shown = g.achievements.filter((a) => filter === 'all' || (filter === 'earned') === !!a.unlocked_at);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Which achievements to show">
        {(['all', 'earned', 'todo'] as const).map((f) => (
          <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)} className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold ${filter === f ? 'border-primary/30 bg-accent-tint text-accent' : 'border-line bg-surface text-ink-2 hover:text-ink'}`}>
            {{ all: 'All', earned: 'Earned', todo: 'To do' }[f]} <span className="tabular opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="t-subhead py-6 text-center text-ink-2">{filter === 'earned' ? 'None yet. The first one takes a single answer.' : 'Every one of them earned. That’s the whole wall.'}</p>}
      {GROUPS.map((group) => {
        const list = shown.filter((a) => groupOf(a.code) === group.key);
        if (list.length === 0) return null;
        const all = g.achievements.filter((a) => groupOf(a.code) === group.key);
        return (
          <section key={group.key} className="mb-4 last:mb-0">
            <h3 className="t-micro mb-2 flex items-center justify-between text-ink-2">
              <span>{group.label}</span>
              <span className="tabular">
                {all.filter((a) => a.unlocked_at).length}/{all.length}
              </span>
            </h3>
            <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((a) => {
                const on = !!a.unlocked_at;
                const hidden = a.secret && !on;
                return (
                  <li key={a.code} className={`mc-card ${on ? '' : 'is-locked'}`} data-kind={a.tier}>
                    <span className="mc-card-icon">
                      <ItemIcon name={iconOf(a.code, hidden)} size={32} dim={!on} />
                    </span>
                    <span className="mc-card-text flex-1">
                      <span className="mc-card-head">{head(a, on)}</span>
                      <span className="mc-card-title">{a.title}</span>
                      <span className="mc-card-sub">
                        {a.description} {on ? `Earned ${relativeDay(Date.parse(a.unlocked_at!), now)}.` : hidden ? '' : `${xp(a.progress)} / ${xp(a.target)}`}
                      </span>
                      {!on && !hidden && a.target > 1 && (
                        <span className="mc-card-bar" aria-hidden="true">
                          <i style={{ width: `${Math.min(100, (100 * a.progress) / Math.max(1, a.target))}%` }} />
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
