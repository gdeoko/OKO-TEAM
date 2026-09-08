# Rocket — independent release snapshot

**Do not merge or copy this entire branch over the OKO monorepo.** It deliberately has independent history and contains only Rocket. Use `deploy/integrate.py` and the reviewed `deploy/rocket-overlay.json` to transfer listed changes into an existing Rocket development checkout. The default action checks conflicts without writing. It preserves unrelated projects, documentation and checks, and never commits or pushes. See `INTEGRATION.md`.

Rocket VPN, Rocket CDN, the space flight and their shared administration panel.

Production addresses: [VPN](https://rocketvpn.top/), [CDN](https://rocketcdn.ru/), [flight](https://rocketcdn.ru/?flight=1), [admin](https://rocketcdn.ru/admin.html). Current publication status and acceptance limits are recorded in `RELEASE_R8.md`; `RELEASE_R7.md`, `RELEASE_R6.md`, `RELEASE_R5.md`, `RELEASE_R4.md` and `RELEASE.md` preserve the earlier reports.

The client now runs **r8**, which fixes CDN screen-text downsampling on WebGL 1, flight projector/camera lifecycle, and post-processing buffer retirement. The native inspection produced 46 cabin/flight checkpoints across landscape and portrait, with no GL/shader errors and successful world rebuilding. The preceding r7 inspection produced 72 VPN checkpoints. These are selected native canvas frames, not continuous browser or physical-device FPS acceptance. Activation passed 28 server checks and retained all five existing requests. The exact r7 tree is now saved in GitHub as `6df75ec187d543c3556fe6726681f9907b415314`; the main and original Rocket branches remain unchanged.

The preceding follow-up changes were deployed on the client as r6. This release corrects the cabin PBR adapter and unsupported float render targets, and replaces the VPN backdrop drawing with a textured 3D Earth. The final activation passed 25 checks and retained all five pre-existing requests. See `FOLLOWUP_2026-09-08.md` and `VPN_AUDIT_2026-09-08.md`. Current health and rollback use `deploy/followup.py`; original activation scripts remain specific to r2. Local native WebGL 1 renders of the VPN finale and its post-processing pass without GL errors. Full browser 3D/HDR and physical-device performance acceptance remain incomplete.

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

48 JavaScript/geometry checks and 13 isolated API checks pass. Native PHP 8.3 validation on the client for the earlier r2 release covered 12 storage checks, 8 delivery checks, concurrent updates and 3 backup checks; it has not been repeated for the follow-up VPN package. The PHP.wasm suite skips interprocess `flock`. Test senders and test data are isolated.

The new browser review covers all 17 panel sections, the mobile drawer, VPN FAQ and theme, all seven native CDN cards, and measured VPN footer/admin content widths of 320/390/768/1440px. The game now explains failed 3D initialization on direct launch links in Russian and English. Earlier r2 review covered delivery retry and a real form request against isolated storage. These checks do **not** certify GPU rendering or real-device FPS: the available browser reports `GL_RENDERER = Disabled`.

## Source and operations

This branch is an orphan snapshot, based on `gdeoko/OKO-TEAM` at `6b64106bdde7488bee2b6485b210eaf1db4fc395`, with recovery and release changes. The live server was compared before overlaying code. Runtime configuration, credentials and customer records remain on the client; they are excluded from Git.

`deploy/activate.py --check` verifies release hashes, native PHP syntax and runtime write access. Activation backs up runtime data/configuration, drains old writers, atomically exchanges both roots, resets PHP caches and enables the delivery timer. `--rollback` restores code/configuration while retaining new records. Scripts under `deploy/` target the documented client paths and must not be run on unrelated hosts.

`deploy/prepare.py` records the one-off recovery using the original transfer archives; it is not a generic installer. For the active r8 release, run `sudo python3 /var/www/rocket-releases/20260908-r8/deploy/followup.py health`. Its `rollback` action restores r7 without reverting runtime records. `deploy/stage.py` maintains the isolated review routes.

The clean branch does not revoke credentials exposed in the original repository's history. Rotation of those broader OKO/GitHub access credentials is not established by this release. Photorealism, 8K output, exact Igloo parity and performance across physical devices remain unverified acceptance items.
