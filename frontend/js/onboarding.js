/* ── 온보딩(튜토리얼) 제어 ──────────────────────────────────────
   ▸ 흐름: 로그인 성공 → maybeShowOnboarding() → (시작하기/건너뛰기)
           → finishOnboarding() → proceedAfterOnboarding()(폰트→메인)
   ▸ 일반 사용자: 최초 1회만 노출 (localStorage 'yeoro_onboarded' 기록)
   ▸ 개발자 테스트: URL에 ?onboarding=1 또는 #test 를 붙이면 매번 강제 노출
     예) yeoro.html?onboarding=1   /   yeoro.html#test
   ────────────────────────────────────────────────────────────────── */
function isOnboardingTestMode() {
    const params = new URLSearchParams(window.location.search);
    return params.get('onboarding') === '1'
        || window.location.hash === '#test'
        || window.location.hash === '#onboarding';
}
function finishOnboarding() {
    /* 테스트 모드에서는 '봤음' 기록을 남기지 않아 매번 다시 뜨도록 함 */
    if (!isOnboardingTestMode()) {
        localStorage.setItem('yeoro_onboarded', '1');
    }
    document.getElementById('onboard-screen').classList.add('hidden');
    proceedAfterOnboarding();   // 튜토리얼 종료 → 폰트 설정 → 메인 진입
}
function maybeShowOnboarding() {
    /* 테스트 모드면 기록과 무관하게 항상 노출, 이미 본 사용자는 건너뛰고 바로 진입 */
    if (isOnboardingTestMode() || !localStorage.getItem('yeoro_onboarded')) {
        document.getElementById('onboard-screen').classList.remove('hidden');
    } else {
        document.getElementById('onboard-screen').classList.add('hidden');
        proceedAfterOnboarding();
    }
}
