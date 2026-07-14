from decimal import Decimal

from pydantic import BaseModel, Field


class PlaceSummaryResponse(BaseModel):
    id: int
    name: str
    category: str
    address: str
    summary: str | None
    latitude: Decimal | None
    longitude: Decimal | None
    opening_hours: str | None
    contact: str | None
    region: str
    themes: list[str]
    average_rating: float | None = None
    review_count: int = 0
    bookmark_count: int = 0
    recommendation_score: float | None = None
    recommendation_reasons: list[str] = Field(default_factory=list)


class PlaceSearchResponse(BaseModel):
    total: int
    items: list[PlaceSummaryResponse]


class RecommendationRequest(BaseModel):
    preferred_themes: list[str] | None = None
    preferred_transport: str | None = Field(default=None, max_length=50)
    category: str | None = Field(default=None, max_length=50)
    region_id: int | None = Field(default=None, ge=1)
    limit: int = Field(default=5, ge=1, le=20)


class RecommendationResponse(BaseModel):
    items: list[PlaceSummaryResponse]