# Brand setup (bring your own)

This public build ships the engine, not any client's brand. Add three things
to make it yours:

1. **`fonts/`** — your subtitle + heading fonts (`.ttf`). SKILL.md examples use
   Soyuz Grotesk (subtitles) + Montserrat Black (numbers); use any you have rights to.
   Google Fonts (OFL) work great: Montserrat, Manrope, Oswald, Unbounded.
2. **`logo.png`** — your transparent logo (watermark + endcard).
3. **Brand colors** — edit the hex values in SKILL.md "Брендинг" and in
   `pipeline/build_reel.py` (`brand_bar`) / the Remotion / three.js templates.
   Defaults are a dark base + one accent color.

Everything else (stock, voiceover, motion, 3D, transitions, grading) needs no assets.
