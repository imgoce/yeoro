from decimal import Decimal

from pydantic import BaseModel, Field


class MedicalFacilityResponse(BaseModel):
    id: int
    name: str
    category: str
    address: str
    phone: str | None
    latitude: Decimal
    longitude: Decimal
    operating_hours: str | None
    distance_km: float


class MedicalFacilitySearchResponse(BaseModel):
    total: int
    items: list[MedicalFacilityResponse]


class MedicalFacilitySearchQuery(BaseModel):
    latitude: Decimal = Field(ge=-90, le=90)
    longitude: Decimal = Field(ge=-180, le=180)
    radius_km: float = Field(default=5.0, gt=0, le=30)
    category: str | None = Field(default=None, max_length=50)
    limit: int = Field(default=5, ge=1, le=20)