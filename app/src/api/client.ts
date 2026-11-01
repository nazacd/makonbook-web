import createClient from 'openapi-fetch';

import type { components, paths } from './schema';

export type Schemas = components['schemas'];

// Same origin: the edge nginx (and the dev server) pass /v1/ to the API, so
// the base URL is empty. The bearer token is kept in localStorage for now
// (docs/handoff.md section 6) and added to every request here.
const TOKEN_KEY = 'mb.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the session lasts as long as the page.
  }
}

/** Called on any 401 of a signed-in request: the session is gone. */
let onSignedOut: (() => void) | null = null;
export function setSignedOutHandler(handler: (() => void) | null): void {
  onSignedOut = handler;
}

export const api = createClient<paths>({ baseUrl: '' });

api.use({
  onRequest({ request }) {
    const token = getToken();
    if (token && !request.headers.has('Authorization')) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  },
  onResponse({ request, response }) {
    // A 401 on an authenticated call means the session ended (logged out,
    // password changed elsewhere, person no longer active): sign out locally.
    if (response.status === 401 && request.headers.has('Authorization')) {
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
    throw new ApiError(0, 'network', 'Can’t reach MakonBook. Check the connection and try again.');
  }
  if (res.response.ok) return res.data as T;
  const body = (res.error ?? {}) as {
    error?: { code?: string; message?: string; request_id?: string };
  };
  const retryAfter = Number(res.response.headers.get('Retry-After'));
  throw new ApiError(
    res.response.status,
    body.error?.code ?? 'unknown',
    body.error?.message ?? `Unexpected answer (${res.response.status}).`,
    body.error?.request_id,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  );
}
