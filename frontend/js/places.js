/* ── 카테고리별 데이터 로딩 ──────────────────────────────────────
   각 카테고리마다 1~2개 API를 호출 → 병합 → 실패 시 폴백
   ─────────────────────────────────────────────────────────────────*/
async function getPlaces(category) {
    if (apiCache[category]) return apiCache[category];

    let places = null;

    try {
        if (category === '관광명소') {
            /* 세종시로 분류된 볼거리를 전부 표시:
               관광지12 + 문화시설14 + 레포츠28 + 여행코스25 + 웰니스 */
            const [tour, culture, leports, course, wellness] = await Promise.all([
                callTourApi('12', 100),
                callTourApi('14', 100),
                callTourApi('28', 100),
                callTourApi('25', 100),
                callWellnessApi(8),
            ]);
            const combined = [...(tour||[]), ...(culture||[]), ...(leports||[]),
                              ...(course||[]), ...(wellness||[])];
            /* contentid 기준 중복 제거 */
            const seen = new Set();
            const deduped = combined.filter(p=>{
                if (seen.has(p.id)) return false;
                seen.add(p.id); return true;
            });
            if (deduped.length > 0) places = deduped;
        }
        else if (category === '먹거리') {
            /* 국문관광정보(음식점39) + 카카오맵(FD6 음식점) 병렬 호출 */
            const [tourFood, kakaoFood] = await Promise.all([
                callTourApi('39', 100),
                callKakaoCategory('FD6', 10),
            ]);
            const combined = [...(tourFood||[]), ...(kakaoFood||[])];
            if (combined.length > 0) places = combined;
        }
        else if (category === '축제') {
            /* 국문관광정보(축제15) */
            const tourFest = await callTourApi('15', 100);
            if (tourFest && tourFest.length > 0) places = tourFest;
        }
        else if (category === '의료기관') {
            /* 응급의료기관(E-Gen) + 병원정보(심평원) + 카카오맵(HP8) 병렬 호출 */
            const [emergency, hospital, kakaoHosp, keyword] = await Promise.all([
                callEmergencyApi(12),
                callHospitalInfoApi(15),
                callKakaoCategory('HP8', 10),
                callKakaoKeyword('세종 병원 응급', 5),
            ]);
            /* 응급의료기관을 앞쪽에 우선 배치 */
            const combined = [...(emergency||[]), ...(hospital||[]), ...(kakaoHosp||[]), ...(keyword||[])];
            // 이름 기준 중복 제거
            const seen = new Set();
            const deduped = combined.filter(p=>{
                if (seen.has(p.name)) return false;
                seen.add(p.name); return true;
            });
            if (deduped.length > 0) places = deduped;
        }
    } catch(e) {
        console.warn('[getPlaces] 예외:', e.message);
        places = null;
    }

    /* API 실패 또는 키 없음 → 로컬 폴백 */
    if (!places || places.length === 0) {
        places = (LOCAL_FALLBACK[category]||[]).map(p=>({...p, category}));
        if (places.length === 0) {
            console.info(`[폴백] ${category}: 데이터 없음`);
        }
    }

    /* 거리 계산 — 직선거리(폴백용) + 실제 도로 주행거리·시간(OSRM) */
    places = places
        .map(p=>({...p, category, _dist:(p.lat&&p.lng)
            ? haversine(userLoc.lat,userLoc.lng,p.lat,p.lng) : null}));
    await fetchDrivingInfo(places);

    /* 가까운 순 정렬 — 실도로 소요시간 우선, 없으면 직선거리, 그것도 없으면 맨 뒤 */
    const sortKey = p => p._driveMin!=null ? p._driveMin
                       : p._dist!=null     ? p._dist*3   // 직선 1km ≈ 3분으로 환산해 섞어 정렬
                       : Infinity;
    places.sort((a,b)=>sortKey(a)-sortKey(b));

    apiCache[category] = places;
    return places;
}

/* ── 카드 렌더링 ──────────────────────────────────────────────── */
async function loadUnifiedCategory(categoryKey) {
    document.querySelectorAll('.cat-tab').forEach(b=>b.classList.remove('active'));
    document.getElementById(`tab-${categoryKey}`)?.classList.add('active');
    changeScreen('api-list');

    const box = document.getElementById('dynamic-api-cards-injection-box');
    box.innerHTML = `<div style="text-align:center;padding:48px 0;color:var(--yeoro-muted);">
        <div style="font-size:2em;margin-bottom:8px;">🔍</div>
        <div style="font-size:.85em;font-weight:600;">불러오는 중...</div>
        <div style="font-size:.75em;margin-top:4px;opacity:.7;">API 연동 중이에요</div></div>`;

    const places = await getPlaces(categoryKey);

    if (!places.length) {
        box.innerHTML=`<div style="text-align:center;padding:48px 0;color:var(--yeoro-muted);">
            <div style="font-size:2em;margin-bottom:8px;">📭</div>
            <div style="font-size:.85em;">표시할 장소가 없어요.</div></div>`;
        return;
    }

    box.innerHTML = '';
    places.forEach(item => {
        const inCart = cart.some(c=>c.id===item.id);
        const dist   = item._driveMin!=null ? `🚗 약 ${item._driveMin}분 (${item._driveKm}km) · `
                     : item._dist!=null     ? `직선거리 ${item._dist}km · ` : '';
        const card   = document.createElement('div');
        card.className = 'place-card';
        card.innerHTML = `
            <div class="place-name">${esc(item.name)}${sourceBadge(item.source||'local')}</div>
            <div class="place-meta">${dist}세종시</div>
            <div class="place-desc">${esc(item.desc||'')}</div>
            ${item.tel?`<div style="font-size:.78em;color:var(--yeoro-muted);margin-bottom:6px;">📞 ${esc(item.tel)}</div>`:''}
            <span class="place-tag">${esc(item.category)}</span>
            ${(item.lat&&item.lng)?`<button class="route-btn" style="background:#FEE500;color:#191919;border:none;border-radius:8px;padding:6px 12px;font-size:.8em;font-weight:700;margin-right:6px;cursor:pointer;">🚗 길찾기</button>`:''}
            <button class="add-btn" ${inCart?'disabled style="opacity:.5"':''}>
                ${inCart?'담김':'추가'}</button>`;
        card.querySelector('.route-btn')?.addEventListener('click', ()=>{
            openKakaoRoute(item.name, item.lat, item.lng);
        });
        card.querySelector('.add-btn').addEventListener('click', e=>{
            if(inCart) return;
            pushToCart(item);
            e.target.disabled=true; e.target.textContent='담김'; e.target.style.opacity='.5';
        });
        box.appendChild(card);
    });
}
