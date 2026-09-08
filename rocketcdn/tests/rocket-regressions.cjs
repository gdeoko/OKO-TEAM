'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.env.ROCKET_SOURCE_ROOT || path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const load = (p, c) => vm.runInContext(read(p), c, {filename:p});
test('VPN cabin upgrades shared hull materials while preserving glass, relief and unlit displays',()=>{
 const f=fixture();load('rocketvpn/assets/vendor/three.min.js',f.c);
 const T=f.c.THREE,root=new T.Group(),bump=new T.Texture();
 const hull=new T.MeshPhongMaterial({color:0x284258,bumpMap:bump,bumpScale:.3,emissive:0x224466,emissiveIntensity:0});
 const glass=new T.MeshPhongMaterial({transparent:true,opacity:.25,depthWrite:false,side:T.DoubleSide});
 const glow=new T.MeshBasicMaterial({color:0xffffff});
 const objects=[hull,hull,glass,glow].map(m=>new T.Mesh(new T.BoxGeometry(),m));objects.forEach(m=>root.add(m));
 let retired=0;hull.addEventListener('dispose',()=>retired++);
 f.c.RC_CABIN={build(){f.c.RC_REAL.upgradeTree(T,root,(_mesh,mat)=>({roughness:mat.transparent?.08:.44,metalness:mat.transparent?.1:.78}));return {group:root};}};
 load('rocketvpn/assets/rv-салон-cdn.js',f.c);
 f.c.RV_САЛОН_CDN.собрать(T,{width:1280,height:800});
 assert.ok(objects[0].material.isMeshStandardMaterial);assert.equal(objects[0].material,objects[1].material);
 assert.equal(objects[0].material.bumpMap,bump);assert.equal(objects[0].material.bumpScale,.3);
 assert.equal(objects[0].material.emissiveIntensity,0);assert.equal(retired,1);
 assert.equal(objects[2].material.transparent,true);assert.equal(objects[2].material.opacity,.25);
 assert.equal(objects[2].material.depthWrite,false);assert.equal(objects[2].material.side,T.DoubleSide);
 assert.equal(objects[3].material,glow);
});
test('VPN and CDN post-processing retain byte targets when float color buffers are unsupported',()=>{
 for(const version2 of [false,true])for(const supported of [false,true]){
  const f=fixture();load('rocketvpn/assets/vendor/three.min.js',f.c);const T=f.c.THREE;
  const r={capabilities:{isWebGL2:version2,maxSamples:version2?4:0},
   extensions:{has:name=>supported&&name===(version2?'EXT_color_buffer_float':'EXT_color_buffer_half_float')},
   getSize:v=>v.set(64,32),getPixelRatio:()=>1,getDrawingBufferSize:v=>v.set(64,32)};
  load('rocketvpn/assets/rv-real.js',f.c);
  if(!supported)assert.equal(f.c.RV_REAL.окружение(T,r,new T.Scene()),null);
  const vpn=f.c.RV_REAL.плёнка(T,r,2,64,32,{});
  assert.equal(vpn.сцена.texture.type,supported?T.HalfFloatType:T.UnsignedByteType);
  assert.ok(vpn.уровни.every(x=>x.a.texture.type===vpn.сцена.texture.type&&x.b.texture.type===vpn.сцена.texture.type));
  load('rocketcdn/assets/rc-real.js',f.c);
  if(!supported)assert.equal(f.c.RC_REAL.env(T,r,false),null);
  const cdn=f.c.RC_REAL.post(T,r,{tier:2});
  assert.equal(cdn.scene.texture.type,supported?T.HalfFloatType:T.UnsignedByteType);
  vpn.dispose();cdn.dispose();
 }
});
function clock() {
  let seq=0, now=0; const jobs=new Map();
  return {set:(fn,ms=0)=>{const id=++seq;jobs.set(id,{fn,at:now+ms});return id;},
    clear:id=>jobs.delete(id), tick(ms=17){now+=ms;const due=[...jobs].filter(([,x])=>x.at<=now);for(const [id,x] of due){if(jobs.delete(id))x.fn(now);}},
    all(){for(let i=0;jobs.size&&i<4000;i++)this.tick(17);assert.equal(jobs.size,0,'animation settles');}};
}
test('VPN ship skips its own PMREM generator when float color targets are unavailable',()=>{
 const f=fixture(),s=read('rocketvpn/assets/rv-корабль.js');
 f.c.document.createElement=()=>assert.fail('Unsupported environment must not allocate canvas or PMREM');
 vm.runInContext(between(s,'function envTexture(renderer) {','/* ── Текстура обшивки:'),f.c);
 for(const isWebGL2 of [false,true])assert.equal(f.c.envTexture({capabilities:{isWebGL2},extensions:{has:()=>false}}),null);
});
function classes(){const s=new Set();return {add:x=>s.add(x),remove:x=>s.delete(x),contains:x=>s.has(x),toggle(x,on){on?s.add(x):s.delete(x);}};}
function fixture() {
 const time=clock(), events={}, devents={};
 const c=vm.createContext({console,Blob,URL,Date,Math,setTimeout:time.set,clearTimeout:time.clear,setInterval:()=>1,clearInterval:()=>{},
 requestAnimationFrame:fn=>time.set(fn,16),cancelAnimationFrame:time.clear,innerHeight:800,innerWidth:1280,scrollY:0,
 addEventListener:(k,fn)=>(events[k]??=[]).push(fn),removeEventListener:()=>{},
 navigator:{},sessionStorage:{getItem:()=>null,setItem:()=>{}}, location:{pathname:'/'},
 document:{readyState:'complete',referrer:'',documentElement:{clientHeight:800,classList:classes()},
 addEventListener:(k,fn)=>(devents[k]??=[]).push(fn),querySelectorAll:()=>[],getElementById:()=>null}});
 c.window=c;c.scrollTo=(x,y)=>{c.scrollY=typeof x==='object'?x.top:y;};
 return {c,time,emit:(k,e={})=>(events[k]||[]).forEach(f=>f(e)),demit:(k,e={})=>(devents[k]||[]).forEach(f=>f(e))};
}
function motion(y=0){const f=fixture();f.c.scrollY=y;f.acts=Array.from({length:4},(_,i)=>({
 getBoundingClientRect(){const h=f.c.innerHeight*4,top=i*h-f.c.scrollY;return {top,height:h,bottom:top+h};},
 getAttribute:()=>String(i),setAttribute:()=>{},style:{setProperty:()=>{}}
}));f.c.document.querySelectorAll=()=>f.acts;load('rocketvpn/assets/rv-motion.js',f.c);f.time.tick();return f;}
test('VPN reload starts at restored scroll position',()=>{const f=motion(4400);assert.equal(f.c.RV_MOTION.доля('1'),.5);});
test('VPN resize preserves the act and its progress',()=>{const f=motion(4400);f.c.innerHeight=650;f.emit('resize');f.time.tick();assert.ok(Math.abs(f.c.RV_MOTION.доля('1')-.5)<.001);f.time.all();assert.ok(Math.abs(f.c.RV_MOTION.доля('1')-.5)<.001);});
test('VPN resize preserves progress in sections with fixed or minimum heights',()=>{
 const f=fixture();f.c.scrollY=1000;const section={getBoundingClientRect(){return {top:-f.c.scrollY,bottom:2800-f.c.scrollY,height:2800};},getAttribute:()=> 'final',setAttribute:()=>{},style:{setProperty:()=>{}}};
 f.c.document.querySelectorAll=()=>[section];load('rocketvpn/assets/rv-motion.js',f.c);f.time.all();assert.equal(f.c.RV_MOTION.доля('final'),.5);
 f.c.innerHeight=600;f.emit('resize');f.time.all();assert.equal(f.c.RV_MOTION.доля('final'),.5);assert.equal(f.c.scrollY,1100);
 f.c.innerHeight=900;f.emit('resize');f.time.all();assert.equal(f.c.RV_MOTION.доля('final'),.5);assert.equal(f.c.scrollY,950);
});
test('VPN camera and act share a coordinate during large forward/reverse scrolls',()=>{const f=motion();for(const y of [7500,1800]){f.c.scrollY=y;f.emit('scroll');for(let i=0;i<15;i++){f.time.tick();const p=f.c.RV_MOTION.позиция();for(let j=0;j<4;j++)assert.ok(Math.abs(f.c.RV_MOTION.доля(String(j))-Math.max(0,Math.min(1,(p-j*3200)/2400)))<1e-9);}f.time.all();assert.equal(f.c.RV_MOTION.позиция(),y);}});
const settle = async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function analytics(){const f=fixture();f.sent=[];f.respond=()=>Promise.resolve({ok:true,json:async()=>({ok:true})});f.c.fetch=(url,o)=>{f.sent.push(JSON.parse(o.body));return f.respond();};load('rocketvpn/assets/rv-track.js',f.c);return f;}
test('VPN analytics retries network failures with unchanged event IDs',async()=>{const f=analytics();f.respond=()=>Promise.reject(new Error('offline'));f.time.tick(2100);await settle();assert.equal(f.sent.length,1);f.respond=()=>Promise.resolve({ok:true,json:async()=>({ok:true})});f.emit('online');await settle();assert.equal(f.sent.length,2);assert.deepEqual(f.sent[0].events,f.sent[1].events);});
test('VPN analytics retries storage rejection and recovers after bfcache',async()=>{const f=analytics();f.respond=()=>Promise.resolve({ok:true,json:async()=>({ok:false})});f.time.tick(2100);await settle();f.respond=()=>Promise.resolve({ok:true,json:async()=>({ok:true})});f.emit('online');await settle();f.emit('pagehide');f.emit('pageshow',{persisted:true});f.c.RV_СЧЁТ.событие('кнопка','после возврата');f.time.tick(2100);await settle();assert.equal(f.sent.length,3);assert.equal(f.sent[2].events[0].l,'после возврата');});
test('VPN rejected beacon falls back to keepalive fetch',async()=>{const f=analytics();f.c.navigator.sendBeacon=()=>false;f.emit('pagehide');await settle();assert.equal(f.sent.length,1);assert.equal(f.sent[0].events[0].t,'view');});
test('VPN pagehide flushes queued events while first fetch is pending',async()=>{const f=analytics();let done;f.respond=()=>new Promise(r=>done=r);f.time.tick(2100);f.c.RV_СЧЁТ.событие('кнопка','последняя');const beacons=[];f.c.navigator.sendBeacon=(url,body)=>{beacons.push(body);return true;};f.emit('pagehide');assert.equal(beacons.length,1);assert.equal(JSON.parse(await beacons[0].text()).events[0].l,'последняя');done({ok:true,json:async()=>({ok:true})});await settle();});
function adminFunctions(){const s=read('rocketcdn/admin.html');return s.slice(s.indexOf('function узлыИзТекста('),s.indexOf('function контент()'));}
test('Switching content sites ignores late responses and disables saving until the selected copy loads',async()=>{
 const elements={'#контентСайт':{value:'cdn'},'#контентТекст':{value:''},'#контентСохранить':{disabled:false},'#контентОтвет':{textContent:''}},pending=[];
 const c=vm.createContext({$:s=>elements[s],зов:()=>new Promise(r=>pending.push(r))}),s=read('rocketcdn/admin.html');
 vm.runInContext(s.slice(s.indexOf('var контентЗапрос ='),s.indexOf('var операционныеРазделы =')),c);
 const first=c.контент();elements['#контентСайт'].value='vpn';const second=c.контент();assert.equal(elements['#контентСохранить'].disabled,true);
 pending[1]({ok:true,content:{'text.1':'VPN'}});await second;pending[0]({ok:true,content:{cdn:'Late'}});await first;
 assert.equal(JSON.parse(elements['#контентТекст'].value)['text.1'],'VPN');assert.equal(elements['#контентСохранить'].disabled,false);
 const failed=c.контент();pending[2]({ok:false});await failed;assert.equal(elements['#контентСохранить'].disabled,true);
});
test('Admin preserves zero region/mask and rejects malformed rows',()=>{const c=vm.createContext({});vm.runInContext(adminFunctions(),c);assert.equal(c.узлыИзТекста('Город · 0 · 0 · 0 · 0')[0][3],0);for(const row of ['Город · NaN · 0 · 1 · 1','Город · 2x · 0 · 1 · 1','Город · 0 · 0 · 1.2 · 1','неполная строка'])assert.throws(()=>c.узлыИзТекста(row));});
test('Admin growth compares equal day counts and handles missing denominator',()=>{const c=vm.createContext({});vm.runInContext(adminFunctions(),c);assert.equal(c.ростПериода(Array.from({length:7},()=>({uniq:100}))),0);assert.equal(c.ростПериода([{uniq:10},{uniq:20}]),100);assert.equal(c.ростПериода([{uniq:0},{uniq:10}]),null);assert.equal(c.ростПериода([{uniq:10}]),null);});
test('CSV export neutralizes spreadsheet formulas without changing plain text',()=>{const c=vm.createContext({});vm.runInContext(adminFunctions(),c);for(const x of ['=1+1','+79999999999','-1+2','@SUM(A1)',' \t=2'])assert.ok(c.ячейкаCSV(x).startsWith('"\''));assert.equal(c.ячейкаCSV('Имя "А"'),'"Имя ""А"""');});
test('Flight abandoned world tasks cannot mutate a rebuilt world',()=>{const f=fixture(),s=read('rocketcdn/assets/rc-flight.js');vm.runInContext(s.slice(s.indexOf('var buildQ = []'),s.indexOf('function buildUniverse(')),f.c);let old=0,fresh=0;f.c.buildLater(()=>old++);f.c.buildLater(()=>old++);f.c.cancelBuild();f.c.buildLater(()=>fresh++);f.time.all();assert.equal(old,0);assert.equal(fresh,1);});
test('Flight restores network marks using the parent system transform',()=>{const c=vm.createContext({console});c.window=c;load('rocketvpn/assets/vendor/three.min.js',c);const T=c.THREE;const scene=new T.Scene(),sg=new T.Group(),planet=new T.Group();sg.position.set(100,20,-300);scene.add(sg);const made={group:planet};const s=read('rocketcdn/assets/rc-flight.js');const a=s.indexOf('          made.group.position.set(px, py, pz);'),b=s.indexOf('          live.push(made);',a);c.T=T;c.made=made;c.sg=sg;c.px=10;c.py=2;c.pz=3;c.pi=0;c.pl={name:'X',info:'Y'};c.net={X:true};let pos;c.netMark=p=>pos=p.clone();vm.runInContext(s.slice(a,b),c);assert.deepEqual([pos.x,pos.y,pos.z],[110,22,-297]);});
function between(s,a,b){const i=s.indexOf(a);assert.ok(i>=0,a);const j=s.indexOf(b,i+a.length);assert.ok(j>i,b);return s.slice(i,j);}
test('Rapid form reopen cancels delayed hide and closing cancels queued open',()=>{const f=fixture(),s=read('rocketvpn/assets/rv-меню.js');f.c.g=f.c;f.c.d=f.c.document;f.c.форма={hidden:true,querySelector:()=>null};vm.runInContext('var формаТаймер=0,формаКадр=0;'+between(s,'  function формаОткрыть()','  /* Строка беды'),f.c);f.c.формаОткрыть();f.time.tick();f.c.формаЗакрыть();f.time.tick(100);f.c.формаОткрыть();f.time.tick(300);assert.equal(f.c.форма.hidden,false);f.c.формаЗакрыть();f.c.формаОткрыть();f.c.формаЗакрыть();f.time.tick(300);assert.equal(f.c.форма.hidden,true);assert.equal(f.c.document.documentElement.classList.contains('rv-форма-открыта'),false);});
test('Music resumed within fadeout is not paused by stale timer',()=>{const f=fixture(),s=read('rocketvpn/assets/rv-sound.js');let paused=0;Object.assign(f.c,{g:f.c,К:{currentTime:0},завестиМузыку:()=>{},музЭл:{play:()=>Promise.resolve(),pause:()=>paused++},музГейн:{gain:{setTargetAtTime:()=>{}}}});vm.runInContext('var музыкаТаймер=0;'+between(s,'  function музыка(да)','  /* ── ПОДПИСКА НА АКТЫ'),f.c);f.c.музыка(false);f.time.tick(300);f.c.музыка(true);f.time.tick(800);assert.equal(paused,0);});
test('Cancel docking prevents delayed navigation, next docking still works',()=>{const f=fixture(),s=read('rocketcdn/assets/rc-dock.js');let trips=0;Object.assign(f.c,{g:f.c,швартуется:false,узел:{setAttribute:()=>{},removeAttribute:()=>{},classList:classes(),querySelectorAll:()=>[]},былФокус:null,полёт:()=>null,тише:()=>false,уйти:()=>trips++});vm.runInContext('var таймерШвартовки=0,таймерФокуса=0;'+between(s,'function швартовка(','function собрать()')+between(s,'function закрыть(тихо)','function открыт()'),f.c);const button={classList:classes()};f.c.швартовка(button,'vpn');f.time.tick(200);f.c.закрыть();f.time.tick(800);assert.equal(trips,0);f.c.швартовка(button,'cdn');f.time.tick(800);assert.equal(trips,1);});
test('Retired WebGL guard removes listeners and cannot count restored old context',()=>{const f=fixture(),s=read('rocketcdn/assets/rc-gl.js');vm.runInContext(s.slice(0,s.indexOf('/* ── Подгрузка'))+'})(window);',f.c);const ls=new Map();const cv={style:{},addEventListener:(k,fn)=>ls.set(k,fn),removeEventListener:(k,fn)=>{if(ls.get(k)===fn)ls.delete(k);}};const gl=f.c.RC_GL;assert.equal(gl.take(true),true);gl.guard(cv,()=>{},()=>{});const oldBack=ls.get('webglcontextrestored');ls.get('webglcontextlost')({preventDefault:()=>{}});assert.equal(gl.stats().used,0);gl.drop(cv);oldBack();assert.equal(gl.stats().used,0);assert.equal(ls.size,0);assert.equal(gl.stats().scenes,0);});
test('Flight explicit launch query is consumed once and retains other URL parts',()=>{const f=fixture(),s=read('rocketcdn/assets/rc-flight.js');let opens=0;Object.assign(f.c,{g:f.c,URLSearchParams,open:()=>opens++,location:{search:'?from=vpn&flight=1',pathname:'/',hash:'#x'},history:{state:{},replaceState(_s,_t,url){const u=new URL(url,'https://example.test');f.c.location.search=u.search;assert.equal(url,'/?from=vpn#x');}}});vm.runInContext(between(s,'function launchIntent()','function ready()'),f.c);f.c.launchIntent();f.c.launchIntent();assert.equal(opens,1);});
test('Mini-game is updated by final panel, pauses when hidden and resumes on reopen',()=>{const f=fixture();f.c.document.body={};f.c.document.getElementById=()=>null;load('rocketvpn/assets/vendor/three.min.js',f.c);load('rocketvpn/assets/rv-игра.js',f.c);const T=f.c.THREE;const nest={hidden:false};f.c.document.getElementById=id=>id==='rvИграГнездо'?nest:null;Object.assign(f.c,{g:f.c,d:f.c.document,T,W:{T},М:{корень:new T.Group()},ЭКР_Y:1.62,ЭКР_ПЛОСКОСТЬ:-2.8});const s=read('rocketvpn/assets/rv-финал.js');vm.runInContext(between(s,'  function играНаПульте(','  function кадр('),f.c);f.c.играНаПульте(true,.016,1);assert.equal(f.c.RV_ИГРА.замер().живая,true);assert.equal(f.c.М.игра.parent,f.c.М.корень);assert.equal(f.c.М.игра.scale.x,.075);f.emit('pointerdown',{target:f.c.document.body});assert.equal(f.c.RV_ИГРА.замер().попаданий,1);nest.hidden=true;f.c.играНаПульте(true,.016,2);assert.equal(f.c.RV_ИГРА.замер().живая,false);f.emit('pointerdown',{target:f.c.document.body});assert.equal(f.c.RV_ИГРА.замер().попаданий,1);nest.hidden=false;f.c.играНаПульте(true,.016,3);assert.equal(f.c.RV_ИГРА.замер().живая,true);f.c.играНаПульте(false,.016,4);assert.equal(f.c.RV_ИГРА.замер().живая,false);});
test('Failed partial world build releases renderer and scene exactly once',()=>{const f=fixture(),s=read('rocketcdn/assets/rc-flight.js');let released=0,disposed=0,dropped=0;Object.assign(f.c,{g:f.c,W3:null,F:{glSlot:false,raf:null},ui:{cv:{}},cancelBuild:()=>{},убратьДерево:()=>released++,RC_GL:{give:()=>{},drop:()=>dropped++}});vm.runInContext(between(s,'function disposeFlightWorld()','function assembleWorld()'),f.c);f.c.assembleWorld=()=>{f.c.buildingWorld={scene:{},r:{dispose:()=>disposed++,forceContextLoss:()=>{}}};f.c.F.glSlot=true;throw new Error('allocation failed');};assert.throws(()=>f.c.buildWorld(),/allocation failed/);assert.equal(released,1);assert.equal(disposed,1);assert.equal(f.c.W3,null);assert.equal(f.c.F.glSlot,false);});
test('Cabin assembly settles onto real transformed surfaces and reverses without changing shared materials',()=>{
 const f=fixture();load('rocketvpn/assets/vendor/three.min.js',f.c);load('rocketvpn/assets/rv-assembly.js',f.c);const T=f.c.THREE;
 const scene=new T.Scene(), parent=new T.Group(), room=new T.Group();parent.position.set(0,21,-4);parent.scale.setScalar(.377);scene.add(parent);parent.add(room);
 const shared=new T.MeshStandardMaterial({color:0x445566});const wall=new T.Mesh(new T.BoxGeometry(4,3,.2),shared);wall.position.set(0,1.5,-3);room.add(wall);
 const assembly=f.c.RV_ASSEMBLY.build(T,room,parent,{tier:0});assert.equal(assembly.count,6000);assert.notEqual(wall.material,shared);
 const target=assembly.field.geometry.attributes.position;for(let i=0;i<target.count;i++){assert.ok(Math.abs(target.getX(i))<=2.001);assert.ok(target.getZ(i)>=-3.101&&target.getZ(i)<=-2.899);}
 assembly.update(0,900);assert.equal(wall.visible,false);assembly.update(.5,900);assert.ok(wall.material.opacity>0&&wall.material.opacity<1);assert.equal(assembly.field.visible,true);
 assembly.update(1,900);assert.equal(wall.material.opacity,1);assert.equal(wall.material.transparent,false);assert.equal(assembly.field.visible,false);
 assembly.update(.5,900);assert.equal(wall.material.transparent,true);assert.equal(shared.transparent,false);assert.equal(shared.opacity,1);
 assembly.dispose();assert.equal(assembly.field.parent,null);
 assert.equal(wall.material,shared);assert.equal(wall.visible,true);
});
test('Assembly excludes hidden and distant-space branches and unused draw ranges, and disposes owned resources once',()=>{
 const f=fixture();load('rocketvpn/assets/vendor/three.min.js',f.c);load('rocketvpn/assets/rv-assembly.js',f.c);const T=f.c.THREE;
 const parent=new T.Group(),room=new T.Group(),hidden=new T.Group();parent.add(room);room.add(hidden);hidden.visible=false;
 const shared=new T.MeshStandardMaterial();const ghost=new T.Mesh(new T.BoxGeometry(500,500,500),shared);hidden.add(ghost);
 const space=new T.Group();space.userData.assemblyIgnore=true;room.add(space);const planet=new T.Mesh(new T.SphereGeometry(100),shared);space.add(planet);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,100,100,100,101,100,100,100,101,100],3));geo.setDrawRange(0,3);
 const visible=new T.Mesh(geo,shared);room.add(visible);const a=f.c.RV_ASSEMBLY.build(T,room,parent,{tier:0});
 const p=a.field.geometry.attributes.position;for(let i=0;i<p.count;i++){assert.equal(p.getZ(i),0);assert.ok(p.getX(i)>=0&&p.getY(i)>=0&&p.getX(i)+p.getY(i)<=1.00001);}
 assert.equal(ghost.material,shared);assert.equal(planet.material,shared);let count=0;[visible.material,a.field.material,a.field.geometry].forEach(x=>x.addEventListener('dispose',()=>count++));
 a.update(.5);a.dispose();a.dispose();a.update(0);assert.equal(count,3);assert.equal(visible.material,shared);assert.equal(visible.visible,true);assert.equal(hidden.visible,false);
});
test('VPN rendering respects pixel and texture limits while keeping phone detail',()=>{
 const f=fixture(),s=read('rocketvpn/assets/rv-world.js');Object.assign(f.c,{g:f.c,W:{ступень:2,плотность:2.6,r:{capabilities:{maxTextureSize:8192}}},мсш:{знач:1}});
 vm.runInContext(between(s,'  function плотностьСейчас()','  /*'),f.c);
 for(const [width,height] of [[3840,2160],[7680,4320],[16000,9000]]){f.c.innerWidth=width;f.c.innerHeight=height;const p=f.c.плотностьСейчас();assert.ok(width*height*p*p<=8300000.001);assert.ok(Math.max(width,height)*p<=8192);f.c.мсш.знач=.6;assert.ok(Math.abs(f.c.плотностьСейчас()/p-.6)<1e-9);f.c.мсш.знач=1;}
 f.c.innerWidth=390;f.c.innerHeight=844;assert.equal(f.c.плотностьСейчас(),2.6);
});
test('VPN adaptive rendering reduces sustained overload and can recover on a 60 Hz screen',()=>{
 const f=fixture(),s=read('rocketvpn/assets/rv-world.js');Object.assign(f.c,{W:{r:{}},мсш:{знач:1,сумма:0,счёт:0,окно:0,старт:0,развороты:0},зажать:(v,a,b)=>Math.max(a,Math.min(b,v)),применитьПлотность:()=>{}});
 vm.runInContext(between(s,'  function подобратьПлотность(','  var ждём ='),f.c);let ts=1;
 for(let i=0;i<720;i++){ts+=1000/24;f.c.подобратьПлотность(1/24,ts);}assert.equal(f.c.мсш.знач,.6);
 for(let i=0;i<2400;i++){ts+=1000/60;f.c.подобратьПлотность(1/60,ts);}assert.ok(f.c.мсш.знач>=.95);assert.notEqual(f.c.мсш.стоп,true);
});
test('VPN graphics failure exposes the full document and stops the render state',()=>{
 const f=fixture(),s=read('rocketvpn/assets/rv-world.js');let hidden=0,reflow=0;Object.assign(f.c,{g:f.c,d:f.c.document,W:{готов:true},закончитьВступление:()=>{},RV_ФИНАЛ:{видно:()=>hidden++},RV_MOTION:{обновить:()=>reflow++}});
 const c=f.c.document.documentElement.classList;['рв-слова-в-сцене','рв-финал-пульт','рв-кабина-есть','рв-живая-рубка'].forEach(x=>c.add(x));
 vm.runInContext(between(s,'  function запаснойРежим()','  function поднять()'),f.c);f.c.запаснойРежим();assert.equal(f.c.W.готов,false);assert.equal(c.contains('rv-no-webgl'),true);assert.equal(c.contains('рв-слова-в-сцене'),false);assert.equal(hidden,1);assert.equal(reflow,1);
});
function introFixture(){
 const f=fixture(),s=read('rocketvpn/assets/rv-world.js');
 Object.assign(f.c,{g:f.c,d:f.c.document,W:{готов:true},вступВсё:false,вступл:null,вступСпешка:false,вступТ:0,
 fire:name=>f.emit(name),зажать:(x,a,b)=>Math.max(a,Math.min(b,x)),безье:x=>x});
 const start=s.includes('  function закончитьВступление()')?'  function закончитьВступление()':'  function весВступления(dt)';
 vm.runInContext(between(s,start,'  /* Место на ленте ->'),f.c);
 vm.runInContext(between(s,'  function запаснойРежим()','  function поднять()'),f.c);
 return f;
}
test('VPN graphics failure releases wheel, touch and keyboard input immediately',()=>{
 const f=introFixture();f.c.document.documentElement.classList.add('рв-вступление');f.c.запаснойРежим();
 let blocked=0;for(const type of ['wheel','touchmove','keydown'])f.emit(type,{key:'PageDown',preventDefault:()=>blocked++});
 assert.equal(blocked,0);assert.equal(f.c.document.documentElement.classList.contains('рв-замок'),false);
 assert.equal(f.c.document.documentElement.classList.contains('рв-вступление'),false);
});
test('VPN intro watchdog releases event handlers as well as CSS lock',()=>{
 for(const started of [false,true]){const f=introFixture();if(started)f.c.вступл={время:5.5};f.time.tick(started?30001:8001);
  let blocked=0;f.emit('wheel',{preventDefault:()=>blocked++});assert.equal(blocked,0);assert.equal(f.c.вступВсё,true);}
});
test('VPN queued resize cannot revive a retired renderer',()=>{
 const f=fixture(),s=read('rocketvpn/assets/rv-world.js');let resized=0;
 Object.assign(f.c,{g:f.c,W:{готов:true},применитьПлотность:()=>resized++});
 vm.runInContext(between(s,'  var ждём = 0;','  /* ── Кадр'),f.c);f.c.поРазмеру();f.c.W.готов=false;
 assert.doesNotThrow(()=>f.time.tick());assert.equal(resized,0);
});
test('A late font atlas cannot hide readable text after graphics failure',()=>{
 const f=fixture(),s=read('rocketvpn/assets/rv-слово3d.js');let done;Object.assign(f.c,{g:f.c,d:f.c.document,W:{готов:false},RV_MSDF:{готов:fn=>done=fn},собрать:()=>assert.fail('No retired 3D text build')});
 const begin=s.indexOf('    g.RV_MSDF["готов"](function () {'),end=s.indexOf('\n    });',begin)+7;vm.runInContext(s.slice(begin,end),f.c);
 f.c.document.documentElement.classList.add('rv-no-webgl');done();assert.equal(f.c.document.documentElement.classList.contains('рв-слова-в-сцене'),false);
});
test('Final game preserves navigation without WebGL and returns keyboard focus after closing',()=>{
 const f=fixture(),nest={hidden:true},faq={hidden:false};let focus=0;
 f.c.document.getElementById=id=>id==='rvИграГнездо'?nest:null;f.c.document.querySelector=s=>s==='[data-к-игре]'?{focus:()=>focus++}:faq;
 f.c.RV_WORLD={готов:()=>false,тихо:()=>false};load('rocketvpn/assets/rv-панель-кнопки.js',f.c);assert.equal(f.c.RV_ПАНЕЛЬ_КНОПКИ.игра(true),false);assert.equal(nest.hidden,true);
 f.c.RV_WORLD.готов=()=>true;assert.equal(f.c.RV_ПАНЕЛЬ_КНОПКИ.игра(true),true);assert.equal(faq.hidden,true);f.c.RV_ПАНЕЛЬ_КНОПКИ.игра(false);assert.equal(faq.hidden,false);assert.equal(focus,1);
});
test('Modal Tab navigation wraps in both directions and skips disabled controls',()=>{
 const f=fixture(),s=read('rocketvpn/assets/rv-меню.js');Object.assign(f.c,{d:f.c.document});let selected='';
 const make=(name,disabled=false)=>({disabled,tabIndex:0,getClientRects:()=>[1],focus:()=>selected=name});const first=make('first'),disabled=make('disabled',true),last=make('last');
 const modal={querySelectorAll:()=>[first,disabled,last],contains:x=>[first,disabled,last].includes(x)};vm.runInContext(between(s,'  function удержатьФокус(','  function открыть()'),f.c);
 let prevented=0;f.c.document.activeElement=last;f.c.удержатьФокус({shiftKey:false,preventDefault:()=>prevented++},modal);assert.equal(selected,'first');
 f.c.document.activeElement=first;f.c.удержатьФокус({shiftKey:true,preventDefault:()=>prevented++},modal);assert.equal(selected,'last');assert.equal(prevented,2);
});
function formRequest(){
 const f=fixture(),s=read('rocketvpn/assets/rv-меню.js');Object.assign(f.c,{g:f.c,d:f.c.document,API:'/api',location:{pathname:'/'}});let requests=0,message='';
 const button={disabled:false,textContent:'Отправить'},input=value=>({value,focus:()=>{}}),form={name:input('Test'),contact:input('test@example.invalid'),task:input('Keep this text'),website:input(''),consent:{checked:true},querySelector:()=>button,closest:()=>null};
 f.c.беда=(_f,m)=>message=m;f.c.fetch=()=>{requests++;return new Promise(r=>f.resolve=r);};vm.runInContext(between(s,'  function формаСлать(','  function старт()'),f.c);
 return Object.assign(f,{form,button,event:{preventDefault:()=>{},target:form},requests:()=>requests,message:()=>message});
}
test('Form blocks repeated submit, releases a timed-out request and preserves typed text',async()=>{
 const f=formRequest();f.c.формаСлать(f.event);f.c.формаСлать(f.event);assert.equal(f.requests(),1);assert.equal(f.button.disabled,true);
 f.time.tick(15001);await settle();assert.equal(f.button.disabled,false);assert.match(f.message(),/Подтверждение не получено/);assert.equal(f.form.task.value,'Keep this text');
 f.resolve({ok:true,json:async()=>({ok:true})});await settle();assert.equal(f.form.innerHTML,undefined);
});
test('Form cannot claim success from a failed HTTP response',async()=>{
 const f=formRequest();f.c.формаСлать(f.event);f.resolve({ok:false,json:async()=>({ok:true})});await settle();assert.equal(f.form.innerHTML,undefined);assert.equal(f.button.disabled,false);
});
test('Manual thrust moves the ship outside the home spline and respects planetary clearance',()=>{
 const f=fixture();load('rocketvpn/assets/vendor/three.min.js',f.c);const T=f.c.THREE,s=read('rocketcdn/assets/rc-flight.js');vm.runInContext(between(s,'function advanceAway(','function frame(ts)'),f.c);
 const w={cam:new T.PerspectiveCamera(),tmpA:new T.Vector3(),tmpB:new T.Vector3()},state={v:.2};w.cam.position.set(0,0,300);w.cam.lookAt(0,0,0);
 f.c.advanceAway(w,state,null,.05,T);assert.ok(w.cam.position.z<300);assert.ok(state.warpV>0);
 const planet=new T.Group();const pack={root:new T.Group(),'тур':[{'узел':planet,r:60}]};pack.root.add(planet);w.cam.position.set(0,0,90);f.c.advanceAway(w,state,pack,.05,T);assert.ok(w.cam.position.length()>=81.19);
});
test('Removed 3D text leaves animation and deferred font queues and cannot rebuild later',()=>{
 const f=fixture();load('rocketvpn/assets/vendor/three.min.js',f.c);const T=f.c.THREE;Object.assign(f.c,{T,Ш:null,Т:null,ждут:[],ВСЕ:[],живые:[],новыйМатериал:()=>new T.MeshBasicMaterial()});
 vm.runInContext(between(read('rocketvpn/assets/rv-msdf.js'),'  function строка(','  function новыйМатериал('),f.c);
 const text=f.c.строка('TEST',{}),pending=f.c.ждут[0];let disposed=0;text.geometry.addEventListener('dispose',()=>disposed++);text.material.addEventListener('dispose',()=>disposed++);f.c.живые.push(text);
 text.userData.rvRelease();text.userData.rvRelease();pending();assert.equal(disposed,2);assert.equal(f.c.ВСЕ.length,0);assert.equal(f.c.ждут.length,0);assert.equal(f.c.живые.length,0);
});
test('CDN cabin and flight honor pixel and GPU limits at 8K, then restore phone detail',()=>{
 const f=fixture(),s=read('rocketcdn/assets/rc-flight.js');Object.assign(f.c,{g:f.c,tiny:false,devicePixelRatio:2});
 vm.runInContext(between(s,'function renderRatio(','function плотность('),f.c);
 const renderer={capabilities:{maxTextureSize:4096}};
 for(const [w,h] of [[7680,4320],[3840,2160],[320,240]]){f.c.innerWidth=w;f.c.innerHeight=h;const ratio=f.c.renderRatio(2,renderer);
  assert.ok(w*h*ratio*ratio<=5500001);assert.ok(w*ratio<=4096);assert.ok(h*ratio<=4096);}
 f.c.innerWidth=390;f.c.innerHeight=844;assert.equal(f.c.renderRatio(2,renderer),2);
});
test('Failed particle allocation restores the actual cabin materials',()=>{
 const f=fixture();load('rocketvpn/assets/vendor/three.min.js',f.c);load('rocketvpn/assets/rv-assembly.js',f.c);const T=f.c.THREE;
 const room=new T.Group(),parent=new T.Group(),material=new T.MeshStandardMaterial(),wall=new T.Mesh(new T.BoxGeometry(),material);room.add(wall);parent.add(room);
 const broken=Object.assign({},T,{ShaderMaterial:function(){throw new Error('allocation failure');}});
 assert.throws(()=>f.c.RV_ASSEMBLY.build(broken,room,parent,{tier:0}),/allocation failure/);
 assert.equal(wall.material,material);assert.equal(wall.visible,true);assert.equal(parent.children.length,1);
});
function adminLoadFixture(){
 const f=fixture(),pending=[],status={textContent:''};Object.assign(f.c,{$:()=>status,состояние:{дней:7,обзор:{old:true},заявки:[],по:{}},
 зов:(action,body)=>new Promise(resolve=>pending.push({action,body,resolve})),нарисовать:()=>{},операции:()=>{}});
 vm.runInContext('var загрузкаЗапрос=0;'+between(read('rocketcdn/admin.html'),'function загрузить()','function нарисовать()'),f.c);
 return {...f,pending,status};
}
test('Admin period switching ignores old responses and rejects a partial refresh',async()=>{
 const f=adminLoadFixture(),a=f.c.загрузить();f.c.состояние.дней=30;const b=f.c.загрузить();
 for(const job of f.pending.slice(5))job.resolve({ok:true,days:30,items:[]});assert.equal(await b,true);
 for(const job of f.pending.slice(0,5))job.resolve({ok:true,days:7,items:[]});assert.equal(await a,false);assert.equal(f.c.состояние.обзор.days,30);
 const c=f.c.загрузить();f.pending.slice(10).forEach((job,i)=>job.resolve(i?{ok:true,days:90}:{ok:false}));
 assert.equal(await c,false);assert.equal(f.c.состояние.обзор.days,30);assert.match(f.status.textContent,/не удалось/);
});
test('Admin request timeout releases the caller and an ambiguous write is not retried',async()=>{
 const f=fixture();let calls=0;Object.assign(f.c,{API:'/api.php',СВОИ:['/api.php','https://rocketcdn.ru/api.php'],искали:false,состояние:{},fetch:()=>{calls++;return new Promise(()=>{});}});
 vm.runInContext(between(read('rocketcdn/admin.html'),'function послать(','/* ── Мелочи'),f.c);
 const pending=f.c.зов('content_save',{content:{}});f.time.tick(15001);await settle();assert.equal((await pending).ok,false);assert.equal(calls,1);
});
test('Admin mobile drawer releases the page on close and after desktop resize',()=>{
 const f=fixture(),nodes={};for(const id of ['#бургер','#бок','#полотно'])nodes[id]={inert:false,setAttribute:()=>{},focus:()=>{}};
 Object.assign(f.c,{$:s=>nodes[s]||null,innerWidth:320});f.c.document.body={classList:classes()};
 vm.runInContext(between(read('rocketcdn/admin.html'),'function обновитьМеню()','/* ── Запуск'),f.c);
 f.c.обновитьМеню();assert.equal(nodes['#бок'].inert,true);assert.equal(nodes['#полотно'].inert,false);
 f.c.открытьМеню();assert.equal(nodes['#бок'].inert,false);assert.equal(nodes['#полотно'].inert,true);
 f.c.закрытьМеню();assert.equal(nodes['#полотно'].inert,false);
 f.c.открытьМеню();f.c.innerWidth=1440;f.c.обновитьМеню();assert.equal(nodes['#полотно'].inert,false);assert.equal(nodes['#бок'].inert,false);
});
test('Admin ignores unknown hash sections without building a selector from them',()=>{
 const f=fixture();Object.assign(f.c,{$$:()=>[{dataset:{р:'дашборд'}}],$:()=>assert.fail('Untrusted hash cannot become a selector'),состояние:{раздел:'дашборд'}});
 vm.runInContext(between(read('rocketcdn/admin.html'),'function кРазделу(','function обновитьМеню()'),f.c);
 assert.doesNotThrow(()=>f.c.кРазделу('"]{'));assert.equal(f.c.состояние.раздел,'дашборд');
});
test('Flight checks the full movement segment against planetary clearance',()=>{
 const f=fixture();load('rocketvpn/assets/vendor/three.min.js',f.c);const T=f.c.THREE;
 vm.runInContext(between(read('rocketcdn/assets/rc-flight.js'),'function advanceAway(','function frame('),f.c);
 const planet=new T.Group(),root=new T.Group();root.add(planet);const pack={root,'тур':[{'узел':planet,r:60}]};
 const w={cam:new T.PerspectiveCamera(),tmpA:new T.Vector3(),tmpB:new T.Vector3()};w.cam.position.set(80,0,13.5);const state={v:.3};
 f.c.advanceAway(w,state,pack,.05,T);assert.ok(w.cam.position.z>0,'must stop at the first boundary, not cross the chord');assert.ok(w.cam.position.length()>=81.2-1e-6);
});
