import { createContext, use, useEffect, useState, type ReactNode } from 'react';

// Appearance: System, Light or Dark, chosen in Profile and kept in this
// browser. styles.css reads `data-theme` on <html>; without it the colour
// scheme follows the system, as on the phone (src/lib/appearance.tsx there).
export type AppearanceMode = 'system' | 'light' | 'dark';

const KEY = 'mb.appearance';

function saved(): AppearanceMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const AppearanceContext = createContext<{ mode: AppearanceMode; setMode: (m: AppearanceMode) => void } | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppearanceMode>(saved);
  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
    try {
      if (mode === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, mode);
    } catch {
      // Not saved: the choice lasts as long as the page.
    }
  }, [mode]);
  return <AppearanceContext value={{ mode, setMode }}>{children}</AppearanceContext>;
}

export function useAppearance() {
  const value = use(AppearanceContext);
  if (!value) throw new Error('useAppearance must be used inside <AppearanceProvider>');
  return value;
}
