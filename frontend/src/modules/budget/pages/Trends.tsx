import { useState, useMemo } from 'react'
import PageShell from '../components/PageShell'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts'
import { api } from '../api'
import { fmt } from '../utils'
import { DateRangePicker, defaultRange } from '../components/DateRangePicker'
import type { DateRange } from '../components/DateRangePicker'

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function shortMonth(m: string): string {
  const [yr, mo] = m.split('-')
  return `${MONTH_SHORT[parseInt(mo) - 1]} '${yr.slice(2)}`
}

const PALETTE = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#84cc16',
  '#f97316', '#14b8a6', '#a78bfa', '#34d399',
]

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { name: string } }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-gray-300 text-xs">{payload[0].payload.name}</p>
      <p className="text-white font-mono text-sm font-semibold">{fmt(payload[0].value)}</p>
    </div>
  )
}

function MonthlyTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const income = payload.find(p => p.name === 'Income')?.value ?? 0
  const expense = payload.find(p => p.name === 'Spent')?.value ?? 0
  const saved = income - expense
  const rate = income > 0 ? Math.round((saved / income) * 100) : null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 shadow-xl space-y-1 text-xs">
      <div className="text-gray-400 font-medium mb-1.5">{label}</div>
      {income > 0 && (
        <div className="flex justify-between gap-6">
          <span className="text-emerald-400">Income</span>
          <span className="font-mono text-white">{fmt(income)}</span>
        </div>
      )}
      <div className="flex justify-between gap-6">
        <span className="text-indigo-400">Spent</span>
        <span className="font-mono text-white">{fmt(expense)}</span>
      </div>
      {income > 0 && (
        <div className="flex justify-between gap-6 border-t border-gray-700 pt-1 mt-1">
          <span className={saved >= 0 ? 'text-emerald-400' : 'text-red-400'}>Saved</span>
          <span className={`font-mono ${saved >= 0 ? 'text-white' : 'text-red-400'}`}>
            {fmt(saved)}{rate !== null ? ` (${rate}%)` : ''}
          </span>
        </div>
      )}
    </div>
  )
}

function SpotlightTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-gray-300 text-xs mb-0.5">{label}</p>
      <p className="text-white font-mono text-sm font-semibold">{fmt(payload[0].value)}</p>
    </div>
  )
}

export default function Trends() {
  const [range, setRange] = useState<DateRange>(defaultRange('this_year'))
  const [spotlightCat, setSpotlightCat] = useState('')

  const { data: expenses } = useQuery({
    queryKey: ['ledger', 'expense', range.start, range.end],
    queryFn: () => api.ledger.list({ start: range.start, end: range.end, type: 'expense' }),
    enabled: !!(range.start && range.end),
  })

  const { data: incomeEntries } = useQuery({
    queryKey: ['ledger', 'income', range.start, range.end],
    queryFn: () => api.ledger.list({ start: range.start, end: range.end, type: 'income' }),
    enabled: !!(range.start && range.end),
  })

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
  })

  const { data: catStats } = useQuery({
    queryKey: ['category-stats'],
    queryFn: () => fetch('/api/budget/category-stats').then(r => r.json()) as Promise<{ name: string; exclude_from_trends: boolean }[]>,
  })

  const hiddenCats = new Set((catStats ?? []).filter(c => c.exclude_from_trends).map(c => c.name))

  const visibleEntries = (expenses ?? []).filter(e => !hiddenCats.has(e.category ?? ''))

  // Monthly overview: expense + income grouped by month
  const monthlyData = useMemo(() => {
    const expByMonth: Record<string, number> = {}
    for (const e of visibleEntries) {
      const m = e.date.slice(0, 7)
      expByMonth[m] = (expByMonth[m] ?? 0) + e.amount
    }
    const incByMonth: Record<string, number> = {}
    for (const e of incomeEntries ?? []) {
      const m = e.date.slice(0, 7)
      incByMonth[m] = (incByMonth[m] ?? 0) + e.amount
    }
    const months = new Set([...Object.keys(expByMonth), ...Object.keys(incByMonth)])
    return Array.from(months).sort().map(m => ({
      month: m,
      label: shortMonth(m),
      expense: expByMonth[m] ?? 0,
      income: incByMonth[m] ?? 0,
    }))
  }, [visibleEntries, incomeEntries])

  // Category spotlight: selected category spend by month
  const spotlightData = useMemo(() => {
    if (!spotlightCat) return []
    const byMonth: Record<string, number> = {}
    for (const e of visibleEntries) {
      if ((e.category ?? '') !== spotlightCat) continue
      const m = e.date.slice(0, 7)
      byMonth[m] = (byMonth[m] ?? 0) + e.amount
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, total]) => ({ label: shortMonth(m), total }))
  }, [visibleEntries, spotlightCat])

  // Aggregate by category
  const byCat: Record<string, number> = {}
  for (const e of visibleEntries) {
    const cat = e.category ?? 'Uncategorized'
    byCat[cat] = (byCat[cat] ?? 0) + e.amount
  }
  const categoryData = Object.entries(byCat)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)

  // Aggregate by account
  const accountMap = Object.fromEntries((accounts ?? []).map(a => [a.id, a.name]))
  const byAcc: Record<string, number> = {}
  for (const e of visibleEntries) {
    const name = accountMap[e.account_id] ?? e.account_id
    byAcc[name] = (byAcc[name] ?? 0) + e.amount
  }
  const accountData = Object.entries(byAcc)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)

  const total = visibleEntries.reduce((s, e) => s + e.amount, 0)
  const count = visibleEntries.length
  const avgPerTxn = count > 0 ? total / count : 0

  return (
    <PageShell>
      <div className="flex justify-end">
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {!expenses && (
        <div className="text-gray-500 text-sm">Loading…</div>
      )}

      {expenses && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-400 mb-1">Total Spent</div>
              <div className="text-2xl font-bold font-mono text-white">{fmt(total)}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-400 mb-1">Transactions</div>
              <div className="text-2xl font-bold text-white">{count}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-400 mb-1">Avg / Txn</div>
              <div className="text-2xl font-bold font-mono text-white">
                {count > 0 ? fmt(avgPerTxn) : '—'}
              </div>
            </div>
          </div>

          {count === 0 && (
            <div className="text-center text-gray-500 text-sm py-12">
              No transactions for this period.
            </div>
          )}

          {/* Monthly Overview */}
          {monthlyData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-5">
                Monthly Overview
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} width={40} />
                  <Tooltip content={<MonthlyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#6b7280', paddingTop: '12px' }} />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expense" name="Spent" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category Spotlight */}
          {categoryData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Category Spotlight
                </h2>
                <select
                  value={spotlightCat}
                  onChange={e => setSpotlightCat(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Pick a category…</option>
                  {categoryData.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              {spotlightCat && spotlightData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={spotlightData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={(v: number) => `$${v}`} width={50} />
                    <Tooltip content={<SpotlightTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="total" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-gray-600 text-sm py-8">
                  {spotlightCat
                    ? 'No spending in this category for the selected period.'
                    : 'Select a category to see month-by-month spending.'}
                </div>
              )}
            </div>
          )}

          {categoryData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-5">
                By Category
              </h2>
              <ResponsiveContainer width="100%" height={Math.max(180, categoryData.length * 38)}>
                <BarChart
                  data={categoryData}
                  layout="vertical"
                  margin={{ left: 0, right: 60, top: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={130}
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#6b7280', fontSize: 11, formatter: (v: unknown) => fmt(v as number) }}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {accountData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">
                By Account
              </h2>
              <div className="space-y-3">
                {accountData.map(({ name, amount }, i) => {
                  const pct = total > 0 ? (amount / total) * 100 : 0
                  return (
                    <div key={name}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-gray-300">{name}</span>
                        <div className="text-right">
                          <span className="text-white font-mono">{fmt(amount)}</span>
                          <span className="text-gray-500 text-xs ml-2">{Math.round(pct)}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  )
}
