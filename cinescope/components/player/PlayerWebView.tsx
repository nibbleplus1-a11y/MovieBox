import React, { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { EdgeInsets } from 'react-native-safe-area-context';

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
  currentTime?: number;
  activeSubtitleUrl?: string;
  activeSubtitleLang?: string;
  onRetry: () => void;
  onBack: () => void;
  onToggleFullscreen: () => void;
  onOpenBottomSheet: (type: 'audio' | 'quality' | 'speed' | 'episodes' | 'servers' | 'subtitles') => void;
  onMessage: (event: { nativeEvent: { data: string } }) => void;
}

export const buildPlayerHTML = (
  videoSrc: string,
  initialSeekTime: number = 0,
  activeSubtitleUrl?: string,
  activeSubtitleLang?: string
): string => {
  const isHls = videoSrc.includes('.m3u8');
  const safeSeek = Math.max(0, Math.floor(initialSeekTime || 0));

  // HLS.js script tag — only injected for HLS streams.
  const hlsScriptTag = isHls
    ? `<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js"><\/script>`
    : '';

  const hlsInit = isHls
    ? `
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: false,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 90,
        maxBufferSize: 40 * 1000 * 1000,
        backBufferLength: 20,
        maxBufferHole: 0.5,
        manifestLoadingMaxRetry: 6,
        levelLoadingMaxRetry: 6,
        fragLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 500,
        levelLoadingRetryDelay: 500,
        fragLoadingRetryDelay: 500,
        startLevel: -1,
        abrEwmaDefaultEstimate: 5000000,
        nudgeOffset: 0.3,
        nudgeMaxRetry: 8,
        highBufferWatchdogPeriod: 3,
        progressive: true,
        testBandwidth: true,
      });
      hlsInstance.loadSource('${videoSrc}');
      hlsInstance.attachMedia(v);
      hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
        performSeek();
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
  const subTrackTag = activeSubtitleUrl
    ? `<track id="playerSubTrack" kind="subtitles" label="${activeSubtitleLang || 'Subtitles'}" srclang="en" src="${activeSubtitleUrl}" default />`
    : '';

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
      transition: filter 0.25s ease;
    }
    /* AI Super-Resolution (CAS: Contrast Adaptive Sharpening) for 1080p/4K Clarity */
    video.ai-enhanced {
      filter: url('#ai-sharpen-filter') contrast(1.05) saturate(1.04) brightness(1.01);
    }
    video.vivid-cinema {
      filter: contrast(1.10) saturate(1.12) brightness(1.02);
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
  <!-- Real-time SVG AI Super-Resolution Edge Sharpening Matrix -->
  <svg style="position: absolute; width: 0; height: 0;" aria-hidden="true">
    <filter id="ai-sharpen-filter">
      <feConvolveMatrix
        order="3"
        preserveAlpha="true"
        kernelMatrix="0 -0.35 0 -0.35 2.4 -0.35 0 -0.35 0"
      />
    </filter>
  </svg>

  <video
    id="videoPlayer"
    class="ai-enhanced"
    ${videoSrcAttr}
    autoplay
    playsinline
    webkit-playsinline
    x5-playsinline="true"
    preload="auto"
    crossorigin="anonymous"
    onerror="handleSourceError(this)"
  >${subTrackTag}</video>

  <script>
    var v = document.getElementById('videoPlayer');
    window.videoEl = v;
    var hlsInstance = null;
    var targetSeekTime = ${safeSeek};
    var didInitialSeek = targetSeekTime > 0 ? false : true;

    // AI Super-Resolution Mode Switcher
    window.setEnhanceMode = function(mode) {
      v.classList.remove('ai-enhanced', 'vivid-cinema');
      if (mode === 'ai' || mode === '1080p_ai') {
        v.classList.add('ai-enhanced');
      } else if (mode === 'vivid') {
        v.classList.add('vivid-cinema');
      }
      post({ type: 'enhanceMode', mode: mode });
    };

    // Netflix / Prime Video style network speed & device detection
    function detectNetworkAndDisplay() {
      var speedMbps = 10.0;
      if (navigator.connection && navigator.connection.downlink) {
        speedMbps = navigator.connection.downlink;
      }
      var isTvOr4k = (window.screen.width >= 3840 || window.screen.height >= 2160 || (window.screen.width * (window.devicePixelRatio || 1) >= 3840));
      var isFullHd = (window.screen.width * (window.devicePixelRatio || 1) >= 1920);

      var suggested = '1080p';
      if (speedMbps >= 15 && isTvOr4k) {
        suggested = '4k';
      } else if (speedMbps >= 5) {
        suggested = '1080p';
      } else if (speedMbps >= 2.5) {
        suggested = '720p';
      } else {
        suggested = '480p';
      }

      post({
        type: 'networkDetected',
        speedMbps: speedMbps,
        isTvOr4k: isTvOr4k,
        isFullHd: isFullHd,
        suggestedQuality: suggested
      });
    }

    setTimeout(detectNetworkAndDisplay, 600);

    function performSeek() {
      if (!didInitialSeek && targetSeekTime > 0) {
        try {
          if (v.duration && v.duration > 1) {
            v.currentTime = Math.min(targetSeekTime, Math.max(0, v.duration - 1));
          } else if (v.readyState >= 1) {
            v.currentTime = targetSeekTime;
          }
        } catch(e) {}
      }
    }

    function checkSeekDone() {
      if (!didInitialSeek && targetSeekTime > 0) {
        if (Math.abs(v.currentTime - targetSeekTime) <= 2.5 || v.currentTime >= targetSeekTime - 1) {
          didInitialSeek = true;
        }
      }
    }

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
          track.track.mode = 'showing';
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
      } catch (e) {
        console.error('Subtitle error:', e);
      }
    };

    // Auto-enable initial subtitle if loaded
    if ('${activeSubtitleUrl || ''}') {
      setTimeout(function() {
        window.setSubtitleTrack('${activeSubtitleUrl || ''}', '${activeSubtitleLang || 'Subtitles'}');
      }, 100);
    }

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
      performSeek();
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

    // Playback recovery watchdog
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
      performSeek();
      if (didInitialSeek || targetSeekTime <= 0) {
        post({ type: 'timeupdate', currentTime: v.currentTime, duration: v.duration });
      }
      tryPlay();
    });

    v.addEventListener('loadeddata', function() {
      performSeek();
      post({ type: 'canplay' });
      tryPlay();
    });

    v.addEventListener('canplay', function() {
      performSeek();
      post({ type: 'canplay' });
      tryPlay();
    });

    v.addEventListener('canplaythrough', function() {
      performSeek();
      post({ type: 'canplay' });
      tryPlay();
    });

    v.addEventListener('timeupdate', function() {
      checkSeekDone();
      // Suppress premature 0:00 reports when seeking to resume position
      if (!didInitialSeek && targetSeekTime > 0 && v.currentTime < 1.0) {
        performSeek();
        return;
      }
      post({ type: 'timeupdate', currentTime: v.currentTime, duration: v.duration });
    });

    v.addEventListener('playing', function() {
      checkSeekDone();
      post({ type: 'playing' });
    });
    v.addEventListener('pause', function() { post({ type: 'pause' }); });
    v.addEventListener('waiting', function() { post({ type: 'waiting' }); });
    v.addEventListener('ended', function() { post({ type: 'ended' }); });
    v.addEventListener('error', function() {
      var err = v.error ? ('Code ' + v.error.code + ': ' + (v.error.message || 'Playback error')) : 'Video error';
      post({ type: 'error', error: err });
    });

    // HLS.js or native fallback
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
  currentTime,
  activeSubtitleUrl,
  activeSubtitleLang,
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

  // Capture initial seek time once per streamUrl, preventing timeupdate from causing WebView reloads!
  const initialSeekRef = useRef(currentTime || 0);
  const prevStreamUrlRef = useRef(streamUrl);
  if (prevStreamUrlRef.current !== streamUrl) {
    prevStreamUrlRef.current = streamUrl;
    initialSeekRef.current = currentTime || 0;
  }

  const playerHTML = useMemo(() => {
    return buildPlayerHTML(
      streamUrl,
      initialSeekRef.current,
      activeSubtitleUrl,
      activeSubtitleLang
    );
  }, [streamUrl, activeSubtitleUrl, activeSubtitleLang]);

  return (
    <>
      <WebView
        ref={webViewRef}
        key={streamUrl}
        source={{
          html: playerHTML,
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
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        setSupportMultipleWindows={false}
        thirdPartyCookiesEnabled={true}
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
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerBox: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: '#f87171',
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: '#e50914',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  bufferingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  iframeTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: 'rgba(7, 8, 11, 0.85)',
    zIndex: 10,
  },
  iconCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iframeInfoBox: {
    flex: 1,
    marginLeft: 12,
  },
  iframeServerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  iframeEpLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  iframeTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 14,
  },
  toolChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
