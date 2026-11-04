import { useAuth } from '@/auth/session';
import { AuthCard } from '@/components/brand/AuthCard';
import { Button } from '@/components/Button';
import { PasswordForm } from '@/components/PasswordForm';
import { useTitle } from '@/lib/title';

// The only screen while the temporary password is in use. Saving clears
// must_change_password and RequireAuth moves on to the dashboard. Never a dead end:
// someone on the wrong account can sign out.
export function ChoosePassword() {
  useTitle('Choose a password');
  const { signOut } = useAuth();
  return (
    <AuthCard title="Choose a password" subtitle="Your first password was temporary. Pick one only you know." aside={<Button label="Not you? Sign out" variant="plain" onClick={() => void signOut()} />}>
      <PasswordForm forced />
    </AuthCard>
  );
}
