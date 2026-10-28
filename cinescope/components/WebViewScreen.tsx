import React, { useRef, useState, useEffect } from 'react';
import {
  View, StyleSheet, ActivityIndicator,
  BackHandler, Platform
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONFIG } from '../config';
import { RemoteConfigService } from '../services/remoteConfig';

const NativeWebView = WebView as any;

interface Props {
  url?: string;
  urlSuffix?: string; // e.g. '#search'
}

export default function WebViewScreen({ url, urlSuffix = '' }: Props) {
  const webRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const insets = useSafeAreaInsets();

  const [baseUrl, setBaseUrl] = useState(url || RemoteConfigService.getUrl());

  useEffect(() => {
    if (url) return;
    const unsubscribe = RemoteConfigService.subscribe((newUrl) => {
      setBaseUrl(newUrl);
    });
    return unsubscribe;
  }, [url]);

  const targetUrl = baseUrl + urlSuffix;

  // Handle Android hardware back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const onBack = () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => subscription.remove();
  }, [canGoBack]);

  const errorPage = `
    <html>
    <body style="background:#0A0A0F;color:#fff;font-family:sans-serif;
      display:flex;flex-direction:column;align-items:center;
      justify-content:center;height:100vh;text-align:center;padding:24px;">
      <div style="font-size:64px;margin-bottom:20px">📡</div>
      <h2 style="color:#fff;margin-bottom:12px">No Connection</h2>
      <p style="color:#B0B0CC;line-height:1.6;margin-bottom:28px">
        CineScope needs internet to load content.<br/>
        Check your connection and try again.
      </p>
      <button onclick="window.location.reload()"
        style="background:#E50914;color:#fff;border:none;padding:14px 36px;
        border-radius:50px;font-size:16px;font-weight:bold;cursor:pointer">
        Retry
      </button>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Loading progress bar */}
      {loading && !error && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color={CONFIG.COLORS.accent} />
        </View>
      )}

      <NativeWebView
        ref={webRef}
        source={error ? { html: errorPage } : { uri: targetUrl }}
        style={styles.webview}
        onLoadStart={() => { setLoading(true); setError(false); }}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setError(true); setLoading(false); }}
        onNavigationStateChange={(state: { canGoBack: boolean }) => setCanGoBack(state.canGoBack)}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserGesture={false}
        allowsInlineMediaPlayback
        mixedContentMode="always"
        userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
        onShouldStartLoadWithRequest={() => true}
        allowsFullscreenVideo
        scalesPageToFit={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CONFIG.COLORS.bg,
  },
  webview: {
    flex: 1,
    backgroundColor: CONFIG.COLORS.bg,
  },
  loaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
    paddingTop: 4,
    backgroundColor: 'transparent',
  },
});
