from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import (
    get_kakao_map_api_client,
    get_redis_cache,
    get_tourism_api_client,
    get_weather_api_client,
)
from app.clients.kakaomap import KakaoMapApiClient, KakaoMapApiError
from app.clients.tourism import TourismApiClient, TourismApiError
from app.clients.weather import WeatherApiClient, WeatherApiError
from app.core.cache import RedisCache

router = APIRouter(prefix="/external/tourism", tags=["external-tourism"])


@router.get("/places")
async def get_places(
    area_code: int = Query(..., ge=1),
    sigungu_code: int | None = Query(default=None, ge=1),
    content_type_id: int | None = Query(default=None, ge=1),
    page_no: int = Query(default=1, ge=1),
    num_of_rows: int = Query(default=20, ge=1, le=100),
    client: TourismApiClient = Depends(get_tourism_api_client),
    cache: RedisCache = Depends(get_redis_cache),
) -> dict:
    try:
        cache_key = (
            f"tourism:places:{area_code}:{sigungu_code}:{content_type_id}:"
            f"{page_no}:{num_of_rows}"
        )
        return await cache.get_or_set_json(
            cache_key,
            lambda: client.get_area_based_list(
                area_code=area_code,
                sigungu_code=sigungu_code,
                content_type_id=content_type_id,
                page_no=page_no,
                num_of_rows=num_of_rows,
            ),
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
    cache: RedisCache = Depends(get_redis_cache),
) -> dict:
    try:
        cache_key = (
            f"tourism:nearby:{map_x}:{map_y}:{radius}:{content_type_id}:"
            f"{page_no}:{num_of_rows}"
        )
        return await cache.get_or_set_json(
            cache_key,
            lambda: client.get_location_based_list(
                map_x=map_x,
                map_y=map_y,
                radius=radius,
                content_type_id=content_type_id,
                page_no=page_no,
                num_of_rows=num_of_rows,
            ),
        )
    except TourismApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/places/{content_id}")
async def get_place_detail(
    content_id: int,
    content_type_id: int | None = Query(default=None, ge=1),
    client: TourismApiClient = Depends(get_tourism_api_client),
    cache: RedisCache = Depends(get_redis_cache),
) -> dict:
    try:
        cache_key = f"tourism:detail:{content_id}:{content_type_id}"
        return await cache.get_or_set_json(
            cache_key,
            lambda: client.get_common_detail(
                content_id=content_id,
                content_type_id=content_type_id,
            ),
        )
    except TourismApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


kakao_router = APIRouter(prefix="/external/kakao-map", tags=["external-kakao-map"])


@kakao_router.get("/search")
async def search_places(
    query: str = Query(..., min_length=1),
    x: float | None = Query(default=None),
    y: float | None = Query(default=None),
    radius: int | None = Query(default=None, ge=1, le=20000),
    page: int = Query(default=1, ge=1, le=45),
    size: int = Query(default=15, ge=1, le=15),
    client: KakaoMapApiClient = Depends(get_kakao_map_api_client),
    cache: RedisCache = Depends(get_redis_cache),
) -> dict:
    try:
        cache_key = f"kakao:search:{query}:{x}:{y}:{radius}:{page}:{size}"
        return await cache.get_or_set_json(
            cache_key,
            lambda: client.search_keyword(
                query=query,
                x=x,
                y=y,
                radius=radius,
                page=page,
                size=size,
            ),
        )
    except KakaoMapApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@kakao_router.get("/category")
async def search_category_places(
    category_group_code: str = Query(..., min_length=1, max_length=3),
    x: float = Query(...),
    y: float = Query(...),
    radius: int = Query(default=3000, ge=1, le=20000),
    page: int = Query(default=1, ge=1, le=45),
    size: int = Query(default=15, ge=1, le=15),
    client: KakaoMapApiClient = Depends(get_kakao_map_api_client),
    cache: RedisCache = Depends(get_redis_cache),
) -> dict:
    try:
        cache_key = (
            f"kakao:category:{category_group_code}:{x}:{y}:{radius}:{page}:{size}"
        )
        return await cache.get_or_set_json(
            cache_key,
            lambda: client.search_category(
                category_group_code=category_group_code,
                x=x,
                y=y,
                radius=radius,
                page=page,
                size=size,
            ),
        )
    except KakaoMapApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@kakao_router.get("/region-code")
async def get_region_code(
    x: float = Query(...),
    y: float = Query(...),
    client: KakaoMapApiClient = Depends(get_kakao_map_api_client),
    cache: RedisCache = Depends(get_redis_cache),
) -> dict:
    try:
        cache_key = f"kakao:region-code:{x}:{y}"
        return await cache.get_or_set_json(
            cache_key,
            lambda: client.coord_to_region_code(x=x, y=y),
        )
    except KakaoMapApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


weather_router = APIRouter(prefix="/external/weather", tags=["external-weather"])


@weather_router.get("/forecast")
async def get_forecast(
    base_date: str = Query(..., min_length=8, max_length=8),
    base_time: str = Query(..., min_length=4, max_length=4),
    nx: int = Query(..., ge=0),
    ny: int = Query(..., ge=0),
    page_no: int = Query(default=1, ge=1),
    num_of_rows: int = Query(default=100, ge=1, le=1000),
    client: WeatherApiClient = Depends(get_weather_api_client),
    cache: RedisCache = Depends(get_redis_cache),
) -> dict:
    try:
        cache_key = (
            f"weather:forecast:{base_date}:{base_time}:{nx}:{ny}:{page_no}:{num_of_rows}"
        )
        return await cache.get_or_set_json(
            cache_key,
            lambda: client.get_village_forecast(
                base_date=base_date,
                base_time=base_time,
                nx=nx,
                ny=ny,
                page_no=page_no,
                num_of_rows=num_of_rows,
            ),
        )
    except WeatherApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@weather_router.get("/nowcast")
async def get_nowcast(
    base_date: str = Query(..., min_length=8, max_length=8),
    base_time: str = Query(..., min_length=4, max_length=4),
    nx: int = Query(..., ge=0),
    ny: int = Query(..., ge=0),
    page_no: int = Query(default=1, ge=1),
    num_of_rows: int = Query(default=100, ge=1, le=1000),
    client: WeatherApiClient = Depends(get_weather_api_client),
    cache: RedisCache = Depends(get_redis_cache),
) -> dict:
    try:
        cache_key = (
            f"weather:nowcast:{base_date}:{base_time}:{nx}:{ny}:{page_no}:{num_of_rows}"
        )
        return await cache.get_or_set_json(
            cache_key,
            lambda: client.get_ultra_short_nowcast(
                base_date=base_date,
                base_time=base_time,
                nx=nx,
                ny=ny,
                page_no=page_no,
                num_of_rows=num_of_rows,
            ),
        )
    except WeatherApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc