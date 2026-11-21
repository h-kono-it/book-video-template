#!/usr/bin/env python3
"""効果音と BGM を合成して書き出す（標準ライブラリのみ・自作なので権利フリー）

  python3 scripts/gen-sfx.py

出力:
  public/se/pop.wav     テロップが出るときの「ポン」
  public/se/whoosh.wav  場面転換の「シュッ」
  public/se/boom.wav    つかみの「ドーン」
  public/se/ding.wav    告知の「チーン」
  public/bgm/beat150.wav  150BPM のドラム＋ベースのループ（2小節）
"""
import math, os, random, struct, wave

SR = 44100
random.seed(7)


def write(path, samples, gain=0.9):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    peak = max(1e-9, max(abs(s) for s in samples))
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s / peak * gain)) * 32767)) for s in samples))
    print(f"{path}  {len(samples) / SR:.2f}s")


def sweep(f0, f1, dur, decay):
    out, ph = [], 0.0
    n = int(SR * dur)
    for i in range(n):
        t = i / n
        f = f0 * (f1 / f0) ** t
        ph += 2 * math.pi * f / SR
        out.append(math.sin(ph) * math.exp(-decay * t))
    return out


def noise(dur):
    return [random.uniform(-1, 1) for _ in range(int(SR * dur))]


def lowpass(x, cutoff_fn):
    y, prev = [], 0.0
    for i, s in enumerate(x):
        a = min(1.0, 2 * math.pi * cutoff_fn(i / len(x)) / SR)
        prev += a * (s - prev)
        y.append(prev)
    return y


def mix(*tracks):
    n = max(len(t) for t in tracks)
    return [sum(t[i] for t in tracks if i < len(t)) for i in range(n)]


def pop():
    return sweep(1100, 260, 0.09, 5)


def whoosh():
    n = noise(0.35)
    f = lowpass(n, lambda t: 300 + 5000 * math.sin(math.pi * t))
    return [s * math.sin(math.pi * i / len(f)) ** 2 for i, s in enumerate(f)]


def boom():
    body = sweep(140, 38, 0.7, 4)
    click = [s * math.exp(-60 * i / SR) for i, s in enumerate(noise(0.05))]
    return mix(body, [c * 0.5 for c in click])


def ding():
    n = int(SR * 0.9)
    return [
        (math.sin(2 * math.pi * 1318.5 * i / SR) + 0.7 * math.sin(2 * math.pi * 1760 * i / SR)) * math.exp(-5 * i / n)
        for i in range(n)
    ]


def beat(bpm=150, bars=2):
    beat_len = 60 / bpm
    total = int(SR * beat_len * 4 * bars)
    out = [0.0] * total
    kick = sweep(150, 45, 0.25, 6)
    snare = mix([s * 0.6 for s in lowpass(noise(0.18), lambda t: 6000)], [s * 0.4 for s in sweep(220, 180, 0.18, 8)])
    snare = [s * math.exp(-18 * i / SR) for i, s in enumerate(snare)]
    hat = [s * math.exp(-80 * i / SR) for i, s in enumerate(noise(0.05))]
    hat = [h - l for h, l in zip(hat, lowpass(hat, lambda t: 4000))]  # ハイパス

    def place(sample, at, vol):
        st = int(at * SR)
        for i, s in enumerate(sample):
            if st + i < total:
                out[st + i] += s * vol

    # ベース: A1 の 8 分（ルート A, 3小節目以降 F→G）
    notes = [55.0, 55.0, 55.0, 65.41, 43.65, 43.65, 49.0, 49.0]
    for b in range(bars * 4):
        t0 = b * beat_len
        place(kick, t0, 1.0)
        if b % 2 == 1:
            place(snare, t0, 0.8)
        for k in range(2):
            place(hat, t0 + k * beat_len / 2, 0.35)
            f = notes[(b * 2 + k) % len(notes)]
            n = int(SR * beat_len / 2 * 0.9)
            sq = [(1 if math.sin(2 * math.pi * f * i / SR) > 0 else -1) * math.exp(-3 * i / n) for i in range(n)]
            place(lowpass(sq, lambda t: 900), t0 + k * beat_len / 2, 0.35)
    return out


if __name__ == "__main__":
    root = os.getcwd()
    write(f"{root}/public/se/pop.wav", pop())
    write(f"{root}/public/se/whoosh.wav", whoosh(), 0.7)
    write(f"{root}/public/se/boom.wav", boom())
    write(f"{root}/public/se/ding.wav", ding(), 0.7)
    write(f"{root}/public/bgm/beat150.wav", beat(), 0.8)
