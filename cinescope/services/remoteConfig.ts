import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../config';

const STORAGE_KEY = '@cinescope_app_url';
const OVERRIDE_KEY = '@cinescope_url_override';

type Listener = (url: string) => void;

export class RemoteConfigService {
  private static resolvedUrl: string = CONFIG.APP_URL;
  private static listeners: Set<Listener> = new Set();

  static subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.resolvedUrl);
      } catch {}
    });
  }

  /**
   * Initializes the config during splash screen.
   * Checks for local developer override first, then remote JSON if configured,
   * then cached URL, and finally defaults to CONFIG.APP_URL.
   */
  static async init(): Promise<string> {
    try {
      // 1. Check if user set an explicit override in Settings
      const override = await AsyncStorage.getItem(OVERRIDE_KEY);
      if (override && override.trim().length > 0 && !override.includes('themoviedb.org')) {
        this.resolvedUrl = override.trim();
        this.notifyListeners();
        return this.resolvedUrl;
      }

      // 2. If a remote JSON config URL is defined, try to fetch it with a fast timeout
      if (CONFIG.REMOTE_CONFIG_URL && CONFIG.REMOTE_CONFIG_URL.startsWith('http')) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        try {
          const response = await fetch(CONFIG.REMOTE_CONFIG_URL, {
            signal: controller.signal,
            headers: { 'Cache-Control': 'no-cache' },
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            const url = data.app_url || data.url;
            if (url && typeof url === 'string' && url.startsWith('http')) {
              this.resolvedUrl = url;
              await AsyncStorage.setItem(STORAGE_KEY, url);
              this.notifyListeners();
              return this.resolvedUrl;
            }
          }
        } catch {
          // Timeout or fetch error, fall through to cache
        }
      }

      // 3. Fallback to cached URL from previous session
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached && cached.trim().length > 0 && !cached.includes('themoviedb.org')) {
        this.resolvedUrl = cached.trim();
        this.notifyListeners();
        return this.resolvedUrl;
      }
    } catch (e) {
      // Ignore errors and use default
    }

    this.resolvedUrl = CONFIG.APP_URL;
    this.notifyListeners();
    return this.resolvedUrl;
  }

  static getUrl(): string {
    return this.resolvedUrl;
  }

  static async setOverrideUrl(url: string | null): Promise<void> {
    if (!url || url.trim().length === 0) {
      await AsyncStorage.removeItem(OVERRIDE_KEY);
      this.resolvedUrl = CONFIG.APP_URL;
    } else {
      await AsyncStorage.setItem(OVERRIDE_KEY, url.trim());
      this.resolvedUrl = url.trim();
    }
    this.notifyListeners();
  }

  static async getOverrideUrl(): Promise<string | null> {
    return await AsyncStorage.getItem(OVERRIDE_KEY);
  }
}
