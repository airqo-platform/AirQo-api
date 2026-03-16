"""rename sync_category to category

Revision ID: 8663652ec8d3
Revises: a0eb9498e93d
Create Date: 2026-02-14 09:28:25.340058

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8663652ec8d3'
down_revision: Union[str, Sequence[str], None] = 'a0eb9498e93d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.rename_table('sync_category', 'category')


def downgrade() -> None:
    """Downgrade schema."""
    op.rename_table('category', 'sync_category')
