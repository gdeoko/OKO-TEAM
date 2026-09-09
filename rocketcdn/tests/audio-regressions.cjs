'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=process.env.ROCKET_SOURCE_ROOT||path.resolve(__dirname,'../..');
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function target(){
 const handlers=new Map();return {handlers,
 addEventListener(type,fn){if(!handlers.has(type))handlers.set(type,new Set());handlers.get(type).add(fn);},
 removeEventListener(type,fn){handlers.get(type)?.delete(fn);},
 emit(type,detail={}){for(const fn of [...(handlers.get(type)||[])])fn({type,target:this,...detail});}
 };
}
function fixture(){
 const events=target(),document=target(),values=new Map(),audio=[],buttons=[],tasks=new Map();let time=0,seq=0;
 const set=(fn,ms=0)=>{tasks.set(++seq,{fn,at:time+ms});return seq;};
 const cls=()=>{const set=new Set();return {add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x),toggle(x,on){on?set.add(x):set.delete(x);}};};
 function element(tag){const el=Object.assign(target(),{tagName:tag.toUpperCase(),style:{},children:[],attrs:{},classList:cls(),paused:true,volume:0,loads:0,plays:[],currentTime:0,
  setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},
  appendChild(child){this.children.push(child);child.parent=this;},
  contains(child){return child===this||this.children.some(x=>x.contains?.(child));},
  closest(selector){return this.className==='rv-звук'&&selector.includes('rv-звук')?this:null;},
  play(){const p=deferred();this.plays.push(p);this.paused=false;return p.promise;},pause(){this.paused=true;},load(){this.loads++;},canPlayType(){return 'probably';}
 });if(tag==='audio')audio.push(el);if(tag==='button')buttons.push(el);return el;}
 Object.assign(document,{readyState:'complete',hidden:false,body:element('body'),documentElement:{classList:cls(),style:{setProperty(){}},scrollHeight:2000},
  createElement:element,querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,getElementsByTagName:()=>[]});
 const node=()=>({gain:{value:0,setTargetAtTime(v){this.value=v;},cancelScheduledValues(){},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;}},
  threshold:{},knee:{},ratio:{},attack:{},release:{},frequency:{},connect(){},disconnect(){}});
 const resumes=[];let context;
 class AudioContext{constructor(){context=this;this.state='suspended';this.currentTime=0;this.destination={};}
  resume(){const p=deferred();resumes.push(p);return p.promise;}createGain(){return node();}createDynamicsCompressor(){return node();}createBiquadFilter(){return node();}createMediaElementSource(){return node();}
  decodeAudioData(){return new Promise(()=>{});}}
 const c=vm.createContext({console,Math,Date,Float32Array,Uint8Array,Promise,AudioContext,document,innerHeight:800,innerWidth:1280,scrollY:0,
  setTimeout:set,clearTimeout:id=>tasks.delete(id),setInterval:()=>++seq,clearInterval(){},requestAnimationFrame:fn=>set(()=>fn(time),16),cancelAnimationFrame:id=>tasks.delete(id),
  performance:{now:()=>time},fetch:()=>new Promise(()=>{}),localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},
  CustomEvent:class{constructor(type,args){this.type=type;this.detail=args.detail;}},
  addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),dispatchEvent:e=>events.emit(e.type,e)});
 c.window=c;
 const f={c,document,events,values,audio,buttons,resumes,node,get ctx(){return context;},
  load(file){vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});},
  advance(ms){const end=time+ms;for(let i=0;i<10000;i++){const next=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;tasks.delete(next[0]);time=next[1].at;next[1].fn();}time=end;},
  finishPlay(index=0,request=0){const a=audio[index];a.paused=false;a.plays[request].resolve();}
 };
 return f;
}
function cdn(){const f=fixture();f.load('rocketcdn/assets/rc-sound.js');const s=f.c.RC_SOUND;s.ready=true;s.ctx=new f.c.AudioContext();s.master=f.node();s.space=()=>{};s.loop=()=>{};f.load('rocketcdn/assets/rc-music.js');return f;}
function music(){const f=fixture();f.load('rocketcdn/assets/rc-music.js');return f;}
test('CDN starts the media element inside the gesture before Web Audio resume resolves',()=>{const f=cdn();f.c.RC_SOUND.start();assert.equal(f.audio.length,1);assert.equal(f.audio[0].plays.length,1);});
test('CDN cancelling a pending start survives its late resume',async()=>{const f=cdn();f.c.RC_SOUND.start();f.c.RC_SOUND.stop();f.ctx.state='running';f.resumes[0].resolve();await flush();assert.equal(f.c.RC_SOUND.on,false);assert.equal(f.values.get('rcdn.sound'),'off');});
test('CDN second toggle cancels a pending start',async()=>{const f=cdn();f.c.RC_SOUND.toggle();f.c.RC_SOUND.toggle();f.ctx.state='running';for(const r of f.resumes)r.resolve();await flush();assert.equal(f.c.RC_SOUND.on,false);});
test('CDN sound button can start music without Web Audio',()=>{const f=cdn();f.c.RC_SOUND.ready=false;f.c.RC_SOUND.build=()=>false;f.c.RC_SOUND.toggle();assert.equal(f.audio.length,1);assert.equal(f.audio[0].plays.length,1);});
test('CDN music reports playing only after playback has started',async()=>{const f=music();f.c.RC_MUSIC.on();assert.equal(f.c.RC_MUSIC.playing(),false);f.finishPlay();await flush();assert.equal(f.c.RC_MUSIC.playing(),true);});
test('CDN late media start cannot undo mute',async()=>{const f=music();f.c.RC_MUSIC.on();f.c.RC_MUSIC.off();f.finishPlay();await flush();assert.equal(f.audio[0].paused,true);assert.equal(f.c.RC_MUSIC.playing(),false);});
test('CDN old playback rejection cannot stop a newer successful request',async()=>{const f=music();f.c.RC_MUSIC.on();f.c.RC_MUSIC.off();f.c.RC_MUSIC.on();f.finishPlay(0,1);await flush();f.audio[0].plays[0].reject(new Error('old request'));await flush();assert.equal(f.c.RC_MUSIC.playing(),true);});
test('CDN keeps the alternative format after one source fails',async()=>{const f=music();f.c.RC_MUSIC.on();const a=f.audio[0];a.emit('error',{target:a.children[0]});assert.equal(f.c.RC_MUSIC.state().сломан,false);f.finishPlay();await flush();assert.equal(f.c.RC_MUSIC.playing(),true);});
test('CDN retries on the next gesture after returning to a tab is denied',async()=>{const f=music();f.c.RC_MUSIC.on();f.finishPlay();await flush();f.document.hidden=true;f.document.emit('visibilitychange');f.document.hidden=false;f.document.emit('visibilitychange');f.audio[0].plays[1].reject(new Error('NotAllowedError'));await flush();f.events.emit('pointerup');assert.equal(f.audio[0].plays.length,3);});
test('CDN touch release retries an unresolved attempt from touch start',()=>{const f=cdn();f.events.emit('touchstart');f.events.emit('touchend');assert.equal(f.resumes.length,2);});
test('VPN first sound-button click is not reversed by its document gesture listener',()=>{const f=fixture();f.load('rocketvpn/assets/rv-sound.js');const button=f.buttons[0];f.document.emit('pointerdown',{target:button});button.emit('click');f.document.emit('click',{target:button});assert.equal(f.c.RV_SOUND.идёт(),true);assert.equal(f.resumes.length,1);});
test('VPN mute cannot be reversed by a still-pending first-gesture listener',()=>{const f=fixture();f.load('rocketvpn/assets/rv-sound.js');f.document.emit('wheel');f.c.RV_SOUND.включить(false);f.document.emit('touchend');assert.equal(f.c.RV_SOUND.идёт(),false);assert.equal(f.values.get('rv.звук'),'0');});
test('VPN switching sound off does not resume its audio context',()=>{const f=fixture();f.load('rocketvpn/assets/rv-sound.js');f.c.RV_SOUND.включить(true);const n=f.resumes.length;f.c.RV_SOUND.включить(false);assert.equal(f.resumes.length,n);});
test('CDN explicit mute prevents first-gesture audio requests',()=>{const f=cdn();f.values.set('rcdn.sound','off');f.events.emit('touchstart');f.events.emit('touchend');assert.equal(f.audio.length,0);assert.equal(f.resumes.length,0);});
test('CDN exhausted sources stop pending playback and an explicit retry can recover',async()=>{const f=music();f.c.RC_MUSIC.on();const a=f.audio[0];for(const child of a.children)a.emit('error',{target:child});assert.equal(f.c.RC_MUSIC.state().сломан,true);assert.equal(a.paused,true);f.c.RC_MUSIC.on();assert.equal(a.loads,1);f.finishPlay(0,1);await flush();assert.equal(f.c.RC_MUSIC.playing(),true);});
test('CDN pending media resolution stays paused on a hidden tab',async()=>{const f=music();f.c.RC_MUSIC.on();f.document.hidden=true;f.document.emit('visibilitychange');f.finishPlay();await flush();assert.equal(f.audio[0].paused,true);f.document.hidden=false;f.document.emit('visibilitychange');f.finishPlay(0,1);await flush();assert.equal(f.c.RC_MUSIC.playing(),true);});
test('CDN media success still allows the next gesture to unlock pending effects',async()=>{const f=cdn();f.events.emit('wheel');f.finishPlay();await flush();f.events.emit('pointerup');assert.equal(f.resumes.length,2);});
test('VPN mute remains final when storage is unavailable',()=>{const f=fixture();f.c.localStorage.getItem=()=>{throw Error('storage unavailable');};f.c.localStorage.setItem=()=>{throw Error('storage unavailable');};f.load('rocketvpn/assets/rv-sound.js');f.document.emit('wheel');f.c.RV_SOUND.включить(false);f.document.emit('touchend');assert.equal(f.c.RV_SOUND.идёт(),false);});
