// ─── IndexedDB adapter ────────────────────────────────────────────────────────
// Database "todo-app-db" v2:
//   todos – keyPath "id", one row per todo (tombstones included)
//   meta  – out-of-line string keys: device, theme, syncGroup, syncPeers
// v1 stores are dropped on upgrade (the app was never released).

import type { Todo } from "./todo-store"

const DB_NAME = "todo-app-db"
const DB_VERSION = 2
const TODOS = "todos"
const META = "meta"

let _db: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (_db) return _db
  _db = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      for (const old of ["store", "prefs"]) {
        if (db.objectStoreNames.contains(old)) db.deleteObjectStore(old)
      }
      if (!db.objectStoreNames.contains(TODOS)) db.createObjectStore(TODOS, { keyPath: "id" })
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
    }

    req.onsuccess = () => {
      const db = req.result
      // Let another tab upgrade instead of blocking it forever.
      db.onversionchange = () => {
        db.close()
        _db = null
      }
      resolve(db)
    }
    req.onerror = () => {
      _db = null
      reject(req.error)
    }
  })
  return _db
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

// ─── Todos ────────────────────────────────────────────────────────────────────

export async function readAllTodos(): Promise<Todo[]> {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const req = db.transaction(TODOS, "readonly").objectStore(TODOS).getAll()
      req.onsuccess = () => resolve(req.result as Todo[])
      req.onerror = () => reject(req.error)
    })
  } catch (e) {
    console.warn("IndexedDB read failed; running in memory", e)
    return []
  }
}

export async function putTodos(todos: Todo[]): Promise<void> {
  if (!todos.length) return
  try {
    const db = await openDB()
    const tx = db.transaction(TODOS, "readwrite")
    const store = tx.objectStore(TODOS)
    for (const t of todos) store.put(t)
    await done(tx)
  } catch (e) {
    console.warn("IndexedDB write failed", e)
  }
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export async function getMeta<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const req = db.transaction(META, "readonly").objectStore(META).get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return undefined
  }
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(META, "readwrite")
    tx.objectStore(META).put(value, key)
    await done(tx)
  } catch (e) {
    console.warn("IndexedDB meta write failed", e)
  }
}

export async function deleteMeta(key: string): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(META, "readwrite")
    tx.objectStore(META).delete(key)
    await done(tx)
  } catch {
    // ignore
  }
}

// ─── Theme preference ─────────────────────────────────────────────────────────

export async function readTheme(): Promise<boolean> {
  return (await getMeta<boolean>("theme")) ?? false
}

export function writeTheme(dark: boolean): Promise<void> {
  return setMeta("theme", dark)
}
