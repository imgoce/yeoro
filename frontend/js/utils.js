/* ── 유틸 ─────────────────────────────────────────────────────── */
const haversine = (la1,lo1,la2,lo2) => {
    const R=6371, d=v=>v*Math.PI/180;
    const a=Math.sin(d(la2-la1)/2)**2+Math.cos(d(la1))*Math.cos(d(la2))*Math.sin(d(lo2-lo1)/2)**2;
    return Math.round(R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))*10)/10;
};
const esc = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function showToast(msg, type='info') {
    const d=document.createElement('div');
    d.style.cssText=`position:fixed;top:20px;left:50%;transform:translateX(-50%);
        background:${type==='error'?'#c0392b':'#1B3A6B'};color:#fff;padding:10px 18px;
        border-radius:12px;font-size:0.82em;font-weight:600;z-index:9999;
        box-shadow:0 4px 16px rgba(0,0,0,.25);pointer-events:none;`;
    d.textContent=msg; document.body.appendChild(d);
    setTimeout(()=>d.remove(),2800);
}
function sourceBadge(src) {
    /* 데이터 출처(관광API·웰니스API·카카오맵 등) 라벨은 표시하지 않는다.
       단, '응급의료기관'은 이용자에게 유용한 정보라 이것만 뱃지로 남긴다. */
    if (src !== 'egen') return '';
    return `<span style="font-size:.7em;font-weight:700;padding:2px 7px;border-radius:6px;
                background:#FDE7E7;color:#C0392B;margin-left:6px;vertical-align:middle;">응급의료</span>`;
}
