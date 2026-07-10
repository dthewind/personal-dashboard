import { useState } from 'react'
import PageShell from '../components/PageShell'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { fmt, monthLabel, prevMonth, todayStr } from '../utils'
import type { MonthlySummary, OutlookMonth } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function weekdaysInMonth(monthIso: string): number {
  const [y, m] = monthIso.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  let count = 0
  for (let d = 1; d <= days; d++) {
    const dow = new Date(y, m - 1, d).getDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

function shortLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return `${d.toLocaleDateString('en-US', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`
}

// ── Plan hours modal ──────────────────────────────────────────────────────────

function PlanModal({
  month,
  initial,
  defaultRate,
  onClose,
}: {
  month: string
  initial: OutlookMonth | null
  defaultRate: number
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [hours, setHours] = useState(initial?.planned_hours != null ? String(initial.planned_hours) : '')
  const [rate, setRate] = useState(initial?.hourly_rate != null ? String(initial.hourly_rate) : String(defaultRate))
  const suggested = weekdaysInMonth(month) * 8

  const mutation = useMutation({
    mutationFn: () => {
      const planned_hours = parseFloat(hours)
      const hourly_rate = parseFloat(rate)
      return initial?.period_id
        ? api.income.periods.update(initial.period_id, { planned_hours, hourly_rate })
        : api.income.periods.create({
            work_month: prevMonth(month),  // July hours → August paycheck
            pay_month: month,
            planned_hours,
            hourly_rate,
          })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outlook'] })
      qc.invalidateQueries({ queryKey: ['income-periods'] })
      onClose()
    },
  })

  const valid = parseFloat(hours) > 0 && parseFloat(rate) > 0
  const inp = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-white font-semibold text-sm">
          Plan — paycheck {monthLabel(month)}
        </h3>
        <p className="text-xs text-gray-500">
          Hours worked in {monthLabel(prevMonth(month))}, paid in {monthLabel(month)}.
        </p>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Planned Hours</label>
          <input
            autoFocus
            type="number"
            step="1"
            min="0"
            value={hours}
            onChange={e => setHours(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && onClose()}
            placeholder={String(suggested)}
            className={inp}
          />
          <button
            onClick={() => setHours(String(suggested))}
            className="mt-1 text-xs text-indigo-400 hover:text-indigo-300"
          >
            {weekdaysInMonth(month)} weekdays × 8h = {suggested}h — use
          </button>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Hourly Rate</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={rate}
              onChange={e => setRate(e.target.value)}
              className={inp + ' pl-7'}
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm">
            Cancel
          </button>
          <button
            disabled={!valid || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium"
          >
            {mutation.isPending ? '…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Projection table ──────────────────────────────────────────────────────────

const PROJECTION_ROWS: { key: keyof OutlookMonth; label: string; neg?: boolean; strong?: boolean }[] = [
  { key: 'gross_income', label: 'Gross Income' },
  { key: 'net_income', label: 'Net Income', strong: true },
  { key: 'after_save', label: 'After Savings', strong: true },
  { key: 'fixed_bills_total', label: 'Fixed Bills', neg: true },
  { key: 'after_fixed', label: 'After Fixed', strong: true },
  { key: 'max_spend', label: 'Max Spend', neg: true },
]

function ProjectionTable({
  outlook,
  onPlan,
}: {
  outlook: OutlookMonth[]
  onPlan: (m: OutlookMonth) => void
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 overflow-x-auto">
      <h2 className="text-xs font-medium text-white uppercase tracking-wider mb-4">
        Forward Projection
      </h2>
      <table className="w-full min-w-[560px]">
        <thead>
          <tr>
            <th className="text-left text-xs text-gray-600 font-normal pb-2 pr-4" />
            {outlook.map(m => (
              <th key={m.month} className="text-right text-xs font-normal pb-2 px-2 min-w-24">
                <div className="text-gray-300 font-medium">{shortLabel(m.month)}</div>
                {m.has_plan ? (
                  <button
                    onClick={() => onPlan(m)}
                    className="text-gray-600 hover:text-indigo-400 font-mono text-[11px]"
                    title="Edit planned hours"
                  >
                    {m.planned_hours}h @ ${m.hourly_rate}
                  </button>
                ) : (
                  <button
                    onClick={() => onPlan(m)}
                    className="text-indigo-400 hover:text-indigo-300 text-[11px]"
                  >
                    + plan
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PROJECTION_ROWS.map(row => (
            <tr key={row.key} className="border-t border-gray-800/60">
              <td className={`py-1.5 pr-4 text-sm whitespace-nowrap ${row.strong ? 'text-white font-medium' : 'text-gray-400'}`}>
                {row.label}
              </td>
              {outlook.map(m => (
                <td key={m.month} className={`py-1.5 px-2 text-right font-mono text-sm ${
                  !m.has_plan ? 'text-gray-700' : row.neg ? 'text-red-400' : row.strong ? 'text-white' : 'text-gray-300'
                }`}>
                  {!m.has_plan ? '—' : row.neg ? `(${fmt(m[row.key] as number)})` : fmt(m[row.key] as number)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-gray-700">
            <td className="py-2 pr-4 text-sm font-semibold text-emerald-400 whitespace-nowrap">Potential Savings</td>
            {outlook.map(m => (
              <td key={m.month} className={`py-2 px-2 text-right font-mono text-sm font-semibold ${m.has_plan ? 'text-emerald-400' : 'text-gray-700'}`}>
                {m.has_plan ? fmt(m.potential_savings) : '—'}
              </td>
            ))}
          </tr>
          <tr className="border-t border-gray-800/60 bg-gray-800/20">
            <td className="py-2 pr-4 text-xs text-gray-500 whitespace-nowrap">Cumulative</td>
            {outlook.map(m => (
              <td key={m.month} className="py-2 px-2 text-right font-mono text-xs text-emerald-600">
                {fmt(m.cumulative_savings)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs text-gray-600">
        Assumes deductions carry forward and spending holds the daily-budget line. Click a month's hours to adjust the plan.
      </p>
    </div>
  )
}

// ── Plan vs Actual scorecard ──────────────────────────────────────────────────

function Scorecard({ annual }: { annual: MonthlySummary[] }) {
  const currentKey = todayStr().slice(0, 7)
  const past = annual.filter(m => m.month < currentKey)
  const current = annual.find(m => m.month === currentKey)

  if (past.length === 0 && !current) return null

  const ytdPotential = past.reduce((s, m) => s + m.potential_savings, 0)
  const ytdActual = past.reduce((s, m) => s + m.actual_savings, 0)
  const ytdCapture = ytdPotential > 0 ? (ytdActual / ytdPotential) * 100 : null

  function captureColor(pct: number | null) {
    if (pct == null) return 'text-gray-500'
    return pct >= 100 ? 'text-emerald-400' : pct >= 70 ? 'text-amber-400' : 'text-red-400'
  }

  function row(m: MonthlySummary, inProgress = false) {
    const capture = m.potential_savings > 0 ? (m.actual_savings / m.potential_savings) * 100 : null
    const diff = m.actual_savings - m.potential_savings
    return (
      <tr key={m.month} className={`border-t border-gray-800/60 ${inProgress ? 'opacity-60' : ''}`}>
        <td className="py-1.5 pr-3 text-sm text-gray-300 whitespace-nowrap">
          {shortLabel(m.month + '-01')}
          {inProgress && <span className="ml-1.5 text-xs text-gray-600">(in progress)</span>}
        </td>
        <td className="py-1.5 px-3 text-right font-mono text-sm text-gray-400">{fmt(m.potential_savings)}</td>
        <td className="py-1.5 px-3 text-right font-mono text-sm text-white">{fmt(m.actual_savings)}</td>
        <td className={`py-1.5 px-3 text-right font-mono text-sm ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {diff >= 0 ? '+' : ''}{fmt(diff)}
        </td>
        <td className="py-1.5 pl-3 w-36">
          {capture != null ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${capture >= 100 ? 'bg-emerald-500' : capture >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.max(0, Math.min(capture, 100))}%` }}
                />
              </div>
              <span className={`text-xs font-mono w-10 text-right ${captureColor(capture)}`}>
                {Math.round(capture)}%
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-600">—</span>
          )}
        </td>
      </tr>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 overflow-x-auto">
      <h2 className="text-xs font-medium text-white uppercase tracking-wider mb-1">
        Plan vs Actual
      </h2>
      <p className="text-xs text-gray-600 mb-4">
        Potential = what the plan said you'd bank · Actual = what you really banked after all spending
      </p>
      <table className="w-full min-w-[480px]">
        <thead>
          <tr className="text-xs text-gray-600">
            <th className="text-left font-normal pb-1 pr-3">Month</th>
            <th className="text-right font-normal pb-1 px-3">Potential</th>
            <th className="text-right font-normal pb-1 px-3">Actual</th>
            <th className="text-right font-normal pb-1 px-3">Δ</th>
            <th className="text-left font-normal pb-1 pl-3">Capture</th>
          </tr>
        </thead>
        <tbody>
          {past.map(m => row(m))}
          {current && row(current, true)}
          {past.length > 1 && (
            <tr className="border-t border-gray-700 bg-gray-800/20">
              <td className="py-2 pr-3 text-sm font-medium text-gray-300">YTD (complete months)</td>
              <td className="py-2 px-3 text-right font-mono text-sm text-gray-400">{fmt(ytdPotential)}</td>
              <td className="py-2 px-3 text-right font-mono text-sm font-semibold text-white">{fmt(ytdActual)}</td>
              <td className={`py-2 px-3 text-right font-mono text-sm ${ytdActual - ytdPotential >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {ytdActual - ytdPotential >= 0 ? '+' : ''}{fmt(ytdActual - ytdPotential)}
              </td>
              <td className={`py-2 pl-3 text-xs font-mono ${captureColor(ytdCapture)}`}>
                {ytdCapture != null ? `${Math.round(ytdCapture)}%` : '—'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Outlook() {
  const [planning, setPlanning] = useState<OutlookMonth | null>(null)

  const { data: outlook = [], isLoading } = useQuery({
    queryKey: ['outlook'],
    queryFn: () => api.outlook(),
  })

  const { data: annual = [] } = useQuery({
    queryKey: ['annual-summary'],
    queryFn: () => api.annualSummary(),
  })

  const { data: periods = [] } = useQuery({
    queryKey: ['income-periods'],
    queryFn: () => api.income.periods.list(),
  })

  if (isLoading) return <div className="text-gray-500 text-sm">Loading…</div>

  const defaultRate =
    periods[0]?.hourly_rate ?? outlook.find(m => m.has_plan)?.hourly_rate ?? 0

  const planned = outlook.filter(m => m.has_plan)
  const totalPotential = planned.reduce((s, m) => s + m.potential_savings, 0)
  const unplanned = outlook.filter(m => !m.has_plan).length
  const horizon = outlook.length > 0 ? shortLabel(outlook[outlook.length - 1].month) : ''

  return (
    <PageShell>
      {/* KPI bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">Potential savings through {horizon}</div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{fmt(totalPotential)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">Planned months</div>
          <div className="text-2xl font-bold font-mono text-white">
            {planned.length}<span className="text-gray-600 text-lg"> / {outlook.length}</span>
          </div>
          {unplanned > 0 && (
            <div className="text-xs text-amber-500 mt-0.5">{unplanned} month{unplanned !== 1 ? 's' : ''} need hours</div>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-400 mb-1">Avg potential / planned month</div>
          <div className="text-2xl font-bold font-mono text-white">
            {planned.length > 0 ? fmt(totalPotential / planned.length) : '—'}
          </div>
        </div>
      </div>

      <ProjectionTable outlook={outlook} onPlan={setPlanning} />

      <Scorecard annual={annual} />

      {planning && (
        <PlanModal
          month={planning.month}
          initial={planning.has_plan ? planning : null}
          defaultRate={defaultRate}
          onClose={() => setPlanning(null)}
        />
      )}
    </PageShell>
  )
}
