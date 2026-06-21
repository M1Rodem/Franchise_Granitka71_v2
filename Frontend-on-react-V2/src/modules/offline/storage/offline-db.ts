import { OFFLINE_DB_NAME, OFFLINE_DB_VERSION, OFFLINE_STORE_NAMES } from '@/modules/offline/storage/offline-db.types'

let dbPromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      // Существующие хранилища
      if (!db.objectStoreNames.contains(OFFLINE_STORE_NAMES.orders)) {
        db.createObjectStore(OFFLINE_STORE_NAMES.orders, {
          keyPath: 'localId',
        })
      }

      if (!db.objectStoreNames.contains(OFFLINE_STORE_NAMES.media)) {
        const mediaStore = db.createObjectStore(OFFLINE_STORE_NAMES.media, {
          keyPath: 'id',
        })
        mediaStore.createIndex('orderLocalId', 'orderLocalId', {
          unique: false,
        })
      }

      if (!db.objectStoreNames.contains(OFFLINE_STORE_NAMES.plots)) {
        const plotsStore = db.createObjectStore(OFFLINE_STORE_NAMES.plots, {
          keyPath: 'id',
        })
        plotsStore.createIndex('name', 'name', { unique: false })
        plotsStore.createIndex('isActive', 'isActive', { unique: false })
      }

      if (!db.objectStoreNames.contains(OFFLINE_STORE_NAMES.syncQueue)) {
        const syncQueueStore = db.createObjectStore(OFFLINE_STORE_NAMES.syncQueue, {
          keyPath: 'orderLocalId',
        })
        syncQueueStore.createIndex('status', 'status', {
          unique: false,
        })
      }

      // Хранилище сотрудников
      if (!db.objectStoreNames.contains(OFFLINE_STORE_NAMES.employees)) {
        const employeesStore = db.createObjectStore(OFFLINE_STORE_NAMES.employees, {
          keyPath: 'id',
        })
        employeesStore.createIndex('username', 'username', {
          unique: false,
        })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function getOfflineDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase()
  }

  return dbPromise
}

function wrapRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await getOfflineDb()

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)

    Promise.resolve(action(store))
      .then((result) => {
        transaction.oncomplete = () => resolve(result)
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      })
      .catch(reject)
  })
}

export { wrapRequest }

