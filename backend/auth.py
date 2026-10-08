from dataclasses import dataclass
from functools import wraps
from typing import Any, Callable, TypeVar, cast

import jwt
from flask import current_app, g, jsonify, request

from backend.config import Settings


F = TypeVar("F", bound=Callable[..., Any])


@dataclass(frozen=True)
class AuthenticatedUser:
    clerk_user_id: str


class ClerkAuthenticator:
    def __init__(self, settings: Settings):
        self.issuer = settings.clerk_issuer_url
        self.authorized_parties = settings.clerk_authorized_parties
        self.jwks = jwt.PyJWKClient(f"{self.issuer}/.well-known/jwks.json", cache_keys=True)

    def authenticate(self, authorization: str | None) -> AuthenticatedUser:
        if not authorization or not authorization.startswith("Bearer "):
            raise ValueError("A valid bearer token is required")

        token = authorization.removeprefix("Bearer ").strip()
        signing_key = self.jwks.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=self.issuer,
            options={"require": ["exp", "iat", "sub"]},
        )
        authorized_party = claims.get("azp")
        if authorized_party and authorized_party.rstrip("/") not in self.authorized_parties:
            raise ValueError("Token was issued for an unauthorized party")
        return AuthenticatedUser(clerk_user_id=str(claims["sub"]))


def require_auth(view: F) -> F:
    @wraps(view)
    def wrapped(*args: Any, **kwargs: Any):
        try:
            authenticator = current_app.extensions["authenticator"]
            g.authenticated_user = authenticator.authenticate(request.headers.get("Authorization"))
        except Exception:
            current_app.logger.info("Authentication failed", exc_info=True)
            return jsonify({"error": "Authentication required"}), 401
        return view(*args, **kwargs)

    return cast(F, wrapped)
