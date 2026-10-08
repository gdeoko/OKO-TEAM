# Орбитальная станция Rocket VPN. Модель для акта «Выход».
#
# Запускается Blender'ом на сервере агентов, без экрана:
#   blender -b -noaudio -P станция.py
#
# ПОЧЕМУ МОДЕЛЬ, А НЕ ГЕОМЕТРИЯ КОДОМ. Станция из цилиндра, тора и трёх
# коробок читается схемой: у неё нет ни одной детали, которая не нужна
# для формы. Настоящая станция узнаётся по мелочи - фермам, кожухам,
# поручням, стыковочному воротнику. Такое пишется руками в модели за
# час и не пишется кодом никогда.
#
# ЧТО ЭКСПОРТИРУЕМ. Только сетку: положения, нормали, развёртку и
# треугольники. Материалы назначает сайт: цвет станции зависит от того,
# зажжена она или нет, и материал из файла пришлось бы перекрашивать.
#
# БЮДЖЕТ. Три-пять тысяч треугольников. Станций в кадре три плюс
# безымянные огни дальних орбит, а сцена идёт на телефоне.

import bpy, bmesh, math, os

def чисто():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def сплав(имена, имя):
    """Сливает объекты в один и возвращает его."""
    объекты = [bpy.data.objects[и] for и in имена if и in bpy.data.objects]
    if not объекты:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for о in объекты:
        о.select_set(True)
    bpy.context.view_layer.objects.active = объекты[0]
    if len(объекты) > 1:
        bpy.ops.object.join()
    о = bpy.context.object
    о.name = имя
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

def короб(имя, sx, sy, sz, x=0, y=0, z=0, rz=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    о = bpy.context.object
    о.name = имя
    о.scale = (sx, sy, sz)
    о.rotation_euler[2] = rz
    return о

def тор(имя, R, r, N, n, x=0, y=0, z=0, ось="z"):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r,
                                     major_segments=N, minor_segments=n,
                                     location=(x, y, z))
    о = bpy.context.object
    о.name = имя
    if ось == "x":
        о.rotation_euler[1] = math.pi / 2
    elif ось == "y":
        о.rotation_euler[0] = math.pi / 2
    return о

def собрать():
    чисто()
    части = []

    # ── Хребет. Станция вытянута вдоль оси X: так она читается
    #    кораблём на приколе, а не башней.
    части.append(цилиндр("хребет", 0.30, 6.0, 12, ось="x").name)

    # Кожухи на хребте: без них труба выглядит трубой.
    for i, x in enumerate((-1.9, -0.4, 1.2, 2.4)):
        части.append(короб("кожух%d" % i, 0.62, 0.52, 0.42, x=x, z=0.30).name)

    # ── Два жилых кольца. Разного диаметра: одинаковые читаются
    #    повтором, разные - назначением.
    части.append(тор("кольцо1", 1.55, 0.16, 26, 8, x=-1.2, ось="x").name)
    части.append(тор("кольцо2", 1.10, 0.14, 22, 8, x=1.6, ось="x").name)

    # Спицы колец: кольцо, висящее в воздухе, читается обручем.
    for кольцо, R, x in (("сп1", 1.55, -1.2), ("сп2", 1.10, 1.6)):
        for i in range(4):
            a = i * math.pi / 2 + math.pi / 4
            о = короб("%s_%d" % (кольцо, i), 0.10, R, 0.10,
                      x=x, y=math.cos(a) * R / 2, z=math.sin(a) * R / 2)
            о.rotation_euler[0] = a
            части.append(о.name)

    # ── Фермы под панели. Ферма это не палка: у неё есть раскосы.
    for знак in (-1, 1):
        части.append(короб("ферма%d" % знак, 0.12, 2.2, 0.12,
                           x=0.2, y=знак * 1.6).name)
        for i in range(5):
            t = -1.0 + i * 0.5
            о = короб("раскос%d_%d" % (знак, i), 0.05, 0.42, 0.05,
                      x=0.2, y=знак * (1.6 + t * 0.0) + t * 0.0)
            о.location = (0.2, знак * (0.7 + i * 0.42), 0.0)
            о.rotation_euler[0] = math.pi / 4 if i % 2 else -math.pi / 4
            части.append(о.name)

    # ── Панели. Тонкие, с рёбрами: плоская плита читается картонкой.
    for знак in (-1, 1):
        части.append(короб("панель%d" % знак, 1.5, 2.6, 0.035,
                           x=0.2, y=знак * 3.1).name)
        for i in range(5):
            части.append(короб("ребро%d_%d" % (знак, i), 1.5, 0.04, 0.06,
                               x=0.2, y=знак * (1.9 + i * 0.6), z=0.05).name)

    # ── Стыковочный воротник спереди: это причал, к нему идут корабли.
    части.append(цилиндр("воротник", 0.52, 0.34, 16, x=3.2, ось="x").name)
    части.append(тор("кромка", 0.52, 0.07, 16, 6, x=3.38, ось="x").name)
    for i in range(6):
        a = i * math.pi / 3
        части.append(короб("зуб%d" % i, 0.10, 0.14, 0.14,
                           x=3.42, y=math.cos(a) * 0.52,
                           z=math.sin(a) * 0.52).name)

    # ── Тарелка связи. Одна и заметная: это её работа.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.62,
                                         location=(-2.6, 0, 1.15))
    о = bpy.context.object
    о.name = "тарелка"
    bm = bmesh.new()
    bm.from_mesh(о.data)
    for в in list(bm.verts):
        if в.co.z < 0.25:
            bm.verts.remove(в)
    bm.to_mesh(о.data)
    bm.free()
    о.scale = (1.0, 1.0, 0.42)
    части.append(о.name)
    части.append(цилиндр("штанга", 0.06, 0.9, 8, x=-2.6, z=0.75).name)

    # ── Мелочь по корпусу. Она и делает станцию станцией.
    for i in range(14):
        a = i * 0.72
        части.append(короб("мелочь%d" % i, 0.16, 0.16, 0.10,
                           x=-2.6 + i * 0.42,
                           y=math.cos(a) * 0.31,
                           z=math.sin(a) * 0.31, rz=a).name)

    о = сплав(части, "станция")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.shade_smooth()
    # Фаска даёт кромке блик: без неё металл читается пластиком.
    м = о.modifiers.new("фаска", "BEVEL")
    м.width = 0.012
    м.segments = 1
    м.limit_method = "ANGLE"
    м.angle_limit = math.radians(40)
    bpy.ops.object.modifier_apply(modifier="фаска")

    # Развёртка нужна под будущие карты: без неё текстуру класть некуда.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    return о


о = собрать()
треуг = sum(len(p.vertices) - 2 for p in о.data.polygons)
путь = "/opt/oko-poster/cab/станция.glb"
bpy.ops.export_scene.gltf(filepath=путь, export_format="GLB",
                          export_apply=True, export_materials="NONE",
                          export_normals=True, export_texcoords=True,
                          export_yup=True)
print("ГОТОВО треугольников", треуг, "байт", os.path.getsize(путь))
