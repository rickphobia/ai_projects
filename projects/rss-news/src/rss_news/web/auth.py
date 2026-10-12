"""Sign-in over the JSON API: login, logout, the session check, and the guard on every API call.

No CSRF tokens: the session cookie is SameSite=Strict, so a cross-site request never carries
it, and the API only takes JSON bodies, which a cross-site form can't send.
"""

import logging
from dataclasses import dataclass

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.responses import Response

from rss_news.auth.login import LockedOut, LoggedIn, OwnerLogin, WrongPassword
from rss_news.auth.sessions import SessionSigner
from rss_news.clock import Clock

logger = logging.getLogger(__name__)

SESSION_COOKIE = "rss_news_session"


@dataclass(frozen=True)
class Access:
    login: OwnerLogin
    sessions: SessionSigner
    clock: Clock
    secure_cookies: bool
    # Cookies stay under the app's path prefix, away from the other projects on the domain.
    cookie_path: str

    def is_signed_in(self, request: Request) -> bool:
        return self.sessions.is_valid(request.cookies.get(SESSION_COOKIE), self.clock.now())

    def start_session(self, response: Response) -> None:
        response.set_cookie(
            SESSION_COOKIE,
            self.sessions.issue(self.clock.now()),
            max_age=int(self.sessions.lifetime.total_seconds()),
            path=self.cookie_path,
            secure=self.secure_cookies,
            httponly=True,
            samesite="strict",
        )

    def end_session(self, response: Response) -> None:
        response.delete_cookie(
            SESSION_COOKIE,
            path=self.cookie_path,
            secure=self.secure_cookies,
            httponly=True,
            samesite="strict",
        )


class LoginRequest(BaseModel):
    password: str


def access_of(request: Request) -> Access:
    access: Access = request.app.state.access
    return access


def require_session(request: Request) -> None:
    """Router dependency: every API route behind it answers 401 without a valid session."""
    if not access_of(request).is_signed_in(request):
        raise HTTPException(status_code=401, detail="Sign in first.")


def _log_context(request: Request) -> dict[str, str]:
    return {"path": request.url.path, "client": request.client.host if request.client else ""}


public_router = APIRouter(prefix="/api")
session_router = APIRouter(prefix="/api")


# A plain def: FastAPI runs it in a worker thread, so the slow scrypt check doesn't block.
@public_router.post("/login")
def login(request: Request, body: LoginRequest) -> Response:
    access = access_of(request)
    match access.login.attempt(body.password):
        case LoggedIn():
            logger.info("owner signed in", extra=_log_context(request))
            response = Response(status_code=204)
            access.start_session(response)
            return response
        case WrongPassword():
            logger.warning("sign-in failed: wrong password", extra=_log_context(request))
            return JSONResponse({"detail": "Wrong password."}, status_code=401)
        case LockedOut(minutes_left=minutes_left):
            logger.warning(
                "sign-in refused: locked out after too many wrong passwords",
                extra={**_log_context(request), "minutes_left": minutes_left},
            )
            return JSONResponse(
                {"detail": "Too many wrong passwords.", "minutes_left": minutes_left},
                status_code=429,
                headers={"Retry-After": str(minutes_left * 60)},
            )


@session_router.get("/session")
def session() -> Response:
    """204 when signed in; the guard answers 401 otherwise. The PWA asks this at start."""
    return Response(status_code=204)


@session_router.post("/logout")
def logout(request: Request) -> Response:
    logger.info("owner signed out", extra=_log_context(request))
    response = Response(status_code=204)
    access_of(request).end_session(response)
    return response
