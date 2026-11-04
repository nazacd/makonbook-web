import QRCode from 'qrcode';
import { useMemo } from 'react';

import { attendanceLink, fromBase64Url, sign, WINDOW_SECONDS, windowAt } from '@/lib/attendance/code';
import { useFastNow } from '@/lib/clock';

const WINDOW_MS = WINDOW_SECONDS * 1000;
const NAVY = '#122d47';
const VIOLET = '#7a4590';

type RotatingQRProps = {
  sessionId: string;
  secret: string; // base64url, from the session
  clockOffsetMs: number; // server time − this computer's time
  size: number;
  onClick?: () => void;
  /** Drawn straight on a white page (full screen): no tile around it. */
  bare?: boolean;
};

/** The code's modules as one SVG path, so the drawing is crisp at any size. */
function modulesPath(value: string): { d: string; n: number } {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
  return { d, n };
}

// The attendance QR (the phone's RotatingQR). A new code every 10 seconds,
// computed here, so it keeps changing even if the connection drops. Navy on
// white whatever the theme: that is what phone cameras read most reliably.
// The bar under it empties as the code's time runs out.
export function RotatingQR({ sessionId, secret, clockOffsetMs, size, onClick, bare = false }: RotatingQRProps) {
  const now = useFastNow() + clockOffsetMs;
  const window = windowAt(now);
  const value = useMemo(() => attendanceLink(sessionId, window, sign(fromBase64Url(secret), sessionId, window)), [sessionId, secret, window]);
  const { d, n } = useMemo(() => modulesPath(value), [value]);
  const left = (WINDOW_MS - (now % WINDOW_MS)) / WINDOW_MS;

  const code = (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label="Attendance QR code. Students scan it with the MakonBook app.">
      <rect width={n} height={n} fill="#ffffff" />
      <path d={d} fill={NAVY} />
    </svg>
  );
  return (
    <div className="flex flex-col items-center gap-3">
      {bare ? (
        code
      ) : onClick ? (
        <button type="button" onClick={onClick} aria-label="Attendance QR code. Shows the code full screen." className="rounded-panel border border-line bg-white p-3.5 active:opacity-85">
          {code}
        </button>
      ) : (
        <div className="rounded-panel border border-line bg-white p-3.5">{code}</div>
      )}
      <div className={`h-1 overflow-hidden rounded-full ${bare ? 'bg-[#ede2cc]' : 'bg-track'}`} style={{ width: size }} aria-hidden="true">
        <div className={`h-full origin-left ${bare ? 'bg-[#7a4590]' : 'bg-accent'}`} style={{ transform: `scaleX(${left})`, backgroundColor: bare ? VIOLET : undefined }} />
      </div>
    </div>
  );
}
