/**
 * downloadService.ts  — v3 (Native Foreground Service)
 *
 * On Android: delegates all downloads to DownloadService.kt (Kotlin foreground service)
 * which keeps running even when the app is closed and shows progress in the notification bar.
 * Files are saved to the public Downloads/movieverse folder.
 *
 * Ad quota system: 1 sponsor ad unlocks 3 ad-free downloads.
 */

import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = '@movieverse_downloads_v3';
const QUOTA_KEY   = '@movieverse_download_quota_v1';
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
  progress: number;        // 0.0–1.0
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
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

// Native module (Android only — safe to access on iOS since DownloadModule won't be there)
const NativeDownloader = NativeModules.MovieVerseDownloader as {
  startDownload(taskId: string, url: string, filename: string, title: string): void;
  cancelDownload(taskId: string): void;
} | undefined;

const useNativeService = Platform.OS === 'android' && !!NativeDownloader;

class DownloadManager {
  private tasks: Map<string, DownloadTask> = new Map();
  private listeners: Set<DownloadListener> = new Set();
  private quota: number = 0;
  private permissionGranted: boolean | null = null;

  // expo-file-system resumables (iOS / fallback)
  private resumables: Map<string, FileSystem.DownloadResumable> = new Map();

  // Native event emitter (Android)
  private emitter?: NativeEventEmitter;
  private nativeSubs: any[] = [];

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const savedQuota = await AsyncStorage.getItem(QUOTA_KEY);
      this.quota = savedQuota !== null ? Math.max(0, parseInt(savedQuota, 10) || 0) : 1;
      if (savedQuota === null) await AsyncStorage.setItem(QUOTA_KEY, '1');

      const savedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const list: DownloadTask[] = JSON.parse(savedData);
        for (const item of list) {
          if (item.status === 'completed' && item.localUri) {
            // For native-saved files, we just trust the saved localUri
            this.tasks.set(item.id, item);
          }
        }
      }
    } catch (e) {
      console.warn('DownloadManager init failed:', e);
    }

    this.notify();

    // ── Wire up native Android events ───────────────────────────────────────
    if (useNativeService && NativeDownloader) {
      try {
        this.emitter = new NativeEventEmitter(NativeDownloader as any);

        this.nativeSubs.push(
          this.emitter.addListener('MVDownloadProgress', (e: any) => {
            const task = this.tasks.get(e.taskId);
            if (!task || task.status !== 'downloading') return;
            task.bytesWritten = e.written;
            task.totalBytes   = e.total;
            if (e.total > 0) {
              task.progress = Math.min(0.99, e.written / e.total);
              task.fileSize = `${formatBytes(e.written)} / ${formatBytes(e.total)}`;
            } else {
              task.fileSize = formatBytes(e.written);
            }
            this.notify();
          }),

          this.emitter.addListener('MVDownloadComplete', async (e: any) => {
            const task = this.tasks.get(e.taskId);
            if (!task) return;
            task.status      = 'completed';
            task.progress    = 1.0;
            task.localUri    = e.localUri;
            task.completedAt = Date.now();
            this.notify();
            await this.persistTasks();
          }),

          this.emitter.addListener('MVDownloadError', (e: any) => {
            const task = this.tasks.get(e.taskId);
            if (!task) return;
            task.status = 'error';
            task.error  = e.error;
            this.notify();
          }),
        );
      } catch (err) {
        console.warn('Failed to attach native download event listeners:', err);
      }
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
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    const list = this.getAllTasks();
    const q = this.quota;
    this.listeners.forEach((fn) => { try { fn(list, q); } catch {} });
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

  // ── Ad Quota ──────────────────────────────────────────────────────────────

  public getQuota(): number  { return this.quota; }
  public hasQuota(): boolean { return this.quota > 0; }

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

  // ── Start Download ────────────────────────────────────────────────────────

  public async startDownload(params: StartDownloadParams): Promise<string> {
    const {
      url,
      filename,
      title = 'Movie / Episode',
      poster,
      episodeTitle,
      season,
      episode,
    } = params;

    const timestamp  = Date.now();
    const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const taskId     = `mv_${timestamp}_${Math.floor(Math.random() * 1000)}`;

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

    if (useNativeService && NativeDownloader) {
      // ── Android native foreground service path ─────────────────────────
      NativeDownloader.startDownload(taskId, url, safeFilename, title);
    } else {
      // ── iOS / fallback: expo-file-system path ──────────────────────────
      await this.startExpoDownload(task, safeFilename, url);
    }

    return taskId;
  }

  /**
   * Fallback downloader using expo-file-system (iOS or if native module missing)
   * Saves to documentDirectory + saves to media library under "MovieVerse" album.
   */
  private async startExpoDownload(task: DownloadTask, safeFilename: string, url: string) {
    const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
    const destination = `${baseDir.endsWith('/') ? baseDir : baseDir + '/'}${task.startedAt}_${safeFilename}`;

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        destination,
        {},
        (progress) => {
          const current = this.tasks.get(task.id);
          if (!current || current.status !== 'downloading') return;
          const total   = progress.totalBytesExpectedToWrite;
          const written = progress.totalBytesWritten;
          current.bytesWritten = written;
          current.totalBytes   = total;
          if (total > 0) {
            current.progress = Math.min(0.99, written / total);
            current.fileSize = `${formatBytes(written)} / ${formatBytes(total)}`;
          } else {
            current.fileSize = formatBytes(written);
          }
          this.notify();
        }
      );

      this.resumables.set(task.id, downloadResumable);

      downloadResumable.downloadAsync().then(async (result) => {
        this.resumables.delete(task.id);
        const current = this.tasks.get(task.id);
        if (!current) return;
        if (!result?.uri) {
          current.status = 'error';
          current.error  = 'Download failed: no output file';
          this.notify();
          return;
        }
        current.localUri     = result.uri;
        current.progress     = 1.0;
        current.status       = 'completed';
        current.completedAt  = Date.now();
        try {
          const info = await FileSystem.getInfoAsync(result.uri);
          if (info.exists && info.size) current.fileSize = formatBytes(info.size);
        } catch {}
        this.notify();
        await this.persistTasks();
        // Export to gallery
        try {
          const asset = await MediaLibrary.createAssetAsync(result.uri);
          const album = await MediaLibrary.getAlbumAsync('MovieVerse');
          if (album) {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          } else {
            await MediaLibrary.createAlbumAsync('MovieVerse', asset, false);
          }
        } catch {}
      }).catch((err: unknown) => {
        this.resumables.delete(task.id);
        const current = this.tasks.get(task.id);
        if (!current) return;
        current.status = 'error';
        current.error  = err instanceof Error ? err.message : 'Download failed';
        this.notify();
      });
    } catch (err: unknown) {
      task.status = 'error';
      task.error  = err instanceof Error ? err.message : 'Failed to start download';
      this.notify();
      throw err;
    }
  }

  // ── Cancel / Delete ───────────────────────────────────────────────────────

  public cancelDownload(taskId: string) {
    if (useNativeService && NativeDownloader) {
      NativeDownloader.cancelDownload(taskId);
    } else {
      const resumable = this.resumables.get(taskId);
      if (resumable) {
        try { resumable.cancelAsync(); } catch {}
        this.resumables.delete(taskId);
      }
    }
    const current = this.tasks.get(taskId);
    if (current?.localUri && !useNativeService) {
      FileSystem.deleteAsync(current.localUri, { idempotent: true }).catch(() => {});
    }
    this.tasks.delete(taskId);
    this.notify();
  }

  public async deleteDownload(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task?.localUri && !useNativeService) {
      try { await FileSystem.deleteAsync(task.localUri, { idempotent: true }); } catch {}
    }
    this.tasks.delete(taskId);
    this.notify();
    await this.persistTasks();
  }

  public dismissTask(taskId: string) {
    this.tasks.delete(taskId);
    this.notify();
  }

  public cleanup() {
    this.nativeSubs.forEach((sub) => { try { sub.remove(); } catch {} });
    this.nativeSubs = [];
  }
}

export const downloadManager = new DownloadManager();

// ── React Hook ──────────────────────────────────────────────────────────────

export function useDownloads() {
  const [tasks, setTasks]   = useState<DownloadTask[]>([]);
  const [quota, setQuota]   = useState<number>(0);

  useEffect(() => {
    const unsubscribe = downloadManager.subscribe((allTasks, currentQuota) => {
      setTasks([...allTasks]);
      setQuota(currentQuota);
    });
    return unsubscribe;
  }, []);

  const activeTasks    = tasks.filter((t) => t.status === 'downloading');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return {
    tasks,
    activeTasks,
    completedTasks,
    activeCount:    activeTasks.length,
    completedCount: completedTasks.length,
    quota,
    hasQuota:       quota > 0,
    startDownload:  (p: StartDownloadParams) => downloadManager.startDownload(p),
    cancelDownload: (id: string)             => downloadManager.cancelDownload(id),
    deleteDownload: (id: string)             => downloadManager.deleteDownload(id),
    dismissTask:    (id: string)             => downloadManager.dismissTask(id),
    grantQuota:     (count?: number)         => downloadManager.grantQuota(count),
    consumeQuota:   ()                       => downloadManager.consumeQuota(),
  };
}

/** Legacy wrapper */
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
