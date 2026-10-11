import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import type { Backend, Device, Employee, GlobalAccount, Sale, Shop } from './types'

export function firebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }
}

export function isFirebaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID)
}

function getDb(): Firestore {
  const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig())
  return getFirestore(app)
}

export function createFirestoreBackend(): Backend {
  const db = getDb()

  async function loadAll<T>(name: string): Promise<T[]> {
    const snap = await getDocs(collection(db, name))
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T)
  }

  return {
    mode: 'firebase',
    async load() {
      const [shops, employees, accounts, devices, sales] = await Promise.all([
        loadAll<Shop>('shops'),
        loadAll<Employee>('employees'),
        loadAll<GlobalAccount>('accounts'),
        loadAll<Device>('devices'),
        loadAll<Sale>('sales'),
      ])
      return { shops, employees, accounts, devices, sales }
    },
    async upsertDevice(device) {
      await setDoc(doc(db, 'devices', device.id), { ...device, id: device.id })
    },
    async deleteDevice(id) {
      await deleteDoc(doc(db, 'devices', id))
    },
    async upsertSale(sale) {
      await setDoc(doc(db, 'sales', sale.id), { ...sale, id: sale.id })
    },
    async deleteSale(id) {
      await deleteDoc(doc(db, 'sales', id))
    },
    async upsertShop(shop) {
      await setDoc(doc(db, 'shops', shop.id), { ...shop, id: shop.id })
    },
    async deleteShop(id) {
      await deleteDoc(doc(db, 'shops', id))
    },
    async upsertEmployee(employee) {
      await setDoc(doc(db, 'employees', employee.id), { ...employee, id: employee.id })
    },
    async deleteEmployee(id) {
      await deleteDoc(doc(db, 'employees', id))
    },
    async upsertAccount(account) {
      await setDoc(doc(db, 'accounts', account.id), { ...account, id: account.id })
    },
    async seed(snapshot) {
      const batch = writeBatch(db)
      snapshot.shops.forEach((x) => batch.set(doc(db, 'shops', x.id), { ...x, id: x.id }))
      snapshot.employees.forEach((x) => batch.set(doc(db, 'employees', x.id), { ...x, id: x.id }))
      snapshot.accounts.forEach((x) => batch.set(doc(db, 'accounts', x.id), { ...x, id: x.id }))
      snapshot.devices.forEach((x) => batch.set(doc(db, 'devices', x.id), { ...x, id: x.id }))
      snapshot.sales.forEach((x) => batch.set(doc(db, 'sales', x.id), { ...x, id: x.id }))
      await batch.commit()
    },
  }
}
