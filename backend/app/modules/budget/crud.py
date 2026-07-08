import calendar
import datetime
from decimal import Decimal

from sqlalchemy import extract, func, select, update
from sqlalchemy.orm import Session

from .models import (
    Account, AccountCredit, Allocation, FixedBill,
    IncomeEntry, IncomePeriod, Merchant, PromoAprWindow, Transaction, Transfer,
)
from .schemas import (
    AccountCreate, AccountUpdate,
    TransactionCreate, TransactionUpdate,
    WaterfallOut,
    FixedBillCreate, FixedBillUpdate,
    FixedBillPaymentCreate,
    IncomePeriodCreate, IncomePeriodUpdate,
    IncomeEntryCreate, IncomeEntryUpdate,
    AllocationCreate,
    AccountCreditCreate, AccountCreditUpdate,
    PromoAprWindowCreate, PromoAprWindowUpdate,
    TransferCreate, TransferUpdate,
)


# ── Balance computation ────────────────────────────────────────────────────────

def recompute_balance(db: Session, account_id: str) -> None:
    """Recalculate current_balance from all ledger sources. Call before db.commit()."""
    acct = db.get(Account, account_id)
    if not acct:
        return

    opening = acct.opening_balance

    # all spending transactions charged to this account (includes bill transactions)
    spent = db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(Transaction.account_id == account_id)
    ) or Decimal("0")

    # money transferred out of this account
    xfer_out = db.scalar(
        select(func.coalesce(func.sum(Transfer.amount), 0))
        .where(Transfer.from_account_id == account_id)
    ) or Decimal("0")

    # money transferred into this account
    xfer_in = db.scalar(
        select(func.coalesce(func.sum(Transfer.amount), 0))
        .where(Transfer.to_account_id == account_id)
    ) or Decimal("0")

    # income deposited into this account
    income = db.scalar(
        select(func.coalesce(func.sum(IncomeEntry.amount), 0))
        .where(IncomeEntry.to_account_id == account_id)
    ) or Decimal("0")

    # statement credits / cashback applied to this account
    credits = db.scalar(
        select(func.coalesce(func.sum(AccountCredit.amount), 0))
        .where(AccountCredit.account_id == account_id)
    ) or Decimal("0")

    if acct.type == "credit_card":
        acct.current_balance = opening + spent - xfer_in - credits
    else:
        acct.current_balance = opening + income - spent - xfer_out + xfer_in + credits


def recompute_all_balances(db: Session) -> None:
    accounts = list(db.scalars(select(Account)).all())
    for acct in accounts:
        recompute_balance(db, acct.id)


# ── Accounts ───────────────────────────────────────────────────────────────────

def get_accounts(db: Session, active_only: bool = True) -> list[Account]:
    q = select(Account)
    if active_only:
        q = q.where(Account.is_active == True)  # noqa: E712
    return list(db.scalars(q).all())


def get_account(db: Session, account_id: str) -> Account | None:
    return db.get(Account, account_id)


def create_account(db: Session, data: AccountCreate) -> Account:
    account = Account(
        name=data.name,
        type=data.type,
        credit_limit=data.credit_limit,
        opening_balance=data.opening_balance,
        current_balance=data.opening_balance,  # starts equal to opening; no transactions yet
        apr=data.apr,
        statement_close_day=data.statement_close_day,
        due_day=data.due_day,
        is_active=data.is_active,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def update_account(db: Session, account_id: str, data: AccountUpdate) -> Account | None:
    account = db.get(Account, account_id)
    if not account:
        return None

    # reconcile_to: back-calculate opening_balance to produce the desired current_balance
    if data.reconcile_to is not None:
        delta = data.reconcile_to - account.current_balance
        account.opening_balance = account.opening_balance + delta
    elif data.opening_balance is not None:
        account.opening_balance = data.opening_balance

    for field in ("name", "apr", "credit_limit", "statement_close_day", "due_day", "is_active"):
        value = getattr(data, field, None)
        if value is not None:
            setattr(account, field, value)

    db.flush()
    recompute_balance(db, account_id)
    db.commit()
    db.refresh(account)
    return account


# ── Transactions ───────────────────────────────────────────────────────────────

def get_transactions(
    db: Session,
    start: datetime.date | None = None,
    end: datetime.date | None = None,
    account_id: str | None = None,
    category: str | None = None,
    merchant: str | None = None,
    limit: int = 500,
    offset: int = 0,
) -> list[Transaction]:
    q = select(Transaction).order_by(Transaction.date.desc())
    if start:
        q = q.where(Transaction.date >= start)
    if end:
        q = q.where(Transaction.date <= end)
    if account_id:
        q = q.where(Transaction.account_id == account_id)
    if category:
        q = q.where(Transaction.category == category)
    if merchant:
        q = q.where(Transaction.merchant == merchant)
    return list(db.scalars(q.limit(limit).offset(offset)).all())


def get_transaction(db: Session, transaction_id: str) -> Transaction | None:
    return db.get(Transaction, transaction_id)


def create_transaction(
    db: Session, data: TransactionCreate, update_balance: bool = True
) -> Transaction:
    txn = Transaction(**data.model_dump())
    db.add(txn)

    merchant = db.scalars(
        select(Merchant).where(Merchant.name == data.merchant)
    ).first()
    if merchant:
        merchant.default_category = data.category
        txn.merchant_id = merchant.id
    else:
        merchant = Merchant(name=data.merchant, default_category=data.category)
        db.add(merchant)
        db.flush()
        txn.merchant_id = merchant.id

    db.flush()
    if update_balance:
        recompute_balance(db, data.account_id)
    db.commit()
    db.refresh(txn)
    return txn


def update_transaction(
    db: Session, transaction_id: str, data: TransactionUpdate
) -> Transaction | None:
    txn = db.get(Transaction, transaction_id)
    if not txn:
        return None

    old_account_id = txn.account_id
    updates = data.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(txn, field, value)

    # keep merchant.default_category in sync when category or merchant changes
    if 'category' in updates or 'merchant' in updates:
        merchant = db.scalars(select(Merchant).where(Merchant.name == txn.merchant)).first()
        if merchant:
            merchant.default_category = txn.category

    db.flush()
    affected = {old_account_id, txn.account_id}
    for aid in affected:
        recompute_balance(db, aid)
    db.commit()
    db.refresh(txn)
    return txn


def bulk_create_transactions(db: Session, items: list[TransactionCreate]) -> int:
    affected_accounts: set[str] = set()
    for data in items:
        txn = Transaction(**data.model_dump())
        db.add(txn)
        merchant = db.scalars(
            select(Merchant).where(Merchant.name == data.merchant)
        ).first()
        if merchant:
            merchant.default_category = data.category
            txn.merchant_id = merchant.id
        else:
            merchant = Merchant(name=data.merchant, default_category=data.category)
            db.add(merchant)
            db.flush()
            txn.merchant_id = merchant.id
        affected_accounts.add(data.account_id)
    db.flush()
    for aid in affected_accounts:
        recompute_balance(db, aid)
    db.commit()
    return len(items)


def delete_transaction(db: Session, transaction_id: str) -> bool:
    txn = db.get(Transaction, transaction_id)
    if not txn:
        return False
    account_id = txn.account_id
    db.delete(txn)
    db.flush()
    recompute_balance(db, account_id)
    db.commit()
    return True


# ── Type-ahead ─────────────────────────────────────────────────────────────────

def get_categories(db: Session) -> list[str]:
    rows = db.scalars(
        select(Transaction.category).distinct().order_by(Transaction.category)
    ).all()
    return list(rows)


def get_merchants(db: Session, q: str = "") -> list[Merchant]:
    stmt = select(Merchant).order_by(Merchant.name)
    if q:
        stmt = stmt.where(Merchant.name.ilike(f"%{q}%"))
    return list(db.scalars(stmt.limit(20)).all())


def update_merchant(db: Session, merchant_id: str, name: str | None, default_category: str | None) -> Merchant | None:
    merchant = db.get(Merchant, merchant_id)
    if not merchant:
        return None
    if name is not None:
        # keep transaction.merchant strings in sync
        db.execute(update(Transaction).where(Transaction.merchant == merchant.name).values(merchant=name))
        merchant.name = name
    if default_category is not None:
        merchant.default_category = default_category or None
    db.commit()
    db.refresh(merchant)
    return merchant


def delete_merchant(db: Session, merchant_id: str) -> bool:
    merchant = db.get(Merchant, merchant_id)
    if not merchant:
        return False
    # detach transactions from this merchant record (don't delete the transactions)
    db.execute(update(Transaction).where(Transaction.merchant_id == merchant_id).values(merchant_id=None))
    db.delete(merchant)
    db.commit()
    return True


def rename_category(db: Session, old_name: str, new_name: str) -> int:
    result = db.execute(
        update(Transaction).where(Transaction.category == old_name).values(category=new_name)
    )
    db.commit()
    return result.rowcount


def get_category_stats(db: Session) -> list[dict]:
    rows = db.execute(
        select(
            Transaction.category,
            func.count(Transaction.id).label("count"),
            func.sum(Transaction.amount).label("total"),
        )
        .group_by(Transaction.category)
        .order_by(Transaction.category)
    ).all()
    return [{"name": r.category, "count": r.count, "total": float(r.total)} for r in rows]


def get_merchant_stats(db: Session) -> list[dict]:
    rows = db.execute(
        select(
            Merchant.id,
            Merchant.name,
            Merchant.default_category,
            func.count(Transaction.id).label("count"),
        )
        .outerjoin(Transaction, Transaction.merchant == Merchant.name)
        .group_by(Merchant.id, Merchant.name, Merchant.default_category)
        .order_by(Merchant.name)
    ).all()
    return [{"id": r.id, "name": r.name, "default_category": r.default_category, "count": r.count} for r in rows]


# ── Waterfall ──────────────────────────────────────────────────────────────────

def get_waterfall(db: Session, pay_month: datetime.date) -> WaterfallOut:
    DAILY_FIXED = Decimal("75")

    gross = db.scalar(
        select(func.coalesce(func.sum(IncomeEntry.amount), 0)).where(
            extract("year", IncomeEntry.received_date) == pay_month.year,
            extract("month", IncomeEntry.received_date) == pay_month.month,
        )
    ) or Decimal("0")

    allocation = db.scalars(
        select(Allocation).where(Allocation.pay_month == pay_month)
    ).first()
    fed = allocation.fed_tax if allocation else Decimal("0")
    state = allocation.state_tax if allocation else Decimal("0")
    sep = allocation.sep_contribution if allocation else Decimal("0")
    roth = allocation.roth_contribution if allocation else Decimal("0")

    net = gross - fed - state - sep
    after_save = net - roth

    fixed_total = db.scalar(
        select(func.coalesce(func.sum(FixedBill.expected_amount), 0)).where(
            FixedBill.is_active == True  # noqa: E712
        )
    ) or Decimal("0")

    after_fixed = after_save - fixed_total
    max_spend = min(
        Decimal(calendar.monthrange(pay_month.year, pay_month.month)[1]) * DAILY_FIXED,
        after_fixed,
    )

    # exclude bill transactions — those are budgeted via fixed_bills_total above
    spent = db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.bill_id == None,  # noqa: E711
            extract("year", Transaction.date) == pay_month.year,
            extract("month", Transaction.date) == pay_month.month,
        )
    ) or Decimal("0")

    today = datetime.date.today()
    days_in_month = calendar.monthrange(pay_month.year, pay_month.month)[1]
    if pay_month.year == today.year and pay_month.month == today.month:
        days_left = max(days_in_month - today.day + 1, 1)
    else:
        days_left = days_in_month

    remaining = max_spend - spent
    dynamic_daily = (remaining / days_left).quantize(Decimal("0.01"))

    return WaterfallOut(
        pay_month=pay_month,
        gross_income=gross,
        fed_tax=fed,
        state_tax=state,
        sep_contribution=sep,
        net_income=net,
        roth_contribution=roth,
        after_save=after_save,
        fixed_bills_total=fixed_total,
        after_fixed=after_fixed,
        max_spend=max_spend,
        spent_to_date=spent,
        remaining=remaining,
        daily_allowance_fixed=DAILY_FIXED,
        daily_allowance_dynamic=dynamic_daily,
        days_in_month=days_in_month,
        days_left=days_left,
    )


# ── Fixed Bills ────────────────────────────────────────────────────────────────

def get_bills(db: Session, active_only: bool = False) -> list[FixedBill]:
    q = select(FixedBill).order_by(FixedBill.due_day)
    if active_only:
        q = q.where(FixedBill.is_active == True)  # noqa: E712
    return list(db.scalars(q).all())


def create_bill(db: Session, data: FixedBillCreate) -> FixedBill:
    bill = FixedBill(**data.model_dump())
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return bill


def update_bill(db: Session, bill_id: str, data: FixedBillUpdate) -> FixedBill | None:
    bill = db.get(FixedBill, bill_id)
    if not bill:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(bill, field, value)
    db.commit()
    db.refresh(bill)
    return bill


def _txn_to_payment_dict(txn: Transaction, bill_name: str) -> dict:
    return {
        "id": txn.id,
        "bill_id": txn.bill_id,
        "paid_date": txn.date,
        "paid_amount": txn.amount,
        "period_month": txn.date.replace(day=1),
        "bill_name": bill_name,
        "account_id": txn.account_id,
    }


def get_bill_payments(
    db: Session, bill_id: str, month: datetime.date | None = None
) -> list[dict]:
    q = (
        select(Transaction, FixedBill.name.label("bill_name"))
        .join(FixedBill, Transaction.bill_id == FixedBill.id)
        .where(Transaction.bill_id == bill_id)
        .order_by(Transaction.date.desc())
    )
    if month:
        q = q.where(
            extract("year", Transaction.date) == month.year,
            extract("month", Transaction.date) == month.month,
        )
    return [_txn_to_payment_dict(txn, bill_name) for txn, bill_name in db.execute(q).all()]


def get_all_bill_payments(
    db: Session,
    month: datetime.date | None = None,
    account_id: str | None = None,
    start: datetime.date | None = None,
    end: datetime.date | None = None,
) -> list[dict]:
    q = (
        select(Transaction, FixedBill.name.label("bill_name"))
        .join(FixedBill, Transaction.bill_id == FixedBill.id)
        .where(Transaction.bill_id != None)  # noqa: E711
        .order_by(Transaction.date.desc())
    )
    if month:
        q = q.where(
            extract("year", Transaction.date) == month.year,
            extract("month", Transaction.date) == month.month,
        )
    if account_id:
        q = q.where(Transaction.account_id == account_id)
    if start:
        q = q.where(Transaction.date >= start)
    if end:
        q = q.where(Transaction.date <= end)
    return [_txn_to_payment_dict(txn, bill_name) for txn, bill_name in db.execute(q).all()]


def record_payment(
    db: Session, bill_id: str, data: FixedBillPaymentCreate
) -> dict:
    bill = db.get(FixedBill, bill_id)
    if not bill:
        raise ValueError(f"Bill {bill_id} not found")

    category = bill.category or bill.name
    merchant_name = bill.merchant or bill.name

    txn = Transaction(
        date=data.paid_date,
        account_id=bill.account_id,
        amount=data.paid_amount,
        category=category,
        merchant=merchant_name,
        tag="fixed",
        bill_id=bill_id,
    )
    db.add(txn)

    merchant_rec = db.scalars(select(Merchant).where(Merchant.name == merchant_name)).first()
    if merchant_rec:
        merchant_rec.default_category = category
        txn.merchant_id = merchant_rec.id
    else:
        merchant_rec = Merchant(name=merchant_name, default_category=category)
        db.add(merchant_rec)
        db.flush()
        txn.merchant_id = merchant_rec.id

    db.flush()
    recompute_balance(db, bill.account_id)
    db.commit()
    db.refresh(txn)
    return _txn_to_payment_dict(txn, bill.name)


def delete_bill_payment(db: Session, payment_id: str) -> bool:
    return delete_transaction(db, payment_id)


# ── Income ─────────────────────────────────────────────────────────────────────

def get_income_periods(
    db: Session,
    work_month: datetime.date | None = None,
    pay_month: datetime.date | None = None,
) -> list[IncomePeriod]:
    q = select(IncomePeriod).order_by(IncomePeriod.work_month.desc())
    if work_month:
        q = q.where(IncomePeriod.work_month == work_month)
    if pay_month:
        q = q.where(IncomePeriod.pay_month == pay_month)
    return list(db.scalars(q).all())


def create_income_period(db: Session, data: IncomePeriodCreate) -> IncomePeriod:
    period = IncomePeriod(**data.model_dump())
    db.add(period)
    db.commit()
    db.refresh(period)
    return period


def update_income_period(
    db: Session, period_id: str, data: IncomePeriodUpdate
) -> IncomePeriod | None:
    period = db.get(IncomePeriod, period_id)
    if not period:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(period, field, value)
    db.commit()
    db.refresh(period)
    return period


def get_income_entries(
    db: Session, month: datetime.date | None = None
) -> list[IncomeEntry]:
    q = select(IncomeEntry).order_by(IncomeEntry.received_date.desc())
    if month:
        q = q.where(
            extract("year", IncomeEntry.received_date) == month.year,
            extract("month", IncomeEntry.received_date) == month.month,
        )
    return list(db.scalars(q).all())


def create_income_entry(db: Session, data: IncomeEntryCreate) -> IncomeEntry:
    entry = IncomeEntry(**data.model_dump())
    db.add(entry)
    db.flush()
    if data.to_account_id:
        recompute_balance(db, data.to_account_id)
    db.commit()
    db.refresh(entry)
    return entry


def update_income_entry(
    db: Session, entry_id: str, data: IncomeEntryUpdate
) -> IncomeEntry | None:
    entry = db.get(IncomeEntry, entry_id)
    if not entry:
        return None
    old_account_id = entry.to_account_id
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(entry, field, value)
    db.flush()
    affected = {a for a in (old_account_id, entry.to_account_id) if a}
    for aid in affected:
        recompute_balance(db, aid)
    db.commit()
    db.refresh(entry)
    return entry


def delete_income_entry(db: Session, entry_id: str) -> bool:
    entry = db.get(IncomeEntry, entry_id)
    if not entry:
        return False
    account_id = entry.to_account_id
    db.delete(entry)
    db.flush()
    if account_id:
        recompute_balance(db, account_id)
    db.commit()
    return True


# ── Allocation ─────────────────────────────────────────────────────────────────

def get_allocation(db: Session, pay_month: datetime.date) -> Allocation | None:
    return db.scalars(
        select(Allocation).where(Allocation.pay_month == pay_month)
    ).first()


def upsert_allocation(db: Session, data: AllocationCreate) -> Allocation:
    allocation = db.scalars(
        select(Allocation).where(Allocation.pay_month == data.pay_month)
    ).first()
    if allocation:
        for field, value in data.model_dump(exclude={"pay_month"}).items():
            setattr(allocation, field, value)
    else:
        allocation = Allocation(**data.model_dump())
        db.add(allocation)
    db.commit()
    db.refresh(allocation)
    return allocation


# ── Transfers ──────────────────────────────────────────────────────────────────

def get_transfers(
    db: Session,
    account_id: str | None = None,
    from_account_id: str | None = None,
    to_account_id: str | None = None,
    start: str | None = None,
    end: str | None = None,
    limit: int = 500,
) -> list[Transfer]:
    q = select(Transfer).order_by(Transfer.date.desc()).limit(limit)
    if account_id:
        q = q.where(
            (Transfer.from_account_id == account_id) | (Transfer.to_account_id == account_id)
        )
    if from_account_id:
        q = q.where(Transfer.from_account_id == from_account_id)
    if to_account_id:
        q = q.where(Transfer.to_account_id == to_account_id)
    if start:
        q = q.where(Transfer.date >= datetime.date.fromisoformat(start))
    if end:
        q = q.where(Transfer.date <= datetime.date.fromisoformat(end))
    return list(db.scalars(q).all())


def update_transfer(db: Session, transfer_id: str, data: TransferUpdate) -> Transfer | None:
    transfer = db.get(Transfer, transfer_id)
    if not transfer:
        return None
    old_from_id = transfer.from_account_id
    old_to_id = transfer.to_account_id
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(transfer, field, value)
    db.flush()
    for aid in {old_from_id, old_to_id, transfer.from_account_id, transfer.to_account_id}:
        recompute_balance(db, aid)
    db.commit()
    db.refresh(transfer)
    return transfer


def create_transfer(db: Session, data: TransferCreate) -> Transfer:
    transfer = Transfer(**data.model_dump())
    db.add(transfer)
    db.flush()
    recompute_balance(db, data.from_account_id)
    recompute_balance(db, data.to_account_id)
    db.commit()
    db.refresh(transfer)
    return transfer


def delete_transfer(db: Session, transfer_id: str) -> bool:
    transfer = db.get(Transfer, transfer_id)
    if not transfer:
        return False
    from_id = transfer.from_account_id
    to_id = transfer.to_account_id
    db.delete(transfer)
    db.flush()
    recompute_balance(db, from_id)
    recompute_balance(db, to_id)
    db.commit()
    return True


# ── Account Credits ─────────────────────────────────────────────────────────────

def get_credits(
    db: Session,
    account_id: str | None = None,
    start: str | None = None,
    end: str | None = None,
    limit: int = 500,
) -> list[AccountCredit]:
    q = select(AccountCredit).order_by(AccountCredit.date.desc()).limit(limit)
    if account_id:
        q = q.where(AccountCredit.account_id == account_id)
    if start:
        q = q.where(AccountCredit.date >= datetime.date.fromisoformat(start))
    if end:
        q = q.where(AccountCredit.date <= datetime.date.fromisoformat(end))
    return list(db.scalars(q).all())


def create_credit(db: Session, data: AccountCreditCreate) -> AccountCredit:
    credit = AccountCredit(**data.model_dump())
    db.add(credit)
    db.flush()
    recompute_balance(db, data.account_id)
    db.commit()
    db.refresh(credit)
    return credit


def update_credit(db: Session, credit_id: str, data: AccountCreditUpdate) -> AccountCredit | None:
    credit = db.get(AccountCredit, credit_id)
    if not credit:
        return None
    old_account_id = credit.account_id
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(credit, field, value)
    db.flush()
    recompute_balance(db, credit.account_id)
    if old_account_id != credit.account_id:
        recompute_balance(db, old_account_id)
    db.commit()
    db.refresh(credit)
    return credit


def delete_credit(db: Session, credit_id: str) -> bool:
    credit = db.get(AccountCredit, credit_id)
    if not credit:
        return False
    account_id = credit.account_id
    db.delete(credit)
    db.flush()
    recompute_balance(db, account_id)
    db.commit()
    return True


# ── Promo APR Windows ──────────────────────────────────────────────────────────

def get_promo_windows(
    db: Session, account_id: str | None = None
) -> list[PromoAprWindow]:
    q = select(PromoAprWindow).order_by(PromoAprWindow.promo_end_date)
    if account_id:
        q = q.where(PromoAprWindow.account_id == account_id)
    return list(db.scalars(q).all())


def create_promo_window(db: Session, data: PromoAprWindowCreate) -> PromoAprWindow:
    window = PromoAprWindow(**data.model_dump())
    db.add(window)
    db.commit()
    db.refresh(window)
    return window


def update_promo_window(
    db: Session, window_id: str, data: PromoAprWindowUpdate
) -> PromoAprWindow | None:
    window = db.get(PromoAprWindow, window_id)
    if not window:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(window, field, value)
    db.commit()
    db.refresh(window)
    return window


def delete_promo_window(db: Session, window_id: str) -> bool:
    window = db.get(PromoAprWindow, window_id)
    if not window:
        return False
    db.delete(window)
    db.commit()
    return True
