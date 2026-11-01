import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { ApiError, api, call } from '@/api/client';
import { useMe } from '@/api/queries';

import {
  clearRun,
  loadAttempts,
  loadPackage,
  loadRun,
  loadRuns,
  markRejected,
  markUploaded,
  mergeFromServer,
  savePackage,
  saveRun,
  type Person,
  type Run,
  type StoredPackage,
} from './local';
import type { CatalogTest, OwnAttempt, ServerAttempt } from './types';

/** Whose practice this browser shows: the signed-in person. */
export function usePerson(): Person {
  const me = useMe().data;
  return me ? `${me.kind}-${me.id}` : 'nobody';
}

// What is in this browser lives in React Query too, under
// ['practice-local', …], so screens update when it changes.
const localKey = (person: Person, ...rest: string[]) => ['practice-local', person, ...rest] as const;

export function useCatalog() {
  return useQuery({
    queryKey: ['practice-catalog'],
    queryFn: async (): Promise<CatalogTest[]> => (await call(api.GET('/v1/practice/tests'))).tests,
  });
}

export function useRuns() {
  const person = usePerson();
  return useQuery({ queryKey: localKey(person, 'runs'), queryFn: () => loadRuns(person), staleTime: Infinity });
}

export function useRun(code: string) {
  const person = usePerson();
  return useQuery({ queryKey: localKey(person, 'runs', code), queryFn: () => loadRun(person, code), staleTime: Infinity });
}

export function useLocalAttempts() {
  const person = usePerson();
  return useQuery({ queryKey: localKey(person, 'attempts'), queryFn: () => loadAttempts(person), staleTime: Infinity });
}

/** Image links are good for 6 hours; fetch again a little before. */
const LINK_MARGIN_MS = 10 * 60_000;

async function fetchPackage(code: string, version: number | undefined): Promise<StoredPackage> {
  const res = await call(
    api.GET('/v1/practice/tests/{code}/package', { params: { path: { code }, query: version == null ? {} : { version } } }),
  );
  const stored: StoredPackage = { package: res.package, images: res.images, expires_at: res.expires_at };
  savePackage(stored);
  return stored;
}

/**
 * A test's package with its image links: from this browser when it has it
 * and the links are still good, otherwise from the API (and kept). With no
 * version, the latest.
 */
export function usePackage(code: string, version: number | undefined, enabled = true) {
  return useQuery({
    queryKey: ['practice-package', code, version ?? 'latest'],
    queryFn: async () => {
      const stored = version == null ? null : loadPackage(code, version);
      if (stored && Date.parse(stored.expires_at) - Date.now() > LINK_MARGIN_MS) return stored;
      try {
        return await fetchPackage(code, version);
      } catch (e) {
        // Offline with a package whose links ran out: the text still shows.
        if (stored && e instanceof ApiError && e.status === 0) return stored;
        throw e;
      }
    },
    enabled: enabled && code !== '',
    staleTime: (query) => (query.state.data ? Math.max(0, Date.parse(query.state.data.expires_at) - Date.now() - LINK_MARGIN_MS) : 0),
  });
}

/**
 * Saves or removes the test in progress: in this browser, and at once in
 * what the screens show.
 */
export function useRunStore() {
  const person = usePerson();
  const queryClient = useQueryClient();
  return useMemo(() => {
    const put = (code: string, run: Run | null) => {
      queryClient.setQueryData(localKey(person, 'runs', code), run);
      queryClient.setQueryData<Record<string, Run>>(localKey(person, 'runs'), (all) => {
        const next = { ...all };
        if (run) next[code] = run;
        else delete next[code];
        return next;
      });
    };
    return {
      save: (run: Run) => {
        put(run.code, run);
        saveRun(person, run);
      },
      clear: (code: string) => {
        put(code, null);
        clearRun(person, code);
      },
    };
  }, [person, queryClient]);
}

/** Re-reads what is in this browser after a write. */
export function useRefreshLocal() {
  const queryClient = useQueryClient();
  const person = usePerson();
  return () => queryClient.invalidateQueries({ queryKey: localKey(person) });
}

/**
 * Sends finished attempts the server doesn't have yet, then brings this
 * browser's list in line with the server's (the phone's attempts, or an
 * earlier session here). Runs when the Practice screens are shown and when
 * the tab comes back into focus; a refused attempt is kept but not sent again.
 */
export function useUploadAttempts(enabled: boolean) {
  const person = usePerson();
  const refresh = useRefreshLocal();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['practice-upload', person],
    enabled,
    queryFn: async () => {
      const pending = loadAttempts(person).filter((a) => !a.uploaded && !a.rejected);
      let sent = 0;
      let online = true;
      for (const a of pending) {
        try {
          const server = await call(
            api.POST('/v1/practice/attempts', {
              body: {
                id: a.id,
                test: a.code,
                version: a.version,
                sections: a.sections,
                started_at: a.started_at,
                finished_at: a.finished_at,
                answers: a.answers.map((x) => ({ ...x, module: x.module as 1 | 2 })),
              },
            }),
          );
          markUploaded(person, server as ServerAttempt);
          sent++;
        } catch (e) {
          if (e instanceof ApiError && (e.code === 'invalid_attempt' || e.code === 'attempt_id_taken')) {
            markRejected(person, a.id, e.message);
          } else {
            online = false; // offline or the server is down: try again later
            break;
          }
        }
      }
      let added = 0;
      if (online) {
        try {
          const { attempts } = await call(api.GET('/v1/me/practice/attempts'));
          added = mergeFromServer(person, attempts as OwnAttempt[]);
          queryClient.setQueryData(['practice-mine'], attempts);
        } catch {
          // Offline: this browser's own attempts still show.
        }
      }
      if (sent > 0 || pending.length > 0 || added > 0) {
        void refresh();
        void queryClient.invalidateQueries({ queryKey: ['practice-mine'] });
      }
      return pending.length - sent;
    },
  });
}

/** The student's attempts as the server has them (from any device). */
export function useServerAttempts(enabled: boolean) {
  return useQuery({
    queryKey: ['practice-mine'],
    enabled,
    queryFn: async (): Promise<OwnAttempt[]> => (await call(api.GET('/v1/me/practice/attempts'))).attempts as OwnAttempt[],
  });
}

/** Sends one attempt right away (after finishing a test); the queue does the rest. */
export function useSendNow() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: async () => queryClient.invalidateQueries({ queryKey: ['practice-upload'] }) });
}
