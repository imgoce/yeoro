<div align="center">
  <img width="200" height="200" alt="image" src="https://github.com/user-attachments/assets/59f62355-46aa-4160-ad52-e63e9d6a37c6" />
  <br/>
  <a href="https://git.io/typing-svg">
    <img src="https://readme-typing-svg.demolab.com/?font=Fira+Code&weight=600&size=35&pause=1000&color=00D9FFFF&center=true&vCenter=true&width=435&lines=Yeoro" alt="Typing SVG" />
  </a>
</div>

# yeoro (여로)

5060 액티브 시니어와 영유아 동반 가족을 대상으로, 세종시의 관광명소·맛집·축제·의료기관 정보를
**무장애 기능(휠체어·유모차 진입 가능 여부 등)으로 큐레이션**해주는 개인 맞춤형 여행 추천 서비스입니다.

## 핵심 기능

- **온보딩 & 로그인** — 4개 핵심 기능을 소개하는 온보딩 화면, 카카오 OAuth 로그인 또는 게스트 모드로 시작
- **여행 모드 선택** — `5060 액티브 시니어 산책 모드` / `영유아 동반 부모 코스 모드` 중 선택 시 폰트·톤이 달라짐
- **통합 큐레이션** — 관광명소·먹거리·축제·의료기관 4개 카테고리를 하나의 화면에서 탐색
- **동선 추천** — 담아둔 장소를 현재 위치 기준 최단 동선으로 자동 정렬, 랜덤 추천 지원
- **장바구니 → 일정 변환** — 관심 장소를 담았다가 한 번에 오늘의 일정으로 변환
- **여행 로그** — 다녀온 곳 기록 (게스트는 기기 로컬 저장, 로그인 시 서버 동기화 예정)
- **글자 크기 조절** — 90~160% 슬라이더로 시니어 친화적 가독성 지원
- **오프라인 폴백** — 공공 API 키가 없거나 호출에 실패해도 로컬 폴백 데이터로 전 기능이 동작
- **앱 진입 스플래시 애니메이션** — 로고가 1.5초간 등장했다 사라지는 진입 연출

## 기술 스택

| 영역 | 스택 |
|---|---|
| 프론트엔드 | Vanilla JS(ES6+), HTML5, CSS3, Bootstrap 5(레이아웃 유틸), Material Icons |
| 백엔드 | FastAPI, Pydantic v2, PyJWT, bcrypt, httpx |
| Android 셸 | Kotlin, WebView, Kakao Login SDK(`v2-user`), AndroidX Browser(Custom Tabs) |
| 외부 연동 | 카카오 로그인/지도, 공공데이터포털(한국관광공사 국문·웰니스 관광정보), 기상청 API *(선택, 키 없이도 폴백 동작)* |

## 프로젝트 구조

```
yeoro/
├── frontend/
│   ├── index.html            # 온보딩·로그인·메인 앱 마크업 (SPA 형태)
│   ├── privacy-policy.html   # 스토어 제출용 개인정보처리방침
│   ├── css/style.css         # 디자인 토큰 + 전체 스타일
│   ├── js/
│   │   ├── config.js         # API 키 설정 (LOGO_SRC, API_CONFIG)
│   │   ├── state.js          # 앱 상태 + 로컬 폴백 데이터
│   │   ├── storage.js        # 게스트/회원 식별자, 로컬 저장
│   │   ├── screens.js        # 화면 전환 로직
│   │   ├── onboarding.js     # 온보딩 튜토리얼 흐름
│   │   ├── auth.js           # 카카오 OAuth 로그인
│   │   ├── geolocation.js    # GPS 기반 현재 위치
│   │   ├── api.js            # 외부 API 호출 (실패 시 항상 null/[] 반환)
│   │   ├── places.js         # 카테고리별 장소 데이터 로딩
│   │   ├── cart.js           # 장바구니
│   │   ├── schedule.js       # 일정·동선 추천
│   │   ├── utils.js          # haversine 등 공용 유틸
│   │   └── logo-data.js      # 로고 base64 리소스
│   └── tools/live_server.py  # 저장 시 자동 새로고침되는 로컬 미리보기 서버
├── android/                   # frontend/를 WebView로 감싸는 네이티브 셸 (카카오 로그인 안정화 목적)
│   └── app/src/main/java/com/yeoro/app/
│       ├── MainActivity.kt       # WebView 호스트 + 카카오 SDK 로그인 + Custom Tabs 안전망
│       ├── KakaoLoginBridge.kt   # JS ↔ 네이티브 브릿지 (window.YeoroNative)
│       └── YeoroApplication.kt   # 카카오 SDK 초기화
└── backend/
    ├── requirements.txt
    └── app/
        ├── main.py           # FastAPI 앱 진입점, CORS 설정
        ├── core/
        │   ├── config.py     # 환경변수 기반 설정(.env)
        │   └── security.py   # 인증 관련 유틸
        ├── api/curation.py   # /curation/recommendations 추천 엔드포인트 (스캐폴드)
        ├── models/user.py    # SQLAlchemy User 모델
        └── schemas/user.py   # Pydantic 스키마
```

## 시작하기

### 프론트엔드 미리보기

별도 빌드 도구 없이 표준 라이브러리만으로 동작하는 자동 새로고침 서버가 포함되어 있습니다.

```bash
cd frontend
python tools/live_server.py        # 기본 포트 5500
```

브라우저에서 http://localhost:5500 접속 — 파일을 저장할 때마다 자동으로 새로고침됩니다.
`js/config.js`의 `API_CONFIG` 키를 비워둬도 `state.js`의 로컬 폴백 데이터로 모든 화면이 정상 동작합니다.

### 백엔드 실행

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

`backend/.env` 파일에 아래 값을 채우면 실제 API가 연동됩니다 (없어도 서버 자체는 기동됩니다):

```
SECRET_KEY=
TOUR_API_KEY=       # 공공데이터포털 — 한국관광공사 국문/웰니스 관광정보 서비스
KAKAO_MAP_API_KEY=  # 카카오맵 — 실시간 경로 최적화
WEATHER_API_KEY=    # 기상청 — 날씨 대응 추천
```

### 프론트엔드 API 키 (선택)

`frontend/js/config.js`의 `API_CONFIG`에 아래 키를 채우면 실제 공공데이터·카카오 연동이 활성화됩니다.
키를 넣지 않아도 로컬 폴백 데이터로 정상 동작합니다.

- `DATA_GO_KR_KEY` — [data.go.kr](https://www.data.go.kr)에서 "한국관광공사_국문 관광정보 서비스" 활용신청 후 발급
- `KAKAO_REST_KEY` / `KAKAO_JS_KEY` — [Kakao Developers](https://developers.kakao.com)에서 발급 (카카오맵 검색 + 로그인)

### Android 앱 (카카오 로그인 안정화)

`frontend/`를 WebView로 감싼 네이티브 셸이 `android/`에 있습니다. 웹 브라우저에서는 기존
OAuth 리다이렉트 방식 그대로 동작하고, 이 앱 안에서는 카카오톡 앱 전환 또는 시스템 브라우저
(Custom Tabs)로 로그인하는 공식 카카오 SDK 방식으로 자동 전환됩니다 — 임베디드 WebView가
카카오/구글 로그인에서 차단되는 문제(`disallowed_useragent`)를 피하기 위함입니다.
설정 방법은 [android/README.md](android/README.md) 참고.

## 라이선스

Apache License 2.0 — 자세한 내용은 [LICENSE](LICENSE) 참고.
