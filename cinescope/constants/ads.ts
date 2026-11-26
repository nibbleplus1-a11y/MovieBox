/**
 * ads.ts
 * Master configuration for CineScope's native ad system & CineCoins economy.
 * All creatives and links are native React Native components — zero WebView ad scripts,
 * zero third-party DOM trackers, 100% resilient to Brave & DNS ad-blockers.
 */

export interface AdCampaign {
  id: string;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  ctaText: string;
  icon: string;
  accentColor: string;
  monetagUrl: string;
  posterUri: string;
  rating: string;
  genres?: string[];
  weight?: number; // Higher = shown more frequently
}

export const AD_CONFIG = {
  // Pre-roll gating
  PRE_ROLL_COOLDOWN_MS: 10 * 60 * 1000, // Show at most once every 10 minutes
  SKIP_DELAY_SECONDS: 5,                // Skip button unlocks after 5s

  // CineCoin Economy
  DEFAULT_STARTING_COINS: 3,
  COINS_PER_REWARDED_AD: 3,
  COINS_PER_SPONSOR_VISIT: 1,
  COINS_FOR_DAILY_BONUS: 1,

  // CineCoin Redemption Costs
  COST_AD_FREE_24H: 10,
  COST_SKIP_AD: 1,
  COST_FAST_DOWNLOAD: 3,

  // Fallback direct URL (Monetag)
  DEFAULT_MONETAG_URL: 'https://uplcm.com/4/12213398',
};

export const AD_CAMPAIGNS: AdCampaign[] = [
  {
    id: 'shield_vpn',
    badge: 'SPONSORED',
    badgeColor: '#FF2E55',
    title: 'Shield VPN · 82% Off',
    subtitle: 'Stream securely at full 4K speed with zero ISP throttling & private DNS.',
    ctaText: 'Claim 82% Off',
    icon: 'shield-checkmark',
    accentColor: '#FF2E55',
    monetagUrl: 'https://uplcm.com/4/12213398',
    posterUri: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&q=80',
    rating: '4.9',
    genres: ['Action', 'Thriller', 'Sci-Fi'],
    weight: 10,
  },
  {
    id: 'cloud_gaming',
    badge: 'FEATURED',
    badgeColor: '#38BDF8',
    title: 'Play 10,000+ Games Free',
    subtitle: 'Instant cloud gaming on phone & TV with zero downloads & real rewards.',
    ctaText: 'Play Free',
    icon: 'game-controller',
    accentColor: '#0284C7',
    monetagUrl: 'https://uplcm.com/4/12213398',
    posterUri: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&q=80',
    rating: '4.8',
    genres: ['Animation', 'Adventure', 'Comedy'],
    weight: 8,
  },
  {
    id: 'vip_4k_pass',
    badge: 'CINEMA VIP',
    badgeColor: '#10B981',
    title: 'Ultra 4K Dolby Cinema Pass',
    subtitle: 'Unlock lightning edge CDN nodes with HDR10+ and instant zero buffering.',
    ctaText: 'Get VIP Pass',
    icon: 'flash',
    accentColor: '#059669',
    monetagUrl: 'https://uplcm.com/4/12213398',
    posterUri: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80',
    rating: '5.0',
    genres: ['All', 'Movies', 'Trending'],
    weight: 9,
  },
  {
    id: 'trade_crypto',
    badge: 'HOT DEAL',
    badgeColor: '#F59E0B',
    title: 'Global Trade Pro · $100 Bonus',
    subtitle: 'Zero fee crypto & stock trading app. Claim your welcome reward today.',
    ctaText: 'Claim Bonus',
    icon: 'trending-up',
    accentColor: '#D97706',
    monetagUrl: 'https://uplcm.com/4/12213398',
    posterUri: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=80',
    rating: '4.7',
    genres: ['Drama', 'Documentary'],
    weight: 6,
  },
];
