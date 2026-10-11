"""Baseline schema from the ORM models.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-10-12

Databases created by the old startup ``create_all`` already have these tables;
``checkfirst`` makes this migration a no-op for them and creates only what is
missing (for example ``consent_records``). Later revisions handle alterations.
"""

from __future__ import annotations

from alembic import op

from ielts_db.models import Base

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind, checkfirst=True)
