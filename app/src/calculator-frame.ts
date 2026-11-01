import './calculator-frame.css';

// The Desmos graphing calculator, in its own page (calculator.html) that the
// test screen shows in a frame. It lives apart from the app on purpose: the
// app's security policy stays strict (the sign-in token is in this origin's
// storage), while this page's policy (docker/calculator-headers.conf) allows
// what Desmos needs to run. The key comes from VITE_DESMOS_API_KEY at build
// time and is restricted to our domain by Desmos.

declare global {
  interface Window {
    Desmos?: { GraphingCalculator?: (el: HTMLElement, options: Record<string, unknown>) => { resize: () => void } };
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

let calculator: { resize: () => void } | null = null;

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
el('retry').addEventListener('click', () => location.reload());

if (KEY) load();
else show('unconfigured');
