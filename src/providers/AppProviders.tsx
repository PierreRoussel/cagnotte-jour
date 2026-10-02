import type { PropsWithChildren } from 'react'
import { NhostProvider } from '@nhost/react'
import { isNhostConfigured, nhost } from '@/lib/nhost'

export function AppProviders({ children }: PropsWithChildren) {
  if (!isNhostConfigured || !nhost) {
    return children
  }

  return <NhostProvider nhost={nhost}>{children}</NhostProvider>
}
