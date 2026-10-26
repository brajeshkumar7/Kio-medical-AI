"""Guest identity, transfer, retention, and atomic daily allowances."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
import hashlib
import hmac
import secrets

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from backend.extensions import db
from backend.models import Conversation, GuestDailyUsage, GuestIpDailyUsage, GuestSession, User, utc_now


GUEST_DAILY_LIMIT = 3
NETWORK_DAILY_LIMIT = 60
GUEST_LIFETIME = timedelta(days=30)


class GuestAccessError(Exception):
    pass


class GuestQuotaExceeded(GuestAccessError):
    def __init__(self, code: str, reset_at: datetime):
        self.code = code
        self.reset_at = reset_at


@dataclass(frozen=True)
class GuestReservation:
    session_id: str
    ip_hash: str
    day: date


def _aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _next_utc_midnight(now: datetime) -> datetime:
    return datetime.combine(now.date() + timedelta(days=1), time.min, timezone.utc)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class GuestAccessService:
    def __init__(self, ip_hash_secret: str):
        self.ip_hash_secret = ip_hash_secret.encode("utf-8")

    def _ip_hash(self, ip: str) -> str:
        if not self.ip_hash_secret:
            raise RuntimeError("GUEST_IP_HASH_SECRET is required for guest access")
        return hmac.new(self.ip_hash_secret, ip.encode("utf-8"), hashlib.sha256).hexdigest()

    def create_session(self) -> tuple[GuestSession, str]:
        token = secrets.token_urlsafe(32)
        now = utc_now()
        session = GuestSession(
            token_hash=_token_hash(token),
            created_at=now,
            last_active_at=now,
            expires_at=now + GUEST_LIFETIME,
        )
        db.session.add(session)
        db.session.commit()
        return session, token

    def authenticate(self, token: str, *, allow_claimed: bool = False) -> GuestSession:
        if not token or len(token) > 200:
            raise GuestAccessError("Guest session required")
        session = db.session.scalar(
            select(GuestSession).where(GuestSession.token_hash == _token_hash(token))
        )
        now = utc_now()
        if session is None or _aware(session.expires_at) <= now:
            raise GuestAccessError("Guest session expired")
        if session.claimed_at is not None and not allow_claimed:
            raise GuestAccessError("Guest session was transferred")
        if session.claimed_at is None:
            session.last_active_at = now
            session.expires_at = now + GUEST_LIFETIME
            db.session.commit()
        return session

    def status(self, session_id: str, ip: str) -> dict:
        now = utc_now()
        day = now.date()
        guest_used = db.session.scalar(
            select(GuestDailyUsage.used).where(
                GuestDailyUsage.guest_session_id == session_id,
                GuestDailyUsage.day == day,
            )
        ) or 0
        network_used = db.session.scalar(
            select(GuestIpDailyUsage.used).where(
                GuestIpDailyUsage.ip_hash == self._ip_hash(ip),
                GuestIpDailyUsage.day == day,
            )
        ) or 0
        return {
            "remaining": max(0, min(GUEST_DAILY_LIMIT - guest_used, NETWORK_DAILY_LIMIT - network_used)),
            "limit": GUEST_DAILY_LIMIT,
            "resetAt": _next_utc_midnight(now).isoformat().replace("+00:00", "Z"),
        }

    @staticmethod
    def _increment(model, values: dict, limit: int) -> bool:
        table = model.__table__
        dialect = db.session.get_bind().dialect.name
        insert = postgres_insert if dialect == "postgresql" else sqlite_insert
        statement = insert(table).values(**values, used=1)
        statement = statement.on_conflict_do_update(
            index_elements=list(values),
            set_={"used": table.c.used + 1},
            where=table.c.used < limit,
        ).returning(table.c.used)
        return db.session.execute(statement).scalar_one_or_none() is not None

    def reserve(self, session_id: str, ip: str) -> GuestReservation:
        now = utc_now()
        day = now.date()
        ip_hash = self._ip_hash(ip)
        if not self._increment(
            GuestDailyUsage,
            {"guest_session_id": session_id, "day": day},
            GUEST_DAILY_LIMIT,
        ):
            db.session.rollback()
            raise GuestQuotaExceeded("GUEST_LIMIT_REACHED", _next_utc_midnight(now))
        if not self._increment(
            GuestIpDailyUsage,
            {"ip_hash": ip_hash, "day": day},
            NETWORK_DAILY_LIMIT,
        ):
            db.session.rollback()
            raise GuestQuotaExceeded("GUEST_NETWORK_LIMIT", _next_utc_midnight(now))
        db.session.commit()
        return GuestReservation(session_id, ip_hash, day)

    def release(self, reservation: GuestReservation) -> None:
        db.session.execute(
            update(GuestDailyUsage)
            .where(
                GuestDailyUsage.guest_session_id == reservation.session_id,
                GuestDailyUsage.day == reservation.day,
                GuestDailyUsage.used > 0,
            )
            .values(used=GuestDailyUsage.used - 1)
        )
        db.session.execute(
            update(GuestIpDailyUsage)
            .where(
                GuestIpDailyUsage.ip_hash == reservation.ip_hash,
                GuestIpDailyUsage.day == reservation.day,
                GuestIpDailyUsage.used > 0,
            )
            .values(used=GuestIpDailyUsage.used - 1)
        )
        db.session.commit()

    def claim(self, token: str, clerk_user_id: str) -> int:
        session = self.authenticate(token, allow_claimed=True)
        session = db.session.scalar(
            select(GuestSession).where(GuestSession.id == session.id)
            .with_for_update().execution_options(populate_existing=True)
        )
        if session.claimed_at is not None:
            user = db.session.get(User, session.claimed_user_id)
            if user is None or user.clerk_user_id != clerk_user_id:
                raise GuestAccessError("Guest session belongs to another account")
            return 0

        user = db.session.scalar(select(User).where(User.clerk_user_id == clerk_user_id))
        if user is None:
            user = User(clerk_user_id=clerk_user_id)
            db.session.add(user)
            db.session.flush()
        count = db.session.scalar(
            select(func.count(Conversation.id)).where(Conversation.guest_session_id == session.id)
        ) or 0
        db.session.execute(
            update(Conversation)
            .where(Conversation.guest_session_id == session.id)
            .values(user_id=user.id, guest_session_id=None)
        )
        session.claimed_user_id = user.id
        session.claimed_at = utc_now()
        db.session.commit()
        return count

    def purge_expired(self) -> int:
        now = utc_now()
        expired = db.session.scalars(
            select(GuestSession).where(GuestSession.expires_at <= now).with_for_update(skip_locked=True)
        ).all()
        if expired:
            db.session.execute(
                delete(GuestDailyUsage).where(
                    GuestDailyUsage.guest_session_id.in_([session.id for session in expired])
                )
            )
        for session in expired:
            db.session.delete(session)
        db.session.execute(delete(GuestIpDailyUsage).where(GuestIpDailyUsage.day < now.date() - timedelta(days=30)))
        db.session.commit()
        return len(expired)
