import fs from 'node:fs/promises';

const PAGE='https://tophub.today/c/news?q=%E7%83%AD%E6%90%9C';
const NODES=['223','1','2','140']; // 抖音、微博、百度、夸克；排除爱奇艺、360
const CITY_GROUPS={
  '北京':['北京','故宫','天坛','颐和园','长城','什刹海','中轴线','环球影城','雍和宫'],
  '廊坊':['廊坊','燕郊','三河','香河','只有红楼梦','大厂'],
  '天津':['天津','海河','五大道','天津之眼','古文化街'],
  '沧州':['沧州','南川老街','大运河','吴桥','黄骅'],
  '邯郸':['邯郸','广府古城','响堂山','丛台','赵王城','京娘湖'],
  '张家口':['张家口','崇礼','草原天路','大境门','太舞','蔚县'],
  '成都':['成都','四川','熊猫基地','春熙路','太古里','宽窄巷子','锦里','都江堰','青城山'],
  '德阳':['德阳','四川','三星堆','绵竹','什邡','广汉','德阳文庙'],
  '眉山':['眉山','四川','三苏祠','瓦屋山','柳江古镇','东坡水街','彭祖山'],
  '重庆':['重庆','洪崖洞','解放碑','李子坝','磁器口','长江索道','武隆','观音桥','山城步道']
};
const DIRECT=['旅游','旅行','出游','景区','景点','打卡','路线','citywalk','周末游','自驾','徒步','夜游','文旅','古镇','公园','博物馆','酒店','民宿','游客','旅拍'];
const EVENT=['秋假','雪假','寒假','暑假','放假','降雪','暴雪','降温','台风','流星雨','演唱会','音乐节','赛事','马拉松','航班','高铁','铁路','高速','机场','交通','签证','免签'];
const EXCLUDE=['骨折','致癌','精神病','家暴','诈骗','杀人','死亡','去世','火灾','中毒','癌症','感染','案件','网警','股票','A股','盗洞','袭击','招保洁','招聘','笔试','抛硬币'];
function clean(s=''){return s.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()}
function blocks(html){const re=/<div class="cc-cd" id="node-(\d+)">/g,m=[...html.matchAll(re)];return m.map((x,i)=>({id:x[1],html:html.slice(x.index,m[i+1]?.index||html.length)}))}
function meta(html){return{source:clean(html.match(/<div class="cc-cd-lb">[\s\S]*?>\s*([\s\S]*?)<\/div>/)?.[1]),list:clean(html.match(/<span class="cc-cd-sb-st">\s*([\s\S]*?)\s*<\/span>/)?.[1])}}
function parse(html){const out=[],re=/<a\s+href="([^"]+)"[\s\S]*?<div class="cc-cd-cb-ll">([\s\S]*?)<\/div>\s*<\/a>/g;for(const m of html.matchAll(re)){const row=m[2],rank=Number(clean(row.match(/<span class="s[^"]*">([\s\S]*?)<\/span>/)?.[1])),title=clean(row.match(/<span class="t">([\s\S]*?)<\/span>/)?.[1]),metric=clean(row.match(/<span class="e">([\s\S]*?)<\/span>/)?.[1]);if(rank&&title)out.push({rank,title,metric,url:m[1].startsWith('/')?'https://tophub.today'+m[1]:m[1]})}return out.slice(0,50)}
function citiesFor(title){return Object.entries(CITY_GROUPS).filter(([,keys])=>keys.some(k=>title.includes(k))).map(([c])=>c)}
function classify(item){const t=item.title.toLowerCase();if(EXCLUDE.some(k=>t.includes(k.toLowerCase())))return null;let cities=citiesFor(item.title);const direct=DIRECT.some(k=>t.includes(k.toLowerCase())),event=EVENT.some(k=>t.includes(k.toLowerCase())),broad=/多地|全国|流星雨|降温日历/.test(item.title);if(!direct&&!event)return null;if(!cities.length&&!broad)return null;if(!cities.length&&broad)cities=Object.keys(CITY_GROUPS);let type='目的地热点',why='进入公开热榜，反映目的地或出行场景的即时关注';if(EVENT.some(k=>item.title.includes(k))){type=item.title.match(/秋假|雪假|寒假|暑假|放假/)?'假期窗口':item.title.match(/降雪|暴雪|降温|台风|流星雨/)?'天气窗口':item.title.match(/演唱会|音乐节|赛事|马拉松/)?'活动客流':'交通变化';why=type==='假期窗口'?'新的放假安排可能提前释放家庭短途游和周边游需求':type==='天气窗口'?'天气变化会影响目的地选择、道路条件和户外活动':type==='活动客流'?'大型活动可能推高局部交通、酒店和夜间出行需求':'交通变化会影响跨城出行计划'}return{...item,cities,type,why,score:Math.max(40,101-item.rank)}}
const r=await fetch(PAGE,{headers:{'user-agent':'Mozilla/5.0 Chrome/124 Safari/537.36'}});if(!r.ok)throw new Error(`TopHub ${r.status}`);const html=await r.text(),order=new Map(NODES.map((x,i)=>[x,i]));const raw=blocks(html).filter(b=>NODES.includes(b.id)).sort((a,b)=>order.get(a.id)-order.get(b.id)).map(b=>({...meta(b.html),nodeId:b.id,items:parse(b.html)}));
const platformSignals=raw.map(p=>({...p,items:p.items.map(x=>classify({...x,platform:p.source})).filter(Boolean)}));
const signals=platformSignals.flatMap(p=>p.items),current=new Map();
for(const s of signals){const k=s.title.replace(/[\s“”"']/g,'');const old=current.get(k);if(old){old.platforms=[...new Set([...old.platforms,s.platform])];old.score=Math.min(100,old.score+8)}else current.set(k,{...s,platforms:[s.platform]})}
const dt=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'medium'}).format(new Date()).replace(' ','T')+'+08:00';
await fs.mkdir('data',{recursive:true});let prior=[];try{prior=JSON.parse(await fs.readFile('data/history.json','utf8')).items||[]}catch{}
const history=new Map(prior.map(x=>[x.key,x])),now=Date.now(),maxAge=7*24*60*60*1000;
for(const [key,s] of current){const old=history.get(key);history.set(key,{...old,...s,key,firstSeen:old?.firstSeen||dt,lastSeen:dt,isCurrent:true})}
for(const [key,s] of history){if(!current.has(key))s.isCurrent=false;if(now-new Date(s.lastSeen).getTime()>maxAge)history.delete(key)}
const insights=[...history.values()].sort((a,b)=>(b.isCurrent-a.isCurrent)||(b.score-a.score)||new Date(b.lastSeen)-new Date(a.lastSeen)).slice(0,24);
const citySignals={};for(const city of Object.keys(CITY_GROUPS))citySignals[city]=insights.filter(x=>x.cities.includes(city));
const payload={capturedAt:dt,source:'TopHub 公开聚合榜单',retentionDays:7,platformSignals,insights,citySignals};
await fs.writeFile('data/history.json',JSON.stringify({updatedAt:dt,items:[...history.values()]},null,2)+'\n');await fs.writeFile('data/latest.json',JSON.stringify(payload,null,2)+'\n');console.log(`captured ${platformSignals.length} platforms, ${signals.length} current signals, ${insights.length} retained insights at ${dt}`);
