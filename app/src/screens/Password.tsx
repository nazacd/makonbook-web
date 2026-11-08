import { useNavigate } from 'react-router';

import { useMe } from '@/api/queries';
import { PasswordForm } from '@/components/PasswordForm';
import { ScreenTitle } from '@/layouts/AppShell';
import { useTitle } from '@/lib/title';

import { BackLink } from './Username';

// From Profile. Back to it once saved.
export function Password() {
  const me = useMe().data;
  const title = me && !me.has_password && !me.must_change_password ? 'Set a password' : 'Change password';
  useTitle(title);
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-md">
      <BackLink />
      <ScreenTitle title={title} />
      <PasswordForm forced={false} onDone={() => void navigate('/profile')} />
    </div>
  );
}
