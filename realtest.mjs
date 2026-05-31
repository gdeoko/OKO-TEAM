import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless:'shell',
  args:['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--window-size=1280,800']
});
const p = await b.newPage(); await p.setViewport({width:1280,height:800});
const errs=[];
p.on('pageerror',e=>errs.push('JS_ERR: '+e.message));
await p.goto('http://127.0.0.1:4180/',{waitUntil:'load',timeout:30000}).catch(e=>errs.push('GOTO:'+e.message));
await new Promise(r=>setTimeout(r,9000));
const st = await p.evaluate(()=>({
  loaderHidden: document.getElementById('loader')?.classList.contains('hidden'),
  webglOk: !!document.querySelector('canvas'),
  bar: document.querySelector('.ld-bar i')?.style.width
}));
await p.screenshot({path:'/tmp/real.png'});
console.log('errors:', errs.length? errs.join(' | '):'НЕТ');
console.log('state:', JSON.stringify(st));
await b.close();
