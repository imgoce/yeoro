from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Sejong Tour API"
    app_env: str = "local"
    # 로컬 개발은 SQLite, 배포(Cloud Run 등)에서는 DATABASE_URL 환경변수로 PostgreSQL을 넣는다.
    # Cloud Run은 컨테이너가 꺼지면 파일이 사라지므로 SQLite를 쓰면 가입 정보·여행로그가 날아간다.
    database_url: str = "sqlite:///./sejong_tour.db"
    # 프론트엔드(정적 파일)를 백엔드가 함께 서빙할지 여부.
    # 켜면 주소 하나로 웹 화면과 API를 모두 제공해 CORS 설정이 필요 없어진다.
    serve_frontend: bool = True
    secret_key: str = "change-this-secret-key"
    access_token_expire_minutes: int = 60 * 24
    jwt_algorithm: str = "HS256"
    tourism_api_base_url: str = "https://apis.data.go.kr/B551011/KorService1"
    tourism_api_key: str = ""
    tourism_api_timeout_seconds: float = 10.0
    kakao_map_api_base_url: str = "https://dapi.kakao.com"
    kakao_map_rest_api_key: str = ""
    kakao_map_timeout_seconds: float = 10.0
    # 카카오 dapi KA 헤더의 origin — 카카오 콘솔 [플랫폼 > Web]에 등록된 도메인이어야 한다
    kakao_ka_origin: str = "http://localhost:5500"
    weather_api_base_url: str = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0"
    weather_api_key: str = ""
    weather_api_timeout_seconds: float = 10.0
    redis_url: str = "redis://localhost:6379/0"
    redis_default_ttl_seconds: int = 300
    cors_extra_origins: str = ""  # 실제 배포 도메인. 쉼표로 여러 개 지정 가능 (예: "https://yeoro.app,https://www.yeoro.app")

    # ── 프론트엔드(브라우저)로 내려보내는 공개 키 ─────────────────────
    # 배포 시 Cloud Run 환경변수로 주입한다. 비워두면 프론트는 폴백 데이터로 동작한다.
    # ⚠️ 브라우저에서 볼 수 있는 값이므로 '공개용 키'만 넣는다.
    #    (서버 전용 비밀값·카카오 client secret 등은 절대 여기 넣지 말 것)
    # 이 값들이 하나라도 채워져 있으면 "배포 환경"으로 보고 서버가 프론트 설정을 만들어 내려준다.
    # 로컬 개발에서는 비워두면 되고, 그때는 frontend/js/config.local.js 파일이 그대로 쓰인다.
    public_data_go_kr_key: str = ""   # 공공데이터포털 키 (관광·날씨·의료 공용)
    public_kakao_rest_key: str = ""   # 카카오 REST 키 (지도 검색용)
    public_kakao_js_key: str = ""     # 카카오 JavaScript 키 (앱 내 지도 표시용)
    public_kakao_navi_key: str = ""   # 카카오내비 길찾기 키 (목록의 소요시간·거리 계산용, REST 키)

    kakao_auth_base_url: str = "https://kauth.kakao.com"
    kakao_api_base_url: str = "https://kapi.kakao.com"
    kakao_rest_api_key: str = ""
    kakao_client_secret: str | None = None
    kakao_redirect_uri: str = ""
    kakao_timeout_seconds: float = 10.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()
