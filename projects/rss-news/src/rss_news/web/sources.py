"""Folders and Sources over the JSON API. For now only the Folder list the Inbox filter needs."""

from typing import Any, Protocol

from fastapi import APIRouter, Request

from rss_news.sources.catalog import Folder

sources_router = APIRouter(prefix="/api")


class FolderList(Protocol):
    def folders(self) -> list[Folder]: ...


def folders_of(request: Request) -> FolderList:
    folders: FolderList = request.app.state.folders
    return folders


@sources_router.get("/folders")
def list_folders(request: Request) -> dict[str, Any]:
    return {
        "folders": [
            {"id": folder.id, "name": folder.name} for folder in folders_of(request).folders()
        ]
    }
