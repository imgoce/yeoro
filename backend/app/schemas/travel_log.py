from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TravelLogCreate(BaseModel):
    place_name: str = Field(min_length=1, max_length=150)
    category: str = Field(min_length=1, max_length=50)
    address: str | None = Field(default=None, max_length=255)


class TravelLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    place_name: str
    category: str
    address: str | None
    created_at: datetime