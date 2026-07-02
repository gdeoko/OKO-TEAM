// Проверка воспроизведения HEVC-alpha в родном WebKit (движок Safari/iOS)
const { webkit } = require('playwright');
const fs = require('fs');
(async()=>{
  const b = await webkit.launch();
  const p = await b.newPage({ viewport:{ width: 900, height: 640 } });
  await p.goto('file://'+process.cwd()+'/hevc/webkit_page.html');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'hevc/out/webkit_mid.png' });
  await p.waitForTimeout(2000);
  const res = await p.$$eval('video', vs => vs.map(v => ({
    src: (v.currentSrc||v.src).split('/').pop(),
    videoWidth: v.videoWidth, videoHeight: v.videoHeight,
    currentTime: +v.currentTime.toFixed(2),
    ended: v.ended, paused: v.paused,
    error: v.error ? 'code '+v.error.code : null,
  })));
  fs.writeFileSync('hevc/out/webkit_results.json', JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1));
  await p.screenshot({ path: 'hevc/out/webkit_end.png' });
  await b.close();
  const ok = res.every(r => !r.error && r.videoWidth > 0 && (r.currentTime > 0.3 || r.ended));
  console.log(ok ? 'WEBKIT_PLAYBACK_OK' : 'WEBKIT_PLAYBACK_PROBLEM');
})().catch(e=>{ console.error('FATAL', e.message); process.exit(1); });
