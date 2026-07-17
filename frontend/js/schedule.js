/* ── 일정·동선 ────────────────────────────────────────────────── */
async function generateRandomSchedule() {
    const box=document.getElementById('schedule-timeline-box');
    box.innerHTML=`<div style="text-align:center;padding:32px;color:var(--yeoro-muted);">🎲 일정 생성 중...</div>`;
    changeScreen('schedule');
    cart=[];
    for (const cat of ['관광명소','먹거리','축제']) {
        const pool=await getPlaces(cat);
        if(pool.length) cart.push(pool[Math.floor(Math.random()*pool.length)]);
    }
    document.getElementById('omni-cart-counter-badge').textContent=cart.length;
    document.getElementById('toss-omni-floating-cart').classList.remove('hidden');
    recalculateAndSortRoute();
}
function recalculateAndSortRoute() {
    if(!cart.length) return;
    cart.forEach(item=>{item._dist=(item.lat&&item.lng)
        ?haversine(userLoc.lat,userLoc.lng,item.lat,item.lng):null;});
    cart.sort((a,b)=>(a._dist===null)-(b._dist===null)||(a._dist||0)-(b._dist||0));
    const box=document.getElementById('schedule-timeline-box');
    box.innerHTML='';
    cart.forEach(item=>{
        const node=document.createElement('div'); node.className='timeline-node';
        /* 좌표가 없는 장소(관광공사 데이터에 미등록·오류)는 길찾기 대신 안내를 보여준다 */
        const routeBtn = (item.lat && item.lng)
            ? `<button class="btn btn-sm mt-2 px-3 fw-bold rounded-3"
                   style="font-size:.78em;background:var(--yeoro-mist);color:var(--yeoro-blue);border:1px solid var(--yeoro-border);"
                   onclick="openKakaoRoute('${esc(item.name).replace(/'/g,'')}',${item.lat},${item.lng})">길찾기</button>`
            : `<div class="mt-2" style="font-size:.75em;color:var(--yeoro-muted);">위치 정보가 없어 길찾기를 지원하지 않아요</div>`;
        node.innerHTML=`
            <div class="timeline-title">${esc(item.name)}</div>
            <div class="timeline-sub">${item._dist!=null?'직선거리 '+item._dist+'km · ':''}${esc(item.category)}</div>
            ${routeBtn}`;
        box.appendChild(node);
    });
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

async function openKakaoRoute(name, lat, lng) {
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
    document.getElementById('inapp-map-info').innerHTML =
        `출발: <b>내 위치</b> (자동 입력됨) → 도착: <b>${esc(name)}</b><br>직선거리 약 ${km}km`;
}

function closeInAppMap() {
    document.getElementById('inapp-map-screen').classList.add('hidden');
}
