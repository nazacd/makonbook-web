import { BookOpen, Download, Eye, LibraryBig, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { describeError } from '@/api/errors';
import { downloadBook, fileSize, SUBJECT_LABEL, useLibrary, type Book } from '@/api/library';
import { BookCover } from '@/components/library/BookCover';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { PageHeader, Segmented } from '@/components/ui';
import { useTitle } from '@/lib/title';

// "/library": SAT MAKON's own books. A shelf of covers: the ones you've begun
// first (Continue reading), then every book, filtered by subject or searched.
// Read opens the reader ("/library/:id"); anyone may download the PDF.

type Filter = 'all' | Book['subject'];

const STAGE: Record<Book['subject'], string> = {
  math: 'linear-gradient(160deg, color-mix(in srgb, var(--color-primary) 16%, var(--color-surface-2)), var(--color-surface-2))',
  english: 'linear-gradient(160deg, color-mix(in srgb, var(--color-green) 18%, var(--color-surface-2)), var(--color-surface-2))',
};

export function Library() {
  useTitle('Library');
  const library = useLibrary();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const books = library.data ?? [];
  const q = query.trim().toLowerCase();
  const shown = books.filter((b) => (filter === 'all' || b.subject === filter) && (!q || b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)));
  const reading = books.filter((b) => b.progress && b.progress.page < b.pages).sort((a, b) => b.progress!.updated_at.localeCompare(a.progress!.updated_at));
  const count = (s: Book['subject']) => books.filter((b) => b.subject === s).length;

  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <PageHeader
        icon={LibraryBig}
        title="Library"
        subtitle={library.data ? `${books.length} ${books.length === 1 ? 'book' : 'books'} from SATMAKON, free to read and keep` : undefined}
        actions={
          <>
            <label className="relative block w-full sm:w-64">
              <span className="sr-only">Search the library</span>
              <Search size={16} strokeWidth={2} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search books"
                className="h-[38px] w-full rounded-full border border-line bg-surface-2 pl-[38px] pr-4 text-[14px] font-medium text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-accent"
              />
            </label>
            <div className="max-w-full overflow-x-auto no-scrollbar">
              <Segmented
                label="Which books"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: 'All', count: library.data ? books.length : undefined },
                  { value: 'math', label: SUBJECT_LABEL.math, count: library.data ? count('math') : undefined },
                  { value: 'english', label: SUBJECT_LABEL.english, count: library.data ? count('english') : undefined },
                ]}
              />
            </div>
          </>
        }
      />

      {library.isError ? (
        <ErrorState title="Couldn’t open the library" message={describeError(library.error)} onRetry={() => void library.refetch()} retrying={library.isFetching} />
      ) : library.isPending ? (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} height={420} radius={20} />
          ))}
        </div>
      ) : (
        <>
          {reading.length > 0 && !q && filter === 'all' && (
            <section className="mb-6" aria-label="Continue reading">
              <h2 className="t-micro mb-2.5 text-ink-3">Continue reading</h2>
              <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                {reading.map((b) => (
                  <Link key={b.id} to={`/library/${b.id}`} className="lift flex w-[300px] shrink-0 items-center gap-3.5 rounded-card border border-line bg-surface p-3 hover:border-accent">
                    <BookCover book={b} width={54} flat />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[14px] font-bold leading-[18px] text-ink">{b.title}</span>
                      <span className="mt-1 block text-[12.5px] text-ink-2 tabular">
                        Page {b.progress!.page} of {b.pages}
                      </span>
                      <Bar value={b.progress!.page / b.pages} />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {shown.length === 0 ? (
            <EmptyState icon={LibraryBig} title={books.length ? 'No book matches' : 'The shelf is empty for now'} message={books.length ? 'Try another word, or show every subject.' : 'SATMAKON’s books will appear here.'} />
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shown.map((b, i) => (
                <BookCard key={b.id} book={b} index={i} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
      <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(3, Math.min(100, value * 100))}%` }} />
    </span>
  );
}

function BookCard({ book: b, index }: { book: Book; index: number }) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const started = b.progress != null;
  const finished = started && b.progress!.page >= b.pages;

  async function download() {
    setSaving(true);
    setFailed(false);
    try {
      await downloadBook(b);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="book-card rise flex flex-col overflow-hidden rounded-card border border-line bg-surface" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }} aria-label={b.title}>
      <Link to={`/library/${b.id}`} tabIndex={-1} aria-hidden="true" className="relative flex h-[232px] items-center justify-center" style={{ background: STAGE[b.subject] }}>
        <BookCover book={b} width={138} />
        {started && <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-bold ${finished ? 'bg-good-tint text-good' : 'bg-accent-tint text-accent'}`}>{finished ? 'Finished' : `Page ${b.progress!.page}`}</span>}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="t-micro text-accent">{SUBJECT_LABEL[b.subject]}</p>
        <h2 className="mt-1 line-clamp-2 text-[16px] font-bold leading-[21px] text-ink">{b.title}</h2>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-[18px] text-ink-2">{b.description}</p>
        <p className="mt-auto flex items-center gap-x-2.5 pt-3 text-[12px] font-medium text-ink-3 tabular">
          <span>{b.pages} pages</span>
          <span aria-hidden="true">·</span>
          <span>{fileSize(b.bytes)}</span>
          <span className="ml-auto flex items-center gap-1" title={`${b.views} ${b.views === 1 ? 'person has' : 'people have'} opened this book`}>
            <Eye size={13} aria-hidden="true" /> {b.views}
            <span className="sr-only">{b.views === 1 ? 'reader' : 'readers'}</span>
          </span>
        </p>
        {started && !finished && <Bar value={b.progress!.page / b.pages} />}
        <div className="mt-3 flex gap-2">
          <Link to={`/library/${b.id}`} className="lift flex h-10 flex-1 items-center justify-center gap-2 rounded-control bg-primary px-4 text-[14px] font-bold text-on-primary hover:bg-primary-hover">
            <BookOpen size={16} aria-hidden="true" /> {started && !finished ? 'Continue' : finished ? 'Read again' : 'Read'}
          </Link>
          <button type="button" onClick={() => void download()} disabled={saving} aria-label={`Download ${b.title} as a PDF`} title="Download the PDF" className="flex size-10 shrink-0 items-center justify-center rounded-control border border-line-strong bg-surface text-ink hover:bg-surface-2 disabled:opacity-60">
            <Download size={16} className={saving ? 'animate-pulse' : ''} aria-hidden="true" />
          </button>
        </div>
        {failed && <p className="t-footnote mt-2 text-bad">Couldn’t download it. Try again.</p>}
      </div>
    </article>
  );
}
