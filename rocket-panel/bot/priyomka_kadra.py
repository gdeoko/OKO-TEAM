# -*- coding: utf-8 -*-
"""Приёмка кадра кнопки: числом, до того как кадр увидит человек.

Зачем. Приёмщиком работал клиент: он открывал кнопку, видел лишнюю ногу
или срезанную голову и писал об этом. Каждый такой круг стоил нам дня.
Все дефекты, которые он называл, меряются кодом за долю секунды, и
кадр с дефектом дешевле пересчитать с другим зерном, чем показать.

Что меряется и почему именно так:

  поза       СИЛУЭТОМ, а не скелетом. Скелет mediapipe на ракурсах
             сзади и сверху читается шатко и давал расхождение 1.25
             там, где поза верная. Силуэт держит и позу, и ракурс, и
             кадрирование разом.
  люди       на соло-кнопке один человек, на парной двое. Самый частый
             брак парных кнопок - второй человек не нарисован вовсе.
  суставы    колено и локоть назад не гнутся. Угол меньше 30 градусов
             при хорошей видимости обеих костей это вывернутая нога.
  лицо       найдено и не срезано краем кадра.

Резкость НЕ блокирует: эталоны сняты в студии и резче любого комнатного
света, строгий порог жёг круги на кадрах без единого дефекта.
"""
import cv2
import numpy as np

try:
    import mediapipe as mp
except Exception:                                           # noqa: BLE001
    mp = None

_поз = _дет = _сег = None


def _модели():
    """Модели поднимаются один раз и живут до конца процесса."""
    global _поз, _дет, _сег
    if mp is None:
        return None, None, None
    if _поз is None:
        _поз = mp.solutions.pose.Pose(static_image_mode=True,
                                      model_complexity=2,
                                      min_detection_confidence=0.25)
        _дет = mp.solutions.face_detection.FaceDetection(
            model_selection=1, min_detection_confidence=0.25)
        _сег = mp.solutions.selfie_segmentation.SelfieSegmentation(
            model_selection=1)
    return _поз, _дет, _сег


def _кадр(данные):
    if isinstance(данные, (bytes, bytearray)):
        return cv2.imdecode(np.frombuffer(данные, np.uint8),
                            cv2.IMREAD_COLOR)
    return данные


def силуэт(кадр):
    """Маска человека в едином размере: её и сравниваем между кадрами."""
    _, _, сег = _модели()
    if сег is None:
        return None
    м = сег.process(cv2.cvtColor(cv2.resize(кадр, (416, 608)),
                                 cv2.COLOR_BGR2RGB))
    return cv2.resize(м.segmentation_mask, (208, 304)) > 0.5


def совпало(а, б):
    """Доля общего у двух силуэтов. Единица - один и тот же силуэт."""
    if а is None or б is None:
        return 1.0
    return float((а & б).sum()) / (float((а | б).sum()) or 1.0)


def людей(кадр, доля=0.035):
    """Крупных связных фигур в кадре."""
    _, _, сег = _модели()
    if сег is None:
        return 1
    м = (сег.process(cv2.cvtColor(кадр, cv2.COLOR_BGR2RGB))
         .segmentation_mask > 0.6).astype(np.uint8)
    n, _, стат, _ = cv2.connectedComponentsWithStats(м, 8)
    порог = кадр.shape[0] * кадр.shape[1] * доля
    return sum(1 for и in range(1, n) if стат[и, cv2.CC_STAT_AREA] > порог)


def лицо(кадр):
    """Рамка самого крупного лица или None."""
    _, дет, _ = _модели()
    if дет is None:
        return None
    ф = дет.process(cv2.cvtColor(кадр, cv2.COLOR_BGR2RGB))
    if not ф.detections:
        return None
    b = max(ф.detections, key=lambda d: d.location_data
            .relative_bounding_box.width).location_data.relative_bounding_box
    В, Ш = кадр.shape[:2]
    return ((b.xmin + b.width / 2) * Ш, (b.ymin + b.height / 2) * В,
            b.width * Ш, b.height * В, b.ymin - b.height * 0.30)


def кривые_суставы(кадр):
    """Вывернутые колени и локти. Считаем только по видимым костям."""
    поз, _, _ = _модели()
    if поз is None:
        return []
    р = поз.process(cv2.cvtColor(кадр, cv2.COLOR_BGR2RGB))
    if not р.pose_landmarks:
        return []
    л = р.pose_landmarks.landmark
    MP = mp.solutions.pose.PoseLandmark
    беды = []
    for имя, a, b, c in (("колено слева", MP.LEFT_HIP, MP.LEFT_KNEE,
                          MP.LEFT_ANKLE),
                         ("колено справа", MP.RIGHT_HIP, MP.RIGHT_KNEE,
                          MP.RIGHT_ANKLE),
                         ("локоть слева", MP.LEFT_SHOULDER, MP.LEFT_ELBOW,
                          MP.LEFT_WRIST),
                         ("локоть справа", MP.RIGHT_SHOULDER,
                          MP.RIGHT_ELBOW, MP.RIGHT_WRIST)):
        if min(л[a.value].visibility, л[b.value].visibility,
               л[c.value].visibility) < 0.6:
            continue
        A = np.array([л[a.value].x, л[a.value].y])
        B = np.array([л[b.value].x, л[b.value].y])
        C = np.array([л[c.value].x, л[c.value].y])
        v1, v2 = A - B, C - B
        к = float(np.dot(v1, v2) / (np.linalg.norm(v1)
                                    * np.linalg.norm(v2) + 1e-6))
        if np.degrees(np.arccos(np.clip(к, -1, 1))) < 30:
            беды.append(имя)
    return беды


def проверить(данные, силуэт_эталона=None, пара=False, порог_позы=0.55):
    """Беды кадра списком и балл для выбора лучшего из попыток.

    Балл меньше - кадр лучше. Каждая беда весит больше любого
    расхождения позы: кадр без дефектов с неточной позой лучше кадра с
    лишней ногой.
    """
    к = _кадр(данные)
    if к is None:
        return ["кадр не читается"], 99.0
    беды = []
    d = 1.0 - совпало(силуэт(к), силуэт_эталона) if силуэт_эталона is not None else 0.0
    if d > порог_позы:
        беды.append("поза мимо эталона (%.2f)" % d)
    n = людей(к)
    надо = 2 if пара else 1
    if пара and n > 2:
        беды.append("людей в кадре %d" % n)
    elif not пара and n != надо:
        беды.append("людей в кадре %d" % n)
    беды += ["вывернут " + б for б in кривые_суставы(к)]
    л = лицо(к)
    if л is None:
        if not пара:
            беды.append("лица нет в кадре")
    elif л[4] < 0.003:
        беды.append("голова срезана краем")
    return беды, len(беды) * 10.0 + d
