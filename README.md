# Rocket — release 2026.09.08-r2

Rocket VPN, Rocket CDN, the space flight and their shared administration panel.

Production addresses: [VPN](https://rocketvpn.top/), [CDN](https://rocketcdn.ru/), [flight](https://rocketcdn.ru/?flight=1), [admin](https://rocketcdn.ru/admin.html). Publication status and acceptance limits are recorded in `RELEASE.md`.

## Changes

- VPN uses one progress value for scrolling, camera and acts. Resizing, restored scroll positions, rapid form reopening and music toggles retain their state correctly.
- The finale retains the full particle scenes, then assembles particles onto actual cabin surfaces. Cabin materials and the control panel appear along the same reversible transition. The final act owns the mini-game. A readable fallback remains available when WebGL cannot start.
- CDN's 360° cabin has opaque, untonemapped display materials and a higher adaptive resolution ceiling. A native text reader follows the seven wall panels, with expandable content independent of perspective and render resolution.
- Flight construction cancels retired work, disposes partial scenes and honors the WebGL context budget. Manual thrust moves the camera in remote systems; planet clearance, restored beacon coordinates, docking cancellation, explicit launch and return to the VPN finale are corrected.
- The shared panel has 17 sections: three-product analytics, requests, support, delivery status/retry, nodes, content, settings and release health. Cyrillic navigation survives reload. CDN and VPN content are separated; late responses cannot replace the selected editor. VPN overrides render as escaped plain text.
- Atomic JSON publication and stable locks preserve old data on failures. API storage failures return 503. Analytics retries are deduplicated; Cyrillic events, device counts, equal-period comparisons and CSV escaping are corrected.
- Delivery intent is saved with each request. A separate worker retries individual failed channels without resending confirmed channels. Delivery is **at least once**: an ambiguous provider response can still cause a duplicate.
- Backups include support records and Telegram offset under a shared checkpoint. A corrupt source cannot replace the previous backup. Native concurrency testing retained all 240 updates from four processes.
- The VPN `/bot` address redirects to its existing Telegram bot. The CDN traffic animation is explicitly labelled as an illustration in both languages.

## Verification

```sh
npm ci --prefix rocketcdn/tests --ignore-scripts
npm test --prefix rocketcdn/tests
```

23 JavaScript/geometry checks and 13 isolated API checks pass. Native PHP 8.3 validation on the client covers 12 storage checks, 8 delivery checks, concurrent updates and 3 backup checks. The PHP.wasm suite skips interprocess `flock`; the native server covers it. Test senders and test data are isolated.

Browser review covers the 17 panel sections, delivery retry, VPN content selection, a real form request against isolated storage, expandable CDN cards, keyboard navigation, and 320px layouts. These checks do **not** certify GPU rendering or real-device FPS: the available browser reports `GL_RENDERER = Disabled`.

## Source and operations

This branch is an orphan snapshot, based on `gdeoko/OKO-TEAM` at `6b64106bdde7488bee2b6485b210eaf1db4fc395`, with recovery and release changes. The live server was compared before overlaying code. Runtime configuration, credentials and customer records remain on the client; they are excluded from Git.

`deploy/activate.py --check` verifies release hashes, native PHP syntax and runtime write access. Activation backs up runtime data/configuration, drains old writers, atomically exchanges both roots, resets PHP caches and enables the delivery timer. `--rollback` restores code/configuration while retaining new records. Scripts under `deploy/` target the documented client paths and must not be run on unrelated hosts.

`deploy/prepare.py` records the one-off recovery using the original transfer archives; it is not a generic installer. For checking the active release, use `deploy/health.py` and `deploy/activate.py --check` on the client. `deploy/stage.py` maintains the isolated review routes.

The clean branch does not revoke credentials exposed in the original repository's history. Rotation of those broader OKO/GitHub access credentials is not established by this release. Photorealism, 8K output, exact Igloo parity and performance across physical devices remain unverified acceptance items.
