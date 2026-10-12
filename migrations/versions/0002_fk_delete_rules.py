"""Apply ON DELETE rules declared on the models to existing foreign keys.

Revision ID: 0002_fk_delete_rules
Revises: 0001_baseline
Create Date: 2026-10-12

Databases built by the old startup ``create_all`` have plain foreign keys, so
deleting a user failed with an integrity error. This walks every foreign key in
the ORM metadata that declares an ``ondelete`` rule and recreates the matching
constraint (Postgres default name ``<table>_<column>_fkey``) with that rule.
Fresh databases already get the rules from ``0001_baseline``; the statements are
idempotent either way.
"""

from __future__ import annotations

from alembic import op
from ielts_db.models import Base

revision = "0002_fk_delete_rules"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def _constraints():
    for table in Base.metadata.sorted_tables:
        for fk in table.foreign_key_constraints:
            if not fk.ondelete or len(fk.columns) != 1:
                continue
            column = next(iter(fk.columns))
            target = next(iter(fk.elements)).column
            yield table.name, column.name, target.table.name, target.name, fk.ondelete


def upgrade() -> None:
    for table, column, ref_table, ref_column, ondelete in _constraints():
        name = f"{table}_{column}_fkey"
        op.execute(f'ALTER TABLE "{table}" DROP CONSTRAINT IF EXISTS "{name}"')
        op.create_foreign_key(name, table, ref_table, [column], [ref_column], ondelete=ondelete)


def downgrade() -> None:
    for table, column, ref_table, ref_column, _ondelete in _constraints():
        name = f"{table}_{column}_fkey"
        op.execute(f'ALTER TABLE "{table}" DROP CONSTRAINT IF EXISTS "{name}"')
        op.create_foreign_key(name, table, ref_table, [column], [ref_column])
