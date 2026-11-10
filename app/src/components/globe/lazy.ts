import { lazy } from 'react';

/** The globe, loaded on first use: three.js comes only with the screens that show it. */
export const Globe = lazy(() => import('./Globe'));
