import type { LucideIcon } from 'lucide-react';

import { Button } from './Button';
import { Icon } from './Icon';
import { Notice } from './Notice';

/** A placeholder block in the shape of the content that is loading. */
export function Skeleton({ width = '100%', height = 16, radius = 8 }: { width?: number | string; height?: number; radius?: number }) {
  return <div aria-hidden="true" className="animate-pulse bg-surface-2 motion-reduce:animate-none" style={{ width, height, borderRadius: radius }} />;
}

/** Nothing to show yet: an icon, one line of title, one of explanation. */
export function EmptyState({ icon, title, message }: { icon: LucideIcon; title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="mb-1.5 flex size-14 items-center justify-center rounded-full bg-surface-2">
        <Icon as={icon} size={26} className="text-ink-2" />
      </div>
      <p className="t-title3 text-ink">{title}</p>
      {message && <p className="t-subhead text-ink-2">{message}</p>}
    </div>
  );
}

/** Content that failed to load: what went wrong, and a way to try again. */
export function ErrorState({ title, message, onRetry, retrying = false }: { title: string; message: string; onRetry: () => void; retrying?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <Notice tone="error" title={title} message={message} />
      <Button label="Try again" variant="secondary" onClick={onRetry} loading={retrying} />
    </div>
  );
}
