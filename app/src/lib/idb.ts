// A small key-value store on IndexedDB, for what is too big for localStorage:
// the word deck and each person's review log (years of reviews run to
// megabytes). One database, one object store, string keys.

const DB = 'makonbook';
const STORE = 'kv';

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error ?? new Error('IndexedDB failed to open'));
    };
  });
  return opening;
}

function request<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
      }),
  );
}

export const idbGet = <T>(key: string): Promise<T | undefined> => request<T | undefined>('readonly', (s) => s.get(key));
export const idbSet = (key: string, value: unknown): Promise<unknown> => request('readwrite', (s) => s.put(value, key));
export const idbDelete = (key: string): Promise<unknown> => request('readwrite', (s) => s.delete(key));
