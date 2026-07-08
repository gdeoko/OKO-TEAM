# How Claude Code became a motion-design editor that runs a content factory

*Companion article for the [reels-machine skill](https://github.com/gdeoko/oko-magic-skill/tree/main/skills/reels-machine). Feel free to republish.*

I asked Claude Code to make an Instagram Reel from a script — "like a good editor
would." Not a slideshow with a stock-music bed. A *finished* vertical video: real
footage cut to the beat, Russian neural voiceover with karaoke, 3D, infographics,
shader transitions, color grade, sound design. One command. Free.

After 7 iterations with a real client, it does exactly that — and the interesting
part isn't any single effect. It's that it stopped looking like a template.

## The problem with "AI video": everything looks the same

The first three reels were technically fine and *identical in feel*. Same counter
animation, same wipe transitions, same everything. The client's words: "the effects
repeat, you're using less than half of what's possible."

The fix wasn't more effects. It was a **rule engine**. Only the brand stays constant
— logo, colors, subtitle font, endcard. Everything else is chosen per video by
*meaning* from the script, and a registry blocks repeats: no technique more than
once per three videos, finales and transitions always different. Every video the
agent runs: **director's manifest → repeat-check → build → novelty-check → log**.
That's the difference between one template and a factory that can make a thousand.

## The non-obvious wins, now baked into the skill

**1. Word-level karaoke that actually lands.** `edge-tts` is free and gives word
timestamps — *if* you pass `boundary="WordBoundary"` (default is sentence; you get
empty timings and no idea why). Those timestamps drive karaoke subtitles and pin
every animation to the exact word being spoken. Forced stress marks (U+0301) fix
the robot mispronouncing homographs.

**2. 125 shader transitions for free.** `gl-transitions` ships GLSL you run over the
two frames at a cut. Rendered through a headless WebGL context, a different set each
video (WaterDrop for water, page-curl for "turning a page", kaleido for beauty).
This alone jumps the production value from "CapCut preset" to "paid template pack".

**3. A 3D object *inside* the live shot.** Not a sticker on top — a three.js object
composited into the stock footage with a contact shadow, the scene's own lighting,
a camera orbit and background parallax, so it reads as *in* the room. The gotcha:
models whose geometry center is far from origin fly out of frame — scale first,
then `position.copy(center).multiplyScalar(-scale)`. And SpecGloss materials render
invisible; override to `MeshStandardMaterial` on traverse.

**4. Bring any flat photo to life (2.5D).** Depth-Anything V2 as ONNX runs locally,
no keys, no quota — one forward pass gives a depth map, then a displaced plane in
three.js lets the camera fly into a still. A plain stock photo becomes a moving shot.

**5. Infographics that spring, not fade.** Remotion (React → frames) with spring
physics: bar charts that pop in sequence, glowing line graphs that draw themselves,
odometers that roll, before/after sliders. Rule: a *different* chart per number, and
never overlap two on the timeline (they collide and look like a bug).

**6. Timings never drift: render in 3 ffmpeg stages, not one mega-graph.** One giant
filter graph desyncs. Stage 1 shots+grade, stage 2 transitions+overlays, stage 3
subtitles+audio. And every `-loop 1` image needs `-framerate 30` + a final `-t`, or
25fps streams break framesync and the video freezes on a frame. Screen-blend for
light leaks only through `format=gbrp` — skip it and your frame goes purple.

**7. What didn't work, so you don't waste the day.** Local lip-sync avatars
(wav2lip) look cheap — the mouth is mush; for talking-head use paid HeyGen/Higgsfield
or don't. Mixkit music URLs 403; pull music from Freesound. ZeroGPU generation is
free but the daily quota is tiny — one attempt, don't hammer it.

## The result

A reel a freelance motion designer would charge $300 for, from a text script, in one
session, with free tools — and the next one looks *different* on purpose.

Grab it (MIT): **github.com/gdeoko/oko-magic-skill** → `skills/reels-machine`.
Copy into `.claude/skills/`, add your brand, describe your video.
