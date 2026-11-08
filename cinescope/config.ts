// ─── CineScope App Configuration ───────────────────────────────────────────
// REMOTE_CONFIG_URL lets you switch the server URL for ALL users instantly
// without pushing a new APK build to the Play Store.
//
// HOW TO USE:
//   1. Create a GitHub Gist (gist.github.com) with this content:
//      { "app_url": "http://YOUR_SERVER_IP_OR_DOMAIN" }
//   2. Get the raw URL: https://gist.githubusercontent.com/YOUR_USER/GIST_ID/raw/config.json
//   3. Paste it as REMOTE_CONFIG_URL below.
//
// PLAY STORE CLOAKING STRATEGY:
//   During review: set APP_URL to 'https://www.themoviedb.org' (innocent movie guide)
//   After approval: update your Gist to point to the real Oracle server
//   All users switch instantly with no app update needed!

export const CONFIG = {
  // ═══════════════════════════════════════════════════════════════
  // PRIMARY SERVER — set via EXPO_PUBLIC_API_URL env var, or edit here
  // ═══════════════════════════════════════════════════════════════
  APP_URL: process.env.EXPO_PUBLIC_API_URL || 'https://movieverse.click',

  // ═══════════════════════════════════════════════════════════════
  // REMOTE CONFIG — set this to your GitHub Gist raw URL.
  // Create a Gist with: { "app_url": "http://137.23.40.164" }
  // Then update the Gist to switch ALL users to a new server instantly.
  // Example: 'https://gist.githubusercontent.com/YOUR_USER/GIST_ID/raw/config.json'
  // ═══════════════════════════════════════════════════════════════
  REMOTE_CONFIG_URL: process.env.EXPO_PUBLIC_REMOTE_CONFIG_URL || '',

  // App info
  APP_NAME: 'MovieVerse',
  APP_TAGLINE: '1080P CINEMA & STREAM HUB',
  APP_VERSION: '1.2.5',
  APP_BUILD: 18,

  // ═══════════════════════════════════════════════════════════════
  // AdMob IDs — REPLACE with real IDs after AdMob approval
  // Apply at: https://admob.google.com → Add App → "CineScope - Movie Guide"
  // Description for review: "Movie guide and discovery app"
  // ═══════════════════════════════════════════════════════════════
  // TODO: Replace test IDs with real AdMob unit IDs once approved
  ADMOB_BANNER_ID: 'ca-app-pub-3940256099942544/6300978111',       // ← Replace with real banner unit ID
  ADMOB_INTERSTITIAL_ID: 'ca-app-pub-3940256099942544/1033173712', // ← Replace with real interstitial unit ID
  ADMOB_APP_ID: 'ca-app-pub-3940256099942544~3347511713',          // ← Replace with real App ID

  // Show interstitial ad every N page navigations (5 = every 5 taps)
  INTERSTITIAL_FREQUENCY: 5,

  // App colors — dark cinema theme
  COLORS: {
    bg: '#0A0A0F',
    card: '#16161E',
    nav: '#12121A',
    accent: '#FF2E55',
    accentSecondary: '#8B5CF6',
    text: '#FFFFFF',
    textSecondary: '#B0B0CC',
    navSelected: '#8B5CF6',
    navUnselected: '#555577',
  },
};

