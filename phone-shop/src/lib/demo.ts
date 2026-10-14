import type { Device, Employee, GlobalAccount, Sale, Shop, Snapshot } from './types'
import { DEFAULT_PASSWORD_HASH } from './password'

function at(daysAgo: number, hour = 11, minute = 30): number {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d.getTime()
}

function firstOfMonth(offsetMonths: number, day: number, hour = 13): number {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offsetMonths)
  d.setDate(day)
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}

const pic = (seed: string) => `https://picsum.photos/seed/${seed}/900/900`

export const DEMO_ACCOUNTS: GlobalAccount[] = [
  { id: 'acc_owner', name: 'เจ้าของร้าน', email: 'owner@phone.shop', role: 'owner', password: DEFAULT_PASSWORD_HASH },
  { id: 'acc_admin', name: 'ผู้ดูแลระบบ', email: 'admin@phone.shop', role: 'admin', password: DEFAULT_PASSWORD_HASH },
]

export function makeDemoSnapshot(): Snapshot {
  const shops: Shop[] = [
    { id: 'shop1', name: 'ร้านมือถือ 1', imageRef: pic('shopfront1'), phone: '081-000-0001', summaryDay: 31, ownerId: 'acc_owner' },
    { id: 'shop2', name: 'ร้านมือถือ 2', imageRef: pic('shopfront2'), phone: '081-000-0002', summaryDay: 31, ownerId: 'acc_owner' },
  ]

  const employees: Employee[] = [
    { id: 'emp1', shopId: 'shop1', name: 'สมชาย ใจดี', email: 'somchai@shop1.com', role: 'staff', status: 'active', password: DEFAULT_PASSWORD_HASH },
    { id: 'emp2', shopId: 'shop1', name: 'มาลี สุขสันต์', email: 'malee@shop1.com', role: 'staff', status: 'active', password: DEFAULT_PASSWORD_HASH },
    { id: 'emp3', shopId: 'shop2', name: 'อารี พงษ์ทอง', email: 'aree@shop2.com', role: 'staff', status: 'active', password: DEFAULT_PASSWORD_HASH },
    {
      id: 'emp4',
      shopId: 'shop2',
      name: 'ปิด เก่าเก็บ',
      email: 'old@shop2.com',
      role: 'staff',
      status: 'deleted',
      deletedBy: 'เจ้าของร้าน',
    },
  ]

  const devices: Device[] = [
    {
      id: 'd1', shopId: 'shop1', model: 'iPhone 14 Pro', color: 'Deep Purple', memory: '256GB',
      battery: '91%', imei: '356789101112131', condition: 'สภาพสวย พร้อมกล่อง',
      costPrice: 24000, sellPrice: 27900, images: { device: [pic('ip14a'), pic('ip14b')], idCard: pic('id1') },
      createdAt: at(9), createdBy: 'สมชาย ใจดี',
    },
    {
      id: 'd2', shopId: 'shop1', model: 'Samsung S23', color: 'Black', memory: '128GB',
      battery: '88%', imei: '356789101112132', condition: 'มีรอยขอบเล็กน้อย',
      costPrice: 15000, sellPrice: 18900, images: { device: [pic('s23a')], idCard: null },
      createdAt: at(7), createdBy: 'มาลี สุขสันต์',
    },
    {
      id: 'd3', shopId: 'shop1', model: 'iPhone 13', color: 'Blue', memory: '128GB',
      battery: '85%', imei: '356789101112133', condition: 'เครื่องสวย ไม่มีรอย',
      costPrice: 13500, sellPrice: 16900, images: { device: [pic('ip13a'), pic('ip13b')], idCard: pic('id3') },
      createdAt: at(5), createdBy: 'สมชาย ใจดี',
    },
    {
      id: 'd4', shopId: 'shop1', model: 'Oppo Reno 10', color: 'Silver', memory: '256GB',
      battery: '93%', imei: '356789101112134', condition: 'ใหม่มาก',
      costPrice: 9800, sellPrice: 12500, images: { device: [pic('oppo1')], idCard: null },
      createdAt: at(3), createdBy: 'มาลี สุขสันต์',
    },
    {
      id: 'd5', shopId: 'shop2', model: 'iPhone 15', color: 'Green', memory: '256GB',
      battery: '97%', imei: '356789101112135', condition: 'สภาพเหมือนใหม่',
      costPrice: 26500, sellPrice: 30900, images: { device: [pic('ip15a')], idCard: pic('id5') },
      createdAt: at(6), createdBy: 'อารี พงษ์ทอง',
    },
    {
      id: 'd6', shopId: 'shop2', model: 'Xiaomi 13T', color: 'Black', memory: '256GB',
      battery: '90%', imei: '356789101112136', condition: 'พร้อมใช้งาน',
      costPrice: 11000, sellPrice: 13900, images: { device: [pic('mi13')], idCard: null },
      createdAt: at(4), createdBy: 'อารี พงษ์ทอง',
    },
    {
      id: 'd7', shopId: 'shop2', model: 'Vivo V29', color: 'Rose Gold', memory: '128GB',
      battery: '89%', imei: '356789101112137', condition: 'มีรอยบากเล็ก',
      costPrice: 8200, sellPrice: 10500, images: { device: [pic('vivo1'), pic('vivo2')], idCard: null },
      createdAt: at(2), createdBy: 'อารี พงษ์ทอง',
    },
  ]

  const sales: Sale[] = [
    {
      id: 's1', shopId: 'shop1', deviceId: 'ds1', model: 'iPhone 12', color: 'White', memory: '64GB',
      battery: '84%', imei: '356789101112201', condition: 'สวย', costPrice: 10500, sellPrice: 12900,
      profit: 2400, paymentMethod: 'cash', freebies: { case: true, film: true, other: false, otherNote: '' },
      soldAt: at(0, 10), soldBy: 'สมชาย ใจดี', hadImages: true,
    },
    {
      id: 's2', shopId: 'shop1', deviceId: 'ds2', model: 'Samsung A54', color: 'Lime', memory: '128GB',
      battery: '90%', imei: '356789101112202', condition: 'สวย', costPrice: 8900, sellPrice: 11200,
      profit: 2300, paymentMethod: 'transfer', freebies: { case: false, film: true, other: false, otherNote: '' },
      soldAt: at(0, 15), soldBy: 'มาลี สุขสันต์', hadImages: false,
    },
    {
      id: 's3', shopId: 'shop1', deviceId: 'ds3', model: 'iPhone 11', color: 'Black', memory: '128GB',
      battery: '80%', imei: '356789101112203', condition: 'ทั่วไป', costPrice: 7800, sellPrice: 9900,
      profit: 2100, paymentMethod: 'card', freebies: { case: true, film: false, other: true, otherNote: 'หูฟัง' },
      soldAt: at(2, 12), soldBy: 'สมชาย ใจดี', hadImages: true,
    },
    {
      id: 's4', shopId: 'shop1', deviceId: 'ds4', model: 'Oppo A78', color: 'Blue', memory: '128GB',
      battery: '92%', imei: '356789101112204', condition: 'สวย', costPrice: 5200, sellPrice: 6900,
      profit: 1700, paymentMethod: 'cash', freebies: { case: false, film: false, other: false, otherNote: '' },
      soldAt: at(5, 16), soldBy: 'มาลี สุขสันต์', hadImages: false,
    },
    {
      id: 's5', shopId: 'shop1', deviceId: 'ds5', model: 'iPhone 13 Pro', color: 'Gold', memory: '256GB',
      battery: '87%', imei: '356789101112205', condition: 'สวย', costPrice: 19000, sellPrice: 22500,
      profit: 3500, paymentMethod: 'transfer', freebies: { case: true, film: true, other: false, otherNote: '' },
      soldAt: firstOfMonth(0, 3, 14), soldBy: 'สมชาย ใจดี', hadImages: true,
    },
    {
      id: 's6', shopId: 'shop1', deviceId: 'ds6', model: 'Samsung S22', color: 'White', memory: '128GB',
      battery: '86%', imei: '356789101112206', condition: 'ดี', costPrice: 13000, sellPrice: 15900,
      profit: 2900, paymentMethod: 'cash', freebies: { case: false, film: true, other: false, otherNote: '' },
      soldAt: firstOfMonth(0, 8, 11), soldBy: 'มาลี สุขสันต์', hadImages: false,
    },
    {
      id: 's7', shopId: 'shop1', deviceId: 'ds7', model: 'Xiaomi 12', color: 'Gray', memory: '256GB',
      battery: '88%', imei: '356789101112207', condition: 'สวย', costPrice: 9500, sellPrice: 11900,
      profit: 2400, paymentMethod: 'card', freebies: { case: true, film: false, other: false, otherNote: '' },
      soldAt: firstOfMonth(-1, 5, 13), soldBy: 'สมชาย ใจดี', hadImages: true,
    },
    {
      id: 's8', shopId: 'shop1', deviceId: 'ds8', model: 'iPhone 14', color: 'Midnight', memory: '128GB',
      battery: '95%', imei: '356789101112208', condition: 'สวย', costPrice: 21000, sellPrice: 24900,
      profit: 3900, paymentMethod: 'transfer', freebies: { case: true, film: true, other: false, otherNote: '' },
      soldAt: firstOfMonth(-1, 12, 10), soldBy: 'มาลี สุขสันต์', hadImages: true,
    },
    {
      id: 's9', shopId: 'shop1', deviceId: 'ds9', model: 'Vivo Y36', color: 'Purple', memory: '128GB',
      battery: '90%', imei: '356789101112209', condition: 'ดี', costPrice: 4900, sellPrice: 6500,
      profit: 1600, paymentMethod: 'cash', freebies: { case: false, film: false, other: false, otherNote: '' },
      soldAt: firstOfMonth(-2, 20, 15), soldBy: 'สมชาย ใจดี', hadImages: false,
    },
    {
      id: 's10', shopId: 'shop2', deviceId: 'ds10', model: 'iPhone 15 Pro', color: 'Blue Titanium', memory: '256GB',
      battery: '99%', imei: '356789101112210', condition: 'ใหม่', costPrice: 32000, sellPrice: 36900,
      profit: 4900, paymentMethod: 'card', freebies: { case: true, film: true, other: true, otherNote: 'ที่ชาร์จ' },
      soldAt: at(1, 13), soldBy: 'อารี พงษ์ทอง', hadImages: true,
    },
    {
      id: 's11', shopId: 'shop2', deviceId: 'ds11', model: 'Samsung S23 Ultra', color: 'Green', memory: '512GB',
      battery: '94%', imei: '356789101112211', condition: 'สวย', costPrice: 24000, sellPrice: 28900,
      profit: 4900, paymentMethod: 'transfer', freebies: { case: false, film: true, other: false, otherNote: '' },
      soldAt: firstOfMonth(0, 6, 12), soldBy: 'อารี พงษ์ทอง', hadImages: false,
    },
  ]

  return { shops, employees, accounts: DEMO_ACCOUNTS, devices, sales }
}
