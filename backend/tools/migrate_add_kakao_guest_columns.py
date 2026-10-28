"""
로컬 개발 DB(sejong_tour.db)의 users 테이블에 카카오/게스트 로그인을 위한
컬럼(kakao_id, auth_provider)을 추가하는 1회성 마이그레이션 스크립트.

Alembic이 없고 SQLAlchemy의 Base.metadata.create_all은 이미 존재하는 테이블에
컬럼을 추가해주지 않으므로, 이 스크립트로 직접 ALTER TABLE을 실행한다.
기존 행은 건드리지 않는다 (auth_provider는 DEFAULT 'email'로 자동 채워짐).

사용법:
    python tools/migrate_add_kakao_guest_columns.py
"""
import sqlite3
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

DB_PATH = Path(__file__).resolve().parent.parent / "sejong_tour.db"


def main() -> None:
    if not DB_PATH.exists():
        print(f"DB 파일이 없습니다: {DB_PATH} (앱을 한 번도 실행 안 했다면 정상 — 다음 실행 시 새 스키마로 자동 생성됩니다)")
        return

    conn = sqlite3.connect(DB_PATH)
    existing_columns = {row[1] for row in conn.execute("PRAGMA table_info(users)")}

    if "kakao_id" not in existing_columns:
        conn.execute("ALTER TABLE users ADD COLUMN kakao_id VARCHAR(64)")
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_kakao_id ON users(kakao_id)")
        print("kakao_id 컬럼 추가 완료")
    else:
        print("kakao_id 컬럼 이미 존재함 (건너뜀)")

    if "auth_provider" not in existing_columns:
        conn.execute("ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) NOT NULL DEFAULT 'email'")
        print("auth_provider 컬럼 추가 완료 (기존 행은 모두 'email'로 채워짐)")
    else:
        print("auth_provider 컬럼 이미 존재함 (건너뜀)")

    conn.commit()
    conn.close()
    print("\n마이그레이션 완료. 기존 계정 데이터는 삭제/수정되지 않았습니다.")


if __name__ == "__main__":
    main()
