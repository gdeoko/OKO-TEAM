/* Native WebGL world inspection, not a browser or device FPS benchmark.
   Real scene and scroll modules; section geometry is a fixed fixture from frame.html.
   Excludes HTML overlays, audio and browser-specific rendering/layout. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {createCanvas, Image, GlobalFonts} = require('@napi-rs/canvas');
const geometryOnly = process.env.ROCKET_GEOMETRY_ONLY === '1';
const createGL = geometryOnly ? null : require('gl');
const source = path.resolve(process.argv[2] || '../source/rocketvpn');
const out = path.resolve(process.argv[3] || './frames');
const width = Number(process.argv[4] || 1280), height = Number(process.argv[5] || 800);
const selected = process.argv[6] || "all";
fs.mkdirSync(out, {recursive:true});
const pending = [], jobs = [], warnings = [], attributes = new Map(), classes = new Set();
const log = {log:console.log, warn:(...x)=>warnings.push(x.join(' ')), error:(...x)=>warnings.push(x.join(' '))};
const document = {
  documentElement:{getAttribute:k=>attributes.get(k),setAttribute:(k,v)=>attributes.set(k,v),
    classList:{contains:k=>classes.has(k),add:k=>classes.add(k),remove:k=>classes.delete(k),
      toggle(k,on){on?classes.add(k):classes.delete(k);}},style:{setProperty(){}}},
  createElement(tag){if(tag==='canvas')return createCanvas(1,1);throw Error('Unsupported native element '+tag);},
  createElementNS(_ns,tag){return this.createElement(tag);},
  getElementById(){return null;}, querySelector(){return null;}, querySelectorAll(){return [];},
  addEventListener(){}, fonts:{ready:Promise.resolve()}
};
class LocalImage extends Image {
  set src(value){super.src=fs.readFileSync(path.resolve(source,value.split('?')[0]));}
}
const context = vm.createContext({console:log,document,Image:LocalImage,HTMLImageElement:Image,
  HTMLCanvasElement:createCanvas(1,1).constructor,innerWidth:width,innerHeight:height,
  devicePixelRatio:1,navigator:{deviceMemory:8,hardwareConcurrency:8},location:{search:'',pathname:'/'},
  addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false}),
  requestIdleCallback:fn=>jobs.push(fn),setTimeout:fn=>jobs.push(fn),clearTimeout(){},
  requestAnimationFrame:fn=>jobs.push(fn),cancelAnimationFrame(){},performance,URL,Math,Date,
  // headless-gl validates typed arrays by constructor identity across VM realms.
  Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,
  Float32Array,Float64Array,ArrayBuffer,DataView});
context.window=context;
context.self=context;
const load = name => vm.runInContext(fs.readFileSync(path.join(source,'assets',name),'utf8'),context,{filename:name});
for(const name of ['golos-cyr.woff2','golos-lat.woff2']){
  GlobalFonts.registerFromPath(path.join(source,'assets/fonts',name),'Golos Text');
}
load('vendor/three.min.js');
const T = context.THREE;
const gl = geometryOnly ? null : createGL(width,height,{preserveDrawingBuffer:true,alpha:false,antialias:true});
if(!geometryOnly && !gl)throw Error('Native WebGL context unavailable');
const glErrors=[];
if(gl && process.env.ROCKET_GL_DEBUG==='1'){
  const getError=gl.getError.bind(gl), names=new Set();
  for(let p=gl;p;p=Object.getPrototypeOf(p))Object.getOwnPropertyNames(p).forEach(x=>names.add(x));
  for(const name of names){
    if(name==='getError'||name.startsWith('_')||typeof gl[name]!=='function')continue;
    const original=gl[name].bind(gl);
    gl[name]=function(...args){const result=original(...args),error=getError();
      if(error && glErrors.length<30)glErrors.push({name,error,args:args.map(x=>typeof x==='number'?x:typeof x)});
      return result;};
  }
}
if(gl){
const originalTexture = gl.texImage2D.bind(gl);
gl.texImage2D = function(...args){
  if(args.length===6 && args[5] && !ArrayBuffer.isView(args[5])){
    const image=args[5], c=image.getContext?image:createCanvas(image.width,image.height);
    if(c!==image)c.getContext('2d').drawImage(image,0,0);
    const bytes=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    return originalTexture(args[0],args[1],args[2],c.width,c.height,0,args[3],args[4],new Uint8Array(bytes));
  }
  return originalTexture(...args);
};
}
const canvas={width,height,style:{},addEventListener(){},removeEventListener(){},getContext:()=>gl};
if(gl)gl.canvas=canvas;
const renderer = geometryOnly ? {domElement:canvas,capabilities:{getMaxAnisotropy:()=>8},setSize(){},setClearColor(){}}
  : new T.WebGLRenderer({canvas,context:gl,antialias:true,alpha:false});
renderer.setSize(width,height,false); renderer.setClearColor(0x05070f,1);
renderer.outputColorSpace=T.SRGBColorSpace;
// Adapt only image IO. Texture bytes and source settings remain those of the site.
T.TextureLoader.prototype.load=function(url,onLoad,onProgress,onError){
  const texture=new T.Texture();
  const promise=new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{texture.image=image;texture.needsUpdate=true;if(onLoad)onLoad(texture);resolve();};
    image.onerror=e=>{if(onError)onError(e);reject(e);};
    image.src=fs.readFileSync(path.resolve(source,url.split('?')[0]));
  });
  pending.push(promise);return texture;
};

// Deterministic event loop and geometry fixture, independent of any browser.
const events=new Map(), devents=new Map(), raf=new Map(), timers=new Map();
let seq=0, now=0;
const on=(map,type,fn)=>{if(!map.has(type))map.set(type,new Set());map.get(type).add(fn);};
const eventErrors=[];
const emit=(map,type,e={})=>{for(const fn of map.get(type)||[])try{fn(e);}catch(error){eventErrors.push({type,error:String(error),stack:error.stack});}};
context.addEventListener=(type,fn)=>on(events,type,fn);
context.removeEventListener=(type,fn)=>events.get(type)?.delete(fn);
context.dispatchEvent=e=>{emit(events,e.type,e);return true;};
context.CustomEvent=class {constructor(type,o={}){this.type=type;this.detail=o.detail;}};
context.requestAnimationFrame=fn=>{raf.set(++seq,fn);return seq;};
context.cancelAnimationFrame=id=>raf.delete(id);
context.setTimeout=(fn,ms=0)=>{timers.set(++seq,{fn,at:now+ms});return seq;};
context.clearTimeout=id=>timers.delete(id);
context.requestIdleCallback=fn=>{jobs.push(fn);return ++seq;};
context.performance={now:()=>now};
context.scrollY=0;context.pageYOffset=0;
context.scrollTo=(x,y)=>{context.scrollY=typeof x==='object'?x.top:y;context.pageYOffset=context.scrollY;emit(events,'scroll');};
context.getComputedStyle=()=>({getPropertyValue:()=>'',paddingTop:'0px',paddingBottom:'0px'});
context.location={pathname:'/',search:'',hash:''};
context.sessionStorage={getItem:()=>null,setItem(){}};
document.readyState='loading';
document.addEventListener=(type,fn)=>on(devents,type,fn);
document.removeEventListener=(type,fn)=>devents.get(type)?.delete(fn);
document.documentElement.clientHeight=height;
document.documentElement.clientWidth=width;
document.documentElement.style.removeProperty=()=>{};
const frame=fs.readFileSync(path.join(source,'frame.html'),'utf8');
let top=0;
const sections=[...frame.matchAll(/<section[^>]*data-акт="([^"]+)"[^>]*height:(\d+)svh[^>]*>/g)].map(m=>{
 const attrs=new Map([...m[0].matchAll(/([\w-]+)="([^"]*)"/gu)].map(x=>[x[1],x[2]]));attrs.set('data-акт',m[1]);
 const start=top, size=Number(m[2])*height/100;top+=size;
 const set=new Set();return {name:m[1],start,size,offsetHeight:size,style:{setProperty(){},removeProperty(){}},
 classList:{add:k=>set.add(k),remove:k=>set.delete(k),contains:k=>set.has(k),toggle:(k,v)=>v?set.add(k):set.delete(k)},
 getBoundingClientRect:()=>({top:start-context.scrollY,bottom:start+size-context.scrollY,height:size,width,left:0,right:width}),
 getAttribute:k=>attrs.get(k)||null,setAttribute:(k,v)=>attrs.set(k,v),hasAttribute:k=>attrs.has(k),
 querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}};
});
if(sections.length!==6)throw Error('Unexpected scene fixture: '+sections.length);
document.documentElement.scrollHeight=top;
document.body={scrollHeight:top,style:{},classList:document.documentElement.classList};
document.getElementById=id=>id==='rvМир'?canvas:null;
document.querySelectorAll=q=>q.includes('.rv-акт')?sections:[];
document.querySelector=q=>{const match=q.match(/data-акт="([^"]+)"/);return match?sections.find(x=>x.name===match[1])||null:null;};
const originalRenderer=T.WebGLRenderer;
// Share the native context while preserving the site's renderer configuration.
T.WebGLRenderer=function(options){return new originalRenderer({...options,context:gl});};
renderer.dispose();
const skip=new Set(['rv-gate.js','rv-boot.js','vendor/three.min.js','rv-sound.js','rv-glb.js',
 'rv-msdf.js','rv-слово3d.js','rv-внутрь.js','rv-игра.js','rv-панель-кнопки.js','rv-титры.js','rv-слово.js',
 'rv-опознаватели.js','rv-data.js','rv-fill.js','rv-лист.js','rv-рейка.js','rv-link.js','rv-меню.js','rv-track.js']);
const modules=[...frame.matchAll(/<script src="assets\/([^"?]+)[^"]*"/g)].map(x=>x[1]).filter(x=>!skip.has(x));
for(const file of modules)load(file);
document.readyState='complete';emit(devents,'DOMContentLoaded');
const W=context.RV_WORLD.мир();
if(!W.готов)throw Error('World did not initialize');
for(const [object,key] of [[W.плёнка,'render'],[context.RV_ОРЕОЛ,'кадр']])if(object?.[key]){
 const call=object[key];object[key]=function(...args){try{return call.apply(this,args);}catch(e){console.error('PIPELINE',key,e);throw e;}};
}
async function idle(){
 for(let pass=0;pass<200;pass++){
  const n=jobs.length;for(let i=0;i<n;i++)jobs.shift()({timeRemaining:()=>100});
  if(pending.length)await Promise.all(pending.splice(0));
  await new Promise(resolve=>setImmediate(resolve));
  if(!jobs.length&&!pending.length)return;
 }throw Error('Preparation did not settle');
}
async function tick(render=true){
 now+=1000/60;
 for(const [id,x] of [...timers])if(x.at<=now&&timers.delete(id))x.fn();
 const old=W.r.render;if(!render)W.r.render=()=>{};
 for(const [id,fn] of [...raf])if(raf.delete(id))fn(now);
  W.r.render=old;
  if(!W.готов)throw Error('World entered fallback during native inspection');
 await idle();
}
function capture(label){
 gl.finish();const pixels=new Uint8Array(width*height*4);
 gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 const img=createCanvas(width,height),x=img.getContext('2d'),data=x.createImageData(width,height);
 for(let y=0;y<height;y++)data.data.set(pixels.subarray((height-y-1)*width*4,(height-y)*width*4),y*width*4);
 x.putImageData(data,0,0);const encoded=img.toBuffer('image/png');fs.writeFileSync(path.join(out,label+'.png'),encoded);
 const colors=new Set();for(let i=0;i<pixels.length;i+=4)colors.add((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]);
 return {label,camera:W.cam.position.toArray(),quaternion:W.cam.quaternion.toArray(),fov:W.cam.fov,
  distinctColors:colors.size,pngSha256:crypto.createHash('sha256').update(encoded).digest('hex'),
  progress:context.RV_MOTION.позиция(),acts:context.RV_WORLD.ход().видны,
  lastRenderPass:{...W.r.info.render},memory:{...W.r.info.memory},failures:context.RV_WORLD.срывы(),glError:gl.getError()};
}
async function main(){
 await idle();
 console.log('REGISTERED',Object.keys(W.акты),'EVENT_ERRORS',JSON.stringify(eventErrors));
 for(let i=0;i<380;i++)await tick(false); // Settle the actual intro at simulated 60 Hz.
 console.log('READY',JSON.stringify(context.RV_WORLD.срывы()));
 const shots=[],poses=[];
 for(const section of sections){
  if(selected!=='all'&&section.name!==selected)continue;
  for(const fraction of [.05,.5,.95])poses.push({section,fraction});
 }
 for(const direction of ['forward','reverse']){
  for(const p of direction==='forward'?poses:[...poses].reverse()){
   const target=p.section.start+(p.section.size-height)*p.fraction;
   context.scrollTo(0,target);
   for(let i=0;i<6000;i++){await tick(false);if(Math.abs(context.RV_MOTION.позиция()-target)<.02)break;if(i===5999)throw Error('Scroll did not settle');}
   for(let i=0;i<4;i++)await tick(false);
   await tick(true);
   const label=direction+'-'+sections.indexOf(p.section)+'-'+p.fraction;
   const shot=capture(label);shots.push(shot);console.log('FRAME',JSON.stringify(shot));
  }
 }
 const result={scope:'Native WebGL 1; real world/camera/scroll modules, fixed section geometry; no browser, DOM text, sound or physical-device FPS',
 source:path.basename(source),modules,sourceHashes:Object.fromEntries(modules.map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(source,'assets',name))).digest('hex')])),
 width,height,sections:sections.map(({name,start,size})=>({name,start,size})),shots,
 renderer:gl.getParameter(gl.RENDERER),glErrors,warnings,eventErrors,failures:context.RV_WORLD.срывы()};
 fs.writeFileSync(path.join(out,'world.json'),JSON.stringify(result,null,2));
 W.r.dispose();gl.getExtension('STACKGL_destroy_context').destroy();
 if(glErrors.length||eventErrors.length||warnings.some(x=>x.includes('Shader Error'))||shots.some(x=>x.distinctColors<16)||result.failures.работы||result.failures.акты)throw Error('Native world inspection failed; see world.json');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
