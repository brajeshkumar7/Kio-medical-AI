"""Add guest sessions, ownership, and daily usage.

Revision ID: 20261013_0002
Revises: 20260801_0001
"""

from alembic import op
import sqlalchemy as sa


revision = "20261013_0002"
down_revision = "20260801_0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "guest_sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("claimed_user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_guest_sessions_expires_at", "guest_sessions", ["expires_at"])
    op.add_column(
        "conversations",
        sa.Column("guest_session_id", sa.String(length=36), nullable=True),
    )
    op.alter_column("conversations", "user_id", existing_type=sa.String(length=36), nullable=True)
    op.create_foreign_key(
        "fk_conversations_guest_session_id",
        "conversations",
        "guest_sessions",
        ["guest_session_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_check_constraint(
        "ck_conversations_one_owner",
        "conversations",
        "(user_id IS NOT NULL AND guest_session_id IS NULL) OR "
        "(user_id IS NULL AND guest_session_id IS NOT NULL)",
    )
    op.create_index(
        "ix_conversations_guest_updated",
        "conversations",
        ["guest_session_id", "updated_at"],
    )
    op.create_table(
        "guest_daily_usage",
        sa.Column("guest_session_id", sa.String(length=36), sa.ForeignKey("guest_sessions.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("day", sa.Date(), primary_key=True),
        sa.Column("used", sa.Integer(), nullable=False),
    )
    op.create_table(
        "guest_ip_daily_usage",
        sa.Column("ip_hash", sa.String(length=64), primary_key=True),
        sa.Column("day", sa.Date(), primary_key=True),
        sa.Column("used", sa.Integer(), nullable=False),
    )


def downgrade():
    op.drop_table("guest_ip_daily_usage")
    op.drop_table("guest_daily_usage")
    op.drop_index("ix_conversations_guest_updated", table_name="conversations")
    op.drop_constraint("ck_conversations_one_owner", "conversations", type_="check")
    op.drop_constraint("fk_conversations_guest_session_id", "conversations", type_="foreignkey")
    op.drop_column("conversations", "guest_session_id")
    op.alter_column("conversations", "user_id", existing_type=sa.String(length=36), nullable=False)
    op.drop_index("ix_guest_sessions_expires_at", table_name="guest_sessions")
    op.drop_table("guest_sessions")
