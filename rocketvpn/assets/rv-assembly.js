/* Reversible surface assembly. One GPU point field settles onto the actual
   cabin geometry; materials follow the same progress, including scroll back. */
(function (g) {
  "use strict";
  function smooth(a, b, t) { t = Math.max(0, Math.min(1, (t - a) / (b - a))); return t * t * (3 - 2 * t); }
  function build(T, room, parent, options) {
    options = options || {};
    room.updateWorldMatrix(true, true);
    parent.updateWorldMatrix(true, false);
    var inverse = new T.Matrix4().copy(parent.matrixWorld).invert();
    var meshes = [], triangles = [], total = 0, disposed = false;
    var a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
    var ab = new T.Vector3(), ac = new T.Vector3();
    var seed = 71831;
    function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    room.traverse(function (object) {
      if (!object.isMesh || !object.geometry || Array.isArray(object.material) || !object.visible) return;
      for (var ancestor = object.parent; ancestor && ancestor !== room; ancestor = ancestor.parent) {
        if (!ancestor.visible) return;
      }
      var material = object.material;
      if (!material || material.transparent || object.isInstancedMesh) return;
      var attr = object.geometry.getAttribute("position");
      if (!attr) return;
      var matrix = new T.Matrix4().multiplyMatrices(inverse, object.matrixWorld);
      var index = object.geometry.index, count = index ? index.count : attr.count;
      var first = triangles.length;
      var range = object.geometry.drawRange;
      var start = Math.max(0, range.start), end = Math.min(count, start + range.count);
      // Surface-area sampling avoids oversized triangles getting too few grains.
      for (var i = start; i + 2 < end; i += 3) {
        a.fromBufferAttribute(attr, index ? index.getX(i) : i).applyMatrix4(matrix);
        b.fromBufferAttribute(attr, index ? index.getX(i + 1) : i + 1).applyMatrix4(matrix);
        c.fromBufferAttribute(attr, index ? index.getX(i + 2) : i + 2).applyMatrix4(matrix);
        var area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() * 0.5;
        if (!(area > 0.000001)) continue;
        total += area;
        triangles.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, total);
      }
      if (triangles.length === first) return;
      var own = material.clone();
      // Preserve the procedural material hooks provided by RV_REAL.
      own.onBeforeCompile = material.onBeforeCompile;
      own.customProgramCacheKey = material.customProgramCacheKey;
      own.transparent = true;
      own.depthWrite = false;
      object.material = own;
      meshes.push({ object: object, material: own, original: material, visible: object.visible,
        opacity: material.opacity, depthWrite: material.depthWrite });
    });
    if (!triangles.length) return null;
    var count = options.tier === 0 ? 6000 : (options.tier === 1 ? 14000 : 22000);
    var positions = new Float32Array(count * 3), origins = new Float32Array(count * 3), phases = new Float32Array(count);
    for (var n = 0; n < count; n++) {
      var pick = random() * total, low = 0, high = triangles.length / 10 - 1;
      while (low < high) { var mid = (low + high) >> 1; if (triangles[mid * 10 + 9] < pick) low = mid + 1; else high = mid; }
      var at = low * 10, u = Math.sqrt(random()), v = random();
      a.fromArray(triangles, at).multiplyScalar(1 - u)
        .addScaledVector(b.fromArray(triangles, at + 3), u * (1 - v))
        .addScaledVector(c.fromArray(triangles, at + 6), u * v);
      a.toArray(positions, n * 3);
      var theta = random() * Math.PI * 2, radius = 1.6 + random() * 3.5;
      origins[n * 3] = Math.cos(theta) * radius;
      origins[n * 3 + 1] = 1.62 + (random() - 0.5) * 5;
      origins[n * 3 + 2] = 3.8 + Math.sin(theta) * radius;
      phases[n] = random();
    }
    var geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
    geometry.setAttribute("aOrigin", new T.BufferAttribute(origins, 3));
    geometry.setAttribute("aPhase", new T.BufferAttribute(phases, 1));
    var uniforms = { progress: { value: 0 }, pixels: { value: 900 }, alpha: { value: 0 } };
    var material = new T.ShaderMaterial({
      uniforms: uniforms, transparent: true, depthWrite: false, toneMapped: false,
      vertexShader: "attribute vec3 aOrigin; attribute float aPhase; uniform float progress; uniform float pixels; varying float vLight; void main(){float p=smoothstep(aPhase*.12,.82+aPhase*.12,progress); vec3 pos=mix(aOrigin,position,p); float arc=sin(p*3.14159265); pos.x+=sin(aPhase*62.83+p*4.)*arc*.38; pos.y+=arc*.7; vec4 mv=modelViewMatrix*vec4(pos,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(pixels*.008*projectionMatrix[1][1]/max(.2,-mv.z),1.,4.); vLight=.55+.45*aPhase;}",
      fragmentShader: "uniform float alpha; varying float vLight; void main(){vec2 uv=gl_PointCoord-.5; float r=dot(uv,uv); if(r>.25) discard; float edge=1.-smoothstep(.12,.25,r); gl_FragColor=vec4(mix(vec3(.40,.56,.83),vec3(.91,.95,1.),vLight),edge*alpha);}",
      blending: T.NormalBlending
    });
    var field = new T.Points(geometry, material); field.name = "Сборка рубки из частиц";
    field.frustumCulled = false; field.renderOrder = 3; field.visible = false; parent.add(field);
    var settled = false;
    return {
      field: field, count: count,
      update: function (progress, pixels) {
        if (disposed) return;
        var p = Math.max(0, Math.min(1, progress));
        uniforms.progress.value = p;
        uniforms.pixels.value = pixels || 900;
        uniforms.alpha.value = smooth(0, .12, p) * (1 - smooth(.60, .94, p));
        field.visible = uniforms.alpha.value > .001;
        var complete = p >= .999;
        var metal = smooth(.36, .86, p);
        meshes.forEach(function (entry) {
          entry.material.opacity = entry.opacity * metal;
          entry.object.visible = metal > .001;
          if (complete !== settled) {
            entry.material.transparent = !complete;
            entry.material.depthWrite = complete && entry.depthWrite;
            entry.material.needsUpdate = true;
          }
        });
        settled = complete;
      },
      dispose: function () {
        if (disposed) return;
        disposed = true;
        parent.remove(field); geometry.dispose(); material.dispose();
        meshes.forEach(function (entry) {
          if (entry.object.material === entry.material) entry.object.material = entry.original;
          entry.object.visible = entry.visible;
          entry.material.dispose();
        });
        meshes.length = 0;
      }
    };
  }
  g.RV_ASSEMBLY = { build: build, smooth: smooth };
})(window);
