import wave, math, struct, re, os
os.makedirs("output",exist_ok=True)
# Original restrained cinematic pulse, no external copyrighted recording.
rate=44100; duration=40
with wave.open("output/music.wav","wb") as w:
 w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate)
 for i in range(rate*duration):
  t=i/rate; beat=0.5+0.5*math.sin(2*math.pi*0.5*t)
  chord=[55,82.41,110,164.81]
  v=sum(math.sin(2*math.pi*f*t) for f in chord)/4
  swell=min(1,t/4)*min(1,(duration-t)/4)
  s=int(32767*.13*swell*(v*(.7+.3*beat)))
  w.writeframesraw(struct.pack("<hh",s,s))
# Timed Russian subtitles, synced to narration beats.
subs=[
(0,4,"В июле 1969 года человечество решилось\nна то, что веками казалось невозможным."),
(4,8,"Ракета «Сатурн-5» подняла корабль «Аполлон-11» с Земли."),
(8,12,"На борту были Нил Армстронг, Базз Олдрин и Майкл Коллинз."),
(12,17,"Четыре дня спустя лунный модуль «Орёл»\nотделился от корабля и начал снижение."),
(17,22,"20 июля Нил Армстронг ступил на Луну.\nВскоре к нему присоединился Базз Олдрин."),
(22,27,"Они установили приборы, собрали образцы грунта\nи оставили следы на другом мире."),
(27,31,"Майкл Коллинз всё это время оставался на орбите."),
(31,36,"Миссия доказала: невозможное становится реальностью,\nкогда тысячи людей работают ради одной цели."),
(36,40,"«Аполлон-11». Первый шаг человечества на другом мире.")
]
def ts(s):
 h=int(s//3600);m=int(s%3600//60);sec=int(s%60);ms=int((s-int(s))*1000)
 return f"{h:02}:{m:02}:{sec:02},{ms:03}"
with open("output/subtitles.srt","w",encoding="utf8") as f:
 for n,(a,b,txt) in enumerate(subs,1):
  f.write(f"{n}\n{ts(a)} --> {ts(b)}\n{txt}\n\n")
