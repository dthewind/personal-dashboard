import { useState, useMemo } from 'react'
import PageShell from '../components/PageShell'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { fmt, currentMonthStr, prevMonth, nextMonth, monthLabel, todayStr, toDateStr } from '../utils'
import type { Account, AccountCreate, AccountType, AutopayType, AllocationCreate, LedgerEntry, LedgerEntryCreate, IncomeType, MonthlySummary, PromoAprWindow, PromoAprWindowCreate, PromoAprWindowUpdate, WaterfallData } from '../types'

// ── Month navigation ──────────────────────────────────────────────────────────

function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const today = currentMonthStr()
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(prevMonth(month))}
        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 text-lg"
      >
        ‹
      </button>
      <span className="text-white font-medium min-w-36 text-center">{monthLabel(month)}</span>
      <button
        onClick={() => onChange(nextMonth(month))}
        disabled={month >= today}
        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-gray-800 text-lg disabled:opacity-30"
      >
        ›
      </button>
    </div>
  )
}

// ── Waterfall table ───────────────────────────────────────────────────────────

type DrilldownKey = 'income' | 'bills' | 'spent' | null

function WRow({
  label,
  amount,
  isTotal,
  indent,
  color,
  expandKey,
  expanded,
  onToggle,
}: {
  label: string
  amount: number
  isTotal?: boolean
  indent?: boolean
  color?: 'green' | 'red' | 'white'
  expandKey?: DrilldownKey
  expanded?: boolean
  onToggle?: () => void
}) {
  const textColor =
    color === 'green' ? 'text-emerald-400' : color === 'red' ? 'text-red-400' : 'text-white'
  const clickable = !!onToggle
  return (
    <div
      className={`flex justify-between items-center py-1.5 ${isTotal ? 'border-t border-gray-700 mt-1 pt-2.5' : ''} ${clickable ? 'cursor-pointer hover:bg-gray-800/40 -mx-2 px-2 rounded' : ''} ${expanded ? 'bg-gray-800/40 -mx-2 px-2 rounded' : ''}`}
      onClick={onToggle}
    >
      <span className={`text-sm ${indent ? 'pl-4 text-gray-400' : isTotal ? 'font-semibold text-white' : 'text-gray-300'}`}>
        {indent ? '─ ' : ''}{label}
        {expandKey && <span className="ml-1.5 text-gray-600 text-xs">{expanded ? '▼' : '▶'}</span>}
      </span>
      <span className={`text-sm font-mono ${isTotal ? 'font-semibold' : ''} ${textColor}`}>
        {color === 'red' ? `(${fmt(amount)})` : fmt(amount)}
      </span>
    </div>
  )
}

function WaterfallDrilldown({
  entries,
  accounts,
  emptyText,
}: {
  entries: LedgerEntry[]
  accounts: Account[]
  emptyText: string
}) {
  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a.name]))
  if (entries.length === 0) {
    return <div className="py-2 pl-4 text-xs text-gray-600">{emptyText}</div>
  }
  return (
    <div className="ml-4 mb-1 max-h-56 overflow-y-auto border-l border-gray-800">
      {entries.map(e => (
        <div key={e.id} className="flex items-center justify-between py-1 pl-3 pr-1 hover:bg-gray-800/30 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-gray-600 shrink-0">{e.date.slice(5)}</span>
            <span className="text-gray-300 truncate">{e.merchant ?? e.notes ?? '—'}</span>
            <span className="text-gray-600 shrink-0">{accountMap[e.account_id] ?? '—'}</span>
          </div>
          <span className="font-mono text-gray-300 shrink-0 ml-3">{fmt(e.amount)}</span>
        </div>
      ))}
    </div>
  )
}

function Waterfall({ w, month, monthEnd, accounts }: { w: WaterfallData; month: string; monthEnd: string; accounts: Account[] }) {
  const [expanded, setExpanded] = useState<DrilldownKey>(null)

  const { data: allExpenses } = useQuery({
    queryKey: ['ledger', 'expense', month, monthEnd],
    queryFn: () => api.ledger.list({ start: month, end: monthEnd, type: 'expense' }),
    enabled: expanded === 'spent' || expanded === 'bills',
  })

  const { data: incomeEntries } = useQuery({
    queryKey: ['ledger', 'income', month],
    queryFn: () => api.ledger.list({ start: month, end: monthEnd, type: 'income' }),
    enabled: expanded === 'income',
  })

  const { data: catStats } = useQuery({
    queryKey: ['category-stats'],
    queryFn: () => api.categoryStats(),
    enabled: expanded === 'spent',
  })

  function toggle(key: DrilldownKey) {
    setExpanded(prev => prev === key ? null : key)
  }

  // match the backend's spent_to_date: exclude bill payments AND excluded categories
  const excludedCats = new Set((catStats ?? []).filter(c => c.exclude_from_spend).map(c => c.name))
  const variableExpenses = (allExpenses ?? []).filter(e => !e.bill_id && !excludedCats.has(e.category ?? ''))
  const billExpenses = (allExpenses ?? []).filter(e => !!e.bill_id)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-xs font-medium text-white uppercase tracking-wider mb-3">Waterfall</h2>
      <WRow label="Gross Income" amount={w.gross_income} color="green"
        expandKey="income" expanded={expanded === 'income'} onToggle={() => toggle('income')} />
      {expanded === 'income' && <WaterfallDrilldown entries={incomeEntries ?? []} accounts={accounts} emptyText="No income entries this month." />}
      <WRow label="Federal Tax" amount={w.fed_tax} indent color="red" />
      <WRow label="State Tax" amount={w.state_tax} indent color="red" />
      <WRow label="SEP Contribution" amount={w.sep_contribution} indent color="red" />
      <WRow label="Net Income" amount={w.net_income} isTotal />
      <WRow label="Roth IRA" amount={w.roth_contribution} indent color="red" />
      <WRow label="After Savings" amount={w.after_save} isTotal />
      <WRow label="Fixed Bills" amount={w.fixed_bills_total} indent color="red"
        expandKey="bills" expanded={expanded === 'bills'} onToggle={() => toggle('bills')} />
      {expanded === 'bills' && <WaterfallDrilldown entries={billExpenses} accounts={accounts} emptyText="No bill payments this month." />}
      <WRow label="Max Spend" amount={w.max_spend} isTotal />
      <WRow label="Spent to Date" amount={w.spent_to_date} indent color="red"
        expandKey="spent" expanded={expanded === 'spent'} onToggle={() => toggle('spent')} />
      {expanded === 'spent' && <WaterfallDrilldown entries={variableExpenses} accounts={accounts} emptyText="No variable expenses this month." />}
      <WRow label="Remaining" amount={w.remaining} isTotal color={w.remaining < 0 ? 'red' : 'green'} />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function ordinal(n: number): string {
  const v = n % 100
  const suffix = (v >= 11 && v <= 13) ? 'th' : ['th','st','nd','rd'][Math.min(v % 10, 3)]
  return `${n}${suffix}`
}

const AUTOPAY_LABEL: Record<AutopayType, string> = { off: 'No autopay', minimum: 'Autopay min', full: 'Autopay full' }
const AUTOPAY_COLOR: Record<AutopayType, string> = { off: 'text-red-400', minimum: 'text-amber-400', full: 'text-emerald-400' }

// ── Account edit modal ────────────────────────────────────────────────────────

function AccountEditModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const qc = useQueryClient()
  const isCredit = account.type === 'credit_card'
  const [name, setName] = useState(account.name)
  const [reconcileTo, setReconcileTo] = useState(String(account.current_balance))
  const [limit, setLimit] = useState(String(account.credit_limit ?? ''))
  const [apr, setApr] = useState(String(account.apr ?? ''))
  const [stmtDay, setStmtDay] = useState(String(account.statement_close_day ?? ''))
  const [dueDay, setDueDay] = useState(String(account.due_day ?? ''))
  const [autopay, setAutopay] = useState<AutopayType | ''>(account.autopay ?? '')
  const [annualFee, setAnnualFee] = useState(String(account.annual_fee ?? ''))
  const [annualFeeMonth, setAnnualFeeMonth] = useState(String(account.annual_fee_month ?? ''))
  const [last4, setLast4] = useState(account.last_4 ?? '')

  const updateMutation = useMutation({
    mutationFn: () =>
      api.accounts.update(account.id, {
        name: name.trim() || account.name,
        reconcile_to: parseFloat(reconcileTo) || 0,
        ...(isCredit && {
          credit_limit: limit ? parseFloat(limit) : undefined,
          apr: apr ? parseFloat(apr) : undefined,
          statement_close_day: stmtDay ? parseInt(stmtDay) : undefined,
          due_day: dueDay ? parseInt(dueDay) : undefined,
          autopay: (autopay || undefined) as AutopayType | undefined,
          annual_fee: annualFee ? parseFloat(annualFee) : undefined,
          annual_fee_month: annualFeeMonth ? parseInt(annualFeeMonth) : undefined,
          last_4: last4.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      onClose()
    },
  })

  const inp = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500'
  const dollarInp = 'w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4 my-auto">
        <h3 className="text-white font-semibold text-sm">Edit Account</h3>
        <input autoFocus value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && onClose()} placeholder="Account name" className={inp} />
        <div>
          <label className="block text-xs text-gray-400 mb-1">Current Balance (reconcile)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" step="0.01" value={reconcileTo} onChange={e => setReconcileTo(e.target.value)} className={dollarInp} />
          </div>
          <p className="text-xs text-gray-600 mt-1">Enter the real-world balance to reconcile.</p>
        </div>
        {isCredit && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Credit Limit</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" step="0.01" value={limit} onChange={e => setLimit(e.target.value)} className={dollarInp} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">APR %</label>
                <input type="number" step="0.01" value={apr} onChange={e => setApr(e.target.value)} placeholder="e.g. 24.99" className={inp} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Statement Closes (day)</label>
                <input type="number" min="1" max="31" value={stmtDay} onChange={e => setStmtDay(e.target.value)} placeholder="1–31" className={inp} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Payment Due (day)</label>
                <input type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} placeholder="1–31" className={inp} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Autopay</label>
              <select value={autopay} onChange={e => setAutopay(e.target.value as AutopayType | '')} className={inp}>
                <option value="">— not set —</option>
                <option value="off">Off (manual payments)</option>
                <option value="minimum">Minimum payment</option>
                <option value="full">Full balance</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Annual Fee</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" step="0.01" value={annualFee} onChange={e => setAnnualFee(e.target.value)} placeholder="0.00" className={dollarInp} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Fee Month</label>
                <select value={annualFeeMonth} onChange={e => setAnnualFeeMonth(e.target.value)} className={inp}>
                  <option value="">—</option>
                  {MONTH_SHORT.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Last 4 Digits</label>
              <input value={last4} onChange={e => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234" maxLength={4} className={inp} />
            </div>
          </>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm">Cancel</button>
          <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium">
            {updateMutation.isPending ? '…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Account table rows ────────────────────────────────────────────────────────

function CreditAccountRow({ account, onEdit }: { account: Account; onEdit: () => void }) {
  const pct = account.credit_limit
    ? Math.min((account.current_balance / account.credit_limit) * 100, 100)
    : 0
  const barColor = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
  const available = account.credit_limit != null ? account.credit_limit - account.current_balance : null

  const meta = useMemo(() => {
    const parts: { text: string; cls: string }[] = []
    if (account.last_4) parts.push({ text: `···${account.last_4}`, cls: 'text-gray-600' })
    if (account.statement_close_day) parts.push({ text: `stmt ${ordinal(account.statement_close_day)}`, cls: 'text-gray-600' })
    if (account.due_day) parts.push({ text: `due ${ordinal(account.due_day)}`, cls: 'text-gray-600' })
    if (account.apr) parts.push({ text: `${account.apr}% APR`, cls: 'text-gray-600' })
    if (account.autopay) parts.push({ text: AUTOPAY_LABEL[account.autopay], cls: AUTOPAY_COLOR[account.autopay] })
    if (account.annual_fee) {
      const mo = account.annual_fee_month ? ` ${MONTH_SHORT[account.annual_fee_month - 1]}` : ''
      parts.push({ text: `$${account.annual_fee}/yr${mo}`, cls: 'text-gray-600' })
    }
    return parts
  }, [account])

  return (
    <tr className="group border-b border-gray-800/60 last:border-0 hover:bg-gray-800/30 transition-colors">
      <td className="py-2 px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-200">{account.name}</span>
          <button onClick={onEdit} className="text-xs text-gray-700 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
            edit
          </button>
        </div>
        {meta.length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
            {meta.map((m, i) => (
              <span key={i} className={`text-xs ${m.cls}`}>{m.text}</span>
            ))}
          </div>
        )}
      </td>
      <td className="py-2 px-4 text-right font-mono text-sm text-white align-top">{fmt(account.current_balance)}</td>
      <td className="py-2 px-4 text-right font-mono text-sm text-gray-500 align-top">{account.credit_limit ? fmt(account.credit_limit) : '—'}</td>
      <td className="py-2 px-4 text-right font-mono text-sm text-emerald-400 align-top">{available != null ? fmt(available) : '—'}</td>
      <td className="py-2 px-4 align-top">
        <div className="flex items-center gap-2 justify-end pt-0.5">
          <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-gray-500 w-8 text-right">{Math.round(pct)}%</span>
        </div>
      </td>
    </tr>
  )
}

function SimpleAccountRow({ account, onEdit }: { account: Account; onEdit: () => void }) {
  const balColor = account.type === 'investment' ? 'text-indigo-300' : 'text-emerald-400'
  return (
    <tr className="group border-b border-gray-800/60 last:border-0 hover:bg-gray-800/30 transition-colors">
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-200">{account.name}</span>
          <span className="text-xs text-gray-600 capitalize">{account.type}</span>
          <button onClick={onEdit} className="text-xs text-gray-700 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
            edit
          </button>
        </div>
      </td>
      <td className={`py-2.5 px-4 text-right font-mono text-sm ${balColor}`}>{fmt(account.current_balance)}</td>
    </tr>
  )
}

function CreditAccountSection({ accounts, onEdit }: { accounts: Account[]; onEdit: (a: Account) => void }) {
  const total = accounts.reduce((s, a) => s + a.current_balance, 0)
  const totalLimit = accounts.reduce((s, a) => s + (a.credit_limit ?? 0), 0)
  const totalAvail = totalLimit > 0 ? totalLimit - total : null
  const totalPct = totalLimit > 0 ? Math.min((total / totalLimit) * 100, 100) : 0
  const totalBarColor = totalPct > 80 ? 'bg-red-500' : totalPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-800 bg-gray-800/40">
        <span className="text-xs font-medium text-white uppercase tracking-wider">Credit Cards</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800/60">
            <th className="text-xs text-gray-600 font-normal py-1.5 px-4 text-left">Account</th>
            <th className="text-xs text-gray-600 font-normal py-1.5 px-4 text-right">Balance</th>
            <th className="text-xs text-gray-600 font-normal py-1.5 px-4 text-right">Limit</th>
            <th className="text-xs text-gray-600 font-normal py-1.5 px-4 text-right">Available</th>
            <th className="text-xs text-gray-600 font-normal py-1.5 px-4 text-right">Util</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(a => <CreditAccountRow key={a.id} account={a} onEdit={() => onEdit(a)} />)}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-700 bg-gray-800/20">
            <td className="py-2 px-4 text-xs text-gray-500 font-medium">Total</td>
            <td className="py-2 px-4 text-right font-mono text-sm font-semibold text-white">{fmt(total)}</td>
            <td className="py-2 px-4 text-right font-mono text-sm text-gray-500">{totalLimit > 0 ? fmt(totalLimit) : ''}</td>
            <td className="py-2 px-4 text-right font-mono text-sm text-emerald-400">{totalAvail != null ? fmt(totalAvail) : ''}</td>
            <td className="py-2 px-4">
              {totalLimit > 0 && (
                <div className="flex items-center gap-2 justify-end">
                  <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${totalBarColor}`} style={{ width: `${totalPct}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 font-medium w-8 text-right">{Math.round(totalPct)}%</span>
                </div>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function SimpleAccountSection({ label, accounts, onEdit }: { label: string; accounts: Account[]; onEdit: (a: Account) => void }) {
  const total = accounts.reduce((s, a) => s + a.current_balance, 0)
  const balColor = accounts[0]?.type === 'investment' ? 'text-indigo-300' : 'text-emerald-400'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-800 bg-gray-800/40">
        <span className="text-xs font-medium text-white uppercase tracking-wider">{label}</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800/60">
            <th className="text-xs text-gray-600 font-normal py-1.5 px-4 text-left">Account</th>
            <th className="text-xs text-gray-600 font-normal py-1.5 px-4 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(a => <SimpleAccountRow key={a.id} account={a} onEdit={() => onEdit(a)} />)}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-700 bg-gray-800/20">
            <td className="py-2 px-4 text-xs text-gray-500 font-medium">Total</td>
            <td className={`py-2 px-4 text-right font-mono text-sm font-semibold ${balColor}`}>{fmt(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function NetWorthSummary({ accounts }: { accounts: Account[] }) {
  const cash = accounts.filter(a => a.type === 'checking' || a.type === 'savings')
  const credit = accounts.filter(a => a.type === 'credit_card')
  const invest = accounts.filter(a => a.type === 'investment')
  const totalCash = cash.reduce((s, a) => s + a.current_balance, 0)
  const totalDebt = credit.reduce((s, a) => s + a.current_balance, 0)
  const totalInvest = invest.reduce((s, a) => s + a.current_balance, 0)
  const netWorth = totalCash + totalInvest - totalDebt

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-800 bg-gray-800/40">
        <span className="text-xs font-medium text-white uppercase tracking-wider">Net Worth</span>
      </div>
      <table className="w-full">
        <tbody>
          {cash.length > 0 && (
            <tr className="border-b border-gray-800/60">
              <td className="py-2 px-4 text-sm text-gray-400">Cash &amp; Savings</td>
              <td className="py-2 px-4 text-right font-mono text-sm text-emerald-400">{fmt(totalCash)}</td>
            </tr>
          )}
          {invest.length > 0 && (
            <tr className="border-b border-gray-800/60">
              <td className="py-2 px-4 text-sm text-gray-400">Investments</td>
              <td className="py-2 px-4 text-right font-mono text-sm text-indigo-300">{fmt(totalInvest)}</td>
            </tr>
          )}
          {credit.length > 0 && (
            <tr className="border-b border-gray-800/60">
              <td className="py-2 px-4 text-sm text-gray-400">Credit Card Debt</td>
              <td className="py-2 px-4 text-right font-mono text-sm text-red-400">({fmt(totalDebt)})</td>
            </tr>
          )}
          <tr className="bg-gray-800/20">
            <td className="py-2.5 px-4 text-sm font-semibold text-white">Net Worth</td>
            <td className={`py-2.5 px-4 text-right font-mono text-sm font-semibold ${netWorth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {netWorth < 0 ? `(${fmt(Math.abs(netWorth))})` : fmt(netWorth)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Add Account modal ─────────────────────────────────────────────────────────

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'investment', label: 'Investment' },
]

function AddAccountModal({ onClose, onSave }: { onClose: () => void; onSave: (d: AccountCreate) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('credit_card')
  const [limit, setLimit] = useState('')
  const [balance, setBalance] = useState('')
  const [apr, setApr] = useState('')
  const [stmtDay, setStmtDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [autopay, setAutopay] = useState<AutopayType | ''>('')
  const [annualFee, setAnnualFee] = useState('')
  const [annualFeeMonth, setAnnualFeeMonth] = useState('')
  const [last4, setLast4] = useState('')
  const isCredit = type === 'credit_card'
  const valid = name.trim()

  const inp = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500'
  const dollarInp = 'w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4 my-auto">
        <h3 className="text-white font-semibold">Add Account</h3>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Name</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Chase Visa" className={inp} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Type</label>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_TYPES.map(t => (
              <button key={t.value} onClick={() => setType(t.value)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${type === t.value ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Current Balance</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0.00" className={dollarInp} />
          </div>
          <p className="text-xs text-gray-600 mt-1">Your balance today — becomes the starting point.</p>
        </div>
        {isCredit && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Credit Limit</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" step="0.01" value={limit} onChange={e => setLimit(e.target.value)} placeholder="0.00" className={dollarInp} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">APR %</label>
                <input type="number" step="0.01" value={apr} onChange={e => setApr(e.target.value)} placeholder="e.g. 24.99" className={inp} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Statement Closes (day)</label>
                <input type="number" min="1" max="31" value={stmtDay} onChange={e => setStmtDay(e.target.value)} placeholder="1–31" className={inp} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Payment Due (day)</label>
                <input type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} placeholder="1–31" className={inp} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Autopay</label>
              <select value={autopay} onChange={e => setAutopay(e.target.value as AutopayType | '')} className={inp}>
                <option value="">— not set —</option>
                <option value="off">Off (manual payments)</option>
                <option value="minimum">Minimum payment</option>
                <option value="full">Full balance</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Annual Fee</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" step="0.01" value={annualFee} onChange={e => setAnnualFee(e.target.value)} placeholder="0.00" className={dollarInp} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Fee Month</label>
                <select value={annualFeeMonth} onChange={e => setAnnualFeeMonth(e.target.value)} className={inp}>
                  <option value="">—</option>
                  {MONTH_SHORT.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Last 4 Digits</label>
              <input value={last4} onChange={e => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234" maxLength={4} className={inp} />
            </div>
          </>
        )}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl py-2.5 text-sm">Cancel</button>
          <button
            disabled={!valid}
            onClick={() => onSave({
              name: name.trim(),
              type,
              opening_balance: balance ? parseFloat(balance) : undefined,
              ...(isCredit && {
                credit_limit: limit ? parseFloat(limit) : undefined,
                apr: apr ? parseFloat(apr) : undefined,
                statement_close_day: stmtDay ? parseInt(stmtDay) : undefined,
                due_day: dueDay ? parseInt(dueDay) : undefined,
                autopay: (autopay || undefined) as AutopayType | undefined,
                annual_fee: annualFee ? parseFloat(annualFee) : undefined,
                annual_fee_month: annualFeeMonth ? parseInt(annualFeeMonth) : undefined,
                last_4: last4 || undefined,
              }),
            })}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Income modal ──────────────────────────────────────────────────────────

const INCOME_TYPES: { value: IncomeType; label: string }[] = [
  { value: 'contract', label: 'Contract' },
  { value: 'interest', label: 'Interest' },
  { value: 'tbill', label: 'T-Bill' },
  { value: 'investment', label: 'Investment' },
  { value: 'other', label: 'Other' },
]

function AddIncomeModal({
  month,
  accounts,
  onClose,
  onSave,
}: {
  month: string
  accounts: Account[]
  onClose: () => void
  onSave: (d: LedgerEntryCreate) => void
}) {
  const depositAccounts = accounts.filter(a => a.type === 'checking' || a.type === 'savings')
  const [subtype, setSubtype] = useState<IncomeType>('contract')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(month.slice(0, 7) + '-01')
  const [accountId, setAccountId] = useState(depositAccounts[0]?.id ?? '')
  const valid = amount && parseFloat(amount) > 0 && description.trim() && accountId

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-white font-semibold">Add Income</h3>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Type</label>
          <div className="flex flex-wrap gap-2">
            {INCOME_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setSubtype(t.value)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  subtype === t.value ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Amount</label>
          <input
            autoFocus
            type="number"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Description</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. July contract hours"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Received Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Deposit Account</label>
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">— select —</option>
              {depositAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl py-2.5 text-sm">Cancel</button>
          <button
            disabled={!valid}
            onClick={() =>
              onSave({
                type: 'income',
                account_id: accountId,
                amount: parseFloat(amount),
                subtype,
                notes: description.trim(),
                date,
              })
            }
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Allocation inline editor ──────────────────────────────────────────────────

function AllocationSection({ month }: { month: string }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [fed, setFed] = useState('')
  const [state, setState] = useState('')
  const [sep, setSep] = useState('')
  const [roth, setRoth] = useState('')

  const { data: alloc } = useQuery({
    queryKey: ['allocation', month],
    queryFn: () => api.allocation.get(month),
  })

  function startEdit() {
    setFed(String(alloc?.fed_tax ?? 0))
    setState(String(alloc?.state_tax ?? 0))
    setSep(String(alloc?.sep_contribution ?? 0))
    setRoth(String(alloc?.roth_contribution ?? 0))
    setEditing(true)
  }

  const saveMutation = useMutation({
    mutationFn: (data: AllocationCreate) => api.allocation.upsert(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allocation', month] })
      qc.invalidateQueries({ queryKey: ['waterfall', month] })
      setEditing(false)
    },
  })

  function save() {
    saveMutation.mutate({
      pay_month: month,
      fed_tax: parseFloat(fed) || 0,
      state_tax: parseFloat(state) || 0,
      sep_contribution: parseFloat(sep) || 0,
      roth_contribution: parseFloat(roth) || 0,
    })
  }

  const inputCls =
    'w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xs font-medium text-white uppercase tracking-wider">
          Deductions &amp; Savings
        </h2>
        {!editing && (
          <button onClick={startEdit} className="text-xs text-indigo-400 hover:text-indigo-300">
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Federal Tax', val: fed, set: setFed },
              { label: 'State Tax', val: state, set: setState },
              { label: 'SEP Contribution', val: sep, set: setSep },
              { label: 'Roth IRA', val: roth, set: setRoth },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <input
                  type="number"
                  step="0.01"
                  value={val}
                  onChange={e => set(e.target.value)}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saveMutation.isPending}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Federal Tax', value: alloc?.fed_tax ?? 0 },
            { label: 'State Tax', value: alloc?.state_tax ?? 0 },
            { label: 'SEP', value: alloc?.sep_contribution ?? 0 },
            { label: 'Roth IRA', value: alloc?.roth_contribution ?? 0 },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-white font-mono text-sm mt-0.5">{fmt(value)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Promo APR Windows ─────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(dateStr + 'T00:00:00')
  return Math.round((end.getTime() - today.getTime()) / 86400000)
}

function PromoWindowCard({
  window: w,
  accountName,
  onEdit,
}: {
  window: PromoAprWindow
  accountName: string
  onEdit: () => void
}) {
  const days = daysUntil(w.promo_end_date)
  const deadlineColor = days < 90 ? 'text-red-400' : days < 180 ? 'text-amber-400' : 'text-gray-400'
  const pct = w.original_amount && w.original_amount > 0
    ? Math.max(0, Math.min(100, ((w.original_amount - w.balance_amount) / w.original_amount) * 100))
    : null
  const monthsLeft = days / 30.44
  const monthsToPayoff = w.required_monthly_payment && w.required_monthly_payment > 0
    ? w.balance_amount / w.required_monthly_payment
    : null
  const payoffBehind = monthsToPayoff !== null && monthsToPayoff > monthsLeft

  return (
    <div
      className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3 cursor-pointer hover:border-gray-700 transition-colors"
      onClick={onEdit}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="text-xs text-indigo-400 font-medium truncate">{accountName}</div>
          <div className="text-sm text-gray-200 mt-0.5">{w.description}</div>
        </div>
        <div className={`text-xs font-mono flex-shrink-0 ${deadlineColor}`}>
          {days > 0 ? `${days}d` : 'expired'}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-baseline">
          <span className="text-lg font-mono font-semibold text-white">{fmt(w.balance_amount)}</span>
          {w.original_amount && (
            <span className="text-xs text-gray-500">of {fmt(w.original_amount)}</span>
          )}
        </div>
        {pct !== null && (
          <div className="mt-1.5">
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-xs text-gray-600 mt-0.5">{Math.round(pct)}% paid off</div>
          </div>
        )}
      </div>

      {w.required_monthly_payment && (
        <div className={`text-xs flex items-center gap-1.5 ${payoffBehind ? 'text-red-400' : 'text-gray-400'}`}>
          <span>Required: {fmt(w.required_monthly_payment)}/mo</span>
          {monthsToPayoff !== null && (
            <>
              <span className="text-gray-700">·</span>
              <span>payoff in {Math.ceil(monthsToPayoff)} mo{payoffBehind ? ' ⚠' : ''}</span>
            </>
          )}
        </div>
      )}

      <div className="text-xs text-gray-600">
        Expires {new Date(w.promo_end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
      </div>
    </div>
  )
}

function PromoWindowModal({
  accounts,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  accounts: Account[]
  initial?: PromoAprWindow
  onClose: () => void
  onSave: (data: PromoAprWindowCreate | PromoAprWindowUpdate) => void
  onDelete?: () => void
}) {
  const [accountId, setAccountId] = useState(initial?.account_id ?? (accounts[0]?.id ?? ''))
  const [description, setDescription] = useState(initial?.description ?? '')
  const [endDate, setEndDate] = useState(initial?.promo_end_date ?? '')
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchase_date ?? '')
  const [balance, setBalance] = useState(initial?.balance_amount != null ? String(initial.balance_amount) : '')
  const [original, setOriginal] = useState(initial?.original_amount != null ? String(initial.original_amount) : '')
  const [required, setRequired] = useState(initial?.required_monthly_payment != null ? String(initial.required_monthly_payment) : '')

  const valid = accountId && description.trim() && endDate && purchaseDate && balance && parseFloat(balance) >= 0

  function handleSave() {
    const payload = {
      account_id: accountId,
      description: description.trim(),
      promo_end_date: endDate,
      purchase_date: purchaseDate,
      balance_amount: parseFloat(balance),
      ...(original ? { original_amount: parseFloat(original) } : { original_amount: null }),
      ...(required ? { required_monthly_payment: parseFloat(required) } : { required_monthly_payment: null }),
    }
    onSave(payload)
  }

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500'
  const dollarCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-white font-semibold">{initial ? 'Edit' : 'Add'} Promo Financing</h3>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Account</label>
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            className={inputCls}
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Description</label>
          <input
            autoFocus
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. 0%-APR Refi Balance"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Purchase Date</label>
            <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Promo Ends</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Current Balance</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0.00" className={dollarCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Original Amount <span className="text-gray-600">(optional)</span></label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" step="0.01" value={original} onChange={e => setOriginal(e.target.value)} placeholder="0.00" className={dollarCls} />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Required Monthly Payment <span className="text-gray-600">(optional — refi only)</span></label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" step="0.01" value={required} onChange={e => setRequired(e.target.value)} placeholder="0.00" className={dollarCls} />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-3 py-2 bg-red-900/40 hover:bg-red-900/70 text-red-400 rounded-lg text-sm"
            >
              Delete
            </button>
          )}
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm">
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={handleSave}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function PromoWindowsSection({ accounts }: { accounts: Account[] }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<PromoAprWindow | null>(null)

  const { data: windows = [] } = useQuery({
    queryKey: ['promo-windows'],
    queryFn: () => api.promoWindows.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data: PromoAprWindowCreate) => api.promoWindows.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promo-windows'] }); setShowAdd(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PromoAprWindowUpdate }) =>
      api.promoWindows.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promo-windows'] }); setEditing(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.promoWindows.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promo-windows'] }); setEditing(null) },
  })

  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a.name]))

  if (windows.length === 0 && !showAdd) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-medium text-white uppercase tracking-wider">Promo Financing</h2>
          <button onClick={() => setShowAdd(true)} className="text-xs text-indigo-400 hover:text-indigo-300">+ Add</button>
        </div>
        <p className="text-gray-600 text-sm">No promo windows tracked.</p>
        {showAdd && (
          <PromoWindowModal
            accounts={accounts}
            onClose={() => setShowAdd(false)}
            onSave={data => createMutation.mutate(data as PromoAprWindowCreate)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-medium text-white uppercase tracking-wider">Promo Financing</h2>
        <button onClick={() => setShowAdd(true)} className="text-xs text-indigo-400 hover:text-indigo-300">+ Add</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {windows.map(w => (
          <PromoWindowCard
            key={w.id}
            window={w}
            accountName={accountMap[w.account_id] ?? 'Unknown'}
            onEdit={() => setEditing(w)}
          />
        ))}
      </div>

      {showAdd && (
        <PromoWindowModal
          accounts={accounts}
          onClose={() => setShowAdd(false)}
          onSave={data => createMutation.mutate(data as PromoAprWindowCreate)}
        />
      )}
      {editing && (
        <PromoWindowModal
          accounts={accounts}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={data => updateMutation.mutate({ id: editing.id, data: data as PromoAprWindowUpdate })}
          onDelete={() => deleteMutation.mutate(editing.id)}
        />
      )}
    </div>
  )
}


// ── Due-soon payment strip ────────────────────────────────────────────────────

function DueSoonStrip({ accounts }: { accounts: Account[] }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dueSoon = accounts
    .filter(a => a.type === 'credit_card' && a.due_day != null)
    .map(a => {
      const dueDay = a.due_day!
      const year = today.getFullYear()
      const month = today.getMonth()
      let dueDate = new Date(year, month, dueDay)
      if (dueDate.getTime() < today.getTime()) {
        dueDate = new Date(year, month + 1, dueDay)
      }
      const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / 86400000)
      return { account: a, daysUntil }
    })
    .filter(x => x.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil)

  if (dueSoon.length === 0) return null

  return (
    <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl px-4 py-3">
      <div className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2">Payments Due Soon</div>
      <div className="flex flex-wrap gap-x-6 gap-y-1.5">
        {dueSoon.map(({ account, daysUntil }) => (
          <div key={account.id} className="flex items-center gap-2 text-sm">
            <span className="text-gray-300">{account.name}</span>
            <span className="font-mono text-gray-500 text-xs">{fmt(account.current_balance)}</span>
            <span className={`text-xs font-medium ${
              daysUntil === 0 ? 'text-red-400' : daysUntil <= 3 ? 'text-amber-400' : 'text-gray-400'
            }`}>
              {daysUntil === 0 ? 'due today' : `due in ${daysUntil}d`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Savings Rate widget ───────────────────────────────────────────────────────

function SavingsRateWidget({ annualData }: { annualData: MonthlySummary[] }) {
  const today = new Date()
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const current = annualData.find(m => m.month === currentMonthKey)
  const rolling = annualData.length > 0
    ? annualData.reduce((s, m) => s + m.savings_rate, 0) / annualData.length
    : null

  const currentRate = current?.savings_rate ?? null
  const rateColor = (r: number) =>
    r >= 50 ? 'text-emerald-400' : r >= 30 ? 'text-amber-400' : 'text-red-400'

  const maxAbs = Math.max(...annualData.map(m => Math.abs(m.savings_rate)), 1)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-xs font-medium text-white uppercase tracking-wider mb-4">Savings Rate</h2>

      <div className="flex items-end gap-6 mb-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">This Month</div>
          <div className={`text-3xl font-bold font-mono ${currentRate != null ? rateColor(currentRate) : 'text-gray-600'}`}>
            {currentRate != null ? `${currentRate.toFixed(1)}%` : '—'}
          </div>
        </div>
        {rolling != null && (
          <div>
            <div className="text-xs text-gray-500 mb-1">YTD avg</div>
            <div className={`text-xl font-bold font-mono ${rateColor(rolling)}`}>
              {rolling.toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      {annualData.length > 0 && (
        <div className="flex items-end gap-1 h-10">
          {annualData.map(m => {
            const pct = (Math.abs(m.savings_rate) / maxAbs) * 100
            const isPos = m.savings_rate >= 0
            const isCurrent = m.month === currentMonthKey
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5" title={`${m.month}: ${m.savings_rate.toFixed(1)}%`}>
                <div
                  className={`w-full rounded-sm transition-all ${
                    isPos ? (isCurrent ? 'bg-emerald-400' : 'bg-emerald-700/60') : 'bg-red-600/60'
                  }`}
                  style={{ height: `${Math.max(pct, 4)}%` }}
                />
                <div className="text-gray-700 text-[9px] leading-none">
                  {m.month.slice(5)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-3 flex gap-4 text-xs text-gray-600">
        <span className="text-emerald-700">≥50% = on track for early FIRE</span>
        <span className="text-amber-700">30–49% = good</span>
        <span className="text-red-700">&lt;30% = build more runway</span>
      </div>
    </div>
  )
}

// ── Income Runway widget ──────────────────────────────────────────────────────

function IncomeRunwayWidget({
  accounts,
  fixedBillsTotal,
  annualData,
}: {
  accounts: Account[]
  fixedBillsTotal: number
  annualData: MonthlySummary[]
}) {
  const liquidAccounts = accounts.filter(a => a.type === 'checking' || a.type === 'savings')
  const liquidAssets = liquidAccounts.reduce((s, a) => s + a.current_balance, 0)

  // 3-month avg variable spend from recent months
  const recent = annualData.slice(-3)
  const avgVariableSpend = recent.length > 0
    ? recent.reduce((s, m) => s + m.total_spend - fixedBillsTotal, 0) / recent.length
    : 0

  const monthlyBurn = fixedBillsTotal + Math.max(avgVariableSpend, 0)
  const runway = monthlyBurn > 0 ? liquidAssets / monthlyBurn : null

  const runwayColor = runway == null ? 'text-gray-500'
    : runway < 3 ? 'text-red-400'
    : runway < 6 ? 'text-amber-400'
    : 'text-emerald-400'

  const barPct = runway != null ? Math.min((runway / 12) * 100, 100) : 0
  const barColor = runway == null ? 'bg-gray-700'
    : runway < 3 ? 'bg-red-500'
    : runway < 6 ? 'bg-amber-500'
    : 'bg-emerald-500'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-xs font-medium text-white uppercase tracking-wider mb-3">Income Runway</h2>
      <div className="flex items-baseline gap-3 mb-3">
        <div className={`text-3xl font-bold font-mono ${runwayColor}`}>
          {runway != null ? `${runway.toFixed(1)} mo` : '—'}
        </div>
        <div className="text-xs text-gray-500">without income</div>
      </div>

      <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
        <div className={`absolute left-0 top-0 h-full rounded-full ${barColor}`} style={{ width: `${barPct}%` }} />
        {/* 3-month and 6-month markers */}
        <div className="absolute top-0 h-full w-px bg-amber-600/50" style={{ left: `${(3/12)*100}%` }} />
        <div className="absolute top-0 h-full w-px bg-emerald-600/50" style={{ left: `${(6/12)*100}%` }} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
        <div><span className="text-gray-300 font-mono">{fmt(liquidAssets)}</span><br/>liquid</div>
        <div><span className="text-gray-300 font-mono">{fmt(monthlyBurn)}</span><br/>monthly burn</div>
        <div>
          <span className="text-amber-500">3mo</span> <span className="text-emerald-500">6mo</span> targets
        </div>
      </div>
    </div>
  )
}

// ── 30-day Cashflow Forecast ──────────────────────────────────────────────────

interface ForecastItem {
  date: string
  label: string
  amount: number
  type: 'bill' | 'income'
}

function CashflowForecast({ accounts }: { accounts: Account[] }) {
  const todayKey = todayStr()
  const today = new Date(todayKey + 'T00:00:00')

  const { data: bills = [] } = useQuery({
    queryKey: ['bills'],
    queryFn: () => api.bills.list(),
  })

  const checkingAccounts = accounts.filter(a => a.type === 'checking' || a.type === 'savings')
  const checkingBalance = checkingAccounts.reduce((s, a) => s + a.current_balance, 0)

  const items = useMemo((): ForecastItem[] => {
    const start = new Date(todayKey + 'T00:00:00')
    const result: ForecastItem[] = []
    const horizon = new Date(start)
    horizon.setDate(horizon.getDate() + 30)

    for (const bill of bills) {
      if (!bill.is_active) continue
      // Find next occurrence within 30 days
      for (let mo = 0; mo <= 1; mo++) {
        const d = new Date(start.getFullYear(), start.getMonth() + mo, bill.due_day)
        if (d >= start && d <= horizon) {
          const mKey = toDateStr(d).slice(0, 7) + '-01'
          if (bill.starts_month && bill.starts_month > mKey) continue
          if (bill.ends_month && bill.ends_month < mKey) continue
          result.push({
            date: toDateStr(d),
            label: bill.name,
            amount: -bill.expected_amount,
            type: 'bill',
          })
        }
      }
    }

    // CC payments due
    for (const cc of accounts.filter(a => a.type === 'credit_card')) {
      if (!cc.due_day || cc.current_balance <= 0) continue
      for (let mo = 0; mo <= 1; mo++) {
        const d = new Date(start.getFullYear(), start.getMonth() + mo, cc.due_day)
        if (d >= start && d <= horizon) {
          result.push({
            date: toDateStr(d),
            label: `${cc.name} payment`,
            amount: -cc.current_balance,
            type: 'bill',
          })
        }
      }
    }

    return result.sort((a, b) => a.date.localeCompare(b.date))
  }, [bills, accounts, todayKey])

  const totalOutflow = items.filter(i => i.amount < 0).reduce((s, i) => s + i.amount, 0)
  const projectedBalance = checkingBalance + totalOutflow

  if (items.length === 0) return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-xs font-medium text-white uppercase tracking-wider mb-4">Next 30 Days</h2>

      <div className="flex gap-6 mb-4">
        <div>
          <div className="text-xs text-gray-500 mb-0.5">Bills due</div>
          <div className="text-lg font-bold font-mono text-red-400">{fmt(Math.abs(totalOutflow))}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-0.5">Projected cash</div>
          <div className={`text-lg font-bold font-mono ${projectedBalance < 1000 ? 'text-red-400' : projectedBalance < 2000 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {fmt(projectedBalance)}
          </div>
        </div>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {items.map((item, i) => {
          const d = new Date(item.date + 'T12:00:00')
          const daysOut = Math.round((d.getTime() - today.getTime()) / 86400000)
          return (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-gray-600 text-xs w-8 shrink-0">
                  {daysOut === 0 ? 'today' : `${daysOut}d`}
                </span>
                <span className="text-gray-300 truncate">{item.label}</span>
              </div>
              <span className={`font-mono text-xs shrink-0 ml-2 ${item.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {item.amount < 0 ? `(${fmt(Math.abs(item.amount))})` : fmt(item.amount)}
              </span>
            </div>
          )
        })}
      </div>

      {projectedBalance < 1000 && (
        <div className="mt-3 text-xs text-red-400 bg-red-950/30 rounded-lg px-3 py-2">
          Projected balance drops below $1,000 — consider transferring funds.
        </div>
      )}
    </div>
  )
}

// ── Category Targets ──────────────────────────────────────────────────────────

function CategoryTargetsCard({ month, monthEnd }: { month: string; monthEnd: string }) {
  const { data: catStats = [] } = useQuery({
    queryKey: ['category-stats'],
    queryFn: () => api.categoryStats(),
  })
  const targets = catStats
    .filter(c => c.monthly_target != null && c.monthly_target > 0)
    .sort((a, b) => (b.monthly_target ?? 0) - (a.monthly_target ?? 0))

  const { data: expenses = [] } = useQuery({
    queryKey: ['ledger', 'expense', month, monthEnd],
    queryFn: () => api.ledger.list({ start: month, end: monthEnd, type: 'expense' }),
    enabled: targets.length > 0,
  })

  if (targets.length === 0) return null

  const spentByCat: Record<string, number> = {}
  for (const e of expenses) {
    if (e.bill_id) continue
    const cat = e.category ?? ''
    spentByCat[cat] = (spentByCat[cat] ?? 0) + e.amount
  }

  const today = todayStr()
  const isCurrent = today.slice(0, 7) === month.slice(0, 7)
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const paceFrac = isCurrent ? parseInt(today.slice(8, 10)) / daysInMonth : 1

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xs font-medium text-white uppercase tracking-wider">Category Targets</h2>
        <span className="text-xs text-gray-600">set targets in Lookup</span>
      </div>
      <div className="space-y-3">
        {targets.map(c => {
          const target = c.monthly_target!
          const spent = spentByCat[c.name] ?? 0
          const pct = Math.min((spent / target) * 100, 100)
          const over = spent > target
          const hot = !over && spent > target * paceFrac  // ahead of pace but not over yet
          const barColor = over ? 'bg-red-500' : hot ? 'bg-amber-500' : 'bg-emerald-500'
          return (
            <div key={c.name}>
              <div className="flex justify-between items-baseline text-sm mb-1">
                <span className="text-gray-300">{c.name}</span>
                <span className="font-mono text-xs">
                  <span className={over ? 'text-red-400' : 'text-white'}>{fmt(spent)}</span>
                  <span className="text-gray-600"> / {fmt(target)}</span>
                  <span className={`ml-2 ${over ? 'text-red-400' : 'text-gray-500'}`}>
                    {over ? `${fmt(spent - target)} over` : `${fmt(target - spent)} left`}
                  </span>
                </span>
              </div>
              <div className="relative h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                {isCurrent && paceFrac < 1 && (
                  <div
                    className="absolute top-0 h-full w-px bg-gray-400/70"
                    style={{ left: `${paceFrac * 100}%` }}
                    title="Month pace — spend left of this line is on track"
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const qc = useQueryClient()
  const [month, setMonth] = useState(currentMonthStr)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [editingDaily, setEditingDaily] = useState(false)
  const [dailyDraft, setDailyDraft] = useState('')

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.settings.get(),
  })
  const dailyBudget = settingsData?.daily_budget ?? 75

  const saveSettingsMutation = useMutation({
    mutationFn: (val: number) => api.settings.update(val),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
    },
  })

  function startEditDaily() {
    setDailyDraft(String(dailyBudget))
    setEditingDaily(true)
  }

  function commitDaily() {
    const val = parseFloat(dailyDraft)
    if (!isNaN(val) && val > 0) {
      saveSettingsMutation.mutate(val)
    }
    setEditingDaily(false)
  }

  const { data: waterfall, isLoading: wLoading } = useQuery({
    queryKey: ['waterfall', month, dailyBudget],
    queryFn: () => api.waterfall(month, dailyBudget),
    enabled: settingsData !== undefined,
  })

  const { data: accounts, isLoading: aLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
  })

  const monthEnd = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }, [month])

  const { data: income } = useQuery({
    queryKey: ['ledger', 'income', month],
    queryFn: () => api.ledger.list({ start: month, end: monthEnd, type: 'income' }),
  })

  const { data: annualData = [] } = useQuery({
    queryKey: ['annual-summary'],
    queryFn: () => api.annualSummary(),
  })

  const addAccountMutation = useMutation({
    mutationFn: (data: AccountCreate) => api.accounts.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setShowAddAccount(false)
    },
  })

  const addIncomeMutation = useMutation({
    mutationFn: (data: LedgerEntryCreate) => api.ledger.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['waterfall'] })
      setShowAddIncome(false)
    },
  })

  if (wLoading || aLoading || !waterfall) {
    return <div className="text-gray-500 text-sm">Loading...</div>
  }

  const w = waterfall
  const spentPct = w.max_spend > 0 ? Math.min((w.spent_to_date / w.max_spend) * 100, 100) : 0
  const remainingColor =
    w.remaining < 0
      ? 'text-red-400'
      : w.remaining < w.max_spend * 0.2
      ? 'text-amber-400'
      : 'text-emerald-400'
  const barColor =
    spentPct > 90 ? 'bg-red-500' : spentPct > 70 ? 'bg-amber-500' : 'bg-indigo-500'

  const allAccounts = accounts ?? []
  const creditAccounts = [...allAccounts.filter(a => a.type === 'credit_card')].sort((a, b) => a.name.localeCompare(b.name))
  const cashAccounts = [...allAccounts.filter(a => a.type === 'checking' || a.type === 'savings')].sort((a, b) => a.name.localeCompare(b.name))
  const investmentAccounts = [...allAccounts.filter(a => a.type === 'investment')].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <PageShell>
      <div className="flex justify-end">
        <MonthNav month={month} onChange={setMonth} />
      </div>

      <DueSoonStrip accounts={allAccounts} />

      {/* Hero */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="text-xs text-white uppercase tracking-wider mb-1">Remaining</div>
            <div className={`text-4xl font-bold font-mono ${remainingColor}`}>
              {fmt(w.remaining)}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 w-48 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${spentPct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{Math.round(spentPct)}% of {fmt(w.max_spend)} spent</span>
            </div>
          </div>
          <div className="flex gap-8">
            <div className="text-center">
              {editingDaily ? (
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={dailyDraft}
                  autoFocus
                  onChange={e => setDailyDraft(e.target.value)}
                  onBlur={commitDaily}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitDaily()
                    if (e.key === 'Escape') setEditingDaily(false)
                  }}
                  className="w-24 bg-gray-800 border border-indigo-500 rounded-lg px-2 py-1 text-2xl font-bold font-mono text-white text-center focus:outline-none"
                />
              ) : (
                <div
                  className="text-2xl font-bold font-mono text-white cursor-pointer hover:text-indigo-300 transition-colors"
                  onClick={startEditDaily}
                  title="Click to edit daily budget"
                >
                  {fmt(w.daily_allowance_fixed)}
                </div>
              )}
              <div className="text-xs text-gray-500 mt-1">budget / day <span className="text-gray-700">(click)</span></div>
            </div>
            <div className="w-px bg-gray-800" />
            {w.days_left > 0 ? (
              <div className="text-center">
                <div
                  className={`text-2xl font-bold font-mono ${
                    w.daily_allowance_dynamic < 0 ? 'text-red-400' : 'text-white'
                  }`}
                >
                  {fmt(w.daily_allowance_dynamic)}
                </div>
                <div className="text-xs text-gray-500 mt-1">dynamic / day</div>
                <div className="text-xs text-gray-600">{w.days_left}d left</div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-2xl font-bold font-mono text-gray-600">—</div>
                <div className="text-xs text-gray-600 mt-1">month closed</div>
              </div>
            )}
          </div>
        </div>

        {/* Pace insight */}
        {w.days_left > 0 && w.remaining > 0 && (() => {
          const dynamic = w.daily_allowance_dynamic
          const configured = dailyBudget
          if (dynamic > configured) {
            const excess = w.remaining - configured * w.days_left
            return (
              <div className="mt-4 pt-4 border-t border-gray-800/60 flex items-center gap-2">
                <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Ahead</span>
                <span className="text-xs text-gray-400">
                  Spend <span className="text-white font-mono">{fmt(excess)}</span> more today to come back to <span className="text-white font-mono">{fmt(configured)}/day</span> pace.
                </span>
              </div>
            )
          }
          if (dynamic < configured) {
            const zeroDays = Math.ceil(w.days_left - w.remaining / configured)
            const dayWord = zeroDays === 1 ? 'day' : 'days'
            return (
              <div className="mt-4 pt-4 border-t border-gray-800/60 flex items-center gap-2">
                <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">Behind</span>
                <span className="text-xs text-gray-400">
                  <span className="text-white font-mono">{zeroDays}</span> zero-spend {dayWord} to recover to <span className="text-white font-mono">{fmt(configured)}/day</span> pace.
                </span>
              </div>
            )
          }
          return (
            <div className="mt-4 pt-4 border-t border-gray-800/60">
              <span className="text-xs text-emerald-400">On pace</span>
            </div>
          )
        })()}
      </div>

      {/* Waterfall */}
      <Waterfall w={w} month={month} monthEnd={monthEnd} accounts={allAccounts} />

      {/* Category Targets */}
      <CategoryTargetsCard month={month} monthEnd={monthEnd} />

      {/* FIRE widgets row */}
      {annualData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SavingsRateWidget annualData={annualData} />
          <IncomeRunwayWidget
            accounts={allAccounts}
            fixedBillsTotal={w.fixed_bills_total}
            annualData={annualData}
          />
        </div>
      )}

      {/* 30-day Forecast */}
      <CashflowForecast accounts={allAccounts} />

      {/* Accounts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-white uppercase tracking-wider">Accounts</h2>
          <button onClick={() => setShowAddAccount(true)} className="text-xs text-indigo-400 hover:text-indigo-300">
            + Add
          </button>
        </div>

        {allAccounts.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <p className="text-gray-500 text-sm">No accounts yet</p>
            <button onClick={() => setShowAddAccount(true)} className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm">
              + Add your first account
            </button>
          </div>
        ) : (
          <>
            {creditAccounts.length > 0 && <CreditAccountSection accounts={creditAccounts} onEdit={setEditingAccount} />}
            {cashAccounts.length > 0 && <SimpleAccountSection label="Cash" accounts={cashAccounts} onEdit={setEditingAccount} />}
            {investmentAccounts.length > 0 && <SimpleAccountSection label="Investments" accounts={investmentAccounts} onEdit={setEditingAccount} />}
            <NetWorthSummary accounts={allAccounts} />
          </>
        )}
      </div>

      {/* Income this month */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-white uppercase tracking-wider">
            Income — {monthLabel(month)}
          </h2>
          <button
            onClick={() => setShowAddIncome(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            + Add
          </button>
        </div>
        {(income?.length ?? 0) === 0 ? (
          <p className="text-gray-600 text-sm">No income entries for this month.</p>
        ) : (
          <div className="space-y-2">
            {income!.map(e => (
              <div key={e.id} className="flex justify-between items-center">
                <div>
                  <span className="text-sm text-gray-300">{e.notes}</span>
                  <span className="ml-2 text-xs text-gray-500 capitalize">{e.subtype}</span>
                </div>
                <span className="text-sm font-mono text-emerald-400">{fmt(e.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center border-t border-gray-800 pt-2 mt-2">
              <span className="text-sm font-medium text-gray-300">Total</span>
              <span className="text-sm font-mono font-semibold text-white">
                {fmt(income!.reduce((s, e) => s + e.amount, 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Allocation */}
      <AllocationSection month={month} />

      {/* Promo Financing */}
      <PromoWindowsSection accounts={allAccounts} />

      {/* Modals */}
      {showAddAccount && (
        <AddAccountModal
          onClose={() => setShowAddAccount(false)}
          onSave={data => addAccountMutation.mutate(data)}
        />
      )}
      {showAddIncome && (
        <AddIncomeModal
          month={month}
          accounts={allAccounts}
          onClose={() => setShowAddIncome(false)}
          onSave={data => addIncomeMutation.mutate(data)}
        />
      )}
      {editingAccount && (
        <AccountEditModal account={editingAccount} onClose={() => setEditingAccount(null)} />
      )}
    </PageShell>
  )
}
