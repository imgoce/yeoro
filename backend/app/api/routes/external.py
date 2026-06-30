from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import get_tourism_api_client
from app.clients.tourism import TourismApiClient, TourismApiError

router = APIRouter(prefix="/external/tourism", tags=["external-tourism"])


@router.get("/places")
async def get_places(
    area_code: int = Query(..., ge=1),
    sigungu_code: int | None = Query(default=None, ge=1),
    content_type_id: int | None = Query(default=None, ge=1),
    page_no: int = Query(default=1, ge=1),
    num_of_rows: int = Query(default=20, ge=1, le=100),
    client: TourismApiClient = Depends(get_tourism_api_client),
) -> dict:
    try:
        return await client.get_area_based_list(
            area_code=area_code,
            sigungu_code=sigungu_code,
            content_type_id=content_type_id,
            page_no=page_no,
            num_of_rows=num_of_rows,
        )
    except TourismApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/nearby")
async def get_nearby_places(
    map_x: float,
    map_y: float,
    radius: int = Query(default=3000, ge=1, le=20000),
    content_type_id: int | None = Query(default=None, ge=1),
    page_no: int = Query(default=1, ge=1),
    num_of_rows: int = Query(default=20, ge=1, le=100),
    client: TourismApiClient = Depends(get_tourism_api_client),
) -> dict:
    try:
        return await client.get_location_based_list(
            map_x=map_x,
            map_y=map_y,
            radius=radius,
            content_type_id=content_type_id,
            page_no=page_no,
            num_of_rows=num_of_rows,
        )
    except TourismApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/places/{content_id}")
async def get_place_detail(
    content_id: int,
    content_type_id: int | None = Query(default=None, ge=1),
    client: TourismApiClient = Depends(get_tourism_api_client),
) -> dict:
    try:
        return await client.get_common_detail(
            content_id=content_id,
            content_type_id=content_type_id,
        )
    except TourismApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc