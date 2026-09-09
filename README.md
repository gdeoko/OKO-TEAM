# Rocket — independent release snapshot

**Do not merge or copy this entire branch over the OKO monorepo.** It deliberately has independent history and contains only Rocket. Use `deploy/integrate.py` and the reviewed `deploy/rocket-overlay.json` to transfer listed changes into an existing Rocket development checkout. The default action checks conflicts without writing. It preserves unrelated projects, documentation and checks, and never commits or pushes. See `INTEGRATION.md`.

Rocket VPN, Rocket CDN, the space flight and their shared administration panel.

Production addresses: [VPN](https://rocketvpn.top/), [CDN](https://rocketcdn.ru/), [flight](https://rocketcdn.ru/?flight=1), [admin](https://rocketcdn.ru/admin.html). **r9 is deployed and ready for client acceptance.** It fixes analytics retries, content-editor races and drafts, cabin material preservation and excessive specular noise. The cabin module is synchronized between CDN and VPN. See `RELEASE_R9.md` and `review/r9-verification.json`.

Activation passed 30 server checks and retained all five existing requests. The exact deployed source commit is `d7d45406ba29510c813a7d8b67dfa14eee0cccb3`; r8 remains available for rollback. The final external HTTP check was blocked by this environment and is not claimed as passed.

The new r9 native inspection produced 58 checkpoints: 46 for CDN/flight and 12 for the VPN finale, across landscape and portrait. No GL/shader or scene-event failures were recorded, and the flight camera lifecycle passed. Native PHP 8.3.6 on the client passed 24 isolated checks, including all 240 concurrent writes and coherent backup snapshots. These are native canvas checkpoints and isolated service checks, not physical-device FPS acceptance. The r8 publication and earlier acceptance records remain in the historical release notes.

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

54 JavaScript/geometry checks, 13 isolated API checks, 12 storage checks and 7 delivery checks pass for r9. Ten deployment/integration checks and all 24 manifest files also pass. Native PHP 8.3.6 on the client now passes storage, delivery-lock, concurrency and backup checks for r9. The PHP.wasm suite itself skips interprocess `flock`. Test senders and test data are isolated.

The preceding browser review covered all 17 panel sections, the mobile drawer, VPN FAQ and theme, all seven native CDN cards, and measured VPN footer/admin content widths of 320/390/768/1440px. The game explains failed 3D initialization on direct launch links in Russian and English. Earlier r2 review covered delivery retry and a real form request against isolated storage. These checks do **not** certify GPU rendering or real-device FPS: the available browser reports `GL_RENDERER = Disabled`. The 58 new r9 native frames are documented separately and do not remove that browser limitation.

## Source and operations

This branch is an orphan snapshot, based on `gdeoko/OKO-TEAM` at `6b64106bdde7488bee2b6485b210eaf1db4fc395`, with recovery and release changes. The live server was compared before overlaying code. Runtime configuration, credentials and customer records remain on the client; they are excluded from Git.

`deploy/activate.py --check` verifies release hashes, native PHP syntax and runtime write access. Activation backs up runtime data/configuration, drains old writers, atomically exchanges both roots, resets PHP caches and enables the delivery timer. `--rollback` restores code/configuration while retaining new records. Scripts under `deploy/` target the documented client paths and must not be run on unrelated hosts.

`deploy/prepare.py` records the one-off recovery using the original transfer archives; it is not a generic installer. For the active r9 release, run `sudo python3 /var/www/rocket-releases/20260909-r9/deploy/followup.py health`. Its `rollback` action restores r8 without reverting runtime records. `deploy/stage.py` maintains the isolated review routes.

The clean branch does not revoke credentials exposed in the original repository's history. Rotation of those broader OKO/GitHub access credentials is not established by this release. Photorealism, 8K output, exact Igloo parity and performance across physical devices remain unverified acceptance items.
