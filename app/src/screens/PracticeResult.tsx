import { ChevronLeft, CircleAlert, CloudCheck, CloudUpload, FileQuestion, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import { useQuestionStats } from '@/api/learning';
import { Icon } from '@/components/Icon';
import { formatWhen, SECTION_LABEL } from '@/components/practice/results/format';
import { resultModules, weakestSkills, type ResultRow } from '@/components/practice/results/model';
import { ReportModal } from '@/components/practice/results/ReportModal';
import { ModuleTable, TableSkeleton } from '@/components/practice/results/ResultTable';
import { ReviewModal } from '@/components/practice/results/ReviewModal';
import { Chip, Completion, NextStep, StatCards, StatCardsSkeleton } from '@/components/practice/results/Summary';
import { EmptyState, Skeleton } from '@/components/States';
import { useIsDark } from '@/layouts/AppShell';
import { useAppearance } from '@/lib/appearance';
import { useLocalAttempts, usePackage, useServerAttempts, useUploadAttempts } from '@/lib/practice/hooks';
import { useResolved } from '@/lib/practice/mistakes';
import { testName } from '@/lib/practice/run';
import type { Subject } from '@/lib/practice/types';
import { useTitle } from '@/lib/title';

type Filter = 'all' | Subject;

/** A test finished this long ago still opens on its completion screen. */
const FRESH_MS = 10 * 60_000;
const seenKey = (id: string) => `mb.practice.complete-seen.${id}`;

function wasSeen(id: string): boolean {
  try {
    return sessionStorage.getItem(seenKey(id)) === '1';
  } catch {
    return false;
  }
}

function markSeen(id: string) {
  try {
    sessionStorage.setItem(seenKey(id), '1');
  } catch {
    // Not kept: the completion screen may show once more.
  }
}

// An attempt's results, as the design reference's results page: the three
// counts, the next step, the scores, then a table per module with every
// question's answer, time and complexity, each opening its review in a modal
// (?q=<slot> in the URL; /practice/review/:id/:slot lands here too). A test
// just finished opens on its completion screen first.
export function PracticeResult() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const slot = params.get('q');
  const local = useLocalAttempts();
  useUploadAttempts(true);
  const attempt = local.data?.find((a) => a.id === id);
  const server = useServerAttempts(!attempt && !local.isPending);
  const fromServer = server.data?.find((a) => a.id === id);
  const shown = attempt ?? fromServer;
  const answersList = attempt?.answers ?? fromServer?.answers ?? [];
  const code = shown ? ('code' in shown ? shown.code : shown.test) : '';
  const pkg = usePackage(code, shown?.version, !!shown);
  const stats = useQuestionStats(code || undefined).data;
  const resolved = useResolved();
  const name = shown ? testName(shown.title) : '';
  useTitle(shown ? `Results - ${name}` : 'Results');

  const [filter, setFilter] = useState<Filter>('all');
  const [hidden, setHidden] = useState(false);
  const [reporting, setReporting] = useState<ResultRow | null>(null);
  const [later, setLater] = useState(false);
  const [openedAt] = useState(() => Date.now());
  // A review opened straight from a link skips the completion screen.
  const [details, setDetails] = useState(() => wasSeen(id) || params.has('q'));

  // Closing a review puts the keyboard back on that question's row.
  const lastSlot = useRef<string | null>(null);
  useEffect(() => {
    if (slot) {
      lastSlot.current = slot;
      return;
    }
    const was = lastSlot.current;
    lastSlot.current = null;
    if (!was) return;
    const el = [document.getElementById(`review-${was}`), document.getElementById(`review-m-${was}`)].find((e) => e && e.offsetParent !== null);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest' });
  }, [slot]);

  const fresh = !!attempt && openedAt - Date.parse(attempt.finished_at) < FRESH_MS;
  const completing = !details && !slot && (params.has('done') || fresh);
  // Shown once: coming back to this result later opens the details.
  useEffect(() => {
    if (completing) markSeen(id);
  }, [completing, id]);

  if (local.isPending || (!attempt && server.isPending)) return <ResultsSkeleton />;
  if (!shown) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <EmptyState icon={FileQuestion} title="No such result" message="This result isn’t here. It may be on your phone." />
        <p className="text-center">
          <Link to="/practice" className="t-subhead font-semibold text-accent">
            Back to mock tests
          </Link>
        </p>
      </div>
    );
  }

  const sections = shown.sections as Subject[];
  const modules = pkg.data ? resultModules(pkg.data.package, sections, answersList) : null;
  const rows = modules?.flatMap((m) => m.rows) ?? [];
  const scoreList = sections.map((s) => shown.scores[s]).filter((s) => s != null);
  const total = modules ? rows.length : scoreList.reduce((n, s) => n + s.questions, 0);
  const correct = modules ? rows.filter((r) => r.outcome === 'correct').length : scoreList.reduce((n, s) => n + s.raw, 0);
  const repairRows = rows.filter((r) => r.outcome !== 'correct' && !(resolved[r.q.id] && resolved[r.q.id]! >= shown.finished_at));
  const skills = weakestSkills(repairRows);

  if (completing) {
    const toDetails = () => {
      setDetails(true);
      if (params.has('done')) void navigate({ search: '' }, { replace: true });
    };
    return (
      <Completion
        name={name}
        total={total}
        correct={correct}
        repair={modules ? repairRows.length : 0}
        skills={skills}
        showNext={!later}
        onLater={() => setLater(true)}
        onDetails={toDetails}
      />
    );
  }

  const shownModules = (modules ?? []).filter((m) => filter === 'all' || m.subject === filter);
  const visible = shownModules.flatMap((m) => m.rows);
  const items = slot && !visible.some((r) => r.slot === slot) ? rows : visible;
  const at = slot ? items.findIndex((r) => r.slot === slot) : -1;

  const openReview = (s: string) => void navigate({ search: `?q=${encodeURIComponent(s)}` }, { state: { review: true } });
  const go = (i: number) => void navigate({ search: `?q=${encodeURIComponent(items[i]!.slot)}` }, { replace: true, state: location.state });
  const close = () => ((location.state as { review?: boolean } | null)?.review ? void navigate(-1) : void navigate({ search: '' }, { replace: true }));

  const sent: { icon: LucideIcon; tone: string; text: string } | null = !attempt
    ? null
    : attempt.rejected
      ? { icon: CircleAlert, tone: 'text-bad', text: `Not sent to your teachers: ${attempt.rejected}` }
      : attempt.uploaded
        ? { icon: CloudCheck, tone: 'text-good', text: 'Sent to your teachers' }
        : { icon: CloudUpload, tone: 'text-ink-3', text: 'Sends to your teachers when you’re online' };

  return (
    <div className="mx-auto flex w-full max-w-[1260px] flex-col gap-5">
      <Header name={name} code={code} what={shown.total != null ? 'Full test' : SECTION_LABEL[sections[0]!]} when={formatWhen(shown.finished_at)} sent={sent} />

      <StatCards total={total} correct={correct} />

      {modules && repairRows.length > 0 && !later && <NextStep repair={repairRows.length} skills={skills} onLater={() => setLater(true)} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" aria-label="Scores">
          {sections.map((s) => (
            <Chip key={s} label={`${SECTION_LABEL[s]}: ${shown.scores[s]?.score ?? 'unknown'} of 800`}>
              <span className="font-medium text-ink-2">{SECTION_LABEL[s]}</span> {shown.scores[s]?.score ?? '–'} / 800
            </Chip>
          ))}
          {shown.total != null && (
            <Chip label={`Total: ${shown.total} of 1600`}>
              <span className="font-medium text-ink-2">Total</span> <span className="text-primary">{shown.total}</span> / 1600
            </Chip>
          )}
        </div>
        <SubjectFilter value={filter} onChange={setFilter} has={sections} />
      </div>

      {modules ? (
        shownModules.map((m) => <ModuleTable key={`${m.subject}-${m.module}`} mod={m} score={shown.scores[m.subject]?.score} stats={stats} onReview={openReview} onReport={setReporting} />)
      ) : pkg.isPending ? (
        <>
          <TableSkeleton />
          <TableSkeleton />
        </>
      ) : (
        <p className="t-subhead rounded-card border border-line bg-surface p-5 text-ink-2">The questions couldn’t be loaded right now. Check the connection and open this page again.</p>
      )}

      <p className="t-caption font-normal text-ink-3">Scores are an estimate from College Board’s practice tests; the real SAT adapts to you.</p>

      {pkg.data && at >= 0 && (
        <ReviewModal title={name} items={items} index={at} stored={pkg.data} stats={stats} hidden={hidden} onHidden={setHidden} onGo={go} onClose={close} />
      )}
      {reporting && <ReportModal row={reporting} code={code} version={shown.version} testTitle={name} onClose={() => setReporting(null)} />}
    </div>
  );
}

function Header({ name, code, what, when, sent }: { name: string; code: string; what: string; when: string; sent: { icon: LucideIcon; tone: string; text: string } | null }) {
  const { setMode } = useAppearance();
  const dark = useIsDark();
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-start gap-1.5">
        <Link to="/practice" aria-label="Back to mock tests" className="group -ml-2 flex size-9 shrink-0 items-center justify-center rounded-chip text-primary hover:bg-surface-2">
          <ChevronLeft size={24} strokeWidth={2.4} className="transition-transform duration-200 group-hover:-translate-x-[3px]" aria-hidden="true" />
        </Link>
        <div className="min-w-0 pt-0.5">
          <h1 className="text-[22px] font-medium leading-8 text-title">Results - {name}</h1>
          <p className="t-footnote flex flex-wrap items-center gap-x-2 text-ink-3">
            <span>
              {what} · {when}
            </span>
            {sent && (
              <span className="flex items-center gap-1">
                <Icon as={sent.icon} size={14} className={sent.tone} />
                {sent.text}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link to={`/practice/test/${encodeURIComponent(code)}`} className="lift inline-flex h-9 items-center rounded-[8px] bg-primary px-5 text-[14px] font-semibold text-on-primary hover:bg-primary-hover">
          Retake
        </Link>
        <button type="button" onClick={() => setMode(dark ? 'light' : 'dark')} aria-label={dark ? 'Light mode' : 'Dark mode'} className="flex size-9 items-center justify-center rounded-chip text-ink-2 hover:bg-surface-2 hover:text-ink">
          {dark ? <Sun size={19} strokeWidth={1.9} aria-hidden="true" /> : <Moon size={19} strokeWidth={1.9} aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}

/** All / Math / R&W: the reference's filter, the chosen one filled; a section not taken is greyed out. */
function SubjectFilter({ value, onChange, has }: { value: Filter; onChange: (f: Filter) => void; has: Subject[] }) {
  const options: { value: Filter; label: string; off: boolean }[] = [
    { value: 'all', label: 'All', off: false },
    { value: 'math', label: 'Math', off: !has.includes('math') },
    { value: 'english', label: 'R&W', off: !has.includes('english') },
  ];
  return (
    <div role="radiogroup" aria-label="Show questions from" className="ml-auto inline-flex h-[38px] overflow-hidden rounded-[12px] border border-line bg-surface">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.off}
            onClick={() => onChange(o.value)}
            className={`min-w-[88px] px-4 text-[15px] transition-colors duration-150 disabled:cursor-default disabled:text-ink-3/50 ${on ? 'bg-primary font-semibold text-on-primary' : 'text-ink-2 hover:bg-surface-2 disabled:hover:bg-transparent'}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** The page's shapes while it loads: the header, the three cards, the chips and two tables. */
function ResultsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1260px] flex-col gap-5" aria-busy="true" aria-label="Loading the results">
      <Skeleton height={56} radius={16} />
      <StatCardsSkeleton />
      <div className="flex justify-end">
        <Skeleton width={270} height={38} radius={12} />
      </div>
      <TableSkeleton />
      <TableSkeleton />
    </div>
  );
}
