import { Globe2 } from 'lucide-react';

// Every country's flag as a round badge (flag-icons, MIT; bundled with the
// app, since Windows draws flag emoji as two letters). Each is its own small
// file, fetched only when shown.
const FILES = import.meta.glob<string>('../../../../node_modules/flag-icons/flags/4x3/*.svg', { eager: true, query: '?no-inline', import: 'default' });
const FLAGS: Record<string, string> = Object.fromEntries(Object.entries(FILES).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -4), url]));

export function Flag({ code, size = 28, className = '' }: { code: string | null; size?: number; className?: string }) {
  const src = code ? FLAGS[code.toLowerCase()] : undefined;
  if (!src) return <Flagless size={size} className={className} />;
  return <img src={src} alt="" width={size} height={size} className={`shrink-0 rounded-full object-cover ring-2 ring-white/80 ${className}`} style={{ width: size, height: size }} />;
}

export function Flagless({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-accent-tint text-primary ${className}`} style={{ width: size, height: size }}>
      <Globe2 size={size * 0.6} aria-hidden="true" />
    </span>
  );
}
