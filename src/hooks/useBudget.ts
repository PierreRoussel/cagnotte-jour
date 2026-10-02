import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type BudgetData,
  type Charge,
  type ChargeType,
  type DailySpend,
  computeCagnotte,
  createId,
  loadBudget,
  saveBudget,
  todayKey,
} from '@/lib/budget'
import { fetchBudgetProfile, upsertBudgetProfile } from '@/lib/budgetRemote'
import { isNhostConfigured, nhost } from '@/lib/nhost'

export type SyncStatus = 'local' | 'loading' | 'syncing' | 'synced' | 'error'

export function useBudget() {
  const [data, setData] = useState<BudgetData>(() => loadBudget())
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    isNhostConfigured ? 'loading' : 'local',
  )
  const skipCloudPush = useRef(false)
  const hydrateRef = useRef<(userId: string) => Promise<void>>(async () => {})

  hydrateRef.current = async (userId: string) => {
    if (!nhost) return
    setSyncStatus('loading')
    try {
      const remote = await fetchBudgetProfile(nhost, userId)
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
        setData(local)
      }
      setSyncStatus('synced')
    } catch {
      setSyncStatus('error')
    } finally {
      skipCloudPush.current = false
    }
  }

  useEffect(() => {
    if (!nhost) return

    const user = nhost.auth.getUser()
    if (user?.id) {
      void hydrateRef.current(user.id)
    } else {
      setSyncStatus('local')
    }

    const unsubscribe = nhost.auth.onAuthStateChanged((_event, session) => {
      if (session?.user?.id) {
        void hydrateRef.current(session.user.id)
      } else {
        setSyncStatus('local')
      }
    })
    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    saveBudget(data)

    const userId = nhost?.auth.getUser()?.id
    if (!nhost || !userId || skipCloudPush.current) return

    setSyncStatus('syncing')
    const client = nhost
    const timer = window.setTimeout(async () => {
      try {
        await upsertBudgetProfile(client, userId, data)
        setSyncStatus('synced')
      } catch {
        setSyncStatus('error')
      }
    }, 700)

    return () => window.clearTimeout(timer)
  }, [data])

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

  const resetAll = useCallback(() => {
    setData({ salary: 0, savings: 0, charges: [], spends: [] })
  }, [])

  return {
    data,
    snapshot,
    syncStatus,
    setSalary,
    setSavings,
    addCharge,
    removeCharge,
    addSpend,
    removeSpend,
    resetAll,
  }
}
