export type PageEditorDraft = {
  version: 1
  key: string
  savedAt: number
  baselineUpdatedAt: string | null
  formValues: unknown
  theme: unknown
  nav?: {
    inNavbar: boolean
    inFooter: boolean
  }
}

const DB_NAME = "siab-editor-drafts"
const DB_VERSION = 1
const STORE_NAME = "page-drafts"
const LOCAL_STORAGE_PREFIX = "siab:page-draft:v1:"

const localStorageKey = (key: string) => `${LOCAL_STORAGE_PREFIX}${key}`

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" })
      }
    }
    request.onerror = () => reject(request.error ?? new Error("Failed to open draft database"))
    request.onsuccess = () => resolve(request.result)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const request = run(tx.objectStore(STORE_NAME))
    request.onerror = () => reject(request.error ?? new Error("Draft store request failed"))
    request.onsuccess = () => resolve(request.result)
    tx.oncomplete = () => db.close()
    tx.onerror = () => {
      db.close()
      reject(tx.error ?? new Error("Draft store transaction failed"))
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error ?? new Error("Draft store transaction aborted"))
    }
  })
}

function readLocalStorageDraft(key: string): PageEditorDraft | null {
  if (typeof localStorage === "undefined") return null
  const raw = localStorage.getItem(localStorageKey(key))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PageEditorDraft
    return parsed?.version === 1 && parsed.key === key ? parsed : null
  } catch {
    return null
  }
}

function writeLocalStorageDraft(draft: PageEditorDraft) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(localStorageKey(draft.key), JSON.stringify(draft))
}

function deleteLocalStorageDraft(key: string) {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(localStorageKey(key))
}

export async function readPageEditorDraft(key: string): Promise<PageEditorDraft | null> {
  try {
    const draft = await withStore<PageEditorDraft | undefined>("readonly", (store) => store.get(key))
    return draft?.version === 1 ? draft : null
  } catch {
    return readLocalStorageDraft(key)
  }
}

export async function writePageEditorDraft(draft: PageEditorDraft): Promise<void> {
  try {
    await withStore<IDBValidKey>("readwrite", (store) => store.put(draft))
    deleteLocalStorageDraft(draft.key)
  } catch {
    writeLocalStorageDraft(draft)
  }
}

export async function deletePageEditorDraft(key: string): Promise<void> {
  try {
    await withStore<undefined>("readwrite", (store) => store.delete(key))
  } catch {
    // IndexedDB may be unavailable in private / constrained contexts. The
    // fallback store is still cleared below.
  }
  deleteLocalStorageDraft(key)
}
