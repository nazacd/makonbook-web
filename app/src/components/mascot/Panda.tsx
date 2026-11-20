import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from 'react';

import type { Season } from '@/lib/season';

// Mako the panda: the vector rig from the old MakonBook (V70), redrawn from
// SATMAKON's six reference poses. Every part is its own element, so the CSS
// (.pd-* in styles.css) can animate it: ears, brows, lids, pupils, six mouths,
// arms, cheeks and effects. An emotion is a data attribute; the transitions
// blend between them. The pupils follow the pointer, he blinks on his own,
// and the parent drives him through the handle: set an emotion for a while,
// change the resting one, talk, perk the ears. His accessory follows the season.

export type Emotion = 'idle' | 'happy' | 'greet' | 'celebrate' | 'surprised' | 'sad' | 'angry' | 'skeptical' | 'bored' | 'sleepy' | 'thinking' | 'love' | 'worried';
export const EMOTIONS: Emotion[] = ['idle', 'happy', 'greet', 'celebrate', 'surprised', 'sad', 'angry', 'skeptical', 'bored', 'sleepy', 'thinking', 'love', 'worried'];

/** Emotions in which he doesn't follow the pointer with his eyes. */
const NO_GAZE = new Set<Emotion>(['bored', 'sleepy', 'thinking', 'skeptical', 'sad']);

export type PandaHandle = {
  /** Show an emotion; with `hold` (ms) he returns to the resting one afterwards. */
  set(emotion: Emotion, hold?: number): void;
  /** The resting emotion (idle, or bored and sleepy when left alone). */
  setBase(emotion: Emotion): void;
  talk(ms: number): void;
  perk(): void;
  readonly element: SVGSVGElement | null;
  readonly emotion: Emotion;
};

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function Panda({ season = null, initial = 'idle', gaze = true, className = '', label = 'Mako the panda', ref }: { season?: Season | null; initial?: Emotion; gaze?: boolean; className?: string; label?: string; ref?: Ref<PandaHandle> }) {
  const id = useId().replace(/:/g, '');
  const svg = useRef<SVGSVGElement>(null);
  const [emotion, setEmotion] = useState<Emotion>(initial);
  const current = useRef(emotion);
  useEffect(() => {
    current.current = emotion;
  }, [emotion]);
  const base = useRef<Emotion>('idle');
  const hold = useRef(0);
  const talking = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      set(e, ms = 0) {
        clearTimeout(hold.current);
        if (current.current === e) {
          // The same emotion again: restart its animations by passing through idle.
          setEmotion('idle');
          requestAnimationFrame(() => setEmotion(e));
        } else setEmotion(e);
        if (ms) hold.current = window.setTimeout(() => setEmotion(base.current), ms);
      },
      setBase(e) {
        clearTimeout(hold.current);
        base.current = e;
        setEmotion(e);
      },
      talk(ms) {
        const el = svg.current;
        if (!el || reduceMotion()) return;
        el.classList.add('is-talking');
        clearTimeout(talking.current);
        talking.current = window.setTimeout(() => el.classList.remove('is-talking'), ms);
      },
      perk() {
        const el = svg.current;
        if (!el) return;
        el.classList.remove('is-perk');
        void el.getBoundingClientRect();
        el.classList.add('is-perk');
      },
      get element() {
        return svg.current;
      },
      get emotion() {
        return current.current;
      },
    }),
    [],
  );

  // Timers die with him.
  useEffect(
    () => () => {
      clearTimeout(hold.current);
      clearTimeout(talking.current);
    },
    [],
  );

  // Blinking: every few seconds, now and then twice.
  useEffect(() => {
    let timer = 0;
    let second = 0;
    const blink = () => {
      const el = svg.current;
      if (!el || current.current === 'sleepy') return;
      el.classList.add('is-blink');
      window.setTimeout(() => el.classList.remove('is-blink'), 120);
    };
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (!document.hidden) {
          blink();
          if (Math.random() < 0.22) second = window.setTimeout(blink, 260);
        }
        schedule();
      }, rand(2400, 6200));
    };
    schedule();
    return () => {
      clearTimeout(timer);
      clearTimeout(second);
    };
  }, []);

  // The pupils point at the pointer (clamped inside the eye).
  useEffect(() => {
    if (!gaze) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const relax = () => {
      svg.current?.style.removeProperty('--px');
      svg.current?.style.removeProperty('--py');
    };
    const look = () => {
      frame = 0;
      const el = svg.current;
      if (!el || !last) return;
      if (NO_GAZE.has(current.current)) return relax();
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.45;
      const dx = last.clientX - cx;
      const dy = last.clientY - cy;
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, d / 260) * 6.5;
      el.style.setProperty('--px', `${(dx / d) * reach}px`);
      el.style.setProperty('--py', `${(dy / d) * reach * 0.8}px`);
    };
    const move = (e: PointerEvent) => {
      last = e;
      if (!frame) frame = requestAnimationFrame(look);
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', relax);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', relax);
    };
  }, [gaze]);

  return (
    <svg ref={svg} className={`pd ${className}`} viewBox="0 0 240 250" data-emotion={emotion} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} focusable="false">
        <defs>
          <clipPath id={`pdBody${id}`}><ellipse cx="120" cy="132" rx="88" ry="90"/></clipPath>
          <clipPath id={`pdEyeL${id}`}><circle cx="80" cy="112" r="25.5"/></clipPath>
          <clipPath id={`pdEyeR${id}`}><circle cx="160" cy="112" r="25.5"/></clipPath>
          <linearGradient id={`pdBelly${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9c9ce"/><stop offset="1" stopColor="#a7a7ad"/></linearGradient>
          <radialGradient id={`pdFace${id}`} cx="45%" cy="35%" r="70%"><stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#ececef"/></radialGradient>
        </defs>
        <ellipse className="pd-shadow" cx="120" cy="238" rx="64" ry="7"/>
        <g className="pd-body">
          <g className="pd-legs" fill="#1f1d22">
            <path d="M76 196H108V226Q108 233 101 233H83Q76 233 76 226Z"/>
            <path d="M132 196H164V226Q164 233 157 233H139Q132 233 132 226Z"/>
          </g>
          <g className="pd-arm pd-arm-l"><path d="M44 128C24 122 8 142 12 164C15 180 32 184 42 174C50 164 54 140 44 128Z" fill="#1f1d22"/></g>
          <g className="pd-arm pd-arm-r"><path d="M196 128C216 122 232 142 228 164C225 180 208 184 198 174C190 164 186 140 196 128Z" fill="#1f1d22"/></g>
          <g className="pd-ear pd-ear-l"><circle cx="52" cy="60" r="27" fill="#1f1d22"/><circle cx="55" cy="63" r="15" fill="#4a4850"/></g>
          <g className="pd-ear pd-ear-r"><circle cx="188" cy="60" r="27" fill="#1f1d22"/><circle cx="185" cy="63" r="15" fill="#4a4850"/></g>
          <path className="pd-tuft" d="M102 48C102 32 108 18 117 8C118 20 123 22 128 15C129 26 135 28 142 23C139 33 137 42 136 50Z" fill="#f7f7f9" stroke="#d6d6dd" strokeWidth="2.5" strokeLinejoin="round"/>
          <ellipse cx="120" cy="132" rx="88" ry="90" fill={`url(#pdFace${id})`} stroke="#dcdce3" strokeWidth="2"/>
          <g clipPath={`url(#pdBody${id})`}>
            <path d="M22 86C38 64 84 58 104 76C118 89 117 128 107 147C90 158 48 158 22 152Z" fill="#1f1d22"/>
            <path d="M218 86C202 64 156 58 136 76C122 89 123 128 133 147C150 158 192 158 218 152Z" fill="#1f1d22"/>
            <ellipse cx="120" cy="212" rx="66" ry="38" fill={`url(#pdBelly${id})`}/>
          </g>
          <g className="pd-cheeks" fill="#ff8fab"><ellipse cx="66" cy="164" rx="11" ry="6"/><ellipse cx="174" cy="164" rx="11" ry="6"/></g>
          {/* eyes */}
          <g className="pd-eye pd-eye-l">
            <circle cx="80" cy="112" r="27.5" fill="#1f1d22"/>
            <circle cx="80" cy="112" r="25.5" fill="#ffffff"/>
            <g clipPath={`url(#pdEyeL${id})`}>
              <g className="pd-pupil"><circle cx="81" cy="113" r="17" fill="#141216"/><circle cx="87" cy="105" r="6" fill="#ffffff"/><circle cx="75" cy="120" r="2.4" fill="#ffffff"/></g>
              <rect className="pd-lid pd-lid-l" x="44" y="22" width="72" height="62" fill="#55525a" stroke="#2b2930" strokeWidth="3"/>
              <rect className="pd-lid-low pd-lid-low-l" x="44" y="139" width="72" height="30" fill="#55525a" stroke="#2b2930" strokeWidth="3"/>
            </g>
          </g>
          <g className="pd-eye pd-eye-r">
            <circle cx="160" cy="112" r="27.5" fill="#1f1d22"/>
            <circle cx="160" cy="112" r="25.5" fill="#ffffff"/>
            <g clipPath={`url(#pdEyeR${id})`}>
              <g className="pd-pupil"><circle cx="161" cy="113" r="17" fill="#141216"/><circle cx="167" cy="105" r="6" fill="#ffffff"/><circle cx="155" cy="120" r="2.4" fill="#ffffff"/></g>
              <rect className="pd-lid pd-lid-r" x="124" y="22" width="72" height="62" fill="#55525a" stroke="#2b2930" strokeWidth="3"/>
              <rect className="pd-lid-low pd-lid-low-r" x="124" y="139" width="72" height="30" fill="#55525a" stroke="#2b2930" strokeWidth="3"/>
            </g>
          </g>
          <path className="pd-brow pd-brow-l" d="M62 72C70 63 86 61 97 66" fill="none" stroke="#1f1d22" strokeWidth="9" strokeLinecap="round"/>
          <path className="pd-brow pd-brow-r" d="M178 72C170 63 154 61 143 66" fill="none" stroke="#1f1d22" strokeWidth="9" strokeLinecap="round"/>
          {/* nose */}
          <path d="M111 127C111 121 129 121 129 127C129 133 123 138 120 138C117 138 111 133 111 127Z" fill="#2b2930"/>
          <path d="M120 138V146" stroke="#2b2930" strokeWidth="2.4" strokeLinecap="round"/>
          {/* mouths: one is visible per emotion */}
          <g className="pd-mouth pd-m-open"><path d="M105 152C105 149 135 149 135 152C135 167 128 175 120 175C112 175 105 167 105 152Z" fill="#8f1d2c"/><path d="M111 168C114 161 126 161 129 168C126 173 123 175 120 175C117 175 114 173 111 168Z" fill="#e05a6d"/></g>
          <g className="pd-mouth pd-m-o"><ellipse cx="120" cy="161" rx="8" ry="10.5" fill="#8f1d2c"/><ellipse cx="120" cy="166" rx="5.5" ry="4" fill="#e05a6d"/></g>
          <path className="pd-mouth pd-m-smile" d="M109 154C113 163 127 163 131 154" fill="none" stroke="#2b2930" strokeWidth="3.2" strokeLinecap="round"/>
          <path className="pd-mouth pd-m-frown" d="M109 163C113 154 127 154 131 163" fill="none" stroke="#2b2930" strokeWidth="3.2" strokeLinecap="round"/>
          <path className="pd-mouth pd-m-flat" d="M107 160C114 157 126 157 133 159" fill="none" stroke="#2b2930" strokeWidth="3.2" strokeLinecap="round"/>
          <path className="pd-mouth pd-m-smirk" d="M110 161C117 160 125 158 131 153" fill="none" stroke="#2b2930" strokeWidth="3.2" strokeLinecap="round"/>
          <path className="pd-mouth pd-m-wobble" d="M107 160Q111 155 115 160T123 160T131 160" fill="none" stroke="#2b2930" strokeWidth="3" strokeLinecap="round"/>
          {/* seasonal accessory */}
          {season === 'spring' && (
          <g className="pd-acc pd-acc-spring" transform="translate(196 44)">
            <g fill="#fbb6ce"><ellipse cy="-9" rx="7" ry="9.5"/><ellipse cy="-9" rx="7" ry="9.5" transform="rotate(72)"/><ellipse cy="-9" rx="7" ry="9.5" transform="rotate(144)"/><ellipse cy="-9" rx="7" ry="9.5" transform="rotate(216)"/><ellipse cy="-9" rx="7" ry="9.5" transform="rotate(288)"/></g>
            <circle r="4" fill="#c2255c"/>
            <path d="M-14 12C-8 8 -2 8 2 12C-2 16 -8 16 -14 12Z" fill="#69b34c"/>
          </g>
          )}
          {season === 'summer' && (
          <g className="pd-acc pd-acc-summer">
            <path d="M78 46L84 22C100 14 140 14 156 22L162 46C140 40 100 40 78 46Z" fill="#1f1d22"/>
            <path d="M84 22C100 14 140 14 156 22L150 30C136 25 104 25 90 30Z" fill="#2c2a30"/>
            <g fill="#ffffff"><path d="M98 38C92 32 96 26 102 28C100 32 102 35 98 38Z"/><path d="M142 38C148 32 144 26 138 28C140 32 138 35 142 38Z"/><path d="M120 36C114 30 116 24 120 22C124 24 126 30 120 36Z"/></g>
            <path d="M78 46C100 40 140 40 162 46" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeDasharray="3 3"/>
          </g>
          )}
          {season === 'autumn' && (
          <g className="pd-acc pd-acc-autumn" transform="translate(150 20) rotate(24) scale(.42) translate(-50 -50)">
            <path d="M50 94L48 75C40 79 28 81 17 78L24 68C13 64 5 56 3 47L16 47C11 39 11 29 15 20C24 27 30 31 34 34L31 17C38 21 43 13 50 3C57 13 62 21 69 17L66 34C70 31 76 27 85 20C89 29 89 39 84 47L97 47C95 56 87 64 76 68L83 78C72 81 60 79 52 75L50 94Z" fill="#e76f51"/>
            <path d="M50 90L50 14M50 62L18 26M50 62L82 26" stroke="#9c3d1d" strokeWidth="3" fill="none"/>
          </g>
          )}
          {season === 'winter' && (
          <g className="pd-acc pd-acc-winter">
            <path d="M44 180C70 194 170 194 196 180L200 196C172 212 68 212 40 196Z" fill="#d62839"/>
            <g fill="#ffffff" opacity=".9"><rect x="64" y="188" width="8" height="15" rx="2"/><rect x="92" y="191" width="8" height="15" rx="2"/><rect x="120" y="192" width="8" height="15" rx="2"/><rect x="148" y="191" width="8" height="15" rx="2"/><rect x="176" y="188" width="8" height="15" rx="2"/></g>
            <path d="M168 196L178 230L162 232L156 200Z" fill="#b51d2e"/>
            <path d="M162 232L160 238M168 231L167 238M174 230L175 237" stroke="#b51d2e" strokeWidth="2.4" strokeLinecap="round"/>
          </g>
          )}
        </g>
        {/* effects */}
        <g className="pd-fx">
          <path className="pd-fx-tear" d="M96 140C96 140 90 150 90 154C90 158 93 160 96 160C99 160 102 158 102 154C102 150 96 140 96 140Z" fill="#7cc4ff"/>
          <path className="pd-fx-sweat" d="M200 60C200 60 192 72 192 77C192 82 196 85 200 85C204 85 208 82 208 77C208 72 200 60 200 60Z" fill="#9fd6ff"/>
          <g className="pd-fx-anger" stroke="#e03131" strokeWidth="5" strokeLinecap="round" fill="none"><path d="M196 30C202 34 202 40 196 44"/><path d="M216 30C210 34 210 40 216 44"/><path d="M200 26C204 20 208 20 212 26"/><path d="M200 48C204 54 208 54 212 48"/></g>
          <g className="pd-fx-zzz" fill="#7c6cf0" fontFamily="inherit" fontWeight="900"><text x="190" y="44" fontSize="22">z</text><text x="206" y="26" fontSize="16">z</text><text x="218" y="12" fontSize="12">z</text></g>
          <text className="pd-fx-q" x="196" y="44" fontSize="40" fontWeight="900" fill="#7c6cf0">?</text>
          <g className="pd-fx-hearts" fill="#ff4d6d"><path d="M24 40C24 34 32 32 34 38C36 32 44 34 44 40C44 46 34 52 34 52C34 52 24 46 24 40Z"/><path d="M196 24C196 20 201 19 203 23C205 19 210 20 210 24C210 28 203 32 203 32C203 32 196 28 196 24Z"/></g>
          <g className="pd-fx-sparkles" fill="#ffc53d"><path d="M22 70L26 80L36 84L26 88L22 98L18 88L8 84L18 80Z"/><path d="M214 92L217 99L224 102L217 105L214 112L211 105L204 102L211 99Z"/><path d="M200 18L202 23L207 25L202 27L200 32L198 27L193 25L198 23Z"/></g>
        </g>
    </svg>
  );
}
