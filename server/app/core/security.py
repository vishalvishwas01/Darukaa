from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings


_MAX_BCRYPT_PASSWORD_BYTES = 72


def _password_bytes(password: str) -> bytes:
    if not isinstance(password, str) or not password:
        raise ValueError("password must not be empty")

    encoded_password = password.encode("utf-8")
    if len(encoded_password) > _MAX_BCRYPT_PASSWORD_BYTES:
        raise ValueError("password must be at most 72 UTF-8 bytes")

    return encoded_password


def hash_password(password: str) -> str:
    password_bytes = _password_bytes(password)
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("ascii")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not isinstance(hashed_password, str) or not hashed_password:
        return False

    try:
        password_bytes = _password_bytes(plain_password)
        return bcrypt.checkpw(password_bytes, hashed_password.encode("ascii"))
    except (UnicodeEncodeError, ValueError, TypeError):
        return False


def create_access_token(
    subject: str | UUID,
    expires_delta: timedelta | None = None,
) -> str:
    subject_value = str(subject) if isinstance(subject, UUID) else subject
    if not isinstance(subject_value, str) or not subject_value:
        raise ValueError("token subject must not be empty")

    settings = get_settings()
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload = {
        "sub": subject_value,
        "iat": issued_at,
        "exp": expires_at,
        "token_type": "access",
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict[str, Any]:
    if not isinstance(token, str) or not token:
        raise ValueError("invalid access token")

    settings = get_settings()

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={
                "require_sub": True,
                "require_exp": True,
                "require_iat": True,
            },
        )
    except (JWTError, TypeError, ValueError, UnicodeError) as exc:
        raise ValueError("invalid access token") from exc

    if (
        not isinstance(payload.get("sub"), str)
        or not payload["sub"]
        or payload.get("token_type") != "access"
    ):
        raise ValueError("invalid access token")

    return payload
