from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router

# ====================================================================
# [수정] 존재하지 않는 external_router를 버리고,
# 실제 작동하는 4개의 개별 서브 라우터를 깔끔하게 직접 가져옵니다.
# ====================================================================
from app.api.routes.external import (
    tourism_router,
    kakao_router,
    weather_router,
    kakao_auth_router,
)
from app.api.routes.users import router as users_router
from app.api.routes.travel_log import router as travel_log_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine


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

    origins = [
        "http://localhost:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "capacitor://localhost",
        "https://your-production-app-domain.com",
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
    application.include_router(travel_log_router)
    
    return application

app = create_application()