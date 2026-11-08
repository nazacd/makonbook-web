import createClient from 'openapi-fetch';

import type { components, paths } from './schema';

export type Schemas = components['schemas'];

// Same origin: the edge nginx (and the dev server) pass /v1/ to the API, so
// the base URL is empty. The bearer token is kept in localStorage for now
// (docs/handoff.md section 6) and added to every request here.
export const TOKEN_KEY = 'mb.token';

function stored(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

// This tab's session: read once, then changed only by signing in or out here,
// or when another tab does (AuthProvider listens and calls adoptToken). Not
// read from storage on every request, so a sign-in in another tab can't make
// this tab's requests go out as someone else.
let current: string | null = stored();

export function getToken(): string | null {
  return current;
}

export function setToken(token: string | null): void {
  current = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the session lasts as long as the page.
  }
}

/** Another tab signed in or out: follow it, without writing it back. */
export function adoptToken(token: string | null): void {
  current = token;
}

/**
 * For work that takes several requests (uploads, syncs): call at the start,
 * then check before each request and each write that the person it started
 * for is still the one signed in here.
 */
export function sameSession(): () => boolean {
  const at = current;
  return () => at !== null && current === at;
}

/** Called on any 401 of a signed-in request: the session is gone. */
let onSignedOut: (() => void) | null = null;
export function setSignedOutHandler(handler: (() => void) | null): void {
  onSignedOut = handler;
}

export const api = createClient<paths>({ baseUrl: '' });

api.use({
  onRequest({ request }) {
    if (current && !request.headers.has('Authorization')) {
      request.headers.set('Authorization', `Bearer ${current}`);
    }
    return request;
  },
  onResponse({ request, response }) {
    // A 401 on an authenticated call means the session ended (logged out,
    // password changed elsewhere, person no longer active): sign out locally.
    // Only for the token in use now: a late answer to a request made before
    // someone else signed in doesn't end their session.
    if (response.status === 401 && current && request.headers.get('Authorization') === `Bearer ${current}`) {
      setToken(null);
      onSignedOut?.();
    }
    return response;
  },
});

/** An error answer from the API. Branch on `code`, never on `message`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    /** From a 429's Retry-After header, in seconds. */
    readonly retryAfter?: number,
    /** For a rejected form: what is wrong, per field. */
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Result<T> = { data?: T; error?: unknown; response: Response };

/** Returns the data of a call, or throws an ApiError. */
export async function call<T>(promise: Promise<Result<T>>): Promise<T> {
  let res: Result<T>;
  try {
    res = await promise;
  } catch {
    throw new ApiError(0, 'network', 'Can’t reach SATMAKON. Check the connection and try again.');
  }
  if (res.response.ok) return res.data as T;
  const body = (res.error ?? {}) as {
    error?: { code?: string; message?: string; request_id?: string; fields?: Record<string, string> };
  };
  const retryAfter = Number(res.response.headers.get('Retry-After'));
  throw new ApiError(
    res.response.status,
    body.error?.code ?? 'unknown',
    body.error?.message ?? `Unexpected answer (${res.response.status}).`,
    body.error?.request_id,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    body.error?.fields,
  );
}
