"""Add users.token_version so logout can revoke issued tokens.

Revision ID: 0004_token_version
Revises: 0003_unique_email
Create Date: 2026-11-07

Existing sessions keep working: tokens without a version claim are read as version 0,
which is the default given to every existing row.
"""

from __future__ import annotations

from alembic import op

revision = "0004_token_version"
down_revision = "0003_unique_email"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The baseline builds tables from the current models, so a fresh database may already have it.
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS token_version")
