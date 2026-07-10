"""add starts_month/ends_month to fixed_bills

Revision ID: e8f2a3b91c04
Revises: c4d9e01a2b77
Create Date: 2026-07-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e8f2a3b91c04"
down_revision: Union[str, None] = "c4d9e01a2b77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("fixed_bills", sa.Column("starts_month", sa.Date(), nullable=True))
    op.add_column("fixed_bills", sa.Column("ends_month", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("fixed_bills", "ends_month")
    op.drop_column("fixed_bills", "starts_month")
