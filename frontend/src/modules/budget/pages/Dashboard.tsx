import { useState, useMemo } from 'react'
import PageShell from '../components/PageShell'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { fmt, currentMonthStr, prevMonth, nextMonth, monthLabel } from '../utils'
import type { Account, AccountCreate, AccountType, AutopayType, AllocationCreate, IncomeEntryCreate, IncomeType, PromoAprWindow, PromoAprWindowCreate, PromoAprWindowUpdate, WaterfallData } from '../types'

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

function WRow({
  label,
  amount,
  isTotal,
  indent,
  color,
}: {
  label: string
  amount: number
  isTotal?: boolean
  indent?: boolean
  color?: 'green' | 'red' | 'white'
}) {
  const textColor =
    color === 'green'
      ? 'text-emerald-400'
      : color === 'red'
      ? 'text-red-400'
      : 'text-white'
  return (
    <div
      className={`flex justify-between items-center py-1.5 ${
        isTotal ? 'border-t border-gray-700 mt-1 pt-2.5' : ''
      }`}
    >
      <span
        className={`text-sm ${
          indent ? 'pl-4 text-gray-400' : isTotal ? 'font-semibold text-white' : 'text-gray-300'
        }`}
      >
        {indent ? '─ ' : ''}{label}
      </span>
      <span className={`text-sm font-mono ${isTotal ? 'font-semibold' : ''} ${textColor}`}>
        {color === 'red' ? `(${fmt(amount)})` : fmt(amount)}
      </span>
    </div>
  )
}

function Waterfall({ w }: { w: WaterfallData }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
        Waterfall
      </h2>
      <WRow label="Gross Income" amount={w.gross_income} color="green" />
      <WRow label="Federal Tax" amount={w.fed_tax} indent color="red" />
      <WRow label="State Tax" amount={w.state_tax} indent color="red" />
      <WRow label="SEP Contribution" amount={w.sep_contribution} indent color="red" />
      <WRow label="Net Income" amount={w.net_income} isTotal />
      <WRow label="Roth IRA" amount={w.roth_contribution} indent color="red" />
      <WRow label="After Savings" amount={w.after_save} isTotal />
      <WRow label="Fixed Bills" amount={w.fixed_bills_total} indent color="red" />
      <WRow label="Max Spend" amount={w.max_spend} isTotal />
      <WRow label="Spent to Date" amount={w.spent_to_date} indent color="red" />
      <WRow
        label="Remaining"
        amount={w.remaining}
        isTotal
        color={w.remaining < 0 ? 'red' : 'green'}
      />
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
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Credit Cards</span>
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
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</span>
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
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Net Worth</span>
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
  onClose,
  onSave,
}: {
  month: string
  onClose: () => void
  onSave: (d: IncomeEntryCreate) => void
}) {
  const [type, setType] = useState<IncomeType>('contract')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(month.slice(0, 7) + '-01')
  const valid = amount && parseFloat(amount) > 0 && description.trim()

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
                onClick={() => setType(t.value)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  type === t.value ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
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
        <div>
          <label className="block text-xs text-gray-400 mb-1">Received Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl py-2.5 text-sm">Cancel</button>
          <button
            disabled={!valid}
            onClick={() =>
              onSave({
                type,
                amount: parseFloat(amount),
                description: description.trim(),
                received_date: date,
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
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
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
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Promo Financing</h2>
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
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Promo Financing</h2>
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


// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const qc = useQueryClient()
  const [month, setMonth] = useState(currentMonthStr)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const { data: waterfall, isLoading: wLoading } = useQuery({
    queryKey: ['waterfall', month],
    queryFn: () => api.waterfall(month),
  })

  const { data: accounts, isLoading: aLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
  })

  const { data: income } = useQuery({
    queryKey: ['income', month],
    queryFn: () => api.income.list(month),
  })

  const addAccountMutation = useMutation({
    mutationFn: (data: AccountCreate) => api.accounts.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] })
      setShowAddAccount(false)
    },
  })

  const addIncomeMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.income.create>[0]) => api.income.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['income', month] })
      qc.invalidateQueries({ queryKey: ['waterfall', month] })
      setShowAddIncome(false)
    },
  })

  if (wLoading || aLoading) {
    return <div className="text-gray-500 text-sm">Loading...</div>
  }

  const w = waterfall!
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

      {/* Hero */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Remaining</div>
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
              <div className="text-2xl font-bold font-mono text-white">
                {fmt(w.daily_allowance_fixed)}
              </div>
              <div className="text-xs text-gray-500 mt-1">fixed / day</div>
            </div>
            <div className="w-px bg-gray-800" />
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
          </div>
        </div>
      </div>

      {/* Waterfall */}
      <Waterfall w={w} />

      {/* Accounts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Accounts</h2>
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
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
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
                  <span className="text-sm text-gray-300">{e.description}</span>
                  <span className="ml-2 text-xs text-gray-500 capitalize">{e.type}</span>
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
