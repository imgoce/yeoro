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
