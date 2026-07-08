"""add_category_rules

Revision ID: 3c8d2a1f9b05
Revises: ac3f15ba07e4
Create Date: 2026-07-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '3c8d2a1f9b05'
down_revision: Union[str, Sequence[str], None] = 'ac3f15ba07e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'category_rules',
        sa.Column('name', sa.String(100), primary_key=True),
        sa.Column('exclude_from_spend', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('exclude_from_trends', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON category_rules TO dashboard")


def downgrade() -> None:
    op.drop_table('category_rules')
