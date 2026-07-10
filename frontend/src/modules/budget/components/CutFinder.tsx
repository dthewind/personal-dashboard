import { useMemo, useState } from 'react'
import { fmt, todayStr } from '../utils'
import type { LedgerEntry } from '../types'

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function labelOf(m: string): string {
  const [yr, mo] = m.split('-')
  return `${MONTH_SHORT[parseInt(mo) - 1]} '${yr.slice(2)}`
}

interface CatRow {
  name: string
  avg: number
  best: number
  bestLabel: string
  trimAnnual: number
  merchants: { name: string; total: number; count: number }[]
}

interface BillRow {
  name: string
  avg: number
  annual: number
  creeping: boolean
}

export default function CutFinder({ entries }: { entries: LedgerEntry[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const { rows, billRows, monthsCount, totalTrim, fixedMonthly } = useMemo(() => {
    // only complete months — the current partial month would fake a "best month"
    const currentMonth = todayStr().slice(0, 7)
    const past = entries.filter(e => e.date.slice(0, 7) < currentMonth)
    const months = Array.from(new Set(past.map(e => e.date.slice(0, 7)))).sort()
    const M = months.length
    if (M < 3) {
      return { rows: [] as CatRow[], billRows: [] as BillRow[], monthsCount: M, totalTrim: 0, fixedMonthly: 0 }
    }

    // ── variable spending by category ──
    const catMonth: Record<string, Record<string, number>> = {}
    const catMerch: Record<string, Record<string, { total: number; count: number }>> = {}
    for (const e of past) {
      if (e.bill_id) continue
      const cat = e.category ?? 'Uncategorized'
      const m = e.date.slice(0, 7)
      catMonth[cat] = catMonth[cat] ?? {}
      catMonth[cat][m] = (catMonth[cat][m] ?? 0) + e.amount
      const mer = e.merchant ?? '—'
      catMerch[cat] = catMerch[cat] ?? {}
      const cur = catMerch[cat][mer] ?? { total: 0, count: 0 }
      catMerch[cat][mer] = { total: cur.total + e.amount, count: cur.count + 1 }
    }

    const rows: CatRow[] = Object.entries(catMonth)
      .map(([cat, byM]) => {
        const totals = Object.values(byM)
        const total = totals.reduce((s, v) => s + v, 0)
        const avg = total / M
        const best = Math.min(...totals)  // cheapest month that had any spend
        const bestMonth = Object.entries(byM).find(([, v]) => v === best)?.[0] ?? ''
        const trimAnnual = Math.max(0, avg - best) * 12
        const merchants = Object.entries(catMerch[cat] ?? {})
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 6)
        return { name: cat, avg, best, bestLabel: labelOf(bestMonth), trimAnnual, merchants }
      })
      .filter(r => r.trimAnnual >= 60)  // ignore noise under $5/mo
      .sort((a, b) => b.trimAnnual - a.trimAnnual)
      .slice(0, 10)

    const totalTrim = rows.reduce((s, r) => s + r.trimAnnual, 0)

    // ── fixed bills ──
    const billAgg: Record<string, { total: number; byMonth: Record<string, number> }> = {}
    for (const e of past) {
      if (!e.bill_id) continue
      const name = e.merchant ?? e.category ?? 'Bill'
      billAgg[name] = billAgg[name] ?? { total: 0, byMonth: {} }
      billAgg[name].total += e.amount
      const m = e.date.slice(0, 7)
      billAgg[name].byMonth[m] = (billAgg[name].byMonth[m] ?? 0) + e.amount
    }
    const lastMonth = months[months.length - 1]
    const billRows: BillRow[] = Object.entries(billAgg)
      .map(([name, b]) => {
        const avg = b.total / M
        const last = b.byMonth[lastMonth] ?? 0
        return { name, avg, annual: avg * 12, creeping: avg > 0 && last > avg * 1.05 }
      })
      .sort((a, b) => b.avg - a.avg)
    const fixedMonthly = billRows.reduce((s, r) => s + r.avg, 0)

    return { rows, billRows, monthsCount: M, totalTrim, fixedMonthly }
  }, [entries])

  if (monthsCount < 3) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-xs font-medium text-white uppercase tracking-wider mb-2">Cut Finder</h2>
        <p className="text-sm text-gray-600">
          Needs at least 3 complete months in the selected range — widen the date range to find savings opportunities.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
        <h2 className="text-xs font-medium text-white uppercase tracking-wider">Cut Finder</h2>
        <span className="text-xs text-gray-600">{monthsCount} complete months · current month excluded</span>
      </div>

      {rows.length > 0 ? (
        <>
          <p className="text-sm text-gray-400 mb-4">
            Run every category at its cheapest month and you'd bank{' '}
            <span className="text-emerald-400 font-mono font-semibold">{fmt(totalTrim)}/yr</span>{' '}
            <span className="text-gray-600">({fmt(totalTrim / 12)}/mo)</span>
          </p>

          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 text-xs text-gray-600 pb-1 border-b border-gray-800">
              <div>Category</div>
              <div className="text-right w-20">Avg / mo</div>
              <div className="text-right w-24">Best month</div>
              <div className="text-right w-24">Save / yr</div>
            </div>
            {rows.map(r => (
              <div key={r.name}>
                <div
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center py-1.5 cursor-pointer hover:bg-gray-800/40 -mx-2 px-2 rounded"
                  onClick={() => setExpanded(expanded === r.name ? null : r.name)}
                >
                  <div className="text-sm text-gray-200 truncate">
                    <span className="mr-1.5 text-gray-600 text-xs">{expanded === r.name ? '▼' : '▶'}</span>
                    {r.name}
                  </div>
                  <div className="text-right font-mono text-sm text-gray-300 w-20">{fmt(r.avg)}</div>
                  <div className="text-right font-mono text-xs text-gray-500 w-24">
                    {fmt(r.best)} <span className="text-gray-700">{r.bestLabel}</span>
                  </div>
                  <div className="text-right font-mono text-sm font-semibold text-emerald-400 w-24">{fmt(r.trimAnnual)}</div>
                </div>
                {expanded === r.name && (
                  <div className="ml-6 mb-2 border-l border-gray-800 pl-3 py-1 space-y-0.5">
                    {r.merchants.map(m => (
                      <div key={m.name} className="flex justify-between text-xs">
                        <span className="text-gray-400 truncate">{m.name} <span className="text-gray-700">×{m.count}</span></span>
                        <span className="font-mono text-gray-300 ml-3 shrink-0">{fmt(m.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-600 mb-2">No meaningful variable-spend trim opportunities in this range — spending is already consistent.</p>
      )}

      {billRows.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-800">
          <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
            <h3 className="text-xs font-medium text-gray-300 uppercase tracking-wider">Recurring Bills</h3>
            <span className="text-xs text-gray-500">
              <span className="font-mono text-gray-300">{fmt(fixedMonthly)}/mo</span>
              <span className="text-gray-700"> · {fmt(fixedMonthly * 12)}/yr locked in</span>
            </span>
          </div>
          <div className="space-y-1">
            {billRows.map(b => (
              <div key={b.name} className="flex items-center justify-between py-1 text-sm">
                <span className="text-gray-400 truncate">
                  {b.name}
                  {b.creeping && (
                    <span className="ml-2 text-xs text-amber-400 bg-amber-950/40 border border-amber-800/50 rounded px-1.5 py-0.5">▲ creeping</span>
                  )}
                </span>
                <span className="font-mono text-gray-300 ml-3 shrink-0">
                  {fmt(b.avg)}<span className="text-gray-600 text-xs">/mo</span>
                  <span className="text-gray-600 text-xs ml-2">{fmt(b.annual)}/yr</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Every recurring bill you cancel is savings that repeats without willpower — the cheapest kind.
          </p>
        </div>
      )}
    </div>
  )
}
