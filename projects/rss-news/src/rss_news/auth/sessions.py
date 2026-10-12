"""Signed session cookie values, made with HMAC-SHA256 over a server-side secret."""

import hashlib
import hmac
from dataclasses import dataclass
from datetime import datetime, timedelta

_SESSION_PREFIX = "v1"


@dataclass(frozen=True)
class SessionSigner:
    """Issues and checks the owner's session cookie value.

    The cookie holds only the time it was issued and a signature. The signature also covers
    the password hash, so changing the password signs out every existing session.
    """

    secret: bytes
    password_hash: str
    lifetime: timedelta

    def issue(self, now: datetime) -> str:
        issued = str(int(now.timestamp()))
        return f"{_SESSION_PREFIX}.{issued}.{self._sign(issued)}"

    def is_valid(self, cookie: str | None, now: datetime) -> bool:
        if not cookie:
            return False
        parts = cookie.split(".")
        if len(parts) != 3 or parts[0] != _SESSION_PREFIX or not parts[1].isdigit():
            return False
        issued, signature = parts[1], parts[2]
        if not hmac.compare_digest(signature, self._sign(issued)):
            return False
        age = now.timestamp() - int(issued)
        return 0 <= age < self.lifetime.total_seconds()

    def _sign(self, issued: str) -> str:
        message = f"session:{issued}:{self.password_hash}".encode()
        return hmac.new(self.secret, message, hashlib.sha256).hexdigest()
