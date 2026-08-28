const DB = "ielts-drafts";
const STORE = "blobs";
const TTL_MS = 1000 * 60 * 60 * 24 * 7;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface DraftMeta {
  testId: string;
  answerId: string;
  createdAt: number;
}

export async function saveDraft(testId: string, answerId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  const meta: DraftMeta = { testId, answerId, createdAt: Date.now() };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, `${testId}:${answerId}`);
    tx.objectStore(STORE).put(meta, `${testId}:${answerId}:meta`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadDraft(testId: string, answerId: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const metaRequest = tx.objectStore(STORE).get(`${testId}:${answerId}:meta`);
    metaRequest.onsuccess = () => {
      const meta = metaRequest.result as { createdAt: number } | null;
      if (meta && Date.now() - meta.createdAt > TTL_MS) {
        tx.objectStore(STORE).delete(`${testId}:${answerId}`);
        tx.objectStore(STORE).delete(`${testId}:${answerId}:meta`);
        resolve(null);
        return;
      }
      const request = tx.objectStore(STORE).get(`${testId}:${answerId}`);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    };
    metaRequest.onerror = () => reject(metaRequest.error);
  });
}

export async function clearDraft(testId: string, answerId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(`${testId}:${answerId}`);
    tx.objectStore(STORE).delete(`${testId}:${answerId}:meta`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
