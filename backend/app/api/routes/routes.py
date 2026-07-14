from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.api.dependencies import get_weather_api_client
from app.clients.weather import WeatherApiClient, WeatherApiError
from app.models.place import Place
from app.models.theme import Theme
from app.models.user import User
from app.schemas.route import (
    CourseGenerationRequest,
    CourseGenerationResponse,
    GeneratedCoursePlaceResponse,
    OptimizedRoutePlaceResponse,
    RouteOptimizeRequest,
    RouteOptimizeResponse,
    WeatherCourseRecommendationRequest,
    WeatherCourseRecommendationResponse,
    WeatherRecommendedPlaceResponse,
    WeatherSnapshotResponse,
)
from app.services import (
    WeatherRecommendationContext,
    build_personalized_itinerary,
    build_weather_recommendation,
    calculate_distance_km,
)

router = APIRouter(prefix="/routes", tags=["routes"])


SKY_MAP = {"1": "맑음", "3": "구름 많음", "4": "흐림"}
PRECIPITATION_MAP = {"0": "없음", "1": "비", "2": "비/눈", "3": "눈", "4": "소나기"}


def _load_candidate_places(
    db: Session,
    *,
    category: str | None,
    region_id: int | None,
) -> list[Place]:
    statement = select(Place).options(joinedload(Place.region), joinedload(Place.themes))
    if category:
        statement = statement.where(Place.category == category)
    if region_id:
        statement = statement.where(Place.region_id == region_id)
    return db.execute(statement).unique().scalars().all()


def _ensure_coordinates(places: list[Place]) -> None:
    missing_coordinates = [
        place.name for place in places if place.latitude is None or place.longitude is None
    ]
    if missing_coordinates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"좌표 정보가 없는 장소가 있습니다: {', '.join(missing_coordinates)}",
        )


def _extract_weather_context(payload: dict) -> WeatherRecommendationContext:
    items = (
        payload.get("response", {})
        .get("body", {})
        .get("items", {})
        .get("item", [])
    )
    grouped: dict[tuple[str, str], dict[str, str]] = {}
    for item in items:
        forecast_date = item.get("fcstDate") or item.get("baseDate")
        forecast_time = item.get("fcstTime") or item.get("baseTime")
        if not forecast_date or not forecast_time:
            continue
        grouped.setdefault((forecast_date, forecast_time), {})[item.get("category")] = item.get("fcstValue")

    if not grouped:
        return WeatherRecommendationContext()

    target_key = sorted(grouped.keys())[0]
    snapshot = grouped[target_key]
    temperature = snapshot.get("TMP") or snapshot.get("T1H")
    precipitation_probability = snapshot.get("POP")
    humidity = snapshot.get("REH")
    return WeatherRecommendationContext(
        sky=SKY_MAP.get(snapshot.get("SKY", ""), snapshot.get("SKY")),
        precipitation_type=PRECIPITATION_MAP.get(snapshot.get("PTY", ""), snapshot.get("PTY")),
        temperature_celsius=float(temperature) if temperature is not None else None,
        precipitation_probability=int(precipitation_probability) if precipitation_probability is not None else None,
        humidity=int(humidity) if humidity is not None else None,
        observed_at=f"{target_key[0]} {target_key[1]}",
    )


@router.post("/optimize", response_model=RouteOptimizeResponse)
def optimize_route(
    payload: RouteOptimizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RouteOptimizeResponse:
    unique_place_ids = list(dict.fromkeys(payload.place_ids))
    if len(unique_place_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="서로 다른 장소를 2개 이상 선택해야 합니다.",
        )

    places = db.query(Place).filter(Place.id.in_(unique_place_ids)).all()
    if len(places) != len(unique_place_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="일부 장소를 찾을 수 없습니다.")

    place_by_id = {place.id: place for place in places}
    missing_coordinates = [
        place.name for place in places if place.latitude is None or place.longitude is None
    ]
    if missing_coordinates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"좌표 정보가 없는 장소가 있습니다: {', '.join(missing_coordinates)}",
        )

    if payload.start_place_id is not None and payload.start_place_id not in place_by_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="출발 장소는 요청한 place_ids 안에 포함되어야 합니다.",
        )

    remaining_places = [place_by_id[place_id] for place_id in unique_place_ids]
    if payload.start_place_id is not None:
        current_place = place_by_id[payload.start_place_id]
        remaining_places = [place for place in remaining_places if place.id != payload.start_place_id]
    else:
        current_place = remaining_places.pop(0)

    ordered_places = [current_place]
    total_distance_km = 0.0

    while remaining_places:
        next_place = min(
            remaining_places,
            key=lambda candidate: calculate_distance_km(
                current_place.latitude,
                current_place.longitude,
                candidate.latitude,
                candidate.longitude,
            ),
        )
        total_distance_km += calculate_distance_km(
            current_place.latitude,
            current_place.longitude,
            next_place.latitude,
            next_place.longitude,
        )
        ordered_places.append(next_place)
        remaining_places.remove(next_place)
        current_place = next_place

    return RouteOptimizeResponse(
        ordered_places=[
            OptimizedRoutePlaceResponse(
                id=place.id,
                name=place.name,
                category=place.category,
                address=place.address,
                latitude=place.latitude,
                longitude=place.longitude,
                order=index + 1,
            )
            for index, place in enumerate(ordered_places)
        ],
        total_distance_km=round(total_distance_km, 2),
    )


@router.post("/generate-course", response_model=CourseGenerationResponse)
def generate_course(
    payload: CourseGenerationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CourseGenerationResponse:
    places = _load_candidate_places(db, category=payload.category, region_id=payload.region_id)
    if len(places) < 2:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="코스를 생성할 수 있을 만큼 충분한 장소가 없습니다.",
        )

    _ensure_coordinates(places)

    preferred_themes = payload.preferred_themes
    if not preferred_themes and current_user.preferred_themes:
        import json

        preferred_themes = json.loads(current_user.preferred_themes)

    preferred_transport = payload.preferred_transport or current_user.preferred_transport

    try:
        ordered_places, total_distance_km = build_personalized_itinerary(
            places=places,
            preferred_themes=preferred_themes,
            preferred_transport=preferred_transport,
            start_place_id=payload.start_place_id,
            max_places=payload.max_places,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    summary_parts = []
    if preferred_themes:
        summary_parts.append(f"선호 테마 {', '.join(preferred_themes)}")
    if preferred_transport:
        summary_parts.append(f"{preferred_transport} 이동 기준")
    if payload.region_id:
        summary_parts.append("지역 필터 반영")
    summary = " / ".join(summary_parts) if summary_parts else "사용자 기본 선호를 반영한 여행 코스입니다."

    return CourseGenerationResponse(
        ordered_places=[
            GeneratedCoursePlaceResponse(
                id=place.id,
                name=place.name,
                category=place.category,
                address=place.address,
                latitude=place.latitude,
                longitude=place.longitude,
                order=index + 1,
                segment_distance_km=round(segment_distance_km, 2),
                recommendation_reasons=reasons,
            )
            for index, (place, segment_distance_km, reasons) in enumerate(ordered_places)
        ],
        total_distance_km=total_distance_km,
        summary=summary,
    )


@router.post("/weather-recommendations", response_model=WeatherCourseRecommendationResponse)
async def recommend_places_by_weather(
    payload: WeatherCourseRecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    weather_client: WeatherApiClient = Depends(get_weather_api_client),
) -> WeatherCourseRecommendationResponse:
    places = _load_candidate_places(db, category=payload.category, region_id=payload.region_id)
    if not places:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="추천할 장소가 없습니다.")

    try:
        weather_payload = await weather_client.get_village_forecast(
            base_date=payload.base_date,
            base_time=payload.base_time,
            nx=payload.nx,
            ny=payload.ny,
        )
    except WeatherApiError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    weather_context = _extract_weather_context(weather_payload)
    scored_places, recommendation_summary = build_weather_recommendation(
        places=places,
        weather=weather_context,
    )

    items = [
        WeatherRecommendedPlaceResponse(
            id=place.id,
            name=place.name,
            category=place.category,
            address=place.address,
            summary=place.summary,
            latitude=place.latitude,
            longitude=place.longitude,
            region=place.region.name,
            themes=[theme.name for theme in place.themes],
            weather_score=round(score, 2),
            recommendation_reasons=reasons,
        )
        for place, score, reasons in scored_places[: payload.limit]
    ]

    return WeatherCourseRecommendationResponse(
        weather=WeatherSnapshotResponse(
            sky=weather_context.sky,
            precipitation_type=weather_context.precipitation_type,
            temperature_celsius=weather_context.temperature_celsius,
            precipitation_probability=weather_context.precipitation_probability,
            humidity=weather_context.humidity,
            observed_at=weather_context.observed_at,
        ),
        recommendation_summary=recommendation_summary,
        items=items,
    )