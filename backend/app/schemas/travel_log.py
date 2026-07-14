from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class TravelLogCreateRequest(BaseModel):
    place_id: int | None = Field(default=None, ge=1)
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    visited_at: datetime
    mood: str | None = Field(default=None, max_length=50)
    stay_minutes: int | None = Field(default=None, ge=1, le=1440)


class TravelLogUpdateRequest(BaseModel):
    place_id: int | None = Field(default=None, ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    visited_at: datetime | None = None
    mood: str | None = Field(default=None, max_length=50)
    stay_minutes: int | None = Field(default=None, ge=1, le=1440)


class TravelLogItemResponse(BaseModel):
    id: int
    title: str
    description: str | None
    visited_at: datetime
    mood: str | None
    stay_minutes: int | None
    place_id: int | None
    place_name: str | None
    place_category: str | None
    place_address: str | None
    latitude: Decimal | None
    longitude: Decimal | None


class TravelLogTimelineResponse(BaseModel):
    total: int
    items: list[TravelLogItemResponse]