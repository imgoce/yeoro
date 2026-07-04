# yeoro
5060 세대와 유아 동반 가족들을 대상으로 세종시의 행사/축제/지역 명소/음식점을 추천해주는 개인 맞춤형 여행 큐레이션 서비스

## 기술 스택

- FastAPI
- SQLAlchemy 2.x
- Pydantic Settings
- SQLite (기본 개발 DB)

## 실행 방법

1. 가상환경 생성 및 활성화
2. 의존성 설치

```bash
pip install -r requirements.txt
```

3. 서버 실행

```bash
uvicorn app.main:app --reload
```

## 환경 변수

`.env` 파일 예시:

```env
APP_NAME=Sejong Tour API
APP_ENV=local
DATABASE_URL=sqlite:///./sejong_tour.db
SECRET_KEY=change-this-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=1440
JWT_ALGORITHM=HS256
TOURISM_API_BASE_URL=https://apis.data.go.kr/B551011/KorService1
TOURISM_API_KEY=your_service_key
TOURISM_API_TIMEOUT_SECONDS=10
KAKAO_MAP_API_BASE_URL=https://dapi.kakao.com
KAKAO_MAP_REST_API_KEY=your_kakao_rest_api_key
KAKAO_MAP_TIMEOUT_SECONDS=10
WEATHER_API_BASE_URL=https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0
WEATHER_API_KEY=your_weather_service_key
WEATHER_API_TIMEOUT_SECONDS=10
REDIS_URL=redis://localhost:6379/0
REDIS_DEFAULT_TTL_SECONDS=300
```

## 주요 도메인 모델

- `User`: 사용자 계정 및 선호 정보
- `Region`: 세종시 권역 정보
- `Place`: 관광지/맛집/카페/숙소 등 장소 정보
- `Theme`: 여행 테마 정보
- `Course`: 큐레이션된 여행 코스
- `CoursePlace`: 코스 내 장소 순서 정보
- `Bookmark`: 사용자 북마크
- `Review`: 사용자 리뷰

## 외부 API 클라이언트

한국관광공사 TourAPI 기반 외부 API 클라이언트가 추가되어 있습니다.

- `GET /external/tourism/places`: 지역 기반 관광지 조회
- `GET /external/tourism/nearby`: 좌표 기반 주변 관광지 조회
- `GET /external/tourism/places/{content_id}`: 관광지 상세 조회

예시:

```bash
curl "http://localhost:8000/external/tourism/places?area_code=8"
```