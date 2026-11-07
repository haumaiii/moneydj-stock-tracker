const el=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let added=[],page=0;
try{added=JSON.parse(localStorage.getItem('moneydj-rows-v1')||'[]')}catch{}
const selected=new Set();
const key=r=>r[0]+'|'+r[1];
const rate=x=>'<span class="'+(x>=0?'up':'down')+'">'+(x>0?'+':'')+x.toFixed(2)+'%</span>';
function table(headers,rows){return rows.length?'<div class="scroll"><table><thead><tr>'+headers.map(x=>'<th scope="col">'+x+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'<p>沒有符合條件的資料。</p>'}
function draw(){
 const rows=[...new Map([...seed,...added].map(r=>[key(r),r])).values()].sort((a,b)=>a[0].localeCompare(b[0]));
 const dates=[...new Set(rows.map(r=>r[0]))],window=dates.slice(-Number(el('days').value));
 const map=new Map();
 for(const r of rows){if(!map.has(r[1]))map.set(r[1],new Map());map.get(r[1]).set(r[0],r)}
 const stocks=[...map].map(([code,m])=>{
 const first=m.values().next().value[0], last=[...m.keys()].at(-1),r=m.get(last),hits=window.filter(d=>m.has(d)).length;
 let streak=0,best=0;
 for(const d of window){streak=m.get(d)?.[4]>0?streak+1:0;best=Math.max(best,streak)}
 return {code,name:r[2],first,last,hits,gain:r[4],best,m,kind:best>=2?'連續強勢':hits===1&&r[4]>=8?'單日急漲':hits>=2?'重複出現':'單日出現'};
 });
 const query=el('q').value.trim().toLowerCase(), match=(c,n)=>(c+' '+n).toLowerCase().includes(query);
 const sort=el('sort').value,dir=el('asc').checked?1:-1, cmp=(a,b)=>(typeof a=== 'number'?a-b:a.localeCompare(b))*dir;
 const list=stocks.filter(s=>s.hits&&match(s.code,s.name)&&(!el('kind').value||s.kind===el('kind').value)&&(page!==1||s.best>=2&&s.hits>=3)).sort((a,b)=>cmp(a[sort],b[sort])||a.code.localeCompare(b.code));
 const date=el('date').value;
 el('date').innerHTML='<option value="">全部日期</option>'+dates.slice().reverse().map(d=>'<option>'+esc(d)+'</option>').join('');
 el('date').value=dates.includes(date)?date:'';
 for(const b of document.querySelectorAll('[data-page]'))b.setAttribute('aria-current',Number(b.dataset.page)===page);
 for(const id of ['q','days','kind','sort','asc','dateWrap']){const input=el(id);(input.parentElement.tagName==='LABEL'?input.parentElement:input).hidden=id==='dateWrap'?page!==2:id==='q'?page===3:page===2||page===3}
 el('stats').textContent=dates[0]+' 至 '+dates.at(-1)+' ｜ '+dates.length+' 個資料日 · '+rows.length+' 筆紀錄 · '+stocks.length+' 檔股票';
 el('count').textContent=selected.size+'/4';
 const stock=s=>esc(s.code+' '+s.name);
 if(page===2){el('note').textContent='依日期倒序呈現每日入選明細。';el('view').innerHTML=table(['日期','股票','收盤價','當日漲跌幅'],rows.slice().reverse().filter(r=>(!date||r[0]===date)&&match(r[1],r[2])).map(r=>[esc(r[0]),esc(r[1]+' '+r[2]),r[3],rate(r[4])]));return}
 if(page===3){el('note').textContent='回到總覽勾選最多 4 檔。空白符號代表當日未入選。';const s=stocks.filter(x=>selected.has(x.code));el('view').innerHTML=s.length?table(['指標',...s.map(stock)],[['首次出現',...s.map(x=>x.first)],['最近出現',...s.map(x=>x.last)],['最近漲幅',...s.map(x=>rate(x.gain))],...dates.slice().reverse().map(d=>[esc(d),...s.map(x=>x.m.has(d)?rate(x.m.get(d)[4]):'—')])]):'<p>尚未選擇股票。</p>';return}
 el('note').textContent=window[0]+' 至 '+window.at(-1)+'（依資料中有紀錄的交易日）｜'+(page===1?'候選條件為窗內至少出現 3 天且至少連續 2 天入選並上漲。可再查營收、獲利與現金流。':'連續強勢為窗內連續至少 2 天入選並上漲。單日急漲為窗內僅出現 1 天且當日漲幅至少 8%。');
 el('view').innerHTML=table(['比較','股票','分類','出現次數','最長連續','首次出現','最近出現','最近漲幅'],list.map(s=>['<input type="checkbox" aria-label="比較 '+stock(s)+'" data-code="'+esc(s.code)+'" '+(selected.has(s.code)?'checked':selected.size>=4?'disabled':'')+'>',stock(s),s.kind,s.hits+' / '+window.length,s.best+' 日',s.first,s.last,rate(s.gain)]));
}
document.querySelector('nav').onclick=e=>{const b=e.target.closest('[data-page]');if(b){page=+b.dataset.page;draw()}};
document.querySelector('.filters').oninput=draw;
el('view').onchange=e=>{const c=e.target.dataset.code;if(c){e.target.checked?selected.add(c):selected.delete(c);draw();[...el('view').querySelectorAll('[data-code]')].find(x=>x.dataset.code===c)?.focus()}};
function csv(text){
 return text.replace(/^\uFEFF/,'').trim().match(/(?:[^"\r\n]|"(?:[^"]|"")*")+/g)?.map(line=>Array.from(line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,"]*))/g),m=>(m[1]?.replace(/""/g,'"')??m[2]).trim()))||[];
}
el('file').onchange=async e=>{
 try{
 const records=csv(await e.target.files[0].text()), header=records.findIndex(r=>r.includes('股票代號')&&r.includes('漲跌幅'));
 if(header<0)throw Error('找不到欄位標題。');
 const h=records[header],indices=[h.indexOf('日期')<0?h.indexOf('資料日期'):h.indexOf('日期'),...['股票代號','股票名稱','收盤價','漲跌幅'].map(x=>h.indexOf(x))];
 if(indices.includes(-1))throw Error('缺少必備欄位。');
 const imported=records.slice(header+1).map(row=>indices.map(i=>row[i]??'')).filter(r=>r.some(Boolean)).map(([d,c,n,p,g])=>{
 const match=d.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|\s)/);
 if(!match||!c||!n||!p||!g)throw Error('存在缺少欄位或日期格式不符的紀錄。');
 const date=match.slice(1).map(x=>x.padStart(2,'0')).join('-'),price=Number(p.replaceAll(',','')),gain=g.endsWith('%')?Number(g.slice(0,-1)):Number(g)*100;
 if(!Number.isFinite(price)||!Number.isFinite(gain)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('存在無效日期、價格或漲幅。');
 return [date,c,n,price,gain];
 });
 if(!imported.length)throw Error('沒有明細資料。');
 const next=[...new Map([...added,...imported].map(r=>[key(r),r])).values()];
 localStorage.setItem('moneydj-rows-v1',JSON.stringify(next));added=next;draw();el('status').textContent='已匯入 '+imported.length+' 筆並重算。';
 }catch(err){el('status').textContent='匯入失敗：'+err.message}finally{e.target.value=''}
};
draw();

const lastTradeDate = seed.reduce((date, row) => row[0] > date ? row[0] : date, "");
el("update-status").textContent = "MoneyDJ 資料截至 " + lastTradeDate +
  (updateStatus ? (updateStatus.ok ? "｜最近檢查 " : "｜抓取失敗，保留上次資料｜最近檢查 ") +
  new Date(updateStatus.checkedAt).toLocaleString("zh-TW", {timeZone:"Asia/Taipei"}) : "｜尚未執行自動更新");
