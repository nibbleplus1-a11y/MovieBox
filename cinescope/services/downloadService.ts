/**
 * downloadService.ts
 * In-app download service using expo-file-system + expo-media-library.
 * Downloads the proxied MP4 stream directly into the device gallery/files.
 */

import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Platform } from 'react-native';

export interface DownloadOptions {
  url: string;
  filename: string;
  onProgress?: (progress: number) => void;
  onComplete?: (localUri: string) => void;
  onError?: (err: string) => void;
}

/**
 * Request media library permissions (needed for Android < 10 and iOS).
 * Returns true if granted.
 */
async function requestStoragePermission(): Promise<boolean> {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Start an in-app download. Progress reported via onProgress (0–1).
 * File saved to device downloads/gallery and local cache.
 */
export async function downloadStream(opts: DownloadOptions): Promise<void> {
  const { url, filename, onProgress, onComplete, onError } = opts;

  const permitted = await requestStoragePermission();
  if (!permitted) {
    Alert.alert(
      'Permission Required',
      'Storage permission is needed to save downloads to your device. Please grant it in Settings.',
    );
    onError?.('Permission denied');
    return;
  }

  // Write to app cache directory first (always writable)
  const localUri = FileSystem.cacheDirectory + filename;

  try {
    const downloadResumable = FileSystem.createDownloadResumable(
      url,
      localUri,
      {},
      (downloadProgress) => {
        const progress =
          downloadProgress.totalBytesExpectedToWrite > 0
            ? downloadProgress.totalBytesWritten /
              downloadProgress.totalBytesExpectedToWrite
            : 0;
        onProgress?.(progress);
      },
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || !result.uri) {
      onError?.('Download failed: no output file');
      return;
    }

    // Save to media library so it appears in Downloads/Gallery
    try {
      const asset = await MediaLibrary.createAssetAsync(result.uri);
      // Try to add to a "MovieVerse" album for organisation
      try {
        const album = await MediaLibrary.getAlbumAsync('MovieVerse');
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
          await MediaLibrary.createAlbumAsync('MovieVerse', asset, false);
        }
      } catch {
        // Album management failed — asset still saved to default location
      }
    } catch (mediaErr) {
      // Android 10+ uses scoped storage — asset likely already accessible via result.uri
      console.warn('MediaLibrary.createAssetAsync failed (scoped storage):', mediaErr);
    }

    onComplete?.(result.uri);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Download failed';
    onError?.(msg);
  }
}
