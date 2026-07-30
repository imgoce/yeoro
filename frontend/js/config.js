/* ════════════════════════════════════════════════════════════════════
   여로(Yero) — 세종시 무장애 큐레이션 앱
   ─ API 키를 API_CONFIG에 채우면 실제 API가 연동됩니다.
   ─ 키가 없어도 로컬 폴백 데이터로 모든 기능이 정상 동작합니다.
   ════════════════════════════════════════════════════════════════════ */

/* ── 로고 이미지 (base64, PNG) ─────────────────────────────────── */
const LOGO_SRC = 'data:image/png;base64,' + LOGO_BASE64.trim();

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

    /* 의료기관 — data.go.kr 서비스키 (응급의료기관 E-Gen + 병원정보 심평원)
       실제 키는 config.local.js(비커밋)에서 채운다. 비워두면 폴백 데이터로 동작. */
    MEDICAL_API_KEY: '',

    /* 아래는 수정하지 않아도 됩니다 */
    KAKAO_REDIRECT_URI: window.location.origin + window.location.pathname,
    /* 카카오 콘솔 [플랫폼 > Web]에 등록된 도메인 — WebView(file://)에서 KA 헤더 origin으로 사용 */
    KAKAO_WEB_ORIGIN: 'http://localhost:5500',
    TOUR_AREA_CODE: '8',   // 세종시 지역코드
    WEATHER_NX: 66,        // 기상청 격자 좌표 (세종시)
    WEATHER_NY: 103,
    MEDICAL_SIDO_CD: '410000',  // 심평원 병원정보 시도코드(세종). 병원정보가 안 나오면 이 값을 확인.
    DEFAULT_LAT: 36.4800,
    DEFAULT_LNG: 127.2890,
    HTTP_TIMEOUT: 6000,

    /* 여로 자체 백엔드(FastAPI) 주소 — 아이디/비밀번호 로그인, 여행기록 저장에 사용 */
    API_BASE_URL: 'http://localhost:8000',
};
