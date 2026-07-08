import { useState, useRef, useEffect } from 'react'
import PageShell from '../components/PageShell'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { fmt } from '../utils'
import { DateRangePicker, defaultRange } from '../components/DateRangePicker'
import type { DateRange } from '../components/DateRangePicker'
import Typeahead from '../components/Typeahead'
import type {
  Account, LedgerEntry, LedgerEntryCreate, LedgerEntryUpdate, TransferPairCreate, TransactionTag,
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
const INCOME_TYPE_LABELS: Record<string, string> = {
  contract: 'Contract', interest: 'Interest', tbill: 'T-Bill', investment: 'Investment', other: 'Other',
}
type LedgerFilter = 'all' | 'expense' | 'income' | 'credit' | 'transfer'
const FILTER_LABELS: Record<LedgerFilter, string> = {
  all: 'All', expense: 'Expenses', income: 'Income', credit: 'Credits', transfer: 'Transfers',
}

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
            <input type="checkbox" checked={allSelected} onChange={() => onChange(new Set())} className="accent-indigo-500" />
            All accounts
          </label>
          <div className="border-t border-gray-700/60 my-0.5" />
          {sorted.map(a => (
            <label key={a.id} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-700 cursor-pointer text-sm text-gray-300">
              <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="accent-indigo-500" />
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
  categories, selected, onChange,
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
  const label = allSelected ? 'All categories' : selected.size === 1 ? [...selected][0] : `${selected.size} categories`

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
            <input type="checkbox" checked={allSelected} onChange={() => onChange(new Set())} className="accent-indigo-500" />
            All categories
          </label>
          <div className="border-t border-gray-700/60 my-0.5" />
          {sorted.map(cat => (
            <label key={cat} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-700 cursor-pointer text-sm text-gray-300">
              <input type="checkbox" checked={selected.has(cat)} onChange={() => toggle(cat)} className="accent-indigo-500" />
              {cat}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Edit forms
// ────────────────────────────────────────────────────────────
const inp = 'w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500'
const inpGreen = inp.replace('focus:border-indigo-500', 'focus:border-emerald-500')
const inpAmber = inp.replace('focus:border-indigo-500', 'focus:border-amber-500')
const inpTeal = inp.replace('focus:border-indigo-500', 'focus:border-teal-500')

function EditExpenseRow({ entry, accounts, categories, onSave, onCancel, saving }: {
  entry: LedgerEntry; accounts: Account[]; categories: string[]
  onSave: (data: LedgerEntryUpdate) => void; onCancel: () => void; saving: boolean
}) {
  const [date, setDate] = useState(entry.date)
  const [amount, setAmount] = useState(String(entry.amount))
  const [accountId, setAccountId] = useState(entry.account_id)
  const [category, setCategory] = useState(entry.category ?? '')
  const [merchant, setMerchant] = useState(entry.merchant ?? '')
  const [tag, setTag] = useState<TransactionTag>(entry.tag ?? 'variable')
  const [notes, setNotes] = useState(entry.notes ?? '')
  const valid = date && amount && parseFloat(amount) > 0 && accountId && category.trim() && merchant.trim()
  return (
    <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700 space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div><label className="block text-xs text-gray-500 mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Amount</label>
          <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input autoFocus type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} className={inp + ' pl-6'} /></div></div>
        <div><label className="block text-xs text-gray-500 mb-1">Account</label>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inp}>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label className="block text-xs text-gray-500 mb-1">Tag</label>
          <select value={tag} onChange={e => setTag(e.target.value as TransactionTag)} className={inp}>
            {TAGS.map(t => <option key={t} value={t}>{TAG_LABELS[t]}</option>)}</select></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="block text-xs text-gray-500 mb-1">Merchant</label>
          <input value={merchant} onChange={e => setMerchant(e.target.value)} className={inp} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Category</label>
          <Typeahead value={category} onChange={setCategory} suggestions={categories} placeholder="Category" inputClassName={inp} /></div>
      </div>
      <div><label className="block text-xs text-gray-500 mb-1">Notes</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" className={inp} /></div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded py-1.5 text-xs">Cancel</button>
        <button disabled={!valid || saving}
          onClick={() => onSave({ date, amount: parseFloat(amount), account_id: accountId, category: category.trim(), merchant: merchant.trim(), tag, notes: notes.trim() || undefined })}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium">
          {saving ? '…' : 'Save'}</button>
      </div>
    </div>
  )
}

function EditCreditRow({ entry, accounts, categories, onSave, onCancel, saving }: {
  entry: LedgerEntry; accounts: Account[]; categories: string[]
  onSave: (data: LedgerEntryUpdate) => void; onCancel: () => void; saving: boolean
}) {
  const [accountId, setAccountId] = useState(entry.account_id)
  const [amount, setAmount] = useState(String(entry.amount))
  const [date, setDate] = useState(entry.date)
  const [crType, setCrType] = useState(entry.subtype ?? 'cashback')
  const [desc, setDesc] = useState(entry.notes ?? '')
  const [category, setCategory] = useState(entry.category ?? '')
  const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name))
  const needsCategory = crType === 'dispute'
  const valid = date && amount && parseFloat(amount) > 0 && accountId && (!needsCategory || category.trim())
  return (
    <div className="px-4 py-3 bg-emerald-950/20 border-b border-gray-700 space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div><label className="block text-xs text-gray-500 mb-1">Account</label>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inpGreen}>
            {sorted.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label className="block text-xs text-gray-500 mb-1">Amount</label>
          <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input autoFocus type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} className={inpGreen + ' pl-6'} /></div></div>
        <div><label className="block text-xs text-gray-500 mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inpGreen} /></div>
        <div><label className="block text-xs text-gray-500 mb-1">Type</label>
          <select value={crType} onChange={e => { setCrType(e.target.value); if (e.target.value !== 'dispute') setCategory('') }} className={inpGreen}>
            {CREDIT_TYPES.map(t => <option key={t} value={t}>{CREDIT_TYPE_LABELS[t]}</option>)}</select></div>
      </div>
      {needsCategory && (
        <div><label className="block text-xs text-gray-500 mb-1">Category <span className="text-emerald-600">— which spending category does this refund?</span></label>
          <Typeahead value={category} onChange={setCategory} suggestions={categories} placeholder="e.g. Groceries" inputClassName={inpGreen} /></div>
      )}
      <div><label className="block text-xs text-gray-500 mb-1">Description</label>
        <input value={desc} onChange={e => setDesc(e.target.value)} className={inpGreen} /></div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded py-1.5 text-xs">Cancel</button>
        <button disabled={!valid || saving}
          onClick={() => onSave({ account_id: accountId, amount: parseFloat(amount), date, subtype: crType, notes: desc.trim() || CREDIT_TYPE_LABELS[crType], category: needsCategory ? category.trim() : undefined })}
          className="flex-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium">
          {saving ? '…' : 'Save'}</button>
      </div>
    </div>
  )
}

function EditXferRow({ entry, accounts, onSave, onCancel, saving }: {
  entry: LedgerEntry; accounts: Account[]
  onSave: (data: { from: string; to: string; amount: number; date: string; notes: string }) => void
  onCancel: () => void; saving: boolean
}) {
  const isOut = entry.type === 'transfer_out'
  const [from, setFrom] = useState(isOut ? entry.account_id : (entry.counterpart_account_id ?? ''))
  const [to, setTo] = useState(isOut ? (entry.counterpart_account_id ?? '') : entry.account_id)
  const [amount, setAmount] = useState(String(entry.amount))
  const [date, setDate] = useState(entry.date)
  const [desc, setDesc] = useState(entry.notes ?? '')
  const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name))
  const valid = from && to && from !== to && amount && parseFloat(amount) > 0 && date
  return (
    <div className="px-4 py-3 bg-amber-950/10 border-b border-gray-700 space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div><label className="block text-xs text-gray-500 mb-1">From</label>
          <select value={from} onChange={e => setFrom(e.target.value)} className={inpAmber}>
            {sorted.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label className="block text-xs text-gray-500 mb-1">To</label>
          <select value={to} onChange={e => setTo(e.target.value)} className={inpAmber}>
            {sorted.filter(a => a.id !== from).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label className="block text-xs text-gray-500 mb-1">Amount</label>
          <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input autoFocus type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} className={inpAmber + ' pl-6'} /></div></div>
        <div><label className="block text-xs text-gray-500 mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inpAmber} /></div>
      </div>
      <div><label className="block text-xs text-gray-500 mb-1">Description</label>
        <input value={desc} onChange={e => setDesc(e.target.value)} className={inpAmber} /></div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded py-1.5 text-xs">Cancel</button>
        <button disabled={!valid || saving}
          onClick={() => onSave({ from, to, amount: parseFloat(amount), date, notes: desc.trim() || 'Transfer' })}
          className="flex-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium">
          {saving ? '…' : 'Save'}</button>
      </div>
    </div>
  )
}

function EditIncomeRow({ entry, accounts, onSave, onCancel, saving }: {
  entry: LedgerEntry; accounts: Account[]
  onSave: (data: LedgerEntryUpdate) => void; onCancel: () => void; saving: boolean
}) {
  const [accountId, setAccountId] = useState(entry.account_id)
  const [amount, setAmount] = useState(String(entry.amount))
  const [date, setDate] = useState(entry.date)
  const [desc, setDesc] = useState(entry.notes ?? '')
  const depositAccounts = accounts.filter(a => a.type === 'checking' || a.type === 'savings')
  const valid = amount && parseFloat(amount) > 0 && accountId && date
  return (
    <div className="px-4 py-3 bg-teal-950/20 border-b border-gray-700 space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div><label className="block text-xs text-gray-500 mb-1">Account</label>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inpTeal}>
            {depositAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label className="block text-xs text-gray-500 mb-1">Amount</label>
          <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input autoFocus type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} className={inpTeal + ' pl-6'} /></div></div>
        <div><label className="block text-xs text-gray-500 mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inpTeal} /></div>
      </div>
      <div><label className="block text-xs text-gray-500 mb-1">Description</label>
        <input value={desc} onChange={e => setDesc(e.target.value)} className={inpTeal} /></div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded py-1.5 text-xs">Cancel</button>
        <button disabled={!valid || saving}
          onClick={() => onSave({ account_id: accountId, amount: parseFloat(amount), date, notes: desc.trim() || undefined })}
          className="flex-1 bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium">
          {saving ? '…' : 'Save'}</button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// AddForm
// ────────────────────────────────────────────────────────────
type AddType = 'expense' | 'credit' | 'income' | 'transfer'

function AddForm({
  accounts, categories, defaultAccountId,
  onSaveExpense, onSaveCredit, onSaveIncome, onSaveTransfer,
  onCancel, saving,
}: {
  accounts: Account[]; categories: string[]; defaultAccountId?: string
  onSaveExpense: (data: LedgerEntryCreate) => void
  onSaveCredit: (data: LedgerEntryCreate) => void
  onSaveIncome: (data: LedgerEntryCreate) => void
  onSaveTransfer: (data: TransferPairCreate) => void
  onCancel: () => void; saving: boolean
}) {
  const [type, setType] = useState<AddType>('expense')
  const today = new Date().toISOString().slice(0, 10)
  const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name))
  const firstId = defaultAccountId || sorted[0]?.id || ''
  const depositAccounts = sorted.filter(a => a.type === 'checking' || a.type === 'savings')

  // expense
  const [txnDate, setTxnDate] = useState(today)
  const [txnAmount, setTxnAmount] = useState('')
  const [txnAccount, setTxnAccount] = useState(firstId)
  const [txnCategory, setTxnCategory] = useState('')
  const [txnMerchant, setTxnMerchant] = useState('')
  const [txnTag, setTxnTag] = useState<TransactionTag>('variable')
  const [txnNotes, setTxnNotes] = useState('')
  const [merchantSuggestions, setMerchantSuggestions] = useState<string[]>([])
  const merchantCategoryMap = useRef<Record<string, string>>({})

  // credit
  const [crDate, setCrDate] = useState(today)
  const [crAmount, setCrAmount] = useState('')
  const [crAccount, setCrAccount] = useState(firstId)
  const [crType, setCrType] = useState('cashback')
  const [crDesc, setCrDesc] = useState('')
  const [crCategory, setCrCategory] = useState('')

  // income
  const [incDate, setIncDate] = useState(today)
  const [incAmount, setIncAmount] = useState('')
  const [incAccount, setIncAccount] = useState(depositAccounts[0]?.id ?? '')
  const [incSubtype, setIncSubtype] = useState('contract')
  const [incDesc, setIncDesc] = useState('')

  // transfer
  const [xfDate, setXfDate] = useState(today)
  const [xfAmount, setXfAmount] = useState('')
  const [xfFrom, setXfFrom] = useState(sorted.find(a => a.type === 'checking')?.id ?? firstId)
  const [xfTo, setXfTo] = useState(sorted[1]?.id ?? '')
  const [xfDesc, setXfDesc] = useState('')

  const txnValid = txnDate && txnAmount && parseFloat(txnAmount) > 0 && txnAccount && txnCategory.trim() && txnMerchant.trim()
  const crNeedsCategory = crType === 'dispute'
  const crValid = crDate && crAmount && parseFloat(crAmount) > 0 && crAccount && (!crNeedsCategory || crCategory.trim())
  const incValid = incDate && incAmount && parseFloat(incAmount) > 0 && incAccount && incDesc.trim()
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
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 mr-1">Add:</span>
        <button className={tabCls('expense')} onClick={() => setType('expense')}>Expense</button>
        <button className={tabCls('income')} onClick={() => setType('income')}>Income</button>
        <button className={tabCls('credit')} onClick={() => setType('credit')}>Credit</button>
        <button className={tabCls('transfer')} onClick={() => setType('transfer')}>Transfer</button>
        <button onClick={onCancel} className="ml-auto text-xs text-gray-600 hover:text-gray-400">✕</button>
      </div>

      {/* Expense */}
      {type === 'expense' && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div><label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} className={inp} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Amount</label>
              <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input autoFocus type="number" step="0.01" min="0" value={txnAmount} onChange={e => setTxnAmount(e.target.value)} className={inp + ' pl-6'} /></div></div>
            <div><label className="block text-xs text-gray-500 mb-1">Account</label>
              <select value={txnAccount} onChange={e => setTxnAccount(e.target.value)} className={inp}>
                {sorted.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div><label className="block text-xs text-gray-500 mb-1">Tag</label>
              <select value={txnTag} onChange={e => setTxnTag(e.target.value as TransactionTag)} className={inp}>
                {TAGS.map(t => <option key={t} value={t}>{TAG_LABELS[t]}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs text-gray-500 mb-1">Merchant</label>
              <Typeahead value={txnMerchant} onChange={setTxnMerchant} onSearch={handleMerchantSearch} onSuggestionSelect={handleMerchantSelect} suggestions={merchantSuggestions} placeholder="Merchant name" inputClassName={inp} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Category</label>
              <Typeahead value={txnCategory} onChange={setTxnCategory} suggestions={categories} placeholder="Category" inputClassName={inp} /></div>
          </div>
          <div><label className="block text-xs text-gray-500 mb-1">Notes</label>
            <input value={txnNotes} onChange={e => setTxnNotes(e.target.value)} placeholder="Optional" className={inp} /></div>
          <button disabled={!txnValid || saving}
            onClick={() => onSaveExpense({ type: 'expense', date: txnDate, amount: parseFloat(txnAmount), account_id: txnAccount, category: txnCategory.trim(), merchant: txnMerchant.trim(), tag: txnTag, notes: txnNotes.trim() || undefined })}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium">
            {saving ? '…' : 'Add Expense'}</button>
        </>
      )}

      {/* Income */}
      {type === 'income' && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div><label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={incDate} onChange={e => setIncDate(e.target.value)} className={inpTeal} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Amount</label>
              <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input autoFocus type="number" step="0.01" min="0" value={incAmount} onChange={e => setIncAmount(e.target.value)} className={inpTeal + ' pl-6'} /></div></div>
            <div><label className="block text-xs text-gray-500 mb-1">Deposit Account</label>
              <select value={incAccount} onChange={e => setIncAccount(e.target.value)} className={inpTeal}>
                {depositAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div><label className="block text-xs text-gray-500 mb-1">Type</label>
              <select value={incSubtype} onChange={e => setIncSubtype(e.target.value)} className={inpTeal}>
                {Object.entries(INCOME_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          </div>
          <div><label className="block text-xs text-gray-500 mb-1">Description</label>
            <input value={incDesc} onChange={e => setIncDesc(e.target.value)} placeholder="e.g. June contract hours" className={inpTeal} /></div>
          <button disabled={!incValid || saving}
            onClick={() => onSaveIncome({ type: 'income', date: incDate, amount: parseFloat(incAmount), account_id: incAccount, subtype: incSubtype, notes: incDesc.trim() })}
            className="w-full bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium">
            {saving ? '…' : 'Add Income'}</button>
        </>
      )}

      {/* Credit */}
      {type === 'credit' && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div><label className="block text-xs text-gray-500 mb-1">Account</label>
              <select value={crAccount} onChange={e => setCrAccount(e.target.value)} className={inpGreen}>
                {sorted.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div><label className="block text-xs text-gray-500 mb-1">Amount</label>
              <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input autoFocus type="number" step="0.01" min="0" value={crAmount} onChange={e => setCrAmount(e.target.value)} className={inpGreen + ' pl-6'} /></div></div>
            <div><label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={crDate} onChange={e => setCrDate(e.target.value)} className={inpGreen} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Type</label>
              <select value={crType} onChange={e => { setCrType(e.target.value); if (e.target.value !== 'dispute') setCrCategory('') }} className={inpGreen}>
                {CREDIT_TYPES.map(t => <option key={t} value={t}>{CREDIT_TYPE_LABELS[t]}</option>)}</select></div>
          </div>
          {crNeedsCategory && (
            <div><label className="block text-xs text-gray-500 mb-1">Category <span className="text-emerald-600">— which spending category does this refund?</span></label>
              <Typeahead value={crCategory} onChange={setCrCategory} suggestions={categories} placeholder="e.g. Groceries" inputClassName={inpGreen} /></div>
          )}
          <div><label className="block text-xs text-gray-500 mb-1">Description</label>
            <input value={crDesc} onChange={e => setCrDesc(e.target.value)} placeholder="e.g. Annual cashback reward" className={inpGreen} /></div>
          <button disabled={!crValid || saving}
            onClick={() => onSaveCredit({ type: 'credit', account_id: crAccount, amount: parseFloat(crAmount), date: crDate, subtype: crType, notes: crDesc.trim() || CREDIT_TYPE_LABELS[crType], category: crNeedsCategory ? crCategory.trim() : undefined })}
            className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium">
            {saving ? '…' : 'Add Credit'}</button>
        </>
      )}

      {/* Transfer */}
      {type === 'transfer' && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div><label className="block text-xs text-gray-500 mb-1">From</label>
              <select value={xfFrom} onChange={e => setXfFrom(e.target.value)} className={inpAmber}>
                {sorted.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div><label className="block text-xs text-gray-500 mb-1">To</label>
              <select value={xfTo} onChange={e => setXfTo(e.target.value)} className={inpAmber}>
                {sorted.filter(a => a.id !== xfFrom).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            <div><label className="block text-xs text-gray-500 mb-1">Amount</label>
              <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input autoFocus type="number" step="0.01" min="0" value={xfAmount} onChange={e => setXfAmount(e.target.value)} className={inpAmber + ' pl-6'} /></div></div>
            <div><label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={xfDate} onChange={e => setXfDate(e.target.value)} className={inpAmber} /></div>
          </div>
          <div><label className="block text-xs text-gray-500 mb-1">Description</label>
            <input value={xfDesc} onChange={e => setXfDesc(e.target.value)} placeholder="e.g. Chase CC payment" className={inpAmber} /></div>
          <button disabled={!xfValid || saving}
            onClick={() => onSaveTransfer({ from_account_id: xfFrom, to_account_id: xfTo, amount: parseFloat(xfAmount), date: xfDate, description: xfDesc.trim() || 'Transfer' })}
            className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white rounded py-1.5 text-xs font-medium">
            {saving ? '…' : 'Add Transfer'}</button>
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
  const [filterType, setFilterType] = useState<LedgerFilter>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const enabled = !!(range.start && range.end)

  const { data: allEntries, isLoading } = useQuery({
    queryKey: ['ledger', range.start, range.end],
    queryFn: () => api.ledger.list({ start: range.start, end: range.end }),
    enabled,
  })

  const { data: accounts } = useQuery({ queryKey: ['accounts'], queryFn: () => api.accounts.list() })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.categories() })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ledger'] })
    qc.invalidateQueries({ queryKey: ['accounts'] })
    qc.invalidateQueries({ queryKey: ['waterfall'] })
  }

  const addLedgerMutation = useMutation({
    mutationFn: (data: LedgerEntryCreate) => api.ledger.create(data),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['categories'] })
      setShowAddForm(false)
    },
  })

  const addTransferMutation = useMutation({
    mutationFn: (data: TransferPairCreate) => api.ledger.createTransfer(data),
    onSuccess: () => { invalidate(); setShowAddForm(false) },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: LedgerEntryUpdate }) => api.ledger.update(id, data),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['categories'] })
      setEditingId(null)
    },
  })

  const editXferMutation = useMutation({
    mutationFn: async ({ entry, data }: { entry: LedgerEntry; data: { from: string; to: string; amount: number; date: string; notes: string } }) => {
      await api.ledger.update(entry.id, { account_id: data.from, amount: data.amount, date: data.date, notes: data.notes })
      if (entry.linked_entry_id) {
        await api.ledger.update(entry.linked_entry_id, { account_id: data.to })
      }
    },
    onSuccess: () => { invalidate(); setEditingId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.ledger.delete(id),
    onSuccess: () => { invalidate(); setConfirmDelete(null) },
  })

  const accountMap = Object.fromEntries((accounts ?? []).map(a => [a.id, a]))
  const inAcct = (id: string) => selectedAccounts.size === 0 || selectedAccounts.has(id)

  const allFiltered = (allEntries ?? []).filter(e => inAcct(e.account_id))

  // In all-accounts view, hide transfer_in rows (show each transfer once via transfer_out)
  const dedupedEntries = selectedAccounts.size === 0
    ? allFiltered.filter(e => e.type !== 'transfer_in')
    : allFiltered

  const typeFiltered = dedupedEntries.filter(e => {
    if (filterType === 'all') return true
    if (filterType === 'expense') return e.type === 'expense'
    if (filterType === 'income') return e.type === 'income'
    if (filterType === 'credit') return e.type === 'credit'
    if (filterType === 'transfer') return e.type === 'transfer_out' || e.type === 'transfer_in'
    return true
  })

  const ledger = typeFiltered
    .filter(e => e.type !== 'expense' || selectedCategories.size === 0 || selectedCategories.has(e.category ?? ''))
    .sort((a, b) => b.date.localeCompare(a.date))

  const expenseTotal = allFiltered.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
  const creditTotal = allFiltered.filter(e => e.type === 'credit').reduce((s, e) => s + e.amount, 0)
  const incomeTotal = allFiltered.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0)
  const xferCount = allFiltered.filter(e => e.type === 'transfer_out').length
  const billCount = allFiltered.filter(e => e.type === 'expense' && e.bill_id).length

  const addSaving = addLedgerMutation.isPending || addTransferMutation.isPending
  const defaultAccountId = selectedAccounts.size === 1 ? [...selectedAccounts][0] : undefined

  return (
    <PageShell>
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <AccountMultiSelect accounts={accounts ?? []} selected={selectedAccounts} onChange={setSelectedAccounts} />
        {selectedAccounts.size > 0 && (
          <button onClick={() => { setSelectedAccounts(new Set()); setSelectedCategories(new Set()) }} className="text-xs text-gray-500 hover:text-gray-300">
            × Clear
          </button>
        )}
        <div className="flex rounded-lg border border-gray-700 overflow-hidden text-xs">
          {(Object.keys(FILTER_LABELS) as LedgerFilter[]).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-2.5 py-1.5 capitalize transition-colors ${
                filterType === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white bg-gray-800'
              }`}>
              {FILTER_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <DateRangePicker value={range} onChange={setRange} />
        <button
          onClick={() => { setShowAddForm(v => !v); setEditingId(null) }}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            showAddForm ? 'border-indigo-500 text-indigo-300 bg-indigo-950/40' : 'border-indigo-700 text-indigo-400 hover:bg-indigo-900/30'
          }`}
        >
          + Add
        </button>
      </div>

      {/* Category filter — only relevant for expenses */}
      {(filterType === 'all' || filterType === 'expense') && (
        <div className="flex items-center gap-2">
          <CategoryMultiSelect categories={categories ?? []} selected={selectedCategories} onChange={setSelectedCategories} />
          {selectedCategories.size > 0 && (
            <button onClick={() => setSelectedCategories(new Set())} className="text-xs text-gray-500 hover:text-gray-300">
              × Clear
            </button>
          )}
        </div>
      )}

      {showAddForm && (
        <AddForm
          accounts={accounts ?? []} categories={categories ?? []} defaultAccountId={defaultAccountId}
          onSaveExpense={data => addLedgerMutation.mutate(data)}
          onSaveIncome={data => addLedgerMutation.mutate(data)}
          onSaveCredit={data => addLedgerMutation.mutate(data)}
          onSaveTransfer={data => addTransferMutation.mutate(data)}
          onCancel={() => setShowAddForm(false)} saving={addSaving}
        />
      )}

      {/* Summary */}
      {!isLoading && (
        <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
          {(filterType === 'all' || filterType === 'expense') && allFiltered.filter(e => e.type === 'expense').length > 0 && (
            <span>
              {allFiltered.filter(e => e.type === 'expense').length} expense{allFiltered.filter(e => e.type === 'expense').length !== 1 ? 's' : ''}
              {billCount > 0 ? ` (${billCount} recurring)` : ''} — <span className="text-white font-mono">{fmt(expenseTotal)}</span>
            </span>
          )}
          {(filterType === 'all' || filterType === 'income') && incomeTotal > 0 && (
            <><span className="text-gray-700">·</span>
              <span className="text-teal-400 font-mono">{fmt(incomeTotal)} income</span></>
          )}
          {(filterType === 'all' || filterType === 'credit') && creditTotal > 0 && (
            <><span className="text-gray-700">·</span>
              <span>{allFiltered.filter(e => e.type === 'credit').length} credit{allFiltered.filter(e => e.type === 'credit').length !== 1 ? 's' : ''} — <span className="text-emerald-400 font-mono">−{fmt(creditTotal)}</span></span></>
          )}
          {(filterType === 'all' || filterType === 'transfer') && xferCount > 0 && (
            <><span className="text-gray-700">·</span><span>{xferCount} transfer{xferCount !== 1 ? 's' : ''}</span></>
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

        {ledger.map((entry, i) => {
          const isLast = i === ledger.length - 1
          const border = !isLast ? 'border-b border-gray-800/60' : ''

          // ── Expense ───────────────────────────────────────
          if (entry.type === 'expense') {
            if (editingId === entry.id) {
              return (
                <EditExpenseRow key={entry.id} entry={entry} accounts={accounts ?? []} categories={categories ?? []}
                  onSave={data => editMutation.mutate({ id: entry.id, data })}
                  onCancel={() => setEditingId(null)} saving={editMutation.isPending} />
              )
            }
            const isBill = !!entry.bill_id
            return (
              <div key={entry.id} className={`flex items-center gap-3 px-4 py-3 group ${border} ${isBill ? 'bg-blue-950/10' : 'hover:bg-gray-800/30'} transition-colors`}>
                <div className="text-xs text-gray-500 w-16 flex-shrink-0 font-mono">{entry.date.slice(5)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium truncate">{entry.merchant}</span>
                    {entry.tag && entry.tag !== 'variable' && !isBill && (
                      <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${TAG_COLORS[entry.tag] ?? 'text-gray-400 bg-gray-800'}`}>
                        {entry.tag}
                      </span>
                    )}
                    {isBill && <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0 text-blue-400 bg-blue-950">bill</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-indigo-400">{entry.category}</span>
                    <span className="text-xs text-gray-600">{accountMap[entry.account_id]?.name ?? '—'}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-white font-mono text-sm">{fmt(entry.amount)}</div>
                  {confirmDelete === entry.id ? (
                    <div className="flex gap-2 mt-1 justify-end">
                      <button onClick={() => deleteMutation.mutate(entry.id)} className="text-xs text-red-400 hover:text-red-300">Confirm</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-3 mt-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingId(entry.id); setConfirmDelete(null) }} className="text-xs text-gray-500 hover:text-indigo-400 transition-colors">edit</button>
                      <button onClick={() => setConfirmDelete(entry.id)} className="text-xs text-gray-700 hover:text-red-400 transition-colors">delete</button>
                    </div>
                  )}
                </div>
              </div>
            )
          }

          // ── Credit ────────────────────────────────────────
          if (entry.type === 'credit') {
            if (editingId === entry.id) {
              return (
                <EditCreditRow key={entry.id} entry={entry} accounts={accounts ?? []} categories={categories ?? []}
                  onSave={data => editMutation.mutate({ id: entry.id, data })}
                  onCancel={() => setEditingId(null)} saving={editMutation.isPending} />
              )
            }
            const acct = accountMap[entry.account_id]
            return (
              <div key={entry.id} className={`flex items-center gap-3 px-4 py-3 ${border} bg-emerald-950/20 group`}>
                <div className="text-xs text-gray-600 w-16 flex-shrink-0 font-mono">{entry.date.slice(5)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-emerald-300">{entry.notes}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {acct?.name ?? '—'}
                    <span className="ml-2 text-emerald-800">{CREDIT_TYPE_LABELS[entry.subtype ?? ''] ?? entry.subtype}</span>
                    {entry.category && <span className="ml-2 text-indigo-400">{entry.category}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono text-emerald-400">−{fmt(entry.amount)}</div>
                  {confirmDelete === entry.id ? (
                    <div className="flex gap-2 mt-1 justify-end">
                      <button onClick={() => deleteMutation.mutate(entry.id)} className="text-xs text-red-400 hover:text-red-300">Confirm</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-3 mt-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingId(entry.id); setConfirmDelete(null) }} className="text-xs text-gray-500 hover:text-emerald-400 transition-colors">edit</button>
                      <button onClick={() => setConfirmDelete(entry.id)} className="text-xs text-gray-700 hover:text-red-400 transition-colors">delete</button>
                    </div>
                  )}
                </div>
              </div>
            )
          }

          // ── Income ────────────────────────────────────────
          if (entry.type === 'income') {
            if (editingId === entry.id) {
              return (
                <EditIncomeRow key={entry.id} entry={entry} accounts={accounts ?? []}
                  onSave={data => editMutation.mutate({ id: entry.id, data })}
                  onCancel={() => setEditingId(null)} saving={editMutation.isPending} />
              )
            }
            const acct = accountMap[entry.account_id]
            return (
              <div key={entry.id} className={`flex items-center gap-3 px-4 py-3 ${border} bg-teal-950/20 group`}>
                <div className="text-xs text-gray-600 w-16 flex-shrink-0 font-mono">{entry.date.slice(5)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-teal-300">{entry.notes}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {acct?.name ?? '—'}
                    <span className="ml-2 text-teal-800">{INCOME_TYPE_LABELS[entry.subtype ?? ''] ?? entry.subtype}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono text-teal-400">+{fmt(entry.amount)}</div>
                  {confirmDelete === entry.id ? (
                    <div className="flex gap-2 mt-1 justify-end">
                      <button onClick={() => deleteMutation.mutate(entry.id)} className="text-xs text-red-400 hover:text-red-300">Confirm</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-3 mt-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingId(entry.id); setConfirmDelete(null) }} className="text-xs text-gray-500 hover:text-teal-400 transition-colors">edit</button>
                      <button onClick={() => setConfirmDelete(entry.id)} className="text-xs text-gray-700 hover:text-red-400 transition-colors">delete</button>
                    </div>
                  )}
                </div>
              </div>
            )
          }

          // ── Transfer ──────────────────────────────────────
          if (entry.type === 'transfer_out' || entry.type === 'transfer_in') {
            const isOut = entry.type === 'transfer_out'
            const from = isOut ? accountMap[entry.account_id] : accountMap[entry.counterpart_account_id ?? '']
            const to = isOut ? accountMap[entry.counterpart_account_id ?? ''] : accountMap[entry.account_id]

            if (editingId === entry.id && isOut) {
              return (
                <EditXferRow key={entry.id} entry={entry} accounts={accounts ?? []}
                  onSave={data => editXferMutation.mutate({ entry, data })}
                  onCancel={() => setEditingId(null)} saving={editXferMutation.isPending} />
              )
            }
            return (
              <div key={entry.id} className={`flex items-center gap-3 px-4 py-3 ${border} bg-gray-800/20 group`}>
                <div className="text-xs text-gray-600 w-16 flex-shrink-0 font-mono">{entry.date.slice(5)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-400">{entry.notes || 'Transfer'}</div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {from?.name ?? '—'}<span className="mx-1">→</span>{to?.name ?? '—'}
                    <span className="ml-2 text-gray-700">{isOut ? 'transfer' : 'incoming'}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-mono ${isOut ? 'text-gray-500' : 'text-gray-400'}`}>{fmt(entry.amount)}</div>
                  {confirmDelete === entry.id ? (
                    <div className="flex gap-2 mt-1 justify-end">
                      <button onClick={() => deleteMutation.mutate(entry.id)} className="text-xs text-red-400 hover:text-red-300">Confirm</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-3 mt-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      {isOut && <button onClick={() => { setEditingId(entry.id); setConfirmDelete(null) }} className="text-xs text-gray-500 hover:text-amber-400 transition-colors">edit</button>}
                      <button onClick={() => setConfirmDelete(entry.id)} className="text-xs text-gray-700 hover:text-red-400 transition-colors">delete</button>
                    </div>
                  )}
                </div>
              </div>
            )
          }

          return null
        })}
      </div>
    </PageShell>
  )
}
