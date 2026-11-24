import wave, math, struct, os

os.makedirs("output", exist_ok=True)

# Original restrained cinematic pulse, no external copyrighted recording.
rate = 44100
duration = 40
with wave.open("output/music.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(rate)
    buf = bytearray(rate * duration * 4)
    chord = [55, 82.41, 110, 164.81]
    for i in range(rate * duration):
        t = i / rate
        beat = 0.5 + 0.5 * math.sin(2 * math.pi * 0.5 * t)
        v = sum(math.sin(2 * math.pi * f * t) for f in chord) / 4
        swell = min(1, t / 4) * min(1, (duration - t) / 4)
        sample = int(32767 * 0.13 * swell * (v * (0.7 + 0.3 * beat)))
        struct.pack_into("<hh", buf, i * 4, sample, sample)
    w.writeframes(buf)

# Short, readable captions: each line is kept below ~30 characters.
subs = [
    (0, 4, "Июль 1969-го.\nЧеловечество летит к Луне."),
    (4, 8, "«Сатурн-5» поднимает\n«Аполлон-11» с Земли."),
    (8, 12, "Армстронг, Олдрин,\nКоллинз — экипаж миссии."),
    (12, 17, "Через четыре дня «Орёл»\nначинает снижение к Луне."),
    (17, 22, "20 июля Армстронг ступает\nна поверхность Луны."),
    (22, 27, "Они собирают образцы грунта\nи устанавливают приборы."),
    (27, 31, "Майкл Коллинз остаётся\nна лунной орбите."),
    (31, 36, "Тысячи людей сделали\nневозможное реальностью."),
    (36, 40, "«Аполлон-11» — первый шаг\nчеловека на другом мире."),
]

def ts(seconds):
    hours = int(seconds // 3600)
    minutes = int(seconds % 3600 // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"

with open("output/subtitles.srt", "w", encoding="utf8") as f:
    for n, (start, end, text) in enumerate(subs, 1):
        f.write(f"{n}\n{ts(start)} --> {ts(end)}\n{text}\n\n")
