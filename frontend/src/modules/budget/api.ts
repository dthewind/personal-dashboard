import type {
  Account, AccountCreate,
  Allocation, AllocationCreate,
  FixedBill, FixedBillCreate, FixedBillUpdate, FixedBillPayment,
  IncomePeriod, IncomePeriodCreate, IncomePeriodUpdate,
  LedgerEntry, LedgerEntryCreate, LedgerEntryUpdate, TransferPairCreate,
  Merchant,
  MonthlySummary,
  PromoAprWindow, PromoAprWindowCreate, PromoAprWindowUpdate,
  RewardRule, RewardRuleCreate, RewardRuleUpdate,
  WaterfallData,
} from './types'

const BASE = '/api/budget'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  accounts: {
    list: () => req<Account[]>('/accounts'),
    create: (data: AccountCreate) =>
      req<Account>('/accounts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<AccountCreate & { is_active: boolean; reconcile_to: number }>) =>
      req<Account>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    recompute: () => req<void>('/accounts/recompute', { method: 'POST' }),
  },

  ledger: {
    list: (params?: {
      start?: string; end?: string; account_id?: string
      type?: string; category?: string; merchant?: string
      limit?: number
    }) => {
      const qs = new URLSearchParams(
        Object.entries(params ?? {})
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)])
      ).toString()
      return req<LedgerEntry[]>(`/ledger${qs ? '?' + qs : ''}`)
    },
    create: (data: LedgerEntryCreate) =>
      req<LedgerEntry>('/ledger', { method: 'POST', body: JSON.stringify(data) }),
    createTransfer: (data: TransferPairCreate) =>
      req<LedgerEntry[]>('/ledger/transfer', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: LedgerEntryUpdate) =>
      req<LedgerEntry>(`/ledger/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => req<void>(`/ledger/${id}`, { method: 'DELETE' }),
    bulk: (entries: LedgerEntryCreate[]) =>
      req<{ created: number }>('/ledger/bulk', {
        method: 'POST',
        body: JSON.stringify({ entries }),
      }),
  },

  categories: () => req<string[]>('/categories'),

  categoryRules: {
    update: (name: string, data: { exclude_from_spend?: boolean; exclude_from_trends?: boolean }) =>
      req<{ name: string; exclude_from_spend: boolean; exclude_from_trends: boolean }>(
        `/categories/${encodeURIComponent(name)}/rules`,
        { method: 'PATCH', body: JSON.stringify(data) },
      ),
  },

  merchants: (q: string) =>
    req<Merchant[]>(`/merchants?q=${encodeURIComponent(q)}`),

  waterfall: (month?: string, dailyBudget?: number) => {
    const p = new URLSearchParams()
    if (month) p.set('month', month)
    if (dailyBudget != null && dailyBudget !== 75) p.set('daily_budget', String(dailyBudget))
    const q = p.toString()
    return req<WaterfallData>(`/waterfall${q ? '?' + q : ''}`)
  },

  bills: {
    list: () => req<FixedBill[]>('/bills'),
    create: (data: FixedBillCreate) =>
      req<FixedBill>('/bills', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: FixedBillUpdate) =>
      req<FixedBill>(`/bills/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    payments: (billId: string) =>
      req<FixedBillPayment[]>(`/bills/${billId}/payments`),
    allPayments: (params?: { month?: string; account_id?: string; start?: string; end?: string }) => {
      const qs = new URLSearchParams()
      if (params?.month) qs.set('month', params.month)
      if (params?.account_id) qs.set('account_id', params.account_id)
      if (params?.start) qs.set('start', params.start)
      if (params?.end) qs.set('end', params.end)
      const q = qs.toString()
      return req<FixedBillPayment[]>(`/bills/payments${q ? '?' + q : ''}`)
    },
    recordPayment: (billId: string, data: { paid_date: string; paid_amount: number; period_month: string }) =>
      req<FixedBillPayment>(`/bills/${billId}/payments`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deletePayment: (billId: string, paymentId: string) =>
      req<void>(`/bills/${billId}/payments/${paymentId}`, { method: 'DELETE' }),
  },

  income: {
    periods: {
      list: (params?: { work_month?: string; pay_month?: string }) => {
        const q = new URLSearchParams(
          Object.fromEntries(
            Object.entries(params ?? {}).filter(([, v]) => v !== undefined)
          ) as Record<string, string>
        ).toString()
        return req<IncomePeriod[]>(`/income/periods${q ? '?' + q : ''}`)
      },
      create: (data: IncomePeriodCreate) =>
        req<IncomePeriod>('/income/periods', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: IncomePeriodUpdate) =>
        req<IncomePeriod>(`/income/periods/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    },
  },

  allocation: {
    get: (month: string) =>
      req<Allocation | null>(`/allocation?month=${month}`),
    upsert: (data: AllocationCreate) =>
      req<Allocation>('/allocation', { method: 'PUT', body: JSON.stringify(data) }),
  },

  promoWindows: {
    list: (account_id?: string) => {
      const q = account_id ? `?account_id=${account_id}` : ''
      return req<PromoAprWindow[]>(`/promo-windows${q}`)
    },
    create: (data: PromoAprWindowCreate) =>
      req<PromoAprWindow>('/promo-windows', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: PromoAprWindowUpdate) =>
      req<PromoAprWindow>(`/promo-windows/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => req<void>(`/promo-windows/${id}`, { method: 'DELETE' }),
  },

  rewardRules: {
    list: (account_id?: string) => {
      const q = account_id ? `?account_id=${account_id}` : ''
      return req<RewardRule[]>(`/reward-rules${q}`)
    },
    create: (data: RewardRuleCreate) =>
      req<RewardRule>('/reward-rules', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: RewardRuleUpdate) =>
      req<RewardRule>(`/reward-rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => req<void>(`/reward-rules/${id}`, { method: 'DELETE' }),
  },

  annualSummary: (year?: number) => {
    const q = year ? `?year=${year}` : ''
    return req<MonthlySummary[]>(`/annual-summary${q}`)
  },

  settings: {
    get: () => req<{ daily_budget: number }>('/settings'),
    update: (daily_budget: number) =>
      req<{ daily_budget: number }>('/settings', { method: 'PUT', body: JSON.stringify({ daily_budget }) }),
  },
}
