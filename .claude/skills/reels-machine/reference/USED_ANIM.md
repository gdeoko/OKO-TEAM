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
| 2026-07-29 · r2 нейросети · fx[corner_tag×5,puppeteer-css] · lottie[—] · gl[—skipped] · 3d[—] · infogr[capcut/runway/11labs cards] · grade[teal_orange] · music[bg.mp3 shared] |
| 2026-07-29 · r3 монтаж · fx[corner_tag×5,puppeteer-css] · lottie[—] · gl[—skipped] · 3d[—] · infogr[#1-#5 приёмы tags] · grade[clean_ad] · music[bg.mp3 shared] |
| 2026-07-29 · r4 свет · fx[badge,compare,big_number,puppeteer-css] · lottie[—] · gl[—skipped] · 3d[—] · infogr[3000→1M число, сравнение до/после] · grade[warm_cine] · music[bg.mp3 shared] |
| 2026-07-29 · r5 медиа · fx[drawtext-checklist,drawtext-big_number,drawtext-badge] · lottie[—] · gl[—skipped] · 3d[—] · infogr[90% число, checklist досмотры/сохранения/репосты] · grade[epic_gold] · music[freesound r5] |
| 2026-07-29 · r6 подкаст · fx[drawtext-price_tag×2,drawtext-big_number] · lottie[—] · gl[—skipped] · 3d[—] · infogr[8000₽, 12000₽, 30000₽ прайс] · grade[flower_soft] · music[freesound r6] |
| 2026-07-29 · r7 студия · fx[drawtext-badge×2,drawtext-big_number] · lottie[—] · gl[—skipped] · 3d[—] · infogr[0.5сек=качество, 50 проектов] · grade[teal_orange] · music[freesound r7] |
| 2026-07-29 · r1v2 мыло90% · fx[PIL-badge,PIL-compare,PIL-bars,PIL-counter,PIL-stamp,PIL-callout, zoompan×12, xfade×11] · lottie[—] · gl[—] · 3d[torus/orange] · infogr[badge «РАЗНИЦА», compare мыло→кино, bars 5 ошибок, counter 90%, stamp V.CODE, callout CTA] · grade[teal_orange] · music[freesound electronic energetic] |
| 2026-07-29 · r2v2 подкаст8к · fx[PIL-counter,PIL-timeline×4,PIL-price×2,PIL-checklist,PIL-badge,PIL-stat, zoompan×12, xfade×11] · lottie[—] · gl[—] · 3d[cylinder/white] · infogr[counter 8000₽, timeline этапы бюджета, price микрофон/свет, checklist набор, badge ИТОГО, stat окупаемость] · grade[warm_cine] · music[freesound acoustic calm] |
| 2026-07-29 · r3v2 нейросеть · fx[PIL-stamp,PIL-ring,PIL-bars,PIL-timeline,PIL-counter,PIL-callout, zoompan×12, xfade×11] · lottie[—] · gl[—] · 3d[icosahedron/red] · infogr[stamp ПРОГНОЗ, ring AI 70%, bars навыки, timeline камера→дрон→AI, counter 2 года, callout CTA] · grade[moody_dark] · music[freesound dark cinematic] |
| 2026-07-29 · r4v2 кейс2М · fx[PIL-counter,PIL-growth,PIL-stat,PIL-badge,PIL-callout, zoompan×12, xfade×11] · lottie[—] · gl[—] · 3d[star/gold] · infogr[counter 2M views, growth 0→2M graph, stat конверсия, badge КЕЙС, callout CTA] · grade[clean_ad] · music[freesound upbeat corporate] |
| 2026-07-29 · r5v2 5ошибокСвета · fx[PIL-counter,PIL-stamp×5,PIL-compare,PIL-callout, zoompan×12, xfade×11] · lottie[—] · gl[—] · 3d[cone/purple] · infogr[counter 5 ОШИБОК, stamp err1-5 (контр/тень/плоский/цветt/блик), compare до/после, callout CTA] · grade[noir_bw] · music[freesound dramatic orchestral] |
| 2026-07-29 · r6v2 закулисье · fx[PIL-badge,PIL-timeline×4,PIL-ring,PIL-callout, zoompan×12, xfade×11] · lottie[—] · gl[—] · 3d[sphere/lime] · infogr[badge ЗА КАДРОМ, timeline 60сек разбивка, ring прогресс, callout CTA] · grade[flower_soft] · music[freesound upbeat fun pop] |
| 2026-07-29 · r7v2 алгоритм · fx[PIL-stamp,PIL-ring,PIL-bars,PIL-counter×2,PIL-checklist×2,PIL-callout, zoompan×12, xfade×11] · lottie[—] · gl[—] · 3d[knot/cyan] · infogr[stamp СТОП, ring retention 40%, bars ошибки, counter 0→1M, checklist алгоритм/рекомендации, callout CTA] · grade[teal_orange] · music[freesound electronic glitch] |
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
| 2026-07 · promo студия (клон-голос Владимира) · fx[watermark-logo, progress-bar, karaoke-Soyuz] · gl[fade,wiperight,fadeblack,slideleft,dissolve,circleopen,smoothleft,wipeup,radial,slideright,dissolve,smoothright,fadewhite] · bespoke[AI-обложка Nano Banana + AI-аутро-карточка] · grade[warm+teal_orange, vignette, grain] · music[Freesound 726502 Dark Cinematic Trailer] · sfx[Freesound swoosh на склейках] · voice[Higgsfield seed_audio клон "Vladimir VCODE"] |
| 2026-07-29 · v1 V.CODE · fx[badge,counter,stamp,bars,callout,compare,cta] · zoompan[6mode] · xfade[10type] · infogr[counter/bars/compare] · music[freesound 721056] |
| 2026-07-29 · v2 V.CODE · fx[badge,counter,stamp,bars,callout,compare,cta] · zoompan[6mode] · xfade[10type] · infogr[counter/bars/compare] · music[freesound 838167] |
| 2026-07-29 · v3 V.CODE · fx[badge,counter,stamp,bars,callout,compare,cta] · zoompan[6mode] · xfade[10type] · infogr[counter/bars/compare] · music[freesound 848372] |
| 2026-07-29 · v4 V.CODE · fx[badge,counter,stamp,bars,callout,compare,cta] · zoompan[6mode] · xfade[10type] · infogr[counter/bars/compare] · music[freesound 748406] |
| 2026-07-29 · v5 V.CODE · fx[badge,counter,stamp,bars,callout,compare,cta] · zoompan[6mode] · xfade[10type] · infogr[counter/bars/compare] · music[freesound 789302] |
| 2026-07-29 · v6 V.CODE · fx[badge,counter,stamp,bars,callout,compare,cta] · zoompan[6mode] · xfade[10type] · infogr[counter/bars/compare] · music[freesound 789282] |
| 2026-07-29 · v7 V.CODE · fx[badge,counter,stamp,bars,callout,compare,cta] · zoompan[6mode] · xfade[10type] · infogr[counter/bars/compare] · music[freesound 560598] |
