import './calculator-frame.css';

// The Desmos graphing calculator, in its own page (calculator.html) that the
// test screen shows in a frame. It lives apart from the app so the app's own
// pages keep their strict policy (no code compiled at run time), while this
// page's (docker/calculator-headers.conf) allows what Desmos needs to run.
// It is not a security boundary: the frame is on the same origin, so its
// scripts (ours and Desmos's) can read this origin's storage, the sign-in
// token included, as they could if Desmos ran in the app itself. Nothing but
// Desmos's code and the calculator's own saved state is loaded here. The key
// comes from VITE_DESMOS_API_KEY at build time and is restricted to our
// domain by Desmos.

type DesmosCalculator = {
  resize: () => void;
  getState: () => unknown;
  setState: (state: unknown, options?: { allowUndo?: boolean }) => void;
  observeEvent?: (event: string, callback: () => void) => void;
};

declare global {
  interface Window {
    Desmos?: { GraphingCalculator?: (el: HTMLElement, options: Record<string, unknown>) => DesmosCalculator };
  }
}

const KEY = import.meta.env.VITE_DESMOS_API_KEY ?? '';
const SRC = 'https://www.desmos.com/api/v1.11/calculator.js?apiKey=';
const SLOW_MS = 6000;
const READY_WAIT_MS = 15000;

const el = (id: string) => document.getElementById(id)!;
const show = (id: 'loading' | 'failed' | 'unconfigured' | null) => {
  for (const o of ['loading', 'failed', 'unconfigured']) el(o).hidden = o !== id;
};

// Everything that goes wrong while loading, to show (and to report back).
const problems: string[] = [];
const note = (p: string) => {
  if (p && !problems.includes(p)) problems.push(p);
};
document.addEventListener('securitypolicyviolation', (e) => note(`Blocked by the security policy: ${e.effectiveDirective} ${e.blockedURI}`.trim()));
window.addEventListener('error', (e) => note(e.message));

let calculator: DesmosCalculator | null = null;

// The student's work, kept for the test in progress (the page is opened as
// calculator.html?run=<run id>): restored when the calculator starts, saved
// as it changes. The key is lib/practice/calculator-state.ts's.
const run = new URLSearchParams(location.search).get('run');
const storeKey = run && /^[\w-]{1,64}$/.test(run) ? `mb.calc.${run}` : null;
let saved = '';

function restore() {
  if (!storeKey || !calculator) return;
  try {
    const raw = localStorage.getItem(storeKey);
    if (raw) {
      calculator.setState(JSON.parse(raw), { allowUndo: false });
      saved = raw;
    }
  } catch {
    // A state Desmos can't read (or no storage): start empty.
  }
}

function save() {
  if (!storeKey || !calculator) return;
  try {
    const state = JSON.stringify(calculator.getState());
    if (state !== saved) {
      localStorage.setItem(storeKey, state);
      saved = state;
    }
  } catch {
    // Storage full or blocked: the work stays on screen for now.
  }
}

let pending: ReturnType<typeof setTimeout> | undefined;
const saveSoon = () => {
  clearTimeout(pending);
  pending = setTimeout(save, 300);
};

function fail(reason: string) {
  note(reason);
  const list = el('details');
  list.replaceChildren(...problems.map((p) => Object.assign(document.createElement('li'), { textContent: p })));
  show('failed');
}

function start() {
  try {
    calculator = window.Desmos!.GraphingCalculator!(el('calculator'), {
      keypad: true,
      expressionsCollapsed: false,
      settingsMenu: false,
      zoomButtons: true,
      border: false,
    });
    restore();
    calculator.observeEvent?.('change', saveSoon);
    // Also now and then, and when the page goes away, in case a change slipped by.
    setInterval(save, 3000);
    show(null);
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
}

function load() {
  show('loading');
  const slow = setTimeout(() => (el('slow').hidden = false), SLOW_MS);
  const script = document.createElement('script');
  script.src = SRC + encodeURIComponent(KEY);
  script.async = true;
  script.onload = () => {
    // The API may finish setting itself up after its script has run.
    const began = Date.now();
    const wait = () => {
      if (typeof window.Desmos?.GraphingCalculator === 'function') {
        clearTimeout(slow);
        start();
      } else if (Date.now() - began > READY_WAIT_MS) {
        clearTimeout(slow);
        fail(window.Desmos ? 'Desmos loaded, but its calculator didn’t start.' : 'The Desmos script ran but didn’t set up the calculator.');
      } else {
        setTimeout(wait, 100);
      }
    };
    wait();
  };
  script.onerror = () => {
    clearTimeout(slow);
    fail('The Desmos script couldn’t be downloaded.');
  };
  document.head.appendChild(script);
}

// The frame is resized with its pane (dragged, docked or floating).
window.addEventListener('resize', () => calculator?.resize());
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && save());
el('retry').addEventListener('click', () => location.reload());

if (KEY) load();
else show('unconfigured');
