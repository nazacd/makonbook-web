import { useAuth } from '@/auth/session';
import { Button } from '@/components/Button';
import { PasswordForm } from '@/components/PasswordForm';
import { useTitle } from '@/lib/title';

// The only screen while the temporary password is in use. Saving clears
// must_change_password and RequireAuth moves on to Classes. Never a dead end:
// someone on the wrong account can sign out.
export function ChoosePassword() {
  useTitle('Choose a password');
  const { signOut } = useAuth();
  return (
    <div className="mx-auto w-full max-w-md px-5 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="t-title text-ink">Choose a password</h1>
        <Button label="Sign out" variant="plain" onClick={() => void signOut()} />
      </div>
      <PasswordForm forced />
    </div>
  );
}
