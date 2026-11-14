/**
 * updateService.ts
 * In-app auto-update checker and APK installer for MovieVerse Android app.
 * Automatically notifies user of new releases, downloads the APK,
 * and triggers Android Package Installer to replace the old version.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';
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

export async function checkForAppUpdate(): Promise<UpdateInfo | null> {
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
    const remoteCode = data.version_code || 0;
    const currentVersion = CONFIG.APP_VERSION || '1.2.3';
    const currentCode = CONFIG.APP_BUILD || 16;

    const hasNewVersion =
      remoteCode > currentCode || isNewer(remoteVersion, currentVersion);

    return {
      available: hasNewVersion,
      version: remoteVersion,
      versionCode: remoteCode,
      changelog:
        data.changelog ||
        'Performance improvements, smoother playback & offline download enhancements.',
      downloadUrl: data.download_url || `${base}/download/app`,
      forceUpdate: Boolean(data.force_update),
    };
  } catch (e) {
    // Fail silently in background
    return null;
  }
}

export async function downloadAndInstallApk(
  downloadUrl: string,
  onProgress?: (ratio: number) => void
): Promise<void> {
  try {
    const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
    const localApkUri = `${targetDir}MovieVerse_Update_${Date.now()}.apk`;

    // Download APK
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      localApkUri,
      {},
      (p) => {
        if (p.totalBytesExpectedToWrite > 0 && onProgress) {
          const ratio = p.totalBytesWritten / p.totalBytesExpectedToWrite;
          onProgress(Math.min(1.0, Math.max(0, ratio)));
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || !result.uri) {
      throw new Error('Download failed');
    }

    // Convert to content:// URI using Expo FileProvider
    const contentUri = await FileSystem.getContentUriAsync(result.uri);

    // Launch Android Package Installer
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 268435457, // FLAG_ACTIVITY_NEW_TASK | FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/vnd.android.package-archive',
      });
    } catch (intentErr) {
      console.warn('IntentLauncher failed, falling back to Linking:', intentErr);
      await Linking.openURL(downloadUrl);
    }
  } catch (err) {
    // If anything fails, fallback to direct browser download
    await Linking.openURL(downloadUrl);
  }
}
