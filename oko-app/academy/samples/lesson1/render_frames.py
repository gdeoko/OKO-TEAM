from playwright.sync_api import sync_playwright
import os,math
os.chdir(os.path.dirname(os.path.abspath(__file__)))
FPS=30; TOTAL=152.85; N=math.ceil(TOTAL*FPS)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
        args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist',
              '--force-color-profile=srgb','--hide-scrollbars'])
    pg=b.new_page(viewport={'width':1920,'height':1080},device_scale_factor=1)
    pg.goto('file://'+os.path.abspath('scene.html')); pg.wait_for_timeout(800)
    pg.evaluate("document.getElementById('leader').style.display='none'")
    for i in range(N):
        t=i/FPS
        pg.evaluate(f'window.SEEK({t})')
        pg.screenshot(path=f'rec/frames/f{i:05d}.jpg', type='jpeg', quality=92)
        if i%500==0: print(f'frame {i}/{N}', flush=True)
    b.close(); print(f'DONE {N} frames')
