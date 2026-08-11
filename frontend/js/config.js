/* ════════════════════════════════════════════════════════════════════
   여로(Yero) — 세종시 무장애 큐레이션 앱
   ─ API 키를 API_CONFIG에 채우면 실제 API가 연동됩니다.
   ─ 키가 없어도 로컬 폴백 데이터로 모든 기능이 정상 동작합니다.
   ════════════════════════════════════════════════════════════════════ */

/* ── 로고 이미지 (base64, PNG) ─────────────────────────────────── */
const LOGO_SRC = 'data:image/png;base64,' + LOGO_BASE64.trim();

/* ── 배포 주소 ────────────────────────────────────────────────────
   ⚠️ 안드로이드 앱(APK)은 화면을 file:// 로 읽기 때문에 "지금 접속한 주소"가
   없다. 그래서 앱에서 쓸 서버 주소는 여기에 한 번 적어줘야 한다.
   백엔드를 배포한 뒤 아래 한 줄만 채우고 APK를 다시 빌드하면 된다.
   예) 'https://yeoro-xxxxx.a.run.app'                                  */
const DEPLOY_API_BASE_URL = 'https://yeoro-1083822668014.asia-northeast3.run.app';

/* 실행 환경에 따라 백엔드 주소를 자동으로 고른다.
   ① 배포된 웹      → 지금 접속한 주소 (백엔드가 화면도 같이 주므로 동일 출처)
   ② 로컬 미리보기  → 미리보기는 5500, 백엔드는 8000 포트로 따로 뜬다
   ③ 안드로이드 앱  → file:// 이므로 위에 적어둔 배포 주소 사용            */
function resolveApiBaseUrl() {
    const isWeb = /^https?:$/.test(window.location.protocol);
    if (!isWeb) return DEPLOY_API_BASE_URL || 'http://localhost:8000';
    if (window.location.port === '5500') return 'http://localhost:8000';
    return window.location.origin;
}

/* 카카오 dapi의 KA 헤더에 넣을 origin — 카카오 콘솔 [플랫폼 > Web]에 등록된 도메인이어야 한다.
   웹에서 접속했다면 그 주소를 그대로 쓰고, 앱(file://)이면 배포 주소를 쓴다. */
function resolveKakaoWebOrigin() {
    const isWeb = /^https?:$/.test(window.location.protocol);
    if (isWeb) return window.location.origin;
    return DEPLOY_API_BASE_URL || 'http://localhost:5500';
}

const API_CONFIG = {
    /*
     * ┌─────────────────────────────────────────────────────────────┐
     * │              API 키 입력 위치 안내                           │
     * ├─────────────────────────────────────────────────────────────┤
     * │ DATA_GO_KR_KEY                                               │
     * │   발급처: https://www.data.go.kr                            │
     * │   검색어: "한국관광공사_국문 관광정보 서비스"                   │
     * │   → 활용신청 → 승인 후 [마이페이지 > 인증키 발급현황]에서 복사  │
     * │   → Decoding(일반) 키를 붙여넣으세요                          │
     * │                                                              │
     * │ KAKAO_REST_KEY                                               │
     * │   발급처: https://developers.kakao.com                       │
     * │   → 내 애플리케이션 > 앱 키 > REST API 키                    │
     * │   → 카카오맵 검색 + 카카오 로그인에 사용                       │
     * │                                                              │
     * │ KAKAO_JS_KEY                                                 │
     * │   → 내 애플리케이션 > 앱 키 > JavaScript 키                  │
     * │   → 지도 SDK 확장용 (선택)                                    │
     * │                                                              │
     * │ ※ 키를 넣지 않아도 폴백 데이터로 정상 동작합니다              │
     * └─────────────────────────────────────────────────────────────┘
     */
    DATA_GO_KR_KEY: '',    // ← 공공데이터 인증키 (Decoding)
    KAKAO_REST_KEY: '',    // ← 카카오 REST API 키
    KAKAO_JS_KEY:   '',    // ← 카카오 JavaScript 키 (선택)
    /* 카카오내비(모빌리티) 길찾기 키 — 목록의 소요시간·거리를 카카오맵 길찾기와
       똑같이 맞추는 데 사용. 비워두면 대체 경로(OSRM)로 계산한다.
       ※ JavaScript 키로는 이 API가 거부되므로 REST API 키를 넣어야 한다. */
    KAKAO_NAVI_KEY: '',

    /* 의료기관 — data.go.kr 서비스키 (응급의료기관 E-Gen + 병원정보 심평원)
       실제 키는 config.local.js(비커밋)에서 채운다. 비워두면 폴백 데이터로 동작. */
    MEDICAL_API_KEY: '',

    /* 아래는 수정하지 않아도 됩니다 */
    KAKAO_REDIRECT_URI: window.location.origin + window.location.pathname,
    /* 카카오 콘솔 [플랫폼 > Web]에 등록된 도메인 — 접속 환경에 따라 자동 결정 */
    KAKAO_WEB_ORIGIN: resolveKakaoWebOrigin(),
    TOUR_AREA_CODE: '8',   // 세종시 지역코드
    WEATHER_NX: 66,        // 기상청 격자 좌표 (세종시)
    WEATHER_NY: 103,
    MEDICAL_SIDO_CD: '410000',  // 심평원 병원정보 시도코드(세종). 병원정보가 안 나오면 이 값을 확인.
    DEFAULT_LAT: 36.4800,
    DEFAULT_LNG: 127.2890,
    HTTP_TIMEOUT: 6000,

    /* 여로 자체 백엔드(FastAPI) 주소 — 아이디/비밀번호 로그인, 여행기록 저장에 사용.
       로컬/배포/앱 환경을 자동으로 구분한다 (위 resolveApiBaseUrl 참고) */
    API_BASE_URL: resolveApiBaseUrl(),
};
