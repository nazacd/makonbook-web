import { useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { api, call, getToken, setSignedOutHandler, setToken } from '@/api/client';
import { meKey } from '@/api/queries';
import { deviceId } from '@/lib/device-id';

export type AuthStatus = 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
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

  useEffect(() => {
    setSignedOutHandler(() => {
      queryClient.clear();
      setStatus('signedOut');
    });
    return () => setSignedOutHandler(null);
  }, [queryClient]);

  async function signIn(login: string, password: string) {
    const response = await call(
      api.POST('/v1/auth/login', { body: { login: login.trim(), password, device_id: deviceId() } }),
    );
    setToken(response.token);
    queryClient.setQueryData(meKey, response.user);
    setStatus('signedIn');
  }

  async function signOut() {
    // Tell the server, but don't make the person wait on it or fail because
    // of it: the token is forgotten here either way. The header is set here,
    // because the request goes out after the token is gone from storage.
    const token = getToken();
    if (token) api.POST('/v1/auth/logout', { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    setToken(null);
    queryClient.clear();
    setStatus('signedOut');
  }

  return <AuthContext value={{ status, signIn, signOut }}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
