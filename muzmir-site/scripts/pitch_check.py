#!/usr/bin/env python3
"""ЗАМЕР СТРОЯ ПО ЗАПИСИ.

Зачем это нужно. Модель хорошо описывает, что видит и слышит в общем смысле,
но высоту звука она оценивает ненадёжно: на живой работе семилетней гитаристки
со слышимой фальшью она дважды поставила высокий балл за интонацию, потому что
слышала уверенное исполнение выученного текста. Слух жюри так не работает —
фальшь слышна сразу и решает судьбу выступления.

Поэтому интонация здесь измеряется, а не оценивается на слух. Скрипт ведёт
основной тон по записи (алгоритм YIN по автокорреляции разностной функции),
переводит частоту в отклонение от ближайшей ноты равномерной темперации и
считает, насколько далеко исполнитель от строя. Результат — числа, которые
затем кладутся модели в запрос как факт: не «мне кажется чисто», а «медианное
отклонение 34 цента, четверть звуков мимо».

Что важно понимать про сами числа:
  • 100 центов — это полутон. Профессиональный слух замечает 10-15 центов,
    неприятная фальшь начинается примерно с 25-30, полутоновый промах — 50 и выше.
  • Строй инструмента как целого (все звуки ровно на 20 центов ниже) — это не
    фальшь исполнителя, а расстроенный инструмент; такое видно по систематическому
    смещению и считается отдельно.
  • На записи с реверберацией, шумом и многоголосием точность падает, поэтому
    берутся только уверенные участки, а доля отброшенного возвращается в отчёте.

    python3 scripts/pitch_check.py файл.mp3
"""
import json
import math
import subprocess
import sys
import wave

import numpy as np

SR = 22050          # для питча выше 22 кГц не нужно, а считать вдвое быстрее
FRAME = 2048        # ~93 мс: хватает для низких нот гитары (E2 = 82 Гц)
HOP = 512           # ~23 мс между замерами
FMIN, FMAX = 70.0, 1400.0
YIN_THRESHOLD = 0.15
NOTES = ['до', 'до-диез', 'ре', 'ре-диез', 'ми', 'фа', 'фа-диез', 'соль', 'соль-диез', 'ля', 'ля-диез', 'си']


def decode(path: str) -> np.ndarray:
    """Читаем что угодно через ffmpeg в моно WAV нужной частоты."""
    cmd = ['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'wav', 'pipe:1']
    raw = subprocess.run(cmd, capture_output=True, timeout=600).stdout
    if not raw:
        raise RuntimeError('ffmpeg не отдал звук')
    import io
    with wave.open(io.BytesIO(raw), 'rb') as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return data.astype(np.float32) / 32768.0


def yin_frame(x: np.ndarray) -> float:
    """Основной тон одного окна. Возвращает 0.0, если тона нет."""
    n = len(x)
    tau_max = int(SR / FMIN)
    tau_min = int(SR / FMAX)
    if tau_max >= n:
        return 0.0
    # Разностная функция через автокорреляцию: d(t) = сумма (x[j] - x[j+t])^2
    power = np.cumsum(np.concatenate(([0.0], x * x)))
    conv = np.correlate(x, x, mode='full')[n - 1:]
    d = power[n] - power[:tau_max + 1] - 2 * conv[:tau_max + 1] + (power[n - np.arange(tau_max + 1)] - power[0])
    d[0] = 0.0
    # Нормировка накопленным средним — суть YIN, она убирает октавные ошибки
    cum = np.zeros_like(d)
    cum[0] = 1.0
    running = 0.0
    for t in range(1, len(d)):
        running += d[t]
        cum[t] = d[t] * t / running if running > 0 else 1.0
    tau = -1
    for t in range(tau_min, len(cum)):
        if cum[t] < YIN_THRESHOLD:
            while t + 1 < len(cum) and cum[t + 1] < cum[t]:
                t += 1
            tau = t
            break
    if tau < 0:
        return 0.0
    # Параболическое уточнение положения минимума: без него шаг сетки даёт
    # ошибку до нескольких центов, а мы измеряем как раз центы.
    if 0 < tau < len(cum) - 1:
        a, b, c = cum[tau - 1], cum[tau], cum[tau + 1]
        denom = 2 * (2 * b - a - c)
        if denom != 0:
            tau = tau + (a - c) / denom
    return SR / tau if tau > 0 else 0.0


def cents_off(freq: float, a4: float = 440.0) -> float:
    """Отклонение от ближайшей ноты равномерной темперации, в центах."""
    semis = 12 * math.log2(freq / a4)
    return (semis - round(semis)) * 100.0


def note_name(freq: float, a4: float = 440.0) -> str:
    semis = round(12 * math.log2(freq / a4))
    idx = (int(semis) + 9) % 12          # ля = индекс 9
    octave = 4 + (int(semis) + 9) // 12
    return f'{NOTES[idx]}{octave}'


def analyse(path: str) -> dict:
    x = decode(path)
    if len(x) < FRAME * 4:
        return {'ok': False, 'why': 'запись слишком короткая'}

    freqs, times, energies = [], [], []
    for i in range(0, len(x) - FRAME, HOP):
        frame = x[i:i + FRAME]
        rms = float(np.sqrt(np.mean(frame * frame)))
        if rms < 0.01:                    # тишина и паузы не интонируют
            continue
        f = yin_frame(frame * np.hanning(FRAME))
        if FMIN < f < FMAX:
            freqs.append(f)
            times.append(i / SR)
            energies.append(rms)

    total_frames = max(1, (len(x) - FRAME) // HOP)
    if len(freqs) < 30:
        return {'ok': False, 'why': 'тон не прослеживается: шум, многоголосие или плохая запись'}

    freqs = np.array(freqs)
    cents = np.array([cents_off(f) for f in freqs])

    # Систематическое смещение — это строй инструмента (или запись не в 440).
    # Оно вычитается, иначе расстроенная на четверть тона гитара выглядела бы
    # как беспорядочная фальшь исполнителя, а это разные диагнозы.
    bias = float(np.median(cents))
    rel = cents - bias
    # После сдвига значения у края (около ±50) заворачиваются — приводим обратно.
    rel = (rel + 50) % 100 - 50
    absrel = np.abs(rel)

    off25 = float(np.mean(absrel > 25) * 100)
    off40 = float(np.mean(absrel > 40) * 100)

    # Самые грязные моменты: их модель потом называет во времени записи.
    worst = []
    order = np.argsort(-absrel)
    used = []
    for k in order:
        t = times[k]
        if any(abs(t - u) < 1.5 for u in used):   # не перечисляем одну ноту дважды
            continue
        used.append(t)
        worst.append({'t': round(float(t), 1), 'cents': round(float(rel[k])),
                      'note': note_name(float(freqs[k]))})
        if len(worst) >= 6:
            break

    return {
        'ok': True,
        'frames_voiced': len(freqs),
        'coverage_pct': round(len(freqs) * 100 / total_frames, 1),
        'tuning_bias_cents': round(bias),
        'median_dev_cents': round(float(np.median(absrel)), 1),
        'mean_dev_cents': round(float(np.mean(absrel)), 1),
        'off_25_pct': round(off25, 1),
        'off_40_pct': round(off40, 1),
        'worst': worst,
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('нужен путь к файлу', file=sys.stderr)
        sys.exit(1)
    try:
        print(json.dumps(analyse(sys.argv[1]), ensure_ascii=False))
    except Exception as e:                # наружу отдаём причину, а не трассировку
        print(json.dumps({'ok': False, 'why': str(e)[:200]}, ensure_ascii=False))
