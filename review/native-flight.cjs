/* Native WebGL inspection of the CDN cabin and flight, not a browser or
   device FPS benchmark. Runs the original world and camera functions with
   fixed cabin-yaw/route checkpoints. Excludes HTML, CSS, audio and input. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {createCanvas: nativeCanvas, Image, GlobalFonts} = require('@napi-rs/canvas');
// CSS unicode-range chooses two subset fonts in the browser. Skia needs
// distinct fallback family names, otherwise Latin/digits become empty boxes.
function createCanvas(...args) {
 const c=nativeCanvas(...args), x=c.getContext('2d');let proto=x, font;
 while(proto&&!font){font=Object.getOwnPropertyDescriptor(proto,'font');proto=Object.getPrototypeOf(proto);}
 if(!font?.set)throw Error('Native font adapter unavailable');
 Object.defineProperty(x,'font',{get(){return font.get.call(this);},set(value){font.set.call(this,value.replaceAll("'Golos Text'","'Golos Native Latin', 'Golos Native Cyrillic'"));}});
 return c;
}
const geometryOnly = process.env.ROCKET_GEOMETRY_ONLY === '1';
const createGL = geometryOnly ? null : require('gl');
const source = path.resolve(process.argv[2] || '../source/rocketcdn');
const out = path.resolve(process.argv[3] || './frames');
const width = Number(process.argv[4] || 1280), height = Number(process.argv[5] || 800);
const selected = process.argv[6] || 'all';
fs.mkdirSync(out, {recursive:true});
const pending = [], jobs = [], warnings = [], attributes = new Map(), classes = new Set();
const log = {log:console.log, table:()=>{}, warn:(...x)=>warnings.push(x.join(' ')), error:(...x)=>warnings.push(x.join(' '))};
const document = {
  documentElement:{getAttribute:k=>attributes.get(k),setAttribute:(k,v)=>attributes.set(k,v),
    classList:{contains:k=>classes.has(k),add:k=>classes.add(k),remove:k=>classes.delete(k),
      toggle(k,on){on?classes.add(k):classes.delete(k);}},style:{setProperty(){}}},
  createElement(tag){if(tag==='canvas')return createCanvas(1,1);if(['style','details','summary','small','strong','span','ul','li','div'].includes(tag))return element();throw Error('Unsupported native element '+tag);},
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
  GlobalFonts.registerFromPath(path.join(source,'assets/fonts',name),name.includes('-lat.')?'Golos Native Latin':'Golos Native Cyrillic');
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


// Native IO adapter only. HTML overlays and browser layout are not rendered.
const events=new Map(), timers=new Map();let serial=0,now=0;
context.addEventListener=(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);};
context.removeEventListener=(name,fn)=>events.set(name,(events.get(name)||[]).filter(x=>x!==fn));
context.dispatchEvent=e=>{for(const fn of events.get(e.type)||[])fn(e);};
context.CustomEvent=class {constructor(type,options={}){this.type=type;this.detail=options.detail;}};
context.requestAnimationFrame=fn=>{if(fn!==context.__nativeFlight?.frame)jobs.push(fn);return ++serial;};context.cancelAnimationFrame=()=>{};
context.setTimeout=(fn,ms=0)=>{timers.set(++serial,{fn,at:now+ms});return serial;};
context.clearTimeout=id=>timers.delete(id);
context.setInterval=()=>++serial;context.clearInterval=()=>{};
context.performance={now:()=>now};context.location.search='?rcdbg=1';
context.localStorage=context.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};
document.readyState='loading';document.hidden=false;
document.body=element();document.head=element();
function element(){const set=new Set();return {children:[],isConnected:true,append(...nodes){this.children.push(...nodes);},appendChild(node){this.children.push(node);return node;},replaceChildren(...nodes){this.children=nodes;},style:{setProperty(){},removeProperty(){}},
 classList:{add:k=>set.add(k),remove:k=>set.delete(k),contains:k=>set.has(k),toggle:(k,v)=>v?set.add(k):set.delete(k)},
 querySelector:()=>null,querySelectorAll:()=>[],setAttribute(){},getAttribute:()=>null,
 addEventListener(){},removeEventListener(){},offsetWidth:width};}
context.nativeElement=element;context.nativeCanvas=canvas;
const Original=T.WebGLRenderer;
T.WebGLRenderer=function(options){return new Original({...options,context:gl});};
renderer.dispose();
const modules=['rc-real.js','rc-planets.js','gen/cab/meta.js','gen/cab/flat.js','gen/cab/deck.js',
 'rc-geo.js','rc-keys.js','rc-deck.js','rc-panel.js','rc-cabin.js'];
for(const file of modules)load(file);
const flightSource=fs.readFileSync(path.join(source,'assets/rc-flight.js'),'utf8');
const end=flightSource.lastIndexOf('})(window);');
if(end<0)throw Error('Flight closure changed');
// Expose private lifecycle functions for this local inspection without changing
// production files. Rendering, world construction and camera logic stay intact.
vm.runInContext(flightSource.slice(0,end)+`
g.__nativeFlight={
 build:function(){ui={cv:g.nativeCanvas,wrap:g.nativeElement(),cap:g.nativeElement(),bar:g.nativeElement(),speedAll:[]};
 W3=buildWorld();F.built=true;F.open=true;F.stageT=0;
 W3.r.setPixelRatio(1);W3.r.setSize(innerWidth,innerHeight,false);
 if(W3.post)W3.post.setSize(innerWidth,innerHeight);
 W3.cam.aspect=innerWidth/innerHeight;W3.cam.updateProjectionMatrix();
 cabinBuild();return W3;},
 state:F,world:function(){return W3;},frame:frame,
 stage:function(k,yaw){F.stage=true;F.stageK=k;F.stageT=0;
 g.RC_INTERIOR={yaw:function(){return yaw;},con:function(){return k;},enter:function(){return 1;},pitch:function(){return 0;}};},
 fly:function(p){F.stage=false;F.p=p;F.v=0;F.auto=false;F.goal=null;F.orbit=null;
 F.away=false;F.last=0;F.shake=0;cabinFlightMode();},
 cabin:function(){return cabin;},jump:jumpUniverse,dispose:disposeFlightWorld
};
`+flightSource.slice(end),context,{filename:'rc-flight.js'});
modules.push('rc-flight.js');const api=context.__nativeFlight;
const checkpoints=[];
async function settle(){
 for(let pass=0;pass<500;pass++){
  const count=jobs.length;for(let i=0;i<count;i++)jobs.shift()({timeRemaining:()=>100});
  for(const [id,job] of [...timers])if(job.at<=now&&timers.delete(id))job.fn();
  if(pending.length)await Promise.all(pending.splice(0));
  await new Promise(resolve=>setImmediate(resolve));
  if(!jobs.length&&!pending.length&&![...timers.values()].some(x=>x.at<=now))return;
 }throw Error('World preparation did not settle');
}
async function tick(draw){
 now+=1000/60;const w=api.world(),render=w.r.render;
 if(!draw)w.r.render=()=>{};
 try{api.frame(now);}finally{w.r.render=render;}
 await settle();
}
function capture(label){
 const w=api.world();gl.finish();const pixels=new Uint8Array(width*height*4);
 gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 const im=createCanvas(width,height),cx=im.getContext('2d'),data=cx.createImageData(width,height);
 for(let y=0;y<height;y++)data.data.set(pixels.subarray((height-y-1)*width*4,(height-y)*width*4),y*width*4);
 cx.putImageData(data,0,0);const png=im.toBuffer('image/png');fs.writeFileSync(path.join(out,label+'.png'),png);
 const colors=new Set();for(let i=0;i<pixels.length;i+=4)colors.add((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]);
 const invalid=[];w.scene.traverse(o=>{if([...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()].some(x=>!Number.isFinite(x)))invalid.push(o.name||o.type);});
 const cab=api.cabin();const row={label,cabin:{flat:!!cab?.console3?.flat,cameraInScene:w.cam.parent===w.scene},progress:api.state.p,camera:w.cam.position.toArray(),quaternion:w.cam.quaternion.toArray(),fov:w.cam.fov,
 distinctColors:colors.size,invalidTransforms:invalid,memory:{...w.r.info.memory},lastRenderPass:{...w.r.info.render},
 pngSha256:crypto.createHash('sha256').update(png).digest('hex'),glError:gl.getError()};
 checkpoints.push(row);console.log('FRAME',JSON.stringify({...row,glErrors:glErrors.length,shaderErrors:warnings.filter(x=>x.includes('Shader Error')).length}));
}
async function main(){
 const w=api.build();await settle();console.log('BUILT',JSON.stringify(w.at));
 if(selected==='all'||selected==='stage'){
  for(const [label,k,yaw] of [['front',0,0],...Array.from({length:7},(_,i)=>['panel-'+(i+1),0,(i+1)*Math.PI/4]),['console',1,Math.PI*2]]){
   api.stage(k,yaw);for(let i=0;i<4;i++)await tick(false);await tick(true);capture('stage-'+label);
  }
 }
 if(selected==='all'||selected==='flight'){
  for(const [label,p] of [['earth',0],...['moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','sun','hole'].map(name=>[name,w.at[name]]),['jump',(w.at.jump0+w.at.jump1)/2],['home',.99]]){
   api.fly(p);for(let i=0;i<120;i++)await tick(false);await tick(true);capture('flight-'+label);
  }
 }
 const oldCamera=w.cam;
 const fresh=api.build();await settle();api.fly(0);
 for(let i=0;i<30;i++)await tick(false);await tick(true);capture('flight-rebuilt');
 const lifecycle={cameraReplaced:fresh.cam!==oldCamera,cameraInNewScene:fresh.cam.parent===fresh.scene};
 if(!lifecycle.cameraReplaced||!lifecycle.cameraInNewScene)throw Error('Rebuilt camera did not join the new scene');
 const result={lifecycle,scope:'Native WebGL 1 with original CDN flight world and camera functions; local lifecycle instrumentation; no HTML/CSS/audio/input acceptance or device FPS',width,height,
 fixture:{content:'Cabin fallback records; page HTML content is not loaded',fontAdapter:'Shipped Latin/Cyrillic subsets, explicit native fallback',hud:'Canvas-only; the production DOM cockpit and controls are excluded'},modules,sourceHashes:Object.fromEntries(modules.map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(source,'assets',name))).digest('hex')])),
 checkpoints,warnings,glErrors,renderer:gl.getParameter(gl.RENDERER)};
 fs.writeFileSync(path.join(out,'flight.json'),JSON.stringify(result,null,2));
 api.dispose();gl.getExtension('STACKGL_destroy_context').destroy();
 if(glErrors.length||warnings.some(x=>x.includes('Shader Error'))||checkpoints.some(x=>x.invalidTransforms.length||x.distinctColors<16))throw Error('Native flight inspection failed; see flight.json');
}
main().catch(e=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(e),stack:e.stack,checkpoints,warnings,glErrors},null,2));console.error(e);process.exitCode=1;});
