import { ShieldMark } from '@/components/brand/Logo';
import { useDialog } from '@/lib/dialog';

// A page this account can't open yet (the reference's locked-feature modal).
export function LockedModal({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  const dialog = useDialog<HTMLDivElement>(onClose);
  return (
    <div className="fade fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[8px]" onClick={onClose}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="pop flex w-full max-w-[380px] flex-col items-center rounded-panel bg-surface px-6 pb-6 pt-7 text-center outline-none" onClick={(e) => e.stopPropagation()}>
        <span className="mb-4 flex size-16 items-center justify-center rounded-full bg-accent-tint text-primary">
          <ShieldMark size={34} />
        </span>
        <h2 className="text-[22px] font-bold text-ink">{title}</h2>
        <p className="t-subhead mt-2 text-ink-2">{message}</p>
        <button type="button" onClick={onClose} className="lift mt-5 h-11 rounded-full bg-ink px-6 text-[14px] font-bold text-surface">
          I Understand
        </button>
      </div>
    </div>
  );
}
