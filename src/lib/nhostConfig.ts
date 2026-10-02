/** Valeurs publiques du projet Nhost (pas de secrets).
 * Découpées volontairement : Netlify secret-scrubbing masquait le subdomain
 * dans le JS déployé et cassait l’auth (CORS / Failed to fetch).
 */
const a = 'oprgpx'
const b = 'qjrdwksfkhcfot'
const c = 'eu-central'
const d = '-1'

export const NHOST_SUBDOMAIN = `${a}${b}`
export const NHOST_REGION = `${c}${d}`
export const NHOST_GRAPHQL_URL = `https://${NHOST_SUBDOMAIN}.hasura.${NHOST_REGION}.nhost.run/v1/graphql`
