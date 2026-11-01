import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { ApiError } from '@/api/client';
import { AuthProvider } from '@/auth/session';
import { AppShell } from '@/layouts/AppShell';
import { RequireAuth, RequireGuest } from '@/layouts/RequireAuth';
import { AppearanceProvider } from '@/lib/appearance';
import { Attendance } from '@/screens/Attendance';
import { AttendanceSession } from '@/screens/AttendanceSession';
import { ChoosePassword } from '@/screens/ChoosePassword';
import { Classes } from '@/screens/Classes';
import { Password } from '@/screens/Password';
import { Practice } from '@/screens/Practice';
import { PracticeHistory } from '@/screens/PracticeHistory';
import { PracticeResult } from '@/screens/PracticeResult';
import { PracticeReview } from '@/screens/PracticeReview';
import { PracticeRun } from '@/screens/PracticeRun';
import { PracticeTest } from '@/screens/PracticeTest';
import { Profile } from '@/screens/Profile';
import { SignIn } from '@/screens/SignIn';
import { Study } from '@/screens/Study';
import { GroupPractice, NewResults } from '@/screens/TeacherPractice';
import { GroupVocab } from '@/screens/TeacherWords';
import { Username } from '@/screens/Username';
import { Words } from '@/screens/Words';
import { WordsList } from '@/screens/WordsList';

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
                {/* A test fills the screen, outside the frame; leaving goes through its Home button. */}
                <Route path="/practice/run/:code" element={<PracticeRun />} />
                <Route path="/words/study" element={<Study />} />
                <Route element={<AppShell />}>
                  <Route path="/" element={<Classes />} />
                  <Route path="/attendance/group/:groupId" element={<Attendance />} />
                  <Route path="/attendance/:id" element={<AttendanceSession />} />
                  <Route path="/practice/new" element={<NewResults />} />
                  <Route path="/practice/group/:id" element={<GroupPractice />} />
                  <Route path="/words/group/:id" element={<GroupVocab />} />
                  <Route path="/practice" element={<Practice />} />
                  <Route path="/practice/test/:code" element={<PracticeTest />} />
                  <Route path="/practice/history/:code" element={<PracticeHistory />} />
                  <Route path="/practice/result/:id" element={<PracticeResult />} />
                  <Route path="/practice/review/:id/:slot" element={<PracticeReview />} />
                  <Route path="/words" element={<Words />} />
                  <Route path="/words/list/:slug" element={<WordsList />} />
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
