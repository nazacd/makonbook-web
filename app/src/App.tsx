import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, type ComponentType } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { ApiError } from '@/api/client';
import { AuthProvider } from '@/auth/session';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageLoading } from '@/components/PageLoading';
import { AppShell } from '@/layouts/AppShell';
import { RequireAuth, RequireGuest } from '@/layouts/RequireAuth';
import { AppearanceProvider } from '@/lib/appearance';
import { Attendance } from '@/screens/Attendance';
import { ChoosePassword } from '@/screens/ChoosePassword';
import { Home, StudentClasses } from '@/screens/Classes';
import { Password } from '@/screens/Password';
import { Profile } from '@/screens/Profile';
import { SignIn } from '@/screens/SignIn';
import { Username } from '@/screens/Username';

// Sign-in, Classes and Profile come with the first load; the rest arrives
// when first opened (the test runner with MathJax and the calculator, Words
// with its scheduler, the teacher's screens with the QR code), so a phone
// downloads only what it uses.
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] })));
}
const Practice = page(() => import('@/screens/Practice'), 'Practice');
const PracticeTest = page(() => import('@/screens/PracticeTest'), 'PracticeTest');
const PracticeRun = page(() => import('@/screens/PracticeRun'), 'PracticeRun');
const PracticeResult = page(() => import('@/screens/PracticeResult'), 'PracticeResult');
const PracticeReview = page(() => import('@/screens/PracticeReview'), 'PracticeReview');
const PracticeHistory = page(() => import('@/screens/PracticeHistory'), 'PracticeHistory');
const Words = page(() => import('@/screens/Words'), 'Words');
const WordsList = page(() => import('@/screens/WordsList'), 'WordsList');
const Study = page(() => import('@/screens/Study'), 'Study');
const AttendanceSession = page(() => import('@/screens/AttendanceSession'), 'AttendanceSession');
const NewResults = page(() => import('@/screens/TeacherPractice'), 'NewResults');
const GroupPractice = page(() => import('@/screens/TeacherPractice'), 'GroupPractice');
const GroupVocab = page(() => import('@/screens/TeacherWords'), 'GroupVocab');
const TrainingHall = page(() => import('@/screens/TrainingHall'), 'TrainingHall');
const Drill = page(() => import('@/screens/Drill'), 'Drill');
const ProblemQuestions = page(() => import('@/screens/ProblemQuestions'), 'ProblemQuestions');
const SignUp = page(() => import('@/screens/SignUp'), 'SignUp');
const ResetPassword = page(() => import('@/screens/ResetPassword'), 'ResetPassword');
const GoogleCallback = page(() => import('@/screens/GoogleCallback'), 'GoogleCallback');
const TelegramCallback = page(() => import('@/screens/TelegramCallback'), 'TelegramCallback');

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
            <ErrorBoundary>
            <Suspense fallback={<PageLoading full />}>
            <Routes>
              {/* Signed in or not: a forgotten password, or a first one after signing up with Google. */}
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route element={<RequireGuest />}>
                <Route path="/sign-in" element={<SignIn />} />
                <Route path="/sign-up" element={<SignUp />} />
                <Route path="/auth/google" element={<GoogleCallback />} />
                <Route path="/auth/telegram" element={<TelegramCallback />} />
              </Route>
              <Route element={<RequireAuth />}>
                <Route path="/choose-password" element={<ChoosePassword />} />
                {/* A test fills the screen, outside the frame; leaving goes through its Home button. */}
                <Route path="/practice/run/:code" element={<PracticeRun />} />
                <Route path="/words/study" element={<Study />} />
                <Route path="/training-hall/drill" element={<Drill />} />
                <Route element={<AppShell />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/classes" element={<StudentClasses />} />
                  <Route path="/training-hall" element={<TrainingHall />} />
                  <Route path="/problem-questions" element={<ProblemQuestions />} />
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
            </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </AuthProvider>
      </AppearanceProvider>
    </QueryClientProvider>
  );
}
