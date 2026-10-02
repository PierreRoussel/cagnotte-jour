import { useMemo, useState, type FormEvent } from 'react'
import { PiggyBank, Plus, Sparkles, Trash2, Wallet } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuthPanel } from '@/components/AuthPanel'
import { useBudget } from '@/hooks/useBudget'
import { formatEuro, monthSpends, todayKey } from '@/lib/budget'
import { isNhostConfigured } from '@/lib/nhost'

function parseAmount(value: string): number {
  const normalized = value.replace(',', '.').replace(/\s/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

export default function App() {
  const {
    data,
    snapshot,
    setSalary,
    setSavings,
    addCharge,
    removeCharge,
    addSpend,
    removeSpend,
    syncStatus,
    syncError,
  } = useBudget()

  const [salaryDraft, setSalaryDraft] = useState(
    data.salary ? String(data.salary) : '',
  )
  const [savingsDraft, setSavingsDraft] = useState(
    data.savings ? String(data.savings) : '',
  )
  const [chargeName, setChargeName] = useState('')
  const [chargeAmount, setChargeAmount] = useState('')
  const [chargeType, setChargeType] = useState<'fixed' | 'variable'>('fixed')
  const [spendAmount, setSpendAmount] = useState('')
  const [spendNote, setSpendNote] = useState('')
  const [spendOpen, setSpendOpen] = useState(false)

  const isSetup = data.salary > 0
  const todaySpends = useMemo(
    () => data.spends.filter((s) => s.date === todayKey()),
    [data.spends],
  )
  const monthHistory = useMemo(
    () =>
      monthSpends(data.spends).sort((a, b) => b.date.localeCompare(a.date)),
    [data.spends],
  )

  const fixedCharges = data.charges.filter((c) => c.type === 'fixed')
  const variableCharges = data.charges.filter((c) => c.type === 'variable')

  function commitSalary() {
    setSalary(parseAmount(salaryDraft))
  }

  function commitSavings() {
    setSavings(parseAmount(savingsDraft))
  }

  function applySuggestion() {
    setSavingsDraft(String(snapshot.suggestedSavings))
    setSavings(snapshot.suggestedSavings)
  }

  function onAddCharge(e: FormEvent) {
    e.preventDefault()
    const amount = parseAmount(chargeAmount)
    if (amount <= 0) return
    addCharge(chargeName, amount, chargeType)
    setChargeName('')
    setChargeAmount('')
  }

  function onAddSpend(e: FormEvent) {
    e.preventDefault()
    const amount = parseAmount(spendAmount)
    if (amount <= 0) return
    addSpend(amount, spendNote)
    setSpendAmount('')
    setSpendNote('')
    setSpendOpen(false)
  }

  const monthLabel = new Date().toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="app-shell">
      <div className="bg-glow" aria-hidden />
      <div className="bg-grain" aria-hidden />

      <header className="site-header">
        <div className="brand">
          <PiggyBank className="brand-icon" aria-hidden />
          <span>Cagnotte Jour</span>
        </div>
        <div className="header-actions">
          <p className="month-chip">{monthLabel}</p>
          <AuthPanel />
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="cagnotte-title">
          <p className="hero-kicker">Disponible aujourd&apos;hui</p>
          <h1 id="cagnotte-title" className="hero-amount">
            {isSetup ? formatEuro(snapshot.available) : '—'}
          </h1>
          <p className="hero-copy">
            {isSetup
              ? `Ta cagnotte vivante cumule ${formatEuro(snapshot.dailyRate)} par jour. Ce qui n'est pas dépensé reste pour demain.`
              : 'Indique ton salaire et tes charges pour démarrer ta cagnotte du mois.'}
          </p>

          {isSetup && (
            <div className="hero-actions">
              <Dialog open={spendOpen} onOpenChange={setSpendOpen}>
                <DialogTrigger
                  render={<Button size="lg" className="cta" />}
                >
                  <Wallet />
                  Noter une dépense
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={onAddSpend}>
                    <DialogHeader>
                      <DialogTitle>Dépense du jour</DialogTitle>
                      <DialogDescription>
                        Elle sera retirée de ta cagnotte disponible.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="form-stack">
                      <div className="field">
                        <Label htmlFor="spend-amount">Montant (€)</Label>
                        <Input
                          id="spend-amount"
                          inputMode="decimal"
                          placeholder="12,50"
                          value={spendAmount}
                          onChange={(e) => setSpendAmount(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className="field">
                        <Label htmlFor="spend-note">Note (optionnel)</Label>
                        <Input
                          id="spend-note"
                          placeholder="Café, resto…"
                          value={spendNote}
                          onChange={(e) => setSpendNote(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" className="w-full sm:w-auto">
                        Enregistrer
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {isSetup && (
            <dl className="hero-stats">
              <div>
                <dt>Reporté</dt>
                <dd>{formatEuro(snapshot.carriedOver)}</dd>
              </div>
              <div>
                <dt>Base du jour</dt>
                <dd>{formatEuro(snapshot.dailyRate)}</dd>
              </div>
              <div>
                <dt>Dépensé aujourd&apos;hui</dt>
                <dd>{formatEuro(snapshot.spentToday)}</dd>
              </div>
            </dl>
          )}
        </section>

        {isSetup && (
          <section className="summary-strip" aria-label="Résumé du mois">
            <div>
              <span>Plaisir du mois</span>
              <strong>{formatEuro(snapshot.pleasure)}</strong>
            </div>
            <div>
              <span>Épargne</span>
              <strong>{formatEuro(data.savings)}</strong>
            </div>
            <div>
              <span>Dépensé ce mois</span>
              <strong>{formatEuro(snapshot.spentMonth)}</strong>
            </div>
          </section>
        )}

        <section className="panel" aria-labelledby="budget-title">
          <div className="panel-head">
            <h2 id="budget-title">Budget du mois</h2>
            <p>Salaire, épargne suggérée, puis charges fixes et variables.</p>
          </div>

          <div className="setup-grid">
            <div className="field">
              <Label htmlFor="salary">Salaire mensuel (€)</Label>
              <div className="inline-actions">
                <Input
                  id="salary"
                  inputMode="decimal"
                  placeholder="2400"
                  value={salaryDraft}
                  onChange={(e) => setSalaryDraft(e.target.value)}
                  onBlur={commitSalary}
                />
                <Button type="button" variant="secondary" onClick={commitSalary}>
                  OK
                </Button>
              </div>
            </div>

            <div className="field">
              <div className="label-row">
                <Label htmlFor="savings">Épargne ce mois (€)</Label>
                {snapshot.suggestedSavings > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="suggest-btn"
                    onClick={applySuggestion}
                  >
                    <Sparkles />
                    Suggestion {formatEuro(snapshot.suggestedSavings)}
                  </Button>
                )}
              </div>
              <div className="inline-actions">
                <Input
                  id="savings"
                  inputMode="decimal"
                  placeholder="200"
                  value={savingsDraft}
                  onChange={(e) => setSavingsDraft(e.target.value)}
                  onBlur={commitSavings}
                />
                <Button type="button" variant="secondary" onClick={commitSavings}>
                  OK
                </Button>
              </div>
              <p className="hint">
                Suggestion = 20% du reste après charges fixes, arrondi à 10 €.
              </p>
            </div>
          </div>

          <Separator className="my-6" />

          <Tabs
            value={chargeType}
            onValueChange={(v) => setChargeType(v as 'fixed' | 'variable')}
          >
            <TabsList>
              <TabsTrigger value="fixed">
                Fixes
                <Badge variant="secondary">{fixedCharges.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="variable">
                Variables
                <Badge variant="secondary">{variableCharges.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <form className="charge-form" onSubmit={onAddCharge}>
              <div className="field grow">
                <Label htmlFor="charge-name">Libellé</Label>
                <Input
                  id="charge-name"
                  placeholder={
                    chargeType === 'fixed' ? 'Loyer, internet…' : 'Courses, essence…'
                  }
                  value={chargeName}
                  onChange={(e) => setChargeName(e.target.value)}
                />
              </div>
              <div className="field amount-field">
                <Label htmlFor="charge-amount">Montant (€)</Label>
                <Input
                  id="charge-amount"
                  inputMode="decimal"
                  placeholder="50"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                />
              </div>
              <Button type="submit" className="add-charge">
                <Plus />
                Ajouter
              </Button>
            </form>

            <TabsContent value="fixed">
              <ChargeList
                items={fixedCharges}
                empty="Aucune charge fixe pour l’instant."
                onRemove={removeCharge}
              />
              <p className="total-line">
                Total fixes : <strong>{formatEuro(snapshot.fixedTotal)}</strong>
              </p>
            </TabsContent>
            <TabsContent value="variable">
              <ChargeList
                items={variableCharges}
                empty="Aucune charge variable pour l’instant."
                onRemove={removeCharge}
              />
              <p className="total-line">
                Total variables :{' '}
                <strong>{formatEuro(snapshot.variableTotal)}</strong>
              </p>
            </TabsContent>
          </Tabs>
        </section>

        {isSetup && (
          <section className="panel" aria-labelledby="history-title">
            <div className="panel-head">
              <h2 id="history-title">Dépenses du mois</h2>
              <p>Historique stocké localement sur cet appareil.</p>
            </div>

            {monthHistory.length === 0 ? (
              <p className="empty">Pas encore de dépense plaisir ce mois-ci.</p>
            ) : (
              <ul className="history-list">
                {monthHistory.map((spend) => (
                  <li key={spend.id}>
                    <div>
                      <strong>{formatEuro(spend.amount)}</strong>
                      <span>
                        {new Date(spend.date + 'T12:00:00').toLocaleDateString(
                          'fr-FR',
                          { weekday: 'short', day: 'numeric', month: 'short' },
                        )}
                        {spend.note ? ` · ${spend.note}` : ''}
                        {spend.date === todayKey() ? ' · aujourd’hui' : ''}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Supprimer la dépense"
                      onClick={() => removeSpend(spend.id)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {todaySpends.length > 0 && (
              <p className="hint mt-4">
                Aujourd&apos;hui : {todaySpends.length} dépense
                {todaySpends.length > 1 ? 's' : ''} ·{' '}
                {formatEuro(snapshot.spentToday)}
              </p>
            )}
          </section>
        )}
      </main>

      <footer className="site-footer">
        {isNhostConfigured
          ? `Cache local + sync Nhost${
              syncStatus === 'loading'
                ? ' · chargement…'
                : syncStatus === 'syncing'
                  ? ' · enregistrement…'
                  : syncStatus === 'synced'
                    ? ' · à jour'
                    : syncStatus === 'error'
                      ? ` · erreur${syncError ? ` : ${syncError}` : ''}`
                      : ' · connecte-toi pour synchroniser'
            }`
          : 'Données dans le localStorage — ajoute Nhost pour la sync cloud.'}
      </footer>
    </div>
  )
}

function ChargeList({
  items,
  empty,
  onRemove,
}: {
  items: { id: string; name: string; amount: number }[]
  empty: string
  onRemove: (id: string) => void
}) {
  if (items.length === 0) {
    return <p className="empty">{empty}</p>
  }

  return (
    <ul className="charge-list">
      {items.map((item) => (
        <li key={item.id}>
          <div>
            <strong>{item.name}</strong>
            <span>{formatEuro(item.amount)}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Supprimer ${item.name}`}
            onClick={() => onRemove(item.id)}
          >
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  )
}
