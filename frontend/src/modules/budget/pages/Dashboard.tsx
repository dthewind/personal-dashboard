import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { fmt, currentMonthStr, prevMonth, nextMonth, monthLabel } from '../utils'
import type { Account, AccountCreate, AccountType, AllocationCreate, IncomeEntryCreate, IncomeType, WaterfallData } from '../types'

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

// ── Waterfall table ───────────────────────────────────────────────────────────

function WRow({
  label,
  amount,
  isTotal,
  indent,
  color,
}: {
  label: string
  amount: number
  isTotal?: boolean
  indent?: boolean
  color?: 'green' | 'red' | 'white'
}) {
  const textColor =
    color === 'green'
      ? 'text-emerald-400'
      : color === 'red'
      ? 'text-red-400'
      : 'text-white'
  return (
    <div
      className={`flex justify-between items-center py-1.5 ${
        isTotal ? 'border-t border-gray-700 mt-1 pt-2.5' : ''
      }`}
    >
      <span
        className={`text-sm ${
          indent ? 'pl-4 text-gray-400' : isTotal ? 'font-semibold text-white' : 'text-gray-300'
        }`}
      >
        {indent ? '─ ' : ''}{label}
      </span>
      <span className={`text-sm font-mono ${isTotal ? 'font-semibold' : ''} ${textColor}`}>
        {color === 'red' ? `(${fmt(amount)})` : fmt(amount)}
      </span>
    </div>
  )
}

function Waterfall({ w }: { w: WaterfallData }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
        Waterfall
      </h2>
      <WRow label="Gross Income" amount={w.gross_income} color="green" />
      <WRow label="Federal Tax" amount={w.fed_tax} indent color="red" />
      <WRow label="State Tax" amount={w.state_tax} indent color="red" />
      <WRow label="SEP Contribution" amount={w.sep_contribution} indent color="red" />
      <WRow label="Net Income" amount={w.net_income} isTotal />
      <WRow label="Roth IRA" amount={w.roth_contribution} indent color="red" />
      <WRow label="After Savings" amount={w.after_save} isTotal />
      <WRow label="Fixed Bills" amount={w.fixed_bills_total} indent color="red" />
      <WRow label="Max Spend" amount={w.max_spend} isTotal />
      <WRow label="Spent to Date" amount={w.spent_to_date} indent color="red" />
      <WRow
        label="Remaining"
        amount={w.remaining}
        isTotal
        color={w.remaining < 0 ? 'red' : 'green'}
      />
    </div>
  )
}

// ── Account card ──────────────────────────────────────────────────────────────

function AccountCard({ account }: { account: Account }) {
  const qc = useQueryClient()
  const isCredit = account.type === 'credit_card'
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(account.name)
  // reconcile_to: user enters the actual current balance; backend back-calculates opening_balance
  const [reconcileTo, setReconcileTo] = useState(String(account.current_balance))
  const [limit, setLimit] = useState(String(account.credit_limit ?? ''))

  function startEdit() {
    setName(account.name)
    setReconcileTo(String(account.current_balance))
    setLimit(String(account.credit_limit ?? ''))
    setEditing(true)
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      api.accounts.update(account.id, {
        name: name.trim() || account.name,
        reconcile_to: parseFloat(reconcileTo) || 0,
        ...(isCredit && { credit_limit: limit ? parseFloat(limit) : undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      setEditing(false)
    },
  })

  const pct =
    isCredit && account.credit_limit
      ? Math.min((account.current_balance / account.credit_limit) * 100, 100)
      : 0
  const barColor =
    pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'

  const dollarInput = 'w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 pl-6'

  if (editing) {
    return (
      <div className="bg-gray-900 border border-indigo-600 rounded-xl p-4 space-y-2">
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && setEditing(false)}
          placeholder="Account name"
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
        />
        <div>
          <label className="block text-xs text-gray-500 mb-1">Current Balance (reconcile)</label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              step="0.01"
              value={reconcileTo}
              onChange={e => setReconcileTo(e.target.value)}
              placeholder="0.00"
              className={dollarInput}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">Enter the real-world balance to reconcile.</p>
        </div>
        {isCredit && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Credit Limit</label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                step="0.01"
                value={limit}
                onChange={e => setLimit(e.target.value)}
                placeholder="0.00"
                className={dollarInput}
              />
            </div>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setEditing(false)}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded py-1.5 text-xs"
          >
            Cancel
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium"
          >
            {updateMutation.isPending ? '…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-gray-900 border border-gray-800 rounded-xl p-4 cursor-default select-none hover:border-gray-700 transition-colors"
      onDoubleClick={startEdit}
      title="Double-click to edit"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="text-xs text-gray-400 truncate">{account.name}</div>
          <div
            className={`text-lg font-semibold font-mono mt-0.5 ${
              isCredit ? 'text-white' : 'text-emerald-400'
            }`}
          >
            {fmt(account.current_balance)}
          </div>
        </div>
        {account.credit_limit && (
          <div className="text-xs text-gray-500 flex-shrink-0">
            / {fmt(account.credit_limit)}
          </div>
        )}
      </div>
      {isCredit && account.credit_limit && (
        <div className="mt-2">
          <div className="h-1.5 bg-gray-800 rounded-full">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">{Math.round(pct)}% used</div>
        </div>
      )}
    </div>
  )
}

// ── Add Account modal ─────────────────────────────────────────────────────────

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'investment', label: 'Investment' },
]

function AddAccountModal({ onClose, onSave }: { onClose: () => void; onSave: (d: AccountCreate) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('credit_card')
  const [limit, setLimit] = useState('')
  const [balance, setBalance] = useState('')
  const valid = name.trim()
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-white font-semibold">Add Account</h3>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Chase Visa"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Type</label>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_TYPES.map(t => (
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
        {type === 'credit_card' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">Credit Limit</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                step="0.01"
                value={limit}
                onChange={e => setLimit(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Current Balance</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              type="number"
              step="0.01"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">Your balance today — becomes the starting point.</p>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl py-2.5 text-sm">Cancel</button>
          <button
            disabled={!valid}
            onClick={() =>
              onSave({
                name: name.trim(),
                type,
                credit_limit: limit ? parseFloat(limit) : undefined,
                opening_balance: balance ? parseFloat(balance) : undefined,
              })
            }
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Income modal ──────────────────────────────────────────────────────────

const INCOME_TYPES: { value: IncomeType; label: string }[] = [
  { value: 'contract', label: 'Contract' },
  { value: 'interest', label: 'Interest' },
  { value: 'tbill', label: 'T-Bill' },
  { value: 'investment', label: 'Investment' },
  { value: 'other', label: 'Other' },
]

function AddIncomeModal({
  month,
  onClose,
  onSave,
}: {
  month: string
  onClose: () => void
  onSave: (d: IncomeEntryCreate) => void
}) {
  const [type, setType] = useState<IncomeType>('contract')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(month.slice(0, 7) + '-01')
  const valid = amount && parseFloat(amount) > 0 && description.trim()

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-white font-semibold">Add Income</h3>
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
        <div>
          <label className="block text-xs text-gray-400 mb-1">Amount</label>
          <input
            autoFocus
            type="number"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Description</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. July contract hours"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Received Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl py-2.5 text-sm">Cancel</button>
          <button
            disabled={!valid}
            onClick={() =>
              onSave({
                type,
                amount: parseFloat(amount),
                description: description.trim(),
                received_date: date,
              })
            }
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Allocation inline editor ──────────────────────────────────────────────────

function AllocationSection({ month }: { month: string }) {
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

  function save() {
    saveMutation.mutate({
      pay_month: month,
      fed_tax: parseFloat(fed) || 0,
      state_tax: parseFloat(state) || 0,
      sep_contribution: parseFloat(sep) || 0,
      roth_contribution: parseFloat(roth) || 0,
    })
  }

  const inputCls =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Deductions &amp; Savings
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
              onClick={save}
              disabled={saveMutation.isPending}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Federal Tax', value: alloc?.fed_tax ?? 0 },
            { label: 'State Tax', value: alloc?.state_tax ?? 0 },
            { label: 'SEP', value: alloc?.sep_contribution ?? 0 },
            { label: 'Roth IRA', value: alloc?.roth_contribution ?? 0 },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-white font-mono text-sm mt-0.5">{fmt(value)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Account sorting ───────────────────────────────────────────────────────────

type SortKey = 'name' | 'balance' | 'utilization' | 'type'

function sortAccounts(list: Account[], by: SortKey): Account[] {
  return [...list].sort((a, b) => {
    if (by === 'name') return a.name.localeCompare(b.name)
    if (by === 'balance') return b.current_balance - a.current_balance
    const ua = a.credit_limit ? a.current_balance / a.credit_limit : 0
    const ub = b.credit_limit ? b.current_balance / b.credit_limit : 0
    return ub - ua
  })
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const qc = useQueryClient()
  const [month, setMonth] = useState(currentMonthStr)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>('name')

  const { data: waterfall, isLoading: wLoading } = useQuery({
    queryKey: ['waterfall', month],
    queryFn: () => api.waterfall(month),
  })

  const { data: accounts, isLoading: aLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
  })

  const { data: income } = useQuery({
    queryKey: ['income', month],
    queryFn: () => api.income.list(month),
  })

  const addAccountMutation = useMutation({
    mutationFn: (data: AccountCreate) => api.accounts.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setShowAddAccount(false)
    },
  })

  const addIncomeMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.income.create>[0]) => api.income.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income', month] })
      qc.invalidateQueries({ queryKey: ['waterfall', month] })
      setShowAddIncome(false)
    },
  })

  if (wLoading || aLoading) {
    return <div className="text-gray-500 text-sm">Loading...</div>
  }

  const w = waterfall!
  const spentPct = w.max_spend > 0 ? Math.min((w.spent_to_date / w.max_spend) * 100, 100) : 0
  const remainingColor =
    w.remaining < 0
      ? 'text-red-400'
      : w.remaining < w.max_spend * 0.2
      ? 'text-amber-400'
      : 'text-emerald-400'
  const barColor =
    spentPct > 90 ? 'bg-red-500' : spentPct > 70 ? 'bg-amber-500' : 'bg-indigo-500'

  const allAccounts = accounts ?? []
  const effectiveSort = sortBy === 'type' ? 'name' : sortBy
  const creditCards = sortAccounts(allAccounts.filter(a => a.type === 'credit_card'), effectiveSort)
  const otherAccounts = sortAccounts(allAccounts.filter(a => a.type !== 'credit_card'), effectiveSort)
  const cashAccounts = sortAccounts(allAccounts.filter(a => a.type === 'checking' || a.type === 'savings'), 'name')
  const creditAccounts = sortAccounts(allAccounts.filter(a => a.type === 'credit_card'), 'name')
  const investmentAccounts = sortAccounts(allAccounts.filter(a => a.type === 'investment'), 'name')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <MonthNav month={month} onChange={setMonth} />
      </div>

      {/* Hero */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Remaining</div>
            <div className={`text-4xl font-bold font-mono ${remainingColor}`}>
              {fmt(w.remaining)}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 w-48 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${spentPct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{Math.round(spentPct)}% of {fmt(w.max_spend)} spent</span>
            </div>
          </div>
          <div className="flex gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold font-mono text-white">
                {fmt(w.daily_allowance_fixed)}
              </div>
              <div className="text-xs text-gray-500 mt-1">fixed / day</div>
            </div>
            <div className="w-px bg-gray-800" />
            <div className="text-center">
              <div
                className={`text-2xl font-bold font-mono ${
                  w.daily_allowance_dynamic < 0 ? 'text-red-400' : 'text-white'
                }`}
              >
                {fmt(w.daily_allowance_dynamic)}
              </div>
              <div className="text-xs text-gray-500 mt-1">dynamic / day</div>
              <div className="text-xs text-gray-600">{w.days_left}d left</div>
            </div>
          </div>
        </div>
      </div>

      {/* Waterfall + Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Waterfall w={w} />

        {/* Accounts */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider flex-shrink-0">
              Accounts
            </h2>
            <div className="flex items-center gap-0.5 ml-1">
              {(
                [
                  { key: 'name', label: 'Name' },
                  { key: 'balance', label: 'Balance' },
                  { key: 'utilization', label: 'Util%' },
                  { key: 'type', label: 'Type' },
                ] as { key: SortKey; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    sortBy === key
                      ? 'text-white bg-gray-800'
                      : 'text-gray-600 hover:text-gray-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddAccount(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 ml-auto flex-shrink-0"
            >
              + Add
            </button>
          </div>

          {allAccounts.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <p className="text-gray-500 text-sm">No accounts yet</p>
              <button
                onClick={() => setShowAddAccount(true)}
                className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm"
              >
                + Add your first account
              </button>
            </div>
          )}

          {sortBy === 'type' ? (
            // Grouped by type
            <div className="space-y-4">
              {[
                { label: 'Cash', items: cashAccounts },
                { label: 'Credit', items: creditAccounts },
                { label: 'Investments', items: investmentAccounts },
              ]
                .filter(g => g.items.length > 0)
                .map(g => (
                  <div key={g.label}>
                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{g.label}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {g.items.map(a => <AccountCard key={a.id} account={a} />)}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            // Flat list sorted by chosen key, credit cards first
            <>
              {creditCards.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {creditCards.map(a => <AccountCard key={a.id} account={a} />)}
                </div>
              )}
              {otherAccounts.length > 0 && (
                <>
                  {creditCards.length > 0 && (
                    <div className="text-xs text-gray-500 pt-1">Other</div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {otherAccounts.map(a => <AccountCard key={a.id} account={a} />)}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Income this month */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Income — {monthLabel(month)}
          </h2>
          <button
            onClick={() => setShowAddIncome(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            + Add
          </button>
        </div>
        {(income?.length ?? 0) === 0 ? (
          <p className="text-gray-600 text-sm">No income entries for this month.</p>
        ) : (
          <div className="space-y-2">
            {income!.map(e => (
              <div key={e.id} className="flex justify-between items-center">
                <div>
                  <span className="text-sm text-gray-300">{e.description}</span>
                  <span className="ml-2 text-xs text-gray-500 capitalize">{e.type}</span>
                </div>
                <span className="text-sm font-mono text-emerald-400">{fmt(e.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center border-t border-gray-800 pt-2 mt-2">
              <span className="text-sm font-medium text-gray-300">Total</span>
              <span className="text-sm font-mono font-semibold text-white">
                {fmt(income!.reduce((s, e) => s + e.amount, 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Allocation */}
      <AllocationSection month={month} />

      {/* Modals */}
      {showAddAccount && (
        <AddAccountModal
          onClose={() => setShowAddAccount(false)}
          onSave={data => addAccountMutation.mutate(data)}
        />
      )}
      {showAddIncome && (
        <AddIncomeModal
          month={month}
          onClose={() => setShowAddIncome(false)}
          onSave={data => addIncomeMutation.mutate(data)}
        />
      )}
    </div>
  )
}
