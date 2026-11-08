import { Search } from 'lucide-react';
import { useState } from 'react';

import { useTeacherQuestions, useTeacherTaxonomy } from '@/api/assignments';
import { describeError } from '@/api/errors';
import { Skeleton } from '@/components/States';
import { Modal } from '@/components/ui';
import { DIFFICULTY_COLOR, DIFFICULTY_LABEL } from '@/components/practice/results/format';

type Difficulty = 'easy' | 'medium' | 'hard';

// Picks one approved question from the bank: by skill, difficulty and text.
// Questions already in the set are left out.
export function QuestionPicker({ subject, skill: startSkill, difficulty: startDifficulty, exclude, title, onPick, onClose }: { subject: 'math' | 'english'; skill?: string; difficulty?: Difficulty | null; exclude: string[]; title: string; onPick: (id: string) => void; onClose: () => void }) {
  const [skill, setSkill] = useState(startSkill ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>(startDifficulty ?? '');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const taxonomy = useTeacherTaxonomy();
  const found = useTeacherQuestions({ subject, skill: skill || undefined, difficulty: difficulty || undefined, q: q || undefined });
  const skills = (taxonomy.data?.subjects[subject] ?? []).flatMap((d) => d.skills.map((s) => s.skill));
  const list = (found.data?.questions ?? []).filter((x) => !exclude.includes(x.id));
  return (
    <Modal title={title} subtitle="Approved questions from the bank" onClose={onClose} width={680}>
      <div className="mb-3 flex flex-wrap gap-2">
        <select value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Skill" className="h-10 min-w-0 flex-1 rounded-control border border-line bg-surface px-3 text-[14px] text-ink">
          <option value="">Any skill</option>
          {skills.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty | '')} aria-label="Difficulty" className="h-10 rounded-control border border-line bg-surface px-3 text-[14px] text-ink">
          <option value="">Any difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <form
          className="relative w-full"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(text.trim());
          }}>
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={text} onChange={(e) => setText(e.target.value)} onBlur={() => setQ(text.trim())} placeholder="Words in the question, then Enter" aria-label="Search the questions" className="h-10 w-full rounded-control border border-line bg-surface-2 pl-9 pr-3 text-[14px] text-ink outline-none focus:border-accent" />
        </form>
      </div>
      {found.isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={60} radius={12} />
          ))}
        </div>
      ) : found.isError ? (
        <p className="t-subhead text-bad">{describeError(found.error)}</p>
      ) : list.length === 0 ? (
        <p className="t-subhead py-8 text-center text-ink-2">No approved question matches. Try another skill or difficulty.</p>
      ) : (
        <>
          <p className="t-caption mb-2 text-ink-3">{found.data!.total} found{found.data!.total > list.length ? `, the first ${list.length} shown` : ''}</p>
          <ul className="flex flex-col gap-2">
            {list.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => onPick(x.id)} className="flex w-full flex-col gap-1 rounded-control border border-line bg-surface px-3.5 py-2.5 text-left hover:border-accent hover:bg-accent-tint/40">
                  <span className="flex flex-wrap gap-x-2 text-[12px] font-semibold">
                    <span className="text-ink-2">{x.skill}</span>
                    {x.difficulty && <span style={{ color: DIFFICULTY_COLOR[x.difficulty] }}>{DIFFICULTY_LABEL[x.difficulty]}</span>}
                    {x.type === 'grid_in' && <span className="text-ink-3">Grid-in</span>}
                  </span>
                  <span className="t-footnote line-clamp-2 text-ink">{x.preview}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
