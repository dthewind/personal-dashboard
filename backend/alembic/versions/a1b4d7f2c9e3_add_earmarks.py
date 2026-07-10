"""add_earmarks

Revision ID: a1b4d7f2c9e3
Revises: e8f2a3b91c04
Create Date: 2026-07-10 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "a1b4d7f2c9e3"
down_revision: Union[str, None] = "e8f2a3b91c04"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "earmarks",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("account_id", UUID(as_uuid=False), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("monthly_accrual", sa.Numeric(12, 2)),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "earmark_events",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "earmark_id",
            UUID(as_uuid=False),
            sa.ForeignKey("earmarks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("description", sa.Text),
    )
    op.create_index("ix_earmark_events_earmark_id", "earmark_events", ["earmark_id"])

    conn = op.get_bind()
    conn.execute(sa.text("GRANT SELECT, INSERT, UPDATE, DELETE ON earmarks TO dashboard"))
    conn.execute(sa.text("GRANT SELECT, INSERT, UPDATE, DELETE ON earmark_events TO dashboard"))


def downgrade() -> None:
    op.drop_table("earmark_events")
    op.drop_table("earmarks")
