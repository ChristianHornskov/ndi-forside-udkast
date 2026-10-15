/* Sammenligningssiden: versionsvælger, månedskalender (version 2 og 3),
   klassevælger og sammenklappet graf i version 3. Ingen eksterne afhængigheder. */
(function(){
'use strict';

/* ---------- Versionsvælger ---------- */
const switchButtons=[...document.querySelectorAll('.switch-btn')];
function showVersion(v){
  switchButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.version===v)));
  ['1','2','3'].forEach(n=>{
    document.getElementById('version-'+n).hidden=n!==v;
    document.querySelector(`[data-desc="${n}"]`).hidden=n!==v;
  });
  try{history.replaceState(history.state,'',location.pathname+location.search+'#v'+v);}catch{/* file:// i enkelte browsere */}
  if(v==='3')renderComboChart();
}
switchButtons.forEach((b,i)=>{
  b.addEventListener('click',()=>showVersion(b.dataset.version));
  b.addEventListener('keydown',e=>{
    const last=switchButtons.length-1;
    const j={ArrowRight:i===last?0:i+1,ArrowLeft:i===0?last:i-1,Home:0,End:last}[e.key];
    if(j===undefined)return;
    e.preventDefault();switchButtons[j].focus();
  });
});

/* ---------- Månedskalender ---------- */
const MONTHS=['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
const MONTH_NAMES=['januar','februar','marts','april','maj','juni','juli','august','september','oktober','november','december'];
// Offentlige tal fra newdealinvest.dk/graf-v2, aflæst 14. okt. 2026. null = ingen data (ikke 0 %).
const CALENDAR=[
  {year:2026,total:'+9,0 % år til dato',open:9,values:[3.2,-5.4,-3.4,19.5,16.7,-3.0,-16.3,5.1,2.1,-4.9,null,null]},
  {year:2025,total:'+15,2 %',values:[8.2,-6.2,-16.9,0.5,16.3,6.6,7.4,1.9,11.4,6.5,-12.2,-3.9]},
  {year:2024,total:'+46,4 %',values:[-3.3,12.9,3.5,-4.1,0.4,4.0,2.6,-2.5,4.0,5.9,20.4,-2.6]},
  {year:2023,total:'+16,7 % fra start',values:[null,null,null,null,null,null,null,null,null,-6.0,9.8,12.1]}
];
const signed=v=>(v<0?'−':'+')+Math.abs(v).toFixed(1).replace('.',',');

function calendarHTML(){
  const head=`<div role="row" class="cal-row cal-head"><span role="columnheader" class="cal-corner"><span class="sr-only">År</span></span>${MONTHS.map((m,i)=>`<span role="columnheader" class="cal-colhead"><span aria-hidden="true">${m}</span><span class="sr-only">${MONTH_NAMES[i]}</span></span>`).join('')}</div>`;
  const rows=CALENDAR.map(row=>{
    const cells=row.values.map((v,i)=>{
      const m=`<span class="cal-m" aria-hidden="true">${MONTHS[i]}</span>`;
      if(v===null)return `<span role="cell" class="cal-cell empty">${m}<span class="sr-only">ingen data</span></span>`;
      const open=row.open===i;
      return `<span role="cell" class="cal-cell ${v<0?'neg':'pos'}">${m}<span class="cal-v">${signed(v)}${open?'<span aria-hidden="true">*</span>':''}<span class="sr-only"> %${open?', uafsluttet måned':''}</span></span></span>`;
    }).join('');
    return `<div role="row" class="cal-row"><span role="rowheader" class="cal-year"><strong>${row.year}</strong><small>${row.total}</small></span>${cells}</div>`;
  }).join('');
  return head+rows;
}
document.querySelectorAll('[data-calendar]').forEach(el=>{
  el.setAttribute('role','table');
  el.innerHTML=calendarHTML();
});

/* ---------- Version 3: klassevælger ---------- */
const CLASSES={
  PMINDI:{isin:'DK0062499810',docs:'https://node-api.fundmarket.dk/funds/documents/priip_ipm140b',docsLabel:'Læs PRIIP-KID for PMINDI'},
  PMINDIAKK:{isin:'DK0064642623',docs:'https://fundmarket.dk/newdeal-invest-akk-kl-n/',docsLabel:'Se PRIIP-KID og dokumenter for PMINDIAKK hos Fundmarket'}
};
const combo=document.getElementById('version-3');
function selectClass(code){
  const c=CLASSES[code];if(!c)return;
  combo.querySelectorAll('[data-c3-fund]').forEach(b=>{const on=b.dataset.c3Fund===code;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
  combo.querySelector('[data-c3-code]').textContent=code;
  combo.querySelector('[data-c3-isin]').textContent=c.isin;
  const docs=combo.querySelector('[data-c3-docs]');docs.href=c.docs;
  combo.querySelector('[data-c3-docs-label]').textContent=c.docsLabel;
  combo.querySelector('[data-c3-akk-note]').hidden=code!=='PMINDIAKK';
}
combo.querySelectorAll('[data-c3-fund]').forEach(b=>b.addEventListener('click',()=>selectClass(b.dataset.c3Fund)));

/* ---------- Version 3: sammenklappet graf (eksempeldata) ---------- */
const toggle=document.getElementById('c3-chart-toggle');
const region=document.getElementById('c3-chart-region');
const chartBox=document.getElementById('c3-chart-box');
const svg=document.getElementById('c3-chart');
const svgTitle=svg.innerHTML;
toggle.addEventListener('click',()=>{
  const open=toggle.getAttribute('aria-expanded')!=='true';
  toggle.setAttribute('aria-expanded',String(open));
  toggle.querySelector('.c-chart-toggle-label').textContent=open?'Skjul graf':'Vis graf';
  region.hidden=!open;
  renderComboChart();
});
function renderComboChart(){
  const data=window.NDI_DEMO&&window.NDI_DEMO.points;
  const width=chartBox.clientWidth,height=chartBox.clientHeight;
  if(!data||region.hidden||!width)return;
  const t=d=>Date.parse(d+'T12:00:00Z');
  const first=data[0],last=data[data.length-1];
  const series=data.map(p=>({t:t(p.date),fund:(p.total/first.total-1)*100,bench:(p.benchmark/first.benchmark-1)*100}));
  const small=width<500;
  const left=small?40:48,right=small?54:64,top=10,bottom=26;
  const all=series.flatMap(p=>[p.fund,p.bench]);
  const step=50,lo=Math.floor(Math.min(...all)/step)*step,hi=Math.ceil(Math.max(...all)/step)*step;
  const t0=series[0].t,t1=series[series.length-1].t;
  const x=v=>left+(v-t0)/(t1-t0)*(width-left-right);
  const y=v=>top+(hi-v)/(hi-lo)*(height-top-bottom);
  const parts=[svgTitle];
  for(let v=lo;v<=hi;v+=step){
    parts.push(`<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" class="${v===0?'c-zero':'c-grid'}"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end">${v<0?'−'+Math.abs(v):v} %</text>`);
  }
  for(const year of [2024,2025,2026]){
    const tx=x(Date.UTC(year,0,1,12));
    parts.push(`<text x="${tx}" y="${height-6}" text-anchor="middle">${year}</text>`);
  }
  const path=key=>series.map((p,i)=>(i?'L':'M')+x(p.t).toFixed(1)+','+y(p[key]).toFixed(1)).join('');
  parts.push(`<path class="c-bench" d="${path('bench')}"/><path class="c-fund" d="${path('fund')}"/>`);
  const end=series[series.length-1];
  let fy=y(end.fund)+4,by=y(end.bench)+4;
  if(Math.abs(fy-by)<14)by=fy+14;
  const fmt=v=>signed(v)+' %';
  parts.push(`<text class="c-end c-end-fund" x="${width-right+6}" y="${fy}">${fmt(end.fund)}</text><text class="c-end c-end-bench" x="${width-right+6}" y="${by}">${fmt(end.bench)}</text>`);
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  svg.innerHTML=parts.join('');
  document.getElementById('c3-fund-end').textContent=fmt(end.fund);
  document.getElementById('c3-bench-end').textContent=fmt(end.bench);
}
if(typeof ResizeObserver!=='undefined'){
  let frame;new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(renderComboChart);}).observe(chartBox);
}else window.addEventListener('resize',renderComboChart);

/* Start på den version, der står i adressen (#v1–#v3), ellers version 1. */
const fromHash=(location.hash.match(/^#v([123])$/)||[])[1];
showVersion(fromHash||'1');
})();
