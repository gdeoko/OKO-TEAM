# Rocket recovery — 2026-09-08

This is an isolated source snapshot for Rocket VPN, Rocket CDN, the space flight and their existing administration panel. It has no parent commit and does not carry the original repository's credentials file or history. No live site has been switched to this snapshot.

Source: `gdeoko/OKO-TEAM`, branch `claude/rocket-cdn-website-admin-x5482k`, commit `6b64106bdde7488bee2b6485b210eaf1db4fc395`, plus the recovery changes listed below. Runtime assets are retained. Old audits, screenshots and deployment scripts are excluded.

## Changes

- VPN camera and acts share one smoothed scroll coordinate. Reload and resize preserve progress.
- Menu/form close timers and pending opening frames are cancelled on rapid reopen/close. Music resume cancels a scheduled pause.
- VPN analytics requeues failed requests, retries rejected beacons with keepalive fetch, and resumes after bfcache. Per-document event IDs support server deduplication; the server keeps the latest 25,000–30,000 IDs per site/day, not an unlimited ledger. Beacon acceptance still cannot prove delivery.
- Analytics event names preserve Cyrillic. A visitor's device is counted once even when a batch contains several views. Dashboard growth compares equal-length periods and does not fabricate a percent when the prior count is zero.
- JSON writes and updates share a sidecar lock and publish via atomic rename. Failed encoding/writes preserve old data. Corrupt existing JSON is rejected. API mutations return HTTP 503 on storage failure. Native filesystem/concurrency validation remains required before production.
- Admin node edits retain hidden nodes and zero values, and reject malformed coordinates. Both CSV exporters neutralize leading spreadsheet formulas.
- Deferred flight construction uses a generation number, with cancellation on world replacement. Restored beacons use planet world coordinates after parenting. Partial world builds release resources. WebGL budget refusal is honored and detached guards stop handling old canvas events.
- Cancelling docking cancels delayed navigation. `flight=1` triggers the explicit launch once. Returning from CDN lands at the VPN final panel.
- The final VPN act now owns the mini-game's geometry and updates; the preceding launch act no longer controls it. Closing the panel pauses the game. Visual placement is not accepted yet.
- Disk monitoring recognizes zero available bytes.

## Checks

From the snapshot root:

```sh
npm ci --prefix rocketcdn/tests --ignore-scripts
npm test --prefix rocketcdn/tests
```

Results: 19 JavaScript/geometry checks, 12 storage checks and 6 API checks pass (37 total). PHP 8.3 runs in PHP.wasm with isolated synthetic data and no live credentials. Four changed PHP files pass parsing; 93 frontend/inline scripts pass JavaScript parsing. `rocketcdn/tests/storage.php` can also run under native PHP for a storage smoke check.

A comparison using the original source failed 17 of the initial 18 JS checks; some failures are missing newly introduced interfaces, so this is not a claim of 17 independent real-device reproductions.

## Release status and remaining work

The September 8 revised server build mentioned in the previous chat was not recovered. Compare it and current live files before applying this snapshot; do not overwrite later work or client configuration/data. The previous chat's new notification queue and 17-section admin build are not established by this snapshot.

The new particles-to-cabin finale is NOT implemented or visually accepted here. The existing full particle scenes and cockpit remain. GPU visual quality, FPS, mobile layout, gameplay placement, browser resource recovery and complete forms remain acceptance gates. The available cloud browser failed to create a WebGL context; state and geometry checks are not substitutes for GPU testing.

Server inspection/deployment is blocked by automatic approval review of the privileged OKO Poster bridge request. No DNS, production configuration, live data, bot notifications or email were modified by this work.

Before release: recover/diff the previous build; rotate the known exposed access key through an approved path; back up current data/config; verify native PHP permissions and concurrent writers; restart/drain old PHP/cron writers before introducing the sidecar-lock protocol; validate nginx API routing and all assets on staging; bump asset versions; run desktop/mobile GPU acceptance; then perform a reversible production switch. Notification durability and unified administration still need the recovered server source and separate verification.
