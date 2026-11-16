// ABOUTME: IndexedDB 封装（session_log 表）
// ABOUTME: 含配额异常自动整理（E-03：删最老记录直到写入成功）

import type { SessionLog } from './types';
import { loadFlags, saveFlags } from './storage';

const DB_NAME = 'brainfit-db';
const DB_VERSION = 1;
const STORE = 'session_log';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('playId', 'playId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    } catch (e) {
      reject(e instanceof Error ? e : new Error('IndexedDB unavailable'));
    }
  });
  return dbPromise;
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('tx failed'));
    tx.onabort = () => reject(tx.error ?? new Error('tx aborted'));
  });
}

/** 删除最老的一批记录（配额整理） */
async function trimOldest(count: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const idx = store.index('createdAt');
  await new Promise<void>((resolve) => {
    let removed = 0;
    const cursorReq = idx.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor || removed >= count) {
        resolve();
        return;
      }
      cursor.delete();
      removed++;
      cursor.continue();
    };
    cursorReq.onerror = () => resolve();
  });
  await txDone(tx).catch(() => undefined);
}

function markTrimmed(): void {
  const flags = loadFlags();
  if (!flags.storageTrimmed) {
    flags.storageTrimmed = true;
    saveFlags(flags);
  }
}

export async function addLog(entry: Omit<SessionLog, 'id'>): Promise<void> {
  // E-03：配额异常时删最老记录重试，最多 6 轮
  for (let round = 0; round < 6; round++) {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add(entry);
      await txDone(tx);
      return;
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      if (name === 'QuotaExceededError') {
        markTrimmed();
        await trimOldest(50).catch(() => undefined);
        continue;
      }
      // 其他错误（如无 IndexedDB）：静默，不打断游戏
      return;
    }
  }
}

export async function getAllLogs(): Promise<SessionLog[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    const rows = await new Promise<SessionLog[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as SessionLog[]) ?? []);
      req.onerror = () => reject(req.error ?? new Error('read failed'));
    });
    await txDone(tx).catch(() => undefined);
    return rows;
  } catch {
    return [];
  }
}

export async function clearLogs(): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    await txDone(tx);
  } catch {
    // 静默
  }
}
