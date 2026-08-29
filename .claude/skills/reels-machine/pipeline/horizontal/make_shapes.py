# make_shapes.py — генератор масок+колец для форм вставок (PIL). См. MOTION_ARSENAL.md §3.
from PIL import Image, ImageDraw, ImageFilter
import PIL.ImageChops as C, math, os
LIME=(154,255,0,255); os.makedirs('shapes',exist_ok=True)
def save(n,m,r): m.save('shapes/%s_mask.png'%n); r.save('shapes/%s_ring.png'%n)
def ring(name,scale=0.93):
    m=Image.open('shapes/%s_mask.png'%name).convert('L'); w,h=m.size
    iw,ih=int(w*scale),int(h*scale); inner=m.resize((iw,ih)).point(lambda p:255 if p>128 else 0)
    ic=Image.new('L',(w,h),0); ic.paste(inner,((w-iw)//2,(h-ih)//2))
    band=C.subtract(m.point(lambda p:255 if p>128 else 0),ic)
    r=Image.composite(Image.new('RGBA',(w,h),LIME),Image.new('RGBA',(w,h),(0,0,0,0)),band.filter(ImageFilter.GaussianBlur(1)))
    r.save('shapes/%s_ring.png'%name)
# circle/oval/roundrect/polys — рисуем маску (feather), кольцо строим из маски полосой
def circ(n,w=1200):
    m=Image.new('L',(w,w),0); ImageDraw.Draw(m).ellipse([40,40,w-40,w-40],fill=255)
    m=m.filter(ImageFilter.GaussianBlur(6)); m.save('shapes/%s_mask.png'%n); ring(n,0.94)
def poly(n,pts,w,h):
    m=Image.new('L',(w,h),0); ImageDraw.Draw(m).polygon(pts,fill=255)
    m=m.filter(ImageFilter.GaussianBlur(5)); m.save('shapes/%s_mask.png'%n); ring(n,0.9)
def rr(n,w,h,rad=48):
    m=Image.new('L',(w,h),0); ImageDraw.Draw(m).rounded_rectangle([26,26,w-26,h-26],radius=rad,fill=255)
    m=m.filter(ImageFilter.GaussianBlur(4)); m.save('shapes/%s_mask.png'%n); ring(n,0.95)
circ('circle'); circ('smallcircle',440)
poly('hexagon',[(int(600+560*math.cos(math.pi/180*(60*i-90))),int(600+560*math.sin(math.pi/180*(60*i-90)))) for i in range(6)],1200,1200)
poly('pentagon',[(int(580+540*math.cos(math.pi/180*(72*i-90))),int(580+540*math.sin(math.pi/180*(72*i-90)))) for i in range(5)],1160,1160)
poly('diamond',[(600,50),(1150,600),(600,1150),(50,600)],1200,1200)
poly('parallelogram',[(180,30),(1170,30),(1020,730),(30,730)],1200,760)
rr('rrect',1320,820); rr('roundsquare',1040,1040,90); rr('tv',1340,860,30); rr('strip',560,1000,46); rr('band',1760,380,40); rr('tilt',1120,760,40); rr('phone',640,1280,90)
print('shapes generated:',len(set(f.split("_")[0] for f in os.listdir("shapes"))))
