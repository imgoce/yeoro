/* ── 백엔드 인증 요청 도우미 — 이메일/카카오/게스트 모두 로그인 시
   백엔드에서 JWT를 발급받아 저장하므로, 로그인 방식에 상관없이 이
   토큰이 있으면 여행기록을 서버와 동기화한다. ───────────── */
function getAuthToken() {
    return localStorage.getItem('yeoro_jwt');
}
async function apiFetchAuthed(path, options={}) {
    const token = getAuthToken();
    if (!token) return null;
    try {
        const res = await fetch(`${API_CONFIG.API_BASE_URL}${path}`, {
            ...options,
            headers: { ...(options.headers||{}), 'Authorization':'Bearer '+token, 'Content-Type':'application/json' },
        });
        if (!res.ok) return null;
        return res.status === 204 ? true : await res.json();
    } catch(e) {
        console.warn(`[travel-log] 서버 동기화 실패: ${e.message}`);
        return null;
    }
}
/* 로그인 직후 서버에 저장된 여행기록을 내려받아 로컬 화면과 맞춘다 */
async function syncTravelLogFromServer() {
    const rows = await apiFetchAuthed('/users/me/travel-logs');
    if (!rows) return;
    const local = getTravelLog(userSession.userId);
    const log = rows.map(row => {
        const date = (row.created_at||'').slice(0,10).replace(/-/g,'.');
        /* 서버는 출처(담은 곳/추천받은 곳)를 저장하지 않으므로
           같은 장소·날짜의 로컬 기록에서 출처를 이어받는다 */
        const prev = local.find(l => l.name === row.place_name && l.date === date);
        return {
            id: row.id, name: row.place_name, category: row.category,
            addr: row.address || '', date,
            origin: (prev && prev.origin) || 'cart',
        };
    });
    saveTravelLog(userSession.userId, log);
    renderTravelLog();
}

/* ── 여행로그 저장/조회 — userId별로 키를 분리해 누구든 기록 유지 ── */
function getTravelLog(userId) {
    try { return JSON.parse(localStorage.getItem('yeoro_log_'+userId) || '[]'); }
    catch(e){ return []; }
}
function saveTravelLog(userId, log) {
    localStorage.setItem('yeoro_log_'+userId, JSON.stringify(log));
}
/* origin — 이 기록이 어디서 왔는지
   'cart'   : 내가 직접 장바구니에 담아 일정으로 만든 곳
   'random' : 🎲 랜덤 추천으로 받은 곳
   'weather': 🌤️ 날씨 맞춤 코스로 받은 곳                              */
function addToTravelLog(items, origin = 'cart') {
    if (!userSession.userId) return;
    const log = getTravelLog(userSession.userId);
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
    const toUpload = [];
    items.forEach(item=>{
        /* 같은 날 같은 장소는 한 번만 기록한다 (추천을 여러 번 눌러도 깔끔하게).
           추천으로 먼저 담겼던 곳을 사용자가 직접 장바구니에 담았다면
           '내가 담은 곳'으로 올려준다 — 직접 고른 쪽이 더 중요한 기록이므로. */
        const already = log.find(l => l.name === item.name && l.date === dateStr);
        if (already) {
            if (origin === 'cart') already.origin = 'cart';
            return;
        }

        log.unshift({
            id: 'log_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
            name: item.name, category: item.category,
            addr: item.addr||'', date: dateStr, origin,
        });
        toUpload.push(item);
    });

    /* 서버 업로드보다 로컬 저장을 먼저 한다.
       순서가 반대면 서버 응답 후 돌아오는 동기화가 아직 저장되지 않은 기록을
       보지 못해 출처(추천받은 곳)를 잃어버린다. */
    saveTravelLog(userSession.userId, log.slice(0,100)); // 최대 100건 보관

    /* 로그인해 토큰이 있으면 서버에도 남긴다 */
    if (getAuthToken()) {
        toUpload.forEach(item=>{
            apiFetchAuthed('/users/me/travel-logs', {
                method: 'POST',
                body: JSON.stringify({ place_name:item.name, category:item.category, address:item.addr||'' }),
            }).then(saved => { if (saved) syncTravelLogFromServer(); });
        });
    }
}
function removeFromTravelLog(logId) {
    if (!userSession.userId) return;
    /* onclick 속성을 거치며 logId는 항상 문자열로 넘어오므로 문자열로 비교한다 */
    let log = getTravelLog(userSession.userId);
    log = log.filter(l => String(l.id) !== String(logId));
    saveTravelLog(userSession.userId, log);
    renderTravelLog();
    /* "log_"로 시작하지 않으면 서버에서 내려받은 기록(숫자 id) → 서버에서도 삭제 */
    if (getAuthToken() && !String(logId).startsWith('log_')) {
        apiFetchAuthed(`/users/me/travel-logs/${logId}`, { method:'DELETE' });
    }
}
let _historyQuery = '';        // 여행로그 검색어
let _historyFilter = 'all';    // 'all' | 'cart'(내가 담은 곳) | 'rec'(추천받은 곳)

function setHistoryFilter(kind) {
    _historyFilter = kind;
    document.querySelectorAll('#history-filter .hist-chip').forEach(btn => {
        const on = btn.dataset.filter === kind;
        btn.style.background = on ? 'var(--yeoro-blue)' : 'var(--yeoro-mist)';
        btn.style.color      = on ? '#fff' : 'var(--yeoro-blue)';
    });
    renderTravelLog();
}

function onHistorySearch(value) {
    _historyQuery = (value || '').trim();
    document.getElementById('history-search-clear').style.display = _historyQuery ? 'inline' : 'none';
    renderTravelLog();
}
function clearHistorySearch() {
    const input = document.getElementById('history-search-input');
    if (input) input.value = '';
    _historyQuery = '';
    document.getElementById('history-search-clear').style.display = 'none';
    renderTravelLog();
}

function renderTravelLog() {
    const banner = document.getElementById('history-guest-banner');
    const empty  = document.getElementById('history-empty-state');
    const noRes  = document.getElementById('history-no-result');
    const search = document.getElementById('history-search-bar');
    const filter = document.getElementById('history-filter');
    const list   = document.getElementById('history-log-list');
    if (!banner || !list) return;

    banner.classList.toggle('hidden', userSession.loggedIn);
    noRes?.classList.add('hidden');

    if (!userSession.userId) {
        empty.classList.remove('hidden');
        search?.classList.add('hidden');
        filter?.classList.add('hidden');
        list.innerHTML='';
        return;
    }

    const log = getTravelLog(userSession.userId);
    if (log.length===0) {
        empty.classList.remove('hidden');
        search?.classList.add('hidden');   // 기록 없으면 검색창도 숨김
        filter?.classList.add('hidden');
        list.innerHTML='';
        return;
    }
    empty.classList.add('hidden');
    search?.classList.remove('hidden');    // 기록이 있으면 검색창·필터 노출
    filter?.classList.remove('hidden');

    /* ① 출처 필터 — 내가 담은 곳 / 추천받은 곳 */
    const byOrigin = log.filter(e => {
        const o = e.origin || 'cart';
        if (_historyFilter === 'cart') return o === 'cart';
        if (_historyFilter === 'rec')  return o === 'random' || o === 'weather';
        return true;
    });

    /* ② 검색어로 이름·카테고리·주소·날짜 필터링 */
    const q = _historyQuery.toLowerCase();
    const shown = q
        ? byOrigin.filter(e => `${e.name||''} ${e.category||''} ${e.addr||''} ${e.date||''}`.toLowerCase().includes(q))
        : byOrigin;

    if (shown.length === 0) {
        noRes?.classList.remove('hidden');
        list.innerHTML='';
        return;
    }

    const catIcon = {'관광명소':'landscape','먹거리':'restaurant','축제':'festival','의료기관':'local_hospital'};
    /* 출처 배지 — 어떻게 담긴 기록인지 한눈에 구분 */
    const originBadge = {
        random:  ['🎲 랜덤추천', '#F3EEFF', '#6B46C1'],
        weather: ['🌤️ 날씨추천', '#E8F3FF', '#2E5FA3'],
    };
    list.innerHTML = shown.map(entry=>{
        const badge = originBadge[entry.origin];
        const badgeHtml = badge
            ? `<span style="font-size:.68em;font-weight:700;padding:2px 6px;border-radius:6px;
                 background:${badge[1]};color:${badge[2]};margin-left:6px;vertical-align:middle;">${badge[0]}</span>`
            : '';
        return `
        <div class="log-entry-card">
            <div class="log-entry-icon"><span class="material-icons">${catIcon[entry.category]||'place'}</span></div>
            <div>
                <div class="log-entry-name">${esc(entry.name)}${badgeHtml}</div>
                <div class="log-entry-meta">${esc(entry.date)} · ${esc(entry.category)}</div>
            </div>
            <span class="material-icons log-entry-del" onclick="removeFromTravelLog('${entry.id}')">close</span>
        </div>`;
    }).join('');
}
