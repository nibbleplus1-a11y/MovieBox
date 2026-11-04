import AsyncStorage from '@react-native-async-storage/async-storage';

const WATCH_PROGRESS_KEY = '@cinescope_watch_progress';

export interface WatchProgressItem {
  subject_id: string;
  title?: string;
  cover?: string;
  type?: string;
  season: number;
  episode: number;
  currentTime: number;
  duration: number;
  progress: number; // 0 to 100 percentage
  savedAt: number;
}

let memoryProgress: Record<string, WatchProgressItem> = {};

export const WatchProgressService = {
  getAll: async (): Promise<WatchProgressItem[]> => {
    try {
      const raw = await AsyncStorage.getItem(WATCH_PROGRESS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memoryProgress = {};
          parsed.forEach((item: WatchProgressItem) => {
            if (item && item.subject_id) memoryProgress[String(item.subject_id)] = item;
          });
          return parsed;
        }
      }
      return Object.values(memoryProgress);
    } catch {
      return Object.values(memoryProgress);
    }
  },

  get: async (subjectId: string): Promise<WatchProgressItem | null> => {
    if (!subjectId) return null;
    const sid = String(subjectId);
    if (memoryProgress[sid]) return memoryProgress[sid];
    try {
      const all = await WatchProgressService.getAll();
      const match = all.find((i) => String(i.subject_id) === sid) || null;
      if (match) memoryProgress[sid] = match;
      return match;
    } catch {
      return memoryProgress[sid] || null;
    }
  },

  save: async (item: Partial<WatchProgressItem> & { subject_id: string }) => {
    if (!item.subject_id) return;
    const sid = String(item.subject_id);
    const existing = (await WatchProgressService.get(sid)) || {
      subject_id: sid,
      season: 0,
      episode: 0,
      currentTime: 0,
      duration: 0,
      progress: 0,
      savedAt: Date.now(),
    };

    const updated: WatchProgressItem = {
      ...existing,
      ...item,
      subject_id: sid,
      savedAt: Date.now(),
    };

    memoryProgress[sid] = updated;

    try {
      const all = await WatchProgressService.getAll();
      const filtered = all.filter((i) => String(i.subject_id) !== sid);
      filtered.unshift(updated);
      const trimmed = filtered.slice(0, 50); // Keep last 50 watched
      await AsyncStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(trimmed)).catch(() => {});
    } catch {
      // Memory progress already updated
    }
  },

  remove: async (subjectId: string) => {
    if (!subjectId) return;
    const sid = String(subjectId);
    delete memoryProgress[sid];
    try {
      const all = await WatchProgressService.getAll();
      const filtered = all.filter((i) => String(i.subject_id) !== sid);
      await AsyncStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(filtered)).catch(() => {});
    } catch {
      // Memory progress already deleted
    }
  },
};
