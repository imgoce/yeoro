from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, joinedload

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, get_db
from app.models.bookmark import Bookmark
from app.models.place import Place
from app.models.region import Region
from app.models.review import Review
from app.models.theme import Theme
from app.models.user import User
from app.schemas.place import PlaceSearchResponse, PlaceSummaryResponse, RecommendationRequest, RecommendationResponse

router = APIRouter(prefix="/places", tags=["places"])


def build_place_summary(
    place: Place,
    average_rating: float | None,
    review_count: int,
    bookmark_count: int,
    recommendation_score: float | None = None,
    recommendation_reasons: list[str] | None = None,
) -> PlaceSummaryResponse:
    return PlaceSummaryResponse(
        id=place.id,
        name=place.name,
        category=place.category,
        address=place.address,
        summary=place.summary,
        latitude=place.latitude,
        longitude=place.longitude,
        opening_hours=place.opening_hours,
        contact=place.contact,
        region=place.region.name,
        themes=[theme.name for theme in place.themes],
        average_rating=round(average_rating, 2) if average_rating is not None else None,
        review_count=review_count,
        bookmark_count=bookmark_count,
        recommendation_score=round(recommendation_score, 2) if recommendation_score is not None else None,
        recommendation_reasons=recommendation_reasons or [],
    )


def apply_place_filters(
    statement: Select[tuple[Place]],
    keyword: str | None,
    category: str | None,
    region_id: int | None,
    theme: str | None,
) -> Select[tuple[Place]]:
    if keyword:
        pattern = f"%{keyword}%"
        statement = statement.where(
            or_(
                Place.name.ilike(pattern),
                Place.address.ilike(pattern),
                Place.summary.ilike(pattern),
            )
        )
    if category:
        statement = statement.where(Place.category == category)
    if region_id:
        statement = statement.where(Place.region_id == region_id)
    if theme:
        statement = statement.where(Place.themes.any(Theme.name == theme))
    return statement


def fetch_place_metrics(db: Session, place_ids: list[int]) -> dict[int, dict[str, float | int | None]]:
    if not place_ids:
        return {}

    review_rows = db.execute(
        select(
            Review.place_id,
            func.avg(Review.rating),
            func.count(Review.id),
        )
        .where(Review.place_id.in_(place_ids))
        .group_by(Review.place_id)
    ).all()
    bookmark_rows = db.execute(
        select(
            Bookmark.place_id,
            func.count(Bookmark.id),
        )
        .where(Bookmark.place_id.in_(place_ids))
        .group_by(Bookmark.place_id)
    ).all()

    metrics = {
        place_id: {
            "average_rating": None,
            "review_count": 0,
            "bookmark_count": 0,
        }
        for place_id in place_ids
    }

    for place_id, average_rating, review_count in review_rows:
        metrics[place_id]["average_rating"] = float(average_rating) if average_rating is not None else None
        metrics[place_id]["review_count"] = int(review_count)
    for place_id, bookmark_count in bookmark_rows:
        metrics[place_id]["bookmark_count"] = int(bookmark_count)
    return metrics


@router.get("/search", response_model=PlaceSearchResponse)
def search_places(
    keyword: str | None = Query(default=None, min_length=1),
    category: str | None = Query(default=None),
    region_id: int | None = Query(default=None, ge=1),
    theme: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> PlaceSearchResponse:
    base_statement = apply_place_filters(select(Place), keyword, category, region_id, theme)
    total = db.scalar(select(func.count()).select_from(base_statement.subquery())) or 0
    places = (
        db.execute(
            base_statement
            .options(joinedload(Place.region), joinedload(Place.themes))
            .order_by(Place.name.asc())
            .offset(offset)
            .limit(limit)
        )
        .unique()
        .scalars()
        .all()
    )
    metrics = fetch_place_metrics(db, [place.id for place in places])
    items = [
        build_place_summary(
            place=place,
            average_rating=metrics[place.id]["average_rating"],
            review_count=int(metrics[place.id]["review_count"]),
            bookmark_count=int(metrics[place.id]["bookmark_count"]),
        )
        for place in places
    ]
    return PlaceSearchResponse(total=total, items=items)


@router.post("/recommendations", response_model=RecommendationResponse)
def recommend_places(
    payload: RecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RecommendationResponse:
    preferred_themes = payload.preferred_themes
    if not preferred_themes:
        preferred_themes = []
        if current_user.preferred_themes:
            import json

            preferred_themes = json.loads(current_user.preferred_themes)

    preferred_transport = payload.preferred_transport or current_user.preferred_transport

    statement = apply_place_filters(
        select(Place).options(joinedload(Place.region), joinedload(Place.themes)),
        keyword=None,
        category=payload.category,
        region_id=payload.region_id,
        theme=None,
    )
    places = db.execute(statement).unique().scalars().all()
    metrics = fetch_place_metrics(db, [place.id for place in places])

    scored_places: list[tuple[float, Place, list[str]]] = []
    for place in places:
        place_theme_names = {theme.name for theme in place.themes}
        matched_themes = [theme_name for theme_name in preferred_themes if theme_name in place_theme_names]
        metric = metrics[place.id]
        average_rating = float(metric["average_rating"]) if metric["average_rating"] is not None else 0.0
        review_count = int(metric["review_count"])
        bookmark_count = int(metric["bookmark_count"])

        score = 0.0
        reasons: list[str] = []

        if matched_themes:
            score += len(matched_themes) * 3
            reasons.append(f"선호 테마 일치: {', '.join(matched_themes)}")
        if preferred_transport and preferred_transport.lower() == "walk" and place.category in {"cafe", "restaurant"}:
            score += 1.5
            reasons.append("도보 이동에 적합한 카테고리")
        if preferred_transport and preferred_transport.lower() == "car" and place.category in {"nature", "experience"}:
            score += 1.5
            reasons.append("차량 이동 선호와 잘 맞는 장소")
        if average_rating:
            score += min(average_rating, 5.0)
            reasons.append(f"평점 우수 ({average_rating:.1f})")
        if bookmark_count:
            score += min(bookmark_count * 0.3, 2.0)
            reasons.append(f"북마크 인기 {bookmark_count}건")
        if review_count:
            score += min(review_count * 0.2, 2.0)

        if not reasons:
            reasons.append("기본 추천 후보")

        scored_places.append((score, place, reasons))

    scored_places.sort(key=lambda item: (-item[0], item[1].name))
    top_places = scored_places[: payload.limit]
    items = [
        build_place_summary(
            place=place,
            average_rating=metrics[place.id]["average_rating"],
            review_count=int(metrics[place.id]["review_count"]),
            bookmark_count=int(metrics[place.id]["bookmark_count"]),
            recommendation_score=score,
            recommendation_reasons=reasons,
        )
        for score, place, reasons in top_places
    ]
    return RecommendationResponse(items=items)