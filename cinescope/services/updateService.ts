/**
 * updateService.ts
 * In-app auto-update checker and APK installer for MovieVerse Android app.
 * Automatically notifies user of new releases, downloads the APK,
 * and triggers Android Package Installer to replace the old version.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform, NativeModules, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../config';

export interface UpdateInfo {
  available: boolean;
  version: string;
  versionCode: number;
  changelog: string;
  downloadUrl: string;
  forceUpdate: boolean;
}

function parseVersion(v: string): number[] {
  return v
    .replace(/^v/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

function isNewer(remoteVer: string, currentVer: string): boolean {
  const r = parseVersion(remoteVer);
  const c = parseVersion(currentVer);
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rv = r[i] || 0;
    const cv = c[i] || 0;
    if (rv > cv) return true;
    if (rv < cv) return false;
  }
  return false;
}

export async function dismissUpdate(version: string): Promise<void> {
  try {
    // Suppress notifications for this version for 24 hours
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    await AsyncStorage.setItem(`update_dismissed_${version}`, String(expiresAt));
  } catch {}
}

export async function checkForAppUpdate(ignoreDismissal: boolean = false): Promise<UpdateInfo | null> {
  if (Platform.OS !== 'android') return null;

  try {
    const base = CONFIG.APP_URL || 'https://movieverse.click';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${base}/api/app/version`, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();

    const remoteVersion = data.version || '1.0.0';
    const remoteCode = Number(data.version_code) || 0;
    const currentVersion = CONFIG.APP_VERSION || '1.3.0';
    const currentCode = Number(CONFIG.APP_BUILD) || 23;

    // A newer version exists ONLY if remote build code is higher,
    // or if remote code is omitted/0 and semantic version is higher
    const hasNewVersion =
      remoteCode > currentCode ||
      (remoteCode === 0 && isNewer(remoteVersion, currentVersion));

    if (!hasNewVersion) {
      return {
        available: false,
        version: remoteVersion,
        versionCode: remoteCode,
        changelog: '',
        downloadUrl: '',
        forceUpdate: false,
      };
    }

    const forceUpdate = Boolean(data.force_update);

    // If non-force update, check if user dismissed this version in the last 24h
    if (!forceUpdate && !ignoreDismissal) {
      try {
        const dismissedUntil = await AsyncStorage.getItem(`update_dismissed_${remoteVersion}`);
        if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
          return {
            available: false,
            version: remoteVersion,
            versionCode: remoteCode,
            changelog: '',
            downloadUrl: '',
            forceUpdate: false,
          };
        }
      } catch {}
    }

    const cdnUrl = data.cdn_download_url || data.download_url;
    const finalDownloadUrl = cdnUrl || `${base}/download/app`;

    return {
      available: true,
      version: remoteVersion,
      versionCode: remoteCode,
      changelog:
        data.changelog ||
        'Performance improvements, smoother playback & offline download enhancements.',
      downloadUrl: finalDownloadUrl,
      forceUpdate,
    };
  } catch (e) {
    // Fail silently in background
    return null;
  }
}

const { MovieVerseDownloader } = NativeModules;

export interface DownloadProgress {
  ratio: number;
  loadedMb: number;
  totalMb: number;
  percent: number;
}

export async function downloadAndInstallApk(
  downloadUrl: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  const HIGH_SPEED_CDN_FALLBACK = 'https://github.com/nibbleplus1-a11y/MovieBox/releases/download/v1.3.0/MovieVerse.apk';
  const targetUrl = downloadUrl || HIGH_SPEED_CDN_FALLBACK;

  // 1. Preferred Android Native: Foreground Service with Status-Bar Notification & Range Resume
  if (Platform.OS === 'android' && MovieVerseDownloader) {
    return new Promise<void>((resolve, reject) => {
      const taskId = 'update_app_apk';
      const filename = 'MovieVerse_Update.apk';
      const title = 'MovieVerse Update v1.3.0';

      const progressSub = DeviceEventEmitter.addListener('MVDownloadProgress', (ev) => {
        if (ev.taskId === taskId && onProgress) {
          const written = Number(ev.written) || 0;
          const total = Number(ev.total) > 0 ? Number(ev.total) : 84435330;
          const ratio = Math.min(1.0, Math.max(0.01, written / total));
          const loadedMb = Number((written / (1024 * 1024)).toFixed(1));
          const totalMb = Number((total / (1024 * 1024)).toFixed(1));
          const percent = Math.min(100, Math.round(ratio * 100));
          onProgress({ ratio, loadedMb, totalMb, percent });
        }
      });

      const completeSub = DeviceEventEmitter.addListener('MVDownloadComplete', async (ev) => {
        if (ev.taskId === taskId) {
          progressSub.remove();
          completeSub.remove();
          errorSub.remove();

          if (onProgress) {
            onProgress({ ratio: 1.0, loadedMb: 84.4, totalMb: 84.4, percent: 100 });
          }

          try {
            let installUri = ev.localUri;
            if (installUri && installUri.startsWith('file://')) {
              try {
                installUri = await FileSystem.getContentUriAsync(installUri);
              } catch (_) {}
            }
            if (installUri) {
              await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                data: installUri,
                flags: 268435457, // FLAG_ACTIVITY_NEW_TASK | FLAG_GRANT_READ_URI_PERMISSION
                type: 'application/vnd.android.package-archive',
              });
            }
          } catch (intentErr) {
            console.warn('IntentLauncher failed, opening via browser/file:', intentErr);
            await Linking.openURL(targetUrl).catch(() => {});
          }
          resolve();
        }
      });

      const errorSub = DeviceEventEmitter.addListener('MVDownloadError', (ev) => {
        if (ev.taskId === taskId) {
          progressSub.remove();
          completeSub.remove();
          errorSub.remove();
          Linking.openURL(targetUrl).catch(() => {});
          reject(new Error(ev.error || 'Native download failed'));
        }
      });

      try {
        MovieVerseDownloader.startDownload(taskId, targetUrl, filename, title);
      } catch (startErr) {
        progressSub.remove();
        completeSub.remove();
        errorSub.remove();
        // Fall back to FileSystem
        fallbackFileSystemDownload(targetUrl, onProgress).then(resolve).catch(reject);
      }
    });
  }

  // 2. Fallback: Expo FileSystem createDownloadResumable
  return fallbackFileSystemDownload(targetUrl, onProgress);
}

async function fallbackFileSystemDownload(
  targetUrl: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  try {
    const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
    const localApkUri = `${targetDir}MovieVerse_Update_${Date.now()}.apk`;

    let lastBytes = 0;
    let lastProgressTime = Date.now();

    const downloadResumable = FileSystem.createDownloadResumable(
      targetUrl,
      localApkUri,
      {},
      (p) => {
        const written = p.totalBytesWritten || 0;
        if (written > lastBytes) {
          lastBytes = written;
          lastProgressTime = Date.now();
        }

        if (onProgress) {
          const expected = p.totalBytesExpectedToWrite > 0 ? p.totalBytesExpectedToWrite : 84435330;
          const ratio = Math.min(1.0, Math.max(0.01, written / expected));
          const loadedMb = Number((written / (1024 * 1024)).toFixed(1));
          const totalMb = Number((expected / (1024 * 1024)).toFixed(1));
          const percent = Math.min(100, Math.round(ratio * 100));
          onProgress({ ratio, loadedMb, totalMb, percent });
        }
      }
    );

    const stallChecker = setInterval(() => {
      if (Date.now() - lastProgressTime > 25000 && lastBytes === 0) {
        clearInterval(stallChecker);
        downloadResumable.pauseAsync().catch(() => {});
        Linking.openURL(targetUrl).catch(() => {});
      }
    }, 5000);

    const result = await downloadResumable.downloadAsync();
    clearInterval(stallChecker);

    if (!result || !result.uri) {
      throw new Error('Download failed');
    }

    const contentUri = await FileSystem.getContentUriAsync(result.uri);

    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 268435457,
        type: 'application/vnd.android.package-archive',
      });
    } catch (intentErr) {
      console.warn('IntentLauncher failed, falling back to Linking:', intentErr);
      await Linking.openURL(targetUrl);
    }
  } catch (err) {
    await Linking.openURL(targetUrl);
  }
}
