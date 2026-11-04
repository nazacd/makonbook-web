import { AtSign, KeyRound, LogOut, Monitor, Moon, Pencil, Sun, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { formatUzPhone } from '@/api/accounts';
import { useGoals } from '@/api/learning';
import { useMe, useParentCode } from '@/api/queries';
import type { Profile as ProfileType } from '@/api/types';
import { useAuth } from '@/auth/session';
import { EditProfile } from '@/components/accounts/EditProfile';
import { Avatar } from '@/components/Avatar';
import { ShieldMark } from '@/components/brand/Logo';
import { GoalsModal } from '@/components/dashboard/GoalsModal';
import { Icon } from '@/components/Icon';
import { Pill } from '@/components/ui';
import { ScreenTitle } from '@/layouts/AppShell';
import { useAppearance, type AppearanceMode } from '@/lib/appearance';
import { useNow } from '@/lib/clock';
import { normalCase, parseClassName } from '@/lib/groups';
import { formatDate, schoolDate } from '@/lib/schedule';
import { useTitle } from '@/lib/title';

const MODES: { value: AppearanceMode; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

// Who you are (name, username, parent code), your SAT goal, your groups, and
// settings: password, appearance, sign out.
export function Profile() {
  useTitle('Profile');
  const profile = useMe().data as ProfileType; // RequireAuth only renders with a profile
  const { signOut } = useAuth();
  const appearance = useAppearance();
  const student = profile.kind === 'student';
  const parentCode = useParentCode(student);
  const goals = useGoals(student);
  const now = useNow();
  const [editGoals, setEditGoals] = useState(false);
  const [editing, setEditing] = useState(false);
  const name = normalCase(`${profile.first_name} ${profile.last_name}`);
  const g = goals.data;
  const days = g?.exam_date ? Math.round((Date.parse(`${g.exam_date}T00:00:00Z`) - Date.parse(`${schoolDate(now)}T00:00:00Z`)) / 86_400_000) : null;

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <ScreenTitle title="Profile" />
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="relative overflow-hidden rounded-card border border-line bg-surface p-5" style={{ background: 'radial-gradient(60% 80% at 0% 0%, var(--color-accent-tint), transparent 60%), var(--color-surface)' }}>
          <div className="flex flex-wrap items-center gap-5">
            <Avatar kind={profile.kind} firstName={profile.first_name} lastName={profile.last_name} id={profile.id} size={112} square />
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-ink">{name}</h1>
              <p className="t-subhead flex flex-wrap items-center gap-2 text-ink-2">
                {student ? 'Student' : 'Teacher'}
                {profile.status === 'registered' ? <Pill tone="neutral">Free account</Pill> : <Pill tone="primary">SATMAKON {student ? 'student' : 'teacher'}</Pill>}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setEditing(true)} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[13px] font-bold text-on-primary hover:bg-primary-hover">
                  <Pencil size={14} aria-hidden="true" /> Edit profile
                </button>
                <Link to={profile.has_password === false ? '/reset-password' : '/profile/password'} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] font-bold text-ink hover:bg-surface-2">
                  <KeyRound size={14} aria-hidden="true" /> {profile.has_password === false ? 'Set password' : 'Change password'}
                </Link>
                <Link to="/profile/username" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-[13px] font-bold text-ink hover:bg-surface-2">
                  <AtSign size={14} aria-hidden="true" /> {profile.username ? 'Change username' : 'Set a username'}
                </Link>
              </div>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="t-micro text-ink-3">Phone</dt>
              <dd className="t-callout mt-1 text-ink">{profile.phone ? `+998 ${formatUzPhone(profile.phone)}` : 'Not provided'}</dd>
            </div>
            <div>
              <dt className="t-micro text-ink-3">Username</dt>
              <dd className="t-callout mt-1 text-ink">{profile.username ? `@${profile.username}` : 'Not set — you sign in with your phone number'}</dd>
            </div>
            {student && (
              <div>
                <dt className="t-micro text-ink-3">Parent code</dt>
                <dd className="mt-1">
                  <ParentCode code={parentCode.data?.code ?? null} failed={parentCode.isError} />
                </dd>
              </div>
            )}
          </dl>
        </section>

        {student ? (
          <section className="rounded-card border border-line bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="t-micro text-ink-2">Goals</p>
              <button type="button" onClick={() => setEditGoals(true)} className="t-footnote font-bold text-accent hover:underline">
                Edit
              </button>
            </div>
            <div className="rounded-control bg-surface-2 p-3.5">
              <p className="t-micro text-ink-3">Target score</p>
              <p className="t-number mt-1 text-[28px] leading-8 text-ink">{g?.target_total ?? '—'}</p>
              {g?.target_math != null && g.target_rw != null && <p className="t-footnote text-ink-2">Math {g.target_math} · English {g.target_rw}</p>}
            </div>
            <div className="mt-2.5 rounded-control bg-surface-2 p-3.5">
              <p className="t-micro text-ink-3">Exam day</p>
              <p className="t-headline mt-1 flex flex-wrap items-center gap-2 text-ink">
                {g?.exam_date ? formatDate(g.exam_date) : 'Not set'}
                {days != null && days >= 0 && <Pill tone="primary">{days === 0 ? 'today' : `${days} ${days === 1 ? 'day' : 'days'} left`}</Pill>}
              </p>
            </div>
            <Link to="/" className="t-footnote mt-3 inline-block text-ink-2 underline underline-offset-2 hover:text-ink">
              Manage goals on dashboard
            </Link>
          </section>
        ) : (
          <div />
        )}

        <section className="relative overflow-hidden rounded-card bg-[#1a3b73] p-5 text-white">
          <ShieldMark size={140} className="absolute -bottom-6 -right-4 text-white/10" />
          <p className="t-micro flex items-center gap-2 text-white/80">
            Groups <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">{profile.groups.length}</span>
          </p>
          {profile.groups.length === 0 ? (
            <p className="mt-3 text-[15px] text-white/85">{student ? 'You’re not in a SATMAKON group yet.' : 'No groups on your schedule yet.'}</p>
          ) : (
            <ul className="relative mt-3 flex flex-col gap-1.5">
              {profile.groups.map((gr) => (
                <li key={gr.id} className="text-[15px] font-semibold">
                  {parseClassName(gr.name, gr.discipline).title}
                  <span className="ml-2 text-[12px] font-medium text-white/70">{normalCase(gr.office)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-card border border-line bg-surface p-5">
          <p className="t-micro mb-3 text-ink-2">Appearance</p>
          <div role="radiogroup" aria-label="Appearance" className="flex rounded-full border border-line bg-surface-2 p-[3px]">
            {MODES.map((m) => {
              const on = appearance.mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => appearance.setMode(m.value)}
                  className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold ${on ? 'bg-accent-tint text-accent' : 'text-ink-2 hover:text-ink'}`}>
                  <Icon as={m.icon} size={15} className="text-current" />
                  {m.label}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => void signOut()} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-control border border-line text-[14px] font-bold text-bad hover:bg-bad-tint">
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </section>
      </div>
      {editGoals && <GoalsModal goals={g} onClose={() => setEditGoals(false)} />}
      {editing && <EditProfile profile={profile} onClose={() => setEditing(false)} />}
    </div>
  );
}

// The five digits, for parents to enter in the MakonBook app's "Ota-onalar uchun".
function ParentCode({ code, failed }: { code: string | null; failed: boolean }) {
  return (
    <div>
      <p
        className={`t-number select-all text-[26px] leading-8 ${code ? 'text-ink' : 'text-ink-3'}`}
        style={{ letterSpacing: 6 }}
        aria-label={code ? `Parent code ${code.split('').join(' ')}` : undefined}>
        {code ?? (failed ? '—' : '·····')}
      </p>
      <p className="t-caption mt-0.5 text-ink-3">Parents enter it in the MakonBook app, under “Ota-onalar uchun”.</p>
    </div>
  );
}
