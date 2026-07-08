import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Boolean, Date, Enum, ForeignKey, Integer, Numeric, String, Text,
    ARRAY, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _uuid():
    return str(uuid.uuid4())


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(
        Enum("credit_card", "checking", "savings", "investment", name="account_type"),
        nullable=False,
    )
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    current_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    apr: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    statement_close_day: Mapped[int | None] = mapped_column(Integer)
    due_day: Mapped[int | None] = mapped_column(Integer)
    autopay: Mapped[str | None] = mapped_column(String(10))  # 'off' | 'minimum' | 'full'
    annual_fee: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    annual_fee_month: Mapped[int | None] = mapped_column(Integer)  # 1–12
    last_4: Mapped[str | None] = mapped_column(String(4))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="account")
    fixed_bills: Mapped[list["FixedBill"]] = relationship(back_populates="account")
    reward_rules: Mapped[list["RewardRule"]] = relationship(back_populates="account")
    promo_apr_windows: Mapped[list["PromoAprWindow"]] = relationship(back_populates="account")
    savings_goals: Mapped[list["SavingsGoal"]] = relationship(back_populates="account")
    credits: Mapped[list["AccountCredit"]] = relationship(back_populates="account")


class PromoAprWindow(Base):
    __tablename__ = "promo_apr_windows"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    promo_end_date: Mapped[date] = mapped_column(Date, nullable=False)
    balance_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False)
    original_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    required_monthly_payment: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))

    account: Mapped["Account"] = relationship(back_populates="promo_apr_windows")


class RewardRule(Base):
    __tablename__ = "reward_rules"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False)
    is_rotating: Mapped[bool] = mapped_column(Boolean, default=False)
    promo_start_date: Mapped[date | None] = mapped_column(Date)
    promo_end_date: Mapped[date | None] = mapped_column(Date)
    spending_cap: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    amount_used: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)

    account: Mapped["Account"] = relationship(back_populates="reward_rules")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="reward_rule")


class FixedBill(Base):
    __tablename__ = "fixed_bills"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    due_day: Mapped[int] = mapped_column(Integer, nullable=False)
    expected_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    is_estimated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    category: Mapped[str | None] = mapped_column(String(100))
    merchant: Mapped[str | None] = mapped_column(String(200))

    account: Mapped["Account"] = relationship(back_populates="fixed_bills")


class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    raw_aliases: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    default_category: Mapped[str | None] = mapped_column(String(100))

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="merchant_ref")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    merchant: Mapped[str] = mapped_column(String(200), nullable=False)
    merchant_id: Mapped[str | None] = mapped_column(ForeignKey("merchants.id"))
    tag: Mapped[str] = mapped_column(
        Enum("fixed", "variable", "one_off", name="transaction_tag"),
        nullable=False,
        default="variable",
    )
    notes: Mapped[str | None] = mapped_column(Text)
    reward_rule_id: Mapped[str | None] = mapped_column(ForeignKey("reward_rules.id"))
    bill_id: Mapped[str | None] = mapped_column(ForeignKey("fixed_bills.id"))

    account: Mapped["Account"] = relationship(back_populates="transactions")
    merchant_ref: Mapped["Merchant | None"] = relationship(back_populates="transactions")
    reward_rule: Mapped["RewardRule | None"] = relationship(back_populates="transactions")


class IncomePeriod(Base):
    __tablename__ = "income_periods"
    __table_args__ = (UniqueConstraint("work_month", name="uq_income_period_work_month"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    work_month: Mapped[date] = mapped_column(Date, nullable=False)
    pay_month: Mapped[date] = mapped_column(Date, nullable=False)
    planned_hours: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    actual_hours: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    hourly_rate: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)

    entries: Mapped[list["IncomeEntry"]] = relationship(back_populates="period")

    @property
    def gross_planned(self) -> Decimal:
        return self.planned_hours * self.hourly_rate

    @property
    def gross_actual(self) -> Decimal:
        return self.actual_hours * self.hourly_rate


class IncomeEntry(Base):
    __tablename__ = "income_entries"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    period_id: Mapped[str | None] = mapped_column(ForeignKey("income_periods.id"))
    type: Mapped[str] = mapped_column(
        Enum("contract", "interest", "tbill", "investment", "other", name="income_type"),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    received_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"))

    period: Mapped["IncomePeriod | None"] = relationship(back_populates="entries")
    to_account: Mapped["Account | None"] = relationship(foreign_keys="[IncomeEntry.to_account_id]")


class Allocation(Base):
    __tablename__ = "allocations"
    __table_args__ = (UniqueConstraint("pay_month", name="uq_allocation_pay_month"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    pay_month: Mapped[date] = mapped_column(Date, nullable=False)
    fed_tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    state_tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    sep_contribution: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    roth_contribution: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)


class Transfer(Base):
    __tablename__ = "transfers"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    from_account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    to_account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    from_account: Mapped["Account"] = relationship(foreign_keys="[Transfer.from_account_id]")
    to_account: Mapped["Account"] = relationship(foreign_keys="[Transfer.to_account_id]")


class AccountCredit(Base):
    __tablename__ = "account_credits"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    credit_type: Mapped[str] = mapped_column(String(50), nullable=False, default="cashback")
    category: Mapped[str | None] = mapped_column(String(100))

    account: Mapped["Account"] = relationship(back_populates="credits")


class SavingsGoal(Base):
    __tablename__ = "savings_goals"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    current_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id"))
    target_date: Mapped[date | None] = mapped_column(Date)

    account: Mapped["Account | None"] = relationship(back_populates="savings_goals")


class CategoryRule(Base):
    __tablename__ = "category_rules"

    name: Mapped[str] = mapped_column(String(100), primary_key=True)
    exclude_from_spend: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    exclude_from_trends: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
