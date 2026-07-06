/* ── 초기화 ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('yeoro-logo').src = LOGO_SRC;
    document.getElementById('auth-logo').src  = LOGO_SRC;
    document.getElementById('onboard-screen').classList.add('hidden');
    if(API_CONFIG.KAKAO_JS_KEY && window.Kakao && !Kakao.isInitialized())
        Kakao.init(API_CONFIG.KAKAO_JS_KEY);

    /* 뒤 배경으로 메인을 깔아둠 (로그인/온보딩이 그 위에 오버레이로 뜸) */
    changeScreen('main');
    renderProfile();

    /* 소셜 로그인 콜백으로 돌아온 경우: handleOAuthCallback 내부에서 afterAuth() 진행 */
    const hasOAuthCode = new URLSearchParams(window.location.search).get('code');
    handleOAuthCallback();

    /* 콜백이 아니고 아직 로그인 전이면 시작 로그인 페이지 노출 */
    if (!hasOAuthCode && !userSession.loggedIn) {
        goToAuthScreen();
    }
});
