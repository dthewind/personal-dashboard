import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from . import crud
from .schemas import (
    AccountCreate, AccountOut, AccountUpdate,
    AllocationCreate, AllocationOut,
    CategoryRuleUpdate,
    FixedBillCreate, FixedBillOut, FixedBillPaymentCreate, FixedBillPaymentOut, FixedBillUpdate,
    IncomePeriodCreate, IncomePeriodOut, IncomePeriodUpdate,
    LedgerBulkCreate, LedgerEntryCreate, LedgerEntryOut, LedgerEntryUpdate,
    MerchantOut,
    PromoAprWindowCreate, PromoAprWindowOut, PromoAprWindowUpdate,
    RewardRuleCreate, RewardRuleOut, RewardRuleUpdate,
    TransferPairCreate,
    WaterfallOut,
)

router = APIRouter(prefix="/api/budget", tags=["budget"])


# ── Accounts ───────────────────────────────────────────────────────────────────

@router.get("/accounts", response_model=list[AccountOut])
def list_accounts(active_only: bool = True, db: Session = Depends(get_db)):
    return crud.get_accounts(db, active_only=active_only)


@router.post("/accounts", response_model=AccountOut, status_code=201)
def create_account(data: AccountCreate, db: Session = Depends(get_db)):
    return crud.create_account(db, data)


@router.get("/accounts/{account_id}", response_model=AccountOut)
def get_account(account_id: str, db: Session = Depends(get_db)):
    account = crud.get_account(db, account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    return account


@router.patch("/accounts/{account_id}", response_model=AccountOut)
def update_account(account_id: str, data: AccountUpdate, db: Session = Depends(get_db)):
    account = crud.update_account(db, account_id, data)
    if not account:
        raise HTTPException(404, "Account not found")
    return account


@router.post("/accounts/recompute", status_code=204)
def recompute_all(db: Session = Depends(get_db)):
    crud.recompute_all_balances(db)
    db.commit()


# ── Ledger ─────────────────────────────────────────────────────────────────────

@router.get("/ledger", response_model=list[LedgerEntryOut])
def list_ledger(
    start: datetime.date | None = None,
    end: datetime.date | None = None,
    account_id: str | None = None,
    type: str | None = None,
    category: str | None = None,
    merchant: str | None = None,
    limit: int = 1000,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    return crud.get_ledger(
        db, start=start, end=end, account_id=account_id,
        entry_type=type, category=category, merchant=merchant,
        limit=limit, offset=offset,
    )


@router.post("/ledger", response_model=LedgerEntryOut, status_code=201)
def create_ledger_entry(data: LedgerEntryCreate, db: Session = Depends(get_db)):
    return crud.create_ledger_entry(db, data)


@router.post("/ledger/transfer", response_model=list[LedgerEntryOut], status_code=201)
def create_transfer(data: TransferPairCreate, db: Session = Depends(get_db)):
    return crud.create_transfer_pair(db, data)


@router.post("/ledger/bulk", status_code=201)
def bulk_create_ledger(data: LedgerBulkCreate, db: Session = Depends(get_db)):
    count = crud.bulk_create_ledger_entries(db, data.entries)
    return {"created": count}


@router.patch("/ledger/{entry_id}", response_model=LedgerEntryOut)
def update_ledger_entry(entry_id: str, data: LedgerEntryUpdate, db: Session = Depends(get_db)):
    result = crud.update_ledger_entry(db, entry_id, data)
    if not result:
        raise HTTPException(404, "Entry not found")
    return result


@router.delete("/ledger/{entry_id}", status_code=204)
def delete_ledger_entry(entry_id: str, db: Session = Depends(get_db)):
    if not crud.delete_ledger_entry(db, entry_id):
        raise HTTPException(404, "Entry not found")


# ── Type-ahead ─────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[str])
def list_categories(db: Session = Depends(get_db)):
    return crud.get_categories(db)


@router.get("/category-stats")
def get_category_stats(db: Session = Depends(get_db)):
    return crud.get_category_stats(db)


@router.post("/categories/rename")
def rename_category(body: dict, db: Session = Depends(get_db)):
    old = body.get("old_name", "").strip()
    new = body.get("new_name", "").strip()
    if not old or not new:
        raise HTTPException(400, "old_name and new_name required")
    count = crud.rename_category(db, old, new)
    return {"updated": count}


@router.patch("/categories/{name}/rules")
def upsert_category_rule(name: str, data: CategoryRuleUpdate, db: Session = Depends(get_db)):
    return crud.upsert_category_rule(db, name, data)


@router.get("/merchant-stats")
def get_merchant_stats(db: Session = Depends(get_db)):
    return crud.get_merchant_stats(db)


@router.patch("/merchants/{merchant_id}")
def update_merchant(merchant_id: str, body: dict, db: Session = Depends(get_db)):
    result = crud.update_merchant(
        db, merchant_id,
        name=body.get("name"),
        default_category=body.get("default_category"),
    )
    if not result:
        raise HTTPException(404, "Merchant not found")
    return {"id": result.id, "name": result.name, "default_category": result.default_category}


@router.delete("/merchants/{merchant_id}", status_code=204)
def delete_merchant(merchant_id: str, db: Session = Depends(get_db)):
    if not crud.delete_merchant(db, merchant_id):
        raise HTTPException(404, "Merchant not found")


@router.get("/merchants", response_model=list[MerchantOut])
def list_merchants(q: str = "", db: Session = Depends(get_db)):
    return crud.get_merchants(db, q=q)


# ── Dashboard ──────────────────────────────────────────────────────────────────

@router.get("/waterfall", response_model=WaterfallOut)
def get_waterfall(month: datetime.date | None = None, db: Session = Depends(get_db)):
    pay_month = month or datetime.date.today().replace(day=1)
    return crud.get_waterfall(db, pay_month)


# ── Fixed Bills ────────────────────────────────────────────────────────────────

@router.get("/bills", response_model=list[FixedBillOut])
def list_bills(active_only: bool = False, db: Session = Depends(get_db)):
    return crud.get_bills(db, active_only=active_only)


@router.post("/bills", response_model=FixedBillOut, status_code=201)
def create_bill(data: FixedBillCreate, db: Session = Depends(get_db)):
    return crud.create_bill(db, data)


@router.patch("/bills/{bill_id}", response_model=FixedBillOut)
def update_bill(bill_id: str, data: FixedBillUpdate, db: Session = Depends(get_db)):
    bill = crud.update_bill(db, bill_id, data)
    if not bill:
        raise HTTPException(404, "Bill not found")
    return bill


@router.get("/bills/payments", response_model=list[FixedBillPaymentOut])
def list_all_payments(
    month: datetime.date | None = None,
    account_id: str | None = None,
    start: datetime.date | None = None,
    end: datetime.date | None = None,
    db: Session = Depends(get_db),
):
    return crud.get_all_bill_payments(db, month=month, account_id=account_id, start=start, end=end)


@router.get("/bills/{bill_id}/payments", response_model=list[FixedBillPaymentOut])
def list_payments(bill_id: str, month: datetime.date | None = None, db: Session = Depends(get_db)):
    return crud.get_bill_payments(db, bill_id, month=month)


@router.post("/bills/{bill_id}/payments", response_model=FixedBillPaymentOut, status_code=201)
def record_payment(bill_id: str, data: FixedBillPaymentCreate, db: Session = Depends(get_db)):
    return crud.record_payment(db, bill_id, data)


@router.delete("/bills/{bill_id}/payments/{payment_id}", status_code=204)
def delete_payment(bill_id: str, payment_id: str, db: Session = Depends(get_db)):
    if not crud.delete_bill_payment(db, payment_id):
        raise HTTPException(404, "Payment not found")


# ── Income Periods ─────────────────────────────────────────────────────────────

@router.get("/income/periods", response_model=list[IncomePeriodOut])
def list_income_periods(
    work_month: datetime.date | None = None,
    pay_month: datetime.date | None = None,
    db: Session = Depends(get_db),
):
    return crud.get_income_periods(db, work_month=work_month, pay_month=pay_month)


@router.post("/income/periods", response_model=IncomePeriodOut, status_code=201)
def create_income_period(data: IncomePeriodCreate, db: Session = Depends(get_db)):
    return crud.create_income_period(db, data)


@router.patch("/income/periods/{period_id}", response_model=IncomePeriodOut)
def update_income_period(period_id: str, data: IncomePeriodUpdate, db: Session = Depends(get_db)):
    period = crud.update_income_period(db, period_id, data)
    if not period:
        raise HTTPException(404, "Income period not found")
    return period


# ── Allocation ─────────────────────────────────────────────────────────────────

@router.get("/allocation", response_model=AllocationOut | None)
def get_allocation(month: datetime.date, db: Session = Depends(get_db)):
    return crud.get_allocation(db, month)


@router.put("/allocation", response_model=AllocationOut)
def upsert_allocation(data: AllocationCreate, db: Session = Depends(get_db)):
    return crud.upsert_allocation(db, data)


# ── Promo APR Windows ──────────────────────────────────────────────────────────

@router.get("/promo-windows", response_model=list[PromoAprWindowOut])
def list_promo_windows(account_id: str | None = None, db: Session = Depends(get_db)):
    return crud.get_promo_windows(db, account_id=account_id)


@router.post("/promo-windows", response_model=PromoAprWindowOut, status_code=201)
def create_promo_window(data: PromoAprWindowCreate, db: Session = Depends(get_db)):
    return crud.create_promo_window(db, data)


@router.patch("/promo-windows/{window_id}", response_model=PromoAprWindowOut)
def update_promo_window(window_id: str, data: PromoAprWindowUpdate, db: Session = Depends(get_db)):
    window = crud.update_promo_window(db, window_id, data)
    if not window:
        raise HTTPException(404, "Promo window not found")
    return window


@router.delete("/promo-windows/{window_id}", status_code=204)
def delete_promo_window(window_id: str, db: Session = Depends(get_db)):
    if not crud.delete_promo_window(db, window_id):
        raise HTTPException(404, "Promo window not found")


# ── Reward Rules ───────────────────────────────────────────────────────────────

@router.get("/reward-rules", response_model=list[RewardRuleOut])
def list_reward_rules(account_id: str | None = None, db: Session = Depends(get_db)):
    return crud.get_reward_rules(db, account_id=account_id)


@router.post("/reward-rules", response_model=RewardRuleOut, status_code=201)
def create_reward_rule(data: RewardRuleCreate, db: Session = Depends(get_db)):
    return crud.create_reward_rule(db, data)


@router.patch("/reward-rules/{rule_id}", response_model=RewardRuleOut)
def update_reward_rule(rule_id: str, data: RewardRuleUpdate, db: Session = Depends(get_db)):
    rule = crud.update_reward_rule(db, rule_id, data)
    if not rule:
        raise HTTPException(404, "Reward rule not found")
    return rule


@router.delete("/reward-rules/{rule_id}", status_code=204)
def delete_reward_rule(rule_id: str, db: Session = Depends(get_db)):
    if not crud.delete_reward_rule(db, rule_id):
        raise HTTPException(404, "Reward rule not found")


# ── Annual Summary ─────────────────────────────────────────────────────────────

@router.get("/annual-summary")
def get_annual_summary(year: int | None = None, db: Session = Depends(get_db)):
    yr = year or datetime.date.today().year
    return crud.get_annual_summary(db, yr)
