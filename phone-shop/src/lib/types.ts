export type PaymentMethod = 'cash' | 'transfer' | 'card'

export type Role = 'staff' | 'admin' | 'owner'

export type EmployeeStatus = 'active' | 'deleted'

export interface Shop {
  id: string
  name: string
  imageRef: string | null
  phone: string
  summaryDay?: number
  ownerId?: string
}

export interface Employee {
  id: string
  shopId: string
  name: string
  email: string
  role: Role
  status: EmployeeStatus
  deletedBy?: string
  avatarRef?: string | null
  password?: string
}

export interface GlobalAccount {
  id: string
  name: string
  email: string
  role: Role
  password?: string
}

export interface DeviceImages {
  device: string[]
  idCard: string | null
}

export interface DeviceChecklist {
  answers: Record<string, string>
  multiple: Record<string, string[]>
  parts: Record<string, string>
  checkedBy: string
  checkedAt: number
}

export interface Device {
  id: string
  shopId: string
  model: string
  color: string
  memory: string
  battery: string
  imei: string
  condition: string
  costPrice: number
  sellPrice: number
  images: DeviceImages
  createdAt: number
  createdBy: string
  checklist?: DeviceChecklist
}

export interface Freebies {
  case: boolean
  film: boolean
  other: boolean
  otherNote: string
}

export interface Sale {
  id: string
  shopId: string
  deviceId: string
  model: string
  color: string
  memory: string
  battery: string
  imei: string
  condition: string
  region?: string
  costPrice: number
  sellPrice: number
  profit: number
  paymentMethod: PaymentMethod
  freebies: Freebies
  soldAt: number
  soldBy: string
  soldById?: string
  hadImages: boolean
}

export interface Snapshot {
  shops: Shop[]
  employees: Employee[]
  accounts: GlobalAccount[]
  devices: Device[]
  sales: Sale[]
}

export interface Backend {
  readonly mode: 'local' | 'firebase'
  load(): Promise<Snapshot>
  subscribe(onData: (snapshot: Snapshot) => void, onError?: (error: unknown) => void): () => void
  upsertDevice(device: Device): Promise<void>
  deleteDevice(id: string): Promise<void>
  upsertSale(sale: Sale): Promise<void>
  deleteSale(id: string): Promise<void>
  upsertShop(shop: Shop): Promise<void>
  deleteShop(id: string): Promise<void>
  upsertEmployee(employee: Employee): Promise<void>
  deleteEmployee(id: string): Promise<void>
  upsertAccount(account: GlobalAccount): Promise<void>
  seed(snapshot: Snapshot): Promise<void>
}

export interface Session {
  id: string
  role: Role
  shopId: string | null
  name: string
  email: string
  signedInAt: number
}
