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
        const url=`https://map.kakao.com/link/to/${encodeURIComponent(item.name)},${item.lat},${item.lng}`;
        const node=document.createElement('div'); node.className='timeline-node';
        node.innerHTML=`
            <div class="timeline-title">${esc(item.name)}</div>
            <div class="timeline-sub">${item._dist!=null?'직선거리 '+item._dist+'km · ':''}${esc(item.category)}</div>
            <button class="btn btn-sm mt-2 px-3 fw-bold rounded-3"
                style="font-size:.78em;background:var(--yeoro-mist);color:var(--yeoro-blue);border:1px solid var(--yeoro-border);"
                onclick="window.open('${url}')">길찾기</button>`;
        box.appendChild(node);
    });
}
