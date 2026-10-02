import { createClient } from '@nhost/nhost-js'
import {
  NHOST_GRAPHQL_URL,
  NHOST_REGION,
  NHOST_SUBDOMAIN,
} from '@/lib/nhostConfig'

// Config publique hardcodée (découpée) — éviter import.meta.env en prod :
// Netlify secret-scrubbing masquait les VITE_NHOST_* dans le bundle.
export const isNhostConfigured = Boolean(NHOST_SUBDOMAIN)

export const nhost = isNhostConfigured
  ? createClient({
      subdomain: NHOST_SUBDOMAIN,
      region: NHOST_REGION,
      graphqlUrl: NHOST_GRAPHQL_URL,
    })
  : null
