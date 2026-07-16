from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.cart import router as cart_router
from app.api.routes.external import (
    tourism_router,
    kakao_router,
    weather_router,
    kakao_auth_router,
)
from app.api.routes.health import router as health_router
from app.api.routes.medical import router as medical_router
from app.api.routes.places import router as places_router
from app.api.routes.travel_log import router as travel_log_router
from app.api.routes.routes import router as routes_router
from app.api.routes.users import router as users_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.medical_facility import MedicalFacility

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=engine)
    yield


def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="세종시 맞춤형 여행 큐레이션 서비스 백엔드 API",
        lifespan=lifespan,
    )

    # CORS 설정: 앱 배포 시 승인된 도메인만 통신 허용
    # 실제 배포 도메인은 하드코딩하지 않고 .env의 CORS_EXTRA_ORIGINS로 넣는다
    # (예: CORS_EXTRA_ORIGINS=https://yeoro.app,https://www.yeoro.app)
    origins = [
        "http://localhost:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
<<<<<<< HEAD
        "capacitor://localhost",       # Capacitor 기반 WebView 셸
        "null",                        # file:// 로 로드되는 안드로이드 WebView(현재 MainActivity 방식)의 Origin
=======
        "capacitor://localhost",       # 안드로이드 WebView 셸
>>>>>>> df7813cbacb9f75c080741f1a81df4e01a0ce0b4
        *[origin.strip() for origin in settings.cors_extra_origins.split(",") if origin.strip()],
    ]
    
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
    )
    
    application.include_router(auth_router)
    application.include_router(health_router)
    
    # ====================================================================
    # [수정] 4개의 외부 API 라우터를 메인 앱에 독립적으로 직접 등록합니다.
    # 각 라우터에 prefix("/external")를 수동으로 붙여 경로 계층을 만듭니다.
    # ====================================================================
    application.include_router(tourism_router, prefix="/external")
    application.include_router(kakao_router, prefix="/external")
    application.include_router(weather_router, prefix="/external")
    application.include_router(kakao_auth_router, prefix="/external")
    
    application.include_router(users_router)
    application.include_router(places_router)
    application.include_router(cart_router)
    application.include_router(routes_router)
    application.include_router(travel_log_router)
    application.include_router(medical_router)
    
    return application

app = create_application()
