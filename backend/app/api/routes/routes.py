from decimal import Decimal
from math import atan2, cos, radians, sin, sqrt

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.place import Place
from app.models.user import User
from app.schemas.route import (
    OptimizedRoutePlaceResponse,
    RouteOptimizeRequest,
    RouteOptimizeResponse,
)

router = APIRouter(prefix="/routes", tags=["routes"])


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