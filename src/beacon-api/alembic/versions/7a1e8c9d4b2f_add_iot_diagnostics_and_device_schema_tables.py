"""Add IoT diagnostics and device schema tables

Revision ID: 7a1e8c9d4b2f
Revises: c70962eb7ba9
Create Date: 2026-08-23 18:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7a1e8c9d4b2f'
down_revision: Union[str, None] = 'c70962eb7ba9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Device Profiles & Topology ─────────────────────────────────────
    op.create_table(
        'device_profiles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('vendor', sa.String(length=100), nullable=True),
        sa.Column('firmware_compatibility', sa.String(length=100), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_device_profiles_name'), 'device_profiles', ['name'], unique=True)
    op.create_index(op.f('ix_device_profiles_category'), 'device_profiles', ['category'], unique=False)

    op.create_table(
        'component_definitions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('profile_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('component_type', sa.String(length=50), nullable=False),
        sa.Column('criticality', sa.Float(), server_default='1.0', nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['profile_id'], ['device_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'metric_definitions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('component_id', sa.UUID(), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('unit', sa.String(length=30), nullable=True),
        sa.Column('data_type', sa.String(length=30), server_default='float', nullable=True),
        sa.Column('expected_min', sa.Float(), nullable=True),
        sa.Column('expected_max', sa.Float(), nullable=True),
        sa.Column('max_rate_of_change', sa.Float(), nullable=True),
        sa.Column('is_telemetry_field', sa.Boolean(), server_default='true', nullable=True),
        sa.ForeignKeyConstraint(['component_id'], ['component_definitions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'component_relationships',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('profile_id', sa.UUID(), nullable=False),
        sa.Column('source_component_id', sa.UUID(), nullable=False),
        sa.Column('target_component_id', sa.UUID(), nullable=False),
        sa.Column('relationship_type', sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(['profile_id'], ['device_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['source_component_id'], ['component_definitions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['target_component_id'], ['component_definitions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── 2. Diagnostic Templates, Symptoms, Causes & Rules ─────────────────
    op.create_table(
        'diagnostic_templates',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('target_component_type', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('version', sa.String(length=20), server_default='1.0.0', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_diagnostic_templates_name'), 'diagnostic_templates', ['name'], unique=True)
    op.create_index(op.f('ix_diagnostic_templates_target_component_type'), 'diagnostic_templates', ['target_component_type'], unique=False)

    op.create_table(
        'symptom_definitions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('template_id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('severity', sa.String(length=20), server_default='MEDIUM', nullable=True),
        sa.Column('evaluation_logic', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['template_id'], ['diagnostic_templates.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_symptom_definitions_code'), 'symptom_definitions', ['code'], unique=False)

    op.create_table(
        'cause_definitions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('template_id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('category', sa.String(length=50), server_default='HARDWARE_FAILURE', nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('recommended_action', sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(['template_id'], ['diagnostic_templates.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_cause_definitions_code'), 'cause_definitions', ['code'], unique=False)

    op.create_table(
        'diagnostic_hypothesis_rules',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('cause_id', sa.UUID(), nullable=False),
        sa.Column('evidence_code', sa.String(length=100), nullable=False),
        sa.Column('weight', sa.Float(), nullable=False),
        sa.Column('is_mandatory', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('description', sa.String(length=300), nullable=True),
        sa.ForeignKeyConstraint(['cause_id'], ['cause_definitions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_diagnostic_hypothesis_rules_evidence_code'), 'diagnostic_hypothesis_rules', ['evidence_code'], unique=False)

    op.create_table(
        'profile_diagnostic_templates',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('profile_id', sa.UUID(), nullable=False),
        sa.Column('template_id', sa.UUID(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.ForeignKeyConstraint(['profile_id'], ['device_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['template_id'], ['diagnostic_templates.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── 3. Health Snapshots & Feedback ────────────────────────────────────
    op.create_table(
        'device_health_snapshots',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('device_id', sa.String(length=100), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('overall_health_score', sa.Float(), nullable=False),
        sa.Column('lifecycle_state', sa.String(length=30), nullable=False),
        sa.Column('subsystem_scores', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('active_evidences', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('detected_symptoms', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('top_diagnoses', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('evaluated_window_hours', sa.Float(), server_default='24.0', nullable=True),
        sa.Column('metadata_context', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['sync_device.device_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_device_health_snapshots_device_id'), 'device_health_snapshots', ['device_id'], unique=False)
    op.create_index(op.f('ix_device_health_snapshots_timestamp'), 'device_health_snapshots', ['timestamp'], unique=False)

    op.create_table(
        'diagnostic_feedback',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('snapshot_id', sa.UUID(), nullable=True),
        sa.Column('device_id', sa.String(length=100), nullable=False),
        sa.Column('technician_user_id', sa.String(length=255), nullable=False),
        sa.Column('confirmed_cause_code', sa.String(length=100), nullable=False),
        sa.Column('was_prediction_accurate', sa.Boolean(), nullable=False),
        sa.Column('actions_taken', sa.Text(), nullable=True),
        sa.Column('technician_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['snapshot_id'], ['device_health_snapshots.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['device_id'], ['sync_device.device_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_diagnostic_feedback_device_id'), 'diagnostic_feedback', ['device_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_diagnostic_feedback_device_id'), table_name='diagnostic_feedback')
    op.drop_table('diagnostic_feedback')
    op.drop_index(op.f('ix_device_health_snapshots_timestamp'), table_name='device_health_snapshots')
    op.drop_index(op.f('ix_device_health_snapshots_device_id'), table_name='device_health_snapshots')
    op.drop_table('device_health_snapshots')
    op.drop_table('profile_diagnostic_templates')
    op.drop_index(op.f('ix_diagnostic_hypothesis_rules_evidence_code'), table_name='diagnostic_hypothesis_rules')
    op.drop_table('diagnostic_hypothesis_rules')
    op.drop_index(op.f('ix_cause_definitions_code'), table_name='cause_definitions')
    op.drop_table('cause_definitions')
    op.drop_index(op.f('ix_symptom_definitions_code'), table_name='symptom_definitions')
    op.drop_table('symptom_definitions')
    op.drop_index(op.f('ix_diagnostic_templates_target_component_type'), table_name='diagnostic_templates')
    op.drop_index(op.f('ix_diagnostic_templates_name'), table_name='diagnostic_templates')
    op.drop_table('diagnostic_templates')
    op.drop_table('component_relationships')
    op.drop_table('metric_definitions')
    op.drop_table('component_definitions')
    op.drop_index(op.f('ix_device_profiles_category'), table_name='device_profiles')
    op.drop_index(op.f('ix_device_profiles_name'), table_name='device_profiles')
    op.drop_table('device_profiles')
