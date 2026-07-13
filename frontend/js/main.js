/* ── 초기화 ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('yeoro-logo').src = LOGO_SRC;
    document.getElementById('auth-logo').src  = LOGO_SRC;
    document.getElementById('splash-logo').src = LOGO_SRC;
    document.getElementById('onboard-screen').classList.add('hidden');

    /* 앱 진입 스플래시: 로고 등장 애니메이션 재생 후(1.5초) 제거 */
    setTimeout(() => {
        document.getElementById('splash-screen').classList.add('hidden');
    }, 1500);
    if(API_CONFIG.KAKAO_JS_KEY && window.Kakao && !Kakao.isInitialized())
        Kakao.init(API_CONFIG.KAKAO_JS_KEY);

    /* 뒤 배경으로 메인을 깔아둠 (로그인/온보딩이 그 위에 오버레이로 뜸) */
    changeScreen('main');

    /* 새로고침/재방문 시 이전 로그인 세션 복원 (카카오·이메일 로그인만 저장됨) —
       로그인 화면을 건너뛰고 바로 인사말·위치 정보까지 복원된 메인 화면으로 진입 */
    let restoredSession = false;
    try {
        const saved = JSON.parse(localStorage.getItem('yeoro_last_user') || 'null');
        if (saved && saved.loggedIn) {
            userSession = saved;
            applyFontFamily(saved.targetGroup);
            if (getAuthToken()) syncTravelLogFromServer();
            hideAuthScreen();
            finalizeAuth();
            restoredSession = true;
        }
    } catch(e) {}
    if (!restoredSession) renderProfile();

    /* 카카오 콜백으로 돌아온 경우: handleKakaoCallback 내부에서 afterAuth() 진행 */
    const hasKakaoCode = new URLSearchParams(window.location.search).get('code');
    handleKakaoCallback();

    /* 콜백도 아니고, 복원된 세션도 없으면 시작 로그인 페이지 노출 */
    if (!hasKakaoCode && !restoredSession && !userSession.loggedIn) {
        goToAuthScreen();
    }
});
