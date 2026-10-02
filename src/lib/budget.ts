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

/** Lissage du quota : solde remis à 0, nouveau taux jusqu'à fin de mois. */
export type MonthSmooth = {
  month: string // YYYY-MM
  fromDay: number
  /** Dépenses du mois au moment du lissage */
  spentBaseline: number
}

export type BudgetData = {
  salary: number
  savings: number
  charges: Charge[]
  spends: DailySpend[]
  smooth: MonthSmooth | null
}

export const STORAGE_KEY = 'cagnotte-jour-v1'

export const defaultData: BudgetData = {
  salary: 0,
  savings: 0,
  charges: [],
  spends: [],
  smooth: null,
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
  /** Quota si on lissait maintenant (null si impossible). */
  smoothedDailyRate: number | null
  accrued: number
  spentMonth: number
  spentToday: number
  carriedOver: number
  available: number
  /** Jours sans dépenser pour repasser ≥ 0. null = impossible (quota nul). 0 = déjà positif. */
  daysUntilPositive: number | null
  recoversThisMonth: boolean
  isSmoothed: boolean
  canSmooth: boolean
  fixedTotal: number
  variableTotal: number
  suggestedSavings: number
}

export function computeDaysUntilPositive(
  available: number,
  dailyRate: number,
  dayOfMonth: number,
  daysInMonth: number,
): { days: number | null; recoversThisMonth: boolean } {
  if (available >= -0.005) {
    return { days: 0, recoversThisMonth: true }
  }
  if (dailyRate <= 0) {
    return { days: null, recoversThisMonth: false }
  }
  const days = Math.ceil(-available / dailyRate)
  return {
    days,
    recoversThisMonth: dayOfMonth + days <= daysInMonth,
  }
}

/** Jours restants dans le mois à partir d'aujourd'hui (inclus). */
export function remainingDaysInMonth(date = new Date()): number {
  return daysInMonth(date) - dayOfMonth(date) + 1
}

/**
 * Nouveau quota après lissage : budget plaisir restant ÷ jours restants.
 * Le jour du lissage part à 0 (la part du jour est « absorbée »).
 */
export function computeSmoothedDailyRate(
  pleasure: number,
  spentBaseline: number,
  fromDay: number,
  daysInMonthCount: number,
): number | null {
  const daysLeft = daysInMonthCount - fromDay + 1
  if (daysLeft < 2) return null
  const remaining = pleasure - spentBaseline
  if (remaining < -0.005) return null
  return remaining / daysLeft
}

export function activeSmooth(
  smooth: MonthSmooth | null | undefined,
  date = new Date(),
): MonthSmooth | null {
  if (!smooth) return null
  if (smooth.month !== monthKey(date)) return null
  if (smooth.fromDay > dayOfMonth(date)) return null
  return smooth
}

export function computeCagnotte(data: BudgetData, date = new Date()): CagnotteSnapshot {
  const pleasure = pleasureBudget(data)
  const dim = daysInMonth(date)
  const day = dayOfMonth(date)
  const naturalRate = dim > 0 ? pleasure / dim : 0
  const key = todayKey(date)
  const spends = monthSpends(data.spends, date)
  const spentMonth = spends.reduce((acc, s) => acc + s.amount, 0)
  const spentToday = spentOnDate(spends, key)
  const spentBefore = spentBeforeDate(spends, key)
  const fixedTotal = sumCharges(data.charges, 'fixed')
  const variableTotal = sumCharges(data.charges, 'variable')

  const smooth = activeSmooth(data.smooth, date)
  let dailyRate = naturalRate
  let accrued = naturalRate * day
  let carriedOver = naturalRate * (day - 1) - spentBefore
  let available = accrued - spentMonth
  let isSmoothed = false

  if (smooth) {
    const smoothed = computeSmoothedDailyRate(
      pleasure,
      smooth.spentBaseline,
      smooth.fromDay,
      dim,
    )
    if (smoothed != null) {
      isSmoothed = true
      dailyRate = smoothed
      const spentSince = spentMonth - smooth.spentBaseline
      const spentSinceBefore = Math.max(0, spentBefore - smooth.spentBaseline)
      // Jour du lissage : disponible = 0 ; ensuite +dailyRate / jour
      accrued = dailyRate * (day - smooth.fromDay)
      carriedOver =
        dailyRate * Math.max(0, day - smooth.fromDay - 1) - spentSinceBefore
      available = accrued - spentSince
    }
  }

  const previewSmooth = computeSmoothedDailyRate(pleasure, spentMonth, day, dim)
  const canSmooth = available < -0.005 && previewSmooth != null

  const recovery = computeDaysUntilPositive(available, dailyRate, day, dim)

  return {
    pleasure,
    daysInMonth: dim,
    dayOfMonth: day,
    dailyRate,
    smoothedDailyRate: previewSmooth,
    accrued,
    spentMonth,
    spentToday,
    carriedOver,
    available,
    daysUntilPositive: recovery.days,
    recoversThisMonth: recovery.recoversThisMonth,
    isSmoothed,
    canSmooth,
    fixedTotal,
    variableTotal,
    suggestedSavings: suggestSavings(data.salary, fixedTotal),
  }
}

export function buildMonthSmooth(
  data: BudgetData,
  date = new Date(),
): MonthSmooth | null {
  const snap = computeCagnotte(data, date)
  if (!snap.canSmooth) return null
  return {
    month: monthKey(date),
    fromDay: dayOfMonth(date),
    spentBaseline: snap.spentMonth,
  }
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value)
}

function normalizeSmooth(raw: unknown): MonthSmooth | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Partial<MonthSmooth>
  if (typeof s.month !== 'string' || !/^\d{4}-\d{2}$/.test(s.month)) return null
  const fromDay = Number(s.fromDay)
  const spentBaseline = Number(s.spentBaseline)
  if (!Number.isFinite(fromDay) || fromDay < 1 || fromDay > 31) return null
  if (!Number.isFinite(spentBaseline)) return null
  return { month: s.month, fromDay, spentBaseline }
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
      smooth: normalizeSmooth(parsed.smooth),
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
