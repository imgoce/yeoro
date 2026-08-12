/* ── 추천 결과 확정/재추천 ─────────────────────────────────────────
   추천은 곧바로 여행로그에 저장하지 않는다. 사용자가 [이대로 여행하기]를
   눌러 마음에 든다고 확인했을 때만 기록으로 남긴다.                    */
let _lastRecommendKind = null;   // 'random' | 'weather'

function showRecommendActions(kind) {
    _lastRecommendKind = kind;
    document.getElementById('recommend-actions')?.classList.remove('hidden');
}
function hideRecommendActions() {
    document.getElementById('recommend-actions')?.classList.add('hidden');
    _lastRecommendKind = null;
}
function confirmRecommendation() {
    if (!cart.length) { showToast('추천된 장소가 없어요', 'error'); return; }
    addToTravelLog(cart, _lastRecommendKind || 'random');
    hideRecommendActions();
    showToast('여행로그에 저장됐어요 ✓ 즐거운 여행 되세요!');
}
function retryRecommendation() {
    if (_lastRecommendKind === 'weather')      generateWeatherSchedule();
    else if (_lastRecommendKind === 'product') generateTravelProduct();
    else if (_lastRecommendKind === 'barrier') generateBarrierFreeSchedule();
    else                                       generateRandomSchedule();
}

/* ── ♿ 무장애 코스 추천 ────────────────────────────────────────────
   휠체어·유모차로 갈 수 있다고 등록된 곳만 골라 코스를 짠다.
   여로가 5060 세대·유아 동반 가족을 위한 앱인 만큼 가장 중요한 추천이다. */
async function generateBarrierFreeSchedule() {
    const box=document.getElementById('schedule-timeline-box');
    box.innerHTML=`<div style="text-align:center;padding:32px;color:var(--yeoro-muted);">♿ 무장애 코스를 짜는 중...</div>`;
    changeScreen('schedule');
    hideRecommendActions();

    const [spots, food] = await Promise.all([
        getPlaces('관광명소', { withDrive:false }),
        getPlaces('먹거리',   { withDrive:false }),
    ]);
    const barrierFree = spots.filter(p => p.barrierFree);

    if (!barrierFree.length) {
        box.innerHTML = `<p class="text-center py-4 small m-0" style="color:var(--yeoro-muted);">
            무장애 정보가 등록된 장소를 찾지 못했어요.</p>`;
        return;
    }

    const pick = (pool, n) => {
        const rest=[...pool], out=[];
        while (rest.length && out.length < n)
            out.push(rest.splice(Math.floor(Math.random()*rest.length), 1)[0]);
        return out;
    };
    cart = [...pick(barrierFree, 3), ...pick(food, 1)].filter(Boolean);
    document.getElementById('omni-cart-counter-badge').textContent=cart.length;
    document.getElementById('toss-omni-floating-cart').classList.remove('hidden');
    await recalculateAndSortRoute();

    const banner = document.getElementById('weather-banner');
    if (banner) {
        banner.innerHTML = `♿ <b>무장애 코스</b><br>
            <span style="font-size:.9em;">휠체어·유모차로 갈 수 있다고 등록된 곳만 골랐어요.
            자세한 시설은 관광명소 목록에서 확인할 수 있어요.</span>`;
        banner.classList.remove('hidden');
    }
    showRecommendActions('barrier');
}

/* ── 일정·동선 ────────────────────────────────────────────────── */
async function generateRandomSchedule() {
    const box=document.getElementById('schedule-timeline-box');
    box.innerHTML=`<div style="text-align:center;padding:32px;color:var(--yeoro-muted);">🎲 일정 생성 중...</div>`;
    changeScreen('schedule');
    cart=[];
    /* 축제는 기간이 정해져 있어 아무 날에나 갈 수 없으므로 추천에서 제외한다.
       일정에 담긴 장소의 소요시간은 recalculateAndSortRoute에서 계산하므로
       여기서는 목록만 받아온다. */
    const [spots, food] = await Promise.all([
        getPlaces('관광명소', { withDrive:false }),
        getPlaces('먹거리',   { withDrive:false }),
    ]);
    const pick = (pool, n) => {
        const rest = [...pool];
        const out = [];
        while (rest.length && out.length < n)
            out.push(rest.splice(Math.floor(Math.random()*rest.length), 1)[0]);
        return out;
    };
    cart.push(...pick(spots, 2), ...pick(food, 1));
    document.getElementById('omni-cart-counter-badge').textContent=cart.length;
    document.getElementById('toss-omni-floating-cart').classList.remove('hidden');
    await recalculateAndSortRoute();
    showRecommendActions('random');   // [이대로 여행하기 / 다시 추천] 노출
}
/* 맞춤형 여행상품처럼 '짜여진 순서'가 의미 있는 코스는 정렬하지 않고 그대로 보여준다
   (관광지 → 식사 → 카페 → 관광지 순서가 흐트러지면 코스의 뜻이 사라진다) */
async function recalculateAndSortRouteInOrder() {
    return recalculateAndSortRoute({ keepOrder: true });
}

async function recalculateAndSortRoute(options = {}) {
    if(!cart.length) return;
    cart.forEach(item=>{item._dist=(item.lat&&item.lng)
        ?haversine(userLoc.lat,userLoc.lng,item.lat,item.lng):null;});
    if (!options.keepOrder) {
        const sortKey = p => p._driveMin!=null ? p._driveMin
                           : p._dist!=null     ? p._dist*3 : Infinity;
        cart.sort((a,b)=>sortKey(a)-sortKey(b));
    }

    /* 즉시 렌더 — 실도로 값이 이미 있으면 바로, 없으면 직선거리로 먼저 보여준다 */
    const box=document.getElementById('schedule-timeline-box');
    box.innerHTML='';
    const routePlaces = cart.filter(item => item.lat && item.lng);
    if (routePlaces.length >= 2) {
        const routeNames = routePlaces.slice(0, 6).map(item => esc(item.name)).join(' → ');
        const routeSummary = document.createElement('div');
        routeSummary.style.cssText = 'margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--yeoro-border);';
        routeSummary.innerHTML = `
            <button class="btn w-100 fw-bold rounded-3 schedule-route-all-btn"
                style="background:#FEE500;color:#191919;border:none;padding:10px 12px;font-size:.9em;">🚗 전체 경로 길찾기</button>
            <div style="font-size:.76em;color:var(--yeoro-muted);line-height:1.45;margin-top:8px;">
                내 위치 → ${routeNames}${routePlaces.length > 6 ? ' 외' : ''}
            </div>`;
        routeSummary.querySelector('.schedule-route-all-btn')
            ?.addEventListener('click', () => openKakaoRouteForPlaces(cart));
        box.appendChild(routeSummary);
    }
    cart.forEach(item=>{
        const node=document.createElement('div'); node.className='timeline-node';
        node.dataset.pid = item.id;   // 백그라운드 실도로 갱신 시 라벨 찾기용
        /* 좌표가 없는 장소(관광공사 데이터에 미등록·오류)는 길찾기 대신 안내를 보여준다 */
        const routeBtn = (item.lat && item.lng)
            ? `<button class="btn btn-sm mt-2 px-3 fw-bold rounded-3 timeline-route-btn"
                   style="font-size:.78em;background:#FEE500;color:#191919;border:none;">🚗 길찾기</button>`
            : `<div class="mt-2" style="font-size:.75em;color:var(--yeoro-muted);">위치 정보가 없어 길찾기를 지원하지 않아요</div>`;
        const distLabel = item._driveMin!=null ? `🚗 약 ${item._driveMin}분 (${item._driveKm}km) · `
                        : item._dist!=null     ? `직선거리 ${item._dist}km · ` : '';
        node.innerHTML=`
            <div class="timeline-title">${esc(item.name)}</div>
            <div class="timeline-sub">${distLabel}${esc(item.category)}</div>
            ${routeBtn}`;
        node.querySelector('.timeline-route-btn')
            ?.addEventListener('click', () => openKakaoRoute(item.name, item.lat, item.lng));
        box.appendChild(node);
    });

    /* 실도로 값이 빠진 항목은 백그라운드로 채우고, 노드 재생성 없이 라벨만 교체
       (눈길 경고 등 나중에 덧붙는 안내가 지워지지 않도록) */
    if (cart.some(item=>item.lat&&item.lng&&item._driveMin==null)) {
        fetchDrivingInfo(cart).then(()=>{
            cart.forEach(item=>{
                if (item._driveMin==null) return;
                const sub = document.querySelector(
                    `#schedule-timeline-box .timeline-node[data-pid="${CSS.escape(item.id)}"] .timeline-sub`);
                if (sub) sub.textContent = `🚗 약 ${item._driveMin}분 (${item._driveKm}km) · ${item.category}`;
            });
        }).catch(()=>{});
    }
}

/* ── 앱 내부 카카오맵 길찾기 ─────────────────────────────────────
   외부 브라우저/웹사이트로 나가지 않고, 카카오맵 JavaScript SDK를
   앱 안의 지도 화면(#inapp-map-screen)에 띄운다.
   출발지는 위치 게이트에서 잡아둔 현재 위치(userLoc)가 자동으로 들어간다. */
let _kakaoSdkPromise = null;
function loadKakaoMapSdk() {
    if (window.kakao && window.kakao.maps && window.kakao.maps.Map) return Promise.resolve(true);
    if (!API_CONFIG.KAKAO_JS_KEY) return Promise.resolve(false);
    if (_kakaoSdkPromise) return _kakaoSdkPromise;
    _kakaoSdkPromise = new Promise(resolve => {
        const s = document.createElement('script');
        s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${API_CONFIG.KAKAO_JS_KEY}&autoload=false`;
        s.onload = () => kakao.maps.load(() => resolve(true));
        s.onerror = () => { _kakaoSdkPromise = null; resolve(false); };
        document.head.appendChild(s);
    });
    return _kakaoSdkPromise;
}

function kakaoRoutePoint(name, lat, lng, fallback='도착지') {
    const safeName = String(name)
        .replace(/[,\/]/g, ' ')
        .trim() || fallback;
    return `${encodeURIComponent(safeName)},${lat},${lng}`;
}

/* 카카오맵 공식 길찾기 링크 — 출발지(내 위치)와 도착지가 자동 입력된 채
   실제 도로 경로·소요시간 안내 화면이 열린다.
   패턴: https://map.kakao.com/link/from/이름,위도,경도/to/이름,위도,경도 */
function kakaoRouteUrl(name, lat, lng) {
    return 'https://map.kakao.com/link/from/' +
        kakaoRoutePoint('내 위치', userLoc.lat, userLoc.lng, '내 위치') +
        `/to/${kakaoRoutePoint(name, lat, lng)}`;
}

/* 여러 목적지가 있는 일정은 현재 위치를 출발지로 두고,
   앞 장소들은 순서대로 경유지, 마지막 장소는 도착지로 넘긴다.
   카카오맵 경유지는 최대 5개라 장소는 최대 6개까지만 링크에 포함된다. */
function kakaoRouteUrlForPlaces(places) {
    const routePlaces = (places || []).filter(item => item && item.lat && item.lng);
    if (routePlaces.length === 0) return null;
    if (routePlaces.length === 1) {
        const only = routePlaces[0];
        return kakaoRouteUrl(only.name, only.lat, only.lng);
    }

    const kakaoLimitPlaces = routePlaces.slice(0, 6);
    const points = [
        kakaoRoutePoint('내 위치', userLoc.lat, userLoc.lng, '내 위치'),
        ...kakaoLimitPlaces.map(item => kakaoRoutePoint(item.name, item.lat, item.lng)),
    ];
    return `https://map.kakao.com/link/by/car/${points.join('/')}`;
}

/* 길찾기 버튼 → 카카오맵 길찾기로 바로 연결.
   (앱 안 미리보기 지도는 showInAppRoutePreview로 유지 — 필요 시 재사용) */
function openKakaoRoute(name, lat, lng) {
    if (!lat || !lng) { showToast('이 장소는 좌표 정보가 없어 길찾기를 열 수 없어요', 'error'); return; }
    const url = kakaoRouteUrl(name, lat, lng);
    /* 안드로이드 앱(WebView): 현재 화면을 이동시키면 네이티브가 가로채 외부로 연다 */
    if (window.YeoroNative) { location.href = url; return; }
    /* 웹 브라우저: 새 탭으로 카카오맵 길찾기 열기 (팝업 차단 시 현재 탭) */
    const win = window.open(url, '_blank');
    if (!win) location.href = url;
}

function openKakaoRouteForPlaces(places) {
    const routePlaces = (places || []).filter(item => item && item.lat && item.lng);
    if (!routePlaces.length) {
        showToast('좌표 정보가 있는 장소가 없어 길찾기를 열 수 없어요', 'error');
        return;
    }
    if (routePlaces.length < (places || []).length) {
        showToast('좌표가 없는 장소는 경로에서 제외했어요');
    }
    if (routePlaces.length > 6) {
        showToast('카카오맵 경유지는 최대 5개라 앞 6개 장소까지만 연결했어요');
    }

    const url = kakaoRouteUrlForPlaces(routePlaces);
    if (!url) return;
    if (window.YeoroNative) { location.href = url; return; }
    const win = window.open(url, '_blank');
    if (!win) location.href = url;
}

/* 앱 안 지도 미리보기(마커 + 직선) — 길찾기 본 기능은 openKakaoRoute가 담당 */
async function showInAppRoutePreview(name, lat, lng) {
    if (!lat || !lng) { showToast('이 장소는 좌표 정보가 없어 길찾기를 열 수 없어요', 'error'); return; }
    const ok = await loadKakaoMapSdk();
    if (!ok) {
        showToast('카카오맵 연동 준비 중이에요 — 카카오 JavaScript 키를 설정하면 앱 안에서 지도가 열려요', 'error');
        return;
    }
    document.getElementById('inapp-map-screen').classList.remove('hidden');
    document.getElementById('inapp-map-title').textContent = `${name} 길찾기`;

    const from = new kakao.maps.LatLng(userLoc.lat, userLoc.lng);
    const to   = new kakao.maps.LatLng(lat, lng);
    const map  = new kakao.maps.Map(document.getElementById('inapp-map'), { center: from, level: 7 });

    new kakao.maps.Marker({ map, position: from, title: '내 위치' });
    new kakao.maps.Marker({ map, position: to,   title: name });
    new kakao.maps.Polyline({
        map, path: [from, to],
        strokeWeight: 4, strokeColor: '#2b6cf6', strokeStyle: 'shortdash', strokeOpacity: .85,
    });
    const bounds = new kakao.maps.LatLngBounds();
    bounds.extend(from); bounds.extend(to);
    map.setBounds(bounds, 60);

    const km = haversine(userLoc.lat, userLoc.lng, lat, lng);
    const info = document.getElementById('inapp-map-info');
    info.innerHTML =
        `출발: <b>내 위치</b> (자동 입력됨) → 도착: <b>${esc(name)}</b><br>직선거리 약 ${km}km<br>
        <a href="#" class="inapp-route-link" style="font-weight:700;">🚗 카카오맵 길안내 시작 →</a>`;
    info.querySelector('.inapp-route-link')?.addEventListener('click', e => {
        e.preventDefault();
        openKakaoRoute(name, lat, lng);
    });
}

function closeInAppMap() {
    document.getElementById('inapp-map-screen').classList.add('hidden');
}
