/**
 * Applique migration SQL + metadata Hasura sur le projet Nhost cloud.
 * Usage: NHOST_ADMIN_SECRET=xxx node scripts/apply-nhost-cloud.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const subdomain = process.env.NHOST_SUBDOMAIN || 'oprgpxqjrdwksfkhcfot'
const region = process.env.NHOST_REGION || 'eu-central-1'
const adminSecret = process.env.NHOST_ADMIN_SECRET

if (!adminSecret) {
  console.error('Définis NHOST_ADMIN_SECRET (Hasura admin secret du dashboard Nhost).')
  process.exit(1)
}

const hasuraBase = `https://${subdomain}.hasura.${region}.nhost.run`
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationSql = readFileSync(
  join(
    root,
    'nhost/migrations/default/1748800000000_create_budget_profiles/up.sql',
  ),
  'utf8',
)

async function hasura(type, args) {
  const res = await fetch(`${hasuraBase}/v1/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({ type, args }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`${type}: ${res.status} ${JSON.stringify(body)}`)
  }
  return body
}

async function runSql(sql) {
  const res = await fetch(`${hasuraBase}/v2/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      type: 'run_sql',
      args: { source: 'default', sql, cascade: false, read_only: false },
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`run_sql: ${res.status} ${JSON.stringify(body)}`)
  }
  return body
}

async function main() {
  console.log(`→ Hasura ${hasuraBase}`)
  console.log('→ Migration SQL…')
  await runSql(migrationSql)

  console.log('→ Track table budget_profiles…')
  try {
    await hasura('pg_track_table', {
      source: 'default',
      schema: 'public',
      name: 'budget_profiles',
    })
  } catch (e) {
    const msg = String(e)
    if (!msg.includes('already tracked') && !msg.includes('already exists')) {
      throw e
    }
    console.log('  (table déjà trackée)')
  }

  const permissions = [
    {
      type: 'pg_create_select_permission',
      role: 'user',
      permission: {
        columns: ['user_id', 'data', 'updated_at'],
        filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
        allow_aggregations: false,
      },
    },
    {
      type: 'pg_create_insert_permission',
      role: 'user',
      permission: {
        check: { user_id: { _eq: 'X-Hasura-User-Id' } },
        columns: ['data'],
        set: { user_id: 'x-hasura-User-Id' },
      },
    },
    {
      type: 'pg_create_update_permission',
      role: 'user',
      permission: {
        columns: ['data'],
        filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
        check: { user_id: { _eq: 'X-Hasura-User-Id' } },
      },
    },
    {
      type: 'pg_create_delete_permission',
      role: 'user',
      permission: {
        filter: { user_id: { _eq: 'X-Hasura-User-Id' } },
      },
    },
  ]

  for (const p of permissions) {
    const { type, role, permission } = p
    console.log(`→ Permission ${type} (${role})…`)
    try {
      await hasura(type, {
        source: 'default',
        table: { schema: 'public', name: 'budget_profiles' },
        role,
        permission,
      })
    } catch (e) {
      const msg = String(e)
      if (msg.includes('already exists')) {
        console.log('  (déjà configurée)')
        continue
      }
      throw e
    }
  }

  const check = await fetch(`${hasuraBase}/v1/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      query: `{ __type(name: "budget_profiles") { name } }`,
    }),
  })
  const checkBody = await check.json()
  const ok = checkBody?.data?.__type?.name === 'budget_profiles'
  console.log(ok ? '✓ Table exposée en GraphQL' : '⚠ Vérifie la console Hasura')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
