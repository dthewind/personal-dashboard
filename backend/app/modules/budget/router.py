import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from . import crud
from .schemas import (
    AccountCreate, AccountOut, AccountUpdate,
    AccountCreditCreate, AccountCreditOut, AccountCreditUpdate,
    AllocationCreate, AllocationOut,
    CategoryRuleUpdate,
    FixedBillCreate, FixedBillOut, FixedBillPaymentCreate, FixedBillPaymentOut, FixedBillUpdate,
    IncomePeriodCreate, IncomePeriodOut, IncomePeriodUpdate,
    IncomeEntryCreate, IncomeEntryOut, IncomeEntryUpdate,
    MerchantOut,
    PromoAprWindowCreate, PromoAprWindowOut, PromoAprWindowUpdate,
    TransactionBulkCreate, TransactionCreate, TransactionOut, TransactionUpdate,
    TransferCreate, TransferOut, TransferUpdate,
    WaterfallOut,
)
# FixedBillPaymentCreate is still used by the Bills payment endpoints (same API shape)

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
    """Recalculate current_balance for every account from ledger data."""
    crud.recompute_all_balances(db)
    db.commit()


# ── Transactions ───────────────────────────────────────────────────────────────

@router.get("/transactions", response_model=list[TransactionOut])
def list_transactions(
    start: datetime.date | None = None,
    end: datetime.date | None = None,
    account_id: str | None = None,
    category: str | None = None,
    merchant: str | None = None,
    limit: int = 500,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    return crud.get_transactions(db, start=start, end=end, account_id=account_id, category=category, merchant=merchant, limit=limit, offset=offset)


@router.post("/transactions", response_model=TransactionOut, status_code=201)
def create_transaction(
    data: TransactionCreate,
    update_balance: bool = True,
    db: Session = Depends(get_db),
):
    return crud.create_transaction(db, data, update_balance=update_balance)


@router.post("/transactions/bulk", status_code=201)
def bulk_create_transactions(
    data: TransactionBulkCreate,
    db: Session = Depends(get_db),
):
    count = crud.bulk_create_transactions(db, data.transactions)
    return {"created": count}


@router.get("/transactions/{transaction_id}", response_model=TransactionOut)
def get_transaction(transaction_id: str, db: Session = Depends(get_db)):
    txn = crud.get_transaction(db, transaction_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")
    return txn


@router.patch("/transactions/{transaction_id}", response_model=TransactionOut)
def update_transaction(transaction_id: str, data: TransactionUpdate, db: Session = Depends(get_db)):
    txn = crud.update_transaction(db, transaction_id, data)
    if not txn:
        raise HTTPException(404, "Transaction not found")
    return txn


@router.delete("/transactions/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: str, db: Session = Depends(get_db)):
    if not crud.delete_transaction(db, transaction_id):
        raise HTTPException(404, "Transaction not found")


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
def list_payments(
    bill_id: str, month: datetime.date | None = None, db: Session = Depends(get_db)
):
    return crud.get_bill_payments(db, bill_id, month=month)


@router.post("/bills/{bill_id}/payments", response_model=FixedBillPaymentOut, status_code=201)
def record_payment(
    bill_id: str, data: FixedBillPaymentCreate, db: Session = Depends(get_db)
):
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
def update_income_period(
    period_id: str, data: IncomePeriodUpdate, db: Session = Depends(get_db)
):
    period = crud.update_income_period(db, period_id, data)
    if not period:
        raise HTTPException(404, "Income period not found")
    return period


# ── Income Entries ─────────────────────────────────────────────────────────────

@router.get("/income", response_model=list[IncomeEntryOut])
def list_income(month: datetime.date | None = None, db: Session = Depends(get_db)):
    return crud.get_income_entries(db, month=month)


@router.post("/income", response_model=IncomeEntryOut, status_code=201)
def create_income(data: IncomeEntryCreate, db: Session = Depends(get_db)):
    return crud.create_income_entry(db, data)


@router.patch("/income/{entry_id}", response_model=IncomeEntryOut)
def update_income(entry_id: str, data: IncomeEntryUpdate, db: Session = Depends(get_db)):
    entry = crud.update_income_entry(db, entry_id, data)
    if not entry:
        raise HTTPException(404, "Income entry not found")
    return entry


@router.delete("/income/{entry_id}", status_code=204)
def delete_income(entry_id: str, db: Session = Depends(get_db)):
    if not crud.delete_income_entry(db, entry_id):
        raise HTTPException(404, "Income entry not found")


# ── Allocation ─────────────────────────────────────────────────────────────────

@router.get("/allocation", response_model=AllocationOut | None)
def get_allocation(month: datetime.date, db: Session = Depends(get_db)):
    return crud.get_allocation(db, month)


@router.put("/allocation", response_model=AllocationOut)
def upsert_allocation(data: AllocationCreate, db: Session = Depends(get_db)):
    return crud.upsert_allocation(db, data)


# ── Transfers ──────────────────────────────────────────────────────────────────

@router.get("/transfers", response_model=list[TransferOut])
def list_transfers(
    account_id: str | None = None,
    from_account_id: str | None = None,
    to_account_id: str | None = None,
    start: str | None = None,
    end: str | None = None,
    db: Session = Depends(get_db),
):
    return crud.get_transfers(db, account_id=account_id, from_account_id=from_account_id, to_account_id=to_account_id, start=start, end=end)


@router.post("/transfers", response_model=TransferOut, status_code=201)
def create_transfer(data: TransferCreate, db: Session = Depends(get_db)):
    return crud.create_transfer(db, data)


@router.put("/transfers/{transfer_id}", response_model=TransferOut)
def update_transfer(transfer_id: str, data: TransferUpdate, db: Session = Depends(get_db)):
    result = crud.update_transfer(db, transfer_id, data)
    if not result:
        raise HTTPException(404, "Transfer not found")
    return result


@router.delete("/transfers/{transfer_id}", status_code=204)
def delete_transfer(transfer_id: str, db: Session = Depends(get_db)):
    if not crud.delete_transfer(db, transfer_id):
        raise HTTPException(404, "Transfer not found")


# ── Account Credits ─────────────────────────────────────────────────────────────

@router.get("/credits", response_model=list[AccountCreditOut])
def list_credits(account_id: str | None = None, start: str | None = None, end: str | None = None, db: Session = Depends(get_db)):
    return crud.get_credits(db, account_id=account_id, start=start, end=end)


@router.post("/credits", response_model=AccountCreditOut, status_code=201)
def create_credit(data: AccountCreditCreate, db: Session = Depends(get_db)):
    return crud.create_credit(db, data)


@router.patch("/credits/{credit_id}", response_model=AccountCreditOut)
def update_credit(credit_id: str, data: AccountCreditUpdate, db: Session = Depends(get_db)):
    result = crud.update_credit(db, credit_id, data)
    if not result:
        raise HTTPException(404, "Credit not found")
    return result


@router.delete("/credits/{credit_id}", status_code=204)
def delete_credit(credit_id: str, db: Session = Depends(get_db)):
    if not crud.delete_credit(db, credit_id):
        raise HTTPException(404, "Credit not found")


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
