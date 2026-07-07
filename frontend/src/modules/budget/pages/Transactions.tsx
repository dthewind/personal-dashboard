import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { fmt } from '../utils'
import { DateRangePicker, defaultRange } from '../components/DateRangePicker'
import type { DateRange } from '../components/DateRangePicker'
import Typeahead from '../components/Typeahead'
import type { Transaction, Transfer, AccountCredit, AccountCreditCreate, FixedBillPayment, TransactionTag } from '../types'

const TAGS: TransactionTag[] = ['variable', 'fixed', 'one_off']
const TAG_LABELS: Record<TransactionTag, string> = { variable: 'Variable', fixed: 'Fixed', one_off: 'One-off' }
const TAG_COLORS: Record<string, string> = {
  fixed: 'text-blue-400 bg-blue-950',
  one_off: 'text-amber-400 bg-amber-950',
}

function EditRow({
  txn,
  accounts,
  categories,
  onSave,
  onCancel,
  saving,
}: {
  txn: Transaction
  accounts: { id: string; name: string }[]
  categories: string[]
  onSave: (data: Partial<Transaction>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [date, setDate] = useState(txn.date)
  const [amount, setAmount] = useState(String(txn.amount))
  const [accountId, setAccountId] = useState(txn.account_id)
  const [category, setCategory] = useState(txn.category)
  const [merchant, setMerchant] = useState(txn.merchant)
  const [tag, setTag] = useState<TransactionTag>(txn.tag)
  const [notes, setNotes] = useState(txn.notes ?? '')

  const valid = date && amount && parseFloat(amount) > 0 && accountId && category.trim() && merchant.trim()

  const inp = 'w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500'

  return (
    <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700 space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount</label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              autoFocus
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className={inp + ' pl-6'}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Account</label>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inp}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tag</label>
          <select value={tag} onChange={e => setTag(e.target.value as TransactionTag)} className={inp}>
            {TAGS.map(t => <option key={t} value={t}>{TAG_LABELS[t]}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <Typeahead
            value={category}
            onChange={setCategory}
            suggestions={categories}
            placeholder="Category"
            inputClassName={inp}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Merchant</label>
          <input value={merchant} onChange={e => setMerchant(e.target.value)} className={inp} />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Optional"
          className={inp}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded py-1.5 text-xs">
          Cancel
        </button>
        <button
          disabled={!valid || saving}
          onClick={() =>
            onSave({
              date,
              amount: parseFloat(amount),
              account_id: accountId,
              category: category.trim(),
              merchant: merchant.trim(),
              tag,
              notes: notes.trim() || undefined,
            })
          }
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium"
        >
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

const CREDIT_TYPES = ['cashback', 'dispute', 'promo', 'other']
const CREDIT_TYPE_LABELS: Record<string, string> = {
  cashback: 'Cashback', dispute: 'Dispute/Refund', promo: 'Promo Credit', other: 'Other',
}

function AddCreditForm({
  accounts,
  defaultAccountId,
  onSave,
  onCancel,
  saving,
}: {
  accounts: { id: string; name: string; type: string }[]
  defaultAccountId: string
  onSave: (data: AccountCreditCreate) => void
  onCancel: () => void
  saving: boolean
}) {
  const inp = 'w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500'
  const ccAccounts = accounts.filter(a => a.type === 'credit_card').sort((a, b) => a.name.localeCompare(b.name))
  const [accountId, setAccountId] = useState(defaultAccountId || ccAccounts[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [creditType, setCreditType] = useState('cashback')

  const valid = accountId && amount && parseFloat(amount) > 0

  return (
    <div className="px-4 py-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl space-y-2">
      <div className="text-xs font-medium text-emerald-400 mb-1">Add Statement Credit</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Account</label>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inp}>
            {ccAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount</label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input autoFocus type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} className={inp + ' pl-6'} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Type</label>
          <select value={creditType} onChange={e => setCreditType(e.target.value)} className={inp}>
            {CREDIT_TYPES.map(t => <option key={t} value={t}>{CREDIT_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Description</label>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Annual cashback reward" className={inp} />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded py-1.5 text-xs">Cancel</button>
        <button
          disabled={!valid || saving}
          onClick={() => onSave({ account_id: accountId, amount: parseFloat(amount), date, description: description.trim() || CREDIT_TYPE_LABELS[creditType], credit_type: creditType })}
          className="flex-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium"
        >
          {saving ? '…' : 'Save Credit'}
        </button>
      </div>
    </div>
  )
}

export default function Transactions() {
  const qc = useQueryClient()
  const [range, setRange] = useState<DateRange>(defaultRange('this_year'))
  const [filterAccount, setFilterAccount] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddCredit, setShowAddCredit] = useState(false)

  const enabled = !!(range.start && range.end)

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions', range.start, range.end, filterAccount, filterCategory],
    queryFn: () =>
      api.transactions.list({
        start: range.start,
        end: range.end,
        account_id: filterAccount || undefined,
        category: filterCategory || undefined,
      }),
    enabled,
  })

  const { data: transfers = [] } = useQuery({
    queryKey: ['transfers', range.start, range.end, filterAccount],
    queryFn: () => api.transfers.list({ start: range.start, end: range.end, account_id: filterAccount || undefined }),
    enabled,
  })

  const { data: credits = [] } = useQuery({
    queryKey: ['credits', range.start, range.end, filterAccount],
    queryFn: () => api.credits.list({ start: range.start, end: range.end, account_id: filterAccount || undefined }),
    enabled,
  })

  const { data: billPayments = [] } = useQuery({
    queryKey: ['bill-payments-ledger', range.start, range.end, filterAccount],
    queryFn: () => api.bills.allPayments({ start: range.start, end: range.end, account_id: filterAccount || undefined }),
    enabled,
  })

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.transactions.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      setConfirmDelete(null)
    },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.transactions.update>[1] }) =>
      api.transactions.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      setEditingId(null)
    },
  })

  const addCreditMutation = useMutation({
    mutationFn: (data: AccountCreditCreate) => api.credits.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credits'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setShowAddCredit(false)
    },
  })

  const deleteCreditMutation = useMutation({
    mutationFn: (id: string) => api.credits.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credits'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })

  const accountMap = Object.fromEntries((accounts ?? []).map(a => [a.id, a]))
  const total = (transactions ?? []).reduce((sum, t) => sum + t.amount, 0)

  type LedgerItem =
    | { kind: 'txn'; item: Transaction; date: string }
    | { kind: 'xfer'; item: Transfer; date: string }
    | { kind: 'credit'; item: AccountCredit; date: string }
    | { kind: 'bill'; item: FixedBillPayment; date: string }

  const ledger: LedgerItem[] = [
    ...(transactions ?? []).map(t => ({ kind: 'txn' as const, item: t, date: t.date })),
    ...(filterCategory ? [] : transfers.map(t => ({ kind: 'xfer' as const, item: t, date: t.date }))),
    ...(filterCategory ? [] : credits.map(c => ({ kind: 'credit' as const, item: c, date: c.date }))),
    ...(filterCategory ? [] : billPayments.map(b => ({ kind: 'bill' as const, item: b, date: b.paid_date }))),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-white">Transactions</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowAddCredit(v => !v); setEditingId(null) }}
            className="text-xs px-3 py-1.5 rounded-lg border border-emerald-700 text-emerald-400 hover:bg-emerald-900/30 transition-colors"
          >
            + Credit
          </button>
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </div>

      {showAddCredit && (
        <AddCreditForm
          accounts={accounts ?? []}
          defaultAccountId={filterAccount}
          onSave={data => addCreditMutation.mutate(data)}
          onCancel={() => setShowAddCredit(false)}
          saving={addCreditMutation.isPending}
        />
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterAccount}
          onChange={e => setFilterAccount(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All accounts</option>
          {[...(accounts ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All categories</option>
          {[...(categories ?? [])].sort((a, b) => a.localeCompare(b)).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {(filterAccount || filterCategory) && (
          <button
            onClick={() => { setFilterAccount(''); setFilterCategory('') }}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Summary */}
      {!isLoading && transactions && (
        <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
          <span>{transactions.length} transactions{transfers.length > 0 && !filterCategory ? `, ${transfers.length} transfer${transfers.length !== 1 ? 's' : ''}` : ''}{billPayments.length > 0 && !filterCategory ? `, ${billPayments.length} bill${billPayments.length !== 1 ? 's' : ''}` : ''}{credits.length > 0 && !filterCategory ? `, ${credits.length} credit${credits.length !== 1 ? 's' : ''}` : ''}</span>
          <span className="text-gray-700">·</span>
          <span>Spent: <span className="text-white font-mono">{fmt(total)}</span></span>
          {credits.length > 0 && !filterCategory && (
            <>
              <span className="text-gray-700">·</span>
              <span>Credits: <span className="text-emerald-400 font-mono">−{fmt(credits.reduce((s, c) => s + c.amount, 0))}</span></span>
            </>
          )}
        </div>
      )}

      {/* List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {isLoading && (
          <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
        )}

        {!isLoading && ledger.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-sm">
            No transactions for this period
          </div>
        )}

        {ledger.map(({ kind, item, date }, i) => {
          const isLast = i === ledger.length - 1
          const borderCls = !isLast ? 'border-b border-gray-800/60' : ''

          if (kind === 'bill') {
            const bp = item as FixedBillPayment
            const acct = accountMap[bp.account_id ?? '']
            return (
              <div
                key={'bill-' + bp.id}
                className={`flex items-center gap-3 px-4 py-3 ${borderCls} bg-blue-950/10`}
              >
                <div className="text-xs text-gray-600 w-16 flex-shrink-0 font-mono">
                  {date.slice(5)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-300">{bp.bill_name ?? 'Bill payment'}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {acct?.name ?? '—'}
                    <span className="ml-2 text-blue-900">recurring bill</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono text-gray-400">{fmt(bp.paid_amount)}</div>
                </div>
              </div>
            )
          }

          if (kind === 'credit') {
            const credit = item as AccountCredit
            const acct = accountMap[credit.account_id]
            return (
              <div
                key={'credit-' + credit.id}
                className={`flex items-center gap-3 px-4 py-3 ${borderCls} bg-emerald-950/20 group`}
              >
                <div className="text-xs text-gray-600 w-16 flex-shrink-0 font-mono">
                  {credit.date.slice(5)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-emerald-300">{credit.description}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {acct?.name ?? '—'}
                    <span className="ml-2 text-emerald-800">{CREDIT_TYPE_LABELS[credit.credit_type] ?? credit.credit_type}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono text-emerald-400">−{fmt(credit.amount)}</div>
                  <button
                    onClick={() => deleteCreditMutation.mutate(credit.id)}
                    className="text-xs text-gray-700 hover:text-red-400 mt-1 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    delete
                  </button>
                </div>
              </div>
            )
          }

          if (kind === 'xfer') {
            const xfer = item as Transfer
            const from = accountMap[xfer.from_account_id]
            const to = accountMap[xfer.to_account_id]
            return (
              <div
                key={'xfer-' + xfer.id}
                className={`flex items-center gap-3 px-4 py-3 ${borderCls} bg-gray-800/20`}
              >
                <div className="text-xs text-gray-600 w-16 flex-shrink-0 font-mono">
                  {xfer.date.slice(5)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-400">{xfer.description}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {from?.name ?? '—'}
                    <span className="mx-1">→</span>
                    {to?.name ?? '—'}
                    <span className="ml-2 text-gray-700">transfer</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono text-gray-500">{fmt(xfer.amount)}</div>
                </div>
              </div>
            )
          }

          const txn = item as Transaction
          if (editingId === txn.id) {
            return (
              <EditRow
                key={txn.id}
                txn={txn}
                accounts={accounts ?? []}
                categories={categories ?? []}
                onSave={data => editMutation.mutate({ id: txn.id, data })}
                onCancel={() => setEditingId(null)}
                saving={editMutation.isPending}
              />
            )
          }

          return (
            <div
              key={txn.id}
              className={`flex items-center gap-3 px-4 py-3 group ${borderCls} hover:bg-gray-800/30 transition-colors`}
            >
              <div className="text-xs text-gray-500 w-16 flex-shrink-0 font-mono">
                {txn.date.slice(5)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium truncate">{txn.merchant}</span>
                  {txn.tag !== 'variable' && (
                    <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${TAG_COLORS[txn.tag] ?? 'text-gray-400 bg-gray-800'}`}>
                      {txn.tag}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-indigo-400">{txn.category}</span>
                  <span className="text-xs text-gray-600">{accountMap[txn.account_id]?.name ?? '—'}</span>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <div className="text-white font-mono text-sm">{fmt(txn.amount)}</div>
                {confirmDelete === txn.id ? (
                  <div className="flex gap-2 mt-1 justify-end">
                    <button onClick={() => deleteMutation.mutate(txn.id)} className="text-xs text-red-400 hover:text-red-300">
                      Confirm
                    </button>
                    <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500 hover:text-gray-300">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3 mt-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingId(txn.id); setConfirmDelete(null) }}
                      className="text-xs text-gray-500 hover:text-indigo-400 transition-colors"
                    >
                      edit
                    </button>
                    <button
                      onClick={() => setConfirmDelete(txn.id)}
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
    </div>
  )
}
