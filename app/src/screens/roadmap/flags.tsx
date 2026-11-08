import { Globe2 } from 'lucide-react';

import ca from 'flag-icons/flags/4x3/ca.svg';
import ch from 'flag-icons/flags/4x3/ch.svg';
import de from 'flag-icons/flags/4x3/de.svg';
import gb from 'flag-icons/flags/4x3/gb.svg';
import jp from 'flag-icons/flags/4x3/jp.svg';
import kr from 'flag-icons/flags/4x3/kr.svg';
import sg from 'flag-icons/flags/4x3/sg.svg';
import tr from 'flag-icons/flags/4x3/tr.svg';
import us from 'flag-icons/flags/4x3/us.svg';
import uz from 'flag-icons/flags/4x3/uz.svg';

// The countries of the journeys, as round flags (flag-icons, MIT; bundled
// with the app, since Windows draws flag emoji as two letters).
const FLAGS: Record<string, string> = { ca, ch, de, gb, jp, kr, sg, tr, us, uz };

export function Flag({ code, size = 28, className = '' }: { code: string | null; size?: number; className?: string }) {
  const src = code ? FLAGS[code] : undefined;
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
