"""add_is_estimated_to_bills

Revision ID: ac3f15ba07e4
Revises: 7e678496fd60
Create Date: 2026-07-05 18:38:04.542494

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ac3f15ba07e4'
down_revision: Union[str, Sequence[str], None] = '7e678496fd60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'fixed_bills',
        sa.Column('is_estimated', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade() -> None:
    op.drop_column('fixed_bills', 'is_estimated')
