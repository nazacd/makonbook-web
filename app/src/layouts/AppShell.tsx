import { BookOpen, Calendar, Layers, User, type LucideIcon } from 'lucide-react';
import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageLoading } from '@/components/PageLoading';

import { Icon } from '@/components/Icon';

// The signed-in frame: the brand and the four tabs across the top on a
// laptop, a tab bar along the bottom on a phone (the phone's tabs: calendar,
// book-open, layers, user). Screens render inside, on one measure.
const TABS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Classes', icon: Calendar, end: true },
  { to: '/practice', label: 'Practice', icon: Layers },
  { to: '/words', label: 'Words', icon: BookOpen },
  { to: '/profile', label: 'Profile', icon: User },
];

export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-brand/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-5">
          <NavLink to="/" className="flex items-center gap-2" aria-label="MakonBook, Classes">
            <img src="/logo.png" alt="" width={28} height={28} />
            <span className="font-title text-[19px] font-bold text-ink">MakonBook</span>
          </NavLink>
          <nav className="hidden sm:block" aria-label="Sections">
            <ul className="flex gap-1">
              {TABS.map((tab) => (
                <li key={tab.to}>
                  <NavLink
                    to={tab.to}
                    end={tab.end}
                    className={({ isActive }) =>
                      `t-subhead flex h-10 items-center rounded-chip px-3 ${isActive ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2 active:bg-surface-2'}`
                    }>
                    {tab.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-28 pt-6 sm:pb-16">
        {/* A page that crashes or is still loading keeps the tabs around it. */}
        <ErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-brand/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden" aria-label="Sections">
        <ul className="flex">
          {TABS.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) => `flex h-14 flex-col items-center justify-center gap-0.5 ${isActive ? 'text-ink' : 'text-ink-3'}`}>
                {({ isActive }) => (
                  <>
                    <Icon as={tab.icon} size={22} className="text-current" strokeWidth={isActive ? 2 : 1.75} />
                    <span className="t-caption">{tab.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** A screen's heading, with an optional way back. */
export function ScreenTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h1 className="t-title text-ink">{title}</h1>
      {children}
    </div>
  );
}
