import { ChevronLeft, ClipboardPaste, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ApiError } from '@/api/client';
import { describeError } from '@/api/errors';
import { deckSlug, useDeckDetail, useSaveDeck, type DeckInput, type UserDeck } from '@/api/vocabSocial';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Skeleton } from '@/components/States';
import { Action, Modal } from '@/components/ui';
import { useSaveSettings, useSettings } from '@/lib/vocab/hooks';
import { useTitle } from '@/lib/title';

type Row = { key: number; id?: string; word: string; part_of_speech: string; definition: string; example: string };

const MAX_WORDS = 200;
let keys = 0;
const blank = (): Row => ({ key: ++keys, word: '', part_of_speech: '', definition: '', example: '' });
const fromDeck = (d: UserDeck): Row[] => d.words.map((w) => ({ key: ++keys, id: w.id, word: w.word, part_of_speech: w.part_of_speech ?? '', definition: w.definition, example: w.example }));

/**
 * Lines pasted in: "word - meaning", "word: meaning" or "word<tab>meaning",
 * with an optional third part as the example.
 */
export function parsePasted(text: string): Row[] {
  const rows: Row[] = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split(/\t| [-–—] |: /).map((p) => p.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) continue;
    rows.push({ ...blank(), word: parts[0], definition: parts[1], example: parts.slice(2).join(' ') });
  }
  return rows;
}

// Making or editing a deck: a title, a line about it, and its words (word
// and meaning needed; part of speech and an example sentence help). Many
// words can be pasted at once. A new deck is turned on for studying.
export function DeckEditor() {
  const { id } = useParams();
  const detail = useDeckDetail(id ?? '');
  if (id && detail.isPending) {
    return (
      <div className="mx-auto w-full max-w-[860px] pt-10">
        <Skeleton height={300} radius={16} />
      </div>
    );
  }
  if (id && (detail.isError || !detail.data?.deck.mine)) {
    return (
      <div className="mx-auto w-full max-w-[860px] pt-10">
        <Notice tone="error" title="You can’t edit this deck" message={detail.error ? describeError(detail.error) : 'Only its owner can.'} />
      </div>
    );
  }
  return <Editor deck={id ? detail.data!.deck : undefined} />;
}

function Editor({ deck }: { deck?: UserDeck }) {
  useTitle(deck ? `Edit ${deck.title}` : 'New deck');
  const navigate = useNavigate();
  const save = useSaveDeck();
  const settings = useSettings();
  const saveSettings = useSaveSettings();
  const [title, setTitle] = useState(deck?.title ?? '');
  const [description, setDescription] = useState(deck?.description ?? '');
  const [rows, setRows] = useState<Row[]>(() => (deck ? fromDeck(deck) : [blank(), blank(), blank()]));
  const [pasting, setPasting] = useState(false);
  const [tried, setTried] = useState(false);

  const filled = rows.filter((r) => r.word.trim() || r.definition.trim());
  const missing = filled.filter((r) => !r.word.trim() || !r.definition.trim());
  const seen = new Map<string, number>();
  for (const r of filled) seen.set(r.word.trim().toLowerCase(), (seen.get(r.word.trim().toLowerCase()) ?? 0) + 1);
  const twice = [...seen].filter(([w, n]) => w && n > 1).map(([w]) => w);
  const problem = !title.trim() ? 'Give the deck a title.' : filled.length === 0 ? 'Add at least one word.' : missing.length > 0 ? 'Each word needs its meaning (and each meaning its word).' : twice.length > 0 ? `“${twice[0]}” is in the deck twice.` : filled.length > MAX_WORDS ? `At most ${MAX_WORDS} words in a deck.` : null;

  const set = (key: number, field: keyof Row, value: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const submit = () => {
    setTried(true);
    if (problem) return;
    const input: DeckInput = {
      title: title.trim(),
      description: description.trim(),
      words: filled.map((r) => ({ id: r.id, word: r.word.trim(), part_of_speech: r.part_of_speech.trim() || null, definition: r.definition.trim(), example: r.example.trim() })),
    };
    save.mutate(
      { id: deck?.id, input },
      {
        onSuccess: (newId) => {
          // A new deck is studied straight away.
          if (!deck && settings.data) saveSettings.mutate({ ...settings.data, active: [...settings.data.active, deckSlug(newId)] });
          void navigate(`/words/decks/${newId}`);
        },
      },
    );
  };

  const field = 't-body w-full rounded-control border border-line bg-surface px-3 py-2 text-ink outline-none placeholder:text-ink-3 focus:border-primary';
  return (
    <div className="mx-auto w-full max-w-[860px]">
      <Link to={deck ? `/words/decks/${deck.id}` : '/words/decks'} className="t-subhead -ml-1 mb-3 inline-flex h-10 items-center gap-1 rounded-chip pr-2 text-accent">
        <ChevronLeft size={18} aria-hidden="true" /> {deck ? deck.title : 'Decks'}
      </Link>
      <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.03em] text-title">{deck ? 'Edit deck' : 'New deck'}</h1>
      <p className="t-subhead mt-1 text-ink-2">Words you met in a passage, a book or a test. Private until you share it.</p>

      <section className="mt-5 grid gap-3 rounded-card border border-line bg-surface p-4 sm:p-5">
        <label>
          <span className="t-subhead font-semibold text-ink">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Words from The Great Gatsby" className={`${field} mt-1 h-11`} />
        </label>
        <label>
          <span className="t-subhead font-semibold text-ink">About it</span> <span className="t-footnote text-ink-3">optional</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Where the words come from, who it’s for" className={`${field} mt-1 h-11`} />
        </label>
      </section>

      <div className="mb-2 mt-6 flex items-center justify-between">
        <h2 className="t-headline text-ink">
          Words <span className="tabular text-ink-3">{filled.length}</span>
        </h2>
        <button type="button" onClick={() => setPasting(true)} className="t-subhead inline-flex h-9 items-center gap-1.5 rounded-control px-3 font-semibold text-accent hover:bg-accent-tint">
          <ClipboardPaste size={16} aria-hidden="true" /> Paste a list
        </button>
      </div>
      <ol className="flex flex-col gap-2.5">
        {rows.map((r, i) => {
          const bad = tried && (r.word.trim() || r.definition.trim()) && (!r.word.trim() || !r.definition.trim());
          return (
            <li key={r.key} className={`rounded-card border bg-surface p-3 ${bad ? 'border-bad' : 'border-line'}`}>
              <div className="flex items-start gap-2">
                <span className="t-footnote tabular mt-2.5 w-6 shrink-0 text-right text-ink-3">{i + 1}</span>
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <input value={r.word} onChange={(e) => set(r.key, 'word', e.target.value)} maxLength={100} placeholder="Word" aria-label={`Word ${i + 1}`} className={`${field} font-semibold`} />
                  <input value={r.part_of_speech} onChange={(e) => set(r.key, 'part_of_speech', e.target.value)} maxLength={30} placeholder="verb, noun…" aria-label={`Part of speech ${i + 1}`} className={field} />
                  <textarea value={r.definition} onChange={(e) => set(r.key, 'definition', e.target.value)} maxLength={1000} rows={1} placeholder="Meaning" aria-label={`Meaning ${i + 1}`} className={`${field} sm:col-span-2`} />
                  <input value={r.example} onChange={(e) => set(r.key, 'example', e.target.value)} maxLength={1000} placeholder="An example sentence (optional; Fill the gap uses it)" aria-label={`Example ${i + 1}`} className={`${field} sm:col-span-2`} />
                </div>
                <button type="button" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [blank()]))} aria-label={`Remove word ${i + 1}`} className="flex size-9 shrink-0 items-center justify-center rounded-chip text-ink-3 hover:bg-bad-tint hover:text-bad">
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <button type="button" onClick={() => setRows((rs) => [...rs, blank()])} disabled={rows.length >= MAX_WORDS} className="t-subhead mt-2.5 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-card border border-dashed border-line-strong font-semibold text-ink-2 hover:border-primary hover:text-accent disabled:opacity-40">
        <Plus size={16} aria-hidden="true" /> Add a word
      </button>

      <div className="sticky bottom-[calc(65px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-6 border-t border-line bg-brand/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border md:bottom-0">
        {tried && problem && <p className="t-subhead mb-2 text-bad">{problem}</p>}
        {save.error && <p className="t-subhead mb-2 text-bad">{save.error instanceof ApiError && save.error.code === 'too_many_decks' ? 'You have 30 decks already: delete one to make another.' : describeError(save.error)}</p>}
        <div className="flex items-center justify-between gap-3">
          <span className="t-footnote text-ink-3">{filled.length} of {MAX_WORDS} words</span>
          <Button label={deck ? 'Save' : 'Make the deck'} onClick={submit} loading={save.isPending} />
        </div>
      </div>
      {pasting && (
        <PasteDialog
          onClose={() => setPasting(false)}
          onAdd={(added) => {
            setRows((rs) => [...rs.filter((r) => r.word.trim() || r.definition.trim()), ...added]);
            setPasting(false);
          }}
        />
      )}
    </div>
  );
}

function PasteDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (rows: Row[]) => void }) {
  const [text, setText] = useState('');
  const rows = parsePasted(text);
  return (
    <Modal
      title="Paste a list"
      subtitle="One word a line: the word, then its meaning, separated by a dash, a colon or a tab. An example can follow."
      onClose={onClose}
      width={520}
      footer={
        <>
          <Action variant="outline" onClick={onClose}>
            Cancel
          </Action>
          <Action disabled={rows.length === 0} onClick={() => onAdd(rows)}>
            {rows.length ? `Add ${rows.length} ${rows.length === 1 ? 'word' : 'words'}` : 'Add'}
          </Action>
        </>
      }>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={'ubiquitous - found everywhere\nlaconic: using few words\nbenevolent\tkind and generous'}
        aria-label="Words to paste"
        className="t-body w-full rounded-control border border-line bg-surface p-3 font-mono text-[14px] text-ink outline-none focus:border-primary"
      />
    </Modal>
  );
}
