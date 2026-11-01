import { Navigate, Outlet, useLocation } from 'react-router';

import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import { useAuth } from '@/auth/session';
import { Button, Spinner } from '@/components/Button';
import { Notice } from '@/components/Notice';

// Signed-in screens only. Who can see what is decided here, like the route
// guards of the mobile app's layouts: signed out goes to /sign-in; while the
// temporary password is in use, /choose-password is the only screen; once it
// is changed, that screen sends people on to Classes.
export function RequireAuth() {
  const { status, signOut } = useAuth();
  const location = useLocation();
  const me = useMe(status === 'signedIn');

  if (status === 'signedOut') return <Navigate to="/sign-in" replace state={{ from: location }} />;

  // A cold start with a saved session: wait for the profile before showing
  // anything that depends on it. Once loaded it is kept, so a failed refetch
  // later (offline) doesn't take the screen away.
  if (!me.data) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-6">
        {me.isError ? (
          <>
            <Notice tone="error" title="Couldn't load your classes" message={describeError(me.error)} />
            <div className="flex w-full flex-col gap-2">
              <Button label="Try again" onClick={() => void me.refetch()} loading={me.isFetching} />
              <Button label="Sign out" variant="destructive" onClick={() => void signOut()} />
            </div>
          </>
        ) : (
          <Spinner className="size-7 text-accent" />
        )}
      </div>
    );
  }

  const mustChange = me.data.must_change_password;
  const choosing = location.pathname === '/choose-password';
  if (mustChange && !choosing) return <Navigate to="/choose-password" replace />;
  if (!mustChange && choosing) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Signed-out screens only: signed in, go to the app. */
export function RequireGuest() {
  const { status } = useAuth();
  const location = useLocation() as { state?: { from?: { pathname?: string } } };
  if (status === 'signedIn') return <Navigate to={location.state?.from?.pathname ?? '/'} replace />;
  return <Outlet />;
}
