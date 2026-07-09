import calendar
import datetime
from decimal import Decimal

from sqlalchemy import extract, func, select, update
from sqlalchemy.orm import Session

from .models import (
    Account, AccountCredit, Allocation, CategoryRule, FixedBill,
    IncomePeriod, LedgerEntry, Merchant, PromoAprWindow, RewardRule, Transaction, Transfer,
)
from .schemas import (
    AccountCreate, AccountUpdate,
    AllocationCreate,
    CategoryRuleUpdate,
    FixedBillCreate, FixedBillUpdate,
    FixedBillPaymentCreate,
    IncomePeriodCreate, IncomePeriodUpdate,
    LedgerEntryCreate, LedgerEntryUpdate, LedgerBulkCreate, TransferPairCreate,
    PromoAprWindowCreate, PromoAprWindowUpdate,
    RewardRuleCreate, RewardRuleUpdate,
    WaterfallOut,
)


# ── Balance computation ────────────────────────────────────────────────────────

def recompute_balance(db: Session, account_id: str) -> None:
    acct = db.get(Account, account_id)
    if not acct:
        return

    opening = acct.opening_balance

    if acct.type == "credit_card":
        # expenses increase balance (more owed); payments and credits decrease it
        pos = db.scalar(
            select(func.coalesce(func.sum(LedgerEntry.amount), 0))
            .where(LedgerEntry.account_id == account_id, LedgerEntry.type == "expense")
        ) or Decimal("0")
        neg = db.scalar(
            select(func.coalesce(func.sum(LedgerEntry.amount), 0))
            .where(LedgerEntry.account_id == account_id, LedgerEntry.type.in_(["transfer_in", "credit"]))
        ) or Decimal("0")
    else:
        pos = db.scalar(
            select(func.coalesce(func.sum(LedgerEntry.amount), 0))
            .where(LedgerEntry.account_id == account_id, LedgerEntry.type.in_(["income", "transfer_in", "credit"]))
        ) or Decimal("0")
        neg = db.scalar(
            select(func.coalesce(func.sum(LedgerEntry.amount), 0))
            .where(LedgerEntry.account_id == account_id, LedgerEntry.type.in_(["expense", "transfer_out"]))
        ) or Decimal("0")

    acct.current_balance = opening + pos - neg


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
        current_balance=data.opening_balance,
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

    if data.reconcile_to is not None:
        delta = data.reconcile_to - account.current_balance
        account.opening_balance = account.opening_balance + delta
    elif data.opening_balance is not None:
        account.opening_balance = data.opening_balance

    for field in ("name", "apr", "credit_limit", "statement_close_day", "due_day", "autopay", "annual_fee", "annual_fee_month", "last_4", "is_active"):
        value = getattr(data, field, None)
        if value is not None:
            setattr(account, field, value)

    db.flush()
    recompute_balance(db, account_id)
    db.commit()
    db.refresh(account)
    return account


# ── Ledger ─────────────────────────────────────────────────────────────────────

def _with_counterparts(db: Session, entries: list[LedgerEntry]) -> list[dict]:
    """Add counterpart_account_id to transfer entries."""
    linked_ids = [e.linked_entry_id for e in entries if e.linked_entry_id]
    counterpart_map: dict[str, str] = {}
    if linked_ids:
        rows = db.execute(
            select(LedgerEntry.id, LedgerEntry.account_id)
            .where(LedgerEntry.id.in_(linked_ids))
        ).all()
        counterpart_map = {r.id: r.account_id for r in rows}

    result = []
    for e in entries:
        result.append({
            "id": e.id,
            "date": e.date,
            "account_id": e.account_id,
            "amount": e.amount,
            "type": e.type,
            "merchant": e.merchant,
            "merchant_id": e.merchant_id,
            "category": e.category,
            "tag": e.tag,
            "subtype": e.subtype,
            "period_id": e.period_id,
            "bill_id": e.bill_id,
            "reward_rule_id": e.reward_rule_id,
            "linked_entry_id": e.linked_entry_id,
            "notes": e.notes,
            "counterpart_account_id": counterpart_map.get(e.linked_entry_id) if e.linked_entry_id else None,
        })
    return result


def get_ledger(
    db: Session,
    start: datetime.date | None = None,
    end: datetime.date | None = None,
    account_id: str | None = None,
    entry_type: str | None = None,
    category: str | None = None,
    merchant: str | None = None,
    limit: int = 1000,
    offset: int = 0,
) -> list[dict]:
    q = select(LedgerEntry).order_by(LedgerEntry.date.desc(), LedgerEntry.id.desc())
    if start:
        q = q.where(LedgerEntry.date >= start)
    if end:
        q = q.where(LedgerEntry.date <= end)
    if account_id:
        q = q.where(LedgerEntry.account_id == account_id)
    if entry_type:
        q = q.where(LedgerEntry.type == entry_type)
    if category:
        q = q.where(LedgerEntry.category == category)
    if merchant:
        q = q.where(LedgerEntry.merchant == merchant)
    entries = list(db.scalars(q.limit(limit).offset(offset)).all())
    return _with_counterparts(db, entries)


def create_ledger_entry(db: Session, data: LedgerEntryCreate) -> dict:
    entry = LedgerEntry(**data.model_dump())
    db.add(entry)

    if data.type == "expense" and data.merchant:
        _sync_merchant(db, entry, data.merchant, data.category)

    db.flush()
    recompute_balance(db, data.account_id)
    db.commit()
    db.refresh(entry)
    return _with_counterparts(db, [entry])[0]


def create_transfer_pair(db: Session, data: TransferPairCreate) -> list[dict]:
    out_id = _uuid()
    in_id = _uuid()
    desc = data.description or "Transfer"

    out_entry = LedgerEntry(
        id=out_id,
        date=data.date,
        account_id=data.from_account_id,
        amount=data.amount,
        type="transfer_out",
        notes=desc,
        linked_entry_id=in_id,
    )
    in_entry = LedgerEntry(
        id=in_id,
        date=data.date,
        account_id=data.to_account_id,
        amount=data.amount,
        type="transfer_in",
        notes=desc,
        linked_entry_id=out_id,
    )
    db.add(out_entry)
    db.add(in_entry)
    db.flush()
    recompute_balance(db, data.from_account_id)
    recompute_balance(db, data.to_account_id)
    db.commit()
    return _with_counterparts(db, [out_entry, in_entry])


def update_ledger_entry(db: Session, entry_id: str, data: LedgerEntryUpdate) -> dict | None:
    entry = db.get(LedgerEntry, entry_id)
    if not entry:
        return None

    old_account_id = entry.account_id
    updates = data.model_dump(exclude_none=True)

    for field, value in updates.items():
        setattr(entry, field, value)

    if entry.type == "expense" and ("merchant" in updates or "category" in updates):
        _sync_merchant(db, entry, entry.merchant, entry.category)

    # sync the linked transfer entry (amount, date, notes)
    if entry.linked_entry_id and entry.type in ("transfer_out", "transfer_in"):
        linked = db.get(LedgerEntry, entry.linked_entry_id)
        if linked:
            if "amount" in updates:
                linked.amount = entry.amount
            if "date" in updates:
                linked.date = entry.date
            if "notes" in updates:
                linked.notes = entry.notes

    db.flush()
    affected = {old_account_id, entry.account_id}
    if entry.linked_entry_id:
        linked = db.get(LedgerEntry, entry.linked_entry_id)
        if linked:
            affected.add(linked.account_id)
    for aid in affected:
        recompute_balance(db, aid)
    db.commit()
    db.refresh(entry)
    return _with_counterparts(db, [entry])[0]


def delete_ledger_entry(db: Session, entry_id: str) -> bool:
    entry = db.get(LedgerEntry, entry_id)
    if not entry:
        return False

    affected = {entry.account_id}
    linked_id = entry.linked_entry_id

    db.delete(entry)
    db.flush()

    if linked_id:
        linked = db.get(LedgerEntry, linked_id)
        if linked:
            affected.add(linked.account_id)
            db.delete(linked)
            db.flush()

    for aid in affected:
        recompute_balance(db, aid)
    db.commit()
    return True


def bulk_create_ledger_entries(db: Session, entries: list[LedgerEntryCreate]) -> int:
    affected: set[str] = set()
    for data in entries:
        entry = LedgerEntry(**data.model_dump())
        db.add(entry)
        if data.type == "expense" and data.merchant:
            _sync_merchant(db, entry, data.merchant, data.category)
        affected.add(data.account_id)
    db.flush()
    for aid in affected:
        recompute_balance(db, aid)
    db.commit()
    return len(entries)


def _uuid() -> str:
    import uuid
    return str(uuid.uuid4())


# ── Merchant helpers ───────────────────────────────────────────────────────────

def _sync_merchant(db: Session, entry: LedgerEntry, merchant_name: str | None, category: str | None) -> None:
    if not merchant_name:
        return
    merchant = db.scalars(select(Merchant).where(Merchant.name == merchant_name)).first()
    if merchant:
        if category:
            merchant.default_category = category
        entry.merchant_id = merchant.id
    else:
        merchant = Merchant(name=merchant_name, default_category=category)
        db.add(merchant)
        db.flush()
        entry.merchant_id = merchant.id


# ── Type-ahead ─────────────────────────────────────────────────────────────────

def get_categories(db: Session) -> list[str]:
    rows = db.scalars(
        select(LedgerEntry.category)
        .where(LedgerEntry.type == "expense", LedgerEntry.category.isnot(None))
        .distinct()
        .order_by(LedgerEntry.category)
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
        db.execute(update(LedgerEntry).where(LedgerEntry.merchant == merchant.name).values(merchant=name))
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
    db.execute(update(LedgerEntry).where(LedgerEntry.merchant_id == merchant_id).values(merchant_id=None))
    db.delete(merchant)
    db.commit()
    return True


def rename_category(db: Session, old_name: str, new_name: str) -> int:
    result = db.execute(
        update(LedgerEntry).where(LedgerEntry.category == old_name).values(category=new_name)
    )
    old_rule = db.get(CategoryRule, old_name)
    if old_rule:
        new_rule = db.get(CategoryRule, new_name)
        if new_rule is None:
            new_rule = CategoryRule(name=new_name)
            db.add(new_rule)
        new_rule.exclude_from_spend = old_rule.exclude_from_spend
        new_rule.exclude_from_trends = old_rule.exclude_from_trends
        db.delete(old_rule)
    db.commit()
    return result.rowcount


def get_category_stats(db: Session) -> list[dict]:
    rows = db.execute(
        select(
            LedgerEntry.category,
            func.count(LedgerEntry.id).label("count"),
            func.sum(LedgerEntry.amount).label("total"),
            func.coalesce(CategoryRule.exclude_from_spend, False).label("exclude_from_spend"),
            func.coalesce(CategoryRule.exclude_from_trends, False).label("exclude_from_trends"),
        )
        .where(LedgerEntry.type == "expense", LedgerEntry.category.isnot(None))
        .outerjoin(CategoryRule, LedgerEntry.category == CategoryRule.name)
        .group_by(
            LedgerEntry.category,
            CategoryRule.exclude_from_spend,
            CategoryRule.exclude_from_trends,
        )
        .order_by(LedgerEntry.category)
    ).all()
    return [
        {
            "name": r.category,
            "count": r.count,
            "total": float(r.total),
            "exclude_from_spend": r.exclude_from_spend,
            "exclude_from_trends": r.exclude_from_trends,
        }
        for r in rows
    ]


def upsert_category_rule(db: Session, name: str, data: CategoryRuleUpdate) -> CategoryRule:
    rule = db.get(CategoryRule, name)
    if rule is None:
        rule = CategoryRule(name=name)
        db.add(rule)
    if data.exclude_from_spend is not None:
        rule.exclude_from_spend = data.exclude_from_spend
    if data.exclude_from_trends is not None:
        rule.exclude_from_trends = data.exclude_from_trends
    db.commit()
    db.refresh(rule)
    return rule


def get_merchant_stats(db: Session) -> list[dict]:
    rows = db.execute(
        select(
            Merchant.id,
            Merchant.name,
            Merchant.default_category,
            func.count(LedgerEntry.id).label("count"),
        )
        .outerjoin(LedgerEntry, (LedgerEntry.merchant == Merchant.name) & (LedgerEntry.type == "expense"))
        .group_by(Merchant.id, Merchant.name, Merchant.default_category)
        .order_by(Merchant.name)
    ).all()
    return [{"id": r.id, "name": r.name, "default_category": r.default_category, "count": r.count} for r in rows]


# ── Waterfall ──────────────────────────────────────────────────────────────────

def get_waterfall(db: Session, pay_month: datetime.date, daily_budget: Decimal = Decimal("75")) -> WaterfallOut:
    DAILY_FIXED = daily_budget

    gross = db.scalar(
        select(func.coalesce(func.sum(LedgerEntry.amount), 0)).where(
            LedgerEntry.type == "income",
            extract("year", LedgerEntry.date) == pay_month.year,
            extract("month", LedgerEntry.date) == pay_month.month,
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

    excluded_cats = db.scalars(
        select(CategoryRule.name).where(CategoryRule.exclude_from_spend == True)  # noqa: E712
    ).all()

    spent_q = select(func.coalesce(func.sum(LedgerEntry.amount), 0)).where(
        LedgerEntry.type == "expense",
        LedgerEntry.bill_id.is_(None),
        extract("year", LedgerEntry.date) == pay_month.year,
        extract("month", LedgerEntry.date) == pay_month.month,
    )
    if excluded_cats:
        spent_q = spent_q.where(LedgerEntry.category.notin_(excluded_cats))
    spent = db.scalar(spent_q) or Decimal("0")

    today = datetime.date.today()
    days_in_month = calendar.monthrange(pay_month.year, pay_month.month)[1]
    is_current = pay_month.year == today.year and pay_month.month == today.month
    is_past = (pay_month.year, pay_month.month) < (today.year, today.month)

    if is_current:
        days_left = max(days_in_month - today.day + 1, 1)
    elif is_past:
        days_left = 0
    else:
        days_left = days_in_month

    remaining = max_spend - spent
    dynamic_daily = (remaining / days_left).quantize(Decimal("0.01")) if days_left > 0 else Decimal("0")

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


def _entry_to_payment_dict(entry: LedgerEntry, bill_name: str) -> dict:
    return {
        "id": entry.id,
        "bill_id": entry.bill_id,
        "paid_date": entry.date,
        "paid_amount": entry.amount,
        "period_month": entry.date.replace(day=1),
        "bill_name": bill_name,
        "account_id": entry.account_id,
    }


def get_bill_payments(db: Session, bill_id: str, month: datetime.date | None = None) -> list[dict]:
    q = (
        select(LedgerEntry, FixedBill.name.label("bill_name"))
        .join(FixedBill, LedgerEntry.bill_id == FixedBill.id)
        .where(LedgerEntry.bill_id == bill_id, LedgerEntry.type == "expense")
        .order_by(LedgerEntry.date.desc())
    )
    if month:
        q = q.where(
            extract("year", LedgerEntry.date) == month.year,
            extract("month", LedgerEntry.date) == month.month,
        )
    return [_entry_to_payment_dict(entry, bill_name) for entry, bill_name in db.execute(q).all()]


def get_all_bill_payments(
    db: Session,
    month: datetime.date | None = None,
    account_id: str | None = None,
    start: datetime.date | None = None,
    end: datetime.date | None = None,
) -> list[dict]:
    q = (
        select(LedgerEntry, FixedBill.name.label("bill_name"))
        .join(FixedBill, LedgerEntry.bill_id == FixedBill.id)
        .where(LedgerEntry.type == "expense", LedgerEntry.bill_id.isnot(None))
        .order_by(LedgerEntry.date.desc())
    )
    if month:
        q = q.where(
            extract("year", LedgerEntry.date) == month.year,
            extract("month", LedgerEntry.date) == month.month,
        )
    if account_id:
        q = q.where(LedgerEntry.account_id == account_id)
    if start:
        q = q.where(LedgerEntry.date >= start)
    if end:
        q = q.where(LedgerEntry.date <= end)
    return [_entry_to_payment_dict(entry, bill_name) for entry, bill_name in db.execute(q).all()]


def record_payment(db: Session, bill_id: str, data: FixedBillPaymentCreate) -> dict:
    bill = db.get(FixedBill, bill_id)
    if not bill:
        raise ValueError(f"Bill {bill_id} not found")

    category = bill.category or bill.name
    merchant_name = bill.merchant or bill.name

    entry = LedgerEntry(
        date=data.paid_date,
        account_id=bill.account_id,
        amount=data.paid_amount,
        type="expense",
        category=category,
        merchant=merchant_name,
        tag="fixed",
        bill_id=bill_id,
    )
    db.add(entry)
    _sync_merchant(db, entry, merchant_name, category)

    db.flush()
    recompute_balance(db, bill.account_id)
    db.commit()
    db.refresh(entry)
    return _entry_to_payment_dict(entry, bill.name)


def delete_bill_payment(db: Session, payment_id: str) -> bool:
    return delete_ledger_entry(db, payment_id)


# ── Income Periods ─────────────────────────────────────────────────────────────

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


def update_income_period(db: Session, period_id: str, data: IncomePeriodUpdate) -> IncomePeriod | None:
    period = db.get(IncomePeriod, period_id)
    if not period:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(period, field, value)
    db.commit()
    db.refresh(period)
    return period


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


# ── Promo APR Windows ──────────────────────────────────────────────────────────

def get_promo_windows(db: Session, account_id: str | None = None) -> list[PromoAprWindow]:
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


def update_promo_window(db: Session, window_id: str, data: PromoAprWindowUpdate) -> PromoAprWindow | None:
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


# ── Reward Rules ───────────────────────────────────────────────────────────────

def get_reward_rules(db: Session, account_id: str | None = None) -> list:
    q = select(RewardRule)
    if account_id:
        q = q.where(RewardRule.account_id == account_id)
    return list(db.scalars(q.order_by(RewardRule.account_id, RewardRule.category)).all())


def create_reward_rule(db: Session, data: RewardRuleCreate) -> RewardRule:
    from uuid import uuid4
    rule = RewardRule(
        id=str(uuid4()),
        account_id=data.account_id,
        category=data.category,
        rate=data.rate,
        is_rotating=data.is_rotating,
        promo_start_date=data.promo_start_date,
        promo_end_date=data.promo_end_date,
        spending_cap=data.spending_cap,
        amount_used=data.amount_used,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def update_reward_rule(db: Session, rule_id: str, data: RewardRuleUpdate) -> RewardRule | None:
    rule = db.get(RewardRule, rule_id)
    if not rule:
        return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return rule


def delete_reward_rule(db: Session, rule_id: str) -> bool:
    rule = db.get(RewardRule, rule_id)
    if not rule:
        return False
    db.delete(rule)
    db.commit()
    return True


# ── Annual Summary ─────────────────────────────────────────────────────────────

def get_annual_summary(db: Session, year: int) -> list[dict]:
    today = datetime.date.today()
    result = []
    for mo in range(1, 13):
        month = datetime.date(year, mo, 1)
        if month > today.replace(day=1):
            break
        w = get_waterfall(db, month)
        total_spend = float(w.spent_to_date + w.fixed_bills_total)
        net = float(w.net_income)
        savings_rate = round((net - total_spend) / net * 100, 1) if net > 0 else 0.0
        result.append({
            "month": f"{year}-{mo:02d}",
            "gross_income": float(w.gross_income),
            "net_income": net,
            "total_spend": total_spend,
            "sep_contribution": float(w.sep_contribution),
            "roth_contribution": float(w.roth_contribution),
            "savings_rate": savings_rate,
        })
    return result
