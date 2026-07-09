import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, PlainSerializer

# Decimal fields in *Out schemas must serialize as JSON numbers, not strings.
# Pydantic v2 defaults to serializing Decimal as string; this alias overrides that.
DecimalJSON = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


# ── Accounts ──────────────────────────────────────────────────────────────────

AccountType = Literal["credit_card", "checking", "savings", "investment"]


class AccountCreate(BaseModel):
    name: str
    type: AccountType
    credit_limit: Decimal | None = None
    opening_balance: Decimal = Decimal("0")
    apr: Decimal | None = None
    statement_close_day: int | None = None
    due_day: int | None = None
    autopay: str | None = None
    annual_fee: Decimal | None = None
    annual_fee_month: int | None = None
    last_4: str | None = None
    is_active: bool = True


class AccountUpdate(BaseModel):
    name: str | None = None
    opening_balance: Decimal | None = None
    # reconcile_to: if set, back-calculates opening_balance to produce this current_balance
    reconcile_to: Decimal | None = None
    apr: Decimal | None = None
    credit_limit: Decimal | None = None
    statement_close_day: int | None = None
    due_day: int | None = None
    autopay: str | None = None
    annual_fee: Decimal | None = None
    annual_fee_month: int | None = None
    last_4: str | None = None
    is_active: bool | None = None


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    type: AccountType
    credit_limit: DecimalJSON | None
    opening_balance: DecimalJSON
    current_balance: DecimalJSON
    apr: DecimalJSON | None
    statement_close_day: int | None
    due_day: int | None
    autopay: str | None
    annual_fee: DecimalJSON | None
    annual_fee_month: int | None
    last_4: str | None
    is_active: bool


# ── Transactions ───────────────────────────────────────────────────────────────

TransactionTag = Literal["fixed", "variable", "one_off"]


class TransactionCreate(BaseModel):
    date: datetime.date
    account_id: str
    amount: Decimal
    category: str
    merchant: str
    tag: TransactionTag = "variable"
    notes: str | None = None
    reward_rule_id: str | None = None


class TransactionUpdate(BaseModel):
    date: datetime.date | None = None
    account_id: str | None = None
    amount: Decimal | None = None
    category: str | None = None
    merchant: str | None = None
    tag: TransactionTag | None = None
    notes: str | None = None
    reward_rule_id: str | None = None


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    date: datetime.date
    account_id: str
    amount: DecimalJSON
    category: str
    merchant: str
    tag: TransactionTag
    notes: str | None
    reward_rule_id: str | None
    bill_id: str | None


# ── Merchants ──────────────────────────────────────────────────────────────────

class MerchantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    default_category: str | None


# ── Dashboard / Waterfall ──────────────────────────────────────────────────────

class WaterfallOut(BaseModel):
    pay_month: datetime.date
    gross_income: DecimalJSON
    fed_tax: DecimalJSON
    state_tax: DecimalJSON
    sep_contribution: DecimalJSON
    net_income: DecimalJSON
    roth_contribution: DecimalJSON
    after_save: DecimalJSON
    fixed_bills_total: DecimalJSON
    after_fixed: DecimalJSON
    max_spend: DecimalJSON
    spent_to_date: DecimalJSON
    remaining: DecimalJSON
    daily_allowance_fixed: DecimalJSON
    daily_allowance_dynamic: DecimalJSON
    days_in_month: int
    days_left: int


# ── Ledger ────────────────────────────────────────────────────────────────────

LedgerEntryType = Literal["expense", "income", "credit", "transfer_out", "transfer_in"]


class LedgerEntryCreate(BaseModel):
    date: datetime.date
    account_id: str
    amount: Decimal
    type: LedgerEntryType
    merchant: str | None = None
    category: str | None = None
    tag: TransactionTag | None = None
    subtype: str | None = None
    period_id: str | None = None
    bill_id: str | None = None
    reward_rule_id: str | None = None
    linked_entry_id: str | None = None
    notes: str | None = None


class LedgerEntryUpdate(BaseModel):
    date: datetime.date | None = None
    account_id: str | None = None
    amount: Decimal | None = None
    merchant: str | None = None
    category: str | None = None
    tag: TransactionTag | None = None
    subtype: str | None = None
    period_id: str | None = None
    bill_id: str | None = None
    reward_rule_id: str | None = None
    notes: str | None = None


class LedgerEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    date: datetime.date
    account_id: str
    amount: DecimalJSON
    type: str
    merchant: str | None
    merchant_id: str | None
    category: str | None
    tag: str | None
    subtype: str | None
    period_id: str | None
    bill_id: str | None
    reward_rule_id: str | None
    linked_entry_id: str | None
    notes: str | None
    counterpart_account_id: str | None = None


class LedgerBulkCreate(BaseModel):
    entries: list[LedgerEntryCreate]


class TransferPairCreate(BaseModel):
    from_account_id: str
    to_account_id: str
    amount: Decimal
    date: datetime.date
    description: str | None = None


# ── Category Rules ────────────────────────────────────────────────────────────

class CategoryRuleUpdate(BaseModel):
    exclude_from_spend: bool | None = None
    exclude_from_trends: bool | None = None


# ── Fixed Bills ────────────────────────────────────────────────────────────────

class FixedBillCreate(BaseModel):
    name: str
    account_id: str
    due_day: int
    expected_amount: Decimal
    is_estimated: bool = False
    is_active: bool = True
    category: str | None = None
    merchant: str | None = None


class FixedBillUpdate(BaseModel):
    name: str | None = None
    account_id: str | None = None
    due_day: int | None = None
    expected_amount: Decimal | None = None
    is_estimated: bool | None = None
    is_active: bool | None = None
    category: str | None = None
    merchant: str | None = None


class FixedBillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    account_id: str
    due_day: int
    expected_amount: DecimalJSON
    is_estimated: bool
    is_active: bool
    category: str | None
    merchant: str | None


class FixedBillPaymentCreate(BaseModel):
    paid_date: datetime.date
    paid_amount: Decimal
    period_month: datetime.date


class FixedBillPaymentOut(BaseModel):
    id: str
    bill_id: str
    paid_date: datetime.date
    paid_amount: DecimalJSON
    period_month: datetime.date
    bill_name: str | None = None
    account_id: str | None = None


# ── Income ─────────────────────────────────────────────────────────────────────

IncomeType = Literal["contract", "interest", "tbill", "investment", "other"]


class IncomePeriodCreate(BaseModel):
    work_month: datetime.date
    pay_month: datetime.date
    planned_hours: Decimal = Decimal("0")
    actual_hours: Decimal = Decimal("0")
    hourly_rate: Decimal


class IncomePeriodUpdate(BaseModel):
    pay_month: datetime.date | None = None
    planned_hours: Decimal | None = None
    actual_hours: Decimal | None = None
    hourly_rate: Decimal | None = None


class IncomePeriodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    work_month: datetime.date
    pay_month: datetime.date
    planned_hours: DecimalJSON
    actual_hours: DecimalJSON
    hourly_rate: DecimalJSON
    gross_planned: DecimalJSON
    gross_actual: DecimalJSON


class IncomeEntryCreate(BaseModel):
    period_id: str | None = None
    type: IncomeType
    amount: Decimal
    description: str
    received_date: datetime.date
    to_account_id: str | None = None


class IncomeEntryUpdate(BaseModel):
    period_id: str | None = None
    type: IncomeType | None = None
    amount: Decimal | None = None
    description: str | None = None
    received_date: datetime.date | None = None
    to_account_id: str | None = None


class IncomeEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    period_id: str | None
    type: IncomeType
    amount: DecimalJSON
    description: str
    received_date: datetime.date
    to_account_id: str | None


# ── Transfers ──────────────────────────────────────────────────────────────────

class TransferCreate(BaseModel):
    from_account_id: str
    to_account_id: str
    amount: Decimal
    date: datetime.date
    description: str


class TransferUpdate(BaseModel):
    from_account_id: str | None = None
    to_account_id: str | None = None
    amount: Decimal | None = None
    date: datetime.date | None = None
    description: str | None = None


class TransferOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    from_account_id: str
    to_account_id: str
    amount: DecimalJSON
    date: datetime.date
    description: str


# ── Allocation ─────────────────────────────────────────────────────────────────

class AllocationCreate(BaseModel):
    pay_month: datetime.date
    fed_tax: Decimal = Decimal("0")
    state_tax: Decimal = Decimal("0")
    sep_contribution: Decimal = Decimal("0")
    roth_contribution: Decimal = Decimal("0")


class AllocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    pay_month: datetime.date
    fed_tax: DecimalJSON
    state_tax: DecimalJSON
    sep_contribution: DecimalJSON
    roth_contribution: DecimalJSON


class TransactionBulkCreate(BaseModel):
    transactions: list[TransactionCreate]


# ── Account Credits ─────────────────────────────────────────────────────────────

class AccountCreditUpdate(BaseModel):
    account_id: str | None = None
    amount: Decimal | None = None
    date: datetime.date | None = None
    description: str | None = None
    credit_type: str | None = None
    category: str | None = None


class AccountCreditCreate(BaseModel):
    account_id: str
    amount: Decimal
    date: datetime.date
    description: str
    credit_type: str = "cashback"
    category: str | None = None


class AccountCreditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    account_id: str
    amount: DecimalJSON
    date: datetime.date
    description: str
    credit_type: str
    category: str | None


# ── Promo APR Windows ──────────────────────────────────────────────────────────

class PromoAprWindowCreate(BaseModel):
    account_id: str
    description: str
    promo_end_date: datetime.date
    balance_amount: Decimal
    purchase_date: datetime.date
    original_amount: Decimal | None = None
    required_monthly_payment: Decimal | None = None


class PromoAprWindowUpdate(BaseModel):
    description: str | None = None
    promo_end_date: datetime.date | None = None
    balance_amount: Decimal | None = None
    purchase_date: datetime.date | None = None
    original_amount: Decimal | None = None
    required_monthly_payment: Decimal | None = None


class PromoAprWindowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    account_id: str
    description: str
    promo_end_date: datetime.date
    balance_amount: DecimalJSON
    purchase_date: datetime.date
    original_amount: DecimalJSON | None
    required_monthly_payment: DecimalJSON | None


# ── Reward Rules ───────────────────────────────────────────────────────────────

class RewardRuleCreate(BaseModel):
    account_id: str
    category: str
    rate: Decimal
    is_rotating: bool = False
    promo_start_date: datetime.date | None = None
    promo_end_date: datetime.date | None = None
    spending_cap: Decimal | None = None
    amount_used: Decimal = Decimal("0")


class RewardRuleUpdate(BaseModel):
    category: str | None = None
    rate: Decimal | None = None
    is_rotating: bool | None = None
    promo_start_date: datetime.date | None = None
    promo_end_date: datetime.date | None = None
    spending_cap: Decimal | None = None
    amount_used: Decimal | None = None


class RewardRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    account_id: str
    category: str
    rate: DecimalJSON
    is_rotating: bool
    promo_start_date: datetime.date | None
    promo_end_date: datetime.date | None
    spending_cap: DecimalJSON | None
    amount_used: DecimalJSON


# ── Budget Settings ────────────────────────────────────────────────────────────

class BudgetSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    daily_budget: DecimalJSON

class BudgetSettingsUpdate(BaseModel):
    daily_budget: Decimal
