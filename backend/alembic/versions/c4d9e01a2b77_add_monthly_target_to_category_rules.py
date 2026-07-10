"""add monthly_target to category_rules

Revision ID: c4d9e01a2b77
Revises: b7f3e9a2c1d8
Create Date: 2026-07-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4d9e01a2b77"
down_revision: Union[str, None] = "b7f3e9a2c1d8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "category_rules",
        sa.Column("monthly_target", sa.Numeric(precision=12, scale=2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("category_rules", "monthly_target")
