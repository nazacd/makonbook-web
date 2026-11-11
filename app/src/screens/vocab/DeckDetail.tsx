import { ChevronLeft, EyeOff, Flag, Globe2, Lock, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ApiError } from '@/api/client';
import { describeError } from '@/api/errors';
import { useMe } from '@/api/queries';
import { useDeckAction, useDeckDetail, useReportDeck } from '@/api/vocabSocial';
import { Notice } from '@/components/Notice';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { Action, Modal } from '@/components/ui';
import { SpeakButton } from '@/components/vocab/Game';
import { confirm } from '@/lib/confirm';
import { useTitle } from '@/lib/title';

import { deckHue } from './Decks';

// One deck: its words, and what the viewer can do with it. The owner edits,
// shares or stops sharing, deletes; another student adds it or reports it;
// a teacher keeps a reported deck up or hides it with a reason.
export function DeckDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const teacher = useMe().data?.kind === 'teacher';
  const query = useDeckDetail(id);
  const action = useDeckAction();
  const [dialog, setDialog] = useState<'report' | 'hide' | null>(null);
  const deck = query.data?.deck;
  useTitle(deck?.title ?? 'Deck');

  const back = (
    <Link to="/words/decks" className="t-subhead -ml-1 mb-3 inline-flex h-10 items-center gap-1 rounded-chip pr-2 text-accent">
      <ChevronLeft size={18} aria-hidden="true" /> Decks
    </Link>
  );
  if (query.isPending) {
    return (
      <div className="mx-auto w-full max-w-[760px]">
        {back}
        <Skeleton height={150} radius={20} />
      </div>
    );
  }
  if (query.isError || !deck) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="mx-auto w-full max-w-[760px]">
        {back}
        {missing ? <EmptyState icon={Lock} title="This deck isn’t available" message="Its owner may have stopped sharing it, or it was taken down." /> : <ErrorState title="Couldn’t load the deck" message={describeError(query.error)} onRetry={() => void query.refetch()} retrying={query.isFetching} />}
      </div>
    );
  }

  const hue = deckHue(deck.id);
  const run = (a: Parameters<typeof action.mutate>[0]['action']) => action.mutate({ id: deck.id, action: a });
  const failed = action.error;

  return (
    <div className="mx-auto w-full max-w-[760px]">
      {back}
      <section className="relative overflow-hidden rounded-panel p-6 text-white" style={{ background: `linear-gradient(135deg, ${hue}, color-mix(in srgb, ${hue} 50%, #000))` }}>
        <span className="pointer-events-none absolute -right-3 -top-10 select-none text-[180px] font-black leading-none text-white/10" aria-hidden="true">
          {deck.title.trim()[0]?.toUpperCase()}
        </span>
        <div className="relative">
          <p className="flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-white/75">
            {deck.mine ? (deck.published ? <><Globe2 size={13} aria-hidden="true" /> Shared</> : <><Lock size={13} aria-hidden="true" /> Private</>) : `by ${deck.owner}`}
            {deck.hidden && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 normal-case tracking-normal text-bad">
                <EyeOff size={12} aria-hidden="true" /> Hidden
              </span>
            )}
          </p>
          <h1 className="mt-1.5 text-[28px] font-bold leading-9 tracking-[-0.02em]">{deck.title}</h1>
          {deck.description && <p className="t-subhead mt-1.5 max-w-[560px] text-white/80">{deck.description}</p>}
          <p className="t-footnote mt-3 flex items-center gap-3 text-white/75">
            <span>{deck.word_count} words</span>
            {deck.published && (
              <span className="inline-flex items-center gap-1">
                <Users size={13} aria-hidden="true" /> {deck.adds} {deck.adds === 1 ? 'student added it' : 'students added it'}
              </span>
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {deck.mine ? (
              <>
                <Link to={`/words/decks/${deck.id}/edit`} className="inline-flex h-10 items-center gap-2 rounded-control bg-white px-4 text-[14px] font-bold text-[#1a0b3d]">
                  <Pencil size={15} aria-hidden="true" /> Edit words
                </Link>
                {!deck.hidden && (
                  <button type="button" disabled={action.isPending} onClick={() => run(deck.published ? 'unpublish' : 'publish')} className="inline-flex h-10 items-center gap-2 rounded-control bg-white/15 px-4 text-[14px] font-bold text-white hover:bg-white/25">
                    {deck.published ? <><Lock size={15} aria-hidden="true" /> Stop sharing</> : <><Globe2 size={15} aria-hidden="true" /> Share with everyone</>}
                  </button>
                )}
                <button
                  type="button"
                  disabled={action.isPending}
                  onClick={() =>
                    confirm({
                      title: `Delete “${deck.title}”?`,
                      message: 'Students who added it lose it too. Your reviews of its words stay.',
                      onConfirm: () => action.mutate({ id: deck.id, action: 'delete' }, { onSuccess: () => void navigate('/words/decks') }),
                    })
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-control px-3 text-[14px] font-bold text-white/85 hover:bg-white/15">
                  <Trash2 size={15} aria-hidden="true" /> Delete
                </button>
              </>
            ) : teacher ? (
              <>
                <button type="button" disabled={action.isPending} onClick={() => run('keep')} className="inline-flex h-10 items-center gap-2 rounded-control bg-white px-4 text-[14px] font-bold text-[#1a0b3d]">
                  <ShieldCheck size={15} aria-hidden="true" /> {deck.hidden ? 'Put it back' : 'Keep it up'}
                </button>
                {!deck.hidden && (
                  <button type="button" onClick={() => setDialog('hide')} className="inline-flex h-10 items-center gap-2 rounded-control bg-white/15 px-4 text-[14px] font-bold text-white hover:bg-white/25">
                    <EyeOff size={15} aria-hidden="true" /> Hide it
                  </button>
                )}
              </>
            ) : (
              <>
                <button type="button" disabled={action.isPending} onClick={() => run(deck.added ? 'remove' : 'add')} className="inline-flex h-10 items-center gap-2 rounded-control bg-white px-4 text-[14px] font-bold text-[#1a0b3d]">
                  {deck.added ? 'Remove from my decks' : <><Plus size={15} aria-hidden="true" /> Add to my decks</>}
                </button>
                <button type="button" onClick={() => setDialog('report')} className="inline-flex h-10 items-center gap-2 rounded-control px-3 text-[14px] font-bold text-white/85 hover:bg-white/15">
                  <Flag size={15} aria-hidden="true" /> Report
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {failed && (
        <div className="mt-3">
          <Notice tone="error" title="That didn’t work" message={failed instanceof ApiError && failed.code === 'deck_too_small' ? 'A deck needs at least 5 words to be shared.' : describeError(failed)} />
        </div>
      )}
      {deck.hidden && (deck.mine || teacher) && (
        <div className="mt-3">
          <Notice tone="warning" title={deck.mine ? 'Other students can’t see this deck' : 'Hidden from students'} message={deck.hidden_reason ?? 'It was taken down.'} />
        </div>
      )}
      {teacher && (query.data?.report_reasons?.length ?? 0) > 0 && (
        <section className="mt-3 rounded-card border border-line bg-surface p-4">
          <h2 className="t-headline text-ink">What students reported</h2>
          <ul className="t-subhead mt-1.5 list-disc pl-5 text-ink-2">
            {query.data!.report_reasons!.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}
      {deck.added && !deck.mine && <p className="t-footnote mt-3 text-ink-2">Its words are in your flashcards and games. Turn it on or off in Lists & pace.</p>}
      {deck.mine && !deck.published && deck.word_count > 0 && <p className="t-footnote mt-3 text-ink-2">Only you see this deck. Its words are in your flashcards and games; share it so others can add it too.</p>}

      <section className="mt-4 overflow-hidden rounded-card border border-line bg-surface">
        {deck.words.length === 0 ? (
          <p className="t-body p-6 text-center text-ink-2">No words yet.</p>
        ) : (
          <ul>
            {deck.words.map((w, i) => (
              <li key={w.id} className={`flex items-start gap-3 px-4 py-3 ${i ? 'border-t border-line' : ''}`}>
                <span className="min-w-0 flex-1">
                  <span className="t-body">
                    <span className="font-bold text-ink">{w.word}</span>
                    {w.part_of_speech && <span className="t-footnote italic text-ink-3"> {w.part_of_speech}</span>}
                  </span>
                  <span className="t-subhead block text-ink-2">{w.definition}</span>
                  {w.example && <span className="t-footnote mt-0.5 block italic text-ink-3">{w.example}</span>}
                </span>
                <SpeakButton word={w.word} className="size-9" />
              </li>
            ))}
          </ul>
        )}
      </section>
      {dialog && <ReasonDialog id={deck.id} hide={dialog === 'hide'} onClose={() => setDialog(null)} />}
    </div>
  );
}

const REASONS = ['Rude or hurtful words', 'Wrong meanings', 'Not SAT words', 'Spam'];

function ReasonDialog({ id, hide, onClose }: { id: string; hide: boolean; onClose: () => void }) {
  const report = useReportDeck();
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  return (
    <Modal
      title={hide ? 'Hide this deck' : 'Report this deck'}
      subtitle={hide ? 'It leaves the community and everyone’s decks. Its owner sees your reason.' : 'Teachers look at reported decks. Three reports take a deck down until they do.'}
      onClose={onClose}
      width={460}
      footer={
        done ? (
          <Action onClick={onClose}>Close</Action>
        ) : (
          <>
            <Action variant="outline" onClick={onClose}>
              Cancel
            </Action>
            <Action disabled={reason.trim() === '' || report.isPending} onClick={() => report.mutate({ id, reason, hide }, { onSuccess: () => (hide ? onClose() : setDone(true)) })}>
              {hide ? 'Hide' : 'Send report'}
            </Action>
          </>
        )
      }>
      {done ? (
        <p className="t-body text-ink-2">Thanks. A teacher will look at it.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} aria-pressed={reason === r} className={`t-subhead h-9 rounded-full border px-3 ${reason === r ? 'border-primary bg-accent-tint font-semibold text-accent' : 'border-line text-ink-2 hover:border-line-strong'}`}>
                {r}
              </button>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="t-subhead text-ink-2">{hide ? 'Reason for its owner' : 'Or say what’s wrong'}</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} className="t-body mt-1 w-full rounded-control border border-line bg-surface p-3 text-ink outline-none focus:border-primary" />
          </label>
          {report.error && <p className="t-footnote mt-2 text-bad">{describeError(report.error)}</p>}
        </>
      )}
    </Modal>
  );
}
