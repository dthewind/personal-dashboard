import { useState, useRef, useCallback } from 'react'
import PageShell from '../components/PageShell'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { Account, LedgerEntryCreate, TransactionTag } from '../types'
import { todayStr } from '../utils'
import Typeahead from '../components/Typeahead'

// ── CSV parsing ───────────────────────────────────────────────────────────────
// Expected format (case-insensitive headers):
//   account, date, amount, merchant, category[, tag]

let _rid = 0
const rid = () => String(++_rid)

interface CsvRow {
  id: string
  accountRaw: string
  accountId: string | null  // resolved after matching against accounts list
  date: string
  amount: number
  merchant: string
  category: string
  tag: TransactionTag
  include: boolean
}

function parseCsvText(text: string): string[][] {
  return text.trim().split('\n').map(line => {
    const fields: string[] = []
    let cur = ''
    let inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    fields.push(cur.trim())
    return fields
  })
}

function parseCsv(text: string, accounts: Account[]): { rows: CsvRow[]; error?: string } {
  const all = parseCsvText(text)
  if (all.length < 2) return { rows: [], error: 'File is empty' }

  const headers = all[0].map(h => h.toLowerCase().replace(/[^a-z]/g, ''))
  const col = (name: string) => headers.indexOf(name)

  const iAccount = col('account')
  const iDate = col('date')
  const iAmount = col('amount')
  const iMerchant = col('merchant')
  const iCategory = col('category')
  const iTag = col('tag')

  const missing = ['account', 'date', 'amount', 'merchant', 'category'].filter(
    n => col(n) === -1
  )
  if (missing.length) return { rows: [], error: `Missing columns: ${missing.join(', ')}` }

  const acctMap = new Map(accounts.map(a => [a.name.toLowerCase(), a.id]))

  const rows = all.slice(1).flatMap((r): CsvRow[] => {
    if (r.every(cell => !cell)) return []  // skip blank lines
    const accountRaw = r[iAccount]?.trim() ?? ''
    const accountId = acctMap.get(accountRaw.toLowerCase()) ?? null
    const dateRaw = r[iDate]?.trim() ?? ''
    // accept YYYY-MM-DD or MM/DD/YYYY
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
      ? dateRaw
      : (() => { const [m, d, y] = dateRaw.split('/'); return `${y}-${m?.padStart(2,'0')}-${d?.padStart(2,'0')}` })()
    const amount = Math.abs(parseFloat(r[iAmount]?.trim() ?? ''))
    const merchant = r[iMerchant]?.trim() ?? ''
    const category = r[iCategory]?.trim() ?? ''
    const tagRaw = iTag >= 0 ? r[iTag]?.trim().toLowerCase() : ''
    const tag: TransactionTag = tagRaw === 'fixed' ? 'fixed' : tagRaw === 'one_off' || tagRaw === 'one-off' ? 'one_off' : 'variable'
    if (isNaN(amount) || amount <= 0) return []
    return [{ id: rid(), accountRaw, accountId, date, amount, merchant, category, tag, include: true }]
  })

  return { rows }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const TAGS: { value: TransactionTag; label: string }[] = [
  { value: 'variable', label: 'Variable' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'one_off', label: 'One-off' },
]

const inputCls = 'bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500'
const selectCls = inputCls + ' cursor-pointer'

function AccountSelect({ value, onChange, accounts }: { value: string; onChange: (v: string) => void; accounts: Account[] }) {
  const sorted = [...accounts].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={selectCls}>
      <option value="">Account…</option>
      {sorted.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  )
}

function MerchantTypeahead({ value, onChange, onSelect, inputClassName }: {
  value: string
  onChange: (v: string) => void
  onSelect: (name: string, defaultCategory: string | null) => void
  inputClassName?: string
}) {
  const [query, setQuery] = useState('')
  const { data: merchants } = useQuery({
    queryKey: ['merchants', query],
    queryFn: () => api.merchants(query),
    enabled: query.length > 0,
    staleTime: 30_000,
  })
  const names = merchants?.map(m => m.name) ?? []
  const handleSelect = useCallback((name: string) => {
    const cat = merchants?.find(m => m.name === name)?.default_category ?? null
    onSelect(name, cat)
  }, [merchants, onSelect])
  return (
    <Typeahead
      value={value}
      onChange={v => { onChange(v); setQuery(v) }}
      onSuggestionSelect={handleSelect}
      suggestions={names}
      placeholder="Merchant"
      inputClassName={inputClassName}
    />
  )
}

// ── Manual batch entry ────────────────────────────────────────────────────────

interface ManualRow {
  id: string
  date: string
  amount: string
  accountId: string
  merchant: string
  category: string
  tag: TransactionTag
}

function emptyRow(prev?: ManualRow): ManualRow {
  return { id: rid(), date: prev?.date ?? todayStr(), amount: '', accountId: prev?.accountId ?? '', merchant: '', category: '', tag: prev?.tag ?? 'variable' }
}

function ManualBatchEntry({ accounts, categories }: { accounts: Account[]; categories: string[] }) {
  const qc = useQueryClient()
  const [rows, setRows] = useState<ManualRow[]>(() => [emptyRow()])
  const [saved, setSaved] = useState(0)

  const mutation = useMutation({
    mutationFn: (entries: LedgerEntryCreate[]) => api.ledger.bulk(entries),
    onSuccess: (res) => {
      setSaved(res.created)
      setRows([emptyRow()])
      qc.invalidateQueries({ queryKey: ['ledger'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['merchants'] })
      setTimeout(() => setSaved(0), 3000)
    },
  })

  function update(id: string, field: keyof ManualRow, value: string) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function addRow() {
    setRows(rs => [...rs, emptyRow(rs[rs.length - 1])])
  }

  function removeRow(id: string) {
    setRows(rs => rs.length > 1 ? rs.filter(r => r.id !== id) : rs)
  }

  const valid = rows.filter(r =>
    r.amount && parseFloat(r.amount) > 0 && r.accountId && r.merchant.trim() && r.category.trim()
  )

  function save() {
    const entries: LedgerEntryCreate[] = valid.map(r => ({
      type: 'expense' as const,
      date: r.date,
      account_id: r.accountId,
      amount: parseFloat(r.amount),
      merchant: r.merchant.trim(),
      category: r.category.trim(),
      tag: r.tag,
    }))
    mutation.mutate(entries)
  }

  return (
    <div className="space-y-3">
      {saved > 0 && (
        <div className="px-4 py-3 bg-emerald-950 border border-emerald-800 rounded-xl text-emerald-400 text-sm">
          {saved} transaction{saved !== 1 ? 's' : ''} saved ✓
        </div>
      )}
      {mutation.isError && (
        <div className="px-4 py-3 bg-red-950 border border-red-800 rounded-xl text-red-400 text-sm">
          Save failed — check all fields.
        </div>
      )}

      <div className="space-y-2">
        {rows.map(row => (
          <div key={row.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
            {/* Line 1 */}
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="date"
                value={row.date}
                onChange={e => update(row.id, 'date', e.target.value)}
                className={inputCls}
              />
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.amount}
                  onChange={e => update(row.id, 'amount', e.target.value)}
                  placeholder="0.00"
                  className={inputCls + ' pl-5 w-28 font-mono'}
                />
              </div>
              <AccountSelect value={row.accountId} onChange={v => update(row.id, 'accountId', v)} accounts={accounts} />
              <button
                onClick={() => removeRow(row.id)}
                className="ml-auto text-gray-600 hover:text-red-400 text-lg leading-none px-1"
                title="Remove row"
              >
                ×
              </button>
            </div>
            {/* Line 2 */}
            <div className="flex flex-wrap gap-2 items-start">
              <div className="flex-1 min-w-40">
                <MerchantTypeahead
                  value={row.merchant}
                  onChange={v => update(row.id, 'merchant', v)}
                  onSelect={(name, cat) => {
                    update(row.id, 'merchant', name)
                    if (cat && !row.category) update(row.id, 'category', cat)
                  }}
                  inputClassName={inputCls + ' w-full'}
                />
              </div>
              <div className="flex-1 min-w-40">
                <Typeahead
                  value={row.category}
                  onChange={v => update(row.id, 'category', v)}
                  suggestions={categories}
                  placeholder="Category"
                  inputClassName={inputCls + ' w-full'}
                />
              </div>
              <select
                value={row.tag}
                onChange={e => update(row.id, 'tag', e.target.value as TransactionTag)}
                className={selectCls}
              >
                {TAGS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={addRow} className="text-sm text-indigo-400 hover:text-indigo-300">
          + Add row
        </button>
        <span className="text-xs text-gray-600">
          {valid.length} of {rows.length} row{rows.length !== 1 ? 's' : ''} ready
        </span>
        <button
          onClick={save}
          disabled={valid.length === 0 || mutation.isPending}
          className="ml-auto bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          {mutation.isPending ? 'Saving…' : `Save ${valid.length || ''} transaction${valid.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

// ── CSV import ────────────────────────────────────────────────────────────────

function CsvImport({ accounts, categories }: { accounts: Account[]; categories: string[] }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<CsvRow[]>([])
  const [parseError, setParseError] = useState('')
  const [saved, setSaved] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const mutation = useMutation({
    mutationFn: (entries: LedgerEntryCreate[]) => api.ledger.bulk(entries),
    onSuccess: (res) => {
      setSaved(res.created)
      setRows([])
      qc.invalidateQueries({ queryKey: ['ledger'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      qc.invalidateQueries({ queryKey: ['merchants'] })
      setTimeout(() => setSaved(0), 4000)
    },
  })

  function loadFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const { rows, error } = parseCsv(text, accounts)
      setRows(rows)
      setParseError(error ?? '')
    }
    reader.readAsText(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) loadFile(file)
  }

  function updateRow(id: string, field: keyof CsvRow, value: string | boolean | null) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function toggleAll(checked: boolean) {
    setRows(rs => rs.map(r => ({ ...r, include: checked })))
  }

  const selected = rows.filter(r => r.include)
  const unmatched = selected.filter(r => !r.accountId)
  const ready = selected.filter(r => r.accountId && r.merchant.trim() && r.category.trim())

  function doImport() {
    const entries: LedgerEntryCreate[] = ready.map(r => ({
      type: 'expense' as const,
      date: r.date,
      account_id: r.accountId!,
      amount: r.amount,
      merchant: r.merchant.trim(),
      category: r.category.trim(),
      tag: r.tag,
    }))
    mutation.mutate(entries)
  }

  const accountNames = accounts.map(a => a.name).sort()

  return (
    <div className="space-y-4">
      {saved > 0 && (
        <div className="px-4 py-3 bg-emerald-950 border border-emerald-800 rounded-xl text-emerald-400 text-sm">
          {saved} transaction{saved !== 1 ? 's' : ''} imported ✓
        </div>
      )}

      {/* Drop zone */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-indigo-500 bg-indigo-950/30' : 'border-gray-700 hover:border-gray-600'
          }`}
        >
          <div className="text-sm text-gray-400">
            Drop a CSV file here, or <span className="text-indigo-400">browse</span>
          </div>
          <div className="text-xs text-gray-600 mt-1 font-mono">account, date, amount, merchant, category[, tag]</div>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
        </div>

        {parseError && (
          <div className="text-xs text-red-400">{parseError}</div>
        )}

        {rows.length > 0 && !parseError && (
          <div className="text-xs text-gray-500">{rows.length} rows parsed</div>
        )}

        {/* Account name reference */}
        <div>
          <div className="text-xs text-gray-500 mb-1">Account names in this app (use exact spelling in your CSV):</div>
          <div className="flex flex-wrap gap-1.5">
            {accountNames.map(name => (
              <span key={name} className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 font-mono">{name}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Review table */}
      {rows.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="text-xs font-medium text-gray-300 uppercase tracking-wider">Review</div>
            <div className="flex items-center gap-3">
              <button onClick={() => toggleAll(true)} className="text-xs text-gray-500 hover:text-gray-300">Select all</button>
              <button onClick={() => toggleAll(false)} className="text-xs text-gray-500 hover:text-gray-300">Deselect all</button>
              <span className="text-xs text-gray-600">
                {selected.length} selected · {ready.length} ready
                {unmatched.length > 0 && <span className="text-amber-400 ml-1">· {unmatched.length} unmatched account{unmatched.length !== 1 ? 's' : ''}</span>}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-[auto_1fr_80px_70px_1fr_1fr_90px] gap-2 px-4 py-2 border-b border-gray-800 text-xs text-gray-500">
            <div />
            <div>Account</div>
            <div>Date</div>
            <div>Amount</div>
            <div>Merchant</div>
            <div>Category</div>
            <div>Tag</div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-800/60">
            {rows.map(row => (
              <div
                key={row.id}
                className={`grid grid-cols-[auto_1fr_80px_70px_1fr_1fr_90px] gap-2 px-4 py-2 items-start transition-colors ${
                  row.include ? '' : 'opacity-40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={row.include}
                  onChange={e => updateRow(row.id, 'include', e.target.checked)}
                  className="mt-2 accent-indigo-500"
                />
                <div className="mt-1.5">
                  {row.accountId
                    ? <span className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300">{row.accountRaw}</span>
                    : <span className="px-1.5 py-0.5 bg-amber-950 border border-amber-800 rounded text-xs text-amber-400" title="No account matches this name">{row.accountRaw || '—'}</span>
                  }
                </div>
                <div className="text-xs text-gray-400 font-mono mt-2">{row.date.slice(5)}</div>
                <div className="text-xs font-mono text-white mt-2">${row.amount.toFixed(2)}</div>
                <input
                  type="text"
                  value={row.merchant}
                  onChange={e => updateRow(row.id, 'merchant', e.target.value)}
                  className={inputCls + ' w-full text-xs'}
                />
                <Typeahead
                  value={row.category}
                  onChange={v => updateRow(row.id, 'category', v)}
                  suggestions={categories}
                  placeholder="Category"
                  inputClassName={inputCls + ' w-full text-xs'}
                />
                <select
                  value={row.tag}
                  onChange={e => updateRow(row.id, 'tag', e.target.value as TransactionTag)}
                  className={selectCls + ' w-full text-xs'}
                >
                  {TAGS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex items-center justify-end gap-3">
          {mutation.isError && (
            <span className="text-sm text-red-400">Import failed — try again.</span>
          )}
          <button
            onClick={doImport}
            disabled={ready.length === 0 || mutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {mutation.isPending ? 'Importing…' : `Import ${ready.length} transaction${ready.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [tab, setTab] = useState<'manual' | 'csv'>('manual')

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.categories(),
  })

  const tabCls = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      active ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
    }`

  return (
    <PageShell>
      <div className="flex justify-end gap-2">
        <button className={tabCls(tab === 'manual')} onClick={() => setTab('manual')}>Manual Entry</button>
        <button className={tabCls(tab === 'csv')} onClick={() => setTab('csv')}>CSV Import</button>
      </div>

      {tab === 'manual'
        ? <ManualBatchEntry accounts={accounts} categories={categories} />
        : <CsvImport accounts={accounts} categories={categories} />
      }
    </PageShell>
  )
}
