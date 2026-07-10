export type AccountType = 'credit_card' | 'checking' | 'savings' | 'investment'
export type TransactionTag = 'fixed' | 'variable' | 'one_off'
export type IncomeType = 'contract' | 'interest' | 'tbill' | 'investment' | 'other'
export type LedgerEntryType = 'expense' | 'income' | 'credit' | 'transfer_out' | 'transfer_in'

export type AutopayType = 'off' | 'minimum' | 'full'

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
  autopay: AutopayType | null
  annual_fee: number | null
  annual_fee_month: number | null  // 1–12
  last_4: string | null
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
  autopay?: AutopayType
  annual_fee?: number
  annual_fee_month?: number
  last_4?: string
}

export interface LedgerEntry {
  id: string
  date: string
  account_id: string
  amount: number
  type: LedgerEntryType
  merchant: string | null
  merchant_id: string | null
  category: string | null
  tag: TransactionTag | null
  subtype: string | null       // income: contract/interest/etc  credit: cashback/dispute/etc
  period_id: string | null
  bill_id: string | null
  reward_rule_id: string | null
  linked_entry_id: string | null
  notes: string | null
  counterpart_account_id: string | null  // populated for transfer_out/transfer_in
}

export interface LedgerEntryCreate {
  date: string
  account_id: string
  amount: number
  type: LedgerEntryType
  merchant?: string
  category?: string
  tag?: TransactionTag
  subtype?: string
  period_id?: string
  bill_id?: string
  reward_rule_id?: string
  linked_entry_id?: string
  notes?: string
}

export interface LedgerEntryUpdate {
  date?: string
  account_id?: string
  amount?: number
  merchant?: string
  category?: string
  tag?: TransactionTag
  subtype?: string
  period_id?: string
  bill_id?: string
  reward_rule_id?: string
  notes?: string
}

export interface TransferPairCreate {
  from_account_id: string
  to_account_id: string
  amount: number
  date: string
  description?: string
}

// ── Legacy types (kept for Bills/Income period forms) ─────────────────────────

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
  bill_id: string | null
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
  category: string | null
  merchant: string | null
  starts_month: string | null  // first-of-month; bounds only affect projections
  ends_month: string | null
}

export interface FixedBillCreate {
  name: string
  account_id: string
  due_day: number
  expected_amount: number
  is_estimated?: boolean
  is_active?: boolean
  category?: string
  merchant?: string
  starts_month?: string
  ends_month?: string
}

export interface FixedBillUpdate {
  name?: string
  account_id?: string
  due_day?: number
  expected_amount?: number
  is_estimated?: boolean
  is_active?: boolean
  category?: string
  merchant?: string
  starts_month?: string | null  // explicit null clears
  ends_month?: string | null
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
  to_account_id: string  // required — income must be linked to an account
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
  category: string | null
}

export interface AccountCreditUpdate {
  account_id?: string
  amount?: number
  date?: string
  description?: string
  credit_type?: string
  category?: string | null
}

export interface AccountCreditCreate {
  account_id: string
  amount: number
  date: string
  description: string
  credit_type: string
  category?: string
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

export interface PromoAprWindow {
  id: string
  account_id: string
  description: string
  promo_end_date: string
  balance_amount: number
  purchase_date: string
  original_amount: number | null
  required_monthly_payment: number | null
}

export interface PromoAprWindowCreate {
  account_id: string
  description: string
  promo_end_date: string
  balance_amount: number
  purchase_date: string
  original_amount?: number
  required_monthly_payment?: number
}

export interface PromoAprWindowUpdate {
  description?: string
  promo_end_date?: string
  balance_amount?: number
  purchase_date?: string
  original_amount?: number | null
  required_monthly_payment?: number | null
}

export interface RewardRule {
  id: string
  account_id: string
  category: string
  rate: number
  is_rotating: boolean
  promo_start_date: string | null
  promo_end_date: string | null
  spending_cap: number | null
  amount_used: number
}

export interface RewardRuleCreate {
  account_id: string
  category: string
  rate: number
  is_rotating?: boolean
  promo_start_date?: string | null
  promo_end_date?: string | null
  spending_cap?: number | null
  amount_used?: number
}

export interface RewardRuleUpdate {
  category?: string
  rate?: number
  is_rotating?: boolean
  promo_start_date?: string | null
  promo_end_date?: string | null
  spending_cap?: number | null
  amount_used?: number
}

export interface MonthlySummary {
  month: string
  gross_income: number
  net_income: number
  total_spend: number
  sep_contribution: number
  roth_contribution: number
  savings_rate: number
  fixed_total: number
  variable_spend: number
  after_fixed: number
  max_spend: number
  potential_savings: number   // plan: After Fixed − Max Spend (hold the daily line)
  actual_savings: number      // reality: After Fixed − variable spend
}

export interface OutlookMonth {
  month: string
  has_plan: boolean
  period_id: string | null
  planned_hours: number | null
  hourly_rate: number | null
  gross_income: number
  fed_tax: number
  state_tax: number
  sep_contribution: number
  roth_contribution: number
  net_income: number
  after_save: number
  fixed_bills_total: number
  after_fixed: number
  max_spend: number
  potential_savings: number
  cumulative_savings: number
  days_in_month: number
}

export interface CategoryStat {
  name: string
  count: number
  total: number
  exclude_from_spend: boolean
  exclude_from_trends: boolean
  monthly_target: number | null
}
