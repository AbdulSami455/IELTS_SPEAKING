"""Enforce one account per email, case-insensitively.

Revision ID: 0003_unique_email
Revises: 0002_fk_delete_rules
Create Date: 2026-11-07

Local accounts used to get a unique ``auth_subject`` derived from the email, which
incidentally prevented duplicates. Random identifiers removed that, so the rule is
now explicit. Existing duplicates are never deleted automatically: the migration
stops and lists them so an operator can decide which account to keep.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003_unique_email"
down_revision = "0002_fk_delete_rules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    duplicates = op.get_bind().execute(
        sa.text(
            "SELECT lower(email) AS email, count(*) AS accounts FROM users "
            "WHERE email IS NOT NULL GROUP BY lower(email) HAVING count(*) > 1"
        )
    ).all()
    if duplicates:
        listing = ", ".join(f"{row.email} ({row.accounts})" for row in duplicates)
        raise RuntimeError(f"Cannot add the unique email index: duplicate accounts exist for {listing}. Merge or delete them, then re-run.")
    # Fresh databases already get the index from the 0001 baseline; this is idempotent.
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (lower(email)) WHERE email IS NOT NULL")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_users_email_lower")
