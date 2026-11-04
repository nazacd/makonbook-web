import { useEffect } from 'react';

/** The browser tab's title: "Dashboard · SATMAKON". */
export function useTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · SATMAKON` : 'SATMAKON';
  }, [title]);
}
