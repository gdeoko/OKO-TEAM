import type { CapacitorConfig } from '@capacitor/cli';

/**
 * OKO — Capacitor config (shared by Android + iOS).
 *
 * OKO is a self-contained HTML app that lives at https://true-journey-418.higgsfield.app.
 * Two ways to ship it inside the native shell:
 *
 *  A) REMOTE mode (default here) — the WebView loads the live site (`server.url`).
 *     Pro: instant updates, no rebuild to push app changes. Fastest to get a store build.
 *     Con: needs network on first launch; some stores (esp. Apple) may question a "thin
 *          web wrapper". For RuStore this is fine.
 *
 *  B) BUNDLED mode — copy oko-app/prototype/index.html into `webDir` (./www) and REMOVE
 *     the `server` block. The app works fully offline (the site already registers a
 *     service worker). Recommended for the App Store review to avoid the "wrapper" reject.
 *     See build-android.md / build-ios.md for the copy step.
 *
 * Switch modes by commenting/uncommenting the `server` block below.
 */
const config: CapacitorConfig = {
  appId: 'com.oko.app',
  appName: 'OKO',
  webDir: 'www',
  // --- REMOTE mode (A). Comment this whole block out for BUNDLED mode (B). ---
  server: {
    url: 'https://true-journey-418.higgsfield.app',
    cleartext: false,
    allowNavigation: [
      'true-journey-418.higgsfield.app',
      '*.higgsfield.app',
      '*.supabase.co',
      '*.twcstorage.ru',
    ],
  },
  // --------------------------------------------------------------------------
  backgroundColor: '#000000',
  android: {
    allowMixedContent: false,
    backgroundColor: '#000000',
    // for RuStore/Play release signing see build-android.md
  },
  ios: {
    backgroundColor: '#000000',
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#000000',
      androidScaleType: 'CENTER',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
    },
  },
};

export default config;
