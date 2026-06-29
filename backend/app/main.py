from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine

def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="세종시 맞춤형 여행 큐레이션 서비스 백엔드 API",
    )
    application.include_router(health_router)
    return application

app = create_application()

# CORS 설정: 앱 배포 시 승인된 도메인만 통신 허용
origins = [
    "http://localhost:3000",
    "https://your-production-app-domain.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

@app.get("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)