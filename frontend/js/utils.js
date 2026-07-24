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
    const m={tourapi:['관광API','#E8F3FF','#2E5FA3'],wellness:['웰니스API','#E6F9F0','#10A37F'],
             kakao:['카카오맵','#FEF7C3','#A98600'],
             egen:['응급의료','#FDE7E7','#C0392B'],hira:['심평원','#EAF1FF','#2F5FE0'],
             local:['기본정보','#F2F4F6','#7A97B8']};
    const [lbl,bg,col]=m[src]||m.local;
    return `<span style="font-size:.7em;font-weight:700;padding:2px 7px;border-radius:6px;
                background:${bg};color:${col};margin-left:6px;vertical-align:middle;">${lbl}</span>`;
}
