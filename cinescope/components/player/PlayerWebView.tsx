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
  onOpenBottomSheet: (type: 'audio' | 'quality' | 'speed' | 'episodes' | 'servers' | 'subtitles') => void;
  onMessage: (event: { nativeEvent: { data: string } }) => void;
}

export const buildPlayerHTML = (videoSrc: string) => {
  const isHls = videoSrc.includes('.m3u8');
  const mimeType = isHls ? 'application/x-mpegURL' : 'video/mp4';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <meta name="referrer" content="no-referrer-when-downgrade" />
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
    video::cue {
      background: transparent !important;
      background-color: transparent !important;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.4;
      text-shadow:
        -1.5px -1.5px 0 #000,
        1.5px -1.5px 0 #000,
        -1.5px 1.5px 0 #000,
        1.5px 1.5px 0 #000,
        0 0 3px #000,
        0 2px 5px rgba(0,0,0,0.95);
      border-radius: 0;
      padding: 0 4px;
    }
  </style>
</head>
<body>
  <video
    id="videoPlayer"
    src="${videoSrc}"
    autoplay
    playsinline
    webkit-playsinline
    x5-playsinline="true"
    preload="auto"
    crossorigin="anonymous"
  >
    <source src="${videoSrc}" type="${mimeType}" onerror="handleSourceError(this)" />
  </video>

  <script>
    const v = document.getElementById('videoPlayer');
    window.videoEl = v;

    window.setSubtitleTrack = function(url, label) {
      try {
        const old = v.querySelectorAll('track');
        old.forEach(function(t) { t.remove(); });
        if (!url) {
          if (v.textTracks && v.textTracks.length > 0) {
            for (var i = 0; i < v.textTracks.length; i++) {
              v.textTracks[i].mode = 'disabled';
            }
          }
          return;
        }
        var track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = label || 'Subtitle';
        track.srclang = 'en';
        track.src = url;
        track.default = true;
        v.appendChild(track);
        function adjustCues() {
          try {
            var t = track.track || (v.textTracks && v.textTracks[0]);
            if (t && t.cues) {
              for (var i = 0; i < t.cues.length; i++) {
                var c = t.cues[i];
                c.snapToLines = false;
                c.line = 80;
              }
            }
          } catch(e) {}
        }
        track.addEventListener('load', function() {
          if (v.textTracks && v.textTracks.length > 0) {
            v.textTracks[0].mode = 'showing';
            adjustCues();
          }
        });
        if (track.track) {
          track.track.oncuechange = function() {
            try {
              if (this.activeCues) {
                for (var i = 0; i < this.activeCues.length; i++) {
                  this.activeCues[i].snapToLines = false;
                  this.activeCues[i].line = 80;
                }
              }
            } catch(e) {}
          };
        }
        if (v.textTracks && v.textTracks.length > 0) {
          v.textTracks[0].mode = 'showing';
          adjustCues();
        }
      } catch (e) {
        console.error('Subtitle error:', e);
      }
    };

    function post(obj) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      }
    }

    function handleSourceError(srcEl) {
      const err = v.error ? ('Code ' + v.error.code + ': ' + (v.error.message || 'Source load error')) : 'Source failed to load';
      post({ type: 'error', error: err });
    }

    function tryPlay() {
      const p = v.play();
      if (p !== undefined && p.catch) {
        p.catch(function(err) {
          // If browser restricts unmuted autoplay, start muted and immediately unmute
          v.muted = true;
          v.play().then(function() {
            setTimeout(function() { v.muted = false; }, 350);
            post({ type: 'playing' });
          }).catch(function(err2) {
            post({ type: 'waiting' });
          });
        });
      }
    }

    v.addEventListener('loadedmetadata', function() {
      post({ type: 'timeupdate', currentTime: v.currentTime, duration: v.duration });
      tryPlay();
    });
    v.addEventListener('loadeddata', function() {
      post({ type: 'canplay' });
      tryPlay();
    });
    v.addEventListener('timeupdate', function() {
      post({ type: 'timeupdate', currentTime: v.currentTime, duration: v.duration });
    });
    v.addEventListener('playing', function() { post({ type: 'playing' }); });
    v.addEventListener('pause', function() { post({ type: 'pause' }); });
    v.addEventListener('waiting', function() { post({ type: 'waiting' }); });
    v.addEventListener('canplay', function() {
      post({ type: 'canplay' });
      tryPlay();
    });
    v.addEventListener('canplaythrough', function() {
      post({ type: 'canplay' });
      tryPlay();
    });
    v.addEventListener('ended', function() { post({ type: 'ended' }); });
    v.addEventListener('error', function() {
      const err = v.error ? ('Code ' + v.error.code + ': ' + (v.error.message || 'Playback error')) : 'Video error';
      post({ type: 'error', error: err });
    });

    // Check if readyState is already available
    if (v.readyState >= 2) {
      post({ type: 'canplay' });
    }
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
          baseUrl: '',
        }}
        originWhitelist={['*']}
        style={styles.webview}
        allowsFullscreenVideo={false}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        allowsProtectedMedia
        androidHardwareAccelerationDisabled={false}
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
