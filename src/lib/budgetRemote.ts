import type { NhostClient } from '@nhost/react'
import { type BudgetData, defaultData } from '@/lib/budget'

const GET_BUDGET = `
  query GetBudgetProfile($userId: uuid!) {
    budget_profiles(where: { user_id: { _eq: $userId } }, limit: 1) {
      data
      updated_at
    }
  }
`

const UPSERT_BUDGET = `
  mutation UpsertBudgetProfile($userId: uuid!, $data: jsonb!) {
    insert_budget_profiles_one(
      object: { user_id: $userId, data: $data }
      on_conflict: {
        constraint: budget_profiles_pkey
        update_columns: [data]
      }
    ) {
      user_id
      updated_at
    }
  }
`

type BudgetRow = {
  data: BudgetData
  updated_at: string
}

function normalizeBudget(raw: unknown): BudgetData {
  if (!raw || typeof raw !== 'object') return { ...defaultData }
  const parsed = raw as Partial<BudgetData>
  return {
    salary: Number(parsed.salary) || 0,
    savings: Number(parsed.savings) || 0,
    charges: Array.isArray(parsed.charges) ? parsed.charges : [],
    spends: Array.isArray(parsed.spends) ? parsed.spends : [],
  }
}

export async function fetchBudgetProfile(
  nhost: NhostClient,
  userId: string,
): Promise<BudgetData | null> {
  const { data, error } = await nhost.graphql.request<{
    budget_profiles: BudgetRow[]
  }>(GET_BUDGET, { userId })

  if (error) {
    throw new Error(formatGraphqlError(error, 'Impossible de charger le budget.'))
  }

  const row = data?.budget_profiles?.[0]
  if (!row) return null
  return normalizeBudget(row.data)
}

export async function upsertBudgetProfile(
  nhost: NhostClient,
  userId: string,
  budget: BudgetData,
): Promise<void> {
  const { error } = await nhost.graphql.request(UPSERT_BUDGET, {
    userId,
    data: budget,
  })

  if (error) {
    throw new Error(
      formatGraphqlError(error, 'Impossible de sauvegarder le budget.'),
    )
  }
}

function formatGraphqlError(error: unknown, fallback: string): string {
  if (Array.isArray(error)) {
    return error[0]?.message ?? fallback
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: string }).message
    if (msg) return msg
  }
  return fallback
}
