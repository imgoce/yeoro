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
        (err) => {
            btn.disabled = false;
            btn.textContent = '위치 허용하고 시작하기';
            // 권한을 막 허용한 직후 첫 요청은 기기의 위치 서비스가 준비되는 데 시간이 걸려
            // 타임아웃(code 3)이 나기도 한다. 이 경우는 권한 문제가 아니므로 안내 문구를 다르게 준다.
            const message = err.code === err.TIMEOUT
                ? '위치를 확인하는 데 시간이 걸리고 있어요. 잠시 후 다시 시도해주세요.'
                : '위치 정보 허용이 필요해요. 브라우저·기기 설정에서 여로의 위치 권한을 허용한 뒤 다시 시도해주세요.';
            showLocationPermissionError(message);
        },
        { timeout: 20000 }
    );
}

function showLocationPermissionError(message) {
    const el = document.getElementById('location-permission-error');
    el.textContent = message;
    el.classList.remove('hidden');
}
