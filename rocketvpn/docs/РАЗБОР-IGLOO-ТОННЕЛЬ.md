# Тоннель и частицы igloo.inc: снято с их сборки

Владелец: «открой ещё раз igloo.inc на разделе туннеля и разделе моделей
с частицами и сделай 1:1 как там и движение камеры и модели туннеля и
кольца тунелья и свет и туман и эффекты и освещение и визуальный фон и
частицы и все 1:1 без малейшего изменения».

Источник - боевая сборка сайта, снятая 04.09.2026:

    https://www.igloo.inc/                      -> assets/index-2eb69c09.js
    https://www.igloo.inc/assets/App3D-f554a111.js   (1 487 415 байт)

Ниже - числа из их кода дословно, а не с глаза. Все длины в ИХ единицах
сцены: фигура высотой 0.69, камера с полем 22-30 градусов на дистанции
полутора-трёх единиц. Наш мир крупнее, поэтому подземка собирается в
своих единицах и целиком масштабируется одним числом.

## Состав сцены входа (класс сцены, метод создания)

    roomring          oF   кольцо комнаты, видно при progress > 0.53
    ringforcefield    bF   силовое поле у каждого кольца
    rings             cF   ТРИ РАЗБИТЫХ КОЛЬЦА тоннеля
    containerparticles wF  ФИГУРА ИЗ 150 000 ЧАСТИЦ
    floor             hF   пол комнаты
    lightroom         dF   свет комнаты
    forcefield        uF   силовое поле под фигурой
    textcylinder      fF   цилиндр размытого текста, две копии
    smoketrail        EF   дымные следы, три копии
    snowparticles     CF   «снег» в шахте, 200 точек
    tunnel            SF   ДЫМНАЯ ТРУБА
    plasma            MF   дым у колец, три копии
    ceilingsmoke      TF   дым под потолком
    groundsmoke       IF   дым у пола
    ambientparticles  BF   60 светлячков комнаты

Пост-обработка: `addBloom({levels: 6, luminanceThreshold: 0, intensity: 1,
radius: 0.85})`.

Камера сцены: `fov 25`, `basePosition (0, 5.5, 0)`, `baseTarget (0,0,0)`,
`displacement.position (0.07, 0.025)`, `lerpPosition 0.02`,
`lerpRotation 0.02`, `lerpTarget 0.015`, `shake 0.02`, `shakeSpeed 0.25`.

## ТРУБА (SF) - это ДЫМ, а не стена

    геометрия  Cylinder(1.3, 1.3, 9, 64, 32, открытая)
               translate(0, -4.5, 0), scale(-1, 1, 1)   // вывернута внутрь
               mesh.position.y = 1                       // от +1 до -8
               renderOrder 1, blending additive

Фрагментный шейдер:

    vec2 uv = vUv * vec2(1.0, 0.25);
    uv.x += uv.y;
    float t = time * 0.05;
    float value = texture2D(tWind, uv * 3.0 + vec2(-t, t * 0.7)).r;
    value *= texture2D(tWind, uv * 4.0 + vec2(-t, t * 0.7)).r;
    value *= texture2D(tWind, uv * 6.0 + vec2(-t, t * 0.7)).r;
    float fade = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
    value *= fade;
    float alpha = pow(value, 3.0) * 3.0;
    vec3 color = vec3(0.85, 0.9, 1.0);

Ход: `mesh.rotation.y = upRotation * 0.65`.

## КОЛЬЦА (cF) - три разбитых кольца ПЛАШМЯ

    моделей два: shattered_ring2.drc и shattered_ring.drc, чередуются
    штук 3, шаг 2.5, первое на y = -1.65  ->  -1.65, -4.15, -6.65
    rotation.x = -PI * 0.5        // лежат плашмя, мы падаем сквозь них
    renderOrder 3
    ход: rotation.z = upRotation * 0.4

Материал `lF`. Атрибуты `centr` (середина осколка) и `rand`.

    vFalloff  = falloffsmooth(dist, 14.0, 2.0, 13.0, 0.75)
    glowFalloff = 1.0 - smoothstep(0.2, 0.4, 1.0 - vFalloff)
    vFade     = falloffsmooth(dist, 2.0, 16.0, 9.0, 0.5)   // проявление
    spinFalloff  = falloffsmooth(dist, 8.0, 2.0, 5.0, 0.5)
    spinFalloff2 = falloffsmooth(dist, 10.0, 2.0, 8.0, 0.5)

    // осколок поворачивается вокруг своей середины
    angle = 0.5 * smoothstep(1.5, 12.0, -vPos.z) + firstRingMask * camFactor * 0.5
    pos -= centr * 0.3; pos = rotate3D(pos, normalize(rand*2-1), angle); pos += centr * 0.3;
    // и разлетается наружу
    pos += centr * glowFalloff * mix(0.075, 0.15, rand.z);
    pos += rand.y * centr * glowFalloff * sin(rand.x*5.0 + time*0.5 + (centr.x+centr.y+centr.z)*15.0) * 0.05;
    pos += centr * camFactor * 0.15 * firstRingMask;
    // и всё кольцо закручивается
    pos.xz = rotate(pos.xz, spinFalloff  * PI * 0.3);
    pos.xy = rotate(pos.xy, spinFalloff2 * PI * 0.3 + translation.y * 0.25 + 1.5);

Цвет: карта `tMap`, СМЕШАННАЯ С ЭКРАННЫМ ФОНОМ по vFade:

    vec2 screenUv = gl_FragCoord.xy / resolution;
    float diagonalGradient = (screenUv.x + screenUv.y) * 0.5;
    diagonalGradient *= sinenoise1(vec3(screenUv, time * 0.614)) * 0.5 + 0.5;
    diagonalGradient *= sinenoise1(vec3(screenUv * 2.0, time * 0.17)) * 0.5 + 0.5;
    vec3 bg = mix(#6a6f7d, #e1e6f1, diagonalGradient) * 1.1;
    color = mix(bg, color, vFade * 0.95);
    // свечение из карты затенения
    color += texture2D(tGlow, vUv).r * vec3(0.5, 0.7, 1.0) * n1 * glowFalloff * 0.8 * camFactor;

Это и есть главное отличие от нашей прежней трубы: у них кольцо КАМЕННОЕ
и растворяется в фоне на расстоянии, а не светится неоном.

## ДЫМ У КОЛЕЦ (MF) и СЛЕДЫ (EF)

    plasma      shattered_ring_smoke.drc, три копии на высотах колец
    smoketrail  smoke_trail.drc, три копии, y = -1.6, -4.1, -6.6,
                initialRotation = i * PI/2, ход: rotation.y = init + upRotation * 0.5
                additive, depthTest false, alpha = pow(wind * 2.75, 3.0)

## СНЕГ В ШАХТЕ (CF)

    200 точек в коробке 3 x 8 x 3, mesh.position.y -= 3.5
    pos.y -= mix(0.4, 0.7, fract(...)) * time      // падают
    angle = t*0.5 + pos.y; pos.x += sin(angle)*0.4; pos.z += cos(angle)*0.4;
    pos.xz = rotate(pos.xz, t * 0.5);
    pos = treadmill(pos, vec3(3.0, 4.0, 3.0));     // заворачиваются по кубу
    gl_PointSize = 50.0 / length(mvPos) * (resolution.y / 1300.0)
    alpha: гаснет у концов шахты, к центру, у камеры и вдали, * 0.3
    в кадре точка это ЧЁРТОЧКА: uv поворачивается на vAngle и сжимается
    pow(1 - abs(uv.x - 0.5), floor(rand.y*3 + 2))

## ФИГУРА ИЗ ЧАСТИЦ (wF) - 150 000 точек

    particles 150000, cubeSize 0.65, mesh.position (0, -9.785, 0)
    форма берётся из ОБЪЁМНОЙ ТЕКСТУРЫ модели (VDB, sampler3D):
      volData.rgb -> градиент поверхности, volData.a -> знаковое расстояние

Счёт положения (каждый кадр, в GPGPU):

    // завихрение
    force1 = 0.0002 * (0.7 + 0.3 * rand.z) + 0.0004 * additionalNoise;
    vel += BitangentNoise4D(vec4(pos * 7.0, time * (1.0 + 0.7 * rand.y))) * force1;
    // к своему исходному месту
    vel += (origPos - pos) * 0.001 * invFluidStrength;
    // к поверхности модели
    force2 = 0.0015 * (0.7 + 0.3 * rand.w);
    signForce = mix(0.0, -0.3, sign(dist) + 1.0);
    vel += grad * force2 * signForce * invFluidStrength;
    vel *= friction(0.9);
    pos += vel;
    // и ЗАЖИМ В ЦИЛИНДР, а не в куб
    pos.y = clamp(pos.y, -0.34, 0.35);
    pos.xz = normalize(pos.xz) * clamp(length(pos.xz), 0.0, 0.275);

Затенение частицы (обёрнутый диффуз по градиенту поверхности):

    wrap = 0.25;
    dp = dot(normalize(lightPos), grad);
    wrapDiffuse = max(0.0, (dp + wrap) / (1.0 + wrap));
    wrapDiffuse += max(0.0, -dp) * 0.1;            // отскок
    shadow = mix(wrapDiffuse * 0.2, wrapDiffuse, smoothstep(-0.05, -0.001, dist));

Рисование частицы:

    uSize 10
    gl_PointSize = uSize / length(vPos.xyz) * (resolution.y / 1300.0)
    // круг, а не квадрат
    alpha = step(length(gl_PointCoord - 0.5), 0.5) * uVisible;
    // нормаль полушария
    vec2 uv = 2.0 * gl_PointCoord - 1.0;
    vec3 n = vec3(uv, sqrt(1.0 - clamp(dot(uv, uv), 0.0, 1.0)));
    n.y = 1.0 - n.y;
    float lightShadow = max(0.0, dot(normalize(rotateY(PI) * uLightPos), normalize(n)));
    float ramp = lightShadow * vShadow;
    vec3 color = mix(uColorDark, uColorLight, ramp);
    color = mix(color, uColorFast, pow(fit(vVel, 0.003, 0.005, 0.0, 1.0), 2.0));
    alpha *= max(uInitialGlow, pow(fit(vVel, 0.002, 0.007, 1.0, 0.0), 2.0) * 0.5 + 0.5);

    uColorInitial #b5d5ff   uColorLight #bdc6d4
    uColorDark    #222b42   uColorFast  #d7ebfa
    uLightPos (-0.75, 1, -0.1)
    depthTest true, depthWrite true, transparent, своё смешивание

Вращение фигуры: `uRotation -= delta * 0.00075` (delta в мс), это 0.75
радиана в секунду, то есть сорок три градуса.

ГЛАВНОЕ ПРО ВИД. Частица у них это ЗАТЕНЁННЫЙ ШАРИК от тёмно-синего
#222b42 до светло-серого #bdc6d4, а не светящаяся точка. Из этого и
получается ощущение статуи из песка, а не роя искр. Наш прежний рой
светился аддитивно и читался пылью.

## СВЕТЛЯЧКИ КОМНАТЫ (BF)

    60 точек, коробка 2.5 x 0.5 x 2.5, mesh.position.y = -9.61
    pos.x += sin(t*0.4 + pos.z*2.5) * 0.75;  (и так же y по x, z по y)
    gl_PointSize = mix(7.0, 12.0, random.x) * resolution.y * 0.002
    vLightFalloff = (sin(time*1.8 + random.y*22.43) * 0.4 + 0.6)
                  * smoothstep(0.2, 0.24, length(pos.xz)) * 1.25
    в кадре: circularGrad = pow(pow(1 - length(uv-0.5)*2, 1) * pow(uv.x, 2), 2)
    additive, renderOrder 15

## ЛЕНТА ВРЕМЕНИ СЦЕНЫ ВХОДА (секунды от начала)

    старт: position (0, 1.5, -2), target (0, -2.5, -1)

    0.0   position -> x 0, z 0          2.5s  power2.out
    0.0   target   -> x 0, z 0          2.5s  power2.out
    0.0   fov 22 -> 30                  7.2s  power1.inOut
    0.2   position.y -> -9.83           7.0s  entry_ease_3
    0.2   target.y   -> -10             3.0s  power1.inOut
    1.0   upRotation -> PI              5.25s power3.inOut
    3.2   target.y   -> -9.81           2.5s  power1.inOut
    3.5   upOriginal -> 1               3.7s  entry_ease
    3.5   position.z -> -1.5            3.7s  entry_ease
    7.2   position.z -> -3              2.0s  entry_ease_2
    7.2   target.y   -> -10.35          2.0s  power2.in

Показ и гашение по progress:

    rings.mesh0 < 0.34   mesh1 < 0.43   mesh2 < 0.52
    ringforcefield 0.10-0.34, 0.25-0.43, 0.36-0.52
    plasma         0.06-0.34, 0.25-0.43, 0.35-0.52
    smoketrail     0-0.37,    0-0.47,    0-0.56
    tunnel < 0.52      snowparticles < 0.52      roomring > 0.53
    частицы: видно с 1.5с, uAlpha 0->1 за 2.5с, uInitialGlow 1->0 за 1с с 3.9
    пол: видно с 3.4с, uAlpha 0->1 за 5с
    цилиндр текста: видно с 4.5с

ПАДЕНИЕ ИДЁТ ПО ПРЯМОЙ ВНИЗ. x и z уходят в ноль за первые 2.5 секунды и
дальше не двигаются до 3.5с; всё падение это одна координата y с 1.5 до
-9.83. Никаких заносов вбок и никаких доворотов курса: поворачивается
только ВЕРХ камеры (upRotation) на 180 градусов, то есть кадр катится, а
не виляет. Владелец про это и сказал: «она должна идти вперёд вглубь вниз
и без воротов сразу».
