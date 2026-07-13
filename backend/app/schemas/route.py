from decimal import Decimal

from pydantic import BaseModel, Field


class RouteOptimizeRequest(BaseModel):
    place_ids: list[int] = Field(min_length=2)
    start_place_id: int | None = Field(default=None, gt=0)


class OptimizedRoutePlaceResponse(BaseModel):
    id: int
    name: str
    category: str
    address: str
    latitude: Decimal | None
    longitude: Decimal | None
    order: int


class RouteOptimizeResponse(BaseModel):
    ordered_places: list[OptimizedRoutePlaceResponse]
    total_distance_km: float