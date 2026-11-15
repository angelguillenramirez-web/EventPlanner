/** Large files (PDFs of any size) live in the browser's IndexedDB, which holds far more than localStorage. */
const DB = "fiesta-blobs", STORE = "files";
const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});
const run = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  return new Promise<T>((resolve, reject) => { const req = fn(db.transaction(STORE, mode).objectStore(STORE)); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
};
export const putBlob = (id: string, b: Blob) => run("readwrite", (s) => s.put(b, id));
export const getBlob = (id: string) => run<Blob | undefined>("readonly", (s) => s.get(id));
export const delBlob = (id: string) => run("readwrite", (s) => s.delete(id)).catch(() => undefined);
