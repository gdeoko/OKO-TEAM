# -*- coding: utf-8 -*-
"""Премиальная фоновая музыка + профессиональные, РАЗНЫЕ SFX для КП OKO. Всё оффлайн (numpy+ffmpeg)."""
import numpy as np, os, subprocess, wave
SR=44100
rng=np.random.default_rng(7)

def wav_stereo(path,L,R):
    x=np.stack([np.clip(L,-1,1),np.clip(R,-1,1)],axis=1)
    a=(x*32767).astype('<i2')
    with wave.open(path,'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(a.tobytes())
def mp3(wavp,mp3p,br='192k'):
    subprocess.run(['ffmpeg','-y','-i',wavp,'-b:a',br,mp3p],capture_output=True); os.remove(wavp)

def onepole_lp(x,cut):
    """переменный/фиксированный однополюсный ФНЧ; cut — скаляр или массив (Гц)"""
    y=np.empty_like(x); acc=0.0
    if np.isscalar(cut):
        a=np.exp(-2*np.pi*cut/SR)
        for i in range(len(x)): acc=a*acc+(1-a)*x[i]; y[i]=acc
    else:
        for i in range(len(x)):
            a=np.exp(-2*np.pi*cut[i]/SR); acc=a*acc+(1-a)*x[i]; y[i]=acc
    return y
def onepole_hp(x,cut=30):
    return x-onepole_lp(x,cut)

def adsr(n,a,d,sl,r):
    e=np.ones(n); ai=int(a*SR);di=int(d*SR);ri=int(r*SR)
    if ai>0: e[:ai]=np.linspace(0,1,ai)
    if di>0: e[ai:ai+di]=np.linspace(1,sl,di)
    e[ai+di:max(ai+di,n-ri)]=sl
    if ri>0: e[n-ri:]=np.linspace(sl,0,ri)
    return e

def reverb(x,decay=2.2,mix=0.30):
    L=int(decay*SR); ir=rng.standard_normal(L)*np.exp(-np.linspace(0,6,L)); ir[0]=1.0
    ir/=np.max(np.abs(ir))
    from numpy.fft import rfft,irfft
    N=len(x)+L; y=irfft(rfft(x,N)*rfft(ir,N))[:len(x)]; y/=np.max(np.abs(y))+1e-9
    return (1-mix)*x+mix*y

def sat(x,drive=1.4): return np.tanh(x*drive)/np.tanh(drive)
def comp(x,thr=0.5,ratio=3.0,atk=0.005,rel=0.12):
    env=0.0; a=np.exp(-1/(atk*SR)); r=np.exp(-1/(rel*SR)); g=np.ones_like(x)
    ax=np.abs(x)
    for i in range(len(x)):
        env=(a*env+(1-a)*ax[i]) if ax[i]>env else (r*env+(1-r)*ax[i])
        if env>thr: g[i]=(thr+(env-thr)/ratio)/(env+1e-9)
    return x*g
def limit(x,ceil=0.95):
    m=np.max(np.abs(x))+1e-9
    if m>ceil: x=x*(ceil/m)
    return np.tanh(x/ceil*0.98)*ceil

# ============================ МУЗЫКА (премиум ambient/motivational) ============================
BPM=72; beat=60/BPM; bar=4*beat
# Am – F – C – G  (i–VI–III–VII: тёплое, вдохновляющее «движение вверх»)
# частоты нот
def nt(name):
    base={'C':261.63,'D':293.66,'E':329.63,'F':349.23,'G':392.00,'A':440.00,'B':493.88}
    return base[name]
CHORDS=[
 ('A', [220.00,261.63,329.63,440.00]),  # Am
 ('F', [174.61,220.00,349.23,440.00]),  # F
 ('C', [130.81,196.00,329.63,523.25]),  # C
 ('G', [196.00,246.94,392.00,587.33]),  # G
]
BARS_PER_CHORD=2
total_bars=len(CHORDS)*BARS_PER_CHORD
seg_n=int(total_bars*bar*SR)
t=np.arange(seg_n)/SR
L=np.zeros(seg_n); R=np.zeros(seg_n)

def supersaw(f,n,detune=0.006,voices=5):
    out=np.zeros(n); tt=np.arange(n)/SR
    for v in range(voices):
        d=1+detune*(v-(voices-1)/2)
        ph=rng.random()
        # пила через сумму гармоник (мягкая)
        s=np.zeros(n)
        for h in range(1,9): s+=((-1)**(h+1))*np.sin(2*np.pi*f*d*h*tt+ph)/h
        out+=s
    return out/voices

# сайдчейн-«дыхание» (мягкий пуш на каждую долю) — придаёт грув без ударных
sc=np.ones(seg_n)
for b in range(total_bars*4):
    s=int(b*beat*SR); d=int(0.28*beat*SR)
    if s<seg_n:
        env=np.linspace(0.55,1.0,min(d,seg_n-s))
        sc[s:s+len(env)]=env

pos=0
for ci in range(total_bars):
    name,ch=CHORDS[ci%len(CHORDS)]
    n=int(bar*SR); tt=np.arange(n)/SR
    # PAD: supersaw аккорд через плавный ФНЧ, тёплый
    pad=np.zeros(n)
    for k,f in enumerate(ch):
        pad+=supersaw(f/2 if k==0 else f,n)/(1.0+0.5*k)
    cut=600+500*np.sin(2*np.pi*tt/(bar*2))
    padf=onepole_lp(pad,cut)
    penv=adsr(n,0.9,0.4,0.85,0.9)
    padf*=penv*0.5
    # SUB bass: корень, мягкий пульс по долям
    root=ch[0]/2
    sub=np.sin(2*np.pi*root*tt)
    subenv=np.ones(n)
    for bb in range(4):
        s=int(bb*beat*SR); d=int(beat*SR)
        e=np.exp(-np.linspace(0,3,min(d,n-s))); subenv[s:s+len(e)]=0.5+0.5*e
    sub*=subenv*0.55
    # ARP pluck (стерео ping-pong): тоны аккорда, короткие
    arpL=np.zeros(n); arpR=np.zeros(n)
    arp_notes=[ch[1],ch[2],ch[3],ch[2]]
    for j in range(8):
        st=j*(beat/2); s=int(st*SR)
        if s>=n: break
        f=arp_notes[j%len(arp_notes)]*(2 if j%4==3 else 1)
        dur=beat*0.9; ln=int(dur*SR); ln=min(ln,n-s)
        te=np.arange(ln)/SR; env=np.exp(-te*7.0)
        note=(np.sin(2*np.pi*f*te)+0.35*np.sin(2*np.pi*2*f*te))*env*0.22
        if j%2==0: arpL[s:s+ln]+=note; arpR[s:s+ln]+=note*0.5
        else:      arpR[s:s+ln]+=note; arpL[s:s+ln]+=note*0.5
    # LEAD bell (нежная ведущая линия, редкая) только в тактах 2 и 4
    lead=np.zeros(n)
    if ci%2==1:
        penta=[ch[2],ch[3],ch[2]*1.5,ch[3]*1.25,ch[2]*2]
        seq=[(0.0,penta[0]),(1.0,penta[1]),(2.0,penta[2]),(3.0,penta[3]),(3.5,penta[1])]
        for st,f in seq:
            s=int(st*beat*SR)
            if s>=n: break
            ln=min(int(1.6*beat*SR),n-s); te=np.arange(ln)/SR; env=np.exp(-te*2.6)
            lead[s:s+ln]+=(np.sin(2*np.pi*f*te)+0.3*np.sin(2*np.pi*2*f*te)*np.exp(-te*5))*env*0.20
    # микс сегмента (сайдчейн на pad+sub)
    scseg=sc[pos:pos+n]
    monoc=(padf+sub)*scseg + lead
    L[pos:pos+n]+=monoc+arpL
    R[pos:pos+n]+=monoc+arpR
    pos+=n

# AIR / текстура (стерео-декоррелированный шумовой пад, очень тихо)
airL=onepole_lp(rng.standard_normal(seg_n),900)*0.05
airR=onepole_lp(rng.standard_normal(seg_n),900)*0.05
# «ЧАСТОТЫ»: мягкий низкий пульс 1.0 Гц на 55 Гц (подсознательная вовлечённость, не назойливо) + воздушный 0.25Гц
freqs=0.045*(0.5+0.5*np.sin(2*np.pi*1.0*t))*np.sin(2*np.pi*55*t)
freqs+=0.03*np.sin(2*np.pi*0.25*t)*np.sin(2*np.pi*82*t)
L+=airL+freqs; R+=airR+freqs

# Haas-ширина + мастеринг
L=onepole_hp(L,28); R=onepole_hp(R,28)
L=sat(L,1.3); R=sat(R,1.3)
L=comp(L,0.5,2.5); R=comp(R,0.5,2.5)
mx=max(np.max(np.abs(L)),np.max(np.abs(R)))+1e-9
L/=mx; R/=mx
L=reverb(L,2.4,0.26); R=reverb(R,2.5,0.26)

# бесшовный луп: кроссфейд 3с
cf=int(3.0*SR)
for X in (L,R):
    head=X[:cf].copy(); tail=X[-cf:].copy(); w=np.linspace(0,1,cf)
    X[-cf:]=tail*(1-w)+head*w
L=L[:-cf]; R=R[:-cf]
L=limit(L*0.9,0.92); R=limit(R*0.9,0.92)
wav_stereo('/tmp/music.wav',L,R); mp3('/tmp/music.wav','kp_deploy/kp-media/snd/music.mp3','192k')
print('music', round(len(L)/SR,1),'s')

# ============================ SFX (профессиональные, РАЗНЫЕ) ============================
def save(name,L,R,rev=0.18,rdec=0.7,br='160k'):
    L=onepole_hp(L,40); R=onepole_hp(R,40)
    if rev>0: L=reverb(L,rdec,rev); R=reverb(R,rdec,rev)
    mx=max(np.max(np.abs(L)),np.max(np.abs(R)))+1e-9
    L=limit(L/mx*0.9,0.94); R=limit(R/mx*0.9,0.94)
    wav_stereo('/tmp/s.wav',L,R); mp3('/tmp/s.wav','kp_deploy/kp-media/snd/'+name+'.mp3',br)

# WHOOSH — переход секции: воздушный фильтрованный свелл с доплером (стерео-пан)
n=int(1.1*SR); t=np.arange(n)/SR
noise=rng.standard_normal(n)
cut=250+2600*np.sin(np.pi*t/t[-1])**1.2
sw=onepole_lp(noise,cut); env=np.sin(np.pi*t/t[-1])**1.5
body=sw*env*2.4+0.3*np.sin(2*np.pi*(90+40*t/t[-1])*t)*env
pan=0.5+0.5*np.sin(np.pi*t/t[-1])   # слева→направо
save('whoosh',body*(1-pan)*1.4,body*pan*1.4,rev=0.22,rdec=0.9)

# CLICK — кнопки: короткий чистый UI-тик с тональным блипом (сухой, резкий, но приятный)
n=int(0.09*SR); t=np.arange(n)/SR; env=np.exp(-t*55)
tk=(0.6*np.sin(2*np.pi*1500*t)+0.5*np.sin(2*np.pi*900*np.exp(-t*20)*t))*env
tk+=0.25*rng.standard_normal(n)*np.exp(-t*120)
save('click',tk,tk,rev=0.06,rdec=0.3)

# OPEN — раскрытие (FAQ/детали): приятный восходящий двухтон «поп»
n=int(0.34*SR); t=np.arange(n)/SR; env=np.exp(-t*7)
f=np.linspace(360,880,n); op=np.sin(2*np.pi*np.cumsum(f)/SR)*env
op+=0.4*np.sin(2*np.pi*np.cumsum(np.linspace(540,1320,n))/SR)*env*0.6
save('open',op,op*0.9,rev=0.16,rdec=0.6)

# SWITCH — переключение (табы/точки): быстрый цифровой «блип» (иной, чем click — два тона вверх)
n=int(0.16*SR); t=np.arange(n)/SR; env=np.exp(-t*24)
a=np.sin(2*np.pi*680*t)*np.exp(-t*30)
b=np.sin(2*np.pi*1020*t)*np.where(t>0.05,np.exp(-(t-0.05)*30),0)
sw2=(a+b)*0.9
save('switch',sw2,sw2*0.85,rev=0.10,rdec=0.4)

# ENTER — загрузка завершена: премиальный восходящий арпеджио-аккорд «power on» (сигнатурный)
n=int(1.2*SR); t=np.arange(n)/SR
chord=[261.63,329.63,392.00,523.25,659.25]
enL=np.zeros(n); enR=np.zeros(n)
for i,f in enumerate(chord):
    s=int(i*0.06*SR); ln=n-s; te=np.arange(ln)/SR; env=np.exp(-te*2.4)
    note=(np.sin(2*np.pi*f*te)+0.3*np.sin(2*np.pi*2*f*te)*np.exp(-te*4))*env*0.5
    pan=i/(len(chord)-1)
    enL[s:s+ln]+=note*(1-0.4*pan); enR[s:s+ln]+=note*(0.6+0.4*pan)
enL+=0.3*np.sin(2*np.pi*130.81*t)*np.exp(-t*3)   # мягкий бас-удар снизу
enR+=0.3*np.sin(2*np.pi*130.81*t)*np.exp(-t*3)
save('enter',enL,enR,rev=0.28,rdec=1.2)
print('SFX done')
