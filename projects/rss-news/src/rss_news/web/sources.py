"""Folders and Sources over the JSON API: listing them and the owner's changes."""

from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, StringConstraints

from rss_news.sources.catalog import (
    AlreadyExists,
    CatalogError,
    FolderNotEmpty,
    InvalidSubreddit,
    NotAFeedUrl,
    NotFound,
    SourceStatus,
)
from rss_news.sources.managing import SourceManagement

sources_router = APIRouter(prefix="/api")

type Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]

_STATUS_FOR: dict[type[CatalogError], int] = {
    NotFound: 404,
    AlreadyExists: 409,
    FolderNotEmpty: 409,
    NotAFeedUrl: 422,
    InvalidSubreddit: 422,
}


class FolderRequest(BaseModel):
    name: Name


class NewSourceRequest(BaseModel):
    folder_id: int
    # Exactly one of these: a feed URL, or a subreddit name such as "LocalLLaMA".
    url: Name | None = None
    subreddit: Name | None = None
    # For a feed URL; its host when left out.
    name: Name | None = None


class SourceChangeRequest(BaseModel):
    # Left out means unchanged.
    folder_id: int | None = None
    paused: bool | None = None


def management_of(request: Request) -> SourceManagement:
    management: SourceManagement = request.app.state.source_management
    return management


def refused(error: CatalogError) -> HTTPException:
    return HTTPException(status_code=_STATUS_FOR.get(type(error), 400), detail=str(error))


@sources_router.get("/folders")
def list_folders(request: Request) -> dict[str, Any]:
    return {
        "folders": [
            {"id": folder.id, "name": folder.name} for folder in management_of(request).folders()
        ]
    }


@sources_router.post("/folders", status_code=201)
def add_folder(request: Request, body: FolderRequest) -> dict[str, Any]:
    try:
        folder = management_of(request).add_folder(body.name)
    except CatalogError as error:
        raise refused(error) from None
    return {"id": folder.id, "name": folder.name}


@sources_router.patch("/folders/{folder_id}", status_code=204)
def rename_folder(request: Request, folder_id: int, body: FolderRequest) -> Response:
    try:
        management_of(request).rename_folder(folder_id, body.name)
    except CatalogError as error:
        raise refused(error) from None
    return Response(status_code=204)


@sources_router.delete("/folders/{folder_id}", status_code=204)
def delete_folder(request: Request, folder_id: int) -> Response:
    try:
        management_of(request).delete_folder(folder_id)
    except CatalogError as error:
        raise refused(error) from None
    return Response(status_code=204)


@sources_router.get("/sources")
def list_sources(request: Request) -> dict[str, Any]:
    return {"sources": [_source_json(source) for source in management_of(request).sources()]}


@sources_router.post("/sources", status_code=201)
def add_source(request: Request, body: NewSourceRequest) -> dict[str, Any]:
    management = management_of(request)
    try:
        if body.url is not None and body.subreddit is None:
            source = management.add_feed(body.folder_id, body.url, body.name)
        elif body.subreddit is not None and body.url is None:
            source = management.add_subreddit(body.folder_id, body.subreddit)
        else:
            raise HTTPException(status_code=422, detail="give either a feed url or a subreddit")
    except CatalogError as error:
        raise refused(error) from None
    return _source_json(source)


@sources_router.patch("/sources/{source_id}")
def change_source(request: Request, source_id: int, body: SourceChangeRequest) -> dict[str, Any]:
    try:
        source = management_of(request).update_source(
            source_id, folder_id=body.folder_id, paused=body.paused
        )
    except CatalogError as error:
        raise refused(error) from None
    return _source_json(source)


@sources_router.delete("/sources/{source_id}", status_code=204)
def delete_source(request: Request, source_id: int) -> Response:
    try:
        management_of(request).delete_source(source_id)
    except CatalogError as error:
        raise refused(error) from None
    return Response(status_code=204)


def _source_json(source: SourceStatus) -> dict[str, Any]:
    return {
        "id": source.id,
        "folder_id": source.folder_id,
        "name": source.name,
        "url": source.url,
        "paused": source.paused,
        "last_success_at": source.last_success_at and source.last_success_at.isoformat(),
        "last_error_at": source.last_error_at and source.last_error_at.isoformat(),
        "last_error": source.last_error,
    }
