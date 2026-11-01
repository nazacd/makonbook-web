// A small key-value store on IndexedDB, for what is too big for localStorage:
// the word deck, each person's review log (years of reviews run to
// megabytes) and the practice tests' packages. One database, one object store, string keys.

const DB = 'makonbook';
const STORE = 'kv';

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      // Closed under us (site data cleared): open again next time.
      req.result.onclose = () => (opening = null);
      resolve(req.result);
    };
    req.onerror = () => {
      opening = null;
      reject(req.error ?? new Error('IndexedDB failed to open'));
    };
  });
  return opening;
}

// Reads answer when the request succeeds; writes when the transaction has
// committed, so "saved" means saved.
function request<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        if (mode === 'readonly') req.onsuccess = () => resolve(req.result);
        else tx.oncomplete = () => resolve(req.result);
        tx.onerror = tx.onabort = () => reject(tx.error ?? req.error ?? new Error('IndexedDB request failed'));
      }),
  );
}

export const idbGet = <T>(key: string): Promise<T | undefined> => request<T | undefined>('readonly', (s) => s.get(key));
export const idbSet = (key: string, value: unknown): Promise<unknown> => request('readwrite', (s) => s.put(value, key));
export const idbDelete = (key: string): Promise<unknown> => request('readwrite', (s) => s.delete(key));

/**
 * Reads a value and writes back what `change` makes of it, in one
 * transaction: another tab's write can't land in between and be lost.
 * Answers the value written.
 */
export function idbUpdate<T>(key: string, change: (old: T | undefined) => T): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        let next: T;
        const get = store.get(key);
        get.onsuccess = () => {
          next = change(get.result as T | undefined);
          store.put(next, key);
        };
        tx.oncomplete = () => resolve(next);
        tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('IndexedDB update failed'));
      }),
  );
}
