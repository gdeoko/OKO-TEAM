/* Пробная сцена движка: небо градиентом и яркое солнце выше единицы.
   Нужна одна вещь - убедиться, что договор работает: кадр, свечение,
   линза, источник. Настоящие сцены тем лежат рядом. */
(function () {
  "use strict";
  МИР.сцена("проба", function (о) {
    var T = о.THREE;
    var сцена = new T.Scene();
    var камера = new T.PerspectiveCamera(50, 1, .1, 100);
    камера.position.set(0, 0, 5);
    var небо = new T.Mesh(new T.PlaneGeometry(20, 30), new T.ShaderMaterial({
      uniforms: { t: { value: 0 } },
      vertexShader: "varying vec2 v; void main(){ v = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
      fragmentShader: "varying vec2 v; uniform float t; void main(){ vec3 a = vec3(.02,.03,.08), b = vec3(.9,.45,.12); gl_FragColor = vec4(mix(b, a, smoothstep(.35,.8,v.y)), 1.); }"
    }));
    небо.position.z = -5;
    сцена.add(небо);
    var солнце = new T.Mesh(new T.CircleGeometry(.5, 64), new T.MeshBasicMaterial({ color: new T.Color(6, 5, 3) }));
    солнце.position.set(0, 1.6, -1);
    сцена.add(солнце);
    return {
      сцена: сцена, камера: камера,
      кадр: function (t) { солнце.position.x = Math.sin(t) * .4; },
      размер: function (ш, в) { камера.aspect = ш / в; камера.updateProjectionMatrix(); },
      источник: function () { return { x: о.якоря.ширина * .8, y: о.якоря.высота * .2 }; },
      событие: function () {},
      уничтожить: function () { небо.geometry.dispose(); небо.material.dispose(); солнце.geometry.dispose(); солнце.material.dispose(); }
    };
  });
})();
