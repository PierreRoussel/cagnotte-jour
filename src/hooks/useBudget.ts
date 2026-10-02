import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type BudgetData,
  type Charge,
  type ChargeType,
  type DailySpend,
  buildMonthSmooth,
  computeCagnotte,
  createId,
  loadBudget,
  saveBudget,
  todayKey,
} from '@/lib/budget'
import { fetchBudgetProfile, upsertBudgetProfile } from '@/lib/budgetRemote'
import { useAuth } from '@/hooks/useAuth'
import { nhost } from '@/lib/nhost'

export type SyncStatus = 'local' | 'loading' | 'syncing' | 'synced' | 'error'

export function useBudget() {
  const { configured, isAuthenticated, userId } = useAuth()
  const [data, setData] = useState<BudgetData>(() => loadBudget())
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    configured ? 'loading' : 'local',
  )
  const [syncError, setSyncError] = useState<string | null>(null)
  const skipCloudPush = useRef(false)

  useEffect(() => {
    if (!nhost || !configured) {
      setSyncStatus('local')
      return
    }

    if (!isAuthenticated || !userId) {
      setSyncStatus('local')
      return
    }

    let cancelled = false

    void (async () => {
      setSyncStatus('loading')
      setSyncError(null)
      try {
        const remote = await fetchBudgetProfile(nhost, userId)
        if (cancelled) return
        const local = loadBudget()
        skipCloudPush.current = true
        if (remote) {
          setData(remote)
        } else if (
          local.salary > 0 ||
          local.charges.length > 0 ||
          local.spends.length > 0
        ) {
          await upsertBudgetProfile(nhost, userId, local)
          if (cancelled) return
          setData(local)
        }
        setSyncStatus('synced')
      } catch (err) {
        if (!cancelled) {
          setSyncStatus('error')
          setSyncError(err instanceof Error ? err.message : 'Erreur de sync')
        }
      } finally {
        skipCloudPush.current = false
      }
    })()

    return () => {
      cancelled = true
    }
  }, [configured, isAuthenticated, userId])

  useEffect(() => {
    saveBudget(data)

    if (!nhost || !configured || !isAuthenticated || !userId) return
    if (skipCloudPush.current) return

    const client = nhost
    const uid = userId
    setSyncStatus('syncing')
    setSyncError(null)
    const timer = window.setTimeout(async () => {
      try {
        await upsertBudgetProfile(client, uid, data)
        setSyncStatus('synced')
      } catch (err) {
        setSyncStatus('error')
        setSyncError(err instanceof Error ? err.message : 'Erreur de sync')
      }
    }, 700)

    return () => window.clearTimeout(timer)
  }, [data, configured, isAuthenticated, userId])

  const snapshot = useMemo(() => computeCagnotte(data), [data])

  const setSalary = useCallback((salary: number) => {
    setData((prev) => ({ ...prev, salary: Math.max(0, salary) }))
  }, [])

  const setSavings = useCallback((savings: number) => {
    setData((prev) => ({ ...prev, savings: Math.max(0, savings) }))
  }, [])

  const addCharge = useCallback((name: string, amount: number, type: ChargeType) => {
    const charge: Charge = {
      id: createId(),
      name: name.trim() || (type === 'fixed' ? 'Charge fixe' : 'Charge variable'),
      amount: Math.max(0, amount),
      type,
    }
    setData((prev) => ({ ...prev, charges: [...prev.charges, charge] }))
  }, [])

  const removeCharge = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      charges: prev.charges.filter((c) => c.id !== id),
    }))
  }, [])

  const addSpend = useCallback((amount: number, note?: string) => {
    const spend: DailySpend = {
      id: createId(),
      date: todayKey(),
      amount: Math.max(0, amount),
      note: note?.trim() || undefined,
    }
    setData((prev) => ({ ...prev, spends: [...prev.spends, spend] }))
  }, [])

  const removeSpend = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      spends: prev.spends.filter((s) => s.id !== id),
    }))
  }, [])

  const smoothDailyRate = useCallback(() => {
    setData((prev) => {
      const smooth = buildMonthSmooth(prev)
      if (!smooth) return prev
      return { ...prev, smooth }
    })
  }, [])

  const resetAll = useCallback(() => {
    setData({ salary: 0, savings: 0, charges: [], spends: [], smooth: null })
  }, [])

  return {
    data,
    snapshot,
    syncStatus,
    syncError,
    setSalary,
    setSavings,
    addCharge,
    removeCharge,
    addSpend,
    removeSpend,
    smoothDailyRate,
    resetAll,
  }
}
