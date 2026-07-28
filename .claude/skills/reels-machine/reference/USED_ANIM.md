# USED_ANIM — реестр использованных анимаций (запрет повторов приёмов)

Правило: перед выбором анимаций прочитать; приём/ассет не повторять 3–5 роликов; переходы
и финалы всегда новые. После сборки — дописать использованное.

Учитываем: типы fx-оверлеев, Lottie-запросы, gl-переходы, 3D-фигуры+цвет, типы инфографики,
беспоук-графику, грейд, id музыки/SFX.

Формат: `дата | ролик | fx[...] | lottie[...] | gl[...] | 3d[...] | infogr[...] | bespoke[...] | grade | music`

| запись |
|--------|
| 2026-07 · d8 автомойка · fx[camui,callout,particles-water,statcard,stamp,dm,shine,ticker] · lottie[water splash, map pin] · gl[WaterDrop,Radial,Directional,ZoomInCircles,ripple] · 3d[droplet/blue] · infogr[statcard 400k, 500₽] · grade[teal_orange] |
| 2026-07 · d10 кондитер · fx[camui,callout,statcard,stamp,bars,toast,shine,ticker] · lottie[sparkle, confetti] · gl[BookFlip,Dreamy,SimpleZoom,PolkaDotsCurtain,fade] · 3d[ring/orange] · infogr[counter 52, bars 5→30] · grade[glossy] |
| 2026-07 · d11 титаник · fx[camui,slam,particles-snow,callout,donut,stamp,toast,shine,ticker] · lottie[warning] · gl[DoomScreen,burn,StaticFade,GlitchMemories,luma] · 3d[diamond/orange] · infogr[donut 70%, kinetic 3ч/3года] · grade[moody_dark] |
| 2026-07 · d12 не досматривают · fx[camui,slam,callout,stamp×3,shine,dm,ticker] · lottie[timer, checkmark] · gl[GlitchDisplace,directionalwarp,SimpleZoomOut,pixelize] · 3d[diamond/lime] · infogr[retention graph] · grade[clean_ad] |
| 2026-07 · d13 один ролик · fx[camui,stamp,bars,callout,dm,likes,toast,shine,ticker] · lottie[clock, chat] · gl[splitSlideInOutHorizontal,crosswarp,SimpleFlip,Bounce,wipeLeft] · 3d[diamond/lime] · infogr[counter 200k, bars реклама/ролик] · grade[warm_cine] |
<!-- Следующие ролики: взять ДРУГИЕ типы, переходы, 3D-фигуры, Lottie, грейды. -->

## Партия n1–n5 (Ставрополь, локальные, 16.07.2026) — голос Dmitry +6%
- n1 «5 бизнесов»: fx camui+statcard+likes+ticker, 3D droplet, Lottie(map pin, growth arrow), grade warm_cine, gl CrossZoom/Radial/cube/Dreamy/fade.
- n2 «конкурент снимает»: fx slam+callout+bars, 3D diamond, Lottie(race finish, ig heart), grade moody_dark, gl directionalwarp/GlitchMemories/SimpleFlip/burn/wipeLeft.
- n3 «сколько стоит молчать»: fx particles(ember)+statcard+donut+stamp, 3D torus, Lottie(coins, graph down), grade clean_ad, gl pixelize/StaticFade/LinearBlur/DoomScreen/fade.
- n4 «ролики которые продают»: fx lowerthird+shine, rem counter, 3D ring, Lottie(camera, play, thumbs), grade epic_gold, gl WaterDrop/FilmBurn/cube/Bounce/DreamyZoom.
- n5 «клиент за 30 сек»: fx toast+dm, rem graph, 3D coin, Lottie(stopwatch, rocket), grade glossy, gl SimpleZoom/GridFlip/crosswarp/fade/ripple.
- Правило: каждый тип FX — ровно в одном ролике партии; 3D-фигуры и Lottie-запросы уникальны.

## Партия n1–n5 v8 (16.07.2026) — планка поднята: 6 сегм., 15 кадров, 10-11 наложений, своя музыка
- Музыка (Freesound, разные настроения): n1 inspiring uplifting ambient, n2 dark tension drone,
  n3 melancholic piano, n4 epic uplifting corporate, n5 modern upbeat electronic.
- Lottie-запросы (все уникальны): n1[barber scissors, coffee steam, map pin, five stars, calendar check, growth arrow, thumbs up];
  n2[race finish, ig heart, eye views, clock, crowd, megaphone]; n3[coins falling, hourglass, sad face, graph down, empty wallet];
  n4[film camera, light bulb, gear, play button, handshake, rocket]; n5[stopwatch, clapper, fire, target, bell, swipe up].
- fx: каждый тип в одном ролике; 3D: droplet/diamond/torus/ring/coin; rem: counter(n4), graph(n5).
- gl: по 6 уникальных переходов на ролик. Кадры — 15 уникальных/ролик (hi-res ≤2560), дедуп по id.

## Ролик n14 «3 приёма снять дорого» (2026-07-16) — полезный формат, голос Dmitry +6%
- fx: camui, steps(1-2-3 свет/шаг/ритм), lowerthird×3 (ПРИЁМ 1/2/3), callout(к свету лицом),
  stamp×2 (БЕЗ ЗУМА / НАПИШИТЕ), gridpop, toast(свет·звук·монтаж), ticker, dm(СЪЕМКА), likes, shine.
- gl: windowslice, Swirl, doorway, Fold, hexagonalize (5 свежих, мимо реестра).
- 3d: torus / оранж #EA5920 (свежая фигура).
- grade: crisp_studio (новый — контраст+unsharp+винетка). music: Freesound 717286 «Upbeat Corporate Inspirational».
- Караоке: Союз Гротеск строчные, активное слово оранж &H2059EA& (стандартное ASS \k, одно событие на строку).

## Ролик n15 «Конкурент уже снимает» (2026-07-16) — виральный/продающий, голос Silero eugene
- fx: camui, statcard×2 (89% выбирают глазами / 100% досматривают), stamp×2 (А ВЫ? / НАПИШИТЕ),
  lowerthird×2 (ФАКТ / ДОВЕРИЕ), callout(листает мимо), bars×2 (без видео/с видео; реклама/видео),
  moneycount(50 000 ₽ на рекламу), ratings(5 вам доверяют), toast, dm, likes, ticker, shine.
- gl: CrossZoom, Rolls, StereoViewer, Overexposure, ZoomLeftWipe (5 свежих).
- 3d: coin / оранж #EA5920. grade: bold_punch (контраст+curves+винетка). music: Freesound 785656 «Trailer Cinematic».
- Голос Silero v4_ru eugene (авто-ударения). Субтитры Союз 2 слова, без тени/границы (Outline=0 Shadow=0).

## Ролик n16 «Пиццерия сняла один ролик» (2026-07-17) — виральный, голос Silero eugene
- fx: camui(REC), slam(ПУСТО/ПО БУДНЯМ), stamp×2 (ЗНАКОМО? / НАПИШИТЕ), lowerthird(ОДИН РОЛИК),
  callout(снимают процесс), statcard(300 000 просмотров), gridpop, donut(100% занято),
  profilecmp(будни 30 / пятница 100), toast(свет·вкус·эмоция), likes, dm(СЪЕМКА), ticker, shine.
- gl: Mosaic, InvertedPageCurl, kaleidoscope, wind, squareswire (5 свежих, мимо реестра).
- 3d: droplet / оранж #EA5920 (давно не использовалась). grade: firelight (тёплый огонь печи — новый).
- music: Freesound 728746 «Emotional Motivational Cinematic». SFX: sfx_bank (impact/pop/whoosh/riser/ding).
- Голос Silero v4_ru eugene (авто-ударения). Обложка: Nano Banana Pro (печь+камера+пицца) + реальный лого.

## Автопилот 2026-07-17 · barbershop_week (viral) — голос Silero eugene, обложка cover_flux, fx/gl/3d/grade авто-ротацией по индексу; тема «Барбершоп в вашем городе стоял пустым по будням.».
- 2026-07-28 | ролик 'джун-собес': наложений код-оверлеев нет (кинетик-субтитры несут динамику, по Библии §5.2 — по смыслу)
