/* ── 초기화 ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('yeoro-logo').src = LOGO_SRC;
    document.getElementById('auth-logo').src  = LOGO_SRC;
    document.getElementById('splash-logo').src = LOGO_SRC;
    document.getElementById('onboard-screen').classList.add('hidden');

    /* 저장해둔 화면 설정(글씨 크기·글꼴·밝은/어두운 모드) 복원 */
    initDisplayPrefs();

    /* 앱 진입 스플래시: 로고 등장 애니메이션 재생 후(1.5초) 제거 */
    setTimeout(() => {
        document.getElementById('splash-screen').classList.add('hidden');
    }, 1500);
    if(API_CONFIG.KAKAO_JS_KEY && window.Kakao && !Kakao.isInitialized())
        Kakao.init(API_CONFIG.KAKAO_JS_KEY);

    /* 뒤 배경으로 메인을 깔아둠 (로그인/온보딩이 그 위에 오버레이로 뜸) */
    changeScreen('main');

    /* 앱을 켤 때는 항상 로그인 화면부터 시작한다.
       (이전에는 저장된 세션을 복원해 바로 메인으로 들어갔는데,
        누가 쓰는지 매번 확인할 수 있도록 자동 로그인을 하지 않는다)
       지난 로그인 정보는 지워서 '내 정보'에도 남지 않게 한다. */
    localStorage.removeItem('yeoro_last_user');
    localStorage.removeItem('yeoro_jwt');
    userSession = { loggedIn:false, targetGroup:'5060', nickname:'게스트', userId:null, authType:null };
    renderProfile();

    /* 카카오 로그인을 마치고 돌아온 경우(웹)에는 그 처리가 끝날 때까지 기다린다.
       handleKakaoCallback 안에서 로그인 완료 후 메인으로 들어간다. */
    const hasKakaoCode = new URLSearchParams(window.location.search).get('code');
    handleKakaoCallback();

    if (!hasKakaoCode) goToAuthScreen();   // 그 외에는 항상 로그인 화면부터

    /* 날씨: 즉시 표시 + 5분마다(그리고 앱 복귀 시) 실시간 갱신 */
    startWeatherWatch();

    /* 스플래시가 끝날 즈음 장소 데이터를 백그라운드로 미리 받아둔다
       → 탭 첫 클릭·랜덤/날씨 추천도 1초 이내(사실상 즉시) */
    setTimeout(prefetchPlaces, 1200);
});
