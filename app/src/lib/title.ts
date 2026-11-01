import { useEffect } from 'react';

/** The browser tab's title: "Classes · MakonBook". */
export function useTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · MakonBook` : 'MakonBook';
  }, [title]);
}
