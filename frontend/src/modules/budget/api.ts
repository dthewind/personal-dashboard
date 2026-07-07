import type {
  Account, AccountCreate,
  Allocation, AllocationCreate,
  FixedBill, FixedBillCreate, FixedBillUpdate, FixedBillPayment,
  IncomePeriod, IncomePeriodCreate, IncomePeriodUpdate,
  IncomeEntry, IncomeEntryCreate, IncomeEntryUpdate,
  Merchant,
  Transaction, TransactionCreate,
  AccountCredit, AccountCreditCreate,
  Transfer, TransferCreate, TransferUpdate,
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

  transactions: {
    list: (params?: { start?: string; end?: string; account_id?: string; category?: string }) => {
      const q = new URLSearchParams(
        Object.fromEntries(
          Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== '')
        ) as Record<string, string>
      ).toString()
      return req<Transaction[]>(`/transactions${q ? '?' + q : ''}`)
    },
    create: (data: TransactionCreate, updateBalance = true) =>
      req<Transaction>(
        `/transactions${updateBalance ? '' : '?update_balance=false'}`,
        { method: 'POST', body: JSON.stringify(data) },
      ),
    update: (id: string, data: Partial<TransactionCreate>) =>
      req<Transaction>(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => req<void>(`/transactions/${id}`, { method: 'DELETE' }),
    bulk: (transactions: TransactionCreate[]) =>
      req<{ created: number }>('/transactions/bulk', {
        method: 'POST',
        body: JSON.stringify({ transactions }),
      }),
  },

  categories: () => req<string[]>('/categories'),

  merchants: (q: string) =>
    req<Merchant[]>(`/merchants?q=${encodeURIComponent(q)}`),

  waterfall: (month?: string) =>
    req<WaterfallData>(`/waterfall${month ? '?month=' + month : ''}`),

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

  transfers: {
    list: (params?: { account_id?: string; from_account_id?: string; to_account_id?: string; start?: string; end?: string }) => {
      const qs = new URLSearchParams()
      if (params?.account_id) qs.set('account_id', params.account_id)
      if (params?.from_account_id) qs.set('from_account_id', params.from_account_id)
      if (params?.to_account_id) qs.set('to_account_id', params.to_account_id)
      if (params?.start) qs.set('start', params.start)
      if (params?.end) qs.set('end', params.end)
      const q = qs.toString()
      return req<Transfer[]>(`/transfers${q ? '?' + q : ''}`)
    },
    create: (data: TransferCreate) =>
      req<Transfer>('/transfers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: TransferUpdate) =>
      req<Transfer>(`/transfers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req<void>(`/transfers/${id}`, { method: 'DELETE' }),
  },

  credits: {
    list: (params?: { account_id?: string; start?: string; end?: string }) => {
      const qs = new URLSearchParams()
      if (params?.account_id) qs.set('account_id', params.account_id)
      if (params?.start) qs.set('start', params.start)
      if (params?.end) qs.set('end', params.end)
      const q = qs.toString()
      return req<AccountCredit[]>(`/credits${q ? '?' + q : ''}`)
    },
    create: (data: AccountCreditCreate) =>
      req<AccountCredit>('/credits', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => req<void>(`/credits/${id}`, { method: 'DELETE' }),
  },

  income: {
    list: (month?: string) =>
      req<IncomeEntry[]>(`/income${month ? '?month=' + month : ''}`),
    create: (data: IncomeEntryCreate) =>
      req<IncomeEntry>('/income', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: IncomeEntryUpdate) =>
      req<IncomeEntry>(`/income/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => req<void>(`/income/${id}`, { method: 'DELETE' }),
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
}
