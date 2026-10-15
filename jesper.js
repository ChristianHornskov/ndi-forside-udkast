/* Version 1 – Jespers mockup (src/app.js + src/core.js).
   Tilpasset til sammenligningssiden:
   - klassisk script i stedet for ES-moduler (moduler kan ikke indlæses via file://)
   - data indlejret via data.js (window.NDI_DEMO) i stedet for fetch('./data.json')
   - alle opslag og klik-handlere er begrænset til #v-jesper, så de ikke rammer de andre versioner
   - noter om demodata er fjernet (siden bruges kun til at se design); URL-opdatering er gjort fejltolerant (file://) */
(function(){
'use strict';
const root=document.getElementById('v-jesper');
if(!root)return;

/* ---- core.js ---- */
const FUNDS = {
  PMINDI: {name:'NewDeal Invest, kl n',type:'Udbyttebetalende',isin:'DK0062499810',documents:'https://fundmarket.dk/newdeal-invest-kl-n/'},
  PMINDIAKK: {name:'NewDeal Invest Akk., kl n',type:'Akkumulerende',isin:'DK0064642623',documents:'https://fundmarket.dk/newdeal-invest-akk-kl-n/'}
};
const PERIODS = {'1m':'1 måned','3m':'3 måneder',ytd:'År til dato','1y':'1 år',all:'Siden start'};
const DAY = 86400000;
function timestamp(date){return Date.parse(date+'T12:00:00Z');}
function dateString(ms){return new Date(ms).toISOString().slice(0,10);}
function cutoff(points,period){
  const end=new Date(timestamp(points.at(-1).date));
  if(period==='all')return timestamp(points[0].date);
  if(period==='ytd')return Date.UTC(end.getUTCFullYear()-1,11,31,12);
  const originalDay=end.getUTCDate();
  end.setUTCDate(1);
  if(period==='1y')end.setUTCFullYear(end.getUTCFullYear()-1);
  else end.setUTCMonth(end.getUTCMonth()-(period==='3m'?3:1));
  const lastDay=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();
  end.setUTCDate(Math.min(originalDay,lastDay));
  return end.getTime();
}
function periodPoints(points,period){
  const target=cutoff(points,period);
  let start=0;
  for(let i=0;i<points.length;i++){if(timestamp(points[i].date)<=target)start=i;else break;}
  return points.slice(start);
}
function returnBetween(first,last,key='total'){return (last[key]/first[key]-1)*100;}
function seriesFor(points,period,mode){
  const selected=periodPoints(points,period), first=selected[0];
  return selected.map(p=>({...p,value:mode==='price'?p.price:returnBetween(first,p),comparison:returnBetween(first,p,'benchmark')}));
}
function stats(points){
  const first=points[0],last=points.at(-1);
  const years=(timestamp(last.date)-timestamp(first.date))/(DAY*365.25);
  const result={total:returnBetween(first,last),cagr:years>0?((last.total/first.total)**(1/years)-1)*100:null};
  for(const [label,period] of [['ytd','ytd'],['year','1y']]){
    const sample=periodPoints(points,period);
    result[label]=timestamp(first.date)<=cutoff(points,period)?returnBetween(sample[0],last):null;
  }
  return result;
}
function nearest(points,date){
  const target=typeof date==='number'?date:timestamp(date);
  let best=0;
  for(let i=1;i<points.length;i++)if(Math.abs(timestamp(points[i].date)-target)<Math.abs(timestamp(points[best].date)-target))best=i;
  return best;
}
function parseCSV(text){
  const lines=text.replace(/^﻿/,'').trim().split(/\r?\n/).filter(s=>s.trim());
  if(lines.length<3)throw new Error('Filen skal indeholde en overskrift og mindst to datarækker.');
  if(lines.length>10001)throw new Error('Filen må højst indeholde 10.000 datarækker.');
  const delimiter=lines[0].includes(';')?';':',';
  const headers=lines[0].split(delimiter).map(s=>s.trim().replace(/^"|"$/g,'').toLowerCase());
  if(new Set(headers).size!==headers.length)throw new Error('Kolonnenavne må kun optræde én gang.');
  if(!['date','total','benchmark','price'].every(k=>headers.includes(k)))throw new Error('De påkrævede kolonner er: date,total,benchmark,price.');
  const seen=new Set();
  const points=lines.slice(1).map((line,i)=>{
    const cells=line.split(delimiter).map(s=>s.trim().replace(/^"|"$/g,''));
    if(cells.length!==headers.length)throw new Error(`Række ${i+2}: antal felter matcher ikke overskriften.`);
    const row=Object.fromEntries(headers.map((h,j)=>[h,cells[j]]));
    const ms=timestamp(row.date);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isFinite(ms)||dateString(ms)!==row.date)throw new Error(`Række ${i+2}: brug en gyldig dato i formatet ÅÅÅÅ-MM-DD.`);
    if(seen.has(row.date))throw new Error(`Række ${i+2}: datoen ${row.date} optræder mere end én gang.`);
    seen.add(row.date);
    const point={date:row.date};
    for(const key of ['total','benchmark','price']){
      const num=Number(delimiter===';'?row[key].replace(',','.'):row[key]);
      if(!row[key]||!Number.isFinite(num)||num<=0||num>1e9)throw new Error(`Række ${i+2}: ${key} skal være et positivt tal.`);
      point[key]=num;
    }
    return point;
  });
  points.sort((a,b)=>a.date.localeCompare(b.date));
  return points;
}
function exportCSV(points){return 'date,total,benchmark,price\n'+points.map(p=>[p.date,p.total,p.benchmark,p.price].join(',')).join('\n')+'\n';}

/* ---- app.js ---- */
const $=s=>root.querySelector(s);
const $$=s=>[...root.querySelectorAll(s)];
const number=new Intl.NumberFormat('da-DK',{minimumFractionDigits:1,maximumFractionDigits:1});
const dateFormat=new Intl.DateTimeFormat('da-DK',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const axisFormat=new Intl.DateTimeFormat('da-DK',{month:'short',year:'numeric',timeZone:'UTC'});
const fmtDate=d=>dateFormat.format(new Date(timestamp(d)));
const pct=(n,sign=false)=>n==null?'—':`${sign&&n>0?'+':''}${number.format(Math.abs(n)<.05?0:n)} %`;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storage={get(key){try{return localStorage.getItem(key)}catch{return null}},set(key,value){try{localStorage.setItem(key,value);return true}catch{return false}},remove(key){try{localStorage.removeItem(key)}catch{}}};
const params=new URLSearchParams(location.search);
const remembered=storage.get('ndi-fund');
const state={fund:FUNDS[params.get('klasse')]?params.get('klasse'):FUNDS[remembered]?remembered:'PMINDI',period:PERIODS[params.get('periode')]?params.get('periode'):'all',mode:params.get('visning')==='price'?'price':'total',benchmark:params.get('nasdaq')!=='0'};
let demo,ready=false,currentSeries=[],chartGeometry,selectedDate='2025-07-01',toastTimer,dialogKind,detailTab='overview';
const imported={};
const dialog=$('#detail-dialog');
const defaultExplanation=$('#mode-explanation').innerHTML;

function dataset(){return imported[state.fund]||demo;}
function points(){return dataset().points;}
function isDemo(){return dataset().kind==='demo';}
function syncURL(){
  try{
    const url=new URL(location.href);
    url.searchParams.set('klasse',state.fund);
    url.searchParams.set('periode',state.period);
    url.searchParams.set('visning',state.mode);
    if(state.benchmark)url.searchParams.delete('nasdaq');else url.searchParams.set('nasdaq','0');
    history.replaceState(history.state,'',url);
  }catch{/* nogle browsere tillader ikke replaceState på file:// */}
}
function selectFund(fund){
  if(!FUNDS[fund])return;
  state.fund=fund;storage.set('ndi-fund',fund);selectedDate=null;
  update();
}
function update(){
  $$('[data-fund]').forEach(el=>{const active=el.dataset.fund===state.fund;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));});
  if(!ready)return;
  syncURL();
  const last=points().at(-1);
  const isPrice=state.mode==='price';
  const demoMode=isDemo();
  $('#eyebrow-fund').textContent=state.fund;
  $('#legend-fund').textContent=state.fund+(isPrice?(demoMode?' · indeks':' · DKK'):'');
  $('#chart-title').textContent=isPrice?'Kurs over tid':'Totalafkast over tid';
  $('#updated').textContent=`Senest opdateret pr. ${fmtDate(last.date)}`;
  $$('[data-mode]').forEach(el=>{const active=el.dataset.mode===state.mode;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
  $$('[data-period]').forEach(el=>{const active=el.dataset.period===state.period;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
  $('#toggle-benchmark').hidden=isPrice;
  $('#toggle-benchmark').setAttribute('aria-pressed',String(state.benchmark));
  $('#benchmark-label').textContent=`Nasdaq-100 · pr. ${fmtDate(last.date)}`;
  const context=[];
  if(!demoMode&&state.period!=='all'&&periodPoints(points(),state.period).length===points().length)context.push('Viser den tilgængelige historik i den valgte periode.');
  $('#chart-context').textContent=context.join(' ');$('#chart-context').hidden=!context.length;
  $('#mode-explanation').innerHTML=isPrice
    ?`${demoMode?'Kursen viser udviklingen i andelens værdi. Udbetalt udbytte indgår ikke i kursen.':'Kursen viser andelens værdi i DKK på de indlæste datoer. Udbetalt udbytte indgår ikke i kursen.'} Vælg Totalafkast for at se udviklingen med geninvesteret udbytte. <strong>Historisk afkast er ikke en pålidelig indikator for fremtidigt afkast.</strong> <button class="text-link inline" type="button" data-dialog="risk">Se yderligere risikoinformation.</button>`
    :defaultExplanation;
  updateMetrics();renderChart();
}
function updateMetrics(){
  const values=stats(points());
  if(isDemo()){values.total=114.6;values.cagr=28.4;values.ytd=9;values.year=-10.1;}
  for(const key of ['total','cagr','ytd','year'])$('#metric-'+key).textContent=pct(values[key]);
  $('#metric-range').textContent=`Fra ${fmtDate(points()[0].date)} til ${fmtDate(points().at(-1).date)} i danske kroner.`;
  $('#metric-ytd-date').textContent=`Dit samlede afkast fra årets start til ${fmtDate(points().at(-1).date)}.`;
}

function renderChart(){
  if(!ready)return;
  currentSeries=seriesFor(points(),state.period,state.mode);
  const first=currentSeries[0],last=currentSeries.at(-1),isPrice=state.mode==='price';
  $('#fund-return').textContent=isPrice?number.format(last.value)+(isDemo()?'':' kr.'):pct(last.value,true);
  $('#benchmark-return').textContent=pct(last.comparison,true);
  const box=$('#chart-container');
  const width=Math.max(300,box.clientWidth||1000),height=Math.max(220,box.clientHeight||410);
  const mobile=width<500;
  const left=mobile?36:width*.068,right=mobile?58:width*.088,top=13,bottom=38;
  const plotWidth=width-left-right,plotHeight=height-top-bottom;
  const values=currentSeries.flatMap(p=>!isPrice&&state.benchmark?[p.value,p.comparison]:[p.value]);
  let lower=Math.min(...values),upper=Math.max(...values);
  let step;
  if(state.period==='all'&&isDemo()&&!isPrice){lower=-50;upper=200;step=50;}
  else{
    const span=Math.max(upper-lower,isPrice?1:4);
    const rough=span/4,power=10**Math.floor(Math.log10(rough));
    step=[1,2,2.5,5,10].map(n=>n*power).find(n=>n>=rough)||power*10;
    lower=Math.floor((lower-span*.06)/step)*step;
    upper=Math.ceil((upper+span*.08)/step)*step;
    if(lower===upper)upper=lower+step;
  }
  const t0=timestamp(first.date),t1=timestamp(last.date);
  const x=p=>left+(timestamp(p.date)-t0)/Math.max(1,t1-t0)*plotWidth;
  const y=v=>top+(upper-v)/(upper-lower)*plotHeight;
  const svg=$('#performance-chart');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const parts=[`<title id="svg-title">${isPrice?'Kurs':'Totalafkast'} for ${state.fund}${!isPrice&&state.benchmark?' og Nasdaq-100':''}</title><desc id="svg-description">Fra ${fmtDate(first.date)} til ${fmtDate(last.date)}. Brug datovælgeren efter grafen til at læse hvert datapunkt.</desc>`];
  for(let tick=lower;tick<=upper+step/2;tick+=step){
    const pos=y(tick);const text=Number.isInteger(tick)?String(tick):number.format(tick);
    parts.push(`<line class="axis-grid ${Math.abs(tick)<.001?'zero-line':''}" x1="${left}" x2="${width-right}" y1="${pos}" y2="${pos}"/><text x="${left-10}" y="${pos+4}" text-anchor="end" style="font-size:${mobile?10:Math.max(10,width/78)}px">${text}${isPrice?'':' %'}</text>`);
  }
  const tickCount=mobile?3:5;
  for(let i=0;i<tickCount;i++){
    const index=Math.round(i*(currentSeries.length-1)/(tickCount-1)),point=currentSeries[index];
    let label=state.period==='1m'||state.period==='3m'?new Intl.DateTimeFormat('da-DK',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(timestamp(point.date))):axisFormat.format(new Date(timestamp(point.date)));
    parts.push(`<text x="${x(point)}" y="${height-7}" text-anchor="${i===0?'start':i===tickCount-1?'end':'middle'}" style="font-size:${mobile?10:Math.max(10,width/80)}px">${escape(label)}</text>`);
  }
  const path=key=>currentSeries.map((p,i)=>(i?'L':'M')+x(p).toFixed(2)+','+y(p[key]).toFixed(2)).join(' ');
  if(!isPrice&&state.benchmark)parts.push(`<path class="benchmark-path" d="${path('comparison')}"/>`);
  parts.push(`<path class="fund-path" d="${path('value')}"/>`);
  const fundY=y(last.value);let benchmarkY=y(last.comparison);
  if(Math.abs(fundY-benchmarkY)<19)benchmarkY=fundY+19;
  const labelSize=mobile?9:Math.max(10,width/83);
  parts.push(`<text class="end-label" x="${width-right+8}" y="${fundY+4}" style="fill:var(--cyan);font-size:${labelSize}px">${isPrice?number.format(last.value):pct(last.value,true)}</text>`);
  if(!isPrice&&state.benchmark)parts.push(`<text class="end-label" x="${width-right+8}" y="${benchmarkY+4}" style="fill:var(--yellow);font-size:${labelSize}px">${pct(last.comparison,true)}</text>`);
  parts.push(`<g id="crosshair-group"><line id="crosshair" class="crosshair" y1="${top}" y2="${height-bottom}"/><circle id="fund-dot" r="3.4" fill="var(--cyan)" stroke="var(--panel)" stroke-width="1.5"/><circle id="benchmark-dot" r="3.4" fill="var(--yellow)" stroke="var(--panel)" stroke-width="1.5"/></g><rect x="${left}" y="0" width="${plotWidth}" height="${height-bottom+10}" fill="transparent" style="cursor:crosshair"/>`);
  svg.innerHTML=parts.join('');
  chartGeometry={x,y,left,right,plotWidth,width,height,t0,t1};
  $('#chart-slider').max=currentSeries.length-1;
  const index=selectedDate?nearest(currentSeries,selectedDate):currentSeries.length-1;
  setPoint(index,false);
  $('#chart-loading').hidden=true;
}
function setPoint(index,showTooltip){
  const p=currentSeries[index];if(!p||!chartGeometry)return;
  const {x,y,width,height}=chartGeometry;
  const isPrice=state.mode==='price';
  $('#crosshair').setAttribute('x1',x(p));$('#crosshair').setAttribute('x2',x(p));
  $('#fund-dot').setAttribute('cx',x(p));$('#fund-dot').setAttribute('cy',y(p.value));
  $('#benchmark-dot').setAttribute('cx',x(p));$('#benchmark-dot').setAttribute('cy',y(p.comparison));
  $('#benchmark-dot').style.display=!isPrice&&state.benchmark?'':'none';
  $('#chart-slider').value=index;
  const fundValue=isPrice?number.format(p.value)+(isDemo()?' indeks':' kr.'):pct(p.value,true);
  const comparison=!isPrice&&state.benchmark?` · Nasdaq-100: ${pct(p.comparison,true)}`:'';
  $('#chart-readout').innerHTML=`<span class="date">${fmtDate(p.date)}</span> · ${state.fund} (${isPrice?'kurs':'kursdato'}): ${fundValue}${comparison}`;
  $('#chart-slider').setAttribute('aria-valuetext',`${fmtDate(p.date)}, ${state.fund}: ${fundValue}${comparison}`);
  const tooltip=$('#chart-tooltip');tooltip.hidden=!showTooltip;
  if(showTooltip){
    tooltip.innerHTML=`<b>${fmtDate(p.date)}</b><div class="tooltip-row"><span>${state.fund}</span><strong>${fundValue}</strong></div>${!isPrice&&state.benchmark?`<div class="tooltip-row comparison"><span>Nasdaq-100</span><strong>${pct(p.comparison,true)}</strong></div>`:''}`;
    const tooltipWidth=tooltip.offsetWidth||180;
    tooltip.style.left=Math.min(Math.max(0,x(p)+14),width-tooltipWidth)+'px';
    tooltip.style.top=Math.max(5,Math.min(y(p.value)-85,height-100))+'px';
  }
}
function pointFromPointer(event){
  if(!ready||!chartGeometry)return;
  const rect=event.currentTarget.getBoundingClientRect();
  const cx=(event.clientX-rect.left)/rect.width*chartGeometry.width;
  const fraction=Math.max(0,Math.min(1,(cx-chartGeometry.left)/chartGeometry.plotWidth));
  return nearest(currentSeries,chartGeometry.t0+fraction*(chartGeometry.t1-chartGeometry.t0));
}
$('#performance-chart').addEventListener('pointermove',event=>{
  const index=pointFromPointer(event);if(index!==undefined)setPoint(index,true);
});
$('#performance-chart').addEventListener('pointerdown',event=>{
  const index=pointFromPointer(event);if(index===undefined)return;
  selectedDate=currentSeries[index].date;setPoint(index,true);
});
$('#performance-chart').addEventListener('pointerleave',()=>{
  if(ready)setPoint(selectedDate?nearest(currentSeries,selectedDate):currentSeries.length-1,false);
});
$('#chart-slider').addEventListener('input',event=>{const i=Number(event.target.value);selectedDate=currentSeries[i].date;setPoint(i,true)});
$('#chart-slider').addEventListener('blur',()=>{$('#chart-tooltip').hidden=true});
let resizeFrame;
if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(renderChart)}).observe($('#chart-container'));
else window.addEventListener('resize',renderChart);

function linkCard(url,title,subtitle){return `<a class="document-link" href="${url}" target="_blank" rel="noopener noreferrer"><span><strong>${title}</strong><small>${subtitle}</small></span><span class="arrow" aria-hidden="true">↗</span><span class="sr-only">Åbner i ny fane</span></a>`;}
function sourceNote(){return isDemo()?'':`<div class="dialog-note"><strong>Egne data for ${state.fund}.</strong><br>${escape(dataset().name)} · ${points().length} observationer. Data er gemt i denne browser og er ikke verificeret af NewDeal Invest. Deling af et link overfører ikke disse data.</div>`;}
function documentCards(){return Object.entries(FUNDS).map(([key,f])=>linkCard(f.documents,key+' · '+f.type,'PRIIP-KID, prospekt og fondsinformation hos Fundmarket')).join('');}
function dataPanel(){return `${sourceNote()}<h3>Indlæs dine egne kursdata</h3><p>Importér en CSV til <strong>${state.fund}</strong>. Graf og nøgletal genberegnes med det samme. Filen behandles lokalt og forlader ikke din browser.</p><p>Brug kolonnerne <code>date,total,benchmark,price</code>: dato som <code>2026-01-02</code>, totalafkastindeks med geninvesteret udbytte, Nasdaq-100-totalafkastindeks i DKK og andelskurs i DKK. Begge indeks skal være positive og konsistente gennem hele serien. Komma eller semikolon kan bruges som separator.</p><label class="field-label" for="csv-input">CSV til ${state.fund} · højst 2 MB</label><input class="file-input" type="file" id="csv-input" accept=".csv,text/csv"><p class="status-message" id="import-status" role="status"></p><div class="dialog-actions"><button type="button" class="outline-button" data-action="template">Hent CSV-skabelon ↓</button><button type="button" class="outline-button" data-action="export-all">Eksportér data ↓</button>${!isDemo()?'<button type="button" class="text-link" data-action="reset-data">Gendan standarddata</button>':''}</div>`;}
function insightPanel(){
  const tabs=`<div class="dialog-tabs" role="tablist" aria-label="Porteføljeindsigt">${[['overview','Overblik'],['returns','Afkast'],['data','Data & metode']].map(([id,title])=>`<button role="tab" type="button" class="dialog-tab" id="tab-${id}" aria-selected="${detailTab===id}" aria-controls="insight-tabpanel" tabindex="${detailTab===id?0:-1}" data-insight-tab="${id}">${title}</button>`).join('')}</div>`;
  let content;
  if(detailTab==='data')content=dataPanel();
  else if(detailTab==='returns')content=`<p>Afkast beregnet fra ${isDemo()?'kursdata':'de indlæste data'}. Perioderne slutter ${fmtDate(points().at(-1).date)}.</p><table class="data-table"><thead><tr><th scope="col">Periode</th><th scope="col">${state.fund}</th><th scope="col">Nasdaq-100</th></tr></thead><tbody>${Object.entries(PERIODS).map(([key,title])=>{const p=periodPoints(points(),key);return `<tr><td>${title}</td><td>${pct(returnBetween(p[0],p.at(-1)),true)}</td><td>${pct(returnBetween(p[0],p.at(-1),'benchmark'),true)}</td></tr>`}).join('')}</tbody></table>${sourceNote()}<div class="dialog-actions"><button class="outline-button" type="button" data-action="export">Eksportér valgt periode ↓</button><button class="outline-button" type="button" data-action="share">Kopiér link til visning ↗</button></div>`;
  else content=`<p class="intro">${FUNDS[state.fund].name}</p><p>${state.fund} er ${state.fund==='PMINDI'?'udbyttebetalende. Udbyttet udbetales til dig.':'akkumulerende. Afkastet geninvesteres i fonden.'} Se sammensætning, selskaber og de seneste analyser hos NewDeal Invest.</p>${linkCard('https://www.newdealinvest.dk/portefoljer','Selskaber og porteføljer','Se den aktuelle fondsinformation')}${linkCard('https://www.newdealinvest.dk/folgmed','Analyser og indsigter','Læs analyser, markedsopdateringer og nyheder')}${linkCard(FUNDS[state.fund].documents,'Dokumenter for '+state.fund,'PRIIP-KID, prospekt og risiko hos Fundmarket')}<div class="dialog-actions"><button type="button" class="outline-button" data-dialog="data">Se data & beregningsmetode</button><button type="button" class="outline-button" data-action="share">Del denne visning ↗</button></div>`;
  return tabs+`<div role="tabpanel" id="insight-tabpanel" aria-labelledby="tab-${detailTab}">${content}</div>`;
}
function investPanel(){const fund=FUNDS[state.fund];return `<p class="intro">Find ${state.fund} dér, hvor du investerer.</p><div class="invest-choice" role="group" aria-label="Vælg andelsklasse">${Object.keys(FUNDS).map(key=>`<button class="control ${key===state.fund?'active':''}" type="button" data-invest-fund="${key}" aria-pressed="${key===state.fund}">${key}</button>`).join('')}</div><div class="copy-field"><div><span>ISIN · ${fund.type}</span><b>${fund.isin}</b></div><button class="outline-button" type="button" data-action="copy-isin">Kopiér ISIN</button></div><ol class="steps"><li><strong>Åbn din bank eller handelsplatform</strong>Gå til køb af værdipapirer.</li><li><strong>Søg på ${state.fund} eller ${fund.isin}</strong>Kontrollér fondens navn og andelsklasse.</li><li><strong>Læs fondens dokumenter</strong>Tag stilling til risiko og omkostninger, inden du investerer. Du gennemfører selv handlen hos din udbyder.</li></ol><div class="dialog-actions"><a class="outline-button" href="${fund.documents}" target="_blank" rel="noopener noreferrer">Læs PRIIP-KID & prospekt ↗</a></div><p class="dialog-note">Generel information, ikke personlig investerings- eller skatterådgivning. Skatteforhold og tilgængelige depoter afhænger af din situation og udbyder.</p>`;}
function openDialog(kind){
  if(!ready&&['data','insights','cagr'].includes(kind)){toast('Grafen indlæses. Prøv igen om et øjeblik.');return;}
  dialogKind=kind;let title,body;
  switch(kind){
    case 'invest':title='Sådan investerer du';body=investPanel();break;
    case 'funds':title='Danske investeringsforeninger';body=`<p class="intro">To klasser. Samme overordnede strategi.</p><h3>PMINDI · udbyttebetalende</h3><p>Udbytte udbetales til dig. Se klassens egenskaber i vælgeren på siden.</p><h3>PMINDIAKK · akkumulerende</h3><p>Afkastet bliver i fonden og geninvesteres. Valget af klasse afhænger blandt andet af depot og skatteforhold.</p>${documentCards()}<div class="dialog-actions"><button type="button" class="outline-button" data-dialog="invest">Sådan investerer du →</button></div>`;break;
    case 'documents':title='Klasser & dokumenter';body=`<p>Læs de gældende dokumenter hos fondenes forvalter, Fundmarket. Kontrollér altid, at dokumentet gælder for den klasse, du overvejer.</p>${documentCards()}`;break;
    case 'etoro':title='NDI-FutureTech på etoro';body=`<p class="intro">En koncentreret portefølje af teknologivirksomheder.</p><p>NDI-FutureTech følger samme overordnede strategi som de danske investeringsforeninger og er tilpasset eToro. Porteføljen rebalanceres som udgangspunkt kvartalsvist. Minimumsinvestering er 500 USD.</p><h3>Omkostninger og vederlag</h3><p>NewDeal Invest modtager et løbende vederlag fra eToro, når du kopierer porteføljen. Det trækkes ikke fra din investering. eToros egne omkostninger, blandt andet spread og valutaveksling, påløber fortsat.</p><div class="dialog-actions"><a class="outline-button" href="https://www.etoro.com/smartportfolios/ndi-futuretech" target="_blank" rel="noopener noreferrer">Se NDI-FutureTech på eToro ↗</a></div><p class="dialog-note">Investeringsprodukter kan falde i værdi. Læs eToros aktuelle vilkår og risikoinformation, før du investerer.</p>`;break;
    case 'follow':title='Følg med hos NewDeal Invest';body=`<p class="intro">Teknologi, investering og vores perspektiv på markederne.</p>${linkCard('https://www.newdealinvest.dk/folgmed','Analyser, indlæg & webinarer','Se det seneste fra NewDeal Invest')}${linkCard('https://www.newdealinvest.dk/','Nyhedsbrev & fællesskab','Find tilmelding og officielle kanaler på hjemmesiden')}`;break;
    case 'risk':title='Vigtig information';body=`<p class="intro">Historisk afkast er ikke en pålidelig indikator for fremtidigt afkast.</p><p>Du kan tabe en del af eller hele din investering. Informationerne her er generelle og er ikke personlig investerings- eller skatterådgivning.</p><ul class="risk-list"><li><strong>Marked og teknologi.</strong> Porteføljer med teknologiaktier kan have store kursudsving.</li><li><strong>Valuta.</strong> Valutakurser kan påvirke dit afkast i danske kroner.</li><li><strong>Sammenligning.</strong> Nasdaq-100 har en anden sammensætning og risiko. Fonden har ikke et benchmark.</li></ul>${documentCards()}${linkCard('https://www.newdealinvest.dk/risici','Læs den fulde risikoinformation','Risikofaktorer hos NewDeal Invest')}`;break;
    case 'cagr':title='Gennemsnitligt årligt afkast';body=`<p class="intro">CAGR viser den gennemsnitlige årlige vækst med renters rente.</p><p>Det er den konstante årlige vækstrate, som ville føre fra startværdien til slutværdien. Det betyder ikke, at afkastet har været det samme hvert år.</p><div class="formula">(Slutværdi / startværdi)<sup>1 / antal år</sup> − 1</div><p>Et totalafkast på 114,6 % betyder, at et indeks er steget fra 100 til 214,6. Over cirka tre år svarer det til omtrent 28 % om året.</p>${sourceNote()}<p>Afkastet er historisk og udtrykker ikke en forventning til fremtiden.</p>`;break;
    case 'data':title='Data & beregningsmetode';body=dataPanel();break;
    case 'insights':title='Mere indsigt i '+state.fund;body=insightPanel();break;
    default:return;
  }
  $('#dialog-title').textContent=title;
  $('#dialog-eyebrow').textContent=kind==='insights'||kind==='data'?state.fund+' · PORTEFØLJEINDSIGT':'NEWDEAL INVEST';
  $('#dialog-content').innerHTML=body;
  if(!dialog.open)dialog.showModal();
}
function closeDialog(){dialog.close();}
$('#close-dialog').addEventListener('click',closeDialog);
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();}});
function toast(message){const el=$('#toast');(dialog.open?dialog:root).append(el);el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true},3500);}
async function copy(text,success){
  try{await navigator.clipboard.writeText(text);toast(success)}catch{
    const input=document.createElement('textarea');input.value=text;input.style.cssText='position:fixed;opacity:0';(dialog.open?dialog:root).append(input);input.select();
    const copied=document.execCommand('copy');input.remove();toast(copied?success:'Kunne ikke kopiere automatisk. Markér og kopiér teksten.');
  }
}
function download(text,filename){const blob=new Blob(['﻿'+text],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('CSV-filen er klar til download.');}
root.addEventListener('click',event=>{
  const button=event.target.closest('[data-fund],[data-mode],[data-period],[data-dialog],[data-insight-tab],[data-invest-fund],[data-action]');
  if(!button)return;
  if(button.dataset.fund)selectFund(button.dataset.fund);
  if(button.dataset.mode){state.mode=button.dataset.mode;update();}
  if(button.dataset.period){state.period=button.dataset.period;selectedDate=null;update();}
  if(button.dataset.dialog){if(button.dataset.dialog==='insights')detailTab='overview';openDialog(button.dataset.dialog);}
  if(button.dataset.insightTab){detailTab=button.dataset.insightTab;openDialog('insights');$(`[data-insight-tab="${detailTab}"]`).focus();}
  if(button.dataset.investFund){selectFund(button.dataset.investFund);openDialog('invest');$(`[data-invest-fund="${state.fund}"]`).focus();}
  const action=button.dataset.action;
  if(action==='copy-isin')copy(FUNDS[state.fund].isin,'ISIN kopieret: '+FUNDS[state.fund].isin);
  if(action==='share')copy(location.href,'Linket til denne visning er kopieret.');
  if(action==='export'||action==='export-all')download(exportCSV(action==='export'?periodPoints(points(),state.period):points()),`${state.fund}-data-${action==='export'?state.period:'alle'}.csv`);
  if(action==='template')download('date,total,benchmark,price\n2026-01-02,100,100,100\n2026-01-05,101,100.5,101\n',state.fund+'-skabelon.csv');
  if(action==='reset-data'){delete imported[state.fund];storage.remove('ndi-data-'+state.fund);update();openDialog(dialogKind);toast('Standarddata er gendannet.');}
});
$('#toggle-benchmark').addEventListener('click',()=>{state.benchmark=!state.benchmark;update()});
dialog.addEventListener('keydown',event=>{
  if(event.target.matches('[role="tab"]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
    event.preventDefault();const tabs=['overview','returns','data'];let i=tabs.indexOf(detailTab);
    i=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:-1)+3)%3;
    detailTab=tabs[i];openDialog('insights');$(`[data-insight-tab="${detailTab}"]`).focus();
  }
});
root.addEventListener('change',async event=>{
  if(event.target.id!=='csv-input')return;
  const file=event.target.files[0];if(!file)return;
  const status=$('#import-status'),targetFund=state.fund;
  try{
    if(file.size>2*1024*1024)throw new Error('Filen er for stor. Vælg en CSV på højst 2 MB.');
    const parsed=parseCSV(await file.text());
    imported[targetFund]={kind:'imported',name:file.name,points:parsed};
    const saved=storage.set('ndi-data-'+targetFund,JSON.stringify(imported[targetFund]));
    state.fund=targetFund;storage.set('ndi-fund',targetFund);
    state.period='all';selectedDate=null;update();openDialog(dialogKind);
    $('#import-status').textContent=`${parsed.length} observationer indlæst for ${state.fund}.${saved?' Data er gemt i denne browser.':' Browseren tillader ikke lagring; data er kun tilgængelige i denne session.'}`;
  }catch(error){status.textContent=error.message;}
});
window.addEventListener('popstate',()=>{
  const p=new URLSearchParams(location.search);state.fund=FUNDS[p.get('klasse')]?p.get('klasse'):'PMINDI';state.period=PERIODS[p.get('periode')]?p.get('periode'):'all';state.mode=p.get('visning')==='price'?'price':'total';state.benchmark=p.get('nasdaq')!=='0';update();
});

function start(){
  update();
  try{
    demo=window.NDI_DEMO;
    if(!demo||!Array.isArray(demo.points)||demo.points.length<2)throw new Error('Datasættet er tomt.');
    for(const key of Object.keys(FUNDS)){
      try{const saved=JSON.parse(storage.get('ndi-data-'+key));if(saved?.kind==='imported'){saved.points=parseCSV(exportCSV(saved.points));imported[key]=saved;}}catch{storage.remove('ndi-data-'+key)}
    }
    ready=true;update();
  }catch(error){
    const el=$('#chart-loading');el.classList.add('error');el.innerHTML='<div><p>Grafdata kunne ikke indlæses (data.js mangler).</p></div>';
  }
}
start();
})();
