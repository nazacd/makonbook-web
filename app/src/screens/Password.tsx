import { useNavigate } from 'react-router';

import { PasswordForm } from '@/components/PasswordForm';
import { ScreenTitle } from '@/layouts/AppShell';
import { useTitle } from '@/lib/title';

import { BackLink } from './Username';

// From Profile. Back to it once saved.
export function Password() {
  useTitle('Change password');
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-md">
      <BackLink />
      <ScreenTitle title="Change password" />
      <PasswordForm forced={false} onDone={() => void navigate('/profile')} />
    </div>
  );
}
