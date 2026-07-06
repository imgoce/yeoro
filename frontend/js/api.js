/* ── API 호출 함수들 ───────────────────────────────────────────────
   모든 함수는 실패 시 null/[] 반환 — 절대 예외를 밖으로 던지지 않음
   ─────────────────────────────────────────────────────────────────*/

/* 공통 fetch 래퍼 (타임아웃 + 에러 흡수) */
async function safeFetch(url, options={}) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(()=>controller.abort(), API_CONFIG.HTTP_TIMEOUT);
        const res = await fetch(url, {...options, signal:controller.signal});
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch(e) {
        console.warn(`[API] 실패: ${url.substring(0,60)}... (${e.message})`);
        return null;
    }
}

/* 공공데이터 응답에서 item 배열 안전 추출 */
function extractItems(json) {
    try {
        const items = json?.response?.body?.items?.item;
        if (!items) return [];
        return Array.isArray(items) ? items : [items];
    } catch(e) { return []; }
}

/* 국문관광정보 API — contentTypeId: 12=관광지, 14=문화시설, 15=축제, 39=음식점 */
async function callTourApi(contentTypeId, rows=15) {
    if (!API_CONFIG.DATA_GO_KR_KEY) return null;
    const url = 'https://apis.data.go.kr/B551011/KorService2/locationBasedList2?' +
        new URLSearchParams({
            serviceKey:    API_CONFIG.DATA_GO_KR_KEY,
            numOfRows: rows, pageNo:1,
            MobileOS:'ETC', MobileApp:'Yero', _type:'json',
            mapX: userLoc.lng, mapY: userLoc.lat,
            radius: 20000, contentTypeId, arrange:'E',
        });
    const json = await safeFetch(url);
    if (!json) return null;
    return extractItems(json).map(it=>({
        id:    'tour-'+(it.contentid||it.title),
        name:  (it.title||'').trim(),
        addr:  ((it.addr1||'')+' '+(it.addr2||'')).trim(),
        lat:   parseFloat(it.mapy)||null,
        lng:   parseFloat(it.mapx)||null,
        desc:  it.cat3||it.cat2||'한국관광공사 제공',
        tel:   it.tel||'',
        image: it.firstimage||it.firstimage2||'',
        source:'tourapi',
    })).filter(p=>p.name);
}

/* 웰니스 관광 API */
async function callWellnessApi(rows=10) {
    if (!API_CONFIG.DATA_GO_KR_KEY) return null;
    const url = 'https://apis.data.go.kr/B551011/wellnessTourInfo/wellnessList?' +
        new URLSearchParams({
            serviceKey: API_CONFIG.DATA_GO_KR_KEY,
            numOfRows:rows, pageNo:1,
            MobileOS:'ETC', MobileApp:'Yero', _type:'json',
            areaCode: API_CONFIG.TOUR_AREA_CODE,
        });
    const json = await safeFetch(url);
    if (!json) return null;
    return extractItems(json).map(it=>({
        id:    'wellness-'+(it.contentid||it.title),
        name:  (it.title||it.name||'').trim(),
        addr:  (it.addr1||it.address||'').trim(),
        lat:   parseFloat(it.mapy||it.latitude)||null,
        lng:   parseFloat(it.mapx||it.longitude)||null,
        desc:  it.overview||it.cat3||'🧘 웰니스 힐링 추천 장소',
        tel:   it.tel||'',
        source:'wellness',
    })).filter(p=>p.name);
}

/* 카카오맵 로컬 검색 — 카테고리 코드: FD6=음식점, HP8=병원, AT4=관광명소 */
async function callKakaoCategory(code, size=15) {
    if (!API_CONFIG.KAKAO_REST_KEY) return null;
    const url = 'https://dapi.kakao.com/v2/local/search/category.json?' +
        new URLSearchParams({
            category_group_code: code,
            x: userLoc.lng, y: userLoc.lat,
            radius: 10000, size: Math.min(size,15), sort:'distance',
        });
    const json = await safeFetch(url, {headers:{Authorization:'KakaoAK '+API_CONFIG.KAKAO_REST_KEY}});
    if (!json) return null;
    return (json.documents||[]).map(d=>({
        id:    'kakao-'+d.id,
        name:  d.place_name||'',
        addr:  d.road_address_name||d.address_name||'',
        lat:   parseFloat(d.y)||null,
        lng:   parseFloat(d.x)||null,
        desc:  d.category_name||'카카오맵 제공',
        tel:   d.phone||'',
        source:'kakao',
    })).filter(p=>p.name);
}

/* 카카오 키워드 검색 */
async function callKakaoKeyword(keyword, size=10) {
    if (!API_CONFIG.KAKAO_REST_KEY) return null;
    const url = 'https://dapi.kakao.com/v2/local/search/keyword.json?' +
        new URLSearchParams({query:keyword, x:userLoc.lng, y:userLoc.lat,
            radius:10000, size:Math.min(size,15)});
    const json = await safeFetch(url, {headers:{Authorization:'KakaoAK '+API_CONFIG.KAKAO_REST_KEY}});
    if (!json) return null;
    return (json.documents||[]).map(d=>({
        id:'kakao-kw-'+d.id, name:d.place_name||'',
        addr:d.road_address_name||d.address_name||'',
        lat:parseFloat(d.y)||null, lng:parseFloat(d.x)||null,
        desc:d.category_name||'카카오맵 제공', tel:d.phone||'',
        source:'kakao',
    })).filter(p=>p.name);
}
