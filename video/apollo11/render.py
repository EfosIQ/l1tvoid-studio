import math, os, subprocess, wave, shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

W,H,FPS,SCENE = 540,960,24,8
OUT="apollo11_tiktok.mp4"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
font=lambda size,b=False: ImageFont.truetype(BOLD if b else FONT,size)
narration=[
"Шестнадцатого июля тысяча девятьсот шестьдесят девятого года. Весь мир смотрит на стартовую площадку во Флориде. Человечество готовится сделать шаг, которого ещё никто не делал.",
"Сверхтяжёлая ракета Сатурн пять поднимает Аполлон одиннадцать над Землёй. За несколько минут экипаж покидает атмосферу. Впереди — почти четыреста тысяч километров неизвестности.",
"На борту — Нил Армстронг, Базз Олдрин и Майкл Коллинз. После выхода на траекторию к Луне корабль отделяется от третьей ступени. Земля постепенно превращается в голубой шар.",
"Двадцатого июля лунный модуль Орёл отделяется от командного корабля. Армстронг и Олдрин снижаются к поверхности. Автоматика ведёт аппарат к опасному участку, и Армстронг берёт управление на себя.",
"В двадцать часов семнадцать минут по всемирному времени Орёл касается Луны. Через несколько часов Армстронг ступает на поверхность. Впервые человек стоит на другом небесном теле. А Коллинз всё это время ждёт на орбите."
]
titles=["16 ИЮЛЯ 1969","СТАРТ SATURN V","ПУТЬ К ЛУНЕ","ПОСАДКА «ОРЛА»","ЧЕЛОВЕК НА ЛУНЕ"]
subtitles=["Три человека. Одна историческая миссия.","Мощь, которая выводит мечту за пределы Земли.","Земля остаётся позади. Луна становится ближе.","Ручное управление. Последние секунды снижения.","20 ИЮЛЯ 1969 • МОРЕ СПОКОЙСТВИЯ"]
os.makedirs("build",exist_ok=True)
# voice segments
voice_files=[]
for i,txt in enumerate(narration):
    p=f"build/voice{i}.wav"
    subprocess.run(["espeak-ng","-v","ru","-s","148","-p","38","-a","175","-w",p,txt],check=True)
    voice_files.append(p)
# Compose audio timeline: voice starts 0.55s into each 8s chapter
sr=22050
total=SCENE*len(narration)
mix=np.zeros(int(sr*total),dtype=np.float32)
for i,p in enumerate(voice_files):
    with wave.open(p,"rb") as wf:
        raw=wf.readframes(wf.getnframes()); ch=wf.getnchannels(); sw=wf.getsampwidth(); rate=wf.getframerate()
    dtype={1:np.int8,2:np.int16,4:np.int32}[sw]
    a=np.frombuffer(raw,dtype=dtype).astype(np.float32)
    if ch>1: a=a.reshape(-1,ch).mean(axis=1)
    a/=max(1,np.max(np.abs(a)))
    if rate!=sr: a=np.interp(np.linspace(0,len(a)-1,int(len(a)*sr/rate)),np.arange(len(a)),a)
    start=int((i*SCENE+.55)*sr); end=min(len(mix),start+len(a))
    mix[start:end]+=a[:end-start]*.72
# original low cinematic synth score
t=np.arange(len(mix))/sr
music=(0.055*np.sin(2*np.pi*55*t)+0.032*np.sin(2*np.pi*82.4*t)+0.018*np.sin(2*np.pi*(110+2*np.sin(2*np.pi*.08*t))*t))
music*=np.minimum(1,t/2)*np.minimum(1,(total-t)/2)
mix=np.tanh(mix+music)
audio=(mix*32767).astype(np.int16)
with wave.open("build/audio.wav","wb") as wf:
    wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(sr); wf.writeframes(audio.tobytes())

# Stable procedural star field
rng=np.random.default_rng(11)
stars=[(int(rng.integers(0,W)),int(rng.integers(0,H)),float(rng.uniform(.3,1.0)),float(rng.uniform(0,6.28))) for _ in range(170)]
def centered(d,y,text,f,fill):
    box=d.textbbox((0,0),text,font=f,stroke_width=0)
    d.text(((W-(box[2]-box[0]))/2,y),text,font=f,fill=fill)
def glow(im,xy,r,color):
    lay=Image.new("RGBA",(W,H)); q=ImageDraw.Draw(lay)
    x,y=xy
    q.ellipse((x-r,y-r,x+r,y+r),fill=color)
    im.alpha_composite(lay.filter(ImageFilter.GaussianBlur(r*.65)))
def scene_frame(sec,idx,frame):
    im=Image.new("RGBA",(W,H),(3,7,18,255))
    d=ImageDraw.Draw(im)
    # space backdrop
    for x,y,b,ph in stars:
        tw=.45+.55*math.sin(sec*2+ph)
        c=int(100+150*b*tw)
        d.ellipse((x,y,x+1.5,y+1.5),fill=(c,c,min(255,c+20),255))
    if idx==0:
        # Earth horizon and launch tower silhouette
        glow(im,(270,790),250,(18,55,115,120))
        d=ImageDraw.Draw(im)
        d.ellipse((-130,700,680,1430),fill=(10,45,95,255),outline=(52,145,220,255),width=5)
        d.arc((-125,695,680,1430),190,350,fill=(90,185,255,255),width=7)
        x=270; y=555+int(8*math.sin(sec*2))
        d.rectangle((x-20,y-260,x+20,790),fill=(135,145,154,255))
        for yy in range(y-240,760,45):
            d.line((x-20,yy,x+20,yy+40),fill=(65,75,88,255),width=3)
            d.line((x+20,yy,x-20,yy+40),fill=(65,75,88,255),width=3)
        # Saturn V
        d.polygon([(x-22,y+100),(x-22,y-110),(x-12,y-150),(x+12,y-150),(x+22,y-110),(x+22,y+100)],fill=(230,232,226,255))
        d.rectangle((x-22,y+15,x+22,y+42),fill=(30,55,90,255))
        d.polygon([(x-22,y+100),(x-34,y+145),(x-20,y+135),(x,y+155),(x+20,y+135),(x+34,y+145),(x+22,y+100)],fill=(190,195,200,255))
        flame=80+int(25*math.sin(sec*18))
        d.polygon([(x-15,y+145),(x+15,y+145),(x+5,y+145+flame),(x,y+205+flame),(x-5,y+145+flame)],fill=(255,155,35,240))
        d.polygon([(x-7,y+145),(x+7,y+145),(x,y+205)],fill=(255,240,170,255))
    elif idx in (1,2,3):
        # Earth globe
        ex,ey=115,345
        glow(im,(ex,ey),170,(15,60,150,90))
        d=ImageDraw.Draw(im)
        d.ellipse((ex-110,ey-110,ex+110,ey+110),fill=(10,55,130,255),outline=(85,170,255,255),width=4)
        d.arc((ex-105,ey-110,ex+110,ey+110),30,160,fill=(50,175,135,255),width=18)
        d.arc((ex-95,ey-100,ex+100,ey+100),190,310,fill=(60,145,220,255),width=10)
        # moon
        mx,my=430,275
        d.ellipse((mx-62,my-62,mx+62,my+62),fill=(174,178,185,255))
        for cx,cy,r in [(mx-20,my-10,13),(mx+24,my+18,9),(mx+7,my-35,7)]:
            d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=(135,140,150,255))
        if idx==1:
            # spacecraft traveling right/up
            u=(sec/SCENE)
            x=160+u*205; y=560-u*185
            d.line((ex+65,ey+65,x,y),fill=(80,125,190,110),width=2)
            d.polygon([(x,y-32),(x-13,y+15),(x,y+9),(x+13,y+15)],fill=(235,235,225,255))
            d.rectangle((x-8,y+5,x+8,y+24),fill=(210,215,220,255))
            d.ellipse((x-4,y-16,x+4,y-8),fill=(80,155,220,255))
        elif idx==2:
            # command module and lunar module in orbit
            x=300+10*math.sin(sec); y=430
            d.line((x,y,x+50,y+55),fill=(210,210,205,255),width=3)
            d.polygon([(x-18,y-15),(x+18,y-15),(x+13,y+18),(x-13,y+18)],fill=(215,220,220,255))
            d.polygon([(x+35,y+40),(x+60,y+45),(x+70,y+75),(x+45,y+70)],fill=(190,185,165,255))
            d.line((x+38,y+62,x+75,y+88),fill=(200,200,190,255),width=4)
        else:
            # lunar module descending
            x=360; y=430+int(sec*16)
            d.polygon([(x-22,y-40),(x+22,y-40),(x+16,y+15),(x-16,y+15)],fill=(210,195,145,255),outline=(245,225,175,255))
            d.polygon([(x-12,y-42),(x,y-70),(x+12,y-42)],fill=(200,205,210,255))
            d.line((x-12,y+12,x-38,y+55),fill=(220,215,195,255),width=4)
            d.line((x+12,y+12,x+38,y+55),fill=(220,215,195,255),width=4)
            d.line((x-38,y+55,x-54,y+55),fill=(220,215,195,255),width=4)
            d.line((x+38,y+55,x+54,y+55),fill=(220,215,195,255),width=4)
    else:
        # lunar landscape
        d=ImageDraw.Draw(im)
        glow(im,(430,270),120,(210,210,190,35))
        d=ImageDraw.Draw(im)
        d.ellipse((360,200,500,340),fill=(184,188,193,255))
        d.ellipse((-100,630,700,1150),fill=(83,88,98,255))
        d.ellipse((40,675,170,730),fill=(105,110,118,255))
        d.ellipse((340,650,520,730),fill=(105,110,118,255))
        for cx,cy,r in [(90,760,25),(430,790,38),(250,700,16),(480,880,20)]:
            d.ellipse((cx-r,cy-r,cx+r,cy+r),outline=(55,60,70,255),width=5)
        # flag and astronaut silhouette
        d.line((270,590,270,760),fill=(205,210,215,255),width=5)
        d.polygon([(272,592),(360,612),(272,635)],fill=(190,45,42,255))
        d.ellipse((210,625,250,665),fill=(225,225,220,255))
        d.rounded_rectangle((207,665,254,750),radius=8,fill=(218,220,215,255))
        d.line((215,742,205,800),fill=(220,220,215,255),width=10)
        d.line((245,742,257,800),fill=(220,220,215,255),width=10)
        d.line((207,680,180,730),fill=(220,220,215,255),width=9)
        d.line((252,680,280,715),fill=(220,220,215,255),width=9)
        d.rectangle((215,675,245,690),fill=(60,100,135,255))
    # cinematic vignette and text
    overlay=Image.new("RGBA",(W,H),(0,0,0,0)); od=ImageDraw.Draw(overlay)
    for k in range(80):
        a=int(1.1*k)
        od.rectangle((k,k,W-k,H-k),outline=(0,0,0,a),width=2)
    im=Image.alpha_composite(im,overlay)
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((28,52,512,190),radius=18,fill=(4,9,22,205),outline=(110,155,205,110),width=1)
    centered(d,76,titles[idx],font(29,True),(245,247,250,255))
    centered(d,132,subtitles[idx],font(14),(190,205,225,255))
    # progress bar and chapter
    d.rounded_rectangle((30,910,510,916),radius=3,fill=(55,65,80,220))
    prog=(idx*SCENE+sec)/total
    d.rounded_rectangle((30,910,30+480*prog,916),radius=3,fill=(100,190,255,255))
    d.text((32,880),"APOLLO 11  /  ДОКУМЕНТАЛЬНАЯ ИСТОРИЯ",font=font(11,True),fill=(175,190,210,255))
    return im.convert("RGB")

cmd=["ffmpeg","-y","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-i","build/audio.wav","-c:v","libx264","-preset","veryfast","-crf","19","-pix_fmt","yuv420p","-c:a","aac","-b:a","160k","-shortest","-movflags","+faststart",OUT]
proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
for idx in range(len(narration)):
    for f in range(SCENE*FPS):
        sec=f/FPS
        frame=scene_frame(sec,idx,f)
        proc.stdin.write(np.asarray(frame,dtype=np.uint8).tobytes())
proc.stdin.close()
if proc.wait()!=0: raise RuntimeError("ffmpeg render failed")
print(f"Rendered {OUT} ({os.path.getsize(OUT)} bytes)")
