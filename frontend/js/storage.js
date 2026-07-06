/* ── 게스트/회원 식별자 — 게스트도 기기별 고유 ID로 기록을 저장 ──── */
function getOrCreateGuestId() {
    let gid = localStorage.getItem('yeoro_guest_id');
    if (!gid) {
        gid = 'guest_' + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
        localStorage.setItem('yeoro_guest_id', gid);
    }
    return gid;
}

/* ── 간이 회원 저장소 (localStorage 기반 데모용) ──────────────────
   실제 서비스에서는 서버 DB + 해시 비밀번호로 대체해야 합니다.       */
function getUsersDB() {
    try { return JSON.parse(localStorage.getItem('yeoro_users_db') || '{}'); }
    catch(e){ return {}; }
}
function saveUsersDB(db) { localStorage.setItem('yeoro_users_db', JSON.stringify(db)); }

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
    });
    saveTravelLog(userSession.userId, log.slice(0,100)); // 최대 100건 보관
}
function removeFromTravelLog(logId) {
    if (!userSession.userId) return;
    let log = getTravelLog(userSession.userId);
    log = log.filter(l=>l.id!==logId);
    saveTravelLog(userSession.userId, log);
    renderTravelLog();
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
