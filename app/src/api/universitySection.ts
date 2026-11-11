import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usePerson } from '@/lib/practice/hooks';

import { api, call } from './client';
import type { components } from './schema';
import { satMinimum, satRange, type UniversitySAT } from './universities';

// The university section (makonbook-api docs/platform-spec.md §24.5): every
// listed university to browse, with the facts the list carries, a page for
// each, and the student's own list.

type Schemas = components['schemas'];
export type UniversityFacts = Schemas['UniversityFacts'];
export type USDRange = Schemas['USDRange'];

export type Continent = 'Central Asia' | 'Europe' | 'North America' | 'Latin America' | 'East Asia' | 'South & Southeast Asia' | 'Middle East' | 'Africa' | 'Oceania';

const CONTINENT: Record<Continent, string> = {
  'Central Asia': 'UZ KZ KG TJ TM AZ GE AM',
  Europe: 'AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LT LU LV MT NL NO PL PT RO RS RU SE SI SK UA',
  'North America': 'US CA',
  'Latin America': 'AR BR CL CO CR CU DO EC GT HN MX PA PE PR PY UY VE',
  'East Asia': 'CN HK JP KR MO TW',
  'South & Southeast Asia': 'BD BN ID IN LK MY PH PK SG TH VN',
  'Middle East': 'AE BH IL IQ IR JO KW LB OM PS QA SA SY TR',
  Africa: 'EG ET GH KE MA NG SD TN TZ UG ZA',
  Oceania: 'AU NZ',
};
const CONTINENT_OF = new Map(Object.entries(CONTINENT).flatMap(([c, codes]) => codes.split(' ').map((code) => [code, c as Continent] as const)));
export const CONTINENTS = Object.keys(CONTINENT) as Continent[];
export const continentOf = (code: string): Continent | null => CONTINENT_OF.get(code) ?? null;

const dollars = (n: number) => '$' + n.toLocaleString('en-US');

/** "$12,400" or "$40,900–$53,100"; free is "Free". */
export function usd(r: USDRange | null | undefined): string | null {
  if (!r) return null;
  if (r.max === 0) return 'Free';
  return r.min === r.max ? dollars(r.min) : `${dollars(r.min)}–${dollars(r.max)}`;
}

/** Where a target sits against a university's admitted middle 50 %. */
export type Fit = { label: string; tone: 'good' | 'watch' | 'bad'; note: string };

export function fitOf(target: number | null | undefined, sat: UniversitySAT | null | undefined, acceptance: number | null | undefined): Fit | null {
  if (!target) return null;
  const r = satRange(sat);
  const min = satMinimum(sat);
  const hard = acceptance != null && acceptance < 0.15;
  if (r) {
    if (target >= r.p75) {
      return hard
        ? { label: 'Reach', tone: 'watch', note: `Your target ${target} is at the top of the admitted range, but only ${Math.round(acceptance * 100)}% of applicants get in.` }
        : { label: 'Strong', tone: 'good', note: `Your target ${target} is above most admitted students (${r.p25}–${r.p75}).` };
    }
    if (target >= r.p25) return { label: hard ? 'Reach' : 'Match', tone: hard ? 'watch' : 'good', note: `Your target ${target} is in the admitted middle 50% (${r.p25}–${r.p75}).` };
    return { label: 'Stretch', tone: 'bad', note: `Your target ${target} is below the admitted middle 50% (${r.p25}–${r.p75}).` };
  }
  if (min != null) {
    return target >= min
      ? { label: 'Meets minimum', tone: 'good', note: `Your target ${target} meets the published minimum of ${min}.` }
      : { label: 'Below minimum', tone: 'bad', note: `The published minimum is ${min}; your target is ${target}.` };
  }
  return null;
}

export const SAT_POLICY: Record<UniversitySAT['policy'], string> = {
  required: 'SAT required',
  optional: 'Test-optional',
  not_considered: 'SAT not considered',
  accepted: 'SAT accepted',
  unknown: 'SAT policy unknown',
};

const savedKey = (person: string) => ['universities-saved', person] as const;

/** The universities the student saved, newest first (ids). */
export function useSavedUniversities(enabled = true) {
  const person = usePerson();
  return useQuery({ queryKey: savedKey(person), enabled, queryFn: async () => (await call(api.GET('/v1/me/universities'))).saved.map((s) => s.id) });
}

/** Saves (or unsaves) at once on screen; puts it back if the server says no. */
export function useSaveUniversity() {
  const person = usePerson();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const path = { params: { path: { id } } };
      if (on) await call(api.PUT('/v1/me/universities/{id}', path));
      else await call(api.DELETE('/v1/me/universities/{id}', path));
    },
    onMutate: ({ id, on }) => {
      const before = queryClient.getQueryData<string[]>(savedKey(person));
      queryClient.setQueryData<string[]>(savedKey(person), (ids = []) => (on ? [id, ...ids.filter((x) => x !== id)] : ids.filter((x) => x !== id)));
      return { before };
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(savedKey(person), ctx?.before),
  });
}
