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

export const buildPlayerHTML = (videoSrc: string): string => {
  const isHls = videoSrc.includes('.m3u8');

  // HLS.js script tag — only injected for HLS streams.
  // We escape the closing </script> inside the template literal with a backslash
  // to prevent the HTML parser from terminating the outer script block early.
  const hlsScriptTag = isHls
    ? `<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js"><\/script>`
    : '';

  const hlsInit = isHls
    ? `
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: false,
        lowLatencyMode: false,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 60 * 1000 * 1000,
        backBufferLength: 30,
        maxBufferHole: 1.0,
        manifestLoadingMaxRetry: 6,
        levelLoadingMaxRetry: 6,
        fragLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 1000,
        levelLoadingRetryDelay: 1000,
        fragLoadingRetryDelay: 1000,
        startLevel: -1,
        abrEwmaDefaultEstimate: 2000000,
        nudgeOffset: 0.3,
        nudgeMaxRetry: 8,
        highBufferWatchdogPeriod: 3
      });
      hlsInstance.loadSource('${videoSrc}');
      hlsInstance.attachMedia(v);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
        post({ type: 'canplay' });
        tryPlay();
      });
      hlsInstance.on(Hls.Events.ERROR, function(event, data) {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              try { hlsInstance.startLoad(); } catch(e) {}
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              try { hlsInstance.recoverMediaError(); } catch(e) {}
              break;
            default:
              post({ type: 'error', error: 'HLS fatal error: ' + data.details });
              break;
          }
        } else if (data.details === 'bufferStalledError') {
          if (hlsInstance) { try { hlsInstance.startLoad(); } catch(e) {} }
        }
      });
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = '${videoSrc}';
      v.load();
      tryPlay();
    } else {
      post({ type: 'error', error: 'HLS not supported on this device' });
    }`
    : `if (v.readyState >= 2) { post({ type: 'canplay' }); }
    tryPlay();`;

  const videoSrcAttr = isHls ? '' : `src="${videoSrc}"`;

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
  ${hlsScriptTag}
</head>
<body>
  <video
    id="videoPlayer"
    ${videoSrcAttr}
    autoplay
    playsinline
    webkit-playsinline
    x5-playsinline="true"
    preload="auto"
    onerror="handleSourceError(this)"
  ></video>

  <!-- IN-STREAM PRE-ROLL SPONSOR HUD (Like StreamFlix / YouTube) -->
  <div id="prerollOverlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.85)); display: flex; flex-direction: column; justify-content: space-between; padding: 14px; z-index: 999; pointer-events: auto;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div style="background: #E50914; color: #fff; font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 4px; letter-spacing: 0.5px;">
        AD · <span id="prerollTimer">5</span>s
      </div>
      <a href="https://asiafilm.org/4/c59f31c3db10b336a8c574304c2e9b41" target="_blank" style="background: rgba(255,255,255,0.18); color: #fff; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 6px; text-decoration: none; border: 1px solid rgba(255,255,255,0.3);">
        Visit Sponsor ↗
      </a>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <div style="color: #fff; font-size: 13px; font-weight: 700; margin-bottom: 2px;">MovieVerse Cloud Sponsor</div>
        <div style="color: #94a3b8; font-size: 11px;">Fast 1080p stream starts after sponsor preview</div>
      </div>
      <button id="skipPrerollBtn" onclick="dismissPreroll()" style="background: rgba(0,0,0,0.6); color: #94a3b8; border: 1px solid rgba(255,255,255,0.2); font-size: 12px; font-weight: 700; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
        Skip in 5s
      </button>
    </div>
  </div>

  <script>
    var v = document.getElementById('videoPlayer');
    window.videoEl = v;
    var hlsInstance = null;

    // ── In-Stream Pre-Roll Controller ─────────────────────────────────────────
    var prerollLeft = 5;
    var prerollInterval = setInterval(function() {
      prerollLeft--;
      var t = document.getElementById('prerollTimer');
      var b = document.getElementById('skipPrerollBtn');
      if (t) t.textContent = Math.max(0, prerollLeft);
      if (prerollLeft <= 0) {
        clearInterval(prerollInterval);
        if (b) {
          b.style.background = '#E50914';
          b.style.color = '#ffffff';
          b.textContent = 'Skip Ad ›';
          b.style.border = 'none';
        }
      } else if (b) {
        b.textContent = 'Skip in ' + prerollLeft + 's';
      }
    }, 1000);

    // Auto-dismiss after 8s if user doesn't interact
    setTimeout(function() {
      dismissPreroll();
    }, 8500);

    function dismissPreroll() {
      clearInterval(prerollInterval);
      var o = document.getElementById('prerollOverlay');
      if (o) o.style.display = 'none';
      tryPlay();
    }

    // ── Subtitle track setter ──────────────────────────────────────────────
    window.setSubtitleTrack = function(url, label) {
      try {
        var old = v.querySelectorAll('track');
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
      var err = v.error ? ('Code ' + v.error.code + ': ' + (v.error.message || 'Source load error')) : 'Source failed to load';
      post({ type: 'error', error: err });
    }

    function tryPlay() {
      var p = v.play();
      if (p !== undefined && p.catch) {
        p.catch(function(err) {
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

    // ── Safe playback recovery watchdog ──────────────────────────────────
    // Does NOT alter currentTime (which cancels the browser Range request and clears buffer).
    // Gently re-triggers play() only if decoder froze unexpectedly while having enough data.
    var lastStuckTime = -1;
    var stuckDuration = 0;
    setInterval(function() {
      if (!v.paused && !v.ended && v.readyState >= 3) {
        if (v.currentTime === lastStuckTime) {
          stuckDuration += 3;
          if (stuckDuration >= 12) {
            tryPlay();
            stuckDuration = 0;
          }
        } else {
          stuckDuration = 0;
          lastStuckTime = v.currentTime;
        }
      } else {
        stuckDuration = 0;
      }
    }, 3000);

    v.addEventListener('loadedmetadata', function() {
      post({ type: 'timeupdate', currentTime: v.currentTime, duration: v.duration });
      tryPlay();
    });
    v.addEventListener('loadeddata', function() { post({ type: 'canplay' }); tryPlay(); });
    v.addEventListener('timeupdate', function() {
      post({ type: 'timeupdate', currentTime: v.currentTime, duration: v.duration });
    });
    v.addEventListener('playing', function() { post({ type: 'playing' }); });
    v.addEventListener('pause', function() { post({ type: 'pause' }); });
    v.addEventListener('waiting', function() { post({ type: 'waiting' }); });
    v.addEventListener('canplay', function() { post({ type: 'canplay' }); tryPlay(); });
    v.addEventListener('canplaythrough', function() { post({ type: 'canplay' }); tryPlay(); });
    v.addEventListener('ended', function() { post({ type: 'ended' }); });
    v.addEventListener('error', function() {
      var err = v.error ? ('Code ' + v.error.code + ': ' + (v.error.message || 'Playback error')) : 'Video error';
      post({ type: 'error', error: err });
    });

    // ── HLS.js or native fallback ──────────────────────────────────────────
    ${hlsInit}
  <\/script>
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
          baseUrl: 'https://movieverse.click/',
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
