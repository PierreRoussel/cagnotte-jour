import { useState, type FormEvent } from 'react'
import { LogIn, LogOut, UserPlus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AuthPanel() {
  const { configured, isLoading, isAuthenticated, email, signOut } = useAuth()

  if (!configured) return null

  if (isLoading) {
    return (
      <Badge variant="secondary" className="auth-badge">
        Connexion…
      </Badge>
    )
  }

  if (isAuthenticated) {
    return (
      <div className="auth-bar">
        <Badge variant="secondary" className="auth-badge max-w-[12rem] truncate">
          {email || 'Connecté'}
        </Badge>
        <Button type="button" variant="ghost" size="sm" onClick={() => signOut()}>
          <LogOut />
          Déconnexion
        </Button>
      </div>
    )
  }

  return <AuthDialog />
}

function AuthDialog() {
  const { signIn, signUp } = useAuth()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    const result =
      mode === 'signin'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password)
    setBusy(false)

    if (!result) {
      setOpen(false)
      setPassword('')
      return
    }

    if (result.includes('vérifie ton email')) {
      setInfo(result)
      return
    }
    setError(result)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <LogIn />
        Connexion
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'signin' ? 'Se connecter' : 'Créer un compte'}
            </DialogTitle>
            <DialogDescription>
              Synchronise ta cagnotte sur Nhost (Postgres + auth). Même compte
              sur téléphone et ordinateur.
            </DialogDescription>
          </DialogHeader>

          <div className="form-stack">
            <div className="field">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <Label htmlFor="auth-password">Mot de passe</Label>
              <Input
                id="auth-password"
                type="password"
                autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                }
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {info && <p className="hint">{info}</p>}
            {error && <p className="auth-error">{error}</p>}
          </div>

          <DialogFooter className="auth-dialog-footer">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
                setError(null)
                setInfo(null)
              }}
            >
              {mode === 'signin' ? (
                <>
                  <UserPlus />
                  Créer un compte
                </>
              ) : (
                <>
                  <LogIn />
                  J&apos;ai déjà un compte
                </>
              )}
            </Button>
            <Button type="submit" disabled={busy}>
              {mode === 'signin' ? 'Connexion' : 'Inscription'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
