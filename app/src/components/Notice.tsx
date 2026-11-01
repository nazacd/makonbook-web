type Tone = 'info' | 'warning' | 'error' | 'success';

const DOT: Record<Tone, string> = { info: 'bg-info', warning: 'bg-watch', error: 'bg-bad', success: 'bg-good' };

// An inline status message, placed next to what it is about. Colour sits on a
// solid mark, never on the text itself, so the message stays legible.
export function Notice({ tone, title, message }: { tone: Tone; title?: string; message: string }) {
  return (
    <div className="flex gap-3 rounded-panel bg-surface p-4" role={tone === 'error' ? 'alert' : 'status'}>
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT[tone]}`} />
      <div className="flex flex-col gap-0.5">
        {title && <p className="t-headline text-ink">{title}</p>}
        <p className="t-subhead text-ink-2">{message}</p>
      </div>
    </div>
  );
}
