# 🎬 Reels Machine

**Turn Claude Code into a one-person motion-design studio.** Give it a script —
get back a finished vertical video (1080×1920) at the level of a top editor.
Free. One command. Built to run a *content factory*, not spit out one template.

> Type what you want. Claude finds the stock footage, voices the script, cuts it
> to the beat, adds 3D, infographics, kinetic type and shader transitions,
> color-grades it, scores it — and hands you an MP4.

Battle-tested on 7+ real client reels (bakery, florist, video-production studio),
each iterated with the client until it *popped*.

---

## Why it's different: the content **factory**

Most "AI video" tools have one look. Reels Machine has a **rule**: only the brand
is constant (logo, colors, subtitle font, endcard). **Everything else changes every
video** — footage, effects, transitions, 3D, infographics, grade, music — chosen
by *meaning* from the script. A registry (`reference/USED_EFFECTS.md`) blocks
repeats: no technique more than once per 3 videos, finales and transitions always
different. That's how you make 1000 reels that don't feel like 1000 copies.

Per video the agent runs: **director's manifest → repeat-check → build → novelty-check → log**.

---

## What's inside

| Category | The gold |
|---|---|
| 🎙 **RU neural voiceover** | `edge-tts` (free), word-level timestamps → karaoke that lands on the beat, forced stress marks |
| 🎞 **Real stock** | Pexels / Pixabay / Mixkit — native vertical 4K, picked by eye from a contact sheet, not the first hit |
| ✨ **125 shader transitions** | `gl-transitions` GLSL run over the cut — WaterDrop, ripple, morph, page-curl, kaleido… a different set every video |
| 🧊 **3D via three.js** | A 3D object *inside* the live stock shot (contact shadow, scene light, camera orbit), 3D metal type, particles-into-logo, particle tunnel fly-through, Sketchfab CC models |
| 🌀 **2.5D parallax** | Bring *any* flat photo to life — depth map from Depth-Anything V2 (ONNX, local, no keys), camera flies into the scene |
| 📊 **Remotion infographics** | Spring bar charts, glowing line graphs, donuts, odometers, ring gauges, before/after sliders — a different one per number |
| 🔤 **Kinetic typography** | Words slam in with spring physics, blur trails, shock rings |
| 💡 **Light leaks** | Real WebGL `@remotion/light-leaks` on the cuts — light that *breathes* |
| 🗺 **Map flyover** | MapLibre camera flight to the client's city (local OSM tiles) |
| ✂️ **Local cutout** | `rembg` — cut a subject from a frame → collage / cover / composite on a glow bg |
| 🎨 **Niche grading** | warm-cine, teal-orange, clean-ad, flower-soft, noir b/w — picked from the manifest |
| 🎵 **Scored & ducked** | Music sidechain-compressed under the voice, meaningful SFX, `loudnorm` to IG spec |

Optional (when quota/keys allow): free HF ZeroGPU generation — FLUX frames,
Wan first→last-frame morphs, LTX i2v b-roll.

**No paid API required for the core.** Stock, voice, motion, 3D, transitions,
grading, cutout — all free and local.

---

## The pipeline (3-stage ffmpeg, timings never drift)

1. **stage 1** — cover as frame 1 (0.3s hook) · shots with 4 alternating motion
   modes (zoom-in/out, pan L/R) · glitch on cuts · watermark · progress bar · grade.
   PNG sequences (3D / parallax / map) drop in as full-screen shots via `SEQ:<dir>`.
2. **stage 2** — shader transitions + all motion/3D/infographic overlays,
   time-separated so nothing collides · light leaks · screen-blend done right
   (`format=gbrp`, or your frame goes purple).
3. **stage 3** — karaoke ASS subtitles + audio mix (voice ducks the music).

Then a QC pass: 12–15 exact-seek frames in a grid, checked by eye.

---

## Install

```bash
# copy the skill into your repo
cp -r skills/reels-machine .claude/skills/reels-machine
# add your brand — see skills/reels-machine/BRAND_SETUP.md (fonts, logo, colors)
```

Claude Code picks it up automatically and triggers on "make a reel / short /
promo / ad from this script". First run installs its toolchain (ffmpeg, edge-tts,
Playwright, Remotion, gl-transitions, three, rembg) — see SKILL.md.

---

## 🇷🇺 По-русски

**Claude Code превращается в моушн-монтажёра под ключ.** Даёшь сценарий — получаешь
готовый вертикальный ролик 1080×1920 уровня топового монтажёра. Бесплатно, по одной
команде. Это **контент-завод**: постоянен только бренд (лого, цвета, шрифт субтитров,
финалка), всё остальное — кадры, эффекты, переходы, 3D, инфографика, грейд, музыка —
меняется под смысл каждого сценария и не повторяется (реестр запрета повторов:
приём не чаще 1 раза в 3 ролика, финалы и переходы всегда разные).

Внутри: русская нейроозвучка с караоке по словам, реальные стоки, 125 шейдерных
переходов, 3D-объект внутри живого кадра, 2.5D-оживление фото, инфографика Remotion,
кинетическая типографика, световые лики, карта-флайовер, вырезка объектов, грейд под
нишу, музыка с дакингом. Ядро — без единого платного ключа.

Установка: скопируй `skills/reels-machine/` в `.claude/skills/`, добавь свой бренд
(`BRAND_SETUP.md`). Всё.

---

Made by **OKO TEAM** · okoteam.top · Built with Claude Code
⭐ Star it if Claude just built you a reel a motion designer would charge $300 for.
