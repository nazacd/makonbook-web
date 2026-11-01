// MathJax 3 (the same build as the landing page, served from /vendor), loaded
// once, the first time a formula is drawn. Only `tex2svg` is used: text is
// never scanned for delimiters, so "$29" can't become math (handoff section 5).

declare global {
  interface Window {
    MathJax?: {
      tex2svg?: (tex: string, options?: { display?: boolean }) => HTMLElement;
      startup?: { promise?: Promise<unknown>; typeset?: boolean };
      [key: string]: unknown;
    };
  }
}

let loading: Promise<void> | null = null;

export function loadMathJax(): Promise<void> {
  if (window.MathJax?.tex2svg) return Promise.resolve();
  if (loading) return loading;
  window.MathJax = {
    svg: { fontCache: 'local' }, // glyph paths inside each SVG: 'global' needs a cache element only typesetting inserts
    startup: { typeset: false },
    options: { enableMenu: false },
  };
  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/vendor/mathjax-3.2.2-tex-svg.js';
    s.async = true;
    s.onload = () => {
      const ready = window.MathJax?.startup?.promise ?? Promise.resolve();
      ready.then(() => resolve(), reject);
    };
    s.onerror = () => {
      loading = null;
      reject(new Error('MathJax failed to load'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

const cache = new Map<string, string>();

/** The SVG markup for a formula, or null when MathJax can't draw it. */
export async function texToSvg(tex: string, display: boolean): Promise<string | null> {
  const k = `${display ? 'D' : 'I'}${tex}`;
  const hit = cache.get(k);
  if (hit !== undefined) return hit || null;
  await loadMathJax();
  const node = window.MathJax?.tex2svg?.(tex, { display });
  const svg = node?.querySelector('svg');
  const out = svg && !svg.querySelector('[data-mml-node="merror"]') ? svg.outerHTML : '';
  cache.set(k, out);
  return out || null;
}
