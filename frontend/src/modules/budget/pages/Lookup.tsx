import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-1 text-xs ${active ? 'text-indigo-400' : 'text-gray-600'}`}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  )
}

interface CategoryStat { name: string; count: number; total: number }
interface MerchantStat { id: string; name: string; default_category: string | null; count: number }

type CatSortKey = 'name' | 'count' | 'total'
type MerchSortKey = 'name' | 'count' | 'default_category'

const inputCls = 'bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500'

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

  // ── Category state ────────────────────────────────────────────────────────
  const [catFilter, setCatFilter] = useState('')
  const [catSort, setCatSort] = useState<CatSortKey>('name')
  const [catDir, setCatDir] = useState<SortDir>('asc')
  const [renamingCat, setRenamingCat] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

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
    },
  })

  // ── Merchant state ────────────────────────────────────────────────────────
  const [merchFilter, setMerchFilter] = useState('')
  const [merchSort, setMerchSort] = useState<MerchSortKey>('name')
  const [merchDir, setMerchDir] = useState<SortDir>('asc')
  const [editingMerchant, setEditingMerchant] = useState<MerchantStat | null>(null)
  const [editName, setEditName] = useState('')
  const [editCat, setEditCat] = useState('')
  const [deletingMerchant, setDeletingMerchant] = useState<MerchantStat | null>(null)

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

  return (
    <div className="space-y-8">

      {/* ── Categories ─────────────────────────────────────────────────────── */}
      <div>
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
                <th className="px-3 py-2 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredCats.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-500 text-sm">No categories yet</td></tr>
              ) : filteredCats.map(c => (
                renamingCat === c.name ? (
                  <tr key={c.name} className="bg-gray-800/60">
                    <td className={tdCls} colSpan={3}>
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
                ) : (
                  <tr key={c.name} className="hover:bg-gray-800/50 group">
                    <td className={tdCls + ' font-medium text-white'}>{c.name}</td>
                    <td className={tdCls + ' text-right tabular-nums'}>{c.count}</td>
                    <td className={tdCls + ' text-right tabular-nums'}>${c.total.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => { setRenamingCat(c.name); setRenameValue(c.name) }}
                        className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-indigo-400 transition-opacity"
                        title="Rename"
                      >
                        Rename
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-xs text-gray-600">Renaming updates all transactions with that category. Typing an existing category name merges them.</p>
      </div>

      {/* ── Merchants ──────────────────────────────────────────────────────── */}
      <div>
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
                  <tr key={m.id} className="hover:bg-gray-800/50 group">
                    <td className={tdCls + ' font-medium text-white'}>{m.name}</td>
                    <td className={tdCls}>
                      {m.default_category
                        ? <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300">{m.default_category}</span>
                        : <span className="text-gray-600">—</span>
                      }
                    </td>
                    <td className={tdCls + ' text-right tabular-nums'}>{m.count}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-xs text-gray-600">Editing a merchant name also updates the name on all linked transactions. Deleting only removes the merchant record.</p>
      </div>

    </div>
  )
}
