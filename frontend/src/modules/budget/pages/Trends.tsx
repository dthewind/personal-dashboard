import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { api } from '../api'
import { fmt } from '../utils'
import { DateRangePicker, defaultRange } from '../components/DateRangePicker'
import type { DateRange } from '../components/DateRangePicker'

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

export default function Trends() {
  const [range, setRange] = useState<DateRange>(defaultRange('this_year'))

  const { data: transactions } = useQuery({
    queryKey: ['transactions', range.start, range.end],
    queryFn: () => api.transactions.list({ start: range.start, end: range.end }),
    enabled: !!(range.start && range.end),
  })

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
  })

  // Aggregate by category
  const byCat: Record<string, number> = {}
  for (const t of transactions ?? []) {
    byCat[t.category] = (byCat[t.category] ?? 0) + t.amount
  }
  const categoryData = Object.entries(byCat)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)

  // Aggregate by account
  const accountMap = Object.fromEntries((accounts ?? []).map(a => [a.id, a.name]))
  const byAcc: Record<string, number> = {}
  for (const t of transactions ?? []) {
    const name = accountMap[t.account_id] ?? t.account_id
    byAcc[name] = (byAcc[name] ?? 0) + t.amount
  }
  const accountData = Object.entries(byAcc)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)

  const total = (transactions ?? []).reduce((s, t) => s + t.amount, 0)
  const count = transactions?.length ?? 0
  const avgPerTxn = count > 0 ? total / count : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-white">Trends</h1>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {!transactions && (
        <div className="text-gray-500 text-sm">Loading…</div>
      )}

      {transactions && (
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
    </div>
  )
}
