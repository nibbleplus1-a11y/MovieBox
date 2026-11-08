/**
 * downloadService.ts
 * In-app background download manager using expo-file-system/legacy + expo-media-library.
 * Supports multiple concurrent background downloads with live progress updates.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Platform } from 'react-native';
import { useEffect, useState } from 'react';

export interface DownloadTask {
  id: string;
  url: string;
  filename: string;
  progress: number; // 0.0 to 1.0
  status: 'downloading' | 'completed' | 'error';
  error?: string;
  localUri?: string;
  startedAt: number;
}

type DownloadListener = (tasks: DownloadTask[]) => void;

class DownloadManager {
  private tasks: Map<string, DownloadTask> = new Map();
  private resumables: Map<string, FileSystem.DownloadResumable> = new Map();
  private listeners: Set<DownloadListener> = new Set();
  private permissionGranted: boolean | null = null;

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
    listener(this.getAllTasks());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const list = this.getAllTasks();
    this.listeners.forEach((fn) => {
      try {
        fn(list);
      } catch {}
    });
  }

  public getAllTasks(): DownloadTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.startedAt - a.startedAt);
  }

  public getActiveTasks(): DownloadTask[] {
    return this.getAllTasks().filter((t) => t.status === 'downloading');
  }

  public async startDownload(url: string, filename: string): Promise<string> {
    const permitted = await this.requestPermission();
    if (!permitted) {
      Alert.alert(
        'Permission Required',
        'Storage permission is needed to save downloads to your device. Please grant it in Settings.'
      );
      throw new Error('Permission denied');
    }

    // Generate unique ID for this download
    const taskId = `${filename}_${Date.now()}`;

    // App directory destination
    const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
    const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const localUri = baseDir.endsWith('/') ? `${baseDir}${safeFilename}` : `${baseDir}/${safeFilename}`;

    const task: DownloadTask = {
      id: taskId,
      url,
      filename: safeFilename,
      progress: 0,
      status: 'downloading',
      startedAt: Date.now(),
    };

    this.tasks.set(taskId, task);
    this.notify();

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        localUri,
        {},
        (downloadProgress) => {
          const currentTask = this.tasks.get(taskId);
          if (!currentTask || currentTask.status !== 'downloading') return;

          const progress =
            downloadProgress.totalBytesExpectedToWrite > 0
              ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
              : 0;

          currentTask.progress = Math.min(0.99, Math.max(0, progress));
          this.notify();
        }
      );

      this.resumables.set(taskId, downloadResumable);

      // Run download in background asynchronously
      downloadResumable
        .downloadAsync()
        .then(async (result) => {
          this.resumables.delete(taskId);
          const currentTask = this.tasks.get(taskId);
          if (!currentTask) return;

          if (!result || !result.uri) {
            currentTask.status = 'error';
            currentTask.error = 'Download failed: no output file';
            this.notify();
            return;
          }

          currentTask.localUri = result.uri;
          currentTask.progress = 1.0;
          currentTask.status = 'completed';
          this.notify();

          // Save to device gallery/media library in MovieVerse folder
          try {
            const asset = await MediaLibrary.createAssetAsync(result.uri);
            try {
              const album = await MediaLibrary.getAlbumAsync('MovieVerse');
              if (album) {
                await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
              } else {
                await MediaLibrary.createAlbumAsync('MovieVerse', asset, false);
              }
            } catch {
              // Scoped storage handles asset in default location
            }
          } catch (mediaErr) {
            console.warn('MediaLibrary save note:', mediaErr);
          }
        })
        .catch((err: unknown) => {
          this.resumables.delete(taskId);
          const currentTask = this.tasks.get(taskId);
          if (!currentTask) return;
          currentTask.status = 'error';
          currentTask.error = err instanceof Error ? err.message : 'Download failed';
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
    this.tasks.delete(taskId);
    this.notify();
  }

  public dismissTask(taskId: string) {
    this.tasks.delete(taskId);
    this.notify();
  }
}

export const downloadManager = new DownloadManager();

/**
 * React Hook for watching active downloads in real-time
 */
export function useDownloads() {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  useEffect(() => {
    const unsubscribe = downloadManager.subscribe((allTasks) => {
      setTasks([...allTasks]);
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
    startDownload: (url: string, filename: string) => downloadManager.startDownload(url, filename),
    cancelDownload: (id: string) => downloadManager.cancelDownload(id),
    dismissTask: (id: string) => downloadManager.dismissTask(id),
  };
}

/** Legacy wrapper to ensure backwards compatibility */
export async function downloadStream(opts: {
  url: string;
  filename: string;
  onProgress?: (progress: number) => void;
  onComplete?: (localUri: string) => void;
  onError?: (err: string) => void;
}): Promise<void> {
  try {
    const taskId = await downloadManager.startDownload(opts.url, opts.filename);
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
