import { useQuery } from '@tanstack/react-query';

import { api, call } from './client';
import type { components } from './schema';

// Universities (makonbook-api docs/platform-spec.md §24): about 1500 (QS's
// top 1500, Uzbekistan's, the roadmaps'), for the dream-university globe in
// onboarding and the university cards. The list is loaded once; a student's
// dream university is in their goals (`useGoals`).

type Schemas = components['schemas'];
export type University = Schemas['UniversitySummary'];
export type UniversityDetail = Schemas['UniversityDetail'];
export type UniversitySAT = Schemas['UniversitySAT'];

export function useUniversities() {
  return useQuery({
    queryKey: ['universities'],
    queryFn: async () => (await call(api.GET('/v1/universities'))).universities,
    staleTime: Infinity,
  });
}

export function useUniversity(id: string | null) {
  return useQuery({
    queryKey: ['universities', id],
    enabled: !!id,
    queryFn: () => call(api.GET('/v1/universities/{id}', { params: { path: { id: id! } } })),
    staleTime: 60 * 60_000,
  });
}

/** Admitted students' middle 50 % (total), when the university publishes it. */
export function satRange(sat: UniversitySAT | null | undefined): { p25: number; p75: number } | null {
  const t = sat?.total;
  if (t?.p25 != null && t.p75 != null) return { p25: t.p25, p75: t.p75 };
  const m = sat?.math;
  const r = sat?.rw;
  if (m?.p25 != null && m.p75 != null && r?.p25 != null && r.p75 != null) return { p25: m.p25 + r.p25, p75: m.p75 + r.p75 };
  return null;
}

/** A published minimum total, where the university gives one instead. */
export const satMinimum = (sat: UniversitySAT | null | undefined) => sat?.minimum?.total ?? null;

/** The target the onboarding starts from: the middle of the admitted range, else the minimum. */
export function suggestedTarget(sat: UniversitySAT | null | undefined): number | null {
  const r = satRange(sat);
  if (r) return Math.round((r.p25 + r.p75) / 20) * 10;
  const min = satMinimum(sat);
  return min != null ? Math.ceil(min / 10) * 10 : null;
}

/** A country's English name, from its ISO code (the browser's own list). */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
