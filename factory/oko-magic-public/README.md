# 🌙 OKO magic skill

**Turn Claude Code into a one-person Awwwards-level web studio.**

A battle-tested [Agent Skill](https://code.claude.com/docs/en/skills) for Claude Code: free AI image & video generation (no API keys required), scroll-scrubbed video, Three.js spline camera journeys, Rive characters, print-ready CMYK PDFs, and a mandatory self-QA loop where Claude screenshots its own work and fixes it before showing you.

**Live demo built with this skill (one session, from scratch):** https://spicy-panther-317.higgsfield.app — a scroll-driven 3D night flight: spline camera, bloom, animal silhouette "moon theatre", glowing wholesale portal, interactive animated 3D fox, game-style HUD and synthesized ambient sound. All assets free.

## What's inside

| Recipe | The gold |
|---|---|
| 🎨 **Free AI generation** | Hugging Face Spaces via `gradio_client` directly — verified live spaces for images (FLUX-Krea, Z-Image-Turbo, Qwen-Image), image editing (Qwen-Image-Edit) and first→last-frame video (Wan 2.2) |
| 🎬 **Scroll-scrubbed video** | Frame A → edited frame B → Wan video → `ffmpeg -g 4` re-encode for buttery `currentTime` seeking |
| 🌌 **3D scroll journeys** | The CatmullRom gotcha nobody tells you about: control points are NOT at uniform curve params — precompute anchors + remap, or your chapters drift off their scenes |
| ✨ **Bloom without blowouts** | UnrealBloomPass settings that keep yellows from nuking to white |
| 🦊 **Rive characters** | Only `@rive-app/canvas-single` works offline/behind proxies (WASM inlined) — the regular build silently fails |
| 🖨 **Print-ready PDFs** | reportlab CMYK + bleed + crop marks, the charSpace leak bug, Cyrillic font subsetting traps |
| 🔍 **Self-QA loop** | Playwright + system Chromium with WebGL in headless (swiftshader), real `mouse.wheel` scrolling for Lenis, video recordings of full scroll-throughs |
| 🧠 **Git second brain** | Obsidian-compatible `brain/` vault: project memory, session logs, environment gotchas — Claude reads it at session start, writes at session end |

## Install

```bash
# in your repo
mkdir -p .claude/skills/oko-magic
curl -o .claude/skills/oko-magic/SKILL.md \
  https://raw.githubusercontent.com/gdeoko/oko-magic-skill/main/skills/oko-magic/SKILL.md
```

That's it. Claude Code picks it up automatically and triggers it on "make a website", "3D", "scroll effects", "like in that video", "generate images", "print PDF", etc.

## Philosophy

1. **Don't ask — do, verify, show.** Claude screenshots its own output and iterates at least twice before you see it.
2. **Blocked on an external resource?** Claude gives you a one-line task ("connect X: link, what to press") and keeps working on everything else.
3. **Everything vendored.** No CDN dependencies in production — sites are self-contained.
4. **Memory lives in git.** Sessions are ephemeral; knowledge isn't.

---

## 🇷🇺 По-русски

Скилл, который превращает Claude Code в студию полного цикла: бесплатная генерация картинок и видео (HF Spaces, без ключей), видео-скраб на скролле, 3D-полёты камеры по сплайну, персонажи Rive, печатные PDF в CMYK для типографии, и обязательный цикл самопроверки через Playwright-скриншоты.

Живое демо (собрано этим скиллом за одну сессию): https://spicy-panther-317.higgsfield.app

Установка: скопируй `skills/oko-magic/SKILL.md` в `.claude/skills/oko-magic/` своего репозитория. Всё.

---

Made by **OKO TEAM** · okoteam.top · Built with Claude Code

⭐ If this saved you a day of debugging bloom blowouts or CatmullRom drift — star it.
