# Приводим меш из фотограмметрии к весу сайта.
#
# Hunyuan3D отдаёт честную, но очень тяжёлую сетку: почти триста тысяч
# треугольников с воксельной лесенкой на поверхности. На сайт такое не
# кладут. Здесь три шага: сгладить лесенку, срезать полигоны до бюджета
# и пересчитать нормали.
import bpy, sys, os, math

ВХОД = sys.argv[sys.argv.index("--") + 1]
ВЫХОД = sys.argv[sys.argv.index("--") + 2]
БЮДЖЕТ = int(sys.argv[sys.argv.index("--") + 3])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ВХОД)
меши = [o for o in bpy.data.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for о in меши:
    о.select_set(True)
bpy.context.view_layer.objects.active = меши[0]
if len(меши) > 1:
    bpy.ops.object.join()
о = bpy.context.object
было = sum(len(p.vertices) - 2 for p in о.data.polygons)

# 1. Лесенку снимаем сглаживанием по объёму, а не размытием нормалей:
#    размытие оставляет ступени в силуэте.
сгл = о.modifiers.new("сгладить", "SMOOTH")
сгл.factor = 0.6
сгл.iterations = 4
bpy.ops.object.modifier_apply(modifier="сгладить")

# 2. Срез до бюджета.
if было > БЮДЖЕТ:
    дец = о.modifiers.new("срез", "DECIMATE")
    дец.ratio = БЮДЖЕТ / было
    bpy.ops.object.modifier_apply(modifier="срез")

bpy.ops.object.shade_smooth()
# 3. Нормали пересчитываем наружу: у меша из вокселей часть граней
#    вывернута, и на сайте это видно чёрными пятнами.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")

# Начало координат в середину, габарит в единицу: сайту удобнее
# масштабировать самому.
bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
о.location = (0, 0, 0)
габ = max(о.dimensions)
if габ > 0:
    о.scale = (1 / габ, 1 / габ, 1 / габ)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

стало = sum(len(p.vertices) - 2 for p in о.data.polygons)
bpy.ops.export_scene.gltf(filepath=ВЫХОД, export_format="GLB",
                          export_apply=True, export_materials="NONE",
                          export_normals=True, export_texcoords=True,
                          export_yup=True)
print("БЫЛО", было, "СТАЛО", стало, "БАЙТ", os.path.getsize(ВЫХОД))
