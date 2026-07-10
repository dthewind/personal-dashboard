import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { fmt, todayStr } from '../utils'
import type { Account, Earmark, EarmarkCreate, EarmarkUpdate, EarmarkEventCreate } from '../types'

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500'
const dollarCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500'

function EarmarkModal({
  accounts,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  accounts: Account[]
  initial?: Earmark
  onClose: () => void
  onSave: (data: EarmarkCreate | EarmarkUpdate) => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [accountId, setAccountId] = useState(initial?.account_id ?? (accounts[0]?.id ?? ''))
  const [accrual, setAccrual] = useState(initial?.monthly_accrual != null ? String(initial.monthly_accrual) : '')

  const valid = name.trim() && accountId

  function handleSave() {
    onSave({
      name: name.trim(),
      account_id: accountId,
      monthly_accrual: accrual ? parseFloat(accrual) : null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-white font-semibold">{initial ? 'Edit' : 'Add'} Earmark</h3>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Fed Tax 2026"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Held In</label>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inputCls}>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Monthly Set-Aside <span className="text-gray-600">(optional)</span></label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" step="0.01" value={accrual} onChange={e => setAccrual(e.target.value)} placeholder="0.00" className={dollarCls} />
          </div>
          <p className="text-xs text-gray-600 mt-1">Enables the one-tap monthly accrue button.</p>
        </div>

        <div className="flex gap-2 pt-1">
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-3 py-2 bg-red-900/40 hover:bg-red-900/70 text-red-400 rounded-lg text-sm"
            >
              Delete
            </button>
          )}
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm">
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={handleSave}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function EarmarkEventModal({
  earmark,
  onClose,
  onSave,
}: {
  earmark: Earmark
  onClose: () => void
  onSave: (data: EarmarkEventCreate) => void
}) {
  const [mode, setMode] = useState<'set_aside' | 'release'>('set_aside')
  const [amount, setAmount] = useState(earmark.monthly_accrual != null ? String(earmark.monthly_accrual) : '')
  const [date, setDate] = useState(todayStr())
  const [description, setDescription] = useState('')

  const parsed = parseFloat(amount)
  const valid = !isNaN(parsed) && parsed > 0 && date

  function handleSave() {
    onSave({
      date,
      amount: mode === 'release' ? -parsed : parsed,
      description: description.trim() || null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-white font-semibold">{earmark.name}</h3>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('set_aside')}
            className={`rounded-lg py-2 text-sm font-medium border ${
              mode === 'set_aside'
                ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            Set Aside
          </button>
          <button
            onClick={() => setMode('release')}
            className={`rounded-lg py-2 text-sm font-medium border ${
              mode === 'release'
                ? 'bg-amber-900/40 border-amber-700 text-amber-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            Release / Paid
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input autoFocus type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={dollarCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Note <span className="text-gray-600">(optional)</span></label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={mode === 'release' ? 'e.g. Q2 estimated tax payment' : 'e.g. July set-aside'}
            className={inputCls}
          />
        </div>

        {mode === 'release' && (
          <p className="text-xs text-amber-500/80">
            Releasing reduces this earmark — use when the payment went out or the money is freed up.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm">
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={handleSave}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function EarmarkRow({
  earmark,
  onQuickAccrue,
  onAddEvent,
  onEdit,
  onDeleteEvent,
}: {
  earmark: Earmark
  onQuickAccrue: () => void
  onAddEvent: () => void
  onEdit: () => void
  onDeleteEvent: (eventId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const currentMonth = todayStr().slice(0, 7)
  const accruedThisMonth = earmark.events.some(ev => ev.date.startsWith(currentMonth) && ev.amount > 0)

  return (
    <div>
      <div className="flex items-center gap-2 py-1.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-600 hover:text-gray-300 text-xs w-4 shrink-0"
          title="Show history"
        >
          {expanded ? '▾' : '▸'}
        </button>
        <button onClick={onEdit} className="text-sm text-gray-300 hover:text-white text-left truncate">
          {earmark.name}
        </button>
        {earmark.monthly_accrual != null && (
          <span className="text-xs text-gray-600 shrink-0">{fmt(earmark.monthly_accrual)}/mo</span>
        )}
        <div className="flex-1" />
        {earmark.monthly_accrual != null && (
          <button
            onClick={onQuickAccrue}
            title={accruedThisMonth ? 'Already set aside this month' : `Set aside ${fmt(earmark.monthly_accrual)} for this month`}
            className={`text-xs px-2 py-0.5 rounded-md border shrink-0 ${
              accruedThisMonth
                ? 'border-gray-800 text-gray-700 hover:text-gray-500'
                : 'border-amber-700/60 text-amber-400 hover:bg-amber-900/30'
            }`}
          >
            {accruedThisMonth ? '✓ month' : '+ month'}
          </button>
        )}
        <button
          onClick={onAddEvent}
          title="Set aside or release a custom amount"
          className="text-xs px-2 py-0.5 rounded-md border border-gray-700 text-gray-400 hover:text-white shrink-0"
        >
          ±
        </button>
        <span className="text-sm font-mono text-red-400/90 w-24 text-right shrink-0">
          −{fmt(earmark.current_amount)}
        </span>
      </div>

      {expanded && (
        <div className="ml-6 mb-2 space-y-1">
          {earmark.events.length === 0 ? (
            <p className="text-xs text-gray-600">No activity yet.</p>
          ) : (
            earmark.events.map(ev => (
              <div key={ev.id} className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 font-mono">{ev.date}</span>
                <span className="text-gray-400 truncate">{ev.description ?? (ev.amount >= 0 ? 'Set aside' : 'Released')}</span>
                <div className="flex-1" />
                <span className={`font-mono ${ev.amount >= 0 ? 'text-emerald-500' : 'text-amber-400'}`}>
                  {ev.amount >= 0 ? '+' : ''}{fmt(ev.amount)}
                </span>
                <button
                  onClick={() => onDeleteEvent(ev.id)}
                  className="text-gray-700 hover:text-red-400"
                  title="Delete entry"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function EarmarksCard({ accounts }: { accounts: Account[] }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Earmark | null>(null)
  const [addingEventFor, setAddingEventFor] = useState<Earmark | null>(null)

  const { data: earmarks = [] } = useQuery({
    queryKey: ['earmarks'],
    queryFn: () => api.earmarks.list(),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['earmarks'] })

  const createMutation = useMutation({
    mutationFn: (data: EarmarkCreate) => api.earmarks.create(data),
    onSuccess: () => { invalidate(); setShowAdd(false) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EarmarkUpdate }) => api.earmarks.update(id, data),
    onSuccess: () => { invalidate(); setEditing(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.earmarks.delete(id),
    onSuccess: () => { invalidate(); setEditing(null) },
  })
  const addEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EarmarkEventCreate }) => api.earmarks.addEvent(id, data),
    onSuccess: () => { invalidate(); setAddingEventFor(null) },
  })
  const deleteEventMutation = useMutation({
    mutationFn: ({ id, eventId }: { id: string; eventId: string }) => api.earmarks.deleteEvent(id, eventId),
    onSuccess: invalidate,
  })

  const savingsAccounts = accounts.filter(a => a.type === 'savings' && a.is_active)
  const cashAccounts = accounts.filter(a => (a.type === 'savings' || a.type === 'checking') && a.is_active)
  const baseAccounts = savingsAccounts.length > 0 ? savingsAccounts : cashAccounts
  const baseLabel = savingsAccounts.length > 0 ? 'Savings balance' : 'Cash balance'
  const baseBalance = baseAccounts.reduce((s, a) => s + a.current_balance, 0)

  const ccCommitted = accounts
    .filter(a => a.type === 'credit_card' && a.is_active)
    .reduce((s, a) => s + Math.max(a.current_balance, 0), 0)

  const earmarkTotal = earmarks.reduce((s, e) => s + e.current_amount, 0)
  const effective = baseBalance - earmarkTotal - ccCommitted

  // earmark modal candidates: cash-type accounts (where set-aside money physically sits)
  const holdingAccounts = cashAccounts.length > 0 ? cashAccounts : accounts

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-white uppercase tracking-wider">Effective Savings</h2>
        <button onClick={() => setShowAdd(true)} className="text-xs text-indigo-400 hover:text-indigo-300">
          + Add earmark
        </button>
      </div>

      <div className="flex justify-between items-center py-1.5">
        <span className="text-sm text-gray-400">{baseLabel}</span>
        <span className="text-sm font-mono text-white">{fmt(baseBalance)}</span>
      </div>

      <div className="border-t border-gray-800/60 mt-1 pt-1">
        {earmarks.length === 0 ? (
          <p className="text-xs text-gray-600 py-1.5">
            No earmarks yet — add one to track money committed to future payments (taxes, SEP, Roth).
          </p>
        ) : (
          earmarks.map(e => (
            <EarmarkRow
              key={e.id}
              earmark={e}
              onQuickAccrue={() =>
                addEventMutation.mutate({
                  id: e.id,
                  data: { date: todayStr(), amount: e.monthly_accrual!, description: 'Monthly set-aside' },
                })
              }
              onAddEvent={() => setAddingEventFor(e)}
              onEdit={() => setEditing(e)}
              onDeleteEvent={eventId => deleteEventMutation.mutate({ id: e.id, eventId })}
            />
          ))
        )}

        <div className="flex items-center gap-2 py-1.5">
          <span className="w-4 shrink-0" />
          <span className="text-sm text-gray-300">Card balances</span>
          <span className="text-xs text-gray-600">auto — all credit cards</span>
          <div className="flex-1" />
          <span className="text-sm font-mono text-red-400/90 w-24 text-right shrink-0">−{fmt(ccCommitted)}</span>
        </div>
      </div>

      <div className="flex justify-between items-center border-t border-gray-800 mt-1 pt-3">
        <span className="text-sm font-medium text-gray-300">Effective savings</span>
        <span className={`text-xl font-bold font-mono ${effective < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
          {fmt(effective)}
        </span>
      </div>
      <p className="text-xs text-gray-600 mt-1">What's actually yours after committed money and card obligations.</p>

      {showAdd && (
        <EarmarkModal
          accounts={holdingAccounts}
          onClose={() => setShowAdd(false)}
          onSave={data => createMutation.mutate(data as EarmarkCreate)}
        />
      )}
      {editing && (
        <EarmarkModal
          accounts={holdingAccounts}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={data => updateMutation.mutate({ id: editing.id, data })}
          onDelete={() => {
            if (confirm(`Delete earmark "${editing.name}" and its history?`)) {
              deleteMutation.mutate(editing.id)
            }
          }}
        />
      )}
      {addingEventFor && (
        <EarmarkEventModal
          earmark={addingEventFor}
          onClose={() => setAddingEventFor(null)}
          onSave={data => addEventMutation.mutate({ id: addingEventFor.id, data })}
        />
      )}
    </div>
  )
}
