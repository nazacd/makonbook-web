import { useQueryClient } from '@tanstack/react-query';
import { createContext, Fragment, use, useEffect, useState, type ReactNode } from 'react';

import { adoptToken, api, call, getToken, setSignedOutHandler, setToken, TOKEN_KEY } from '@/api/client';
import { meKey } from '@/api/queries';
import { deviceId } from '@/lib/device-id';

export type AuthStatus = 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  /** Someone signed out in this tab (or another tab changed who is signed in): the next person starts at Classes, not on the last page. */
  leftOnPurpose: boolean;
  signIn: (login: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Who is signed in, as far as this browser knows: a token in localStorage
// (docs/handoff.md section 6). Everything about the person comes from /v1/me
// (useMe), seeded by the login answer. Any 401 on a signed-in request ends
// the session here (api/client.ts calls back).
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>(() => (getToken() ? 'signedIn' : 'signedOut'));
  const [leftOnPurpose, setLeftOnPurpose] = useState(false);
  // Changes when another tab signs in or out: everything below starts over,
  // so nothing keeps showing (or saving for) the person who was here.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    setSignedOutHandler(() => {
      queryClient.clear();
      setStatus('signedOut');
    });
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TOKEN_KEY && e.key !== null) return; // null: all of storage was cleared
      const next = e.key === null ? null : e.newValue;
      if (next === getToken()) return;
      adoptToken(next);
      void queryClient.cancelQueries();
      queryClient.clear();
      setStatus(next ? 'signedIn' : 'signedOut');
      setLeftOnPurpose(true);
      setGeneration((g) => g + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      setSignedOutHandler(null);
      window.removeEventListener('storage', onStorage);
    };
  }, [queryClient]);

  async function signIn(login: string, password: string) {
    const response = await call(
      api.POST('/v1/auth/login', { body: { login: login.trim(), password, device_id: deviceId() } }),
    );
    setToken(response.token);
    queryClient.setQueryData(meKey, response.user);
    setStatus('signedIn');
    setLeftOnPurpose(false);
  }

  async function signOut() {
    // Tell the server, but don't make the person wait on it or fail because
    // of it: the token is forgotten here either way. The header is set here,
    // because the request goes out after the token is gone from storage.
    const token = getToken();
    if (token) api.POST('/v1/auth/logout', { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    setToken(null);
    void queryClient.cancelQueries();
    queryClient.clear();
    setStatus('signedOut');
    setLeftOnPurpose(true);
  }

  return (
    <AuthContext value={{ status, leftOnPurpose, signIn, signOut }}>
      <Fragment key={generation}>{children}</Fragment>
    </AuthContext>
  );
}

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
