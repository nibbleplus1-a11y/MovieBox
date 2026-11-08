/**
 * downloadService.ts
 * MovieBox & StreamFlix style background download manager using expo-file-system + expo-media-library.
 * Features:
 *  - 3-in-1 Ad Unlock Quota (1 sponsor ad unlocks 3 high-speed downloads)
 *  - Multi-task queue with concurrent downloads
 *  - Persistent storage in AsyncStorage (offline videos survive app restarts)
 *  - Offline file deletion & media library export
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { useEffect, useState } from 'react';

const STORAGE_KEY = '@movieverse_downloads_v2';
const QUOTA_KEY = '@movieverse_download_quota_v1';
const FREE_DOWNLOADS_PER_AD = 3;

export interface DownloadTask {
  id: string;
  url: string;
  filename: string;
  title: string;
  poster?: string;
  episodeTitle?: string;
  season?: number;
  episode?: number;
  progress: number; // 0.0 to 1.0
  bytesWritten: number;
  totalBytes: number;
  status: 'downloading' | 'completed' | 'error' | 'paused';
  error?: string;
  localUri?: string;
  fileSize?: string;
  startedAt: number;
  completedAt?: number;
}

export interface StartDownloadParams {
  url: string;
  filename: string;
  title?: string;
  poster?: string;
  episodeTitle?: string;
  season?: number;
  episode?: number;
}

type DownloadListener = (tasks: DownloadTask[], quota: number) => void;

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

class DownloadManager {
  private tasks: Map<string, DownloadTask> = new Map();
  private resumables: Map<string, FileSystem.DownloadResumable> = new Map();
  private listeners: Set<DownloadListener> = new Set();
  private quota: number = 0;
  private permissionGranted: boolean | null = null;
  private initialized: boolean = false;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      // Load saved quota
      const savedQuota = await AsyncStorage.getItem(QUOTA_KEY);
      if (savedQuota !== null) {
        this.quota = Math.max(0, parseInt(savedQuota, 10) || 0);
      } else {
        // First install bonus: 1 free download!
        this.quota = 1;
        await AsyncStorage.setItem(QUOTA_KEY, '1');
      }

      // Load saved completed downloads
      const savedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const list: DownloadTask[] = JSON.parse(savedData);
        // Verify files still exist locally
        for (const item of list) {
          if (item.status === 'completed' && item.localUri) {
            try {
              const info = await FileSystem.getInfoAsync(item.localUri);
              if (info.exists) {
                this.tasks.set(item.id, item);
              }
            } catch {
              // File missing or inaccessible, skip
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to initialize DownloadManager:', e);
    } finally {
      this.initialized = true;
      this.notify();
    }
  }

  private async persistTasks() {
    try {
      const completed = Array.from(this.tasks.values()).filter((t) => t.status === 'completed');
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
    } catch (e) {
      console.warn('Failed to persist downloads:', e);
    }
  }

  public async requestPermission(): Promise<boolean> {
    if (this.permissionGranted === true) return true;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      this.permissionGranted = status === 'granted';
      return this.permissionGranted;
    } catch {
      return false;
    }
  }

  public subscribe(listener: DownloadListener): () => void {
    this.listeners.add(listener);
    listener(this.getAllTasks(), this.quota);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const list = this.getAllTasks();
    const q = this.quota;
    this.listeners.forEach((fn) => {
      try {
        fn(list, q);
      } catch {}
    });
  }

  public getAllTasks(): DownloadTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.startedAt - a.startedAt);
  }

  public getActiveTasks(): DownloadTask[] {
    return this.getAllTasks().filter((t) => t.status === 'downloading');
  }

  public getCompletedTasks(): DownloadTask[] {
    return this.getAllTasks().filter((t) => t.status === 'completed');
  }

  // ── Ad Quota System (3-in-1 Unlock) ──────────────────────────────────────────

  public getQuota(): number {
    return this.quota;
  }

  public hasQuota(): boolean {
    return this.quota > 0;
  }

  /**
   * Watch 1 sponsor ad -> unlock 3 high-speed downloads!
   */
  public async grantQuota(count: number = FREE_DOWNLOADS_PER_AD): Promise<number> {
    this.quota = (this.quota || 0) + count;
    await AsyncStorage.setItem(QUOTA_KEY, String(this.quota));
    this.notify();
    return this.quota;
  }

  public async consumeQuota(): Promise<boolean> {
    if (this.quota > 0) {
      this.quota -= 1;
      await AsyncStorage.setItem(QUOTA_KEY, String(this.quota));
      this.notify();
      return true;
    }
    return false;
  }

  // ── Download Operations ──────────────────────────────────────────────────────

  public async startDownload(params: StartDownloadParams): Promise<string> {
    const permitted = await this.requestPermission();
    if (!permitted) {
      Alert.alert(
        'Permission Required',
        'Storage permission is needed to save offline downloads to your device.'
      );
      throw new Error('Permission denied');
    }

    const { url, filename, title = 'Movie / Episode', poster, episodeTitle, season, episode } = params;

    // Generate unique ID and isolated file path to prevent collision
    const timestamp = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const taskId = `mv_${timestamp}_${Math.floor(Math.random() * 1000)}`;

    const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
    const destination = baseDir.endsWith('/')
      ? `${baseDir}${timestamp}_${safeFilename}`
      : `${baseDir}/${timestamp}_${safeFilename}`;

    const task: DownloadTask = {
      id: taskId,
      url,
      filename: safeFilename,
      title,
      poster,
      episodeTitle,
      season,
      episode,
      progress: 0,
      bytesWritten: 0,
      totalBytes: 0,
      status: 'downloading',
      startedAt: timestamp,
    };

    this.tasks.set(taskId, task);
    this.notify();

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        destination,
        {},
        (downloadProgress) => {
          const current = this.tasks.get(taskId);
          if (!current || current.status !== 'downloading') return;

          const total = downloadProgress.totalBytesExpectedToWrite;
          const written = downloadProgress.totalBytesWritten;
          current.bytesWritten = written;
          current.totalBytes = total;

          if (total > 0) {
            current.progress = Math.min(0.99, Math.max(0, written / total));
            current.fileSize = `${formatBytes(written)} / ${formatBytes(total)}`;
          } else {
            current.fileSize = formatBytes(written);
          }
          this.notify();
        }
      );

      this.resumables.set(taskId, downloadResumable);

      // Execute background async download
      downloadResumable
        .downloadAsync()
        .then(async (result) => {
          this.resumables.delete(taskId);
          const current = this.tasks.get(taskId);
          if (!current) return;

          if (!result || !result.uri) {
            current.status = 'error';
            current.error = 'Download failed: no output file';
            this.notify();
            return;
          }

          current.localUri = result.uri;
          current.progress = 1.0;
          current.status = 'completed';
          current.completedAt = Date.now();

          // Get exact file size on disk
          try {
            const info = await FileSystem.getInfoAsync(result.uri);
            if (info.exists && info.size) {
              current.fileSize = formatBytes(info.size);
            }
          } catch {}

          this.notify();
          await this.persistTasks();

          // Also export to system gallery MovieVerse album so user can view in file manager
          try {
            const asset = await MediaLibrary.createAssetAsync(result.uri);
            const album = await MediaLibrary.getAlbumAsync('MovieVerse');
            if (album) {
              await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            } else {
              await MediaLibrary.createAlbumAsync('MovieVerse', asset, false);
            }
          } catch {
            // Scoped storage handles file locally
          }
        })
        .catch((err: unknown) => {
          this.resumables.delete(taskId);
          const current = this.tasks.get(taskId);
          if (!current) return;
          current.status = 'error';
          current.error = err instanceof Error ? err.message : 'Download failed';
          this.notify();
        });

      return taskId;
    } catch (err: unknown) {
      task.status = 'error';
      task.error = err instanceof Error ? err.message : 'Failed to start download';
      this.notify();
      throw err;
    }
  }

  public cancelDownload(taskId: string) {
    const resumable = this.resumables.get(taskId);
    if (resumable) {
      try {
        resumable.cancelAsync();
      } catch {}
      this.resumables.delete(taskId);
    }
    const current = this.tasks.get(taskId);
    if (current && current.localUri) {
      FileSystem.deleteAsync(current.localUri, { idempotent: true }).catch(() => {});
    }
    this.tasks.delete(taskId);
    this.notify();
  }

  public async deleteDownload(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task?.localUri) {
      try {
        await FileSystem.deleteAsync(task.localUri, { idempotent: true });
      } catch {}
    }
    this.tasks.delete(taskId);
    this.notify();
    await this.persistTasks();
  }

  public dismissTask(taskId: string) {
    this.tasks.delete(taskId);
    this.notify();
  }
}

export const downloadManager = new DownloadManager();

/**
 * React Hook for accessing active downloads, completed offline videos, and quota
 */
export function useDownloads() {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [quota, setQuota] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = downloadManager.subscribe((allTasks, currentQuota) => {
      setTasks([...allTasks]);
      setQuota(currentQuota);
    });
    return unsubscribe;
  }, []);

  const activeTasks = tasks.filter((t) => t.status === 'downloading');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return {
    tasks,
    activeTasks,
    completedTasks,
    activeCount: activeTasks.length,
    completedCount: completedTasks.length,
    quota,
    hasQuota: quota > 0,
    startDownload: (params: StartDownloadParams) => downloadManager.startDownload(params),
    cancelDownload: (id: string) => downloadManager.cancelDownload(id),
    deleteDownload: (id: string) => downloadManager.deleteDownload(id),
    dismissTask: (id: string) => downloadManager.dismissTask(id),
    grantQuota: (count?: number) => downloadManager.grantQuota(count),
    consumeQuota: () => downloadManager.consumeQuota(),
  };
}

/** Legacy backwards-compatible wrapper */
export async function downloadStream(opts: {
  url: string;
  filename: string;
  title?: string;
  poster?: string;
  onProgress?: (progress: number) => void;
  onComplete?: (localUri: string) => void;
  onError?: (err: string) => void;
}): Promise<void> {
  try {
    const taskId = await downloadManager.startDownload({
      url: opts.url,
      filename: opts.filename,
      title: opts.title,
      poster: opts.poster,
    });
    const unsub = downloadManager.subscribe((tasks) => {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        opts.onProgress?.(task.progress);
        if (task.status === 'completed') {
          opts.onComplete?.(task.localUri || '');
          unsub();
        } else if (task.status === 'error') {
          opts.onError?.(task.error || 'Download failed');
          unsub();
        }
      }
    });
  } catch (e: any) {
    opts.onError?.(e?.message || 'Download failed');
  }
}
