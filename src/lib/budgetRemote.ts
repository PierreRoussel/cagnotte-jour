import type { NhostClient } from '@nhost/nhost-js'
import { type BudgetData, defaultData } from '@/lib/budget'

const GET_BUDGET = `
  query GetBudgetProfile {
    budget_profiles(limit: 1) {
      data
      updated_at
    }
  }
`

const UPSERT_BUDGET = `
  mutation UpsertBudgetProfile($data: jsonb!) {
    insert_budget_profiles_one(
      object: { data: $data }
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
  client: NhostClient,
  _userId?: string,
): Promise<BudgetData | null> {
  try {
    const { body } = await client.graphql.request<{
      budget_profiles: BudgetRow[]
    }>({
      query: GET_BUDGET,
    })
    const row = body.data?.budget_profiles?.[0]
    if (!row) return null
    return normalizeBudget(row.data)
  } catch (err) {
    throw new Error(formatGraphqlError(err, 'Impossible de charger le budget.'))
  }
}

export async function upsertBudgetProfile(
  client: NhostClient,
  _userId: string | undefined,
  budget: BudgetData,
): Promise<void> {
  try {
    await client.graphql.request({
      query: UPSERT_BUDGET,
      variables: { data: budget },
    })
  } catch (err) {
    throw new Error(
      formatGraphqlError(err, 'Impossible de sauvegarder le budget.'),
    )
  }
}

function formatGraphqlError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'body' in error) {
    const body = (error as { body?: unknown }).body
    if (body && typeof body === 'object' && 'errors' in body) {
      const errors = (body as { errors?: { message?: string }[] }).errors
      if (errors?.[0]?.message) return errors[0].message
    }
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}
