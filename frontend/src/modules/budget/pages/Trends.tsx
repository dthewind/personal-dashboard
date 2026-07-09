import { useState, useMemo } from 'react'
import PageShell from '../components/PageShell'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  Tooltip,
  ResponsiveContainer,
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

// ── Tooltips ──────────────────────────────────────────────────────────────────

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
  active?: boolean; payload?: { name: string; value: number }[]; label?: string
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
  active?: boolean; payload?: { value: number }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-gray-300 text-xs mb-0.5">{label}</p>
      <p className="text-white font-mono text-sm font-semibold">{fmt(payload[0].value)}</p>
    </div>
  )
}

function DeltaTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number; payload: { current: number; prev: number } }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      <div className="flex justify-between gap-4">
        <span className="text-gray-400">This month</span>
        <span className="font-mono text-white">{fmt(p.payload.current)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-400">Prior month</span>
        <span className="font-mono text-white">{fmt(p.payload.prev)}</span>
      </div>
      <div className={`flex justify-between gap-4 border-t border-gray-700 pt-1 mt-1 ${p.value > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
        <span>Change</span>
        <span className="font-mono">{p.value > 0 ? '+' : ''}{p.value.toFixed(1)}%</span>
      </div>
    </div>
  )
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-gray-300">{payload[0].name}</p>
      <p className="text-white font-mono font-semibold">{fmt(payload[0].value)}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

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

  // ── Monthly overview ────────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const expByMonth: Record<string, number> = {}
    const incByMonth: Record<string, number> = {}
    for (const e of visibleEntries) {
      const m = e.date.slice(0, 7)
      expByMonth[m] = (expByMonth[m] ?? 0) + e.amount
    }
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

  // ── Stacked area: top N categories by month ─────────────────────────────────
  const { stackedAreaData, topCategories } = useMemo(() => {
    const catByMonth: Record<string, Record<string, number>> = {}
    const catTotals: Record<string, number> = {}
    for (const e of visibleEntries) {
      const m = e.date.slice(0, 7)
      const cat = e.category ?? 'Uncategorized'
      catByMonth[m] = catByMonth[m] ?? {}
      catByMonth[m][cat] = (catByMonth[m][cat] ?? 0) + e.amount
      catTotals[cat] = (catTotals[cat] ?? 0) + e.amount
    }
    const top = Object.entries(catTotals).sort(([, a], [, b]) => b - a).slice(0, 8).map(([c]) => c)
    const months = Object.keys(catByMonth).sort()
    const data = months.map(m => {
      const row: Record<string, number | string> = { label: shortMonth(m) }
      for (const cat of top) row[cat] = catByMonth[m]?.[cat] ?? 0
      return row
    })
    return { stackedAreaData: data, topCategories: top }
  }, [visibleEntries])

  // ── MoM category delta ──────────────────────────────────────────────────────
  const momDelta = useMemo(() => {
    if (monthlyData.length < 2) return []
    const last = monthlyData[monthlyData.length - 1]
    const prev = monthlyData[monthlyData.length - 2]

    const catLast: Record<string, number> = {}
    const catPrev: Record<string, number> = {}
    for (const e of visibleEntries) {
      const cat = e.category ?? 'Uncategorized'
      if (e.date.slice(0, 7) === last.month) catLast[cat] = (catLast[cat] ?? 0) + e.amount
      if (e.date.slice(0, 7) === prev.month) catPrev[cat] = (catPrev[cat] ?? 0) + e.amount
    }

    const allCats = new Set([...Object.keys(catLast), ...Object.keys(catPrev)])
    return Array.from(allCats)
      .map(cat => {
        const cur = catLast[cat] ?? 0
        const pr = catPrev[cat] ?? 0
        const pctChange = pr > 0 ? ((cur - pr) / pr) * 100 : cur > 0 ? 100 : 0
        const dollarDelta = cur - pr
        return { name: cat, pctChange, dollarDelta, current: cur, prev: pr }
      })
      .filter(d => Math.abs(d.dollarDelta) >= 10)
      .sort((a, b) => Math.abs(b.dollarDelta) - Math.abs(a.dollarDelta))
      .slice(0, 12)
  }, [monthlyData, visibleEntries])

  // ── Fixed vs discretionary ───────────────────────────────────────────────────
  const fixedVsDiscretionary = useMemo(() => {
    let fixed = 0, variable = 0
    for (const e of visibleEntries) {
      if (e.bill_id) fixed += e.amount
      else variable += e.amount
    }
    return [
      { name: 'Fixed Bills', value: fixed },
      { name: 'Discretionary', value: variable },
    ].filter(d => d.value > 0)
  }, [visibleEntries])

  // ── Anomaly detection ────────────────────────────────────────────────────────
  const anomalies = useMemo(() => {
    if (monthlyData.length < 3) return []
    const latestMonth = monthlyData[monthlyData.length - 1].month

    // Build per-category monthly history
    const catHistory: Record<string, Record<string, number>> = {}
    for (const e of visibleEntries) {
      const cat = e.category ?? 'Uncategorized'
      const m = e.date.slice(0, 7)
      catHistory[cat] = catHistory[cat] ?? {}
      catHistory[cat][m] = (catHistory[cat][m] ?? 0) + e.amount
    }

    const results: { cat: string; current: number; avg: number; ratio: number }[] = []
    for (const [cat, byMonth] of Object.entries(catHistory)) {
      const current = byMonth[latestMonth] ?? 0
      if (current === 0) continue
      const priorMonths = Object.entries(byMonth)
        .filter(([m]) => m !== latestMonth)
        .map(([, v]) => v)
      if (priorMonths.length < 2) continue
      const avg = priorMonths.reduce((s, v) => s + v, 0) / priorMonths.length
      if (avg < 20) continue
      const ratio = current / avg
      if (ratio >= 1.5) results.push({ cat, current, avg, ratio })
    }
    return results.sort((a, b) => b.ratio - a.ratio).slice(0, 5)
  }, [visibleEntries, monthlyData])

  // ── Category spotlight ────────────────────────────────────────────────────────
  const spotlightData = useMemo(() => {
    if (!spotlightCat) return []
    const byMonth: Record<string, number> = {}
    for (const e of visibleEntries) {
      if ((e.category ?? '') !== spotlightCat) continue
      const m = e.date.slice(0, 7)
      byMonth[m] = (byMonth[m] ?? 0) + e.amount
    }
    return Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b))
      .map(([m, total]) => ({ label: shortMonth(m), total }))
  }, [visibleEntries, spotlightCat])

  // ── Aggregates ────────────────────────────────────────────────────────────────
  const byCat: Record<string, number> = {}
  for (const e of visibleEntries) {
    const cat = e.category ?? 'Uncategorized'
    byCat[cat] = (byCat[cat] ?? 0) + e.amount
  }
  const categoryData = Object.entries(byCat).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)

  const accountMap = Object.fromEntries((accounts ?? []).map(a => [a.id, a.name]))
  const byAcc: Record<string, number> = {}
  for (const e of visibleEntries) {
    const name = accountMap[e.account_id] ?? e.account_id
    byAcc[name] = (byAcc[name] ?? 0) + e.amount
  }
  const accountData = Object.entries(byAcc).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)

  const total = visibleEntries.reduce((s, e) => s + e.amount, 0)
  const count = visibleEntries.length
  const latestLabel = monthlyData.length > 0 ? shortMonth(monthlyData[monthlyData.length - 1].month) : ''
  const prevLabel = monthlyData.length > 1 ? shortMonth(monthlyData[monthlyData.length - 2].month) : ''

  return (
    <PageShell>
      <div className="flex justify-end">
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {!expenses && <div className="text-gray-500 text-sm">Loading…</div>}

      {expenses && (
        <>
          {/* KPI bar */}
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
              <div className="text-2xl font-bold font-mono text-white">{count > 0 ? fmt(total / count) : '—'}</div>
            </div>
          </div>

          {count === 0 && (
            <div className="text-center text-gray-500 text-sm py-12">No transactions for this period.</div>
          )}

          {/* Anomaly callouts */}
          {anomalies.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-300 uppercase tracking-wider">Spending Alerts</div>
              {anomalies.map(a => (
                <div key={a.cat} className="bg-amber-950/25 border border-amber-800/40 rounded-xl px-4 py-3 flex justify-between items-center">
                  <div>
                    <span className="text-sm text-amber-300 font-medium">{a.cat}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {fmt(a.current)} this month vs {fmt(Math.round(a.avg))} avg
                    </span>
                  </div>
                  <span className="text-amber-400 font-mono text-sm font-semibold">{a.ratio.toFixed(1)}×</span>
                </div>
              ))}
            </div>
          )}

          {/* Monthly Overview */}
          {monthlyData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-xs font-medium text-gray-300 uppercase tracking-wider mb-5">Income vs Spend</h2>
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

          {/* MoM Delta */}
          {momDelta.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-xs font-medium text-gray-300 uppercase tracking-wider mb-1">
                Category Change
              </h2>
              <p className="text-xs text-gray-600 mb-4">{latestLabel} vs {prevLabel} · sorted by dollar impact</p>
              <ResponsiveContainer width="100%" height={Math.max(160, momDelta.length * 34)}>
                <BarChart data={momDelta} layout="vertical" margin={{ left: 0, right: 60, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}%`} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<DeltaTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="pctChange" radius={[0, 4, 4, 0]}
                    label={{ position: 'right', fill: '#6b7280', fontSize: 10, formatter: (v: unknown) => `${(v as number) > 0 ? '+' : ''}${Math.round(v as number)}%` }}>
                    {momDelta.map((d, i) => (
                      <Cell key={i} fill={d.pctChange > 0 ? '#ef4444' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Stacked area */}
          {stackedAreaData.length > 1 && topCategories.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-xs font-medium text-gray-300 uppercase tracking-wider mb-5">
                Category Composition Over Time
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={stackedAreaData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} width={40} />
                  <Tooltip formatter={(value: unknown) => fmt(value as number)} contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }} />
                  <Legend wrapperStyle={{ fontSize: '10px', color: '#6b7280', paddingTop: '8px' }} />
                  {topCategories.map((cat, i) => (
                    <Area
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      stackId="1"
                      stroke={PALETTE[i % PALETTE.length]}
                      fill={PALETTE[i % PALETTE.length]}
                      fillOpacity={0.7}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Fixed vs Discretionary */}
          {fixedVsDiscretionary.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-xs font-medium text-gray-300 uppercase tracking-wider mb-5">
                Fixed vs Discretionary
              </h2>
              <div className="flex items-center gap-8">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={fixedVsDiscretionary}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {fixedVsDiscretionary.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? '#6366f1' : '#10b981'} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 flex-1">
                  {fixedVsDiscretionary.map((d, i) => {
                    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
                    return (
                      <div key={d.name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: i === 0 ? '#6366f1' : '#10b981' }} />
                            {d.name}
                          </span>
                          <span className="font-mono text-white">{fmt(d.value)} <span className="text-gray-500 text-xs">{pct}%</span></span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: i === 0 ? '#6366f1' : '#10b981' }} />
                        </div>
                      </div>
                    )
                  })}
                  <div className="text-xs text-gray-600 mt-1">
                    Lower fixed % = more resilient spending profile
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Category Spotlight */}
          {categoryData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xs font-medium text-gray-300 uppercase tracking-wider">Category Spotlight</h2>
                <select
                  value={spotlightCat}
                  onChange={e => setSpotlightCat(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Pick a category…</option>
                  {categoryData.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
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
                  {spotlightCat ? 'No spending in this category for the selected period.' : 'Select a category to see month-by-month spending.'}
                </div>
              )}
            </div>
          )}

          {/* By Category */}
          {categoryData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-xs font-medium text-gray-300 uppercase tracking-wider mb-5">By Category</h2>
              <ResponsiveContainer width="100%" height={Math.max(180, categoryData.length * 38)}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 0, right: 60, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={130}
                    tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}
                    label={{ position: 'right', fill: '#6b7280', fontSize: 11, formatter: (v: unknown) => fmt(v as number) }}>
                    {categoryData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* By Account */}
          {accountData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-xs font-medium text-gray-300 uppercase tracking-wider mb-4">By Account</h2>
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
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
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
