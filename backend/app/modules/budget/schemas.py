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


# ── Fixed Bills ────────────────────────────────────────────────────────────────

class FixedBillCreate(BaseModel):
    name: str
    account_id: str
    due_day: int
    expected_amount: Decimal
    is_estimated: bool = False
    is_active: bool = True


class FixedBillUpdate(BaseModel):
    name: str | None = None
    account_id: str | None = None
    due_day: int | None = None
    expected_amount: Decimal | None = None
    is_estimated: bool | None = None
    is_active: bool | None = None


class FixedBillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    account_id: str
    due_day: int
    expected_amount: DecimalJSON
    is_estimated: bool
    is_active: bool


class FixedBillPaymentCreate(BaseModel):
    paid_date: datetime.date
    paid_amount: Decimal
    period_month: datetime.date


class FixedBillPaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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

class AccountCreditCreate(BaseModel):
    account_id: str
    amount: Decimal
    date: datetime.date
    description: str
    credit_type: str = "cashback"


class AccountCreditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    account_id: str
    amount: DecimalJSON
    date: datetime.date
    description: str
    credit_type: str
