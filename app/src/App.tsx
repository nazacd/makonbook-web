import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { ApiError } from '@/api/client';
import { AuthProvider } from '@/auth/session';
import { AppShell } from '@/layouts/AppShell';
import { RequireAuth, RequireGuest } from '@/layouts/RequireAuth';
import { AppearanceProvider } from '@/lib/appearance';
import { Attendance } from '@/screens/Attendance';
import { ChoosePassword } from '@/screens/ChoosePassword';
import { Classes } from '@/screens/Classes';
import { Password } from '@/screens/Password';
import { Profile } from '@/screens/Profile';
import { SignIn } from '@/screens/SignIn';
import { PracticeSoon, WordsSoon } from '@/screens/Soon';
import { Username } from '@/screens/Username';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retry once when the network or the server failed; an answer the API
      // meant (401, 403 password_change_required, 429…) is final.
      retry: (count, error) => count < 1 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
    },
    mutations: { retry: false },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppearanceProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<RequireGuest />}>
                <Route path="/sign-in" element={<SignIn />} />
              </Route>
              <Route element={<RequireAuth />}>
                <Route path="/choose-password" element={<ChoosePassword />} />
                <Route element={<AppShell />}>
                  <Route path="/" element={<Classes />} />
                  <Route path="/attendance/:groupId" element={<Attendance />} />
                  <Route path="/practice" element={<PracticeSoon />} />
                  <Route path="/words" element={<WordsSoon />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/profile/username" element={<Username />} />
                  <Route path="/profile/password" element={<Password />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </AppearanceProvider>
    </QueryClientProvider>
  );
}
