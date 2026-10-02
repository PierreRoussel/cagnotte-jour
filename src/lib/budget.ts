export type ChargeType = 'fixed' | 'variable'

export type Charge = {
  id: string
  name: string
  amount: number
  type: ChargeType
}

export type DailySpend = {
  id: string
  date: string // YYYY-MM-DD
  amount: number
  note?: string
}

export type BudgetData = {
  salary: number
  savings: number
  charges: Charge[]
  spends: DailySpend[]
}

export const STORAGE_KEY = 'cagnotte-jour-v1'

export const defaultData: BudgetData = {
  salary: 0,
  savings: 0,
  charges: [],
  spends: [],
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function monthKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function daysInMonth(date = new Date()): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

export function dayOfMonth(date = new Date()): number {
  return date.getDate()
}

export function sumCharges(charges: Charge[], type?: ChargeType): number {
  return charges
    .filter((c) => (type ? c.type === type : true))
    .reduce((acc, c) => acc + (Number.isFinite(c.amount) ? c.amount : 0), 0)
}

export function suggestSavings(salary: number, fixedTotal: number): number {
  const base = Math.max(0, salary - fixedTotal)
  return Math.round((base * 0.2) / 10) * 10
}

export function pleasureBudget(data: BudgetData): number {
  const fixed = sumCharges(data.charges, 'fixed')
  const variable = sumCharges(data.charges, 'variable')
  return data.salary - fixed - variable - data.savings
}

export function monthSpends(spends: DailySpend[], date = new Date()): DailySpend[] {
  const prefix = monthKey(date)
  return spends.filter((s) => s.date.startsWith(prefix))
}

export function spentOnDate(spends: DailySpend[], dateKey: string): number {
  return spends
    .filter((s) => s.date === dateKey)
    .reduce((acc, s) => acc + s.amount, 0)
}

export function spentBeforeDate(spends: DailySpend[], dateKey: string): number {
  return spends
    .filter((s) => s.date < dateKey)
    .reduce((acc, s) => acc + s.amount, 0)
}

export type CagnotteSnapshot = {
  pleasure: number
  daysInMonth: number
  dayOfMonth: number
  dailyRate: number
  accrued: number
  spentMonth: number
  spentToday: number
  carriedOver: number
  available: number
  fixedTotal: number
  variableTotal: number
  suggestedSavings: number
}

export function computeCagnotte(data: BudgetData, date = new Date()): CagnotteSnapshot {
  const pleasure = pleasureBudget(data)
  const dim = daysInMonth(date)
  const day = dayOfMonth(date)
  const dailyRate = dim > 0 ? pleasure / dim : 0
  const key = todayKey(date)
  const spends = monthSpends(data.spends, date)
  const spentMonth = spends.reduce((acc, s) => acc + s.amount, 0)
  const spentToday = spentOnDate(spends, key)
  const spentBefore = spentBeforeDate(spends, key)
  const accrued = dailyRate * day
  const carriedOver = dailyRate * (day - 1) - spentBefore
  const available = accrued - spentMonth
  const fixedTotal = sumCharges(data.charges, 'fixed')
  const variableTotal = sumCharges(data.charges, 'variable')

  return {
    pleasure,
    daysInMonth: dim,
    dayOfMonth: day,
    dailyRate,
    accrued,
    spentMonth,
    spentToday,
    carriedOver,
    available,
    fixedTotal,
    variableTotal,
    suggestedSavings: suggestSavings(data.salary, fixedTotal),
  }
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value)
}

export function loadBudget(): BudgetData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaultData }
    const parsed = JSON.parse(raw) as Partial<BudgetData>
    return {
      salary: Number(parsed.salary) || 0,
      savings: Number(parsed.savings) || 0,
      charges: Array.isArray(parsed.charges) ? parsed.charges : [],
      spends: Array.isArray(parsed.spends) ? parsed.spends : [],
    }
  } catch {
    return { ...defaultData }
  }
}

export function saveBudget(data: BudgetData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function createId(): string {
  return crypto.randomUUID()
}
