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

/* 관광공사 분류코드(cat2) → 사람이 읽을 수 있는 이름 */
const TOUR_CAT_LABELS = {
    A0101:'자연관광지', A0102:'관광자원',
    A0201:'역사관광지', A0202:'휴양관광지', A0203:'체험관광지', A0204:'산업관광지',
    A0205:'건축/조형물', A0206:'문화시설', A0207:'축제', A0208:'공연/행사',
    A0301:'레포츠', A0302:'육상레포츠', A0303:'수상레포츠', A0304:'항공레포츠',
    A0401:'쇼핑', A0502:'음식점', B0201:'숙박',
};
function tourCatLabel(it) {
    const code = it.cat2 || (it.cat3||'').slice(0,5);
    return TOUR_CAT_LABELS[code] || '한국관광공사 제공';
}

/* 세종시 대략 경계 — 관광공사 데이터에 좌표가 잘못 등록된 항목이 섞여 있어
   (예: 축제 하나가 수천 km 밖으로 찍힘) 범위를 벗어난 좌표는 버린다.
   좌표가 null이면 거리 표시가 생략되고 길찾기도 막힌다. */
const SEJONG_BOUNDS = { minLat: 36.3, maxLat: 36.8, minLng: 126.95, maxLng: 127.55 };
function sejongCoord(mapy, mapx) {
    const lat = parseFloat(mapy), lng = parseFloat(mapx);
    if (!lat || !lng) return { lat: null, lng: null };
    const inside = lat >= SEJONG_BOUNDS.minLat && lat <= SEJONG_BOUNDS.maxLat
                && lng >= SEJONG_BOUNDS.minLng && lng <= SEJONG_BOUNDS.maxLng;
    if (!inside) {
        console.warn(`[좌표오류] 세종 범위 밖 좌표라 무시합니다: ${lat},${lng}`);
        return { lat: null, lng: null };
    }
    return { lat, lng };
}

/* 국문관광정보 API — contentTypeId: 12=관광지, 14=문화시설, 15=축제, 39=음식점
   세종시(areaCode=8)에 등록된 전체 데이터를 가져온다 — 다른 지역은 포함되지 않음.
   거리 계산·가까운 순 정렬은 places.js에서 좌표 기반으로 처리한다. */
async function callTourApi(contentTypeId, rows=100) {
    if (!API_CONFIG.DATA_GO_KR_KEY) return null;
    const url = 'https://apis.data.go.kr/B551011/KorService2/areaBasedList2?' +
        new URLSearchParams({
            serviceKey:    API_CONFIG.DATA_GO_KR_KEY,
            numOfRows: rows, pageNo:1,
            MobileOS:'ETC', MobileApp:'Yero', _type:'json',
            areaCode: API_CONFIG.TOUR_AREA_CODE, contentTypeId,
        });
    const json = await safeFetch(url);
    if (!json) return null;
    return extractItems(json).map(it=>({
        id:    'tour-'+(it.contentid||it.title),
        name:  (it.title||'').trim(),
        addr:  ((it.addr1||'')+' '+(it.addr2||'')).trim(),
        ...sejongCoord(it.mapy, it.mapx),
        desc:  tourCatLabel(it),
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
        ...sejongCoord(it.mapy||it.latitude, it.mapx||it.longitude),
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
            /* 카카오 로컬 API의 최대 반경은 20km (그 이상은 정책상 불가) */
            radius: 20000, size: Math.min(size,15), sort:'distance',
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

/* XML 응답에서 item 배열 추출 (E-Gen 응급의료 API는 XML만 반환) */
async function safeFetchXmlItems(url) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(()=>controller.abort(), API_CONFIG.HTTP_TIMEOUT);
        const res = await fetch(url, {signal:controller.signal});
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, 'application/xml');
        return Array.from(doc.getElementsByTagName('item')).map(node=>{
            const o = {};
            Array.from(node.children).forEach(c=>{ o[c.tagName] = c.textContent; });
            return o;
        });
    } catch(e) {
        console.warn(`[API] XML 실패: ${url.substring(0,60)}... (${e.message})`);
        return null;
    }
}

/* 응급의료기관 위치기반 조회 (국립중앙의료원 E-Gen) — 현위치 주변 응급의료기관 */
async function callEmergencyApi(rows=12) {
    if (!API_CONFIG.MEDICAL_API_KEY) return null;
    const url = 'https://apis.data.go.kr/B552657/ErmctInfoInqireService/getEgytLcinfoInqire?' +
        new URLSearchParams({
            serviceKey: API_CONFIG.MEDICAL_API_KEY,
            WGS84_LON: userLoc.lng, WGS84_LAT: userLoc.lat,
            pageNo: 1, numOfRows: rows,
        });
    const items = await safeFetchXmlItems(url);
    if (!items) return null;
    return items.map(it=>({
        id:    'egen-'+(it.hpid||it.dutyName),
        name:  (it.dutyName||'').trim(),
        addr:  (it.dutyAddr||'').trim(),
        lat:   parseFloat(it.latitude||it.wgs84Lat)||null,
        lng:   parseFloat(it.longitude||it.wgs84Lon)||null,
        desc:  '🚑 '+(it.dutyEmclsName||it.dutyDivName||'응급의료기관')+(it.distance?` · ${it.distance}km`:''),
        tel:   it.dutyTel1||'',
        source:'egen',
    })).filter(p=>p.name);
}

/* 병원정보서비스 (건강보험심사평가원) — 세종시 병·의원 목록 */
async function callHospitalInfoApi(rows=15) {
    if (!API_CONFIG.MEDICAL_API_KEY) return null;
    const url = 'https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList?' +
        new URLSearchParams({
            serviceKey: API_CONFIG.MEDICAL_API_KEY,
            sidoCd: API_CONFIG.MEDICAL_SIDO_CD,
            pageNo: 1, numOfRows: rows, _type:'json',
        });
    const json = await safeFetch(url);
    if (!json) return null;
    return extractItems(json).map(it=>({
        id:    'hira-'+(it.ykiho||it.yadmNm),
        name:  (it.yadmNm||'').trim(),
        addr:  (it.addr||'').trim(),
        lat:   parseFloat(it.YPos)||null,   // 심평원: YPos=위도, XPos=경도
        lng:   parseFloat(it.XPos)||null,
        desc:  '🏥 '+(it.clCdNm||'병원'),
        tel:   it.telno||'',
        source:'hira',
    })).filter(p=>p.name);
}

/* 카카오 키워드 검색 */
async function callKakaoKeyword(keyword, size=10) {
    if (!API_CONFIG.KAKAO_REST_KEY) return null;
    const url = 'https://dapi.kakao.com/v2/local/search/keyword.json?' +
        new URLSearchParams({query:keyword, x:userLoc.lng, y:userLoc.lat,
            radius:20000, size:Math.min(size,15)});
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
