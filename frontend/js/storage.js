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
    const log = rows.map(row => ({
        id: row.id, name: row.place_name, category: row.category,
        addr: row.address || '', date: (row.created_at||'').slice(0,10).replace(/-/g,'.'),
    }));
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
function addToTravelLog(items) {
    if (!userSession.userId) return;
    const log = getTravelLog(userSession.userId);
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
    items.forEach(item=>{
        log.unshift({
            id: 'log_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
            name: item.name, category: item.category,
            addr: item.addr||'', date: dateStr,
        });
        /* 아이디/비밀번호로 로그인한 경우에만 서버에도 기록을 남김 */
        if (getAuthToken()) {
            apiFetchAuthed('/users/me/travel-logs', {
                method: 'POST',
                body: JSON.stringify({ place_name:item.name, category:item.category, address:item.addr||'' }),
            }).then(saved => { if (saved) syncTravelLogFromServer(); });
        }
    });
    saveTravelLog(userSession.userId, log.slice(0,100)); // 최대 100건 보관
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
function renderTravelLog() {
    const banner = document.getElementById('history-guest-banner');
    const empty  = document.getElementById('history-empty-state');
    const list   = document.getElementById('history-log-list');
    if (!banner || !list) return;

    banner.classList.toggle('hidden', userSession.loggedIn);

    if (!userSession.userId) {
        empty.classList.remove('hidden');
        list.innerHTML='';
        return;
    }

    const log = getTravelLog(userSession.userId);
    if (log.length===0) {
        empty.classList.remove('hidden');
        list.innerHTML='';
        return;
    }
    empty.classList.add('hidden');

    const catIcon = {'관광명소':'landscape','먹거리':'restaurant','축제':'festival','의료기관':'local_hospital'};
    list.innerHTML = log.map(entry=>`
        <div class="log-entry-card">
            <div class="log-entry-icon"><span class="material-icons">${catIcon[entry.category]||'place'}</span></div>
            <div>
                <div class="log-entry-name">${esc(entry.name)}</div>
                <div class="log-entry-meta">${esc(entry.date)} · ${esc(entry.category)}</div>
            </div>
            <span class="material-icons log-entry-del" onclick="removeFromTravelLog('${entry.id}')">close</span>
        </div>`).join('');
}
