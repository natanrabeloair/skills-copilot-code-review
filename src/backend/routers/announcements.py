"""
Announcement endpoints for the High School Management System API
"""

from datetime import date
from typing import Any, Dict, List, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..database import announcements_collection, teachers_collection

router = APIRouter(prefix="/announcements", tags=["announcements"])


class AnnouncementIn(BaseModel):
    message: str
    expiration_date: date
    start_date: Optional[date] = None


def _require_teacher(username: Optional[str]) -> None:
    if not username or not teachers_collection.find_one({"_id": username}):
        raise HTTPException(
            status_code=401, detail="Authentication required")


def _serialize(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "message": doc["message"],
        "start_date": doc.get("start_date"),
        "expiration_date": doc["expiration_date"],
    }


def _validate(data: AnnouncementIn) -> Dict[str, Any]:
    message = data.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    if data.start_date and data.start_date > data.expiration_date:
        raise HTTPException(
            status_code=400,
            detail="Start date must be on or before the expiration date")
    return {
        "message": message,
        "start_date": data.start_date.isoformat() if data.start_date else None,
        "expiration_date": data.expiration_date.isoformat(),
    }


def _object_id(announcement_id: str) -> ObjectId:
    try:
        return ObjectId(announcement_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Announcement not found")


@router.get("")
def get_active_announcements() -> List[Dict[str, Any]]:
    """Announcements currently in effect (public)"""
    today = date.today().isoformat()
    query = {
        "expiration_date": {"$gte": today},
        "$or": [{"start_date": None}, {"start_date": {"$lte": today}}],
    }
    return [_serialize(d) for d in announcements_collection.find(query).sort("expiration_date", 1)]


@router.get("/all")
def get_all_announcements(teacher_username: Optional[str] = Query(None)) -> List[Dict[str, Any]]:
    """All announcements, including expired/scheduled (signed-in only)"""
    _require_teacher(teacher_username)
    return [_serialize(d) for d in announcements_collection.find().sort("expiration_date", -1)]


@router.post("")
def create_announcement(data: AnnouncementIn, teacher_username: Optional[str] = Query(None)):
    _require_teacher(teacher_username)
    doc = _validate(data)
    result = announcements_collection.insert_one(doc)
    return _serialize({"_id": result.inserted_id, **doc})


@router.put("/{announcement_id}")
def update_announcement(announcement_id: str, data: AnnouncementIn, teacher_username: Optional[str] = Query(None)):
    _require_teacher(teacher_username)
    doc = _validate(data)
    oid = _object_id(announcement_id)
    result = announcements_collection.update_one({"_id": oid}, {"$set": doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return _serialize({"_id": oid, **doc})


@router.delete("/{announcement_id}")
def delete_announcement(announcement_id: str, teacher_username: Optional[str] = Query(None)):
    _require_teacher(teacher_username)
    result = announcements_collection.delete_one(
        {"_id": _object_id(announcement_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"message": "Announcement deleted"}
