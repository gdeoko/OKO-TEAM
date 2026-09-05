# Разбор кода igloo.inc: сверенные находки

Здесь то, что вычитано ИЗ ИХ БОЕВОГО БАНДЛА (`/tmp/igloo/App3D.pretty.js`,
около 20600 строк распечатанного кода) десятью разборщиками по
направлениям. Каждую находку потом проверял отдельный сверщик: открывал
указанную строку и смотрел, есть ли там названное число дословно. Всё,
что не подтвердилось, выброшено и перечислено в конце каждого раздела.

Дополняет `РАЗБОР-IGLOO-ЖИВОЙ.md`, где то же самое снято с их картинки.
Там - что видно глазом и числа палитры; здесь - что написано в коде.


## ЗАГРУЗКА

### DOM-предзагрузчик (единственный HTML-оверлей). Файл /tmp/igloo/igloo-main.js (НЕ App3D), Svelte-компонент Ht. Никакого канваса, SVG и сетки в нём нет: это div#loader на весь экран с одной строкой ASCII-бегунка через CSS content в псевдоэлементе .ascii:before. ПОДТВЕРЖДЕНО ДОСЛОВНО, строки 6-141 файла igloo-main.js

**Числа.** font-size: 17px (стр. 30); font-family: monospace (31); font-weight: bold (32); color #ffffff (28); text-shadow: 0px 0px 5px rgba(255,255,255,0.4) (36); animation-name: head (33); animation-duration:5s (34); animation-iteration-count: infinite (35); ровно 101 кейфрейм 0%..100% с шагом 1% (строки 40-140); базовая строка content: '----------' (стр. 29, 10 знакомест из '-', '=', '+'); фон background-color: var(--bgColor) = #A0A5B1; pointer-events: none; flex column, justify-content/align-items/align-content: center; will-change: opacity. DOM: div#loader > div.ascii + <style>

```glsl
div#loader {
    display: flex;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;

    background-color: var(--bgColor);
    will-change: opacity;

    flex-direction: column;
    flex-wrap: nowrap;
    justify-content: center;
    align-items: center;
    align-content: center;

    pointer-events: none;
}

.ascii:before {
    position: relative;
    color: #ffffff;
    content: '----------';
    font-size: 17px;
    font-family: monospace;
    font-weight: bold;
    animation-name: head;
    animation-duration:5s;
    animation-iteration-count: infinite;
    text-shadow: 0px 0px 5px rgba(255,255,255,0.4);
}

@keyframes head {
    0% {content: '---===+++='}
    1% {content: '----===+++'}
    2% {content: '-----===++'}
    3% {content: '------===+'}
    4% {content: '=------==='}
    ...
    98% {content: '==+++===--'}
    99% {content: '===+++===-'}
    100% {content: '===+++===-'}
}
// разметка: U(e,"class","ascii"), U(n,"id","loader")
```

**Что делать у нас.** Один div#loader на весь экран, фон #A0A5B1, по центру пустой div.ascii, у него ::before с monospace 17px bold белым и свечением, 101 кейфрейм с подменой content — бегущая волна '-' → '=' → '+' по 10 знакоместам, цикл 5с infinite. Проценты нигде не показываются, прогресс-бара нет. Файл: /tmp/igloo/igloo-main.js, строки 6-141.

Строка бандла: 6

### Скрытие предзагрузчика: два раздельных fade-out через svelte fade + собственная кривая cubicInOut, и только после resolve App3D.ready. Порядок монтирования: new Ht({target}) → show() → динамический import('./App3D-f554a111.js') → await new App3D(...).ready → hide() → 'outroend' → dispatch('hidden') → $destroy. ПОДТВЕРЖДЕНО

**Числа.** .ascii — fade duration:250 ms, easing G; #loader — fade duration:750 ms, easing G; G = cubicInOut = t<.5 ? 4*t*t*t : .5*Math.pow(2*t-2,3)+1 (определение на строке 5); J = fade, css: i=>`opacity: ${i*r}`, где r = текущий computed opacity; дефолт svelte-перехода duration 300 не используется — оба переопределены

```glsl
o(l){o=W(e,J,{duration:250,easing:G}),c=W(n,J,{duration:750,easing:G}),f=!1}
// e = div.ascii, n = div#loader
// строка 5: function G(t){return t<.5?4*t*t*t:.5*Math.pow(2*t-2,3)+1}
// строка 5: function J(t,{delay:n=0,duration:e=400,easing:o=Z}={}){const r=+getComputedStyle(t).opacity;
//            return{delay:n,duration:e,easing:o,css:i=>`opacity: ${i*r}`}}
// строка 141, точка входа:
(async t=>{ let n=null; t?.cnt?n=t.cnt:(n=document.createElement("div"),n.id="app",document.body.prepend(n));
 const e=new Ht({target:n}); e==null||e.show();
 const o=(await mt(()=>import("./App3D-f554a111.js"),[])).default,
 i=await new o({target:n,props:{interactionNode:t?.interactionNode,relativePath:t?.relativePath},...e?{anchor:e.getEl()}:{}}).ready;
 return e&&await new Promise(c=>{e.$on("hidden",()=>{e.$destroy(),c()}),e.hide()}),i==null?void 0:i()})();
```

**Что делать у нас.** Текст гасим за 250 мс, полотно-подложку за 750 мс, обе по cubicInOut. Гасить не по таймеру, а по разрешению промиса готовности 3D-приложения. Файл /tmp/igloo/igloo-main.js, строка 141.

Строка бандла: 141

### Скролла на странице физически нет — блокировка на уровне CSS документа, стили инжектятся в <style> из переменной pt. Прокрутка целиком виртуальная, эмулируется событиями wheel/keydown/touch_drag через шину Q. ПОДТВЕРЖДЕНО ДОСЛОВНО

**Числа.** html,html body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background-color:var(--bgColor);touch-action:none;-webkit-text-size-adjust:100%;text-size-adjust:100%} ; #app{display:block;position:absolute;top:0;left:0;width:100%;height:100%;margin:0;padding:0;overflow:hidden} ; html{--default-font: sans-serif;--bgColor: #A0A5B1} ; viewport = "width=device-width, initial-scale=1.0, shrink-to-fit=no, minimal-ui, viewport-fit=cover"

```glsl
pt=`html{text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}html,html body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background-color:var(--bgColor);touch-action:none;-webkit-text-size-adjust:100%;text-size-adjust:100%}html body .click{cursor:pointer}html body #app{display:block;position:absolute;top:0;left:0;width:100%;height:100%;margin:0;padding:0;overflow:hidden}...html{--default-font: sans-serif;--bgColor: #A0A5B1}`
// строка 141: const ut=document.createElement("style");ut.textContent=pt;document.head.append(ut);
```

**Что делать у нас.** html и body — 100%/100%, overflow:hidden, touch-action:none, #app абсолютный на весь экран с overflow:hidden. Никакого нативного скролла вообще. Файл /tmp/igloo/igloo-main.js, строка 1.

Строка бандла: 1

### Реальная блокировка прокрутки до конца загрузки+интро: подписка на события ввода вешается ТОЛЬКО после того, как отыграла вступительная анимация. enableScroll/disableScroll в главном контроллере jF; плюс отдельный флаг scrollBlocked внутри обработчиков. ПОДТВЕРЖДЕНО, строка 20656 (одна гигантская строка бандла)

**Числа.** scrollMultiplier = 75e-5 (0.00075), задан в конструкторе jF; scrollBlocked изначально !1 (false); ArrowDown прибавляет 150*scrollMultiplier, ArrowUp вычитает 150*scrollMultiplier; onTouchDrag прибавляет e.delta11.y*1.25 (НЕ через scrollMultiplier); инерция скролла: lerpFPSLimited(targetY1, targetY2, .075, 100*scrollMultiplier); enableScroll() вызывается ровно в 2 местах бандла, оба внутри navigateToSection

```glsl
enableScroll(){Q.on("wheel",this.onScroll,this),Q.on("keydown",this.onKeyDown,this),Q.on("touch_drag",this.onTouchDrag,this)}
disableScroll(){Q.off("wheel",this.onScroll,this),Q.off("keydown",this.onKeyDown,this),Q.off("touch_drag",this.onTouchDrag,this)}
onScroll(e){this.scrollBlocked||(this.stopAutoCenter(),this.scroll.targetY2+=e.delta.y*this.scrollMultiplier)}
onKeyDown(e){this.scrollBlocked||(this.stopAutoCenter(),e.key==="ArrowDown"&&(this.scroll.targetY2+=150*this.scrollMultiplier),e.key==="ArrowUp"&&(this.scroll.targetY2-=150*this.scrollMultiplier))}
onTouchDrag(e){this.scrollBlocked||(this.stopAutoCenter(),this.scroll.targetY2+=e.delta11.y*1.25)}
// конструктор: this.scroll={total:0,targetY1:0,targetY2:0,y:0,velocity:0},
//   this.autoCenter={needed:!1,animating:!1,lastTarget:0,lastTime:0},
//   this.scrollMultiplier=75e-5,this.scrollBlocked=!1
```

**Что делать у нас.** Не «глушить» скролл флагом, а просто НЕ подписываться на wheel/keydown/touch_drag, пока не отыграет интро. Подписка = enableScroll() ровно один раз, в конце первой навигации на 'home'.

Строка бандла: 20656

### Точка, где скролл включается: navigateToSection('home') при isFirstNavigation. Сначала параллельно проявление кадра (uIntro загрузочного материала) и полная интро-анимация сцены, и только потом enableScroll(). ПОДТВЕРЖДЕНО ДОСЛОВНО

**Числа.** gsap.fromTo(materialLoad.uniforms.uIntro, {value:0} → {value:1, duration:1, ease:"inOut3"}); playInAnimation(){this.introTL.play(0), await gsap.delayedCall(5)} — ждёт ровно 5 секунд; Promise.all из двух этих анимаций, то есть суммарная задержка до enableScroll = max(1с, 5с) = 5с; перед этим emit("webgl_router_block_navigation",!0); второй вызов enableScroll (возврат из детали) идёт через delayedCall(1)

```glsl
async navigateToSection(e="home",t="/",s={}){if(this.currentSection!==e){if(Q.emit("webgl_router_block_navigation",!0),e==="home")this.isFirstNavigation?(this.isFirstNavigation=!1,this.mainMesh.material=this.materialLoad,await Promise.all([re.fromTo(this.materialLoad.uniforms.uIntro,{value:0},{value:1,duration:1,ease:"inOut3"}),this.scrollComposers[0].passes[0].scene.playInAnimation()]),this.mainMesh.material=this.material,this.enableScroll()):(this.centerDetailScene(0),this.detailIndex=0,re.to(this.material.uniforms.uDetailProgress,{overwrite:!0,value:0,ease:"power2.out",duration:1.25}),re.to(this.material.uniforms.uDetailProgress2,{overwrite:!0,value:0,ease:"power2.out",duration:.6}),this.scrollComposers[1].passes[0].scene.detailAnimationOut(),this.detailScene.playOutAnimation(),Q.emit("webgl_play_audio","leave-project"),await re.delayedCall(1,()=>{this.isDetailOpen=!1,this.enableScroll()}));
// строка 16312: async playInAnimation(){this.introTL.play(0),await re.delayedCall(5,()=>{})}
```

**Что делать у нас.** Порядок ровно такой: материал главного треугольника переключается на «загрузочный», за 1с ease inOut3 uIntro идёт 0→1, параллельно играет интро-таймлайн сцены (внутри ждёт 5 секунд), затем материал возвращается на боевой и вызывается enableScroll().

Строка бандла: 20656

### Загрузочный полноэкранный материал p3 (this.materialLoad): плоская заливка серо-синим, из которой «проявляется» отрендеренная сцена. Именно он держит кадр, пока предзагрузчик уже погас. ПОДТВЕРЖДЕНО ДОСЛОВНО, строка 14612

**Числа.** uColor = new Color("#8b909d"); uIntro нач. 0; tScene: null; depthTest:false, depthWrite:false; вершинный шейдер без матриц — gl_Position = vec4(position,1.0) (полноэкранный треугольник Si.triangle); оба материала (боевой f3 и загрузочный p3) прогреваются через he.renderPass.scene._upload() ещё в initGlobalPlane

```glsl
class p3 extends fe{constructor(){super({uniformsGroups:[he.UBO],uniforms:{tScene:{value:null},uColor:{value:new Z("#8b909d")},uIntro:{value:0}},vertexShader:`
                //- edit
                varying vec2 vUv;

                void main() {
                    vUv = uv;
                    gl_Position = vec4(position, 1.0);
                }
            `,fragmentShader:`
                //- edit
                ${ae}

                uniform sampler2D tScene;
                uniform float uIntro;
                uniform vec3 uColor;

                varying vec2 vUv;

                void main() {
                    vec4 scene = texture2D(tScene, vUv);
                    vec3 color = scene.rgb;

                    // final overlay
                    color = mix(uColor, color, uIntro);

                    // color
                    gl_FragColor = vec4(color, 1.0);
                }
            `,depthTest:!1,depthWrite:!1})}}
// строка 20656: initGlobalPlane(){const e=Si.triangle;this.material=new f3,this.materialLoad=new p3,
//   this.mainMesh=new Ce(e,this.material),this.mainMesh.frustumCulled=!1,
//   he.renderPass.scene.add(this.mainMesh),this.mainMesh.material=this.material,
//   he.renderPass.scene._upload(),this.mainMesh.material=this.materialLoad,he.renderPass.scene._upload()}
```

**Что делать у нас.** Полноэкранный треугольник с фрагментным шейдером color = mix(#8b909d, texture2D(tScene,vUv).rgb, uIntro), uIntro тянем 0→1 за 1 с ease inOut3. Пока uIntro=0 — экран залит #8b909d, стык с предзагрузчиком #A0A5B1 незаметен. Оба варианта материала прогреть (_upload) заранее, чтобы не было хитча при переключении.

Строка бандла: 14612

### САМА «рисованная сетка» — это не 2D и не SVG, а wireframe самой сцены: два THREE.LineSegments из Draco-геометрий igloo_cage.drc и igloo_outline.drc. Классы w3 (клетка, стр. 14952) и C3 (контур, стр. 14993). ПОДТВЕРЖДЕНО. Уточнение номеров: yr = LineSegments (объявление класса стр. 11501, isLineSegments/type="LineSegments" стр. 11503), ga = LineBasicMaterial (класс стр. 11425, this.linewidth=1 стр. 11427), pt = 2 = AdditiveBlending (стр. 8, в ряду qt=0,_o=1,pt=2,Ng=3)

**Числа.** цвет линий color:"#a7b2d6", opacity:.3, transparent:true, depthTest:false, depthWrite:false, blending: pt = 2 = AdditiveBlending, frustumCulled:false, renderOrder:999 — у обоих. Разница: cage visible = !q.devScene, outline visible = true. Толщина линии — LineBasicMaterial.linewidth = 1 (дефолт из стр. 11427, в WebGL всегда 1 px, в опциях материала не переопределяется). Контур доп. считает uScrollAlpha каждый кадр: ease(fit(scene.progress, 0, .35, 1, 0), "sine.in") * 2

```glsl
class w3{constructor(e){this.scene=e,this.ready=new Promise(t=>{this.isReady=t}),this.init()}async init(){const e=await zt.load("igloo/igloo_cage.drc"),t=new _3({color:"#a7b2d6",opacity:.3,transparent:!0});t.depthTest=!1,t.depthWrite=!1,t.blending=pt,t.transparent=!0,this.mesh=new yr(e,t),this.mesh.frustumCulled=!1,this.mesh.visible=!q.devScene,this.mesh.name="igloo_cage",this.mesh.renderOrder=999,this.scene.add(this.mesh),this.isReady()}}

class C3{constructor(e){this.scene=e,this.ready=new Promise(t=>{this.isReady=t}),this.init()}async init(){const e=await zt.load("igloo/igloo_outline.drc"),t=new E3({color:"#a7b2d6",opacity:.3,transparent:!0});t.depthTest=!1,t.depthWrite=!1,t.blending=pt,t.transparent=!0,this.mesh=new yr(e,t),this.mesh.frustumCulled=!1,this.mesh.visible=!0,this.mesh.name="igloo_outline",this.mesh.renderOrder=999,this.scene.add(this.mesh),this.mesh.onBeforeRender=()=>{const s=ie.ease(ie.fit(this.scene.progress,0,.35,1,0),"sine.in")*2;this.mesh.material.uniforms.uScrollAlpha.value=s},this.isReady()}}
```

**Что делать у нас.** Взять реальную геометрию домика, отдельно экспортировать её рёбра/каркас в два Draco-файла (cage — сетка объёма, outline — контур), грузить как LineSegments с LineBasicMaterial #a7b2d6, opacity 0.3, additive, depthTest/depthWrite off, renderOrder 999. Никаких случайных ромбиков — это буквально рёбра модели, EdgesGeometry в рантайме не считается.

Строка бандла: 14952

### Материал _3 «клетки» (igloo_cage): расходящаяся от центра ударная волна по радиусу мира + постоянное мерцание. Наследник LineBasicMaterial (ga), доработан через onBeforeCompile; в вершинном шейдере берётся центроид треугольника (attribute centr), а не позиция. ПОДТВЕРЖДЕНО ДОСЛОВНО, строки 14916-14952

**Числа.** uProgress нач. 1, uAlpha = .185; vWorldPos = (modelMatrix * vec4(centr,1.0)).xyz — по ЦЕНТРОИДУ; falloff(intro_gradientInput, 0.0, 20.0, 5.0, uProgress) — волна от радиуса 0 до 20 мировых единиц с мягкой каймой 5.0; idleAnimation = sin(vColor.r*13.0 + time*6.0)*0.5+0.5; подмена идёт в '#include <skinning_vertex>' и '#include <dithering_fragment>'

```glsl
let _3=class extends ga{constructor(){super(),this.uniforms={uniformsGroups:[he.UBO],uProgress:{value:1},uAlpha:{value:.185}},this.onBeforeCompile=e=>{e.uniforms={...e.uniforms,...this.uniforms},e.vertexShader=`
                attribute vec3 color;
                attribute vec3 centr;

                varying vec3 vColor;
                varying vec3 vWorldPos;
                varying vec3 vCentr;

                ${e.vertexShader}
            `,e.vertexShader=e.vertexShader.replace("#include <skinning_vertex>",`
                vColor = color;
                vCentr = centr;
                vWorldPos = (modelMatrix * vec4(centr, 1.0)).xyz;
            `),e.fragmentShader=`
                ${ae}
                ${Ue}

                varying vec3 vColor;
                varying vec3 vCentr;
                varying vec3 vWorldPos;

                uniform float uProgress;
                uniform float uAlpha;

                ${e.fragmentShader}
            `,e.fragmentShader=e.fragmentShader.replace("#include <dithering_fragment>",`
                    float intro_gradientInput = length(vWorldPos);
                    float intro_shockwave = falloff(intro_gradientInput, 0.0, 20.0, 5.0, uProgress);

                    float alpha = uAlpha;
                    alpha *= intro_shockwave;

                    float idleAnimation = sin(vColor.r * 13.0 + time * 6.0) * 0.5 + 0.5;
                    alpha *= idleAnimation;

                    gl_FragColor.a = alpha;
            `)}}};
```

**Что делать у нас.** Линии клетки не появляются все разом: альфа = uAlpha(0.185) * falloff(радиус_от_центроида, 0, 20, margin 5, uProgress) * мерцание sin(vColor.r*13 + time*6)*0.5+0.5. uProgress тянуть 0→1 за 4 с ease sine.inOut. Нужен доп. атрибут centr (центроид треугольника) в геометрии.

Строка бандла: 14916

### Материал E3 «контура» (igloo_outline): проявление сверху вниз по мировой высоте Y + мерцание тройной синусоидой по XYZ + отдельная альфа под скролл. ПОДТВЕРЖДЕНО ДОСЛОВНО, строки 14952-14993

**Числа.** uProgress:1, uAlpha:1, uScrollAlpha:0, uIntroMaterialize:0. ВАЖНОЕ ОТЛИЧИЕ ОТ КЛЕТКИ: здесь vWorldPos = (modelMatrix * vec4(position,1.0)).xyz — по позиции вершины, не по centr. alpha = mix(uAlpha, 1.0, uScrollAlpha); falloffsmooth(vWorldPos.y, 3.5, 0.1, 2.0, uIntroMaterialize) — от y=3.5 до y=0.1, кайма 2.0. idleAnimation: sin(vWorldPos.y*6.0 + time*5.0)*0.5+0.5, умножить на cos(vWorldPos.z*6.0 + time*5.0)*0.5+0.5, умножить на sin(vWorldPos.x*6.0 + time*5.0)*0.5+0.5, затем *0.8 + 0.2. uScrollAlpha = ease(fit(scene.progress, 0, .35, 1, 0), "sine.in") * 2

```glsl
e.fragmentShader=e.fragmentShader.replace("#include <dithering_fragment>",`
                    // intro materialize effect

                    float alpha = mix(uAlpha, 1.0, uScrollAlpha);
                    float idleAnimation = sin(vWorldPos.y * 6.0 + time * 5.0) * 0.5 + 0.5;
                    idleAnimation *= cos(vWorldPos.z * 6.0 + time * 5.0) * 0.5 + 0.5;
                    idleAnimation *= sin(vWorldPos.x * 6.0 + time * 5.0) * 0.5 + 0.5;
                    idleAnimation = idleAnimation * 0.8 + 0.2;
                    alpha *= idleAnimation;

                    // materialize effect
                    alpha *= falloffsmooth(vWorldPos.y, 3.5, 0.1, 2.0, uIntroMaterialize);

                    gl_FragColor.a = alpha;
            `)
// вершинный (стр. 14961-14964):
// e.vertexShader.replace("#include <skinning_vertex>", `
//     vColor = color; vCentr = centr;
//     vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz; `)
```

**Что делать у нас.** Контур домика «рисуется» сверху вниз: alpha *= falloffsmooth(worldY, 3.5, 0.1, margin 2.0, uIntroMaterialize), uIntroMaterialize 0→1 за 2.5 с ease power3.inOut в самом начале таймлайна (позиция 0). Плюс тройное мерцание по XYZ и отдельный uScrollAlpha, который на скролле выводит контур в полную непрозрачность.

Строка бандла: 14979

### Функции проявления линий — falloff и falloffsmooth (GLSL-чанк бандла, строка 13252). Это единственный механизм «порядка появления» линий: start/end задаёт диапазон входной величины (радиус или высота), margin — ширину мягкого фронта, progress — положение фронта. ПОДТВЕРЖДЕНО ДОСЛОВНО, все 6 перегрузок + вспомогательные _linstep и _pl

**Числа.** float m = margin*sign(end-start); float p = mix(start-m, end, progress); falloff = _linstep(p+m, p, _input); falloffsmooth = smoothstep(p+m, p, _input). _linstep(begin,end,t) = clamp((t-begin)/(end-begin), 0.0, 1.0). Для vec2/vec3 через _pl: dot(dir, _input-start-dir*(dist+margin)*progress), где v=end-start, dist=length(v), dir=v/dist

```glsl
float _linstep(float begin,float end,float t){return clamp((t-begin)/(end-begin),0.0,1.0);}
float _pl(vec2 _input,vec2 start,vec2 end,float margin,float progress){vec2 v=end-start;float dist=length(v);vec2 dir=v/dist;return dot(dir,_input-start-dir*(dist+margin)*progress);}
float falloff(float _input,float start,float end,float margin,float progress){float m=margin*sign(end-start);float p=mix(start-m,end,progress);return _linstep(p+m,p,_input);}
float falloffsmooth(float _input,float start,float end,float margin,float progress){float m=margin*sign(end-start);float p=mix(start-m,end,progress);return smoothstep(p+m,p,_input);}
float falloff(vec2 _input,vec2 start,vec2 end,float margin,float progress){return _linstep(0.0,-margin,_pl(_input,start,end,margin,progress));}
float falloffsmooth(vec2 _input,vec2 start,vec2 end,float margin,float progress){return smoothstep(0.0,-margin,_pl(_input,start,end,margin,progress));}
float falloff(vec3 _input,vec3 start,vec3 end,float margin,float progress){return _linstep(0.0,-margin,_pl(_input,start,end,margin,progress));}
float falloffsmooth(vec3 _input,vec3 start,vec3 end,float margin,float progress){return smoothstep(0.0,-margin,_pl(_input,start,end,margin,progress));}
```

**Что делать у нас.** Скопировать все функции дословно вместе с _linstep и _pl. Весь эффект «рисующейся сетки» у igloo — это они: один uniform progress двигает мягкий фронт по любой скалярной величине (радиус length(worldPos.xz), высота worldPos.y), и линии/треугольники проявляются волной, а не все сразу.

Строка бандла: 13252

### Сетка ПОВЕРХНОСТИ (земля/террейн/горы/патчи): не геометрия, а тайловая текстура треугольников triangles_tiling.ktx2 + шумовая mosaic.ktx2, композитятся двумя слоями синей ударной волны прямо во фрагментном шейдере. Один и тот же блок ДОСЛОВНО повторён 4 раза: y3 (ground.drc, mesh.name="igloobase", стр. 14866), S3 (mountain.drc, стр. 15068), M3 (ground.drc + ground_sansigloo_color, «terrain», стр. 15277), b3 (igloo/patch.drc, «terrainpatches», стр. 15463). ПОДТВЕРЖДЕНО

**Числа.** vec3 blue = vec3(0.3, 0.45, 1.0); noise = texture2D(tNoise, vWorldPos.xz*0.07).r; triangles = texture2D(tTriangles, vWorldPos.xz*0.25).r; inputGradient = length(vWorldPos.xz) + noise*3.5; terrainFalloff = 1.0 - falloffsmooth(inputGradient, 0.0, 32.0, 8.0, uProgress2); terrainFalloff2 = 1.0 - falloffsmooth(inputGradient, 0.0, 32.0, 3.0, uProgress2); terrainShockwaveColor += terrainFalloff*triangles*blue*3.0; += terrainFalloff2*blue; terrainShockwaveAlpha += falloff(inputGradient, -0.1, 31.9, 0.1, uProgress2); triangleFalloff = 1.0 - falloffsmooth(inputGradient, 0.0, 32.0, 10.0, uProgress); triangleShockwaveAlpha += falloff(inputGradient, 1.0, 33.0, 0.1, uProgress). ИСПРАВЛЕНИЕ: затухание по краям РАЗНОЕ у каждого класса — igloobase smoothstep(0.8,1.0,length(vPos.xz)*0.1085) (стр.14905), mountain smoothstep(0.7,0.9,...*0.1085) (15134), terrain smoothstep(0.85,1.0,...*0.1085) (15337), terrainpatches smoothstep(0.3,0.48,length(vPos.xz)) БЕЗ множителя 0.1085 (15523)

```glsl
// intro animation
                    if (uProgress2 < 1.0) {
                        // reduce alpha to zero so we can composite layers onto it
                        alpha *= 0.0;

                        // create input textures and values
                        float noise = texture2D(tNoise, vWorldPos.xz * 0.07).r;
                        float triangles = texture2D(tTriangles, vWorldPos.xz * 0.25).r;
                        vec3 blue = vec3(0.3, 0.45, 1.0);
                        float inputGradient = length(vWorldPos.xz);
                        inputGradient += noise * 3.5;

                        // terrain layer
                        vec3 terrainShockwaveColor = vec3(0.0);
                        float terrainShockwaveAlpha = 0.0;
                        float terrainFalloff = 1.0 - falloffsmooth(inputGradient, 0.0, 32.0, 8.0, uProgress2);
                        float terrainFalloff2 = 1.0 - falloffsmooth(inputGradient, 0.0, 32.0, 3.0, uProgress2);
                        terrainShockwaveColor += terrainFalloff * triangles * blue * 3.0;
                        terrainShockwaveColor += terrainFalloff2 * blue;
                        terrainShockwaveAlpha += falloff(inputGradient, -0.1, 31.9, 0.1, uProgress2);

                        // triangle layer
                        vec3 triangleShockwaveColor = vec3(0.0);
                        float triangleShockwaveAlpha = 0.0;
                        float triangleFalloff = 1.0 - falloffsmooth(inputGradient, 0.0, 32.0, 10.0, uProgress);
                        triangleShockwaveColor += blue;
                        triangleShockwaveAlpha += falloff(inputGradient, 1.0, 33.0, 0.1, uProgress);
                        triangleShockwaveAlpha *= triangleFalloff;
                        triangleShockwaveAlpha *= triangles;

                        // composite layers
                        color += terrainShockwaveColor;
                        alpha += terrainShockwaveAlpha;

                        color += triangleShockwaveColor * (1.0 - terrainShockwaveAlpha);
                        alpha += triangleShockwaveAlpha * (1.0 - terrainShockwaveAlpha);
                    }

                    // fade at edges
                    alpha *= 1.0 - smoothstep(0.8, 1.0, length(vPos.xz) * 0.1085);

                    // color safety
                    alpha = clamp(alpha, 0.0, 1.0);
                    color = clamp(color, vec3(0.0), vec3(1.0));

                    // global fade
                    alpha *= uAlpha;

                    gl_FragColor = vec4(color, alpha);
```

**Что делать у нас.** Сетка поверхности рисуется двумя uniform-ами: uProgress ведёт передний «треугольный» фронт (синие треугольники бегут наружу первыми), uProgress2 следом заливает настоящий цвет террейна. Оба тянутся 0→1 за 7.5 с, uProgress — ease inOut1, uProgress2 — ease inOut3, старт в 0.7 с. Нужны две тайловые текстуры: triangles_tiling.ktx2 (масштаб UV 0.25 по мировым XZ) и mosaic.ktx2 (0.07, режим srgb-repeat-nearest). Порог затухания по краям подбирать под каждый меш отдельно.

Строка бандла: 14866

### Проявление самого домика (класс U3, batched igloo.drc, стр. 16022): геометрия физически отбрасывается снизу вверх через discard, на границе горит синяя эмиссия с рисунком треугольников. ПОДТВЕРЖДЕНО ДОСЛОВНО, строки 16107-16116

**Числа.** uIntroMaterialize нач. 0 (в devScene 1); uIntroGlow:{value:1}; uProgress:{value:0}; introDisplacementModulator = q.devScene?1:0. introEmissive = 1.0 - falloffsmooth(vPos.y, 3.95, -0.4, 1.5, uIntroMaterialize); if (introEmissive > 0.9999) discard; triangles = texture2D(tTriangles, vUv*5.0).r; introEmissive += clamp(introEmissive*triangles*13.0, 0.0, 1.0); vec3 blue = vec3(0.5, 0.7, 1.0) (стр. 16101). Дальше по коду: color += pow(vEmission, 2.0) * clamp(1.0*vDisplacement, 0.0, 1.0) * blue

```glsl
// intro animation
                    if (uIntroMaterialize < 1.0) {
                        float introEmissive = 1.0 - falloffsmooth(vPos.y, 3.95, -0.4, 1.5, uIntroMaterialize);
                        if (introEmissive > 0.9999) discard;

                        float triangles = texture2D(tTriangles, vUv * 5.0).r;
                        introEmissive += clamp(introEmissive * triangles * 13.0, 0.0, 1.0);

                        color += introEmissive * blue;
                    }
// uniforms (стр. 16022):
// tMap: igloo/igloo_color.ktx2 "srgb", tMapExploded: igloo/igloo_exploded_color.ktx2 "srgb",
// tTriangles: igloo/triangles_tiling.ktx2 "srgb-repeat", tNoise: perlin-datatexture.ktx2 "srgb-repeat",
// tOptions: this.optionsTexture, uProgress:{value:0}, uIntroGlow:{value:1},
// uIntroMaterialize:{value:q.devScene?1:0}
```

**Что делать у нас.** Тело домика не «фейдится», а вырезается по высоте: всё, что выше фронта, отбрасывается discard, на самом фронте — синее свечение vec3(0.5,0.7,1.0) с текстурой треугольников, усиленной в 13 раз. uIntroMaterialize 0→1 за 2.25 с ease igloo_ease_1 со старта 1.1 с; сам меш до 1.1 с visible=false.

Строка бандла: 16107

### Интро-частицы (класс T3, intro_particles.drc, стр. 15536): THREE.Points со спрайтами цифр из спрайтшита igloo/numbers.ktx2, летят той же расходящейся волной. ПОДТВЕРЖДЕНО ДОСЛОВНО, шейдер строки 15551-15629

**Числа.** gl_PointSize = resolution.y / 100.0; спрайтшит на 32 строки (uv.y = 1.0 - uv.y; uv.y /= 32.0; uv.y += 1.0/32.0); offset = length(vWorldPos); progress = uProgress*4.0, затем floor(progress*12.0 - offset)/32.0, clamp 0..1, uv.y += progress; numbers = texture2D(tNumbers, uv).r; shockwave = falloff(length(vWorldPos), 0.0, 20.0, 5.0, uProgress); color = vec3(numbers); alpha *= 0.5; материал: transparent:true, blending: pt (Additive), depthTest:false, depthWrite:false; меш: renderOrder=1e3, matrixAutoUpdate=false, receiveShadow=false, name="intro_particles"

```glsl
void main() {
                    // scale uvs to match a single character of the spritesheet
                    vec2 uv = gl_PointCoord.xy;
                    uv.y = 1.0 - uv.y;
                    uv.y /= 32.0;
                    uv.y += 1.0 / 32.0;

                    // animate spritesheet character offset
                    float offset = length(vWorldPos);
                    float progress = uProgress * 4.0;
                    progress = floor(progress * 12.0 - offset) / 32.0;
                    progress = clamp(progress, 0.0, 1.0);
                    uv.y += progress;

                    // sample numbers texture with offset uvs
                    float numbers = texture2D(tNumbers, uv).r;
                    float alpha = 1.0;

                    // intro animation
                    float gradientInput = length(vWorldPos);
                    float shockwave = falloff(gradientInput, 0.0, 20.0, 5.0, uProgress);
                    alpha *= shockwave;

                    vec3 color = vec3(numbers);
                    alpha *= 0.5;

                    gl_FragColor = vec4(color, alpha);
                }
// вершинный (15551-15562):
//     vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
//     gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
//     gl_PointSize = resolution.y / 100.0;
// материал (15630): transparent:!0, blending:pt, depthTest:!1, depthWrite:!1
// меш: new Fn(e,t) — Fn = THREE.Points (класс стр. 11526), renderOrder=1e3
```

**Что делать у нас.** Точки THREE.Points из отдельного .drc, размер точки = высота холста/100, в каждой точке рисуется цифра из спрайтшита 1x32, номер цифры зависит от расстояния до центра и времени. Живут 0..3.75 с: uProgress 0→1 за 4 с ease sine.out со старта 0.5 с, uAlpha 1→0 за 2 с linear со старта 1.75 с, visible=false в 3.75 с.

Строка бандла: 15536

### ПОЛНЫЙ интро-таймлайн createIntroTimeline() — точный порядок и скорость появления всего. GSAP timeline paused, позиции указаны последним аргументом (секунды от старта). ПОДТВЕРЖДЕНО ДОСЛОВНО, все 32 твина сверены один в один, строка 16312

**Числа.** onStart: I=1/(height+1) при this.height=2.35 → 1/3.35; P=(initialScrollAutocenter - I)*(height+1) при initialScrollAutocenter=.495; controller?.centerScroll(P,0); introPosition.set(-14,21,14); introTarget.set(0,.5,0).
Порядок и тайминги:
· camera.touchAmount 0→1, duration 5, @2
· outline uIntroMaterialize 0→1, duration 2.5, ease power3.inOut, @0
· outline uAlpha 1→0, duration 3, ease inOut4, @2
· cage uProgress 0→1, duration 4, ease sine.inOut, @0
· cage uAlpha 0→.4, duration .1, ease power2.inOut, @0; затем .4→0, duration 3, ease power2.inOut, @2.1
· cage visible=true @0, visible=false @2.1+3 = 5.1
· igloo uIntroMaterialize 0→1, duration 2.25, ease igloo_ease_1, @1.1; igloo visible=false @0, visible=true @1.1
· igloo.introDisplacementModulator 0→1, duration 2, ease linear, @2
· igloobase/terrain/terrainpatches uAlpha set 0 @0, set 1 @2.1
· mountains uAlpha 0→1, duration 3 (ease по дефолту power2.inOut), @0.7
· uProgress (igloobase, terrain, terrainpatches, mountains) 0→1, duration 7.5, ease inOut1, @0.7
· uProgress2 (те же четыре) 0→1, duration 7.5, ease inOut3, @0.7
· introparticles uProgress 0→1, duration 4, ease sine.out, @0.5
· introparticles uAlpha 1→0, duration 2, ease linear, @1.75; visible=true @0, visible=false @1.75+2 = 3.75
· smoke uAlpha 0→1, duration 3, ease power2.inOut, @2
· snowparticles uAlpha 0→1, duration 4, ease power2.inOut, @2
· sky uProgress 0→1, duration 3, ease power2.inOut, @1.5
· igloo uProgress 0→1, duration 1, ease power2.inOut, @1
· BloomEffect intensity 1.5→1, duration 2, ease sine.inOut, @2.5
· uGradientAlpha цветокоррекции (isIglooColorCorrectionPass) 0→1, duration 4, ease sine.inOut, @1
· call → emit("webgl_show_ui_intro") @4.5
· introWeight 0→1, duration 5.5, ease inOut1, @2

```glsl
createIntroTimeline(){this.introTL=re.timeline({paused:!0,onStart:()=>{var D;const I=1/(this.height+1),P=(this.initialScrollAutocenter-I)*(this.height+1);(D=this.controller)==null||D.centerScroll(P,0),this.introPosition.set(-14,21,14),this.introTarget.set(0,.5,0)}});
... this.introTL.fromTo(this.camera,{touchAmount:0},{touchAmount:1,duration:5},2),
this.introTL.fromTo(n,{value:0},{value:1,duration:2.5,ease:"power3.inOut"},0),
this.introTL.fromTo(r,{value:1},{value:0,duration:3,ease:"inOut4"},2),
this.introTL.fromTo(w,{value:0},{value:1,duration:4,ease:"sine.inOut"},0),
this.introTL.fromTo(C,{value:0},{value:.4,duration:.1,ease:"power2.inOut"},0),
this.introTL.fromTo(C,{value:.4},{value:0,duration:3,ease:"power2.inOut"},2.1),
this.introTL.set(this.igloocage.mesh,{visible:!0},0),
this.introTL.set(this.igloocage.mesh,{visible:!1},2.1+3),
this.introTL.fromTo(a,{value:0},{value:1,duration:2.25,ease:"igloo_ease_1"},1.1),
this.introTL.set(this.igloo.mesh,{visible:!1},0),
this.introTL.set(this.igloo.mesh,{visible:!0},1.1),
this.introTL.fromTo(o,{value:0},{value:1,duration:2,ease:"linear"},2),
this.introTL.set(l,{value:0},0),this.introTL.set(l,{value:1},2.1),
this.introTL.set(c,{value:0},0),this.introTL.set(c,{value:1},2.1),
this.introTL.set(h,{value:0},0),this.introTL.set(h,{value:1},2.1),
this.introTL.fromTo(d,{value:0},{value:1,duration:3},.7),
this.introTL.fromTo(u,{value:0},{value:1,duration:7.5,ease:"inOut1"},.7),
this.introTL.fromTo(p,{value:0},{value:1,duration:7.5,ease:"inOut1"},.7),
this.introTL.fromTo(A,{value:0},{value:1,duration:7.5,ease:"inOut1"},.7),
this.introTL.fromTo(f,{value:0},{value:1,duration:7.5,ease:"inOut1"},.7),
this.introTL.fromTo(m,{value:0},{value:1,duration:7.5,ease:"inOut3"},.7),
this.introTL.fromTo(x,{value:0},{value:1,duration:7.5,ease:"inOut3"},.7),
this.introTL.fromTo(v,{value:0},{value:1,duration:7.5,ease:"inOut3"},.7),
this.introTL.fromTo(g,{value:0},{value:1,duration:7.5,ease:"inOut3"},.7),
this.introTL.fromTo(y,{value:0},{value:1,duration:4,ease:"sine.out"},.5),
this.introTL.fromTo(S,{value:1},{value:0,duration:2,ease:"linear"},1.75),
this.introTL.set(this.introparticles.mesh,{visible:!0},0),
this.introTL.set(this.introparticles.mesh,{visible:!1},1.75+2),
this.introTL.fromTo(M,{value:0},{value:1,duration:3,ease:"power2.inOut"},2),
this.introTL.fromTo(s,{value:0},{value:1,duration:4,ease:"power2.inOut"},2),
this.introTL.fromTo(E,{value:0},{value:1,duration:3,ease:"power2.inOut"},1.5),
this.introTL.fromTo(_,{value:0},{value:1,duration:1,ease:"power2.inOut"},1),
this.introTL.fromTo(e,{value:1.5},{value:1,duration:2,ease:"sine.i
```

**Что делать у нас.** Скопировать таймлайн один-в-один: сначала (позиция 0) контур и клетка домика, с 0.5 с цифровые частицы, с 0.7 с волна сетки по земле и горам (7.5 с), с 1.1 с материализация самого домика, с 1.5 с небо, с 2 с дым/снег/камера, в 4.5 с показ UI. Ждать 5 секунд и включать скролл.

Строка бандла: 16312

### Кастомные кривые ускорения, использованные в интро — созданы через GSAP CustomEase (Ei) из SVG-путей. Регистрируются в двух местах: базовые четыре на стр. 13304 (вместе с gsap.config/defaults), остальные пять — на стр. 20662, внутри onMount компонента App3D, ДО инициализации рендерера. ПОДТВЕРЖДЕНО ДОСЛОВНО

**Числа.** inOut1: M0,0 C0.5,0 0.1,1 1,1 (precision:2); inOut2: M0,0 C0.56,0 0,1 1,1 (precision:2); inOut3: M0,0 C0.6,0 0,1 1,1 (precision:2); inOut4: M0,0 C0.4,0 -0.06,1 1,1 (precision:2); inOut5: M0,0 C0.171,0 0.77,-0.013 0.842,0.272 0.972,0.794 0.972,0.85 1,1 (БЕЗ precision); entry_ease: M0,0 C0.358,0 0.336,0.209 0.442,0.519 0.59,0.952 0.768,0.918 1,1; entry_ease_2: M0,0 C0.388,0.082 0.924,0.862 1,1; entry_ease_3: M0,0 C0.272,0 0.472,0.454 0.496,0.496 0.66,0.79 0.685,1 1,1; igloo_ease_1: M0,0 C0.662,0.073 0.047,1 1,1 (precision:2). Глобальные дефолты GSAP: gsap.config({force3D:!0}); gsap.defaults({ease:"power2.inOut", duration:.6, overwrite:"auto"})

```glsl
re.registerPlugin(Ei,dg,fg);re.config({force3D:!0});re.defaults({ease:"power2.inOut",duration:.6,overwrite:"auto"});
Ei.create("inOut1","M0,0 C0.5,0 0.1,1 1,1",{precision:2});
Ei.create("inOut2","M0,0 C0.56,0 0,1 1,1",{precision:2});
Ei.create("inOut3","M0,0 C0.6,0 0,1 1,1",{precision:2});
Ei.create("inOut4","M0,0 C0.4,0 -0.06,1 1,1",{precision:2});
// строка 20662 (внутри onMount App3D):
Ei.create("inOut5","M0,0 C0.171,0 0.77,-0.013 0.842,0.272 0.972,0.794 0.972,0.85 1,1"),
Ei.create("entry_ease","M0,0 C0.358,0 0.336,0.209 0.442,0.519 0.59,0.952 0.768,0.918 1,1",{precision:2}),
Ei.create("entry_ease_2","M0,0 C0.388,0.082 0.924,0.862 1,1",{precision:2}),
Ei.create("entry_ease_3","M0,0 C0.272,0 0.472,0.454 0.496,0.496 0.66,0.79 0.685,1 1,1",{precision:2}),
Ei.create("igloo_ease_1","M0,0 C0.662,0.073 0.047,1 1,1",{precision:2});
```

**Что делать у нас.** Подключить GSAP CustomEase и зарегистрировать эти кривые теми же путями. Из них в интро реально работают inOut1, inOut3, inOut4 и igloo_ease_1. Без них интро ощущается иначе: inOut1/inOut3 — очень долгий «выкат» волны, igloo_ease_1 — резкий старт с длинным затуханием.

Строка бандла: 13304

### Стартовая точка всей цепочки: Svelte-компонент App3D (строка 20662). ready резолвится только после полной инициализации контроллера jF (все сцены собраны и загружены в GPU: await Promise.all([...scene.uploaded])) и вызова start(). ПОДТВЕРЖДЕНО ДОСЛОВНО

**Числа.** DPR = window.devicePixelRatio<=2 ? Math.min(devicePixelRatio, 1.15) : Math.min(devicePixelRatio, 1.5); he.init({canvasCnt, interactionNode, relativePath, fingers:2, audioContext:true, contextMenu:false, DPR:u||1, adaptiveDPR:true, shadowMap:true, shadowMapType:ly}); при отсутствии q.capabilities.webgl2 — ready резолвится в ()=>!1 и показывается заглушка; jF.start(){emit("webgl_render_active",!0); emit("webgl_router_start")}; роутер: Q.once("webgl_router_start",()=>e.start())

```glsl
RE(async()=>{if(!q.capabilities.webgl2){s(()=>!1),t(2,c=!0);return}
t(1,l=!0),await Promise.all([LE(),h()]),
Ei.create("inOut5",...),...,Ei.create("igloo_ease_1","M0,0 C0.662,0.073 0.047,1 1,1",{precision:2});
const u=window.devicePixelRatio<=2?Math.min(window.devicePixelRatio,1.15):Math.min(window.devicePixelRatio,1.5);
await he.init({canvasCnt:o,interactionNode:r,relativePath:a,fingers:2,audioContext:!0,contextMenu:!1,DPR:u||1,adaptiveDPR:!0,shadowMap:!0,shadowMapType:ly});
{const f=new jF;await f.ready,f.start(),s(()=>!0)}});
// строка 20656, jF:
// async init(){this.initGlobalPlane(),await this.createScenes(),this.audioController=new u3(this),
//   he.renderPass.scene.beforeRenderCbs.push(()=>{this.render()}),Q.on("resize",this.resize,this),
//   Q.on("webgl_router_request_switch_scene",this.navigateToSection,this),
//   this.scrollComposers.forEach(e=>e.render()),this.isReady()}
// async createScenes(){...await Promise.all([this.uiScene.uploaded,
//   ...this.scrollComposers.map(e=>e.passes[0].scene.uploaded),
//   this.detailComposer.passes[0].scene.uploaded]),...}
// start(){Q.emit("webgl_render_active",!0),Q.emit("webgl_router_start")}
```

**Что делать у нас.** Схема гейта: промис ready 3D-приложения → he.init(рендерер) → new Controller() → await controller.ready (все сцены + await scene.uploaded, то есть реальная загрузка в GPU) → controller.start() → emit('webgl_router_start') → роутер вызывает navigateToSection('home') → интро → enableScroll(). Предзагрузчик гасится сразу на resolve ready, а скролл включается ещё на 5 секунд позже — экран уже живой, но не листается.

Строка бандла: 20662

### Ассеты, из которых строится «сетка» интро — сверено по полному списку всех .drc и .ktx2 в бандле, имена дословные

**Числа.** Draco-геометрии интро: igloo/igloo_cage.drc, igloo/igloo_outline.drc, intro_particles.drc, igloo.drc (через zt.batched), ground.drc, mountain.drc, igloo/patch.drc. Текстуры KTX2: igloo/triangles_tiling.ktx2 ("srgb-repeat"), mosaic.ktx2 ("srgb-repeat-nearest"), perlin-datatexture.ktx2 ("srgb-repeat"), igloo/numbers.ktx2 ("srgb-repeat"), igloo/igloo_color.ktx2 ("srgb"), igloo/igloo_exploded_color.ktx2 ("srgb"), igloo/ground_color.ktx2 ("srgb"), igloo/ground_glow.ktx2 ("srgb"), igloo/ground_sansigloo_color.ktx2 ("srgb"), igloo/mountain_color.ktx2 ("srgb"), wind_noise.ktx2 ("srgb-repeat"), igloo/igloo_scene.ktx2 (LUT, "luttetrahedral"). Цвета гор: uColor1 #d1d6e3, uColor2 #afb6c7

```glsl
async init(){const e=await zt.batched("igloo.drc"),t=le.load("igloo/igloo_color.ktx2","srgb"),s=le.load("igloo/igloo_exploded_color.ktx2","srgb");
...uniforms:{tMap:{value:t},tMapExploded:{value:s},tTriangles:{value:le.load("igloo/triangles_tiling.ktx2","srgb-repeat")},tNoise:{value:le.load("perlin-datatexture.ktx2","srgb-repeat")},tOptions:{value:this.optionsTexture},uProgress:{value:0},uIntroGlow:{value:1},uIntroMaterialize:{value:q.devScene?1:0}}
// стр. 14793 (y3, igloobase): zt.load("ground.drc"), tMap: igloo/ground_color.ktx2,
//   tGroundGlow: igloo/ground_glow.ktx2, tWind: wind_noise.ktx2,
//   tTriangles: igloo/triangles_tiling.ktx2, tNoise: mosaic.ktx2 "srgb-repeat-nearest"
// стр. 14993 (S3, mountain): zt.load("mountain.drc"), uColor1 #d1d6e3, uColor2 #afb6c7,
//   tMap: igloo/mountain_color.ktx2
// стр. 15148 (M3, terrain): zt.load("ground.drc"), tMap: igloo/ground_sansigloo_color.ktx2
// стр. 15350 (b3, terrainpatches): zt.load("igloo/patch.drc")
// стр. 15536 (T3): zt.load("intro_particles.drc"), tNumbers: igloo/numbers.ktx2
```

**Что делать у нас.** Нужны две отдельные каркасные геометрии (cage и outline) плюс тайл треугольников и шум. Каркас — это отдельный экспорт рёбер модели в Draco, а не EdgesGeometry в рантайме: во всём бандле EdgesGeometry/WireframeGeometry отсутствуют полностью.

Строка бандла: 16022

**Не найдено или не подтвердилось:**

- Процент загрузки. ПОДТВЕРЖДЕНО ОТСУТСТВИЕ: ни счётчика, ни прогресс-бара, ни текста вида '0 / 100' в бандле нет. THREE.LoadingManager (класс Jy, стр. 12761; onProgress на стр. 12766 и 12769) в приложении не подключается ни к какому UI. ProgressEvent (стр. 12859) используется только внутри FileLoader. Поиск loadingProgress / isLoading / itemsLoaded / itemsTotal по бандлу — ноль совпадений; единственное близкое имя loadProgressive (стр. 13414) это загрузчик текстур, а не счётчик.
- ИСПРАВЛЕНО: в разборе было сказано, что EdgesGeometry и WireframeGeometry есть в виде определений классов на строках 8627/11427/11503. Это неверно. В /tmp/igloo/App3D.pretty.js слов EdgesGeometry и WireframeGeometry НЕТ ВООБЩЕ (ноль совпадений) — копия three.js в бандле их не содержит. LineDashedMaterial встречается на строках 8627 и 10187 (список констант и определение класса), в коде сайта не используется. Строка 11427 это this.linewidth=1 внутри LineBasicMaterial, строка 11503 это isLineSegments внутри LineSegments — к EdgesGeometry отношения не имеют. material.wireframe=true встречается один раз, на стр. 2038, и только внутри Material.toJSON (сериализация), то есть не является вызовом. Суть вывода сохраняется: каркас приходит готовыми .drc-файлами.
- ИСПРАВЛЕНО: 'getContext("2d") встречается один раз, на строке 13387'. На самом деле пять раз: 407 и 414 (THREE.ImageUtils.getDataURL / sRGBToLinear), 9348 (проверка OffscreenCanvas), 9360, и 13387. К экрану загрузки не относится ни один; 13387 — конвертер SVG в текстуру внутри загрузчика ассетов. Канвас-2D предзагрузчика нет.
- SVG-предзагрузчик, stroke-dasharray / stroke-dashoffset анимации: ПОДТВЕРЖДЕНО ОТСУТСТВИЕ — ноль совпадений и в App3D.pretty.js, и в igloo-main.js.
- ИСПРАВЛЕНО: 'gl_PointSize нашёлся только у интро-частиц (строка 15536)'. Неверно: gl_PointSize встречается 11 раз (6455, 6458, 15558, 15939, 17300, 18823, 19162, 19164, 19629, 20399, 20537). У интро-частиц он на строке 15558. Сохраняется только сам вывод: отдельного шейдера-предзагрузчика, рисующего сетку на плоскости, в бандле нет — сетка это wireframe самой сцены плюс тайловая текстура треугольников в шейдерах земли.
- Толщина линии в пикселях: ПОДТВЕРЖДЕНО — LineBasicMaterial.linewidth нигде в коде сайта не задаётся, остаётся дефолт 1 (стр. 11427). Библиотек толстых линий (Line2 / LineMaterial / LineSegmentsGeometry / meshline) в бандле нет, ноль совпадений.
- Отдельного флага вроде isLoading / loadingProgress в контроллере jF нет — ПОДТВЕРЖДЕНО. Блокировка прокрутки сделана только отсутствием подписки на wheel/keydown/touch_drag и флагом scrollBlocked (стр. 20656). enableScroll() вызывается ровно в двух местах бандла, оба внутри navigateToSection.
- ИСПРАВЛЕНО: 'первое проигрывание звука привязано к показу манифеста после webgl_show_ui_intro (строка 16312)'. В интро-таймлайне webgl_play_audio действительно нет — это подтверждено. Но первым по webgl_show_ui_intro играет НЕ манифест: на стр. 19789 стоит Q.once("webgl_show_ui_intro",()=>{this.interaction.enable(),this.show(),Q.emit("webgl_play_audio","logo")}) — то есть звук 'logo'. Манифест (webgl_play_audio,"manifesto") висит на onStart анимации uShow1 текста (стр. 16312), это отдельная ветка. Всего подписчиков webgl_show_ui_intro три: логотип (19789), сообщение (19828), кнопка звука (19983).


## КАМЕРА И ТАЙМЛАЙН

### ПОДТВЕРЖДЕНО. Базовый класс камеры Bw(type) — весь механизм хода камеры сайта. Camera = PerspectiveCamera, но position/target/up НЕ выставляются напрямую: сцена пишет basePosition/baseTarget/baseUp, а _update() каждый кадр собирает итоговый quaternion через Matrix4.lookAt. lookAt() как метод в прикладном коде не вызывается ни разу (единственный `.lookAt(` после строки 13300 — это GD.lookAt внутри самого _update). ДОПОЛНЕНО соседними числами из того же места: короткий путь при нулевом displacement.position, ветка _resize() и setCustomSize().

**Числа.** PerspectiveCamera(45, q.screen.w/q.screen.h, ox=.1, lx=1e3); Orthographic: super(w*-.5, w*.5, h*.5, h*-.5, .1, 1e3); HD=6 -> basePosition=new b(0,0,6); baseTarget (0,0,0); baseUp (0,1,0); displacement={position:Vector2(0,0), target:Vector2(0,0), rotation:0}; lerpPosition=.035; lerpTarget=.035; lerpRotation=.035; shake=Vector3(0,0,0); shakeSpeed=Vector3(1,1,1); touchAmount=1; resetOnTouch=true; Ch=Math.PI*.5; при currentInput==='touch' и не-нажатом пальце s=true -> n=.5 и углы r,a принудительно 0. Дополнительно: если displacement.position равен (0,0) — position просто копируется из basePosition, сферические углы сбрасываются в (1,0,0); ветка target активна только если displacement.target!==(0,0) ИЛИ shake.x!==0 ИЛИ shake.y!==0; _resize() пересчитывает aspect (перспектива) или left/right/top/bottom=±size*.5 (орто) только когда _size изменился.

```glsl
const $t=new QD,Ks=new b,Gr=new b,Qf=new b,Kn=new b,GD=new De,Ch=Math.PI*.5,ax=new H,
 Gf={PERSPECTIVE:1,ORTHOGRAPHIC:2},Hf={SCREEN:1,CUSTOM:2},ox=.1,lx=1e3,HD=6;
function Bw(i){const e=Gf[i.toUpperCase()],t=e===Gf.PERSPECTIVE?gi:Ln;return class extends t{constructor(){
 e===Gf.PERSPECTIVE?super(45,q.screen.w/q.screen.h,ox,lx):super(q.screen.w*-.5,q.screen.w*.5,q.screen.h*.5,q.screen.h*-.5,ox,lx),
 this.isBaseCamera=!0,this._sizing=Hf.SCREEN,this._size=new H(q.screen.w,q.screen.h),this._firstUpdate=!0,
 this._prevSize=this._size.clone(),this._prevPosition=new b,this._prevTarget=new b,this._prevUp=new b,
 this._additionalSphericalPosition=new Yl,this._additionalSphericalTarget=new Yl,this._additionalRotationUp=0,
 this.target=new b,this.basePosition=new b(0,0,HD),this.baseTarget=new b,this.baseUp=new b(0,1,0),
 this.displacement={position:new H,target:new H,rotation:0},
 this.lerpPosition=.035,this.lerpTarget=.035,this.lerpRotation=.035,
 this.shake=new b,this.shakeSpeed=new b(1,1,1),this.touchAmount=1,this.resetOnTouch=!0}
_update(){this._firstUpdate&&(this._firstUpdate=!1);
 const s=this.resetOnTouch&&$t.get(0).currentInput==="touch"&&!$t.get(0).touching,n=s?.5:1,
 r=ie.fit(s?0:$t.get(0).position11.x,-1,1,-Ch,Ch)*this.touchAmount,
 a=ie.fit(s?0:$t.get(0).position11.y,1,-1,-Ch,Ch)*this.touchAmount;
 if(Ks.subVectors(this.basePosition,this.baseTarget),Ks.lengthSq()===0&&(Ks.z=1),Ks.normalize(),
  Gr.crossVectors(this.baseUp,Ks),Gr.lengthSq()===0&&(Math.abs(this.baseUp.z)===1?Ks.x+=1e-4:Ks.z+=1e-4,Ks.normalize(),Gr.crossVectors(this.baseUp,Ks)),
  Gr.normalize(),Qf.crossVectors(Ks,Gr),
  this.displacement.position.equals(ax)?(this.position.copy(this.basePosition),this._additionalSphericalPosition.set(1,0,0)):(
   this._additionalSphericalPosition.theta=ie.lerpFPS(this._additionalSphericalPosition.theta,r*this.displacement.position.x,this.lerpPosition*n),
   this._additionalSphericalPosition.phi=ie.lerpFPS(this._additionalSphericalPosition.phi,a*this.displacement.position.y,this.lerpPosition*n),
   Kn.subVectors(this.basePosition,this.baseTarget),
   Kn.applyAxisAngle(Gr,this._additionalSphericalPosition.phi).applyAxisAngle(Qf,this._additionalSphericalPosition.theta),
   this.position.copy(this.baseTarget).add(Kn)),
  this.displacement.target.equals(ax)&&this.shake.x===0&&this.shake.y===0)
   this.target.copy(this.baseTarget),this._additionalSphericalTarget.set(1,0,0);
 else{ ... }
 (!this.position.equals(this._prevPosition)||!this.target.equals(this._prevTarget)||!this.up.equals(this._prevUp))&&(
  this._prevPosition.copy(this.position),this._prevTarget.co
```

**Что делать у нас.** Сделать класс-обёртку над THREE.PerspectiveCamera с полями basePosition/baseTarget/baseUp + displacement + shake. Каждый кадр: строим базис Ks=norm(basePosition-baseTarget), Gr=norm(cross(baseUp,Ks)), Qf=cross(Ks,Gr); от мыши берём углы r,a в диапазоне ±PI/2, множим на displacement.position.x/.y, крутим вектор (basePosition-baseTarget) applyAxisAngle(Gr,phi).applyAxisAngle(Qf,theta) и прибавляем к baseTarget; то же отдельно для target через displacement.target; итог кладём в quaternion через Matrix4().lookAt(position,target,up). Обязательно оставить короткие пути: если displacement нулевой — просто копируем базовый вектор, это экономит кадр и убирает дрожание. Ставить camera.matrixWorldAutoUpdate=false и звать _update() вручную.

Строка бандла: 13304

### ПОДТВЕРЖДЕНО. Поворот камеры вокруг оси взгляда (крен/roll) в базовой камере. Ветка срабатывает только если displacement.rotation!==0 ИЛИ shake.z!==0. Ось вращения — нормаль взгляда normalize(position-target). При нулевых значениях up жёстко копируется из baseUp, а накопленный угол сбрасывается в 0.

**Числа.** _additionalRotationUp = ie.lerpFPS(prev, $t.get(0).velocity.x * displacement.rotation * touchAmount, lerpRotation*n), где n=.5 при пассивном touch и 1 иначе; шумовой крен o = Of.sineNoise1(23.434, -1.565, 8.454 + Fe.time*shakeSpeed.z) * shake.z * touchAmount; итоговый угол = _additionalRotationUp + o

```glsl
if(this.displacement.rotation===0&&this.shake.z===0)
  this.up.copy(this.baseUp),this._additionalRotationUp=0;
else{
  this._additionalRotationUp=ie.lerpFPS(this._additionalRotationUp,$t.get(0).velocity.x*this.displacement.rotation*this.touchAmount,this.lerpRotation*n);
  const o=this.shake.z===0?0:Of.sineNoise1(23.434,-1.565,8.454+Fe.time*this.shakeSpeed.z)*this.shake.z*this.touchAmount;
  Kn.subVectors(this.position,this.target).normalize(),
  this.up.copy(this.baseUp).applyAxisAngle(Kn,this._additionalRotationUp+o)
}
```

**Что делать у нас.** Крен делать не через camera.rotation.z, а через поворот вектора up вокруг оси взгляда: up = baseUp.clone().applyAxisAngle(normalize(pos-target), angle). Angle = сглаженная кадронезависимым лерпом скорость мыши по X * коэффициент + синус-шум. Ветку целиком отключать при нулевых displacement.rotation и shake.z, иначе up будет дёргаться на нуле.

Строка бандла: 13304

### ПОДТВЕРЖДЕНО ДОСЛОВНО. Шумовая тряска камеры (shake) по target-у: сдвиг точки взгляда, а не позиции. Формула шума kD (экспортируется как Of.sineNoise1) — сумма шести синусов от скалярных произведений, делённая на 6.

**Числа.** o (theta-шум) = sineNoise1(12.23, 3.44, -3.234 + Fe.time*shakeSpeed.x)*shake.x*touchAmount; l (phi-шум) = sineNoise1(-2.45, 4.789, 7.343 + Fe.time*shakeSpeed.y)*shake.y*touchAmount; шумы прибавляются к сферическим углам ПЕРЕД applyAxisAngle: applyAxisAngle(Gr, phi+l).applyAxisAngle(Qf, theta+o); базисные векторы kD: (1.5,3.4598,1.234), (3.12,-3.234,4.221), (.355,2.3,-1.375), (-.156,-3.34,-.4566), (-4.1235,-.485,-1.45), (2.54,-.879,-2.123), сумма делится на 6

```glsl
const Qr=new b,Ga=new b;
function kD(i,e,t){Qr.set(i,e,t);let s=0;return
 s+=Math.sin(Qr.dot(Ga.set(1.5,3.4598,1.234))),
 s+=Math.sin(Qr.dot(Ga.set(3.12,-3.234,4.221))),
 s+=Math.sin(Qr.dot(Ga.set(.355,2.3,-1.375))),
 s+=Math.sin(Qr.dot(Ga.set(-.156,-3.34,-.4566))),
 s+=Math.sin(Qr.dot(Ga.set(-4.1235,-.485,-1.45))),
 s+=Math.sin(Qr.dot(Ga.set(2.54,-.879,-2.123))),s/6}
const Of={sineNoise1:kD};
// применение в _update():
const o=this.shake.x===0?0:Of.sineNoise1(12.23,3.44,-3.234+Fe.time*this.shakeSpeed.x)*this.shake.x*this.touchAmount,
      l=this.shake.y===0?0:Of.sineNoise1(-2.45,4.789,7.343+Fe.time*this.shakeSpeed.y)*this.shake.y*this.touchAmount;
Kn.subVectors(this.baseTarget,this.basePosition),
Kn.applyAxisAngle(Gr,this._additionalSphericalTarget.phi+l).applyAxisAngle(Qf,this._additionalSphericalTarget.theta+o),
this.target.copy(this.basePosition).add(Kn)
```

**Что делать у нас.** Скопировать kD один в один как функцию живого дрожания. Подавать третьим аргументом (фаза + time*shakeSpeed), домножать на амплитуду shake.x/y/z. Даёт непериодичное мягкое покачивание без импорта simplex-noise. Важно: шум подмешивается в УГЛЫ поворота target, а не в позицию камеры.

Строка бандла: 13304

### ПОДТВЕРЖДЕНО ДОСЛОВНО. Вызов камеры в кадре: сцена в updateMatrixWorld сама пересчитывает камеру перед своими колбэками, с защитой от повторного прогона в одном кадре (Sc.hasRunThisFrame).

**Числа.** порядок: super.updateMatrixWorld -> camera._resize() -> camera._update() -> camera.updateMatrixWorld() -> beforeRenderCbs. Флаги сцены: camera.matrixWorldAutoUpdate=false, scene.matrixWorldAutoUpdate=true, scene.matrixAutoUpdate=false

```glsl
class Jo extends No{constructor({orbit:e=!1,follow:t=!1,cameraType:s="perspective"}={}){super();
 const n=e?qD:VD;this.camera=n(s),this.camera.matrixWorldAutoUpdate=!1,this.composer=null,
 this.matrixWorldAutoUpdate=!0,this.matrixAutoUpdate=!1,this.beforeRenderCbs=[],
 this._textures=new Set,this.customUploadRT=null, ... }
updateMatrixWorld(e){super.updateMatrixWorld(e),!Sc.hasRunThisFrame(this)&&(
 this.camera._resize(),this.camera._update(),this.camera.updateMatrixWorld(),
 this.beforeRenderCbs.forEach(t=>t()))}
```

**Что делать у нас.** Держать камеру с matrixWorldAutoUpdate=false и обновлять её строго один раз за кадр перед update-колбэками сцены, с флагом «уже считали в этом кадре», иначе при рендере в несколько таргетов камера пересчитается несколько раз и лерпы поедут.

Строка бандла: 13306

### ПОДТВЕРЖДЕНО ДОСЛОВНО. Лента прокрутки целиком (класс jF): три скролл-сцены в кольце, никакого ScrollTrigger и никакого scrollbar. Ввод только wheel/keys/touch, прогресс сцены = локальная доля от её высоты. Лента зациклена по модулю суммы высот.

**Числа.** scrollMultiplier=75e-5 (0.00075); onScroll: targetY2 += wheel.delta.y*0.00075; ArrowDown/Up = ±150*0.00075=±0.1125; touch: targetY2 += delta11.y*1.25; targetY1=lerpFPSLimited(targetY1,targetY2,.075, лимит 100*0.00075=0.075/кадр при ratio=1); scroll.y=lerpFPS(scroll.y,targetY1,.15); зажим targetY2 в ±750*0.00075=±0.5625 от scroll.y; довод-щелчок при |y-targetY2|<.1*0.00075; velocity += |dy|*1, velocity *= frictionFPS(.98), clamp(0,1), обнуление при <.001; высоты сцен: igloo 2.35, cubes 3 (Be.cubes.length: pudgy-penguins, overpass, abstract), entry 5.5 -> total 10.85; __top: 0 / 2.35 / 5.35; кольцо: s=y%total, n=y>=0?s:total-|s|, r=n+1, a=r%total; progress=(y-__top)/(__bottom-__top+1) -> делители 3.35 / 4 / 6.5; автоцентр запускается через 1.4 с после последнего изменения targetY2; round(e)=ie.round(e,2)

```glsl
const ty={igloo:F3,cubes:aF,entry:UF};
class jF{constructor(e){ ... this.scroll={total:0,targetY1:0,targetY2:0,y:0,velocity:0},
 this.autoCenter={needed:!1,animating:!1,lastTarget:0,lastTime:0},this.scrollMultiplier=75e-5,
 this.scrollBlocked=!1,this.detailIndex=0,this.isDetailOpen=!1,this.scrollComposers=[], ... }
round(e){return ie.round(e,2)}
render(){
 this.scroll.targetY2!==this.autoCenter.lastTarget&&(this.autoCenter.needed=!0,this.autoCenter.lastTarget=this.scroll.targetY2,this.autoCenter.lastTime=Fe.time);
 const e=this.scroll.y;
 this.scroll.targetY1=ie.lerpFPSLimited(this.scroll.targetY1,this.scroll.targetY2,.075,100*this.scrollMultiplier),
 this.scroll.y=ie.lerpFPS(this.scroll.y,this.scroll.targetY1,.15);
 const t=750*this.scrollMultiplier;
 this.scroll.targetY2=ie.clamp(this.scroll.targetY2,this.scroll.y-t,this.scroll.y+t),
 Math.abs(this.scroll.y-this.scroll.targetY2)<.1*this.scrollMultiplier&&(this.scroll.y=this.scroll.targetY2,this.scroll.targetY1=this.scroll.targetY2),
 this.scroll.velocity+=Math.abs(this.scroll.y-e)*1,this.scroll.velocity*=ie.frictionFPS(.98),
 this.scroll.velocity=ie.clamp(this.scroll.velocity,0,1),Math.abs(this.scroll.velocity)<.001&&(this.scroll.velocity=0),
 this.scroll.total=0,this.scrollComposers.forEach(p=>{const A=p.passes[0].scene;A.__top=this.scroll.total,A.__bottom=A.__top+A.height,this.scroll.total+=A.height});
 const s=this.scroll.y%this.scroll.total,n=this.scroll.y>=0?s:this.scroll.total-Math.abs(s),r=n+1,a=r%this.scroll.total;
 ... const y=x?r:a,S=A.__bottom-A.__top;A.progress=(y-A.__top)/(S+1); ... }
centerScroll(e,t){const s=this.round(e);this.autoCenter.animating=!0,
 re.to(this.scroll,{y:s,duration:t,ease:"inOut3",overwrite:!0,
  onUpdate:()=>{this.scroll.targetY1=this.scroll.y,this.scroll.targetY2=this.scroll.y,this.autoCenter.lastTarget=this.scroll.y},
  onComplete:()=>{this.autoCenter.animating=!1}})}
onScroll(e){this.scrollBlocked||(this.stopAutoCenter(),this.scroll.targetY2+=e.delta.y*this.scrollMultiplier)}
onKeyDown(e){this.scrollBlocked||(this.stopAutoCenter(),
 e.key==="ArrowDown"&&(this.scroll.targetY2+=150*this.scrollMultiplier),
 e.key==="ArrowUp"&&(this.scroll.targetY2-=150*this.scrollMultiplier))}
onTouchDrag(e){this.scrollBlocked||(this.stopAutoCenter(),this.scroll.targetY2+=e.delta11.y*1.25)}
resize(){this.stopAutoCenter(),this.scroll.targetY2=this.scroll.y,this.scroll.targetY1=this.scroll.y,this.autoCenter.lastTarget=1/0}
```

**Что делать у нас.** Отказаться от нативного скролла и ScrollTrigger. Держать одну числовую координату scroll.y в условных экранах, двигать её колесом с множителем 0.00075, вести двухступенчатым лерпом (0.075 с лимитом скорости и 0.15 без), и делить ленту на сцены с собственной height. Прогресс сцены = (y - top)/(height+1) — единица добавляется потому, что сцена должна доехать через весь экран. Зацикливание — просто модуль по сумме высот. При resize обязательно схлопывать targetY1/targetY2 в текущий y, иначе лента прыгнет.

Строка бандла: 20656

### ПОДТВЕРЖДЕНО ДОСЛОВНО. Колесо мыши: сырой инпут с трением и нормировкой Firefox. Класс Fl, приватные статики через WeakMap-хелпер te().

**Числа.** te(Fl,ap,33) — множитель для deltaMode===1 (Firefox, строки вместо пикселей); te(Fl,op,.97) — трение; velocity.add(delta * .1); velocity.clampScalar(-1,1); обнуление при velocity.length()<.001; трение применяется в webgl_prerender через ie.frictionFPS

```glsl
aE=function(i){U(this,dd)&&(i.preventDefault(),i.stopPropagation()),this.isPinching=i.ctrlKey,
 U(this,ao).set(i.deltaX,i.deltaY),
 U(this,fd)&&i.deltaMode===1&&U(this,ao).multiplyScalar(U(Fl,ap)),
 this.position.add(U(this,ao)),this.delta.copy(this.position).sub(U(this,wu)),U(this,wu).copy(this.position),
 this.velocity.add(U(this,ao).copy(this.delta).multiplyScalar(.1)),Q.emit("wheel",this)},
Eu=new WeakSet,
Qm=function(){this.velocity.multiplyScalar(ie.frictionFPS(U(Fl,op))),this.velocity.clampScalar(-1,1),
 this.velocity.length()<.001&&this.velocity.setScalar(0)},
te(Fl,ap,33),te(Fl,op,.97);let BU=Fl;const Px=new BU;
```

**Что делать у нас.** Скопировать целиком, включая множитель 33 для Firefox deltaMode===1 и трение 0.97 через frictionFPS (кадронезависимое). Именно velocity.x из этого класса потом крутит камеру вокруг оси взгляда в базовой камере.

Строка бандла: 13433

### ПОДТВЕРЖДЕНО ДОСЛОВНО. СЦЕНА 1 — HERO С ИГЛУ (класс F3). Камера едет по ОДНОЙ gsap-таймлинии длиной 21 с, у которой progress жёстко приравнен к прогрессу скролла. Плюс отдельная интро-таймлиния при первой загрузке. displacement.target и displacement.rotation в cameraOptions не трогаются — остаются дефолтными (0,0) и 0.

**Числа.** height=2.35; initialScrollAutocenter=.495; finalScrollAutocenter=.495; fov=30 (ставится один раз, отдельного твина fov в сцене нет); camera.zoom=Math.min(1, q.screen.aspectRatio*1.25); displacement.position=(.07,.025); shake.setScalar(.01); shakeSpeed.setScalar(.5); lerp* дефолтные .035; timelinePosition база (-13.25, 2.5, 13.25); timelineTarget база (0, 1, 0). ТАЙМЛИНИЯ (общая длительность 21 с): (t=0, d=14, power2.out) position.y 11.5 -> 2.5; (t=0, d=14, power2.out) target.y 15 -> 1; (t=7, d=14, power1.inOut) position.x -13.25 -> -15.25 и position.z 13.25 -> 23.25. Старт progress=0: pos(-13.25, 11.5, 13.25) target(0,15,0); финиш progress=1: pos(-15.25, 2.5, 23.25) target(0,1,0); точка 14/21=0.6667 — высота уже конечная. Интро: introPosition(-14,21,14), introTarget(0,.5,0), introWeight 0->1 (t=2, d=5.5, ease inOut1), basePosition=lerpVectors(introPosition,timelinePosition,introWeight); onStart интро-таймлинии зовёт controller.centerScroll((.495 - 1/3.35)*3.35, 0); cameraOptions до старта ставит basePosition(-14,4,14), baseTarget(0,1,0); playInAnimation: introTL.play(0) + delayedCall(5); звук ветра _windVolume = fit(progress,.05,.2,0,1)*fit(progress,.75,.95,1,0)

```glsl
class F3 extends Jo{constructor(e={}){super({orbit:!1}),this.controller=e.mainController,this.progress=0,
 this.height=2.35,this._isSceneVisible=!1,this.introPosition=new b,this.introTarget=new b,this.introWeight={value:0},
 this.timelinePosition=new b,this.timelineTarget=new b,this._needsReset=!1,
 this.initialScrollAutocenter=.495,this.finalScrollAutocenter=.495,this._windVolume=0,this._iglooVolume=0,this.init()}
cameraOptions(){this.camera.fov=30,this.camera.updateProjectionMatrix(),
 this.camera.basePosition.set(-14,4,14),this.camera.baseTarget.set(0,1,0),
 this.camera.displacement.position.set(.07,.025),
 this.camera.shake.setScalar(.01),this.camera.shakeSpeed.setScalar(.5)}
createIntroTimeline(){this.introTL=re.timeline({paused:!0,onStart:()=>{
 const I=1/(this.height+1),P=(this.initialScrollAutocenter-I)*(this.height+1);
 this.controller?.centerScroll(P,0),this.introPosition.set(-14,21,14),this.introTarget.set(0,.5,0)}});
 ... this.introTL.fromTo(this.introWeight,{value:0},{value:1,duration:5.5,ease:"inOut1"},2)}
createTimeline(){this.timelinePosition.set(-13.25,2.5,13.25),this.timelineTarget.set(0,1,0);
 const e=this.timelinePosition.toArray(),t=this.timelineTarget.toArray();
 this.timeline=re.timeline({paused:!0}),
 this.timeline.fromTo(this.timelinePosition,{y:e[1]+9},{y:e[1],duration:14,ease:"power2.out"},0),
 this.timeline.fromTo(this.timelineTarget,{y:t[1]+14},{y:t[1],duration:14,ease:"power2.out"},0),
 this.timeline.fromTo(this.timelinePosition,{x:e[0],z:e[2]},{x:e[0]-2,z:e[2]+10,duration:14,ease:"power1.inOut"},7),
 this.timeline.progress(1),this.timeline.progress(0)}
update(){this.timeline.progress(this.progress),
 this.camera.basePosition.lerpVectors(this.introPosition,this.timelinePosition,this.introWeight.value),
 this.camera.baseTarget.lerpVectors(this.introTarget,this.timelineTarget,this.introWeight.value), ... }
resize(){this.camera.zoom=Math.min(1,q.screen.aspectRatio*1.25),this.camera.updateProjectionMatrix()}
```

**Что делать у нас.** Собрать gsap.timeline({paused:true}) на объекты-векторы (не на саму камеру), в конце дёрнуть timeline.progress(1); timeline.progress(0) для прогрева, и каждый кадр звать timeline.progress(scrollProgress). Камеру двигать копированием этих векторов в basePosition/baseTarget. Числа: pos (-13.25,11.5,13.25)->(-15.25,2.5,23.25), target (0,15,0)->(0,1,0), fov 30, zoom min(1, aspect*1.25). Интро — отдельная таймлиния, которая гонит вес смешивания introWeight 0->1 за 5.5 с, а камера всё это время лежит на lerpVectors между интро-точкой и точкой ленты.

Строка бандла: 16312

### ПОДТВЕРЖДЕНО ДОСЛОВНО. СЦЕНА 2 — ГЛЫБЫ ЛЬДА (кубы, класс aF). Таймлинии нет вообще: камера линейно едет вниз по Y пропорционально прогрессу, а fov пульсирует от скорости скролла. Проверено: Be.cubes ровно три (hash pudgy-penguins / overpass / abstract), значит height=3.

**Числа.** height=Be.cubes.length=3; verticalOffset=-5.75; basePosition(0,0,5); baseTarget(0,0,0); displacement.position=(.1,.05); shake.setScalar(.02); shakeSpeed.setScalar(.1); baseUp не трогается; fov в cameraOptions НЕ ставится -> дефолт 45, но каждый кадр camera.fov = 45 - 5*Math.abs(controller.scroll.velocity) (45 в покое, до 40 на максимальной скорости, velocity зажат в [0,1]); camera.zoom=Math.min(1, aspectRatio*1.25); смещение по Y: e=(3+1)*(-5.75)*progress -> от 0 до -23, применяется и к basePosition.y, и к baseTarget.y; basePosition.z = 5 + cameraZoom.value; cameraZoom.value=0 в ленте, -3.5 при входе в проект (duration 1.25+delay, ease power3.in) и назад в 0 (duration 1.45, ease power3.out); touchAmount 1->0 при входе (duration 1.25+delay) и 0->1 при выходе (duration 1.45); кубы: additionalRotationAmount 1->0 (d=1+delay, power1.in) и 0->1 (d=1.45, power2.out); автоцентр к ближайшему кубу по centeredProgress: r=delta*(height+1), длительность ie.clamp(|r|*6, 1.6, 2.4), ease inOut3 (в centerScroll); при devScene cubes срезается до одного и verticalOffset=0

```glsl
const bp=new b;class aF extends Jo{constructor(e={}){super({orbit:!1}),
 this.options={cubes:Be.cubes,verticalOffset:-5.75},
 q.devScene&&(this.options.cubes=this.options.cubes.slice(0,1),this.options.verticalOffset=0),
 this.controller=e.mainController,this.progress=0,this.height=this.options.cubes.length, ...
 this._UP=new b,this._LEFT=new b,this.cameraZoom={value:0},this._shardVolume=0,this.init()}
cameraOptions(){this.camera.basePosition.set(0,0,5),this.camera.baseTarget.set(0,0,0),
 this.camera.displacement.position.set(.1,.05),
 this.camera.shake.setScalar(.02),this.camera.shakeSpeed.setScalar(.1),
 this.camera.initialPosition=this.camera.basePosition.clone(),
 this.camera.initialTarget=this.camera.baseTarget.clone()}
update(){const e=(this.options.cubes.length+1)*this.options.verticalOffset*this.progress;
 this.camera.basePosition.y=this.camera.initialPosition.y+e,
 this.camera.baseTarget.y=this.camera.initialTarget.y+e,
 this.camera.basePosition.z=this.camera.initialPosition.z+this.cameraZoom.value,
 bp.subVectors(this.camera.position,this.camera.target).normalize(),
 this._LEFT.crossVectors(this.camera.up,bp),this._UP.crossVectors(bp,this._LEFT), ...
 this.controller&&(this.camera.fov=45-5*Math.abs(this.controller.scroll.velocity),this.camera.updateProjectionMatrix()); ... }
autoCenter(e,t){let s=1/0,n=1/0;this.cubes.forEach((o,l)=>{const c=o.options.centeredProgress-this.progress,h=Math.abs(c);h<s&&(s=h,n=c)});
 const r=n*(this.height+1),a=ie.clamp(Math.abs(r)*6,1.6,2.4);e.centerScroll(e.scroll.y+r,a)}
detailAnimationIn(e=0){re.to(this.cameraZoom,{overwrite:!0,value:-3.5,duration:1.25+e,ease:"power3.in"}),
 re.to(this.cubes.map(t=>t.additionalRotationAmount),{overwrite:!0,value:0,duration:1+e,ease:"power1.in"}),
 re.to(this.camera,{touchAmount:0,overwrite:!0,duration:1.25+e}),this.cubes.forEach(t=>t.plexus.click())}
detailAnimationOut(){re.to(this.cameraZoom,{overwrite:!0,value:0,duration:1.45,ease:"power3.out", ...}),
 re.to(this.cubes.map(e=>e.additionalRotationAmount),{overwrite:!0,value:1,duration:1.45,ease:"power2.out"}),
 re.to(this.camera,{touchAmount:1,overwrite:!0,duration:1.45}), ...}
resize(){this.camera.zoom=Math.min(1,q.screen.aspectRatio*1.25),this.camera.updateProjectionMatrix(), ...}
```

**Что делать у нас.** Прямой линейный проезд: camera.y = -5.75*(N+1)*progress, target.y такой же. Никакого easing по позиции — вся живость от лерпа скролла и от fov=45-5*|velocity| (лёгкий зум-эффект при разгоне). Автоцентр на ближайшую карточку с длительностью clamp(|d|*6, 1.6, 2.4) и ease inOut3. Наезд на карточку — только смещение z через отдельный объект cameraZoom, чтобы твин не дрался с ежекадровой записью basePosition.

Строка бандла: 17646

### ПОДТВЕРЖДЕНО ДОСЛОВНО. СЦЕНА 3+4 — ТУННЕЛЬ И ВЫХОД К ФИГУРЕ ИЗ ЧАСТИЦ (класс UF, ключ 'entry'). Одна таймлиния 9.2 с покрывает и падение по туннелю, и прилёт в зал. Здесь камера переворачивается. Все пороги видимости и звука висят на onUpdate таймлинии и читают this.progress.

**Числа.** height=5.5; initialScrollAutocenter=.2; finalScrollAutocenter=.76; cameraOptions: fov=25, basePosition(0,5.5,0), baseTarget(0,0,0), displacement.position(.07,.025), lerpPosition=.02, lerpRotation=.02, lerpTarget=.015, shake.setScalar(.02), shakeSpeed.setScalar(.25); camera.zoom=Math.min(1, aspectRatio*1.5). Старт таймлинии: timelinePosition(0, 1.5, -2), timelineTarget(0, -2.5, -1). ТАЙМЛИНИЯ, полная длительность 9.2 с: (t=0, d=2.5, power2.out) position.z->0, position.x->0; (t=0, d=2.5, power2.out) target.z->0, target.x->0; (t=0.2, d=7, ease entry_ease_3) position.y 1.5 -> -9.83; (t=0.2, d=3, power1.inOut) target.y -2.5 -> -10; (t=3.2, d=2.5, power1.inOut) target.y -10 -> -9.81; (t=1, d=5.25, power3.inOut) upRotation 0 -> Math.PI; (t=3.5, d=3.7, ease entry_ease) upOriginal 0 -> 1; (t=3.5, d=3.7, ease entry_ease) position.z 0 -> -1.5; (t=7.2, d=2, ease entry_ease_2) position.z -1.5 -> -3; (t=7.2, d=2, power2.in) target.y -9.81 -> -10.35; FOV: set 22 в t=0, затем (t=0, d=7.2, power1.inOut) fov 22 -> 30; displacement: set (x:.01, y:.005) в t=0, (t=4, d=1, power2.inOut) -> (0,0); displacement.target (t=4, d=2, power2.inOut) -> (-.03,-.01); displacement.rotation set 0 в t=0, (t=4, d=2, power2.inOut) -> .05; вспышки колец uRingProximity: 0->1 за .5 (power1.in) и 1->0 за .4 (power1.out) в t=2, t=2.95, и 0->1 за .5 / 1->0 за .6 в t=3.8, колбэк s в t=2, 2.95, 3.8, 4.9. Пороги видимости по progress: rings .34/.43/.52, ringforcefield .1-.34 / .25-.43 / .36-.52, plasma .06-.34 / .25-.43 / .35-.52, smoketrail >0 и до .37/.47/.56, tunnel.mesh и snowparticles видимы при progress<.52, roomring при progress>.53; звук порталов: расстояние до ближайшей из точек .28/.375/.465, _portalsVolume=ie.ease(ie.fit(n,0,.04,1,0),'power2.out')*.9. Обновление матрицы проекции — только когда fov реально изменился (сравнение с прошлым значением в onUpdate).

```glsl
class UF extends Jo{constructor(e={}){super({orbit:q.devScene&&!q.query.playAnimation}),
 this.controller=e.mainController,this.progress=0,this.height=5.5,this._isSceneVisible=!1,
 this.initialScrollAutocenter=.2,this.finalScrollAutocenter=.76,
 this.timelinePosition=new b,this.timelineTarget=new b,this.timelineDisplacement=new H,this.timelineDisplacementTar=new H,
 this.timelineDisplacementRot={value:0},this.timelineAdditional={upRotation:0,upOriginal:0},
 this.lastProgress=0,this.direction=1, ... }
cameraOptions(){this.camera.fov=25,this.camera.updateProjectionMatrix(),
 this.camera.basePosition.set(0,5.5,0),this.camera.baseTarget.set(0,0,0),
 this.camera.displacement.position.set(.07,.025),
 this.camera.lerpPosition=.02,this.camera.lerpRotation=.02,this.camera.lerpTarget=.015,
 this.camera.shake.setScalar(.02),this.camera.shakeSpeed.setScalar(.25)}
async createTimeline(){this.timelinePosition.set(0,1.5,-2),this.timelineTarget.set(0,-2.5,-1);
 await this.composerReady;const e=this.___composerPass.material.uniforms;let t=this.camera.fov;
 this.timeline=re.timeline({paused:!0,onUpdate:()=>{this.camera.fov!==t&&(t=this.camera.fov,this.camera.updateProjectionMatrix()),
  this.rings.mesh0.visible=this.progress<.34, ... this.roomring.mesh.visible=this.progress>.53;
  let n=1/0;[.28,.375,.465].forEach(r=>{const a=Math.abs(this.progress-r);n=Math.min(n,a)}),
  this._portalsVolume=ie.ease(ie.fit(n,0,.04,1,0),"power2.out")*.9}}),
 this.timeline.to(this.timelinePosition,{z:0,x:0,duration:2.5,ease:"power2.out"},0),
 this.timeline.to(this.timelineTarget,{z:0,x:0,duration:2.5,ease:"power2.out"},0),
 this.timeline.to(this.timelinePosition,{y:-9.83,duration:7,ease:"entry_ease_3"},.2),
 this.timeline.to(this.timelineTarget,{y:-10,duration:3,ease:"power1.inOut"},.2),
 this.timeline.to(this.timelineTarget,{y:-9.81,duration:2.5,ease:"power1.inOut"},3.2),
 this.timeline.to(this.timelineAdditional,{upRotation:Math.PI,duration:5.25,ease:"power3.inOut"},1),
 this.timeline.to(this.timelineAdditional,{upOriginal:1,duration:3.7,ease:"entry_ease"},3.5),
 this.timeline.to(this.timelinePosition,{z:-1.5,duration:3.7,ease:"entry_ease"},3.5),
 this.timeline.to(this.timelinePosition,{z:-3,duration:2,ease:"entry_ease_2"},7.2),
 this.timeline.set(this.camera,{fov:22},0),
 this.timeline.to(this.camera,{fov:30,duration:7.2,ease:"power1.inOut"},0),
 this.timeline.set(this.timelineDisplacement,{x:.01,y:.005},0),
 this.timeline.set(this.timelineDisplacementRot,{value:0},0),
 this.timeline.to(this.timelineDisplacement,{x:0,y:0,duration:1,ease:"power2.inOut"},4),
 this.timeline.to(this.timeline
```

**Что делать у нас.** Одна пауз-таймлиния на 9.2 с, progress = прогресс сцены. Камера падает с y=1.5 до y=-9.83 (11.33 юнита) за 7 с по кастомной кривой entry_ease_3, точка взгляда уходит ниже камеры (до -10), потом чуть поднимается до -9.81, а в конце камера отъезжает назад по Z с 0 до -1.5 и до -3. FOV 22->30 — раскрытие поля при разгоне в трубе, updateProjectionMatrix звать только при реальном изменении fov. Все пороги видимости объектов вешать на onUpdate таймлинии по progress, а не на отдельные твины visible.

Строка бандла: 19733

### ПОДТВЕРЖДЕНО ДОСЛОВНО. КРЕН КАМЕРЫ В ТУННЕЛЕ — ровно 180 градусов. Реализован построением baseUp: базовый up = (0,0,-1), крутится вокруг мировой оси Y на upRotation, затем линейно (lerp, не slerp) подмешивается к мировому (0,1,0) по upOriginal и нормируется. Поскольку камера в этот момент смотрит почти строго вниз, поворот up вокруг Y = чистый крен вокруг оси взгляда. ДОПОЛНЕНО: кольца туннеля (класс cF, this.rings) синхронно докручиваются по своей оси Z на upRotation*0.4 — мир подхватывает поворот камеры.

**Числа.** upRotation: 0 -> Math.PI (3.141592653589793, ровно 180 градусов), duration 5.25 с, ease power3.inOut, старт t=1 -> в долях таймлинии от 1/9.2=0.1087 до 6.25/9.2=0.6793 прогресса сцены; средняя скорость 180/5.25=34.29 град/с таймлинии; upOriginal: 0 -> 1, duration 3.7, ease entry_ease, старт t=3.5 -> с 3.5/9.2=0.3804 до 7.2/9.2=0.7826 прогресса. Параллельно всегда работает шумовой крен (shake.z=.02, shakeSpeed.z=.25), а с t=4 добавляется мышиный крен displacement.rotation 0 -> .05 (d=2, power2.inOut). Кольца: mesh.rotation.z = scene.timelineAdditional.upRotation*.4 -> максимум PI*.4=1.2566 рад (72 градуса).

```glsl
update(){this.direction=this.progress>this.lastProgress?1:-1,this.lastProgress=this.progress,
 q.devScene||this.timeline.progress(this.progress),
 this.textcylinder.update(),this.smoketrail.update(),this.rings.update(),this.tunnel.update(),this.plasma.update(),
 this.camera.basePosition.copy(this.timelinePosition),
 this.camera.baseTarget.copy(this.timelineTarget),
 this.camera.displacement.position.copy(this.timelineDisplacement),
 this.camera.displacement.target.copy(this.timelineDisplacementTar),
 this.camera.displacement.rotation=this.timelineDisplacementRot.value,
 this.camera.baseUp.set(0,0,-1),
 this.camera.baseUp.applyAxisAngle($x.set(0,1,0),this.timelineAdditional.upRotation),
 this.camera.baseUp.lerp($x.set(0,1,0),this.timelineAdditional.upOriginal).normalize(),
 this._needsReset=!1, ... }
// класс колец cF (L17947-17955):
update(){const e=this.scene.timelineAdditional.upRotation*.4;this.meshes.forEach(t=>{t.rotation.z=e})}
```

**Что делать у нас.** Не крутить camera.rotation.z. Держать отдельные скаляры upRotation и upOriginal в таймлинии и каждый кадр пересобирать up: up = new Vector3(0,0,-1).applyAxisAngle(new Vector3(0,1,0), upRotation).lerp(new Vector3(0,1,0), upOriginal).normalize(). upRotation 0->PI за 5.25 с (power3.inOut), upOriginal 0->1 за 3.7 с (entry_ease) со сдвигом 2.5 с — именно этот перехлёст даёт ощущение, что мир перевернулся и потом выпрямился. Геометрию туннеля докручивать на долю того же угла (0.4), чтобы стены поворачивались вместе с кадром.

Строка бандла: 19733

### ПОДТВЕРЖДЕНО ДОСЛОВНО. ПЕРЕХОД ТУННЕЛЬ -> ФИГУРА ИЗ ЧАСТИЦ: камера НЕ поднимается. Она продолжает падать до пола зала, а последним движением отъезжает назад по -Z, одновременно доворачивая up к мировому верху и опуская точку взгляда. Проверено поиском по всему бандлу: после t=7.2 ни одного твина, поднимающего position.y.

**Числа.** position.y приходит на -9.83 к t=7.2 и дальше не меняется. position.z: 0 -> -1.5 за 3.7 с (t=3.5..7.2, ease entry_ease) = средняя 0.405 юнита/с; затем -1.5 -> -3 за 2 с (t=7.2..9.2, ease entry_ease_2) = средняя 0.75 юнита/с. target.y в это же время -9.81 -> -10.35 за 2 с (power2.in), взгляд опускается на 0.54 юнита. Скорость падения на туннельном участке: 1.5 -> -9.83 = 11.33 юнита за 7 с = 1.619 юнита/с в среднем (кривая entry_ease_3 сильно неравномерная). Появление частиц-фигуры: containerparticles.mesh visible=false в t=0, visible=true в t=1.5, uAlpha 0->1 за 2.5 с power2.inOut с t=1.5; uInitialGlow 1->0 за 1 с power1.inOut с t=3.9; uShowNoise (computationMaterial) 1->0 за 1.5 с power1.inOut с t=3.5; пол floor visible=false в t=0 и visible=true с t=3.4, uAlpha 0->1 за 5 с power2.out с t=3.4; текстовый цилиндр mesh и mesh2 visible с t=4.5, uAlpha 0->1 за 2 с power2.inOut с t=4.5; forcefield visible с t=4, uAlpha 0->1 за 2 с power2.inOut с t=4; groundsmoke visible с t=3.4, ceilingsmoke visible с t=4.5, groundsmoke uAlpha 0->1 за 3 с power2.out с t=4.4; ambientparticles visible с t=3.4, uAlpha 0->1 за 3 с power2.out с t=4.4; roomring.mesh.visible = progress>.53

```glsl
this.timeline.to(this.timelinePosition,{z:-1.5,duration:3.7,ease:"entry_ease"},3.5),
this.timeline.to(this.timelinePosition,{z:-3,duration:2,ease:"entry_ease_2"},7.2),
this.timeline.to(this.timelineTarget,{y:-10.35,duration:2,ease:"power2.in"},7.2),
this.timeline.set(this.containerparticles.mesh,{visible:!1},0),
this.timeline.set(this.containerparticles.mesh,{visible:!0},1.5),
this.timeline.fromTo(this.containerparticles.mesh.material.uniforms.uAlpha,{value:0},{value:1,duration:2.5,ease:"power2.inOut"},1.5),
this.timeline.fromTo(this.containerparticles.mesh.material.uniforms.uInitialGlow,{value:1},{value:0,duration:1,ease:"power1.inOut"},3.9),
this.timeline.fromTo(this.containerparticles.mesh.computationMaterial.uniforms.uShowNoise,{value:1},{value:0,duration:1.5,ease:"power1.inOut"},3.5),
this.timeline.set(this.floor.mesh,{visible:!1},0),this.timeline.set(this.floor.mesh,{visible:!0},3.4),
this.timeline.fromTo(this.floor.mesh.material.uniforms.uAlpha,{value:0},{value:1,duration:5,ease:"power2.out"},3.4),
this.timeline.set(this.textcylinder.mesh,{visible:!0},4.5),
this.timeline.fromTo(this.textcylinder.mesh.material.uniforms.uAlpha,{value:0},{value:1,duration:2,ease:"power2.inOut"},4.5),
this.timeline.set(this.forcefield.mesh,{visible:!0},4),
this.timeline.fromTo(this.forcefield.mesh.material.uniforms.uAlpha,{value:0},{value:1,duration:2,ease:"power2.inOut"},4),
this.timeline.set(this.ambientparticles.mesh,{visible:!0},3.4),
this.timeline.fromTo(this.ambientparticles.mesh.material.uniforms.uAlpha,{value:0},{value:1,duration:3,ease:"power2.out"},4.4)
```

**Что делать у нас.** Финал ленты собирать так: падение уже закончилось, камера стоит на y=-9.83, и вся динамика — отъезд по Z (0 -> -1.5 -> -3) плюс опускание target на 0.54. Фигура из частиц включается сильно раньше приезда камеры (t=1.5 из 9.2, то есть на 16% ленты) и разгорается 2.5 с, чтобы её было видно ещё из трубы. Каждый объект зала гасить парой set(visible:false) в t=0 и set(visible:true) в своей точке — тогда перемотка ленты назад корректно всё прячет.

Строка бандла: 19733

### ПОДТВЕРЖДЕНО ДОСЛОВНО. Кастомные кривые разгона (gsap CustomEase). ИСПРАВЛЕНИЕ: они создаются в ДВУХ разных местах. inOut1-inOut4 регистрируются в ядре бандла на строке 13304 сразу после re.config/re.defaults; inOut5, entry_ease, entry_ease_2, entry_ease_3, igloo_ease_1 — в bootstrap приложения на строке 20662, внутри асинхронного старта после проверки webgl2.

**Числа.** inOut1 = M0,0 C0.5,0 0.1,1 1,1; inOut2 = M0,0 C0.56,0 0,1 1,1; inOut3 = M0,0 C0.6,0 0,1 1,1; inOut4 = M0,0 C0.4,0 -0.06,1 1,1; inOut5 = M0,0 C0.171,0 0.77,-0.013 0.842,0.272 0.972,0.794 0.972,0.85 1,1; entry_ease = M0,0 C0.358,0 0.336,0.209 0.442,0.519 0.59,0.952 0.768,0.918 1,1; entry_ease_2 = M0,0 C0.388,0.082 0.924,0.862 1,1; entry_ease_3 = M0,0 C0.272,0 0.472,0.454 0.496,0.496 0.66,0.79 0.685,1 1,1; igloo_ease_1 = M0,0 C0.662,0.073 0.047,1 1,1; precision:2 у всех кроме inOut5. Дефолты gsap в проекте: ease 'power2.inOut', duration .6, overwrite 'auto', force3D true. Версия gsap-плагина в бандле 3.12.5. Строки: inOut1-4 -> 13304, остальные пять -> 20662.

```glsl
// L13304:
re.registerPlugin(Ei,dg,fg);re.config({force3D:!0});
re.defaults({ease:"power2.inOut",duration:.6,overwrite:"auto"});
Ei.create("inOut1","M0,0 C0.5,0 0.1,1 1,1",{precision:2});
Ei.create("inOut2","M0,0 C0.56,0 0,1 1,1",{precision:2});
Ei.create("inOut3","M0,0 C0.6,0 0,1 1,1",{precision:2});
Ei.create("inOut4","M0,0 C0.4,0 -0.06,1 1,1",{precision:2});
// L20662, в bootstrap приложения:
Ei.create("inOut5","M0,0 C0.171,0 0.77,-0.013 0.842,0.272 0.972,0.794 0.972,0.85 1,1"),
Ei.create("entry_ease","M0,0 C0.358,0 0.336,0.209 0.442,0.519 0.59,0.952 0.768,0.918 1,1",{precision:2}),
Ei.create("entry_ease_2","M0,0 C0.388,0.082 0.924,0.862 1,1",{precision:2}),
Ei.create("entry_ease_3","M0,0 C0.272,0 0.472,0.454 0.496,0.496 0.66,0.79 0.685,1 1,1",{precision:2}),
Ei.create("igloo_ease_1","M0,0 C0.662,0.073 0.047,1 1,1",{precision:2});
```

**Что делать у нас.** Подключить gsap CustomEase и зарегистрировать эти девять кривых дословно по SVG-путям, до создания любых таймлиний. entry_ease_3 (падение в туннеле) — двухступенчатая: быстрый разгон до середины, полка около 0.496, второй разгон — именно она даёт ощущение свободного падения с зависанием. entry_ease_2 — резкий старт и мягкое торможение для финального отъезда.

Строка бандла: 20662

### ПОДТВЕРЖДЕНО ДОСЛОВНО. Автоцентровка ленты по сценам (докрутка до кадра) — то, из-за чего лента ощущается как серия кадров, а не как непрерывный скролл. Флаг needed поднимается при любом изменении targetY2, срабатывает после 1.4 с покоя и только если сейчас нет активного твина автоцентра.

**Числа.** условие: autoCenter.needed && !autoCenter.animating && Fe.time - autoCenter.lastTime > 1.4; межсценовый доводчик: базовая длительность S=2, поправка _=((w===o ? 1-finalScrollAutocenter : initialScrollAutocenter) - 1/(height+1))*(height+1), цель y += _*Math.sign(v), S += _*2; igloo: initial/final autocenter .495, старт интро centerScroll((0.495 - 1/3.35)*3.35, 0); cubes: r=deltaCenteredProgress*(height+1), длительность ie.clamp(|r|*6, 1.6, 2.4); entry: срабатывает только при progress>.15, s=(0.76-progress)*(5.5+1), длительность ie.clamp(|s|*4, 2, 20); ease доводчика всегда inOut3; цель округляется ie.round(e,2); во время твина onUpdate синхронно тянет targetY1 и targetY2 за scroll.y

```glsl
if(this.autoCenter.needed&&!this.autoCenter.animating&&Fe.time-this.autoCenter.lastTime>1.4){
 this.autoCenter.needed=!1; ...
 if(typeof C.initialScrollAutocenter=="number"&&typeof C.finalScrollAutocenter=="number"){
  const M=1/(C.height+1),_=((w===o?1-C.finalScrollAutocenter:C.initialScrollAutocenter)-M)*(C.height+1);
  y+=_*Math.sign(v),S+=_*2}
 this.centerScroll(y,S)}
else o!==null&&(this.scrollComposers[o].passes[0].scene?.autoCenter?.call(u,this,A))
// L19733, entry:
autoCenter(e,t){if(this.progress>.15){const s=(this.finalScrollAutocenter-this.progress)*(this.height+1),
 n=ie.clamp(Math.abs(s)*4,2,20);e.centerScroll(e.scroll.y+s,n)}}
// L17646, cubes:
autoCenter(e,t){let s=1/0,n=1/0;this.cubes.forEach((o,l)=>{const c=o.options.centeredProgress-this.progress,h=Math.abs(c);h<s&&(s=h,n=c)});
 const r=n*(this.height+1),a=ie.clamp(Math.abs(r)*6,1.6,2.4);e.centerScroll(e.scroll.y+r,a)}
// доводчик:
centerScroll(e,t){const s=this.round(e);this.autoCenter.animating=!0,
 re.to(this.scroll,{y:s,duration:t,ease:"inOut3",overwrite:!0, ...})}
```

**Что делать у нас.** После 1.4 с покоя колеса догонять ближайшую опорную точку сцены твином по scroll.y с ease inOut3 и длительностью, пропорциональной оставшемуся расстоянию (для кубов множитель 6, зажим 1.6..2.4 с; для туннеля множитель 4, зажим 2..20 с). В onUpdate твина тянуть targetY1/targetY2 за scroll.y, иначе после доводки лента отскочит назад. Без этого камера зависает между кадрами.

Строка бандла: 20656

### ПОДТВЕРЖДЕНО ДОСЛОВНО. Сцена деталей проекта (класс JF) — камера, которая наезжает на объект внутри куба. Отдельная от ленты, включается по роутеру /portfolio/:project.

**Числа.** basePosition(0,0,2.5); baseTarget(0,0,0); displacement.position(0,0) — параллакса от мыши нет; lerpPosition=.02 (lerpTarget/lerpRotation остаются дефолтными .035); shake.setScalar(.05); shakeSpeed.setScalar(.05); fov дефолтный 45 (в cameraOptions не ставится); вход: camera.basePosition z 4 -> 2.5, duration 2, delay t+.5, ease inOut1; выход: z -> 4, duration .6, delay 0, ease 'none'; поворот объекта additionalRotationAmount -> 1 за 1 с delay t+1.5 ease power1.out, обратно -> 0 за .6 с ease power1.in; UI displayUIvar 0->1 за .7 с delay t+.5 (ease дефолтный power2.inOut); роутер: routes [{path:'/'},{path:'/portfolio/:project'}]

```glsl
class JF extends Jo{constructor(e={}){super({orbit:!1}),this.objects=[],this.controller=e.mainController,
 this.displayUIvar={value:0},this.init()}
cameraOptions(){this.camera.basePosition.set(0,0,2.5),this.camera.baseTarget.set(0,0,0),
 this.camera.displacement.position.set(0,0),this.camera.lerpPosition=.02,
 this.camera.shake.setScalar(.05),this.camera.shakeSpeed.setScalar(.05)}
playInAnimation(e,t=0){this.objects.forEach(s=>{s.mesh.visible=s.index===e}),
 re.to(this.objects.map(s=>s.additionalRotationAmount),{overwrite:!0,value:1,duration:1,delay:t+1.5,ease:"power1.out"}),
 re.fromTo(this.displayUIvar,{value:0},{value:1,duration:.7,delay:t+.5,onComplete:()=>{ ... }}),
 re.fromTo(this.camera.basePosition,{z:4},{overwrite:!0,z:2.5,duration:2,delay:t+.5,ease:"inOut1"})}
playOutAnimation(){re.to(this.camera.basePosition,{overwrite:!0,z:4,duration:.6,delay:0,ease:"none"}),
 re.to(this.objects.map(e=>e.additionalRotationAmount),{overwrite:!0,value:0,duration:.6,ease:"power1.in"}),
 re.killTweensOf(this.displayUIvar),Q.emit("webgl_project_hide")}
```

**Что делать у нас.** Наезд на карточку проекта: z 4 -> 2.5 за 2 с по inOut1 с задержкой 0.5 с, выход z -> 4 за 0.6 с линейно. Тряска сильная по амплитуде (0.05), но очень медленная (shakeSpeed 0.05) — объект как будто дышит. Параллакс от мыши здесь выключить полностью (displacement.position 0,0), чтобы карточка стояла ровно.

Строка бандла: 20656

### ПОДТВЕРЖДЕНО ДОСЛОВНО. UI-сцена (класс GF) — ортографическая камера логотипа/звука/скролла, лерпы отключены полностью, камера живёт в пиксельных координатах.

**Числа.** cameraType:'orthographic'; lerpPosition=0; lerpTarget=0; lerpRotation=0; при resize basePosition.set(q.screen.w*.5, -q.screen.h*.5, basePosition.z), baseTarget.set(basePosition.x, basePosition.y, 0); орто-фрустум приходит из фабрики: left=-w*.5, right=w*.5, top=h*.5, bottom=-h*.5, near=.1, far=1e3; UI-пасс добавляется в композер с clear=false; подсказка скролла гаснет, когда |scroll.y - round(initialScrollAutocenter)| > height*.25 у первой сцены

```glsl
class GF extends Jo{constructor(e={}){super({cameraType:"orthographic"}),this.controller=e.mainController,
 this.small=!1,this.mobile=!1,this.meshMarginLeft=0,this.meshMarginTop=0,this.scrollVisible=!0,this.init()}
cameraOptions(){this.camera.lerpPosition=0,this.camera.lerpTarget=0,this.camera.lerpRotation=0}
update(){if(this.scrollVisible&&this.controller){
 const t=this.controller.scrollComposers[0].passes[0].scene,
 s=Math.abs(this.controller.scroll.y-this.controller.round(t.initialScrollAutocenter));
 this.controller.scroll.y!==0&&s>t.height*.25&&(this.scrollVisible=!1,this.scroll.hide())} ... }
resize(){this.camera.basePosition.set(q.screen.w*.5,-q.screen.h*.5,this.camera.basePosition.z),
 this.camera.baseTarget.set(this.camera.basePosition.x,this.camera.basePosition.y,0),
 this.camera.updateProjectionMatrix(), ... }
```

**Что делать у нас.** Интерфейс держать в отдельной ортографической 3D-сцене поверх, с камерой в пиксельных координатах (левый верх в 0,0) и нулевыми лерпами, чтобы UI не плавал вместе с миром. Пасс UI класть в общий композер с clear=false.

Строка бандла: 20287

### ПОДТВЕРЖДЕНО ДОСЛОВНО. Математические хелперы ie, на которых стоят все сглаживания камеры и скролла (кадронезависимые). Объект объявлен как `const q=new OD,ie={...}` — искать по имени переменной, а не по `const ie=`.

**Числа.** clamp(i,e=0,t=1); lerp(i,e,t)=(1-t)*i+t*e; damp(i,e)=1-Math.exp(Math.log(1-i)*e); lerpCoefFPS(i)=damp(i, Fe.ratio); lerpFPS(i,e,t)=lerp(i,e,damp(t,ratio)); lerpFPSLimited(i,e,t,s=Infinity): n=lerpFPS(...), r=s*Fe.ratio, возврат i+clamp(n-i,-r,r); friction(i,e)=Math.exp(Math.log(i)*e); frictionFPS(i)=friction(i,Fe.ratio); efit/fit — линейная перекладка диапазонов, fit с зажимом; есть fit01/fit10/fit11, step, linearstep, smoothstep, smootherstep, parabola, pcurve. Базовый FPS: pg=60, BD=.2, PD=pg*BD=12, DD=pg/PD=5, Fe.ratio = Math.min(DD, dm/(1e3/pg)) = min(5, delta_ms/16.667); тикер — re.ticker.add, средний FPS считается окном RD=.5 c и минимум UD=5 замеров.

```glsl
const q=new OD,ie={TWO_PI:Math.PI*2,HALF_PI:Math.PI*.5,DEG2RAD:Math.PI/180,RAD2DEG:180/Math.PI,
 degrees(i){return i*this.RAD2DEG},radians(i){return i*this.DEG2RAD},
 clamp(i,e=0,t=1){return Math.max(e,Math.min(t,i))},
 lerp(i,e,t){return(1-t)*i+t*e},mix(i,e,t){return this.lerp(i,e,t)},
 deltaRatio(){return Fe.ratio},
 lerpCoefFPS(i){return this.damp(i,Fe.ratio)},
 lerpFPS(i,e,t){return this.lerp(i,e,this.lerpCoefFPS(t))},
 lerpFPSLimited(i,e,t,s=1/0){const n=this.lerpFPS(i,e,t),r=s*Fe.ratio,a=this.clamp(n-i,-r,r);return i+a},
 damp(i,e){return 1-Math.exp(Math.log(1-i)*e)},
 frictionFPS(i){return this.friction(i,Fe.ratio)},
 friction(i,e){return Math.exp(Math.log(i)*e)},
 efit(i,e,t,s,n){return s+(i-e)*(n-s)/(t-e)},
 fit(i,e,t,s,n){return this.efit(this.clamp(i,Math.min(e,t),Math.max(e,t)),e,t,s,n)}, ... }
// тайминг:
const tx=re.parseEase(),pg=60,BD=.2,PD=pg*BD;let DD=pg/PD,um=0,dm=16,_w=0,fm=60,pm=0;
const Fe={get time(){return um},get delta(){return dm},get frame(){return _w},
 get averageFPS(){return fm},get maxFPS(){return pm},
 get ratio(){return Math.min(DD,dm/(1e3/pg))}};
```

**Что делать у нас.** Обязательно взять damp/lerpFPS вместо голого lerp: 1-exp(log(1-k)*ratio), где ratio = min(5, dt/(1000/60)). Иначе на 144 Гц камера будет догонять втрое быстрее, чем на 60 Гц, и кривые разъедутся. Потолок ratio=5 нужен, чтобы после переключения вкладки лента не прыгнула. Трение — тоже через степень от ratio, а не умножение на константу.

Строка бандла: 13304

**Не найдено или не подтвердилось:**

- ВЫБРОШЕНО: ничего. Все 16 находок разбора подтверждены дословно, все номера строк оказались верными. Внесены только два уточнения: (1) кастомные кривые создаются в двух местах — inOut1..inOut4 на строке 13304, а inOut5/entry_ease/entry_ease_2/entry_ease_3/igloo_ease_1 на строке 20662; (2) находка про хелперы ie требует поиска по `ie={`, потому что в бандле объявление слито: `const q=new OD,ie={...}`.
- gsap ScrollTrigger не используется вообще. Строка 'ScrollTrigger' встречается ровно 2 раза и обе — на строке 13260 внутри ядра gsap (текст предупреждений/регистрации плагинов). Ни одного вызова ScrollTrigger.create, scrub, pin, trigger, start/end в прикладном коде нет.
- Ни одного вызова camera.lookAt(...) в прикладном коде. Проверено по всему файлу: `.lookAt(` встречается 21 раз, последнее вхождение на строке 13304 (это GD.lookAt внутри базовой камеры), все остальные — на строках 1599, 2245, 2786, 2787, 7508, 12885, то есть внутри ядра three.js. В диапазоне 13305-20662 совпадений ноль. Ориентация камеры строится только через this.quaternion.setFromRotationMatrix(GD.lookAt(position, target, up)).
- Нет сплайновых траекторий камеры. CatmullRomCurve3 присутствует на строках 11761 и 11954, CubicBezierCurve3 на 11841 и 11954, getPointAt на 11614, 11627, 11859, 11879, 11975 — всё это код three.js. (Разбор указывал диапазон 11748-11761, точные строки исправлены.) В сценах эти классы не используются — камера ведётся покомпонентными gsap-твинами по x/y/z.
- Нет массивов ключевых кадров камеры. 'waypoints' и 'cameraPath' — ноль вхождений во всём файле; 'keyframes' встречается 6 раз только на строках 12421, 13260, 13264 (ядро three.js и gsap). Вся раскадровка — вызовы timeline.to()/fromTo() с явными position/duration.
- Нет ни одного camera.quaternion.slerp: 'quaternion.slerp' — ноль вхождений во всём файле. 'rotation.z' встречается 17 раз (строки 14740, 15148, 15350, 15536, 15962, 17516, 17955, 20467), и ни одно из них не относится к камере: это mesh неба, гор, террейна, кубов, колец туннеля и UI-меша. Крен камеры делается только поворотом вектора up вокруг оси взгляда.
- Длительностей в реальных секундах у ленты нет: секунды в таймлиниях — это внутреннее время gsap-таймлинии, которую каждый кадр насильно ставят в timeline.progress(scrollProgress). Реальная скорость целиком зависит от того, как быстро пользователь крутит колесо (множитель 75e-5 на deltaY).
- Для сцены кубов (глыбы льда) НЕТ таймлинии камеры и нет кастомной кривой разгона: в классе aF нет ни одного re.timeline, камера едет строго линейно по progress. Единственная нелинейность — лерп самого скролла и fov=45-5*|velocity|.
- Для сцены с иглу отдельного твина fov нет: 'camera.fov' в классе F3 встречается ровно один раз, в cameraOptions (=30). Проверено по всему файлу: camera.fov присваивается только на строках 16312 (30, иглу), 17646 (45-5*|velocity|, кубы) и 19733 (25 в cameraOptions + твин 22->30 в таймлинии, туннель).
- Не найдено значения near/far, отличных от базовых: 'camera.near' и 'camera.far' — ноль вхождений во всём файле. Значения задаются один раз в фабрике камеры (ox=.1, lx=1e3) и ни одна сцена их не переопределяет.
- Не найдено кода, который поднимал бы камеру вверх на переходе туннель -> фигура: последнее движение по Y — падение до -9.83 (твин с t=0.2, d=7), дальше в таймлинии UF только отъезд по Z (-1.5 при t=3.5 и -3 при t=7.2) и опускание target до -10.35 при t=7.2.


## ИГЛУ

### Модели иглу: четыре draco-меша (кирпичи, каркас, контур, земля) плюс горы, патчи, интро-частицы. ПОДТВЕРЖДЕНО

**Числа.** igloo.drc через zt.batched (строка 16022); igloo/igloo_cage.drc (14952, класс w3); igloo/igloo_outline.drc (14993, класс C3); ground.drc (14793, класс y3 «igloobase»); mountain.drc (14993, класс S3); ground.drc второй раз (15148, класс M3 «terrain1..5»); igloo/patch.drc (15350, класс b3 «terrainpatch1..2»); intro_particles.drc (15536, класс T3). wt=1023 (RGBAFormat), Lt=1015 (FloatType) — строка 8. Yf="batchId" — строка 13321

```glsl
async init(){const e=await zt.batched("igloo.drc"),t=le.load("igloo/igloo_color.ktx2","srgb"),s=le.load("igloo/igloo_exploded_color.ktx2","srgb");let n=Math.sqrt(e.length);n=Math.ceil(n/4)*4,n=Math.max(n,4);const r=new Float32Array(n*n*4);this.optionsTexture=new Hi(r,n,n,wt,Lt);

// строка 13357 — что такое zt.batched:
batched(i){return this._initLoad(`batched_<>_${i}`,async e=>{const t=await this.load(i);e(lR(t))})}

// строка 13321 — lR режет геометрию по атрибуту batchId:
const Yf="batchId";
function lR(i){if(!i.attributes[Yf]||!i.getIndex())return console.warn("Geometry does not have a batchId or an index attribute"),[i];...return r}

// строка 11198: class cI extends Ce{...this.isBatchedMesh=!0...}  (THREE.BatchedMesh)
// строка 11005: class Hi extends Rt{...this.isDataTexture=!0...} (THREE.DataTexture)
// строка 8: wt=1023, Lt=1015
```

**Что делать у нас.** Иглу это НЕ один меш. Это BatchedMesh (cI, строка 11198), собранный из N отдельных геометрий-кирпичей, полученных функцией lR (строка 13321), которая режет один .drc по вершинному атрибуту batchId (константа Yf="batchId"). Плюс два служебных LineSegments поверх (cage, outline) и земля/горы/патчи отдельными мешами. У нас: экспортировать модель, где каждый кирпич отдельная группа с атрибутами batchId/centr/rand/emission, грузить через DRACOLoader, резать по batchId, складывать в THREE.BatchedMesh.

Строка бандла: 16022

### Позиция/поворот/масштаб иглу не задаются в коде, всё запечено в модели. ПОДТВЕРЖДЕНО

**Числа.** this.mesh.matrixAutoUpdate=!1; frustumCulled=!1; sortObjects=!1; receiveShadow=!1; castShadow=!1; renderOrder у иглу не задан (0). Земля igloobase renderOrder=2 (строка 14916); terrain1 renderOrder=1, terrain2 renderOrder=3, terrain3 renderOrder=1, terrain4/5 renderOrder=2 (15350); terrainpatch1/2 renderOrder=0 (15536); горы mountain1..5 renderOrder=1 (15148); дым smoke1/2 renderOrder=2 (14793); snowparticles renderOrder=5 (15923); cage и outline renderOrder=999; plexus lines 999, points 1000 (lineMesh.renderOrder+1), numbers 1001 (lineMesh.renderOrder+2)

```glsl
this.mesh=new cI(o,l,c,a),e.forEach((h,d)=>{this.mesh.addGeometry(h)}),this.scene.beforeRenderCbs.push(this.update.bind(this)),this.mesh.name="igloo",this.mesh.sortObjects=!1,this.mesh.matrixAutoUpdate=!1,this.mesh.receiveShadow=!1,this.mesh.castShadow=!1,this.mesh.frustumCulled=!1,this.plexus=new R3({scene:this.scene,parent:this}),await this.plexus.ready,this.scene.add(this.mesh),this.isReady()

// строка 14905, край земли:
alpha *= 1.0 - smoothstep(0.8, 1.0, length(vPos.xz) * 0.1085);
// строка 16109, верх иглу в интро-шейдере:
float introEmissive = 1.0 - falloffsmooth(vPos.y, 3.95, -0.4, 1.5, uIntroMaterialize);
// строка 16140, нижняя граница отлёта:
const d=ie.smoothstep(.45,.7,a.centroid.y);
```

**Что делать у нас.** Ничего не двигать в коде. Модель уже в мировых координатах: иглу в начале координат, верх около y=3.95 (по falloffsmooth в интро-шейдере), земля гаснет к length(xz)≈9.2 (smoothstep(0.8,1.0,len*0.1085)). Кирпичи начинают отлетать выше y=0.45..0.7.

Строка бандла: 16140

### Каждый кирпич пересчитан в локальные координаты относительно своего центроида; position объекта = centroid. ПОДТВЕРЖДЕНО дословно

**Числа.** Bh.fromArray(h.attributes.centr.array,0) — centr из первой вершины; u.rand = attributes.rand первой вершины; удаляются атрибуты centr, rand, batchId. It = THREE.Object3D (строка 1527)

```glsl
this._objects=[],e.forEach((h,d)=>{Bh.fromArray(h.attributes.centr.array,0);const u=new It;u.targetDisplacement1=0,u.targetDisplacement2=0,u.targetBounce1=0,u.targetBounce2=0,u.displacement=0,u.scrollDisplacement1=0,u.scrollDisplacement2=0,u.bounce=0,u.centroid=Bh.clone(),u.rand=Ls.fromArray(h.attributes.rand.array,0).clone(),u.position.copy(Bh),u._pieceIndex=d,this._objects.push(u),h.deleteAttribute("centr"),h.deleteAttribute("rand"),h.deleteAttribute("batchId");const f=h.attributes.position.count;for(let p=0;p<f;p++)Ls.fromArray(h.attributes.position.array,p*3),Ls.sub(Bh).toArray(h.attributes.position.array,p*3)});const o=e.length,l=e.reduce((h,d)=>h+d.attributes.position.count,0),c=e.reduce((h,d)=>h+d.index.count,0);this.mesh=new cI(o,l,c,a)
```

**Что делать у нас.** Для каждого кирпича: centroid = attributes.centr[0..2], rand = attributes.rand[0..2], затем вычесть centroid из всех position, чтобы кирпич вращался вокруг своего центра. Объект-пустышка THREE.Object3D на каждый кирпич, его matrix пишется в BatchedMesh.setMatrixAt(i, obj.matrix). Конструктор BatchedMesh получает (кол-во геометрий, суммарное кол-во вершин, суммарное кол-во индексов, материал).

Строка бандла: 16140

### ПОСТОЯННАЯ IDLE-АНИМАЦИЯ иглу (дышит без мыши) — три множителя, все кирпичи. ПОДТВЕРЖДЕНО дословно

**Числа.** базовая амплитуда 0.4; sin(-time*2 + centroid.x)*0.5+0.5; cos(-time)*0.5+0.5; mix(0.5, 2, rand.z); *0.5; * introDisplacementModulator.value. В devScene режиме t=1, s=0, n=1

```glsl
let t=ie.fit(this.scene.progress,0,this.scene.initialScrollAutocenter,0,1),
    s=ie.ease(ie.fit(this.scene.progress,0,.4,1,0),"sine.in"),
    n=this.scene._needsReset?1:.075;
q.devScene&&(t=1,s=0,n=1),
this._objects.forEach((a,o)=>{
  let l=.4;
  l*=Math.sin(-Fe.time*2+a.centroid.x)*.5+.5,
  l*=Math.cos(-Fe.time)*.5+.5,
  l*=ie.mix(.5,2,a.rand.z),
  l*=.5,
  l*=this.introDisplacementModulator.value;
  const c=Math.sin(Fe.time+a.rand.x*12.342)*a.rand.y,
        h=ie.fit(ie.smoothstep(1,3,Ls.copy(a.centroid).sub(this.mousePosition).length()),0,1,.5+.3*c,0);
  l=Math.max(l,h*t);
```

**Что делать у нас.** Точная формула холостого дыхания на кирпич:
idle = 0.4 * (sin(-t*2 + centroid.x)*0.5+0.5) * (cos(-t)*0.5+0.5) * mix(0.5, 2.0, rand.z) * 0.5 * introModulator.
Одна общая волна cos(-t), промодулированная бегущей по X волной sin(-t*2+x) и персональным множителем rand.z. Пик idle = 0.4*1*1*2*0.5 = 0.4. introDisplacementModulator тянется 0→1 за 2 сек ease linear на отметке 2.0 интро-таймлайна (строка 16312).

Строка бандла: 16140

### РЕАКЦИЯ НА МЫШЬ: не клик и не raycast, а расстояние до точки на плоскости. ПОДТВЕРЖДЕНО дословно

**Числа.** плоскость на расстоянии 19.25 от камеры; сглаживание курсора lerpCoefFPS(0.05); зона влияния smoothstep(1,3,dist); амплитуда 0.5+0.3*c, где c=sin(time + rand.x*12.342)*rand.y; mouseVelocity: +=len*0.01, *=frictionFPS(0.98), clamp(0,1)

```glsl
update(){var r;
  Si.planeInteraction.setCamera(this.scene.camera),
  Si.planeInteraction.setPlaneFromCameraTargetAndDistance(19.25),
  Ls.copy($t.get(0).position11);
  const e=Si.planeInteraction.getPointPositionOnPlane(Ls);
  Ls.copy(e),
  this.mousePosition.lerp(e,ie.lerpCoefFPS(.05)),
  this.mouseVelocity+=Ls.sub(this.mousePosition).length()*.01,
  this.mouseVelocity*=ie.frictionFPS(.98),
  this.mouseVelocity=ie.clamp(this.mouseVelocity,0,1);

// строка 13304, NDC курсора:
this.position11.copy(this.position01).multiplyScalar(2).subScalar(1)
```

**Что делать у нас.** Никакого Raycaster по иглу нет. position11 это NDC курсора (-1..1), строка 13304. Курсор анпроецируется на плоскость, перпендикулярную оси камеры, на расстоянии 19.25 от камеры. Точка сглаживается damp(0.05). Дальше на каждый кирпич: dist = |centroid - mousePosition|, hover = fit(smoothstep(1,3,dist), 0,1, 0.5+0.3*c, 0) — на dist<=1 полный эффект, на dist>=3 ноль. Итог l = max(idle, hover*t). Объект Si.planeInteraction объявлен на строке 13306, сами методы setPlaneFromCameraTargetAndDistance / getPointPositionOnPlane / unprojectDistance — на 13304.

Строка бандла: 16140

### Двойное сглаживание смещения и отскока (два каскада lerpFPS). ПОДТВЕРЖДЕНО дословно

**Числа.** bounce: 0.05 и 0.05; displacement: 0.06 и 0.06; вертикальная маска smoothstep(0.45, 0.7, centroid.y); запись в DataTexture: R=displacement (o*4+0), G=bounce (o*4+1)

```glsl
a.targetBounce1=l,
a.targetBounce2=ie.lerpFPS(a.targetBounce2,a.targetBounce1,.05),
a.bounce=ie.lerpFPS(a.bounce,a.targetBounce2,.05);
const d=ie.smoothstep(.45,.7,a.centroid.y);
l*=d,l=Math.max(0,l),
a.targetDisplacement1=l,
a.targetDisplacement2=ie.lerpFPS(a.targetDisplacement2,a.targetDisplacement1,.06),
a.displacement=ie.lerpFPS(a.displacement,a.targetDisplacement2,.06),
this.optionsTexture.image.data[o*4+0]=a.displacement,
this.optionsTexture.image.data[o*4+1]=a.bounce,
a.position.copy(a.centroid).addScaledVector(a.centroid,a.displacement);
// ... в конце update():
this.optionsTexture.needsUpdate=!0
```

**Что делать у нас.** bounce считается ДО вертикальной маски (нижние кирпичи тоже светят отражением от земли), displacement ПОСЛЕ (нижние не отлетают). Двойной каскад lerpFPS даёт мягкое ускорение/торможение. Смещение чисто радиальное: position = centroid + centroid*displacement (центр иглу в 0,0,0). Значения пишутся в DataTexture RGBA-Float (R=displacement, G=bounce), которая читается в вершинном шейдере через texelFetch по batchId.

Строка бандла: 16140

### Поворот кирпича при отлёте (косинус от собственного смещения плюс rand). ПОДТВЕРЖДЕНО дословно

**Числа.** по Y: cos(displacement*2 + rand.z*30)*displacement*0.5 + scrollDisplacement2*rand.x*-1.5; по Z: cos(displacement*2 + rand.x*30)*displacement*0.5 + scrollDisplacement2*rand.y*-1.5; по X: cos(displacement*2 + rand.y*30)*displacement*0.5 + scrollDisplacement2*rand.z*-1.5

```glsl
const A=a.scrollDisplacement2*a.rand.x*-1.5,m=a.scrollDisplacement2*a.rand.y*-1.5,g=a.scrollDisplacement2*a.rand.z*-1.5;
a.quaternion.identity(),
a.quaternion.multiply(cp.setFromAxisAngle(Ls.set(0,1,0),Math.cos(a.displacement*2+a.rand.z*30)*a.displacement*.5+A)),
a.quaternion.multiply(cp.setFromAxisAngle(Ls.set(0,0,1),Math.cos(a.displacement*2+a.rand.x*30)*a.displacement*.5+m)),
a.quaternion.multiply(cp.setFromAxisAngle(Ls.set(1,0,0),Math.cos(a.displacement*2+a.rand.y*30)*a.displacement*.5+g)),
a.updateMatrix(),
this.mesh.setMatrixAt(o,a.matrix)
```

**Что делать у нас.** Кватернион собирается заново каждый кадр из трёх setFromAxisAngle по осям Y, Z, X именно в этом порядке. Угол по каждой оси = cos(displacement*2 + rand.<другая компонента>*30) * displacement * 0.5 плюс скролловая добавка. Множитель 30 у rand даёт полный разброс фаз, кирпичи не крутятся синхронно.

Строка бандла: 16140

### Разлёт иглу по СКРОЛЛУ (второй, более сильный слой смещения). ПОДТВЕРЖДЕНО дословно

**Числа.** s = ease(fit(progress, 0, 0.4, 1, 0), "sine.in"); маска по высоте smoothstep(0.3, 1, centroid.y); множитель fit(rand.x, 0.4, 1, 0, 1)*2; коэффициент n = 0.075 (или 1 при _needsReset, и 1 при devScene)

```glsl
const u=ie.smoothstep(.3,1,a.centroid.y),f=ie.fit(a.rand.x,.4,1,0,1)*2,p=s*u*f;
a.scrollDisplacement1=ie.lerp(a.scrollDisplacement1,p,n),
a.scrollDisplacement2=ie.lerpFPS(a.scrollDisplacement2,a.scrollDisplacement1,n),
a.position.addScaledVector(a.centroid,a.scrollDisplacement2);
```

**Что делать у нас.** progress 0 → s=1 (иглу разлетелось), progress >= 0.4 → s=0 (иглу собрано). В самом начале страницы иглу СОБИРАЕТСЯ из кусков по мере скролла. Множитель до 2.0 радиуса. Первый lerp обычный ie.lerp (без FPS-нормализации), второй lerpFPS.

Строка бандла: 16140

### ВЕРШИННЫЙ ШЕЙДЕР ИГЛУ целиком. ПОДТВЕРЖДЕНО дословно (строки 16023-16079)

**Числа.** textureSize(batchingTexture,0).x; j = int(batchId)*4; texelFetch по ivec2(x..x+3, y); tOptions читается одним texelFetch по ivec2(x,y)

```glsl
//- edit
${ae}

/* BATCHING */
attribute float batchId;
uniform sampler2D batchingTexture;
mat4 getBatchingMatrix(const in float i) {
    int size = textureSize(batchingTexture, 0).x;
    int j = int(i) * 4;
    int x = j % size;
    int y = j / size;
    vec4 v1 = texelFetch(batchingTexture, ivec2(x, y), 0);
    vec4 v2 = texelFetch(batchingTexture, ivec2(x + 1, y), 0);
    vec4 v3 = texelFetch(batchingTexture, ivec2(x + 2, y), 0);
    vec4 v4 = texelFetch(batchingTexture, ivec2(x + 3, y), 0);
    return mat4(v1, v2, v3, v4);
}

uniform sampler2D tOptions;
vec4 getOptions(const in float i) {
    int size = textureSize(tOptions, 0).x;
    int x = int(i) % size;
    int y = int(i) / size;
    return texelFetch(tOptions, ivec2(x, y), 0);
}

// attribute vec3 rand;
attribute float emission;

varying vec2 vUv;
varying vec3 vPos;
varying float vDisplacement;
varying float vBounce;
varying float vEmission;

vec2 rotate(vec2 v, float a) {
    float s = sin(a);
    float c = cos(a);
    mat2 m = mat2(c, s, -s, c);
    return m * v;
}

void main() {
    vUv = uv;
    vEmission = emission;

    mat4 batchingMatrix = getBatchingMatrix(batchId);
    vec3 pos = (getBatchingMatrix(batchId) * vec4(position, 1.0)).xyz;
    vPos = pos;

    vec4 options = getOptions(batchId);
    vDisplacement = options.r;
    vBounce = options.g;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
```

**Что делать у нас.** Собственная реализация батчинга. Матрица кирпича читается texelFetch из batchingTexture (её пишет BatchedMesh), состояние (displacement, bounce) — из своей tOptions DataTexture по тому же batchId. vPos это позиция после батч-матрицы, весь фрагментный шейдер завязан на неё. ${ae} = "uniform Global{vec2 resolution;vec2 resolutionUI;float aspect;float time;float dtRatio;};" (строка 13252) — глобальный UBO, откуда берётся time. Атрибут rand в шейдере закомментирован, наружу идёт только emission.

Строка бандла: 16023

### СВЕЧЕНИЕ КИРПИЧЕЙ: по вершинному атрибуту emission, цвет vec3(0.5, 0.7, 1.0). ПОДТВЕРЖДЕНО дословно (строки 16118-16126)

**Числа.** blue = vec3(0.5, 0.7, 1.0) = #80B3FF; от разлёта: pow(vEmission, 2.0) * clamp(1.0*vDisplacement, 0.0, 1.0) * blue; idle: powEmission = pow(vEmission, 8.0) * blue * 0.5, модулируется (sin(vPos.x - time*1.0 + 3.2)*0.5+0.5); внутренние грани: max(0.0, smoothstep(0.0, 2.0, vPos.x*0.5 - vPos.z*0.5)) * powEmission

```glsl
// add emission based on displacement
color += pow(vEmission, 2.0) * clamp(1.0 * vDisplacement, 0.0, 1.0) * blue;

// add idle emission;
vec3 powEmission = pow(vEmission, 8.0) * blue * 0.5;
color += powEmission * (sin(vPos.x - time * 1.0 + 3.2) * 0.5 + 0.5);

// make inside of igloo glow, on faces furthest from camera
color += max(0.0, smoothstep(0.0, 2.0, vPos.x * 0.5 - vPos.z * 0.5)) * powEmission;
```

**Что делать у нас.** Признак, по которому кирпич зажигается, — вершинный float-атрибут emission, запечённый в igloo.drc (в бандле он только читается, нигде не вычисляется). Две степени одного значения: pow(emission,2.0) — широкое свечение, включается только при отлёте (умножено на displacement); pow(emission,8.0) — узкое, горит ВСЕГДА и пульсирует бегущей по X волной sin(vPos.x - time + 3.2). Третий член добавляет то же свечение граням, дальним от камеры. Цвет один на всю сцену: голубой #80B3FF.

Строка бандла: 16118

### ФРАГМЕНТНЫЙ ШЕЙДЕР ИГЛУ целиком. ПОДТВЕРЖДЕНО дословно (строки 16079-16139), номер строки исправлен с 16077 на 16079

**Числа.** exploded lightmap + 0.05; textureMix = clamp(5.0*vDisplacement,0,1); intro: falloffsmooth(vPos.y, 3.95, -0.4, 1.5, uIntroMaterialize), discard при introEmissive>0.9999, triangles UV*5.0, *13.0; fake SSS: (vPos.x*0.1+0.4)*0.3*min(vPos.y+0.5,1.0)*0.5; ground bounce: (1.0-smoothstep(-1.5,1.0,vPos.y)) * vBounce * vec3(0.8,0.9,1.0) * 0.25

```glsl
//- edit
${ae}
${Ue}

varying vec2 vUv;
varying vec3 vPos;
varying float vDisplacement;
varying float vEmission;
varying float vBounce;

uniform sampler2D tMap;
uniform sampler2D tMapExploded;
uniform sampler2D tTriangles;
uniform sampler2D tNoise;

uniform float uProgress;
uniform float uIntroMaterialize;

void main() {
    vec3 color = texture2D(tMap, vUv).rgb;
    vec3 exploded = texture2D(tMapExploded, vUv).rgb + 0.05;
    vec3 blue = vec3(0.5, 0.7, 1.0);

    // fade between 'together' lightmap and 'exploded' lightmap, based on displacement
    float textureMix = clamp(5.0 * vDisplacement, 0.0, 1.0);
    color = mix(color, exploded, textureMix);

    // intro animation
    if (uIntroMaterialize < 1.0) {
        float introEmissive = 1.0 - falloffsmooth(vPos.y, 3.95, -0.4, 1.5, uIntroMaterialize);
        if (introEmissive > 0.9999) discard;

        float triangles = texture2D(tTriangles, vUv * 5.0).r;
        introEmissive += clamp(introEmissive * triangles * 13.0, 0.0, 1.0);

        color += introEmissive * blue;
    }

    // add emission based on displacement
    color += pow(vEmission, 2.0) * clamp(1.0 * vDisplacement, 0.0, 1.0) * blue;

    // add idle emission;
    vec3 powEmission = pow(vEmission, 8.0) * blue * 0.5;
    color += powEmission * (sin(vPos.x - time * 1.0 + 3.2) * 0.5 + 0.5);

    // make inside of igloo glow, on faces furthest from camera
    color += max(0.0, smoothstep(0.0, 2.0, vPos.x * 0.5 - vPos.z * 0.5)) * powEmission;

    // add fake sss from sunlight (just a sideways gradient, but kept dark near the ground)
    color += (vPos.x * 0.1 + 0.4) * 0.3 * min(vPos.y + 0.5, 1.0) * 0.5;

    // color safety
    color = clamp(color, vec3(0.0), vec3(1.0));

    // add ground bounce
    float verticalGrad = (1.0 - smoothstep(-1.5, 1.0, vPos.y));
    color += (1.0 - smoothstep(-1.5, 1.0, vPos.y)) * vBounce * vec3(0.8, 0.9, 1.0) * 0.25;

    gl_FragColor = vec4(color, 1.0);
}
```

**Что делать у нас.** Света в сцене нет: ShaderMaterial (fe = THREE.ShaderMaterial, строка 2660) без нормалей и источников. Весь свет — две запечённые лайтмапы: igloo_color.ktx2 (собрано, AO в швах) и igloo_exploded_color.ktx2 (разлетелось, +0.05 подъём чёрного). Crossfade по clamp(5*displacement,0,1), то есть displacement=0.2 даёт полный переход. Фейковый SSS — градиент по X, притушенный у земли. Отражение от снега по vBounce, только у низа, цвет (0.8,0.9,1.0)*0.25. Переменная verticalGrad объявлена и не используется (выражение продублировано в следующей строке).

Строка бандла: 16079

### КАРКАС ИГЛУ (igloo_cage.drc) — LineSegments поверх, свой мерцающий шейдер. ПОДТВЕРЖДЕНО дословно

**Числа.** color "#a7b2d6", opacity 0.3, blending=pt=2 (AdditiveBlending, строка 8), depthTest=false, depthWrite=false, renderOrder=999, visible=!q.devScene; uProgress:{value:1}, uAlpha:{value:.185}; idleAnimation = sin(vColor.r*13.0 + time*6.0)*0.5+0.5; intro_shockwave = falloff(length(vWorldPos), 0.0, 20.0, 5.0, uProgress)

```glsl
// материал: let _3=class extends ga (ga = LineBasicMaterial, строка 11425), объявлен в конце строки 14916:
this.uniforms={uniformsGroups:[he.UBO],uProgress:{value:1},uAlpha:{value:.185}}

// vertex inject (замена #include <skinning_vertex>), строки 14926-14928:
vColor = color;
vCentr = centr;
vWorldPos = (modelMatrix * vec4(centr, 1.0)).xyz;

// fragment inject (замена #include <dithering_fragment>), строки 14942-14951:
float intro_gradientInput = length(vWorldPos);
float intro_shockwave = falloff(intro_gradientInput, 0.0, 20.0, 5.0, uProgress);

float alpha = uAlpha;
alpha *= intro_shockwave;

float idleAnimation = sin(vColor.r * 13.0 + time * 6.0) * 0.5 + 0.5;
alpha *= idleAnimation;

gl_FragColor.a = alpha;

// класс w3, строка 14952:
const e=await zt.load("igloo/igloo_cage.drc"),t=new _3({color:"#a7b2d6",opacity:.3,transparent:!0});
t.depthTest=!1,t.depthWrite=!1,t.blending=pt,t.transparent=!0,
this.mesh=new yr(e,t),this.mesh.frustumCulled=!1,this.mesh.visible=!q.devScene,this.mesh.name="igloo_cage",this.mesh.renderOrder=999
```

**Что делать у нас.** Каркас это отдельный LineSegments (yr = THREE.LineSegments, строка 11501) поверх иглу: depthTest выключен, аддитивный блендинг, всегда сверху. Мерцает по вершинному атрибуту color.r: alpha *= sin(color.r*13.0 + time*6.0)*0.5+0.5, каждое ребро со своей фазой, зашитой в цвет вершины. vWorldPos у каркаса берётся из centr, а не из position. Виден только в интро: uAlpha 0→0.4 за 0.1с на t=0, 0.4→0 за 3с на t=2.1, mesh.visible=false на t=5.1.

Строка бандла: 14952

### КОНТУР ИГЛУ (igloo_outline.drc) — второй LineSegments, живёт всё время, мерцание в трёх осях. ПОДТВЕРЖДЕНО дословно

**Числа.** color "#a7b2d6", opacity 0.3, blending=pt=2, depthTest/depthWrite=false, renderOrder=999, visible=true; uProgress:1, uAlpha:1, uScrollAlpha:0, uIntroMaterialize:0; idle: sin(y*6+t*5) * cos(z*6+t*5) * sin(x*6+t*5), каждый *0.5+0.5, затем *0.8+0.2; materialize: falloffsmooth(vWorldPos.y, 3.5, 0.1, 2.0, uIntroMaterialize); uScrollAlpha = ease(fit(progress,0,0.35,1,0),"sine.in")*2

```glsl
// материал class E3 extends ga, объявлен в конце строки 14952:
this.uniforms={uniformsGroups:[he.UBO],uProgress:{value:1},uAlpha:{value:1},uScrollAlpha:{value:0},uIntroMaterialize:{value:0}}

// vertex inject, строки 14962-14964:
vColor = color;
vCentr = centr;
vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;

// fragment inject, строки 14979-14992:
// intro materialize effect

float alpha = mix(uAlpha, 1.0, uScrollAlpha);
float idleAnimation = sin(vWorldPos.y * 6.0 + time * 5.0) * 0.5 + 0.5;
idleAnimation *= cos(vWorldPos.z * 6.0 + time * 5.0) * 0.5 + 0.5;
idleAnimation *= sin(vWorldPos.x * 6.0 + time * 5.0) * 0.5 + 0.5;
idleAnimation = idleAnimation * 0.8 + 0.2;
alpha *= idleAnimation;

// materialize effect
alpha *= falloffsmooth(vWorldPos.y, 3.5, 0.1, 2.0, uIntroMaterialize);

gl_FragColor.a = alpha;

// класс C3, строка 14993:
this.mesh.onBeforeRender=()=>{
  const s=ie.ease(ie.fit(this.scene.progress,0,.35,1,0),"sine.in")*2;
  this.mesh.material.uniforms.uScrollAlpha.value=s
};
```

**Что делать у нас.** Главный живой элемент, видимый ВСЕГДА (visible=true, в отличие от cage). Мерцание — произведение трёх синусов по мировым x, y, z с одной частотой 6.0 и скоростью time*5.0, поджато к диапазону 0.2..1.0, контур никогда не гаснет полностью. uScrollAlpha привязан к скроллу: на progress=0 значение 2 (mix зажимает alpha до 1), к progress=0.35 плавно (sine.in) уходит в базовую alpha. vWorldPos здесь из position, у cage — из centr.

Строка бандла: 14979

### ПЛЕКСУС: подсветка ближайших к курсору кирпичей точками, линиями и цифрами. ПОДТВЕРЖДЕНО дословно

**Числа.** maxPlexusPoints=5; maxPlexusConnections=2; animateLineInTime=0.1; animateLineOutTime=0.06; отбор: displacement>0.1, затем slice(0,5), затем __plexusDistance<2; смещение маркера +0.2 вдоль normalize(centroid); порог движения мыши 0.05; линии LineBasicMaterial color "#ffffff", opacity .25, depthTest=false, blending=2, renderOrder=999

```glsl
class R3{constructor({scene:e,parent:t}={}){this.scene=e,this.parent=t,this.ready=new Promise(s=>{this.isReady=s}),this.closest=[],this.lastMousePosition=new b,this.maxPlexusPoints=5,this.maxPlexusConnections=2,this.animateLineInTime=.1,this.animateLineOutTime=.06,this.isPlexusTransitioning=!1,this.init()}

// update():
Ih.copy(this.parent.scene.camera.position).sub(this.parent.mousePosition).normalize(),
Ya.copy(this.parent.mousePosition).addScaledVector(Ih,1);
const s=this.lastMousePosition.distanceTo(Ya)>.05;
s&&this.lastMousePosition.copy(Ya);
let n=this.parent._objects.map(u=>(u.__plexusDistance=u.position.distanceToSquared(Ya),u.__plexusDistReal=!1,...));
n.sort((u,f)=>u.__plexusDistance-f.__plexusDistance),
n=n.filter(u=>u.displacement>.1),
n=n.slice(0,this.maxPlexusPoints);
const r=u=>{u.__plexusDistReal||(u.__plexusDistReal=!0,u.__plexusDistance=Math.sqrt(u.__plexusDistance))};
if(n.forEach(r),this.closest.forEach(r),n=n.filter(u=>u.__plexusDistance<2), ... )
this.closest.forEach((u,f)=>{u.__UIPos=Ih.copy(u.position).addScaledVector(Ya.copy(u.centroid).normalize(),.2).toArray()});

// линии:
const t=new ga({color:"#ffffff",opacity:.25,transparent:!0});
t.depthTest=!1,t.depthWrite=!1,t.blending=pt,this.lineMesh=new yr(e,t),
this.lineMesh.renderOrder=999
```

**Что делать у нас.** Точка отсчёта смещена на 1 единицу от mousePosition В СТОРОНУ камеры (Ya = mousePosition + normalize(camera-mouse)*1.0), чтобы подсвечивались ближние к зрителю кирпичи. Берутся 5 ближайших с displacement>0.1 (уже отлетевших) и не дальше 2 единиц. Сортировка идёт по КВАДРАТУ расстояния, корень берётся только для отобранных. Плексус обновляется только когда мышь сдвинулась больше 0.05, и по одной точке за кадр (isPlexusTransitioning блокирует). Маркер на 0.2 наружу от кирпича. Плексус включается только когда introDisplacementModulator.value===1 (строка 16140).

Строка бандла: 16022

### Шейдер точек плексуса (квадратная рамка, вращается при появлении). ПОДТВЕРЖДЕНО дословно, строка исправлена с 15925 на 15924

**Числа.** uColor "#ffffff", uSize 200 (материал в конце строки 15923); gl_PointSize = uSize*progress/length(viewPos.xyz) * (resolution.y/1300.0); поворот UV mix(1.3, 0.0, vProgress); const float size = 0.125; alpha = shape*0.5; renderOrder = lineMesh.renderOrder+1 = 1000

```glsl
// материал (строка 15923):
const t=new fe({uniformsGroups:[he.UBO],uniforms:{uColor:{value:new Z("#ffffff")},uSize:{value:200}},vertexShader:`

// vertex
${ae}
${Rc}

attribute float progress;
uniform float uSize;

flat varying float vProgress;

void main() {
    vProgress = progress;
    vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
    float size = uSize * progress;

    gl_Position = projectionMatrix * viewPos;
    gl_PointSize = size / length(viewPos.xyz) * (resolution.y / 1300.0);
}

// fragment
${ae}
${Zo}
${Cr}

uniform vec3 uColor;

flat varying float vProgress;

void main() {
    if (vProgress < 0.001) discard;
    vec2 uv = rotateUV(gl_PointCoord.xy, mix(1.3, 0.0, vProgress));
    uv = uv * 2.0 - 1.0;

    const float size = 0.125;
    float shape = 1.0 - aastep(size, abs(uv.x)) * aastep(size, abs(uv.y));

    gl_FragColor = vec4(uColor, shape * 0.5);
}
```

**Что делать у нас.** THREE.Points (Fn, строка 11526), размер точки в пикселях нормирован на высоту экрана 1300px. При появлении маркер докручивается с 1.3 радиан до 0. Форма — квадратная рамка через 1 - aastep(0.125,|x|)*aastep(0.125,|y|). Cr это чанк с rotateUV/scaleUV, объявлен в конце строки 15923.

Строка бандла: 15924

### Цифры рядом с подсвеченным кирпичом — расстояние отлёта, две последние цифры от floor(dist*50). ПОДТВЕРЖДЕНО дословно

**Числа.** n = `${Math.floor(s*50)}`.slice(-2), где s = centroid.distanceTo(position); дополняется нулём слева; uSize = Math.min(.1, .08/(q.screen.h/1300)); смещение таблички: left*screenSide*uSize*1.75 и up*1.0*uSize; screenSide = -sign(projPos.x/projPos.w); геометрия двух плоскостей scale(.77777,1,1), translate(-.5- -.1,0,0) и translate(.5+-.1,0,0) то есть ∓0.4; numStep = 1.0/10.0; uColor "#ffffff", uSize 1; renderOrder = lineMesh.renderOrder+2 = 1001

```glsl
update(){const e=this.parent.closest;this.mesh.count=e.length;
for(let t=0;t<e.length;t++){
  if(e[t]){Th.position.fromArray(e[t].__UIPos),
  this.mesh.geometry.attributes.progress.array[t]=e[t].__plexusAnimation.value;
  const s=e[t].centroid.distanceTo(e[t].position);
  let n=`${Math.floor(s*50)}`.slice(-2);
  n.length<2&&(n=`0${n}`),
  this.mesh.geometry.attributes.nums.array[t*2]=n[0],
  this.mesh.geometry.attributes.nums.array[t*2+1]=n[1]}
  else Th.position.set(0,0,0),this.mesh.geometry.attributes.progress.array[t]=0,...
  Th.updateMatrix(),this.mesh.setMatrixAt(t,Th.matrix)}
this.mesh.material.uniforms.uSize.value=Math.min(.1,.08/(q.screen.h/1300));

// vertex, строки 15984-15997:
vec3 left = getViewLeft();
vec3 up = getViewUp();
float size = uSize;
vec4 pos = instanceMatrix * billboardModelMatrix() * vec4(position * size * power1In(progress), 1.0);
vec4 projPos = projectionMatrix * viewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
float screenSide = -sign(projPos.x / projPos.w);
pos.xyz += left * screenSide * uSize * 1.75;
pos.xyz += up * 1.0 * uSize;
gl_Position = projectionMatrix * viewMatrix * pos;

// fragment, строки 16014-16020:
float numStep = 1.0 / 10.0;
float num = float(vSide < 0 ? vNums.x : vNums.y);
vec2 uv = vec2(numStep * vUv.x + num * numStep, vUv.y);
float a = msdf(tNums, uv);
gl_FragColor = vec4(uColor, a);
```

**Что делать у нас.** Цифры не декорация: это фактическое смещение кирпича от его центроида, умноженное на 50 и обрезанное до двух младших разрядов. Рисуются MSDF-шрифтом из numbers-datatexture.ktx2 (атлас 10 цифр, шаг UV 1/10), билбордом, всегда с той стороны, которая ближе к краю экрана. Класс D3 объявлен на строке 15962, его шейдеры занимают 15963-16021, апдейт с цифрами — на 16022.

Строка бандла: 16022

### ЗЕМЛЯ ПОД ИГЛУ: свечение снега от положения курсора (vMouseGlow). ПОДТВЕРЖДЕНО дословно

**Числа.** радиус влияния 5.0; цвет vec3(0.5, 0.7, 1.0); маска по высоте курсора smoothstep(-0.5, 2.0, uMousePos.y); затухание к краю 1 - clamp(length(worldPos),0,9)/9; итог *2.0; своя мышь сглаживается lerpCoefFPS(0.03), плоскость тоже 19.25 через unprojectDistance; ударная волна земли vec3(0.3, 0.45, 1.0) (строка 14874)

```glsl
// vertex, строки 14814-14817:
// approximate light glow based on igloo interaction
vMouseGlow = (1.0 - clamp(distance(uMousePos, vWorldPos.xyz * vec3(1.0, 0.0, 1.0)), 0.0, 5.0) / 5.0) * vec3(0.5, 0.7, 1.0) * smoothstep(-0.5, 2.0, uMousePos.y);
vMouseGlow *= 1.0 - clamp(length(vWorldPos.xyz), 0.0, 9.0) / 9.0;
vMouseGlow *= 2.0;

// fragment, строки 14849-14853:
// ground glow based on mouse position
vec3 glow = texture2D(tGroundGlow, vUv).rgb;
float glowStrength = (sin(vPos.x - time * 1.0 + 3.2) * 0.5 + 0.5);
terrainColor += glow * glowStrength * terrainColor.r;
terrainColor += vMouseGlow * terrainColor.r;

// обновление мыши, строка 14916:
this.mesh.name="igloobase",this.mesh.renderOrder=2,...
this.scene.beforeRenderCbs.push(()=>{
  Si.planeInteraction.setCamera(this.scene.camera);
  const s=Si.planeInteraction.unprojectDistance(19.25);
  x3.copy(s),this.mousePosition.lerp(s,ie.lerpCoefFPS(.03))
});
```

**Что делать у нас.** Свет от горячих кирпичей на снегу подделан двумя способами. (1) Запечённая карта ground_glow.ktx2, пульсирующая ТОЙ ЖЕ волной, что и idle-свечение кирпичей: sin(vPos.x - time*1.0 + 3.2)*0.5+0.5 — синхронно, поэтому выглядит как настоящий отсвет. (2) vMouseGlow — сферическое пятно радиусом 5 вокруг проекции курсора, гаснущее если курсор ниже y=-0.5 и полностью гаснущее на радиусе 9 от центра. Оба множатся на terrainColor.r, свет ложится только на светлый снег. Считается в вершинном шейдере. У земли своя копия курсора со сглаживанием 0.03 (у иглу 0.05), но плоскость та же — 19.25.

Строка бандла: 14814

### КЛИКА И СВАЙПА ПО ИГЛУ НЕТ. Единственный жест — скролл. ПОДТВЕРЖДЕНО

**Числа.** scene.height=2.35; initialScrollAutocenter=0.495; finalScrollAutocenter=0.495; touch_click встречается в бандле РОВНО один раз — строка 18772 (UI сцены cubes); пороги клика wm=15 px, Em=0.5 с, трение velocity kf=0.95 (статические приватные поля класса Ul/bm, строка 13304)

```glsl
class F3 extends Jo{constructor(e={}){super({orbit:!1}),this.controller=e.mainController,this.progress=0,this.height=2.35,this._isSceneVisible=!1,this.introPosition=new b,this.introTarget=new b,this.introWeight={value:0},this.timelinePosition=new b,this.timelineTarget=new b,this._needsReset=!1,this.initialScrollAutocenter=.495,this.finalScrollAutocenter=.495,this._windVolume=0,this._iglooVolume=0,this.init()}

// эмиттер кликов, строка 13304:
onTouchEnd(e){...const s=Math.max(.001,Fe.time-U(this,fu));
this.swipeVelocity.copy(this.dragged).divideScalar(s),
Q.emit(`${this.eventID}_end`,this),
this.dragged.length()<U(bm,wm)&&s<U(bm,Em)&&e.type!=="pointerout"&&Q.emit(`${this.eventID}_click`,this)}
// te(Ul,wm,15), te(Ul,Em,.5), te(Ul,kf,.95)

// единственный подписчик, строка 18772:
Q.on("webgl_ui_particles_clicked",this.onUIClicked,this),Q.on("touch_click",this.onClick,this),Q.on("touch_end",this.onTouchEnd,this),Q.on("keydown",this.onKeyDown,this)
```

**Что делать у нас.** Не искать в иглу обработчик клика: его нет. Есть только (а) движение мыши → отлёт кирпичей и плексус, (б) скролл → progress → сборка иглу и полёт камеры. Событие touch_click генерируется (порог: перетаскивание меньше 15 px и время меньше 0.5 с), но сцена иглу на него не подписана. mouseVelocity в классе иглу считается (frictionFPS(0.98), clamp 0..1) и нигде не читается — мёртвый код.

Строка бандла: 16312

### Камера сцены иглу и её скролл-таймлайн. ПОДТВЕРЖДЕНО дословно

**Числа.** fov 30; basePosition(-14, 4, 14); baseTarget(0, 1, 0); displacement.position(0.07, 0.025); shake 0.01; shakeSpeed 0.5; zoom = min(1, aspectRatio*1.25). Таймлайн: pos(-13.25, 2.5, 13.25), target(0,1,0); position.y с 11.5 к 2.5 за 14с power2.out на t=0; target.y с 15 к 1 за 14с power2.out на t=0; x -2 и z +10 за 14с power1.inOut на t=7

```glsl
cameraOptions(){this.camera.fov=30,this.camera.updateProjectionMatrix(),this.camera.basePosition.set(-14,4,14),this.camera.baseTarget.set(0,1,0),this.camera.displacement.position.set(.07,.025),this.camera.shake.setScalar(.01),this.camera.shakeSpeed.setScalar(.5)}

createTimeline(){this.timelinePosition.set(-13.25,2.5,13.25),this.timelineTarget.set(0,1,0);
const e=this.timelinePosition.toArray(),t=this.timelineTarget.toArray();
this.timeline=re.timeline({paused:!0}),
this.timeline.fromTo(this.timelinePosition,{y:e[1]+9},{y:e[1],duration:14,ease:"power2.out"},0),
this.timeline.fromTo(this.timelineTarget,{y:t[1]+14},{y:t[1],duration:14,ease:"power2.out"},0),
this.timeline.fromTo(this.timelinePosition,{x:e[0],z:e[2]},{x:e[0]-2,z:e[2]+10,duration:14,ease:"power1.inOut"},7),
this.timeline.progress(1),this.timeline.progress(0)}

resize(){this.camera.zoom=Math.min(1,q.screen.aspectRatio*1.25),this.camera.updateProjectionMatrix()}

update(){var e;this.timeline.progress(this.progress),
this.camera.basePosition.lerpVectors(this.introPosition,this.timelinePosition,this.introWeight.value),
this.camera.baseTarget.lerpVectors(this.introTarget,this.timelineTarget,this.introWeight.value),...}
```

**Что делать у нас.** Камера с длинным фокусом (fov 30) стоит по диагонали (-14, 4, 14) и смотрит в (0,1,0). Скролл не двигает камеру напрямую: он проигрывает GSAP-таймлайн длиной 14 (progress 0..1 маппится на всю длину), в котором сначала камера падает сверху вниз (position.y с 11.5 до 2.5, target.y с 15 до 1), а во второй половине отъезжает вбок (x -2, z +10). Живость даёт displacement.position(0.07, 0.025) — параллакс от мыши, и shake 0.01 со скоростью 0.5. Zoom привязан к аспекту.

Строка бандла: 16312

### Интро-таймлайн сцены иглу целиком. ПОДТВЕРЖДЕНО дословно, все отметки сверены

**Числа.** camera.touchAmount 0→1 за 5с на t=2; uIntroMaterialize контура 0→1 за 2.5с power3.inOut на t=0; alpha контура 1→0 за 3с inOut4 на t=2; uProgress cage 0→1 за 4с sine.inOut на t=0; alpha cage 0→0.4 за 0.1с power2.inOut на t=0, 0.4→0 за 3с power2.inOut на t=2.1, mesh visible=true на t=0 и false на t=5.1; uIntroMaterialize ИГЛУ 0→1 за 2.25с ease "igloo_ease_1" на t=1.1; mesh иглу visible=false на t=0, true на t=1.1; introDisplacementModulator 0→1 за 2с linear на t=2; земля/террейн/патчи alpha 0 на t=0 и 1 на t=2.1; горы alpha 0→1 за 3с на t=0.7; uProgress земли, террейна, патчей и гор 0→1 за 7.5с inOut1 на t=0.7; uProgress2 тех же 0→1 за 7.5с inOut3 на t=0.7; uProgress интро-частиц 0→1 за 4с sine.out на t=0.5, их alpha 1→0 за 2с linear на t=1.75, mesh скрыт на t=3.75; дым 0→1 за 3с power2.inOut на t=2; снег 0→1 за 4с power2.inOut на t=2; небо 0→1 за 3с power2.inOut на t=1.5; uProgress иглу 0→1 за 1с power2.inOut на t=1; bloom intensity 1.5→1 за 2с sine.inOut на t=2.5; uGradientAlpha 0→1 за 4с sine.inOut на t=1; событие webgl_show_ui_intro на t=4.5; introWeight 0→1 за 5.5с inOut1 на t=2; introPosition(-14,21,14), introTarget(0,0.5,0); playInAnimation ждёт 5с

```glsl
this.introTL.fromTo(this.camera,{touchAmount:0},{touchAmount:1,duration:5},2),
this.introTL.fromTo(n,{value:0},{value:1,duration:2.5,ease:"power3.inOut"},0),
this.introTL.fromTo(r,{value:1},{value:0,duration:3,ease:"inOut4"},2),
this.introTL.fromTo(w,{value:0},{value:1,duration:4,ease:"sine.inOut"},0),
this.introTL.fromTo(C,{value:0},{value:.4,duration:.1,ease:"power2.inOut"},0),
this.introTL.fromTo(C,{value:.4},{value:0,duration:3,ease:"power2.inOut"},2.1),
this.introTL.set(this.igloocage.mesh,{visible:!0},0),
this.introTL.set(this.igloocage.mesh,{visible:!1},2.1+3),
this.introTL.fromTo(a,{value:0},{value:1,duration:2.25,ease:"igloo_ease_1"},1.1),
this.introTL.set(this.igloo.mesh,{visible:!1},0),
this.introTL.set(this.igloo.mesh,{visible:!0},1.1),
this.introTL.fromTo(o,{value:0},{value:1,duration:2,ease:"linear"},2),
this.introTL.set(l,{value:0},0),this.introTL.set(l,{value:1},2.1),
this.introTL.fromTo(d,{value:0},{value:1,duration:3},.7),
this.introTL.fromTo(u,{value:0},{value:1,duration:7.5,ease:"inOut1"},.7),
this.introTL.fromTo(m,{value:0},{value:1,duration:7.5,ease:"inOut3"},.7),
this.introTL.fromTo(y,{value:0},{value:1,duration:4,ease:"sine.out"},.5),
this.introTL.fromTo(S,{value:1},{value:0,duration:2,ease:"linear"},1.75),
this.introTL.fromTo(M,{value:0},{value:1,duration:3,ease:"power2.inOut"},2),
this.introTL.fromTo(s,{value:0},{value:1,duration:4,ease:"power2.inOut"},2),
this.introTL.fromTo(E,{value:0},{value:1,duration:3,ease:"power2.inOut"},1.5),
this.introTL.fromTo(_,{value:0},{value:1,duration:1,ease:"power2.inOut"},1),
this.introTL.fromTo(e,{value:1.5},{value:1,duration:2,ease:"sine.inOut"},2.5),
this.introTL.fromTo(t,{value:0},{value:1,duration:4,ease:"sine.inOut"},1),
this.introTL.call(()=>{Q.emit("webgl_show_ui_intro")},null,4.5),
this.introTL.fromTo(this.introWeight,{value:0},{value:1,duration:5.5,ease:"inOut1"},2)

// onStart:
const I=1/(this.height+1),P=(this.initialScrollAutocenter-I)*(this.height+1);
this.controller?.centerScroll(P,0),
this.introPosition.set(-14,21,14),this.introTarget.set(0,.5,0)
```

**Что делать у нас.** Порядок рождения сцены: сначала проволочный контур материализуется снизу вверх (0-2.5с), одновременно проступает каркас; на 0.5с стартуют интро-частицы; на 1.1с включается меш иглу и его кирпичи проявляются снизу вверх с голубым триангулярным свечением; на 2с включается холостое дыхание, контур и каркас гаснут, приходят дым и снег, идёт ударная волна по террейну (7.5с); на 4.5с показывается UI. Камера едет с (-14, 21, 14) вниз на рабочую позицию по introWeight за 5.5с с отметки 2.

Строка бандла: 16312

### Пользовательские easing-кривые, применённые к иглу. ПОДТВЕРЖДЕНО дословно

**Числа.** igloo_ease_1: CustomEase "M0,0 C0.662,0.073 0.047,1 1,1" precision 2 (строка 20662); inOut1 "M0,0 C0.5,0 0.1,1 1,1"; inOut2 "M0,0 C0.56,0 0,1 1,1"; inOut3 "M0,0 C0.6,0 0,1 1,1"; inOut4 "M0,0 C0.4,0 -0.06,1 1,1" — все четыре на строке 13304 с precision 2; inOut5 "M0,0 C0.171,0 0.77,-0.013 0.842,0.272 0.972,0.794 0.972,0.85 1,1" (без precision, строка 20662)

```glsl
Ei.create("inOut5","M0,0 C0.171,0 0.77,-0.013 0.842,0.272 0.972,0.794 0.972,0.85 1,1"),
Ei.create("entry_ease","M0,0 C0.358,0 0.336,0.209 0.442,0.519 0.59,0.952 0.768,0.918 1,1",{precision:2}),
Ei.create("entry_ease_2","M0,0 C0.388,0.082 0.924,0.862 1,1",{precision:2}),
Ei.create("entry_ease_3","M0,0 C0.272,0 0.472,0.454 0.496,0.496 0.66,0.79 0.685,1 1,1",{precision:2}),
Ei.create("igloo_ease_1","M0,0 C0.662,0.073 0.047,1 1,1",{precision:2})

// строка 13304:
Ei.create("inOut1","M0,0 C0.5,0 0.1,1 1,1",{precision:2});
Ei.create("inOut2","M0,0 C0.56,0 0,1 1,1",{precision:2});
Ei.create("inOut3","M0,0 C0.6,0 0,1 1,1",{precision:2});
Ei.create("inOut4","M0,0 C0.4,0 -0.06,1 1,1",{precision:2});
```

**Что делать у нас.** Скопировать дословно через gsap CustomEase.create с теми же SVG-путями. igloo_ease_1 (материализация кирпичей) — резкий старт и долгий хвост: первая контрольная точка почти на оси X (0.662, 0.073), вторая почти на потолке (0.047, 1).

Строка бандла: 20662

### Постобработка сцены иглу: свой LUT-пасс + Bloom. ПОДТВЕРЖДЕНО дословно, строка исправлена с 14700 на 14645 (материал)

**Числа.** LUT igloo/igloo_scene.ktx2 (luttetrahedral), uLUTSize:{value:1} (перезаписывается шириной текстуры), uLUTIntensity:{value:1}, uGradientAlpha:{value:0}; градиент gradient = mix(0.8, 1.0, (uv.x+uv.y)*0.5), затем mix(1.0, gradient, uGradientAlpha); Bloom: levels 6, luminanceThreshold 0.2, intensity 1, radius 0.85

```glsl
// материал, строка 14645:
let m3=class extends fe{constructor(){super({uniformsGroups:[he.UBO],uniforms:{tDiffuse:{value:null},tLUT:{value:le.load("igloo/igloo_scene.ktx2","luttetrahedral")},uLUTSize:{value:1},uLUTIntensity:{value:1},uGradientAlpha:{value:0}},vertexShader:`

// шейдер пасса, строки 14685-14698:
vec3 scene = texture2D(tDiffuse, uv).rgb;
float gradient = mix(0.8, 1.0, (uv.x + uv.y) * 0.5);
gradient = mix(1.0, gradient, uGradientAlpha);
scene *= gradient;

vec3 sceneColor = apply3DLUTTetrahedral(scene.rgb, tLUT, uLUTSize, uLUTIntensity);

gl_FragColor = vec4(sceneColor, 1.0);

// строка 14700, размер LUT берётся из ширины текстуры:
`}),setTimeout(async()=>{const e=this.uniforms.tLUT.value;await e._loaded,this.uniforms.uLUTSize.value=e.image.width},0)}};
async function A3(i,e){const t=new Eg(new m3);t.isIglooColorCorrectionPass=!0,e.addPass(t),await t.material.uniforms.tLUT.value._loaded}

// строка 16312, renderOptions():
e.addPass(new Fd().addBloom({debug:q.devScene,levels:6,luminanceThreshold:.2,intensity:1,radius:.85}))
```

**Что делать у нас.** Голубое свечение кирпичей выглядит объёмным из-за Bloom с низким порогом (0.2) и большим радиусом (0.85) на 6 уровнях мип-пирамиды. Цветокор — 3D LUT с тетраэдральной интерполяцией, загружается из ktx2 как sampler3D, uLUTSize подставляется шириной картинки после загрузки. Плюс диагональная виньетка-градиент от 0.8 в левом нижнем углу до 1.0 в правом верхнем, включаемая по uGradientAlpha (0→1 за 4с на t=1 интро).

Строка бандла: 14645

### Звук иглу привязан к тому, светятся ли кирпичи под курсором. ПОДТВЕРЖДЕНО дословно

**Числа.** igloo.ogg volume 0, autoPlay true, loop true; громкость = (n.length>0 ? 1 : 0) * _windVolume, сглаживание lerpFPS 0.1, на выходе * 0.5; ветер wind.ogg volume 0 autoPlay loop, _windVolume = fit(progress, 0.05, 0.2, 0, 1) * fit(progress, 0.75, 0.95, 1, 0), на выходе * 0.4; music-highq.ogg volume 0.2; room.ogg volume 0.45

```glsl
// R3.update(), конец, строка 16022:
const c=(n.length>0?1:0)*this.scene._windVolume;
this.scene._iglooVolume=ie.lerpFPS(this.scene._iglooVolume,c,.1)

// F3.update(), строка 16312:
this._windVolume=ie.fit(this.progress,.05,.2,0,1)*ie.fit(this.progress,.75,.95,1,0),
Q.emit("webgl_set_audio_volume","wind",this._windVolume*.4),
Q.emit("webgl_set_audio_volume","igloo",this._iglooVolume*.5),
this._needsReset=!1

// строка 14444:
this._controller.addAudio({name:"wind",url:"wind.ogg",volume:0,autoPlay:!0,loop:!0}),
this._controller.addAudio({name:"igloo",url:"igloo.ogg",volume:0,autoPlay:!0,loop:!0}),
this._controller.addAudio({name:"music-bg",url:"music-highq.ogg",volume:.2,autoPlay:!0,loop:!0}),
this._controller.addAudio({name:"room-bg",url:"room.ogg",volume:.45,autoPlay:!0,loop:!0})
```

**Что делать у нас.** Звук иглу и ветра играют ВСЕГДА в цикле с нулевой громкостью, наружу выкручивается только громкость. Иглу звучит только когда курсор реально задел отлетевшие кирпичи (в списке n есть точки), и только настолько, насколько сейчас слышен ветер. Сглаживание lerpFPS(0.1).

Строка бандла: 16022

### Полный список ассетов сцены иглу. ПОДТВЕРЖДЕНО дословно

**Числа.** geo: igloo.drc, igloo/igloo_cage.drc, igloo/igloo_outline.drc, ground.drc (дважды: igloobase и terrain), mountain.drc, igloo/patch.drc, intro_particles.drc; tex: igloo/igloo_color.ktx2 (srgb), igloo/igloo_exploded_color.ktx2 (srgb), igloo/triangles_tiling.ktx2 (srgb-repeat), perlin-datatexture.ktx2 (srgb-repeat), igloo/ground_color.ktx2 (srgb), igloo/ground_glow.ktx2 (srgb), igloo/ground_sansigloo_color.ktx2 (srgb), igloo/mountain_color.ktx2 (srgb), igloo/numbers.ktx2 (srgb-repeat), wind_noise.ktx2 (srgb-repeat), mosaic.ktx2 (srgb-repeat-nearest), numbers-datatexture.ktx2 (data), igloo/igloo_scene.ktx2 (luttetrahedral); цвета: снег #d1d6e3, тень #afb6c7, интро-небо #b3bac9, проволока #a7b2d6, свечение vec3(0.5,0.7,1.0)=#80B3FF, ударная волна земли vec3(0.3,0.45,1.0)=#4D73FF; небо bd(800,12,12)

```glsl
const a=new fe({uniformsGroups:[he.UBO],uniforms:{
  tMap:{value:t},
  tMapExploded:{value:s},
  tTriangles:{value:le.load("igloo/triangles_tiling.ktx2","srgb-repeat")},
  tNoise:{value:le.load("perlin-datatexture.ktx2","srgb-repeat")},
  tOptions:{value:this.optionsTexture},
  uProgress:{value:0},
  uIntroGlow:{value:1},
  uIntroMaterialize:{value:q.devScene?1:0}
},vertexShader:`...`})

// земля, строка 14793 (класс y3):
uniforms:{tMap:{value:le.load("igloo/ground_color.ktx2","srgb")},tGroundGlow:{value:le.load("igloo/ground_glow.ktx2","srgb")},tWind:{value:le.load("wind_noise.ktx2","srgb-repeat")},tTriangles:{value:le.load("igloo/triangles_tiling.ktx2","srgb-repeat")},tNoise:{value:le.load("mosaic.ktx2","srgb-repeat-nearest")},uMousePos:{value:this.mousePosition},uProgress:{value:q.devScene?1:0},uProgress2:{value:q.devScene?1:0},uTriangleAlpha:{value:1},uAlpha:{value:1}}

// горы, строка 14993 (класс S3):
uColor1:{value:new Z("#d1d6e3")},uColor2:{value:new Z("#afb6c7")}

// небо, строка 14700 (класс g3):
const e=new bd(800,12,12),t=new fe({uniformsGroups:[he.UBO],uniforms:{uColor1:{value:new Z("#d1d6e3")},uColor2:{value:new Z("#afb6c7")},uIntroColor:{value:new Z("#b3bac9")},uProgress:{value:0}}})

// интро-частицы, строка 15536 (класс T3):
tNumbers:{value:le.load("igloo/numbers.ktx2","srgb-repeat")},uProgress:{value:0},uAlpha:{value:1}
```

**Что делать у нас.** Все текстуры в KTX2 (Basis), геометрия в Draco. Одна и та же triangles_tiling.ktx2 используется в иглу, земле, горах, патчах — общий тех-паттерн треугольников для всех эффектов материализации. Небо это сфера радиусом 800 с 12x12 сегментами и теми же цветами плюс отдельный интро-цвет #b3bac9.

Строка бандла: 16022

### Точные реализации математических хелперов. ПОДТВЕРЖДЕНО дословно, плюс раскрыто значение DD

**Числа.** lerp(a,b,t) = (1-t)*a + t*b; lerpCoefFPS(k) = damp(k, Fe.ratio); damp(k,e) = 1 - exp(log(1-k)*e); frictionFPS(k) = exp(log(k)*Fe.ratio); linearstep(a,b,x) = clamp((x-a)/(b-a),0,1); smoothstep = s*s*(3-2*s); efit(x,a,b,c,d) = c + (x-a)*(d-c)/(b-a); fit = efit с предварительным clamp; Fe.ratio = min(DD, dm/(1000/60)); pg=60, BD=.2, PD=pg*BD=12, DD=pg/PD=5 (потолок ratio, эквивалент 12 fps); dm стартует с 16

```glsl
lerp(i,e,t){return(1-t)*i+t*e},
mix(i,e,t){return this.lerp(i,e,t)},
deltaRatio(){return Fe.ratio},
lerpCoefFPS(i){return this.damp(i,Fe.ratio)},
lerpFPS(i,e,t){return this.lerp(i,e,this.lerpCoefFPS(t))},
lerpFPSLimited(i,e,t,s=1/0){const n=this.lerpFPS(i,e,t),r=s*Fe.ratio,a=this.clamp(n-i,-r,r);return i+a},
damp(i,e){return 1-Math.exp(Math.log(1-i)*e)},
frictionFPS(i){return this.friction(i,Fe.ratio)},
friction(i,e){return Math.exp(Math.log(i)*e)},
efit(i,e,t,s,n){return s+(i-e)*(n-s)/(t-e)},
fit(i,e,t,s,n){return this.efit(this.clamp(i,Math.min(e,t),Math.max(e,t)),e,t,s,n)},
linearstep(i,e,t){return this.clamp((t-i)/(e-i),0,1)},
smoothstep(i,e,t){const s=this.linearstep(i,e,t);return s*s*(3-2*s)},
ease(i,e="linear"){return(tx[e]||tx.none)(i)}

// глобальные часы, та же строка:
const tx=re.parseEase(),pg=60,BD=.2,PD=pg*BD;
let DD=pg/PD,um=0,dm=16,_w=0,fm=60,pm=0;
const Fe={get time(){return um},get delta(){return dm},get frame(){return _w},get averageFPS(){return fm},get maxFPS(){return pm},get ratio(){return Math.min(DD,dm/(1e3/pg))}};
```

**Что делать у нас.** Все коэффициенты сглаживания (0.05, 0.06, 0.075, 0.03, 0.1) — это доля пути за кадр при 60 fps, прогнанная через damp(k, deltaRatio). Если применять их как обычный lerp без FPS-нормализации, на 120 Гц анимация станет вдвое быстрее. Копировать damp/friction как есть. Потолок ratio DD равен 5: при лагах ниже 12 fps шаг перестаёт расти, анимация не выстреливает.

Строка бандла: 13304

### GLSL-хелперы falloff / falloffsmooth, на которых держатся все материализации. ПОДТВЕРЖДЕНО дословно

**Числа.** дословный код чанка Ue и чанка ae на строке 13252

```glsl
Ue="float _linstep(float begin,float end,float t){return clamp((t-begin)/(end-begin),0.0,1.0);}
float _pl(vec2 _input,vec2 start,vec2 end,float margin,float progress){vec2 v=end-start;float dist=length(v);vec2 dir=v/dist;return dot(dir,_input-start-dir*(dist+margin)*progress);}
float _pl(vec3 _input,vec3 start,vec3 end,float margin,float progress){vec3 v=end-start;float dist=length(v);vec3 dir=v/dist;return dot(dir,_input-start-dir*(dist+margin)*progress);}
float falloff(float _input,float start,float end,float margin,float progress){float m=margin*sign(end-start);float p=mix(start-m,end,progress);return _linstep(p+m,p,_input);}
float falloffsmooth(float _input,float start,float end,float margin,float progress){float m=margin*sign(end-start);float p=mix(start-m,end,progress);return smoothstep(p+m,p,_input);}
float falloff(vec2 _input,vec2 start,vec2 end,float margin,float progress){return _linstep(0.0,-margin,_pl(_input,start,end,margin,progress));}
float falloffsmooth(vec2 _input,vec2 start,vec2 end,float margin,float progress){return smoothstep(0.0,-margin,_pl(_input,start,end,margin,progress));}
float falloff(vec3 _input,vec3 start,vec3 end,float margin,float progress){return _linstep(0.0,-margin,_pl(_input,start,end,margin,progress));}
float falloffsmooth(vec3 _input,vec3 start,vec3 end,float margin,float progress){return smoothstep(0.0,-margin,_pl(_input,start,end,margin,progress));}";

ae="uniform Global{vec2 resolution;vec2 resolutionUI;float aspect;float time;float dtRatio;};";
```

**Что делать у нас.** Единственный приём, которым сделаны все волны материализации на сайте: движущийся вдоль величины _input порог шириной margin, положение которого задаётся progress. falloffsmooth(y, 3.95, -0.4, 1.5, p) значит: при p=0 порог выше 3.95 (ничего не видно), при p=1 порог на -0.4 (видно всё), ширина размытия 1.5. Вставить чанк Ue в каждый шейдер и дальше строить любые проявления одной строкой.

Строка бандла: 13252

**Не найдено или не подтвердилось:**

- ВЫБРОШЕНО из прошлого разбора: пункт «значение константы DD обрезано, grep даёт DD= без числа». Это неверно. На строке 13304 стоит `const tx=re.parseEase(),pg=60,BD=.2,PD=pg*BD;let DD=pg/PD`, то есть DD = 60/(60*0.2) = 5, и больше DD нигде не переприсваивается (единственное присваивание в файле). Значение добавлено в находку про математические хелперы.
- ИСПРАВЛЕНО: в прошлом разборе сказано «uHover / uHoverMix есть только в СЦЕНЕ CUBES, строки 17346 и 17421». Сцена верная, номера нет: uHover впервые встречается на 17262, дальше 17275, 17293, 17346, 17358, 17377, 17406; uHoverMix — 17358, 17379, 17409. В шейдерах и классах иглу их нет.
- ИСПРАВЛЕНО: фрагментный шейдер иглу начинается на строке 16079 (fragmentShader:`), тело 16080-16139, а не на 16077 (16077 это последняя строка вершинного шейдера, gl_Position).
- ИСПРАВЛЕНО: шейдер точек плексуса начинается на 15924, а не 15925; материал точек (uColor #ffffff, uSize 200) объявлен в конце строки 15923. Класс цифр D3 объявлен на 15962, его шейдеры 15963-16021.
- ИСПРАВЛЕНО: материал LUT-пасса (igloo_scene.ktx2, uLUTIntensity 1, uGradientAlpha 0) объявлен на строке 14645, шейдер 14685-14698, функция A3 подключения пасса — 14700.
- ИСПРАВЛЕНО: материалы cage (_3) и outline (E3) объявлены в конце строк 14916 и 14952 соответственно; классы-мешы w3 и C3 — на 14952 и 14993.
- ИСПРАВЛЕНО: объект Si.planeInteraction объявлен на строке 13306, а его методы setPlaneFromCameraTargetAndDistance / getPointPositionOnPlane / unprojectDistance — на 13304. Классы пружин eR и tR тоже на 13306 и в сцене иглу не используются.
- Явных position / rotation / scale для меша иглу в коде НЕТ. matrixAutoUpdate=false и матрица никогда не задаётся, значит меш стоит в единичной матрице, вся геометрия уже в мировых координатах внутри igloo.drc. Габарит модели числом нигде не записан.
- Обработчика клика или свайпа ПО ИГЛУ нет. Строка "touch_click" встречается в бандле ровно один раз — на строке 18772, где на неё подписан UI сцены cubes. Ни F3, ни U3, ни R3 не слушают touch_click / touch_end / touch_start / touch_drag.
- Raycaster / intersectObject по иглу не используется: они есть только в 12885 (детект браузера/общий Raycaster three.js) и 14181 (универсальный класс интеракции), в классах сцены иглу их нет. Вся реакция на курсор идёт через анпроекцию на плоскость и сравнение расстояний в JS. Слов hover, uHover, uActive, fresnel, rim, emissive в шейдерах и классах иглу нет.
- Как вычисляется вершинный атрибут emission — в бандле НЕТ. Он приходит готовым внутри igloo.drc: слово emission встречается только на 16050 (объявление attribute), 16067 (vEmission=emission) и в фрагментном шейдере через vEmission. Логика «какие кирпичи считать светящимися» осталась в 3D-пакете.
- Численного значения количества кирпичей нет: размер optionsTexture считается динамически (n=ceil(sqrt(e.length)/4)*4, min 4), e.length зависит от содержимого igloo.drc.
- Слов brick и seam как имён переменных/uniform в шейдерах иглу нет: brick встречается только внутри списка CSS-цветов (firebrick, строка 1857), seam — в регулярке детекта браузера (seamonkey, 12885) и в комментариях чужого пасса про хроматическую аберрацию (14543, 14566). Швы и кирпичность целиком запечены в лайтмапы igloo_color.ktx2 / igloo_exploded_color.ktx2.
- spring / damping как отдельная физика для иглу не применяются: только каскады lerpFPS.
- Мёртвые униформы материала иглу: uIntroGlow объявлен в uniforms (строка 16022) и не встречается в тексте шейдеров ни разу; uProgress объявлен в фрагментном шейдере (16095) и нигде не читается, при этом в интро-таймлайне он всё равно анимируется 0→1 за 1с на отметке 1.
- this.mouseVelocity в классе иглу считается каждый кадр (строка 16140: += len*0.01, *= frictionFPS(0.98), clamp 0..1), но нигде не читается — мёртвый код.
- В фрагментном шейдере иглу переменная verticalGrad объявлена (строка 16135) и не используется: то же выражение продублировано целиком в следующей строке.


## ГЛЫБЫ

### Конфиг всех глыб: их РОВНО ТРИ (Be.cubes), с моделью, иконкой, датой, температурой и текстом интерьера. ПОДТВЕРЖДЕНО ДОСЛОВНО

**Числа.** 3 глыбы. [0] title "PORTFOLIO_CO_01 Pudgy Penguins", hash "pudgy-penguins", date "01/02/2020", temp 0, obj "cube3", innerobject "pudgy", interior.obj "pudgy", objScale 1.1. [1] "PORTFOLIO_CO_02 Overpass", hash "overpass", date "06/01/2023", temp -3, obj "cube1", innerobject "overpass_logo", objScale 1.2. [2] "PORTFOLIO_CO_03 Abstract", hash "abstract", date "06/28/2024", temp -5, obj "cube2", innerobject "abstractlogo", objScale 1.2. Цвета: colorTitle "#3C3C54", colorText "#ffffff", colorProjectTitle "#67707E", colorProjectText "#A1AAB7", colorLogo "#ffffff". Подписи: click "Click to explore", clickDisabled "???????????????", close "Close", socialTitle "/// Discover", linkTitle "/// Visit", interior.title "////// Summary". ДОПОЛНЕНО из того же места: gridSize 125 / gridSizeLow 50 / gridSizeMobile 25, topMargin 90 / 45 / 25, breakpointW 1600, breakpointH 800, breakPointMobile 640, manifesto.title "////// Manifesto", copyright "// Copyright © 2026", rights "Igloo, Inc.\nAll Rights Reserved.", scroll "Scroll down to discover.", follow "/// Follow Us", links[] LinkedIn vdb "peachesbody_64" scale 1.2 / X vdb "x_64" scale 1.3 / Medium vdb "medium_32" scale 1.25, volume 1, muted true. ВАЖНАЯ ПОПРАВКА: у ВСЕХ ТРЁХ глыб interior.enabled:!0, так что строка clickDisabled в бандле мёртвая, некликабельных глыб на сайте нет.

```glsl
const Be={gridSize:125,gridSizeLow:50,gridSizeMobile:25,topMargin:90,topMarginLow:45,topMarginMobile:25,breakpointW:1600,breakpointH:800,breakPointMobile:640,colorLogo:"#ffffff",colorTitle:"#3C3C54",colorText:"#ffffff",colorProjectTitle:"#67707E",colorProjectText:"#A1AAB7",
 manifesto:{title:"////// Manifesto",text:"Our mission is to build the next generation of consumer brands at the intersection of Community, AI, and crypto."},
 copyright:"// Copyright © 2026",rights:`Igloo, Inc.
All Rights Reserved.`,scroll:"Scroll down to discover.",follow:"/// Follow Us",click:"Click to explore",clickDisabled:"???????????????",close:"Close",
 social:[{name:"X",link:"https://twitter.com/iglooinc"},{name:"LI",link:"..."}],
 cubes:[{title:"PORTFOLIO_CO_01 Pudgy Penguins",hash:"pudgy-penguins",date:"01/02/2020",temp:0,obj:"cube3",innerobject:"pudgy",interior:{enabled:!0,title:"////// Summary",content:`...`,socialTitle:"/// Discover",social:[...],linkTitle:"/// Visit",links:[{name:"website",link:"https://www.pudgypenguins.com"}],obj:"pudgy",objScale:1.1}},
 {title:"PORTFOLIO_CO_02 Overpass",hash:"overpass",date:"06/01/2023",temp:-3,obj:"cube1",innerobject:"overpass_logo",interior:{enabled:!0,...obj:"overpass_logo",objScale:1.2}},
 {title:"PORTFOLIO_CO_03 Abstract",hash:"abstract",date:"06/28/2024",temp:-5,obj:"cube2",innerobject:"abstractlogo",interior:{enabled:!0,...obj:"abstractlogo",objScale:1.2}}],
 links:[{title:"LinkedIn",url:"...",vdb:"peachesbody_64",scale:1.2},{title:"X / Twitter",url:"...",vdb:"x_64",scale:1.3},{title:"Medium",url:"...",vdb:"medium_32",scale:1.25}],volume:1,muted:!0};
```

**Что делать у нас.** Завести один объект-конфиг с массивом из 3 записей, где каждая запись несёт имя .drc глыбы, имя .drc иконки, hash для URL, дату, температуру и весь текст интерьера. Всё остальное (сцена, тексты, выноски, интерьер) строится из этого массива циклом, нигде не хардкодится. Сам объект Be объявлен на строке 14437, массив cubes переносится на 14438.

Строка бандла: 14437

### Геометрия глыбы: Draco-модель cubes/{obj}.drc + BVH для клика. Никаких примитивов. ПОДТВЕРЖДЕНО

**Числа.** zt.load(`cubes/${obj}.drc`) — cube1.drc, cube2.drc, cube3.drc; иконка грузится БЕЗ префикса cubes/: zt.load(`${innerobject}.drc`). Плюс cubes/background_shapes.drc для фоновых осколков (строка 17516, renderOrder 9, текстура shapes_blurred.ktx2). mesh.renderOrder=3, computeBoundingBox(), computeBoundingSphere(), boundsTree=new bg(geometry). ДОПОЛНЕНО: класс меша — class bE extends Ce{} с bE.prototype.raycast=VL (акселерированный рейкаст three-mesh-bvh), сама глыба лежит в группе class nF extends Gi (Group) с именем `group{index}`.

```glsl
// 17421:
class bE extends Ce{}bE.prototype.raycast=VL;
class nF extends Gi{constructor(e,t){super(),this.scene=e,this.options={index:0,obj:"cube3",innerobject:"pudgy",centeredProgress:0,scrollPosition:0,rand:Math.random(),...t},this.name=`group${this.options.index} `,this.position.y=this.options.scrollPosition,this.additionalRotationAmount={value:1},...}

// 17423-17429:
async init(){const[e,t]=await Promise.all([zt.load(`cubes/${this.options.obj}.drc`),zt.load(`${this.options.innerobject}.drc`)]);
this.mesh=new bE(e,new WL(3)),this.mesh.name=`cube${this.options.index} `,this.mesh.renderOrder=3,
this.mesh.geometry.computeBoundingBox(),this.mesh.geometry.computeBoundingSphere(),
this.mesh.geometry.boundsTree=new bg(this.mesh.geometry),this.add(this.mesh),
```

**Что делать у нас.** Глыбы моделить в 3D и грузить как Draco .drc (не BoxGeometry, не IcosahedronGeometry). Обязательно computeBoundingBox — на его гранях потом висят точки крепления выносок. Для клика подменить raycast меша на acceleratedRaycast из three-mesh-bvh, построить boundsTree и включить firstHitOnly, иначе рейкаст по тяжёлому мешу будет тормозить.

Строка бандла: 17423

### Материал льда: three.js MeshPhysicalMaterial + свой onBeforeCompile. Полный список uniform и свойств. ПОДТВЕРЖДЕНО

**Числа.** new WL(3) на строке 17425 — AWESOME_SAMPLES=3 (дефолт класса 5). Базовый класс: class WL extends Ys, где Ys — MeshPhysicalMaterial (isMeshPhysicalMaterial=!0, строка 12235). uniforms: tTriangles="igloo/triangles_tiling.ktx2" (srgb-repeat), tBlue="noises/blue-8-128-rgb.ktx2" (colordata-repeat), uBlueOffset=vec2, tMouseFrost=null, uColorFrost=#83a1c5, uChromaticAberration=0.1, uTransmission=1, uThickness=2, uAttenuationDistance=0, uAttenuationColor=#ffffff, uTransmissionSamplerSize=vec2, tTransmissionSamplerMap=null, uResolution=(1,1). Свойства материала (строки 17429-17433): color=#e0e8ef, roughnessMap=cubes/{obj}_roughness.ktx2, roughness=0.65, envMap=cubes_env.exr, envMapIntensity=0.91, envMapRotation.y=Math.PI, normalMap=cubes/{obj}_normal.ktx2, normalScale=(1,1), ior=1.18, reflectivity=0.3, transmission=0. ПОПРАВКА: uniform uTransmission объявлен в GLSL (строка 16492), но НИ РАЗУ не участвует ни в одном выражении шейдера — это мёртвый uniform.

```glsl
class WL extends Ys{constructor(e=5){super(),this.defines.AWESOME_SAMPLES=e,this.uniforms={
 tTriangles:{value:le.load("igloo/triangles_tiling.ktx2","srgb-repeat")},
 tBlue:{value:le.load("noises/blue-8-128-rgb.ktx2","colordata-repeat")},
 uBlueOffset:{value:new H},tMouseFrost:{value:null},
 uColorFrost:{value:new Z("#83a1c5")},
 uChromaticAberration:{value:.1},uTransmission:{value:1},uThickness:{value:2},
 uAttenuationDistance:{value:0},uAttenuationColor:{value:new Z("#ffffff")},
 uTransmissionSamplerSize:{value:new H},tTransmissionSamplerMap:{value:null},
 uResolution:{value:new H(1,1)}},this.onBeforeCompile=t=>{...}

// применение (17429-17433):
this.mesh=new bE(e,new WL(3)) ...
s.material.color.setStyle("#e0e8ef"),
s.material.roughnessMap=le.load(`cubes/${obj}_roughness.ktx2`),
s.material.roughness=.65,
s.material.envMap=this.scene.envmap,
s.material.envMapIntensity=.91,
s.material.envMapRotation.y=Math.PI,
s.material.normalMap=le.load(`cubes/${obj}_normal.ktx2`),
s.material.normalScale.set(1,1),
s.material.ior=1.18,
s.material.reflectivity=.3,
s.material.transmission=0
```

**Что делать у нас.** Взять MeshPhysicalMaterial, поставить ior=1.18 (низкий, «мутный лёд», не стекло 1.5), roughness=0.65, reflectivity=0.3, envMapIntensity=0.91, envMapRotation.y=PI, цвет #e0e8ef. transmission на самом материале держать 0 — вся прозрачность считается своим блоком шейдера через uThickness и свою функцию преломления. Толщина uThickness=2 постоянная, карты толщины нет. uTransmission заводить не надо, в бандле он не используется.

Строка бандла: 16486

### Двухпроходная трансмиссия: сначала рендер ТЫЛЬНЫХ граней глыбы в отдельный RT вместе с иконкой, потом лицевые грани преломляют этот RT. ПОДТВЕРЖДЕНО

**Числа.** _transmissionRT=new vt(2,2,{generateMipmaps:!0,type:Mi,minFilter:Qs,samples:0}); в resize() setSize(resolution.x, resolution.y) — полное разрешение экрана. Константы: Mi=1016 (HalfFloatType), Qs=1008 (LinearMipmapLinearFilter), ei=1 (BackSide), es=0 (FrontSide). Проход 1: side=ei, tTransmissionSamplerMap=this._bgTex (le.load("cubes/bg.png","srgb")), uTransmissionSamplerSize=(4,4), mesh3 (иконка) visible=true, mesh2 (дым) visible=false, plexus.group visible=false, textsGroup/blurrytext/backgroundshapes visible=false. Проход 2: side=es, tTransmissionSamplerMap=_transmissionRT.texture, uTransmissionSamplerSize=(RT.width,RT.height), mesh3 visible=false, mesh2/plexus/тексты обратно visible=true.

```glsl
this.cubes.forEach(r=>{r.mesh.material.side=ei,r.mesh.material.needsUpdate=!0,
 r.mesh.material.uniforms.tTransmissionSamplerMap.value=this._bgTex,
 r.mesh.material.uniforms.uTransmissionSamplerSize.value.set(4,4),
 r.mesh3.visible=!0,r.mesh2.visible=!1,r.plexus.group.visible=!1}),
this.textsGroup.visible=!1,this.blurrytext.mesh.visible=!1,this.backgroundshapes.mesh.visible=!1;
const t=he.renderer.webgl.getRenderTarget();
he.renderer.webgl.setRenderTarget(this._transmissionRT);
he.renderer.webgl.clear(!0,!0,!0);
he.renderer.webgl.render(this,this.camera);
he.renderer.webgl.setRenderTarget(t);
this.cubes.forEach(r=>{r.mesh.material.side=es,r.mesh.material.needsUpdate=!0,
 r.mesh.material.uniforms.tTransmissionSamplerMap.value=this._transmissionRT.texture,
 r.mesh.material.uniforms.uTransmissionSamplerSize.value.set(this._transmissionRT.width,this._transmissionRT.height),
 r.mesh3.visible=!1,r.mesh2.visible=!0,r.plexus.group.visible=!0}),
this.textsGroup.visible=!0,this.blurrytext.mesh.visible=!0,this.backgroundshapes.mesh.visible=!0;
```

**Что делать у нас.** Каждый кадр: (1) прячем всё, что не должно преломляться (тексты, дым, плексус, фоновые фигуры), включаем иконку, ставим side=BackSide, подсовываем как фон-заглушку cubes/bg.png с размером сэмплера 4x4, рендерим сцену в half-float RT размером с экран с мипмапами; (2) возвращаем side=FrontSide, отдаём этот RT в шейдер как tTransmissionSamplerMap с настоящим размером, прячем иконку, показываем остальное и рендерим на экран. Иконка ВНУТРИ глыбы никогда не рисуется напрямую — её видно только сквозь преломление.

Строка бандла: 17646

### Ядро шейдера льда: хроматическая аберрация через 3 раздельных выборки преломления по R, G, B с разным ior и разной толщиной. ПОДТВЕРЖДЕНО

**Числа.** Число сэмплов подставляется в GLSL шаблоном ${e}, где e=3 (AWESOME_SAMPLES) — в коде это `float totalSamples = ${e}.0;` и `for (float i = 0.0; i < ${e}.0; i ++)`. thickness_smear = uThickness * pow(roughnessFactor, 0.33). noise=getNoise(tBlue, gl_FragCoord.xy, uBlueOffset), noise2=getNoise(tBlue, gl_FragCoord.xy+vec2(8.4,9.6), uBlueOffset*+vec2(1.34,34.32)). distortionNormal = roughnessFactor*roughnessFactor*2.0*normalize(noise2.xyz) + mousefrost*0.025. R: ior как есть, толщина uThickness + smear*(i+noise.g)/3. G: ior*(1.0 + uChromaticAberration*(i+noise.r)/3). B: ior*(1.0 + 2.0*uChromaticAberration*(i+noise.b)/3). Дальше transmitted /= 3.0, transmitted.a = 1.0, totalDiffuse = transmitted.rgb, totalDiffuse = clamp(...,0,1) (строки 16740-16742). Голубой шум сдвигается каждый кадр: uBlueOffset.value.set(Math.random(), Math.random()) в nF.update (17516).

```glsl
if (uChromaticAberration > 0.0) {
    float transmissionR, transmissionB, transmissionG;
    float thickness_smear = uThickness * pow(roughnessFactor, 0.33);
    vec4 noise = getNoise(tBlue, gl_FragCoord.xy, uBlueOffset);
    vec4 noise2 = getNoise(tBlue, gl_FragCoord.xy + vec2(8.4, 9.6), uBlueOffset * + vec2(1.34, 34.32));

    vec3 distortionNormal = roughnessFactor * roughnessFactor * 2.0 * normalize(noise2.xyz) + mousefrost * 0.025;
    vec3 sampleNorm = normalize(n + distortionNormal);
    float totalSamples = ${e}.0;

    for (float i = 0.0; i < ${e}.0; i ++) {
        transmissionR = getIBLVolumeRefraction2(
            sampleNorm, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
            pos, modelMatrix, viewMatrix, projectionMatrix, material.ior, uThickness + thickness_smear * (i + noise.g) / totalSamples,
            uAttenuationColor, uAttenuationDistance
        ).r;
        transmissionG = getIBLVolumeRefraction2(
            sampleNorm, v, ..., material.ior * (1.0 + uChromaticAberration * (i + noise.r) / totalSamples), uThickness + thickness_smear * (i + noise.r) / totalSamples,
            uAttenuationColor, uAttenuationDistance
        ).g;
        transmissionB = getIBLVolumeRefraction2(
            sampleNorm, v, ..., material.ior * (1.0 + 2.0 * uChromaticAberration * (i + noise.b) / totalSamples), uThickness + thickness_smear * (i + noise.b) / totalSamples,
            uAttenuationColor, uAttenuationDistance
        ).b;
        transmitted.r += transmissionR;
        transmitted.g += transmissionG;
        transmitted.b += transmissionB;
    }
    transmitted /= ${e}.0;
    transmitted.a = 1.0;
} else {
    transmitted = getIBLVolumeRefraction2(n, v, material.roughness, ..., material.ior, uThickness, uAttenuationColor, uAttenuationDistance);
}
totalDiffuse = transmitted.rgb; // fix
totalDiffuse = clamp(totalDiffuse, vec3(0.0), vec3(1.0)); // fix
```

**Что делать у нас.** Заменить в MeshPhysicalMaterial блок #include <transmission_fragment> своим: цикл на 3 итерации, в каждой три вызова преломления с ior, ior*(1+0.1*k) и ior*(1+0.2*k) для R/G/B и с плавающей толщиной. Джиттерить голубым шумом (blue noise 8-128-rgb), смещая offset шума случайно каждый кадр, иначе видны швы. totalDiffuse полностью заменяется преломлением, потом clamp в 0..1.

Строка бандла: 16688

### getIBLVolumeRefraction2 и getVolumeTransmissionRay — своя копия three.js-функций, поглощение (Beer's law) ВЫКЛЮЧЕНО. ПОДТВЕРЖДЕНО

**Числа.** volumeAttenuation() (строка 16633) возвращает vec3(1.0), код Бера закомментирован. getVolumeTransmissionRay: refract(-v, normalize(n), 1.0/ior) * thickness * modelScale (строка 16600). applyIorToRoughness = roughness * clamp(ior*2.0-2.0, 0.0, 1.0) (строка 16613) → при ior=1.18 это roughness*0.36. В бандле ДВЕ функции выборки: getTransmissionSample (строка 16621, textureBicubic) и getTransmissionSampleCheap (строка 16628, textureLod) — в цикле аберрации зовётся именно Cheap. lod = log2(uTransmissionSamplerSize.x) * applyIorToRoughness(roughness, ior). Финал: vec4((1.0-F)*attenuatedColor, 1.0-(1.0-transmittedLight.a)*transmittanceFactor), F=EnvironmentBRDF(n,v,specularColor,specularF90,roughness).

```glsl
vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
    return vec3( 1.0 ); // fix
    /*
    if ( isinf( attenuationDistance ) ) { return vec3( 1.0 ); }
    else {
        vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
        vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance ); // Beer's law
        return transmittance;
    }
    */
}

// 16628
vec4 getTransmissionSampleCheap( const in vec2 fragCoord, const in float roughness, const in float ior ) {
    float lod = log2( uTransmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
    return textureLod( tTransmissionSamplerMap, fragCoord.xy, lod );
}

// 16656
vec4 getIBLVolumeRefraction2( ... ) {
    vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
    vec3 refractedRayExit = position + transmissionRay;
    vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
    vec2 refractionCoords = ndcPos.xy / ndcPos.w;
    refractionCoords += 1.0;
    refractionCoords /= 2.0;
    vec4 transmittedLight = getTransmissionSampleCheap( refractionCoords, roughness, ior );
    vec3 transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
    vec3 attenuatedColor = transmittance * transmittedLight.rgb;
    vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
    float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
    return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
}
```

**Что делать у нас.** Скопировать three.js-шные getVolumeTransmissionRay / applyIorToRoughness / getTransmissionSample, но: (а) внутри цикла аберрации звать дешёвую textureLod-версию вместо бикубика, (б) поглощение отключить возвратом vec3(1.0) — иначе с 3 сэмплами лёд уходит в грязь. Френель приходит из штатного EnvironmentBRDF, отдельного uFresnel в бандле нет.

Строка бандла: 16633

### Иней от мыши на глыбе: пинг-понг симуляция волны 512x512 по второму UV-каналу, она же гасит roughness и normal и подсвечивает грани. ПОДТВЕРЖДЕНО

**Числа.** class jL (строка 17232): options {width:512,height:512}, RT = new vt(512,512,{type:Mi,depthBuffer:!1}), два RT пинг-понгом (rts=[s, s.clone()]). update() (строка 17262) выходит, если Fe.time - splatLastRenderTime < 0.015. Материал симуляции class JL (строка 17117): tAdvect="cubes/advect.png" (colordata-repeat). Шейдер (17185-17226): advect=(texture2D(tAdvect, uv*3.0).xy*2.0-1.0)*1.0, uv += advect*invResolution; wavespeed=1.0; nextVal=max четырёх соседей; radius=0.05*smoothstep(0.1,1.0,uSplatRadius); splat=cubicIn(clamp(1.0-line(vUv,prev,cur)/radius,0,1)); nextVal+=splat; nextVal*=0.985; nextVal=min(nextVal,1.0); rim=nextVal-texture2D(tBuffer,uv).r; gl_FragColor=vec4(nextVal,rim,0,1). Скорость (17262): сброс если простой > 0.15 с или скачок > 0.3; splatTargetVelocity += dist*6, *=0.88, clamp 0..1; splatVelocity = lerp(splatVelocity, ease(splatTargetVelocity,"power4.out"), 0.1) — именно splatVelocity идёт в uSplatRadius; soundVelocity += dist*4, *=0.98, clamp 0..1. Подмешивание в лёд (16771-16826): тайлинг триангуляции 9.0*min(1.0, uResolution.y/1300.0).

```glsl
// материал симуляции, class JL (17117), шейдер 17185-17226:
vec2 advect = (texture2D(tAdvect, noiseUv * 3.0).xy * 2.0 - 1.0) * 1.0;
uv += advect * invResolution;
float wavespeed = 1.0;
vec2 offset = invResolution * wavespeed;
float l = texture2D(tBuffer, uv - vec2(offset.x, 0.0)).r; // r/t/b аналогично
float nextVal = max(max(max(l, r), t), b);
float radius = 0.05 * smoothstep(0.1, 1.0, uSplatRadius);
float splat = cubicIn(clamp(1.0 - line(vUv, uSplatPrevCoords.xy, uSplatCoords.xy) / radius, 0.0, 1.0));
nextVal += splat;
nextVal *= 0.985;
nextVal = min(nextVal, 1.0);
float rim = nextVal - texture2D(tBuffer, uv).r;
gl_FragColor = vec4(nextVal, rim, 0.0, 1.0);

// подмешивание в лёд (16771..16826):
vec2 mousefrostdata = texture2D(tMouseFrost, vUv1).rg;
float mousefrost = mousefrostdata.r;
float mousefrostrim = mousefrostdata.g;
roughnessFactor *= 1.0 - mousefrost;                 // roughnessmap_fragment
mapN.xy *= 1.0 - mousefrost;                          // normal_fragment_maps
totalEmissiveRadiance += mousefrostrim * uColorFrost;
float triangles = texture2D(tTriangles, vNormalMapUv * (9.0 * min(1.0, uResolution.y / 1300.0))).r;
totalEmissiveRadiance += triangles * mousefrostrim * 10.0;
totalEmissiveRadiance += triangles * pow(mousefrost, 2.0);
vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
outgoingLight = clamp(outgoingLight, vec3(0.0), vec3(1.0));
```

**Что делать у нас.** Дать глыбе второй UV-канал (attribute vec2 uv1 → varying vUv1), повесить на неё пинг-понг FBO 512x512 half-float без depth с волновой симуляцией: адвекция по cubes/advect.png, max от четырёх соседей, затухание 0.985, splat вдоль отрезка мышь-предыдущая-мышь. Красный канал — иней, зелёный — гребень волны. Обновлять не чаще раза в 0.015 с. Иней гасит шероховатость и нормали, гребень подсвечивает эмиссией #83a1c5 и вытягивает тайловую текстуру треугольников с усилением x10.

Строка бандла: 17117

### Расстановка и вращение глыб на скролле: три штуки по вертикали с шагом -5.75, вращение линейно от скролла плюс отдельное холостое покачивание. ПОДТВЕРЖДЕНО

**Числа.** verticalOffset = -5.75, height = cubes.length = 3. Позиции по Y: (1+t)*(-5.75) → -5.75, -11.5, -17.25. s = -5.75*(3+1) = -23, centeredProgress = n/s → 0.25, 0.5, 0.75. Камера сцены глыб: basePosition (0,0,5), baseTarget (0,0,0), displacement.position (0.1,0.05), shake 0.02, shakeSpeed 0.1; resize: zoom = min(1, screen.aspectRatio*1.25); fov = 45 - 5*|controller.scroll.velocity|. Множители вращения: p=11*l*(1-d) по Y, A=14*c*(1-u) по X, m=6*h*(1-f) по Z, где d=fit(rand*12.3423%1,0,1,0.1,0.2), u=fit(rand*123.5343%1,0,1,0.1,0.3), f=fit(rand*54.654%1,0,1,0.1,0.25), знак o=(index+cubes[0].rand)*242.45353%1<0.5?-1:1, l=o, c=-o, h=o. Холостое: g=0.3, x=0.1*additionalRotationAmount, фазы rand*12.423 / rand*42.987 / rand*2.53, множитель Math.sign(rand-0.5). Bloom (17646): levels 6, luminanceThreshold 0.2, intensity 1, radius 0.85. Автодоводка (17646): duration = clamp(|r|*6, 1.6, 2.4).

```glsl
// расстановка (17646):
this.options={cubes:Be.cubes,verticalOffset:-5.75}; this.height=this.options.cubes.length;
createCube(e={},t){const s=this.options.verticalOffset*(this.options.cubes.length+1),
 n=q.devScene?0:(1+t)*this.options.verticalOffset,
 r=q.devScene?0:n/s,
 a=new nF(this,{index:t,scrollPosition:n,centeredProgress:r,...e});
 return this.cubes.push(a),a.ready}
cameraOptions(){this.camera.basePosition.set(0,0,5),this.camera.baseTarget.set(0,0,0),
 this.camera.displacement.position.set(.1,.05),this.camera.shake.setScalar(.02),this.camera.shakeSpeed.setScalar(.1)}

// вращение (17516):
const n=this.options.centeredProgress-e, r=this.options.scrollPosition-t, a=n,
 o=(s+this.scene.cubes[0].options.rand)*242.45353%1<.5?-1:1,
 l=o,c=-o,h=o,
 d=ie.fit(this.options.rand*12.3423%1,0,1,.1,.2),
 u=ie.fit(this.options.rand*123.5343%1,0,1,.1,.3),
 f=ie.fit(this.options.rand*54.654%1,0,1,.1,.25),
 p=11*l*(1-d),A=14*c*(1-u),m=6*h*(1-f),
 g=.3,x=.1*this.additionalRotationAmount.value,
 v=Math.sin(Fe.time*g+this.options.rand*12.423)*x*Math.sign(this.options.rand-.5),
 y=Math.sin(Fe.time*g+this.options.rand*42.987)*x*Math.sign(this.options.rand-.5),
 S=Math.sin(Fe.time*g+this.options.rand*2.53)*x*Math.sign(this.options.rand-.5);
this.rotation.y=p*a+v,this.rotation.x=A*a+y,this.rotation.z=m*a+S;
```

**Что делать у нас.** Глыбы не крутятся «сами по кругу». Их разворот жёстко привязан к скроллу: угол = базовый множитель (11 по Y, 14 по X, 6 по Z) умножить на расстояние от центра экрана, плюс маленькое синусоидальное покачивание амплитудой 0.1 и скоростью 0.3. Знаки множителей раскидываются псевдослучайно (rand*242.45353 % 1 < 0.5), чтобы соседние глыбы крутились в разные стороны. Шаг между глыбами -5.75, камера на z=5, fov сужается на 5 градусов при быстром скролле, zoom камеры = min(1, aspect*1.25).

Строка бандла: 17516

### Дым/иней-вуаль вокруг глыбы: билборд-плоскость 2.5x3.5, гаснет по мере ухода глыбы со скролла. ПОДТВЕРЖДЕНО

**Числа.** PlaneGeometry(2.5, 3.5), name `smoke{index}`, position.y = -0.35, renderOrder = 15, transparent:true, depthTest:false, depthWrite:false (обычный блендинг, НЕ аддитивный). uColor1 = #886a3d, tTexture1 = wind_noise.ktx2 (srgb-repeat), uProgress стартует 100. Шейдер (17472-17489): st.y *= 0.75, st *= 1.5, t = time*0.075, offset = vec2(0, t), noise = tex(st+offset).r * tex(st*0.5+offset).r, grad = 1-clamp(length(vUv-0.5)*2), noise *= grad, noise *= length(vUv-0.5), noise = noise*6.5, scrollDist = clamp(1.0 - |uProgress|*20.0, 0, 1), gl_FragColor = vec4(vec3(1.0), noise). uProgress каждый кадр = centeredProgress - scrollProgress.

```glsl
this.mesh2=new Ce(new kt(2.5,3.5),new fe({uniforms:{tTexture1:{value:le.load("wind_noise.ktx2","srgb-repeat")},uColor1:{value:new Z("#886a3d")},uProgress:{value:100}},...
// fragment (17472-17489):
vec2 st = uv; st.y *= 0.75; st *= 1.5;
float t = time * 0.075;
vec2 offset = vec2(0.0, t);
float noise = texture2D(tTexture1, st + offset).r;
noise *= texture2D(tTexture1, st * 0.5 + offset).r;
float grad = 1.0 - clamp(length(vUv - 0.5) * 2.0, 0.0, 1.0);
noise *= grad;
noise *= length(vUv - 0.5);
noise = noise * 6.5;
float scrollDist = clamp(1.0 - abs(uProgress) * 20.0, 0.0, 1.0);
noise *= scrollDist;
vec3 color = vec3(1.0);
float alpha = noise;
gl_FragColor = vec4(color, alpha);
// 17516: this.mesh2.renderOrder=15, this.mesh2.position.y=-.35
```

**Что делать у нас.** Позади глыбы поставить билборд 2.5x3.5 со сдвинутым вниз центром (y = -0.35), два слоя одной шумовой текстуры с разным масштабом, кольцевая маска (яркость по краю, дырка в центре), усиление 6.5 и полное гашение, когда глыба отъезжает от центра экрана дальше 0.05 прогресса. Блендинг обычный, не аддитивный, depthTest выключен.

Строка бандла: 17437

### Плексус вокруг глыбы: 18 точек, до 3 связей на точку, беговая дорожка по Y, линии рисуются LineSegments с аддитивным блендингом. ПОДТВЕРЖДЕНО с одной поправкой

**Числа.** class sF (17421): totalPlexusPoints = 18, maxPlexusPoints = 18, maxConnectionsPerPoint = 3, radius = mesh.geometry.boundingSphere.radius * 0.9, treadmillDist = 3, connectTime = 0.35. Точки: angle = random*TWO_PI, r = fit(random,0,1,0.8,1)*radius, y = random*3. Дрейф: angle + (rand-0.5)*0.5*time, +0.1*sin(time*0.5+rand*2.324) по X и +0.1*sin(time*0.5+rand*9.564) по Z, Y через tF(y0 + rand*time*0.25, 1.5), где tF(i,e)=fract((i+e)/(2e))*2e-e. Связь допускается при |y| < 1.125 (=3*0.5*0.75) и |scrollDist| < 1.25, дистанция < 3 (treadmillDist). Точки (class ZL, 17262): uColor #666666, uSize 50, gl_PointSize = size / length(viewPos.xyz) * (resolution.y / 1300.0) (строка 17300). Линии (class $L, 17358-17421): renderOrder 20, blending pt (аддитивный), depthWrite false, depthTest true. Клик-глитч (17421): 4 твина uHoverMix — fromTo 0→1 (0.075, none), -1→1 (0.075), -1→1 (0.075), 1→-1 (0.25, power2.out). ПОПРАВКА: maxLines = maxPlexusPoints * maxConnectionsPerPoint = 18*3 = 54 отрезка (108 вершин), а не 18*2.

```glsl
this.totalPlexusPoints=18,this.maxPlexusPoints=this.totalPlexusPoints,this.maxConnectionsPerPoint=3,
this.radius=this.parent.mesh.geometry.boundingSphere.radius*.9,this.treadmillDist=3,this.connectTime=.35;
for(let e=0;e<this.totalPlexusPoints;e++){const t=new It,s=Math.random()*ie.TWO_PI,
 n=ie.fit(Math.random(),0,1,.8,1)*this.radius;
 t.position.set(Math.cos(s)*n,Math.random()*this.treadmillDist,Math.sin(s)*n);...}
// update:
const n=Math.abs(s)<1.25,r=this.treadmillDist*.5,a=this.treadmillDist*.5*.75;
o.position.set(Math.cos(l)*o.originalRadius+.1*Math.sin(Fe.time*.5+o.__rand*2.324),
  tF(o.originalPosition.y+o.__rand*Fe.time*.25,r),
  Math.sin(l)*o.originalRadius+.1*Math.sin(Fe.time*.5+o.__rand*9.564));
o._canConnect=n&&Math.abs(o.position.y)<a&&!h;
// ... u=<точка>.distanceTo(d.position); u<this.treadmillDist&&c.push({distance:u,pt:d})
// линии (17400-17421), фрагмент:
vec3 col = mix(vec3(0.0), uColor, smoothstep(0.75, 1.5, length(wPos)));
float n1 = sinenoise1(wPos * 10.1 + vec3(0.0, 0.0, 0.0)) * 0.5 + 0.5;
if (uHoverAnimation) { col = mix(col, vec3(uHoverMix < 0.0 ? 0.0 : 0.3), abs(uHoverMix)); }
col = mix(vec3(0.0), col, smoothstep(0.4, 0.5, n1));
gl_FragColor = vec4(col, 1.0);
```

**Что делать у нас.** Вокруг глыбы — цилиндр радиусом 0.9 от её боундинг-сферы, высотой 3, в нём 18 точек. Точки медленно вращаются вокруг оси и ползут вверх, при уходе за границу ±1.5 заворачиваются обратно. Соединять ближайшие (не дальше 3), максимум 3 связи на точку, появление/исчезновение связи — твин progress 0→1 за 0.35 с. Линии — одна LineSegments-геометрия на 54 отрезка (108 вершин), позиции переписываются каждый кадр, аддитивный блендинг, разрыв линии шумом smoothstep(0.4,0.5,noise). Размер точки на экране: size/расстояние*(высота окна/1300).

Строка бандла: 17421

### ВЫНОСКА №1 (заголовок): ломаная из двух отрезков от точки на грани глыбы, чистый WebGL LineSegments, никакого DOM/SVG. ПОДТВЕРЖДЕНО

**Числа.** Класс YL объявлен на строке 16831, update на 16903. Точка крепления El: mix(min.x,max.x,0.35), mix(max.y,min.y,0.15), mix(min.z,max.z,0.93), затем applyMatrix4(mesh.matrixWorld). Первый излом wp = El + LEFT*(-0.3) + UP*(0.3). Конец Ep = wp + LEFT*(-0.5). Два сегмента: El→Wh и Wh→Jx, где Wh = El.lerp(wp, fit(progress,0,0.5,0,1)), Jx = Wh.lerp(Ep, fit(progress,0.5,1,0,1)). Материал линий: LineBasicMaterial (класс ga) color #ffffff, opacity 1, transparent, depthTest false, depthWrite false, blending pt (аддитивный), frustumCulled false, renderOrder 999, name "title lines", лежит в scene.textsGroup. Текст: font IBMPlexMono-Medium, title.toUpperCase(), width 1, align left, lineHeight 0.8, size 0.13, uColor #ffffff, атлас ../fonts/IBMPlexMono-Medium-datatexture.ktx2, renderOrder 999, depthWrite/depthTest false, blending pt. Масштаб: min(0.8, 0.5/(screen.h/1300)). Позиция текста: Ep + UP*(text.size.y*0.5*scale.y + 0.05). Видимость: 1-|fit(scrollDist,-1.6,0.5,-1,1)| !== 0. Тайминги: animationProgress 0.2 с в обе стороны, uShow1 to 1 за 0.4 с, uShow2 fromTo 0→1 за 0.75 с, скрытие uShow1 за 0.2 с, все ease "none".

```glsl
const n=this.parent.mesh.geometry.boundingBox;
El.set(ie.mix(n.min.x,n.max.x,.35),ie.mix(n.max.y,n.min.y,.15),ie.mix(n.min.z,n.max.z,.93));
El.applyMatrix4(this.parent.mesh.matrixWorld);
const r=this.parent.scene._LEFT,a=this.parent.scene._UP;
wp.copy(El).addScaledVector(r,-.3).addScaledVector(a,.3);
Ep.copy(wp).addScaledVector(r,-.5);
Wh.copy(El).lerp(wp,ie.fit(this.animationProgress.value,0,.5,0,1));
Jx.copy(Wh).lerp(Ep,ie.fit(this.animationProgress.value,.5,1,0,1));
this.lineMesh.geometry.setAttribute("position",new nt([...El,...Wh,...Wh,...Jx],3));
this.lineMesh.geometry.needsUpdate=!0;
this.text.scale.setScalar(Math.min(.8,.5/(q.screen.h/1300)));
this.text.position.copy(Ep).addScaledVector(a,this.text.size.y*.5*this.text.scale.y+.05);

// _LEFT / _UP считаются от камеры каждый кадр (строка 17646):
bp.subVectors(this.camera.position,this.camera.target).normalize();
this._LEFT.crossVectors(this.camera.up,bp);
this._UP.crossVectors(bp,this._LEFT);
```

**Что делать у нас.** Выноска — это 4 вершины в одной LineSegments-геометрии, координаты которых пересчитываются каждый кадр в мировом пространстве. Точка крепления берётся как доля вдоль боундинг-бокса глыбы (0.35 по X, 0.15 сверху вниз по Y, 0.93 по Z) и прогоняется через матрицу мира глыбы, поэтому линия «прилипает» к вращающейся глыбе. Излом и хвост строятся не в экранных пикселях, а сдвигом на -0.3/+0.3 и -0.5 вдоль векторов LEFT/UP, посчитанных из камеры каждый кадр через cross. Рисование линии — анимация: первая половина progress рисует первый отрезок, вторая — второй. Текст висит на конце хвоста, отступ 0.05 плюс полвысоты строки.

Строка бандла: 16903

### ВЫНОСКА №2 (дата + «CLICK TO EXPLORE»): один отрезок, текст по правому краю, кегль меньше. ПОДТВЕРЖДЕНО

**Числа.** Класс qL объявлен на строке 16903, update в блоке 16957-16980. Текст: `D ${date с точками вместо слэшей}` + перевод строки + (interior.enabled ? Be.click : Be.clickDisabled).toUpperCase(). font IBMPlexMono-Medium, width 1, align right, lineHeight 0.8, size 0.115, uColor #ffffff. Точка крепления Cl: mix(min.x,max.x,0.7), mix(max.y,min.y,0.75), mix(min.z,max.z,0.95). Конец Cp = Cl + LEFT*0.7 (положительный знак, в противоположную сторону от первой выноски). Один сегмент Cl→jx, jx = Cl.lerp(Cp, fit(progress,0,0.5,0,1)). Видимость: 1-|fit(scrollDist,-0.6,1.25,-1,1)| !== 0. Тайминги те же: 0.2 / 0.4 / 0.75. Линия — тот же LineBasicMaterial, renderOrder 999, blending pt, name "title lines".

```glsl
this.text=new Ui({font:"IBMPlexMono-Medium",
  text:`D ${this.parent.options.date.replaceAll("/",".")}\n${(s?Be.click:Be.clickDisabled).toUpperCase()}`,
  width:1,align:"right",lineHeight:.8,size:.115},{uniforms:{tMap:{value:le.load("../fonts/IBMPlexMono-Medium-datatexture.ktx2","data")},uColor:{value:new Z("#ffffff")},uShow1:{value:0},uShow2:{value:0}},...});
// update:
Cl.set(ie.mix(n.min.x,n.max.x,.7),ie.mix(n.max.y,n.min.y,.75),ie.mix(n.min.z,n.max.z,.95));
Cl.applyMatrix4(this.parent.mesh.matrixWorld);
const r=this.parent.scene._LEFT,a=this.parent.scene._UP;
Cp.copy(Cl).addScaledVector(r,.7);
jx.copy(Cl).lerp(Cp,ie.fit(this.animationProgress.value,0,.5,0,1));
this.lineMesh.geometry.setAttribute("position",new nt([...Cl,...jx],3));
this.text.scale.setScalar(Math.min(.8,.5/(q.screen.h/1300)));
this.text.position.copy(Cp).addScaledVector(a,this.text.size.y*.5*this.text.scale.y+.05);
```

**Что делать у нас.** Вторая выноска — прямая, вправо (LEFT*0.7 — положительный знак, то есть в другую сторону от первой), от точки 0.7/0.75/0.95 боундинг-бокса. Две строки: дата через точки и призыв к клику. Ветка с вопросительными знаками и отключением клика в коде есть, но на живом сайте не срабатывает: у всех трёх глыб interior.enabled = true.

Строка бандла: 16903

### ВЫНОСКА №3 (TEMP): собственная геометрия из плоскостей-цифр, без линии, температура плавает синусом и дублируется в Фаренгейтах. ПОДТВЕРЖДЕНО

**Числа.** Класс XL объявлен на строке 16980, update на 17109-17117. "TEMP" — size 0.1, width 0.75, align left, lineHeight 0.8; точка-разделитель — тот же Ui с текстом ".". Цифры — PlaneGeometry(0.06, 0.06) с удалённым normal, атрибут isNum (Int32Array, заливка 1), scale(0.77777, 1, 1), шаг a = 0.045, старт l = 0.3, всего 8 цифр, translate(l, 0.024+c, 0). Разделители на f===1 и f===5: l += 0.025, точка, l += 0.025. Перенос на вторую строку на f===3: c = -0.1, l = 0.3, добавляется квад с isNum.fill(-2) на x = l-0.015. У текстовых геометрий isNum заливается -1. Атрибут textWeight — p = f/(count-1) по четвёркам. Атлас: tNums = numbers-datatexture.ktx2 ("data"), плюс tMap шрифта. Значение: temp = targetTemp + sin(time*0.05 + random1)*2; a = temp.toFixed(2).split(".") с «+» при temp>=0 и добивкой нуля; c = (temp*1.8+32).toFixed(2).split("."). Запись в isNum: [4,5,7,8] ← Фаренгейт (h), [10,11,13,14] ← Цельсий (o[f+1]), [9] ← знак: temp<0 ? -2 : -3. Точка привязки Sp: mix(min.x,max.x,0.7), mix(max.y,min.y,0.15), mix(min.z,max.z,0.93), затем + LEFT*0.3. Масштаб min(0.8, 0.5/(screen.h/1300)). Видимость: 1-|fit(scrollDist,-1.2,0.5,-1,1)| !== 0.

```glsl
const e=new Ui({font:"IBMPlexMono-Medium",text:"TEMP",width:.75,align:"left",lineHeight:.8,size:.1}),
      t=new Ui({font:"IBMPlexMono-Medium",text:".",width:.75,align:"left",lineHeight:.8,size:.1});
const r=[s],a=.045,o=new kt(.06,.06);
o.deleteAttribute("normal");
o.setAttribute("isNum",new Ev(new Int32Array(new Array(o.attributes.position.count).fill(1)),1));
o.scale(.77777,1,1);
let l=.3,c=0;
for(let f=0;f<8;f++){const p=o.clone();
  if(l+=a,p.translate(l,.024+c,0),r.push(p),f===1||f===5){l+=.025;const A=n.clone();A.translate(l,c,0),r.push(A),l+=.025}
  if(f===3){c=-.1,l=.3;const A=o.clone();A.attributes.isNum.array.fill(-2),A.translate(l-.015,.024+c,0),r.push(A)}}
// uniforms: tNums = le.load("numbers-datatexture.ktx2","data")

// update (17109-17117):
this.temp=this.targetTemp+Math.sin(Fe.time*.05+this.random1)*2;
const a=this.temp.toFixed(2).split("."); this.temp>=0&&(a[0]=`+${a[0]}`);
const o=[...a[0],...a[1]], c=(this.temp*1.8+32).toFixed(2).split(".");
const h=[...c[0],...c[1]], d=this.mesh.geometry.attributes.isNum.array;
[4,5,7,8].forEach((u,f)=>{const p=Number(h[f]);for(let A=0;A<4;A++)d[u*4+A]=p}),
[10,11,13,14].forEach((u,f)=>{const p=Number(o[f+1]);for(let A=0;A<4;A++)d[u*4+A]=p}),
[9].forEach((u,f)=>{const p=this.temp<0?-2:-3;for(let A=0;A<4;A++)d[u*4+A]=p}),
this.mesh.geometry.attributes.isNum.needsUpdate=!0;
```

**Что делать у нас.** Цифровое табло не перегенерируется как текст. Один раз собирается меш из квадратиков 0.06x0.06, каждому квадрату в целочисленный атрибут isNum пишется номер цифры (-1 — обычный глиф шрифта, -2/-3 — минус/плюс), шейдер выбирает нужный символ из атласа numbers-datatexture.ktx2. Каждый кадр меняется только Int32Array атрибута isNum — ни одной пересборки геометрии. Температура медленно дышит: базовое значение из конфига плюс sin(time*0.05)*2, рядом та же величина в Фаренгейтах.

Строка бандла: 16980

### Общая механика появления текста выносок: MSDF-шрифт, пробегающий по буквам fallout и глитч-подмена спрайта по 8 кадрам. ПОДТВЕРЖДЕНО

**Числа.** Вершинный шейдер (16855-16861): tr1 = falloff(textWeights.x, 0.0, 1.0, 0.1, clamp(uShow1,0,1)); tr2 = falloff(textWeights.x, 0.0, 1.0, 1.0, clamp(uShow2,0,1)); vUv = uv; vUv.x = mod(uv.x + 0.125*mod(floor((1.0-tr2)*5.753), 8.0), 1.0); vAlpha = tr1; gl_Position = projectionMatrix * viewMatrix * billboardModelMatrix() * vec4(position, 1.0). Фрагмент (16889-16897): alpha = vAlpha; alpha *= msdf(tMap, uv); gl_FragColor = vec4(uColor, alpha). Шрифт: ../fonts/IBMPlexMono-Medium-datatexture.ktx2 ("data"). Все тексты выносок: depthWrite false, depthTest false, blending pt (аддитивный), renderOrder 999, frustumCulled false, лежат в scene.textsGroup.

```glsl
float tr1 = falloff(textWeights.x, 0.0, 1.0, 0.1, clamp(uShow1, 0.0, 1.0));
float tr2 = falloff(textWeights.x, 0.0, 1.0, 1.0, clamp(uShow2, 0.0, 1.0));
vUv = uv;
vUv.x = mod(uv.x + 0.125 * mod(floor((1.0 - tr2) * 5.753), 8.0), 1.0);
vAlpha = tr1;
gl_Position = projectionMatrix * viewMatrix * billboardModelMatrix() * vec4(position, 1.0);
// fragment (16889-16897):
vec2 uv = vUv;
float alpha = vAlpha;
alpha *= msdf(tMap, uv);
gl_FragColor = vec4(uColor, alpha);
```

**Что делать у нас.** Текст — MSDF-меш (шрифт запечён в ktx2-атлас), каждой букве в атрибут textWeights.x положен её порядковый вес 0..1. uShow1 гонит волну прозрачности по буквам слева направо за 0.4 с. uShow2 за 0.75 с гонит вторую волну, которая по формуле 0.125*mod(floor((1-tr2)*5.753),8) сдвигает UV на 1/8 — буква на долю секунды подменяется соседним глифом из атласа, это и даёт эффект «расшифровки». Билборд: billboardModelMatrix() вместо modelViewMatrix, чтобы текст всегда был лицом к камере.

Строка бандла: 16855

### 3D-ИКОНКА ВНУТРИ ГЛЫБЫ в главной сцене: отдельный меш с MeshBasicMaterial, виден ТОЛЬКО через преломление. ПОДТВЕРЖДЕНО

**Числа.** mesh3 = new Ce(geometry `{innerobject}.drc`, new or({map: le.load(`cubes/{innerobject}_color.ktx2`)})), где or — MeshBasicMaterial (isMeshBasicMaterial, строка 2069). name = `{innerobject}{index} `, renderOrder = 10, добавляется в ту же группу nF, что и глыба. Модели: pudgy.drc, overpass_logo.drc, abstractlogo.drc (грузятся из корня, без префикса cubes/). В главной сцене иконка не масштабируется — objScale применяется только в интерьере (VF: mesh.scale.setScalar(options.scale)). Освещения нет, только запечённая цветовая карта.

```glsl
this.mesh3=new Ce(t,new or({map:le.load(`cubes/${this.options.innerobject}_color.ktx2`)}));
this.mesh3.name=`${this.options.innerobject+this.options.index} `;
this.mesh3.renderOrder=10;
this.add(this.mesh3);
// в aF.update (17646) иконка включается ТОЛЬКО на проход тыльных граней:
// r.mesh3.visible=!0  (side=ei/BackSide, рендер в _transmissionRT)
// r.mesh3.visible=!1  (side=es/FrontSide, рендер на экран)
```

**Что делать у нас.** Иконка внутри глыбы — не PBR-объект и не подсвеченный меш. Это Draco-модель с MeshBasicMaterial и запечённой цветовой ktx2-картой, добавленная в ту же группу, что и глыба (то есть вращающаяся вместе с ней). Она рисуется исключительно в прекадр трансмиссии; на экран напрямую не попадает. Отсюда и ощущение «объект замурован в лёд»: его контур ломается, двоится и хроматически расщепляется ровно так, как это делает шейдер льда.

Строка бандла: 17433

### КЛИК ПО ГЛЫБЕ: рейкаст по BVH, переход через роутер на /portfolio/{hash}. ПОДТВЕРЖДЕНО

**Числа.** class jL (строка 17232): interaction = new Er({camera: parent.scene.camera, meshes: [parent.mesh], onMove, onHover, onClick, hoverCursor:true, ctx:this}); затем !!parent.options.interior.enabled || (interaction.enable = ()=>{}, interaction.disable = ()=>{}); interaction._raycaster.firstHitOnly = true. onMouseClick (строка 17260): q.devScene || (interaction.disable(), emit("webgl_switch_scene", `portfolio/${hash}`)). Роутер (строка 20656): routes: [{path:"/", data:{scene:"home"}}, {path:"/portfolio/:project", data:{scene:"project"}}], onChange → emit("webgl_router_request_switch_scene", scene, path, params). Взаимодействие включено только когда |scrollPosition - camera.basePosition.y| < 2 и !controller.isDetailOpen (строка 17516).

```glsl
this.interaction=new Er({camera:this.parent.scene.camera,meshes:[this.parent.mesh],
 onMove:this.onMouseMove,onHover:this.onMouseHover,onClick:this.onMouseClick,hoverCursor:!0,ctx:this}),
!!this.parent.options.interior.enabled||(this.interaction.enable=()=>{},this.interaction.disable=()=>{}),
this.interaction._raycaster.firstHitOnly=!0;

// 17260:
onMouseClick(e){q.devScene||(this.interaction.disable(),
  Q.emit("webgl_switch_scene",`portfolio/${this.parent.options.hash}`))}

// 17516:
(w=this.scene.controller)!=null&&w.isDetailOpen?this.mouseFrost.interaction.disable():
  Math.abs(r)<2?this.mouseFrost.interaction.enable():this.mouseFrost.interaction.disable()

// 20656:
routes:[{path:"/",data:{scene:"home"}},{path:"/portfolio/:project",data:{scene:"project"}}]
```

**Что делать у нас.** Клик вешать не на всю сцену, а на конкретный меш глыбы, с BVH и firstHitOnly. Включать интеракцию только у той глыбы, что сейчас ближе двух единиц скролла к камере, и глушить, когда открыт интерьер. Сам клик ничего не анимирует напрямую — он только меняет URL через роутер (history API), а вся анимация висит на смене маршрута. Так работает и прямой заход по ссылке /portfolio/abstract.

Строка бандла: 17232

### ВЛЁТ КАМЕРЫ ВНУТРЬ: полный тайминг перехода из сцены глыб в интерьер. ПОДТВЕРЖДЕНО

**Числа.** a = centerDetailScene()*0.5, где centerDetailScene(e=1) возвращает ease(fit(|n|, 0, 0.2, 0.05, 1), "expo.out")*1.5 при e>0, n = (cubes[detailIndex].centeredProgress - scene.progress)*(height+1) — то есть a максимум 0.75. uDetailProgress: 0→1, ease "power3.in", delay a, duration 1.25. uDetailProgress2: 0→1, ease "sine.out", delay a+0.75, duration 1.25. detailAnimationIn(a): cameraZoom 0 → -3.5, duration 1.25+a, ease "power3.in" (basePosition.z = initial.z + cameraZoom, то есть 5 → 1.5); additionalRotationAmount глыб → 0, duration 1+a, ease "power1.in"; camera.touchAmount → 0, duration 1.25+a; plexus.click() у всех глыб. playInAnimation(index, a): видима только objects[index]; иконка additionalRotationAmount → 1, duration 1, delay a+1.5, ease "power1.out"; displayUIvar fromTo 0→1, duration 0.7, delay a+0.5, onComplete → mouseSim.reset(), emit("webgl_project_show"), emit("webgl_play_audio","project-text"); camera.basePosition fromTo z:4 → z:2.5, duration 2, delay a+0.5, ease "inOut1". Звуки: "click-project" сразу, "enter-project" через delayedCall(a). Общее ожидание await Sc.wait(a + 0.75 + 1.25). FOV не меняется — 45 в обеих сценах.

```glsl
else{const a=this.centerDetailScene()*.5;
  re.to(this.material.uniforms.uDetailProgress,{overwrite:!0,value:1,ease:"power3.in",delay:a,duration:1.25}),
  re.to(this.material.uniforms.uDetailProgress2,{overwrite:!0,value:1,ease:"sine.out",delay:a+.75,duration:1.25}),
  this.scrollComposers[1].passes[0].scene.detailAnimationIn(a),
  this.detailScene.playInAnimation(this.detailIndex,a),
  Q.emit("webgl_play_audio","click-project"),
  re.delayedCall(a,()=>{Q.emit("webgl_play_audio","enter-project")}),
  await Sc.wait(a+.75+1.25)}

centerDetailScene(e=1){...const n=(t.cubes[this.detailIndex].options.centeredProgress-t.progress)*(t.height+1),r=Math.abs(n);
  let a=0; return e>0&&(a=ie.ease(ie.fit(r,0,.2,.05,1),"expo.out")*1.5), ...}

detailAnimationIn(e=0){
  re.to(this.cameraZoom,{overwrite:!0,value:-3.5,duration:1.25+e,ease:"power3.in"}),
  re.to(this.cubes.map(t=>t.additionalRotationAmount),{overwrite:!0,value:0,duration:1+e,ease:"power1.in"}),
  re.to(this.camera,{touchAmount:0,overwrite:!0,duration:1.25+e}),
  this.cubes.forEach(t=>t.plexus.click())}

playInAnimation(e,t=0){this.objects.forEach(s=>{s.mesh.visible=s.index===e}),
  re.to(this.objects.map(s=>s.additionalRotationAmount),{overwrite:!0,value:1,duration:1,delay:t+1.5,ease:"power1.out"}),
  re.fromTo(this.displayUIvar,{value:0},{value:1,duration:.7,delay:t+.5,onComplete:()=>{this.mouseSim.reset(),Q.emit("webgl_project_show",e),Q.emit("webgl_play_audio","project-text")}}),
  re.fromTo(this.camera.basePosition,{z:4},{overwrite:!0,z:2.5,duration:2,delay:t+.5,ease:"inOut1"})}
```

**Что делать у нас.** Влёт — это ДВЕ независимые камеры и полноэкранный микс, а не одна камера, летящая сквозь геометрию. (1) Сначала скролл автодоводится до центра глыбы, длительность доводки a вычисляется из того, насколько далеко глыба от центра (максимум 0.75 с). (2) В сцене глыб камера просто наезжает: z с 5 до 1.5 за 1.25+a с по power3.in, вращение глыб плавно гасится до нуля. (3) Параллельно вторая сцена (интерьер) рендерится в свой композер и её камера отъезжает с z=4 на z=2.5 за 2 с по своей кривой inOut1 с задержкой a+0.5. (4) Полноэкранный шейдер миксует два кадра по uDetailProgress. Итого около 2 секунд на весь переход. FOV не трогается — весь эффект даёт z камеры плюс шейдер.

Строка бандла: 20656

### Шейдер самого перехода: ледяное искажение + техническое смещение + хроматическая аберрация между кадром сцены глыб и кадром интерьера. ПОДТВЕРЖДЕНО ДОСЛОВНО

**Числа.** transition = fit(uDetailProgress, 0.4, 1.0, 0.0, 1.0). modulator = 8.0*smoothstep(1.0,0.5,|vUv.x*2-1|)*smoothstep(1.0,0.5,|vUv.y*2-1|). Техсмещение: techDisp = (uvTex-0.5)*0.1, tTech = texture(tScroll, techDisp).g*2-1, dispTechStr = 0.005, dispTech = vec2(1,0)*tTech*0.005. Ледяное смещение: uvDisp = (uvTex-0.5)*5.0*(1.0-uDetailProgress), tDisp = texture(tFrost, uvDisp).r*2-1, dispStr = 0.1, disp = vec2(1,0)*tDisp*0.1 + vec2(0,1)*tDisp*0.1. Уходящий кадр: sceneIceDisp = disp*power1In(fit(uDetailProgress,0.1,0.9,0,1)), sceneTechDisp = dispTech*power4Out(uDetailProgress), CA-сила = power2Out(uDetailProgress)*noise.r. Приходящий: detailIceDisp = disp*fit(uDetailProgress,0.1,0.9,1,0), detailTechDisp = dispTech*fit(uDetailProgress2,0.7,1.0,1,0), CA-сила = power2Out(1.0-uDetailProgress2)*noise.r. Финал: color = mix(scene, detail, transition). uBlueOffset этого пасса гоняется каждый рендер: set(Math.random()*10, Math.random()*12.5).

```glsl
if (uInCubes && uDetailProgress > 0.0) {
    if (uDetailProgress < 1.0 || uDetailProgress2 < 1.0) {
        vec2 uvTex = vUv - 0.5; uvTex.x *= aspect; uvTex += 0.5;
        float transition = fit(uDetailProgress, 0.4, 1.0, 0.0, 1.0);
        vec4 noise = getNoise(tBlue, gl_FragCoord.xy, uBlueOffset);
        float modulator = 8.0 * smoothstep(1.0, 0.5, abs(vUv.x * 2.0 - 1.0)) * smoothstep(1.0, 0.5, abs(vUv.y * 2.0 - 1.0));

        vec2 techDisp = uvTex - 0.5; techDisp *= 0.1;
        float tTech = texture(tScroll, techDisp).g * 2.0 - 1.0;
        float dispTechStr = 0.005;
        vec2 dispTech = vec2(1.0, 0.0) * tTech * dispTechStr;

        vec2 uvDisp = uvTex - 0.5; uvDisp *= 5.0; uvDisp *= (1.0 - uDetailProgress);
        float tDisp = texture(tFrost, uvDisp).r * 2.0 - 1.0;
        float dispStr = 0.1;
        vec2 disp = vec2(1.0, 0.0) * tDisp * dispStr;
        disp += vec2(0.0, 1.0) * tDisp * dispStr;

        vec3 scene;
        if (transition < 1.0) {
            vec2 sceneIceDisp = disp * power1In(fit(uDetailProgress, 0.1, 0.9, 0.0, 1.0));
            vec2 sceneTechDisp = dispTech * power4Out(uDetailProgress);
            scene = chromatic_aberration(tCubes, vUv + sceneIceDisp + sceneTechDisp, modulator, power2Out(uDetailProgress) * noise.r).rgb;
        }
        vec3 detail;
        if (transition > 0.0) {
            vec2 detailIceDisp = disp * fit(uDetailProgress, 0.1, 0.9, 1.0, 0.0);
            vec2 detailTechDisp = dispTech * fit(uDetailProgress2, 0.7, 1.0, 1.0, 0.0);
            detail = chromatic_aberration(tDetail, vUv + detailIceDisp + detailTechDisp, modulator, power2Out(1.0 - uDetailProgress2) * noise.r).rgb;
        }
        color = mix(scene, detail, transition);
    } else {
        color = texture2D(tDetail, vUv).rgb;
    }
} else {
    color = texture2D(tScene1, vUv).rgb;
}
```

**Что делать у нас.** Держать два готовых кадра (tCubes и tDetail) и смешивать их полноэкранным шейдером. Ключевое: перед смешиванием оба кадра гнутся по одной и той же ледяной карте искажений (tFrost, масштаб 5, сила 0.1), но с зеркальными огибающими — уходящий кадр гнётся всё сильнее, приходящий распрямляется. Плюс небольшой горизонтальный техно-сдвиг 0.005 и хроматическая аберрация (CA_ITERATIONS 5 по умолчанию), чей модулятор растёт от краёв экрана к центру. Перекрёстное растворение начинается только на 40% прогресса (fit 0.4..1.0), поэтому первые 40% — чистое ломание льда, и только потом появляется интерьер.

Строка бандла: 14556

### ИНТЕРЬЕР ГЛЫБЫ: фон — диагональный градиент, тумана нет, свет — два аддитивных билборда. ПОДТВЕРЖДЕНО

**Числа.** Фон class HF (объявлен 20287, меш 20340): fullscreen triangle Si.triangle, uColor1 #09121f, uColor2 #6b7685, tNoise wind_noise.ktx2, uRotation -0.66; uv = (vUv-0.5), uv.x *= resolution.x/resolution.y, uv *= 0.5, uv += 0.5, uv = rotateUV(uv, uRotation); gradient = pow(uv.y, 3.0)*0.5 + hash12(vUv*1000.0+time)*0.01; color = mix(uColor1, uColor2, gradient); depthWrite false, depthTest false, transparent, blending pt, renderOrder -5. Луч class YF (объявлен 20434, меш 20467): PlaneGeometry(1,1), tMap perlin-datatexture.png (srgb-repeat), uColor #d1e3ff, name "lightshaft", position (1.67, 0.79, 0), scale (1.5, 3, 1), rotation.z = -40*3.14/180, blending pt; t = time*0.12, noise = tex(vUv*vec2(1.0,0.46)+vec2(t,t*0.323)).r + tex(vUv*vec2(0.5,0.25)+vec2(-t*0.77,-t*0.414)).r, circularGradient = pow(1-clamp(length(vUv-0.5)*2,0,1), 2.0), alpha = circularGradient*noise*0.07. Пятно class qF (объявлен 20467, меш 20503): PlaneGeometry(1,1), tBokeh bokeh.ktx2, tMap perlin-datatexture.png, uColor #d1e3ff, name "lightplane", position (-2.05,-0.87,1), scale (4,4,4), blending pt; bokeh = tex(tBokeh, vUv*2.0).r, noise = tex(tMap, vUv*2.0 + time*0.15).r, bokeh *= noise, bokeh *= 5.0, alpha = (circularGradient + bokeh*circularGradient)*0.15; onBeforeRender: position.x = -2.2 + sin(time*0.3)*0.2, position.y = -0.87 + cos(time*0.24)*0.2. Камера интерьера (20656): basePosition (0,0,2.5), baseTarget (0,0,0), displacement (0,0), lerpPosition 0.02, shake 0.05, shakeSpeed 0.05, fov 45.

```glsl
// фон (class HF, объявлен 20287; шейдер 20317-20329; меш 20340):
uniforms:{uColor1:{value:new Z("#09121f")},uColor2:{value:new Z("#6b7685")},
  tNoise:{value:le.load("wind_noise.ktx2","colordata-repeat")},uRotation:{value:-.66}}
vec2 uv = vUv - 0.5;
uv.x *= resolution.x / resolution.y;
uv *= 0.5; uv += 0.5;
uv = rotateUV(uv, uRotation);
float gradient = pow(uv.y, 3.0);
gradient *= 0.5;
gradient += hash12(vUv * 1000.0 + time) * 0.01;
vec3 color = mix(uColor1, uColor2, gradient);
// ... this.mesh.renderOrder=-5

// луч (class YF, 20434; шейдер 20452-20459; меш 20467):
float t = time * 0.12;
float noise = texture2D(tMap, vUv * vec2(1.0, 0.46) + vec2(t, t * 0.323)).r;
noise += texture2D(tMap, vUv * vec2(0.5, 0.25) + vec2(-t * 0.77, -t * 0.414)).r;
float circularGradient = 1.0 - clamp(length(vUv - 0.5) * 2.0, 0.0, 1.0);
circularGradient = pow(circularGradient, 2.0);
float alpha = circularGradient * noise * 0.07;
// mesh.position.set(1.67,.79,0); mesh.scale.set(1.5,3,1); mesh.rotation.z=-40*3.14/180;

// пятно (class qF, 20467; шейдер 20487-20495; меш 20503):
float bokeh = texture2D(tBokeh, vUv * 2.0).r;
float noise = texture2D(tMap, vUv * 2.0 + time * 0.15).r;
bokeh *= noise; bokeh *= 5.0;
float alpha = (circularGradient + bokeh * circularGradient) * 0.15;
// position (-2.05,-.87,1), scale (4,4,4)
// onBeforeRender: position.x = -2.2 + Math.sin(Fe.time*.3)*.2, position.y = -.87 + Math.cos(Fe.time*.24)*.2
```

**Что делать у нас.** Внутри глыбы нет ни одного источника света three.js и нет Fog. Всё нарисовано: (1) полноэкранный градиент от #09121f к #6b7685, поднятый в третью степень и повёрнутый на -0.66 рад, с обязательным дизерингом hash12*0.01, иначе полосит; (2) вытянутый билборд-луч 1.5x3 справа сверху под -40 градусов, два слоя одного перлина ползут навстречу, прозрачность всего 0.07; (3) большое мягкое пятно 4x4 слева снизу с боке-текстурой, прозрачность 0.15, медленно дрейфует по синусу и косинусу с разными периодами (0.3 и 0.24), чтобы движение не читалось как петля. Оба световых билборда — аддитивный блендинг.

Строка бандла: 20287

### 3D-ИКОНКА В ИНТЕРЬЕРЕ: та же модель, но тёмная карта и наложенные каустики, покачивается на 0.035. ПОДТВЕРЖДЕНО

**Числа.** class VF (строка 20340): geometry `{obj}.drc`, tMap `{obj}_dark_color.ktx2`, tNoise "perlin-datatexture.ktx2" (srgb-repeat), tCaustics "caustics.ktx2" (srgb-repeat). mesh.name="object", frustumCulled false, scale.setScalar(options.scale) — 1.1 для pudgy, 1.2 для overpass_logo и abstractlogo. Шейдер (20364-20372): color = texture2D(tMap, vUv).rgb; noise = texture2D(tNoise, vPos.xy*0.4 + vec2(-time*0.1, time*0.023)).r; color *= mix(0.025, 0.15, noise); caustics = texture2D(tCaustics, vPos.xy*1.5 + vec2(-time*0.1, time*0.023)).r; caustics = min(caustics, texture2D(tCaustics, vPos.xy*2.0 + vec2(time*0.05, -time*0.013)).r); color += caustics*color.b*30.0. Покачивание (20375): s = 0.035*additionalRotationAmount, rot.x/y/z = sin(time*0.3 + rand*{12.423, 42.987, 2.53})*s*sign(rand-0.5). Видна только иконка текущего проекта: mesh.visible = (index === detailIndex).

```glsl
const e=await zt.load(`${this.options.obj}.drc`);
this.mesh=new Ce(e,new fe({uniforms:{
  tMap:{value:le.load(`${this.options.obj}_dark_color.ktx2`)},
  tNoise:{value:le.load("perlin-datatexture.ktx2","srgb-repeat")},
  tCaustics:{value:le.load("caustics.ktx2","srgb-repeat")}},
fragmentShader:`
  vec3 color = texture2D(tMap, vUv).rgb;
  float noise = texture2D(tNoise, vPos.xy * 0.4 + vec2(-time * 0.1, time * 0.023)).r;
  color *= mix(0.025, 0.15, noise);
  float caustics = texture2D(tCaustics, vPos.xy * 1.5 + vec2(-time * 0.1, time * 0.023)).r;
  caustics = min(caustics, texture2D(tCaustics, vPos.xy * 2.0 + vec2(time * 0.05, -time * 0.013)).r);
  color += caustics * color.b * 30.0;
  gl_FragColor = vec4(color, 1.0);`}));
this.mesh.scale.setScalar(this.options.scale);
this.mesh.onBeforeRender=()=>{const s=.035*this.additionalRotationAmount.value,
  n=Math.sin(Fe.time*.3+this.options.rand*12.423)*s*Math.sign(this.options.rand-.5),
  r=Math.sin(Fe.time*.3+this.options.rand*42.987)*s*Math.sign(this.options.rand-.5),
  a=Math.sin(Fe.time*.3+this.options.rand*2.53)*s*Math.sign(this.options.rand-.5);
  this.mesh.rotation.set(n,r,a)};
```

**Что делать у нас.** Иконка ОСТАЁТСЯ на фоне и становится главным героем интерьера. Она грузится второй раз, но с ДРУГОЙ картой (_dark_color вместо _color) и без всякого PBR. Приём, который даёт весь эффект «под водой во льду»: базовый цвет прибивается почти в ноль (множитель 0.025..0.15 по перлину), а поверх кладутся каустики — пересечение (min) двух слоёв одной текстуры, ползущих в разные стороны с разной скоростью, умноженное на СИНИЙ канал самого цвета и на 30. Из-за умножения на color.b светятся только холодные части модели. Покачивание крошечное — 0.035 рад, скорость 0.3.

Строка бандла: 20340

### Частицы в интерьере: 250 крупных + 10000 мелких, мелкие реагируют на мышь через ту же волновую симуляцию. ПОДТВЕРЖДЕНО, номера строк исправлены

**Числа.** class WF (крупные, строка 20375): n = 250, x = random*4-2, y = random*4-2, z = (r/n - 0.5)*2 (то есть -1..1 строго по индексу), атрибут random — 3 float на точку, uniforms только uRotation = -0.66, меш new Fn (Points), renderOrder 1, blending pt. class XF (мелкие, строка 20503): n = 2, r = 1e4 = 10000, x = random*4-2, y = random*4-2, z = (random*4-2)*0.5 (то есть -1..1), uRotation -0.66, uColor #2d3133, tSim = this.scene.mouseSim.finalRT.texture. gl_PointSize у обоих = size * (resolution.y * 0.002).

```glsl
// WF, крупные (20375):
const e=new ot,t=[],s=[],n=250;
for(let r=0;r<n;r++){const a=Math.random()*4-2,o=Math.random()*4-2,l=(r/n-.5)*2;
  t.push(a,o,l),s.push(Math.random()),s.push(Math.random()),s.push(Math.random())}
this.mesh=new Fn(e,new fe({uniformsGroups:[he.UBO],uniforms:{uRotation:{value:-.66}},...
// ... this.mesh.name="particles", this.mesh.renderOrder=1

// XF, мелкие (20503):
const e=new ot,t=[],s=[],n=2,r=1e4;
for(let a=0;a<r;a++){const o=Math.random()*n*2-n,l=Math.random()*n*2-n,c=(Math.random()*n*2-n)*.5;
  t.push(o,l,c),s.push(Math.random()),s.push(Math.random()),s.push(Math.random())}
this.mesh=new Fn(e,new fe({uniformsGroups:[he.UBO],uniforms:{uRotation:{value:-.66},
  uColor:{value:new Z("#2d3133")},tSim:{value:this.scene.mouseSim.finalRT.texture}},...
```

**Что делать у нас.** Два слоя точек в кубе -2..2 по X и Y, но по Z сплюснутые до -1..1: у крупных z распределён строго линейно по индексу (детерминированный порядок отрисовки), у мелких сжат вдвое случайно. Мелкие 10000 подкрашены очень тёмным #2d3133 и толкаются той же волновой FBO, что и иней на глыбе, — курсор в интерьере разгоняет пыль. Размер точки = size * (высота экрана * 0.002).

Строка бандла: 20375

### ТЕКСТ В ИНТЕРЬЕРЕ: ровно 6 блоков, в ортографической UI-сцене, с кнопками-ссылками под описанием. ПОДТВЕРЖДЕНО с двумя поправками

**Числа.** Порядок: 1) interior.title (Be.colorProjectTitle #67707E), 2) interior.content (Be.colorProjectText #A1AAB7), 3) interior.socialTitle (#67707E), 4) блок соцсетей ey (#A1AAB7), 5) interior.linkTitle (#67707E), 6) блок сайта ey (#A1AAB7). Базовые опции: font IBMPlexMono-Medium, color "#ffffff", width 4, align left, lineHeight 1, size 14, baseOffset -0.65. resize: size = scene.small ? 18 : 24, максимальная ширина t = 500, боковой отступ s = 20, width = min(screen.width-40, 500), межблочный отступ n = 25, r = max(20, (screen.width - width)*0.5), scrollMargin = 65, scrollMax = max(0, суммарнаяВысота - (screen.height - 65*4)); при scrollMax>0 старт o = scrollMargin*2 = 130, иначе o = (screen.height - a)*0.5. Скролл текста: scrollTargetY clamp 0..scrollMax, scrollY = lerpFPS(scrollY, scrollTargetY, 0.1). Кнопки (class ey): a = scene.small ? 12 : 18, шаг t += o + 15, перенос строки s -= l + 10, icon.position.x = mesh.size.x - a + 5, interactionMesh.scale = (mesh.size.x + icon.scale.x*0.5, mesh.size.y*1.25, 1). ПОПРАВКА 1: показ блоков — r = text ? (text.length>100 ? 0.75 : 0.25) : 0.3, накопительная задержка e += (text && length>100) ? 0.3 : 0.1 — подтверждено; но ПОПРАВКА 2: ey.show(e=1,t=0) игнорирует переданную длительность 0.3 и зовёт s.show(0.5, t + n*0.1) — каждая кнопка проявляется за 0.5 с со сдвигом 0.1 с.

```glsl
async init(){const e=Be.cubes[this.index].interior,
  t={font:"IBMPlexMono-Medium",color:"#ffffff",width:4,align:"left",lineHeight:1,size:14,baseOffset:-.65};
  this.elements.push(
    new Yh({parent:this,text:e.title,options:{...t,color:Be.colorProjectTitle}}),
    new Yh({parent:this,text:e.content,options:{...t,color:Be.colorProjectText}}),
    new Yh({parent:this,text:e.socialTitle,options:{...t,color:Be.colorProjectTitle}}),
    new ey({parent:this,links:e.social,options:{...t,color:Be.colorProjectText}}),
    new Yh({parent:this,text:e.linkTitle,options:{...t,color:Be.colorProjectTitle}}),
    new ey({parent:this,links:e.links,options:{...t,color:Be.colorProjectText}}));}

show(){this.group.visible=!0,this.scrollY=0,this.scrollTargetY=0;let e=0;
  this.elements.forEach((t,s)=>{var a;const n=!!t.text,r=n?t.text.length>100?.75:.25:.3;
    t.show(r,e); e+=n&&t.text.length>100?.3:.1; (a=t.interaction)==null||a.enable()})}

resize(){const e=this.scene.small?18:24,t=500,s=20;
  this.width=Math.min(q.screen.width-s*2,t);
  const n=25,r=Math.max(s,(q.screen.width-this.width)*.5);
  ... const a=this.elements.reduce((c,h)=>c+h.mesh.size.y,0)+n*(this.elements.length-1);
  this.scrollMax=Math.max(0,a-(q.screen.height-this.scrollMargin*4));
  if(this.scrollMax>0){o=this.scrollMargin*2;...} else {o=(q.screen.height-a)*.5;...}
  let l=o; this.elements.forEach(c=>{c.mesh.position.set(r,-l,0); l+=c.mesh.size.y+n})}

// class ey:
show(e=1,t=0){return Promise.all(this.els.map((s,n)=>s.show(.5,t+n*.1)))}
resize(){...const a=this.parent.scene.small?12:18,o=n.mesh.size.x+a;
  t+o>this.parent.width&&(t=0,s-=l+10);
  n.mesh.position.set(t,s,0),n.icon.scale.set(a,a,1),n.icon.position.set(n.mesh.size.x-a+5,0,0);
  ... t+=o+15}
update(){this.els.forEach(e=>{e.interactionMesh.scale.set(e.mesh.size.x+e.icon.scale.x*.5,e.mesh.size.y*1.25,1);...})}
```

**Что делать у нас.** Текст интерьера — тоже WebGL MSDF, но в отдельной ОРТОГРАФИЧЕСКОЙ сцене поверх, где единицы = пиксели (size 14 базовый, 24 на широком, 18 на узком). Колонка шириной ровно 500 px, центрируется по экрану, отступ между блоками 25 px. Если текст влезает — блок центрируется по вертикали и скролла нет; если не влезает — включается свой независимый скролл с инерцией 0.1 и запасом 130 px сверху. Под описанием ДВЕ группы кнопок: соцсети и сайт, каждая — строка иконок 18x18 (12 на узком) с шагом 15 и отдельным невидимым interactionMesh на 125% высоты для комфортного попадания. Блоки выезжают каскадом: длинный текст 0.75 с, заголовок 0.25 с, шаг задержки 0.3/0.1 с; кнопки внутри блока — по 0.5 с каждая со сдвигом 0.1 с.

Строка бандла: 20287

### ВЫХОД ИЗ ГЛЫБЫ: кнопка Close справа сверху, Escape, и обратная анимация. ПОДТВЕРЖДЕНО

**Числа.** Кнопка class OF (объявлена 19983, меш и подпись 20039, resize/onKey/onHover 20078): tMap "ui/close-datatexture.ktx2", плюс tBlocks "scroll-datatexture.ktx2", uColor = Be.colorLogo, uColor2 #ffffff; name "close", renderOrder 10, visible false. Подпись: Be.close = "Close", font IBMPlexMono-Medium, width 1, align center, lineHeight 0.8, size 0.09, uColor = Be.colorText. resize: e = mobile ? 85 : small ? 95 : 120, t = e*0.45; mesh.scale (e, t, 1); mesh.position (screen.width - scene.meshMarginLeft, -scene.meshMarginTop + t*0.12, 0); message.scale (e*2.15, e*2.15, 1); message.position.x = mesh.position.x - e*0.5, y = mesh.position.y - t*0.5 - message.size.y*0.21*message.scale.y. Hover: show(0.25, 0) + звук "ui-long". Клик и Escape: emit("webgl_switch_scene",""). Обратная анимация (20656): uDetailProgress → 0 ease power2.out duration 1.25; uDetailProgress2 → 0 ease power2.out duration 0.6; detailAnimationOut(): cameraZoom → 0 duration 1.45 ease power3.out (onComplete обнуляет _shardVolume), additionalRotationAmount глыб → 1 duration 1.45 ease power2.out, camera.touchAmount → 1 duration 1.45, plexus.resetClick(); playOutAnimation(): камера интерьера basePosition.z → 4 duration 0.6 ease "none", иконка additionalRotationAmount → 0 duration 0.6 ease power1.in, killTweensOf(displayUIvar), emit("webgl_project_hide"); звук "leave-project"; через delayedCall(1) isDetailOpen = false и enableScroll().

```glsl
// 20078:
onHover:t=>{t.action==="hover_in"&&(this.show(.25,0),Q.emit("webgl_play_audio","ui-long"))},
onClick:()=>{Q.emit("webgl_switch_scene","")}
... e.key==="Escape"&&Q.emit("webgl_switch_scene","")
resize(){const e=this.scene.mobile?85:this.scene.small?95:120,t=e*.45;
  this.mesh.scale.set(e,t,1);
  this.mesh.position.set(q.screen.width-this.scene.meshMarginLeft,-this.scene.meshMarginTop+t*.12,0);
  this.message.scale.set(e*2.15,e*2.15,1);
  this.message.position.set(this.mesh.position.x-e*.5,this.mesh.position.y-t*.5-this.message.size.y*.21*this.message.scale.y,0)}

// сам выход (20656):
this.centerDetailScene(0),this.detailIndex=0,
re.to(this.material.uniforms.uDetailProgress,{overwrite:!0,value:0,ease:"power2.out",duration:1.25}),
re.to(this.material.uniforms.uDetailProgress2,{overwrite:!0,value:0,ease:"power2.out",duration:.6}),
this.scrollComposers[1].passes[0].scene.detailAnimationOut(),
this.detailScene.playOutAnimation(),
Q.emit("webgl_play_audio","leave-project"),
await re.delayedCall(1,()=>{this.isDetailOpen=!1,this.enableScroll()})

detailAnimationOut(){re.to(this.cameraZoom,{overwrite:!0,value:0,duration:1.45,ease:"power3.out",onComplete:()=>{this._shardVolume=0,Q.emit("webgl_set_audio_volume","shard",this._shardVolume)}}),
  re.to(this.cubes.map(e=>e.additionalRotationAmount),{overwrite:!0,value:1,duration:1.45,ease:"power2.out"}),
  re.to(this.camera,{touchAmount:1,overwrite:!0,duration:1.45}),
  this.cubes.forEach(e=>e.plexus.resetClick())}
playOutAnimation(){re.to(this.camera.basePosition,{overwrite:!0,z:4,duration:.6,delay:0,ease:"none"}),
  re.to(this.objects.map(e=>e.additionalRotationAmount),{overwrite:!0,value:0,duration:.6,ease:"power1.in"}),
  re.killTweensOf(this.displayUIvar),Q.emit("webgl_project_hide")}
```

**Что делать у нас.** Выход не зеркалит вход, он в два раза резче: 1.45 с на возврат камеры глыб против 1.25+a на влёт, и всего 0.6 с на откат камеры интерьера. Кнопка Close — WebGL-меш, а не DOM, живёт в UI-сцене, привязана к правому верхнему углу через ту же сетку отступов (meshMarginLeft/meshMarginTop), что и логотип. Escape работает наравне с кликом. Возврат тоже идёт через роутер (пустой маршрут), так что кнопка «назад» браузера работает сама собой.

Строка бандла: 19983

### Звуковая партитура клика и интерьера. ПОДТВЕРЖДЕНО, номер строки исправлен

**Числа.** Все addAudio на строке 14444 (class u3): music-bg = music-highq.ogg volume 0.2 autoPlay loop; room-bg = room.ogg 0.45 autoPlay loop; wind = wind.ogg 0 autoPlay loop; igloo = igloo.ogg 0 autoPlay loop; beeps/beeps2/beeps3 = 0.5, minTimeBetweenPlays 0.4; click-project 0.5; enter-project 0.5; leave-project 0.5; shard = shard.ogg 0 autoPlay loop; project-text 0.5; portals = circles.ogg 0 autoPlay loop; particles = particles.ogg 0 autoPlay loop; logo 0.3; ui-long 0.3; ui-short 0.3; manifesto 0.3. Громкость льда (17646): r = soundVelocity > _shardVolume ? 0.2 : 0.05; _shardVolume = lerpFPS(_shardVolume, soundVelocity, r); emit("webgl_set_audio_volume","shard", _shardVolume*0.5) — берётся с ближайшей к центру глыбы. Бипы (playBeep, строка 17117): не чаще раза в 0.4 с, случайный из трёх.

```glsl
this._controller.addAudio({name:"music-bg",url:"music-highq.ogg",volume:.2,autoPlay:!0,loop:!0}),
this._controller.addAudio({name:"room-bg",url:"room.ogg",volume:.45,autoPlay:!0,loop:!0}),
this._controller.addAudio({name:"wind",url:"wind.ogg",volume:0,autoPlay:!0,loop:!0}),
this._controller.addAudio({name:"igloo",url:"igloo.ogg",volume:0,autoPlay:!0,loop:!0}),
this._controller.addAudio({name:"beeps",url:"beeps.ogg",volume:.5,minTimeBetweenPlays:.4}),
this._controller.addAudio({name:"click-project",url:"click-project.ogg",volume:.5}),
this._controller.addAudio({name:"enter-project",url:"enter-project.ogg",volume:.5}),
this._controller.addAudio({name:"leave-project",url:"leave-project.ogg",volume:.5}),
this._controller.addAudio({name:"shard",url:"shard.ogg",volume:0,autoPlay:!0,loop:!0}),
this._controller.addAudio({name:"project-text",url:"project-text.ogg",volume:.5}),
this._controller.addAudio({name:"ui-long",url:"ui-long.ogg",volume:.3}),

// громкость льда (17646):
const r=this.cubes[n].mouseFrost.soundVelocity>this._shardVolume?.2:.05;
this._shardVolume=ie.lerpFPS(this._shardVolume,this.cubes[n].mouseFrost.soundVelocity,r);
Q.emit("webgl_set_audio_volume","shard",this._shardVolume*.5);

// бипы на выноску (17117):
playBeep(){if(!(Fe.time-this.lastBeepPlayed<.4))switch(this.lastBeepPlayed=Fe.time,Math.floor(Math.random()*3)){
  case 0:Q.emit("webgl_play_audio","beeps");break;
  case 1:Q.emit("webgl_play_audio","beeps2");break;
  case 2:Q.emit("webgl_play_audio","beeps3");break}}
```

**Что делать у нас.** Три отдельных звука на переход: короткий щелчок сразу по клику, гулкий вход после автодоводки скролла, и звук проявления текста. Скрип льда shard.ogg — зацикленный на нулевой громкости, его громкость каждый кадр следует за скоростью ведения курсора по глыбе (быстрое нарастание 0.2, медленное затухание 0.05, итог умножается на 0.5). На каждое появление выноски играется случайный из трёх бипов, но не чаще раза в 0.4 с.

Строка бандла: 14444

### НОВОЕ (добавлено взамен ошибочного пункта «не найдено»): базовый класс камеры — near/far и fov раскрыты числами

**Числа.** const ox = .1, lx = 1e3 (near 0.1, far 1000). Фабрика Bw(i): для PERSPECTIVE — super(45, q.screen.w/q.screen.h, ox, lx); для ORTHOGRAPHIC — super(w*-0.5, w*0.5, h*0.5, h*-0.5, ox, lx). Рядом же: Ch = Math.PI*0.5, HD = 6, Gf = {PERSPECTIVE:1, ORTHOGRAPHIC:2}, Hf = {SCREEN:1, CUSTOM:2}. То есть fov 45 у обеих перспективных камер, и он не трогается при влёте в интерьер — в сцене глыб только модулируется скроллом (fov = 45 - 5*|scroll.velocity|, строка 17646).

```glsl
const Gf={PERSPECTIVE:1,ORTHOGRAPHIC:2},Hf={SCREEN:1,CUSTOM:2},ox=.1,lx=1e3,HD=6;
function Bw(i){const e=Gf[i.toUpperCase()],t=e===Gf.PERSPECTIVE?gi:Ln;
  return class extends t{constructor(){
    e===Gf.PERSPECTIVE?super(45,q.screen.w/q.screen.h,ox,lx):super(q.screen.w*-.5,q.screen.w*.5,q.screen.h*.5,q.screen.h*-.5,ox,lx),
    this.isBaseCamera=!0,this._sizing=Hf.SCREEN,this._size=new H(q.screen.w,q.screen.h),...}}
```

**Что делать у нас.** Обе перспективные камеры (сцена глыб и интерьер) — PerspectiveCamera(45, aspect, 0.1, 1000). Ортографическая UI-сцена — Orthographic(-w/2, w/2, h/2, -h/2, 0.1, 1000), то есть единицы UI-сцены совпадают с пикселями, ровно поэтому текст интерьера задаётся в размерах 14/18/24.

Строка бандла: 13304

**Не найдено или не подтвердилось:**

- ВЫБРОШЕНО как ОШИБОЧНОЕ: «Numeric near/far камеры (константы ox и lx) в распечатанном бандле не раскрываются числами». Раскрываются: строка 13304, const ox=.1, lx=1e3. Взамен добавлена отдельная подтверждённая находка про базовый класс камеры.
- ИСПРАВЛЕНО в находке про плексус: было «одна LineSegments-геометрия на 18*2 вершин». В бандле maxLines = maxPlexusPoints * maxConnectionsPerPoint = 18*3 = 54 отрезка, то есть 108 вершин (строка 17358).
- ИСПРАВЛЕНО в находке про материал льда: было «прозрачность считается своим кодом через uTransmission/uThickness». uniform float uTransmission объявлен (JS-значение 1 на строке 16486, GLSL-объявление на 16492), но НИ РАЗУ не используется ни в одном выражении шейдера. Работает только uThickness.
- ИСПРАВЛЕНО в находке про текст интерьера: было «0.3 для блока ссылок». Родительский show() действительно передаёт 0.3, но class ey.show(e=1,t=0) этот аргумент игнорирует и вызывает s.show(.5, t + n*.1) — 0.5 с на кнопку со сдвигом 0.1 с.
- ИСПРАВЛЕНЫ номера строк: находка про частицы интерьера указывала 20503 для WF (250 крупных) — на самом деле WF на 20375, а на 20503 объявлен XF (10000 мелких). Находка про клик указывала 17260 — класс jL с interaction и firstHitOnly на 17232, onMouseClick на 17260. Находка про ядро шейдера указывала 16689 — блок if (uChromaticAberration > 0.0) начинается на 16688. Находка про MSDF-глитч указывала 16854 — tr1/tr2 на 16855-16861. Находка про звук указывала 14442 — addAudio на 14444. Находка про конфиг указывала 14438 — объект Be объявлен на 14437 (массив cubes переносится на 14438).
- ИСПРАВЛЕНО: число сэмплов аберрации в GLSL записано не литералом 3.0, а шаблоном ${e} (totalSamples = ${e}.0, for i < ${e}.0, transmitted /= ${e}.0); значение 3 приходит из new WL(3) на строке 17425 при дефолте класса 5.
- ДОБАВЛЕНО к находке про TEMP: помимо статического квада с isNum=-2 при f===3, каждый кадр индексу 9 пишется знак: p = this.temp<0 ? -2 : -3. Также: [4,5,7,8] заполняются массивом Фаренгейта (h), а [10,11,13,14] — массивом Цельсия (o), а не наоборот.
- Численные габариты самих глыб (bounding box / размер в юнитах) в бандле отсутствуют. Геометрия живёт внутри cubes/cube1.drc, cubes/cube2.drc, cubes/cube3.drc — есть только computeBoundingBox() и обращения к n.min/n.max. Косвенные ориентиры: плоскость дыма 2.5 x 3.5 (17437), высота беговой дорожки плексуса 3 и радиус 0.9 от боундинг-сферы (17421).
- Uniform-ов с именами uRefraction, uIor, uFresnel, uTurbidity, uAbsorption в бандле НЕТ (0 вхождений). Показатель преломления задан свойством материала material.ior = 1.18 (17433), френель приходит из штатной three.js-функции EnvironmentBRDF, мутность даёт roughness 0.65 + roughnessMap.
- Поглощение (Beer's law) не работает: volumeAttenuation() принудительно возвращает vec3(1.0), рабочий код закомментирован (16633-16654). uAttenuationDistance = 0, uAttenuationColor = #ffffff — цветного поглощения по толщине НЕТ.
- Карты толщины (thicknessMap) нет: слово встречается только в библиотечной части three.js (строки < 14400), в коде приложения ни разу не присваивается. uThickness — константа 2 (16486), локально размазывается только на thickness_smear = uThickness * pow(roughnessFactor, 0.33).
- Никакого DOM и SVG в выносках и в тексте интерьера. Во всём коде приложения (строки > 14400) нет ни одного document.createElement / innerHTML / getElementById / querySelector. Всё — WebGL: LineSegments (LineBasicMaterial, аддитивный блендинг, renderOrder 999) и MSDF-текст из ../fonts/IBMPlexMono-Medium-datatexture.ktx2. Единственный DOM — Svelte-обёртка на последней строке 20662: attr(e,"id","webgl") и ветка !q.capabilities.webgl2.
- Кегль выносок в пикселях/пунктах не задан: тексты в мировых единицах (size 0.13 заголовок, 0.115 дата, 0.1 TEMP, 0.09 Close), а размер на экране получается из scale = min(0.8, 0.5/(screen.h/1300)) — привязка к высоте окна 1300 px.
- Тумана (Fog / FogExp2 / scene.fog) в коде приложения нет ни одного вхождения. Ощущение глубины делают фоновый градиент, два аддитивных световых билборда и 10250 точек.
- Источников света three.js (DirectionalLight / PointLight / AmbientLight / HemisphereLight) в коде приложения нет ни одного — все совпадения только в библиотечной части бандла. В главной сцене иконка — MeshBasicMaterial без света, в интерьере — свой шейдер с каустиками. Освещение самой глыбы — только envMap из cubes_env.exr (envMapIntensity 0.91, envMapRotation.y = PI).


## ТУННЕЛЬ

### Геометрия трубы туннеля (класс SF, mesh.name="tunnel") — ПОДТВЕРЖДЕНО дословно

**Числа.** new Md(1.3,1.3,9,64,32,!0). Md подтверждён как CylinderGeometry (строка 12037-12040: type="CylinderGeometry", parameters={radiusTop:e,radiusBottom:t,height:s,radialSegments:n,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l}). t.translate(0,-9*.5,0) = -4.5; t.scale(-1,1,1). mesh.position.y=1, renderOrder=1, visible=!1, receiveShadow=!1, castShadow=!1, transparent:!0, blending:pt. pt=2 подтверждено по шапке бандла (строка 4: qt=0,_o=1,pt=2,Ng=3,Og=4,cy=5 = NoBlending/Normal/Additive/Subtractive/Multiply/Custom), значит pt = AdditiveBlending. Ce подтверждён как Mesh (строка 2482, type="Mesh"). Мировой размах трубы по Y: -8 .. +1. Единственная текстура: tWind = le.load("wind_noise.ktx2","linear-repeat"). matrixAutoUpdate НЕ выключен (в отличие от почти всех соседей).

```glsl
class SF{constructor(e){this.scene=e,this.ready=new Promise(t=>{this.isReady=t}),this.init()}init(){const t=new Md(1.3,1.3,9,64,32,!0);t.translate(0,-9*.5,0),t.scale(-1,1,1);const s=new fe({uniformsGroups:[he.UBO],uniforms:{tWind:{value:le.load("wind_noise.ktx2","linear-repeat")}},vertexShader:`...`,fragmentShader:`...`,transparent:!0,blending:pt});this.mesh=new Ce(t,s),this.mesh.name="tunnel",this.mesh.renderOrder=1,this.mesh.position.y=1,this.mesh.updateMatrixWorld(!0),this.mesh.visible=!1,this.mesh.receiveShadow=!1,this.mesh.castShadow=!1,this.scene.add(this.mesh),this.isReady()}update(){const e=this.scene.timelineAdditional.upRotation*.65;this.mesh.rotation.y=e,this.mesh.rotation.y=e}}
// строка 12037:
}class Md extends ot{
  constructor(e=1,t=1,s=1,n=32,r=1,a=!1,o=0,l=Math.PI*2){
    super(),this.type="CylinderGeometry",this.parameters={
      radiusTop:e,radiusBottom:t,height:s,radialSegments:n,heightSegments:r,openEnded:a,thetaStart:o,thetaLength:l
    };
```

**Что делать у нас.** THREE.CylinderGeometry(1.3,1.3,9,64,32,true), затем geom.translate(0,-4.5,0) и geom.scale(-1,1,1). Меш на y=1, renderOrder=1, ShaderMaterial с transparent:true и blending:THREE.AdditiveBlending, без теней, стартовая visible=false. Единственная текстура — шумовая wind_noise (wrap Repeat, фильтр linear).

Строка бандла: 19211

### Шейдер стенки туннеля целиком (класс SF) — ПОДТВЕРЖДЕНО дословно, строка в строку

**Числа.** Вертекс: vFalloff = 1.0 - clamp(cameraPosition.y - 1.0, 0.0, 4.0)/4.0, затем smoothstep(0.0,1.0,vFalloff). Фрагмент (void main на строке 19242): uv = vUv*vec2(1.0,0.25); uv.x += uv.y; t = time*0.05. Три слоя одной текстуры с масштабами 3.0, 4.0, 6.0 и сдвигом vec2(-t, t*0.7), перемножаются. fade = smoothstep(0.0,0.2,vUv.y)*smoothstep(1.0,0.9,vUv.y). alpha = pow(value,3.0); alpha *= 3.0. Цвет vec3(0.85,0.9,1.0). vFalloff НЕ применён: строка `// alpha *= vFalloff;` закомментирована. Блок ${ae} подтверждён: ae="uniform Global{vec2 resolution;vec2 resolutionUI;float aspect;float time;float dtRatio;};". Блок ${Ue} — набор _linstep/falloff/falloffsmooth/_pl.

```glsl
// ---- VERTEX (19212-19230) ----
${ae}
varying float vFalloff;
varying vec2 vUv;
varying vec3 vPos;
void main() {
    vUv = uv;
    vec3 pos = position;
    vPos = pos;
    // fade in as camera enters igloo
    vFalloff = 1.0 - clamp(cameraPosition.y - 1.0, 0.0, 4.0) / 4.0;
    vFalloff = smoothstep(0.0, 1.0, vFalloff);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
// ---- FRAGMENT (19231-19270) ----
${ae}
${Ue}
varying float vFalloff;
varying vec2 vUv;
varying vec3 vPos;
uniform sampler2D tWind;
void main() {
    vec2 uv = vUv * vec2(1.0, 0.25);
    uv.x += uv.y;
    float t = time * 0.05;
    // layer to create organic smoke
    float value = texture2D(tWind, uv * 3.0 + vec2(-t, t * 0.7)).r;
    value *= texture2D(tWind, uv * 4.0 + vec2(-t, t * 0.7)).r;
    value *= texture2D(tWind, uv * 6.0 + vec2(-t, t * 0.7)).r;
    // fade at inner and outer part of mesh
    float fade = 1.0;
    fade *= smoothstep(0.0, 0.2, vUv.y);
    fade *= smoothstep(1.0, 0.9, vUv.y);
    // fade *= 1.0 - smoothstep(1.0, 0.3, vUv.y);
    value *= fade;
    // convert to linear(ish)
    float alpha = value;
    alpha = pow(alpha, 3.0);
    alpha *= 3.0;
    // alpha *= vFalloff;
    vec3 color = vec3(0.85, 0.9, 1.0);
    // color = vec3(1.0, 0.0, 0.0);
    // alpha = 1.0;
    gl_FragColor = vec4(color, alpha);
}
```

**Что делать у нас.** Копировать дословно. Обязательно подставить свой блок общих uniform (resolution, aspect, time). Перемножение трёх октав одной шумовой текстуры со сдвигом vec2(-t, t*0.7) даёт дымную стенку; pow(alpha,3.0)*3.0 выбивает тонкие волокна. Сжатие UV по вертикали в 0.25 и uv.x += uv.y дают спиральный ход дыма вдоль трубы.

Строка бандла: 19212

### Вращение туннеля по таймлайну (SF.update) — ПОДТВЕРЖДЕНО

**Числа.** this.mesh.rotation.y = this.scene.timelineAdditional.upRotation*.65 (строка дублируется дважды подряд, это в бандле так). Твин: to(timelineAdditional,{upRotation:Math.PI,duration:5.25,ease:"power3.inOut"},1) — подтверждён в createTimeline. Максимум PI*0.65 = 2.0420 рад. Рядом: rings.rotation.z = upRotation*.4 (макс 1.25664), plasma и smoketrail rotation.y = initialRotation + upRotation*.5.

```glsl
update(){const e=this.scene.timelineAdditional.upRotation*.65;this.mesh.rotation.y=e,this.mesh.rotation.y=e}
// таймлайн:
this.timeline.to(this.timelineAdditional,{upRotation:Math.PI,duration:5.25,ease:"power3.inOut"},1)
// кольца (cF.update, строка 17955):
update(){const e=this.scene.timelineAdditional.upRotation*.4;this.meshes.forEach(t=>{t.rotation.z=e})}
// плазма (MF.update, 19342) и шлейф (EF.update, 19096):
update(){const e=this.scene.timelineAdditional.upRotation*.5;this.meshes.forEach(t=>{t.rotation.y=t.initialRotation+e})}
```

**Что делать у нас.** Завести объект timelineAdditional={upRotation:0,upOriginal:0}, гнать upRotation 0→PI за 5.25 таймлайн-секунды с power3.inOut начиная с 1.0 с, и каждый кадр ставить tunnel.rotation.y = upRotation*0.65, rings.rotation.z = upRotation*0.4, plasma/smoketrail rotation.y = initialRotation + upRotation*0.5.

Строка бандла: 19271

### Кольца: модель, число, шаг, положения (класс cF) — ПОДТВЕРЖДЕНО дословно

**Числа.** Две модели: "shattered_ring2.drc" и "shattered_ring.drc". t=3, s=2.5, n стартует с 1.65. Позиции Y: -1.65, -4.15, -6.65. Чередование e[r%e.length]: ring0=shattered_ring2, ring1=shattered_ring, ring2=shattered_ring2. rotation.x=-3.14159*.5. renderOrder = t = 3 у всех трёх (не 3-a). Текстуры: `${name}_color.ktx2` (srgb-repeat) в tMap и `${name}_ao.ktx2` (srgb-repeat) в tGlow. Материал — новый экземпляр lF на КАЖДОЕ кольцо (new lF внутри цикла). update(): rotation.z = upRotation*.4.

```glsl
class cF{constructor(e){this.scene=e,this.ready=new Promise(t=>{this.isReady=t}),this.meshes=[],this.init()}async init(){const e=[{name:"shattered_ring2",geometry:await zt.load("shattered_ring2.drc")},{name:"shattered_ring",geometry:await zt.load("shattered_ring.drc")}],t=3,s=2.5;let n=1.65;for(let r=0;r<t;r++){const a=e[r%e.length],o=a.geometry,l=`mesh${r}`;this[l]=new Ce(o,new lF),this[l].material.uniforms.tMap.value=le.load(`${a.name}_color.ktx2`,"srgb-repeat"),this[l].material.uniforms.tGlow.value=le.load(`${a.name}_ao.ktx2`,"srgb-repeat"),this[l].name=`ring${r}`,this[l].receiveShadow=!1,this[l].castShadow=!1,this[l].position.y=-n,this[l].rotation.x=-3.14159*.5,this[l].updateMatrixWorld(!0),this[l].renderOrder=t,n+=s,this.scene.add(this[l]),this.meshes.push(this[l])}this.isReady()}update(){const e=this.scene.timelineAdditional.upRotation*.4;this.meshes.forEach(t=>{t.rotation.z=e})}}
```

**Что делать у нас.** Две разные раздробленные модели-кольца, 3 штуки на y = -1.65, -4.15, -6.65, поворот X = -PI/2, чередование геометрии через r%2. Каждое кольцо — своя пара текстур (baked color + AO/glow). Геометрия ОБЯЗАНА нести атрибуты `centr` (вектор от центра осколка) и `rand` (vec3 случайных) — они объявлены в вертексе lF (строки 17733, 17735), без них разлёта не будет.

Строка бандла: 17947

### РАЗЛЁТ ОСКОЛКОВ ЗАВИСИТ ОТ РАССТОЯНИЯ ДО КАМЕРЫ (вертекс lF). Числа подтверждены, НО НАПРАВЛЕНИЕ glowFalloff В ИСХОДНОМ РАЗБОРЕ БЫЛО ПЕРЕВЁРНУТО

**Числа.** Ключ: float dist = distance(cameraPosition, translation), translation = getMatrixTranslation(modelMatrix). Времени в формуле разлёта нет. Пороги (falloffsmooth(x,start,end,margin,progress) = smoothstep(p+m, p, x), m=margin*sign(end-start), p=mix(start-m,end,progress)):
· vFalloff = falloffsmooth(dist,14.0,2.0,13.0,0.75) = smoothstep(-4.75, 8.25, dist) — РАСТЁТ с расстоянием;
· glowFalloff(вертекс) = 1.0 - smoothstep(0.2, 0.4, 1.0 - vFalloff) → = 1 при dist >= 4.52 (ДАЛЕКО), = 0 при dist <= 2.63 (БЛИЗКО). Исходный разбор указал наоборот;
· spinFalloff = falloffsmooth(dist,8.0,2.0,5.0,0.5) = smoothstep(2.5, 7.5, dist);
· spinFalloff2 = falloffsmooth(dist,10.0,2.0,8.0,0.5) = smoothstep(2.0, 10.0, dist);
· vFade = falloffsmooth(dist,2.0,16.0,9.0,0.5) = smoothstep(13.5, 4.5, dist) → 1 при dist<=4.5, 0 при dist>=13.5.
Амплитуда: pos += centr*glowFalloff*mix(0.075,0.15,rand.z). Дыхание: pos += rand.y*centr*glowFalloff*sin(rand.x*5.0 + time*0.5 + (centr.x+centr.y+centr.z)*15.0)*0.05. Толчок первого кольца: pos += centr*camFactor*0.15*firstRingMask. Кручение: angle1 = spinFalloff*3.14159*0.3 (xz), angle2 = spinFalloff2*3.14159*0.3 + translation.y*0.25 + 1.5 (xy). Наклон осколка: angle = 0.5*smoothstep(1.5,12.0,-vPos.z) + firstRingMask*camFactor*0.5 вокруг normalize(rand*2.0-1.0), центр scaledCentr = centr*0.3. ВАЖНО: vPos = (modelViewMatrix*vec4(position,1.0)).xyz, то есть -vPos.z это глубина во вью-пространстве, а не мировой Z.

```glsl
vUv = uv;
vPos = (modelViewMatrix * vec4(position, 1.0)).xyz;

vec3 pos = position;
vec3 translation = getMatrixTranslation(modelMatrix);
float firstRingMask = falloff(translation.y, -1.66, -1.661, 0.01, 0.5);
vFirstRingMask = 1.0 - firstRingMask;
float camFactor = 1.0 - (1.0 - clamp(-cameraPosition.z * 0.8, 0.0, 1.0));

// rotate based on camera distance
float dist = distance(cameraPosition, translation);

vFalloff = falloffsmooth(dist, 14.0, 2.0, 13.0, 0.75);
float glowFalloff = 1.0 - smoothstep(0.2, 0.4, 1.0 - vFalloff);

vec3 scaledCentr = centr * 0.3;
vec3 axis = normalize(rand * 2.0 - 1.0);
float angle = 0.5 * smoothstep(1.5, 12.0, -vPos.z) + firstRingMask * camFactor * 0.5;
pos -= scaledCentr;
pos = rotate3D(pos, axis, angle);
pos += scaledCentr;

pos += centr * glowFalloff * mix(0.075, 0.15, rand.z);
pos += rand.y * centr * glowFalloff * sin(rand.x * 5.0 + time * 0.5 + (centr.x + centr.y + centr.z) * 15.0) * 0.05;

// additional push based on camera coming into view
pos += centr * camFactor * 0.15 * firstRingMask;

float spinFalloff = falloffsmooth(dist, 8.0, 2.0, 5.0, 0.5);
float spinFalloff2 = falloffsmooth(dist, 10.0, 2.0, 8.0, 0.5);

float angle1 = spinFalloff * 3.14159 * 0.3;
pos.xz = rotate(pos.xz, angle1);

float angle2 = spinFalloff2 * 3.14159 * 0.3 + translation.y * 0.25 + 1.5;
pos.xy = rotate(pos.xy, angle2);

vec4 worldPos = modelMatrix * vec4(pos, 1.0);
vGlowPos = rotate(worldPos.xz, -time * 0.5 + translation.y * 2.2);

// fade in as camera approaches
vFade = falloffsmooth(dist, 2.0, 16.0, 9.0, 0.5);

// make first ring fully visible
vFade = min(1.0, vFade);

gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

// чанк Ue (строка 13252) дословно:
// float _linstep(float begin,float end,float t){return clamp((t-begin)/(end-begin),0.0,1.0);}
// float falloff(float _input,float start,float end,float margin,float progress){float m=margin*sign(end-start);float p=mix(start-m,end,progress);return _linstep(p+m,p,_input);}
// float falloffsmooth(float _input,float start,float end,float margin,float progress){float m=margin*sign(end-start);float p=mix(start-m,end,progress);return smoothstep(p+m,p,_input);}
```

**Что делать у нас.** Разлёт вешать на distance(cameraPosition, центр кольца) прямо в вершинном шейдере, не на скролл и не на время. Скопировать _linstep/falloff/falloffsmooth дословно и вызвать с теми же пятёрками чисел. Смещение идёт по собственному вектору centr осколка, амплитуда mix(0.075,0.15,rand.z) — расхождение максимум 7.5-15% радиуса. Практический эффект (с учётом исправленного направления): ДАЛЬНЕЕ кольцо стоит раскрытым, и по мере подлёта камеры ближе 4.5 ед. осколки СХЛОПЫВАЮТСЯ, к 2.6 ед. собраны полностью — и ровно там же вспыхивает голубое свечение из фрагмента.

Строка бандла: 17772

### Маска первого кольца firstRingMask и camFactor у колец — ПОДТВЕРЖДЕНО с арифметикой

**Числа.** firstRingMask = falloff(translation.y, -1.66, -1.661, 0.01, 0.5). Раскрытие: m = 0.01*sign(-0.001) = -0.01; p = mix(-1.66+0.01, -1.661, 0.5) = -1.6555; _linstep(-1.6655, -1.6555, y) = clamp((y+1.6655)/0.01, 0, 1). Кольцо 0 (y=-1.65) → 1.55 → 1. Кольца 1 и 2 (y=-4.15, -6.65) → 0. Маска работает ТОЛЬКО на первое кольцо.
camFactor (вертекс) = 1.0 - (1.0 - clamp(-cameraPosition.z*0.8, 0.0, 1.0)) = clamp(-camZ*0.8, 0, 1): 0 при z=0, 1 при z<=-1.25.
camFactor (фрагмент) = pow(1.0 - clamp(-cameraPosition.z, 0.0, 1.0), 4.0): 1 при z=0, 0 при z<=-1.
Камера по Z в таймлайне: старт timelinePosition.set(0,1.5,-2); z→0 (dur 2.5, power2.out, @0); z→-1.5 (dur 3.7, entry_ease, @3.5); z→-3 (dur 2, entry_ease_2, @7.2).

```glsl
float firstRingMask = falloff(translation.y, -1.66, -1.661, 0.01, 0.5);
vFirstRingMask = 1.0 - firstRingMask;
float camFactor = 1.0 - (1.0 - clamp(-cameraPosition.z * 0.8, 0.0, 1.0));
...
pos += centr * camFactor * 0.15 * firstRingMask;
// фрагмент (17926-17928):
float camFactor = pow(1.0 - clamp(-cameraPosition.z, 0.0, 1.0), 4.0);
color += texture2D(tGlow, vUv).r * vec3(0.5, 0.7, 1.0) * n1 * glowFalloff * 0.8 * camFactor;
```

**Что делать у нас.** Точечная маска по Y-координате конкретного инстанса через falloff с окном 0.001 — дешёвый способ выделить один меш без лишнего uniform. Первое кольцо получает дополнительный толчок 0.15*camFactor на въезде камеры в сцену, остальные нет. Свечение по AO гаснет полностью, как только камера уходит за z=-1.

Строка бандла: 17779

### Фрагментный шейдер кольца (материал lF) — ПОДТВЕРЖДЕНО, но строка была 17862, верная 17888; и glowFalloff здесь ОБРАТЕН вертексному

**Числа.** uniforms lF: tMap:null, tGlow:null, uAlpha:1, uColor1="#6a6f7d", uColor2="#e1e6f1". Фон-градиент: diagonalGradient = (screenUv.x+screenUv.y)*0.5, промодулирован sinenoise1(vec3(screenUv, time*0.614))*0.5+0.5 и sinenoise1(vec3(screenUv*2.0, time*0.17))*0.5+0.5; bg = mix(uColor1,uColor2,diagonalGradient); bg *= 1.1. color = mix(bg, color, vFade*0.95). Свечение: falloff = 1.0 - vFalloff; glowFalloff = smoothstep(0.2, 0.4, falloff) — это РОВНО (1 - вертексный glowFalloff), то есть свет включается БЛИЗКО (dist <= 2.63), когда разлёт уже схлопнут. n1 = sinenoise1(vPos + time*0.5 + color.r*5.0)*0.5+0.5, затем n1 = n1*0.5+0.5. color += texture2D(tGlow,vUv).r * vec3(0.5,0.7,1.0) * n1 * glowFalloff * 0.8 * camFactor. alpha = 1.0 жёстко, uAlpha в шейдере объявлен, но не используется.

```glsl
void main() {
    float alpha = 1.0;
    vec3 color = texture2D(tMap, vUv).rgb;

    // background gradient
    vec2 screenUv = gl_FragCoord.xy / resolution;
    float diagonalGradient = (screenUv.x + screenUv.y) * 0.5;
    diagonalGradient *= sinenoise1(vec3(screenUv, time * 0.614)) * 0.5 + 0.5;
    diagonalGradient *= sinenoise1(vec3(screenUv * 2.0, time * 0.17)) * 0.5 + 0.5;
    vec3 bg = mix(uColor1, uColor2, diagonalGradient);
    bg *= 1.1;

    color = mix(bg, color, vFade * 0.95);

    // darken as camera approaches
    // color *= vFalloff;
    // reveal as camera enters igloo entry
    // color *= vFalloff2;

    // emissive
    float falloff = 1.0 - vFalloff;
    float glowFalloff = smoothstep(0.2, 0.4, falloff);
    float n1 = sinenoise1(vPos + time * 0.5 + color.r * 5.0) * 0.5 + 0.5;
    n1 = n1 * 0.5 + 0.5;
    float camFactor = pow(1.0 - clamp(-cameraPosition.z, 0.0, 1.0), 4.0);
    color += texture2D(tGlow, vUv).r * vec3(0.5, 0.7, 1.0) * n1 * glowFalloff * 0.8 * camFactor;
    // vec3 blue = vec3(0.5, 0.7, 1.0) * vFirstRingMask;
    // float glowModulation = pow(length(vGlowPos - vec2(0.0, 0.5)), 3.0);
    // color += blue * vGlow * 5.0 * glowFalloff * glowModulation;
    // color += color * blue * smoothstep(0.9, 1.0, falloff) * glowModulation * 0.5;

    gl_FragColor = vec4(color, alpha);
}
```

**Что делать у нас.** Дальние кольца не фейдить альфой, а замешивать в цвет фона: mix(bg, baked_color, vFade*0.95) — растворение в дымке без сортировки прозрачности, кольца остаются полностью непрозрачными. Голубое свечение по AO-карте цветом vec3(0.5,0.7,1.0) включать ОБРАТНЫМ falloff-ом относительно разлёта: осколки собираются и одновременно разгораются, когда камера подошла вплотную.

Строка бандла: 17888

### Кольцевое силовое поле (портал) внутри каждого кольца — класс bF. Подтверждено; маска firstRingMask работает НЕ так, как было заявлено

**Числа.** 3 меша, шаг 2.5, старт r=1.5 → Y: -1.5, -4.0, -6.5. rotation.x=-3.14159*.5, scale.setScalar(.65), renderOrder = 3-a, matrixAutoUpdate=!1, transparent:!0, blending:pt, depthTest:!1, depthWrite:!1. Геометрия kt(1,1) = PlaneGeometry (класс kt, строка 3040, type="PlaneGeometry"). Текстуры: tTriangles="igloo/triangles_tiling.ktx2" (srgb-repeat), tNoise="clouds_noise.ktx2" (srgb-repeat). Есть неиспользуемые uniform uAlpha:1, uColor1="#6a6f7d", uColor2="#e1e6f1". Цвет свечения vec3(0.7,0.8,1.0).
ИСПРАВЛЕНИЕ: firstRingMask = falloff(translation.y, -4.5, -4.51, 0.01, 0.5) → m=-0.01, p=-4.50, clamp((y+4.51)/0.01,0,1): y=-1.5 → 1, y=-4.0 → 1, y=-6.5 → 0. То есть маска = 1 у ПЕРВЫХ ДВУХ порталов и 0 у третьего; angle1 = spinFalloff*PI*0.25*(1.0-firstRingMask) крутит ТОЛЬКО третий (самый глубокий) портал.
vFalloff = smoothstep(3.5, 2.3, depth), depth = -mvPos.z. spinFalloff = falloffsmooth(dist,8.0,2.0,5.0,0.5), spinFalloff2 = falloffsmooth(dist,10.0,2.0,8.0,0.5). angle2 = spinFalloff2*3.14159*0.25 + translation.y*0.5.

```glsl
// VERTEX (19367-19410)
vUv = uv; vGlow = glow; vPos = position;
vec3 pos = position;
vec3 translation = getMatrixTranslation(modelMatrix);
float dist = distance(cameraPosition, translation);
float spinFalloff = falloffsmooth(dist, 8.0, 2.0, 5.0, 0.5);
float spinFalloff2 = falloffsmooth(dist, 10.0, 2.0, 8.0, 0.5);
float firstRingMask = falloff(translation.y, -4.5, -4.51, 0.01, 0.5);
vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
float depth = -mvPos.z;
vFalloff = smoothstep(3.5, 2.3, depth);
float angle1 = spinFalloff * 3.14159 * 0.25 * (1.0 - firstRingMask);
pos.xz = rotate(pos.xz, angle1);
float angle2 = spinFalloff2 * 3.14159 * 0.25 + translation.y * 0.5;
pos.xy = rotate(pos.xy, angle2);
vec4 worldPos = modelMatrix * vec4(pos, 1.0);
vWorldPos = worldPos.xyz;
vGlowPos = rotate(worldPos.xz, -time * 0.5 + translation.y * 2.2);
gl_Position = projectionMatrix * mvPos;

// FRAGMENT (19426-19465)
void main() {
    float alpha = 1.0;
    float y = length(vUv - 0.5) * 2.0;
    float circleMask = 1.0 - step(0.98, y);
    float radialMask = smoothstep(0.5, 1.0, y);
    float circleEdgeMask = smoothstep(0.9, 0.85, y);
    float noise = texture2D(tNoise, vUv * 0.25 + vec2(vWorldPos.y)).r;
    noise *= texture2D(tNoise, vUv * 0.8 + vec2(vWorldPos.y)).r;
    noise = sin(noise * 13.0 + time - y * 10.0) * 0.5 + 0.5;
    float mask = aastep(0.2, noise) * (1.0 - noise * 0.75);
    float triangles = texture2D(tTriangles, vUv * 2.0 + noise * 0.04).r * 4.0;
    // shape effect
    alpha = triangles * mask;
    alpha += pow(mask, 5.0) * 0.5;
    alpha += radialMask * 0.5;
    alpha *= circleMask;
    alpha = min(1.0, alpha);
    // clip to circle
    alpha *= circleEdgeMask;
    alpha *= smoothstep(0.45 - vFalloff * 0.25, 0.75 - vFalloff * 0.3, length(vUv - 0.5));
    float camFactor = (1.0 - clamp(-cameraPosition.z * 8.0, 0.0, 1.0));
    alpha *= camFactor;
    vec3 color = vec3(0.7, 0.8, 1.0);
    gl_FragColor = vec4(color, alpha);
}
```

**Что делать у нас.** Плоский диск PlaneGeometry(1,1) внутри каждого кольца, повёрнут -PI/2 по X, масштаб 0.65, depthTest и depthWrite выключены, аддитив. Тайлящаяся текстура треугольников плюс облачный шум дают плазменную мембрану. Радиальная маска smoothstep(0.45 - vFalloff*0.25, 0.75 - vFalloff*0.3, r) раскрывает дырку в центре по мере приближения — сквозь неё и пролетает камера. camFactor гасит поле полностью, как только камера отъезжает за z=-0.125.

Строка бандла: 19342

### Плазма-конус у каждого кольца (класс MF, модель shattered_ring_smoke.drc) — ПОДТВЕРЖДЕНО, кроме side

**Числа.** 3 меша, шаг n=2.5, старт r=1.6 → Y: -1.6, -4.1, -6.6. initialRotation = a*3.14*2*.25 (0, 1.57, 3.14). renderOrder = 3-a. ИСПРАВЛЕНИЕ: side:xi, а xi = DoubleSide, не BackSide (шапка бандла: es=0 FrontSide, ei=1 BackSide, xi=2 DoubleSide; проверено по Material: this.side=es по умолчанию, строка 1997). blending:pt, transparent:!0. Один общий материал на три меша. Глубина: depth = -(modelViewMatrix*vec4(position,1.0)).z; vFalloff = 1.0 - smoothstep(2.0,4.0,depth); vFalloff *= smoothstep(0.4,1.0,depth). vPos = мировая позиция (modelMatrix), в фрагменте не используется. UV: vUv*vec2(0.25,0.5), uv.x += uv.y, t = -time*0.075, слои 3.0/4.0/6.0. fade = smoothstep(0.3,0.4,vUv.x)*smoothstep(0.6,0.5,vUv.x). glowMask = smoothstep(0.3,0.45,vUv.x)*smoothstep(0.8,0.4,vUv.x); value += glowMask*0.3; value += pow(glowMask,2.0)*wind*0.2. alpha *= 1.7; alpha = pow(alpha,4.0); alpha = min(1.0,alpha); alpha *= pow(1.0-clamp(-cameraPosition.z,0.0,1.0),4.0). Цвет vec3(0.65,0.8,1.0). update(): rotation.y = initialRotation + upRotation*.5.

```glsl
// VERTEX (19279-19291)
vUv = uv;
vec3 pos = position;
vPos = (modelMatrix * vec4(position, 1.0)).xyz;
float depth = -(modelViewMatrix * vec4(position, 1.0)).z;
vFalloff = 1.0 - smoothstep(2.0, 4.0, depth);
vFalloff *= smoothstep(0.4, 1.0, depth);
gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

// FRAGMENT (19303-19341)
void main() {
    vec2 uv = vUv * vec2(0.25, 0.5);
    uv.x += uv.y;
    float t = -time * 0.075;
    // layer to create organic smoke
    float wind = texture2D(tWind, uv * 3.0 + vec2(-t, t * 0.7)).r;
    wind *= texture2D(tWind, uv * 4.0 + vec2(-t, t * 0.7)).r;
    wind *= texture2D(tWind, uv * 6.0 + vec2(-t, t * 0.7)).r;
    float value = wind;
    // fade at inner and outer part of mesh
    float fade = 1.0;
    fade *= smoothstep(0.3, 0.4, vUv.x);
    fade *= smoothstep(0.6, 0.5, vUv.x);
    value *= fade;
    float glowMask = smoothstep(0.3, 0.45, vUv.x) * smoothstep(0.8, 0.4, vUv.x);
    value += glowMask * 0.3;
    value += pow(glowMask, 2.0) * wind * 0.2;
    // fade by depth
    value *= vFalloff;
    // convert to linear(ish)
    float alpha = value;
    alpha *= 1.7;
    alpha = pow(alpha, 4.0);
    alpha = min(1.0, alpha);
    // fade in when scene transitions in
    float camFactor = pow(1.0 - clamp(-cameraPosition.z, 0.0, 1.0), 4.0);
    alpha *= camFactor;
    vec3 color = vec3(0.65, 0.8, 1.0);
    gl_FragColor = vec4(color, alpha);
}
// строка 19342:
`,transparent:!0,blending:pt,side:xi}),s=3,n=2.5;let r=1.6;for(let a=0;a<s;a++){const o=`mesh${a}`;this[o]=new Ce(e,t),this[o].name=`plasma${a}`,this[o].position.y=-r,this[o].initialRotation=a*3.14*2*.25,this[o].renderOrder=s-a,r+=n,this.scene.add(this[o]),this.meshes.push(this[o])}
```

**Что делать у нас.** Одна модель дыма (кольцевая юбка) переиспользуется 3 раза с разной стартовой Y-ротацией (0, 90, 180 градусов), чтобы дым у трёх колец не выглядел одинаково. Материал ОДИН на все три (side: DoubleSide, аддитив) — экономия драйв-коллов. Клинообразная маска по vUv.x (0.3-0.4 и 0.6-0.5) вырезает узкую полосу свечения.

Строка бандла: 19271

### Дымный шлейф вдоль трубы (класс EF, модель smoke_trail.drc) — ПОДТВЕРЖДЕНО, кроме side

**Числа.** 3 меша, шаг 2.5, старт 1.6 → Y: -1.6, -4.1, -6.6. initialRotation = a*3.14*2*.25. ИСПРАВЛЕНИЕ: side:xi = DoubleSide (не BackSide). depthTest:!1, depthWrite:!1, transparent:!0, БЕЗ аддитива. renderOrder = 3-a. vFalloff = (1.0 - smoothstep(2.0,15.0,depth)) * smoothstep(0.5,2.0,depth), depth = -(modelViewMatrix*vec4(position,1.0)).z. ВАЖНО: vPos = (modelMatrix*vec4(position,1.0)).xyz — МИРОВАЯ позиция, и uv.x += vPos.z*0.1 сдвигает шум по мировому Z, а не по локальному. UV: vUv*vec2(0.25,0.5), t = time*0.15, слои 3.0/4.0/6.0. fade = smoothstep(0.0,0.2,vUv.y)*smoothstep(1.0,0.5,vUv.y)*(1.0 - abs((vUv.x-0.5)*2.0)). alpha *= 2.75; alpha = pow(alpha,3.0); alpha = min(1.0,alpha). Цвет vec3(0.85,0.9,1.0). Тот же tWind (wind_noise.ktx2, linear-repeat), что и на стенке. update(): rotation.y = initialRotation + upRotation*.5.

```glsl
// VERTEX (19041-19053)
vUv = uv;
vec3 pos = position;
vPos = (modelMatrix * vec4(position, 1.0)).xyz;
// fade in as camera enters igloo
float depth = -(modelViewMatrix * vec4(position, 1.0)).z;
vFalloff = 1.0 - smoothstep(2.0, 15.0, depth);
vFalloff *= smoothstep(0.5, 2.0, depth);
gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

// FRAGMENT (19065-19095)
vec2 uv = vUv * vec2(0.25, 0.5);
uv.x += vPos.z * 0.1;
float t = time * 0.15;
float value = texture2D(tWind, uv * 3.0 + vec2(-t, t * 0.7)).r;
value *= texture2D(tWind, uv * 4.0 + vec2(-t, t * 0.7)).r;
value *= texture2D(tWind, uv * 6.0 + vec2(-t, t * 0.7)).r;
float fade = 1.0;
fade *= smoothstep(0.0, 0.2, vUv.y);
fade *= smoothstep(1.0, 0.5, vUv.y);
fade *= 1.0 - abs((vUv.x - 0.5) * 2.0);
// fade *= 1.0 - smoothstep(1.0, 0.3, vUv.y);
value *= fade;
// fade by depth
value *= vFalloff;
float alpha = value;
alpha *= 2.75;
alpha = pow(alpha, 3.0);
alpha = min(1.0, alpha);
vec3 color = vec3(0.85, 0.9, 1.0);
gl_FragColor = vec4(color, alpha);
```

**Что делать у нас.** Шлейф — отдельная geometry (не труба), три копии с той же раскладкой Y, что у плазмы. Двойная глубинная маска (гаснет и слишком близко, и слишком далеко) убирает клиппинг о ближнюю плоскость. Тот же wind_noise, что и на стенке, только скорость 0.15 вместо 0.05 и сдвиг UV по МИРОВОМУ Z вершины. Материал прозрачный, без аддитива, side DoubleSide, глубина отключена.

Строка бандла: 19033

### СНЕГ в туннеле (класс CF, mesh.name="particles") — ПОДТВЕРЖДЕНО дословно

**Числа.** options = {count:200, shape:"box", scale:[3,8,3], center:[0,0,0], generateRandomBuffer:!0}. Позиции: Math.random()*scale[i] - scale[i]*0.5 + center[i]. Атрибуты position(3) и random(3). mesh.position.y -= 3.5, renderOrder=1, frustumCulled=!1, matrixAutoUpdate=!1, blending:pt, depthTest:!1, depthWrite:!1, transparent:!0. Fn подтверждён как Points (строка 11526, type="Points"). Падение: pos.y -= mix(0.4,0.7,fract(random.x+random.z+random.y))*time. Спираль: angle = t*0.5 + pos.y; pos.x += sin(angle)*0.4; pos.z += cos(angle)*0.4; pos.xz = rotate(pos.xz, t*0.5); t = time*mix(0.2,1.0,random.x). Зацикливание: pos = treadmill(pos, vec3(3.0,4.0,3.0)); treadmill подтверждён в чанке Cg: vec3 treadmill(vec3 p,vec3 margin){vec3 n=fract((p+margin)/(2.0*margin));return n*2.0*margin-margin;}. Альфа: smoothstep(8.0,0.0,-vWorldPos.y) * smoothstep(0.0,2.0,-vWorldPos.y) * (1.0 - min(1.0, length(vWorldPos.xz)*0.5)) * smoothstep(0.5,1.0,-vMvPos.z) * smoothstep(0.0,2.0,-vMvPos.z) * (sin(time+random.x+random.z*13.0)*0.5+0.5) * 0.3. Размер: gl_PointSize = 50.0 / length(mvPos.xyz) * (resolution.y/1300.0). vAngle = random.y*3.14*2.0 + mix(0.5,0.2,random.x) - time*mix(0.5,1.0,random.x*1.3). Форма: circularGrad = 1.0 - length(uv-0.5)*2.0; squish = pow(1.0 - abs(uv.x-0.5), floor(vRandom.y*3.0+2.0)); alpha = clamp(alpha,0.0,1.0).

```glsl
vRandom = random;
vAngle = random.y * 3.14 * 2.0 + mix(0.5, 0.2, random.x);
vAngle -= time * mix(0.5, 1.0, random.x * 1.3);

vec3 pos = position;
float t = time;
t *= mix(0.2, 1.0, random.x);

pos.y -= mix(0.4, 0.7, fract(random.x + random.z + random.y)) * time;

float angle = t * 0.5 + pos.y;
pos.x += sin(angle) * 0.4;
pos.z += cos(angle) * 0.4;
pos.xz = rotate(pos.xz, t * 0.5);

pos = treadmill(pos, vec3(3.0, 4.0, 3.0));

vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
vMvPos = mvPos.xyz;

// fade at ends
vAlpha = 1.0;
vAlpha *= smoothstep(8.0, 0.0, -vWorldPos.y);
vAlpha *= smoothstep(0.0, 2.0, -vWorldPos.y);
// circular gradient fade
vAlpha *= 1.0 - min(1.0, length(vWorldPos.xz) * 0.5);
// fade near camera
vAlpha *= smoothstep(0.5, 1.0, -vMvPos.z);
// fade far from camera
vAlpha *= smoothstep(0.0, 2.0, -vMvPos.z);
vAlpha *= sin(time + random.x + random.z * 13.0) * 0.5 + 0.5;
vAlpha *= 0.3;

gl_Position = projectionMatrix * mvPos;
// gl_PointSize = resolution.y / mix(75.0, 125.0, random.z);
float size = 50.0;
gl_PointSize = size / length(mvPos.xyz) * (resolution.y / 1300.0);

// FRAGMENT (19191-19210)
vec2 uv = gl_PointCoord.xy;
vec3 color = vec3(1.0);
float alpha = vAlpha;
float circularGrad = 1.0 - length(uv - 0.5) * 2.0;
alpha *= circularGrad;
uv -= 0.5;
uv = rotate(uv, vAngle);
uv += 0.5;
float squish = pow(1.0 - abs(uv.x - 0.5), floor(vRandom.y * 3.0 + 2.0));
alpha *= squish;
alpha = clamp(alpha, 0.0, 1.0);
gl_FragColor = vec4(color, alpha);
```

**Что делать у нас.** Всего 200 точек на весь снег. Ключ, чтобы снег не кончался: treadmill заворачивает координату в коробку vec3(3,4,3), частица ушла вниз — появилась сверху. Размер строго перспективный: 50/расстояние, нормировано на resolution.y/1300. Итоговая альфа умножена на 0.3 — снег очень слабый, читается только массой. Материал снега несёт ОДИН uniform {uAlpha:{value:1}}, хотя фрагмент объявляет ещё tNumbers и uProgress — их не подключают.

Строка бандла: 19096

### Дым у потолка (TF) и у пола (IF) на выходе из туннеля — ПОДТВЕРЖДЕНО, добавлены пропущенные UV

**Числа.** TF (класс объявлен на 19466): модель "ceilingsmoke.drc", position.y=-9.4, scale.set(2,.1,2), renderOrder=2, matrixAutoUpdate=!1, transparent:!0, blending:pt, uniforms только tWind. UV: vUv*vec2(0.5,1.0), uv.x -= uv.y, t = -time*0.075, слои 1.0/2.0/3.0. fade = smoothstep(0.135,0.25,vUv.x)*smoothstep(1.0,0.3,vUv.x). alpha *= 1.8; alpha = pow(alpha,2.0); alpha += pow(screenUv.x,2.0)*fade*0.2. innerCircle = smoothstep(0.0,0.1,vUv.x)*smoothstep(0.4,0.1,vUv.x); alpha += innerCircle*fade*0.4*screenUv.x; alpha += innerCircle*wind*screenUv.x. Строки value += glowMask*0.3 и value += pow(glowMask,2.0)*wind*0.2 ЗАКОММЕНТИРОВАНЫ.
IF (класс объявлен на 19535): модель "shattered_ring_smoke.drc", position.y=-10.17, scale.set(5,.1,5), renderOrder=0, uAlpha:{value:0}, matrixAutoUpdate НЕ выключен. Та же UV-раскладка vUv*vec2(0.5,1.0) и uv.x -= uv.y (в исходном разборе была пропущена), t = time*0.05 + 0.5, слои 1.0/2.0/3.0. fade = smoothstep(0.4,0.5,vUv.x)*smoothstep(1.0,0.4,vUv.x). alpha *= 3.0; alpha = pow(alpha,3.0); alpha += pow(screenUv.x,2.0)*fade*0.15; alpha *= uAlpha.
Оба цвета vec3(0.9,0.95,1.0). Таймлайн: groundsmoke visible=true @3.4, uAlpha fromTo 0→1 duration 3 power2.out @4.4; ceilingsmoke visible=true @4.5.

```glsl
// TF (ceilingsmoke) FRAGMENT, строки 19493-19534
vec2 screenUv = gl_FragCoord.xy / resolution;
vec2 uv = vUv * vec2(0.5, 1.0);
uv.x -= uv.y;
float t = -time * 0.075;
float wind = texture2D(tWind, uv * 1.0 + vec2(-t, t * 0.7)).r;
wind *= texture2D(tWind, uv * 2.0 + vec2(-t, t * 0.7)).r;
wind *= texture2D(tWind, uv * 3.0 + vec2(-t, t * 0.7)).r;
float value = wind;
float fade = 1.0;
fade *= smoothstep(0.135, 0.25, vUv.x);
fade *= smoothstep(1.0, 0.3, vUv.x);
value *= fade;
float glowMask = smoothstep(0.3, 0.45, vUv.x) * smoothstep(0.8, 0.4, vUv.x);
// value += glowMask * 0.3;
// value += pow(glowMask, 2.0) * wind * 0.2;
float alpha = value;
alpha *= 1.8;
alpha = pow(alpha, 2.0);
alpha += pow(screenUv.x, 2.0) * fade * 0.2;
float innerCircle = smoothstep(0.0, 0.1, vUv.x) * smoothstep(0.4, 0.1, vUv.x);
alpha += innerCircle * fade * 0.4 * screenUv.x;
alpha += innerCircle * wind * screenUv.x;
vec3 color = vec3(0.9, 0.95, 1.0);
gl_FragColor = vec4(color, alpha);

// IF (groundsmoke) FRAGMENT, строки 19563-19602
vec2 uv = vUv * vec2(0.5, 1.0);
uv.x -= uv.y;
float t = time * 0.05 + 0.5;
...
fade *= smoothstep(0.4, 0.5, vUv.x);
fade *= smoothstep(1.0, 0.4, vUv.x);
float alpha = value;
alpha *= 3.0;
alpha = pow(alpha, 3.0);
alpha += pow(screenUv.x, 2.0) * fade * 0.15;
alpha *= uAlpha;
```

**Что делать у нас.** Плоские дымовые блины (scale по Y = 0.1) на потолке зала (-9.4) и на полу (-10.17). Наземный вводится по таймлайну через uAlpha (0→1 за 3 с power2.out с 4.4), потолочный просто включается видимостью в 4.5 с. Добавка pow(screenUv.x,2.0) делает дым ярче в правой части экрана — дешёвая имитация бокового источника света.

Строка бандла: 19466

### Туман/атмосфера и «свет»: THREE.Fog не используется, фон — сфера lightroom (класс dF). ПОДТВЕРЖДЕНО, кроме side

**Числа.** Геометрия bd(100,32,32); bd подтверждён как SphereGeometry (строка 12186: type="SphereGeometry", parameters={radius,widthSegments,heightSegments,...}). ИСПРАВЛЕНИЕ: side:ei, а ei = BackSide (не FrontSide) — сфера рендерится изнутри, как купол. position.y=-12.15, renderOrder=2, matrixAutoUpdate=!1, без прозрачности (gl_FragColor alpha = 1.0). uColor1="#6a6f7d", uColor2="#e1e6f1". Uniform tPerlin="perlin-datatexture.ktx2" (colordata-repeat) объявлен, но во фрагменте не используется; uAlpha тоже не используется (строки с ним закомментированы). Градиент: ramp = (screenUv.x+screenUv.y)*0.5, промодулирован sinenoise1(vec3(screenUv, time*0.614))*0.5+0.5 и sinenoise1(vec3(screenUv*2.0, time*0.17))*0.5+0.5; color = mix(uColor1,uColor2,ramp); color *= 1.1. Точки: dotUv = vUv*vec2(200.0,100.0), tDotPattern="cubes/dot_pattern.ktx2" (srgb-repeat), dotid = hash12(floor(dotUv)), dotfade = 1.0 - abs(fract(dotid + time*0.1) - 0.5)*2.0, color += dots*dotfade*2.0. Проверено грепом: `lights:!0` — 0 совпадений, `new *Light(` — 0 совпадений, `scene.fog=` и `.fog=new` — 0 совпадений. Весь свет — эмиссия в шейдерах плюс Bloom.

```glsl
class dF{...init(){const e=new bd(100,32,32),t=new fe({uniformsGroups:[he.UBO],uniforms:{uAlpha:{value:1},uColor1:{value:new Z("#6a6f7d")},uColor2:{value:new Z("#e1e6f1")},tPerlin:{value:le.load("perlin-datatexture.ktx2","colordata-repeat")},tDotPattern:{value:le.load("cubes/dot_pattern.ktx2","srgb-repeat")}},...

// FRAGMENT (18331-18368)
vec2 screenUv = gl_FragCoord.xy / resolution;
float ramp = (screenUv.x + screenUv.y) * 0.5;
ramp *= sinenoise1(vec3(screenUv, time * 0.614)) * 0.5 + 0.5;
ramp *= sinenoise1(vec3(screenUv * 2.0, time * 0.17)) * 0.5 + 0.5;
vec3 color = mix(uColor1, uColor2, ramp);
color *= 1.1;
vec2 dotUv = vUv * vec2(200.0, 100.0);
float dots = texture2D(tDotPattern, dotUv).r;
float dotid = hash12(floor(dotUv));
float dotfade = 1.0 - abs(fract(dotid + time * 0.1) - 0.5) * 2.0;
color += dots * dotfade * 2.0;
// animate on scroll
// float alpha = falloffsmooth(length(vPos.xz), 0.0, 10.1, 2.0, uAlpha);
// color *= alpha;
gl_FragColor = vec4(color, 1.0);

float hash12(vec2 p) {
    vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// строка 18369:
`,side:ei});this.mesh=new Ce(e,t),this.mesh.name="lightroom",this.mesh.renderOrder=2,this.mesh.position.y=-12.15,...
```

**Что делать у нас.** Фог не ставить вообще. Вместо него: (1) сфера радиуса 100, материал side=BackSide, экранный диагональный градиент #6a6f7d → #e1e6f1, шевелящийся двумя sinenoise со скоростями 0.614 и 0.17; (2) в каждом шейдере объектов пересчитывать тот же градиент и подмешивать через mix(bg, color, vFade) — это и есть дальняя дымка. Плюс мерцающие точки-звёзды 200x100 через hash12 по ячейке. Ни одного источника света three.js в сцене не заводить.

Строка бандла: 18269

### Bloom и цветокор-пасс входа (класс DF + функция RF) — ПОДТВЕРЖДЕНО дословно

**Числа.** Bloom: e.addPass(new Fd().addBloom({debug:q.devScene, levels:6, luminanceThreshold:0, intensity:1, radius:.85})), навешивается один раз через флаг __hasBloomPass. Uniforms DF: tDiffuse:null, tBlue="noises/blue-8-128-rgb.ktx2" (data-repeat), tScroll="scroll-datatexture.ktx2" (data-repeat), uBlueOffset (Vector2), uGradientAlpha:0, uRingProximity:0, uSquareAttr (Vector3). Каждый кадр по событию webgl_render: uBlueOffset.set(Math.random()*46.23, Math.random()*12.5). const bluramount = 0.3. Искажение: angle1 = angle + 0.3*(noise.r-0.5)*uRingProximity; dispSquares = texture2D(tScroll, newUv1*1.5 + uSquareAttr.rg).g*2.0-1.0; newUv1 += dispSquares*0.01*uSquareAttr.b*uRingProximity. Подсветка в HSV только если length(scene) < length(vec3(1.0)): scene.g += 0.05*uRingProximity, scene.b += 0.075*uRingProximity. Блик: diagonalGradient = pow(vUv.x*vUv.y, 2.0); sceneColor += diagonalGradient*(sinenoise1(vec3(vUv.x*aspect, vUv.y, time*0.5))*0.4+0.4)*vec3(0.8,0.9,1.0)*noise.b*2.0. Выход: gl_FragColor = vec4(clamp(sceneColor,0.0,1.0), 1.0). uGradientAlpha объявлен, но в шейдере не используется.

```glsl
class DF extends fe{constructor(){super({uniformsGroups:[he.UBO],uniforms:{tDiffuse:{value:null},tBlue:{value:le.load("noises/blue-8-128-rgb.ktx2","data-repeat")},tScroll:{value:le.load("scroll-datatexture.ktx2","data-repeat")},uBlueOffset:{value:new H},uGradientAlpha:{value:0},uRingProximity:{value:0},uSquareAttr:{value:new b}},vertexShader:...

// FRAGMENT (19685-19732)
vec2 uv = vUv;
vec3 scene;
vec3 noise = getNoise(tBlue, gl_FragCoord.xy, uBlueOffset).rgb;
if (uRingProximity > 0.0) {
    // main distortion
    uv -= 0.5;
    uv.x *= aspect;
    float angle = atan(uv.y, uv.x);
    float dist = length(uv);
    const float bluramount = 0.3;
    float angle1 = angle + bluramount * (noise.r - 0.5) * uRingProximity;
    vec2 newUv1 = vec2(cos(angle1), sin(angle1)) * dist;
    newUv1.x /= aspect;
    newUv1 += 0.5;
    // squares
    float dispSquares = texture2D(tScroll, newUv1 * 1.5 + uSquareAttr.rg).g * 2.0 - 1.0;
    newUv1 += dispSquares * 0.01 * uSquareAttr.b * uRingProximity;
    // read color
    scene = texture2D(tDiffuse, newUv1).rgb;
    // highlight only when not already white
    if (length(scene) < length(vec3(1.0))) {
        scene = rgb2hsv(scene);
        scene.g += 0.05 * uRingProximity;
        scene.b += 0.075 * uRingProximity;
        scene = hsv2rgb(scene);
    }
} else {
    scene = texture2D(tDiffuse, uv).rgb;
}
vec3 sceneColor = scene;
// glare
float diagonalGradient = pow(vUv.x * vUv.y, 2.0);
sceneColor += diagonalGradient * (sinenoise1(vec3(vUv.x * aspect, vUv.y, time * 0.5)) * 0.4 + 0.4) * vec3(0.8, 0.9, 1.0) * noise.b * 2.0;
gl_FragColor = vec4(clamp(sceneColor, 0.0, 1.0), 1.0);

// строка 19733:
`}),Q.on("webgl_render",()=>{this.uniforms.uBlueOffset.value.set(Math.random()*46.23,Math.random()*12.5)})}}
function RF(i,e){const t=new Eg(new DF);t.isEntryColorCorrectionPass=!0,e.addPass(t),i.___composerPass=t}
```

**Что делать у нас.** Вспышка при пролёте сквозь кольцо делается не в 3D, а полноэкранным пассом: угловое (вихревое) смещение UV по blue-noise плюс блочное смещение по scroll-текстуре, оба умножены на uRingProximity, плюс подъём S и V в HSV. Blue-noise каждый кадр сдвигается случайным offset — иначе зерно застынет. Bloom с luminanceThreshold = 0 (светится всё), 6 уровней, radius 0.85.

Строка бандла: 19658

### Импульсы uRingProximity — вспышки на трёх кольцах — ПОДТВЕРЖДЕНО дословно

**Числа.** Три пары твинов (секунды таймлайна): (1) 0→1 dur .5 power1.in @2.0; 1→0 dur .4 power1.out @2.5. (2) 0→1 dur .5 @2.95; 1→0 dur .4 @3.45. (3) 0→1 dur .5 @3.8; 1→0 dur .6 power1.out @4.3. Перед импульсом вызывается s(): a = (второй аргумент если задан) иначе 1 при n===null или direction===-1, иначе 0.5; uSquareAttr.value.set(Math.random()*25.424, Math.random()*64.453, a). Вызовы: call(s,null,2), call(s,null,2.95), call(s,[!0],3.8), call(s,[!1,.5],4.9). Звук: n = min по [.28,.375,.465] от |progress - точка|; _portalsVolume = ie.ease(ie.fit(n, 0, .04, 1, 0), "power2.out")*.9. Тайм-коды 2.0/2.95/3.8 при длительности таймлайна 9.2 с соответствуют progress 0.2174 / 0.3207 / 0.4130.

```glsl
const s=(n=null,r=null)=>{const a=r!==null?r:n===null||this.direction===-1?1:.5;e.uSquareAttr.value.set(Math.random()*25.424,Math.random()*64.453,a)};
this.timeline.call(s,null,2),
this.timeline.fromTo(e.uRingProximity,{value:0},{value:1,duration:.5,ease:"power1.in"},2),
this.timeline.fromTo(e.uRingProximity,{value:1},{value:0,duration:.4,ease:"power1.out"},2.5),
this.timeline.call(s,null,2.95),
this.timeline.fromTo(e.uRingProximity,{value:0},{value:1,duration:.5,ease:"power1.in"},2.95),
this.timeline.fromTo(e.uRingProximity,{value:1},{value:0,duration:.4,ease:"power1.out"},3.45),
this.timeline.call(s,[!0],3.8),
this.timeline.fromTo(e.uRingProximity,{value:0},{value:1,duration:.5,ease:"power1.in"},3.8),
this.timeline.fromTo(e.uRingProximity,{value:1},{value:0,duration:.6,ease:"power1.out"},4.3),
this.timeline.call(s,[!1,.5],4.9),
this.timeline.progress(1),this.timeline.progress(0)
// звук порталов в onUpdate:
let n=1/0;[.28,.375,.465].forEach(r=>{const a=Math.abs(this.progress-r);n=Math.min(n,a)}),
this._portalsVolume=ie.ease(ie.fit(n,0,.04,1,0),"power2.out")*.9
```

**Что делать у нас.** Вспышки не считаются по расстоянию, а жёстко прибиты к таймлайну: 2.0 / 2.95 / 3.8 с (моменты, когда камера физически проходит кольца на -1.65, -4.15, -6.65). Значит в своей сцене сначала верстается пролёт, потом руками расставляются импульсы на те же тайм-коды. Звук привязан к прогрессу скролла: пики на 0.28, 0.375, 0.465, окно затухания 0.04. Учти direction: при скролле назад третий аргумент uSquareAttr всегда 1, при движении вперёд 0.5 — блочный сдвиг вдвое слабее.

Строка бандла: 19733

### Видимость всех элементов туннеля по прогрессу скролла (onUpdate таймлайна) — ПОДТВЕРЖДЕНО дословно

**Числа.** rings.mesh0 < .34 · mesh1 < .43 · mesh2 < .52
ringforcefield.mesh0: > .1 и < .34 · mesh1: > .25 и < .43 · mesh2: > .36 и < .52
plasma.mesh0: > .06 и < .34 · mesh1: > .25 и < .43 · mesh2: > .35 и < .52
smoketrail.mesh0: > 0 и < .37 · mesh1: > 0 и < .47 · mesh2: > 0 и < .56
tunnel.mesh.visible = progress < .52
snowparticles.mesh.visible = progress < .52
roomring.mesh.visible = progress > .53
В том же onUpdate: если camera.fov изменился твином, вызывается camera.updateProjectionMatrix().

```glsl
this.timeline=re.timeline({paused:!0,onUpdate:()=>{this.camera.fov!==t&&(t=this.camera.fov,this.camera.updateProjectionMatrix()),
this.rings.mesh0.visible=this.progress<.34,this.rings.mesh1.visible=this.progress<.43,this.rings.mesh2.visible=this.progress<.52,
this.ringforcefield.mesh0.visible=this.progress>.1&&this.progress<.34,this.ringforcefield.mesh1.visible=this.progress>.25&&this.progress<.43,this.ringforcefield.mesh2.visible=this.progress>.36&&this.progress<.52,
this.plasma.mesh0.visible=this.progress>.06&&this.progress<.34,this.plasma.mesh1.visible=this.progress>.25&&this.progress<.43,this.plasma.mesh2.visible=this.progress>.35&&this.progress<.52,
this.smoketrail.mesh0.visible=this.progress>0&&this.progress<.37,this.smoketrail.mesh1.visible=this.progress>0&&this.progress<.47,this.smoketrail.mesh2.visible=this.progress>0&&this.progress<.56,
this.tunnel.mesh.visible=this.progress<.52,
this.snowparticles.mesh.visible=this.progress<.52,
this.roomring.mesh.visible=this.progress>.53
```

**Что делать у нас.** Всё, что относится к туннелю, выключается на progress = 0.52-0.56, и на 0.53 включается кольцо зала. Туннель существует только в первой половине сцены. Видимость гасится булевой visible, не альфой — экономия филлрейта на тяжёлых аддитивных мешах. Каждый элемент имеет свой порог включения, чтобы дальние кольца не грузили кадр раньше времени.

Строка бандла: 19733

### СКОРОСТЬ ПРОХОДА ТУННЕЛЯ в их единицах на единицу прокрутки — ПОДТВЕРЖДЕНО, вся арифметика пересчитана

**Числа.** scrollMultiplier = 75e-5 = 0.00075. Колесо: scroll.targetY2 += e.delta.y*0.00075. Клавиши: ±150*0.00075 = ±0.1125. Тач: scroll.targetY2 += e.delta11.y*1.25 (множитель 1.25, БЕЗ scrollMultiplier — дословно так). Сглаживание: targetY1 = lerpFPSLimited(targetY1, targetY2, .075, 100*0.00075 = 0.075); y = lerpFPS(y, targetY1, .15). Ограничитель: t = 750*0.00075 = 0.5625, targetY2 = clamp(targetY2, y-t, y+t). Порог схлопывания: |y - targetY2| < 0.1*0.00075 = 7.5e-5 → жёсткая синхронизация. Инерция: velocity += |Δy|, velocity *= frictionFPS(.98), clamp(0,1).
Сцена входа: this.height = 5.5; A.progress = (y - A.__top)/(S+1), S = height → делитель 6.5. Вся сцена = 6.5 скролл-единиц = 8666.67 px колеса.
Длительность таймлайна 9.2 с (последний твин 7.2+2). Спуск камеры: timelinePosition.y 1.5 → -9.83, duration 7, entry_ease_3, старт 0.2 → progress 0.0217391..0.7826087, Δ = 0.7608696.
ИТОГО: 11.33 мировых единицы за 4.9456522 скролл-единицы = 6594.2 px колеса. 2.29095 мировой единицы на скролл-единицу · 0.00171817 мировой единицы на px колеса · 582.0 px колеса на мировую единицу · 1 скролл-единица = 1333.33 px колеса.

```glsl
this.scrollMultiplier=75e-5
onScroll(e){this.scrollBlocked||(this.stopAutoCenter(),this.scroll.targetY2+=e.delta.y*this.scrollMultiplier)}
onKeyDown(e){this.scrollBlocked||(this.stopAutoCenter(),e.key==="ArrowDown"&&(this.scroll.targetY2+=150*this.scrollMultiplier),e.key==="ArrowUp"&&(this.scroll.targetY2-=150*this.scrollMultiplier))}
onTouchDrag(e){this.scrollBlocked||(this.stopAutoCenter(),this.scroll.targetY2+=e.delta11.y*1.25)}
// сглаживание в render():
this.scroll.targetY1=ie.lerpFPSLimited(this.scroll.targetY1,this.scroll.targetY2,.075,100*this.scrollMultiplier);
this.scroll.y=ie.lerpFPS(this.scroll.y,this.scroll.targetY1,.15);
const t=750*this.scrollMultiplier;
this.scroll.targetY2=ie.clamp(this.scroll.targetY2,this.scroll.y-t,this.scroll.y+t),
Math.abs(this.scroll.y-this.scroll.targetY2)<.1*this.scrollMultiplier&&(this.scroll.y=this.scroll.targetY2,this.scroll.targetY1=this.scroll.targetY2),
this.scroll.velocity+=Math.abs(this.scroll.y-e)*1,this.scroll.velocity*=ie.frictionFPS(.98),this.scroll.velocity=ie.clamp(this.scroll.velocity,0,1);
// прогресс сцены:
const S=A.__bottom-A.__top; A.progress=(y-A.__top)/(S+1)
// у сцены входа (класс UF): this.height=5.5
// спуск камеры:
this.timeline.to(this.timelinePosition,{y:-9.83,duration:7,ease:"entry_ease_3"},.2)
```

**Что делать у нас.** Скролл держать в СВОИХ единицах, не в пикселях: одна единица = 1333 px колеса. Сцену мерить высотой в тех же единицах (у входа 5.5), прогресс делить на height+1 — единица запаса нужна, чтобы соседняя сцена успела появиться. Двойное сглаживание обязательно: targetY1 догоняет targetY2 с лимитом скорости 0.075, затем y догоняет targetY1 коэффициентом 0.15. Ограничитель ±0.5625 не даёт швырнуть камеру рывком колеса. Ориентир скорости: 0.0017 мировой единицы туннеля на пиксель колеса.

Строка бандла: 20656

### Кривые ease для прохода туннеля (CustomEase-пути) — ПОДТВЕРЖДЕНО дословно

**Числа.** entry_ease   : "M0,0 C0.358,0 0.336,0.209 0.442,0.519 0.59,0.952 0.768,0.918 1,1" (precision 2)
entry_ease_2 : "M0,0 C0.388,0.082 0.924,0.862 1,1" (precision 2)
entry_ease_3 : "M0,0 C0.272,0 0.472,0.454 0.496,0.496 0.66,0.79 0.685,1 1,1" (precision 2)
igloo_ease_1 : "M0,0 C0.662,0.073 0.047,1 1,1" (precision 2)
inOut5       : "M0,0 C0.171,0 0.77,-0.013 0.842,0.272 0.972,0.794 0.972,0.85 1,1" (без precision)
Дополнительно (строка 13304, ядро): inOut1 "M0,0 C0.5,0 0.1,1 1,1", inOut2 "M0,0 C0.56,0 0,1 1,1", inOut3 "M0,0 C0.6,0 0,1 1,1", inOut4 "M0,0 C0.4,0 -0.06,1 1,1" — все с precision 2. inOut3 используется в centerScroll (автоцентровка), inOut1 в анимации входа в проект.

```glsl
Ei.create("inOut5","M0,0 C0.171,0 0.77,-0.013 0.842,0.272 0.972,0.794 0.972,0.85 1,1"),
Ei.create("entry_ease","M0,0 C0.358,0 0.336,0.209 0.442,0.519 0.59,0.952 0.768,0.918 1,1",{precision:2}),
Ei.create("entry_ease_2","M0,0 C0.388,0.082 0.924,0.862 1,1",{precision:2}),
Ei.create("entry_ease_3","M0,0 C0.272,0 0.472,0.454 0.496,0.496 0.66,0.79 0.685,1 1,1",{precision:2}),
Ei.create("igloo_ease_1","M0,0 C0.662,0.073 0.047,1 1,1",{precision:2})
```

**Что делать у нас.** Зарегистрировать GSAP CustomEase с этими путями дословно. Спуск по туннелю идёт по entry_ease_3 — она даёт ступеньку в середине (узлы 0.472,0.454 и 0.496,0.496), камера чуть притормаживает между вторым и третьим кольцом, потом разгоняется. Без этой кривой пролёт линейно-скучный. Для автоцентровки скролла взять inOut3.

Строка бандла: 20662

### Полный таймлайн пролёта туннеля (класс UF, createTimeline) — ПОДТВЕРЖДЕНО дословно, добавлен пропущенный set displacementRot

**Числа.** Старт: timelinePosition.set(0,1.5,-2), timelineTarget.set(0,-2.5,-1). Таймлайн paused:!0, прогонка через timeline.progress(this.progress).
· position z:0, x:0, dur 2.5, power2.out, @0
· target   z:0, x:0, dur 2.5, power2.out, @0
· position y:-9.83, dur 7, entry_ease_3, @0.2
· target   y:-10, dur 3, power1.inOut, @0.2
· target   y:-9.81, dur 2.5, power1.inOut, @3.2
· upRotation → Math.PI, dur 5.25, power3.inOut, @1
· upOriginal → 1, dur 3.7, entry_ease, @3.5
· position z:-1.5, dur 3.7, entry_ease, @3.5
· position z:-3, dur 2, entry_ease_2, @7.2
· camera set fov 22 @0, затем to fov 30, dur 7.2, power1.inOut, @0
· set displacement {x:.01,y:.005} @0; set displacementRot {value:0} @0 (в исходном разборе пропущено)
· displacement to {x:0,y:0} dur 1 power2.inOut @4
· displacementTar to {x:-.03,y:-.01} dur 2 power2.inOut @4
· displacementRot to .05 dur 2 power2.inOut @4
· target y:-10.35, dur 2, power2.in, @7.2
Полная длительность 9.2 с. В конце createTimeline делается progress(1) и progress(0) — прогрев твинов.
Камера сцены: fov 25, basePosition(0,5.5,0), baseTarget(0,0,0), displacement.position(.07,.025), lerpPosition .02, lerpRotation .02, lerpTarget .015, shake .02, shakeSpeed .25; в resize(): camera.zoom = Math.min(1, q.screen.aspectRatio*1.5).
Вектор вверх: baseUp.set(0,0,-1) → applyAxisAngle((0,1,0), upRotation) → lerp к (0,1,0) на upOriginal → normalize.

```glsl
this.timelinePosition.set(0,1.5,-2),this.timelineTarget.set(0,-2.5,-1);
this.timeline.to(this.timelinePosition,{z:0,x:0,duration:2.5,ease:"power2.out"},0),
this.timeline.to(this.timelineTarget,{z:0,x:0,duration:2.5,ease:"power2.out"},0),
this.timeline.to(this.timelinePosition,{y:-9.83,duration:7,ease:"entry_ease_3"},.2),
this.timeline.to(this.timelineTarget,{y:-10,duration:3,ease:"power1.inOut"},.2),
this.timeline.to(this.timelineTarget,{y:-9.81,duration:2.5,ease:"power1.inOut"},3.2),
this.timeline.to(this.timelineAdditional,{upRotation:Math.PI,duration:5.25,ease:"power3.inOut"},1),
this.timeline.to(this.timelineAdditional,{upOriginal:1,duration:3.7,ease:"entry_ease"},3.5),
this.timeline.to(this.timelinePosition,{z:-1.5,duration:3.7,ease:"entry_ease"},3.5),
this.timeline.to(this.timelinePosition,{z:-3,duration:2,ease:"entry_ease_2"},7.2),
this.timeline.set(this.camera,{fov:22},0),
this.timeline.to(this.camera,{fov:30,duration:7.2,ease:"power1.inOut"},0),
this.timeline.set(this.timelineDisplacement,{x:.01,y:.005},0),
this.timeline.set(this.timelineDisplacementRot,{value:0},0),
this.timeline.to(this.timelineDisplacement,{x:0,y:0,duration:1,ease:"power2.inOut"},4),
this.timeline.to(this.timelineDisplacementTar,{x:-.03,y:-.01,duration:2,ease:"power2.inOut"},4),
this.timeline.to(this.timelineDisplacementRot,{value:.05,duration:2,ease:"power2.inOut"},4),
this.timeline.to(this.timelineTarget,{y:-10.35,duration:2,ease:"power2.in"},7.2);
// cameraOptions():
this.camera.fov=25,this.camera.updateProjectionMatrix(),this.camera.basePosition.set(0,5.5,0),this.camera.baseTarget.set(0,0,0),this.camera.displacement.position.set(.07,.025),this.camera.lerpPosition=.02,this.camera.lerpRotation=.02,this.camera.lerpTarget=.015,this.camera.shake.setScalar(.02),this.camera.shakeSpeed.setScalar(.25)
// каждый кадр в update():
this.camera.basePosition.copy(this.timelinePosition),this.camera.baseTarget.copy(this.timelineTarget),
this.camera.displacement.position.copy(this.timelineDisplacement),this.camera.displacement.target.copy(this.timelineDisplacementTar),
this.camera.displacement.rotation=this.timelineDisplacementRot.value,
this.camera.baseUp.set(0,0,-1),
this.camera.baseUp.applyAxisAngle($x.set(0,1,0),this.timelineAdditional.upRotation),
this.camera.baseUp.lerp($x.set(0,1,0),this.timelineAdditional.upOriginal).normalize()
// resize():
resize(){this.camera.zoom=Math.min(1,q.screen.aspectRatio*1.5),this.camera.updateProjectionMatrix()}
```

**Что делать у нас.** Камеру не двигать напрямую — держать два Vector3 (timelinePosition, timelineTarget) плюс displacement/displacementRot, гнать их GSAP-таймлайном на paused:true и каждый кадр делать timeline.progress(scrollProgress). Ключ к ощущению падения в шахту: одновременно тянется fov 22 → 30 и вектор up поворачивается на PI вокруг Y, а потом плавно возвращается к (0,1,0) через upOriginal — камера переворачивается по ходу спуска. Не забыть updateProjectionMatrix при каждом изменении fov и zoom = min(1, aspect*1.5) на ресайзе.

Строка бандла: 19733

### Кольцо на выходе из туннеля (класс oF, mesh.name="roomring") — ПОДТВЕРЖДЕНО дословно

**Числа.** Геометрия kt(1,1) = PlaneGeometry(1,1), e.rotateX(Math.PI*.5), e.translate(0,1.5,0). Материал без единого uniform (uniforms:{}). mesh.position.y=-10.26, scale.setScalar(.57), renderOrder=3, transparent:!0, blending:pt, matrixAutoUpdate НЕ выключен. Вертекс: pos.xz = rotate(pos.xz, -time*0.2). Фрагмент: color = vec3(2.0); dist = length(vUv-0.5); alpha = smoothstep(0.5,0.3,dist) * smoothstep(0.3,0.4,dist) * smoothstep(0.03,0.1,abs(vUv.x-0.5)); alpha *= mix(1.0, 0.8, sin(time*2.0 + dist + vUv.x*2.0 + vUv.y)*0.5+0.5). Строка smoothstep(0.04,0.09,abs(vUv.y-0.5)) закомментирована. Видимо при progress > .53.

```glsl
class oF{constructor(e){this.scene=e,this.ready=new Promise(t=>{this.isReady=t}),this.init()}init(){const e=new kt(1,1);e.rotateX(Math.PI*.5),e.translate(0,1.5,0);const t=new fe({uniformsGroups:[he.UBO],uniforms:{},vertexShader:...

// VERTEX (17669-17681)
vUv = uv;
vec3 pos = position;
pos.xz = rotate(pos.xz, -time * 0.2);
gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

// FRAGMENT (17692-17717)
void main() {
    vec3 color = vec3(2.0);
    // draw ring
    float dist = length(vUv - 0.5);
    float alpha = smoothstep(0.5, 0.3, dist);
    alpha *= smoothstep(0.3, 0.4, dist);
    alpha *= smoothstep(0.03, 0.1, abs(vUv.x - 0.5));
    // alpha *= smoothstep(0.04, 0.09, abs(vUv.y - 0.5));
    // subtle animation
    alpha *= mix(1.0, 0.8, sin(time * 2.0 + dist + vUv.x * 2.0 + vUv.y) * 0.5 + 0.5);
    gl_FragColor = vec4(color, alpha);
}

// строка 17718:
`,transparent:!0,blending:pt});this.mesh=new Ce(e,t),this.mesh.position.y=-10.26,this.mesh.scale.setScalar(.57),this.mesh.name="roomring",this.mesh.renderOrder=3,...
```

**Что делать у нас.** Тонкое светящееся кольцо рисуется одним шейдером без текстур и без единого uniform: два встречных smoothstep по радиусу дают ободок между 0.3 и 0.4 от центра, третий smoothstep по abs(vUv.x-0.5) вырезает шов. Цвет vec3(2.0) намеренно за пределами [0,1], чтобы кольцо ушло в Bloom. Плоскость перед этим поднята translate(0,1.5,0) и положена rotateX(PI/2).

Строка бандла: 17646

### Частицы-искры в зале под туннелем (класс BF, mesh.name="ambientparticles") — ПОДТВЕРЖДЕНО дословно

**Числа.** options = {count:60, shape:"box", scale:[2.5,.5,2.5], center:[0,0,0]}; буфер random генерируется всегда (без флага). mesh.position.y=-9.61, renderOrder=15, frustumCulled=!1, transparent:!0, blending:pt, uniforms {uAlpha:{value:1}}. Дрейф: t = time*0.1; pos.x += sin(t*0.4 + position.z*2.5)*0.75; pos.y += sin(t*0.2 + position.x*2.5)*0.75; pos.z += sin(t*0.2 + position.y*2.5)*0.75. Размер: size = mix(7.0,12.0,random.x); gl_PointSize = size * resolution.y * 0.002 (НЕ перспективный). Мерцание: vLightFalloff = sin(time*1.8 + random.y*22.43)*0.4+0.6; *= smoothstep(0.2,0.24,length(pos.xz)); *= 1.25. Фрагмент: uv = gl_PointCoord; uv.y = 1.0 - uv.y; circularGrad = 1.0 - clamp(length(uv-0.5)*2.0,0.0,1.0); circularGrad *= pow(uv.x,2.0); circularGrad = pow(circularGrad,2.0); alpha = circularGrad*vLightFalloff*uAlpha. Таймлайн: visible=false @0, visible=true @3.4, uAlpha fromTo 0→1 dur 3 power2.out @4.4. Строка vec2 ndc = gl_Position.xy/gl_Position.w вычисляется, но не используется.

```glsl
class BF{constructor(e){this.options={count:60,shape:"box",scale:[2.5,.5,2.5],center:[0,0,0]},...}
// VERTEX (19613-19635)
vUv = uv;
float t = time * 0.1;
vec3 pos = position;
pos.x += sin(t * 0.4 + position.z * 2.5) * 0.75;
pos.y += sin(t * 0.2 + position.x * 2.5) * 0.75;
pos.z += sin(t * 0.2 + position.y * 2.5) * 0.75;
// pos.x = max(0.22, pos.x);
// pos.z = max(0.22, pos.z);
gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
// scale larger with screen gradient
vec2 ndc = gl_Position.xy / gl_Position.w;
float size = mix(7.0, 12.0, random.x);
gl_PointSize = size * resolution.y * 0.002;
// random flicker
vLightFalloff = sin(time * 1.8 + random.y * 22.43) * 0.4 + 0.6;
vLightFalloff *= smoothstep(0.2, 0.24, length(pos.xz));
vLightFalloff *= 1.25;

// FRAGMENT (19644-19657)
vec2 uv = gl_PointCoord.xy;
uv.y = 1.0 - uv.y;
float circularGrad = 1.0 - clamp(length(uv - 0.5) * 2.0, 0.0, 1.0);
circularGrad *= pow(uv.x, 2.0);
circularGrad = pow(circularGrad, 2.0);
vec3 color = vec3(1.0);
float alpha = circularGrad * vLightFalloff;
alpha *= uAlpha;
gl_FragColor = vec4(color, alpha);
```

**Что делать у нас.** Всего 60 точек в коробке 2.5 x 0.5 x 2.5 на высоте -9.61. Размер НЕ перспективный (в отличие от снега) — постоянный в пикселях, привязан к resolution.y*0.002, поэтому искры читаются как источники света, а не как объекты. Мерцание по random.y*22.43 разводит фазы; smoothstep(0.2,0.24,length(pos.xz)) вырезает дырку в центре, чтобы искры не лезли в кадр камеры.

Строка бандла: 19603

**Не найдено или не подтвердилось:**

- ВЫБРОШЕНО КАК НЕВЕРНОЕ: «side:xi (BackSide)» у плазмы MF и шлейфа EF. В бандле xi = DoubleSide. Шапка бандла (строка 4): es=0, ei=1, xi=2, что по порядку констант three.js r165 = FrontSide, BackSide, DoubleSide; подтверждено дефолтом материала this.side=es (строка 1997).
- ВЫБРОШЕНО КАК НЕВЕРНОЕ: «side:ei (FrontSide, изнутри не рисуется)» у сферы lightroom (dF). ei = BackSide — сфера как раз и рисуется изнутри, это купол.
- ВЫБРОШЕНО КАК НЕВЕРНОЕ: направление glowFalloff у колец. В вертексе glowFalloff = 1.0 - smoothstep(0.2,0.4,1.0-vFalloff), а vFalloff = smoothstep(-4.75, 8.25, dist) растёт с расстоянием. Значит glowFalloff = 1 при dist >= 4.52 (далеко) и 0 при dist <= 2.63 (близко), то есть осколки раскрыты ИЗДАЛЕКА и схлопываются при подлёте. В разборе было записано наоборот.
- ВЫБРОШЕНО КАК НЕВЕРНОЕ: «свет и разлёт синхронны». Фрагментный glowFalloff = smoothstep(0.2,0.4,1.0-vFalloff) — это в точности (1 - вертексный glowFalloff). Свечение и разлёт ПРОТИВОФАЗНЫ: осколки собираются ровно тогда, когда включается голубая эмиссия.
- ВЫБРОШЕНО КАК НЕВЕРНОЕ: «firstRingMask в bF — маска на ВТОРОЕ кольцо». Расчёт falloff(translation.y, -4.5, -4.51, 0.01, 0.5) = clamp((y+4.51)/0.01, 0, 1) даёт 1 для y=-1.5 и y=-4.0 и 0 для y=-6.5. Маска = 1 у первых двух порталов; вращение angle1 = spinFalloff*PI*0.25*(1-firstRingMask) применяется ТОЛЬКО к третьему, самому глубокому порталу.
- ИСПРАВЛЕН НОМЕР СТРОКИ: фрагментный шейдер кольца (lF) указан как 17862, там varying-объявления. Верно: fragmentShader начинается на 17850, void main() на 17888.
- ИСПРАВЛЕНЫ НОМЕРА СТРОК классов: EF (smoketrail) объявлен на 19033, а не 19035; CF (снег) — на 19096, а не 19097; MF (плазма) — на 19271, а не 19272; bF (ringforcefield) — на 19342, а не 19343; TF (ceilingsmoke) — на 19466, а не 19467; BF (ambientparticles) — на 19603, а не 19604. Остальные номера (19211, 19212, 19271, 17947, 17790, 17779, 17646, 18269, 19658, 19733, 20656, 20662) подтверждены как есть.
- УТОЧНЕНО: «Переменной/параметра с именем snow в бандле нет» — неверно. Есть свойство this.snowparticles (строки 16312 и 19733) и ОТДЕЛЬНЫЙ класс B3 с mesh.name="snowparticles" (строка 15923) для другой сцены (уличная/иглу). К туннелю относится именно CF с mesh.name="particles", создаваемый через createSnowParticles() на строке 19733.
- ПОДТВЕРЖДЕНО ОТСУТСТВИЕ: uCamZ — 0 совпадений грепом. camFactor и falloff — локальные переменные шейдеров, вычисляемые из встроенного cameraPosition, не uniform.
- ПОДТВЕРЖДЕНО ОТСУТСТВИЕ: ни одного источника света three.js. `new *Light(` — 0 совпадений, `lights:!0` — 0 совпадений.
- ПОДТВЕРЖДЕНО ОТСУТСТВИЕ: THREE.Fog / FogExp2 в сцене не создаются. `scene.fog=` и `.fog=new` — 0 совпадений; строки Fog/FogExp/FogDepth/FogUniforms присутствуют только внутри копии ядра three.js.
- ПОДТВЕРЖДЕНО ОТСУТСТВИЕ: слово debris — 0 совпадений; shatter встречается только в именах моделей shattered_ring.drc / shattered_ring2.drc / shattered_ring_smoke.drc.
- ПОДТВЕРЖДЕНО ОТСУТСТВИЕ: .mp3 — 0 совпадений в App3D.js; звуки адресуются строковыми ключами через Q.emit("webgl_set_audio_volume", ...).
- ПОДТВЕРЖДЕНО ОТСУТСТВИЕ: слово tunnel встречается 4 раза (mesh.name="tunnel" на 19271, createTunnel/this.tunnel на 19733); shaft — только name="lightshaft" на строке 20467, это луч света в сцене деталей проекта, к туннелю отношения не имеет.
- ПОДТВЕРЖДЕНО ОТСУТСТВИЕ: uniform tNumbers у снега объявлен во фрагменте CF (строка 19179) вместе с uProgress, но uniforms материала — только {uAlpha:{value:1}}; обе текстуры/значения не подключены. Аналогично не подключены/не используются: uAlpha в материале колец lF, uAlpha+uColor1+uColor2 в bF, tPerlin и uAlpha в dF, uGradientAlpha в пассе DF.
- ПОДТВЕРЖДЕНО ОТСУТСТВИЕ: точные габариты моделей shattered_ring.drc / shattered_ring2.drc в бандле не заданы — геометрия приходит из Draco, scale для колец не вызывается (только position.y и rotation.x).
- ПОДТВЕРЖДЕНО ОТСУТСТВИЕ: отдельного шейдера «дыма туннеля» нет, дым туннеля это и есть fragmentShader цилиндра SF. Дополнительно идут smoketrail (EF), plasma (MF), ceilingsmoke (TF), groundsmoke (IF).


## ЧАСТИЦЫ

### Класс всей системы: wF (scene.containerparticles). Количество точек, размер куба, параметры флюид-симуляции. ВАЖНАЯ ПОПРАВКА: два переданных параметра флюида молча игнорируются

**Числа.** this.cubeSize=.65; this.particles=150*1e3=150000; fluidSim: borders:!1, simRes:128, dyeRes:128, curlStrength:0, splatRadius:.22, splatForce:35, pressureIterations:2, densityDissipation:.88, velocityDissipation:.98, pressureDissipation:.86, splatRadiusVelocity:!1, renderEvent:!1; сразу fluidSim.disable(); currentLink=0; vdbScales=Be.links.map(t=>t.scale)=[1.2,1.3,1.25]. ПОПРАВКА (строка 14171): конструктор $U читает ключ pressureIteration (ЕДИНСТВЕННОЕ число), а передан pressureIterations — значит 2 НЕ применяется, работает дефолт Us.PRESSURE_ITERATIONS=3. Ключа renderEvent в деструктуризации нет вообще — тоже мёртвый. Реально применяются: simRes 128, dyeRes 128 (дефолт был бы 512), curl 0 (дефолт 10), splatRadius .22 (дефолт .12), splatForce 35 (дефолт 50), splatRadiusVelocity false (дефолт true), borders false.

```glsl
class wF{constructor(e){this.scene=e,this.ready=new Promise(t=>{this.isReady=t}),this.cubeSize=.65,this.particles=150*1e3,this.fluidSim=new $U({borders:!1,simRes:128,dyeRes:128,curlStrength:0,splatRadius:.22,splatForce:35,pressureIterations:2,densityDissipation:.88,velocityDissipation:.98,pressureDissipation:.86,splatRadiusVelocity:!1,renderEvent:!1}),this.fluidSim.disable(),this.currentLink=0,this.vdbs=[],this.vdbScales=Be.links.map(t=>t.scale),this.soundControl=new _F(this),this.init()}

// строка 14171 — почему 2 итерации давления не работают:
const Us={SIMULATION_RESOLUTION:128,DYE_RESOLUTION:512,DENSITY_DISSIPATION:.97,VELOCITY_DISSIPATION:.98,PRESSURE_DISSIPATION:.8,PRESSURE_ITERATIONS:3,CURL_STRENGTH:10,SPLAT_RADIUS:.12,SPLAT_RADIUS_VELOCITY:!0,SPLAT_FORCE:50,BORDERS:!1};
class $U{constructor({simRes:e=Us.SIMULATION_RESOLUTION,dyeRes:t=Us.DYE_RESOLUTION,pressureIteration:s=Us.PRESSURE_ITERATIONS,densityDissipation:n=Us.DENSITY_DISSIPATION,velocityDissipation:r=Us.VELOCITY_DISSIPATION,pressureDissipation:a=Us.PRESSURE_DISSIPATION,curlStrength:o=Us.CURL_STRENGTH,splatRadius:l=Us.SPLAT_RADIUS,splatRadiusVelocity:c=Us.SPLAT_RADIUS_VELOCITY,splatForce:h=Us.SPLAT_FORCE,splatMode:d="line",borders:u=Us.BORDERS,mode:f="screen",fingers:p=he.fingers}={}){...}
```

**Что делать у нас.** GPGPU-система на 150000 точек (geometry:"points", не инстансы), куб 0.65, рядом 2D-флюид 128x128 без завихрений (curlStrength 0) как источник экранной скорости. Итераций давления ставить 3, а не 2 — на сайте фактически работает 3.

Строка бандла: 18772

### Откуда берутся места точек: не VDB в рантайме, а 3D-текстура KTX2 (Data3DTexture) со знаковым расстоянием и градиентом. Три файла — по одному на соцсеть-ссылку. Фильтры ставит загрузчик по слову "data" в режиме

**Числа.** Конфиг (14444): peachesbody_64 scale 1.2 / x_64 scale 1.3 / medium_32 scale 1.25. Путь: `${absolutePath}/assets/images/volumes/<name>.ktx2`, режим "3d-data". Загрузчик (13396,13400): режим содержит "3d" -> new DA (Data3DTexture); содержит "data" -> magFilter=_t=1006 LinearFilter, minFilter=_t=1006, generateMipmaps=false. Сам класс DA (714): wrapR=zs=1001 ClampToEdge, flipY=false, unpackAlignment=1. Расшифровка каналов в компьют-шейдере (18963-18967).

```glsl
// 14444 — конфиг
links:[{title:"LinkedIn",url:"https://www.linkedin.com/company/igloo-incorporated",vdb:"peachesbody_64",scale:1.2},{title:"X / Twitter",url:"https://www.twitter.com/iglooinc",vdb:"x_64",scale:1.3},{title:"Medium",url:"https://medium.com/@iglooinc",vdb:"medium_32",scale:1.25}],volume:1,muted:!0

// 18772-18776 — загрузка
const e=await le.load(`volumes/${Be.links[0].vdb}.ktx2`,"3d-data");this.vdbs.push(e);
for(let l=1;l<Be.links.length;l++)this.vdbs.push(le.load(`volumes/${Be.links[l].vdb}.ktx2`,"3d-data"));

// 13396 — выбор класса текстуры по режиму
s.startsWith("ktx2")?(r=Di.KTX2,n.includes("3d")||n.includes("lut")?a=new DA:n.includes("cubemap")?a=new Vy:a=new bc):...

// 13400 — фильтры
n.includes("data")?(a.magFilter=_t,a.minFilter=_t):n.includes("nearest")&&(a.magFilter=gt,a.minFilter=gt),
(n.includes("nearest")||n.includes("data")||n.includes("nomipmaps"))&&(a.generateMipmaps=!1)

// 714 — класс Data3DTexture
class DA extends Rt{constructor(e=null,t=1,s=1,n=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:s,depth:n},this.magFilter=gt,this.minFilter=gt,this.wrapR=zs,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1

// 18963-18967 — расшифровка каналов
vec3 samplePos = rotMatrix * (currentPos.xyz / uCubeSize) * uVolumeScale + 0.5;
vec4 volData = texture(tVolume, samplePos);
vec3 grad = normalize(volData.rgb * 2.0 - 1.0) * rotMatrix;
float dist = (volData.a * 2.0 - 1.0) * 2.0;
```

**Что делать у нас.** Запечь фигуру в 3D-текстуру 64^3 RGBA: RGB = градиент SDF, упакованный как g*0.5+0.5; A = знаковое расстояние, упакованное как d/2*0.5+0.5 (в шейдере распаковка обратная — это вывод из кода, не подпись в бандле). Грузить как THREE.Data3DTexture с LinearFilter, wrapR ClampToEdge, generateMipmaps=false, flipY=false. Один файл = одна фигура, переключение = смена tVolume.

Строка бандла: 14444

### Размер FBO-текстур GPGPU и раскладка частиц по текселям (ie.getTextureSizeParticles) плюс сборка геометрии n3

**Числа.** getTextureSizeParticles(i=4,e=1)=Math.max(Math.ceil(Math.sqrt(i*e)/4)*4,4). Для 150000: sqrt=387.2983, /4=96.8246, ceil=97, *4=388. Текстура 388x388=150544 текселя. o=1/a*.5=1/388*0.5; texuv[c]=(c%388/388+o, floor(c/388)/388+o). rand = vec4 из четырёх Math.random().

```glsl
// 13304
getTextureSizeParticles(i=4,e=1){return Math.max(Math.ceil(Math.sqrt(i*e)/4)*4,4)}

// 14397
function n3(i,e){const t=i==="points";let s=null;if(t)s=new ot,s.setAttribute("position",new We(new Float32Array(e*3),3));else{const c=i.clone();s=new Td,s.instanceCount=e,c.index&&s.setIndex(c.index);for(const h in c.attributes)s.setAttribute(h,c.attributes[h])}const n=[],r=[],a=ie.getTextureSizeParticles(e),o=1/a*.5;for(let c=0;c<e;c++){n.push(Math.random(),Math.random(),Math.random(),Math.random());const h=c%a/a+o,d=Math.floor(c/a)/a+o;r.push(h,d)}const l=t?We:gr;return s.setAttribute("rand",new l(new Float32Array(n),4)),s.setAttribute("texuv",new l(new Float32Array(r),2)),s}
```

**Что делать у нас.** BufferGeometry с пустым position (Float32Array(150000*3)), атрибутом rand (vec4 случайных 0..1) и texuv (vec2 центра текселя). Размер FBO считать той же формулой, иначе texuv не попадёт в центры.

Строка бандла: 13304

### Пинг-понг FBO-солвер (класс r3, фабрика gE). Два render target'а с MRT на 2 текстуры (позиция + скорость). НОМЕР СТРОКИ ИСПРАВЛЕН: было 14437, реально 14397

**Числа.** count=s.textures||1 -> 2; wrapS=wrapT=zs=1001 ClampToEdge; minFilter=magFilter=gt=1003 NearestFilter; format=wt=1023 RGBAFormat; type=Lt=1015 FloatType если capabilities.floatRenderTarget, иначе Mi=1016 HalfFloatType; depthBuffer:!1; rtCurrent=(rtCurrent+1)%2; при compute() setClearColor(s3=Color("#000000"),0) + clear(!0,!1,!1); autoCompute!==false -> onBeforeRender=compute; frustumCulled=!1. Стартовые текстуры заливаются в ОБА RT одноразовым fullscreen-квадом (initialTextures).

```glsl
function r3(i){const e=i==="points"?Fn:OA;return class extends e{constructor(t={},s={}){super(t.geometry,t.material,t.count),this.isParticlesGPU=!0,this.name="GPU Particles",this.particlesCount=t.count,this.frustumCulled=!1;const n=Je.webgl.capabilities.floatRenderTarget?Lt:Mi,r=ie.getTextureSizeParticles(this.particlesCount);if(this.rt1=new vt(r,r,{count:s.textures||1,wrapS:zs,wrapT:zs,minFilter:gt,magFilter:gt,format:wt,type:n,depthBuffer:!1}),this.rt2=this.rt1.clone(),this.rtCurrent=0,this.fsQuad=new uE(null),...

compute(t=Je.webgl,s,n){const r=this.computationMaterial.uniforms.uModelMatrix,a=this.computationMaterial.uniforms.uViewMatrix,o=this.computationMaterial.uniforms.uProjMatrix;r&&r.value.copy(this.matrixWorld),a&&a.value.copy(n.matrixWorldInverse),o&&o.value.copy(n.projectionMatrix);const l=this.rtCurrent===0?this.rt1:this.rt2,c=this.rtCurrent===0?this.rt2:this.rt1;this.rtCurrent=(this.rtCurrent+1)%2;for(let f=0;f<c.textures.length;f++){const p=this.computationMaterial.uniforms[`tTexture${f+1}`];p&&(p.value=c.textures[f])}const h=t.autoClear;t.autoClear=!1;const d=t.getRenderTarget();t.setRenderTarget(l),t.getClearColor(Lx);const u=t.getClearAlpha();t.setClearColor(s3,0),t.clear(!0,!1,!1),this.fsQuad.render(t),t.autoClear=h,t.setRenderTarget(d),t.setClearColor(Lx,u);for(let f=0;f<l.textures.length;f++){const p=this.material.uniforms[`tTexture${f+1}`];p&&(p.value=l.textures[f]);const A=this.material.uniforms[`tTexture${f+1}Prev`];A&&(A.value=c.textures[f])}this.afterCompute&&this.afterCompute(t,s,n)}

function gE(i={},e={}){const t=i.geometry,s=i.material,n=i.count||1024,r=n3(t,n),a=r3(t);return new a({geometry:r,material:s,count:n},e)}
```

**Что делать у нас.** WebGLRenderTarget(388,388,{count:2,...}) и его clone(); каждый кадр рендерить fullscreen-quad с compute-материалом в свободный RT, читая из второго; после рендера подставлять tTexture1/tTexture2 в материал точек. Матрицы model/view/proj закидывать в compute-материал ДО рендера.

Строка бандла: 14397

### Инициализация начальных данных: стартовые позиции равномерно случайные внутри куба 0.65, четвёртый канал = random; вторая текстура (скорость) — нули; третья (tOrig) — копия стартовых позиций

**Числа.** s[l*4+0..2]=ie.fit(Math.random(),0,1,-.325,.325) (это -cubeSize*.5..+cubeSize*.5); s[l*4+3]=Math.random(). DataTexture Hi(data, 388, 388, wt=1023 RGBAFormat, Lt=1015 FloatType). uLightPos = new b(-.75,1,-.1).

```glsl
const t=ie.getTextureSizeParticles(this.particles),s=new Float32Array(t*t*4);
for(let l=0;l<this.particles;l++)s[l*4+0]=ie.fit(Math.random(),0,1,-this.cubeSize*.5,this.cubeSize*.5),s[l*4+1]=ie.fit(Math.random(),0,1,-this.cubeSize*.5,this.cubeSize*.5),s[l*4+2]=ie.fit(Math.random(),0,1,-this.cubeSize*.5,this.cubeSize*.5),s[l*4+3]=Math.random();
const n=new Hi(s,t,t,wt,Lt);n.needsUpdate=!0;
const r=new Hi(new Float32Array(t*t*4),t,t,wt,Lt);r.needsUpdate=!0;
const a=new Hi(s.slice(),t,t,wt,Lt);a.needsUpdate=!0;
const o=new b(-.75,1,-.1);
```

**Что делать у нас.** Три DataTexture Float32 388x388 RGBA: позиции (случай в кубе ±0.325 плюс random в .w), нулевые скорости, копия позиций как tOrig (к ней частицы всегда притягиваются).

Строка бандла: 18776

### Все uniform-ы РЕНДЕР-материала частиц с точными значениями и цветами в hex, плюс UBO-блок Global

**Числа.** tTexture1:null, tTexture2:null, uColorInitial:#b5d5ff, uColorLight:#bdc6d4, uColorDark:#222b42, uColorFast:#d7ebfa, uSize:10, uLightPos:Vector3(-.75,1,-.1), uVisible:0, uAlpha:1, uInitialGlow:0. UBO Global (чанк ae, строка 13252): vec2 resolution; vec2 resolutionUI; float aspect; float time; float dtRatio. Значения UBO (13433/13468): resolution = размер холста в CSS-пикселях, УМНОЖЕННЫЙ на DPR и округлённый вниз (физические пиксели); resolutionUI = CSS-пиксели; aspect = resolution.x/resolution.y.

```glsl
material:new fe({uniformsGroups:[he.UBO],uniforms:{tTexture1:{value:null},tTexture2:{value:null},uColorInitial:{value:new Z("#b5d5ff")},uColorLight:{value:new Z("#bdc6d4")},uColorDark:{value:new Z("#222b42")},uColorFast:{value:new Z("#d7ebfa")},uSize:{value:10},uLightPos:{value:o},uVisible:{value:0},uAlpha:{value:1},uInitialGlow:{value:0}}

// 13252 — сам чанк
ae="uniform Global{vec2 resolution;vec2 resolutionUI;float aspect;float time;float dtRatio;};"

// 13433 — дефолты UBO
resolution:{value:new H(2,2),global:!0},resolutionUI:{value:new H(2,2),global:!0},aspect:{value:1,global:!0},time:{value:0,global:!0},dtRatio:{value:1,global:!0}

// 13468 — как заполняется при ресайзе
_i.resolution.value.set(i,e).multiplyScalar(this.currentDPR).floor(),_i.aspect.value=_i.resolution.value.x/_i.resolution.value.y,_i.resolutionUI.value.set(i,e)
```

**Что делать у нас.** Скопировать значения один в один. resolution — ФИЗИЧЕСКИЕ пиксели (css * devicePixelRatio), это важно: размер точки на ретине вдвое больше. time — секунды, dtRatio = min(5, deltaMs/(1000/60)).

Строка бандла: 18776

### ВЕРШИННЫЙ ШЕЙДЕР частиц целиком и формула gl_PointSize. НОМЕР СТРОКИ ИСПРАВЛЕН: было 18800, реально 18777-18823

**Числа.** gl_PointSize = size / length(vPos.xyz) * (resolution.y / 1300.0), size = uSize = 10. Та же формула ещё в трёх местах бандла: 15939, 17300, 19164.

```glsl
${ae}

attribute vec4 rand;
attribute vec2 texuv;
uniform sampler2D tTexture1;
uniform sampler2D tTexture2;

uniform float uSize;

varying float vShadow;
varying float vVel;
varying float vY;

void main() {
    vec4 posData = texture2D(tTexture1, texuv);
    vec4 velData = texture2D(tTexture2, texuv);

    vec3 pos = posData.xyz;
    vec4 vPos = modelViewMatrix * vec4(pos, 1.0);
    float size = uSize;

    vShadow = posData.w;
    vVel = velData.w;
    vY = posData.y;

    gl_Position = projectionMatrix * vPos;
    gl_PointSize = size / length(vPos.xyz) * (resolution.y / 1300.0);
}
```

**Что делать у нас.** Дословно. Размер точки обратно пропорционален расстоянию до камеры (ручная перспективная коррекция) и линейно масштабируется по высоте окна в физических пикселях, опорная высота 1300. Атрибут rand в вершинном шейдере точек объявлен, но не используется. vY тоже объявлен и во фрагменте не читается.

Строка бандла: 18777

### ФРАГМЕНТНЫЙ ШЕЙДЕР частиц целиком. НОМЕР СТРОКИ ИСПРАВЛЕН: было 18870, реально 18831-18908

**Числа.** alpha = step(length(gl_PointCoord.xy-0.5),0.5)*uVisible; discard при alpha<0.001; хайлайт скорости pow(fit(vVel,0.003,0.005,0.0,1.0),2.0); блюр alpha *= max(uInitialGlow, pow(fit(vVel,0.002,0.007,1.0,0.0),2.0)*0.5+0.5); rotateY(3.1416); fadeInColor через linearstep(0.0,1.0,uAlpha).

```glsl
// подключённые чанки: ${Zo} ${Ht} ${yd} ${AF}
// Ht (14444): float efit(float x,float a1,float a2,float b1,float b2){return b1+((x-a1)*(b2-b1))/(a2-a1);}
//             float fit(float x,float a1,float a2,float b1,float b2){return clamp(efit(x,a1,a2,b1,b2),min(b1,b2),max(b1,b2));}
// yd (17718): mat3 rotateY(float angle){float c=cos(angle);float s=sin(angle);return mat3(c,0.0,-s,0.0,1.0,0.0,s,0.0,c);}
// AF (18541): float linearstep(float begin,float end,float t){return clamp((t-begin)/(end-begin),0.0,1.0);}
// Zo (15630): aastep — подключён, но в этом шейдере НЕ вызывается

uniform vec3 uColorLight;
uniform vec3 uColorDark;
uniform vec3 uColorInitial;
uniform vec3 uColorFast;
uniform vec3 uLightPos;
uniform float uVisible;
uniform float uAlpha;
uniform float uInitialGlow;
varying float vShadow;
varying float vVel;
varying float vY;

void main() {
    float alpha = step(length(gl_PointCoord.xy - 0.5), 0.5) * uVisible;
    if (alpha < 0.001) discard;

    // calculate normal
    vec2 uv = 2.0 * gl_PointCoord.xy - 1.0;
    vec3 n = vec3(uv, sqrt(1.0 - clamp(dot(uv, uv), 0.0, 1.0)));
    n.y = 1.0 - n.y;

    // calculate light direction
    float lightShadow = max(0.0, dot(normalize(rotateY(3.1416) * uLightPos), normalize(n)));
    float ramp = lightShadow * vShadow;

    // base color
    vec3 color = mix(uColorDark, uColorLight, ramp);

    // highlight color for velocity
    color = mix(color, uColorFast, pow(fit(vVel, 0.003, 0.005, 0.0, 1.0), 2.0));

    // poor's man motion blur
    alpha *= max(uInitialGlow, pow(fit(vVel, 0.002, 0.007, 1.0, 0.0), 2.0) * 0.5 + 0.5);

    // we do a blending trick here. the initial hidden state requires: alpha 0, uInitialGlow 1 and color white
    // alpha must be animated first and the color used will be
    vec3 fadeInColor = mix(vec3(1.0), uColorInitial, linearstep(0.0, 1.0, uAlpha));
    color = mix(color, fadeInColor, uInitialGlow);

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha * uAlpha);
}
```

**Что делать у нас.** Точка — жёсткий круг через step (края не сглажены), нормаль сферы фейкается из gl_PointCoord, свет — один вектор uLightPos, повёрнутый на 180 градусов по Y. Быстрые частицы белеют (uColorFast) и одновременно становятся полупрозрачнее. Обязательны чанки fit() и rotateY().

Строка бандла: 18831

### Режим смешивания, depthTest и depthWrite материала частиц — ключ ко всему свечению

**Числа.** depthTest:!0, depthWrite:!0, transparent:!0, blending:cy=5 CustomBlending, blendEquation:ar=100 AddEquation, blendDst:hy=202 SrcColorFactor, blendSrc:Ou=204 SrcAlphaFactor. Итог: result = src*srcAlpha + dst*srcColor. blendSrcAlpha/blendDstAlpha у этого материала НЕ заданы (в бандле эти имена встречаются только внутри самого three.js).

```glsl
`,depthTest:!0,depthWrite:!0,transparent:!0,blending:cy,blendEquation:ar,blendDst:hy,blendSrc:Ou})

// константы three.js, строка 8 бандла:
// qt=0,_o=1,pt=2 AdditiveBlending,Ng=3,Og=4,cy=5 CustomBlending
// ar=100 AddEquation
// HE=200 Zero, VE=201 One, hy=202 SrcColor, WE=203 OneMinusSrcColor, Ou=204 SrcAlpha, Bp=205 OneMinusSrcAlpha
// Ar=1e3,zs=1001,Do=1002,gt=1003 Nearest,_t=1006 Linear, Lt=1015 Float, Mi=1016 HalfFloat, wt=1023 RGBA
```

**Что делать у нас.** material.blending=THREE.CustomBlending; blendEquation=AddEquation; blendSrc=SrcAlphaFactor; blendDst=SrcColorFactor; depthTest=true; depthWrite=true; transparent=true. Нестандартный dst=SrcColor даёт «фон умножается на цвет частицы плюс сама частица»: тёмные частицы затемняют фон, светлые светятся аддитивно. Обычный AdditiveBlending это не повторит.

Строка бандла: 18909

### Все uniform-ы COMPUTE-материала (солвера) с точными значениями

**Числа.** tTexture1:null, tTexture2:null, tOrig:<копия стартовых позиций>, tVel: fluidSim.velUniform (передаётся сам объект uniform, общая ссылка), uViewMatrix/uModelMatrix/uProjMatrix: new Matrix4, uRotation:0, uCubeSize:0.65, tVolume: vdbs[currentLink], uVolumeScale: vdbScales[0] (жёстко индекс 0, а не currentLink), uLightPos: Vector3(-.75,1,-.1), uInteractForce:1, uAdditionalNoise:0, uShowNoise:0. MRT: {textures:2, initialTextures:[позиции, нули]}.

```glsl
{textures:2,initialTextures:[n,r],material:new fe({uniformsGroups:[he.UBO],uniforms:{tTexture1:{value:null},tTexture2:{value:null},tOrig:{value:a},tVel:this.fluidSim.velUniform,uViewMatrix:{value:new De},uModelMatrix:{value:new De},uProjMatrix:{value:new De},uRotation:{value:0},uCubeSize:{value:this.cubeSize},tVolume:{value:this.vdbs[this.currentLink]},uVolumeScale:{value:this.vdbScales[0]},uLightPos:{value:o},uInteractForce:{value:1},uAdditionalNoise:{value:0},uShowNoise:{value:0}}

// 14171 — что такое velUniform внутри флюида
this.velUniform={value:null}   // в конструкторе
this.velUniform.value=this._velocity.read.texture   // каждый кадр в _update
```

**Что делать у нас.** tVel передаётся не значением, а самим объектом uniform из флюид-симуляции (this.fluidSim.velUniform), поэтому подмена текстуры скорости происходит автоматически каждый кадр.

Строка бандла: 18909

### ВЕРШИННЫЙ ШЕЙДЕР солвера (fullscreen quad)

**Числа.** gl_Position = vec4(position, 1.0) — без матриц

```glsl
attribute vec4 rand;
varying vec4 vRand;
void main() {
    vRand = rand;
    gl_Position = vec4(position, 1.0);
}
```

**Что делать у нас.** Fullscreen-квад/триангл. Атрибут rand берётся из геометрии квада, а не из геометрии точек, поэтому per-particle соответствия здесь нет — фактически это просто дополнительный шум на фрагмент. В своём движке проще заменить на хеш по gl_FragCoord.

Строка бандла: 18910

### ФРАГМЕНТНЫЙ ШЕЙДЕР СОЛВЕРА (GPGPU) целиком — MRT на две цели: outPos (location 0) и outVel (location 1). НОМЕР СТРОКИ УТОЧНЁН: 18918-19031

**Числа.** pushForce=0.0005; invFluidStrength=1.0-length(vel)*0.65*uInteractForce; force1=0.0002*(0.7+0.3*vRand.z)+0.0004*additionalNoise; шум по позиции *7.0, время *(1.0+0.7*vRand.y); притяжение к tOrig *0.001; force2=0.0015*(0.7+0.3*vRand.w); signForce=mix(0.0,-0.3,sign(dist)+1.0); трение frictionFPS(0.9,dtRatio); клампы y in [-0.34,0.35], радиус xz <= 0.275; wrap=0.25; bounce +max(0,-dp)*0.1; targetShadow=mix(wrapDiffuse*0.2,wrapDiffuse,smoothstep(-0.05,-0.001,dist)); currentVel.a=lerpFPS(currentVel.a,length(currentVel.xyz),0.035,dtRatio). Мёртвый код: float positionLimit объявлен и не используется, vec3 toOrig объявлен и не используется, строка с lerpFPS для currentPos.a закомментирована.

```glsl
varying vec4 vRand;
#define outPos pc_fragColor
uniform sampler2D tTexture1;
layout(location = 1) out highp vec4 outVel;
uniform sampler2D tTexture2;
uniform sampler2D tOrig;
uniform sampler2D tVel;
uniform mat4 uProjMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform float uCubeSize;
uniform vec3 uLightPos;
uniform float uRotation;
uniform float uAdditionalNoise;
uniform float uShowNoise;
uniform float uInteractForce;
#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp sampler3D;
#else
    precision mediump sampler3D;
#endif
uniform sampler3D tVolume;
uniform float uVolumeScale;
${ae} ${pF} ${mF} ${yd}
// pF (18541): float lerpCoefFPS(float t,float dt){return 1.0-exp2(log2(1.0-t)*dt);}
//             float frictionFPS(float t,float dt){return exp2(log2(t)*dt);}
//             float lerpFPS(float x,float y,float t,float dt){return mix(x,y,lerpCoefFPS(t,dt));}
void main() {
    ivec2 uv = ivec2(gl_FragCoord.xy);
    vec4 currentPos = texelFetch(tTexture1, uv, 0);
    vec4 currentVel = texelFetch(tTexture2, uv, 0);
    float positionLimit = uCubeSize * 0.5;
    mat3 rotMatrix = rotateY(uRotation);
    vec3 samplePos = rotMatrix * (currentPos.xyz / uCubeSize) * uVolumeScale + 0.5;
    vec4 volData = texture(tVolume, samplePos);
    vec3 grad = normalize(volData.rgb * 2.0 - 1.0) * rotMatrix;
    float dist = (volData.a * 2.0 - 1.0) * 2.0;
    float pushForce = 0.0005;
    vec4 wPos = uModelMatrix * vec4(currentPos.xyz, 1.0);
    vec4 vPos = uViewMatrix * wPos;
    vec4 posProjected = uProjMatrix * vPos;
    vec2 uvScreen = (posProjected.xy / posProjected.w + 1.0) * 0.5;
    vec3 vel = texture2D(tVel, uvScreen).xyz;
    vec3 up = vec3(uViewMatrix[0][1], uViewMatrix[1][1], uViewMatrix[2][1]);
    vec3 right = vec3(uViewMatrix[0][0], uViewMatrix[1][0], uViewMatrix[2][0]);
    vec3 disp = right * vel.x + up * vel.y;
    currentVel.xyz += disp * pushForce * dtRatio * uInteractForce;
    float invFluidStrength = 1.0 - length(vel) * 0.65 * uInteractForce;
    float additionalNoise = max(uAdditionalNoise, uShowNoise);
    float force1 = 0.0002 * (0.7 + 0.3 * vRand.z) + 0.0004 * additionalNoise;
    currentVel.xyz += BitangentNoise4D(vec4((currentPos.xyz) * 7.0, time * (1.0 + 0.7 * vRand.y))) * force1 * dtRatio;
    vec4 origPos = texelFetch(tOrig, uv, 0);
    vec3 toOrig = origPos.xyz - currentPos.xyz;
    currentVel.xyz += (origPos.xyz - currentPos.xyz) * 0.001 * dtRatio * invFluidStrength;
    float force2 = 0.0015 * (0.7 + 0.3 * vRand.w);
    float signForce = mix(0.0, -0.3, sign(dist) + 1.0);
    currentVel.xyz += grad * force2 * signForce * d
```

**Что делать у нас.** Копировать дословно. Нужен WebGL2 плюс MRT (два out). Обязательные чанки: BitangentNoise4D, frictionFPS/lerpFPS, rotateY. Ключевой трюк: сила вдоль градиента SDF включается только снаружи фигуры (signForce=-0.3 при dist>0, 0 при dist<0), плюс постоянное притяжение к своей исходной случайной точке — за счёт этого фигура дышит.

Строка бандла: 18918

### Чанк mF — процедурный шум BitangentNoise4D (PCG-хеш, симплекс 4D, cross двух градиентов). Единственный источник турбулентности. НОМЕР СТРОКИ ИСПРАВЛЕН: было 19033, реально 18541

**Числа.** F4=0.309016994374947451; C=vec4(0.138196601125011,0.276393202250021,0.414589803375032,-0.447213595499958); PCG 1664525u/1013904223u; сдвиг i+32768.5; порог m0=clamp(0.6-..); множитель -6.0; выход *81.0. В том же чанке лежит неиспользуемая 3D-версия BitangentNoise3D с порогом 0.5, множителем -8.0 и выходом *3918.76. Вызов в бандле ровно один — строка 18988.

```glsl
uvec2 _pcg4d16(uvec4 p){uvec4 v=p*1664525u+1013904223u;v.x+=v.y*v.w;v.y+=v.z*v.x;v.z+=v.x*v.y;v.w+=v.y*v.z;v.x+=v.y*v.w;v.y+=v.z*v.x;return v.xy;}
vec4 _gradient4d(uint hash){vec4 g=vec4(uvec4(hash)&uvec4(0x80000,0x40000,0x20000,0x10000));return g*(1.0/vec4(0x40000,0x20000,0x10000,0x8000))-1.0;}
vec3 BitangentNoise4D(vec4 p){const vec4 F4=vec4(0.309016994374947451);const vec4 C=vec4(0.138196601125011,0.276393202250021,0.414589803375032,-0.447213595499958);vec4 i=floor(p+dot(p,F4));vec4 x0=p-i+dot(i,C.xxxx);vec4 i0;vec3 isX=step(x0.yzw,x0.xxx);vec3 isYZ=step(x0.zww,x0.yyz);i0.x=isX.x+isX.y+isX.z;i0.yzw=1.0-isX;i0.y+=isYZ.x+isYZ.y;i0.zw+=1.0-isYZ.xy;i0.z+=isYZ.z;i0.w+=1.0-isYZ.z;vec4 i3=clamp(i0,0.0,1.0);vec4 i2=clamp(i0-1.0,0.0,1.0);vec4 i1=clamp(i0-2.0,0.0,1.0);vec4 x1=x0-i1+C.xxxx;vec4 x2=x0-i2+C.yyyy;vec4 x3=x0-i3+C.zzzz;vec4 x4=x0+C.wwww;i=i+32768.5;uvec2 hash0=_pcg4d16(uvec4(i));uvec2 hash1=_pcg4d16(uvec4(i+i1));uvec2 hash2=_pcg4d16(uvec4(i+i2));uvec2 hash3=_pcg4d16(uvec4(i+i3));uvec2 hash4=_pcg4d16(uvec4(i+1.0));vec4 p00=_gradient4d(hash0.x);vec4 p01=_gradient4d(hash0.y);vec4 p10=_gradient4d(hash1.x);vec4 p11=_gradient4d(hash1.y);vec4 p20=_gradient4d(hash2.x);vec4 p21=_gradient4d(hash2.y);vec4 p30=_gradient4d(hash3.x);vec4 p31=_gradient4d(hash3.y);vec4 p40=_gradient4d(hash4.x);vec4 p41=_gradient4d(hash4.y);vec3 m0=clamp(0.6-vec3(dot(x0,x0),dot(x1,x1),dot(x2,x2)),0.0,1.0);vec2 m1=clamp(0.6-vec2(dot(x3,x3),dot(x4,x4)),0.0,1.0);vec3 m02=m0*m0;vec3 m03=m02*m0;vec2 m12=m1*m1;vec2 m13=m12*m1;vec3 temp0=m02*vec3(dot(p00,x0),dot(p10,x1),dot(p20,x2));vec2 temp1=m12*vec2(dot(p30,x3),dot(p40,x4));vec4 grad0=-6.0*(temp0.x*x0+temp0.y*x1+temp0.z*x2+temp1.x*x3+temp1.y*x4);grad0+=m03.x*p00+m03.y*p10+m03.z*p20+m13.x*p30+m13.y*p40;temp0=m02*vec3(dot(p01,x0),dot(p11,x1),dot(p21,x2));temp1=m12*vec2(dot(p31,x3),dot(p41,x4));vec4 grad1=-6.0*(temp0.x*x0+temp0.y*x1+temp0.z*x2+temp1.x*x3+temp1.y*x4);grad1+=m03.x*p01+m03.y*p11+m03.z*p21+m13.x*p31+m13.y*p41;return cross(grad0.xyz,grad1.xyz)*81.0;}
```

**Что делать у нас.** Вставить функцию дословно (нужен WebGL2/GLSL ES 3.00 из-за uint). Вызов ровно один: BitangentNoise4D(vec4(pos*7.0, time*(1.0+0.7*rand.y))).

Строка бандла: 18541

### ПОКОЙ: постоянное медленное вращение объёма и предпрогрев формы до показа. АРИФМЕТИКА ИСПРАВЛЕНА

**Числа.** uRotation -= Fe.delta*75e-5 каждый кадр. Fe.delta это dm в МИЛЛИСЕКУНДАХ (стартовое значение 16). При 60 fps 16.667*0.00075 = 0.0125 рад/кадр = 0.75 рад/с (в разборе было 0.012 и 0.72 — округление вниз). Предпрогрев: копится delta, каждый кадр принудительный compute, при e>1e3 (1000 мс) отписка и uVisible=1. dtRatio: DD вычисляется как pg/PD, где pg=60, BD=.2, PD=pg*BD=12, то есть DD=5; ratio = Math.min(5, dm/(1e3/60)).

```glsl
initializeShape(){let e=0;const t=()=>{e+=Fe.delta,this.mesh.compute(void 0,this.scene,this.scene.camera),e>1e3&&(Q.off("webgl_prerender",t),this.mesh.material.uniforms.uVisible.value=1)};Q.on("webgl_prerender",t)}

update(){var e,t;if(this.fluidSim.points[0].position.copy($t.get(0).position01),this.fluidSim._update(Fe.time,Fe.delta),this.mesh.computationMaterial.uniforms.uRotation.value-=Fe.delta*75e-5,!q.devScene){const s=ie.smoothstep(.45,.65,this.scene.progress),n=1-ie.smoothstep(.8,.93,this.scene.progress);this.mesh.computationMaterial.uniforms.uInteractForce.value=s*n,(e=this.soundControl)==null||e.update(s*n)}(t=this.UI)==null||t.update()}

// 13304 — тайминги
pg=60,BD=.2,PD=pg*BD;let DD=pg/PD,um=0,dm=16,_w=0,fm=60,pm=0;
const Fe={get time(){return um},get delta(){return dm},get frame(){return _w},get averageFPS(){return fm},get maxFPS(){return pm},get ratio(){return Math.min(DD,dm/(1e3/pg))}};
```

**Что делать у нас.** В покое фигура живёт за счёт трёх вещей: вращения самой сэмплируемой 3D-текстуры (uRotation), шума force1 и вечного притягивания к tOrig. Меш не крутится вообще. Перед первым показом прогнать ровно 1 секунду симуляции, иначе видно облако вместо фигуры.

Строка бандла: 19033

### ПРОКРУТКА: сила взаимодействия и вся анимация появления по таймлайну GSAP

**Числа.** uInteractForce = smoothstep(0.45,0.65,progress) * (1 - smoothstep(0.8,0.93,progress)). Таймлайн: visible=false@0; visible=true@1.5; uAlpha 0->1 duration 2.5 ease power2.inOut @1.5; uInitialGlow 1->0 duration 1 ease power1.inOut @3.9; uShowNoise 1->0 duration 1.5 ease power1.inOut @3.5. Рядом в том же таймлайне пол: floor.mesh visible=false@0, visible=true@3.4, uAlpha 0->1 duration 5. UI стрелок включается при progress>0.64 и <0.9.

```glsl
this.timeline.set(this.containerparticles.mesh,{visible:!1},0),this.timeline.set(this.containerparticles.mesh,{visible:!0},1.5),this.timeline.fromTo(this.containerparticles.mesh.material.uniforms.uAlpha,{value:0},{value:1,duration:2.5,ease:"power2.inOut"},1.5),this.timeline.fromTo(this.containerparticles.mesh.material.uniforms.uInitialGlow,{value:1},{value:0,duration:1,ease:"power1.inOut"},3.9),this.timeline.fromTo(this.containerparticles.mesh.computationMaterial.uniforms.uShowNoise,{value:1},{value:0,duration:1.5,ease:"power1.inOut"},3.5),this.timeline.set(this.floor.mesh,{visible:!1},0),this.timeline.set(this.floor.mesh,{visible:!0},3.4),this.timeline.fromTo(this.floor.mesh.material.uniforms.uAlpha,{value:0},{value:1,duration:5,ease:...

// 18772 — включение UI по прокрутке (класс yF)
update(){if(this.parent){if(!q.devScene){const e=this.parent.scene.progress;e>.64&&e<.9?this.enable():this.disable()}...}}
```

**Что делать у нас.** Появление: сначала облако белых светящихся точек (uShowNoise=1 разгоняет шум, uInitialGlow=1 красит всё в белый и убирает моушен-блюр), затем шум гаснет (3.5-5.0 с), частицы собираются в фигуру, свечение переходит в нормальный цветовой рамп (3.9-4.9). Прозрачность едет отдельно и раньше (1.5-4.0).

Строка бандла: 19733

### КАСАНИЕ И МЫШЬ: толчок частиц идёт через 2D-флюид, а не через uMouse. НОМЕР СТРОКИ ИСПРАВЛЕН: splat-шейдер было 13524, реально 13578; логика splat — 14171

**Числа.** pushForce=0.0005; invFluidStrength=1-length(vel)*0.65*uInteractForce; splatRadius=0.22, splatForce=35, curlStrength=0, simRes=dyeRes=128. Логика точки (14171): точка обновляется не чаще чем раз в 0.016 с; a.velocity += длина смещения * 2; l = (e - a.lastSplat > .15) — если прошло больше 0.15 с, prevPoint = point и color умножается на 0 (то есть первый мазок после паузы гасится); radius = splatRadius * (splatRadiusVelocity ? velocity : 1), у нас splatRadiusVelocity=false, значит просто 0.22; после splat a.velocity *= .9 и клампится в 1. Курсор: position01 = (x/screenW, 1 - y/screenH).

```glsl
// 13578 — шейдер splat, режим LINE (splatMode по умолчанию "line")
float line(vec2 uv, vec2 point1, vec2 point2) {
    vec2 pa = uv - point1, ba = point2 - point1;
    pa.x *= aspectRatio;
    ba.x *= aspectRatio;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}
float cubicIn(float t) { return t * t * t; }
void main () {
    #ifdef SPLAT_DOT
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / (radius / 50.0)) * color;
    #else
        vec3 splat = cubicIn(clamp(1.0 - line(vUv, prevPoint.xy, point.xy) / radius, 0.0, 1.0)) * color;
    #endif
    vec3 base = texture2D(uTarget, vUv).xyz;
    vec3 result = base + splat;
    if (isDye) result = clamp(result, vec3(0.0), vec3(1.0));
    gl_FragColor = vec4(result, 1.0);
}

// 14171 — что именно триггерит splat
this.points.forEach(a=>{if(e-a.lastUpdate<.016)return;bh.subVectors(a.position,a.prevPosition);const o=bh.length();if(a.velocity+=o*2,o>0){const l=e-a.lastSplat>.15;...this._materialSplat.uniforms.prevPoint.value.copy(l?a.position:a.prevPosition),this._materialSplat.uniforms.color.value.set(bh.x*this._aspect,bh.y,0).multiplyScalar(this._splatForce).multiplyScalar(l?0:1),this._materialSplat.uniforms.radius.value=this._splatRadius*(this._splatRadiusVelocity?a.velocity:1),...a.lastSplat=e}a.lastUpdate=e,a.prevPosition.copy(a.position),a.velocity*=.9,a.velocity=Math.min(1,a.velocity)})

// 19033 — подача курсора
this.fluidSim.points[0].position.copy($t.get(0).position01);
this.fluidSim._update(Fe.time,Fe.delta);
```

**Что делать у нас.** Нужен Navier-Stokes на 128x128 (splat, curl, vorticity, divergence, clear pressure, итерации Якоби, gradient subtract, advection). curlStrength=0, вихрь возникает только из адвектированного поля. Частица проецируется в экран (uProj*uView*uModel), читает вектор скорости в своём экранном UV и получает толчок вдоль right/up камеры. Толчок работает только когда uInteractForce > 0.

Строка бандла: 13578

### КЛИК, СВАЙП, СТРЕЛКИ: смена фигуры (LinkedIn -> X -> Medium) с всплеском шума

**Числа.** uAdditionalNoise 1->0 duration 0.5 ease power2.inOut overwrite:true; uRotation сбрасывается в Math.PI*1.5; floor.additionalTime += 4*(-dir) duration 3 ease power4.out; soundControl.splatTargetVelocity += 1; свайп при |dragged.x|>100 и |swipeVelocity.x|>1e3; клик влево/вправо по знаку position11.x.

```glsl
onClick(e){this.enabled&&this.changeLink(e.position11.x<0?-1:1)}
onTouchEnd(e){this.enabled&&Math.abs(e.dragged.x)>100&&Math.abs(e.swipeVelocity.x)>1e3&&this.changeLink(e.dragged.x<0?-1:1)}
onKeyDown(e){this.enabled&&(e.key==="ArrowRight"?this.changeLink(1):e.key==="ArrowLeft"&&this.changeLink(-1))}
changeLink(e=1){Promise.resolve().then(()=>{var s,n;if(this.preventChangeLink)return;e===-1?this.parent.currentLink=this.parent.currentLink===0?this.parent.vdbs.length-1:this.parent.currentLink-1:this.parent.currentLink=(this.parent.currentLink+1)%this.parent.vdbs.length,re.fromTo(this.parent.mesh.computationMaterial.uniforms.uAdditionalNoise,{value:1},{value:0,duration:.5,ease:"power2.inOut",overwrite:!0}),this.parent.mesh.computationMaterial.uniforms.tVolume.value=this.parent.vdbs[this.parent.currentLink],this.parent.mesh.computationMaterial.uniforms.uVolumeScale.value=this.parent.vdbScales[this.parent.currentLink],this.parent.mesh.computationMaterial.uniforms.uRotation.value=Math.PI*1.5,(s=this.arrows)==null||s.show(e===1?"right":"left",.75),(n=this.bottom)==null||n.show(1,!1,!1),Q.emit("webgl_play_audio","ui-long");const t=this.parent.scene.floor.additionalTime+4*-e;re.to(this.parent.scene.floor,{additionalTime:t,duration:3,ease:"power4.out",overwrite:!0}),this.parent.soundControl.splatTargetVelocity+=1})}
```

**Что делать у нас.** Переключение фигуры: подменить tVolume и uVolumeScale, сбросить uRotation в PI*1.5, на 0.5 с поднять uAdditionalNoise до 1 — фигура взрывается облаком и пересобирается. Тени при этом замораживаются: currentPos.a = mix(targetShadow, currentPos.a, additionalNoise).

Строка бандла: 18772

### НАВЕДЕНИЕ НА ФИГУРУ: невидимый икосаэдр-прокси для raycast, управляет только громкостью звука и всплеском splat-скорости

**Числа.** GA(.27,0) = IcosahedronGeometry(radius 0.27, detail 0), класс GA на строке 12177; позиция (0,-9.785,0); троттлинг 0.015 с; splatTargetVelocity += dist*4, затухание *0.97, клампится в [0,e]; сброс при паузе >0.15 с, при hover или при dist>0.3; splatVelocity = lerp(splatVelocity, target, 0.05); итог scene._particlesVolume = 0.04*e + splatVelocity*0.21 (максимум 0.25 при e=1). Звук: аудио "particles" из particles.ogg, стартовая volume 0, autoPlay, loop (строка 14444).

```glsl
class _F{constructor(e){this.parent=e,this.init()}
init(){const e=new GA(.27,0);this.mesh=new Ce(e,new qy),this.mesh.position.set(0,-9.785,0),this.mesh.updateMatrixWorld(),this.interaction=new Er({camera:this.parent.scene.camera,meshes:[this.mesh],onMove:this.onMouseMove,onHover:this.onMouseHover,ctx:this}),this.splatPosition=new b,this.splatLastPosition=new b,this.splatLastMoveTime=0,this.splatLastRenderTime=0,this.splatTargetVelocity=0,this.splatVelocity=0,this.splatHovered=!1}
onMouseMove(e){const t=e.interactions[0];t&&this.splatPosition.copy(t.point)}
onMouseHover(e){this.splatHovered=!0}
update(e=0){if(e>0?this.interaction.enable():this.interaction.disable(),Fe.time-this.splatLastRenderTime<.015)return;this.splatLastRenderTime=Fe.time;let t=this.splatPosition.distanceTo(this.splatLastPosition);const s=Fe.time-this.splatLastMoveTime;t>0&&(this.splatLastMoveTime=Fe.time),(s>.15||this.splatHovered||t>.3)&&(this.splatLastPosition.copy(this.splatPosition),t=0),this.splatHovered=!1,this.splatTargetVelocity+=t*4,this.splatTargetVelocity*=.97,this.splatTargetVelocity=ie.clamp(this.splatTargetVelocity,0,e),this.splatVelocity=ie.lerp(this.splatVelocity,this.splatTargetVelocity,.05),this.splatVelocity=ie.clamp(this.splatVelocity,0,e),this.splatLastPosition.copy(this.splatPosition),this.parent.scene._particlesVolume=.04*e+this.splatVelocity*.21}}

// 14444
this._controller.addAudio({name:"particles",url:"particles.ogg",volume:0,autoPlay:!0,loop:!0})
```

**Что делать у нас.** Прокси-икосаэдр радиусом 0.27 (сама фигура зажата в цилиндр r=0.275) в центре фигуры, в сцену НЕ добавляется, служит только мишенью raycast. Визуального отклика на наведение нет — только громкость лупа particles.ogg в диапазоне 0.04..0.25 и подкрутка splat-скорости.

Строка бандла: 18772

### СВЕЧЕНИЕ: один глобальный bloom-пасс поверх всей сцены (postprocessing, mipmapBlur), эмиссии в материале нет

**Числа.** addBloom({debug:q.devScene, levels:6, luminanceThreshold:0, intensity:1, radius:0.85}) — именно для подземной сцены; в двух других сценах (16312, 17646) тот же вызов, но luminanceThreshold:.2. Опция mipmapBlur:!0 добавляется внутри addBloom, encodeOutput=false, пасс ставится один раз по флагу __hasBloomPass. Дефолты BloomEffect (n_, строка 12950), которые остаются незаданными: blendFunction SCREEN, luminanceSmoothing .025, kernelSize LARGE, resolutionScale .5, levels 8 (перебит на 6), radius .85 (совпадает с дефолтом). Or (13246) = EffectPass, n_ (12950) = BloomEffect, Fd (13468) = обёртка постпроцессинга на EffectComposer с frameBufferType HalfFloat.

```glsl
// 19733 — подземная сцена
e.__hasBloomPass||(e.__hasBloomPass=!0,e.addPass(new Fd().addBloom({debug:q.devScene,levels:6,luminanceThreshold:0,intensity:1,radius:.85})))

// 13468 — сам addBloom
addBloom(e={}){const t=new Or(ml,new n_({...e,mipmapBlur:!0}));return t.fullscreenMaterial.encodeOutput=!1,this._effectComposer.addPass(t),this}

// 12950 — дефолты BloomEffect
n_=class extends Bc{constructor({blendFunction:i=ct.SCREEN,luminanceThreshold:e=.9,luminanceSmoothing:t=.025,mipmapBlur:s=!1,intensity:n=1,radius:r=.85,levels:a=8,kernelSize:o=fr.LARGE,resolutionScale:l=.5,...}={}){...}
```

**Что делать у нас.** postprocessing (pmndrs) BloomEffect: mipmapBlur true, levels 6, luminanceThreshold 0 (порога нет, светится всё), intensity 1, radius 0.85, blendFunction SCREEN. Свечение самих частиц берётся из скорости: currentVel.a — сглаженная длина скорости, по ней частица красится в uColorFast #d7ebfa и по ней же режется alpha. Никакого emissive нет: в блоке wF (18772-19033) слово emissive не встречается ни разу.

Строка бандла: 19733

### Меш фигуры в сцене: имя, позиция, без renderOrder, без frustum culling

**Числа.** this.mesh.name="volume particles"; position (0,-9.785,0); frustumCulled=false (ставится в r3); renderOrder не задан (остаётся 0); compute вызывается автоматически через onBeforeRender, потому что autoCompute не передан; update регистрируется в scene.beforeRenderCbs.

```glsl
this.mesh.name="volume particles",this.mesh.position.set(0,-9.785,0),this.mesh.updateMatrixWorld(),this.scene.add(this.mesh),this.initializeShape(),this.UI=new yF(this),await this.UI.ready,q.devScene&&this.UI.enable(),this.scene.beforeRenderCbs.push(this.update.bind(this)),this.isReady()
```

**Что делать у нас.** Меш это THREE.Points, координаты фигуры порядка 0.3 юнита (крошечная), стоит на глубине -9.785 в подземелье. Масштаба у меша нет, размер задаётся кубом 0.65 и uSize.

Строка бандла: 19033

### Кнопка-ссылка под фигурой (bottom link): отдельный меш с аддитивным блендингом, при клике открывает URL текущей фигуры

**Числа.** blending:pt=2 AdditiveBlending, depthWrite:!1, depthTest:!1, transparent:!0, renderOrder=999, frustumCulled=!1, visible=!1 при создании; показ uShow 0->1 duration .3*e ease "none"; скрытие 1->0 duration .15 ease power2.out; hover -> show(.75,!0) плюс звук ui-long; размер бокса 220 px (мобила 150, малый экран 180), высота = ширина/3.125; позиция по y = screen.height - meshMarginTop - (mobile?80:20). Глитч-шейдер: steps=3.0, uRand*3.342, scale vec2(0.1,0.15), uRand*12.4242, offset*uRand*4.543, displacement=0.025, мерцание sin(uShow*30.0+uRand*12.4242)*0.15+0.85, a *= step(0.01,uShow). НОМЕР СТРОК ГЛИТЧА УТОЧНЁН: 18732-18761.

```glsl
`,depthWrite:!1,depthTest:!1,transparent:!0,blending:pt})),this.box.name="box",this.box.frustumCulled=!1,this.box.renderOrder=999,this.box.visible=!1,this.parent.parent.scene.add(this.box),this.interaction=new Er({meshes:[this.box],camera:this.parent.parent.scene.camera,hoverCursor:!0,onHover:t=>{t.action==="hover_in"&&(this.show(.75,!0),Q.emit("webgl_play_audio","ui-long"))},onClick:t=>{Q.emit("webgl_ui_particles_clicked"),window.open(Be.links[this.parent.parent.currentLink].url,"_blank").focus()}})
// размеры
const e=this.mobile?150:this.small?180:220,t=e/3.125;

// 18732-18761 — глитч появления
if (uShow < 1.0) {
    // squared displacement
    float steps = 3.0;
    vec2 hash = hash21(floor(uShow * steps) / steps + uRand * 3.342);
    vec2 offset = hash * 2.0 - 1.0;
    vec2 scale = vec2(0.1, 0.15);
    vec2 blocksUV = uv * scale + uRand * 12.4242 + offset * uRand * 4.543;
    float blocks1 = texture2D(tBlocks, blocksUV).g * 2.0 - 1.0;
    float displacement = 0.025;
    uv += vec2(blocks1, 0.0) * displacement;

    // make it blink
    a *= sin(uShow * 30.0 + uRand * 12.4242) * 0.15 + 0.85;
    a *= step(0.01, uShow);
}
```

**Что делать у нас.** Подпись под фигурой рисуется MSDF-текстом с аддитивным блендингом поверх всего (renderOrder 999, depthTest выключен) и появляется глитч-сдвигом по X через шум-блоки, с мерцанием sin(uShow*30)*0.15+0.85.

Строка бандла: 18772

### Соседние системы частиц в той же подземной сцене. НОМЕРА КЛАССОВ УТОЧНЕНЫ: ambient BF на 19603, snow CF на 19096; обе создаются именно в подземной сцене (19733)

**Числа.** ambientparticles (BF, 19603): count 60, shape "box", scale [2.5,.5,2.5], center [0,0,0]; mesh.name="ambientparticles", renderOrder 15, position.y=-9.61, frustumCulled=false, blending pt Additive, transparent; размер mix(7.0,12.0,random.x)*resolution.y*0.002; мерцание sin(time*1.8+random.y*22.43)*0.4+0.6; гашение у центра smoothstep(0.2,0.24,length(pos.xz)) и *1.25; дрейф sin по трём осям с амплитудой 0.75 и t=time*0.1. snowparticles (CF, 19096): count 200, scale [3,8,3], generateRandomBuffer:true; mesh.name="particles" (НЕ snowparticles), renderOrder 1, position.y -= 3.5, matrixAutoUpdate=false, blending pt, depthTest:!1, depthWrite:!1; size 50.0, gl_PointSize = 50.0/length(mvPos.xyz)*(resolution.y/1300.0); падение pos.y -= mix(0.4,0.7,fract(random.x+random.z+random.y))*time; закрутка sin/cos*0.4 плюс rotate(pos.xz, t*0.5); treadmill(pos, vec3(3.0,4.0,3.0)); alpha *= 0.3 плюс четыре смягчения smoothstep и мерцание sin(time+random.x+random.z*13.0)*0.5+0.5; форма снежинки squish = pow(1.0-abs(uv.x-0.5), floor(vRandom.y*3.0+2.0)).

```glsl
// 19612-19635 — ambient (BF)
void main() {
    vUv = uv;
    float t = time * 0.1;
    vec3 pos = position;
    pos.x += sin(t * 0.4 + position.z * 2.5) * 0.75;
    pos.y += sin(t * 0.2 + position.x * 2.5) * 0.75;
    pos.z += sin(t * 0.2 + position.y * 2.5) * 0.75;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    vec2 ndc = gl_Position.xy / gl_Position.w;
    float size = mix(7.0, 12.0, random.x);
    gl_PointSize = size * resolution.y * 0.002;
    vLightFalloff = sin(time * 1.8 + random.y * 22.43) * 0.4 + 0.6;
    vLightFalloff *= smoothstep(0.2, 0.24, length(pos.xz));
    vLightFalloff *= 1.25;
}
// 19636-19657 — фрагмент ambient
void main() {
    vec2 uv = gl_PointCoord.xy;
    uv.y = 1.0 - uv.y;
    float circularGrad = 1.0 - clamp(length(uv - 0.5) * 2.0, 0.0, 1.0);
    circularGrad *= pow(uv.x, 2.0);
    circularGrad = pow(circularGrad, 2.0);
    vec3 color = vec3(1.0);
    float alpha = circularGrad * vLightFalloff;
    alpha *= uAlpha;
    gl_FragColor = vec4(color, alpha);
}
// 19129-19165 — snow (CF), ключевое
pos.y -= mix(0.4, 0.7, fract(random.x + random.z + random.y)) * time;
float angle = t * 0.5 + pos.y;
pos.x += sin(angle) * 0.4;
pos.z += cos(angle) * 0.4;
pos.xz = rotate(pos.xz, t * 0.5);
pos = treadmill(pos, vec3(3.0, 4.0, 3.0));
vAlpha *= sin(time + random.x + random.z * 13.0) * 0.5 + 0.5;
vAlpha *= 0.3;
float size = 50.0;
gl_PointSize = size / length(mvPos.xyz) * (resolution.y / 1300.0);
```

**Что делать у нас.** Вокруг фигуры летают 60 пылинок (простые Points без GPGPU, синусоидальный дрейф) и 200 снежинок с treadmill-зацикливанием. Обе системы белые, AdditiveBlending, без GPGPU. Дешёвые в повторе и дают половину ощущения живого подземелья.

Строка бандла: 19603

**Не найдено или не подтвердилось:**

- ВЫБРОШЕНО ЧИСЛО (не подтвердилось): pressureIterations:2 у флюид-симуляции. Значение в объекте есть, но конструктор $U (строка 14171) читает ключ pressureIteration в единственном числе, поэтому 2 нигде не применяется и работает дефолт Us.PRESSURE_ITERATIONS = 3. То же с renderEvent:!1 — такого ключа в деструктуризации конструктора нет вообще, параметр мёртвый.
- ИСПРАВЛЕНО (было неверно): «Uniform-ов с именами uMouse и uTouch в бандле НЕТ (0 совпадений)». uTouch действительно 0 совпадений, а uMouse встречается 7 раз — это uMousePos на строках 14793, 14802, 14815 (x2), 14838, 15630, 15646, в других системах сцены. В системе volume particles (18772-19033) uMousePos нет ни разу, вывод разбора верен, счётчик был неверен.
- ПОДТВЕРЖДЕНО: рантайм-парсинга VDB нет. Слово vdb встречается 12 раз — это поле Be.links[].vdb и массив this.vdbs. Расширения .vdb как файла в бандле нет, грузятся только volumes/*.ktx2 в режиме "3d-data".
- ПОДТВЕРЖДЕНО: uScroll в системе частиц не используется. 4 совпадения — это uScrollAlpha на строках 14952, 14975, 14982, 14993, другая система. Прокрутка входит через JS: scene.progress -> uInteractForce и через GSAP-таймлайн на uAlpha / uInitialGlow / uShowNoise.
- ПОДТВЕРЖДЕНО: отдельной текстуры кёрл-шума нет, турбулентность полностью процедурная (чанк mF, BitangentNoise4D, строка 18541). Вызов ровно один — строка 18988.
- ПОДТВЕРЖДЕНО: emissive-материала для частиц нет (слово emissive в блоке 18772-19033 не встречается). Bloom один на всю подземную сцену: levels 6, luminanceThreshold 0, intensity 1, radius 0.85. Метод addSelectiveBloom в бандле есть ровно один раз — только определение на строке 13468, вызовов нет нигде.
- ПОДТВЕРЖДЕНО: размер ядра bloom явно не задан, берутся дефолты BloomEffect (строка 12950): kernelSize LARGE, resolutionScale .5, luminanceSmoothing .025, blendFunction SCREEN. Переданы только levels, luminanceThreshold, intensity, radius, debug плюс mipmapBlur:true изнутри addBloom.
- ПОДТВЕРЖДЕНО: blendSrcAlpha и blendDstAlpha у материала частиц не заданы (в материале на строке 18909 их нет; сами имена встречаются в бандле по 7 раз, но только внутри кода three.js).
- ПОДТВЕРЖДЕНО: renderOrder у меша "volume particles" не задан, остаётся 0 (строка 19033 — задаются только name, position, updateMatrixWorld).
- ПОДТВЕРЖДЕНО: точных размеров 3D-текстур в пикселях в коде нет, только из имён файлов peachesbody_64, x_64, medium_32. В коде нигде не фигурируют числа 64 или 32 применительно к объёму.
- ПОДТВЕРЖДЕНО: порога bloom по яркости нет — luminanceThreshold ровно 0 именно для подземной сцены (19733). В двух других сценах бандла (16312 и 17646) тот же вызов идёт с luminanceThreshold .2, так что ноль это осознанная настройка конкретно этой сцены.
- НАЙДЕНО ДОПОЛНИТЕЛЬНО (мёртвый код, чтобы не копировать зря): в компьют-шейдере объявлены и не используются float positionLimit и vec3 toOrig; строка с lerpFPS для currentPos.a закомментирована в исходнике. В вершинном шейдере точек объявлен и не используется attribute vec4 rand, а varying vY передаётся, но во фрагменте не читается. Во фрагмент точек подключён чанк Zo (aastep) и не вызывается. uVolumeScale при инициализации берётся как vdbScales[0] жёстко, хотя tVolume берётся как vdbs[currentLink].


## ТЕКСТ И ЕГО АНИМАЦИЯ

### Как набран текст: MSDF-меш внутри three-сцены, DOM-текста нет. Класс Ui (extends Ce=Mesh), геометрия строится загрузчиком zt.msdf (класс AR) через внешний web-worker

**Числа.** font:"IBMPlexMono-Medium" (в бандле ровно 15 вызовов, других имён шрифта нет). Атрибуты геометрии из воркера: index(1), position(3), uv(2), uvMask(4), textWeights(2), lineWeights(3), centr(3), плюс _maxLineHeight и _maxUVDisp. Воркер: new Worker("/assets/msdfworker-ac346fa7.js") стр.13333. JSON-шрифта грузится как `${e.font}.json`, глифы перекладываются в словарь по String.fromCharCode(c.unicode), placeholderChar = первый по сортировке ключ (стр.13335). Путь: Ag.setPath(`${q.absolutePath}/assets/fonts/`) стр.13382

```glsl
class Ui extends Ce{constructor(e={},t={}){if(!e.font)throw new Error("You must specify a MSDF font.");super(),this._options=e,this.name="Text (MSDF)",this.size=new H,this.ready=new Promise(s=>{this.isReady=s}),this.update().then(()=>{this.material=i3(e.font,t),this.isReady()})}_updateSize(){...this.size.x=Math.abs(this.geometry.boundingBox.min.x)+Math.abs(this.geometry.boundingBox.max.x),this.size.y=Math.abs(...)...}async update(e={}){try{const t=this.geometry;this.geometry=await zt.msdf({...this._options,...e}),this._updateSize(),t.dispose()}catch(t){console.log("Error updating meshText geometry:",t)}}}
// стр.13335 (загрузчик):
n.setAttribute("position",new We(a.position,3)),n.setAttribute("uv",new We(a.uv,2)),n.setAttribute("uvMask",new We(a.uvMask,4)),n.setAttribute("textWeights",new We(a.textWeights,2)),n.setAttribute("lineWeights",new We(a.lineWeights,3)),n.setAttribute("centr",new We(a.centr,3)),n._maxLineHeight=a.maxLineHeight,n._maxUVDisp=a.maxUVDisp
```

**Что делать у нас.** Не troika и не DOM. Сгенерировать MSDF-атлас шрифта, рядом .json с glyphs (по unicode), в воркере собрать BufferGeometry из квадов по глифам и выдать 7 буферов (index/position/uv/uvMask/textWeights/lineWeights/centr) + два скаляра maxLineHeight/maxUVDisp. textWeights.x = нормализованный 0..1 индекс символа по всему блоку. Всё остальное (появление, волна) делается только шейдером по textWeights.x. Размер меша считается из boundingBox: size.x=|min.x|+|max.x|.

Строка бандла: 14397

### Шрифт. Один-единственный на всём сайте: IBM Plex Mono Medium, в сцене как KTX2-дататекстура MSDF-атласа. Цифры (плексус и TEMP) — отдельный атлас на 10 знаков

**Числа.** le.load("../fonts/IBMPlexMono-Medium-datatexture.ktx2","data") — ровно 15 вызовов, стр.: 16140, 16183, 16226, 16269, 16831, 16908, 16980, 18586, 19789, 19828, 19867, 19906, 20039, 20078, 20148. Плюс базовый материал Ui строит путь сам: `${font}-datatexture.ktx2` (стр.14205). Цифры: tNums:{value:le.load("numbers-datatexture.ktx2","data")} — стр.15962 (плексус) и стр.16980-область (TEMP). Шаг по атласу цифр numStep = 1.0/10.0 (стр.16014 и 17094)

```glsl
tMap:{value:le.load("../fonts/IBMPlexMono-Medium-datatexture.ktx2","data")}
// цифры (стр.16014):
float numStep = 1.0 / 10.0;
float num = float(vSide < 0 ? vNums.x : vNums.y);
vec2 uv = vec2(numStep * vUv.x + num * numStep, vUv.y);
float a = msdf(tNums, uv);
```

**Что делать у нас.** Взять IBM Plex Mono Medium, собрать MSDF-атлас, сжать в KTX2 (three KTX2Loader), грузить как data-текстуру. Второй маленький атлас ровно на 10 цифр — отдельно, чтобы бегущие числа не тянули весь шрифт (шаг по нему 1/10, а не 1/8 как у букв).

Строка бандла: 16140

### MSDF-функции (GLSL-чанк ii) — как из атласа берётся альфа и обводка. Лежит одной строкой-константой вместе с остальными чанками

**Числа.** median = max(min(r,g),min(max(r,g),b)) - 0.5; msdf = smoothstep(-d, d, signedDist), d = fwidth(signedDist); в варианте с обводкой d = max(10e-6, fwidth(signedDist)). Рядом в том же файле-строке: msdfOpaque(tMap,uv) = step(0.0, median) и msdfOpaque(tMap,uv,outlineWidth) = step(-outlineWidth,signedDist)*step(signedDist,outlineWidth)

```glsl
ii="float median(sampler2D tMap,vec2 uv){vec3 tex=texture2D(tMap,uv).rgb;return max(min(tex.r,tex.g),min(max(tex.r,tex.g),tex.b))-0.5;}float msdf(sampler2D tMap,vec2 uv){float signedDist=median(tMap,uv);float d=fwidth(signedDist);return smoothstep(-d,d,signedDist);}float msdfOpaque(sampler2D tMap,vec2 uv){return step(0.0,median(tMap,uv));}float msdf(sampler2D tMap,vec2 uv,float outlineWidth){float signedDist=median(tMap,uv);float d=max(10e-6,fwidth(signedDist));return smoothstep(-d-outlineWidth,d-outlineWidth,signedDist)*smoothstep(outlineWidth+d,outlineWidth-d,signedDist);}float msdfOpaque(sampler2D tMap,vec2 uv,float outlineWidth){float signedDist=median(tMap,uv);return step(-outlineWidth,signedDist)*step(signedDist,outlineWidth);}"
```

**Что делать у нас.** Скопировать чанк дословно, подставлять во все текстовые материалы (в бандле он вставляется как ${ii}).

Строка бандла: 13252

### АНИМАЦИЯ ПОЯВЛЕНИЯ — перебор глифов сдвигом UV по атласу. Ядро всего текстового эффекта, одна строка

**Числа.** vUv.x = mod(uv.x + 0.125 * mod(floor((1.0 - tr2) * 5.753), 8.0), 1.0); Шаг 0.125 = 1/8 ширины атласа, обёртка mod 8.0, множитель 5.753 → floor даёт 5,4,3,2,1,0 = ШЕСТЬ состояний глифа. Встречается ровно 13 раз, дословно на стр.: 16157, 16200, 16243, 16286, 16861, 16938, 17025, 18617, 19806, 19845, 19884, 19923, 20056. Плюс вариант для цифр на стр.17098: uv.x = uv.x + numStep * mod(floor((1.0 - vAlpha2) * 5.753), 8.0) — тот же множитель 5.753 и та же обёртка 8.0, но шаг numStep = 1/10

```glsl
attribute vec3 textWeights;
uniform float uShow1;
uniform float uShow2;

varying vec2 vUv;
varying float vAlpha;

void main() {
    float tr1 = falloff(textWeights.x, 0.0, 1.0, 0.1, clamp(uShow1, 0.0, 1.0));
    float tr2 = falloff(textWeights.x, 0.0, 1.0, 1.0, clamp(uShow2, 0.0, 1.0));

    vUv = uv;
    vUv.x = mod(uv.x + 0.125 * mod(floor((1.0 - tr2) * 5.753), 8.0), 1.0);
    vAlpha = tr1;

    gl_Position = projectionMatrix * viewMatrix * billboardModelMatrix() * vec4(position, 1.0);
}
```

**Что делать у нас.** Никакого JS-scramble по массиву символов. Символ подменяется прямо в шейдере: сдвиг U на n/8 атласа, n = floor((1-progress)*5.753) mod 8. В позиции каждого глифа последовательно светятся 6 разных знаков из той же строки атласа, потом встаёт свой. Цена нулевая, один mod. Для цифрового атласа шаг меняется на 1/10, множитель тот же.

Строка бандла: 16157

### Задержка по букве (stagger) — не в JS, а в GLSL через falloff по textWeights.x. Два независимых прохода: tr1 = альфа (узкое окно 0.1), tr2 = перебор глифов (широкое окно 1.0)

**Числа.** tr1 = falloff(textWeights.x, 0.0, 1.0, 0.1, clamp(uShow1,0,1)) — margin 0.1 (стр.16153); tr2 = falloff(textWeights.x, 0.0, 1.0, 1.0, clamp(uShow2,0,1)) — margin 1.0 (стр.16154). Сами функции лежат в чанке Ue на стр.13252: float falloff(float _input,float start,float end,float margin,float progress){float m=margin*sign(end-start);float p=mix(start-m,end,progress);return _linstep(p+m,p,_input);} float falloffsmooth(...) то же через smoothstep; float _linstep(float begin,float end,float t){return clamp((t-begin)/(end-begin),0.0,1.0);}

```glsl
float falloff(float _input,float start,float end,float margin,float progress){float m=margin*sign(end-start);float p=mix(start-m,end,progress);return _linstep(p+m,p,_input);}
float falloffsmooth(float _input,float start,float end,float margin,float progress){float m=margin*sign(end-start);float p=mix(start-m,end,progress);return smoothstep(p+m,p,_input);}
float _linstep(float begin,float end,float t){return clamp((t-begin)/(end-begin),0.0,1.0);}
```

**Что делать у нас.** Волна проявления идёт по textWeights.x (0 у первой буквы, 1 у последней). margin — ширина фронта: 0.1 значит одномоментно проявляется 10% текста (жёсткая кромка), 1.0 значит перебор глифов идёт по всему блоку сразу и рассасывается медленно. Разводя uShow1 и uShow2 по времени, получаем: буквы уже видны, но ещё крутятся.

Строка бандла: 16153

### Длительности появления. Пары твинов GSAP на uShow1/uShow2 — я выписал их все дословно, каждая со своей строкой

**Числа.** Подпись скролла (стр.19828): show(e=.5,t=1) → uShow1 duration .4, uShow2 duration .75, ease "sine.out", delay 1; hide() → uShow1→0 duration .5 "sine.out", uShow2 fromTo{1}→0 duration .4 "sine.out", затем звук "ui-short". Sound/On/Off (стр.19983): show(e=1,t=1) → .4*e и .75*e "sine.out", у on/off delay t+.1. Close (стр.20078): show(e=.5,t=.2) → uShow меша duration e=.5 ease "none", у сообщения uShow1 duration .2 и uShow2 duration .4 "sine.out". Ссылки entry-сцены (стр.18672): show(e="all",t=0,s=1) → uShow1 .4*s, uShow2 .75*s "sine.out"; hide → uShow2→0 duration .15*s ease "none", uAlpha→0 duration .15*s ease "power2.out" с delay t*1.5. Ссылка с иконкой в проекте (стр.20287): uShow иконки 0→1 duration .5*e delay t*1.25 ease "none", uShow1 .4*e, uShow2 .75*e. Заголовки кубов (стр.16903 и 16980): uShow1→1 duration .4 ease "none", uShow2 0→1 duration .75 ease "none", скрытие .2 ease "none"

```glsl
// стр.19828
show(e=.5,t=1){re.fromTo(this.message.material.uniforms.uShow1,{value:0},{delay:t,value:1,duration:.4,ease:"sine.out",overwrite:!0}),re.fromTo(this.message.material.uniforms.uShow2,{value:0},{delay:t,value:1,duration:.75,ease:"sine.out",overwrite:!0})}
hide(){re.to(this.message.material.uniforms.uShow1,{value:0,duration:.5,ease:"sine.out",overwrite:!0,onComplete:()=>{this.message.visible=!1}}),re.to(this.message.material.uniforms.uShow2,{value:1},{value:0,duration:.4,ease:"sine.out",overwrite:!0}),this.message.material.uniforms.uShow1.value>0&&Q.emit("webgl_play_audio","ui-short")}
// стр.18672
hide(e="all",t=0,s=1){this.group.children.forEach((n,r)=>{(e==="all"||e===r)&&(re.to(n.material.uniforms.uShow2,{delay:t,value:0,duration:.15*s,ease:"none",overwrite:!0}),re.to(n.material.uniforms.uAlpha,{delay:t*1.5,value:0,duration:.15*s,overwrite:!0,ease:"power2.out",onComplete:()=>{this.group.visible=!1}}))})}
```

**Что делать у нас.** Две GSAP-переменные на текст: uShow1 (альфа) и uShow2 (перебор глифов), обычно .4 и .75 с, ease sine.out (у заголовков кубов ease none). Скрытие всегда быстрее показа: .15-.5 с, причём гаснет сначала uShow2, а альфа с запаздыванием ×1.5.

Строка бандла: 19828

### Каскад блоков манифеста: разные задержки на первый показ и на повторный, звук через один блок

**Числа.** Порядок: [copyright, rights, title, text]. Первый показ: s = t<2 ? 0.75 + t*0.2 : (t-1)*0.2 → 0.75, 0.95, 0.20, 0.40. Повторный (hasBeenShownOnce): s = t*0.15 → 0, 0.15, 0.30, 0.45. Множитель длительности n = t>0 ? 1.75 : 1 → uShow1 .4*n, uShow2 .75*n, ease "sine.out". Звук "manifesto" в onStart на чётном индексе (t%2===0). update: скрытие при t (переход) или progress<0.15; показ при canBeShown && 0.25 < progress < 0.8

```glsl
show(){this.visible||(this.visible=!0,[this.copyright,this.rights,this.title,this.text].forEach((e,t)=>{let s=0;this.hasBeenShownOnce?s=t*.15:s=t<2?.75+t*.2:(t-1)*.2;const n=t>0?1.75:1;re.fromTo(e.material.uniforms.uShow1,{value:0},{delay:s,value:1,duration:.4*n,ease:"sine.out",overwrite:!0,onStart:()=>{t%2===0&&Q.emit("webgl_play_audio","manifesto")}}),re.fromTo(e.material.uniforms.uShow2,{value:0},{delay:s,value:1,duration:.75*n,ease:"sine.out",overwrite:!0})}),this.hasBeenShownOnce=!0)}
update(e,t){(t||e<.15)&&this.hide(),this.canBeShown&&e>.25&&e<.8&&this.show()}
```

**Что делать у нас.** Задержки в четвертях секунды, длительность у всех кроме первого блока умножена на 1.75. Звук дёргается не на каждый блок, а через один. Диапазон показа по скроллу шире диапазона скрытия — получается гистерезис.

Строка бандла: 16312

### ВОЛНА ОТ ДВИЖЕНИЯ УКАЗАТЕЛЯ — отдельный FBO-симулятор (класс KF, полноэкранный, детальная сцена проекта). Пишет в RGB: R = амплитуда, G = гребень (rim), B = сглаженный гребень

**Числа.** RT создаётся как new vt(2,2,{type:Mi(half-float),depthBuffer:!1}), ping-pong из двух (rts=[t,t.clone()]). Реальный размер в resize(): floor(resolution.x/5) × floor(resolution.y/5), стр.20656. Шаг симуляции не чаще 0.015 с. Адвекция шумом: texture2D(tAdvect, vUv*3.0).xy*2.0-1.0, умножено на 1.0, uv += advect*invResolution. Текстура шума: le.load("cubes/advect.png","colordata-repeat"). wavespeed = 1.0. Распространение: nextVal = max четырёх соседей по R. Затухание nextVal *= 0.985, потолок min(nextVal,1.0). Гребень rim = nextVal - prev.r. Сглаженный: rimLerp = (prev.b + rim) * 0.9. Радиус вброса: radius = 0.05 * smoothstep(0.1, 1.0, uSplatRadius). Вброс по отрезку: splat = cubicIn(clamp(1.0 - line(vUv,prev,cur)/radius, 0.0, 1.0)), cubicIn(t)=t*t*t. Выход vec4(nextVal, rim, rimLerp, 1.0)

```glsl
float line(vec2 uv, vec2 point1, vec2 point2) {
    vec2 pa = uv - point1, ba = point2 - point1;
    pa.x *= aspect;
    ba.x *= aspect;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

float cubicIn(float t) { return t * t * t; }

void main() {
    vec2 uv = vUv;
    vec2 invResolution = 1.0 / vec2(textureSize(tBuffer, 0));

    // advect by noise
    vec2 noiseUv = vUv;
    vec2 advect = (texture2D(tAdvect, noiseUv * 3.0).xy * 2.0 - 1.0) * 1.0;
    uv += advect * invResolution;

    // wave propagation
    float wavespeed = 1.0;
    vec2 offset = invResolution * wavespeed;
    float l = texture2D(tBuffer, uv - vec2(offset.x, 0.0)).r;
    float r = texture2D(tBuffer, uv + vec2(offset.x, 0.0)).r;
    float t = texture2D(tBuffer, uv + vec2(0.0, offset.y)).r;
    float b = texture2D(tBuffer, uv - vec2(0.0, offset.y)).r;
    float nextVal = max(max(max(l, r), t), b);

    // mouse line splat
    float radius = 0.05 * smoothstep(0.1, 1.0, uSplatRadius);
    float splat = cubicIn(clamp(1.0 - line(vUv, uSplatPrevCoords.xy, uSplatCoords.xy) / radius, 0.0, 1.0));
    nextVal += splat;

    // damping and clamp
    nextVal *= 0.985;
    nextVal = min(nextVal, 1.0);

    vec4 prev = texture2D(tBuffer, uv);
    float rim = nextVal - prev.r;

    float rimLerp = prev.b + rim;
    rimLerp *= 0.9;

    gl_FragColor = vec4(nextVal, rim, rimLerp, 1.0);
}
// resize (стр.20656):
resize(){const t=Math.floor(he.uniforms.resolution.value.x/5),s=Math.floor(he.uniforms.resolution.value.y/5);this.rts.forEach(n=>{n.setSize(t,s)})}
```

**Что делать у нас.** Волна это не формула по расстоянию, а честный кадр-в-кадр FBO вчетверо-впятеро меньше экрана. Гребень получаем вычитанием предыдущего кадра. Ширина гребня не задаётся числом, она равна тому, насколько фронт (max-фильтр 1 тексель за шаг) успел уйти за кадр. Затухание 0.985 за шаг → жизнь волны примерно 66 шагов ≈ 1 с при троттлинге 0.015 с. Радиус вброса 0.05 (5% ширины) на полной скорости указателя.

Строка бандла: 20576

### Как скорость указателя превращается в радиус вброса (uSplatRadius). Полноэкранная версия KF

**Числа.** Троттлинг 0.015 с. Сброс отрезка если пауза > 0.15 с, либо splatHovered, либо скачок > 0.3; при сбросе обнуляется ТОЛЬКО splatTargetVelocity (splatVelocity не трогают) и e=0. Дальше splatTargetVelocity += dist*6; *= 0.88; clamp(0,1). splatVelocity = lerp(splatVelocity, ease(splatTargetVelocity,"power4.out"), 0.1). Точка приходит из события "touch_move" как e.position01 (0..1 по экрану). В KF поле splatHovered только читается и нигде не присваивается — то есть ветка hover в полноэкранной версии мёртвая

```glsl
onTouchMove(e){this.splatPosition.set(e.position01.x,e.position01.y)}
update(){if(Fe.time-this.splatLastRenderTime<.015)return;this.splatLastRenderTime=Fe.time;let e=this.splatPosition.distanceTo(this.splatLastPosition);const t=Fe.time-this.splatLastMoveTime;e>0&&(this.splatLastMoveTime=Fe.time),(t>.15||this.splatHovered||e>.3)&&(this.splatLastPosition.copy(this.splatPosition),this.splatTargetVelocity=0,e=0),this.splatTargetVelocity+=e*6,this.splatTargetVelocity*=.88,this.splatTargetVelocity=ie.clamp(this.splatTargetVelocity,0,1),this.splatVelocity=ie.lerp(this.splatVelocity,ie.ease(this.splatTargetVelocity,"power4.out"),.1),this.fsQuad.material.uniforms.uSplatCoords.value.copy(this.splatPosition),this.fsQuad.material.uniforms.uSplatPrevCoords.value.copy(this.splatLastPosition),this.fsQuad.material.uniforms.uSplatRadius.value=this.splatVelocity,this.splatLastPosition.copy(this.splatPosition); ... }
```

**Что делать у нас.** Волна рождается на движении указателя, а не на клике. Быстро ведёшь — радиус к 0.05, стоишь — радиус 0. Пауза 0.15 с рвёт отрезок, чтобы не тянуло хвост через пол-экрана. Обнулять на разрыве достаточно только целевую скорость: текущая доезжает до нуля лерпом сама, и волна не обрывается рывком.

Строка бандла: 20640

### ГЛАВНОЕ: как волна цепляется к тексту. Текст читает FBO в экранных координатах и от гребня а) крутит глифы, б) светится

**Числа.** uvScreen = abs((modelMatrix*vec4(centr,1.0)).xy) / resolutionUI; выборка texture2D(tSim, vec2(uvScreen.x, 1.0 - uvScreen.y)).xy. tr = fit(val.g, 0.01, 1.0, 0.0, 5.0) — гребень (канал G) масштабируется в 0..5 и ПРИБАВЛЯЕТСЯ к аргументу перебора глифов. illum = val.r (амплитуда), объявлен как flat varying. Перебор: vUv.x = mod(uv.x + 0.125 * mod(floor((1.0 - tr2 + tr) * 5.654), 8.0), 1.0) — множитель тут 5.654, а не 5.753 (стр.20112 и её двойник 20183). Свечение: gl_FragColor = vec4(mix(uColor, vec3(0.8), fit(illum, 0.6, 0.8, 0.0, 1.0)), alpha) — цвет свечения ЖЁСТКО vec3(0.8) = #CCCCCC, включается только когда амплитуда в 0.6..0.8 (стр.20146 и 20217). Весь блок под флагом uniform bool uHighlights

```glsl
attribute vec3 textWeights;
attribute vec3 centr;
uniform sampler2D tSim;
uniform bool uHighlights;

varying vec2 vUv;
varying float wPosY;
varying float vAlpha;
flat varying float illum;

void main() {
    float tr1 = falloff(textWeights.x, 0.0, 1.0, 0.1, clamp(uShow1, 0.0, 1.0));
    float tr2 = falloff(textWeights.x, 0.0, 1.0, 1.0, clamp(uShow2, 0.0, 1.0));

    float tr = 0.0;
    illum = 0.0;

    if (uHighlights) {
        vec4 ppos = modelMatrix * vec4(centr, 1.0);
        vec2 uvScreen = abs(ppos.xy) / resolutionUI;
        vec2 val = texture2D(tSim, vec2(uvScreen.x, 1.0 - uvScreen.y)).xy;
        tr = fit(val.g, 0.01, 1.0, 0.0, 5.0);
        illum = val.r;
    }

    vUv = uv;
    vUv.x = mod(uv.x + 0.125 * mod(floor((1.0 - tr2 + tr) * 5.654), 8.0), 1.0);
    vAlpha = tr1;

    vec4 wPos = modelMatrix * vec4(position, 1.0);
    wPosY = wPos.y;

    gl_Position = projectionMatrix * viewMatrix * wPos;
}
// --- фрагментный ---
void main() {
    vec2 uv = vUv;
    float alpha = vAlpha;
    alpha *= msdf(tMap, uv);
    alpha *= uOpacity;

    // mobile fade
    alpha *= smoothstep(-uFadeMargin, -uFadeMargin * 3.0, wPosY);
    alpha *= smoothstep(-resolutionUI.y + uFadeMargin, -resolutionUI.y + uFadeMargin * 3.0, wPosY);

    gl_FragColor = vec4(mix(uColor, vec3(0.8), fit(illum, 0.6, 0.8, 0.0, 1.0)), alpha);
}
```

**Что делать у нас.** Каждой букве в вершинном шейдере даём её центроид (атрибут centr), переводим в экранный UV, читаем FBO. Канал G (гребень) добавляем прямо в формулу перебора глифов — буквы на гребне перещёлкиваются через 5 лишних состояний. Канал R (амплитуда) через fit(0.6,0.8→0,1) подмешивает светло-серый #CCCCCC в цвет буквы. Флаг uHighlights выключает весь эффект одним булевым, illum объявлен flat — на глиф одно значение, без интерполяции по квадру.

Строка бандла: 20095

### Иконка-стрелка у ссылок реагирует на ту же волну — не свечением, а морганием (пропуском кадров)

**Числа.** illum объявлен flat varying vec2. В вершинном (стр.20236): ppos = modelMatrix * vec4(vec3(0.0),1.0) — берётся начало координат меша, а не centr; illum.x = fit(val.g, 0.01, 1.0, 0.0, 5.0); illum.y = val.r. Во фрагментном (стр.20279): a *= uOpacity * (1.0 - floor(mod(illum.x * 5.34234, 2.0))) — множитель 5.34234, mod 2.0 даёт вкл/выкл. Цвет (стр.20285): mix(uColor, vec3(0.8), fit(illum.y, 0.6, 0.8, 0.0, 1.0)). Собственное мигание при появлении: if (uShow < 1.0) { a *= sin(uShow*30.0 + uRand*12.4242)*0.4 + 0.6; a *= step(0.01, uShow); }. Текстура: le.load("ui/arrow-datatexture.ktx2","datatexture-repeat"), UV через imagefitUV(vUv, textureSize(tMap,0), vScale, 1.0)

```glsl
if (uShow < 1.0) {
    a *= sin(uShow * 30.0 + uRand * 12.4242) * 0.4 + 0.6;
    a *= step(0.01, uShow);
}

a *= msdf(tMap, uv);
a *= uOpacity * (1.0 - floor(mod(illum.x * 5.34234, 2.0)));

// mobile fade
a *= smoothstep(-uFadeMargin, -uFadeMargin * 3.0, wPosY);
a *= smoothstep(-resolutionUI.y + uFadeMargin, -resolutionUI.y + uFadeMargin * 3.0, wPosY);

gl_FragColor = vec4(mix(uColor, vec3(0.8), fit(illum.y, 0.6, 0.8, 0.0, 1.0)), a);
```

**Что делать у нас.** Не-буквенные элементы (иконки) на гребне волны не крутятся, а стробят через floor(mod(x*5.34234, 2.0)). Дёшево и выглядит как помеха в терминале. Иконке центроид не нужен — читаем FBO по позиции самого меша.

Строка бандла: 20279

### Тот же FBO кормит частицы света на фоне — берётся канал B (сглаженный гребень rimLerp)

**Числа.** vec2 fluid = texture(tSim, ndc*0.5+0.5).rb; float sim = fit(fluid.y, 1e-8, 0.3, 0.0, 1.0); size = mix(3.0, 10.0, random.x * sim); gl_PointSize = size * (resolution.y * 0.002); мерцание flick = (sin(time*0.8 + random.y*12.43)*0.5+0.5) * (sin(time*1.73 + random.z*7.16)*0.5+0.5); vLightFalloff = mix(0.5, 1.0, flick) * sim. Во фрагментном: discard при vLightFalloff < 0.001, круг через step(length(uv-0.5),0.5), градиент (1 - length(uv-0.5)*2) * pow(uv.x, 2.0)

```glsl
vec2 ndc = gl_Position.xy / gl_Position.w;
vec2 fluid = texture(tSim, ndc * 0.5 + 0.5).rb;
float sim = fit(fluid.y, 1e-8, 0.3, 0.0, 1.0);
float size = mix(3.0, 10.0, random.x * sim);
gl_PointSize = size * (resolution.y * 0.002);
float flick = sin(time * 0.8 + random.y * 12.43) * 0.5 + 0.5;
flick *= sin(time * 1.73 + random.z * 7.16) * 0.5 + 0.5;
vLightFalloff = mix(0.5, 1.0, flick) * sim;
```

**Что делать у нас.** Одна и та же карта волны используется трижды: буквы (R и G), иконки (R и G), частицы (B). Не заводить три симуляции.

Строка бандла: 20530

### Второй экземпляр той же симуляции — на кубах портфолио (класс jL), 512×512, привязан к UV самого меша, и на нём же висит клик по кубу

**Числа.** options {width:512, height:512}, RT type Mi (half-float), depthBuffer:!1, ping-pong ×2. tAdvect = "cubes/advect.png". Ядро идентично полноэкранному, но invResolution берётся из скалярного textureSize (квадрат) и rim = nextVal - texture2D(tBuffer,uv).r; выход vec4(nextVal, rim, 0.0, 1.0) — канала B тут НЕТ. Точка вброса: e.interactions[0].uv1. Hover: splatHovered=!0, сбрасывается в !1 каждый шаг update. При сбросе отрезка обнуляются splatTargetVelocity и soundVelocity (splatVelocity не трогают). Отдельная звуковая скорость: soundVelocity += dist*4; *= 0.98; clamp(0,1). Клик: Q.emit("webgl_switch_scene", `portfolio/${hash}`) с предварительным interaction.disable(). raycaster.firstHitOnly = !0. Создаётся как this.mouseFrost = new jL(this,{}) на стр.17437

```glsl
class jL{constructor(e,t={}){this.parent=e,this.options={width:512,height:512,...t};const s=new vt(this.options.width,this.options.height,{type:Mi,depthBuffer:!1});if(this.rts=[s,s.clone()],this.finalRT=s,this.fsQuad=new wg(new JL),this.renderer=he.renderer.webgl,this.interaction=new Er({camera:this.parent.scene.camera,meshes:[this.parent.mesh],onMove:this.onMouseMove,onHover:this.onMouseHover,onClick:this.onMouseClick,hoverCursor:!0,ctx:this}), ... this.interaction._raycaster.firstHitOnly=!0, ...}
onMouseMove(e){const t=e.interactions[0];if(!t)return;const s=t.uv1;this.splatPosition.copy(s)}
onMouseHover(e){this.splatHovered=!0}
onMouseClick(e){q.devScene||(this.interaction.disable(),Q.emit("webgl_switch_scene",`portfolio/${this.parent.options.hash}`))}
// фрагмент ядра, стр.17226:
float rim = nextVal - texture2D(tBuffer, uv).r;
gl_FragColor = vec4(nextVal, rim, 0.0, 1.0);
```

**Что делать у нас.** На объекты волна кладётся по UV меша (uv1) через Raycaster с firstHitOnly, на полноэкранный текст — по нормированным координатам экрана (position01). Формула ядра идентична, различие в источнике координат, в третьем канале и в наличии второй, звуковой скорости.

Строка бандла: 17232

### ЦВЕТА. Ровно один набор, светлой темы в бандле нет

**Числа.** Конфиг Be (стр.14437): colorLogo:"#ffffff", colorTitle:"#3C3C54", colorText:"#ffffff", colorProjectTitle:"#67707E", colorProjectText:"#A1AAB7". Разводка в манифесте: copyright красится в Be.colorTitle (#3C3C54), rights в Be.colorText (#ffffff). Тексты кубов и служебные — жёстко new Z("#ffffff"). Цвет свечения от волны — vec3(0.8) = #CCCCCC, захардкожен в трёх фрагментных шейдерах (стр.20146, 20217, 20285). Фон сцены (стр.20287): uColor1 "#09121f", uColor2 "#6b7685", tNoise "wind_noise.ktx2", uRotation -.66. Плексус детальной сцены: линии "#7f7f7f" (стр.17358), точки "#666666" с uSize 50 (стр.17262). Плексус сцены иглу — другой: линии материал ga({color:"#ffffff",opacity:.25,blending:pt}) (стр.15962)

```glsl
const Be={gridSize:125,gridSizeLow:50,gridSizeMobile:25,topMargin:90,topMarginLow:45,topMarginMobile:25,breakpointW:1600,breakpointH:800,breakPointMobile:640,colorLogo:"#ffffff",colorTitle:"#3C3C54",colorText:"#ffffff",colorProjectTitle:"#67707E",colorProjectText:"#A1AAB7", ... volume:1,muted:!0}
// фон, стр.20287:
uniforms:{uColor1:{value:new Z("#09121f")},uColor2:{value:new Z("#6b7685")},tNoise:{value:le.load("wind_noise.ktx2","colordata-repeat")},uRotation:{value:-.66}}
```

**Что делать у нас.** Заголовки на тёмном фоне сознательно ТЁМНЫЕ (#3C3C54), тело текста белое. У проекта наоборот: заголовок #67707E, текст #A1AAB7 — оба серые, ни один не белый. Фон — градиент между почти чёрным #09121f и серо-голубым #6b7685 с поворотом -0.66 рад.

Строка бандла: 14437

### КЕГЛИ И МЕТРИКА текстовых блоков (size в мировых единицах меша, потом мешу ставится scale)

**Числа.** Манифест и копирайт (стр.16140): {manifestoWidth:.75, copyrightWidth:.9, align:"right", lineHeight:.8, size:.09}; у rights lineHeight = this.options.lineHeight + .15 = .95 (стр.16269), align у copyright/rights переопределён на "left". Подпись скролла (стр.19789): {width:.6, align:"left", lineHeight:.8, size:.09}. Sound/On/Off (стр.19828): {width:1, align:"left", lineHeight:.8, size:.09}. Close (стр.19983): {width:1, align:"center", lineHeight:.8, size:.09}. Заголовок куба (стр.16831): {width:1, align:"left", lineHeight:.8, size:.13}. Дата + CLICK TO EXPLORE (стр.16908): {width:1, align:"right", lineHeight:.8, size:.115}. TEMP (стр.16980-область): {width:.75, align:"left", lineHeight:.8, size:.1}. Текст проекта (стр.20287): {width:4, align:"left", lineHeight:1, size:14, baseOffset:-.65}, при resize size = small ? 18 : 24. Ссылки в entry (стр.18586): {width:10, align:"center", lineHeight:1, size:1, baseOffset:-.25}

```glsl
this.options={manifestoWidth:.75,copyrightWidth:.9,align:"right",lineHeight:.8,size:.09}
// rights, стр.16269:
this.rights=new Ui({font:"IBMPlexMono-Medium",text:Be.rights,width:this.options.copyrightWidth,align:"left",lineHeight:this.options.lineHeight+.15,size:this.options.size},{...})
// текст проекта, стр.20287:
const t={font:"IBMPlexMono-Medium",color:"#ffffff",width:4,align:"left",lineHeight:1,size:14,baseOffset:-.65};
```

**Что делать у нас.** lineHeight 0.8 почти везде (плотный моноширинный набор), у длинного текста проекта и у ссылок 1.0. baseOffset -0.65 сдвигает базовую линию. Кегль текста проекта задаётся не в опциях, а на resize и переключается ступенькой 24→18.

Строка бандла: 16140

### РАСКЛАДКА, широкий и узкий экран. Брейкпоинты и отступы сетки

**Числа.** breakpointW:1600, breakpointH:800, breakPointMobile:640 (стр.14437). small = w<1600 || h<800; mobile = w<640 || h<640. Отступ слева (gridSize): 125 / 50 (small) / 25 (mobile). Отступ сверху (topMargin): 90 / 45 (small) / 25 (mobile). Масштаб манифеста s: 250 / 200 (small) / 175 (mobile). Логотип (стр.19789): ширина 200 / 160 (small) / 140 (mobile), высота = ширина*0.21. Подпись скролла (стр.19828): масштаб 230 / 180 (small). Кнопка Close (стр.20078): 120 / 95 (small) / 85 (mobile), высота = ширина*0.45, сообщение рядом масштабируется в e*2.15

```glsl
render(){const e=q.screen.width<Be.breakpointW||q.screen.height<Be.breakpointH,t=q.screen.width<Be.breakPointMobile||q.screen.height<Be.breakPointMobile,s=t?175:e?200:250,n=s,r=t?Be.gridSizeMobile:e?Be.gridSizeLow:Be.gridSize,a=t?Be.topMarginMobile:e?Be.topMarginLow:Be.topMargin;
Si.positionUI({camera:this.scene.camera,mesh:this.title,x:q.screen.width-r,y:a+this.title.size.y*.75*n,width:s,height:n}),
Si.positionUI({camera:this.scene.camera,mesh:this.text,x:q.screen.width-r,y:a+this.title.size.y*2.25*n,width:s,height:n});
const l=(e?160:200)*.21,c=a+l+this.copyright.size.y*1.25*s;
Si.positionUI({camera:this.scene.camera,mesh:this.copyright,x:r,y:c,width:s,height:s}),
Si.positionUI({camera:this.scene.camera,mesh:this.rights,x:r,y:c+this.copyright.size.y*1.5*s,width:s,height:s})}
```

**Что делать у нас.** Сетка не в процентах, а в пикселях: 125 px поля на десктопе, 50 на среднем, 25 на телефоне. Масштаб текстового меша меняется тремя ступенями, а не плавно. Вертикальные отступы считаются от size.y самого текста (0.75, 1.25, 1.5, 2.25 высоты).

Строка бандла: 16312

### Функция positionUI — как пиксельная раскладка ложится в 3D-сцену

**Числа.** l = длина вектора (camera.position - camera.target), либо явная distance; camera.getViewSize(l, Wa); c = Wa.y / screen.height; scale = (width*c, height*c, 1); h = x/screen.width, d = y/screen.height; position = camera.position + (Wa.x*-0.5 + Wa.x*h, Wa.y*0.5 - Wa.y*d, -l).applyQuaternion(camera.quaternion); при billboardCamera (по умолчанию true) mesh.quaternion копируется с камеры, затем updateMatrixWorld()

```glsl
positionUI({camera:i,mesh:e,x:t=0,y:s=0,width:n=1,height:r=1,distance:a=null,billboardCamera:o=!0}={}){const l=a||mx.subVectors(i.position,i.target).length();i.getViewSize(l,Wa);const c=Wa.y/q.screen.height;e.scale.set(n*c,r*c,1);const h=t/q.screen.width,d=s/q.screen.height;e.position.copy(i.position).add(mx.set(Wa.x*-.5+Wa.x*h,Wa.y*.5-Wa.y*d,-l).applyQuaternion(i.quaternion)),o&&e.quaternion.copy(i.quaternion),e.updateMatrixWorld()}
```

**Что делать у нас.** Один универсальный хелпер: даёшь x,y в CSS-пикселях от левого верхнего угла и ширину/высоту в пикселях, он сам ставит меш в мировых координатах перед камерой и разворачивает лицом к ней. Так текст живёт внутри 3D-сцены, но верстается как DOM.

Строка бандла: 13306

### Колонка текста проекта: ширина, поля, вертикальное центрирование, скролл

**Числа.** максимум 500 px, боковое поле 20 px: width = Math.min(screen.width - 20*2, 500). Левый край r = Math.max(20, (screen.width - width)*0.5) — колонка центрируется. Промежуток между блоками n = 25. scrollMargin = 65, width по умолчанию 500. scrollMax = max(0, totalHeight - (screen.height - 65*4)). Если скроллится — верхний отступ 130 (scrollMargin*2) с сохранением относительной позиции, иначе блок центрируется: (screen.height - totalHeight)*0.5. Инерция скролла: scrollY = lerpFPS(scrollY, scrollTargetY, .1), scrollTargetY зажат в 0..scrollMax. Клавиши: ArrowDown/ArrowUp ±150 * scrollMultiplier. Fade у краёв через uFadeMargin = scrollMargin = 65: smoothstep(-65, -195, wPosY) и smoothstep(-H+65, -H+195, wPosY)

```glsl
resize(){const e=this.scene.small?18:24,t=500,s=20;this.width=Math.min(q.screen.width-s*2,t);const n=25,r=Math.max(s,(q.screen.width-this.width)*.5);this.ready.then(()=>Promise.all(this.elements.map(a=>a.resize({size:e,width:this.width}))).then(()=>{const a=this.elements.reduce((c,h)=>c+h.mesh.size.y,0)+n*(this.elements.length-1);let o=0;if(this.scrollMax=Math.max(0,a-(q.screen.height-this.scrollMargin*4)),this.scrollMax>0){o=this.scrollMargin*2;const c=this.scrollMax===0?0:this.scrollY/this.scrollMax;this.scrollY=c*this.scrollMax,this.scrollTargetY=this.scrollY}else o=(q.screen.height-a)*.5,this.scrollY=0,this.scrollTargetY=0;let l=o;this.elements.forEach(c=>{c.mesh.position.set(r,-l,0),l+=c.mesh.size.y+n})}))}
```

**Что делать у нас.** Колонка не растягивается: жёсткий потолок 500 px и центрирование. Fade сверху и снизу считается прямо в шейдере от мировой Y, ширина растушёвки = scrollMargin*3 = 195 px.

Строка бандла: 20287

### Каскад показа блоков внутри проекта: длинный текст крутится дольше короткого

**Числа.** Для каждого элемента: r = есть текст ? (text.length > 100 ? 0.75 : 0.25) : 0.3 — это длительность. Накопительная задержка e += (есть текст и length>100) ? 0.3 : 0.1. В Yh.show(e,t) (стр.20148): uOpacity выставляется мгновенно (duration 0, delay t), uShow1 duration e, uShow2 duration e+0.1, оба ease "sine.out". Yh.hide(): uOpacity→0 duration .15 ease "power2.out". Звук на открытии проекта: "project-text" вместе с mouseSim.reset() (стр.20656)

```glsl
show(){this.group.visible=!0,this.scrollY=0,this.scrollTargetY=0;let e=0;this.elements.forEach((t,s)=>{var a;const n=!!t.text,r=n?t.text.length>100?.75:.25:.3;t.show(r,e),e+=n&&t.text.length>100?.3:.1,(a=t.interaction)==null||a.enable()})}
// Yh.show, стр.20148:
show(e=0,t=0){return re.fromTo(this.mesh.material.uniforms.uOpacity,{value:0},{value:1,delay:t,duration:0,overwrite:!0}),re.fromTo(this.mesh.material.uniforms.uShow1,{value:0},{delay:t,value:1,duration:e,ease:"sine.out",overwrite:!0}),re.fromTo(this.mesh.material.uniforms.uShow2,{value:0},{delay:t,value:1,duration:e+.1,ease:"sine.out",overwrite:!0})}
```

**Что делать у нас.** Порог 100 символов делит блоки на короткие (0.25 с) и длинные (0.75 с). uShow2 всегда ровно на 0.1 с длиннее uShow1 — глифы дощёлкивают уже на видимом тексте. Гасится не uShow, а uOpacity, за 0.15 с.

Строка бандла: 20287

### Мигание текста при наведении на логотип (uBlink) — прямоугольная волна, а не плавная. Глубина у разных блоков разная

**Числа.** if (uBlink < 1.0) alpha *= 0.6 + 0.4 * mod(floor(uBlink * 5.0), 2.0) — 5 полупериодов за прогон, глубина 0.6..1.0; так на стр.16178 (title), 16221 (text манифеста) и 16307 (rights). У copyright (стр.16264) глубина ДРУГАЯ: alpha *= 0.3 + 0.7 * mod(floor(uBlink * 5.0), 2.0). Твин (стр.16312): uBlink 0→1, duration .1, ease "none", delay = t*0.1, применяется только к [copyright, rights]. Триггер — событие "webgl_hover_logo"

```glsl
if (uBlink < 1.0) alpha *= 0.6 + 0.4 * mod(floor(uBlink * 5.0), 2.0);
alpha *= msdf(tMap, uv);
gl_FragColor = vec4(uColor, alpha);
// у copyright, стр.16264:
if (uBlink < 1.0) alpha *= 0.3 + 0.7 * mod(floor(uBlink * 5.0), 2.0);
// ---
blinkAnimation(){[this.copyright,this.rights].forEach((e,t)=>{re.fromTo(e.material.uniforms.uBlink,{value:0},{value:1,delay:t*.1,duration:.1,ease:"none",overwrite:!0})})}
```

**Что делать у нас.** Мигание сделано floor+mod, без синусов. 0.1 с на весь мигающий пакет из пяти вспышек. Блок, который должен мигать заметнее, получает большую глубину (0.3 вместо 0.6).

Строка бандла: 16178

### ЗВУК текста. У появления текста свой звук, и он рандомизируется из трёх сэмплов с антидребезгом

**Числа.** playBeep() стр.17117: if (Fe.time - lastBeepPlayed < .4) return; Math.floor(Math.random()*3) → "beeps" | "beeps2" | "beeps3". Все три: volume .5, minTimeBetweenPlays .4. Библиотека (стр.14444): music-highq.ogg имя "music-bg" (.2, loop, autoPlay), room.ogg имя "room-bg" (.45, loop, autoPlay), wind.ogg (0, loop), igloo.ogg (0, loop), shard.ogg (0, loop), circles.ogg — имя "portals" (0, loop), particles.ogg (0, loop), beeps/beeps2/beeps3.ogg (.5, minTimeBetweenPlays .4), click-project.ogg (.5), enter-project.ogg (.5), leave-project.ogg (.5), project-text.ogg (.5), logo.ogg (.3), ui-long.ogg (.3), ui-short.ogg (.3), manifesto.ogg (.3). Глобально volume:1, muted:!0

```glsl
playBeep(){if(!(Fe.time-this.lastBeepPlayed<.4))switch(this.lastBeepPlayed=Fe.time,Math.floor(Math.random()*3)){case 0:Q.emit("webgl_play_audio","beeps");break;case 1:Q.emit("webgl_play_audio","beeps2");break;case 2:Q.emit("webgl_play_audio","beeps3");break}}
// ---
this._controller.addAudio({name:"beeps",url:"beeps.ogg",volume:.5,minTimeBetweenPlays:.4})
this._controller.addAudio({name:"project-text",url:"project-text.ogg",volume:.5})
this._controller.addAudio({name:"ui-short",url:"ui-short.ogg",volume:.3})
```

**Что делать у нас.** Три варианта одного бипа, выбор случайный, но не чаще 0.4 с — иначе при быстром скролле получается пулемёт. Формат .ogg, не .mp3. Фоновые слои держатся на нулевой громкости и подмешиваются кодом, а не запускаются заново. Стартуем в mute, звук включает пользователь.

Строка бандла: 17117

### Второй, независимый механизм анимации текста в базовом материале Ui: ANIMATION_TRANSLATE двигает вершину, ANIMATION_MASK двигает UV внутри ячейки глифа

**Числа.** Дефолтные uniform-ы базового материала (стр.14205): uColor "#ffffff", uAlpha 1, uOutlineWidth .05, uAnimationOrder 0, плюс uAnimationDirection (vec2), uAnimationAmount, uAnimationMargin, uAnimationProgress. ВЕРШИННЫЙ, ANIMATION_TRANSLATE (стр.14276): vAlpha = falloffsmooth(abs(uAnimationOrder - weight), 0.0, 1.0, uAnimationMargin, clamp(uAnimationProgress,0,1)); pos += vec3(uAnimationDirection, 0.0) * uAnimationAmount * (1.0 - vAlpha). ФРАГМЕНТНЫЙ, ANIMATION_MASK (стр.14372): a = falloffsmooth(...); uv += uAnimationDirection * uAnimationAmount * (1.0 - a); uv = clamp(uv, vec2(vUVMask.x, vUVMask.z), vec2(vUVMask.y, vUVMask.w)). weight выбирается дефайном: 1→textWeights.x, 2→textWeights.y, 3..5→lineWeights.x/y/z (одинаково для обоих дефайнов). uAnimationAmount выставляется из geometry._maxLineHeight (для TRANSLATE) либо geometry._maxUVDisp (для MASK) в Ui._updateSize()

```glsl
// фрагментный
#ifdef ANIMATION_MASK
    float weight = 0.0;
    #if ANIMATION_MASK == 1
        weight = vTextWeights.x;
    #elif ANIMATION_MASK == 2
        weight = vTextWeights.y;
    #elif ANIMATION_MASK == 3
        weight = vLineWeights.x;
    #elif ANIMATION_MASK == 4
        weight = vLineWeights.y;
    #elif ANIMATION_MASK == 5
        weight = vLineWeights.z;
    #endif

    float a = falloffsmooth(abs(uAnimationOrder - weight), 0.0, 1.0, uAnimationMargin, clamp(uAnimationProgress, 0.0, 1.0));
    uv += uAnimationDirection * uAnimationAmount * (1.0 - a);
    uv = clamp(uv, vec2(vUVMask.x, vUVMask.z), vec2(vUVMask.y, vUVMask.w));
#endif

// вершинный
#ifdef ANIMATION_TRANSLATE
    vAlpha = falloffsmooth(abs(uAnimationOrder - weight), 0.0, 1.0, uAnimationMargin, clamp(uAnimationProgress, 0.0, 1.0));
    pos += vec3(uAnimationDirection, 0.0) * uAnimationAmount * (1.0 - vAlpha);
#endif
```

**Что делать у нас.** Запасной приём, в боевых текстах igloo не задействован. MASK: буква уезжает по UV внутри своей ячейки атласа и обрезается по uvMask, чтобы не залезть на соседний глиф. TRANSLATE: уезжает сама геометрия на высоту строки. Порядок анимации можно вести не по символам, а по строкам (lineWeights).

Строка бандла: 14351

### Сами тексты сайта и заглушка недоступного кубика — вместо надписи вопросительные знаки той же длины

**Числа.** click:"Click to explore" (16 символов), clickDisabled:"???????????????" (15 знаков вопроса, проверено посимвольно). Подставляется как (s?Be.click:Be.clickDisabled).toUpperCase(), где s = options.interior.enabled (стр.16907). Строка целиком: `D ${date.replaceAll("/",".")}\n${...}`. Прочее из Be (стр.14437): manifesto.title "////// Manifesto", manifesto.text "Our mission is to build the next generation of consumer brands at the intersection of Community, AI, and crypto.", scroll "Scroll down to discover.", follow "/// Follow Us", close "Close", copyright "// Copyright © 2026", rights "Igloo, Inc.\nAll Rights Reserved.", socialTitle "/// Discover", linkTitle "/// Visit", заголовки кубов "PORTFOLIO_CO_01 Pudgy Penguins", "PORTFOLIO_CO_02 Overpass", "PORTFOLIO_CO_03 Abstract"

```glsl
this.text=new Ui({font:"IBMPlexMono-Medium",text:`D ${this.parent.options.date.replaceAll("/",".")}\n${(s?Be.click:Be.clickDisabled).toUpperCase()}`,width:1,align:"right",lineHeight:.8,size:.115},{uniforms:{tMap:{value:le.load("../fonts/IBMPlexMono-Medium-datatexture.ktx2","data")},uColor:{value:new Z("#ffffff")},uShow1:{value:0},uShow2:{value:0}},...})
```

**Что делать у нас.** Приём для неактивных элементов: не прятать и не гасить, а заменить текст на ??????? почти той же длины моноширинным шрифтом. Служебные префиксы из слэшей (//////, ///, //) дают вид терминала без единой иконки. Дата пишется через точки, с префиксом D.

Строка бандла: 16908

### Появление/скрытие заголовков кубов по прогрессу скролла — разные диапазоны у заголовка и у даты, плюс звук

**Числа.** Заголовок (стр.16903): условие 1-Math.abs(ie.fit(t,-1.6,.5,-1,1))===0 → прячем. Дата (стр.16980): 1-Math.abs(ie.fit(t,-.6,1.25,-1,1))===0 → прячем. Прячем: animationProgress→0 за .2 "none" (в onComplete lineMesh.visible=!1), uShow1→0 за .2 "none" (в onComplete text.visible=!1). Показываем: animationProgress→1 за .2, uShow1→1 за .4, uShow2 0→1 за .75, все ease "none", плюс playBeep(). Масштаб текста: Math.min(.8, .5/(q.screen.h/1300)) — на трёх местах (16903, 16980, 17109); у цифр плексуса аналог uSize = Math.min(.1, .08/(q.screen.h/1300)) (стр.16022)

```glsl
update(e,t){if(1-Math.abs(ie.fit(t,-1.6,.5,-1,1))===0? ... hide ... : this.lineMesh.visible||(this.lineMesh.visible=!0,this.text.visible=!0,this.isHiding=!1,re.to(this.animationProgress,{value:1,duration:.2,ease:"none",overwrite:!0}),re.to(this.text.material.uniforms.uShow1,{value:1,duration:.4,ease:"none",overwrite:!0}),re.fromTo(this.text.material.uniforms.uShow2,{value:0},{value:1,duration:.75,ease:"none",overwrite:!0}),this.parent.texts.playBeep()) ...
this.text.scale.setScalar(Math.min(.8,.5/(q.screen.h/1300)))
```

**Что делать у нас.** Порог показа не точка, а диапазон, и у заголовка он шире и смещён (-1.6..0.5) относительно даты (-0.6..1.25) — подписи включаются не одновременно. Масштаб привязан к высоте окна через опорные 1300 px с потолком.

Строка бандла: 16903

### Fade текста ссылок в entry-сцене по горизонтали (карусель) — вырезание окна прямо в фрагментном шейдере

**Числа.** alpha *= smoothstep(resolution.x*0.5 + uFadePosition + uFadeMargin, resolution.x*0.5 + uFadePosition, gl_FragCoord.x); alpha *= smoothstep(resolution.x*0.5 - uFadePosition - uFadeMargin, resolution.x*0.5 - uFadePosition, gl_FragCoord.x) — стр.18660-18663. Константы (стр.18672): uFadePosition из 100 / 70 (small) / 50 (mobile) px; uFadeMargin из 200 / 140 (small) / 110 (mobile) px, оба пересчитаны как resolution.x*px/resolutionUI.x. Шаг между ссылками e = 10 / 7 (small) / 6 (mobile); масштаб a = 1 / .8 (small) / .75 (mobile). Показываются ровно три: текущая (0,0,0), следующая (+e,0,0), предыдущая (-e,0,0), индексы по кругу через (s+1)%t и s-1<0?t-1:s-1. Сама группа ставится через positionUI в x = screen.width*0.5

```glsl
alpha *= smoothstep(resolution.x * 0.5 + uFadePosition + uFadeMargin, resolution.x * 0.5 + uFadePosition, gl_FragCoord.x);
alpha *= smoothstep(resolution.x * 0.5 - uFadePosition - uFadeMargin, resolution.x * 0.5 - uFadePosition, gl_FragCoord.x);
// ---
const e=this.parent.mobile?6:this.parent.small?7:10, ... a=this.parent.mobile?.75:this.parent.small?.8:1,o=this.parent.mobile?50:this.parent.small?70:100,l=this.parent.mobile?110:this.parent.small?140:200,c=he.uniforms.resolution.value.x*o/he.uniforms.resolutionUI.value.x,h=he.uniforms.resolution.value.x*l/he.uniforms.resolutionUI.value.x;
```

**Что делать у нас.** Ленту не режут ножницами и не масками DOM: gl_FragCoord.x против центра экрана, две smoothstep. Ширина растушёвки вдвое больше самого окна. В сцене живут только три меша, остальные visible=false.

Строка бандла: 18660

### Порядок отрисовки и режимы материалов текста — почему текст никогда не перекрывается сценой

**Числа.** renderOrder=999 встречается 22 раза (все обычные тексты), renderOrder=9999 один раз — у ссылок entry-сцены (область стр.18660), renderOrder=10 у логотипа (стр.19789) и у кнопки close (стр.20039). У всех текстовых мешей frustumCulled = !1, depthWrite:!1, depthTest:!1; часть текстов blending: pt (аддитивный). Общий UBO (чанк ae, стр.13252): uniform Global{vec2 resolution; vec2 resolutionUI; float aspect; float time; float dtRatio;}. Чанк математики Ht (стр.14444) даёт efit/fit/fit01/fit10/fit11 в float и vec3

```glsl
ae="uniform Global{vec2 resolution;vec2 resolutionUI;float aspect;float time;float dtRatio;};"
// ---
Ht="float efit(float x,float a1,float a2,float b1,float b2){return b1+((x-a1)*(b2-b1))/(a2-a1);}float fit(float x,float a1,float a2,float b1,float b2){return clamp(efit(x,a1,a2,b1,b2),min(b1,b2),max(b1,b2));}float fit01(float x,float a1,float a2){return fit(x,0.0,1.0,a1,a2);}float fit10(float x,float a1,float a2){return fit(x,1.0,0.0,a1,a2);}float fit11(...)..."
// ---
this.title.name="title",this.title.frustumCulled=!1,this.title.renderOrder=999,this.scene.add(this.title)
```

**Что делать у нас.** Текст рисуется поверх всего, без записи и проверки глубины, вне отсечения по фрустуму. Все общие величины (разрешение, экранное разрешение UI, время, dtRatio) лежат в одном UBO, а не в 40 отдельных uniform-ах. Логотип и close специально с маленьким renderOrder — они рисуются раньше и могут уйти под остальной UI.

Строка бандла: 13252

**Не найдено или не подтвердилось:**

- ВЫБРОШЕНО ЦЕЛИКОМ: весь CSS-блок из находки про шрифт. В App3D.pretty.js и igloo-main.js НЕТ ни одного @font-face, ни IBMPlexMono-Medium-897c8c30.woff2, ни -1e253194.woff, ни IBMPlexMono-Regular / -d3034935.woff2 / -419d45f6.woff, ни html{--default-font: sans-serif}. Строка woff в бандле встречается 4 раза и все 4 — это setVie'wOff'set в three.js. Единственный font-size: 17px в igloo-main.js это .ascii:before у прелоадера с font-family: monospace, а не html{font-size:17px}.
- ИСПРАВЛЕНО: список строк с загрузкой IBMPlexMono-Medium-datatexture.ktx2. Было 16974, 19785, 19825, 19864, 19903, 20035, 20139 — таких строк нет. Верно: 16140, 16183, 16226, 16269, 16831, 16908, 16980, 18586, 19789, 19828, 19867, 19906, 20039, 20078, 20148. Число 15 подтверждено.
- ИСПРАВЛЕНО: чанк msdf (ii), чанк falloff/_linstep (Ue) и UBO (ae) лежат НЕ на 14389 и не на 16153, а все на строке 13252 — это одна длинная строка-константа длиной 7909 символов со всеми GLSL-чанками.
- ИСПРАВЛЕНО: positionUI не на 14437, а на 13306.
- ИСПРАВЛЕНО: конфиг Be действительно на 14437, но каскад манифеста show()/blinkAnimation()/render() — на 16312, а опции {manifestoWidth...} — на 16140.
- ИСПРАВЛЕНО и ПЕРЕПИСАНО: находка про длительности. Было сказано «базовый показ скролл/звук/close: uShow1 .4, uShow2 .75, delay 1 или .2; скрытие всегда .15..0.2». В коде иначе: у подписи скролла (19828) скрытие uShow1 за .5 и uShow2 за .4, а не .2; у Close (20078) показ сообщения uShow1 за .2 и uShow2 за .4, а не .4/.75. Число .15 относится только к hide ссылок entry-сцены (18672) и к hide Yh по uOpacity (20148).
- ИСПРАВЛЕНО: в KF.update (20640) при разрыве отрезка обнуляется ТОЛЬКО this.splatTargetVelocity. Строки this.splatVelocity=0 там нет. В версии на кубах jL (17262) обнуляются splatTargetVelocity и soundVelocity, тоже без splatVelocity. Утверждение «splatTargetVelocity=0; splatVelocity=0» было неверным для обеих версий.
- ИСПРАВЛЕНО: в KF (полноэкранная версия) поле splatHovered только читается в условии и нигде не присваивается — обработчика onHover у KF нет, ветка мёртвая. splatHovered живёт только в jL (17232/17260/17262) и в третьем, не-FBO объекте на 18772.
- ИСПРАВЛЕНО: номера строк по волне и тексту. Ядро симуляции — 20576..20629 (фрагментный шейдер KF), класс KF начинается на 20562, resize с делением на 5 — на 20656. Текст, читающий tSim — 20085..20146 и двойник 20155..20217. Иконка-стрелка — 20226 (вершинный) и 20272..20285 (фрагментный), а не 20240. Частицы — 20530..20542. Колонка проекта и её каскад — 20287, а не 20301.
- ИСПРАВЛЕНО: строка мигания uBlink — 16178, а не 16175. И глубина не одна: на 16178, 16221, 16307 это 0.6 + 0.4*mod(...), а на 16264 (copyright) 0.3 + 0.7*mod(...).
- ИСПРАВЛЕНО: Close использует align:"center" (19983), а не "left", как было записано в находке про кегли.
- ИСПРАВЛЕНО: playBeep находится на 17117, аудиобиблиотека — на 14444, а не на 16903.
- ИСПРАВЛЕНО: слово stagger в бандле ЕСТЬ — 19 раз на строке 13264, это API GSAP. Слово split есть 41 раз (String.split), decode 101 раз (KTX2/draco), shuffle 1 раз. Верно только то, что scramble (0) и glitch (0) не встречаются вообще, и что ни одно из них не относится к тексту.
- ПОДТВЕРЖДЕНО: troika в бандле 0 вхождений. Своя реализация — класс Ui + загрузчик AR (zt.msdf) + внешний воркер.
- ПОДТВЕРЖДЕНО: ни одного uniform с именем uWave, uRipple, uClick, uTouch, uDecode, uScramble, uGlitch (по 0 вхождений). Волна называется tSim (16 раз), точка вброса — uSplatCoords/uSplatPrevCoords/uSplatRadius (8 раз).
- ПОДТВЕРЖДЕНО: единственная текстовая DOM-строка в бандле — "Seems like WebGL2 is not supported by your browser 😰 Please update it to access the experience.", функция ZF, строка 20656.
- ПОДТВЕРЖДЕНО: второго (светлого) набора цветов нет, переключателя темы нет, слов light/dark как темы нет. Один палитр-набор в Be (14437) плюс жёсткий vec3(0.8) как цвет свечения (20146, 20217, 20285).
- ПОДТВЕРЖДЕНО: явного списка подставляемых символов нет. Подставляется то, что лежит на 1/8, 2/8 … 7/8 ширины MSDF-атласа от текущего глифа; состав подмен задаётся раскладкой атласа, а её в бандле нет.
- ПОДТВЕРЖДЕНО: размеры MSDF-атласа, число колонок/строк, список глифов и метрики в бандл не входят — загружаются из внешнего `${font}.json` по пути /assets/fonts/ (13335, 13382). Множитель 0.125 позволяет предположить 8 колонок, подтверждения в коде нет.
- ПОДТВЕРЖДЕНО: расчёт textWeights, lineWeights, uvMask, centr, maxLineHeight, maxUVDisp выполняется во внешнем воркере /assets/msdfworker-ac346fa7.js (13333). В бандле видно только имена буферов и itemSize: index 1, position 3, uv 2, uvMask 4, textWeights 2, lineWeights 3, centr 3.
- ПОДТВЕРЖДЕНО: волна не запускается по клику. Обработчика клика по тексту нет. Полноэкранная волна кормится событием "touch_move" (единственное вхождение, 20640) через e.position01; на кубах — onMove/uv1. Клик (onMouseClick, 17260) только переключает сцену. mouseSim.reset() дёргается при открытии проекта вместе со звуком "project-text" (20656).
- ПОДТВЕРЖДЕНО: ширина гребня отдельным числом не задана, rim = nextVal - prev.r. Скорость волны в px/c в коде отсутствует, выводится из wavespeed=1.0, деления разрешения на 5 и троттлинга 0.015 с — сами эти три числа в коде есть, произведения нет.
- ПОДТВЕРЖДЕНО: отдельного uniform под цвет свечения нет, vec3(0.8) захардкожен в трёх фрагментных шейдерах (20146, 20217, 20285).
- ПОДТВЕРЖДЕНО: stagger по буквам в миллисекундах в JS отсутствует, разнос чисто геометрический через falloff по textWeights.x с margin 0.1 и 1.0.
- ПОДТВЕРЖДЕНО: .ttf/.otf в бандле 0 вхождений.
- ПОДТВЕРЖДЕНО: медиазапросов CSS для текста нет, вся адаптивность в JS через Be.breakpointW/breakpointH/breakPointMobile и ступенчатые множители.
- ДОБАВЛЕНО ПРИ СВЕРКЕ: в сцене живут ДВА разных плексуса. У того, что в сцене иглу (15962), линии сделаны обычным материалом ga({color:"#ffffff",opacity:.25}). Цвета #7f7f7f (17358) и #666666 (17262) относятся к плексусу детальной сцены. Приписывать один набор цветов обоим нельзя.


## ЗВУК

### Полный реестр всех 18 звуков сайта (класс u3 — обёртка аудио над контроллером HU). Единственное место, где перечислены файлы, громкости, автоплей и зацикливание.

**Числа.** music-bg / music-highq.ogg volume=.2 autoPlay=!0 loop=!0 · room-bg / room.ogg volume=.45 autoPlay=!0 loop=!0 · wind / wind.ogg volume=0 autoPlay=!0 loop=!0 · igloo / igloo.ogg volume=0 autoPlay=!0 loop=!0 · beeps / beeps.ogg volume=.5 minTimeBetweenPlays=.4 · beeps2 / beeps2.ogg volume=.5 minTimeBetweenPlays=.4 · beeps3 / beeps3.ogg volume=.5 minTimeBetweenPlays=.4 · click-project / click-project.ogg volume=.5 · enter-project / enter-project.ogg volume=.5 · leave-project / leave-project.ogg volume=.5 · shard / shard.ogg volume=0 autoPlay=!0 loop=!0 · project-text / project-text.ogg volume=.5 · portals / circles.ogg volume=0 autoPlay=!0 loop=!0 · particles / particles.ogg volume=0 autoPlay=!0 loop=!0 · logo / logo.ogg volume=.3 · ui-long / ui-long.ogg volume=.3 · ui-short / ui-short.ogg volume=.3 · manifesto / manifesto.ogg volume=.3. Глобальный конфиг сцены: volume:1, muted:!0

```glsl
volume:1,muted:!0};class u3{constructor(e){this.mainController=e,this._controller=new HU({volume:Be.volume,muted:Be.muted}),this.init()}init(){this._controller.addAudio({name:"music-bg",url:"music-highq.ogg",volume:.2,autoPlay:!0,loop:!0}),this._controller.addAudio({name:"room-bg",url:"room.ogg",volume:.45,autoPlay:!0,loop:!0}),this._controller.addAudio({name:"wind",url:"wind.ogg",volume:0,autoPlay:!0,loop:!0}),this._controller.addAudio({name:"igloo",url:"igloo.ogg",volume:0,autoPlay:!0,loop:!0}),this._controller.addAudio({name:"beeps",url:"beeps.ogg",volume:.5,minTimeBetweenPlays:.4}),this._controller.addAudio({name:"beeps2",url:"beeps2.ogg",volume:.5,minTimeBetweenPlays:.4}),this._controller.addAudio({name:"beeps3",url:"beeps3.ogg",volume:.5,minTimeBetweenPlays:.4}),this._controller.addAudio({name:"click-project",url:"click-project.ogg",volume:.5}),this._controller.addAudio({name:"enter-project",url:"enter-project.ogg",volume:.5}),this._controller.addAudio({name:"leave-project",url:"leave-project.ogg",volume:.5}),this._controller.addAudio({name:"shard",url:"shard.ogg",volume:0,autoPlay:!0,loop:!0}),this._controller.addAudio({name:"project-text",url:"project-text.ogg",volume:.5}),this._controller.addAudio({name:"portals",url:"circles.ogg",volume:0,autoPlay:!0,loop:!0}),this._controller.addAudio({name:"particles",url:"particles.ogg",volume:0,autoPlay:!0,loop:!0}),this._controller.addAudio({name:"logo",url:"logo.ogg",volume:.3}),this._controller.addAudio({name:"ui-long",url:"ui-long.ogg",volume:.3}),this._controller.addAudio({name:"ui-short",url:"ui-short.ogg",volume:.3}),this._controller.addAudio({name:"manifesto",url:"manifesto.ogg",volume:.3}),Q.on("webgl_set_audio_volume",this.setAudioVolume,this),Q.on("webgl_play_audio",this.playAudio,this)}setAudioVolume(e,t=1){this._controller.setAudioVolume(e,t)}playAudio(e){this._controller.playAudio(e)}}
```

**Что делать у нас.** Завести один реестр звуков ровно такой структуры: {name, url, volume, autoPlay, loop, minTimeBetweenPlays}. Четыре петли-амбиента (wind, igloo, shard, portals=circles, particles) стартуют с volume:0 и потом рулятся событием, а не запускаются заново. Две петли (music-bg .2, room-bg .45) играют постоянно. Все разовые UI-звуки .3-.5. Формат везде OGG. Развести на два события: 'play_audio' (name) для разовых и 'set_audio_volume' (name, value) для петель.

Строка бандла: 14444

### Разблокировка AudioContext (класс DU). Звук включается по ПЕРВОМУ жесту: клик по body, конец касания (touch_end) или нажатие клавиши. Скролл/wheel в списке НЕТ. Отдельной кнопки "включить звук" для старта не требуется.

**Числа.** 3 слушателя: document.body 'click', событие 'touch_end', событие 'keydown'. iOS: возврат во вкладку → setTimeout(()=>this.resume(),500). contextReady — Promise, resolve только после успешного context.resume()

```glsl
class DU{constructor(){...Oe(this,"context",$h.getContext()),Oe(this,"contextReady",null),Oe(this,"contextStarted",!1),Oe(this,"preventSuspend",!1),Oe(this,"preventResume",!1),this.contextReady=new Promise((e,t)=>{et(this,vo,{resolve:e,reject:t})})}init(){this.context=$h.getContext(),ve(this,Vm,cE).call(this),Q.on("visibility_change",ve(this,Cu,qm),this)}suspend(){if(this.context.state==="running"&&!this.preventSuspend)return this.context.suspend()}resume(){if(this.contextStarted&&this.context.state==="suspended"&&!this.preventResume)return this.context.resume()}...
Vm=new WeakSet,cE=function(){$t.allowTouchStart=!0,document.body.addEventListener("click",U(this,$n)),Q.on("touch_end",U(this,$n)),Q.on("keydown",U(this,$n))},
pd=new WeakSet,Wm=function(){$t.allowTouchStart=!1,document.body.removeEventListener("click",U(this,$n)),Q.off("touch_end",U(this,$n)),Q.off("keydown",U(this,$n))},
Ym=new WeakSet,hE=async function(){try{if(await this.context.resume(),this.contextStarted)return;this.contextStarted=!0,ve(this,pd,Wm).call(this),U(this,vo).resolve()}catch(i){console.log("audio context error:",i)}},
Cu=new WeakSet,qm=function(i){this.contextStarted&&q.os.name==="ios"&&(i?et(this,rc,setTimeout(()=>this.resume(),500)):(clearTimeout(U(this,rc)),this.suspend()))};const RU=new DU
```

**Что делать у нас.** Сделать синглтон аудиоконтекста с полем contextReady = new Promise. На init вешать три одноразовых разблокировщика: body 'click', 'touch_end', 'keydown'. Обработчик: await ctx.resume(); если уже стартовал — выход; иначе снять все три слушателя и resolve(contextReady). Отдельно на iOS: при возврате во вкладку resume через 500 мс, при уходе — suspend.

Строка бандла: 13433

### Авто-снятие мьюта: сайт стартует muted=true, но как только AudioContext разблокирован первым жестом, контроллер САМ шлёт webgl_audio_mute_toggle и звук включается. Мастер-гейн едет плавно.

**Числа.** стартовые поля: sn(volume)=1, xo(currentGain)=0, en(muted)=!0. Плавность мастер-гейна: gain.setTargetAtTime(target, Math.max(.1, ctx.currentTime), .35). Дефолты конструктора: {camera:null, volume:1, muted:!0}

```glsl
class HU{constructor({camera:e=null,volume:t=1,muted:s=!0}={}){...te(this,sn,1),te(this,xo,0),te(this,en,!0),te(this,er,q.visible),te(this,js,new KI),te(this,bn,new Map),te(this,lA,.1),te(this,Iu,0),te(this,hc,!1),et(this,Kr,e),U(this,Kr)&&U(this,Kr).add(U(this,js)),et(this,sn,t),et(this,en,s),U(this,js).setMasterVolume(U(this,xo)),Q.on("visibility_change",ve(this,Pu,cA),this),Q.on("webgl_audio_mute_toggle",ve(this,Du,hA),this),Q.on("webgl_audio_global_volume",ve(this,Ru,uA),this),Q.on("webgl_prerender",ve(this,Uu,dA),this),he.audio.contextReady.then(()=>{U(this,en)&&Q.emit("webgl_audio_mute_toggle"),ve(this,Mn,nr).call(this,U(this,sn))}).catch(()=>{console.warn("audio failed to set volume")})}
...
Mn=new WeakSet,nr=function(i=1){let e=i;(!U(this,er)||U(this,en))&&(e=0),e!==U(this,xo)&&(et(this,xo,e),U(this,js).gain.gain.setTargetAtTime(U(this,xo),Math.max(.1,he.audio.context.currentTime),.35))},
Pu=new WeakSet,cA=function(i){i?U(this,er)||(et(this,er,!0),ve(this,Mn,nr).call(this,U(this,sn))):U(this,er)&&(et(this,er,!1),ve(this,Mn,nr).call(this,0))},
Du=new WeakSet,hA=function(){et(this,en,!U(this,en)),U(this,en)?ve(this,Mn,nr).call(this,0):ve(this,Mn,nr).call(this,U(this,sn)),Q.emit("webgl_audio_update_mute",U(this,en))},
Ru=new WeakSet,uA=function(i=1){et(this,sn,i),ve(this,Mn,nr).call(this,U(this,sn))}
```

**Что делать у нас.** У нас: мастер-гейн стартует в 0, флаг muted=true. Подписаться на contextReady и там, если muted, дёрнуть тот же тумблер — получится «звук сам включился после первого клика», кнопка нужна только чтобы выключить. Плавность обязательна: setTargetAtTime с постоянной .35 (не мгновенный gain.value=). Гейн также падает в 0 при уходе со вкладки (visibility_change) и возвращается к volume при возврате.

Строка бандла: 13472

### Загрузка и запуск дорожки (приватный метод fA контроллера): буфер грузится сразу при регистрации, а play() ждёт contextReady. Кэш по url, защита от дублей имени, ограничитель частоты повторов.

**Числа.** minTimeBetweenPlays сравнивается как Fe.time-s._timeLastPlayed>s._minTimeBetweenPlays. playAudio(name, offsetSeconds=0) делает s.stop().play(t). Проверка Bu: he.audio.context.state==="running"

```glsl
playAudio(e="default",t=0){const s=U(this,bn).get(e);!s||!ve(this,uc,Bu).call(this)||Fe.time-s._timeLastPlayed>s._minTimeBetweenPlays&&(s._timeLastPlayed=Fe.time,s.stop().play(t))}
setAudioVolume(e="default",t=1){const s=U(this,bn).get(e);s&&(s.individualVolume=t,s.setVolume(s.individualVolume))}
...
uc=new WeakSet,Bu=function(){return he.audio.context.state==="running"},
Lu=new WeakSet,fA=async function({name:i,url:e,volume:t,autoPlay:s,loop:n,playbackRate:r,offset:a,sync:o,syncOffset:l,minTimeBetweenPlays:c,positional:h=null}={}){if(U(this,bn).has(i))throw new Error(`audio ${i} already exists`);U(this,bn).set(i,null);try{const d=await Ow.load(e);if(!d||U(this,hc))return;const u=new(h?jI:$y)(U(this,js));return u.setBuffer(d),u.setLoop(n),u.setPlaybackRate(r),u.offset=a,u._animationSync=o,u._animationSyncOffset=l,u._minTimeBetweenPlays=c,u._timeLastPlayed=0,h&&(...),u.individualVolume=t,u.setVolume(u.individualVolume),s&&he.audio.contextReady.then(()=>{ve(this,uc,Bu).call(this)&&!U(this,hc)&&u.play()}).catch(()=>{console.warn(`audio ${i} failed to play`)}),U(this,bn).set(i,u),u}catch(d){console.log(d)}}
```

**Что делать у нас.** У нас: addAudio грузит буфер немедленно (параллельно 3D), а .play() у autoPlay-дорожек подвешивается на contextReady.then(). Разовые звуки перед play проверяют ctx.state==="running" и таймер minTimeBetweenPlays, иначе выходят молча. Перед каждым проигрыванием делать stop().play(offset) — так звук перезапускается, а не накладывается сам на себя.

Строка бандла: 13474

### Путь к звукам и декодер. Файлы лежат в /assets/audio/, декодируются НЕ через decodeAudioData, а в отдельном воркере, буфер собирается вручную.

**Числа.** базовый путь `${relativePath}/assets/audio/`; воркер new Worker("/assets/audioworker-036a09db.js"); пул воркеров new jo(1) — ровно 1 поток; загрузчик FileLoader с setResponseType("arraybuffer"); кэш Map по url

```glsl
function iR(){return new Worker("/assets/audioworker-036a09db.js")}const mg=new Ts;mg.setResponseType("arraybuffer");const Nw=new jo(1);Nw.setWorkerCreator(()=>new iR);const Ow={_audiobuffersCache:new Map,_initLoad(i,e){return this._audiobuffersCache.has(i)||this._audiobuffersCache.set(i,new Promise(e)),this._audiobuffersCache.get(i)},load(i){return this._initLoad(i,async e=>{try{const t=await mg.loadAsync(i),s=(await Nw.postMessage({buffer:t},[t])).data;if(s.error)throw new Error("audio could not be decoded");const n=he.audio.context.createBuffer(s.channelData.length,s.samplesDecoded,s.sampleRate);s.channelData.forEach((r,a)=>n.getChannelData(a).set(r)),e(n)}catch(t){console.log(`audio ${i} failed to load`),e(!1)}})}}
// путь:
function nR(){mg.setPath(`${q.relativePath}/assets/audio/`)}
```

**Что делать у нас.** Класть все .ogg в /assets/audio/. Грузить fetch'ем как arraybuffer, декодировать в web-worker'е (ogg-vorbis декодер), из {channelData, samplesDecoded, sampleRate} собирать ctx.createBuffer и заполнять getChannelData(i).set(). Кэш Promise по url, чтобы один файл не грузился дважды. Пул воркеров = 1, чтобы декодирование не ело кадры.

Строка бандла: 13306

### Включение аудио-подсистемы при инициализации движка — флаг audioContext:!0

**Числа.** await he.init({canvasCnt:o,interactionNode:r,relativePath:a,fingers:2,audioContext:!0,contextMenu:!1,DPR:u||1,adaptiveDPR:!0,shadowMap:!0,shadowMapType:ly}); DPR: window.devicePixelRatio<=2 ? Math.min(dpr,1.15) : Math.min(dpr,1.5)

```glsl
const u=window.devicePixelRatio<=2?Math.min(window.devicePixelRatio,1.15):Math.min(window.devicePixelRatio,1.5);await he.init({canvasCnt:o,interactionNode:r,relativePath:a,fingers:2,audioContext:!0,contextMenu:!1,DPR:u||1,adaptiveDPR:!0,shadowMap:!0,shadowMapType:ly});
```

**Что делать у нас.** Флаг audioContext включает audio.init() внутри движка (`c&&this.audio.init()` в GU.init). У нас — тот же переключатель, чтобы можно было собрать сцену вообще без звука.

Строка бандла: 20662

### Ветер (wind.ogg) и гул иглу (igloo.ogg) — привязаны к прогрессу скролла первой сцены

**Числа.** this._windVolume=ie.fit(this.progress,.05,.2,0,1)*ie.fit(this.progress,.75,.95,1,0); emit("webgl_set_audio_volume","wind",this._windVolume*.4); emit("webgl_set_audio_volume","igloo",this._iglooVolume*.5). initialScrollAutocenter=.495, finalScrollAutocenter=.495

```glsl
this._windVolume=ie.fit(this.progress,.05,.2,0,1)*ie.fit(this.progress,.75,.95,1,0),Q.emit("webgl_set_audio_volume","wind",this._windVolume*.4),Q.emit("webgl_set_audio_volume","igloo",this._iglooVolume*.5),this._needsReset=!1
// сброс при уходе со сцены:
set isSceneVisible(e){const t=this._isSceneVisible!==e;this._isSceneVisible=e,t&&(e?this._needsReset=!0:(this._windVolume=0,this._iglooVolume=0,Q.emit("webgl_set_audio_volume","wind",this._windVolume),Q.emit("webgl_set_audio_volume","igloo",this._iglooVolume)))}
// ie.fit: fit(i,e,t,s,n){return this.efit(this.clamp(i,Math.min(e,t),Math.max(e,t)),e,t,s,n)}
```

**Что делать у нас.** Каждый кадр пересчитывать громкость петли от прогресса скролла двумя fit'ами: нарастание 0.05→0.2 и затухание 0.75→0.95. Итог умножать на потолок (.4 для ветра, .5 для иглу) и слать set_audio_volume. При уходе со сцены громкость обнулять явно, петля продолжает крутиться в тишине.

Строка бандла: 16312

### Гул иглу считается от того, видны ли аннотации-линии на объекте, и подтягивается инерционно

**Числа.** const c=(n.length>0?1:0)*this.scene._windVolume; this.scene._iglooVolume=ie.lerpFPS(this.scene._iglooVolume,c,.1)

```glsl
this.lineMesh.visible=a.length>0,this.points.update(),this.numbers.update();const c=(n.length>0?1:0)*this.scene._windVolume;this.scene._iglooVolume=ie.lerpFPS(this.scene._iglooVolume,c,.1)
```

**Что делать у нас.** Целевая громидкость = флаг видимости (0 или 1) умножить на громкость ветра, и тянуть к ней через lerpFPS с коэффициентом .1 (кадронезависимый лерп). Так гул не щёлкает при появлении/исчезновении разметки.

Строка бандла: 16022

### Звук глыбы/льда (shard.ogg) — громкость от скорости движения мыши по ближайшей к камере глыбе. Асимметричная атака/спад.

**Числа.** выбирается куб с минимальным |options.centeredProgress - progress|; коэффициент лерпа r = (soundVelocity > _shardVolume) ? .2 : .05; итог emit("webgl_set_audio_volume","shard",this._shardVolume*.5)

```glsl
let s=1/0,n=0;if(this.cubes.forEach((r,a)=>{const o=r.options.centeredProgress-this.progress,l=Math.abs(o);l<s&&(s=l,n=a)}),this.cubes[n].mouseFrost){const r=this.cubes[n].mouseFrost.soundVelocity>this._shardVolume?.2:.05;this._shardVolume=ie.lerpFPS(this._shardVolume,this.cubes[n].mouseFrost.soundVelocity,r)}Q.emit("webgl_set_audio_volume","shard",this._shardVolume*.5)
// сброс:
set isSceneVisible(e){...(this._shardVolume=0,Q.emit("webgl_set_audio_volume","shard",this._shardVolume))}
// и при выходе из проекта:
detailAnimationOut(){re.to(this.cameraZoom,{overwrite:!0,value:0,duration:1.45,ease:"power3.out",onComplete:()=>{this._shardVolume=0,Q.emit("webgl_set_audio_volume","shard",this._shardVolume)}})}
```

**Что делать у нас.** Скорость курсора по объекту → громкость петли. Атака быстрая (.2), спад медленный (.05) — это и даёт ощущение «трогаешь лёд». Брать только ближайший к центру объект, а не сумму по всем.

Строка бандла: 17646

### Накопитель скорости мыши, который питает громкость shard (mouseFrost.soundVelocity)

**Числа.** this.soundVelocity+=e*4; this.soundVelocity*=.98; this.soundVelocity=ie.clamp(this.soundVelocity,0,1). Рядом визуальный: splatTargetVelocity+=e*6, *=.88, clamp 0..1; splatVelocity=ie.lerp(splatVelocity, ie.ease(splatTargetVelocity,"power4.out"), .1). Сброс если пауза t>.15 c, либо hover, либо скачок e>.3

```glsl
const t=Fe.time-this.splatLastMoveTime;e>0&&(this.splatLastMoveTime=Fe.time),(t>.15||this.splatHovered||e>.3)&&(this.splatLastPosition.copy(this.splatPosition),this.splatTargetVelocity=0,this.soundVelocity=0,e=0),this.splatHovered=!1,this.splatTargetVelocity+=e*6,this.splatTargetVelocity*=.88,this.splatTargetVelocity=ie.clamp(this.splatTargetVelocity,0,1),this.splatVelocity=ie.lerp(this.splatVelocity,ie.ease(this.splatTargetVelocity,"power4.out"),.1),this.soundVelocity+=e*4,this.soundVelocity*=.98,this.soundVelocity=ie.clamp(this.soundVelocity,0,1)
```

**Что делать у нас.** Держать ДВА разных накопителя от одной дельты курсора: визуальный (×6, затухание .88) и звуковой (×4, затухание .98). Звуковой затухает медленнее — хвост звука длиннее следа на экране. Обнулять оба, если мышь стояла дольше .15 с или прыгнула больше .3.

Строка бандла: 17232

### Туннель/порталы (circles.ogg под именем "portals") — три точки на скролле, звук нарастает при подлёте к каждой

**Числа.** точки прогресса [.28,.375,.465]; n=min|progress-точка|; this._portalsVolume=ie.ease(ie.fit(n,0,.04,1,0),"power2.out")*.9. Рядом видимость: tunnel.mesh.visible = progress<.52; snowparticles.mesh.visible = progress<.52; roomring.mesh.visible = progress>.53; smoketrail mesh0<.37, mesh1<.47, mesh2<.56

```glsl
this.smoketrail.mesh0.visible=this.progress>0&&this.progress<.37,this.smoketrail.mesh1.visible=this.progress>0&&this.progress<.47,this.smoketrail.mesh2.visible=this.progress>0&&this.progress<.56,this.tunnel.mesh.visible=this.progress<.52,this.snowparticles.mesh.visible=this.progress<.52,this.roomring.mesh.visible=this.progress>.53;let n=1/0;[.28,.375,.465].forEach(r=>{const a=Math.abs(this.progress-r);n=Math.min(n,a)}),this._portalsVolume=ie.ease(ie.fit(n,0,.04,1,0),"power2.out")*.9
```

**Что делать у нас.** Отдельного звука туннеля нет — есть петля circles.ogg, которая вспыхивает ровно на трёх отметках скролла. Ширина вспышки .04 прогресса (очень узко), кривая power2.out, потолок .9. У нас: список ключевых точек пролёта → расстояние до ближайшей → fit(dist,0,0.04,1,0) → ease power2.out.

Строка бандла: 19733

### Петля частиц (particles.ogg) — громкость от базового уровня плюс скорость курсора по «звуковой» плашке под UI

**Числа.** this.parent.scene._particlesVolume=.04*e+this.splatVelocity*.21, где e — множитель силы сцены. Геометрия зоны: new GA(.27,0), позиция mesh.position.set(0,-9.785,0). Накопитель: splatTargetVelocity+=t*4, *=.97, clamp(0,e); splatVelocity=ie.lerp(splatVelocity,splatTargetVelocity,.05); троттлинг апдейта 0.015 c; сброс при паузе >.15 c или скачке >.3

```glsl
class _F{constructor(e){this.parent=e,this.init()}init(){const e=new GA(.27,0);this.mesh=new Ce(e,new qy),this.mesh.position.set(0,-9.785,0),this.mesh.updateMatrixWorld(),this.interaction=new Er({camera:this.parent.scene.camera,meshes:[this.mesh],onMove:this.onMouseMove,onHover:this.onMouseHover,ctx:this}),...}update(e=0){if(e>0?this.interaction.enable():this.interaction.disable(),Fe.time-this.splatLastRenderTime<.015)return;this.splatLastRenderTime=Fe.time;let t=this.splatPosition.distanceTo(this.splatLastPosition);const s=Fe.time-this.splatLastMoveTime;t>0&&(this.splatLastMoveTime=Fe.time),(s>.15||this.splatHovered||t>.3)&&(this.splatLastPosition.copy(this.splatPosition),t=0),this.splatHovered=!1,this.splatTargetVelocity+=t*4,this.splatTargetVelocity*=.97,this.splatTargetVelocity=ie.clamp(this.splatTargetVelocity,0,e),this.splatVelocity=ie.lerp(this.splatVelocity,this.splatTargetVelocity,.05),this.splatVelocity=ie.clamp(this.splatVelocity,0,e),this.splatLastPosition.copy(this.splatPosition),this.parent.scene._particlesVolume=.04*e+this.splatVelocity*.21}}
```

**Что делать у нас.** Петля частиц никогда не молчит полностью пока сцена активна: базовый уровень .04, поверх до .21 от скорости курсора. Обновлять не чаще чем раз в 15 мс.

Строка бандла: 18772

### Три бипа (beeps/beeps2/beeps3) на появление HUD-подписей у глыб — случайный выбор из трёх с кулдауном

**Числа.** кулдаун .4 c (Fe.time-this.lastBeepPlayed<.4), выбор Math.floor(Math.random()*3), плюс встроенный minTimeBetweenPlays=.4 у самих дорожек. Анимация текста при этом: uShow1 duration .4 ease none, uShow2 fromTo 0→1 duration .75

```glsl
class KL{constructor(e){this.parent=e,this.lastBeepPlayed=0,...}
playBeep(){if(!(Fe.time-this.lastBeepPlayed<.4))switch(this.lastBeepPlayed=Fe.time,Math.floor(Math.random()*3)){case 0:Q.emit("webgl_play_audio","beeps");break;case 1:Q.emit("webgl_play_audio","beeps2");break;case 2:Q.emit("webgl_play_audio","beeps3");break}}
// вызов из каждой подписи при её показе:
re.to(this.text.material.uniforms.uShow1,{value:1,duration:.4,ease:"none",overwrite:!0}),re.fromTo(this.text.material.uniforms.uShow2,{value:0},{value:1,duration:.75,ease:"none",overwrite:!0}),this.parent.texts.playBeep()
```

**Что делать у нас.** Смена/появление текста озвучивается НЕ одним семплом, а случайным из трёх, с двойным кулдауном (в вызывающем коде .4 c и в самом реестре .4 c). Это убивает пулемётность, когда несколько подписей выезжают подряд.

Строка бандла: 17117

### Манифест (manifesto.ogg) — звучит только на каждой второй строке текста при появлении блока

**Числа.** условие onStart:()=>{t%2===0&&Q.emit("webgl_play_audio","manifesto")}; задержки строк: если уже показывали s=t*.15, иначе s = t<2 ? .75+t*.2 : (t-1)*.2; длительность n = t>0 ? 1.75 : 1; uShow1 duration .4*n ease sine.out, uShow2 duration .75*n

```glsl
show(){this.visible||(this.visible=!0,[this.copyright,this.rights,this.title,this.text].forEach((e,t)=>{let s=0;this.hasBeenShownOnce?s=t*.15:s=t<2?.75+t*.2:(t-1)*.2;const n=t>0?1.75:1;re.fromTo(e.material.uniforms.uShow1,{value:0},{delay:s,value:1,duration:.4*n,ease:"sine.out",overwrite:!0,onStart:()=>{t%2===0&&Q.emit("webgl_play_audio","manifesto")}}),re.fromTo(e.material.uniforms.uShow2,{value:0},{delay:s,value:1,duration:.75*n,ease:"sine.out",overwrite:!0})}),...)}
```

**Что делать у нас.** На «печать» блока текста звук вешать через один элемент (t%2===0), а не на каждый. Звук стартует в onStart твина появления строки, поэтому звук и картинка идут кадр в кадр.

Строка бандла: 16312

### Звуки входа в проект/глыбу и выхода: click-project → (через задержку) enter-project → project-text; выход leave-project

**Числа.** a=this.centerDetailScene()*.5; click-project играет сразу, enter-project через re.delayedCall(a,...); далее await Sc.wait(a+.75+1.25). project-text играет в onComplete твина displayUIvar duration .7 delay t+.5 вместе с emit("webgl_project_show"). Камера при этом: basePosition.z 4→2.5 duration 2 delay t+.5 ease "inOut1". leave-project играет одновременно с detailAnimationOut, потом re.delayedCall(1,...) разблокирует скролл

```glsl
const a=this.centerDetailScene()*.5;re.to(this.material.uniforms.uDetailProgress,{overwrite:!0,value:1,ease:"power3.in",delay:a,duration:1.25}),re.to(this.material.uniforms.uDetailProgress2,{overwrite:!0,value:1,ease:"sine.out",delay:a+.75,duration:1.25}),this.scrollComposers[1].passes[0].scene.detailAnimationIn(a),this.detailScene.playInAnimation(this.detailIndex,a),Q.emit("webgl_play_audio","click-project"),re.delayedCall(a,()=>{Q.emit("webgl_play_audio","enter-project")}),await Sc.wait(a+.75+1.25)
// текст проекта:
re.fromTo(this.displayUIvar,{value:0},{value:1,duration:.7,delay:t+.5,onComplete:()=>{this.mouseSim.reset(),Q.emit("webgl_project_show",e),Q.emit("webgl_play_audio","project-text")}}),re.fromTo(this.camera.basePosition,{z:4},{overwrite:!0,z:2.5,duration:2,delay:t+.5,ease:"inOut1"})
// выход:
this.scrollComposers[1].passes[0].scene.detailAnimationOut(),this.detailScene.playOutAnimation(),Q.emit("webgl_play_audio","leave-project"),await re.delayedCall(1,()=>{this.isDetailOpen=!1,this.enableScroll()})
```

**Что делать у нас.** Вход в объект озвучивать ТРЕМЯ звуками по цепочке: щелчок в момент клика, «вход» ровно в момент, когда камера долетела (delay = половина времени центровки), «текст» в onComplete появления UI. Выход — один звук в момент старта обратной анимации. Так удар и звук совпадают, а не расходятся.

Строка бандла: 20656

### UI-звуки наведения: ui-long на крупные элементы, ui-short на мелкие, logo на логотип

**Числа.** logo: hover_in на стрелках (show(arrow,.75)) стр.18586 и на логотипе show(.25,0) стр.19789, плюс один раз при интро в Q.once("webgl_show_ui_intro"). ui-long: hover на боксе ссылок show(.75,!0) стр.18772, на смене ссылки (uRotation=Math.PI*1.5, floor.additionalTime += 4*-e, duration 3 ease power4.out), на enable()/disable() стрелок, на кнопке звука show(.5,0) стр.19983, на кнопке закрытия show(.25,0) стр.20078. ui-short: на скрытии подсказки (uShow2 1→0 duration .4 ease sine.out) стр.19828 и на hover карточек ссылок show(.5,0) стр.20287

```glsl
// кнопка звука (класс NF) - hover и клик:
this.interaction=new Er({meshes:[this.interactionGeo],camera:this.scene.camera,hoverCursor:!0,onHover:s=>{s.action==="hover_in"&&(this.show(.5,0),Q.emit("webgl_play_audio","ui-long"))},onClick:s=>{Q.emit("webgl_ui_particles_clicked"),Q.emit("webgl_audio_mute_toggle"),this.show(.2,0)}}),Q.once("webgl_show_ui_intro",()=>{this.show(),this.interaction.enable()}),Q.on("webgl_audio_mute_toggle",this.onMute,this),this.onMute(),this.isReady()
// логотип:
onHover:t=>{t.action==="hover_in"&&(this.show(.25,0),Q.emit("webgl_hover_logo"),Q.emit("webgl_play_audio","logo"))}}),Q.once("webgl_show_ui_intro",()=>{this.interaction.enable(),this.show(),Q.emit("webgl_play_audio","logo")})
// карточки ссылок:
onHover:e=>{if(e.action==="hover_in"){const t=e.interactions[0].object._index;this.els[t].show(.5,0),Q.emit("webgl_play_audio","ui-short")}}
```

**Что делать у нас.** Три UI-семпла на весь сайт: ui-long (крупное/переключение), ui-short (мелкое/карточки), logo (фирменный, только на лого и стрелках). Играть строго на action==="hover_in", не на каждом кадре наведения. Все три громкостью .3.

Строка бандла: 19983

### Кнопка звука в 3D (класс NF): текст "Sound:" + "On"/"Off", шрифт IBMPlexMono-Medium, живёт в сцене как меш, а не в DOM

**Числа.** options={width:1,align:"left",lineHeight:.8,size:.09}; renderOrder=999, frustumCulled=!1, depthWrite:!1, depthTest:!1; иконка scale = small?18:22; текст scale = small?180:230; позиция иконки (meshMarginLeft, -screen.height+meshMarginTop+e*.7, 0); анимация показа: sound uShow1 .4*e / uShow2 .75*e, on/off с delay t+.1, иконка uShow duration .5*e ease none, uRand=Math.random()

```glsl
class NF{constructor(e){this.scene=e,this.ready=new Promise(t=>{this.isReady=t}),this.options={width:1,align:"left",lineHeight:.8,size:.09},this.init()}async init(){this.sound=new Ui({font:"IBMPlexMono-Medium",text:"Sound:",width:this.options.width,align:this.options.align,lineHeight:this.options.lineHeight,size:this.options.size},...),this.on=new Ui({font:"IBMPlexMono-Medium",text:"On",...}),this.off=new Ui({font:"IBMPlexMono-Medium",text:"Off",...})...}
onMute(e){var t;(t=this.scene.controller)!=null&&t.audioController&&Promise.resolve().then(()=>{this.scene.controller.audioController._controller.muted?(this.on.visible=!1,this.off.visible=!0,this.icon.material.uniforms.uActive.value=0):(this.on.visible=!0,this.off.visible=!1,this.icon.material.uniforms.uActive.value=1)})}
```

**Что делать у нас.** Кнопка звука — часть 3D-сцены (moнospace-текст "Sound: On/Off" + иконка с uActive 0/1), появляется по webgl_show_ui_intro, читает состояние прямо из контроллера в onMute. У нас можно так же: подпись + иконка в мире, а не HTML-кнопка в углу.

Строка бандла: 19828

### Момент появления UI (и первого звука логотипа) в интро-таймлайне

**Числа.** this.introTL.call(()=>{Q.emit("webgl_show_ui_intro")},null,4.5) — на 4.5 секунде интро; рядом introTL.fromTo(t,{value:0},{value:1,duration:4,ease:"sine.inOut"},1) и introWeight 0→1 duration 5.5 ease "inOut1" с позиции 2

```glsl
this.introTL.fromTo(...,{value:1,duration:4,ease:"sine.inOut"},1),this.introTL.call(()=>{Q.emit("webgl_show_ui_intro")},null,4.5),this.introTL.fromTo(this.introWeight,{value:0},{value:1,duration:5.5,ease:"inOut1"},2)
```

**Что делать у нас.** Музыка и амбиент стартуют раньше UI: они висят на contextReady (первый жест), а кнопка звука и звук логотипа появляются на 4.5 с интро-таймлайна. У нас порядок такой же: сначала фон, через 4.5 с интерфейс.

Строка бандла: 16312

### Синхронизация зацикленных дорожек с часами анимации (webgl_prerender), чтобы петли не уезжали от картинки

**Числа.** порог рассинхрона lA=.1 c; формула: _progress=(Fe.time+t._animationSyncOffset)*t.playbackRate % (t.duration||t.buffer.duration); при рассинхроне pause() → пересчёт → play(). В реестре igloo.inc sync ни у одной дорожки не включён (по умолчанию sync:!1, syncOffset:0)

```glsl
Uu=new WeakSet,dA=function(){if(!U(this,er)||!ve(this,uc,Bu).call(this))return;const i=Fe.time-he.audio.context.currentTime,e=Math.abs(i-U(this,Iu))>U(this,lA);U(this,bn).forEach(t=>{t&&e&&t._animationSync&&(t.pause(),t._progress=(Fe.time+t._animationSyncOffset)*t.playbackRate%(t.duration||t.buffer.duration),t.play())}),e&&et(this,Iu,i)}
```

**Что делать у нас.** Механизм есть, но на igloo.inc не используется. У нас пригодится, если петля должна совпадать с анимацией по фазе: каждый кадр сравнивать (clock.time - ctx.currentTime) с прошлым значением, при расхождении >.1 c перезапускать дорожку с рассчитанного _progress.

Строка бандла: 13472

### Базовые three.js аудио-классы, на которых всё построено, и их постоянные времени

**Числа.** AudioListener: gain=ctx.createGain(), gain.connect(ctx.destination); setMasterVolume: setTargetAtTime(e, ctx.currentTime, .01). Audio.setVolume: setTargetAtTime(e, ctx.currentTime, .01). PositionalAudio: panner.panningModel="HRTF". Дефолты addPositionalAudio: refDistance=1, rolloffFactor=1, distanceModel="inverse", maxDistance=1e4, directionalCone=[360,0,0]

```glsl
class KI extends It{constructor(){super(),this.type="AudioListener",this.context=$h.getContext(),this.gain=this.context.createGain(),this.gain.connect(this.context.destination),this.filter=null,this.timeDelta=0,this._clock=new Zy}...setMasterVolume(e){return this.gain.gain.setTargetAtTime(e,this.context.currentTime,.01),this}
class $y extends It{constructor(e){super(),this.type="Audio",this.listener=e,this.context=e.context,this.gain=this.context.createGain(),this.gain.connect(e.getInput()),this.autoplay=!1,this.buffer=null,this.detune=0,...}setVolume(e){return this.gain.gain.setTargetAtTime(e,this.context.currentTime,.01),this}
class jI extends $y{constructor(e){super(e),this.panner=this.context.createPanner(),this.panner.panningModel="HRTF",this.panner.connect(this.gain)}
```

**Что делать у нас.** Цепочка: буфер → Audio.gain (индивидуальная громкость, рампа .01) → AudioListener.gain (мастер, рампа .35) → destination. Два уровня гейна обязательны: индивидуальный дёргается каждый кадр от скролла/мыши, мастер — только мьютом и вкладкой.

Строка бандла: 12885

**Не найдено или не подтвердилось:**

- Ни одного .mp3, .wav, .m4a, .aac — во всём бандле только 18 файлов .ogg (grep -c 'mp3' = 0)
- Ни Howler, ни howl, ни new Audio(), ни HTMLAudioElement, ни <audio> — всё на голом Web Audio API через three.js Audio/AudioListener
- Отдельного звука туннеля НЕТ. Туннель (tunnel.mesh.visible при progress<.52) озвучен петлёй circles.ogg под именем "portals" с всплесками на .28/.375/.465
- Событие "webgl_audio_global_volume" только слушается (стр. 13472), нигде в бандле не emit'ится — ползунка общей громкости на сайте нет
- addPositionalAudio определён (стр. 13472), но НИ РАЗУ не вызван: все 18 дорожек непозиционные, панорамирования/HRTF в сцене нет
- Ни localStorage, ни sessionStorage, ни cookie — состояние mute нигде не сохраняется, при перезагрузке всё заново (grep localStorage = 0 совпадений)
- Кнопки "нажмите, чтобы включить звук" / "enter site" перед стартом нет — звук снимается с мьюта автоматически на первом клике/тапе/клавише
- Скролл и wheel НЕ разблокируют AudioContext: в списке разблокировщиков только body 'click', 'touch_end', 'keydown' (стр. 13433)
- Фоновая музыка music-highq.ogg стартует не с какой-то секунды: offset по умолчанию 0, autoPlay, играет с нуля сразу после contextReady. Никакого delay/offset для неё в бандле нет
- Ducking музыки нет: имя "music-bg" встречается в бандле ровно 1 раз (только регистрация), его громкость .2 больше нигде не меняется. То же самое с "room-bg" (.45)
- Параметры sync, syncOffset, offset и playbackRate ни у одной дорожки не переопределены — везде дефолты (sync:!1, syncOffset:0, offset:0, playbackRate:1)
- Имени и содержимого файла /assets/audioworker-036a09db.js в бандле нет — это отдельный внешний воркер-декодер, здесь только вызов new Worker(...) и разбор ответа {channelData, samplesDecoded, sampleRate}
- Точных абсолютных URL звуков нет: путь собирается как `${relativePath}/assets/audio/` + имя файла, значение relativePath в этом бандле не зашито


## ТЕМА

### Тема одна. Переключателя светлая/тёмная НЕТ во всём бандле

**Числа.** 0 совпадений на theme / prefers-color-scheme / darkMode / lightMode в App3D.js и main.js

```glsl
grep -i "theme|prefers-color-scheme|darkMode|lightMode" /tmp/igloo/App3D.pretty.js -> пусто
grep -i "theme|prefers-color" /tmp/igloo/igloo-main.js -> пусто
```

**Что делать у нас.** Не пытаться повторить igloo «светлой темой». У них ровно один режим - холодный светло-серо-голубой. Если у нас нужны две темы, тёмную делать своим набором uColor1/uColor2, а светлую строить строго по цифрам ниже. Пересвет у нас идёт не от темы, а от того, что мы светим лампами - у них ламп нет вообще (см. следующие пункты).

Строка бандла: 1

### В сцене НЕТ НИ ОДНОГО источника света three.js. Ни Ambient, ни Directional, ни Hemisphere, ни Point, ни Spot

**Числа.** 0 вызовов new DirectionalLight/AmbientLight/HemisphereLight/PointLight/SpotLight в прикладной части (строки >13900). Все совпадения DirectionalLight/HemisphereLight лежат только внутри библиотечных GLSL-чанков three (строки 3752, 3818, 4357, 8758, 8770) и никогда не инстанцируются. 0 совпадений на ".intensity" в прикладной части.

```glsl
awk 'NR>13900' App3D.pretty.js | grep -E "Light\(|AmbientLight|DirectionalLight|HemisphereLight|PointLight|SpotLight|\.intensity"
-> (пусто)
```

**Что делать у нас.** Убрать из нашей сцены все AmbientLight/DirectionalLight/HemisphereLight. Свет у igloo ЗАПЕЧЁН в текстуры (*_color.ktx2 = lightmap) плюс дорисован формулами в шейдере. Это и есть главная причина, почему у нас «всё пересвечено»: мы складываем лампы + PBR + тонмаппинг, а они кладут готовый пиксель. Единственный источник освещения во всём сайте - envMap на ледяных кубах (см. отдельный пункт).

Строка бандла: 13900

### renderer: конструктор и setClearColor. toneMapping и outputColorSpace НЕ трогаются - остаются дефолтные

**Числа.** new WebGLRenderer({alpha:!1, antialias:!1, stencil:!1, depth:!1}); clearColor = new Color("#000000"); clearAlpha = 1; setClearColor("#000000", 1). toneMapping = dr = 0 = NoToneMapping (three-дефолт, строка 10336: this.toneMapping=dr, this.toneMappingExposure=1). toneMappingExposure = 1. outputColorSpace = Ve = "srgb" (строка 10336: this._outputColorSpace=Ve; Ve="srgb"). DPR = devicePixelRatio<=2 ? min(dpr,1.15) : min(dpr,1.5); adaptiveDPR=true; shadowMap=true.

```glsl
class KD{constructor(){Oe(this,"webgl",null),Oe(this,"domElement",null),Oe(this,"info",null),Oe(this,"clearColor",new Z("#000000")),Oe(this,"clearAlpha",1)}init({shadowMap:e,shadowMapType:t}={}){this.webgl=new ZT({alpha:!1,antialias:!1,stencil:!1,depth:!1}),this.webgl.setClearColor(this.clearColor,this.clearAlpha),e===!0&&(this.webgl.shadowMap.enabled=!0,t&&(this.webgl.shadowMap.type=t)),...this.webgl.debug.checkShaderErrors=!1,...}}
const Je=new KD
// строка 10336 (three-дефолты, ничем не переопределены):
this._outputColorSpace=Ve,this.toneMapping=dr,this.toneMappingExposure=1
// dr=0 (NoToneMapping), Ve="srgb", oi="srgb-linear"
// строка 20662:
const u=window.devicePixelRatio<=2?Math.min(window.devicePixelRatio,1.15):Math.min(window.devicePixelRatio,1.5);
await he.init({canvasCnt:o,interactionNode:r,relativePath:a,fingers:2,audioContext:!0,contextMenu:!1,DPR:u||1,adaptiveDPR:!0,shadowMap:!0,shadowMapType:ly});
```

**Что делать у нас.** У нас поставить renderer.toneMapping = THREE.NoToneMapping и toneMappingExposure = 1. НИКАКОГО ACESFilmic - именно он выбеливает светлые сцены. antialias:false (сглаживание даёт SMAA-пасс), alpha:false, depth:false, stencil:false. setClearColor(0x000000, 1) - фон всё равно перекрыт сферой неба, чёрный клир нигде не виден. Пиксель-рэйшо резать до 1.15/1.5.

Строка бандла: 13304

### Конвейер постобработки целиком (EffectComposer)

**Числа.** Базовый композер: RenderPass(scene, camera, undefined, clearColor=#000000, clearAlpha=1) -> [на каждую сцену свой ColorCorrectionPass] -> BloomPass -> SMAA(quality:"high"). RT композера type = Mi (HalfFloatType). Пассы сортируются так, что isGammaCorrectionPass всегда последний. Финальный SMAA-пасс: fullscreenMaterial.encodeOutput = true (там и происходит linear->sRGB).

```glsl
AE=function(){this.composer=new tA({renderToScreen:!0});const i=new Jo;this.renderPass=new dE(i,i.camera,void 0,this.renderer.clearColor,this.renderer.clearAlpha),this.composer.addPass(this.renderPass);const e=new Fd().addSMAA({quality:"high"});e.isGammaCorrectionPass=!0,this.composer.addPass(e)};
// addPass сортирует пассы:
addPass(e){...this.passes.sort((s,n)=>{const r=[s,n].map(a=>a.isGammaCorrectionPass?1:0);return r[0]-r[1]})}
// addSMAA:
addSMAA(e={}){const s=new Or(ml,new XB({preset:so[e.quality?.toUpperCase()||"HIGH"]}));return s.renderToScreen=!0,s.fullscreenMaterial.encodeOutput=!0,this._effectComposer.addPass(s),this}
```

**Что делать у нас.** Ставить композер в порядке: RenderPass -> LUT/цветокор -> Bloom -> SMAA(high). Рендерить в HalfFloat, кодировать в sRGB ТОЛЬКО в последнем пассе. Никакого GammaCorrection в середине - иначе двойная гамма и есть тот самый пересвет.

Строка бандла: 13472

### БЛУМ - точные числа, три вызова на три сцены

**Числа.** Сцена igloo (строка 16312): addBloom({debug:devScene, levels:6, luminanceThreshold:0.2, intensity:1, radius:0.85}). Сцена cubes (строка 17646): те же числа - levels:6, luminanceThreshold:0.2, intensity:1, radius:0.85. Сцена entry (строка 19733): levels:6, luminanceThreshold:0, intensity:1, radius:0.85. Плюс форсированный mipmapBlur:true во всех трёх (addBloom подставляет ...e,mipmapBlur:!0). Не переопределены дефолты BloomEffect: blendFunction=SCREEN, luminanceSmoothing=0.025, kernelSize=fr.LARGE, resolutionScale=0.5. На интро блум подтягивается: intensity 1.5 -> 1, duration 2, ease "sine.inOut", старт на 2.5 с таймлайна.

```glsl
// igloo scene
e.addPass(new Fd().addBloom({debug:q.devScene,levels:6,luminanceThreshold:.2,intensity:1,radius:.85}))
// cubes scene (строка 17646) - идентично
// entry scene (строка 19733)
e.addPass(new Fd().addBloom({debug:q.devScene,levels:6,luminanceThreshold:0,intensity:1,radius:.85}))
// дефолты BloomEffect в библиотеке:
n_=class extends Bc{constructor({blendFunction:i=ct.SCREEN,luminanceThreshold:e=.9,luminanceSmoothing:t=.025,mipmapBlur:s=!1,intensity:n=1,radius:r=.85,levels:a=8,kernelSize:o=fr.LARGE,resolutionScale:l=.5,...}={})
// addBloom всегда включает mipmapBlur:
addBloom(e={}){const t=new Or(ml,new n_({...e,mipmapBlur:!0}));return t.fullscreenMaterial.encodeOutput=!1,...}
// анимация интенсивности на интро:
this.introTL.fromTo(e,{value:1.5},{value:1,duration:2,ease:"sine.inOut"},2.5)
```

**Что делать у нас.** У нас: UnrealBloom/BloomEffect с threshold 0.2 (не 0!), strength/intensity 1.0, radius 0.85, mipmap-блюр на 6 уровней, blend SCREEN, resolutionScale 0.5. Порог 0.2 - именно то, что не даёт светлому фону цвести. У нас, скорее всего, порог около 0 и сила больше 1 - отсюда пересвет. Для тёмной/входной сцены порог можно опустить до 0, но там и фон тёмный.

Строка бандла: 16312

### ЦВЕТОКОР = 3D-LUT в тетраэдральной интерполяции, отдельный LUT на каждую сцену. Это и есть их «тон»

**Числа.** Сцена igloo: tLUT = le.load("igloo/igloo_scene.ktx2","luttetrahedral"), uLUTSize = ширина картинки LUT (подставляется после загрузки), uLUTIntensity = 1, uGradientAlpha = 0 -> 1 (duration 4, ease "sine.inOut", старт 1 на интро-таймлайне). Сцена cubes: tLUT = le.load("cubes/cube_scene.ktx2","luttetrahedral"), uLUTIntensity = 1. Сцена entry: LUT НЕТ вообще, только дисторшн + блик. LUT грузится как Data3DTexture, magFilter=minFilter=1003 (NearestFilter) - интерполяция делается вручную тетраэдрально в шейдере.

```glsl
let m3=class extends fe{constructor(){super({uniformsGroups:[he.UBO],uniforms:{tDiffuse:{value:null},tLUT:{value:le.load("igloo/igloo_scene.ktx2","luttetrahedral")},uLUTSize:{value:1},uLUTIntensity:{value:1},uGradientAlpha:{value:0}},
fragmentShader:`
    uniform sampler3D tLUT;
    uniform float uLUTSize;
    uniform float uLUTIntensity;
    uniform float uGradientAlpha;

    void main() {
        vec2 uv = vUv;
        vec3 scene = texture2D(tDiffuse, uv).rgb;
        float gradient = mix(0.8, 1.0, (uv.x + uv.y) * 0.5);
        gradient = mix(1.0, gradient, uGradientAlpha);
        scene *= gradient;
        vec3 sceneColor = apply3DLUTTetrahedral(scene.rgb, tLUT, uLUTSize, uLUTIntensity);
        gl_FragColor = vec4(sceneColor, 1.0);
    }`})}}
// сам LUT-хелпер (строка 14645):
vec3 apply3DLUTTetrahedral(vec3 color,sampler3D lutTexture,float lutSize,float lutIntensity){float scale=lutSize-1.0;float offset=0.0;float texelSize=1.0/lutSize;vec3 col=LUTLinearTosRGB(color);vec3 rgb=clamp(col,0.0,1.0)*scale+offset;vec3 p=floor(rgb);vec3 f=rgb-p;vec3 v1=(p+0.5)*texelSize;vec3 v4=(p+1.5)*texelSize;...return LUTsRGBToLinear(mix(col,result.rgb,lutIntensity));}
vec3 LUTLinearTosRGB(in vec3 value){return mix(pow(value.rgb,vec3(0.41666))*1.055-vec3(0.055),value.rgb*12.92,vec3(lessThanEqual(value.rgb,vec3(0.0031308))));}
vec3 LUTsRGBToLinear(in vec3 value){return mix(pow(value.rgb*0.9478672986+vec3(0.0521327014),vec3(2.4)),value.rgb*0.0773993808,vec3(lessThanEqual(value.rgb,vec3(0.04045))));}
```

**Что делать у нас.** Главный рычаг «сделать как у igloo 1:1». Вместо подкрутки материалов - собрать ОДИН .cube LUT (например 32x32x32), запечь в него всю холодную серо-голубую гамму, скормить как Data3DTexture с NearestFilter и применять тетраэдрально этим же шейдером. Диагональный градиент mix(0.8,1.0,(uv.x+uv.y)*0.5) - мягкая направленная виньетка: левый-нижний угол на 20% темнее. Это единственная виньетка в проекте.

Строка бандла: 14645

### ЗЕРНА (film grain) в цветокоре НЕТ - код закомментирован. И RGB-shift тоже закомментирован

**Числа.** Закомментировано: noise = hash32(uv*1000.0 + time); noise *= 2.0; noise -= 1.0; sceneColor += noise * 0.05. Закомментирован rgb-шифт: offset = 0.08 * length(vUv - 0.5), offset = pow(offset, 2.0). Живое дизеринговое зерно есть только в фоне сцены cubes: color += noise.rgb * 0.05 из blue-noise текстуры.

```glsl
// строки 14692-14696, ЗАКОММЕНТИРОВАНО:
// film grain
// vec3 noise = hash32(uv * 1000.0 + time);
// noise *= 2.0;
// noise -= 1.0;
// sceneColor += noise * 0.05;

// строка 14677-14683, тоже ЗАКОММЕНТИРОВАНО:
// apply rgb shift
// float offset = 0.08 * length(vUv - 0.5);
// offset = pow(offset, 2.0);
// float r = texture2D(tDiffuse, uv + vec2(-offset, offset)).r;

// живое зерно только в фоне cubes (строка ~16400):
vec4 noise = getNoise(tBlue, gl_FragCoord.xy, uBlueOffset);
color += noise.rgb * 0.05;
```

**Что делать у нас.** Не вешать зерно на весь кадр. Если нужно убрать бандинг на градиентах - только blue-noise в шейдере фона на 0.05, как у них, а не постпасс на всю сцену.

Строка бандла: 14692

### ХРОМАТИЧЕСКАЯ АБЕРРАЦИЯ - не постпасс на всю сцену, а только в шейдере ПЕРЕХОДА между сценами

**Числа.** CA_ITERATIONS = 5. RECI_ITER = 1/5. Барабанная дисторсия: coord + cc*dot(cc,cc)*amt. Спектр: pow(ret, vec4(1.0/2.2)). Модулятор силы: 12.0 * smoothstep(1.0,0.7,abs(vUv.x*2-1)) * smoothstep(1.0,0.7,abs(vUv.y*2-1)) - в переходе сцен; 8.0 * smoothstep(1.0,0.5,...) - в открытии карточки. parallaxY = 0.4, displacement = 0.025. Отдельно у ледяного куба своя CA в преломлении: uChromaticAberration = 0.1, AWESOME_SAMPLES = 3.

```glsl
#ifndef CA_ITERATIONS
const int CA_ITERATIONS=5;
#endif
const float RECI_ITER=1.0/float(CA_ITERATIONS);
vec2 ca_barrelDistortion(vec2 coord,float amt){vec2 cc=coord-0.5;float dist=dot(cc,cc);return coord+cc*dist*amt;}
vec4 ca_spectrum_offset(float t){vec4 ret;float lo=step(t,0.5);float hi=1.0-lo;float w=ca_linterp(ca_remap(t,1.0/6.0,5.0/6.0));ret=vec4(lo,1.0,hi,1.0)*vec4(1.0-w,w,1.0-w,1.0);return pow(ret,vec4(1.0/2.2));}
vec4 chromatic_aberration(sampler2D text,vec2 uv,float maxdistort,float bendAmount){vec4 sumcol=vec4(0.0);vec4 sumw=vec4(0.0);for(int i=0;i<CA_ITERATIONS;++i){float t=float(i)*RECI_ITER;vec4 w=ca_spectrum_offset(t);sumw+=w;sumcol+=w*texture2D(text,ca_barrelDistortion(uv,bendAmount*maxdistort*t));}return sumcol/sumw;}

// применение (строки 14540-14552):
const float parallaxY = 0.4;
const float displacement = 0.025;
vec4 noise = getNoise(tBlue, gl_FragCoord.xy, uBlueOffset);
float modulator = 12.0 * smoothstep(1.0, 0.7, abs(vUv.x * 2.0 - 1.0)) * smoothstep(1.0, 0.7, abs(vUv.y * 2.0 - 1.0));
if (cut < 1.0) scene1 = chromatic_aberration(tScene1, vUv - vec2(0.0, parallaxY * power2In(uProgress) + displacement * cutDisp), modulator, cutDiagonalBlur * noise.r).rgb;
if (cut > 0.0) scene2 = chromatic_aberration(tScene2, vUv + vec2(0.0, parallaxY * power2In(1.0 - uProgress) + displacement * (1.0 - cutDisp)), modulator, (1.0 - cutDiagonalBlur) * noise.g).rgb;
color = clamp(mix(scene1, scene2, cut), vec3(0.0), vec3(1.0));
```

**Что делать у нас.** Не вешать глобальную аберрацию. Включать её только на кадрах перехода, силой modulator, которая гаснет к краям (smoothstep 1.0->0.7 по обеим осям), и глушить швы blue-noise'ом. В покое аберрации на экране НЕТ - оттого картинка чистая.

Строка бандла: 14448

### ГЛУБИНЫ РЕЗКОСТИ (DOF), god rays, классической виньетки - в проекте НЕТ, хотя методы в библиотеке есть

**Числа.** Методы addDOF (worldFocusDistance:4, worldFocusRange:10, bokehScale:5, resolutionScale:0.5), addGodRays (kernelSize SMALL), addSelectiveBloom, addKawaseBlur, addGaussianBlur, addFXAA, addGammaCorrection объявлены в классе Fd (строка 13468), но в прикладном коде НЕ вызываются НИ РАЗУ. Реально вызываются только addSMAA({quality:"high"}) один раз и addBloom три раза.

```glsl
addDOF(e,t,s={}){...const n=new Or(e,new TB(e,{resolutionScale:.5,worldFocusDistance:4,worldFocusRange:10,bokehScale:5,...s}));...}
// вызовов addDOF/addGodRays/addFXAA/addGammaCorrection/addKawaseBlur/addGaussianBlur/addSelectiveBloom в прикладном коде: 0
```

**Что делать у нас.** Убрать у нас DOF/боке и виньетку-постпасс, если они есть. Размытие фона у igloo достигается не DOF, а туманом-в-шейдере (см. ниже) и запечённой текстурой. Экономит кадры и не даёт мыла.

Строка бандла: 13468

### ТУМАН: THREE.Fog/FogExp2 НЕ используются НИ РАЗУ. Туман целиком нарисован в шейдере гор, по экранному диагональному градиенту

**Числа.** scene.fog нигде не присваивается. Формула тумана гор: fogColor = mix(uColor2, uColor1, grad), где grad = pow((screenUv.x+screenUv.y)*0.5, 2.0). uColor1 = #d1d6e3, uColor2 = #afb6c7. distanceFog = clamp(-vMvPos.z * 0.005, 0.0, 1.0). fog = clamp(1.0 - vWorldPos.y*0.05 - 0.5, 0.0, 1.0); fog += distanceFog * 0.75. Подмешивание: color = mix(color, fogColor*1.1 + smoothstep(0.5,1.0,color.r), fog).

```glsl
// fog gradient
vec2 screenUv = gl_FragCoord.xy / resolution;
float grad = (screenUv.x + screenUv.y) * 0.5;
grad = pow(grad, 2.0);
vec3 color1 = uColor1;   // #d1d6e3
vec3 color2 = uColor2;   // #afb6c7
vec3 fogColor = mix(color2, color1, grad);

vec3 color = texture2D(tMap, vUv).rgb;
float alpha = 1.0;

float distanceFog = clamp(-vMvPos.z * 0.005, 0.0, 1.0);
float fog = clamp(1.0 - vWorldPos.y * 0.05 - 0.5, 0.0, 1.0);
fog += distanceFog * 0.75;
...
// fog
color = mix(color, fogColor * 1.1 + smoothstep(0.5, 1.0, color.r), fog);

gl_FragColor = vec4(color, alpha);
```

**Что делать у нас.** Выкинуть scene.fog. Вместо него в шейдере дальних объектов: экранный диагональный градиент в квадрате между двумя цветами тумана, дальность = -viewPos.z * 0.005 (то есть на 200 юнитах туман полный), высотный член 1.0 - worldY*0.05 - 0.5 (внизу гуще). fogColor умножается на 1.1 - туман чуть ярче фона, за счёт этого дальний план «съедается», а не сереет.

Строка бандла: 15044

### НЕБО/ФОН сцены igloo - вывернутая сфера радиуса 800, тот же диагональный градиент, что и туман

**Числа.** new SphereGeometry(800, 12, 12); side = ei (BackSide); mesh.scale.x = -1; rotation.x = 16*3.14/180; rotation.z = -16*3.14/180; name="sky". uColor1 = #d1d6e3, uColor2 = #afb6c7, uIntroColor = #b3bac9, uProgress 0->1. grad = pow((screenUv.x+screenUv.y)*0.5, 2.0); color = mix(color2, color1, grad); затем color = mix(uIntroColor, color, uProgress).

```glsl
init(){const e=new bd(800,12,12),t=new fe({uniformsGroups:[he.UBO],uniforms:{uColor1:{value:new Z("#d1d6e3")},uColor2:{value:new Z("#afb6c7")},uIntroColor:{value:new Z("#b3bac9")},uProgress:{value:0}},
fragmentShader:`
    void main() {
        // light to dark gradient
        vec2 screenUv = gl_FragCoord.xy / resolution;
        float grad = (screenUv.x + screenUv.y) * 0.5;
        grad = pow(grad, 2.0);
        vec3 color1 = uColor1;
        vec3 color2 = uColor2;
        vec3 color = mix(color2, color1, grad);

        // intro animation
        color = mix(uIntroColor, color, uProgress);

        gl_FragColor = vec4(color, 1.0);
    }`,side:ei});
this.mesh=new Ce(e,t),this.mesh.name="sky",this.mesh.scale.x=-1,this.mesh.rotation.x=16*3.14/180,this.mesh.rotation.z=-16*3.14/180,...
```

**Что делать у нас.** Вот база нашей «светлой темы» 1:1: фон - не однотонный цвет и не HDRI, а экранный диагональный градиент #afb6c7 -> #d1d6e3 с гаммой pow(...,2.0), нарисованный на гигантской сфере BackSide радиуса 800. Верх-право светлее, низ-лево темнее. Тот же градиент подмешивается как туман в горы. Никакого белого фона.

Строка бандла: 14700

### ФОН сцены cubes (портфолио) - перлин-шум между двумя цветами + точечный паттерн + blue-noise против бандинга

**Числа.** uColor1 = #c9d0df, uColor2 = #545b6b. screenUv = vUv; screenUv.x *= aspect; screenUv *= 0.3. t = time * 0.075. offset1 = vec2(-t, t*0.25); offset2 = vec2(t, -t*0.5). offset1.y -= uProgress*0.25; offset1.y -= uProgress*0.4. perlin = tPerlin(screenUv+offset1).r + tPerlin(screenUv*0.5+offset2).r; perlin *= 0.5. color = mix(uColor1, uColor2, perlin). dotUv = screenUv*45.0; dotUv += vec2(0.0, -uProgress*10.0). dotfade = 1.0 - abs(fract(dotid + time*0.1) - 0.5)*2.0. color += dots*dotfade. color += noise.rgb*0.05. depthTest:false, depthWrite:false, renderOrder = -99.

```glsl
uniforms:{uProgress:{value:0},uColor1:{value:new Z("#c9d0df")},uColor2:{value:new Z("#545b6b")},tPerlin:...,tDotPattern:le.load("cubes/dot_pattern.ktx2","srgb-repeat"),tBlue:le.load("noises/blue-8-128-rgb.ktx2","colordata-repeat"),uBlueOffset:{value:new H}}

void main() {
    vec2 screenUv = vUv;
    screenUv.x *= aspect;
    screenUv *= 0.3;
    float t = time * 0.075;
    vec2 offset1 = vec2(-t, t * 0.25);
    vec2 offset2 = vec2(t, -t * 0.5);
    // match scroll
    offset1.y -= uProgress * 0.25;
    offset1.y -= uProgress * 0.4;
    // perlin noise
    float perlin = texture2D(tPerlin, screenUv + offset1).r;
    perlin += texture2D(tPerlin, screenUv * 0.5 + offset2).r;
    perlin *= 0.5;
    vec3 color = mix(uColor1, uColor2, perlin);
    // dot pattern
    vec2 dotUv = screenUv * 45.0;
    dotUv += vec2(0.0, -uProgress * 10.0);
    float dots = texture2D(tDotPattern, dotUv).r;
    float dotid = hash12(floor(dotUv));
    float dotfade = 1.0 - abs(fract(dotid + time * 0.1) - 0.5) * 2.0;
    color += dots * dotfade;
    // blue noise to prevent banding
    vec4 noise = getNoise(tBlue, gl_FragCoord.xy, uBlueOffset);
    color += noise.rgb * 0.05;
    gl_FragColor = vec4(color, 1.0);
}
```

**Что делать у нас.** Второй экран у нас можно делать ровно так: полноэкранный треугольник renderOrder=-99, depthTest off, mix двух цветов по двухслойному перлину, ползущему со скоростью time*0.075, плюс мерцающая точечная сетка, плюс blue-noise 0.05. Даёт живой, не плоский фон без единого источника света.

Строка бандла: 16349

### ФОН сцены entry (внутри иглу) - диагональный градиент по экрану, промодулированный двумя синус-шумами, с яркостью 1.1

**Числа.** uColor1 = #6a6f7d, uColor2 = #e1e6f1 (эта пара повторяется в 4 объектах сцены entry: lightroom строка 17718, floor строка 17955, forcefield строка 18269, ceilingsmoke строка 19342). diagonalGradient = (screenUv.x+screenUv.y)*0.5; *= sinenoise1(vec3(screenUv, time*0.614))*0.5+0.5; *= sinenoise1(vec3(screenUv*2.0, time*0.17))*0.5+0.5. bg = mix(uColor1, uColor2, diagonalGradient); bg *= 1.1. color = mix(bg, color, vFade*0.95). Свечение: color += tGlow.r * vec3(0.5,0.7,1.0) * n1 * glowFalloff * 0.8 * camFactor, где glowFalloff = smoothstep(0.2,0.4,1.0-vFalloff), camFactor = pow(1.0-clamp(-cameraPosition.z,0.0,1.0),4.0).

```glsl
void main() {
    float alpha = 1.0;
    vec3 color = texture2D(tMap, vUv).rgb;

    // background gradient
    vec2 screenUv = gl_FragCoord.xy / resolution;
    float diagonalGradient = (screenUv.x + screenUv.y) * 0.5;
    diagonalGradient *= sinenoise1(vec3(screenUv, time * 0.614)) * 0.5 + 0.5;
    diagonalGradient *= sinenoise1(vec3(screenUv * 2.0, time * 0.17)) * 0.5 + 0.5;
    vec3 bg = mix(uColor1, uColor2, diagonalGradient);
    bg *= 1.1;
    color = mix(bg, color, vFade * 0.95);

    // emissive
    float falloff = 1.0 - vFalloff;
    float glowFalloff = smoothstep(0.2, 0.4, falloff);
    float n1 = sinenoise1(vPos + time * 0.5 + color.r * 5.0) * 0.5 + 0.5;
    n1 = n1 * 0.5 + 0.5;
    float camFactor = pow(1.0 - clamp(-cameraPosition.z, 0.0, 1.0), 4.0);
    color += texture2D(tGlow, vUv).r * vec3(0.5, 0.7, 1.0) * n1 * glowFalloff * 0.8 * camFactor;

    gl_FragColor = vec4(color, alpha);
}
```

**Что делать у нас.** Для «внутренней» сцены брать пару #6a6f7d / #e1e6f1, тот же диагональный градиент, но промодулированный двумя медленными синус-шумами (скорости 0.614 и 0.17) - фон дышит. Множитель 1.1 - фон чуть ярче объектов, объекты читаются силуэтом. Голубое свечение везде одного оттенка vec3(0.5, 0.7, 1.0).

Строка бандла: 17884

### ФЕЙКОВЫЙ СВЕТ на главной модели иглу - вместо ламп прямые формулы в шейдере (это ключ к «не пересвечено»)

**Числа.** Голубой оттенок света: blue = vec3(0.5, 0.7, 1.0). Смешение двух лайтмапов: textureMix = clamp(5.0*vDisplacement, 0.0, 1.0), exploded-лайтмап поднят на +0.05. Эмиссия от смещения: color += pow(vEmission, 2.0) * clamp(1.0*vDisplacement,0,1) * blue. Дежурная эмиссия: powEmission = pow(vEmission, 8.0) * blue * 0.5, домножается на sin(vPos.x - time*1.0 + 3.2)*0.5+0.5. Внутреннее свечение: += max(0.0, smoothstep(0.0,2.0, vPos.x*0.5 - vPos.z*0.5)) * powEmission. ФЕЙКОВОЕ СОЛНЦЕ/SSS: color += (vPos.x*0.1 + 0.4) * 0.3 * min(vPos.y+0.5, 1.0) * 0.5. Отскок от земли: color += (1.0 - smoothstep(-1.5, 1.0, vPos.y)) * vBounce * vec3(0.8, 0.9, 1.0) * 0.25. И обязательный clamp(color, 0.0, 1.0) ПЕРЕД отскоком.

```glsl
void main() {
    vec3 color = texture2D(tMap, vUv).rgb;
    vec3 exploded = texture2D(tMapExploded, vUv).rgb + 0.05;
    vec3 blue = vec3(0.5, 0.7, 1.0);

    // fade between 'together' lightmap and 'exploded' lightmap, based on displacement
    float textureMix = clamp(5.0 * vDisplacement, 0.0, 1.0);
    color = mix(color, exploded, textureMix);

    // intro animation
    if (uIntroMaterialize < 1.0) {
        float introEmissive = 1.0 - falloffsmooth(vPos.y, 3.95, -0.4, 1.5, uIntroMaterialize);
        if (introEmissive > 0.9999) discard;
        float triangles = texture2D(tTriangles, vUv * 5.0).r;
        introEmissive += clamp(introEmissive * triangles * 13.0, 0.0, 1.0);
        color += introEmissive * blue;
    }

    // add emission based on displacement
    color += pow(vEmission, 2.0) * clamp(1.0 * vDisplacement, 0.0, 1.0) * blue;

    // add idle emission;
    vec3 powEmission = pow(vEmission, 8.0) * blue * 0.5;
    color += powEmission * (sin(vPos.x - time * 1.0 + 3.2) * 0.5 + 0.5);

    // make inside of igloo glow, on faces furthest from camera
    color += max(0.0, smoothstep(0.0, 2.0, vPos.x * 0.5 - vPos.z * 0.5)) * powEmission;

    // add fake sss from sunlight (just a sideways gradient, but kept dark near the ground)
    color += (vPos.x * 0.1 + 0.4) * 0.3 * min(vPos.y + 0.5, 1.0) * 0.5;

    // color safety
    color = clamp(color, vec3(0.0), vec3(1.0));

    // add ground bounce
    float verticalGrad = (1.0 - smoothstep(-1.5, 1.0, vPos.y));
    color += (1.0 - smoothstep(-1.5, 1.0, vPos.y)) * vBounce * vec3(0.8, 0.9, 1.0) * 0.25;

    gl_FragColor = vec4(color, 1.0);
}
```

**Что делать у нас.** Ровно то, что нам надо вместо ламп: боковой градиент по X как «солнце» с амплитудой 0.3*0.5=0.15 максимум и высотной маской min(y+0.5,1.0); отскок от земли снизу голубым vec3(0.8,0.9,1.0) силой 0.25; clamp(color, 0, 1) перед последним слоем. Никакого PBR, никакого нормала - только позиция вершины. Пересвета быть не может физически, потому что каждое слагаемое ограничено долями единицы.

Строка бандла: 16098

### Единственный PBR-материал во всём сайте - ледяной куб. И единственный источник освещения - его envMap

**Числа.** MeshPhysicalMaterial: color = "#e0e8ef", roughness = 0.65 (+ roughnessMap cubes/<obj>_roughness.ktx2), envMap = PMREM из cubes_env.exr (равнопрямоугольная EXR), envMapIntensity = 0.91, envMapRotation.y = Math.PI, normalMap = cubes/<obj>_normal.ktx2, normalScale = (1,1), ior = 1.18, reflectivity = 0.3, transmission = 0. Кастомные униформы: AWESOME_SAMPLES = 3, uColorFrost = "#83a1c5", uChromaticAberration = 0.1, uTransmission = 1, uThickness = 2, uAttenuationDistance = 0, uAttenuationColor = "#ffffff".

```glsl
this.mesh=new bE(e,new WL(3));
[this.mesh].forEach(s=>{
  s.material.color.setStyle("#e0e8ef"),
  s.material.roughnessMap=le.load(`cubes/${this.options.obj}_roughness.ktx2`),
  s.material.roughness=.65,
  s.material.envMap=this.scene.envmap,
  s.material.envMapIntensity=.91,
  s.material.envMapRotation.y=Math.PI,
  s.material.normalMap=le.load(`cubes/${this.options.obj}_normal.ktx2`),
  s.material.normalScale.set(1,1),
  s.material.ior=1.18,
  s.material.reflectivity=.3,
  s.material.transmission=0
});
// класс материала (строка 16486):
class WL extends Ys{constructor(e=5){super(),this.defines.AWESOME_SAMPLES=e,this.uniforms={tTriangles:...,tBlue:...,uBlueOffset:{value:new H},tMouseFrost:{value:null},uColorFrost:{value:new Z("#83a1c5")},uChromaticAberration:{value:.1},uTransmission:{value:1},uThickness:{value:2},uAttenuationDistance:{value:0},uAttenuationColor:{value:new Z("#ffffff")},...}
// envmap (строка 17646):
async createEnvironmentMap(){const e=le.load("cubes_env.exr"),t=new kp(he.renderer.webgl);await e._loaded,this.envmap=t.fromEquirectangular(e).texture,t.dispose()}
```

**Что делать у нас.** Если у нас есть стеклянные/ледяные объекты - вот точные цифры: envMapIntensity 0.91 (НЕ 1 и не 2 - отсюда наш пересвет металла/стекла), roughness 0.65, ior 1.18, reflectivity 0.3, transmission ноль (преломление считается вручную). Освещать сцену ТОЛЬКО этой envMap, без ламп.

Строка бандла: 17429

### ПОЛНЫЙ СПИСОК ЦВЕТОВ СЦЕНЫ В HEX, с привязкой к объекту

**Числа.** CSS-фон страницы/прелоадера: --bgColor #A0A5B1 (igloo-main.js). UI-текст: colorLogo #ffffff, colorTitle #3C3C54, colorText #ffffff, colorProjectTitle #67707E, colorProjectText #A1AAB7. Небо (sky, сфера 800): uColor1 #d1d6e3, uColor2 #afb6c7, uIntroColor #b3bac9. Горы (mountain1..5): uColor1 #d1d6e3, uColor2 #afb6c7. Оверлей интро (mix поверх всей сцены): #8b909d. Каркас иглу (igloo_cage) и контур (igloo_outline): #a7b2d6, opacity 0.3, blending Additive(2), depthTest false, renderOrder 999. Частицы интро: uColor1 #cda05e, uColor2 #ab8349, uOutlineColor #904619 (единственные тёплые цвета в проекте). Снежинки (snowparticles): #ffffff, uSize 200. Плексус иглу: #ffffff. Фон cubes: #c9d0df / #545b6b. Размытый текст cubes: #c9d0df. Лёд куба: #e0e8ef, изморозь #83a1c5. Плексус кубов: точки #666666 (uSize 50), линии #7f7f7f. Внутренность куба: #886a3d. Сцена entry (lightroom/floor/forcefield/ceilingsmoke): #6a6f7d / #e1e6f1. Кольцо комнаты (roomring): vec3(2.0) - белый в двойной яркости, под блум. Частицы контейнера: uColorInitial #b5d5ff, uColorLight #bdc6d4, uColorDark #222b42, uColorFast #d7ebfa. Треугольники UI (arrow/links/projects): #09121f / #6b7685. Пылинки и световой столб: #d1e3ff. Плоскость света: #2d3133. Общий голубой оттенок свечения во всех шейдерах: vec3(0.5, 0.7, 1.0); шоквейв-синий vec3(0.3, 0.45, 1.0); отскок от земли vec3(0.8, 0.9, 1.0).

```glsl
// igloo-main.js: html{--default-font: sans-serif;--bgColor: #A0A5B1}
// строка 14437:
const Be={gridSize:125,gridSizeLow:50,gridSizeMobile:25,topMargin:90,topMarginLow:45,topMarginMobile:25,breakpointW:1600,breakpointH:800,breakPointMobile:640,colorLogo:"#ffffff",colorTitle:"#3C3C54",colorText:"#ffffff",colorProjectTitle:"#67707E",colorProjectText:"#A1AAB7",...}
// 14612: uniforms:{tScene:{value:null},uColor:{value:new Z("#8b909d")},uIntro:{value:0}}  // финальный оверлей
// 14700: uColor1 #d1d6e3, uColor2 #afb6c7, uIntroColor #b3bac9  // sky
// 14952: new _3({color:"#a7b2d6",opacity:.3,transparent:!0}) blending=pt(2=Additive) // igloo_cage
// 14993: new E3({color:"#a7b2d6",opacity:.3}) // igloo_outline; и mountain uColor1 #d1d6e3 / uColor2 #afb6c7
// 15630: uColor1 #cda05e, uColor2 #ab8349, uOutlineColor #904619 // intro_particles
// 15923: uColor #ffffff, uSize 200 // snowparticles
// 16349: uColor1 #c9d0df, uColor2 #545b6b // cubes bg
// 16486: uColorFrost #83a1c5, uAttenuationColor #ffffff
// 17262: uColor #666666, uSize 50 // plexus points
// 17358: uColor #7f7f7f // plexus lines
// 17437: uColor1 #886a3d
// 17718/17955/18269/19342: uColor1 #6a6f7d, uColor2 #e1e6f1
// 18776: uColorInitial #b5d5ff, uColorLight #bdc6d4, uColorDark #222b42, uColorFast #d7ebfa
// 20287: uColor1 #09121f, uColor2 #6b7685
// 20434/20467: uColor #d1e3ff ; 20503: uColor #2d3133
```

**Что делать у нас.** Взять этот список как палитру 1:1. Ядро светлой темы - четыре цвета: #afb6c7 (тень фона), #d1d6e3 (свет фона), #a7b2d6 (контуры/каркас), #8b909d (общий приглушающий оверлей). Ни одного чистого белого в фоне и в объектах - белый только у текста, снега и кольца. Тёмных цветов в светлой сцене всего два: #545b6b и #09121f, и оба используются как нижняя точка градиента, не как заливка.

Строка бандла: 14437

### Весь «свет» на земле и горах - это ЗАПЕЧЁННЫЕ lightmap-текстуры KTX2, а не расчёт

**Числа.** Список запечённых карт: igloo/ground_color.ktx2, igloo/ground_glow.ktx2, igloo/ground_sansigloo_color.ktx2, igloo/igloo_color.ktx2, igloo/igloo_exploded_color.ktx2 (второй лайтмап под разлёт), igloo/mountain_color.ktx2, floor_color.ktx2, shattered_ring_color.ktx2 + shattered_ring_ao.ktx2, cubes/<obj>_roughness.ktx2, cubes/<obj>_normal.ktx2. Плюс LUT-ы igloo/igloo_scene.ktx2 и cubes/cube_scene.ktx2. Все цветовые грузятся с colorSpace "srgb" (Ve), LUT-ы как Data3DTexture с NearestFilter (1003), все остальные LinearFilter (1006).

```glsl
// строка 13433, loader:
s.startsWith("ktx2")?(r=Di.KTX2, n.includes("3d")||n.includes("lut")?a=new DA /*Data3DTexture*/ : n.includes("cubemap")?a=new Vy : a=new bc):...
const l=n.includes("srgb")||i===tp?Ve:a.colorSpace; a.colorSpace=l;
n.includes("nearest")||n.includes("luttetrahedral")?(a.magFilter=gt,a.minFilter=gt):(a.magFilter=_t,a.minFilter=_t)
// gt=1003 NearestFilter, _t=1006 LinearFilter, Ve="srgb"

// использование двух лайтмапов на иглу (строка 16099):
vec3 color = texture2D(tMap, vUv).rgb;              // igloo_color.ktx2
vec3 exploded = texture2D(tMapExploded, vUv).rgb + 0.05;  // igloo_exploded_color.ktx2
float textureMix = clamp(5.0 * vDisplacement, 0.0, 1.0);
color = mix(color, exploded, textureMix);
```

**Что делать у нас.** Нам надо запечь освещение в текстуры моделей (Blender bake -> Combined/Diffuse+lightmap, экспорт в KTX2/basis) и рендерить их плоско, без ламп. Иначе 1:1 не получится никогда - у igloo в кадре нет ни одного вычисляемого источника. Для варианта «разлетелось» держать ВТОРОЙ лайтмап и смешивать его по величине смещения.

Строка бандла: 13433

### Каждый шейдер жёстко зажимает цвет перед выводом. Пересвет невозможен по построению

**Числа.** color = clamp(color, vec3(0.0), vec3(1.0)) - в шейдере иглу (строка 16132), гор (15137), земли (14900), терраина (15343). alpha = clamp(alpha, 0.0, 1.0). В пассе entry: gl_FragColor = vec4(clamp(sceneColor, 0.0, 1.0), 1.0). В пассе перехода: color = clamp(mix(scene1, scene2, cut), vec3(0.0), vec3(1.0)).

```glsl
// igloo (16131):
// color safety
color = clamp(color, vec3(0.0), vec3(1.0));

// mountain (15132):
alpha = clamp(alpha, 0.0, 1.0);
alpha *= 1.0 - smoothstep(0.7, 0.9, length(vPos.xz) * 0.1085);
color = clamp(color, vec3(0.0), vec3(1.0));

// roomring (17695) - единственный намеренный overbright:
vec3 color = vec3(2.0);
```

**Что делать у нас.** Добавить clamp(color, 0.0, 1.0) в конец каждого нашего фрагментного шейдера ПЕРЕД выводом (и перед последним добавочным слоем, как у них у иглу). Единственное место, где значение специально уходит за единицу - кольцо roomring с vec3(2.0), и оно именно затем, чтобы поймать порог блума 0.2.

Строка бандла: 16132

### Пасс сцены entry: не LUT, а искажение кольца + диагональный блик, всё через HSV

**Числа.** bluramount = 0.3. Сдвиг угла: angle + 0.3*(noise.r-0.5)*uRingProximity. Квадраты: tScroll(newUv1*1.5 + uSquareAttr.rg).g*2-1, сдвиг *0.01*uSquareAttr.b*uRingProximity. Подсветка в HSV: scene.g += 0.05*uRingProximity (насыщенность), scene.b += 0.075*uRingProximity (яркость), только если length(scene) < length(vec3(1.0)). Блик: diagonalGradient = pow(vUv.x*vUv.y, 2.0); sceneColor += diagonalGradient * (sinenoise1(vec3(vUv.x*aspect, vUv.y, time*0.5))*0.4 + 0.4) * vec3(0.8, 0.9, 1.0) * noise.b * 2.0.

```glsl
// highlight only when not already white
if (length(scene) < length(vec3(1.0))) {
    scene = rgb2hsv(scene);
    scene.g += 0.05 * uRingProximity;
    scene.b += 0.075 * uRingProximity;
    scene = hsv2rgb(scene);
}
...
vec3 sceneColor = scene;

// glare
float diagonalGradient = pow(vUv.x * vUv.y, 2.0);
sceneColor += diagonalGradient * (sinenoise1(vec3(vUv.x * aspect, vUv.y, time * 0.5)) * 0.4 + 0.4) * vec3(0.8, 0.9, 1.0) * noise.b * 2.0;

gl_FragColor = vec4(clamp(sceneColor, 0.0, 1.0), 1.0);
```

**Что делать у нас.** Приём, который нам стоит взять целиком: подсветку делать в HSV и ТОЛЬКО там, где пиксель ещё не белый (length(scene) < length(vec3(1.0))). Так подсвечиваются тени и полутона, а света не выбиваются. Плюс диагональный блик pow(uv.x*uv.y, 2.0) голубоватого оттенка vec3(0.8,0.9,1.0), промодулированный blue-noise'ом.

Строка бандла: 19670

### Единственный «источник света» в шейдерах частиц - фиксированный вектор направления, не объект three

**Числа.** const o = new Vector3(-0.75, 1, -0.1), передаётся как uniform uLightPos в материал частиц контейнера (строка 18776) и в volumetric-материал VDB (строка 18909). Цвета той же системы: uColorInitial #b5d5ff, uColorLight #bdc6d4, uColorDark #222b42, uColorFast #d7ebfa, uSize 10.

```glsl
const o=new b(-.75,1,-.1);
this.mesh=new gE({count:this.particles,geometry:"points",material:new fe({uniformsGroups:[he.UBO],uniforms:{tTexture1:{value:null},tTexture2:{value:null},uColorInitial:{value:new Z("#b5d5ff")},uColorLight:{value:new Z("#bdc6d4")},uColorDark:{value:new Z("#222b42")},uColorFast:{value:new Z("#d7ebfa")},uSize:{value:10},uLightPos:{value:o},uVisible:{value:0},uAlpha:{value:1},uInitialGlow:{value:0}},...
```

**Что делать у нас.** Если нужен «направленный свет» - передавать вектор униформой и считать N·L руками. Никакого DirectionalLight в графе сцены. Вектор (-0.75, 1, -0.1) - слева-сверху-чуть-сзади.

Строка бандла: 18776

**Не найдено или не подтвердилось:**

- Переключения светлой и тёмной темы нет вообще - ни в App3D.js, ни в igloo-main.js. Тема одна: холодная светло-серо-голубая. Ноль совпадений на theme / prefers-color-scheme / darkMode / lightMode / data-theme.
- Ни одного источника света three.js: 0 вызовов new AmbientLight / DirectionalLight / HemisphereLight / PointLight / SpotLight в прикладной части бандла (строки >13900). Позиций, цветов и интенсивностей источников не существует - выписывать нечего.
- scene.fog и scene.background не присваиваются нигде. Нет ни THREE.Fog(color, near, far), ни FogExp2(color, density) - соответственно нет ни near/far, ни density.
- renderer.toneMapping и renderer.toneMappingExposure нигде не переопределяются - остаются дефолты three (NoToneMapping, 1.0). ACESFilmic / Reinhard / AgX в проекте не используются.
- renderer.outputColorSpace нигде не переопределяется - остаётся дефолт SRGBColorSpace.
- Классической виньетки (VignetteEffect, затемнение по length(uv-0.5)) как постпасса НЕТ. Есть только диагональное затемнение mix(0.8,1.0,(uv.x+uv.y)*0.5) внутри LUT-пасса сцены igloo.
- Зерна (film grain) в постобработке НЕТ - код закомментирован (строки 14692-14696). Раскомментированное зерно есть только как blue-noise 0.05 в фоне сцены cubes.
- Глубины резкости (DOF/боке) в проекте НЕТ: addDOF объявлен в библиотеке (worldFocusDistance 4, worldFocusRange 10, bokehScale 5), но не вызывается ни разу.
- God rays, SelectiveBloom, KawaseBlur, GaussianBlur, FXAA, отдельный GammaCorrectionPass - объявлены, но не вызываются ни разу.
- scene.environment / environmentIntensity не задаются. Единственная envMap - на материале ледяного куба (envMapIntensity 0.91), присваивается прямо материалу.
- HDRI-окружения для сцен igloo и entry нет. Единственный EXR во всём проекте - cubes_env.exr, и он только для кубов.
- Числовых значений внутри LUT-файлов (igloo/igloo_scene.ktx2, cubes/cube_scene.ktx2) в бандле нет - это бинарные KTX2 3D-текстуры, вся кривая цвета лежит в них. Чтобы повторить тон 1:1, эти два файла надо скачать с сайта отдельно.


## МОБИЛЬНЫЙ

### Детект устройства: класс-синглтон `q` (new OD) на базе UAParser 1.0.38. Даёт q.device ('desktop'|'mobile'|'tablet'), q.os.name, q.browser.name, q.capabilities.touch, q.oldIphone, q.screen.dpr

**Числа.** UAParser version "1.0.38"; device по умолчанию "desktop"; touch = 'ontouchstart' in window || navigator.maxTouchPoints>0 || navigator.msMaxTouchPoints>0; mac+touch → device="tablet", os="ios"; mobile+ios+window.devicePixelRatio<3 → oldIphone=true; screen.dpr = window.devicePixelRatio||1

```glsl
Oe(this,"device","desktop"),Oe(this,"visible",!0),Oe(this,"focused",!0),Oe(this,"electron",this.UAInfo.ua.toLowerCase().indexOf(" electron/")>-1),Oe(this,"oldIphone",!1),Oe(this,"devScene",!1),Oe(this,"os",{name:"unknown",fullVersion:"0",version:0}),Oe(this,"browser",{name:"unknown",fullVersion:"0",version:0}),Oe(this,"screen",{dpr:window.devicePixelRatio||1,aspectRatio:1,width:0,height:0,w:0,h:0}),Oe(this,"capabilities",{webgl2:ND.isWebGL2Available(),touch:"ontouchstart"in window||navigator.maxTouchPoints>0||navigator.msMaxTouchPoints>0,offscreenCanvas:!!HTMLCanvasElement.prototype.transferControlToOffscreen,...,imageBitmap:!0});
const s=(this.UAInfo.device.type||"").toLowerCase();switch(s){case"mobile":case"tablet":this.device=s;break}
...
this.os.name==="mac"&&this.capabilities.touch&&(this.device="tablet",this.os.name="ios"),this.device==="mobile"&&this.os.name==="ios"&&window.devicePixelRatio<3&&(this.oldIphone=!0);
```

**Что делать у нас.** Завести один синглтон Device: UAParser (или navigator.userAgentData.mobile) → device/os/browser + screen{w,h,dpr,aspectRatio} + capabilities{webgl2,touch,imageBitmap}. Событие 'resize' эмитить из него (window.innerWidth/innerHeight). Дальше ВСЁ читать из него, а не из window напрямую.

Строка бандла: 13304

### КЛЮЧЕВОЕ: начальный DPR. Единственное место, где igloo режет разрешение по железу. setPixelRatio НЕ вызывается вообще

**Числа.** const u = window.devicePixelRatio<=2 ? Math.min(window.devicePixelRatio,1.15) : Math.min(window.devicePixelRatio,1.5); → he.init({DPR:u||1, adaptiveDPR:!0, shadowMap:!0, shadowMapType:ly, fingers:2, audioContext:!0, contextMenu:!1}). То есть: ПК с dpr=1 → 1.0; ретина-ноут dpr=2 → 1.15; телефон dpr=3 → 1.5; телефон dpr=4 → 1.5

```glsl
const u=window.devicePixelRatio<=2?Math.min(window.devicePixelRatio,1.15):Math.min(window.devicePixelRatio,1.5);
await he.init({canvasCnt:o,interactionNode:r,relativePath:a,fingers:2,audioContext:!0,contextMenu:!1,DPR:u||1,adaptiveDPR:!0,shadowMap:!0,shadowMapType:ly});
```

**Что делать у нас.** У себя поставить ровно эту формулу: dpr = devicePixelRatio<=2 ? Math.min(dpr,1.15) : Math.min(dpr,1.5). Не резать телефон до 1 и тем более не до 0.75 - у igloo телефон рендерит В ПОЛТОРА раза плотнее, чем ретина-ПК (1.5 против 1.15). Мыло на мобиле почти всегда от того, что мы ставим setPixelRatio(1).

Строка бандла: 20662

### Как DPR применяется: renderer.setPixelRatio НЕ используется. Разрешение бэкбуфера считается вручную и в CSS канвас растягивается на CSS-пиксели

**Числа.** resolution = floor(vec2(innerWidth, innerHeight) * currentDPR); aspect = resolution.x/resolution.y; resolutionUI = vec2(innerWidth, innerHeight) без DPR; webgl.setSize(resolution.x, resolution.y, !1) - третий аргумент false, стиль не трогаем; style.width/height = CSS-пиксели

```glsl
Tu=function(i,e){_i.resolution.value.set(i,e).multiplyScalar(this.currentDPR).floor(),_i.aspect.value=_i.resolution.value.x/_i.resolution.value.y,_i.resolutionUI.value.set(i,e),this.renderer.webgl.setSize(_i.resolution.value.x,_i.resolution.value.y,!1),this.renderer.domElement.style.width=`${i}px`,this.renderer.domElement.style.height=`${e}px`}
...
setDPRMultiplier(e=1){this.currentDPR=this.initialDPR*e,Q.emit("resize",q.screen.w,q.screen.h)}
```

**Что делать у нас.** Не звать setPixelRatio. Держать два uniform: uResolution (в пикселях бэкбуфера, с DPR) и uResolutionUI (в CSS-пикселях, без DPR). renderer.setSize(w*dpr, h*dpr, false) + вручную canvas.style.width/height в CSS-пикселях. Тогда UI-раскладку считаем в CSS-пикселях, а шейдеры - в реальных.

Строка бандла: 13468

### Адаптивный DPR по FPS (класс UU) - единственная система 'слабая машина'. Никакого tier/quality/low-preset в бандле нет

**Числа.** старт через 2 с после первого рендера (Xm=2); шаг оценки не чаще 4 с (Km=4); минимум 5 замеров (Jm=5); порог вниз FPS<30 (jm=30); порог вверх FPS>=60 (Zm=60); шаг множителя 0.1 (Su=.1); НИЖНИЙ ПОТОЛОК множителя 0.6 (Mu=.6); множитель стартует с 1 (Ns=1); после 4 колебаний (перекладываний знака, $m=4) - console.warn("Adaptive DPR stopped.") и стоп навсегда

```glsl
class UU{constructor(e){te(this,bu),te(this,ac,null),te(this,Xm,2),te(this,oc,0),te(this,Km,4),te(this,Jm,5),te(this,jm,30),te(this,Zm,60),te(this,Su,.1),te(this,Mu,.6),te(this,$m,4),te(this,sr,[]),te(this,oo,0),te(this,Nl,0),te(this,Ns,1),te(this,Bo,0),et(this,ac,e)}
...
eA=function(i){if(!(Fe.time<U(this,oc))&&q.visible&&(U(this,sr).push(i),Fe.time-U(this,Bo)>=U(this,Km)&&U(this,sr).length>=U(this,Jm))){const e=U(this,sr).reduce((t,s)=>t+s,0)/U(this,sr).length;e<U(this,jm)&&U(this,Ns)>U(this,Mu)?(et(this,Ns,Math.max(U(this,Mu),U(this,Ns)-U(this,Su))),U(this,ac).setDPRMultiplier(U(this,Ns)),U(this,oo)===1&&L0(this,Nl)._++,et(this,oo,-1)):e>=U(this,Zm)&&U(this,Ns)<1&&(et(this,Ns,Math.min(1,U(this,Ns)+U(this,Su))),U(this,ac).setDPRMultiplier(U(this,Ns)),U(this,oo)===-1&&L0(this,Nl)._++,et(this,oo,1)),U(this,sr).length=0,et(this,Bo,Fe.time),U(this,Nl)>=U(this,$m)&&(console.warn("Adaptive DPR stopped."),this.stop())}};
```

**Что делать у нас.** Реализовать ровно это: множитель 1.0, шаг 0.1, пол 0.6, вниз при среднем FPS<30, вверх при >=60, окно 4 с и минимум 5 замеров, стоп после 4 перекладываний. Итого худший случай на телефоне: 1.5*0.6 = 0.9 реальных пикселя на CSS-пиксель. НИКОГДА не опускаться ниже - у igloo пол жёсткий.

Строка бандла: 13468

### Замер FPS, который кормит адаптивный DPR (событие webgl_average_fps_update)

**Числа.** базовый FPS pg=60; BD=.2; PD=60*.2=12; DD=60/12=5 (потолок deltaRatio); окно усреднения RD=.5 c; минимум UD=5 кадров; averageFPS = Math.round(1000/среднее(ms))

```glsl
const tx=re.parseEase(),pg=60,BD=.2,PD=pg*BD;let DD=pg/PD,um=0,dm=16,_w=0,fm=60,pm=0;
const Fe={get time(){return um},get delta(){return dm},get frame(){return _w},get averageFPS(){return fm},get maxFPS(){return pm},get ratio(){return Math.min(DD,dm/(1e3/pg))}};
let ix=0;const RD=.5,UD=5,ul=[],LD=["webgl_prerender","webgl_render","webgl_postrender"];
re.ticker.add((i,e,t)=>{const s=Math.round((i-um)*1e3);{if(ul.push(s),i-ix>=RD&&ul.length>=UD){const n=Math.round(1e3/(ul.reduce((r,a)=>r+a,0)/ul.length));pm=Math.max(pm,n),fm=n,ul.length=0,ix=i,Q.emit("webgl_average_fps_update",fm)}um=i,dm=s,_w++,LD.forEach(n=>Q.emit(n,i,s))}});
```

**Что делать у нас.** Тикер GSAP (или rAF) считает средний FPS за 0.5 с при минимум 5 кадрах и эмитит событие. Тот же deltaRatio = min(5, delta/(1000/60)) использовать во всех lerp-ах, чтобы анимации на 30 FPS шли с той же скоростью, что на 120.

Строка бандла: 13304

### ОТВЕТ НА ГЛАВНЫЙ ВОПРОС: освещение, экспозиция, тон-мэппинг и цвета на телефоне НЕ МЕНЯЮТСЯ. Во всём бандле нет ни одной ветки по устройству в цветовом/световом тракте

**Числа.** grep по бандлу: `q.device` - 0 вхождений; `.device==="mobile"` - 1 (внутри самого детекта); `oldIphone` - 2 (объявление + присвоение, НИ ОДНОГО чтения); `capabilities.touch` - 1 (внутри детекта); `os.name==="ios"` - 4 (три внутри детекта, одно в аудио-контексте). Уникальных световых uniform-ов всего один: uLightPos. Uniform-ов uExposure / uBrightness / uGamma / uAmbient / uFog / uIntensity / uSaturation / uDark в бандле НЕТ

```glsl
// единственное чтение os.name вне детекта - пауза аудио на iOS:
qm=function(i){this.contextStarted&&q.os.name==="ios"&&(i?et(this,rc,setTimeout(()=>this.resume(),500)):(clearTimeout(U(this,rc)),this.suspend()))};
```

**Что делать у нас.** Выкинуть у себя ЛЮБЫЕ ветки вида isMobile ? затемнить/убавить свет/сменить тон-мэппинг. Свет, экспозиция, LUT, bloom - один набор чисел на все устройства. Телефон отличается ТОЛЬКО плотностью пикселей (DPR) и размером UI-элементов.

Строка бандла: 13304

### Настройки WebGLRenderer: антиалиасинг аппаратный ВЫКЛЮЧЕН на всех устройствах, сглаживание делает пост-SMAA. toneMapping и outputColorSpace НЕ выставляются (остаются дефолтные NoToneMapping + SRGB)

**Числа.** new WebGLRenderer({alpha:!1, antialias:!1, stencil:!1, depth:!1}); clearColor = new Color("#000000"), clearAlpha = 1; debug.checkShaderErrors=!1; info.autoReset=!1; canvas прячется в closed shadow-root; capabilities.floatLinearFiltering = extensions.has("OES_texture_float_linear"); capabilities.floatRenderTarget = живой тест рендера в RGBA-float RT 1x1 с проверкой r===0, g>=0.1, b>=0.05, a===1

```glsl
init({shadowMap:e,shadowMapType:t}={}){this.webgl=new ZT({alpha:!1,antialias:!1,stencil:!1,depth:!1}),this.webgl.setClearColor(this.clearColor,this.clearAlpha),e===!0&&(this.webgl.shadowMap.enabled=!0,t&&(this.webgl.shadowMap.type=t)),...,this.webgl.debug.checkShaderErrors=!1,this.webgl.capabilities.floatLinearFiltering=this.webgl.extensions.has("OES_texture_float_linear"),this.webgl.capabilities.floatRenderTarget=this.checkFloatRenderTarget()}
checkFloatRenderTarget(){const e=new vt(1,1,{minFilter:gt,magFilter:gt,type:Lt}),t=new No,s=new fe({vertexShader:" void main() { gl_Position = vec4(position, 1.0); } ",fragmentShader:" void main() { gl_FragColor.rgb = vec3(0.0, 1.0 / 10.0, 1.0 / 20.0); gl_FragColor.a = 1.0; } "});t.add(new Ce(Ld,s));const n=this.webgl.getRenderTarget();this.webgl.setRenderTarget(e),this.webgl.render(t,new Ln(-1,1,1,-1,0,1));const r=new Float32Array(4);return this.webgl.readRenderTargetPixels(e,0,0,1,1,r),this.webgl.setRenderTarget(n),e.dispose(),s.dispose(),!(r[0]!==0||r[1]<.1||r[2]<.05||r[3]<1)}
```

**Что делать у нас.** antialias:false везде (и на ПК, и на телефоне), сглаживание отдать SMAA-пассу. depth:false/stencil:false - глубина живёт в своих render target. Проверку float-RT делать РЕАЛЬНЫМ рендером в RT, а не по строке userAgent.

Строка бандла: 13304

### Постобработка одинаковая на всех устройствах: SMAA качества HIGH + Bloom с mipmapBlur. Никаких мобильных отключений постпроцесса

**Числа.** addSMAA({quality:"high"}) → preset so.HIGH; пресеты SMAA: LOW = edgeDetectionThreshold .15 / orthogonalSearchSteps 4 / diagonal false / corner false; MEDIUM = .1 / 8 / false; HIGH и ULTRA - выше. Bloom на всех трёх сценах: levels:6, luminanceThreshold:.2 (сцена иглу и сцена кубов), luminanceThreshold:0 (интерьер), intensity:1, radius:.85, mipmapBlur принудительно true

```glsl
AE=function(){this.composer=new tA({renderToScreen:!0});const i=new Jo;this.renderPass=new dE(i,i.camera,void 0,this.renderer.clearColor,this.renderer.clearAlpha),this.composer.addPass(this.renderPass);const e=new Fd().addSMAA({quality:"high"});e.isGammaCorrectionPass=!0,this.composer.addPass(e)};
// addBloom:
addBloom(e={}){const t=new Or(ml,new n_({...e,mipmapBlur:!0}));return t.fullscreenMaterial.encodeOutput=!1,this._effectComposer.addPass(t),this}
// вызовы на сценах:
e.addPass(new Fd().addBloom({debug:q.devScene,levels:6,luminanceThreshold:.2,intensity:1,radius:.85}))   // иглу и кубы
e.addPass(new Fd().addBloom({debug:q.devScene,levels:6,luminanceThreshold:0,intensity:1,radius:.85}))   // интерьер
```

**Что делать у нас.** Оставить SMAA high и bloom (levels 6, threshold 0.2, intensity 1, radius 0.85, mipmapBlur) на телефоне тоже. Экономить только на DPR. Если на нашем сайте на мобиле отключён bloom или color-grade - именно поэтому картинка 'тусклая и тёмная' против ПК.

Строка бандла: 13472

### Цветокоррекция сцены иглу: 3D-LUT (tetrahedral) + диагональный градиент. Один и тот же на всех устройствах

**Числа.** tLUT = le.load("igloo/igloo_scene.ktx2","luttetrahedral"); uLUTSize подставляется из ширины картинки LUT после загрузки; uLUTIntensity = 1; uGradientAlpha = 0 по умолчанию, анимируется по интро; формула градиента: mix(0.8, 1.0, (uv.x+uv.y)*0.5)

```glsl
vec3 scene = texture2D(tDiffuse, uv).rgb;
float gradient = mix(0.8, 1.0, (uv.x + uv.y) * 0.5);
gradient = mix(1.0, gradient, uGradientAlpha);
scene *= gradient;

vec3 sceneColor = apply3DLUTTetrahedral(scene.rgb, tLUT, uLUTSize, uLUTIntensity);

// film grain
// vec3 noise = hash32(uv * 1000.0 + time);
// noise *= 2.0;
// noise -= 1.0;
// sceneColor += noise * 0.05;

gl_FragColor = vec4(sceneColor, 1.0);
// подстановка размера LUT:
setTimeout(async()=>{const e=this.uniforms.tLUT.value;await e._loaded;this.uniforms.uLUTSize.value=e.image.width},0)
```

**Что делать у нас.** Сделать грейд одним 3D-LUT (KTX2 sampler3D, tetrahedral-интерполяция) с интенсивностью 1 на ВСЕХ устройствах. Затемняющий градиент держать выключенным (uGradientAlpha=0) и включать только в интро. Именно так у них ПК и телефон совпадают по цвету 1:1.

Строка бандла: 14687

### Цветокоррекция интерьерной сцены (DF): blue-noise дизеринг, HSV-подсветка у кольца, диагональный glare. Тоже без веток по устройству

**Числа.** bluramount = 0.3; squares displacement 0.01; HSV: saturation +0.05*uRingProximity, value +0.075*uRingProximity; glare: pow(vUv.x*vUv.y, 2.0) * (sinenoise1(vec3(vUv.x*aspect, vUv.y, time*0.5))*0.4 + 0.4) * vec3(0.8,0.9,1.0) * noise.b * 2.0; шум blue-8-128-rgb.ktx2, tScroll uv*1.5

```glsl
vec3 noise = getNoise(tBlue, gl_FragCoord.xy, uBlueOffset).rgb;
if (uRingProximity > 0.0) {
    uv -= 0.5;
    uv.x *= aspect;
    float angle = atan(uv.y, uv.x);
    float dist = length(uv);
    const float bluramount = 0.3;
    float angle1 = angle + bluramount * (noise.r - 0.5) * uRingProximity;
    vec2 newUv1 = vec2(cos(angle1), sin(angle1)) * dist;
    newUv1.x /= aspect;
    newUv1 += 0.5;
    float dispSquares = texture2D(tScroll, newUv1 * 1.5 + uSquareAttr.rg).g * 2.0 - 1.0;
    newUv1 += dispSquares * 0.01 * uSquareAttr.b * uRingProximity;
    scene = texture2D(tDiffuse, newUv1).rgb;
    if (length(scene) < length(vec3(1.0))) {
        scene = rgb2hsv(scene);
        scene.g += 0.05 * uRingProximity;
        scene.b += 0.075 * uRingProximity;
        scene = hsv2rgb(scene);
    }
} else {
    scene = texture2D(tDiffuse, uv).rgb;
}
vec3 sceneColor = scene;
// glare
float diagonalGradient = pow(vUv.x * vUv.y, 2.0);
sceneColor += diagonalGradient * (sinenoise1(vec3(vUv.x * aspect, vUv.y, time * 0.5)) * 0.4 + 0.4) * vec3(0.8, 0.9, 1.0) * noise.b * 2.0;
gl_FragColor = vec4(clamp(sceneColor, 0.0, 1.0), 1.0);
```

**Что делать у нас.** Взять этот шейдер целиком как финальный грейд: blue-noise по gl_FragCoord (не по uv - тогда шум не масштабируется с DPR), подъём насыщенности/яркости в HSV, диагональный glare. На телефоне не отключать - он и даёт 'живость', против которой чёрный экран выглядит мёртвым.

Строка бандла: 19658

### Единственные реальные ветки 'слабое железо' - по возможностям GL, а не по устройству: точность шейдеров и фильтрация float-текстур во флюид-симуляции

**Числа.** highPrecision = capabilities.getMaxPrecision("highp"); mediumPrecision = capabilities.getMaxPrecision("mediump"); _linearFilteringSupported = capabilities.floatLinearFiltering; если нет линейной фильтрации float - LinearFilter заменяется на NearestFilter у density и velocity; pressure всегда NearestFilter

```glsl
this._linearFilteringSupported=Je.webgl.capabilities.floatLinearFiltering;
...
_createRTs(){this._density=lp(this._dyeRes,wt,this._linearFilteringSupported?_t:gt),this._velocity=lp(this._simRes,wt,this._linearFilteringSupported?_t:gt),this._pressure=lp(this._simRes,wt,gt);const e={type:Mi,magFilter:gt,minFilter:gt,depthBuffer:!1};this._divergence=new vt(this._simRes,this._simRes,e),this._curl=new vt(this._simRes,this._simRes,e)}
_createMaterials(){const e=Je.webgl.capabilities,t=e.getMaxPrecision("highp"),s=e.getMaxPrecision("mediump");this._materialClear=new VU({highPrecision:t,mediumPrecision:s,pressureDissipation:this._pressureDissipation}),...}
// в шейдерах:
precision ${e.highPrecision} float;
precision ${e.highPrecision} sampler2D;
```

**Что делать у нас.** Спрашивать у самого GL: getMaxPrecision('highp') и extensions.has('OES_texture_float_linear'), и подставлять в шейдеры строку precision. Не хардкодить mediump 'потому что мобила' - это как раз даёт полосы и грязь на телефоне.

Строка бандла: 14171

### GPU-частицы: формат render target выбирается по проверенной возможности, не по устройству. Количество частиц ФИКСИРОВАНО и одинаково на ПК и на телефоне

**Числа.** тип RT = floatRenderTarget ? FloatType : HalfFloatType; размер текстуры частиц getTextureSizeParticles(i) = Math.max(Math.ceil(Math.sqrt(i*e)/4)*4, 4); RT: wrapS/wrapT ClampToEdge, minFilter/magFilter Nearest, format RGBA, depthBuffer:false. Числа частиц по сценам: снег 1200; частицы внутри куба 150*1e3 = 150000; амбиент-частицы 200 (box, scale [3,8,3]); ещё один набор 60 (box, scale [2.5,.5,2.5])

```glsl
const n=Je.webgl.capabilities.floatRenderTarget?Lt:Mi,r=ie.getTextureSizeParticles(this.particlesCount);
if(this.rt1=new vt(r,r,{count:s.textures||1,wrapS:zs,wrapT:zs,minFilter:gt,magFilter:gt,format:wt,type:n,depthBuffer:!1}),this.rt2=this.rt1.clone(),this.rtCurrent=0,...
// getTextureSizeParticles:
getTextureSizeParticles(i=4,e=1){return Math.max(Math.ceil(Math.sqrt(i*e)/4)*4,4)}
// счётчики:
this.options={count:1200,...t}                       // снег
this.cubeSize=.65,this.particles=150*1e3             // частицы в кубе
this.options={count:200,shape:"box",scale:[3,8,3],center:[0,0,0],generateRandomBuffer:!0}
this.options={count:60,shape:"box",scale:[2.5,.5,2.5],center:[0,0,0]}
```

**Что делать у нас.** НЕ резать число частиц на телефоне. 150 000 GPU-частиц крутятся на мобиле у igloo без веток. Резать только формат RT (half-float если float-RT не поддержан) и полагаться на adaptive DPR.

Строка бандла: 14397

### Флюид-симуляция: разрешение фиксировано, не зависит от экрана и устройства

**Числа.** new $U({borders:!1, simRes:128, dyeRes:128, curlStrength:0, splatRadius:.22, splatForce:35, pressureIterations:2, densityDissipation:.88, velocityDissipation:.98, pressureDissipation:.86, splatRadiusVelocity:!1, renderEvent:!1})

```glsl
this.cubeSize=.65,this.particles=150*1e3,this.fluidSim=new $U({borders:!1,simRes:128,dyeRes:128,curlStrength:0,splatRadius:.22,splatForce:35,pressureIterations:2,densityDissipation:.88,velocityDissipation:.98,pressureDissipation:.86,splatRadiusVelocity:!1,renderEvent:!1}),this.fluidSim.disable()
```

**Что делать у нас.** Флюид считать в фиксированных 128x128 (не в разрешении экрана) - тогда он одинаково дёшев и на ПК, и на телефоне, и мобильную версию не надо резать.

Строка бандла: 18772

### Брейкпоинты раскладки. Единственный источник - объект Be. Три ступени: обычный / small / mobile, и решаются они по ШИРИНЕ ИЛИ ВЫСОТЕ, а не только по ширине

**Числа.** gridSize:125, gridSizeLow:50, gridSizeMobile:25, topMargin:90, topMarginLow:45, topMarginMobile:25, breakpointW:1600, breakpointH:800, breakPointMobile:640. Правило: small = screen.width<1600 || screen.height<800; mobile = screen.width<640 || screen.height<640

```glsl
const Be={gridSize:125,gridSizeLow:50,gridSizeMobile:25,topMargin:90,topMarginLow:45,topMarginMobile:25,breakpointW:1600,breakpointH:800,breakPointMobile:640,colorLogo:"#ffffff",colorTitle:"#3C3C54",colorText:"#ffffff",colorProjectTitle:"#67707E",colorProjectText:"#A1AAB7",manifesto:{title:"////// Manifesto",text:"Our mission is to build the next generation of consumer brands at the intersection of Community, AI, and crypto."},copyright:"// Copyright © 2026",rights:`Igloo, Inc.\nAll Rights Reserved.`,scroll:"Scroll down to discover.",follow:"/// Follow Us",click:"Click to explore",clickDisabled:"???????????????",close:"Close",...}
```

**Что делать у нас.** Завести один конфиг с этими числами (1600/800/640, поля 125/50/25 и 90/45/25) и проверять `w<breakpointW || h<breakpointH` - иначе на альбомном телефоне (ширина 800, высота 380) сайт считает себя десктопом и всё вылезает.

Строка бандла: 14437

### Раскладка UI-сцены (лого, звук, закрыть, скролл, проекты) на узком экране. Отступы и позиции пересчитываются на каждый resize

**Числа.** meshMarginLeft = mobile?25 : small?50 : 125; meshMarginTop = mobile?25 : small?45 : 90; ортокамера ставится в (w*0.5, -h*0.5, basePosition.z)

```glsl
resize(){...this.camera.basePosition.set(q.screen.w*.5,-q.screen.h*.5,this.camera.basePosition.z),this.camera.baseTarget.set(this.camera.basePosition.x,this.camera.basePosition.y,0),this.camera.updateProjectionMatrix(),this.small=q.screen.width<Be.breakpointW||q.screen.height<Be.breakpointH,this.mobile=q.screen.width<Be.breakPointMobile||q.screen.height<Be.breakPointMobile,this.meshMarginLeft=this.mobile?Be.gridSizeMobile:this.small?Be.gridSizeLow:Be.gridSize,this.meshMarginTop=this.mobile?Be.topMarginMobile:this.small?Be.topMarginLow:Be.topMargin,[this.logo,this.scroll,this.sound,this.close,this.projects].forEach(e=>{e.resize()})}
```

**Что делать у нас.** Весь UI держать в ортографической 3D-сцене в CSS-пикселях (ортокамера по размеру окна) и на resize просто пересчитывать отступы по трём ступеням. Никаких @media - в бандле igloo НОЛЬ CSS media-queries.

Строка бандла: 20287

### Размеры конкретных UI-элементов на мобиле (позиционирование через Si.positionUI в пикселях)

**Числа.** логотип: mobile 140, small 160, обычный 200 (высота = ширина*0.21); кнопка Close: mobile 85, small 95, обычный 120 (высота = ширина*0.45), текст-подсказка масштаб width*2.15; кнопка Visit/box: mobile 150, small 180, обычный 220 (высота = width/3.125), нижняя позиция = screen.height - meshMarginTop - (mobile?80:20); точки-переключатели ссылок: шаг mobile 6 / small 7 / обычный 10, масштаб mobile .75 / small .8 / обычный 1, зона фейда mobile 50/110, small 70/140, обычный 100/200; звук: иконка small 18 иначе 22, надпись small 180 иначе 230

```glsl
// точки-переключатели
const e=this.parent.mobile?6:this.parent.small?7:10,t=this.group.children.length,s=this.parent.parent.parent.currentLink,n=(s+1)%t,r=s-1<0?t-1:s-1,a=this.parent.mobile?.75:this.parent.small?.8:1,o=this.parent.mobile?50:this.parent.small?70:100,l=this.parent.mobile?110:this.parent.small?140:200,c=he.uniforms.resolution.value.x*o/he.uniforms.resolutionUI.value.x,h=he.uniforms.resolution.value.x*l/he.uniforms.resolutionUI.value.x;
// visit-box
this.bottomPosition=q.screen.height-this.meshMarginTop-(this.mobile?80:20);const e=this.mobile?150:this.small?180:220,t=e/3.125;
// лого
resize(){const e=this.scene.mobile?140:this.scene.small?160:200,t=e*.21;this.mesh.scale.set(e,t,1),this.mesh.position.set(this.scene.meshMarginLeft,-this.scene.meshMarginTop,0)}
// close
resize(){const e=this.scene.mobile?85:this.scene.small?95:120,t=e*.45;...}
```

**Что делать у нас.** Скопировать эти три ступени размеров под наши элементы. Обратить внимание на строку с `resolution.value.x * o / resolutionUI.value.x` - когда пиксельный размер надо превратить в шейдерные координаты, делят реальное разрешение на CSS-разрешение. Это и есть корректная работа с DPR в UI-шейдерах.

Строка бандла: 18672

### Текст манифеста и копирайта: перенос строк НЕ меняется на мобиле, меняется только экранный масштаб. Привязка к правому краю через grid-отступ

**Числа.** options = {manifestoWidth:.75, copyrightWidth:.9, align:"right", lineHeight:.8, size:.09} - константы для всех устройств; экранный размер s = mobile?175 : small?200 : 250; заголовок в x = screen.width - r, y = a + title.size.y*0.75*s; текст в y = a + title.size.y*2.25*s; копирайт слева в x = r, y = a + (small?160:200)*0.21 + copyright.size.y*1.25*s; rights ниже на copyright.size.y*1.5*s

```glsl
this.options={manifestoWidth:.75,copyrightWidth:.9,align:"right",lineHeight:.8,size:.09}
...
render(){const e=q.screen.width<Be.breakpointW||q.screen.height<Be.breakpointH,t=q.screen.width<Be.breakPointMobile||q.screen.height<Be.breakPointMobile,s=t?175:e?200:250,n=s,r=t?Be.gridSizeMobile:e?Be.gridSizeLow:Be.gridSize,a=t?Be.topMarginMobile:e?Be.topMarginLow:Be.topMargin;
Si.positionUI({camera:this.scene.camera,mesh:this.title,x:q.screen.width-r,y:a+this.title.size.y*.75*n,width:s,height:n}),
Si.positionUI({camera:this.scene.camera,mesh:this.text,x:q.screen.width-r,y:a+this.title.size.y*2.25*n,width:s,height:n});
const l=(e?160:200)*.21,c=a+l+this.copyright.size.y*1.25*s;
Si.positionUI({camera:this.scene.camera,mesh:this.copyright,x:r,y:c,width:s,height:s}),
Si.positionUI({camera:this.scene.camera,mesh:this.rights,x:r,y:c+this.copyright.size.y*1.5*s,width:s,height:s})}
```

**Что делать у нас.** Текст в 3D делать MSDF-мешем с фиксированной шириной переноса (0.75/0.9) и менять на мобиле ТОЛЬКО пиксельный масштаб (250→175, то есть 70%). Тогда вёрстка не ломается и текст не превращается в лесенку.

Строка бандла: 16312

### Хелпер Si.positionUI - как 3D-меш ставится в пиксельные координаты экрана (основа всей мобильной раскладки igloo)

**Числа.** scale = размер_в_пикселях * (viewSize.y / screen.height); position = camera.position + (viewSize.x*(-0.5 + x/screen.width), viewSize.y*(0.5 - y/screen.height), -distance) повёрнутое кватернионом камеры; billboardCamera по умолчанию true

```glsl
positionUI({camera:i,mesh:e,x:t=0,y:s=0,width:n=1,height:r=1,distance:a=null,billboardCamera:o=!0}={}){const l=a||mx.subVectors(i.position,i.target).length();i.getViewSize(l,Wa);const c=Wa.y/q.screen.height;e.scale.set(n*c,r*c,1);const h=t/q.screen.width,d=s/q.screen.height;e.position.copy(i.position).add(mx.set(Wa.x*-.5+Wa.x*h,Wa.y*.5-Wa.y*d,-l).applyQuaternion(i.quaternion)),o&&e.quaternion.copy(i.quaternion),e.updateMatrixWorld()}
```

**Что делать у нас.** Взять эту функцию как есть. Она решает нашу задачу 'текст и карточки ВНУТРИ 3D-мира, а не поверх': элемент реально в сцене, но позиционируется в CSS-пикселях от угла экрана и всегда смотрит в камеру.

Строка бандла: 13306

### Положение 3D на узком экране: камера ОТЪЕЗЖАЕТ через zoom по aspectRatio. Единственная адаптация самой 3D-сцены под мобильный экран

**Числа.** сцена иглу (внешняя) и сцена кубов: camera.zoom = Math.min(1, screen.aspectRatio*1.25); интерьерная сцена: camera.zoom = Math.min(1, screen.aspectRatio*1.5). Пример: iPhone 390x844 → aspect 0.462 → zoom 0.577 (кубы) и 0.693 (интерьер); ПК 16:9 → aspect 1.78 → zoom 1 (без изменений)

```glsl
// сцена кубов
resize(){this.camera.zoom=Math.min(1,q.screen.aspectRatio*1.25),this.camera.updateProjectionMatrix(),this._transmissionRT.setSize(he.uniforms.resolution.value.x,he.uniforms.resolution.value.y)}
// сцена иглу
resize(){this.camera.zoom=Math.min(1,q.screen.aspectRatio*1.25),this.camera.updateProjectionMatrix()}
// интерьер
resize(){this.camera.zoom=Math.min(1,q.screen.aspectRatio*1.5),this.camera.updateProjectionMatrix()}
```

**Что делать у нас.** Вместо переставления объектов на мобиле - просто уменьшать camera.zoom = min(1, aspect*1.25). На портретном телефоне сцена сама отъезжает и целиком влезает в кадр, композиция не ломается. Для перспективной камеры аналог - увеличивать дистанцию/fov по тому же множителю.

Строка бандла: 17646

### Ориентация экрана (портрет/альбом) меняет расстановку стрелок-указателей у карточек

**Числа.** портрет (w<h): uWidth=0.175, uScale=0.75, планки на x=±0.185; альбом: uWidth=0.3, uScale=1, планки на x=±0.3

```glsl
update(){q.screen.w<q.screen.h?(this.mesh.material.uniforms.uWidth.value=.175,this.mesh.material.uniforms.uScale.value=.75,[this.planeLeft,this.planeRight].forEach((e,t)=>e.position.set(.185*(t===0?1:-1),0,0))):(this.mesh.material.uniforms.uWidth.value=.3,this.mesh.material.uniforms.uScale.value=1,[this.planeLeft,this.planeRight].forEach((e,t)=>e.position.set(.3*(t===0?1:-1),0,0)))}
```

**Что делать у нас.** Проверять именно `screen.w < screen.h` (портрет), а не isMobile: на планшете в альбоме нужна десктопная расстановка. Сжимать интерактивные зоны к центру на 0.185 вместо 0.3 и масштаб 0.75.

Строка бандла: 18586

### Мелкие 3D-подписи масштабируются по ВЫСОТЕ экрана, чтобы не превращались в пыль на телефоне

**Числа.** размер точек-цифр plexus: uSize = Math.min(.1, .08/(screen.h/1300)); подписи-выноски: scale = Math.min(.8, .5/(screen.h/1300)) (три места). Опорная высота везде 1300 px

```glsl
this.mesh.material.uniforms.uSize.value=Math.min(.1,.08/(q.screen.h/1300)),this.mesh.geometry.attributes.progress.needsUpdate=!0
...
this.text.scale.setScalar(Math.min(.8,.5/(q.screen.h/1300)))
...
this.mesh.scale.setScalar(Math.min(.8,.5/(q.screen.h/1300)))
```

**Что делать у нас.** Подписи и мелкие 3D-элементы масштабировать как min(потолок, база/(screen.h/1300)). На телефоне высотой 844 множитель = 1300/844 = 1.54, то есть подписи становятся В ПОЛТОРА РАЗА КРУПНЕЕ - именно так они остаются читаемыми, а не 'уменьшаются вместе со всем'.

Строка бандла: 16022

### Загрузчик текстур: один и тот же набор KTX2 для всех устройств. Формат сжатия выбирает транскодер Basis по возможностям GPU (ASTC на телефоне, BC на ПК)

**Числа.** Транскодер: In.setTranscoderPath(origin + "/assets/libs/basis/"), setWorkerLimit(1). Флаги по имени файла: 'srgb' → SRGBColorSpace; 'data' → magFilter/minFilter = LinearFilter + generateMipmaps=false; 'nearest' → NearestFilter; 'repeat'/'mirror' → RepeatWrapping/MirroredRepeat; 'luttetrahedral' → NearestFilter; 'lut' → LinearFilter; '3d'/'lut' → Data3DTexture; 'cubemap' → CubeTexture. anisotropy НЕ выставляется нигде (остаётся 1). Фолбэк при ошибке загрузки - "uv/uvchecker-srgb.ktx2"

```glsl
const l=n.includes("srgb")||i===tp?Ve:a.colorSpace;a.colorSpace=l;
...
n.includes("repeat")&&(n.includes("mirror")?(a.wrapS=Do,a.wrapT=Do):(a.wrapS=Ar,a.wrapT=Ar)),
n.includes("data")?(a.magFilter=_t,a.minFilter=_t):n.includes("nearest")&&(a.magFilter=gt,a.minFilter=gt),
(n.includes("nearest")||n.includes("data")||n.includes("nomipmaps"))&&(a.generateMipmaps=!1),
n.includes("pmrem")&&(n.includes("refraction")?a.mapping=Qu:a.mapping=zu),
n.includes("lut")&&(n.includes("luttetrahedral")?(a.magFilter=gt,a.minFilter=gt):(a.magFilter=_t,a.minFilter=_t)),
a.colorSpace=l,a.needsUpdate=!0
```

**Что делать у нас.** Перевести наши текстуры в KTX2/Basis и грузить ОДИН набор на все устройства - транскодер сам отдаст ASTC телефону. Не делать отдельных '-mobile' текстур: в бандле igloo нет ни одного файла с мобильным вариантом.

Строка бандла: 13392

### Единственное место, где браузер/ОС влияют на путь загрузки текстур: отключается imageBitmap и включается обычный TextureLoader

**Числа.** Условие: browser.name==="safari" && browser.version<17.5 || browser.name==="firefox" && browser.version<100 || os.name==="ios" && browser.name!=="safari" → capabilities.imageBitmap = false

```glsl
(this.browser.name==="safari"&&this.browser.version<17.5||this.browser.name==="firefox"&&this.browser.version<100||this.os.name==="ios"&&this.browser.name!=="safari")&&(this.capabilities.imageBitmap=!1),U(this,Zr).classList.add(this.language),U(this,Zr).classList.add(this.device),this.os.name!=="unknown"&&U(this,Zr).classList.add(this.os.name),this.browser.name!=="unknown"&&U(this,Zr).classList.add(this.browser.name)
```

**Что делать у нас.** Скопировать эти три условия для createImageBitmap. Заодно перенять приём: на <html> вешаются классы языка, устройства, ОС и браузера (`html.mobile.ios.safari`) - удобная точка входа для точечных CSS-фиксов без media-queries.

Строка бандла: 13304

### Ввод: два пальца, contextMenu отключён, никакого отдельного мобильного контроллера. Скролл/зум/поворот считаются от высоты экрана

**Числа.** fingers:2, contextMenu:!1; rotate: sphericalDelta.theta -= 2*PI*delta.x/screen.h; phi -= 2*PI*delta.y/screen.h; зум колесом множитель zoomSpeedWheel=.25, при щипке дополнительный x10; lerpRotate=.075, lerpZoom=.1, lerpPan=.1; touches: ONE=ROTATE, TWO=ZOOM_PAN; в CSS: touch-action:none на html и body

```glsl
_handleRotateMove(e){Yi.copy(e.delta).multiplyScalar(this.rotateSpeed),this._sphericalDelta.theta-=2*Math.PI*Yi.x/q.screen.h,this._sphericalDelta.phi-=2*Math.PI*Yi.y/q.screen.h}
_handleZoomMove(e){const t=e.isPinching!==void 0;this._zoomCursorPosition.copy(...);let s=e.delta.y;t?s*=dx*this.zoomSpeedWheel*(e.isPinching?10:1):s/=dx*q.screen.h;const n=Math.pow(.95,this.zoomSpeed*Math.abs(s));...}
// CSS из igloo-main.js:
html,html body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background-color:var(--bgColor);touch-action:none;-webkit-text-size-adjust:100%;text-size-adjust:100%}
```

**Что делать у нас.** Один контроллер ввода на мышь и тач (событиями touch_start/touch_drag/touch_end + touch2_*), нормировка delta на screen.h, touch-action:none на html/body, overflow:hidden, -webkit-text-size-adjust:100%. Щипок домножать на 10 против колеса.

Строка бандла: 13304

**Не найдено или не подтвердилось:**

- Отдельного тон-мэппинга: renderer.toneMapping и renderer.toneMappingExposure в коде приложения НЕ выставляются ни разу (все совпадения toneMapping в бандле - внутренности three.js: строки 13186-13252 шейдерные чанки и 8646/9474 разбор материалов). Значит остаётся NoToneMapping. Ни на ПК, ни на телефоне.
- renderer.outputColorSpace приложение тоже не трогает - остаётся дефолт three.js (SRGB). Разных цветовых пространств для мобилы нет.
- Ни одной ветки, где на телефоне меняются свет, экспозиция, яркость, контраст, насыщенность или цвета. Uniform-ов uExposure / uBrightness / uGamma / uContrast / uAmbient / uFog / uEnv / uIntensity / uSaturation / uTint / uDark в бандле нет вообще; световой uniform ровно один - uLightPos, и он одинаковый везде.
- Никакого tier/quality/performance-preset. Слова quality/tier/low встречаются только внутри postprocessing-библиотеки (пресеты SMAA LOW/MEDIUM/HIGH/ULTRA, строка 13186) и в единственном вызове addSMAA({quality:"high"}) - то есть всегда HIGH.
- Нет window.matchMedia, нет 'pointer: coarse', нет 'prefers-reduced-motion'. Единственный тач-детект - 'ontouchstart' in window || navigator.maxTouchPoints>0.
- Нет ни одного CSS @media - ни в App3D.pretty.js, ни в igloo-main.js. Вся адаптивность живёт в WebGL-раскладке.
- renderer.setPixelRatio приложение не вызывает НИ РАЗУ. Все совпадения setPixelRatio (строки 10036, 10063, 10074, 10383) - внутри XR-модуля и определения самого метода three.js, плюс метод у EffectComposer (13468), который тоже не вызывается приложением. DPR применяется через setSize(w*dpr, h*dpr, false) + CSS-размер канваса.
- Разрешение теней (shadow.mapSize) нигде не задаётся. В init передаётся только shadowMap:true и shadowMapType:ly (PCFSoftShadowMap) - одинаково для всех. Веток размера карты теней по устройству нет.
- Нет мобильных вариантов ассетов: ни одного файла с суффиксом -mobile/-low/-lq/@1x. Все .drc и .ktx2 в единственном экземпляре (полный список путей есть в бандле: igloo/igloo_color.ktx2, igloo/ground_color.ktx2, cubes/cube_scene.ktx2, volumes/*.ktx2, mountain.drc, igloo.drc и т.д.).
- anisotropy у текстур не выставляется нигде - остаётся 1 и на ПК, и на телефоне.
- Числа частиц не зависят от устройства: 1200 (снег), 150000 (в кубе), 200 и 60 (амбиент) - жёстко зашиты. Ветки вида isMobile ? count/2 : count нет.
- Флаг q.oldIphone вычисляется (device===mobile && os===ios && devicePixelRatio<3), но НИГДЕ не читается - во всём бандле ровно 2 вхождения: объявление и присвоение. То есть это мёртвый код, на качество он не влияет.
- Нет гейта 'поверните телефон' и нет заглушки 'мобильные не поддерживаются'. Единственное сообщение - про отсутствие WebGL2 (строка 13304, текст 'Your $0 does not seem to support WebGL 2', где $0 = 'graphics card' или 'browser').
- Нет пропуска или упрощения постобработки на мобиле: SMAA high и Bloom (levels 6, radius .85, mipmapBlur) добавляются безусловно на всех трёх сценах.
- Отдельного мобильного разрешения для render target-ов нет: _transmissionRT.setSize(resolution.x, resolution.y) - полное разрешение бэкбуфера; флюид всегда 128x128.
