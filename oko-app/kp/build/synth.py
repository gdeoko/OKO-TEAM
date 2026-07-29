# -*- coding: utf-8 -*-
"""Тёплая фоновая музыка + глубокие мягкие SFX для КП OKO. Всё оффлайн через numpy."""
import numpy as np, os, subprocess, wave
SR=44100
def wav(path,x):
    x=np.clip(x,-1,1); a=(x*32767).astype('<i2')
    if a.ndim==1: a=np.column_stack([a,a])
    with wave.open(path,'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(a.tobytes())
def mp3(wavp,mp3p,br='160k'):
    subprocess.run(['ffmpeg','-y','-i',wavp,'-b:a',br,mp3p],capture_output=True)
    os.remove(wavp)

def adsr(n,a,d,s,r,sl=0.7):
    e=np.ones(n); ai=int(a*SR);di=int(d*SR);ri=int(r*SR)
    if ai>0: e[:ai]=np.linspace(0,1,ai)
    if di>0: e[ai:ai+di]=np.linspace(1,sl,di)
    e[ai+di:n-ri]=sl
    if ri>0: e[n-ri:]=np.linspace(sl,0,ri)
    return e
def sine(f,n,ph=0): t=np.arange(n)/SR; return np.sin(2*np.pi*f*t+ph)

# --- мягкий свёрточный реверб ---
def reverb(x,decay=1.8,mix=0.28):
    L=int(decay*SR); ir=np.random.randn(L)*np.exp(-np.linspace(0,6,L)); ir[0]=1.0
    ir/=np.max(np.abs(ir))
    from numpy.fft import rfft,irfft
    N=len(x)+L
    y=irfft(rfft(x,N)*rfft(ir,N))[:len(x)]
    y/=np.max(np.abs(y))+1e-9
    return (1-mix)*x+mix*y

# ---------------- BACKGROUND MUSIC (тёплая, приятная, «частоты») ----------------
BPM=64; beat=60/BPM
# аккорды (Am – F – C – G), тёплое настроение
chords=[
 [110.0,164.81,220.0,329.63],   # Am add
 [87.31,130.81,174.61,261.63],  # F
 [98.0,130.81,196.0,392.0],     # C/G-ish
 [98.0,146.83,196.0,293.66],    # G
]
barlen=8.0  # сек на аккорд
def pad(freqs,dur):
    n=int(dur*SR); out=np.zeros(n)
    env=adsr(n,2.2,1.0,0,2.6,0.85)
    for k,f in enumerate(freqs):
        det=1+ (0.004*np.sin(2*np.pi*0.08*np.arange(n)/SR + k))   # медленный хорус
        for h,amp in [(1,0.5),(2,0.16),(3,0.07)]:
            out+= amp*np.sin(2*np.pi*f*h*det*np.arange(n)/SR)/ (1+0.6*k)
    return out*env
def subbass(root,dur):
    n=int(dur*SR); env=adsr(n,0.6,0.4,0,1.8,0.8)
    return 0.6*np.sin(2*np.pi*(root/2)*np.arange(n)/SR)*env
def bell(f,dur,amp=0.22):
    n=int(dur*SR); t=np.arange(n)/SR; env=np.exp(-t*3.2)
    return amp*(np.sin(2*np.pi*f*t)+0.4*np.sin(2*np.pi*2*f*t)*np.exp(-t*6))*env

music=np.zeros(0)
for ci,ch in enumerate(chords):
    seg=pad(ch,barlen)+subbass(ch[0],barlen)
    # мягкое арпеджио-колокольчики поверх (редкие)
    arp=np.zeros(int(barlen*SR))
    steps=[0.0,2.0,4.0,6.0]; notes=[ch[2],ch[3],ch[2]*1.5,ch[3]]
    for st,nf in zip(steps,notes):
        s=int(st*SR); b=bell(nf,barlen-st,0.16); arp[s:s+len(b)]+=b[:len(arp)-s]
    seg=seg+arp*0.7
    music=np.concatenate([music,seg])
# «частоты»: очень мягкая воздушная подложка + лёгкий low-shelf тёплый
air=0.06*np.sin(2*np.pi*0.3*np.arange(len(music))/SR)*np.sin(2*np.pi*70*np.arange(len(music))/SR)
music=music+air
music=music/(np.max(np.abs(music))+1e-9)*0.85
music=reverb(music,2.4,0.30)
# бесшовный луп: кроссфейд 3с
cf=int(3.0*SR)
head=music[:cf].copy(); tail=music[-cf:].copy()
w=np.linspace(0,1,cf)
music[-cf:]=tail*(1-w)+head*w
music=music[:-cf]  # хвост слит с началом
music=music/(np.max(np.abs(music))+1e-9)*0.8
wav('/tmp/music.wav',music); mp3('/tmp/music.wav','kp_deploy/kp-media/snd/music.mp3','160k')
print('music', round(len(music)/SR,1),'s')

# ---------------- SFX (глубокие, мягкие, не резкие) ----------------
def save_sfx(name,x,br='128k'):
    x=x/(np.max(np.abs(x))+1e-9)*0.9
    x=reverb(x,0.8,0.22)
    wav('/tmp/s.wav',x); mp3('/tmp/s.wav','kp_deploy/kp-media/snd/'+name+'.mp3',br)
# WHOOSH — глубокий мягкий свелл (long attack, low-pass, без резкого шипа)
n=int(1.3*SR); t=np.arange(n)/SR
noise=np.random.randn(n)
# бегущий low-pass: сглаживание с растущим окном → мягко
from numpy import convolve
sw=np.zeros(n); cutlfo=200+1200*np.sin(np.pi*t/t[-1])  # свелл вверх-вниз
# простая однополюсная фильтрация с переменным коэффициентом
y=0.0; out=np.zeros(n)
for i in range(n):
    a=np.exp(-2*np.pi*cutlfo[i]/SR); y=a*y+(1-a)*noise[i]; out[i]=y
env=np.sin(np.pi*t/t[-1])**1.6
whoosh=out*env*3.0 + 0.3*np.sin(2*np.pi*80*t)*env
save_sfx('whoosh',whoosh)
# CLICK — мягкий низкий бульк
n=int(0.14*SR); t=np.arange(n)/SR; env=np.exp(-t*22)
click=(np.sin(2*np.pi*520*t)+0.5*np.sin(2*np.pi*260*t))*env
save_sfx('click',click)
# OPEN — тёплый восходящий
n=int(0.4*SR); t=np.arange(n)/SR; env=np.exp(-t*6)
f=np.linspace(300,760,n); openf=np.sin(2*np.pi*np.cumsum(f)/SR)*env
save_sfx('open',openf)
# SWITCH — короткий двойной
n=int(0.22*SR); t=np.arange(n)/SR; env=np.exp(-t*16)
sw2=(np.sin(2*np.pi*440*t)+0.4*np.sin(2*np.pi*660*t))*env
save_sfx('switch',sw2)
# ENTER — глубокий приятный аккорд-удар
n=int(1.0*SR); t=np.arange(n)/SR; env=np.exp(-t*3.0)
enter=(np.sin(2*np.pi*196*t)+0.6*np.sin(2*np.pi*293*t)+0.4*np.sin(2*np.pi*392*t))*env
save_sfx('enter',enter)
print('SFX done')
