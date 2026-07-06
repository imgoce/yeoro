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
     * │ GOOGLE_CLIENT_ID                                             │
     * │   발급처: https://console.cloud.google.com/apis/credentials  │
     * │   → OAuth 클라이언트 ID 생성 (유형: 웹 애플리케이션)           │
     * │   → 승인된 리디렉션 URI에 이 페이지 주소를 등록하세요          │
     * │                                                              │
     * │ ※ 키를 넣지 않아도 폴백 데이터로 정상 동작합니다              │
     * └─────────────────────────────────────────────────────────────┘
     */
    DATA_GO_KR_KEY:   '',    // ← 공공데이터 인증키 (Decoding)
    KAKAO_REST_KEY:   '',    // ← 카카오 REST API 키
    KAKAO_JS_KEY:     '',    // ← 카카오 JavaScript 키 (선택)
    GOOGLE_CLIENT_ID: '',    // ← 구글 OAuth 클라이언트 ID

    /* 아래는 수정하지 않아도 됩니다 */
    KAKAO_REDIRECT_URI:  window.location.origin + window.location.pathname,
    GOOGLE_REDIRECT_URI: window.location.origin + window.location.pathname,
    TOUR_AREA_CODE: '8',   // 세종시 지역코드
    DEFAULT_LAT: 36.4800,
    DEFAULT_LNG: 127.2890,
    HTTP_TIMEOUT: 6000,
};
