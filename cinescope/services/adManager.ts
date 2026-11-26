/**
 * adManager.ts
 * Centralized service managing native ads, frequency capping, CineCoins economy,
 * and ad-free session passes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AD_CAMPAIGNS, AD_CONFIG, AdCampaign } from '../constants/ads';

const COINS_KEY = '@cinescope_cinecoins_v1';
const AD_FREE_UNTIL_KEY = '@cinescope_ad_free_until';
const LAST_AD_TIME_KEY = 'cinescope_last_ad_time';
const DAILY_BONUS_DATE_KEY = '@cinescope_daily_bonus_date';
const STATS_KEY = '@cinescope_ad_stats_v1';

type CoinsListener = (coins: number) => void;

class AdManagerService {
  private cachedCoins: number = AD_CONFIG.DEFAULT_STARTING_COINS;
  private isInitialized: boolean = false;
  private listeners: Set<CoinsListener> = new Set();
  private lastPreRollTime: number = 0;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const storedCoins = await AsyncStorage.getItem(COINS_KEY);
      if (storedCoins !== null) {
        this.cachedCoins = parseInt(storedCoins, 10) || 0;
      } else {
        await AsyncStorage.setItem(COINS_KEY, String(this.cachedCoins));
      }

      const storedLastAd = await AsyncStorage.getItem(LAST_AD_TIME_KEY);
      if (storedLastAd) {
        this.lastPreRollTime = parseInt(storedLastAd, 10) || 0;
      }

      this.isInitialized = true;
      this.notifyListeners();
    } catch {
      this.isInitialized = true;
    }
  }

  public subscribe(listener: CoinsListener): () => void {
    this.listeners.add(listener);
    listener(this.cachedCoins);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.cachedCoins);
      } catch {}
    });
  }

  /**
   * Returns current CineCoins balance.
   */
  public async getCoins(): Promise<number> {
    if (!this.isInitialized) {
      await this.init();
    }
    return this.cachedCoins;
  }

  /**
   * Earn CineCoins for watching sponsored content or visiting offers.
   */
  public async earnCoins(amount: number, reason?: string): Promise<number> {
    if (amount <= 0) return this.cachedCoins;
    this.cachedCoins += amount;
    try {
      await AsyncStorage.setItem(COINS_KEY, String(this.cachedCoins));
    } catch {}
    this.notifyListeners();
    return this.cachedCoins;
  }

  /**
   * Spend CineCoins to skip ads, unlock fast downloads, or buy ad-free passes.
   */
  public async spendCoins(amount: number, reason?: string): Promise<boolean> {
    if (this.cachedCoins < amount) {
      return false;
    }
    this.cachedCoins -= amount;
    try {
      await AsyncStorage.setItem(COINS_KEY, String(this.cachedCoins));
    } catch {}
    this.notifyListeners();
    return true;
  }

  /**
   * Check if user is eligible for daily login bonus (+1 coin).
   */
  public async checkDailyBonus(): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const lastClaimed = await AsyncStorage.getItem(DAILY_BONUS_DATE_KEY);
      if (lastClaimed !== today) {
        await AsyncStorage.setItem(DAILY_BONUS_DATE_KEY, today);
        await this.earnCoins(AD_CONFIG.COINS_FOR_DAILY_BONUS, 'daily_login');
        return true;
      }
    } catch {}
    return false;
  }

  /**
   * Checks if user currently has an active Ad-Free VIP pass.
   */
  public async isAdFree(): Promise<boolean> {
    try {
      const untilStr = await AsyncStorage.getItem(AD_FREE_UNTIL_KEY);
      if (!untilStr) return false;
      const until = parseInt(untilStr, 10);
      return Date.now() < until;
    } catch {
      return false;
    }
  }

  /**
   * Activates Ad-Free pass for a specific duration in hours (e.g. 24 hours).
   */
  public async activateAdFree(hours: number = 24): Promise<void> {
    const expiresAt = Date.now() + hours * 60 * 60 * 1000;
    try {
      await AsyncStorage.setItem(AD_FREE_UNTIL_KEY, String(expiresAt));
    } catch {}
  }

  /**
   * Checks whether a pre-roll ad can be shown (frequency capping & ad-free check).
   */
  public async canShowPreRoll(): Promise<boolean> {
    if (await this.isAdFree()) {
      return false;
    }
    const now = Date.now();
    if (this.lastPreRollTime && now - this.lastPreRollTime < AD_CONFIG.PRE_ROLL_COOLDOWN_MS) {
      return false;
    }
    return true;
  }

  /**
   * Marks that a pre-roll ad was shown, resetting the cooldown timer.
   */
  public async recordPreRoll(): Promise<void> {
    const now = Date.now();
    this.lastPreRollTime = now;
    try {
      await AsyncStorage.setItem(LAST_AD_TIME_KEY, String(now));
    } catch {}
  }

  /**
   * Selects an ad campaign using contextual weighting (by genre or random).
   */
  public selectCampaign(genre?: string): AdCampaign {
    if (!AD_CAMPAIGNS.length) {
      return AD_CAMPAIGNS[0];
    }

    if (genre) {
      const matching = AD_CAMPAIGNS.filter(
        (c) => c.genres && c.genres.some((g) => g.toLowerCase() === genre.toLowerCase())
      );
      if (matching.length > 0) {
        return matching[Math.floor(Math.random() * matching.length)];
      }
    }

    // Weighted random selection
    const totalWeight = AD_CAMPAIGNS.reduce((acc, c) => acc + (c.weight || 5), 0);
    let randomNum = Math.random() * totalWeight;

    for (const campaign of AD_CAMPAIGNS) {
      const weight = campaign.weight || 5;
      if (randomNum < weight) {
        return campaign;
      }
      randomNum -= weight;
    }

    return AD_CAMPAIGNS[0];
  }

  /**
   * Record local impression for analytics
   */
  public async recordImpression(campaignId: string): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STATS_KEY);
      const stats = raw ? JSON.parse(raw) : {};
      stats[campaignId] = stats[campaignId] || { imp: 0, click: 0 };
      stats[campaignId].imp += 1;
      await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch {}
  }

  /**
   * Record local click for analytics
   */
  public async recordClick(campaignId: string): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STATS_KEY);
      const stats = raw ? JSON.parse(raw) : {};
      stats[campaignId] = stats[campaignId] || { imp: 0, click: 0 };
      stats[campaignId].click += 1;
      await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch {}
  }
}

export const adManager = new AdManagerService();
