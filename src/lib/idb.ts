type KvValue = string

const DB_NAME = 'reef-system'
const STORE_NAME = 'kv'
const DB_VERSION = 1

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB indisponível'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const withStore = async <T,>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
) => {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const request = fn(store)
    const result = await new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    return result
  } finally {
    db.close()
  }
}

export const idbGet = async (key: string) => {
  const value = await withStore<KvValue | undefined>('readonly', (store) => store.get(key))
  return typeof value === 'string' ? value : null
}

export const idbSet = async (key: string, value: string) => {
  await withStore('readwrite', (store) => store.put(value, key))
}

export const idbDel = async (key: string) => {
  await withStore('readwrite', (store) => store.delete(key))
}

