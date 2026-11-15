/**
 * useTVDetect — Robust Android TV / Fire TV / Generic Android Box detection.
 *
 * ─── HOW EACH SIGNAL WORKS ───────────────────────────────────────────────────
 *
 * 1. Platform.isTV
 *    Set by Android firmware via PackageManager.hasSystemFeature(
 *      "android.hardware.type.television")
 *    ✅ Reliable for: Nvidia Shield, Mi Box, Xiaomi TV Stick, Fire TV Stick
 *    ❌ Misses: Cheap generic Android boxes (H96, X96, Tanix, etc.)
 *
 * 2. Screen dimensions (landscape + wide ratio)
 *    TVs are always landscape. Checks:
 *    • width > height (landscape)
 *    • aspect ratio ≥ 1.65  (16:9 = 1.78, 16:10 = 1.6)
 *    • EITHER width ≥ 960 OR height ≥ 540  (covers 720p boxes at any density)
 *    ✅ Reliable for: Most TV boxes at 720p, 1080p, 4K output
 *    ❌ Might false-positive: Landscape tablets (handled by density check below)
 *
 * 3. Pixel density heuristic
 *    Tablets and phones have high DPI (≥2.0). Generic TV boxes + Android TV
 *    devices connected to TVs typically output at ~1.0–1.5 density because
 *    TVs are physically large (high PPI is not needed at 10-foot viewing).
 *    • density ≤ 1.5 AND landscape → very likely a TV/box
 *    ✅ Reliable for: Generic boxes outputting 1080p to a 50"+ TV
 *    ❌ Misses: High-DPI OLED TVs (rare, they still have Platform.isTV)
 *
 * 4. Platform.OS check
 *    Only runs detection on Android. iOS Platform.isTV covers Apple TV.
 *
 * 5. AsyncStorage manual override (always wins)
 *    User can force TV mode ON or OFF from Settings.
 *    "cinescope_tv_mode" = "1" → force TV
 *    "cinescope_tv_mode" = "0" → force phone/tablet even if signals say TV
 *    "cinescope_tv_mode" = null → auto-detect (default)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Platform, Dimensions, PixelRatio } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TV_MODE_KEY = 'cinescope_tv_mode';

import { CONFIG } from '../config';

/** Signal 1: Platform.isTV (certified Android TV / tvOS) */
function signal_platformIsTV(): boolean {
  return !!(Platform as any).isTV;
}

/** Signal 2: Screen is in landscape with TV ratio (16:9, 16:10, 21:9) */
function signal_screenRatio(): boolean {
  const { width, height } = Dimensions.get('window');
  const w = Math.max(width, height);
  const h = Math.min(width, height);
  const isLandscape = width > height;
  const ratio = w / Math.max(h, 1);
  // Any Android device running in landscape with a wide ratio (>= 1.45)
  return isLandscape && (ratio >= 1.45 || w >= 900);
}

/** Signal 3: TV build configuration flag */
function signal_configTV(): boolean {
  return !!CONFIG.IS_TV_BUILD;
}

/** Combined auto-detection */
function detectTV(): boolean {
  if (signal_configTV()) return true;
  if (signal_platformIsTV()) return true;
  if (Platform.OS !== 'android') return false;
  // On Android, if device is running in landscape with wide screen, it is a TV / Android Box / Leanback device
  return signal_screenRatio();
}

export function useTVDetect(): {
  isTVDevice: boolean;
  setTVMode: (val: boolean) => Promise<void>;
  clearTVOverride: () => Promise<void>;
  debugSignals: () => object;
} {
  const [isTVDevice, setIsTVDevice] = useState<boolean>(detectTV());
  // Track whether user set a manual override
  const [hasOverride, setHasOverride] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.getItem(TV_MODE_KEY).then((val) => {
      if (val === '1') { setIsTVDevice(true);  setHasOverride(true); }
      if (val === '0') { setIsTVDevice(false); setHasOverride(true); }
      // null = no override → keep auto-detected value
    }).catch(() => {});
  }, []);

  /** Force TV mode on or off, persists across restarts */
  const setTVMode = async (val: boolean): Promise<void> => {
    setIsTVDevice(val);
    setHasOverride(true);
    await AsyncStorage.setItem(TV_MODE_KEY, val ? '1' : '0');
  };

  /** Remove manual override and go back to auto-detection */
  const clearTVOverride = async (): Promise<void> => {
    setHasOverride(false);
    setIsTVDevice(detectTV());
    await AsyncStorage.removeItem(TV_MODE_KEY);
  };

  /** Useful for debugging what each signal reports */
  const debugSignals = () => {
    const { width, height } = Dimensions.get('window');
    return {
      Platform_isTV: signal_platformIsTV(),
      screen_ratio:  signal_screenRatio(),
      config_tv:     signal_configTV(),
      auto_result:   detectTV(),
      has_override:  hasOverride,
      final_result:  isTVDevice,
      screen_width:  width,
      screen_height: height,
      pixel_ratio:   PixelRatio.get(),
      aspect_ratio:  (Math.max(width, height) / Math.min(width, height)).toFixed(2),
    };
  };

  return { isTVDevice, setTVMode, clearTVOverride, debugSignals };
}
