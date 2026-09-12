# Меш из марширующих кубов приезжает РАЗВАРЕННЫМ: у каждого
# треугольника свои три вершины, соседи ничего друг о друге не знают.
# Срезать полигоны на такой сетке нельзя - коллапс рёбер не находит
# рёбер, и модель расползается кусками: тарелка отлетает, корпус
# разваливается пополам. Поэтому первый шаг всегда сварка.
import bpy, sys, os
арг = sys.argv[sys.argv.index("--")+1:]
ВХОД, ВЫХОД, БЮДЖЕТ, СГЛ = арг[0], арг[1], int(арг[2]), float(арг[3])
ГАБАРИТ = float(арг[4]) if len(арг) > 4 else 1.0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ВХОД)
меши = [o for o in bpy.data.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for о in меши: о.select_set(True)
bpy.context.view_layer.objects.active = меши[0]
if len(меши) > 1: bpy.ops.object.join()
о = bpy.context.object
print("ПРИЕХАЛО верш", len(о.data.vertices), "полиг", len(о.data.polygons))

bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=1e-4)
bpy.ops.object.mode_set(mode="OBJECT")
print("СВАРЕНО верш", len(о.data.vertices))

if СГЛ > 0:
    с = о.modifiers.new("сгл", "SMOOTH")
    с.factor = СГЛ; с.iterations = 2
    bpy.ops.object.modifier_apply(modifier="сгл")

было = len(о.data.polygons)
if было > БЮДЖЕТ:
    д = о.modifiers.new("срез", "DECIMATE")
    д.ratio = БЮДЖЕТ / было
    д.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier="срез")

bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")
# Плоские грани помечены как sharp_face, и экспортёр из-за этого
# разрывает каждый угол в свою вершину: файл толстеет втрое.
for п in о.data.polygons: п.use_smooth = True
bpy.ops.object.shade_smooth()

bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
о.location = (0, 0, 0)
г = max(о.dimensions)
if г > 0:
    к = ГАБАРИТ / г
    о.scale = (к, к, к)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

bpy.ops.export_scene.gltf(filepath=ВЫХОД, export_format="GLB", export_apply=True,
                          export_materials="NONE", export_normals=True, export_yup=True)
print("СТАЛО полиг", len(о.data.polygons), "верш", len(о.data.vertices),
      "габарит", [round(v,2) for v in о.dimensions], "БАЙТ", os.path.getsize(ВЫХОД))
