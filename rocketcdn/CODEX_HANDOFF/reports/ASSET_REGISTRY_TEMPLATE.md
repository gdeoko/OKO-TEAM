# Rocket CDN — asset registry template

Создать копию этого файла как `ASSET_REGISTRY.md` и вести только для Rocket CDN. Secret/account credential values сюда не записывать.

| ID | Web/source path | Type | Service/model | Created | Prompt file | Input refs | Seed/job ID (non-secret) | Aspect/resolution/duration | License/rights | Integration mode | Status | Replaced by | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RC-EXAMPLE-001 | — | image/video/audio/texture | — | YYYY-MM-DD | prompts/...md | RC-REF-... | — | — | — | WebGL material / fallback / poster / SFX | reference | — | — |

## Status vocabulary

- `reference` — только визуальный/звуковой ориентир.
- `approved-source` — выбранный production master.
- `web-export` — оптимизированный runtime file.
- `integrated` — подключён в code и прошёл QA.
- `rejected` — не использовать.
- `superseded` — заменён новым ID.

## Integration modes

- `geometry-reference`
- `material-reference`
- `texture-map`
- `WebGL-video-texture`
- `fallback-video`
- `fallback-still`
- `poster`
- `OpenGraph`
- `music`
- `SFX`
- `voiceover`

## Required acceptance fields

Для `integrated` в Notes указать:

- A/B evidence path;
- viewport/device list;
- performance result;
- continuity result;
- license confirmation;
- reviewer/date.

