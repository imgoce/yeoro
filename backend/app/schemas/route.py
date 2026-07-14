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


class CourseGenerationRequest(BaseModel):
    preferred_themes: list[str] = Field(default_factory=list)
    preferred_transport: str | None = Field(default=None, max_length=50)
    category: str | None = Field(default=None, max_length=50)
    region_id: int | None = Field(default=None, ge=1)
    start_place_id: int | None = Field(default=None, gt=0)
    max_places: int = Field(default=5, ge=2, le=10)


class GeneratedCoursePlaceResponse(OptimizedRoutePlaceResponse):
    segment_distance_km: float
    recommendation_reasons: list[str] = Field(default_factory=list)


class CourseGenerationResponse(BaseModel):
    ordered_places: list[GeneratedCoursePlaceResponse]
    total_distance_km: float
    summary: str


class WeatherCourseRecommendationRequest(BaseModel):
    base_date: str = Field(min_length=8, max_length=8)
    base_time: str = Field(min_length=4, max_length=4)
    nx: int = Field(ge=0)
    ny: int = Field(ge=0)
    category: str | None = Field(default=None, max_length=50)
    region_id: int | None = Field(default=None, ge=1)
    limit: int = Field(default=5, ge=1, le=10)


class WeatherSnapshotResponse(BaseModel):
    sky: str | None = None
    precipitation_type: str | None = None
    temperature_celsius: float | None = None
    precipitation_probability: int | None = None
    humidity: int | None = None
    observed_at: str | None = None


class WeatherRecommendedPlaceResponse(BaseModel):
    id: int
    name: str
    category: str
    address: str
    summary: str | None
    latitude: Decimal | None
    longitude: Decimal | None
    region: str
    themes: list[str]
    weather_score: float
    recommendation_reasons: list[str] = Field(default_factory=list)


class WeatherCourseRecommendationResponse(BaseModel):
    weather: WeatherSnapshotResponse
    recommendation_summary: list[str]
    items: list[WeatherRecommendedPlaceResponse]