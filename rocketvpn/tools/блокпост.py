# Орбитальный блокпост. Плита для акта 1 «Периметр».
#
#   blender -b -noaudio -P блокпост.py
#
# ЗАЧЕМ ПЛИТА, А НЕ ГЕОМЕТРИЯ В БРАУЗЕРЕ. Акты 0 и 1 намеренно плоские:
# сеть это граф, граф читается сверху, а первый экран обязан появляться
# мгновенно на любом телефоне. Ломать это решение ради объёма нельзя.
#
# Но стена это не граф. Стена это сооружение, и она обязана быть
# железом. Поэтому железо приходит готовым кадром: Blender считает
# тяжёлый свет один раз здесь, браузер кладёт результат за холст и
# двигает его вместе с прокруткой. Ровно тот же приём, на котором стоит
# рубка родственного сайта: фотография плиты плюс живой свет поверх.
#
# ЧТО НА КАДРЕ. Стена блокпоста во всю ширину: броневые сегменты рядами,
# посередине створ ворот, по краям мачты досмотра, за стеной второй слой
# ферм для глубины. Пакеты, лучи досмотра и очередь рисует холст сверху,
# поэтому здесь их нет.
#
# ФОН ПРОЗРАЧНЫЙ. За стеной идёт живой космос акта, и запечённое чёрное
# небо перекрыло бы его.

import bpy, math, os

def чисто():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def короб(имя, sx, sy, sz, x=0, y=0, z=0, rz=0.0, ry=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    о = bpy.context.object
    о.name = имя
    о.scale = (sx, sy, sz)
    о.rotation_euler[2] = rz
    о.rotation_euler[1] = ry
    return о

def цилиндр(имя, r, h, грани, x=0, y=0, z=0, ось="z"):
    bpy.ops.mesh.primitive_cylinder_add(vertices=грани, radius=r, depth=h,
                                        location=(x, y, z))
    о = bpy.context.object
    о.name = имя
    if ось == "x":
        о.rotation_euler[1] = math.pi / 2
    elif ось == "y":
        о.rotation_euler[0] = math.pi / 2
    return о

def сплав(имена, имя):
    объекты = [bpy.data.objects[и] for и in имена if и in bpy.data.objects]
    bpy.ops.object.select_all(action="DESELECT")
    for о in объекты:
        о.select_set(True)
    bpy.context.view_layer.objects.active = объекты[0]
    if len(объекты) > 1:
        bpy.ops.object.join()
    о = bpy.context.object
    о.name = имя
    return о

# Стена стоит в плоскости XZ, камера смотрит вдоль -Y.
СЕГW, СЕГH, СЕГT = 3.05, 2.30, 0.62   # броневой сегмент
ЗАЗОР = 0.16
РЯДОВ, СТОЛБЦОВ = 4, 9
СТВОР_СТ = 4                          # столбец, где стоит створ ворот

def сегмент(ч, имя, x, z, глуб=0.0, крупно=1.0):
    """Броневая плита с фаской, поясом и крепежом."""
    ч.append(короб(имя, СЕГW * крупно, СЕГT, СЕГH * крупно, x=x, y=глуб, z=z).name)
    # Пояс по низу плиты: он и даёт ряду горизонтальный ритм.
    ч.append(короб(имя + "_пояс", СЕГW * крупно * 0.98, СЕГT * 0.30, 0.16,
                   x=x, y=глуб - СЕГT * 0.42, z=z - СЕГH * крупно * 0.40).name)
    # Рёбра жёсткости.
    for i in range(3):
        ч.append(короб(имя + "_ребро%d" % i, 0.10, СЕГT * 0.34, СЕГH * крупно * 0.72,
                       x=x + (i - 1) * СЕГW * крупно * 0.30,
                       y=глуб - СЕГT * 0.44, z=z).name)
    # Крепёж по углам.
    for sx in (-1, 1):
        for sz in (-1, 1):
            ч.append(цилиндр(имя + "_болт%d%d" % (sx, sz), 0.075, 0.10, 6,
                             x=x + sx * СЕГW * крупно * 0.40,
                             y=глуб - СЕГT * 0.50,
                             z=z + sz * СЕГH * крупно * 0.38, ось="y").name)

def собрать():
    чисто()
    ч = []

    ширинаШага = СЕГW + ЗАЗОР
    высотаШага = СЕГH + ЗАЗОР
    x0 = -(СТОЛБЦОВ - 1) / 2 * ширинаШага
    z0 = -(РЯДОВ - 1) / 2 * высотаШага

    # ── Основная стена. Створ ворот проедает середину: там сегментов
    #    нет, там проход.
    for r in range(РЯДОВ):
        for c in range(СТОЛБЦОВ):
            if c == СТВОР_СТ and r in (1, 2):
                continue
            сегмент(ч, "сег%d_%d" % (r, c), x0 + c * ширинаШага, z0 + r * высотаШага)

    # ── Створ ворот: тяжёлая рама и две сдвинутые створки.
    гx = x0 + СТВОР_СТ * ширинаШага
    гz = z0 + 1.5 * высотаШага
    ч.append(короб("рама_л", 0.34, СЕГT * 1.6, высотаШага * 2.2,
                   x=гx - СЕГW * 0.62, y=-0.10, z=гz).name)
    ч.append(короб("рама_п", 0.34, СЕГT * 1.6, высотаШага * 2.2,
                   x=гx + СЕГW * 0.62, y=-0.10, z=гz).name)
    ч.append(короб("рама_в", СЕГW * 1.5, СЕГT * 1.6, 0.34,
                   x=гx, y=-0.10, z=гz + высотаШага * 1.0).name)
    ч.append(короб("рама_н", СЕГW * 1.5, СЕГT * 1.6, 0.34,
                   x=гx, y=-0.10, z=гz - высотаШага * 1.0).name)
    for i, s in enumerate((-1, 1)):
        ч.append(короб("створка%d" % i, СЕГW * 0.52, СЕГT * 0.7, высотаШага * 1.7,
                       x=гx + s * СЕГW * 0.30, y=0.16, z=гz).name)
        for j in range(6):
            ч.append(короб("створка%d_ребро%d" % (i, j), СЕГW * 0.46, 0.10, 0.09,
                           x=гx + s * СЕГW * 0.30, y=0.16 - СЕГT * 0.36,
                           z=гz - высотаШага * 0.7 + j * высотаШага * 0.28).name)

    # ── Мачты досмотра по краям. Они высокие: стена должна уходить за
    #    верхний край кадра, иначе она читается забором, а не сооружением.
    for s in (-1, 1):
        мx = x0 + (СТОЛБЦОВ - 1) * ширинаШага * (0 if s < 0 else 1) + s * ширинаШага * 0.72
        мx = s * ((СТОЛБЦОВ - 1) / 2 * ширинаШага + ширинаШага * 0.70)
        ч.append(цилиндр("мачта%d" % s, 0.24, высотаШага * 7.2, 10,
                         x=мx, y=-0.35, z=высотаШага * 1.4).name)
        for i in range(6):
            z = -высотаШага * 1.6 + i * высотаШага * 1.05
            ч.append(короб("кронштейн%d_%d" % (s, i), 0.70, 0.22, 0.18,
                           x=мx - s * 0.42, y=-0.35, z=z).name)
            ч.append(цилиндр("излучатель%d_%d" % (s, i), 0.17, 0.34, 8,
                             x=мx - s * 0.78, y=-0.35, z=z, ось="y").name)

    # ── Второй слой: фермы за стеной. Они и дают глубину, без них стена
    #    читается декорацией на плоском фоне.
    for c in range(СТОЛБЦОВ + 2):
        x = x0 - ширинаШага + c * ширинаШага
        ч.append(короб("ферма%d" % c, 0.16, 0.16, высотаШага * 6.4,
                       x=x, y=1.9, z=высотаШага * 0.6).name)
    for r in range(5):
        ч.append(короб("связь%d" % r, ширинаШага * (СТОЛБЦОВ + 2), 0.14, 0.14,
                       y=1.9, z=-высотаШага * 1.8 + r * высотаШага * 1.3).name)
    for r in range(4):
        for c in range(СТОЛБЦОВ + 1):
            x = x0 - ширинаШага * 0.5 + c * ширинаШага
            ч.append(короб("раскос%d_%d" % (r, c), 0.09, 0.09, высотаШага * 1.55,
                           x=x, y=1.9, z=-высотаШага * 1.2 + r * высотаШага * 1.3,
                           ry=math.radians(38 if (r + c) % 2 else -38)).name)

    # ── Кожухи и мелочь на лице стены: без неё броня читается кафелем.
    гнёзда = ((-3.2, 2.1, 0.9, 0.5), (2.6, 1.4, 0.7, 0.6), (-8.0, -1.2, 1.1, 0.5),
              (7.4, -2.4, 0.8, 0.6), (-5.6, -3.0, 0.6, 0.5), (5.0, 2.6, 0.9, 0.4),
              (-10.6, 1.6, 0.7, 0.5), (10.2, 0.4, 0.8, 0.5))
    for i, (x, z, sx, sz) in enumerate(гнёзда):
        ч.append(короб("кожух%d" % i, sx, 0.28, sz, x=x, y=-СЕГT * 0.62, z=z).name)
        ч.append(короб("щель%d" % i, sx * 0.7, 0.10, 0.07,
                       x=x, y=-СЕГT * 0.78, z=z + sz * 0.28).name)

    о = сплав(ч, "блокпост")
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    о.location = (0, 0, 0)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.shade_smooth()
    м = о.modifiers.new("фаска", "BEVEL")
    м.width = 0.020
    м.segments = 2
    м.limit_method = "ANGLE"
    м.angle_limit = math.radians(40)
    bpy.ops.object.modifier_apply(modifier="фаска")
    return о


def материал(о):
    м = bpy.data.materials.new("броня")
    м.use_nodes = True
    б = м.node_tree.nodes["Principled BSDF"]
    б.inputs["Base Color"].default_value = (0.052, 0.062, 0.095, 1)
    б.inputs["Metallic"].default_value = 0.78
    б.inputs["Roughness"].default_value = 0.44
    о.data.materials.clear()
    о.data.materials.append(м)


def свет():
    # Ключ холодный слева сверху: это свет открытой сети.
    bpy.ops.object.light_add(type="AREA", location=(-14, -16, 12))
    l = bpy.context.object
    l.data.energy = 46000
    l.data.size = 26
    l.data.color = (0.62, 0.70, 1.0)
    # Контровой янтарный справа: янтарь на этом сайте принадлежит
    # досмотру, и стена обязана быть подсвечена именно им.
    bpy.ops.object.light_add(type="AREA", location=(19, 9, 4))
    l2 = bpy.context.object
    l2.data.energy = 26000
    l2.data.size = 20
    l2.data.color = (1.0, 0.46, 0.20)
    # Тихий подлив снизу, чтобы низ стены не проваливался в ноль.
    bpy.ops.object.light_add(type="AREA", location=(0, -12, -12))
    l3 = bpy.context.object
    l3.data.energy = 9000
    l3.data.size = 30
    l3.data.color = (0.30, 0.36, 0.78)


def камера():
    bpy.ops.object.camera_add(location=(0, -26.0, -1.2))
    c = bpy.context.object
    c.rotation_euler = (math.radians(88), 0, 0)
    c.data.lens = 42
    bpy.context.scene.camera = c


о = собрать()
материал(о)
свет()
камера()

s = bpy.context.scene
s.render.engine = "CYCLES"
s.cycles.samples = 64
s.cycles.use_denoising = True
s.render.resolution_x = 2200
s.render.resolution_y = 1400
s.render.film_transparent = True          # за стеной живой космос акта
s.render.image_settings.file_format = "PNG"
s.render.image_settings.color_mode = "RGBA"
s.render.filepath = "/opt/oko-poster/cab/блокпост.png"
bpy.ops.render.render(write_still=True)
print("КАДР", os.path.getsize("/opt/oko-poster/cab/блокпост.png"))
