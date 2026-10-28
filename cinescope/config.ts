// Remote config - controls what URL the app loads
// During Play Store review: loads TMDB (clean, innocent movie database)
// After approval: switch APP_URL in this file OR use Firebase Remote Config
// to push the real streaming URL to all users instantly

export const CONFIG = {
  // ═══════════════════════════════════════════════════════════════
  // CHANGE THIS after Play Store approves your app:
  // Set it to your Railway URL e.g. "https://moviebox-xxx.up.railway.app"
  // ═══════════════════════════════════════════════════════════════
  // Active Streaming Platform URL (loads automatically without manual configuration)
  APP_URL: 'http://192.168.100.151:8000',

  // Optional: URL to a JSON endpoint or Firebase / GitHub Gist returning {"app_url": "..."}
  // When empty, it uses APP_URL directly
  REMOTE_CONFIG_URL: '',

  // App info
  APP_NAME: 'CineScope',
  APP_TAGLINE: 'MOVIE GUIDE & DISCOVERY',

  // AdMob IDs — replace with real ones after AdMob approval
  // These are Google's official TEST IDs (safe to use during development)
  ADMOB_BANNER_ID: 'ca-app-pub-3940256099942544/6300978111',       // Test banner
  ADMOB_INTERSTITIAL_ID: 'ca-app-pub-3940256099942544/1033173712', // Test interstitial
  ADMOB_APP_ID: 'ca-app-pub-3940256099942544~3347511713',          // Test app ID

  // Show interstitial ad every N page navigations
  INTERSTITIAL_FREQUENCY: 5,

  // Colors
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
