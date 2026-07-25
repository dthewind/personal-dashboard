"""add_tbill_rungs

Revision ID: f6a9c3e18d02
Revises: a1b4d7f2c9e3
Create Date: 2026-07-25 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "f6a9c3e18d02"
down_revision: Union[str, None] = "a1b4d7f2c9e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tbill_rungs",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("account_id", UUID(as_uuid=False), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("funding_account_id", UUID(as_uuid=False), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("purchase_date", sa.Date, nullable=False),
        sa.Column("maturity_date", sa.Date, nullable=False),
        sa.Column("term_weeks", sa.Integer, nullable=False),
        sa.Column("purchase_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("face_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("discount_rate", sa.Numeric(6, 4)),
        sa.Column("auto_reinvest", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("cusip", sa.String(20)),
        sa.Column("notes", sa.Text),
        sa.Column("status", sa.String(10), nullable=False, server_default="active"),
        sa.Column("purchase_transfer_out_id", UUID(as_uuid=False), sa.ForeignKey("ledger_entries.id")),
        sa.Column("income_entry_id", UUID(as_uuid=False), sa.ForeignKey("ledger_entries.id")),
        sa.Column("payout_transfer_out_id", UUID(as_uuid=False), sa.ForeignKey("ledger_entries.id")),
        sa.Column("next_rung_id", UUID(as_uuid=False), sa.ForeignKey("tbill_rungs.id")),
    )
    op.create_index("ix_tbill_rungs_maturity_date", "tbill_rungs", ["maturity_date"])

    conn = op.get_bind()
    conn.execute(sa.text("GRANT SELECT, INSERT, UPDATE, DELETE ON tbill_rungs TO dashboard"))


def downgrade() -> None:
    op.drop_table("tbill_rungs")
