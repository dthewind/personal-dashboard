import { useState } from 'react'
import PageShell from '../components/PageShell'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { fmt, currentMonthStr, prevMonth, nextMonth, monthLabel } from '../utils'
import type {
  Account,
  AllocationCreate,
  IncomePeriod, IncomePeriodCreate,
  LedgerEntry, LedgerEntryCreate, LedgerEntryUpdate,
  IncomeType,
} from '../types'

// ── Month navigation ──────────────────────────────────────────────────────────

function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const today = currentMonthStr()
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(prevMonth(month))}
        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 text-lg"
      >
        ‹
      </button>
      <span className="text-white font-medium min-w-36 text-center">{monthLabel(month)}</span>
      <button
        onClick={() => onChange(nextMonth(month))}
        disabled={month >= today}
        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 text-lg disabled:opacity-30"
      >
        ›
      </button>
    </div>
  )
}

// ── Work Period card ──────────────────────────────────────────────────────────

function WorkPeriodCard({ month }: { month: string }) {
  const qc = useQueryClient()
  const [showSetup, setShowSetup] = useState(false)
  const [editing, setEditing] = useState(false)

  const [rate, setRate] = useState('')
  const [planned, setPlanned] = useState('')
  const [actual, setActual] = useState('')
  const [payMonth, setPayMonth] = useState('')

  const { data: periods } = useQuery({
    queryKey: ['income-periods', 'work', month],
    queryFn: () => api.income.periods.list({ work_month: month }),
  })
  const period = periods?.[0] ?? null

  const createMutation = useMutation({
    mutationFn: (data: IncomePeriodCreate) => api.income.periods.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-periods', 'work', month] })
      setShowSetup(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.income.periods.update>[1] }) =>
      api.income.periods.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income-periods', 'work', month] })
      setEditing(false)
    },
  })

  function startEdit(p: IncomePeriod) {
    setRate(String(p.hourly_rate))
    setPlanned(String(p.planned_hours))
    setActual(String(p.actual_hours))
    setPayMonth(p.pay_month.slice(0, 7))
    setEditing(true)
  }

  function startSetup() {
    const next = nextMonth(month)
    setRate('56')
    setPlanned('')
    setActual('')
    setPayMonth(next.slice(0, 7))
    setShowSetup(true)
  }

  const inputCls = 'bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500'

  if (period && editing) {
    return (
      <div className="bg-gray-900 border border-indigo-600 rounded-xl p-5 space-y-4">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Edit Work Period</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Pay Month</label>
            <input
              type="month"
              value={payMonth}
              onChange={e => setPayMonth(e.target.value)}
              className={inputCls + ' w-full'}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Hourly Rate ($)</label>
            <input
              type="number"
              step="0.01"
              value={rate}
              onChange={e => setRate(e.target.value)}
              className={inputCls + ' w-full'}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Planned Hours</label>
            <input
              type="number"
              step="0.5"
              value={planned}
              onChange={e => setPlanned(e.target.value)}
              className={inputCls + ' w-full'}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Actual Hours</label>
            <input
              type="number"
              step="0.5"
              value={actual}
              onChange={e => setActual(e.target.value)}
              className={inputCls + ' w-full'}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(false)}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              updateMutation.mutate({
                id: period.id,
                data: {
                  pay_month: payMonth + '-01',
                  hourly_rate: parseFloat(rate) || 56,
                  planned_hours: parseFloat(planned) || 0,
                  actual_hours: parseFloat(actual) || 0,
                },
              })
            }
            disabled={updateMutation.isPending}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium"
          >
            {updateMutation.isPending ? '…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  if (period) {
    const payLbl = monthLabel(period.pay_month)
    const pctDone =
      period.planned_hours > 0
        ? Math.min((period.actual_hours / period.planned_hours) * 100, 100)
        : 0
    const barColor = pctDone >= 100 ? 'bg-emerald-500' : pctDone >= 80 ? 'bg-indigo-500' : 'bg-amber-500'

    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Contract Work Period</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {monthLabel(period.work_month)} work → {payLbl} pay
            </div>
          </div>
          <button onClick={() => startEdit(period)} className="text-xs text-indigo-400 hover:text-indigo-300">
            Edit
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-xs text-gray-500">Rate</div>
            <div className="text-white font-mono text-sm mt-0.5">${period.hourly_rate}/hr</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Planned</div>
            <div className="text-white font-mono text-sm mt-0.5">
              {period.planned_hours}h
              <span className="text-gray-400 text-xs ml-1">= {fmt(period.gross_planned)}</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Actual</div>
            <div
              className={`font-mono text-sm mt-0.5 ${
                period.actual_hours >= period.planned_hours ? 'text-emerald-400' : 'text-white'
              }`}
            >
              {period.actual_hours}h
              <span className="text-gray-400 text-xs ml-1">= {fmt(period.gross_actual)}</span>
            </div>
          </div>
        </div>

        {period.planned_hours > 0 && (
          <div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${pctDone}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">{Math.round(pctDone)}% of planned hours logged</div>
          </div>
        )}
      </div>
    )
  }

  if (showSetup) {
    return (
      <div className="bg-gray-900 border border-indigo-600 rounded-xl p-5 space-y-4">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Set Up Work Period — {monthLabel(month)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Pay Month</label>
            <input
              type="month"
              value={payMonth}
              onChange={e => setPayMonth(e.target.value)}
              className={inputCls + ' w-full'}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Hourly Rate ($)</label>
            <input
              autoFocus
              type="number"
              step="0.01"
              value={rate}
              onChange={e => setRate(e.target.value)}
              placeholder="56.00"
              className={inputCls + ' w-full'}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Planned Hours</label>
            <input
              type="number"
              step="0.5"
              value={planned}
              onChange={e => setPlanned(e.target.value)}
              placeholder="160"
              className={inputCls + ' w-full'}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Actual Hours (so far)</label>
            <input
              type="number"
              step="0.5"
              value={actual}
              onChange={e => setActual(e.target.value)}
              placeholder="0"
              className={inputCls + ' w-full'}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSetup(false)}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              createMutation.mutate({
                work_month: month,
                pay_month: (payMonth || nextMonth(month).slice(0, 7)) + '-01',
                hourly_rate: parseFloat(rate) || 56,
                planned_hours: parseFloat(planned) || 0,
                actual_hours: parseFloat(actual) || 0,
              })
            }
            disabled={createMutation.isPending || !rate}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium"
          >
            {createMutation.isPending ? '…' : 'Create'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Contract Work Period</div>
      <div className="flex items-center justify-between">
        <p className="text-gray-500 text-sm">No work period tracked for {monthLabel(month)}.</p>
        <button
          onClick={startSetup}
          className="text-xs text-indigo-400 hover:text-indigo-300 ml-4 flex-shrink-0"
        >
          + Set up
        </button>
      </div>
    </div>
  )
}

// ── Add / Edit income entry form ──────────────────────────────────────────────

const INCOME_TYPES: { value: IncomeType; label: string }[] = [
  { value: 'contract', label: 'Contract' },
  { value: 'interest', label: 'Interest' },
  { value: 'tbill', label: 'T-Bill' },
  { value: 'investment', label: 'Investment' },
  { value: 'other', label: 'Other' },
]

function IncomeEntryForm({
  defaultMonth,
  initial,
  accounts,
  onSave,
  onCancel,
  saving,
}: {
  defaultMonth: string
  initial?: LedgerEntry
  accounts: Account[]
  onSave: (d: LedgerEntryCreate) => void
  onCancel: () => void
  saving: boolean
}) {
  const [type, setType] = useState<IncomeType>((initial?.subtype as IncomeType) ?? 'contract')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [description, setDescription] = useState(initial?.notes ?? '')
  const [date, setDate] = useState(initial?.date ?? defaultMonth.slice(0, 7) + '-01')
  const [toAccountId, setToAccountId] = useState(initial?.account_id ?? '')
  const depositAccounts = accounts.filter(a => a.type === 'checking' || a.type === 'savings')
  const valid = amount && parseFloat(amount) > 0 && description.trim() && toAccountId

  return (
    <div className="bg-gray-900 border border-indigo-600 rounded-xl p-5 space-y-4">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
        {initial ? 'Edit Income' : 'Add Income'}
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Type</label>
        <div className="flex flex-wrap gap-2">
          {INCOME_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                type === t.value ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Amount</label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              autoFocus
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-6 pr-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Received Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Description</label>
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. June contract hours"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Deposited into</label>
        {depositAccounts.length === 0 ? (
          <p className="text-xs text-amber-400">Add a checking or savings account first.</p>
        ) : (
          <select
            value={toAccountId}
            onChange={e => setToAccountId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">— select account —</option>
            {depositAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm"
        >
          Cancel
        </button>
        <button
          disabled={!valid || saving}
          onClick={() =>
            onSave({
              type: 'income',
              account_id: toAccountId,
              amount: parseFloat(amount),
              subtype: type,
              notes: description.trim(),
              date,
            })
          }
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium"
        >
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Income Entries section ────────────────────────────────────────────────────

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

function IncomeEntriesSection({ month, accounts }: { month: string; accounts: Account[] }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['ledger', 'income', month],
    queryFn: () => api.ledger.list({ start: month, end: lastDayOfMonth(month), type: 'income' }),
  })

  const createMutation = useMutation({
    mutationFn: (data: LedgerEntryCreate) => api.ledger.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      setShowAdd(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: LedgerEntryUpdate }) =>
      api.ledger.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.ledger.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      setConfirmDeleteId(null)
    },
  })

  const total = entries.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Income Received — {monthLabel(month)}
        </h2>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            + Add
          </button>
        )}
      </div>

      {showAdd && (
        <div className="mb-4">
          <IncomeEntryForm
            defaultMonth={month}
            accounts={accounts}
            onSave={data => createMutation.mutate(data)}
            onCancel={() => setShowAdd(false)}
            saving={createMutation.isPending}
          />
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-500 text-sm">Loading…</div>
      ) : entries.length === 0 && !showAdd ? (
        <p className="text-gray-600 text-sm">No income entries for this month.</p>
      ) : (
        <div className="space-y-1">
          {entries.map(entry => {
            if (editingId === entry.id) {
              return (
                <div key={entry.id} className="mb-2">
                  <IncomeEntryForm
                    defaultMonth={month}
                    initial={entry}
                    accounts={accounts}
                    onSave={data => updateMutation.mutate({ id: entry.id, data: {
                      date: data.date,
                      account_id: data.account_id,
                      amount: data.amount,
                      subtype: data.subtype,
                      notes: data.notes,
                    }})}
                    onCancel={() => setEditingId(null)}
                    saving={updateMutation.isPending}
                  />
                </div>
              )
            }

            return (
              <div
                key={entry.id}
                className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-gray-200">{entry.notes}</span>
                    <span className="text-xs text-gray-500 capitalize flex-shrink-0">{entry.subtype}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <span className="text-sm font-mono text-emerald-400">{fmt(entry.amount)}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingId(entry.id)}
                      className="text-gray-500 hover:text-gray-300 text-xs px-1"
                      title="Edit"
                    >
                      ✎
                    </button>
                    {confirmDeleteId === entry.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => deleteMutation.mutate(entry.id)}
                          className="text-red-400 hover:text-red-300 text-xs px-1"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-gray-500 hover:text-gray-300 text-xs px-1"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(entry.id)}
                        className="text-gray-600 hover:text-red-400 text-xs px-1"
                        title="Delete"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {entries.length > 0 && (
            <div className="flex justify-between items-center pt-3 mt-1">
              <span className="text-sm font-medium text-gray-300">Total</span>
              <span className="text-sm font-mono font-semibold text-white">{fmt(total)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Deductions section ────────────────────────────────────────────────────────

function DeductionsSection({ month }: { month: string }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [fed, setFed] = useState('')
  const [state, setState] = useState('')
  const [sep, setSep] = useState('')
  const [roth, setRoth] = useState('')

  const { data: alloc } = useQuery({
    queryKey: ['allocation', month],
    queryFn: () => api.allocation.get(month),
  })

  function startEdit() {
    setFed(String(alloc?.fed_tax ?? 0))
    setState(String(alloc?.state_tax ?? 0))
    setSep(String(alloc?.sep_contribution ?? 0))
    setRoth(String(alloc?.roth_contribution ?? 0))
    setEditing(true)
  }

  const saveMutation = useMutation({
    mutationFn: (data: AllocationCreate) => api.allocation.upsert(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allocation', month] })
      qc.invalidateQueries({ queryKey: ['waterfall', month] })
      setEditing(false)
    },
  })

  const inputCls =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Deductions &amp; Savings — {monthLabel(month)}
        </h2>
        {!editing && (
          <button onClick={startEdit} className="text-xs text-indigo-400 hover:text-indigo-300">
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Federal Tax', val: fed, set: setFed },
              { label: 'State Tax', val: state, set: setState },
              { label: 'SEP Contribution', val: sep, set: setSep },
              { label: 'Roth IRA', val: roth, set: setRoth },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <input
                  type="number"
                  step="0.01"
                  value={val}
                  onChange={e => set(e.target.value)}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                saveMutation.mutate({
                  pay_month: month,
                  fed_tax: parseFloat(fed) || 0,
                  state_tax: parseFloat(state) || 0,
                  sep_contribution: parseFloat(sep) || 0,
                  roth_contribution: parseFloat(roth) || 0,
                })
              }
              disabled={saveMutation.isPending}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium"
            >
              {saveMutation.isPending ? '…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Federal Tax', value: alloc?.fed_tax ?? 0 },
            { label: 'State Tax', value: alloc?.state_tax ?? 0 },
            { label: 'SEP', value: alloc?.sep_contribution ?? 0 },
            { label: 'Roth IRA', value: alloc?.roth_contribution ?? 0 },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-white font-mono text-sm mt-0.5">{fmt(Number(value))}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Summary row ───────────────────────────────────────────────────────────────

function SummarySection({ month }: { month: string }) {
  const { data: w } = useQuery({
    queryKey: ['waterfall', month],
    queryFn: () => api.waterfall(month),
  })

  if (!w) return null

  const deductions = w.fed_tax + w.state_tax + w.sep_contribution + w.roth_contribution

  const rows: { label: string; amount: number; sub?: boolean; bold?: boolean; color?: 'red' | 'green' }[] = [
    { label: 'Gross Income', amount: w.gross_income, color: 'green' },
    { label: 'Federal Tax', amount: w.fed_tax, sub: true, color: 'red' },
    { label: 'State Tax', amount: w.state_tax, sub: true, color: 'red' },
    { label: 'SEP Contribution', amount: w.sep_contribution, sub: true, color: 'red' },
    { label: 'Net Income', amount: w.net_income, bold: true },
    { label: 'Roth IRA', amount: w.roth_contribution, sub: true, color: 'red' },
    { label: 'After Savings', amount: w.after_save, bold: true },
  ]

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
        Summary — {monthLabel(month)}
      </h2>
      <div className="space-y-1">
        {rows.map(r => (
          <div
            key={r.label}
            className={`flex justify-between items-center py-1 ${r.bold ? 'border-t border-gray-700 mt-1 pt-2' : ''}`}
          >
            <span
              className={`text-sm ${
                r.sub ? 'pl-4 text-gray-400' : r.bold ? 'font-semibold text-white' : 'text-gray-300'
              }`}
            >
              {r.sub ? '─ ' : ''}{r.label}
            </span>
            <span
              className={`text-sm font-mono ${r.bold ? 'font-semibold' : ''} ${
                r.color === 'red'
                  ? 'text-red-400'
                  : r.color === 'green'
                  ? 'text-emerald-400'
                  : 'text-white'
              }`}
            >
              {r.color === 'red' ? `(${fmt(r.amount)})` : fmt(r.amount)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between text-xs text-gray-500">
        <span>Total deductions</span>
        <span className="font-mono text-red-400">{fmt(deductions)}</span>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function IncomePage() {
  const [month, setMonth] = useState(currentMonthStr)

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
  })

  return (
    <PageShell>
      <div className="flex justify-end">
        <MonthNav month={month} onChange={setMonth} />
      </div>

      <WorkPeriodCard month={month} />
      <IncomeEntriesSection month={month} accounts={accounts} />
      <DeductionsSection month={month} />
      <SummarySection month={month} />
    </PageShell>
  )
}
