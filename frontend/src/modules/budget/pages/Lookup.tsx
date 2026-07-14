import { useState } from 'react'
import PageShell from '../components/PageShell'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { CategoryStat } from '../types'

type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-1 text-xs ${active ? 'text-indigo-400' : 'text-gray-600'}`}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  )
}

interface MerchantStat { id: string; name: string; default_category: string | null; count: number }
interface Transaction {
  id: string
  date: string
  amount: number
  merchant: string | null
  category: string | null
  account_id: string
}
interface Account { id: string; name: string }

type CatSortKey = 'name' | 'count' | 'total'
type MerchSortKey = 'name' | 'count' | 'default_category'

const inputCls = 'bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500'

function DrilldownPanel({ filter, accounts, colSpan = 4 }: { filter: { category?: string; merchant?: string }; accounts: Account[]; colSpan?: number }) {
  const params = new URLSearchParams({ type: 'expense', limit: '200' })
  if (filter.category) params.set('category', filter.category)
  if (filter.merchant) params.set('merchant', filter.merchant)

  const { data: txns = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['lookup-drilldown', filter],
    queryFn: () => fetch(`/api/budget/ledger?${params}`).then(r => r.json()),
  })

  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a.name]))

  if (isLoading) return (
    <tr><td colSpan={colSpan} className="px-4 py-3 bg-gray-950 text-xs text-gray-500">Loading…</td></tr>
  )
  if (txns.length === 0) return (
    <tr><td colSpan={colSpan} className="px-4 py-3 bg-gray-950 text-xs text-gray-500">No transactions found.</td></tr>
  )

  return (
    <tr>
      <td colSpan={colSpan} className="p-0 bg-gray-950 border-b border-gray-800">
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full">
            <tbody>
              {txns.map(t => (
                <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="pl-6 pr-2 py-1.5 text-xs text-gray-500 tabular-nums w-24">{t.date}</td>
                  <td className="px-2 py-1.5 text-xs text-gray-300">{t.merchant ?? '—'}</td>
                  <td className="px-2 py-1.5 text-xs text-gray-400">{accountMap[t.account_id] ?? '—'}</td>
                  <td className="px-2 py-1.5 text-xs text-right tabular-nums text-gray-300 pr-4">${Number(t.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  )
}

export default function LookupPage() {
  const qc = useQueryClient()

  const { data: cats = [] } = useQuery<CategoryStat[]>({
    queryKey: ['category-stats'],
    queryFn: () => fetch('/api/budget/category-stats').then(r => r.json()),
  })

  const { data: merch = [] } = useQuery<MerchantStat[]>({
    queryKey: ['merchant-stats'],
    queryFn: () => fetch('/api/budget/merchant-stats').then(r => r.json()),
  })

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => fetch('/api/budget/accounts').then(r => r.json()),
  })

  const [activeTab, setActiveTab] = useState<'categories' | 'merchants'>('categories')

  // ── Category state ────────────────────────────────────────────────────────
  const [catFilter, setCatFilter] = useState('')
  const [catSort, setCatSort] = useState<CatSortKey>('name')
  const [catDir, setCatDir] = useState<SortDir>('asc')
  const [renamingCat, setRenamingCat] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [targetEditing, setTargetEditing] = useState<string | null>(null)
  const [targetValue, setTargetValue] = useState('')

  const renameCategory = useMutation({
    mutationFn: ({ old_name, new_name }: { old_name: string; new_name: string }) =>
      fetch('/api/budget/categories/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_name, new_name }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category-stats'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      setRenamingCat(null)
      setExpandedCat(null)
    },
  })

  const updateCategoryRule = useMutation({
    mutationFn: ({ name, data }: { name: string; data: { exclude_from_spend?: boolean; exclude_from_trends?: boolean; monthly_target?: number | null } }) =>
      api.categoryRules.update(name, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['category-stats'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      setTargetEditing(null)
    },
  })

  function saveTarget(name: string) {
    const v = parseFloat(targetValue)
    updateCategoryRule.mutate({ name, data: { monthly_target: !isNaN(v) && v > 0 ? v : null } })
  }

  // ── Merchant state ────────────────────────────────────────────────────────
  const [merchFilter, setMerchFilter] = useState('')
  const [merchSort, setMerchSort] = useState<MerchSortKey>('name')
  const [merchDir, setMerchDir] = useState<SortDir>('asc')
  const [editingMerchant, setEditingMerchant] = useState<MerchantStat | null>(null)
  const [editName, setEditName] = useState('')
  const [editCat, setEditCat] = useState('')
  const [deletingMerchant, setDeletingMerchant] = useState<MerchantStat | null>(null)
  const [expandedMerch, setExpandedMerch] = useState<string | null>(null)

  const updateMerchant = useMutation({
    mutationFn: ({ id, name, default_category }: { id: string; name: string; default_category: string }) =>
      fetch(`/api/budget/merchants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, default_category: default_category || null }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merchant-stats'] })
      qc.invalidateQueries({ queryKey: ['merchants'] })
      setEditingMerchant(null)
    },
  })

  const deleteMerchant = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/budget/merchants/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merchant-stats'] })
      qc.invalidateQueries({ queryKey: ['merchants'] })
      setDeletingMerchant(null)
    },
  })

  // ── Sorting helpers ───────────────────────────────────────────────────────
  function toggleCat(key: CatSortKey) {
    if (catSort === key) setCatDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setCatSort(key); setCatDir('asc') }
  }

  function toggleMerch(key: MerchSortKey) {
    if (merchSort === key) setMerchDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setMerchSort(key); setMerchDir('asc') }
  }

  const filteredCats = cats
    .filter(c => c.name.toLowerCase().includes(catFilter.toLowerCase()))
    .sort((a, b) => {
      const mul = catDir === 'asc' ? 1 : -1
      if (catSort === 'name') return mul * a.name.localeCompare(b.name)
      if (catSort === 'count') return mul * (a.count - b.count)
      return mul * (a.total - b.total)
    })

  const filteredMerch = merch
    .filter(m =>
      m.name.toLowerCase().includes(merchFilter.toLowerCase()) ||
      (m.default_category ?? '').toLowerCase().includes(merchFilter.toLowerCase())
    )
    .sort((a, b) => {
      const mul = merchDir === 'asc' ? 1 : -1
      if (merchSort === 'name') return mul * a.name.localeCompare(b.name)
      if (merchSort === 'count') return mul * (a.count - b.count)
      return mul * (a.default_category ?? '').localeCompare(b.default_category ?? '')
    })

  const thCls = 'px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-white'
  const tdCls = 'px-3 py-2 text-sm text-gray-300'

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
    }`

  return (
    <PageShell gap="space-y-4">

      {/* ── Sub-tabs ───────────────────────────────────────────────────────── */}
      <div className="flex gap-1">
        <button className={tabCls(activeTab === 'categories')} onClick={() => setActiveTab('categories')}>Categories</button>
        <button className={tabCls(activeTab === 'merchants')} onClick={() => setActiveTab('merchants')}>Merchants</button>
      </div>

      {/* ── Categories ─────────────────────────────────────────────────────── */}
      {activeTab === 'categories' && <div>
        <div className="flex items-center gap-4 mb-3">
          <h2 className="text-lg font-semibold text-white">Categories</h2>
          <span className="text-xs text-gray-500">{filteredCats.length} of {cats.length}</span>
          <input
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            placeholder="Filter…"
            className="ml-auto bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-48"
          />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-800">
              <tr>
                <th className={thCls} onClick={() => toggleCat('name')}>
                  Category <SortIcon active={catSort === 'name'} dir={catDir} />
                </th>
                <th className={thCls + ' text-right'} onClick={() => toggleCat('count')}>
                  Transactions <SortIcon active={catSort === 'count'} dir={catDir} />
                </th>
                <th className={thCls + ' text-right'} onClick={() => toggleCat('total')}>
                  Total Spent <SortIcon active={catSort === 'total'} dir={catDir} />
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wide w-28" title="Monthly spending target — shown as a gauge on the Dashboard">Target/mo</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wide w-20" title="Exclude from budget waterfall spend">Budget</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wide w-20" title="Exclude from Trends charts">Trends</th>
                <th className="px-3 py-2 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredCats.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500 text-sm">No categories yet</td></tr>
              ) : filteredCats.map(c => (
                renamingCat === c.name ? (
                  <>
                    <tr key={c.name} className="bg-gray-800/60">
                      <td className={tdCls} colSpan={6}>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-xs">Rename "{c.name}" to:</span>
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && renameValue.trim()) renameCategory.mutate({ old_name: c.name, new_name: renameValue.trim() })
                              if (e.key === 'Escape') setRenamingCat(null)
                            }}
                            className={inputCls + ' w-48'}
                          />
                          <button
                            onClick={() => renameValue.trim() && renameCategory.mutate({ old_name: c.name, new_name: renameValue.trim() })}
                            disabled={!renameValue.trim() || renameCategory.isPending}
                            className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded px-2 py-1"
                          >
                            {renameCategory.isPending ? '…' : 'Save'}
                          </button>
                          <button onClick={() => setRenamingCat(null)} className="text-xs text-gray-400 hover:text-white">Cancel</button>
                        </div>
                      </td>
                      <td />
                    </tr>
                  </>
                ) : (
                  <>
                    <tr
                      key={c.name}
                      className={`hover:bg-gray-800/50 group cursor-pointer ${expandedCat === c.name ? 'bg-gray-800/40' : ''}`}
                      onClick={() => setExpandedCat(expandedCat === c.name ? null : c.name)}
                    >
                      <td className={tdCls + ' font-medium text-white'}>
                        <span className="mr-1.5 text-gray-600 text-xs">{expandedCat === c.name ? '▼' : '▶'}</span>
                        {c.name}
                      </td>
                      <td className={tdCls + ' text-right tabular-nums'}>{c.count}</td>
                      <td className={tdCls + ' text-right tabular-nums'}>${c.total.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                        {targetEditing === c.name ? (
                          <input
                            autoFocus
                            type="number"
                            step="1"
                            min="0"
                            value={targetValue}
                            onChange={e => setTargetValue(e.target.value)}
                            onBlur={() => saveTarget(c.name)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveTarget(c.name)
                              if (e.key === 'Escape') setTargetEditing(null)
                            }}
                            placeholder="none"
                            className={inputCls + ' w-20 text-right'}
                          />
                        ) : (
                          <button
                            onClick={() => { setTargetEditing(c.name); setTargetValue(c.monthly_target != null ? String(c.monthly_target) : '') }}
                            title="Set a monthly target for this category (blank to clear)"
                            className={`text-xs tabular-nums px-2 py-0.5 rounded border transition-colors ${
                              c.monthly_target != null
                                ? 'bg-indigo-950/40 border-indigo-800 text-indigo-300 hover:bg-indigo-950/70'
                                : 'bg-transparent border-gray-700 text-gray-600 hover:text-gray-400 hover:border-gray-500'
                            }`}
                          >
                            {c.monthly_target != null ? `$${c.monthly_target}` : 'set'}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => updateCategoryRule.mutate({ name: c.name, data: { exclude_from_spend: !c.exclude_from_spend } })}
                          title={c.exclude_from_spend ? 'Excluded from budget — click to include' : 'Included in budget — click to exclude'}
                          className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                            c.exclude_from_spend
                              ? 'bg-amber-900/30 border-amber-700 text-amber-400 hover:bg-amber-900/50'
                              : 'bg-transparent border-gray-700 text-gray-600 hover:text-gray-400 hover:border-gray-500'
                          }`}
                        >
                          {c.exclude_from_spend ? 'skip' : 'in'}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => updateCategoryRule.mutate({ name: c.name, data: { exclude_from_trends: !c.exclude_from_trends } })}
                          title={c.exclude_from_trends ? 'Hidden from Trends — click to show' : 'Shown in Trends — click to hide'}
                          className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                            c.exclude_from_trends
                              ? 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'
                              : 'bg-transparent border-gray-700 text-gray-600 hover:text-gray-400 hover:border-gray-500'
                          }`}
                        >
                          {c.exclude_from_trends ? 'hide' : 'in'}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { setRenamingCat(c.name); setRenameValue(c.name) }}
                          className="text-xs text-gray-500 hover:text-indigo-400 transition-colors"
                          title="Rename"
                        >
                          Rename
                        </button>
                      </td>
                    </tr>
                    {expandedCat === c.name && (
                      <DrilldownPanel filter={{ category: c.name }} accounts={accounts} colSpan={7} />
                    )}
                  </>
                )
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-xs text-gray-600">Click a row to see its transactions. Renaming updates all transactions with that category. Typing an existing category name merges them.</p>
      </div>}

      {/* ── Merchants ──────────────────────────────────────────────────────── */}
      {activeTab === 'merchants' && <div>
        <div className="flex items-center gap-4 mb-3">
          <h2 className="text-lg font-semibold text-white">Merchants</h2>
          <span className="text-xs text-gray-500">{filteredMerch.length} of {merch.length}</span>
          <input
            value={merchFilter}
            onChange={e => setMerchFilter(e.target.value)}
            placeholder="Filter name or category…"
            className="ml-auto bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-56"
          />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-gray-800">
              <tr>
                <th className={thCls} onClick={() => toggleMerch('name')}>
                  Merchant <SortIcon active={merchSort === 'name'} dir={merchDir} />
                </th>
                <th className={thCls} onClick={() => toggleMerch('default_category')}>
                  Default Category <SortIcon active={merchSort === 'default_category'} dir={merchDir} />
                </th>
                <th className={thCls + ' text-right'} onClick={() => toggleMerch('count')}>
                  Transactions <SortIcon active={merchSort === 'count'} dir={merchDir} />
                </th>
                <th className="px-3 py-2 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredMerch.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500 text-sm">No merchants yet</td></tr>
              ) : filteredMerch.map(m => {
                if (editingMerchant?.id === m.id) {
                  return (
                    <tr key={m.id} className="bg-gray-800/60">
                      <td className={tdCls}>
                        <input
                          autoFocus
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => e.key === 'Escape' && setEditingMerchant(null)}
                          className={inputCls + ' w-44'}
                        />
                      </td>
                      <td className={tdCls}>
                        <input
                          value={editCat}
                          onChange={e => setEditCat(e.target.value)}
                          placeholder="Category"
                          onKeyDown={e => {
                            if (e.key === 'Enter' && editName.trim()) updateMerchant.mutate({ id: m.id, name: editName.trim(), default_category: editCat.trim() })
                            if (e.key === 'Escape') setEditingMerchant(null)
                          }}
                          className={inputCls + ' w-40'}
                        />
                      </td>
                      <td className={tdCls + ' text-right tabular-nums'}>{m.count}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => editName.trim() && updateMerchant.mutate({ id: m.id, name: editName.trim(), default_category: editCat.trim() })}
                            disabled={!editName.trim() || updateMerchant.isPending}
                            className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded px-2 py-1"
                          >
                            {updateMerchant.isPending ? '…' : 'Save'}
                          </button>
                          <button onClick={() => setEditingMerchant(null)} className="text-xs text-gray-400 hover:text-white">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )
                }

                if (deletingMerchant?.id === m.id) {
                  return (
                    <tr key={m.id} className="bg-red-950/30">
                      <td className={tdCls} colSpan={3}>
                        <span className="text-red-400 text-xs">
                          {m.count > 0
                            ? `Delete "${m.name}"? The ${m.count} transaction${m.count !== 1 ? 's' : ''} will remain but lose the merchant link.`
                            : `Delete "${m.name}"?`
                          }
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => deleteMerchant.mutate(m.id)}
                            disabled={deleteMerchant.isPending}
                            className="text-xs bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white rounded px-2 py-1"
                          >
                            {deleteMerchant.isPending ? '…' : 'Delete'}
                          </button>
                          <button onClick={() => setDeletingMerchant(null)} className="text-xs text-gray-400 hover:text-white">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )
                }

                return (
                  <>
                    <tr
                      key={m.id}
                      className={`hover:bg-gray-800/50 group cursor-pointer ${expandedMerch === m.id ? 'bg-gray-800/40' : ''}`}
                      onClick={() => setExpandedMerch(expandedMerch === m.id ? null : m.id)}
                    >
                      <td className={tdCls + ' font-medium text-white'}>
                        <span className="mr-1.5 text-gray-600 text-xs">{expandedMerch === m.id ? '▼' : '▶'}</span>
                        {m.name}
                      </td>
                      <td className={tdCls}>
                        {m.default_category
                          ? <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300">{m.default_category}</span>
                          : <span className="text-gray-600">—</span>
                        }
                      </td>
                      <td className={tdCls + ' text-right tabular-nums'}>{m.count}</td>
                      <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setEditingMerchant(m); setEditName(m.name); setEditCat(m.default_category ?? '') }}
                            className="text-xs text-gray-400 hover:text-indigo-400"
                            title="Edit"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeletingMerchant(m)}
                            className="text-xs text-gray-400 hover:text-red-400"
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedMerch === m.id && (
                      <DrilldownPanel filter={{ merchant: m.name }} accounts={accounts} />
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-xs text-gray-600">Click a row to see its transactions. Editing a merchant name also updates the name on all linked transactions. Deleting only removes the merchant record.</p>
      </div>}

    </PageShell>
  )
}
