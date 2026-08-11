/* ── 화면 전환 ────────────────────────────────────────────────── */
function changeScreen(id) {
    ['login','main','schedule','api-list','history'].forEach(s=>
        document.getElementById('screen-'+s)?.classList.add('hidden'));
    document.getElementById('screen-'+id)?.classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach((t,i)=>t.classList.toggle('active',
        (id==='main'&&i===0)||(id==='schedule'&&i===1)||(id==='history'&&i===2)||(id==='login'&&i===3)));
    if (id==='history') renderTravelLog();
    if (id==='login') {
        renderProfile();          // 내 정보 탭 진입 시 프로필 갱신
        refreshPrefButtons();     // 화면 설정 버튼에 현재 선택 표시
    }
}

/* ── 시작 로그인 페이지(독립 오버레이) 열기/닫기 ──────────────── */
function goToAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
}
function hideAuthScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
}

/* ── 프로필(내 정보) 렌더링 ───────────────────────────────────── */
function renderProfile() {
    const nick = document.getElementById('profile-nickname');
    const type = document.getElementById('profile-authtype');
    const loginRow  = document.getElementById('profile-login-row');
    const logoutRow = document.getElementById('profile-logout-row');
    const modeLabel = document.getElementById('profile-mode-label');
    const modeIcon  = document.getElementById('profile-mode-icon');
    if (!nick) return;

    nick.textContent = userSession.nickname || '게스트';
    const typeMap = {kakao:'카카오 로그인', email:'아이디 로그인', guest:'게스트 (이 기기에서만 이어짐)'};
    type.textContent = userSession.userId ? (typeMap[userSession.authType]||'') : '로그인이 필요해요';

    if (userSession.targetGroup==='family') {
        modeLabel.textContent='영유아 동반 부모 코스'; modeIcon.textContent='child_friendly';
    } else {
        modeLabel.textContent='5060 액티브 시니어'; modeIcon.textContent='accessibility_new';
    }

    /* 로그인 상태면 로그아웃, 게스트/미로그인이면 로그인 버튼 노출 */
    const isMember = userSession.loggedIn;
    loginRow.style.display  = isMember ? 'none' : 'flex';
    logoutRow.style.display = isMember ? 'flex' : 'none';
}

/* ── 로그아웃 → 시작 로그인 페이지로 ──────────────────────────── */
function handleLogout() {
    localStorage.removeItem('yeoro_last_user');
    localStorage.removeItem('yeoro_jwt');
    userSession = { loggedIn:false, targetGroup:'5060', nickname:'게스트', userId:null, authType:null };
    document.getElementById('user-profile-indicator').textContent='시작하기';
    /* 폰트/크기 기본값으로 복원 */
    applyFontFamily('5060');
    setFont('100%');
    showToast('로그아웃 되었어요');
    goToAuthScreen();
}
