import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EdgeInsets } from 'react-native-safe-area-context';

interface PlayerWebViewProps {
  streamUrl: string;
  useIframe: boolean;
  iframeServerName?: string;
  loading: boolean;
  error: string | null;
  isBuffering: boolean;
  isFullscreen: boolean;
  insets: EdgeInsets;
  epLabel?: string | null;
  seasonsCount: number;
  webViewRef: React.RefObject<any>;
  onRetry: () => void;
  onBack: () => void;
  onToggleFullscreen: () => void;
  onOpenBottomSheet: (type: 'audio' | 'quality' | 'speed' | 'episodes' | 'servers') => void;
  onMessage: (event: { nativeEvent: { data: string } }) => void;
}

export const buildPlayerHTML = (videoSrc: string) => {
  // FIX P1 #2: dynamically choose MIME type based on extension
  const isHls = videoSrc.includes('.m3u8');
  const mimeType = isHls ? 'application/x-mpegURL' : 'video/mp4';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <meta name="referrer" content="always" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%;
      background: #000; overflow: hidden;
      user-select: none; -webkit-user-select: none;
    }
    video {
      width: 100%; height: 100%;
      object-fit: contain; background: #000;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <video
    id="videoPlayer"
    autoplay
    playsinline
    webkit-playsinline
    x5-playsinline="true"
    preload="auto"
  >
    <source src="${videoSrc}" type="${mimeType}" />
  </video>

  <script>
    const v = document.getElementById('videoPlayer');
    window.videoEl = v;

    function post(obj) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      }
    }

    function tryPlay() {
      const p = v.play();
      if (p !== undefined && p.catch) {
        p.catch(function(err) {
          // Fallback if browser blocks unmuted autoplay: start muted then unmute immediately
          v.muted = true;
          v.play().then(function() {
            setTimeout(function() { v.muted = false; }, 300);
            post({ type: 'playing' });
          }).catch(function() {
            post({ type: 'waiting' });
          });
        });
      }
    }

    v.addEventListener('loadedmetadata', () => {
      post({ type: 'timeupdate', currentTime: v.currentTime, duration: v.duration });
      tryPlay();
    });
    v.addEventListener('timeupdate', () => {
      post({ type: 'timeupdate', currentTime: v.currentTime, duration: v.duration });
    });
    v.addEventListener('playing', () => post({ type: 'playing' }));
    v.addEventListener('pause', () => post({ type: 'pause' }));
    v.addEventListener('waiting', () => post({ type: 'waiting' }));
    v.addEventListener('canplay', () => {
      post({ type: 'canplay' });
      tryPlay();
    });
    v.addEventListener('ended', () => post({ type: 'ended' }));
    v.addEventListener('error', () => {
      const err = v.error ? (v.error.message || ('Code: ' + v.error.code)) : 'Video playback error';
      post({ type: 'error', error: err });
    });

    // Ensure playback kicks off immediately on load
    tryPlay();
  </script>
</body>
</html>`;
};

export const PlayerWebView: React.FC<PlayerWebViewProps> = ({
  streamUrl,
  useIframe,
  iframeServerName,
  loading,
  error,
  isBuffering,
  isFullscreen,
  insets,
  epLabel,
  seasonsCount,
  webViewRef,
  onRetry,
  onBack,
  onToggleFullscreen,
  onOpenBottomSheet,
  onMessage,
}) => {
  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color="#e50914" />
        <Text style={styles.loadingText}>Connecting stream…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerBox}>
        <Ionicons name="warning-outline" size={42} color="#fca5a5" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryText}>Retry Stream</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (useIframe) {
    return (
      <>
        <WebView
          key={streamUrl}
          source={{ uri: streamUrl }}
          style={styles.webview}
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          javaScriptEnabled
          domStorageEnabled
        />
        <View style={[styles.iframeTopBar, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity style={styles.iconCircleBtn} onPress={onBack} activeOpacity={0.8}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={styles.iframeInfoBox}>
            <Text style={styles.iframeServerText} numberOfLines={1}>
              {iframeServerName || 'Cloud Stream'}
            </Text>
            {epLabel ? <Text style={styles.iframeEpLabel}>{epLabel}</Text> : null}
          </View>

          <View style={styles.iframeTopRight}>
            {seasonsCount > 0 && (
              <TouchableOpacity
                style={styles.toolChip}
                onPress={() => onOpenBottomSheet('episodes')}
              >
                <Ionicons name="list" size={13} color="#fff" />
                <Text style={styles.toolChipText}> Episodes</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.toolChip}
              onPress={() => onOpenBottomSheet('servers')}
            >
              <Ionicons name="server-outline" size={13} color="#fff" />
              <Text style={styles.toolChipText}> Server</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconCircleBtn} onPress={onToggleFullscreen}>
              <Ionicons name={isFullscreen ? 'contract' : 'expand'} size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <WebView
        ref={webViewRef}
        key={streamUrl}
        source={{
          html: buildPlayerHTML(streamUrl),
          baseUrl: 'https://movieboxonline.net/',
        }}
        originWhitelist={['*']}
        style={styles.webview}
        allowsFullscreenVideo={false}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        onMessage={onMessage}
      />
      {isBuffering && (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#e50914" />
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: '#000' },
  centerBox: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#8e95a5', fontSize: 13, fontWeight: '500' },
  bufferingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  errorText: { color: '#fca5a5', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
  retryBtn: {
    backgroundColor: '#e50914',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginTop: 6,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  iframeTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    gap: 10,
    zIndex: 20,
  },
  iframeInfoBox: { flex: 1, gap: 2 },
  iframeServerText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  iframeEpLabel: { color: '#94a3b8', fontSize: 11 },
  iframeTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolChip: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
