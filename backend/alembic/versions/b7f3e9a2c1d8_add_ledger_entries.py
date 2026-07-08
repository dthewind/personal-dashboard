"""add_ledger_entries

Revision ID: b7f3e9a2c1d8
Revises: 3c8d2a1f9b05
Create Date: 2026-07-08 12:00:00.000000

"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "b7f3e9a2c1d8"
down_revision: Union[str, None] = "3c8d2a1f9b05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ledger_entries",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("account_id", UUID(as_uuid=False), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("merchant", sa.String(200)),
        sa.Column("merchant_id", UUID(as_uuid=False), sa.ForeignKey("merchants.id")),
        sa.Column("category", sa.String(100)),
        sa.Column("tag", sa.String(10)),
        sa.Column("subtype", sa.String(30)),
        sa.Column("period_id", UUID(as_uuid=False), sa.ForeignKey("income_periods.id")),
        sa.Column("bill_id", UUID(as_uuid=False), sa.ForeignKey("fixed_bills.id")),
        sa.Column("reward_rule_id", UUID(as_uuid=False), sa.ForeignKey("reward_rules.id")),
        sa.Column("linked_entry_id", UUID(as_uuid=False), sa.ForeignKey("ledger_entries.id")),
        sa.Column("notes", sa.Text),
    )
    op.create_index("ix_ledger_entries_account_id", "ledger_entries", ["account_id"])
    op.create_index("ix_ledger_entries_date", "ledger_entries", ["date"])
    op.create_index("ix_ledger_entries_type", "ledger_entries", ["type"])

    conn = op.get_bind()

    # 1. Expenses from transactions (preserve IDs)
    conn.execute(sa.text("""
        INSERT INTO ledger_entries
            (id, date, account_id, amount, type, merchant, merchant_id,
             category, tag, bill_id, reward_rule_id, notes)
        SELECT
            id, date, account_id, amount, 'expense', merchant, merchant_id,
            category, tag, bill_id, reward_rule_id, notes
        FROM transactions
    """))

    # 2. Income from income_entries (preserve IDs; skip entries without to_account_id)
    conn.execute(sa.text("""
        INSERT INTO ledger_entries
            (id, date, account_id, amount, type, subtype, period_id, notes)
        SELECT
            id, received_date, to_account_id, amount, 'income', type, period_id, description
        FROM income_entries
        WHERE to_account_id IS NOT NULL
    """))

    # 3. Credits from account_credits (preserve IDs)
    conn.execute(sa.text("""
        INSERT INTO ledger_entries
            (id, date, account_id, amount, type, subtype, category, notes)
        SELECT
            id, date, account_id, amount, 'credit', credit_type, category, description
        FROM account_credits
    """))

    # 4. Transfers — two linked rows per transfer (new IDs)
    transfers = conn.execute(sa.text(
        "SELECT id, date, from_account_id, to_account_id, amount, description FROM transfers"
    )).fetchall()

    for t in transfers:
        out_id = str(uuid.uuid4())
        in_id = str(uuid.uuid4())
        # Insert out first without linked_entry_id (circular FK — resolve after)
        conn.execute(sa.text("""
            INSERT INTO ledger_entries (id, date, account_id, amount, type, notes)
            VALUES (:id, :date, :account_id, :amount, 'transfer_out', :notes)
        """), {"id": out_id, "date": t.date, "account_id": t.from_account_id,
               "amount": t.amount, "notes": t.description})
        # Insert in with linked pointing to out (out exists now)
        conn.execute(sa.text("""
            INSERT INTO ledger_entries (id, date, account_id, amount, type, linked_entry_id, notes)
            VALUES (:id, :date, :account_id, :amount, 'transfer_in', :linked, :notes)
        """), {"id": in_id, "date": t.date, "account_id": t.to_account_id,
               "amount": t.amount, "linked": out_id, "notes": t.description})
        # Now set the out→in link
        conn.execute(sa.text(
            "UPDATE ledger_entries SET linked_entry_id = :linked WHERE id = :id"
        ), {"linked": in_id, "id": out_id})

    conn.execute(sa.text("GRANT SELECT, INSERT, UPDATE, DELETE ON ledger_entries TO dashboard"))


def downgrade() -> None:
    op.drop_table("ledger_entries")
