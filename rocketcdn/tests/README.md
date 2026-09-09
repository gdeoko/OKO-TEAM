# Offline regression checks

Run `npm ci --ignore-scripts` and `npm test` in this directory. Node.js 22+ is recommended. Dependencies are pinned in package-lock.json. They are development dependencies only.

The JS suite uses actual modules or scoped actual functions with controlled DOM/timers; geometry checks use the project's Three.js. PHP.wasm tests use the actual PHP storage and API code in an isolated virtual filesystem with synthetic records and an offline-only test key. They do not send live notifications. PHP.wasm does not validate native PHP-FPM concurrency, nginx, OS permissions, disk faults, graphics, mobile browser layout or FPS.

`php storage.php` is also available with native PHP. Run it from a writable temporary environment, never against live data.

`audio-regressions.cjs` adds 18 behavior checks against the complete CDN/VPN sound modules: delayed playback and resume, cancellation, first gestures, unsupported audio formats, visibility changes, and stored mute preferences. Its DOM and audio devices are controlled fixtures; it does not certify native browser autoplay or physical speakers. Together with the other JS checks, `npm test` runs 72 JavaScript checks, 12 storage checks, 7 delivery checks and 13 API checks.
