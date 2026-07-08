import { useState, useRef, useEffect } from 'react'
import PageShell from '../components/PageShell'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { fmt } from '../utils'
import { DateRangePicker, defaultRange } from '../components/DateRangePicker'
import type { DateRange } from '../components/DateRangePicker'
import Typeahead from '../components/Typeahead'
import type {
  Account, Transaction, TransactionCreate,
  Transfer, TransferCreate, TransferUpdate,
  AccountCredit, AccountCreditCreate, AccountCreditUpdate,
  TransactionTag,
} from '../types'

const TAGS: TransactionTag[] = ['variable', 'fixed', 'one_off']
const TAG_LABELS: Record<TransactionTag, string> = { variable: 'Variable', fixed: 'Fixed', one_off: 'One-off' }
const TAG_COLORS: Record<string, string> = {
  fixed: 'text-blue-400 bg-blue-950',
  one_off: 'text-amber-400 bg-amber-950',
}
const CREDIT_TYPES = ['cashback', 'interest', 'dispute', 'promo', 'other']
const CREDIT_TYPE_LABELS: Record<string, string> = {
  cashback: 'Cashback', interest: 'Interest Earned', dispute: 'Refund/Dispute', promo: 'Promo Credit', other: 'Other',
}
type LedgerType = 'all' | 'debits' | 'credits' | 'transfers'

// ────────────────────────────────────────────────────────────
// AccountMultiSelect
// ────────────────────────────────────────────────────────────
function AccountMultiSelect({
  accounts,
  selected,
  onChange,
}: {
  accounts: Account[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const allSelected = selected.size === 0

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name))

  const label = allSelected
    ? 'All accounts'
    : selected.size === 1
    ? (accounts.find(a => selected.has(a.id))?.name ?? '1 account')
    : `${selected.size} accounts`

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 text-sm rounded-lg border px-3 py-1.5 transition-colors ${
          allSelected
            ? 'border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700'
            : 'border-indigo-600 text-indigo-300 bg-indigo-950/40 hover:bg-indigo-950/60'
        }`}
      >
        {label}
        <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[200px] py-1">
          <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-700 cursor-pointer text-sm text-gray-200">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onChange(new Set())}
              className="accent-indigo-500"
            />
            All accounts
          </label>
          <div className="border-t border-gray-700/60 my-0.5" />
          {sorted.map(a => (
            <label key={a.id} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-700 cursor-pointer text-sm text-gray-300">
              <input
                type="checkbox"
                checked={selected.has(a.id)}
                onChange={() => toggle(a.id)}
                className="accent-indigo-500"
              />
              {a.name}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// CategoryMultiSelect
// ────────────────────────────────────────────────────────────
function CategoryMultiSelect({
  categories,
  selected,
  onChange,
}: {
  categories: string[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const allSelected = selected.size === 0

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const sorted = [...categories].sort((a, b) => a.localeCompare(b))

  const label = allSelected
    ? 'All categories'
    : selected.size === 1
    ? [...selected][0]
    : `${selected.size} categories`

  function toggle(cat: string) {
    const next = new Set(selected)
    if (next.has(cat)) next.delete(cat)
    else next.add(cat)
    onChange(next)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 text-sm rounded-lg border px-3 py-1.5 transition-colors ${
          allSelected
            ? 'border-gray-700 text-gray-300 bg-gray-800 hover:bg-gray-700'
            : 'border-indigo-600 text-indigo-300 bg-indigo-950/40 hover:bg-indigo-950/60'
        }`}
      >
        {label}
        <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl min-w-[200px] max-h-72 overflow-y-auto py-1">
          <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-700 cursor-pointer text-sm text-gray-200">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onChange(new Set())}
              className="accent-indigo-500"
            />
            All categories
          </label>
          <div className="border-t border-gray-700/60 my-0.5" />
          {sorted.map(cat => (
            <label key={cat} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-700 cursor-pointer text-sm text-gray-300">
              <input
                type="checkbox"
                checked={selected.has(cat)}
                onChange={() => toggle(cat)}
                className="accent-indigo-500"
              />
              {cat}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// EditRow (inline edit for existing transactions)
// ────────────────────────────────────────────────────────────
function EditRow({
  txn, accounts, categories, onSave, onCancel, saving,
}: {
  txn: Transaction
  accounts: Account[]
  categories: string[]
  onSave: (data: Partial<TransactionCreate>) => void
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
            <input autoFocus type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} className={inp + ' pl-6'} />
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
          <label className="block text-xs text-gray-500 mb-1">Merchant</label>
          <input value={merchant} onChange={e => setMerchant(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <Typeahead value={category} onChange={setCategory} suggestions={categories} placeholder="Category" inputClassName={inp} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Notes</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" className={inp} />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded py-1.5 text-xs">Cancel</button>
        <button
          disabled={!valid || saving}
          onClick={() => onSave({ date, amount: parseFloat(amount), account_id: accountId, category: category.trim(), merchant: merchant.trim(), tag, notes: notes.trim() || undefined })}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium"
        >
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// EditCreditRow
// ────────────────────────────────────────────────────────────
function EditCreditRow({
  credit, accounts, categories, onSave, onCancel, saving,
}: {
  credit: AccountCredit
  accounts: Account[]
  categories: string[]
  onSave: (data: AccountCreditUpdate) => void
  onCancel: () => void
  saving: boolean
}) {
  const [accountId, setAccountId] = useState(credit.account_id)
  const [amount, setAmount] = useState(String(credit.amount))
  const [date, setDate] = useState(credit.date)
  const [crType, setCrType] = useState(credit.credit_type)
  const [desc, setDesc] = useState(credit.description)
  const [category, setCategory] = useState(credit.category ?? '')

  const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name))
  const needsCategory = crType === 'dispute'
  const valid = date && amount && parseFloat(amount) > 0 && accountId && (!needsCategory || category.trim())
  const inp = 'w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500'

  return (
    <div className="px-4 py-3 bg-emerald-950/20 border-b border-gray-700 space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Account</label>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inp}>
            {sorted.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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
          <select value={crType} onChange={e => { setCrType(e.target.value); if (e.target.value !== 'dispute') setCategory('') }} className={inp}>
            {CREDIT_TYPES.map(t => <option key={t} value={t}>{CREDIT_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
      </div>
      {needsCategory && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Category <span className="text-emerald-600">— which spending category does this refund?</span></label>
          <Typeahead value={category} onChange={setCategory} suggestions={categories} placeholder="e.g. Groceries" inputClassName={inp} />
        </div>
      )}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Description</label>
        <input value={desc} onChange={e => setDesc(e.target.value)} className={inp} />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded py-1.5 text-xs">Cancel</button>
        <button
          disabled={!valid || saving}
          onClick={() => onSave({
            account_id: accountId,
            amount: parseFloat(amount),
            date,
            credit_type: crType,
            description: desc.trim() || CREDIT_TYPE_LABELS[crType],
            category: needsCategory ? category.trim() : null,
          })}
          className="flex-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium"
        >
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// EditXferRow
// ────────────────────────────────────────────────────────────
function EditXferRow({
  xfer, accounts, onSave, onCancel, saving,
}: {
  xfer: Transfer
  accounts: Account[]
  onSave: (data: TransferUpdate) => void
  onCancel: () => void
  saving: boolean
}) {
  const [from, setFrom] = useState(xfer.from_account_id)
  const [to, setTo] = useState(xfer.to_account_id)
  const [amount, setAmount] = useState(String(xfer.amount))
  const [date, setDate] = useState(xfer.date)
  const [desc, setDesc] = useState(xfer.description)

  const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name))
  const valid = from && to && from !== to && amount && parseFloat(amount) > 0 && date
  const inp = 'w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500'

  return (
    <div className="px-4 py-3 bg-amber-950/10 border-b border-gray-700 space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <select value={from} onChange={e => setFrom(e.target.value)} className={inp}>
            {sorted.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <select value={to} onChange={e => setTo(e.target.value)} className={inp}>
            {sorted.filter(a => a.id !== from).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Description</label>
        <input value={desc} onChange={e => setDesc(e.target.value)} className={inp} />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded py-1.5 text-xs">Cancel</button>
        <button
          disabled={!valid || saving}
          onClick={() => onSave({ from_account_id: from, to_account_id: to, amount: parseFloat(amount), date, description: desc.trim() || 'Transfer' })}
          className="flex-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium"
        >
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// AddForm — unified add for txn / credit / transfer
// ────────────────────────────────────────────────────────────
type AddType = 'txn' | 'credit' | 'transfer'

function AddForm({
  accounts, categories, defaultAccountId,
  onSaveTxn, onSaveCredit, onSaveTransfer, onCancel, saving,
}: {
  accounts: Account[]
  categories: string[]
  defaultAccountId?: string
  onSaveTxn: (data: TransactionCreate) => void
  onSaveCredit: (data: AccountCreditCreate) => void
  onSaveTransfer: (data: TransferCreate) => void
  onCancel: () => void
  saving: boolean
}) {
  const [type, setType] = useState<AddType>('txn')
  const today = new Date().toISOString().slice(0, 10)
  const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name))
  const firstId = defaultAccountId || sorted[0]?.id || ''

  // txn state
  const [txnDate, setTxnDate] = useState(today)
  const [txnAmount, setTxnAmount] = useState('')
  const [txnAccount, setTxnAccount] = useState(firstId)
  const [txnCategory, setTxnCategory] = useState('')
  const [txnMerchant, setTxnMerchant] = useState('')
  const [txnTag, setTxnTag] = useState<TransactionTag>('variable')
  const [txnNotes, setTxnNotes] = useState('')
  const [merchantSuggestions, setMerchantSuggestions] = useState<string[]>([])
  const merchantCategoryMap = useRef<Record<string, string>>({})

  // credit state
  const [crDate, setCrDate] = useState(today)
  const [crAmount, setCrAmount] = useState('')
  const [crAccount, setCrAccount] = useState(firstId)
  const [crType, setCrType] = useState('cashback')
  const [crDesc, setCrDesc] = useState('')
  const [crCategory, setCrCategory] = useState('')

  // transfer state
  const [xfDate, setXfDate] = useState(today)
  const [xfAmount, setXfAmount] = useState('')
  const [xfFrom, setXfFrom] = useState(firstId)
  const [xfTo, setXfTo] = useState(sorted[1]?.id || '')
  const [xfDesc, setXfDesc] = useState('')

  const inp = 'w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500'
  const inpGreen = inp.replace('focus:border-indigo-500', 'focus:border-emerald-500')
  const inpAmber = inp.replace('focus:border-indigo-500', 'focus:border-amber-500')

  const txnValid = txnDate && txnAmount && parseFloat(txnAmount) > 0 && txnAccount && txnCategory.trim() && txnMerchant.trim()
  const crNeedsCategory = crType === 'dispute'
  const crValid = crDate && crAmount && parseFloat(crAmount) > 0 && crAccount && (!crNeedsCategory || crCategory.trim())
  const xfValid = xfDate && xfAmount && parseFloat(xfAmount) > 0 && xfFrom && xfTo && xfFrom !== xfTo

  async function handleMerchantSearch(q: string) {
    if (!q.trim()) { setMerchantSuggestions([]); return }
    try {
      const results = await api.merchants(q.trim())
      merchantCategoryMap.current = Object.fromEntries(results.map(m => [m.name, m.default_category ?? '']))
      setMerchantSuggestions(results.map(m => m.name))
    } catch {}
  }

  function handleMerchantSelect(name: string) {
    const cat = merchantCategoryMap.current[name]
    if (cat && !txnCategory) setTxnCategory(cat)
  }

  const tabCls = (t: AddType) =>
    `px-3 py-1 text-xs rounded transition-colors ${type === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`

  return (
    <div className="bg-gray-800/40 border border-gray-700 rounded-xl px-4 py-3 space-y-3">
      {/* type switcher */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 mr-1">Add:</span>
        <button className={tabCls('txn')} onClick={() => setType('txn')}>Transaction</button>
        <button className={tabCls('credit')} onClick={() => setType('credit')}>Credit</button>
        <button className={tabCls('transfer')} onClick={() => setType('transfer')}>Transfer</button>
        <button onClick={onCancel} className="ml-auto text-xs text-gray-600 hover:text-gray-400">✕</button>
      </div>

      {/* Transaction */}
      {type === 'txn' && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input autoFocus type="number" step="0.01" min="0" value={txnAmount} onChange={e => setTxnAmount(e.target.value)} className={inp + ' pl-6'} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Account</label>
              <select value={txnAccount} onChange={e => setTxnAccount(e.target.value)} className={inp}>
                {sorted.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tag</label>
              <select value={txnTag} onChange={e => setTxnTag(e.target.value as TransactionTag)} className={inp}>
                {TAGS.map(t => <option key={t} value={t}>{TAG_LABELS[t]}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Merchant</label>
              <Typeahead
                value={txnMerchant}
                onChange={setTxnMerchant}
                onSearch={handleMerchantSearch}
                onSuggestionSelect={handleMerchantSelect}
                suggestions={merchantSuggestions}
                placeholder="Merchant name"
                inputClassName={inp}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <Typeahead value={txnCategory} onChange={setTxnCategory} suggestions={categories} placeholder="Category" inputClassName={inp} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <input value={txnNotes} onChange={e => setTxnNotes(e.target.value)} placeholder="Optional" className={inp} />
          </div>
          <button
            disabled={!txnValid || saving}
            onClick={() => onSaveTxn({ date: txnDate, amount: parseFloat(txnAmount), account_id: txnAccount, category: txnCategory.trim(), merchant: txnMerchant.trim(), tag: txnTag, notes: txnNotes.trim() || undefined })}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium"
          >
            {saving ? '…' : 'Add Transaction'}
          </button>
        </>
      )}

      {/* Credit */}
      {type === 'credit' && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Account</label>
              <select value={crAccount} onChange={e => setCrAccount(e.target.value)} className={inpGreen}>
                {sorted.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input autoFocus type="number" step="0.01" min="0" value={crAmount} onChange={e => setCrAmount(e.target.value)} className={inpGreen + ' pl-6'} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={crDate} onChange={e => setCrDate(e.target.value)} className={inpGreen} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select value={crType} onChange={e => { setCrType(e.target.value); if (e.target.value !== 'dispute') setCrCategory('') }} className={inpGreen}>
                {CREDIT_TYPES.map(t => <option key={t} value={t}>{CREDIT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
          </div>
          {crNeedsCategory && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category <span className="text-emerald-600">— which spending category does this refund?</span></label>
              <Typeahead value={crCategory} onChange={setCrCategory} suggestions={categories} placeholder="e.g. Groceries" inputClassName={inpGreen} />
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input value={crDesc} onChange={e => setCrDesc(e.target.value)} placeholder="e.g. Annual cashback reward" className={inpGreen} />
          </div>
          <button
            disabled={!crValid || saving}
            onClick={() => onSaveCredit({
              account_id: crAccount,
              amount: parseFloat(crAmount),
              date: crDate,
              description: crDesc.trim() || CREDIT_TYPE_LABELS[crType],
              credit_type: crType,
              category: crNeedsCategory ? crCategory.trim() : undefined,
            })}
            className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium"
          >
            {saving ? '…' : 'Add Credit'}
          </button>
        </>
      )}

      {/* Transfer */}
      {type === 'transfer' && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <select value={xfFrom} onChange={e => setXfFrom(e.target.value)} className={inpAmber}>
                {sorted.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <select value={xfTo} onChange={e => setXfTo(e.target.value)} className={inpAmber}>
                {sorted.filter(a => a.id !== xfFrom).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Amount</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input autoFocus type="number" step="0.01" min="0" value={xfAmount} onChange={e => setXfAmount(e.target.value)} className={inpAmber + ' pl-6'} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={xfDate} onChange={e => setXfDate(e.target.value)} className={inpAmber} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input value={xfDesc} onChange={e => setXfDesc(e.target.value)} placeholder="e.g. Chase CC payment" className={inpAmber} />
          </div>
          <button
            disabled={!xfValid || saving}
            onClick={() => onSaveTransfer({ from_account_id: xfFrom, to_account_id: xfTo, amount: parseFloat(xfAmount), date: xfDate, description: xfDesc.trim() || 'Transfer' })}
            className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium"
          >
            {saving ? '…' : 'Add Transfer'}
          </button>
        </>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Main Transactions page
// ────────────────────────────────────────────────────────────
export default function Transactions() {
  const qc = useQueryClient()
  const [range, setRange] = useState<DateRange>(defaultRange('this_year'))
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [filterType, setFilterType] = useState<LedgerType>('all')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmDeleteCredit, setConfirmDeleteCredit] = useState<string | null>(null)
  const [confirmDeleteXfer, setConfirmDeleteXfer] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingCreditId, setEditingCreditId] = useState<string | null>(null)
  const [editingXferId, setEditingXferId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const enabled = !!(range.start && range.end)

  // fetch all data for date range, filter client-side
  const { data: allTransactions, isLoading } = useQuery({
    queryKey: ['transactions', range.start, range.end],
    queryFn: () => api.transactions.list({ start: range.start, end: range.end }),
    enabled,
  })

  const { data: allTransfers = [] } = useQuery({
    queryKey: ['transfers', range.start, range.end],
    queryFn: () => api.transfers.list({ start: range.start, end: range.end }),
    enabled,
  })

  const { data: allCredits = [] } = useQuery({
    queryKey: ['credits', range.start, range.end],
    queryFn: () => api.credits.list({ start: range.start, end: range.end }),
    enabled,
  })

  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: () => api.accounts.list() })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.categories() })

  // mutations
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

  const addTxnMutation = useMutation({
    mutationFn: (data: TransactionCreate) => api.transactions.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      setShowAddForm(false)
    },
  })

  const addCreditMutation = useMutation({
    mutationFn: (data: AccountCreditCreate) => api.credits.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credits'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setShowAddForm(false)
    },
  })

  const addTransferMutation = useMutation({
    mutationFn: (data: TransferCreate) => api.transfers.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setShowAddForm(false)
    },
  })

  const deleteCreditMutation = useMutation({
    mutationFn: (id: string) => api.credits.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credits'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setConfirmDeleteCredit(null)
    },
  })

  const editCreditMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AccountCreditUpdate }) => api.credits.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credits'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setEditingCreditId(null)
    },
  })

  const editXferMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransferUpdate }) => api.transfers.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setEditingXferId(null)
    },
  })

  const deleteXferMutation = useMutation({
    mutationFn: (id: string) => api.transfers.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setConfirmDeleteXfer(null)
    },
  })

  const accountMap = Object.fromEntries((accounts ?? []).map(a => [a.id, a]))

  // client-side account filtering
  const inAcct = (id: string) => selectedAccounts.size === 0 || selectedAccounts.has(id)

  const transactions = (allTransactions ?? [])
    .filter(t => inAcct(t.account_id))
    .filter(t => selectedCategories.size === 0 || selectedCategories.has(t.category))

  const transfers = allTransfers.filter(t => inAcct(t.from_account_id) || inAcct(t.to_account_id))
  const credits = allCredits.filter(c => inAcct(c.account_id))

  // assemble ledger based on type filter
  type LedgerItem =
    | { kind: 'txn'; item: Transaction; date: string }
    | { kind: 'xfer'; item: Transfer; date: string }
    | { kind: 'credit'; item: AccountCredit; date: string }

  const ledger: LedgerItem[] = []
  if (filterType === 'all' || filterType === 'debits') {
    ledger.push(...transactions.map(t => ({ kind: 'txn' as const, item: t, date: t.date })))
  }
  if (filterType === 'all' || filterType === 'transfers') {
    ledger.push(...transfers.map(t => ({ kind: 'xfer' as const, item: t, date: t.date })))
  }
  if (filterType === 'all' || filterType === 'credits') {
    ledger.push(...credits.map(c => ({ kind: 'credit' as const, item: c, date: c.date })))
  }
  ledger.sort((a, b) => b.date.localeCompare(a.date))

  const debitTotal = transactions.reduce((s, t) => s + t.amount, 0)
  const creditTotal = credits.reduce((s, c) => s + c.amount, 0)
  const billCount = transactions.filter(t => t.bill_id).length
  const addSaving = addTxnMutation.isPending || addCreditMutation.isPending || addTransferMutation.isPending

  const defaultAccountId = selectedAccounts.size === 1 ? [...selectedAccounts][0] : undefined

  return (
    <PageShell>
      {/* Controls row */}
      <div className="flex items-center gap-2 flex-wrap">
        <AccountMultiSelect accounts={accounts ?? []} selected={selectedAccounts} onChange={setSelectedAccounts} />

        {selectedAccounts.size > 0 && (
          <button onClick={() => { setSelectedAccounts(new Set()); setSelectedCategories(new Set()) }} className="text-xs text-gray-500 hover:text-gray-300">
            × Clear
          </button>
        )}

        {/* Type filter */}
        <div className="flex rounded-lg border border-gray-700 overflow-hidden text-xs">
          {(['all', 'debits', 'credits', 'transfers'] as LedgerType[]).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2.5 py-1.5 capitalize transition-colors ${
                filterType === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white bg-gray-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <DateRangePicker value={range} onChange={setRange} />
        <button
          onClick={() => { setShowAddForm(v => !v); setEditingId(null) }}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            showAddForm
              ? 'border-indigo-500 text-indigo-300 bg-indigo-950/40'
              : 'border-indigo-700 text-indigo-400 hover:bg-indigo-900/30'
          }`}
        >
          + Add
        </button>
      </div>

      {/* Category filter — only relevant for debits */}
      {(filterType === 'all' || filterType === 'debits') && (
        <div className="flex items-center gap-2">
          <CategoryMultiSelect
            categories={categories ?? []}
            selected={selectedCategories}
            onChange={setSelectedCategories}
          />
          {selectedCategories.size > 0 && (
            <button onClick={() => setSelectedCategories(new Set())} className="text-xs text-gray-500 hover:text-gray-300">
              × Clear
            </button>
          )}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <AddForm
          accounts={accounts ?? []}
          categories={categories ?? []}
          defaultAccountId={defaultAccountId}
          onSaveTxn={data => addTxnMutation.mutate(data)}
          onSaveCredit={data => addCreditMutation.mutate(data)}
          onSaveTransfer={data => addTransferMutation.mutate(data)}
          onCancel={() => setShowAddForm(false)}
          saving={addSaving}
        />
      )}

      {/* Summary */}
      {!isLoading && (
        <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
          {(filterType === 'all' || filterType === 'debits') && transactions.length > 0 && (
            <span>
              {transactions.length} txn{transactions.length !== 1 ? 's' : ''}
              {billCount > 0 ? ` (${billCount} recurring)` : ''}{' '}—{' '}
              <span className="text-white font-mono">{fmt(debitTotal)}</span>
            </span>
          )}
          {(filterType === 'all' || filterType === 'credits') && credits.length > 0 && (
            <>
              {filterType === 'all' && <span className="text-gray-700">·</span>}
              <span>{credits.length} credit{credits.length !== 1 ? 's' : ''} — <span className="text-emerald-400 font-mono">−{fmt(creditTotal)}</span></span>
            </>
          )}
          {(filterType === 'all' || filterType === 'transfers') && transfers.length > 0 && (
            <>
              {filterType === 'all' && <span className="text-gray-700">·</span>}
              <span>{transfers.length} transfer{transfers.length !== 1 ? 's' : ''}</span>
            </>
          )}
          {ledger.length === 0 && <span>No entries for this period</span>}
        </div>
      )}

      {/* Ledger */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {isLoading && <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>}
        {!isLoading && ledger.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-sm">No entries for this period</div>
        )}

        {ledger.map(({ kind, item }, i) => {
          const isLast = i === ledger.length - 1
          const border = !isLast ? 'border-b border-gray-800/60' : ''

          if (kind === 'credit') {
            const credit = item as AccountCredit
            const acct = accountMap[credit.account_id]
            if (editingCreditId === credit.id) {
              return (
                <EditCreditRow
                  key={'c-' + credit.id}
                  credit={credit}
                  accounts={accounts ?? []}
                  categories={categories ?? []}
                  onSave={data => editCreditMutation.mutate({ id: credit.id, data })}
                  onCancel={() => setEditingCreditId(null)}
                  saving={editCreditMutation.isPending}
                />
              )
            }
            return (
              <div key={'c-' + credit.id} className={`flex items-center gap-3 px-4 py-3 ${border} bg-emerald-950/20 group`}>
                <div className="text-xs text-gray-600 w-16 flex-shrink-0 font-mono">{credit.date.slice(5)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-emerald-300">{credit.description}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {acct?.name ?? '—'}
                    <span className="ml-2 text-emerald-800">{CREDIT_TYPE_LABELS[credit.credit_type] ?? credit.credit_type}</span>
                    {credit.category && <span className="ml-2 text-indigo-400">{credit.category}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono text-emerald-400">−{fmt(credit.amount)}</div>
                  {confirmDeleteCredit === credit.id ? (
                    <div className="flex gap-2 mt-1 justify-end">
                      <button onClick={() => deleteCreditMutation.mutate(credit.id)} className="text-xs text-red-400 hover:text-red-300">Confirm</button>
                      <button onClick={() => setConfirmDeleteCredit(null)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-3 mt-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingCreditId(credit.id); setConfirmDeleteCredit(null) }} className="text-xs text-gray-500 hover:text-emerald-400 transition-colors">edit</button>
                      <button onClick={() => setConfirmDeleteCredit(credit.id)} className="text-xs text-gray-700 hover:text-red-400 transition-colors">delete</button>
                    </div>
                  )}
                </div>
              </div>
            )
          }

          if (kind === 'xfer') {
            const xfer = item as Transfer
            const from = accountMap[xfer.from_account_id]
            const to = accountMap[xfer.to_account_id]
            if (editingXferId === xfer.id) {
              return (
                <EditXferRow
                  key={'x-' + xfer.id}
                  xfer={xfer}
                  accounts={accounts ?? []}
                  onSave={data => editXferMutation.mutate({ id: xfer.id, data })}
                  onCancel={() => setEditingXferId(null)}
                  saving={editXferMutation.isPending}
                />
              )
            }
            return (
              <div key={'x-' + xfer.id} className={`flex items-center gap-3 px-4 py-3 ${border} bg-gray-800/20 group`}>
                <div className="text-xs text-gray-600 w-16 flex-shrink-0 font-mono">{xfer.date.slice(5)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-400">{xfer.description}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {from?.name ?? '—'}<span className="mx-1">→</span>{to?.name ?? '—'}
                    <span className="ml-2 text-gray-700">transfer</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono text-gray-500">{fmt(xfer.amount)}</div>
                  {confirmDeleteXfer === xfer.id ? (
                    <div className="flex gap-2 mt-1 justify-end">
                      <button onClick={() => deleteXferMutation.mutate(xfer.id)} className="text-xs text-red-400 hover:text-red-300">Confirm</button>
                      <button onClick={() => setConfirmDeleteXfer(null)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-3 mt-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingXferId(xfer.id); setConfirmDeleteXfer(null) }} className="text-xs text-gray-500 hover:text-amber-400 transition-colors">edit</button>
                      <button onClick={() => setConfirmDeleteXfer(xfer.id)} className="text-xs text-gray-700 hover:text-red-400 transition-colors">delete</button>
                    </div>
                  )}
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

          const isBill = !!txn.bill_id
          return (
            <div
              key={txn.id}
              className={`flex items-center gap-3 px-4 py-3 group ${border} ${isBill ? 'bg-blue-950/10' : 'hover:bg-gray-800/30'} transition-colors`}
            >
              <div className="text-xs text-gray-500 w-16 flex-shrink-0 font-mono">{txn.date.slice(5)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium truncate">{txn.merchant}</span>
                  {txn.tag !== 'variable' && !isBill && (
                    <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${TAG_COLORS[txn.tag] ?? 'text-gray-400 bg-gray-800'}`}>
                      {txn.tag}
                    </span>
                  )}
                  {isBill && (
                    <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 text-blue-400 bg-blue-950">bill</span>
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
                    <button onClick={() => deleteMutation.mutate(txn.id)} className="text-xs text-red-400 hover:text-red-300">Confirm</button>
                    <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
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
    </PageShell>
  )
}
