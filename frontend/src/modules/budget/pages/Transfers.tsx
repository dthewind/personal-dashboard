import { useState } from 'react'
import PageShell from '../components/PageShell'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { fmt, todayStr } from '../utils'
import { DateRangePicker, defaultRange } from '../components/DateRangePicker'
import type { DateRange } from '../components/DateRangePicker'
import type { Account, Transfer, TransferCreate, TransferUpdate } from '../types'

const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500'

function TransferForm({
  accounts,
  initial,
  onSave,
  onCancel,
  saving,
  submitLabel,
}: {
  accounts: Account[]
  initial?: Transfer
  onSave: (data: TransferCreate) => void
  onCancel: () => void
  saving: boolean
  submitLabel: string
}) {
  const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name))
  const firstChecking = sorted.find(a => a.type === 'checking')

  const [fromId, setFromId] = useState(initial?.from_account_id ?? firstChecking?.id ?? sorted[0]?.id ?? '')
  const [toId, setToId] = useState(initial?.to_account_id ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [date, setDate] = useState(initial?.date ?? todayStr())
  const [description, setDescription] = useState(initial?.description ?? '')

  const valid = fromId && toId && fromId !== toId && amount && parseFloat(amount) > 0

  const toAccount = sorted.find(a => a.id === toId)
  const isCcPayment = toAccount?.type === 'credit_card'

  function handleToChange(newToId: string) {
    setToId(newToId)
    const acct = sorted.find(a => a.id === newToId)
    if (acct?.type === 'credit_card' && !description.trim()) {
      setDescription(`${acct.name} payment`)
    }
  }

  function handleSave() {
    const desc = description.trim() || (isCcPayment ? `${toAccount?.name} payment` : 'Transfer')
    onSave({ from_account_id: fromId, to_account_id: toId, amount: parseFloat(amount), date, description: desc })
  }

  return (
    <div className="bg-gray-900 border border-indigo-600 rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">From</label>
          <select value={fromId} onChange={e => setFromId(e.target.value)} className={inputCls}>
            <option value="">— select —</option>
            {sorted.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">To</label>
          <select value={toId} onChange={e => handleToChange(e.target.value)} className={inputCls}>
            <option value="">— select —</option>
            {sorted.filter(a => a.id !== fromId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      {isCcPayment && (
        <p className="text-xs text-indigo-400 -mt-1">
          CC payment — will reduce {toAccount?.name} balance (paying down debt).
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              autoFocus
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className={inputCls + ' pl-7'}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Description <span className="text-gray-600">(optional)</span></label>
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. savings deposit — auto-filled for CC payments"
          className={inputCls}
        />
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm">
          Cancel
        </button>
        <button
          disabled={!valid || saving}
          onClick={handleSave}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium"
        >
          {saving ? '…' : submitLabel}
        </button>
      </div>
    </div>
  )
}

export default function TransfersPage() {
  const qc = useQueryClient()
  const [range, setRange] = useState<DateRange>(defaultRange('this_year'))
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
  })

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['transfers', range.start, range.end, filterFrom, filterTo],
    queryFn: () => api.transfers.list({
      start: range.start,
      end: range.end,
      from_account_id: filterFrom || undefined,
      to_account_id: filterTo || undefined,
    }),
    enabled: !!(range.start && range.end),
  })

  const createMutation = useMutation({
    mutationFn: (data: TransferCreate) => api.transfers.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setShowAdd(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransferUpdate }) => api.transfers.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.transfers.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setConfirmDeleteId(null)
    },
  })

  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]))

  return (
    <PageShell>
      <div className="flex justify-end">
        {!showAdd && !editingId && (
          <button
            onClick={() => setShowAdd(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            + New Transfer
          </button>
        )}
      </div>

      <div className="flex items-center flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">From</span>
          <select
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Any</option>
            {[...accounts].sort((a, b) => a.name.localeCompare(b.name)).map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">To</span>
          <select
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Any</option>
            {[...accounts].sort((a, b) => a.name.localeCompare(b.name)).map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        {(filterFrom || filterTo) && (
          <button onClick={() => { setFilterFrom(''); setFilterTo('') }} className="text-xs text-gray-500 hover:text-gray-300">
            Clear
          </button>
        )}
        <DateRangePicker value={range} onChange={setRange} />
        {!isLoading && transfers.length > 0 && (
          <span className="text-xs text-gray-500 ml-auto">
            {transfers.length} transfer{transfers.length !== 1 ? 's' : ''} · {' '}
            <span className="text-white font-mono">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                transfers.reduce((s, t) => s + t.amount, 0)
              )}
            </span>
          </span>
        )}
      </div>

      {showAdd && (
        <TransferForm
          accounts={accounts}
          onSave={data => createMutation.mutate(data)}
          onCancel={() => setShowAdd(false)}
          saving={createMutation.isPending}
          submitLabel="Save Transfer"
        />
      )}

      {isLoading && <div className="text-gray-500 text-sm">Loading…</div>}

      {!isLoading && transfers.length === 0 && !showAdd && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm">No transfers for this period.</p>
          <p className="text-gray-600 text-xs mt-1">{range.start} — {range.end}</p>
        </div>
      )}

      {transfers.length > 0 && (
        <div className="space-y-2">
          {transfers.map(t => {
            const from = accountMap[t.from_account_id]
            const to = accountMap[t.to_account_id]
            const isCc = to?.type === 'credit_card'

            if (editingId === t.id) {
              return (
                <TransferForm
                  key={t.id}
                  accounts={accounts}
                  initial={t}
                  onSave={data => updateMutation.mutate({ id: t.id, data })}
                  onCancel={() => setEditingId(null)}
                  saving={updateMutation.isPending}
                  submitLabel="Save Changes"
                />
              )
            }

            return (
              <div
                key={t.id}
                className="bg-gray-900 border border-gray-800 rounded-xl flex items-center gap-3 px-4 py-3 group hover:bg-gray-800/30 transition-colors"
              >
                <div className="text-xs text-gray-500 w-16 flex-shrink-0 font-mono">
                  {t.date.slice(5)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white">{t.description}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {from?.name ?? '—'}
                    <span className="mx-1 text-gray-700">→</span>
                    <span className={isCc ? 'text-indigo-400' : 'text-gray-400'}>{to?.name ?? '—'}</span>
                    {isCc && <span className="ml-1 text-xs text-gray-600">(CC payment)</span>}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono text-white">{fmt(t.amount)}</div>
                  {confirmDeleteId === t.id ? (
                    <div className="flex gap-2 mt-1 justify-end">
                      <button onClick={() => deleteMutation.mutate(t.id)} className="text-xs text-red-400 hover:text-red-300">
                        Confirm
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-500 hover:text-gray-300">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-3 mt-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingId(t.id); setShowAdd(false); setConfirmDeleteId(null) }}
                        className="text-xs text-gray-500 hover:text-indigo-400 transition-colors"
                      >
                        edit
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(t.id)}
                        className="text-xs text-gray-700 hover:text-red-400 transition-colors"
                      >
                        delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
