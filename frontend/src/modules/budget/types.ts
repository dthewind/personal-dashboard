export type AccountType = 'credit_card' | 'checking' | 'savings' | 'investment'
export type TransactionTag = 'fixed' | 'variable' | 'one_off'
export type IncomeType = 'contract' | 'interest' | 'tbill' | 'investment' | 'other'

export interface Account {
  id: string
  name: string
  type: AccountType
  credit_limit: number | null
  opening_balance: number
  current_balance: number   // computed from ledger — do not set directly
  apr: number | null
  statement_close_day: number | null
  due_day: number | null
  is_active: boolean
}

export interface AccountCreate {
  name: string
  type: AccountType
  credit_limit?: number
  opening_balance?: number  // balance before any tracked transactions
  apr?: number
  statement_close_day?: number
  due_day?: number
}

export interface Transaction {
  id: string
  date: string
  account_id: string
  amount: number
  category: string
  merchant: string
  tag: TransactionTag
  notes: string | null
  reward_rule_id: string | null
}

export interface TransactionCreate {
  date: string
  account_id: string
  amount: number
  category: string
  merchant: string
  tag: TransactionTag
  notes?: string
}

export interface Merchant {
  id: string
  name: string
  default_category: string | null
}

export interface WaterfallData {
  pay_month: string
  gross_income: number
  fed_tax: number
  state_tax: number
  sep_contribution: number
  net_income: number
  roth_contribution: number
  after_save: number
  fixed_bills_total: number
  after_fixed: number
  max_spend: number
  spent_to_date: number
  remaining: number
  daily_allowance_fixed: number
  daily_allowance_dynamic: number
  days_in_month: number
  days_left: number
}

export interface FixedBill {
  id: string
  name: string
  account_id: string
  due_day: number
  expected_amount: number
  is_estimated: boolean
  is_active: boolean
}

export interface FixedBillCreate {
  name: string
  account_id: string
  due_day: number
  expected_amount: number
  is_estimated?: boolean
  is_active?: boolean
}

export interface FixedBillUpdate {
  name?: string
  account_id?: string
  due_day?: number
  expected_amount?: number
  is_estimated?: boolean
  is_active?: boolean
}

export interface FixedBillPayment {
  id: string
  bill_id: string
  paid_date: string
  paid_amount: number
  period_month: string
  bill_name?: string | null
  account_id?: string | null
}

export interface IncomePeriod {
  id: string
  work_month: string
  pay_month: string
  planned_hours: number
  actual_hours: number
  hourly_rate: number
  gross_planned: number
  gross_actual: number
}

export interface IncomePeriodCreate {
  work_month: string
  pay_month: string
  planned_hours?: number
  actual_hours?: number
  hourly_rate: number
}

export interface IncomePeriodUpdate {
  pay_month?: string
  planned_hours?: number
  actual_hours?: number
  hourly_rate?: number
}

export interface IncomeEntry {
  id: string
  period_id: string | null
  type: IncomeType
  amount: number
  description: string
  received_date: string
  to_account_id: string | null
}

export interface IncomeEntryCreate {
  type: IncomeType
  amount: number
  description: string
  received_date: string
  to_account_id?: string
}

export interface IncomeEntryUpdate {
  type?: IncomeType
  amount?: number
  description?: string
  received_date?: string
  to_account_id?: string
}

export interface AccountCredit {
  id: string
  account_id: string
  amount: number
  date: string
  description: string
  credit_type: string
}

export interface AccountCreditCreate {
  account_id: string
  amount: number
  date: string
  description: string
  credit_type: string
}

export interface Transfer {
  id: string
  from_account_id: string
  to_account_id: string
  amount: number
  date: string
  description: string
}

export interface TransferUpdate {
  from_account_id?: string
  to_account_id?: string
  amount?: number
  date?: string
  description?: string
}

export interface TransferCreate {
  from_account_id: string
  to_account_id: string
  amount: number
  date: string
  description: string
}

export interface Allocation {
  id: string
  pay_month: string
  fed_tax: number
  state_tax: number
  sep_contribution: number
  roth_contribution: number
}

export interface AllocationCreate {
  pay_month: string
  fed_tax: number
  state_tax: number
  sep_contribution: number
  roth_contribution: number
}
