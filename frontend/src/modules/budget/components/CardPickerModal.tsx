import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { fmt, todayStr } from '../utils'
import Typeahead from './Typeahead'
import type { RewardRule, RewardRuleCreate, RewardRuleUpdate, Account } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isRuleActive(r: RewardRule): boolean {
  if (!r.is_rotating) return true
  if (!r.promo_end_date) return true
  return r.promo_end_date >= todayStr()
}

function effectiveRate(r: RewardRule): number {
  if (!isRuleActive(r)) return 0
  if (r.spending_cap != null && r.amount_used >= r.spending_cap) return 0
  return r.rate
}

function capRemaining(r: RewardRule): number | null {
  if (r.spending_cap == null) return null
  return Math.max(0, r.spending_cap - r.amount_used)
}

// ── Card Picker results ───────────────────────────────────────────────────────

interface PickerResult {
  accountId: string
  accountName: string
  rule: RewardRule
  effective: number
}

function CardPickerResults({
  category,
  rules,
  accounts,
}: {
  category: string
  rules: RewardRule[]
  accounts: Account[]
}) {
  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a.name]))

  const results = useMemo((): PickerResult[] => {
    if (!category.trim()) return []

    const catLower = category.trim().toLowerCase()

    // For each account, find best effective rate across matching rules
    const byAccount = new Map<string, PickerResult>()

    for (const r of rules) {
      if (r.category.toLowerCase() !== catLower) continue
      const rate = effectiveRate(r)
      const existing = byAccount.get(r.account_id)
      if (!existing || rate > existing.effective) {
        byAccount.set(r.account_id, {
          accountId: r.account_id,
          accountName: accountMap[r.account_id] ?? r.account_id,
          rule: r,
          effective: rate,
        })
      }
    }

    return Array.from(byAccount.values()).sort((a, b) => b.effective - a.effective)
  }, [category, rules, accountMap])

  if (!category.trim()) {
    return (
      <p className="text-gray-600 text-sm text-center py-6">
        Enter a category to see which card earns the most.
      </p>
    )
  }

  if (results.length === 0) {
    return (
      <p className="text-gray-500 text-sm text-center py-6">
        No reward rules found for "{category}". Add rules below.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {results.map((r, i) => {
        const remaining = capRemaining(r.rule)
        const active = isRuleActive(r.rule)
        const capHit = r.rule.spending_cap != null && r.rule.amount_used >= r.rule.spending_cap

        return (
          <div
            key={r.accountId}
            className={`flex items-center justify-between rounded-xl px-4 py-3 ${
              i === 0 ? 'bg-emerald-950/40 border border-emerald-800/50' : 'bg-gray-800/60 border border-gray-800'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {i === 0 && <span className="text-xs text-emerald-400 font-medium">Best</span>}
                <span className={`text-sm font-medium ${i === 0 ? 'text-white' : 'text-gray-300'}`}>
                  {r.accountName}
                </span>
                {!active && (
                  <span className="text-xs text-red-400">expired</span>
                )}
                {capHit && (
                  <span className="text-xs text-amber-400">cap hit</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                {r.rule.is_rotating && r.rule.promo_end_date && (
                  <span>promo ends {r.rule.promo_end_date.slice(0, 7)}</span>
                )}
                {remaining !== null && (
                  <span className={remaining < 100 ? 'text-amber-400' : ''}>
                    {fmt(remaining)} cap remaining
                  </span>
                )}
              </div>
            </div>
            <div className={`text-lg font-bold font-mono ${
              r.effective === 0 ? 'text-gray-600' : i === 0 ? 'text-emerald-400' : 'text-gray-300'
            }`}>
              {r.effective > 0 ? `${(r.effective * 100).toFixed(1)}%` : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Rule form ─────────────────────────────────────────────────────────────────

function RuleForm({
  accounts,
  categories,
  initial,
  onSave,
  onCancel,
  onDelete,
  saving,
}: {
  accounts: Account[]
  categories: string[]
  initial?: RewardRule
  onSave: (d: RewardRuleCreate | RewardRuleUpdate) => void
  onCancel: () => void
  onDelete?: () => void
  saving: boolean
}) {
  const creditCards = accounts.filter(a => a.type === 'credit_card')
  const [accountId, setAccountId] = useState(initial?.account_id ?? creditCards[0]?.id ?? '')
  const [cat, setCat] = useState(initial?.category ?? '')
  const [rate, setRate] = useState(initial ? String(initial.rate * 100) : '')
  const [isRotating, setIsRotating] = useState(initial?.is_rotating ?? false)
  const [promoEnd, setPromoEnd] = useState(initial?.promo_end_date ?? '')
  const [cap, setCap] = useState(initial?.spending_cap != null ? String(initial.spending_cap) : '')
  const [used, setUsed] = useState(initial?.amount_used != null ? String(initial.amount_used) : '0')

  const valid = accountId && cat.trim() && rate && parseFloat(rate) > 0

  function handleSave() {
    const payload = {
      account_id: accountId,
      category: cat.trim(),
      rate: parseFloat(rate) / 100,
      is_rotating: isRotating,
      promo_end_date: promoEnd || null,
      spending_cap: cap ? parseFloat(cap) : null,
      amount_used: parseFloat(used) || 0,
    }
    onSave(initial ? { ...payload } : payload as RewardRuleCreate)
  }

  const inp = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500'

  return (
    <div className="space-y-3 border-t border-gray-800 pt-4 mt-4">
      <div className="text-xs font-medium text-white uppercase tracking-wider">
        {initial ? 'Edit Rule' : 'Add Rule'}
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Card</label>
        <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inp}>
          {creditCards.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <Typeahead
            label=""
            value={cat}
            onChange={setCat}
            suggestions={categories}
            placeholder="e.g. Groceries"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Reward %</label>
          <input
            type="number"
            step="0.1"
            value={rate}
            onChange={e => setRate(e.target.value)}
            placeholder="e.g. 5"
            className={inp}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsRotating(v => !v)}
          className={`w-9 h-5 rounded-full transition-colors ${isRotating ? 'bg-indigo-600' : 'bg-gray-700'}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white mx-0.5 transition-transform ${isRotating ? 'translate-x-4' : ''}`} />
        </button>
        <span className="text-xs text-gray-400">Rotating / promo</span>
      </div>

      {isRotating && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Promo ends</label>
            <input type="date" value={promoEnd} onChange={e => setPromoEnd(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Spending cap</label>
            <input type="number" step="0.01" value={cap} onChange={e => setCap(e.target.value)} placeholder="$" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Used so far</label>
            <input type="number" step="0.01" value={used} onChange={e => setUsed(e.target.value)} placeholder="0" className={inp} />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {onDelete && (
          <button onClick={onDelete} className="px-3 py-2 bg-red-900/40 hover:bg-red-900/70 text-red-400 rounded-lg text-sm">
            Delete
          </button>
        )}
        <button onClick={onCancel} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!valid || saving}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium"
        >
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function CardPickerModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [category, setCategory] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<RewardRule | null>(null)

  const { data: rules = [] } = useQuery({
    queryKey: ['reward-rules'],
    queryFn: () => api.rewardRules.list(),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories(),
  })

  const createMutation = useMutation({
    mutationFn: (d: RewardRuleCreate) => api.rewardRules.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reward-rules'] }); setShowForm(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RewardRuleUpdate }) => api.rewardRules.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reward-rules'] }); setEditingRule(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.rewardRules.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reward-rules'] }); setEditingRule(null) },
  })

  const creditCards = accounts.filter(a => a.type === 'credit_card')
  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a.name]))

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-5 py-4 flex justify-between items-center">
          <h2 className="text-white font-semibold">Card Picker</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Category input */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Category</label>
            <Typeahead
              label=""
              value={category}
              onChange={setCategory}
              suggestions={categories}
              placeholder="e.g. Groceries, Gas, Dining"
            />
          </div>

          {/* Results */}
          <CardPickerResults category={category} rules={rules} accounts={accounts} />

          {/* Rules management */}
          {!showForm && !editingRule && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider">All Rules ({rules.length})</span>
                <button onClick={() => setShowForm(true)} className="text-xs text-indigo-400 hover:text-indigo-300">
                  + Add rule
                </button>
              </div>
              {rules.length === 0 ? (
                <p className="text-gray-600 text-xs">No reward rules yet. Add one to get started.</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {rules.map(r => {
                    const active = isRuleActive(r)
                    return (
                      <button
                        key={r.id}
                        onClick={() => setEditingRule(r)}
                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-800 text-left"
                      >
                        <span className="text-xs text-gray-300">
                          <span className="text-gray-500">{accountMap[r.account_id] ?? '?'}</span>
                          {' · '}{r.category}
                          {r.is_rotating && <span className="ml-1 text-indigo-400">↻</span>}
                        </span>
                        <span className={`text-xs font-mono ${active ? 'text-emerald-400' : 'text-gray-600'}`}>
                          {(r.rate * 100).toFixed(1)}%
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {showForm && (
            <RuleForm
              accounts={creditCards.length > 0 ? accounts : accounts}
              categories={categories}
              onSave={d => createMutation.mutate(d as RewardRuleCreate)}
              onCancel={() => setShowForm(false)}
              saving={createMutation.isPending}
            />
          )}

          {editingRule && (
            <RuleForm
              accounts={accounts}
              categories={categories}
              initial={editingRule}
              onSave={d => updateMutation.mutate({ id: editingRule.id, data: d as RewardRuleUpdate })}
              onCancel={() => setEditingRule(null)}
              onDelete={() => deleteMutation.mutate(editingRule.id)}
              saving={updateMutation.isPending || deleteMutation.isPending}
            />
          )}
        </div>
      </div>
    </div>
  )
}
