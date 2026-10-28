from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from math import atan2, cos, radians, sin, sqrt

from app.models.place import Place


def calculate_distance_km(
    start_latitude: Decimal,
    start_longitude: Decimal,
    end_latitude: Decimal,
    end_longitude: Decimal,
) -> float:
    earth_radius_km = 6371.0
    latitude_delta = radians(float(end_latitude) - float(start_latitude))
    longitude_delta = radians(float(end_longitude) - float(start_longitude))
    start_latitude_rad = radians(float(start_latitude))
    end_latitude_rad = radians(float(end_latitude))

    haversine = (
        sin(latitude_delta / 2) ** 2
        + cos(start_latitude_rad) * cos(end_latitude_rad) * sin(longitude_delta / 2) ** 2
    )
    arc = 2 * atan2(sqrt(haversine), sqrt(1 - haversine))
    return earth_radius_km * arc


@dataclass(slots=True)
class WeatherRecommendationContext:
    sky: str | None = None
    precipitation_type: str | None = None
    temperature_celsius: float | None = None
    precipitation_probability: int | None = None
    humidity: int | None = None
    observed_at: str | None = None


def build_personalized_itinerary(
    *,
    places: list[Place],
    preferred_themes: list[str],
    preferred_transport: str | None,
    start_place_id: int | None,
    max_places: int,
) -> tuple[list[tuple[Place, float, list[str]]], float]:
    place_by_id = {place.id: place for place in places}
    if start_place_id is not None and start_place_id not in place_by_id:
        raise ValueError("출발 장소는 후보 장소 목록에 포함되어야 합니다.")

    scored_places: list[tuple[float, Place, list[str]]] = []
    normalized_transport = preferred_transport.lower() if preferred_transport else None

    for place in places:
        score = 0.0
        reasons: list[str] = []
        place_theme_names = {theme.name for theme in place.themes}
        matched_themes = [theme for theme in preferred_themes if theme in place_theme_names]

        if matched_themes:
            score += len(matched_themes) * 4
            reasons.append(f"선호 테마 반영: {', '.join(matched_themes)}")
        if normalized_transport == "walk" and place.category in {"cafe", "restaurant", "culture"}:
            score += 2.0
            reasons.append("도보 여행에 어울리는 장소")
        if normalized_transport == "car" and place.category in {"nature", "experience", "landmark"}:
            score += 2.0
            reasons.append("차량 이동 효율이 좋은 장소")
        if place.summary:
            score += 0.5
        if not reasons:
            reasons.append("여행 코스 후보로 적합")

        scored_places.append((score, place, reasons))

    scored_places.sort(key=lambda item: (-item[0], item[1].name))
    selected_places = [place for _, place, _ in scored_places[:max_places]]
    selected_ids = {place.id for place in selected_places}

    if start_place_id is not None and start_place_id not in selected_ids:
        selected_places = [place_by_id[start_place_id], *selected_places[:-1]]

    ordered_places: list[tuple[Place, float, list[str]]] = []
    remaining_places = selected_places.copy()

    if start_place_id is not None:
        current_place = place_by_id[start_place_id]
        remaining_places = [place for place in remaining_places if place.id != start_place_id]
        start_reason = ["사용자가 지정한 출발지"]
    else:
        current_place = remaining_places.pop(0)
        start_reason = next(reasons for score, place, reasons in scored_places if place.id == current_place.id)

    ordered_places.append((current_place, 0.0, start_reason))
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
        segment_distance = calculate_distance_km(
            current_place.latitude,
            current_place.longitude,
            next_place.latitude,
            next_place.longitude,
        )
        total_distance_km += segment_distance
        reasons = next(reasons for score, place, reasons in scored_places if place.id == next_place.id)
        ordered_places.append((next_place, segment_distance, reasons))
        remaining_places.remove(next_place)
        current_place = next_place

    return ordered_places, round(total_distance_km, 2)


def build_weather_recommendation(
    *,
    places: list[Place],
    weather: WeatherRecommendationContext,
) -> tuple[list[tuple[Place, float, list[str]]], list[str]]:
    normalized_sky = (weather.sky or "").lower()
    normalized_precipitation = (weather.precipitation_type or "").lower()
    rainy = any(keyword in normalized_precipitation for keyword in ("비", "rain", "snow", "shower"))
    cloudy = "흐" in normalized_sky or "cloud" in normalized_sky
    hot = weather.temperature_celsius is not None and weather.temperature_celsius >= 28
    cold = weather.temperature_celsius is not None and weather.temperature_celsius <= 5

    global_reasons: list[str] = []
    if rainy:
        global_reasons.append("강수 예보가 있어 실내 위주 장소를 우선 추천합니다.")
    elif hot:
        global_reasons.append("더운 날씨를 고려해 실내·휴식형 장소를 우선 추천합니다.")
    elif cold:
        global_reasons.append("추운 날씨를 고려해 실내 체류 시간이 긴 장소를 우선 추천합니다.")
    elif cloudy:
        global_reasons.append("흐린 날씨에 맞춰 이동 부담이 적은 장소를 추천합니다.")
    else:
        global_reasons.append("맑은 날씨라 야외 체험 장소를 우선 추천합니다.")

    scored_places: list[tuple[Place, float, list[str]]] = []
    for place in places:
        score = 0.0
        reasons: list[str] = []
        category = place.category.lower()
        theme_names = {theme.name.lower() for theme in place.themes}

        indoor = category in {"museum", "cafe", "restaurant", "culture"} or any(
            keyword in theme_names for keyword in {"실내", "전시", "카페", "휴식"}
        )
        outdoor = category in {"nature", "experience", "landmark"} or any(
            keyword in theme_names for keyword in {"야외", "산책", "자연", "체험"}
        )

        if rainy or hot or cold:
            if indoor:
                score += 4.0
                reasons.append("현재 날씨에 적합한 실내형 장소")
            if place.opening_hours:
                score += 0.5
                reasons.append("운영 정보가 명확해 방문 계획 수립이 쉬움")
        else:
            if outdoor:
                score += 4.0
                reasons.append("맑은 날씨에 즐기기 좋은 야외형 장소")
            if indoor:
                score += 1.0
                reasons.append("날씨 변화 시 대안으로 적합")

        if cloudy and category in {"cafe", "restaurant"}:
            score += 1.5
            reasons.append("흐린 날씨에 휴식하기 좋은 장소")

        if not reasons:
            reasons.append("현재 날씨 기준 기본 추천 장소")

        scored_places.append((place, score, reasons))

    scored_places.sort(key=lambda item: (-item[1], item[0].name))
    return scored_places, global_reasons