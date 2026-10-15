/* Sammenligningssiden: versionsvælger, månedskalender (version 2), samt graf,
   månedstabel og klassevælger i version 3. Ingen eksterne afhængigheder. */
(function(){
'use strict';

const signed=v=>(v<0?'−':'+')+Math.abs(v).toFixed(1).replace('.',',');
const pct=v=>signed(v)+' %';

/* ---------- Månedsdata (fælles for version 2 og 3) ---------- */
const MONTHS=['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
const MONTH_NAMES=['januar','februar','marts','april','maj','juni','juli','august','september','oktober','november','december'];
// null = ingen data (ikke 0 %). open = indeks for uafsluttet måned.
const CALENDAR=[
  {year:2026,total:'+9,0 % år til dato',sum:9.0,sumNote:'år til dato',open:9,values:[3.2,-5.4,-3.4,19.5,16.7,-3.0,-16.3,5.1,2.1,-4.9,null,null]},
  {year:2025,total:'+15,2 %',sum:15.2,values:[8.2,-6.2,-16.9,0.5,16.3,6.6,7.4,1.9,11.4,6.5,-12.2,-3.9]},
  {year:2024,total:'+46,4 %',sum:46.4,values:[-3.3,12.9,3.5,-4.1,0.4,4.0,2.6,-2.5,4.0,5.9,20.4,-2.6]},
  {year:2023,total:'+16,7 % fra start',sum:16.7,sumNote:'fra start',values:[null,null,null,null,null,null,null,null,null,-6.0,9.8,12.1]}
];

/* Version 2: tofarvet kalender (farveblokke) */
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

/* Version 3: rolig tabel – kun tekstfarve, svag tone ved måneder over ±10 % */
function calmTableHTML(){
  const head=`<caption class="sr-only">Afkast måned for måned i procent for PMINDI</caption><thead><tr><th scope="col">År</th>${MONTHS.map((m,i)=>`<th scope="col"><abbr title="${MONTH_NAMES[i]}">${m}</abbr></th>`).join('')}<th scope="col" class="c3-sum">År i alt</th></tr></thead>`;
  const body=CALENDAR.map(row=>{
    const cells=row.values.map((v,i)=>{
      if(v===null)return '<td class="empty"><span class="sr-only">ingen data</span></td>';
      const open=row.open===i;
      const cls=(v<0?'neg':'pos')+(Math.abs(v)>=10?' big':'');
      return `<td class="${cls}">${signed(v)}${open?'<span aria-hidden="true">*</span><span class="sr-only"> (uafsluttet måned)</span>':''}</td>`;
    }).join('');
    const note=row.sumNote?`<small>${row.sumNote}</small>`:'';
    return `<tr><th scope="row">${row.year}</th>${cells}<td class="c3-sum ${row.sum<0?'neg':'pos'}">${signed(row.sum)}${note}</td></tr>`;
  }).join('');
  return head+`<tbody>${body}</tbody>`;
}
document.querySelectorAll('[data-c3-calendar]').forEach(el=>{el.innerHTML=calmTableHTML();});

/* ---------- Version 3: klassevælger ---------- */
const combo=document.getElementById('version-3');
const DOCS={PMINDI:'https://fundmarket.dk/newdeal-invest-kl-n/',PMINDIAKK:'https://fundmarket.dk/newdeal-invest-akk-kl-n/'};
combo.querySelectorAll('[data-c3-fund]').forEach(b=>b.addEventListener('click',()=>{
  const code=b.dataset.c3Fund;
  combo.querySelectorAll('[data-c3-fund]').forEach(o=>{const on=o===b;o.classList.toggle('selected',on);o.setAttribute('aria-pressed',String(on));});
  combo.querySelector('[data-c3-docs]').href=DOCS[code];
  combo.querySelector('[data-c3-docs-name]').textContent=code;
}));

/* ---------- Version 3: graf i Jespers stil (færre perioder) ---------- */
const $c=id=>document.getElementById(id);
const chartBox=$c('c3-chart-container'),svg=$c('c3-chart'),slider=$c('c3-slider'),tooltip=$c('c3-tooltip');
const benchToggle=$c('c3-toggle-benchmark');
const svgHead=svg.innerHTML;
const dateFmt=new Intl.DateTimeFormat('da-DK',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const axisFmt=new Intl.DateTimeFormat('da-DK',{month:'short',year:'numeric',timeZone:'UTC'});
const ts=d=>Date.parse(d+'T12:00:00Z');
const fmtDate=d=>dateFmt.format(new Date(ts(d)));
const chart={period:'all',benchmark:true,series:[],geo:null,selected:null};

function cutoff(points,period){
  const end=new Date(ts(points[points.length-1].date));
  if(period==='ytd')return Date.UTC(end.getUTCFullYear()-1,11,31,12);
  if(period==='1y'){end.setUTCFullYear(end.getUTCFullYear()-1);return end.getTime();}
  return ts(points[0].date);
}
function buildSeries(){
  const points=window.NDI_DEMO.points,target=cutoff(points,chart.period);
  let start=0;
  for(let i=0;i<points.length;i++){if(ts(points[i].date)<=target)start=i;else break;}
  const sel=points.slice(start),f=sel[0];
  return sel.map(p=>({date:p.date,value:(p.total/f.total-1)*100,comparison:(p.benchmark/f.benchmark-1)*100}));
}
function nearest(t){
  let best=0;
  chart.series.forEach((p,i)=>{if(Math.abs(ts(p.date)-t)<Math.abs(ts(chart.series[best].date)-t))best=i;});
  return best;
}
function renderChart(){
  if(!window.NDI_DEMO||combo.hidden)return;
  chart.series=buildSeries();
  const s=chart.series,first=s[0],last=s[s.length-1];
  $c('c3-fund-return').textContent=pct(last.value);
  $c('c3-benchmark-return').textContent=pct(last.comparison);
  const width=Math.max(300,chartBox.clientWidth||1000),height=Math.max(220,chartBox.clientHeight||410);
  const mobile=width<500;
  const left=mobile?40:width*.068,right=mobile?58:width*.088,top=13,bottom=38;
  const plotW=width-left-right,plotH=height-top-bottom;
  const values=s.flatMap(p=>chart.benchmark?[p.value,p.comparison]:[p.value]);
  let lower=Math.min(...values),upper=Math.max(...values);
  const span=Math.max(upper-lower,4),rough=span/4,power=10**Math.floor(Math.log10(rough));
  const step=[1,2,2.5,5,10].map(n=>n*power).find(n=>n>=rough)||power*10;
  lower=Math.floor((lower-span*.06)/step)*step;upper=Math.ceil((upper+span*.08)/step)*step;
  const t0=ts(first.date),t1=ts(last.date);
  const x=p=>left+(ts(p.date)-t0)/Math.max(1,t1-t0)*plotW;
  const y=v=>top+(upper-v)/(upper-lower)*plotH;
  const fs=mobile?10:Math.max(10,width/78);
  const parts=[svgHead];
  for(let tick=lower;tick<=upper+step/2;tick+=step){
    const label=Number.isInteger(tick)?(tick<0?'−'+Math.abs(tick):String(tick)):signed(tick).replace('+','');
    parts.push(`<line class="axis-grid ${Math.abs(tick)<.001?'zero-line':''}" x1="${left}" x2="${width-right}" y1="${y(tick)}" y2="${y(tick)}"/><text x="${left-10}" y="${y(tick)+4}" text-anchor="end" style="font-size:${fs}px">${label} %</text>`);
  }
  const n=mobile?3:5;
  for(let i=0;i<n;i++){
    const p=s[Math.round(i*(s.length-1)/(n-1))];
    parts.push(`<text x="${x(p)}" y="${height-7}" text-anchor="${i===0?'start':i===n-1?'end':'middle'}" style="font-size:${fs}px">${axisFmt.format(new Date(ts(p.date)))}</text>`);
  }
  const path=key=>s.map((p,i)=>(i?'L':'M')+x(p).toFixed(2)+','+y(p[key]).toFixed(2)).join(' ');
  if(chart.benchmark)parts.push(`<path class="benchmark-path" d="${path('comparison')}"/>`);
  parts.push(`<path class="fund-path" d="${path('value')}"/>`);
  const fy=y(last.value);let by=y(last.comparison);
  if(Math.abs(fy-by)<19)by=fy+19;
  const ls=mobile?9:Math.max(10,width/83);
  parts.push(`<text class="end-label" x="${width-right+8}" y="${fy+4}" style="fill:var(--cyan);font-size:${ls}px">${pct(last.value)}</text>`);
  if(chart.benchmark)parts.push(`<text class="end-label" x="${width-right+8}" y="${by+4}" style="fill:var(--yellow);font-size:${ls}px">${pct(last.comparison)}</text>`);
  parts.push(`<line id="c3-crosshair" class="crosshair" y1="${top}" y2="${height-bottom}"/><circle id="c3-fund-dot" r="3.4" fill="var(--cyan)" stroke="var(--panel)" stroke-width="1.5"/><circle id="c3-bench-dot" r="3.4" fill="var(--yellow)" stroke="var(--panel)" stroke-width="1.5"/><rect x="${left}" y="0" width="${plotW}" height="${height-bottom+10}" fill="transparent" style="cursor:crosshair"/>`);
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  svg.innerHTML=parts.join('');
  chart.geo={x,y,left,plotW,width,height,t0,t1};
  slider.max=s.length-1;
  setPoint(chart.selected?nearest(ts(chart.selected)):s.length-1,false);
}
function setPoint(i,showTip){
  const p=chart.series[i],g=chart.geo;if(!p||!g)return;
  const cross=$c('c3-crosshair');cross.setAttribute('x1',g.x(p));cross.setAttribute('x2',g.x(p));
  const fd=$c('c3-fund-dot');fd.setAttribute('cx',g.x(p));fd.setAttribute('cy',g.y(p.value));
  const bd=$c('c3-bench-dot');bd.setAttribute('cx',g.x(p));bd.setAttribute('cy',g.y(p.comparison));bd.style.display=chart.benchmark?'':'none';
  slider.value=i;
  const comp=chart.benchmark?` · Nasdaq-100: ${pct(p.comparison)}`:'';
  $c('c3-readout').innerHTML=`<span class="date">${fmtDate(p.date)}</span> · PMINDI: ${pct(p.value)}${comp}`;
  slider.setAttribute('aria-valuetext',`${fmtDate(p.date)}, PMINDI: ${pct(p.value)}${comp}`);
  tooltip.hidden=!showTip;
  if(showTip){
    tooltip.innerHTML=`<b>${fmtDate(p.date)}</b><div class="tooltip-row"><span>PMINDI</span><strong>${pct(p.value)}</strong></div>${chart.benchmark?`<div class="tooltip-row comparison"><span>Nasdaq-100</span><strong>${pct(p.comparison)}</strong></div>`:''}`;
    const w=tooltip.offsetWidth||180;
    tooltip.style.left=Math.min(Math.max(0,g.x(p)+14),g.width-w)+'px';
    tooltip.style.top=Math.max(5,Math.min(g.y(p.value)-85,g.height-100))+'px';
  }
}
function fromPointer(e){
  const g=chart.geo;if(!g)return;
  const r=svg.getBoundingClientRect();
  const cx=(e.clientX-r.left)/r.width*g.width;
  return nearest(g.t0+Math.max(0,Math.min(1,(cx-g.left)/g.plotW))*(g.t1-g.t0));
}
svg.addEventListener('pointermove',e=>{const i=fromPointer(e);if(i!==undefined)setPoint(i,true);});
svg.addEventListener('pointerdown',e=>{const i=fromPointer(e);if(i===undefined)return;chart.selected=chart.series[i].date;setPoint(i,true);});
svg.addEventListener('pointerleave',()=>{if(chart.geo)setPoint(chart.selected?nearest(ts(chart.selected)):chart.series.length-1,false);});
slider.addEventListener('input',()=>{const i=Number(slider.value);chart.selected=chart.series[i].date;setPoint(i,true);});
slider.addEventListener('blur',()=>{tooltip.hidden=true;});
combo.querySelectorAll('[data-c3-period]').forEach(b=>b.addEventListener('click',()=>{
  chart.period=b.dataset.c3Period;chart.selected=null;
  combo.querySelectorAll('[data-c3-period]').forEach(o=>{const on=o===b;o.classList.toggle('active',on);o.setAttribute('aria-pressed',String(on));});
  renderChart();
}));
benchToggle.addEventListener('click',()=>{
  chart.benchmark=!chart.benchmark;benchToggle.setAttribute('aria-pressed',String(chart.benchmark));renderChart();
});
if(typeof ResizeObserver!=='undefined'){
  let frame;new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(renderChart);}).observe(chartBox);
}else window.addEventListener('resize',renderChart);

/* ---------- Versionsvælger ---------- */
const switchButtons=[...document.querySelectorAll('.switch-btn')];
function showVersion(v){
  switchButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.version===v)));
  ['1','2','3'].forEach(n=>{
    document.getElementById('version-'+n).hidden=n!==v;
    document.querySelector(`[data-desc="${n}"]`).hidden=n!==v;
  });
  try{history.replaceState(history.state,'',location.pathname+location.search+'#v'+v);}catch{/* file:// i enkelte browsere */}
  if(v==='3')renderChart();
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
/* Start på den version, der står i adressen (#v1–#v3), ellers version 1. */
const fromHash=(location.hash.match(/^#v([123])$/)||[])[1];
showVersion(fromHash||'1');
})();
