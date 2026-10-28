from decimal import Decimal
from math import asin, cos, radians, sin, sqrt

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.medical_facility import MedicalFacility
from app.schemas.medical import MedicalFacilityResponse, MedicalFacilitySearchResponse

router = APIRouter(prefix="/medical-facilities", tags=["medical-facilities"])


def calculate_distance_km(
    origin_latitude: Decimal,
    origin_longitude: Decimal,
    target_latitude: Decimal,
    target_longitude: Decimal,
) -> float:
    earth_radius_km = 6371.0
    lat1 = radians(float(origin_latitude))
    lon1 = radians(float(origin_longitude))
    lat2 = radians(float(target_latitude))
    lon2 = radians(float(target_longitude))
    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1
    haversine = sin(delta_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lon / 2) ** 2
    return 2 * earth_radius_km * asin(sqrt(haversine))


@router.get("/nearby", response_model=MedicalFacilitySearchResponse)
def search_nearby_medical_facilities(
    latitude: Decimal = Query(ge=-90, le=90),
    longitude: Decimal = Query(ge=-180, le=180),
    radius_km: float = Query(default=5.0, gt=0, le=30),
    category: str | None = Query(default=None),
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
) -> MedicalFacilitySearchResponse:
    statement = select(MedicalFacility)
    if category:
        statement = statement.where(MedicalFacility.category == category)

    facilities = db.execute(statement.order_by(MedicalFacility.name.asc())).scalars().all()
    matched_items: list[MedicalFacilityResponse] = []
    for facility in facilities:
        distance_km = calculate_distance_km(latitude, longitude, facility.latitude, facility.longitude)
        if distance_km <= radius_km:
            matched_items.append(
                MedicalFacilityResponse(
                    id=facility.id,
                    name=facility.name,
                    category=facility.category,
                    address=facility.address,
                    phone=facility.phone,
                    latitude=facility.latitude,
                    longitude=facility.longitude,
                    operating_hours=facility.operating_hours,
                    distance_km=round(distance_km, 2),
                )
            )

    matched_items.sort(key=lambda item: (item.distance_km, item.name))
    return MedicalFacilitySearchResponse(total=len(matched_items), items=matched_items[:limit])