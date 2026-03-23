"""Copy data from items_stock to sync_items_stock

Revision ID: d44abd139eb1
Revises: b39071ac13b5
Create Date: 2026-02-13 13:42:17.354836

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd44abd139eb1'
down_revision: Union[str, Sequence[str], None] = 'b39071ac13b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Copy data from items_stock to sync_items_stock
    op.execute(
        "INSERT INTO sync_items_stock (id, name, stock, unit, created_date, updated_at) "
        "SELECT id, name, stock, unit, created_date, updated_at FROM items_stock "
        "ON CONFLICT (id) DO NOTHING"
    )
    
    # Copy data from items_stock_history to sync_items_stock_history
    op.execute(
        "INSERT INTO sync_items_stock_history (history_id, item_id, old_stock, new_stock, old_unit, new_unit, change_type, changed_at) "
        "SELECT history_id, item_id, old_stock, new_stock, old_unit, new_unit, change_type, changed_at FROM items_stock_history "
        "ON CONFLICT (history_id) DO NOTHING"
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Data is usually not removed during downgrade unless specifically requested,
    # as it might cause data loss if the target tables were not empty.
    # But if we want to revert, we could delete the records we just inserted.
    # For safety, we leave it empty or just delete based on IDs found in source.
    pass
