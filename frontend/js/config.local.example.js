/* ════════════════════════════════════════════════════════════════════
   config.local.js 템플릿.
   이 파일을 같은 폴더에 config.local.js 로 복사한 뒤 실제 키를 채우세요.
   config.local.js 는 .gitignore 처리되어 깃허브에 올라가지 않습니다.
   ════════════════════════════════════════════════════════════════════ */
if (typeof API_CONFIG !== 'undefined') {
    // 공공데이터포털(data.go.kr) 서비스키 — 응급의료기관(E-Gen) + 병원정보서비스(심평원)
    API_CONFIG.MEDICAL_API_KEY = '여기에_data.go.kr_서비스키_입력';

    // (선택) 같은 data.go.kr 키로 관광/축제/음식 실데이터도 켜기:
    // API_CONFIG.DATA_GO_KR_KEY = API_CONFIG.MEDICAL_API_KEY;

    // (선택) 카카오맵 병원 검색:
    // API_CONFIG.KAKAO_REST_KEY = '여기에_카카오_REST_키';
}
