import { NhostClient } from '@nhost/react'

const subdomain = import.meta.env.VITE_NHOST_SUBDOMAIN as string | undefined
const region = (import.meta.env.VITE_NHOST_REGION as string | undefined) || 'eu-central-1'
const graphqlUrl = import.meta.env.VITE_NHOST_GRAPHQL_URL as string | undefined

export const isNhostConfigured = Boolean(subdomain?.trim())

export const nhost = isNhostConfigured
  ? new NhostClient({
      subdomain: subdomain!.trim(),
      region: region.trim(),
      ...(graphqlUrl?.trim() ? { graphqlUrl: graphqlUrl.trim() } : {}),
    })
  : null
