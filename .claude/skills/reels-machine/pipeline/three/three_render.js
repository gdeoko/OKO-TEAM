// node three_render.js jobs.json  jobs:[{shape,dir,frames,dur,col,col2,scale?}]  served via http
const { chromium }=require('playwright');const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process');
(async()=>{
 const jobs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 // serve three3d dir
 const srv=cp.spawn('python3',['-m','http.server','8731','--directory','three3d'],{stdio:'ignore'});
 await new Promise(r=>setTimeout(r,800));
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox','--use-gl=angle','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const page=await b.newPage({viewport:{width:1080,height:1920}});
 for(const job of jobs){
  try{
   fs.mkdirSync(job.dir,{recursive:true});
   const q=`shape=${job.shape}&col=${job.col||'9CF806'}&col2=${job.col2||'e8842a'}`;
   await page.goto(`http://localhost:8731/scene.html?${q}`,{waitUntil:'load'});
   await page.waitForFunction('window.ready===true',{timeout:10000});
   const dur=job.dur||(job.frames/30);
   for(let f=0;f<job.frames;f++){const t=f/30;await page.evaluate(tt=>window.render3d(tt),t);
     await page.screenshot({path:path.join(job.dir,String(f).padStart(3,'0')+'.png'),omitBackground:true});}
   console.log('3D',job.shape,'->',job.dir,job.frames);
  }catch(e){console.log('3D-SKIP',job.shape,String(e).slice(0,90));}
 }
 await b.close();srv.kill();
})();
