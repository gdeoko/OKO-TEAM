// Lottie renderer. node lottie_render.js jobs.json  ; jobs:[{query,dir,frames,x,y,size,speed?,tint?}]
const { chromium } = require('playwright');
const fs=require('fs'), path=require('path'), cp=require('child_process');
const CA='/root/.ccr/ca-bundle.crt';
const lottieJs = fs.readFileSync('node_modules/lottie-web/build/player/lottie.min.js','utf8');
function fetchLottie(q){
  const body=JSON.stringify({query:"query($q:String!){searchPublicAnimations(query:$q,first:6){edges{node{jsonUrl downloads}}}}",variables:{q}});
  const r=cp.execSync(`curl -s --max-time 25 --cacert ${CA} -X POST https://graphql.lottiefiles.com/2022-08 -H 'content-type: application/json' -d '${body.replace(/'/g,"")}'`).toString();
  const edges=JSON.parse(r).data.searchPublicAnimations.edges.map(e=>e.node).sort((a,b)=>b.downloads-a.downloads);
  for(const n of edges){try{const j=cp.execSync(`curl -s --max-time 25 --cacert ${CA} '${n.jsonUrl}'`).toString();JSON.parse(j);return j;}catch(e){}}
  throw new Error('no lottie for '+q);
}
(async()=>{
  const jobs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const page=await b.newPage({viewport:{width:1080,height:1920}});
  const cache={};
  for(const job of jobs){
   try{
    fs.mkdirSync(job.dir,{recursive:true});
    const j=cache[job.query]||(cache[job.query]=fetchLottie(job.query));
    const size=job.size||420, x=(job.x||0.5)*1080-size/2, y=(job.y||0.5)*1920-size/2;
    const tint=job.tint?`filter:drop-shadow(0 0 1px ${job.tint});`:'';
    await page.setContent(`<!DOCTYPE html><html><head><meta charset=utf-8><style>*{margin:0}html,body{width:1080px;height:1920px;background:transparent;overflow:hidden}#h{position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;${tint}}</style></head><body><div id=h></div><script>${lottieJs}</script><script>
      window._a=lottie.loadAnimation({container:document.getElementById('h'),renderer:'svg',loop:true,autoplay:false,animationData:${j}});
      window._tf=()=>window._a.totalFrames;window._go=f=>window._a.goToAndStop(f,true);</script></body></html>`);
    await page.waitForFunction('window._a && window._tf()>0',{timeout:8000});
    const total=await page.evaluate(()=>window._tf());const speed=job.speed||1;
    for(let f=0;f<job.frames;f++){
      const lf=Math.min(total-1,(f*speed)%total);
      await page.evaluate(fr=>window._go(fr),lf);
      await page.screenshot({path:path.join(job.dir,String(f).padStart(3,'0')+'.png'),omitBackground:true});
    }
    console.log('LOTTIE',job.query,'->',job.dir,job.frames,'(src',total,'fr)');
   }catch(e){console.log('LOTTIE-SKIP',job.query,String(e).slice(0,80));}
  }
  await b.close();
})();
