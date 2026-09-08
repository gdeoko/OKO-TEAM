/* Native WebGL scene inspection. This is not a browser or an FPS benchmark.
   Loads the shipped Three.js and scene modules unchanged. DOM layout and the
   page's scroll controller are intentionally outside this inspection. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createCanvas, Image, GlobalFonts} = require('@napi-rs/canvas');
const geometryOnly = process.env.ROCKET_GEOMETRY_ONLY === '1';
const createGL = geometryOnly ? null : require('gl');
const source = path.resolve(process.argv[2] || '../source/rocketvpn');
const out = path.resolve(process.argv[3] || './frames');
const width = Number(process.argv[4] || 1280), height = Number(process.argv[5] || 800);
const progress = Number(process.argv[6] || 1);
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
const scene=new T.Scene(), cam=new T.PerspectiveCamera(width>=height?72:84,width/height,.1,4000);
scene.add(cam);
const W={T,r:renderer,scene,cam,ступень:2,готов:true,часы:0};
context.RV_WORLD={мир:()=>W,работа:(name,fn)=>jobs.push(fn)};
load('rv-пбр.js');load('rv-real.js');
context.RV_REAL.свет(T,scene);
if(!geometryOnly)context.RV_REAL.окружение(T,renderer,scene);
for(const file of ['gen/cab/meta.js','gen/cab/flat.js','gen/cab/deck.js','rc-keys.js','rc-deck.js',
  'rc-panel.js','rc-cabin.js','rv-салон-cdn.js','rv-assembly.js','rv-финал.js'])load(file);
const root=new T.Group();scene.add(root);
context.RV_ФИНАЛ.собрать(W,root);
async function main(){
  // Resolve scheduled preparation and actual local texture decodes before drawing.
  for(let pass=0;pass<8;pass++){
    const count=jobs.length;for(let i=0;i<count;i++)jobs.shift()();
    if(pending.length)await Promise.all(pending.splice(0));
    await new Promise(resolve=>setImmediate(resolve));
    if(!jobs.length&&!pending.length)break;
  }
  const place=context.RV_ФИНАЛ.замер().местоУПульта;
  const pose=context.RV_ФИНАЛ.поза();
  // Final viewing position is taken from the module's documented console distance.
  // Intermediate images use this same observation point, not the site's scroll camera.
  cam.position.set(0,1.66,-2.8+place.даль);
  cam.lookAt(0,1.62,-2.90);cam.updateMatrixWorld(true);
  context.RV_ФИНАЛ.видно(true);
  context.RV_ФИНАЛ.кадр(progress,1/60,10);
  scene.updateMatrixWorld(true);
  const groups=[], materials={};
  root.traverse(o=>{if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials[m.type]=(materials[m.type]||0)+1;});
  root.traverse(o=>{if(!o.isGroup)return;let objects=0,vertices=0;o.traverse(x=>{objects++;vertices+=x.geometry?.attributes.position?.count||0;});if(objects>5)groups.push({name:o.name,objects,vertices,visible:o.visible});});
  if(geometryOnly){console.log(JSON.stringify({geometryOnly:true,finale:context.RV_ФИНАЛ.замер(),groups,materials,warnings},null,2));return;}
  // Environment generation may have used offscreen targets. Inspect the output
  // framebuffer explicitly, as the site's final composite pass normally does.
  renderer.setRenderTarget(null);
  const post = process.env.ROCKET_POST==='1' ? context.RV_REAL.плёнка(T,renderer,2,width,height,{}) : null;
  renderer.info.autoReset=false; renderer.info.reset();
  if(post)post.render(scene,cam,10);else renderer.render(scene,cam);
  gl.finish();
  const pixels=new Uint8Array(width*height*4);
  gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  const image=createCanvas(width,height), x=image.getContext('2d'), data=x.createImageData(width,height);
  for(let y=0;y<height;y++)data.data.set(pixels.subarray((height-y-1)*width*4,(height-y)*width*4),y*width*4);
  x.putImageData(data,0,0);
  const stem=`finale-${width}x${height}-${progress}`;
  fs.writeFileSync(path.join(out,stem+'.png'),image.toBuffer('image/png'));
  const colors=new Set();
  for(let i=0;i<pixels.length;i+=4)colors.add((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]);
  const result={scope:'Native scene module inspection; no browser, DOM overlay, scroll controller or device FPS',
    three:T.REVISION,width,height,progress,renderer:gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),
    postProcessing:!!post,colorTargetType:post?post.сцена.texture.type:null,
    camera:cam.position.toArray(),pose,finale:context.RV_ФИНАЛ.замер(),
    info:renderer.info.render,programs:renderer.info.programs.length,materials,
    distinctColors:colors.size,warnings,glErrors,glError:gl.getError()};
  fs.writeFileSync(path.join(out,stem+'.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));if(post)post.dispose();renderer.dispose();gl.getExtension('STACKGL_destroy_context').destroy();
}
main().catch(e=>{console.error(e);process.exitCode=1;});
