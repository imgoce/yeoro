from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


def _normalize_db_url(url: str) -> str:
    """클라우드 DB 제공업체(Neon·Supabase·Railway 등)는 접속 주소를 보통
    `postgres://...` 형태로 주는데, SQLAlchemy 2.x는 이 접두어를 인식하지 못한다.
    드라이버(psycopg)를 명시한 형태로 바꿔준다."""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


DATABASE_URL = _normalize_db_url(settings.database_url)
_is_sqlite = DATABASE_URL.startswith("sqlite")

# SQLite는 스레드 제약을 풀어주고, 클라우드 PostgreSQL은 끊긴 커넥션을 자동 감지하게 한다.
# (서버가 유휴 상태로 있다가 깨어날 때 죽은 커넥션을 잡고 500이 나는 것을 방지)
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    pool_pre_ping=not _is_sqlite,
    pool_recycle=1800 if not _is_sqlite else -1,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
