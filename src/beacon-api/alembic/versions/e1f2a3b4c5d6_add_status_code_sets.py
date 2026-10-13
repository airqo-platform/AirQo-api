"""Add status code sets: meanings of device status codes and how to decode them

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-10-11 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'd0e1f2a3b4c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'status_code_sets',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('decode_rule', sa.String(length=20), server_default='bitmask', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_status_code_sets_name'), 'status_code_sets', ['name'], unique=True)

    op.create_table(
        'status_codes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('code_set_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(length=150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('kind', sa.String(length=20), server_default='fault', nullable=False),
        sa.ForeignKeyConstraint(['code_set_id'], ['status_code_sets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code_set_id', 'code', name='uq_status_code_set_code'),
    )
    op.create_index(op.f('ix_status_codes_code_set_id'), 'status_codes', ['code_set_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_status_codes_code_set_id'), table_name='status_codes')
    op.drop_table('status_codes')
    op.drop_index(op.f('ix_status_code_sets_name'), table_name='status_code_sets')
    op.drop_table('status_code_sets')
