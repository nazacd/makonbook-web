import { AtSign, KeyRound, LogOut, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';

import { useMe, useParentCode } from '@/api/queries';
import type { Profile as ProfileType } from '@/api/types';
import { useAuth } from '@/auth/session';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { PageRow } from '@/components/PageRow';
import { useAppearance, type AppearanceMode } from '@/lib/appearance';
import { normalCase } from '@/lib/groups';
import { useTitle } from '@/lib/title';

const MODES: { value: AppearanceMode; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

// Avatar-led: who you are, the parent code (students), then a few rows.
export function Profile() {
  useTitle('Profile');
  const profile = useMe().data as ProfileType; // RequireAuth only renders with a profile
  const { signOut } = useAuth();
  const appearance = useAppearance();
  const parentCode = useParentCode(profile.kind === 'student');
  const name = normalCase(`${profile.first_name} ${profile.last_name}`);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 pt-4">
      <div className="flex flex-col items-center gap-2.5">
        <Avatar kind={profile.kind} firstName={profile.first_name} lastName={profile.last_name} id={profile.id} size={104} />
        <h1 className="t-title text-center text-ink">{name}</h1>
        {profile.username && <p className="t-subhead -mt-1 text-ink-2">@{profile.username}</p>}
      </div>

      {profile.kind === 'student' && <ParentCode code={parentCode.data?.code ?? null} failed={parentCode.isError} />}

      <div>
        <PageRow icon={AtSign} label="Username" value={profile.username ? `@${profile.username}` : 'Not set'} to="/profile/username" />
        <PageRow icon={KeyRound} label="Change password" separator to="/profile/password" />
      </div>

      <div role="radiogroup" aria-label="Appearance" className="flex rounded-control bg-surface-2 p-1">
        {MODES.map((m) => {
          const on = appearance.mode === m.value;
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => appearance.setMode(m.value)}
              className={`t-subhead flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[11px] ${on ? 'bg-surface font-medium text-ink shadow-sm' : 'text-ink-2'}`}>
              <Icon as={m.icon} size={16} className="text-current" />
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <PageRow icon={LogOut} label="Sign out" destructive onClick={() => void signOut()} />
      </div>
    </div>
  );
}

// Centred under the name: the label and the five digits large, for parents
// to enter in the app's "Ota-onalar uchun".
function ParentCode({ code, failed }: { code: string | null; failed: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <p className="t-subhead font-medium text-ink-2">Parent code</p>
      <p
        className={`font-title tabular select-all text-[40px] font-bold leading-[48px] ${code ? 'text-ink' : 'text-ink-3'}`}
        style={{ letterSpacing: 9, paddingLeft: 9 }}
        aria-label={code ? `Parent code ${code.split('').join(' ')}` : undefined}>
        {code ?? (failed ? '—' : '·····')}
      </p>
      <p className="t-footnote mt-1 text-center text-ink-3">Parents enter it in the MakonBook app, under “Ota-onalar uchun”.</p>
    </div>
  );
}
