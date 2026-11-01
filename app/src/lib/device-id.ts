// One random id per browser, sent with the login as `device_id` (the API's
// LoginRequest). Kept in localStorage, so it lasts as long as the sign-in.
const KEY = 'mb.device_id';

export function deviceId(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    const id = uuid();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Storage blocked (private mode with storage off): a fresh id each time.
    return uuid();
  }
}

/** A random UUID. `crypto.randomUUID` exists only on https and localhost;
 * the dev server opened from a phone over the LAN (http://192.168…) has the
 * rest of WebCrypto, so build one from random bytes there. */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40; // version 4
  b[8] = (b[8]! & 0x3f) | 0x80; // variant
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
