import { useState, useEffect } from 'react'
import PageShell from '../components/PageShell'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { fmt, currentMonthStr, prevMonth, nextMonth, monthLabel } from '../utils'
import Typeahead from '../components/Typeahead'
import type { Account, FixedBill, FixedBillCreate, FixedBillPayment, FixedBillUpdate } from '../types'

function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const today = currentMonthStr()
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(prevMonth(month))}
        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 text-lg"
      >
        ‹
      </button>
      <span className="text-sm text-white min-w-28 text-center">{monthLabel(month)}</span>
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

function AmountDisplay({ amount, estimated }: { amount: number; estimated: boolean }) {
  return (
    <span className="font-mono">
      {estimated && <span className="text-gray-500 mr-0.5">~</span>}
      {fmt(amount)}
    </span>
  )
}

function AddBillModal({
  accounts,
  categories,
  onClose,
  onSave,
  error,
}: {
  accounts: Account[]
  categories: string[]
  onClose: () => void
  onSave: (data: FixedBillCreate) => void
  error?: string
}) {
  const [name, setName] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [dueDay, setDueDay] = useState('')
  const [amount, setAmount] = useState('')
  const [isEstimated, setIsEstimated] = useState(false)
  const [category, setCategory] = useState('')
  const [startsMonth, setStartsMonth] = useState('')
  const [endsMonth, setEndsMonth] = useState('')

  const valid = name.trim() && accountId && dueDay && amount && parseFloat(amount) > 0

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-white font-semibold">Add Fixed Bill</h3>

        {error && (
          <div className="px-3 py-2 bg-red-950 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-400 mb-1">Bill Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && onClose()}
            placeholder="e.g. Rent, MLGW, Sirius"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Charged To</label>
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-600 mt-1">
            {accounts.find(a => a.id === accountId)?.type === 'credit_card'
              ? 'Auto-charged to this CC — marking paid increases its balance.'
              : 'Payment deducted from this account.'}
          </p>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Category</label>
          <Typeahead
            value={category}
            onChange={setCategory}
            suggestions={categories}
            placeholder="e.g. Housing, Utilities, Subscriptions"
            inputClassName="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Due Day</label>
            <input
              type="number"
              min="1"
              max="31"
              value={dueDay}
              onChange={e => setDueDay(e.target.value)}
              placeholder="1–31"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Amount / mo</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-2">Amount Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEstimated(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                !isEstimated
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Fixed
            </button>
            <button
              onClick={() => setIsEstimated(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                isEstimated
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Estimated
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1.5">
            {isEstimated
              ? 'Amount varies — enter a typical value. Shown with ~ prefix.'
              : 'Amount is the same every month.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Starts <span className="text-gray-600">(optional)</span></label>
            <input
              type="month"
              value={startsMonth}
              onChange={e => setStartsMonth(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Ends <span className="text-gray-600">(optional)</span></label>
            <input
              type="month"
              value={endsMonth}
              onChange={e => setEndsMonth(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <p className="col-span-2 text-xs text-gray-600 -mt-1.5">
            Bounds only affect current/future projections — past months always use actual payments.
          </p>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl py-2.5 text-sm"
          >
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={() =>
              onSave({
                name: name.trim(),
                account_id: accountId,
                due_day: parseInt(dueDay),
                expected_amount: parseFloat(amount),
                is_estimated: isEstimated,
                category: category.trim() || undefined,
                starts_month: startsMonth ? startsMonth + '-01' : undefined,
                ends_month: endsMonth ? endsMonth + '-01' : undefined,
              })
            }
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function EditBillForm({
  bill,
  accounts,
  categories,
  onSave,
  onCancel,
  saving,
}: {
  bill: FixedBill
  accounts: Account[]
  categories: string[]
  onSave: (data: FixedBillUpdate) => void
  onCancel: () => void
  saving: boolean
}) {
  const [name, setName] = useState(bill.name)
  const [accountId, setAccountId] = useState(bill.account_id)
  const [dueDay, setDueDay] = useState(String(bill.due_day))
  const [amount, setAmount] = useState(String(bill.expected_amount))
  const [isEstimated, setIsEstimated] = useState(bill.is_estimated)
  const [category, setCategory] = useState(bill.category ?? '')
  const [startsMonth, setStartsMonth] = useState(bill.starts_month?.slice(0, 7) ?? '')
  const [endsMonth, setEndsMonth] = useState(bill.ends_month?.slice(0, 7) ?? '')

  const valid = name.trim() && accountId && dueDay && amount && parseFloat(amount) > 0

  return (
    <div className="bg-gray-900 border border-indigo-600 rounded-xl px-4 py-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1">Bill Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && onCancel()}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1">Category</label>
          <Typeahead
            value={category}
            onChange={setCategory}
            suggestions={categories}
            placeholder="e.g. Housing, Utilities"
            inputClassName="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-400 mb-1">Charged To</label>
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Due Day</label>
          <input
            type="number"
            min="1"
            max="31"
            value={dueDay}
            onChange={e => setDueDay(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Amount / mo</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Starts <span className="text-gray-600">(optional)</span></label>
          <input
            type="month"
            value={startsMonth}
            onChange={e => setStartsMonth(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Ends <span className="text-gray-600">(optional)</span></label>
          <input
            type="month"
            value={endsMonth}
            onChange={e => setEndsMonth(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setIsEstimated(false)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !isEstimated ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          Fixed
        </button>
        <button
          onClick={() => setIsEstimated(true)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isEstimated ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          Estimated
        </button>
      </div>

      <div className="flex gap-2 pt-1">
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
              name: name.trim(),
              account_id: accountId,
              due_day: parseInt(dueDay),
              expected_amount: parseFloat(amount),
              is_estimated: isEstimated,
              category: category.trim() || undefined,
              starts_month: startsMonth ? startsMonth + '-01' : null,
              ends_month: endsMonth ? endsMonth + '-01' : null,
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

function PayModal({
  bill,
  account,
  defaultDate,
  onClose,
  onSave,
  saving,
}: {
  bill: FixedBill
  account: Account | undefined
  defaultDate: string
  onClose: () => void
  onSave: (data: { paid_date: string; paid_amount: number; period_month: string }) => void
  saving: boolean
}) {
  const [date, setDate] = useState(defaultDate)
  const [amount, setAmount] = useState(String(bill.expected_amount))

  // period_month always derived from the date the user enters — never from "today"
  const periodMonth = date.slice(0, 8) + '01'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isCc = account?.type === 'credit_card'
  const valid = amount && parseFloat(amount) > 0 && date

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <h3 className="text-white font-semibold">Confirm Payment</h3>
          <p className="text-sm text-gray-400 mt-0.5">{bill.name}</p>
        </div>

        {/* Account context — read-only, explains what will happen */}
        <div className="bg-gray-800/60 rounded-lg px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {isCc ? 'Charged to' : 'Deducted from'}
            </span>
            <span className="text-sm text-white font-medium">{account?.name ?? '—'}</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {isCc
              ? `Adds to CC balance (you owe more).`
              : `Reduces account balance (cash out).`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
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
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl py-2.5 text-sm"
          >
            Cancel
          </button>
          <button
            disabled={!valid || saving}
            onClick={() =>
              onSave({
                paid_date: date,
                paid_amount: parseFloat(amount),
                period_month: periodMonth,
              })
            }
            className="flex-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-medium"
          >
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}


export default function Bills() {
  const qc = useQueryClient()
  const [month, setMonth] = useState(currentMonthStr)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [payingBill, setPayingBill] = useState<FixedBill | null>(null)
  const [addError, setAddError] = useState<string | undefined>()
  const [undoingPaymentId, setUndoingPaymentId] = useState<string | null>(null)

  const { data: bills, isLoading } = useQuery({
    queryKey: ['bills'],
    queryFn: () => api.bills.list(),
  })

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories(),
  })

  const { data: currentPayments } = useQuery({
    queryKey: ['bills-payments', month],
    queryFn: () => api.bills.allPayments({ month }),
  })

  // Map of bill_id → payment for quick lookup
  const paidMap = Object.fromEntries(
    (currentPayments ?? []).map((p: FixedBillPayment) => [p.bill_id, p])
  )

  const accountMap = Object.fromEntries((accounts ?? []).map(a => [a.id, a]))

  const addMutation = useMutation({
    mutationFn: (data: FixedBillCreate) => api.bills.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      setShowAdd(false)
      setAddError(undefined)
    },
    onError: (e: Error) => {
      setAddError(e.message || 'Failed to save bill. Try again.')
    },
  })

  const payMutation = useMutation({
    mutationFn: ({ billId, data }: { billId: string; data: Parameters<typeof api.bills.recordPayment>[1] }) =>
      api.bills.recordPayment(billId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['bills-payments'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      setPayingBill(null)
    },
  })

  const undoPaymentMutation = useMutation({
    mutationFn: ({ billId, paymentId }: { billId: string; paymentId: string }) =>
      api.bills.deletePayment(billId, paymentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['bills-payments'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      setUndoingPaymentId(null)
    },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FixedBillUpdate }) =>
      api.bills.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      setEditingId(null)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.bills.update(id, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
    },
  })

  const billSort = (a: FixedBill, b: FixedBill) => {
    if (a.due_day !== b.due_day) return a.due_day - b.due_day
    const aAcct = (accountMap[a.account_id]?.name ?? '').toLowerCase()
    const bAcct = (accountMap[b.account_id]?.name ?? '').toLowerCase()
    if (aAcct !== bAcct) return aAcct < bAcct ? -1 : 1
    return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1
  }

  // date bounds: is this bill expected in the viewed month?
  const inMonth = (b: FixedBill) =>
    (!b.starts_month || b.starts_month <= month) && (!b.ends_month || b.ends_month >= month)

  const active = (bills ?? []).filter(b => b.is_active).sort(billSort)
  const inactive = (bills ?? []).filter(b => !b.is_active).sort(billSort)
  const inScope = active.filter(inMonth)
  const fixedTotal = inScope.filter(b => !b.is_estimated).reduce((s, b) => s + b.expected_amount, 0)
  const estimatedTotal = inScope.filter(b => b.is_estimated).reduce((s, b) => s + b.expected_amount, 0)
  const paidCount = inScope.filter(b => paidMap[b.id]).length

  return (
    <PageShell>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          {active.length > 0 && (
            <p className="text-sm text-gray-400 mt-0.5">
              {inScope.length} bills ·{' '}
              <span className="text-white font-mono">{fmt(fixedTotal + estimatedTotal)}</span>/mo
              {estimatedTotal > 0 && (
                <span className="text-gray-500 text-xs ml-1">
                  ({fmt(fixedTotal)} fixed + ~{fmt(estimatedTotal)} est.)
                </span>
              )}
              <span className={`ml-2 text-xs ${paidCount === inScope.length ? 'text-emerald-400' : 'text-gray-500'}`}>
                · {paidCount}/{inScope.length} paid in {monthLabel(month)}
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <MonthNav month={month} onChange={m => { setMonth(m); setUndoingPaymentId(null) }} />
          <button
            onClick={() => { setShowAdd(true); setAddError(undefined) }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Add Bill
          </button>
        </div>
      </div>

      {isLoading && <div className="text-gray-500 text-sm">Loading…</div>}

      {!isLoading && active.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm">No active bills.</p>
          <p className="text-gray-600 text-xs mt-1">Add your recurring fixed expenses here.</p>
        </div>
      )}

      {/* Active bills */}
      <div className="space-y-2">
        {active.map(bill => {
          const payment = paidMap[bill.id] as FixedBillPayment | undefined

          if (editingId === bill.id) {
            return (
              <EditBillForm
                key={bill.id}
                bill={bill}
                accounts={accounts ?? []}
                categories={categories ?? []}
                onSave={data => editMutation.mutate({ id: bill.id, data })}
                onCancel={() => setEditingId(null)}
                saving={editMutation.isPending}
              />
            )
          }

          const outOfMonth = !inMonth(bill)

          return (
            <div
              key={bill.id}
              className={`border rounded-xl px-4 py-3.5 group transition-colors ${
                payment
                  ? 'bg-emerald-950/20 border-emerald-900/40'
                  : 'bg-gray-900 border-gray-800'
              } ${outOfMonth ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-3">
                {/* Due day badge */}
                <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 ${
                  payment ? 'bg-emerald-900/30' : 'bg-gray-800'
                }`}>
                  {payment ? (
                    <span className="text-emerald-400 text-lg leading-none">✓</span>
                  ) : (
                    <>
                      <span className="text-xs text-gray-500 leading-none">day</span>
                      <span className="text-sm font-bold text-white leading-tight">{bill.due_day}</span>
                    </>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{bill.name}</span>
                    {bill.is_estimated && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                        est.
                      </span>
                    )}
                    {bill.starts_month && bill.starts_month > month && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/50 text-indigo-300">
                        starts {monthLabel(bill.starts_month)}
                      </span>
                    )}
                    {bill.ends_month && bill.ends_month < month && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-500">
                        ended {monthLabel(bill.ends_month)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5">
                    {payment ? (
                      <span className="text-emerald-600">
                        Paid {fmt(payment.paid_amount)} · {payment.paid_date}
                      </span>
                    ) : (
                      <span className="text-gray-500">
                        {accountMap[bill.account_id]?.name ?? '—'} · due day {bill.due_day}
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount + pay */}
                <div className="text-right flex-shrink-0">
                  <div className="text-white text-sm">
                    <AmountDisplay amount={bill.expected_amount} estimated={bill.is_estimated} />
                  </div>

                  {payment ? (
                    undoingPaymentId === payment.id ? (
                      <div className="flex gap-2 mt-1 justify-end">
                        <button
                          onClick={() => undoPaymentMutation.mutate({ billId: bill.id, paymentId: payment.id })}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Undo
                        </button>
                        <button
                          onClick={() => setUndoingPaymentId(null)}
                          className="text-xs text-gray-500 hover:text-gray-300"
                        >
                          Keep
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setUndoingPaymentId(payment.id)}
                        className="text-xs text-emerald-600 hover:text-amber-400 mt-1 transition-colors"
                      >
                        Paid ✓
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => setPayingBill(bill)}
                      className="text-xs text-gray-600 hover:text-emerald-400 mt-1 transition-colors"
                    >
                      Mark paid
                    </button>
                  )}
                </div>

                {/* Edit + Deactivate */}
                <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                  <button
                    onClick={() => { setEditingId(bill.id); setPayingBill(null) }}
                    title="Edit"
                    className="text-gray-500 hover:text-gray-200 text-sm px-1 transition-colors"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => toggleMutation.mutate({ id: bill.id, is_active: false })}
                    title="Deactivate"
                    className="text-gray-600 hover:text-red-400 text-sm px-1 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Inactive bills */}
      {inactive.length > 0 && (
        <div>
          <h2 className="text-xs text-gray-600 uppercase tracking-wider mb-2">Inactive</h2>
          <div className="space-y-2">
            {inactive.map(bill => (
              <div
                key={bill.id}
                className="flex items-center gap-3 bg-gray-900/40 border border-gray-800/40 rounded-xl px-4 py-3 opacity-50"
              >
                <div className="flex-1 text-sm text-gray-500">{bill.name}</div>
                <div className="text-sm text-gray-500">
                  <AmountDisplay amount={bill.expected_amount} estimated={bill.is_estimated} />
                </div>
                <button
                  onClick={() => toggleMutation.mutate({ id: bill.id, is_active: true })}
                  className="text-xs text-gray-600 hover:text-emerald-400 transition-colors"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && accounts && (
        <AddBillModal
          accounts={accounts}
          categories={categories ?? []}
          onClose={() => setShowAdd(false)}
          onSave={data => addMutation.mutate(data)}
          error={addError}
        />
      )}

      {/* Pay modal */}
      {payingBill && (
        <PayModal
          bill={payingBill}
          account={accountMap[payingBill.account_id]}
          defaultDate={(() => {
            // Default to the bill's due day in the viewed month; clamp to month end
            const [y, m] = month.split('-').map(Number)
            const daysInMonth = new Date(y, m, 0).getDate()
            const day = Math.min(payingBill.due_day, daysInMonth)
            return `${month.slice(0, 7)}-${String(day).padStart(2, '0')}`
          })()}
          onClose={() => setPayingBill(null)}
          onSave={data => payMutation.mutate({ billId: payingBill.id, data })}
          saving={payMutation.isPending}
        />
      )}
    </PageShell>
  )
}
