import {
  Bell,
  BookOpenCheck,
  Bookmark,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  ClipboardList,
  Dumbbell,
  FileStack,
  LayoutDashboard,
  Lock,
  LogOut,
  Moon,
  MoreHorizontal,
  Search,
  LibraryBig,
  SpellCheck,
  Sun,
  User,
  Users,
  X,
  type LucideIcon,
  Signpost,
} from 'lucide-react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import { isDue, useMyAssignments, useNotifications } from '@/api/assignments';
import { useMe } from '@/api/queries';
import { useAuth } from '@/auth/session';
import { Avatar } from '@/components/Avatar';
import { ShieldMark, Wordmark } from '@/components/brand/Logo';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageLoading } from '@/components/PageLoading';
import { CommandSearch } from '@/components/shell/CommandSearch';
import { LockedModal } from '@/components/shell/LockedModal';
import { PhoneLocked, ProvePanelContext, ProvePhonePanel, useProvePanel } from '@/components/shell/ProvePhone';
import { needsPhone } from '@/api/accounts';
import { NotificationsDrawer } from '@/components/shell/NotificationsDrawer';
import { useAppearance } from '@/lib/appearance';
import { useTrackPracticeVisits } from '@/lib/practice/summary';
import { APP_VERSION } from '@/lib/version';

// The signed-in frame (docs/design.md): on a laptop a floating sidebar panel
// (collapsible to an icon rail) beside the page; on a phone a top bar and a
// bottom tab bar, the rest of the pages in a "More" sheet.

/** The phone's tab that opens the Assessments sheet (not a page). */
const ASSESSMENTS_TAB = 'assessments';

type Item = { to: string; label: string; icon: LucideIcon; end?: boolean; enrolledOnly?: boolean; count?: number };

const ASSESSMENTS: Item[] = [
  { to: '/homework', label: 'Homework', icon: BookOpenCheck },
  { to: '/level-checks', label: 'Level Checks', icon: ClipboardCheck },
  { to: '/exams', label: 'Exams', icon: CalendarClock },
];
const ASSESSMENT_KIND: Record<string, 'homework' | 'level_check' | 'exam'> = { '/homework': 'homework', '/level-checks': 'level_check', '/exams': 'exam' };

const STUDENT: Item[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/classes', label: 'Classes', icon: CalendarDays, enrolledOnly: true },
  { to: '/roadmaps', label: 'Roadmaps', icon: Signpost },
  ...ASSESSMENTS,
  { to: '/practice', label: 'Mock tests', icon: ClipboardList },
  { to: '/training-hall', label: 'Training Hall', icon: Dumbbell },
  { to: '/problem-questions', label: 'Problem questions', icon: Bookmark },
  { to: '/words', label: 'Vocabulary', icon: SpellCheck },
  { to: '/library', label: 'Library', icon: LibraryBig },
];
// The phone's bottom bar: three of them, an Assessments sheet, and More.
const STUDENT_TABS = ['/', '/classes', '/roadmaps', ASSESSMENTS_TAB];

const TEACHER: Item[] = [
  { to: '/', label: 'Today', icon: CalendarCheck, end: true },
  { to: '/assignments', label: 'Assignments', icon: FileStack },
  { to: '/groups', label: 'Groups', icon: Users },
  { to: '/practice', label: 'Mock tests', icon: ClipboardList },
  { to: '/words', label: 'Vocabulary', icon: SpellCheck },
  { to: '/library', label: 'Library', icon: LibraryBig },
];
const TEACHER_TABS = ['/', '/assignments', '/groups', '/practice'];

const SHORT: Record<string, string> = { '/': 'Home', '/practice': 'Tests', '/words': 'Words', '/roadmaps': 'Roadmap', '/assignments': 'Assign' };

function useCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, set] = useState(() => {
    try {
      return localStorage.getItem('mb.sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });
  const save = (v: boolean) => {
    set(v);
    try {
      localStorage.setItem('mb.sidebar', v ? 'collapsed' : 'open');
    } catch {
      // Not kept.
    }
  };
  return [collapsed, save];
}

/** Whether the page is dark now (the saved choice, or the computer's). */
export function useIsDark(): boolean {
  const { mode } = useAppearance();
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mode === 'dark' || (mode === 'system' && systemDark);
}

function useThemeToggle() {
  const { setMode } = useAppearance();
  const dark = useIsDark();
  return { dark, toggle: () => setMode(dark ? 'light' : 'dark') };
}

export function AppShell() {
  const me = useMe().data;
  const teacher = me?.kind === 'teacher';
  // Signed up on the web, not (yet) a SATMAKON student: some pages are locked.
  const registered = me?.status === 'registered';
  // No phone number yet: everything but the dashboard and Profile is locked
  // until it's proven (the panel from the bottom).
  const phoneless = needsPhone(me);
  const isLocked = (item: Item) => (phoneless ? item.to !== '/' : registered && !!item.enrolledOnly);
  const [locked, setLocked] = useState<Item | null>(null);
  const prove = useProvePanel(phoneless);
  const onLocked = (item: Item) => (phoneless ? prove.open() : setLocked(item));
  useTrackPracticeVisits(teacher);
  // Counters: what is still due, per kind (students in a group).
  const assignments = useMyAssignments(!teacher && !phoneless && !!me && me.status !== 'registered');
  const due = (kind: string) => (assignments.data ?? []).filter((a) => a.kind === kind && isDue(a)).length;
  const notifications = useNotifications(!!me && !phoneless);
  const unread = notifications.data?.unread ?? 0;
  const items = teacher ? TEACHER : STUDENT.map((i) => (ASSESSMENT_KIND[i.to] ? { ...i, count: due(ASSESSMENT_KIND[i.to]!) } : i));
  const tabs = teacher ? TEACHER_TABS : STUDENT_TABS;
  const [collapsed, setCollapsed] = useCollapsed();
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  const [assessmentSheet, setAssessmentSheet] = useState(false);
  const [overlay, setOverlay] = useState<'search' | 'notifications' | null>(null);
  // Ctrl K (⌘K) opens the search from anywhere.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOverlay((o) => (o === 'search' ? null : 'search'));
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const pages = [...items, { to: '/profile', label: 'Profile', icon: User }];
  // A new page starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0); // newer browsers return a promise here: never hand it to React as a cleanup
  }, [pathname]);

  return (
    <div className="flex min-h-dvh">
      <Sidebar items={items} collapsed={collapsed} onCollapse={setCollapsed} onSearch={() => setOverlay('search')} onNotifications={() => setOverlay('notifications')} unread={unread} isLocked={isLocked} onLocked={onLocked} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onSearch={() => setOverlay('search')} onNotifications={() => setOverlay('notifications')} unread={unread} />
        <main className="w-full flex-1 px-4 pb-28 pt-4 md:px-7 md:pb-12 md:pt-6">
          {/* A page that crashes or is still loading keeps the frame around it. */}
          <ErrorBoundary>
            <Suspense fallback={<PageLoading />}>
              {phoneless && pathname !== '/' && !pathname.startsWith('/profile') ? <PhoneLocked onProve={prove.open} /> : <ProvePanelContext value={prove.open}><Outlet /></ProvePanelContext>}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <BottomBar
        items={items}
        tabs={tabs}
        onMore={() => setMore(true)}
        onAssessments={() => setAssessmentSheet(true)}
        assessmentsActive={ASSESSMENTS.some((a) => isActive(pathname, a))}
        assessmentsDue={teacher ? 0 : ASSESSMENTS.reduce((n, a) => n + due(ASSESSMENT_KIND[a.to]!), 0)}
        moreActive={!ASSESSMENTS.some((a) => isActive(pathname, a)) && !tabs.some((t) => t !== ASSESSMENTS_TAB && isActive(pathname, items.find((i) => i.to === t)!))}
        isLocked={isLocked}
        onLocked={onLocked}
      />
      {more && <MoreSheet items={items.filter((i) => !tabs.includes(i.to) && !(tabs.includes(ASSESSMENTS_TAB) && ASSESSMENT_KIND[i.to]))} isLocked={isLocked} onLocked={onLocked} onClose={() => setMore(false)} />}
      {assessmentSheet && <MoreSheet title="Assessments" profile={false} items={items.filter((i) => ASSESSMENT_KIND[i.to])} isLocked={isLocked} onLocked={onLocked} onClose={() => setAssessmentSheet(false)} />}
      {overlay === 'search' && <CommandSearch pages={pages} onClose={() => setOverlay(null)} />}
      {overlay === 'notifications' && <NotificationsDrawer onClose={() => setOverlay(null)} />}
      {prove.shown && <ProvePhonePanel onClose={prove.close} />}
      {locked && (
        <LockedModal
          title={`${locked.label} Locked`}
          message={`${locked.label} are for SATMAKON students. Enrol at SATMAKON and your classes, schedule and attendance appear here.`}
          onClose={() => setLocked(null)}
        />
      )}
    </div>
  );
}

const isActive = (pathname: string, item: Item) => (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`));

function Sidebar({ items, collapsed, onCollapse, onSearch, onNotifications, unread, isLocked, onLocked }: { items: Item[]; collapsed: boolean; onCollapse: (v: boolean) => void; onSearch: () => void; onNotifications: () => void; unread: number; isLocked: (item: Item) => boolean; onLocked: (item: Item) => void }) {
  const row = `flex h-[39px] w-full items-center gap-2.5 rounded-chip px-2.5 text-[15px] text-nav transition-colors duration-150 hover:bg-surface-2 hover:text-ink ${collapsed ? 'justify-center' : ''}`;
  return (
    <aside
      className={`sticky top-0 m-2 hidden h-[calc(100dvh-16px)] shrink-0 flex-col rounded-panel border border-line-soft bg-surface px-2.5 py-3.5 transition-[width] duration-300 md:flex ${collapsed ? 'w-[76px]' : 'w-[244px]'}`}
      aria-label="Sections">
      <div className={`mb-4 flex items-center ${collapsed ? 'flex-col gap-3' : 'justify-between pl-2'}`}>
        <NavLink to="/" aria-label="SATMAKON, home">
          <Wordmark compact={collapsed} />
        </NavLink>
        <button
          type="button"
          onClick={() => onCollapse(!collapsed)}
          aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
          className="flex size-8 items-center justify-center rounded-chip text-ink-2 hover:bg-surface-2 hover:text-ink">
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </div>
      <div className="mb-2 flex flex-col gap-0.5 border-b border-line pb-2">
        <button type="button" onClick={onSearch} title={collapsed ? 'Search' : undefined} className={row}>
          <Search size={18} strokeWidth={1.9} aria-hidden="true" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search</span>
              <kbd className="rounded-[6px] border border-line-strong px-1.5 text-[10px] font-semibold text-ink-2">Ctrl K</kbd>
            </>
          )}
        </button>
        <button type="button" onClick={onNotifications} title={collapsed ? 'Notifications' : undefined} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className={row}>
          <span className="relative">
            <Bell size={18} strokeWidth={1.9} aria-hidden="true" />
            {unread > 0 && collapsed && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary" aria-hidden="true" />}
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Notifications</span>
              {unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold leading-4 text-on-primary tabular">{unread}</span>}
            </>
          )}
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto no-scrollbar">
        {items.map((item) =>
          isLocked(item) ? (
            <button key={item.to} type="button" onClick={() => onLocked(item)} title={collapsed ? `${item.label} (locked)` : undefined} className={`${row} opacity-45`}>
              <item.icon size={18} strokeWidth={1.9} aria-hidden="true" />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate text-left">{item.label}</span>
                  <Lock size={14} className="text-primary" aria-label="Locked" />
                </>
              )}
            </button>
          ) : (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={collapsed ? item.label : undefined}
            className={({ isActive: on }) =>
              `flex h-[39px] items-center gap-2.5 rounded-chip px-2.5 text-[15px] transition-colors duration-150 ${collapsed ? 'justify-center' : ''} ${
                on ? 'bg-primary font-semibold text-on-primary' : 'text-nav hover:bg-surface-2 hover:text-ink'
              }`
            }>
            <span className="relative">
              <item.icon size={18} strokeWidth={1.9} aria-hidden="true" />
              {collapsed && !!item.count && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary ring-2 ring-surface" aria-hidden="true" />}
            </span>
            {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
            {!collapsed && !!item.count && <Counter n={item.count} />}
          </NavLink>
          ),
        )}
      </nav>
      <div className="border-t border-line pt-3">
        <UserMenu collapsed={collapsed} />
        {!collapsed && <p className="mt-1.5 text-center text-[12px] text-ink-3">Version: {APP_VERSION}</p>}
      </div>
    </aside>
  );
}

/** A sidebar row's count: purple, or white on the active row. */
function Counter({ n }: { n: number }) {
  return (
    <span className="text-[12px] font-semibold tabular text-primary [.bg-primary_&]:text-on-primary" aria-label={`${n} to do`}>
      {n}
    </span>
  );
}

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const me = useMe().data;
  const { signOut } = useAuth();
  const { dark, toggle } = useThemeToggle();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  if (!me) return null;
  const name = `${me.first_name} ${me.last_name}`;
  return (
    <div ref={box} className="relative">
      {open && (
        <div role="menu" className="pop absolute bottom-[calc(100%+8px)] left-0 z-30 w-56 rounded-card border border-line bg-surface p-1.5 shadow-[0_12px_32px_-8px_rgba(16,19,26,0.18)]">
          <NavLink to="/profile" role="menuitem" className="flex h-10 items-center gap-2.5 rounded-chip px-2.5 text-[14px] hover:bg-surface-2">
            <User size={17} aria-hidden="true" /> Profile
          </NavLink>
          <button type="button" role="menuitem" onClick={toggle} className="flex h-10 w-full items-center gap-2.5 rounded-chip px-2.5 text-left text-[14px] hover:bg-surface-2">
            {dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />} {dark ? 'Light mode' : 'Dark mode'}
          </button>
          <div className="my-1 border-t border-line" />
          <button type="button" role="menuitem" onClick={() => void signOut()} className="flex h-10 w-full items-center gap-2.5 rounded-chip px-2.5 text-left text-[14px] text-bad hover:bg-surface-2">
            <LogOut size={17} aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex w-full items-center gap-2.5 rounded-chip p-1.5 text-left hover:bg-surface-2 ${collapsed ? 'justify-center' : ''}`}>
        <Avatar kind={me.kind} firstName={me.first_name} lastName={me.last_name} id={me.id} size={32} photo={me.photo_url} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{name}</span>
            <ChevronUp size={16} className={`text-ink-2 transition-transform ${open ? '' : 'rotate-180'}`} aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
}

function TopBar({ onSearch, onNotifications, unread }: { onSearch: () => void; onNotifications: () => void; unread: number }) {
  const { dark, toggle } = useThemeToggle();
  const { signOut } = useAuth();
  return (
    <header className="sticky top-0 z-20 p-2 md:hidden">
      <div className="flex h-[58px] items-center justify-between rounded-card border border-line-soft bg-surface/95 px-3.5 backdrop-blur">
        <NavLink to="/" aria-label="SATMAKON, home">
          <Wordmark />
        </NavLink>
        <div className="flex items-center">
          <button type="button" onClick={onSearch} aria-label="Search" className="flex size-10 items-center justify-center rounded-chip text-ink-2 active:bg-surface-2">
            <Search size={20} />
          </button>
          <button type="button" onClick={onNotifications} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative flex size-10 items-center justify-center rounded-chip text-ink-2 active:bg-surface-2">
            <Bell size={20} />
            {unread > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-primary ring-2 ring-surface" aria-hidden="true" />}
          </button>
          <button type="button" onClick={toggle} aria-label={dark ? 'Light mode' : 'Dark mode'} className="flex size-10 items-center justify-center rounded-chip text-ink-2 active:bg-surface-2">
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button type="button" onClick={() => void signOut()} aria-label="Sign out" className="flex size-10 items-center justify-center rounded-chip text-ink-2 active:bg-surface-2">
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}

function BottomBar({ items, tabs, onMore, onAssessments, assessmentsActive, assessmentsDue, moreActive, isLocked, onLocked }: { items: Item[]; tabs: string[]; onMore: () => void; onAssessments: () => void; assessmentsActive: boolean; assessmentsDue: number; moreActive: boolean; isLocked: (item: Item) => boolean; onLocked: (item: Item) => void }) {
  const locked = isLocked(ASSESSMENTS[0]!);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(0,0,0,0.05)] md:hidden" aria-label="Sections">
      <ul className="flex h-[65px] items-center justify-around px-1">
        {tabs.map((to) => {
          if (to === ASSESSMENTS_TAB) {
            return (
              <li key={to}>
                <button type="button" onClick={() => (locked ? onLocked(ASSESSMENTS[0]!) : onAssessments())} className={`${tabClass(assessmentsActive)} relative ${locked ? 'opacity-45' : ''}`} aria-label={assessmentsDue ? `Assessments, ${assessmentsDue} to do` : 'Assessments'}>
                  <ClipboardCheck size={22} strokeWidth={1.9} aria-hidden="true" />
                  <span className="text-[11.5px] font-semibold">Assess</span>
                  {assessmentsDue > 0 && <span className="absolute right-3.5 top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-4 text-on-primary tabular">{assessmentsDue}</span>}
                </button>
              </li>
            );
          }
          const item = items.find((i) => i.to === to)!;
          if (isLocked(item)) {
            return (
              <li key={to}>
                <button type="button" onClick={() => onLocked(item)} className={`${tabClass(false)} opacity-45`} aria-label={`${item.label} (locked)`}>
                  <item.icon size={22} strokeWidth={1.9} aria-hidden="true" />
                  <span className="text-[11.5px] font-semibold">{SHORT[to] ?? item.label}</span>
                </button>
              </li>
            );
          }
          return (
            <li key={to}>
              <NavLink to={to} end={item.end} className={({ isActive: on }) => tabClass(on)}>
                <item.icon size={22} strokeWidth={1.9} aria-hidden="true" />
                <span className="text-[11.5px] font-semibold">{SHORT[to] ?? item.label}</span>
              </NavLink>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={onMore} className={tabClass(moreActive)}>
            <MoreHorizontal size={22} strokeWidth={1.9} aria-hidden="true" />
            <span className="text-[11.5px] font-semibold">More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

const tabClass = (on: boolean) =>
  `flex h-[52px] w-[72px] flex-col items-center justify-center gap-0.5 rounded-chip transition-colors ${on ? 'bg-primary/10 text-primary' : 'text-ink-2'}`;

function MoreSheet({ items, isLocked, onLocked, onClose, title = 'More', profile = true }: { items: Item[]; isLocked: (item: Item) => boolean; onLocked: (item: Item) => void; onClose: () => void; title?: string; profile?: boolean }) {
  const me = useMe().data;
  const { signOut } = useAuth();
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="fade fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="sheet-up absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-panel bg-surface px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2.5" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-strong" />
        <div className="mb-2 flex items-center justify-between">
          <p className="t-micro text-ink-2">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-chip text-ink-2 active:bg-surface-2">
            <X size={18} />
          </button>
        </div>
        <ul className="flex flex-col">
          {[...items, ...(profile ? [{ to: '/profile', label: 'Profile', icon: User }] : [])].map((item) => (
            <li key={item.to}>
              {isLocked(item) ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLocked(item);
                  }}
                  className="flex h-12 w-full items-center gap-3 rounded-chip px-2 text-left text-[15px] font-semibold text-ink opacity-45 active:bg-surface-2">
                  <span className="flex size-8 items-center justify-center rounded-[9px] bg-accent-tint text-primary">
                    <item.icon size={17} aria-hidden="true" />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <Lock size={14} className="text-primary" aria-label="Locked" />
                </button>
              ) : (
                <NavLink to={item.to} onClick={onClose} className="flex h-12 items-center gap-3 rounded-chip px-2 text-[15px] font-semibold text-ink active:bg-surface-2">
                  <span className="flex size-8 items-center justify-center rounded-[9px] bg-accent-tint text-primary">
                    <item.icon size={17} aria-hidden="true" />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {!!item.count && <span className="rounded-full bg-accent-tint px-2 text-[12px] font-bold text-accent tabular">{item.count}</span>}
                </NavLink>
              )}
            </li>
          ))}
          {profile && <li>
            <button type="button" onClick={() => void signOut()} className="flex h-12 w-full items-center gap-3 rounded-chip px-2 text-left text-[15px] font-semibold text-bad active:bg-surface-2">
              <span className="flex size-8 items-center justify-center rounded-[9px] bg-bad-tint">
                <LogOut size={17} aria-hidden="true" />
              </span>
              Sign out{me ? ` (${me.first_name})` : ''}
            </button>
          </li>}
        </ul>
      </div>
    </div>
  );
}

/** The shield in a tile, for page headers and empty states. */
export function BrandTile({ size = 36 }: { size?: number }) {
  return (
    <span className="flex items-center justify-center rounded-[10px] bg-accent-tint text-primary" style={{ width: size, height: size }}>
      <ShieldMark size={size * 0.6} />
    </span>
  );
}

/** A plain page title with actions beside it (pages without an icon header). */
export function ScreenTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.03em] text-title">{title}</h1>
      {children}
    </div>
  );
}
