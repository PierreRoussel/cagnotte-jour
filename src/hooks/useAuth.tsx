import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import type { StoredSession } from '@nhost/nhost-js'
import { isNhostConfigured, nhost } from '@/lib/nhost'

type AuthContextValue = {
  configured: boolean
  isLoading: boolean
  isAuthenticated: boolean
  session: StoredSession | null
  email: string | null
  userId: string | null
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<StoredSession | null>(() =>
    nhost?.getUserSession() ?? null,
  )
  const [isLoading, setIsLoading] = useState(Boolean(nhost))

  useEffect(() => {
    if (!nhost) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    const unsub = nhost.sessionStorage.onChange((next) => {
      if (!cancelled) setSession(next)
    })

    void (async () => {
      try {
        const existing = nhost.getUserSession()
        if (existing?.refreshToken) {
          await nhost.refreshSession(0)
        }
      } catch {
        nhost.clearSession()
      } finally {
        if (!cancelled) {
          setSession(nhost.getUserSession())
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!nhost) return 'Nhost non configuré'
    try {
      const { body, status } = await nhost.auth.signInEmailPassword({
        email,
        password,
      })
      if (status >= 400) {
        return extractError(body) || 'Connexion impossible'
      }
      if (body.mfa) return 'MFA requise (non supportée dans cette mini-app)'
      if (!body.session) return 'Session absente — vérifie ton email'
      setSession(nhost.getUserSession())
      return null
    } catch (err) {
      return extractThrownError(err) || 'Connexion impossible'
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    if (!nhost) return 'Nhost non configuré'
    try {
      const { body, status } = await nhost.auth.signUpEmailPassword({
        email,
        password,
      })
      if (status >= 400) {
        return extractError(body) || 'Inscription impossible'
      }
      if (!body.session) {
        return 'Compte créé — vérifie ton email puis reconnecte-toi'
      }
      setSession(nhost.getUserSession())
      return null
    } catch (err) {
      return extractThrownError(err) || 'Inscription impossible'
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!nhost) return
    const current = nhost.getUserSession()
    try {
      if (current?.refreshToken) {
        await nhost.auth.signOut({ refreshToken: current.refreshToken })
      }
    } catch {
      // ignore network errors on sign-out
    } finally {
      nhost.clearSession()
      setSession(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isNhostConfigured,
      isLoading,
      isAuthenticated: Boolean(session?.accessToken),
      session,
      email: session?.user?.email ?? null,
      userId: session?.user?.id ?? null,
      signIn,
      signUp,
      signOut,
    }),
    [isLoading, session, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth doit être utilisé dans AuthProvider')
  }
  return ctx
}

function extractError(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  if (typeof record.message === 'string') return record.message
  if (typeof record.error === 'string') return record.error
  return null
}

function extractThrownError(err: unknown): string | null {
  if (err && typeof err === 'object' && 'body' in err) {
    return extractError((err as { body: unknown }).body)
  }
  if (err instanceof Error && err.message) return err.message
  return null
}
