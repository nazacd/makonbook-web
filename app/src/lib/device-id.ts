// One random id per browser, sent with the login as `device_id` (the API's
// LoginRequest). Kept in localStorage, so it lasts as long as the sign-in.
const KEY = 'mb.device_id';

export function deviceId(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Storage blocked (private mode with storage off): a fresh id each time.
    return crypto.randomUUID();
  }
}
