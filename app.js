const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),num=n=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0}).format(n),iso=d=>new Date(d).toISOString().slice(0,10),day=86400000;
const fields=['cost','imp','click','view','3s-view','like','coment','share','save','cart','purchase','sales','signup','subscribe'],labels={media:'매체',product:'상품',campaign:'캠페인',adset:'광고 그룹',ad:'소재 / 검색어',keyword:'키워드',date:'일별',week:'주별',month:'월별','ad type':'광고 유형',cost:'광고비',imp:'노출',click:'클릭',sales:'매출',purchase:'구매',roas:'ROAS',ctr:'CTR',cpc:'CPC',cvr:'CVR',cpa:'CPA',cart:'장바구니',signup:'회원가입',subscribe:'구독'};
let rows=[],view='summary',page=0,sort='cost',direction=-1,displayRows=[],mode='snapshot';
function parseCSV(t){let out=[],row=[],cell='',q=false;for(let i=0;i<t.length;i++){let c=t[i];if(c==='"'){if(q&&t[i+1]==='"'){cell+='"';i++}else q=!q}else if(c===','&&!q){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&t[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))out.push(row);row=[];cell=''}else cell+=c}row.push(cell);if(row.some(Boolean))out.push(row);return out}
function normalize(data){const h=data[0].map(x=>String(x).trim().toLowerCase());for(const k of ['date','media','product','cost','sales','purchase'])if(!h.includes(k))throw Error('필수 열 누락: '+k);return data.slice(1).filter(r=>r[h.indexOf('date')]).map(r=>{let o={};h.forEach((k,i)=>o[k]=r[i]??'');fields.forEach(k=>o[k]=Number(String(o[k]).replace(/,/g,''))||0);let d=o.date;if(typeof d==='number'||/^\d{5}(\.\d+)?$/.test(d))o.date=iso(Date.UTC(1899,11,30)+Number(d)*day);else o.date=iso(new Date(String(d).replace(/\.\s*/g,'-').replace(/-$/,'')));o.keyword=String(o.ad).trim();o.month=o.date.slice(0,7);const dt=new Date(o.date);dt.setUTCDate(dt.getUTCDate()-((dt.getUTCDay()+6)%7));o.week=iso(dt);return o})}
function aggregate(rs,key){let m=new Map;for(const r of rs){let k=key?r[key]||'미지정':'합계';if(!m.has(k))m.set(k,{name:k,...Object.fromEntries(fields.map(f=>[f,0]))});fields.forEach(f=>m.get(k)[f]+=r[f])}return [...m.values()].map(o=>({...o,roas:o.cost?o.sales/o.cost*100:null,ctr:o.imp?o.click/o.imp*100:null,cpc:o.click?o.cost/o.click:null,cvr:o.click?o.purchase/o.click*100:null,cpa:o.purchase?o.cost/o.purchase:null}))}
function total(rs){return aggregate(rs,null)[0]||{...Object.fromEntries(fields.map(f=>[f,0])),roas:null,ctr:null,cpc:null,cvr:null,cpa:null}}
function fmt(v,k){return v==null?'—':['roas','ctr','cvr'].includes(k)?v.toFixed(2)+'%':num(v)}
function scope(){return rows.filter(r=>(!$('media').value||r.media===$('media').value)&&(!$('product').value||r.product===$('product').value)&&(!$('type').value||r['ad type']===$('type').value)&&(view!=='creative'||(String(r['ad type']).trim().toUpperCase()==='DA'&&String(r.ad??'').trim()!==''&&String(r.ad).trim()!=='0'))&&(view!=='meta'||r.media.toLowerCase()==='meta')&&(!['google','keyword'].includes(view)||r.media.toLowerCase()==='google')&&(view!=='keyword'||(r['ad type'].toUpperCase()==='SA'&&r.keyword&&(!$('keywordCampaign').value||r.campaign===$('keywordCampaign').value)&&(!$('keywordAdset').value||r.adset===$('keywordAdset').value)&&r.keyword.toLowerCase().includes($('keywordQuery').value.trim().toLowerCase()))))}

let activePeriod='all';
function kstToday(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
function presetRange(key,today=kstToday()){
 const t=new Date(today+'T00:00:00Z'),first=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),1));
 if(key==='yesterday'){const d=iso(+t-day);return [d,d]}
 if(key==='week'){const monday=+t-((t.getUTCDay()+6)%7)*day;return [iso(monday-7*day),iso(monday-day)]}
 if(key==='month')return [iso(first),today];
 if(key==='lastMonth')return [iso(Date.UTC(t.getUTCFullYear(),t.getUTCMonth()-1,1)),iso(+first-day)];
 if(key==='30days')return [iso(+t-29*day),today];
 const dates=rows.map(r=>r.date).sort();return [dates[0]||today,dates.at(-1)||today];
}
function syncPeriodButtons(){document.querySelectorAll('[data-period]').forEach(b=>{const selected=b.dataset.period===activePeriod;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected))})}
function applyPeriod(key){activePeriod=key;const [start,end]=presetRange(key);$('start').value=start;$('end').value=end;page=0;render();if(view==='compare')compare();syncPeriodButtons()}

function filtered(){return scope().filter(r=>r.date>=$('start').value&&r.date<=$('end').value)}
function install(data,source){let parsed=normalize(data);if(!parsed.length)throw Error('데이터가 없습니다');const previous=rows.map(r=>r.date).sort(),followAll=!$('start').value||($('start').value===previous[0]&&$('end').value===previous.at(-1));rows=parsed;mode=source;const dates=rows.map(r=>r.date).sort();for(const [id,key] of [['media','media'],['product','product'],['type','ad type']]){let old=$(id).value;$(id).innerHTML='<option value="">전체</option>'+[...new Set(rows.map(r=>r[key]))].sort().map(v=>'<option>'+esc(v)+'</option>').join('');$(id).value=old}if(activePeriod && activePeriod!=='all'){const range=presetRange(activePeriod);$('start').value=range[0];$('end').value=range[1]}else if(followAll){$('start').value=dates[0];$('end').value=dates.at(-1)}$('status').textContent=source+' · '+num(rows.length)+'행 · '+dates[0]+' ~ '+dates.at(-1);$('status').textContent+=' · 최신 일자 '+dates.at(-1);$('sourceInfo').textContent=$('status').textContent+' · 조회 '+new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});$('bStart').value=$('start').value;$('bEnd').value=$('end').value;let len=(new Date($('end').value)-new Date($('start').value))/day+1;$('aEnd').value=iso(new Date($('start').value)-day);$('aStart').value=iso(new Date($('start').value)-len*day);updateKeywordOptions();render()}
function bars(rs,k,id){const sum=total(rs)[k];let a=aggregate(rs,'product').sort((a,b)=>b[k]-a[k]).slice(0,8),max=Math.max(...a.map(r=>r[k]),1);$(id).innerHTML=a.length?a.map(r=>'<div class="barrow"><div class="barlabel"><span>'+esc(r.name)+'</span><strong>'+fmt(r[k],k)+'</strong></div><div class="track"><div class="fill" style="width:'+r[k]/max*100+'%"></div></div><small class="product-share">비중 '+(sum>0?(r[k]/sum*100).toFixed(2)+'%':'—')+' · ROAS '+fmt(r.roas,'roas')+'</small></div>').join(''):'<p>데이터 없음</p>'}
function axisNumber(v){return new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(v)}
function niceAxisMax(peak){if(!peak)return 1;const power=10**Math.floor(Math.log10(peak)),n=peak/power;return (n<=1?1:n<=2?2:n<=5?5:10)*power}
function chart(rs){
  const barKey=$('metric').value,lineKey=$('lineMetric').value;
  const barLabel=$('metric').selectedOptions[0].text,lineLabel=$('lineMetric').selectedOptions[0].text;
  const a=aggregate(rs,$('grain').value).sort((x,y)=>x.name.localeCompare(y.name));
  if(!a.length){$('chart').innerHTML='<div class="empty">선택한 조건에 해당하는 추이 데이터가 없습니다.</div>';return}
  const W=1100,H=280,L=90,R=90,T=34,B=35,iw=W-L-R,ih=H-T-B;
  const maxFor=key=>{const peak=Math.max(0,...a.map(r=>r[key]??0));return niceAxisMax(peak,['roas','ctr','cvr'].includes(key))};
  const barMax=maxFor(barKey),lineMax=maxFor(lineKey),step=iw/a.length,bw=Math.min(40,step*.65);
  const xx=i=>L+(i+.5)*step,yy=(v,max)=>T+ih-v/max*ih;
  const pct=key=>['roas','ctr','cvr'].includes(key);
  const axis=(v,key)=>pct(key)?axisNumber(v)+'%':Math.abs(v)>=100000000?axisNumber(v/100000000)+'억':Math.abs(v)>=10000?axisNumber(v/10000)+'만':axisNumber(v);
  const value=(v,key)=>fmt(v,key);
  const grid=Array.from({length:6},(_,i)=>{const part=1-i/5,y=T+i*ih/5;return `<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="#e8edf4"/><text x="${L-10}" y="${y+4}" text-anchor="end" fill="#527cad" font-size="12">${axis(barMax*part,barKey)}</text><text x="${W-R+10}" y="${y+4}" fill="#b96a24" font-size="12">${axis(lineMax*part,lineKey)}</text>`}).join('');
  const bars=a.map((r,i)=>r[barKey]==null?'':`<rect x="${xx(i)-bw/2}" y="${yy(r[barKey],barMax)}" width="${bw}" height="${Math.max(0,r[barKey]/barMax*ih)}" rx="2" fill="#8cafd5"><title>${esc(r.name)} · ${esc(barLabel)}: ${value(r[barKey],barKey)}</title></rect>`).join('');
  let connected=false;
  const path=a.map((r,i)=>{if(r[lineKey]==null){connected=false;return ''}const segment=`${connected?'L':'M'} ${xx(i)} ${yy(r[lineKey],lineMax)}`;connected=true;return segment}).join(' ');
  const dots=a.map((r,i)=>r[lineKey]==null?'':`<circle cx="${xx(i)}" cy="${yy(r[lineKey],lineMax)}" r="${a.length>70?2:3.5}" fill="#cb792e"><title>${esc(r.name)} · ${esc(lineLabel)}: ${value(r[lineKey],lineKey)}</title></circle>`).join('');
  const labels=a.map((r,i)=>i===0||i===a.length-1||i%Math.max(1,Math.ceil(a.length/7))===0?`<text x="${xx(i)}" y="${H-10}" text-anchor="middle" fill="#7b899c" font-size="12">${esc($('grain').value==='month'?r.name:r.name.slice(5))}</text>`:'').join('');
  $('chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="막대 ${esc(barLabel)} · 꺾은선 ${esc(lineLabel)} 복합 추이 차트">${grid}${bars}<path d="${path}" fill="none" stroke="#cb792e" stroke-width="2.5"/>${dots}${labels}<line class="chart-guide" x1="0" x2="0" y1="${T}" y2="${H-B}" stroke="#536f93" stroke-dasharray="4 4" visibility="hidden"/>${a.map((r,i)=>`<rect class="chart-hit" data-index="${i}" x="${L+i*step}" y="${T}" width="${step}" height="${ih}" fill="transparent" tabindex="0" aria-label="${esc(r.name)} · ${esc(barLabel)} ${esc(value(r[barKey],barKey))} · ${esc(lineLabel)} ${esc(value(r[lineKey],lineKey))}"/>`).join('')}</svg><div class="chart-tooltip" role="tooltip" hidden></div>`;
  const chart=$('chart'),tip=chart.querySelector('.chart-tooltip'),guide=chart.querySelector('.chart-guide'),svg=chart.querySelector('svg');
  const hide=()=>{tip.hidden=true;guide.setAttribute('visibility','hidden')};
  const show=(i)=>{
    const r=a[i];
    tip.innerHTML=`<strong>${esc(r.name)}</strong><div><span class="tooltip-bar">● ${esc(barLabel)}</span><b>${esc(value(r[barKey],barKey))}</b></div><div><span class="tooltip-line">● ${esc(lineLabel)}</span><b>${esc(value(r[lineKey],lineKey))}</b></div>`;
    tip.hidden=false;guide.setAttribute('x1',xx(i));guide.setAttribute('x2',xx(i));guide.setAttribute('visibility','visible');
    const box=chart.getBoundingClientRect(),plot=svg.getBoundingClientRect(),x=plot.left-box.left+xx(i)/W*plot.width;
    const left=x+16+tip.offsetWidth>box.width?x-tip.offsetWidth-16:x+16;
    tip.style.left=Math.max(4,Math.min(left,box.width-tip.offsetWidth-4))+'px';tip.style.top=(plot.top-box.top+T/H*plot.height+8)+'px';
  };
  chart.querySelectorAll('.chart-hit').forEach(hit=>{const i=Number(hit.dataset.index);hit.onpointerenter=()=>show(i);hit.onpointerdown=()=>show(i);hit.onfocus=()=>show(i);hit.onblur=hide;hit.onkeydown=e=>{if(e.key==='Escape'){hide();hit.blur()}}});
  svg.onpointerleave=hide;

}
const cols=['cost','sales','roas','imp','click','ctr','cpc','cart','purchase','cvr','cpa','signup','subscribe'];

let expandKeywordCampaigns = true;
const keywordExpansionOverrides = new Set();

function keywordIsExpanded(name) {
  return expandKeywordCampaigns !== keywordExpansionOverrides.has(name);
}

function renderDetailTable(filteredRows) {
  const keywordView = view === 'keyword';
  const visible = displayRows.slice(page * 20, page * 20 + 20);
  const campaignsToggle = $('toggleKeywordCampaigns');
  if (campaignsToggle) {
    campaignsToggle.hidden = !keywordView;
    campaignsToggle.disabled = !displayRows.length;
    const allExpanded = displayRows.length > 0 && displayRows.every(row => keywordIsExpanded(row.name));
    campaignsToggle.textContent = allExpanded ? '캠페인 전체 접기' : '캠페인 전체 펼치기';
    campaignsToggle.onclick = () => {
      expandKeywordCampaigns = !allExpanded;
      keywordExpansionOverrides.clear();
      renderDetailTable(filteredRows);
    };
  }

  const byKeyword = new Map(visible.map(row => [row.name, []]));
  if (keywordView) {
    for (const row of filteredRows) {
      byKeyword.get(row.keyword)?.push(row);
    }
  }

  const metricCells = row => cols.map(key => '<td>' + fmt(row[key], key) + '</td>').join('');
  const body = visible.map((row, index) => {
    if (!keywordView) {
      const metaCreative = view === 'creative' && filteredRows.some(item =>
        item.ad === row.name && String(item.media).toLowerCase() === 'meta');
      const nameCell = metaCreative
        ? '<button type="button" class="creative-preview-trigger" data-creative-index="' + index + '" title="Meta 소재 미리보기">' + esc(row.name) + ' <span aria-hidden="true">↗</span></button>'
        : esc(row.name);
      return '<tr><td title="' + esc(row.name) + '">' + nameCell + '</td>' + metricCells(row) + '</tr>';
    }
    const campaigns = aggregate(byKeyword.get(row.name), 'campaign')
      .sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name));
    const expanded = keywordIsExpanded(row.name);
    const parent = '<tr class="keyword-total"><td><button type="button" class="keyword-expand" data-keyword-index="' +
      index + '" aria-expanded="' + expanded + '"><span aria-hidden="true">' +
      (expanded ? '▾' : '▸') + '</span> ' + esc(row.name) + '</button><small>' +
      num(campaigns.length) + '개 캠페인 합계</small></td>' + metricCells(row) + '</tr>';
    if (!expanded) return parent;
    return parent + campaigns.map(campaign =>
      '<tr class="keyword-campaign"><td title="' + esc(campaign.name) +
      '"><small>캠페인</small><span aria-hidden="true">↳ </span>' +
      esc(campaign.name) + '</td>' + metricCells(campaign) + '</tr>'
    ).join('');
  }).join('');

  $('table').innerHTML = '<thead><tr><th data-sort="name">' + labels[$('group').value] +
    '</th>' + cols.map(key => '<th data-sort="' + key + '">' + labels[key] +
    (sort === key ? (direction < 0 ? ' ↓' : ' ↑') : '') + '</th>').join('') +
    '</tr></thead><tbody>' + body + '</tbody>';
}

function render(){if(view==='creative')$('group').value='ad';drawBudget();if(view==='keyword')$('group').value='keyword';let rs=filtered(),t=total(rs);drawMediaDonuts(rs);if(view==='keyword')$('keywordBasis').textContent='Google SA · '+num(rs.length)+'행 · '+num(aggregate(rs,'keyword').length)+'개 키워드';$('kpis').innerHTML=['cost','sales','roas','purchase','cart','click','cpc','ctr','cvr','signup','subscribe'].map(k=>'<div class="kpi"><label>'+labels[k]+'</label><strong>'+fmt(t[k],k)+'</strong><em>'+({roas:'매출 ÷ 광고비 × 100',cpc:'광고비 ÷ 클릭 · 원본 금액 단위',ctr:'클릭 ÷ 노출 × 100',cvr:'구매 ÷ 클릭 × 100'}[k]||(['cost','sales'].includes(k)?'원본 금액 단위':'선택 기간 합계'))+'</em></div>').join('');$('period').textContent=$('start').value+' ~ '+$('end').value+' · '+num(rs.length)+'행';chart(rs);bars(rs,'cost','costbars');bars(rs,'sales','salesbars');let q=$('search').value.toLowerCase();displayRows=aggregate(rs,$('group').value).filter(r=>r.name.toLowerCase().includes(q)).sort((a,b)=>direction*(sort==='name'?a.name.localeCompare(b.name):(a[sort]??-Infinity)-(b[sort]??-Infinity)));page=Math.max(0,Math.min(page,Math.ceil(displayRows.length/20)-1));renderDetailTable(rs);$('count').textContent=num(displayRows.length)+'개 항목';$('page').textContent=(page+1)+' / '+Math.max(1,Math.ceil(displayRows.length/20));$('prev').disabled=page===0;$('next').disabled=(page+1)*20>=displayRows.length;drawDailyPerformance()}
const views=[['summary','◫','Summary'],['meta','◎','Meta'],['google','⌕','Google'],['keyword','⌕','Keywords'],['campaign','☷','Campaign'],['creative','▧','Creative'],['compare','⇄','기간 비교'],['source','↻','데이터 관리']];
$('nav').innerHTML=views.map(([v,i,n])=>'<button data-view="'+v+'">'+i+'　'+n+'</button>').join('');$('group').innerHTML=['media','product','campaign','adset','ad','keyword','ad type','date','week','month'].map(k=>'<option value="'+k+'">'+labels[k]+'</option>').join('');
function switchView(v){view=v;page=0;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('dashboard').hidden=['compare','source'].includes(v);$('comparison').hidden=v!=='compare';$('source').hidden=v!=='source';$('title').textContent=v==='summary'?'광고 성과 한눈에 보기':views.find(x=>x[0]===v)[2]+' 분석';$('keywordFilters').hidden=v!=='keyword';$('group').disabled=['keyword','creative'].includes(v);$('media').disabled=v==='keyword';$('type').disabled=v==='keyword';$('tableTitle').textContent=v==='keyword'?'키워드별 성과':'성과 상세';$('search').placeholder=v==='keyword'?'결과에서 키워드 검색':'이름 검색';$('performanceNotice').textContent=v==='keyword'?'키워드 기준 · US RAW의 Google / SA 행에 기록된 ad 값을 키워드로 집계합니다. 같은 키워드는 캠페인·그룹을 합산하며, 필터로 범위를 좁힐 수 있습니다. 원본에 등록 키워드·검색어 구분 열은 없습니다.':'성과 기준 · US 자사몰 RAW의 구매·매출 보고값을 사용합니다. CTR·CVR·ROAS는 합산 후 재계산합니다. 원본에 통화 표기가 없어 금액은 원본 단위로 표시합니다.';if(v==='keyword'){ $('media').value='';$('type').value='';$('search').value='';updateKeywordOptions();$('group').value='keyword';}else if($('group').value==='keyword')$('group').value='media';if(v==='campaign')$('group').value='campaign';if(v==='creative'){$('group').value='ad';$('media').value='';$('type').value='';$('search').value='';$('tableTitle').textContent='소재별 성과';$('search').placeholder='소재명 검색';$('performanceNotice').textContent='소재 기준 · RAW의 DA 행 중 소재명이 있는 데이터만 집계합니다. Google SA 검색어는 Keywords 탭에서 확인할 수 있습니다.'}labels.ad=v==='creative'?'소재':'소재 / 검색어';render();if(v==='compare')compare()}
$('nav').onclick=e=>{let b=e.target.closest('[data-view]');if(b)switchView(b.dataset.view)};['start','end','media','product','type','group','metric','lineMetric','grain'].forEach(id=>$(id).onchange=()=>{if(id==='start'||id==='end'){activePeriod=null;syncPeriodButtons()}page=0;render();if(view==='compare')compare()});$('search').oninput=()=>{page=0;render()};$('table').onclick = event => {
  const creative = event.target.closest('[data-creative-index]');
  if (view === 'creative' && creative) {
    const row = displayRows[page * 20 + Number(creative.dataset.creativeIndex)];
    if (row) document.dispatchEvent(new CustomEvent('manyo:creative-preview', {detail: {name: row.name}}));
    return;
  }
  const toggle = event.target.closest('[data-keyword-index]');
  if (view === 'keyword' && toggle) {
    const index = Number(toggle.dataset.keywordIndex);
    const row = displayRows[page * 20 + index];
    if (!row) return;
    if (keywordExpansionOverrides.has(row.name)) keywordExpansionOverrides.delete(row.name);
    else keywordExpansionOverrides.add(row.name);
    renderDetailTable(filtered());
    $('table').querySelector('[data-keyword-index="' + index + '"]')?.focus({preventScroll: true});
    return;
  }
  const header = event.target.closest('[data-sort]');
  if (header) {
    direction = sort === header.dataset.sort ? -direction : -1;
    sort = header.dataset.sort;
    render();
  }
};$('prev').onclick=()=>{page--;render()};$('next').onclick=()=>{page++;render()};
function compare(){let ids=['aStart','aEnd','bStart','bEnd'];if(ids.some(id=>!$(id).value)||$('aStart').value>$('aEnd').value||$('bStart').value>$('bEnd').value){$('cmp').textContent='유효한 비교 기간을 선택하세요.';return}let rs=scope(),a=total(rs.filter(r=>r.date>=$('aStart').value&&r.date<=$('aEnd').value)),b=total(rs.filter(r=>r.date>=$('bStart').value&&r.date<=$('bEnd').value));$('cmp').innerHTML='<div class="tablewrap"><table><tr><th>지표</th><th>기준 A</th><th>비교 B</th><th>증감 B−A</th><th>증감률</th></tr>'+cols.map(k=>{let diff=a[k]==null||b[k]==null?null:b[k]-a[k];return '<tr><td>'+labels[k]+'</td><td>'+fmt(a[k],k)+'</td><td>'+fmt(b[k],k)+'</td><td>'+(diff==null?'—':fmt(diff,k)+(['roas','ctr','cvr'].includes(k)?'p':''))+'</td><td>'+(a[k]&&diff!=null?(diff/a[k]*100).toFixed(1)+'%':'—')+'</td></tr>'}).join('')+'</table></div>'};$('compare').onclick=compare;
function download(){let csv=[['항목',...cols.map(k=>labels[k])],...displayRows.map(r=>[r.name,...cols.map(k=>r[k]??'')])].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');let u=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='manyo-us-performance.csv';a.click();URL.revokeObjectURL(u)}$('export').onclick=download;
const DASHBOARD_FEED_URL = "https://script.google.com/macros/s/AKfycbw8kVr6wgh_7sgbcfNzkceY0JBPz1mwfeo7YyYHQN-NL638htSOFQaIrtJtKm9TatX3/exec";
const DEPLOYED_BUDGET = [["month","meta","google","Chat GPT","Criteo"],["2026-10",10000000,2000000,"",""],["2026-11",50000000,10000000,10000000,5000000],["2026-12","","","",""]];
async function readDashboardFeed(dataset) {
  if (!DASHBOARD_FEED_URL) throw Error('실시간 연결 준비 중');
  const url = new URL(DASHBOARD_FEED_URL);
  url.searchParams.set('dataset', dataset);
  url.searchParams.set('_', Date.now());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {cache: 'no-store', credentials: 'omit', signal: controller.signal});
    if (!response.ok) throw Error('연결 응답 오류: ' + response.status);
    const result = await response.json();
    if (!result.ok || !Array.isArray(result.rows)) throw Error('유효한 대시보드 데이터가 없습니다.');
    return result.rows;
  } finally {
    clearTimeout(timer);
  }
}
async function refresh(){refreshBudget();const b=$('refresh');b.disabled=true;b.textContent='조회 중…';try{const data=await readDashboardFeed('raw');install(data,'Google Sheets 실시간 조회');$('status').textContent+=' · 전체 광고비 '+num(total(rows).cost)+' · Meta '+num(total(rows.filter(r=>r.media.toLowerCase()==="meta")).cost)+' · 조회 '+new Date().toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul'});if(view==='compare')compare()}catch(e){$('status').textContent='새로고침 실패 · '+mode+' '+num(rows.length)+'행 유지 · 최신 일자 '+rows.map(r=>r.date).sort().at(-1)+' · 최신 데이터 연결을 확인해 주세요. ('+e.message+')'}finally{b.disabled=false;b.textContent='↻ 데이터 새로고침'}}
$('refresh').onclick=refresh;$('file').onchange=async e=>{try{install(parseCSV(await e.target.files[0].text()),'CSV 직접 불러오기')}catch(e){$('status').textContent='CSV 오류: '+e.message}};fetch('data.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.json()).then(d=>{install(d,'배포 저장본');switchView('summary');if(DASHBOARD_FEED_URL)refresh()}).catch(e=>$('status').textContent='데이터 로드 오류: '+e.message);

function updateKeywordOptions(){let candidates=rows.filter(r=>r.media.toLowerCase()==='google'&&r['ad type'].toUpperCase()==='SA');for(const [id,key] of [['keywordCampaign','campaign'],['keywordAdset','adset']]){let old=$(id).value;let available=id==='keywordAdset'&&$('keywordCampaign').value?candidates.filter(r=>r.campaign===$('keywordCampaign').value):candidates;let options=[...new Set(available.map(r=>r[key]))].sort();$(id).innerHTML='<option value="">전체</option>'+options.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');$(id).value=options.includes(old)?old:'';}}
$('keywordCampaign').onchange=()=>{updateKeywordOptions();page=0;render()};$('keywordAdset').onchange=()=>{page=0;render()};$('keywordQuery').oninput=()=>{page=0;render()};$('keywordReset').onclick=()=>{['keywordCampaign','keywordAdset','keywordQuery','search'].forEach(id=>$(id).value='');updateKeywordOptions();page=0;render()};
document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>applyPeriod(b.dataset.period));syncPeriodButtons();


function dailyPerformanceRows(rs,selection,start,end,today=kstToday()){
 let a=start,b=end;
 if(selection==='30days'){b=today;a=iso(new Date(today+'T00:00:00Z')-29*day)}
 else if(selection!=='selected'){a=[start,selection+'-01'].sort().at(-1);const d=new Date(selection+'-01T00:00:00Z');const last=iso(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0));b=[end,last].sort()[0]}
 const selected=rs.filter(r=>r.date>=a&&r.date<=b);
 return {rows:aggregate(selected,'date').sort((x,y)=>x.name.localeCompare(y.name)),sum:total(selected),start:a,end:b};
}
function drawDailyPerformance(){
 const picker=$('dailyMonth'),old=picker.value,months=[...new Set(rows.map(r=>r.date.slice(0,7)))].sort().reverse();
 picker.innerHTML='<option value="selected">상단 선택 기간</option><option value="30days">최근 30일</option>'+months.map(m=>'<option value="'+esc(m)+'">'+m.slice(0,4)+'년 '+Number(m.slice(5))+'월</option>').join('');
 picker.value=['selected','30days',...months].includes(old)?old:months.includes($('end').value.slice(0,7))?$('end').value.slice(0,7):'selected';
 const data=dailyPerformanceRows(scope(),picker.value,$('start').value,$('end').value);
 const metrics=['cost','imp','click','ctr','cpc','cpm','view','vtr','3s-view','like','coment','share','save','er','cart','purchase','sales','cvr','roas','cpa','signup','subscribe'];
 const names={...labels,cpm:'CPM',view:'조회',vtr:'VTR','3s-view':'3초 조회',like:'좋아요',coment:'댓글',share:'공유',save:'저장',er:'ER'};
 const derived=r=>({...r,cpm:r.imp?r.cost/r.imp*1000:null,vtr:r.imp?r.view/r.imp*100:null,er:r.imp?(r.like+r.coment+r.share+r.save)/r.imp*100:null});
 const value=(r,k)=>['vtr','er'].includes(k)?(r[k]==null?'—':r[k].toFixed(2)+'%'):fmt(r[k],k);
 const row=(r,name,tag='td')=>'<tr><'+tag+'>'+esc(name)+'</'+tag+'>'+metrics.map(k=>'<'+tag+'>'+value(derived(r),k)+'</'+tag+'>').join('')+'</tr>';
 $('dailySummary').textContent=(data.start>data.end?'상단 기간과 선택 월이 겹치지 않습니다.':data.start+' ~ '+data.end)+' · '+data.rows.length+'일 · 비율 지표는 조회 기간 합계 기준으로 재계산';
 $('dailyTable').innerHTML='<thead><tr><th scope="col">일자</th>'+metrics.map(k=>'<th scope="col">'+names[k]+'</th>').join('')+'</tr></thead><tbody>'+(data.rows.length?data.rows.map(r=>row(r,r.name)).join(''):'<tr><td colspan="'+(metrics.length+1)+'" class="empty">선택 조건에 데이터가 없습니다.</td></tr>')+'</tbody><tfoot>'+row(data.sum,'선택 기간 합계')+'</tfoot>';
}

$('dailyMonth').onchange=drawDailyPerformance;


let budgetTargets={},budgetLoaded=false,budgetInfo='목표 불러오는 중…';
function budgetMediaKey(name){return String(name).trim().toLowerCase().replace(/[\s_-]+/g,'')}
function budgetMediaLabel(name){return {meta:'Meta',google:'Google',chatgpt:'Chat GPT',criteo:'Criteo'}[name]||name}
function budgetSummary(rs,targets,month){
 const t=targets[month],media=t?Object.keys(t):['meta','google'];
 const selected=rs.filter(r=>r.date.slice(0,7)===month&&media.includes(budgetMediaKey(r.media)));
 const spent=selected.reduce((sum,r)=>sum+r.cost,0),complete=!!t&&media.length>0&&media.every(m=>t[m]!=null),target=complete?media.reduce((sum,m)=>sum+t[m],0):null;
 return {spent,target,rate:target>0?spent/target*100:null,media,latest:media.map(m=>{const ds=selected.filter(r=>budgetMediaKey(r.media)===m).map(r=>r.date).sort();return budgetMediaLabel(m)+': '+(ds.at(-1)||'RAW 데이터 없음')}).join(' / ')};
}
function drawBudget(){
 $('budgetPanel').hidden=view!=='summary';
 if(!$('budgetMonth').value)$('budgetMonth').value=kstToday().slice(0,7);
 const month=$('budgetMonth').value,z=budgetSummary(rows,budgetTargets,month),t=budgetTargets[month];
 $('budgetSpent').textContent=num(z.spent)+'원';
 $('budgetTarget').textContent=z.target==null?'목표 미설정':num(z.target)+'원';
 $('budgetRate').textContent=z.rate==null?'—':z.rate.toFixed(2)+'%';
 $('budgetFill').style.width=Math.min(100,z.rate||0)+'%';
 $('budgetFill').classList.toggle('over',z.rate>100);
 $('budgetProgress').setAttribute('aria-valuenow',String(Math.min(100,z.rate||0)));
 $('budgetProgress').setAttribute('aria-valuetext',z.rate==null?'목표 미설정 또는 목표 0원':z.rate.toFixed(2)+'%');
 $('budgetRemaining').textContent=z.target==null?'Budget 시트의 매체별 목표를 모두 입력해주세요.':z.spent>z.target?'예산 초과 '+num(z.spent-z.target)+'원':'남은 예산 '+num(z.target-z.spent)+'원';
 $('budgetBasis').textContent=month+' 월 전체 · '+z.latest+' · 상단 기간·매체·상품 필터와 별도 집계 · 공통 목표: '+budgetInfo+(t?' · '+Object.entries(t).map(([m,v])=>budgetMediaLabel(m)+' '+(v==null?'미설정':num(v)+'원')).join(' / '):'');
}
function parseBudgetTable(table){
 const headers=table.cols.map(c=>String(c.label||'').trim()),monthIndex=headers.findIndex(h=>h.toLowerCase()==='month');
 const columns=headers.map((h,i)=>({key:budgetMediaKey(h),i})).filter(c=>c.i!==monthIndex&&c.key&&!['입력안내','note','notes'].includes(c.key));
 if(monthIndex<0||!columns.length)throw Error('Budget에 month와 매체 목표 열이 필요합니다.');
 if(new Set(columns.map(c=>c.key)).size!==columns.length)throw Error('매체명이 중복되었습니다.');
 const targets={};for(const r of table.rows){
 const raw=r.c[monthIndex]?.v;if(raw==null||raw==='')continue;const month=String(raw).trim();if(!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('월 형식 오류: YYYY-MM 텍스트로 입력하세요.');if(targets[month])throw Error(month+' 월이 중복되었습니다.');
 const amounts={};for(const c of columns){const v=r.c[c.i]?.v;const n=v==null||String(v).trim()===''?null:Number(String(v).replace(/,/g,''));if(n!=null&&(!Number.isFinite(n)||n<0))throw Error('목표는 0 이상의 숫자로 입력하세요.');amounts[c.key]=n}targets[month]=amounts;
 }return targets;
}
async function refreshBudget(){
 const b=$('budgetRefresh');b.disabled=true;
 try {
 const [headers,...values]=DASHBOARD_FEED_URL ? await readDashboardFeed('budget') : DEPLOYED_BUDGET;
 budgetTargets=parseBudgetTable({cols:headers.map(label=>({label})),rows:values.map(row=>({c:row.map(v=>({v}))}))});
 budgetLoaded=true;budgetInfo=DASHBOARD_FEED_URL?'조회 '+new Date().toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul'})+' KST':'배포 저장본';
  }catch(e){
 if(!budgetLoaded){
   const [headers,...values]=DEPLOYED_BUDGET;
   budgetTargets=parseBudgetTable({cols:headers.map(label=>({label})),rows:values.map(row=>({c:row.map(v=>({v}))}))});
   budgetLoaded=true;
   budgetInfo='배포 저장본 · 실시간 조회 실패';
 }else budgetInfo='이전 목표 유지 · '+e.message;
 }finally{b.disabled=false;drawBudget()}
}
$('budgetMonth').onchange=drawBudget;$('budgetRefresh').onclick=refreshBudget;refreshBudget();


function mediaDonutData(rs,key){
 const grouped=aggregate(rs,'media').map(r=>({name:r.name,key:budgetMediaKey(r.name),value:r[key]})).sort((a,b)=>a.key.localeCompare(b.key));
 const total=grouped.reduce((s,r)=>s+r.value,0);
 return {total,rows:grouped.map(r=>({...r,share:total>0?r.value/total*100:0}))};
}
function drawMediaDonuts(rs){
 $('mediaDonutSection').hidden=view!=='summary';
 if(view!=='summary')return;
 const palette={meta:'#3f65ad',google:'#d88b3c',chatgpt:'#65a99a',criteo:'#9169b3'},fallback=['#6596bc','#c66d7b','#889a54','#796fbb'];
 const unknown=[...new Set(rows.map(r=>budgetMediaKey(r.media)))].filter(m=>!palette[m]).sort();
 const color=m=>palette[m]||fallback[unknown.indexOf(m)%fallback.length]||'#8593a7';
 $('mediaDonutGrid').innerHTML=[['cost','매체별 광고비'],['click','매체별 클릭'],['sales','매체별 매출']].map(([key,title])=>{
 const data=mediaDonutData(rs,key),unit=v=>key==='click'?num(v)+'회':num(v)+'원';let offset=0;
 const rings=data.rows.filter(r=>r.value>0).map(r=>{const arc='<circle cx="120" cy="120" r="86" fill="none" stroke="'+color(r.key)+'" stroke-width="22" pathLength="100" stroke-dasharray="'+r.share+' '+(100-r.share)+'" stroke-dashoffset="'+(-offset)+'" transform="rotate(-90 120 120)"><title>'+esc(budgetMediaLabel(r.key))+': '+unit(r.value)+' ('+r.share.toFixed(2)+'%)</title></circle>';offset+=r.share;return arc}).join('');
 return '<section class="panel media-donut-card"><h2>'+title+'</h2><svg class="media-donut" viewBox="0 0 240 240" role="img" aria-label="'+title+' 합계 '+unit(data.total)+'"><circle cx="120" cy="120" r="86" fill="none" stroke="#edf1f6" stroke-width="22"/>'+rings+'<text x="120" y="109" text-anchor="middle" class="donut-total-label">합계</text><text x="120" y="138" text-anchor="middle" class="donut-total-value">'+unit(data.total)+'</text></svg><div class="media-donut-legend">'+(data.rows.length?data.rows.map(r=>'<div class="media-donut-row"><span><i style="background:'+color(r.key)+'"></i>'+esc(budgetMediaLabel(r.key))+'</span><strong>'+unit(r.value)+'</strong><small>'+r.share.toFixed(2)+'%</small></div>').join(''):'<p class="donut-empty">선택 조건에 데이터가 없습니다.</p>')+'</div></section>';
 }).join('');
}


(function installCreativePreview() {
  const dialog = document.createElement('dialog');
  dialog.className = 'creative-preview-dialog';
  dialog.setAttribute('aria-labelledby', 'creativePreviewTitle');
  dialog.innerHTML = '<div class="creative-preview-header"><div><h2 id="creativePreviewTitle">소재 미리보기</h2><p id="creativePreviewName"></p></div><button type="button" class="creative-preview-close" aria-label="미리보기 닫기">닫기 ×</button></div><p id="creativePreviewStatus" role="status" aria-live="polite"></p><div id="creativePreviewItems"></div>';
  document.body.appendChild(dialog);
  const nameLabel = dialog.querySelector('#creativePreviewName');
  const status = dialog.querySelector('#creativePreviewStatus');
  const container = dialog.querySelector('#creativePreviewItems');
  const previewCache = new Map();
  const previewRequests = new Map();
  let previewSequence = 0;
  const videoPlayers = new Map();
  dialog.querySelector('.creative-preview-close').onclick = () => dialog.close();
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    previewSequence++;
    container.replaceChildren();
  });

  function safeUrl(value, image) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password ||
        [...url.searchParams.keys()].some(key => /^(access_token|appsecret_proof|client_token|authorization)$/i.test(key))) return '';
      if (image) return /(^|\.)(fbcdn\.net|fbsbx\.com)$/.test(url.hostname) ? url.href : '';
      if (url.hostname === 'business.facebook.com') return url.pathname === '/ads/api/preview_iframe.php' ? url.href : '';
      return ['www.facebook.com', 'facebook.com', 'fb.me'].includes(url.hostname) ? url.href : '';
    } catch { return ''; }
  }

  function addPreview(item) {
    const card = document.createElement('article');
    card.className = 'creative-preview-card';
    const heading = document.createElement('h3');
    heading.textContent = item.campaign || 'Meta 광고';
    const context = document.createElement('p');
    context.textContent = (item.adset || '광고 그룹 미지정') + ' · 광고 ID ' + item.id;
    card.append(heading, context);
    const previewUrl = safeUrl(item.previewUrl, false);
    const imageUrl = safeUrl(item.imageUrl, true);
    const thumbnailUrl = safeUrl(item.thumbnailUrl, true);
    if (previewUrl) {
      const frame = document.createElement('iframe');
      frame.src = previewUrl;
      frame.title = item.name + ' Meta 광고 미리보기';
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
      frame.referrerPolicy = 'no-referrer';
      frame.loading = 'lazy';
      card.appendChild(frame);
    }
    if (!item.hasVideo && (imageUrl || thumbnailUrl)) {
      const image = document.createElement('img');
      image.src = imageUrl || thumbnailUrl;
      image.alt = item.name + (imageUrl ? ' 소재 이미지' : ' 소재 썸네일');
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      image.onerror = () => {
        if (thumbnailUrl && image.src !== thumbnailUrl) { image.src = thumbnailUrl; return; }
        image.remove();
        const notice = document.createElement('p');
        notice.textContent = '이미지가 만료되었거나 표시되지 않습니다. Meta 미리보기에서 확인해 주세요.';
        card.appendChild(notice);
      };
      card.appendChild(image);
    }
    const linkUrl = safeUrl(item.previewLink, false);
    if (linkUrl) {
      const link = document.createElement('a');
      link.href = linkUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Meta 광고 미리보기 열기 ↗';
      card.appendChild(link);
    }
    if (!previewUrl && !imageUrl && !thumbnailUrl && !linkUrl) {
      const notice = document.createElement('p');
      notice.textContent = '이 광고는 미리보기 정보를 제공하지 않습니다.';
      card.appendChild(notice);
    }
    container.appendChild(card);
    if (item.hasVideo) loadVideoPlayer(card, item);
  }



  function fetchVideoPlayer(item) {
    const existing = videoPlayers.get(item.id);
    if (existing && Date.now() - existing.loadedAt < 300000) return existing.promise;
    const request = new AbortController();
    const timeout = setTimeout(() => request.abort(), 30000);
    const url = new URL(DASHBOARD_FEED_URL);
    url.searchParams.set('dataset', 'creativeVideo');
    url.searchParams.set('name', item.name);
    url.searchParams.set('adId', item.id);
    const promise = fetch(url, {cache: 'no-store', credentials: 'omit', signal: request.signal})
      .then(async response => {
        if (!response.ok) throw Error('동영상 플레이어를 불러오지 못했습니다.');
        const data = await response.json();
        const source = data.ok ? safeUrl(data.previewUrl, false) : '';
        if (!source) throw Error(data.error || '이 영상은 Meta 광고 미리보기 링크에서 재생해 주세요.');
        return source;
      })
      .catch(error => { videoPlayers.delete(item.id); throw error; })
      .finally(() => clearTimeout(timeout));
    videoPlayers.set(item.id, {loadedAt: Date.now(), promise});
    return promise;
  }

  async function loadVideoPlayer(card, item) {
    const loading = document.createElement('p');
    loading.className = 'creative-video-status';
    loading.setAttribute('role', 'status');
    loading.textContent = '동영상 플레이어를 불러오는 중…';
    card.appendChild(loading);
    try {
      const source = await fetchVideoPlayer(item);
      if (!card.isConnected) return;
      const frame = document.createElement('iframe');
      frame.className = 'creative-video-player';
      frame.src = source;
      frame.title = item.name + ' 동영상 광고';
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
      frame.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'no-referrer';
      const image = card.querySelector('img');
      if (image) image.replaceWith(frame);
      else card.insertBefore(frame, card.querySelector('a') || loading);
      loading.textContent = '영상 안의 재생 버튼을 눌러주세요.';
    } catch (error) {
      if (card.isConnected) loading.textContent = error.message;
    }
  }

  function fetchPreview(name) {
    const saved = previewCache.get(name);
    if (saved && Date.now() - saved.loadedAt < 300000) return Promise.resolve(saved.data);
    if (previewRequests.has(name)) return previewRequests.get(name);
    const request = new AbortController();
    const timeout = setTimeout(() => request.abort(), 45000);
    const url = new URL(DASHBOARD_FEED_URL);
    url.searchParams.set('dataset', 'creative');
    url.searchParams.set('name', name);
    url.searchParams.set('_', Date.now());
    const pending = fetch(url, {cache: 'no-store', credentials: 'omit', signal: request.signal})
      .then(async response => {
        if (!response.ok) throw Error('소재 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        const data = await response.json();
        if (!data.ok || !Array.isArray(data.items)) throw Error(data.error || '소재 연결을 확인해 주세요.');
        previewCache.set(name, {loadedAt: Date.now(), data});
        return data;
      })
      .catch(error => {
        throw Error(request.signal.aborted ? '소재 조회 시간이 초과되었습니다. 다시 눌러주세요.' : error.message);
      })
      .finally(() => { clearTimeout(timeout); previewRequests.delete(name); });
    previewRequests.set(name, pending);
    return pending;
  }

  async function openCreativePreview(name) {
    const sequence = ++previewSequence;
    nameLabel.textContent = name;
    const saved = previewCache.get(name);
    status.textContent = saved && Date.now() - saved.loadedAt < 300000 ? '소재 미리보기' : 'Meta 소재를 불러오는 중…';
    container.replaceChildren();
    if (!dialog.open) dialog.showModal();
    try {
      const data = await fetchPreview(name);
      if (sequence !== previewSequence || !dialog.open) return;
      const items = data.items.filter(item => item.name === name && /^\d+$/.test(String(item.id)));
      if (!items.length) {
        status.textContent = '해당 이름과 캠페인·광고 그룹이 일치하는 Meta 광고를 찾지 못했습니다.';
        return;
      }
      status.textContent = items.length + '개 광고 · 같은 소재명의 광고는 캠페인·광고 그룹별로 표시합니다. 동영상 소재는 플레이어가 열리면 재생 버튼을 눌러주세요.';
      items.forEach(addPreview);
    } catch (error) {
      if (sequence !== previewSequence || !dialog.open) return;
      status.textContent = error.message;
    }
  }
  document.addEventListener('manyo:creative-preview', event => openCreativePreview(event.detail.name));
})();
