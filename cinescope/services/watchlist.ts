import AsyncStorage from '@react-native-async-storage/async-storage';

const WATCHLIST_KEY = '@cinescope_watchlist';

export interface WatchlistItem {
  subject_id: string;
  title: string;
  cover: string;
  type?: string;
  addedAt: number;
}

// In-memory fallback in case native storage is unavailable or restarting
let memoryStore: WatchlistItem[] = [];

export const WatchlistService = {
  get: async (): Promise<WatchlistItem[]> => {
    try {
      const raw = await AsyncStorage.getItem(WATCHLIST_KEY);
      if (raw) {
        memoryStore = JSON.parse(raw);
        return memoryStore;
      }
      return memoryStore;
    } catch {
      return memoryStore;
    }
  },

  add: async (item: WatchlistItem) => {
    try {
      const list = await WatchlistService.get();
      const exists = list.some(i => i.subject_id === item.subject_id);
      if (!exists) {
        list.unshift(item);
        memoryStore = list;
        await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(list)).catch(() => {});
      }
    } catch {
      if (!memoryStore.some(i => i.subject_id === item.subject_id)) {
        memoryStore.unshift(item);
      }
    }
  },

  remove: async (id: string) => {
    try {
      const list = await WatchlistService.get();
      const filtered = list.filter(i => i.subject_id !== id);
      memoryStore = filtered;
      await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(filtered)).catch(() => {});
    } catch {
      memoryStore = memoryStore.filter(i => i.subject_id !== id);
    }
  },

  has: async (id: string): Promise<boolean> => {
    try {
      const list = await WatchlistService.get();
      return list.some(i => i.subject_id === id);
    } catch {
      return memoryStore.some(i => i.subject_id === id);
    }
  },
};
