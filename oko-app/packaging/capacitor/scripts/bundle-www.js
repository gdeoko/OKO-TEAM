#!/usr/bin/env node
/**
 * Bundle OKO for OFFLINE / App-Store-safe mode.
 * Copies the self-contained prototype into ./www so Capacitor ships it inside the app.
 * Run from packaging/capacitor:   npm run bundle:www
 *
 * After running: remove (or comment out) the `server` block in capacitor.config.ts,
 * then `npx cap sync`.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..', '..', 'prototype', 'index.html'); // oko-app/prototype/index.html
const WWW = path.resolve(__dirname, '..', 'www');
const DEST = path.join(WWW, 'index.html');

if (!fs.existsSync(SRC)) {
  console.error('Prototype not found at', SRC);
  process.exit(1);
}
fs.mkdirSync(WWW, { recursive: true });
fs.copyFileSync(SRC, DEST);
console.log('Bundled', SRC, '->', DEST);
console.log('Now remove the `server` block in capacitor.config.ts and run `npx cap sync`.');
console.log('NOTE: bundled offline mode means app updates require a new store build.');
