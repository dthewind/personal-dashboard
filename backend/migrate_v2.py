"""
One-time migration: adds transfers table, from_account_id to fixed_bill_payments,
and to_account_id to income_entries.

Run once from the backend directory:
    python migrate_v2.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from app.core.database import engine


DDL = [
    # New transfers table
    """
    CREATE TABLE IF NOT EXISTS transfers (
        id          UUID NOT NULL PRIMARY KEY,
        from_account_id UUID NOT NULL REFERENCES accounts(id),
        to_account_id   UUID NOT NULL REFERENCES accounts(id),
        amount      NUMERIC(12,2) NOT NULL,
        date        DATE NOT NULL,
        description TEXT NOT NULL
    )
    """,

    # New column: fixed_bill_payments.from_account_id
    """
    ALTER TABLE fixed_bill_payments
        ADD COLUMN IF NOT EXISTS from_account_id UUID REFERENCES accounts(id)
    """,

    # New column: income_entries.to_account_id
    """
    ALTER TABLE income_entries
        ADD COLUMN IF NOT EXISTS to_account_id UUID REFERENCES accounts(id)
    """,
]

if __name__ == "__main__":
    with engine.connect() as conn:
        for stmt in DDL:
            conn.execute(text(stmt.strip()))
            print("OK:", stmt.strip().split("\n")[0][:60])
        conn.commit()
    print("\nMigration complete.")
