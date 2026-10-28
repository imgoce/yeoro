/* ════════════════════════════════════════════════════════════════════
   config.local.js 템플릿.
   이 파일을 같은 폴더에 config.local.js 로 복사한 뒤 실제 키를 채우세요.
   config.local.js 는 .gitignore 처리되어 깃허브에 올라가지 않습니다.
   ════════════════════════════════════════════════════════════════════ */
if (typeof API_CONFIG !== 'undefined') {
    /* 공공데이터포털(data.go.kr) 서비스키 (Decoding/일반 키)
       — 관광정보 · 축제 · 음식점 · 기상청 날씨 · 응급의료 · 병원정보에 모두 쓰입니다 */
    API_CONFIG.DATA_GO_KR_KEY  = '여기에_data.go.kr_서비스키_입력';
    API_CONFIG.MEDICAL_API_KEY = API_CONFIG.DATA_GO_KR_KEY;

    /* 카카오 REST API 키 — 지도에서 음식점·병원 검색 */
    API_CONFIG.KAKAO_REST_KEY = '여기에_카카오_REST_키_입력';

    /* 카카오 JavaScript 키 — 앱 안에서 지도를 그릴 때 사용 */
    API_CONFIG.KAKAO_JS_KEY = '여기에_카카오_JavaScript_키_입력';

    /* 카카오내비(모빌리티) 길찾기 키 — 목록에 표시하는 "약 N분 (Nkm)"을
       길찾기 버튼을 눌렀을 때 열리는 카카오맵 값과 똑같이 맞추는 데 씁니다.
       ※ JavaScript 키로는 거부되므로 반드시 REST API 키를 넣으세요.
       비워두면 대체 계산(OSRM)을 쓰는데, 카카오맵 값과 다를 수 있습니다. */
    API_CONFIG.KAKAO_NAVI_KEY = '여기에_카카오_REST_키_입력';
}
