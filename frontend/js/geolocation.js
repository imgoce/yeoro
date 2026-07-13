/* ── GPS ──────────────────────────────────────────────────────── */
function initGeolocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        p=>{userLoc={lat:p.coords.latitude,lng:p.coords.longitude};},
        ()=>{}, {timeout:5000});
}

/* ── 위치 정보 허용 게이트 ─────────────────────────────────────────
   회원가입/로그인/게스트 둘러보기 공통 경로: 글자 크기를 정한 뒤,
   위치 정보를 허용해야만 메인 화면(finalizeAuth)으로 들어갈 수 있다. */
function requestLocationThenEnter() {
    document.getElementById('location-permission-error').classList.add('hidden');
    document.getElementById('location-permission-screen').classList.remove('hidden');
}

function handleLocationPermissionRequest() {
    const btn = document.getElementById('location-permission-btn');
    if (!navigator.geolocation) {
        showLocationPermissionError('이 기기/브라우저는 위치 정보를 지원하지 않아요. 설정에서 위치 서비스를 켜주세요.');
        return;
    }
    btn.disabled = true;
    btn.textContent = '위치 확인 중...';
    navigator.geolocation.getCurrentPosition(
        p => {
            userLoc = { lat: p.coords.latitude, lng: p.coords.longitude };
            document.getElementById('location-permission-screen').classList.add('hidden');
            btn.disabled = false;
            btn.textContent = '위치 허용하고 시작하기';
            finalizeAuth();
        },
        () => {
            btn.disabled = false;
            btn.textContent = '위치 허용하고 시작하기';
            showLocationPermissionError('위치 정보 허용이 필요해요. 브라우저·기기 설정에서 여로의 위치 권한을 허용한 뒤 다시 시도해주세요.');
        },
        { timeout: 8000 }
    );
}

function showLocationPermissionError(message) {
    const el = document.getElementById('location-permission-error');
    el.textContent = message;
    el.classList.remove('hidden');
}
