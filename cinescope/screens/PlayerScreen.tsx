import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions, ScrollView, Modal,
  TouchableWithoutFeedback, Animated, useWindowDimensions,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CONFIG } from '../config';
import { api, StreamData, StreamSource } from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type BottomSheetType = 'none' | 'audio' | 'quality' | 'speed' | 'episodes' | 'servers';

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {
    id: initialId,
    title,
    cover,
    initialDub,
    season: initialSeason = 0,
    episode: initialEpisode = 0,
    type: initialType = 'Movie',
  } = route.params || {};

  // Core stream states
  const [currentId, setCurrentId] = useState<string>(initialId);
  const [currentSeason, setCurrentSeason] = useState<number>(initialSeason);
  const [currentEpisode, setCurrentEpisode] = useState<number>(initialEpisode);
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [activeStream, setActiveStream] = useState<StreamSource | null>(null);
  const [selectedServer, setSelectedServer] = useState<string>('direct');
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [useIframe, setUseIframe] = useState<boolean>(false);
  const [iframeServerName, setIframeServerName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Playback states
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [selectedDubName, setSelectedDubName] = useState<string>(initialDub || 'Original Audio');

  // UI Control states (Netflix-style)
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [bottomSheet, setBottomSheet] = useState<BottomSheetType>('none');
  const [seasonsData, setSeasonsData] = useState<any[]>([]);
  const [sheetSeason, setSheetSeason] = useState<number>(initialSeason || 1);

  const isSeriesType = initialType === 'Series' || initialType === 'TV Series';

  const webViewRef = useRef<any>(null);
  const controlsTimerRef = useRef<any>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Episode + season label shown in player overlay
  const epLabel = isSeriesType && currentSeason > 0
    ? `S${currentSeason} E${currentEpisode}`
    : null;

  // Orientation handling: lock to portrait by default, listen for physical rotation, lock to portrait on unmount
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);

    const subscription = ScreenOrientation.addOrientationChangeListener((evt) => {
      const o = evt.orientationInfo.orientation;
      if (
        o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
      ) {
        setIsFullscreen(true);
      } else if (
        o === ScreenOrientation.Orientation.PORTRAIT_UP ||
        o === ScreenOrientation.Orientation.PORTRAIT_DOWN
      ) {
        setIsFullscreen(false);
      }
    });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  // Auto-hide controls timer (Netflix 3.5s rule)
  const resetControlsTimer = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    setControlsVisible(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();

    if (!isLocked && isPlaying) {
      controlsTimerRef.current = setTimeout(() => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setControlsVisible(false);
        });
      }, 3500);
    }
  }, [fadeAnim, isLocked, isPlaying]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [resetControlsTimer, isPlaying]);

  // Toggle controls visibility on single tap
  const toggleControls = () => {
    if (controlsVisible) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setControlsVisible(false);
      });
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    } else {
      resetControlsTimer();
    }
  };

  // Fullscreen toggle — true fullscreen via LANDSCAPE_RIGHT lock + 100% overlay
  const toggleFullscreen = useCallback(async () => {
    try {
      if (isFullscreen) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsFullscreen(false);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
        setIsFullscreen(true);
      }
    } catch (err) {
      console.warn('Orientation lock error:', err);
    }
    resetControlsTimer();
  }, [isFullscreen, resetControlsTimer]);

  // Load streams from backend
  const loadStreams = useCallback(async (subjectId: string, se = 0, ep = 0) => {
    setLoading(true);
    setError(null);
    setIsBuffering(true);
    try {
      const data = await api.streams(subjectId, se, ep);
      setStreamData(data);

      const playable = (data.streams || []).filter(
        s => s.format !== 'DASH' && !s.url.includes('.mpd')
      );

      if (playable.length > 0) {
        const best = playable.find(s => s.quality === '1080p') || playable[0];
        setActiveStream(best);
        setSelectedServer('direct');
        setUseIframe(false);
        setIframeServerName('');
        setStreamUrl(api.proxyUrl(best.url, best.headers?.Referer));
      } else if (data.fallback_servers && data.fallback_servers.length > 0) {
        const srv = data.fallback_servers[0];
        setSelectedServer(srv.id);
        setIframeServerName(srv.name || srv.id);
        setStreamUrl(srv.url);
        setUseIframe(true);
      } else {
        setError('No streams available for this title.');
      }

      // Fetch episodes if series
      if (isSeriesType || se > 0 || ep > 0) {
        try {
          const epData = await api.episodes(subjectId);
          if (epData?.seasons) {
            setSeasonsData(epData.seasons);
            const targetSe = se || epData.seasons[0]?.season || 1;
            setSheetSeason(targetSe);
          }
        } catch {}
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load stream');
    } finally {
      setLoading(false);
    }
  }, [isSeriesType]);

  useEffect(() => {
    loadStreams(currentId, currentSeason, currentEpisode);
  }, [currentId, currentSeason, currentEpisode, loadStreams]);

  // Control Commands to WebView Video
  const sendVideoCommand = (jsCode: string) => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(jsCode);
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      sendVideoCommand('window.videoEl && window.videoEl.pause();');
    } else {
      sendVideoCommand('window.videoEl && window.videoEl.play();');
    }
    resetControlsTimer();
  };

  const seekRelative = (deltaSeconds: number) => {
    const target = Math.max(0, Math.min(duration, currentTime + deltaSeconds));
    sendVideoCommand(`if(window.videoEl) window.videoEl.currentTime = ${target};`);
    setCurrentTime(target);
    resetControlsTimer();
  };

  const seekAbsolute = (percentage: number) => {
    if (duration > 0) {
      const target = duration * Math.max(0, Math.min(1, percentage));
      sendVideoCommand(`if(window.videoEl) window.videoEl.currentTime = ${target};`);
      setCurrentTime(target);
      resetControlsTimer();
    }
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    sendVideoCommand(`if(window.videoEl) window.videoEl.playbackRate = ${speed};`);
    setBottomSheet('none');
    resetControlsTimer();
  };

  const switchQuality = (stream: StreamSource) => {
    setActiveStream(stream);
    setSelectedServer('direct');
    setUseIframe(false);
    const newUrl = api.proxyUrl(stream.url, stream.headers?.Referer);
    setStreamUrl(newUrl);
    setBottomSheet('none');
    resetControlsTimer();
  };

  const switchDub = (dubId: string, dubName: string) => {
    setSelectedDubName(dubName);
    setCurrentId(dubId);
    setBottomSheet('none');
    resetControlsTimer();
  };

  const switchServer = (serverId: string) => {
    if (serverId === 'direct') {
      if (activeStream) {
        setSelectedServer('direct');
        setUseIframe(false);
        setIframeServerName('');
        setStreamUrl(api.proxyUrl(activeStream.url, activeStream.headers?.Referer));
      }
    } else {
      const srv = streamData?.fallback_servers?.find(s => s.id === serverId);
      if (srv) {
        setSelectedServer(srv.id);
        setIframeServerName(srv.name || srv.id);
        setUseIframe(true);
        setStreamUrl(srv.url);
      }
    }
    setBottomSheet('none');
    resetControlsTimer();
  };

  const switchEpisode = (se: number, ep: number) => {
    setCurrentSeason(se);
    setCurrentEpisode(ep);
    setSheetSeason(se);
    setBottomSheet('none');
    resetControlsTimer();
  };

  // Handle messages from the WebView Video Player
  const handleWebViewMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      switch (msg.type) {
        case 'timeupdate':
          setCurrentTime(msg.currentTime || 0);
          if (msg.duration && msg.duration > 0) setDuration(msg.duration);
          break;
        case 'playing':
          setIsPlaying(true);
          setIsBuffering(false);
          break;
        case 'pause':
          setIsPlaying(false);
          break;
        case 'waiting':
          setIsBuffering(true);
          break;
        case 'canplay':
          setIsBuffering(false);
          break;
        default:
          break;
      }
    } catch {}
  };

  // Custom HTML5 Video Player inside WebView
  const buildPlayerHTML = (videoSrc: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
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
    <source src="${videoSrc}" type="video/mp4" />
  </video>

  <script>
    const v = document.getElementById('videoPlayer');
    window.videoEl = v;

    function post(obj) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(obj));
      }
    }

    v.addEventListener('timeupdate', () => {
      post({ type: 'timeupdate', currentTime: v.currentTime, duration: v.duration });
    });
    v.addEventListener('playing', () => post({ type: 'playing' }));
    v.addEventListener('pause', () => post({ type: 'pause' }));
    v.addEventListener('waiting', () => post({ type: 'waiting' }));
    v.addEventListener('canplay', () => post({ type: 'canplay' }));
    v.addEventListener('ended', () => post({ type: 'ended' }));
  </script>
</body>
</html>
`;

  const playableStreams = (streamData?.streams || []).filter(
    s => s.format !== 'DASH' && !s.url.includes('.mpd')
  );
  const dubsList = streamData?.dubs || [];
  const fallbackServers = streamData?.fallback_servers || [];
  const sheetSeasonEpisodes = seasonsData.find(s => s.season === sheetSeason)?.episodes || [];

  // In fullscreen, player takes the FULL screen dimensions
  const playerHeight = isFullscreen ? screenHeight : (screenWidth * 9) / 16;
  const playerWidth = isFullscreen ? screenWidth : screenWidth;
  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  // Back action: exit fullscreen first, then go back
  const handleBack = () => {
    if (isFullscreen) {
      toggleFullscreen();
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden={isFullscreen} style="light" />

      {/* VIDEO PLAYER VIEWPORT — absolute in fullscreen, inline otherwise */}
      <View style={[
        styles.playerContainer,
        isFullscreen
          ? styles.playerContainerFullscreen
          : { height: (screenWidth * 9) / 16, width: '100%' },
      ]}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#e50914" />
            <Text style={styles.loadingText}>Connecting stream…</Text>
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Ionicons name="warning-outline" size={42} color="#fca5a5" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => loadStreams(currentId, currentSeason, currentEpisode)}
            >
              <Text style={styles.retryText}>Retry Stream</Text>
            </TouchableOpacity>
          </View>
        ) : useIframe ? (
          // ── IFRAME / EMBED server — minimal overlay on top ──
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
            {/* Minimal top bar for iframe mode */}
            <View style={[styles.iframeTopBar, { paddingTop: isFullscreen ? insets.top + 6 : insets.top + 6 }]}>
              <TouchableOpacity
                style={styles.iconCircleBtn}
                onPress={handleBack}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </TouchableOpacity>

              <View style={styles.iframeInfoBox}>
                <Text style={styles.iframeServerText} numberOfLines={1}>
                  {iframeServerName || 'Cloud Stream'}
                </Text>
                {epLabel ? (
                  <Text style={styles.iframeEpLabel}>{epLabel}</Text>
                ) : null}
              </View>

              <View style={styles.iframeTopRight}>
                {seasonsData.length > 0 && (
                  <TouchableOpacity
                    style={styles.toolChip}
                    onPress={() => { setBottomSheet('episodes'); resetControlsTimer(); }}
                  >
                    <Ionicons name="list" size={13} color="#fff" />
                    <Text style={styles.toolChipText}> Episodes</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.toolChip}
                  onPress={() => { setBottomSheet('servers'); resetControlsTimer(); }}
                >
                  <Ionicons name="server-outline" size={13} color="#fff" />
                  <Text style={styles.toolChipText}> Server</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconCircleBtn} onPress={toggleFullscreen}>
                  <Ionicons name={isFullscreen ? 'contract' : 'expand'} size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : (
          <WebView
            ref={webViewRef}
            key={streamUrl}
            source={{ html: buildPlayerHTML(streamUrl) }}
            style={styles.webview}
            allowsFullscreenVideo={false}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            onMessage={handleWebViewMessage}
          />
        )}

        {/* Buffering Indicator overlay */}
        {isBuffering && !loading && !error && !useIframe && (
          <View style={styles.bufferingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#e50914" />
          </View>
        )}

        {/* GESTURE TOUCH LAYER */}
        {!useIframe && !loading && !error && (
          <TouchableWithoutFeedback onPress={toggleControls}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        )}

        {/* NETFLIX-STYLE FLOATING ON-SCREEN CONTROLS OVERLAY */}
        {!useIframe && !loading && !error && controlsVisible && (
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.controlsOverlay, { opacity: fadeAnim }]}
            pointerEvents="box-none"
          >
            {/* Screen Lock Mode */}
            {isLocked ? (
              <View style={styles.lockedContainer}>
                <TouchableOpacity
                  style={styles.unlockBtn}
                  onPress={() => { setIsLocked(false); resetControlsTimer(); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="lock-closed" size={18} color="#fff" />
                  <Text style={styles.unlockText}>Screen Locked · Tap to Unlock</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* TOP BAR */}
                <View style={[styles.topBar, { paddingTop: isFullscreen ? Math.max(insets.top, 14) : 12 }]}>
                  <TouchableOpacity
                    style={styles.iconCircleBtn}
                    onPress={handleBack}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chevron-back" size={22} color="#fff" />
                  </TouchableOpacity>

                  <View style={styles.topTitleBox}>
                    <Text style={styles.topMovieTitle} numberOfLines={1}>
                      {title || streamData?.title || 'Now Playing'}
                    </Text>
                    <Text style={styles.topMovieSubtitle} numberOfLines={1}>
                      {epLabel ? `${epLabel} · ` : ''}{selectedDubName} · {activeStream?.quality || '1080p'}
                    </Text>
                  </View>

                  <View style={styles.topRightIcons}>
                    <TouchableOpacity
                      style={styles.toolChip}
                      onPress={() => { setBottomSheet('audio'); resetControlsTimer(); }}
                    >
                      <Ionicons name="volume-high-outline" size={13} color="#fff" />
                      <Text style={styles.toolChipText}> Audio</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.toolChip}
                      onPress={() => { setBottomSheet('quality'); resetControlsTimer(); }}
                    >
                      <Ionicons name="flash-outline" size={13} color="#fff" />
                      <Text style={styles.toolChipText}> Quality</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.iconCircleBtn}
                      onPress={() => { setIsLocked(true); resetControlsTimer(); }}
                    >
                      <Ionicons name="lock-open-outline" size={17} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* CENTER CONTROLS: -10s, Play/Pause, +10s */}
                <View style={styles.centerControls} pointerEvents="box-none">
                  <TouchableOpacity
                    style={styles.seekBtn}
                    onPress={() => seekRelative(-10)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="play-back" size={28} color="#fff" />
                    <Text style={styles.seekBtnSub}>10</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.playPauseBtn}
                    onPress={togglePlayPause}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={28}
                      color="#fff"
                      style={{ marginLeft: isPlaying ? 0 : 3 }}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.seekBtn}
                    onPress={() => seekRelative(10)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="play-forward" size={28} color="#fff" />
                    <Text style={styles.seekBtnSub}>10</Text>
                  </TouchableOpacity>
                </View>

                {/* BOTTOM CONTROLS: Scrubber & Quick Tools */}
                <View style={[styles.bottomBar, { paddingBottom: isFullscreen ? Math.max(insets.bottom, 10) + 4 : 10 }]}>
                  {/* Scrubber Bar */}
                  <View style={styles.scrubberRow}>
                    <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                    <TouchableWithoutFeedback
                      onPress={(e) => {
                        const touchX = e.nativeEvent.locationX;
                        seekAbsolute(touchX / Math.max(1, (screenWidth - (isFullscreen ? 140 : 120))));
                      }}
                    >
                      <View style={styles.scrubberTrack}>
                        <View style={styles.scrubberBg} />
                        <View style={[styles.scrubberFill, { width: `${progressRatio * 100}%` }]} />
                        <View style={[styles.scrubberThumb, { left: `${progressRatio * 100}%` }]} />
                      </View>
                    </TouchableWithoutFeedback>
                    <Text style={styles.timeText}>{formatTime(duration)}</Text>
                  </View>

                  {/* Feature Tray */}
                  <View style={styles.bottomTray}>
                    <View style={styles.bottomTrayLeft}>
                      <TouchableOpacity
                        style={styles.trayActionBtn}
                        onPress={() => { setBottomSheet('speed'); resetControlsTimer(); }}
                      >
                        <Ionicons name="speedometer-outline" size={12} color="#cbd5e1" style={{ marginRight: 4 }} />
                        <Text style={styles.trayActionText}>{playbackSpeed}x</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.trayActionBtn}
                        onPress={() => { setBottomSheet('servers'); resetControlsTimer(); }}
                      >
                        <Ionicons name="cloud-outline" size={12} color="#cbd5e1" style={{ marginRight: 4 }} />
                        <Text style={styles.trayActionText}>Server</Text>
                      </TouchableOpacity>

                      {seasonsData.length > 0 && (
                        <TouchableOpacity
                          style={styles.trayActionBtn}
                          onPress={() => { setBottomSheet('episodes'); resetControlsTimer(); }}
                        >
                          <Ionicons name="list" size={12} color="#cbd5e1" style={{ marginRight: 4 }} />
                          <Text style={styles.trayActionText}>Episodes</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity style={styles.fullscreenToggle} onPress={toggleFullscreen}>
                      <Ionicons name={isFullscreen ? 'contract' : 'expand'} size={22} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </Animated.View>
        )}
      </View>

      {/* PORTRAIT DASHBOARD & RECOMMENDATIONS */}
      {!isFullscreen && (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces
        >
          {/* Movie Title & Badges */}
          <View style={styles.metaSection}>
            <Text style={styles.movieMainTitle}>{title || streamData?.title || 'Now Playing'}</Text>

            <View style={styles.badgeRow}>
              <View style={styles.netflixMatchBadge}>
                <Text style={styles.netflixMatchText}>98% Match</Text>
              </View>
              <View style={styles.qualityTagBadge}>
                <Text style={styles.qualityTagText}>{activeStream?.quality || '1080p FHD'}</Text>
              </View>
              <View style={styles.metaTagBadge}>
                <Text style={styles.metaTagText}>Dolby Audio</Text>
              </View>
              <View style={styles.metaTagBadge}>
                <Text style={styles.metaTagText}>{selectedDubName}</Text>
              </View>
            </View>
          </View>

          {/* Quick Actions Row */}
          <View style={styles.quickBar}>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => setBottomSheet('audio')}
              activeOpacity={0.8}
            >
              <View style={styles.quickBtnIconBox}>
                <Ionicons name="volume-high" size={20} color="#e50914" />
              </View>
              <Text style={styles.quickBtnLabel}>Audio Dubs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => setBottomSheet('quality')}
              activeOpacity={0.8}
            >
              <View style={styles.quickBtnIconBox}>
                <Ionicons name="flash" size={20} color="#e50914" />
              </View>
              <Text style={styles.quickBtnLabel}>Quality</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => setBottomSheet('servers')}
              activeOpacity={0.8}
            >
              <View style={styles.quickBtnIconBox}>
                <Ionicons name="cloud" size={20} color="#e50914" />
              </View>
              <Text style={styles.quickBtnLabel}>Servers</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => setBottomSheet('speed')}
              activeOpacity={0.8}
            >
              <View style={styles.quickBtnIconBox}>
                <Ionicons name="speedometer" size={20} color="#e50914" />
              </View>
              <Text style={styles.quickBtnLabel}>Speed ({playbackSpeed}x)</Text>
            </TouchableOpacity>

            {seasonsData.length > 0 && (
              <TouchableOpacity
                style={styles.quickBtn}
                onPress={() => setBottomSheet('episodes')}
                activeOpacity={0.8}
              >
                <View style={styles.quickBtnIconBox}>
                  <Ionicons name="list" size={20} color="#e50914" />
                </View>
                <Text style={styles.quickBtnLabel}>Episodes</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Audio Languages Shelf */}
          {dubsList.length > 0 && (
            <View style={styles.dashSection}>
              <Text style={styles.dashSectionTitle}>AVAILABLE AUDIO LANGUAGES</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {dubsList.map((dub, i) => {
                  const isCurrent = dub.subject_id === currentId;
                  return (
                    <TouchableOpacity
                      key={dub.subject_id || i}
                      style={[styles.audioChip, isCurrent && styles.audioChipActive]}
                      onPress={() => switchDub(dub.subject_id, dub.lang_name)}
                    >
                      <Ionicons
                        name={isCurrent ? 'checkmark-circle' : 'volume-medium-outline'}
                        size={14}
                        color={isCurrent ? '#e50914' : '#94a3b8'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.audioChipText, isCurrent && styles.audioChipTextActive]}>
                        {dub.lang_name || 'Dub'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Stream Resolutions Shelf */}
          {playableStreams.length > 0 && (
            <View style={styles.dashSection}>
              <Text style={styles.dashSectionTitle}>SELECT STREAM RESOLUTION</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {playableStreams.map((s, i) => {
                  const isCurrent = !useIframe && activeStream?.url === s.url;
                  return (
                    <TouchableOpacity
                      key={s.url || i}
                      style={[styles.qualityChip, isCurrent && styles.qualityChipActive]}
                      onPress={() => switchQuality(s)}
                    >
                      <Ionicons
                        name={isCurrent ? 'checkmark-circle' : 'flash-outline'}
                        size={14}
                        color={isCurrent ? '#e50914' : '#94a3b8'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.qualityChipText, isCurrent && styles.qualityChipTextActive]}>
                        {s.quality} {s.size_mb ? `(${s.size_mb} MB)` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Cloud Fallback Servers */}
          {fallbackServers.length > 0 && (
            <View style={styles.dashSection}>
              <Text style={styles.dashSectionTitle}>ALTERNATE STREAMING MIRRORS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                <TouchableOpacity
                  style={[styles.serverChip, !useIframe && styles.serverChipActive]}
                  onPress={() => switchServer('direct')}
                >
                  <Ionicons
                    name={!useIframe ? 'checkmark-circle' : 'flash-outline'}
                    size={14}
                    color={!useIframe ? '#e50914' : '#94a3b8'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.serverChipText, !useIframe && styles.serverChipTextActive]}>
                    CineScope CDN
                  </Text>
                </TouchableOpacity>
                {fallbackServers.map(srv => {
                  const isCurrent = useIframe && selectedServer === srv.id;
                  return (
                    <TouchableOpacity
                      key={srv.id}
                      style={[styles.serverChip, isCurrent && styles.serverChipActive]}
                      onPress={() => switchServer(srv.id)}
                    >
                      <Ionicons
                        name={isCurrent ? 'checkmark-circle' : 'cloud-outline'}
                        size={14}
                        color={isCurrent ? '#e50914' : '#94a3b8'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.serverChipText, isCurrent && styles.serverChipTextActive]}>
                        {srv.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* NETFLIX-STYLE BOTTOM SHEET MODAL */}
      <Modal
        visible={bottomSheet !== 'none'}
        transparent
        animationType="slide"
        onRequestClose={() => setBottomSheet('none')}
      >
        <TouchableWithoutFeedback onPress={() => setBottomSheet('none')}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20 }]}>
                {/* Drag handle */}
                <View style={styles.sheetHandle} />
                {/* Header */}
                <View style={styles.bottomSheetHeader}>
                  <View style={styles.sheetHeaderLeft}>
                    {bottomSheet === 'audio' && <Ionicons name="volume-high" size={18} color="#e50914" />}
                    {bottomSheet === 'quality' && <Ionicons name="flash" size={18} color="#e50914" />}
                    {bottomSheet === 'speed' && <Ionicons name="speedometer" size={18} color="#e50914" />}
                    {bottomSheet === 'servers' && <Ionicons name="cloud" size={18} color="#e50914" />}
                    {bottomSheet === 'episodes' && <Ionicons name="list" size={18} color="#e50914" />}
                    <Text style={styles.bottomSheetTitle}>
                      {bottomSheet === 'audio' && 'Audio Languages & Dubs'}
                      {bottomSheet === 'quality' && 'Video Quality'}
                      {bottomSheet === 'speed' && 'Playback Speed'}
                      {bottomSheet === 'servers' && 'Streaming Servers'}
                      {bottomSheet === 'episodes' && 'TV Show Episodes'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setBottomSheet('none')} style={styles.modalCloseBtn}>
                    <Ionicons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* AUDIO DUBS LIST */}
                {bottomSheet === 'audio' && (
                  <ScrollView style={styles.sheetList}>
                    {dubsList.length > 0 ? (
                      dubsList.map((dub, i) => {
                        const isSelected = dub.subject_id === currentId;
                        return (
                          <TouchableOpacity
                            key={dub.subject_id || i}
                            style={[styles.sheetRow, isSelected && styles.sheetRowSelected]}
                            onPress={() => switchDub(dub.subject_id, dub.lang_name)}
                          >
                            <Ionicons
                              name="volume-medium-outline"
                              size={18}
                              color={isSelected ? '#e50914' : '#64748b'}
                              style={{ marginRight: 12 }}
                            />
                            <Text style={[styles.sheetRowText, isSelected && styles.sheetRowTextSelected]}>
                              {dub.lang_name || 'Original Audio'}
                            </Text>
                            {isSelected && <Ionicons name="checkmark-circle" size={20} color="#e50914" />}
                          </TouchableOpacity>
                        );
                      })
                    ) : (
                      <View style={[styles.sheetRow, styles.sheetRowSelected]}>
                        <Ionicons name="volume-medium-outline" size={18} color="#e50914" style={{ marginRight: 12 }} />
                        <Text style={[styles.sheetRowText, styles.sheetRowTextSelected]}>Original Audio Track</Text>
                        <Ionicons name="checkmark-circle" size={20} color="#e50914" />
                      </View>
                    )}
                  </ScrollView>
                )}

                {/* QUALITY LIST */}
                {bottomSheet === 'quality' && (
                  <ScrollView style={styles.sheetList}>
                    {playableStreams.map((s, i) => {
                      const isSelected = !useIframe && activeStream?.url === s.url;
                      return (
                        <TouchableOpacity
                          key={s.url || i}
                          style={[styles.sheetRow, isSelected && styles.sheetRowSelected]}
                          onPress={() => switchQuality(s)}
                        >
                          <Ionicons
                            name="flash-outline"
                            size={18}
                            color={isSelected ? '#e50914' : '#64748b'}
                            style={{ marginRight: 12 }}
                          />
                          <Text style={[styles.sheetRowText, isSelected && styles.sheetRowTextSelected]}>
                            {s.quality} {s.size_mb ? `(~${s.size_mb} MB)` : ''}
                          </Text>
                          {isSelected && <Ionicons name="checkmark-circle" size={20} color="#e50914" />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {/* SPEED LIST */}
                {bottomSheet === 'speed' && (
                  <View style={styles.sheetList}>
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(sp => {
                      const isSelected = playbackSpeed === sp;
                      return (
                        <TouchableOpacity
                          key={sp}
                          style={[styles.sheetRow, isSelected && styles.sheetRowSelected]}
                          onPress={() => changeSpeed(sp)}
                        >
                          <Ionicons
                            name="speedometer-outline"
                            size={18}
                            color={isSelected ? '#e50914' : '#64748b'}
                            style={{ marginRight: 12 }}
                          />
                          <Text style={[styles.sheetRowText, isSelected && styles.sheetRowTextSelected]}>
                            {sp === 1.0 ? '1.0× Normal' : `${sp}×`}
                          </Text>
                          {isSelected && <Ionicons name="checkmark-circle" size={20} color="#e50914" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* SERVERS LIST */}
                {bottomSheet === 'servers' && (
                  <ScrollView style={styles.sheetList}>
                    <TouchableOpacity
                      style={[styles.sheetRow, !useIframe && styles.sheetRowSelected]}
                      onPress={() => switchServer('direct')}
                    >
                      <Ionicons
                        name="flash-outline"
                        size={18}
                        color={!useIframe ? '#e50914' : '#64748b'}
                        style={{ marginRight: 12 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sheetRowText, !useIframe && styles.sheetRowTextSelected]}>
                          CineScope Direct CDN
                        </Text>
                        <Text style={styles.sheetRowSub}>Fastest · Native 1080p MP4</Text>
                      </View>
                      {!useIframe && <Ionicons name="checkmark-circle" size={20} color="#e50914" />}
                    </TouchableOpacity>
                    {fallbackServers.map(srv => {
                      const isSelected = useIframe && selectedServer === srv.id;
                      return (
                        <TouchableOpacity
                          key={srv.id}
                          style={[styles.sheetRow, isSelected && styles.sheetRowSelected]}
                          onPress={() => switchServer(srv.id)}
                        >
                          <Ionicons
                            name="cloud-outline"
                            size={18}
                            color={isSelected ? '#e50914' : '#64748b'}
                            style={{ marginRight: 12 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.sheetRowText, isSelected && styles.sheetRowTextSelected]}>
                              {srv.name}
                            </Text>
                            <Text style={styles.sheetRowSub}>Cloud Stream</Text>
                          </View>
                          {isSelected && <Ionicons name="checkmark-circle" size={20} color="#e50914" />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {/* EPISODES — with season tabs */}
                {bottomSheet === 'episodes' && (
                  <View style={{ flex: 1 }}>
                    {/* Season selector tabs */}
                    {seasonsData.length > 1 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.seasonTabsRow}
                        style={styles.seasonTabsScroll}
                      >
                        {seasonsData.map(s => {
                          const isActive = s.season === sheetSeason;
                          return (
                            <TouchableOpacity
                              key={s.season}
                              style={[styles.seasonTab, isActive && styles.seasonTabActive]}
                              onPress={() => setSheetSeason(s.season)}
                            >
                              <Text style={[styles.seasonTabText, isActive && styles.seasonTabTextActive]}>
                                Season {s.season}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}
                    {/* Episode rows for selected season */}
                    <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
                      {sheetSeasonEpisodes.length > 0 ? (
                        sheetSeasonEpisodes.map((ep: any) => {
                          const isCurrent = ep.episode === currentEpisode && sheetSeason === currentSeason;
                          return (
                            <TouchableOpacity
                              key={ep.episode}
                              style={[styles.sheetRow, isCurrent && styles.sheetRowSelected]}
                              onPress={() => switchEpisode(sheetSeason, ep.episode)}
                            >
                              <View style={styles.epRowLeft}>
                                <Text style={styles.epNumber}>{ep.episode}</Text>
                                <Text
                                  style={[styles.sheetRowText, isCurrent && styles.sheetRowTextSelected]}
                                  numberOfLines={2}
                                >
                                  {ep.title || `Episode ${ep.episode}`}
                                </Text>
                              </View>
                              {isCurrent && <Ionicons name="play-circle" size={22} color="#e50914" />}
                            </TouchableOpacity>
                          );
                        })
                      ) : (
                        <View style={styles.sheetEmptyBox}>
                          <Ionicons name="film-outline" size={36} color="#3f3f46" />
                          <Text style={styles.sheetEmptyText}>No episodes found.</Text>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090a0f' },

  playerContainer: {
    width: '100%',
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  playerContainerFullscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 9999,
    backgroundColor: '#000',
  },

  // ── Iframe minimal top overlay ──
  iframeTopBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
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

  // Controls Overlay (Netflix Style)
  controlsOverlay: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitleBox: { flex: 1 },
  topMovieTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  topMovieSubtitle: { color: '#a1a1aa', fontSize: 11, marginTop: 1 },
  topRightIcons: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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

  // Center Controls
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  seekBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
  },
  seekBtnSub: { color: '#fff', fontSize: 11, fontWeight: '800', marginTop: 2 },
  playPauseBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(229,9,20,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#e50914',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },

  // Bottom Bar
  bottomBar: {
    paddingHorizontal: 14,
    gap: 8,
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeText: { color: '#cbd5e1', fontSize: 11, fontWeight: '600', minWidth: 42, textAlign: 'center' },
  scrubberTrack: {
    flex: 1,
    height: 20,
    justifyContent: 'center',
  },
  scrubberBg: {
    position: 'absolute',
    left: 0, right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
  },
  scrubberFill: {
    height: 3,
    backgroundColor: '#e50914',
    borderRadius: 2,
  },
  scrubberThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    top: 3,
    marginLeft: -7,
    shadowColor: '#e50914',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  bottomTray: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomTrayLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trayActionBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trayActionText: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  fullscreenToggle: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Locked State
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    gap: 8,
  },
  unlockText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Scrollable Dashboard below video in Portrait
  scrollArea: { flex: 1, backgroundColor: '#090a0f' },
  scrollContent: { padding: 16 },
  metaSection: { marginBottom: 16 },
  movieMainTitle: { color: '#fff', fontSize: 18, fontWeight: '800', lineHeight: 24 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  netflixMatchBadge: {
    backgroundColor: 'rgba(70,211,105,0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  netflixMatchText: { color: '#46d369', fontSize: 11, fontWeight: '800' },
  qualityTagBadge: {
    backgroundColor: 'rgba(229,9,20,0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.3)',
  },
  qualityTagText: { color: '#e50914', fontSize: 10, fontWeight: '800' },
  metaTagBadge: {
    backgroundColor: '#1b1d28',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  metaTagText: { color: '#94a3b8', fontSize: 10, fontWeight: '600' },

  // Quick Action Bar
  quickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#12141c',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  quickBtn: { alignItems: 'center', gap: 6 },
  quickBtnIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(229,9,20,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.25)',
  },
  quickBtnLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '600' },

  // Dashboard Sections
  dashSection: { marginBottom: 18 },
  dashSectionTitle: { color: '#71717a', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  chipsRow: { gap: 8, paddingVertical: 2 },
  audioChip: {
    backgroundColor: '#161822',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioChipActive: { backgroundColor: 'rgba(229,9,20,0.2)', borderColor: '#e50914' },
  audioChipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  audioChipTextActive: { color: '#fff', fontWeight: '800' },

  qualityChip: {
    backgroundColor: '#161822',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  qualityChipActive: { backgroundColor: 'rgba(229,9,20,0.2)', borderColor: '#e50914' },
  qualityChipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  qualityChipTextActive: { color: '#fff', fontWeight: '800' },

  serverChip: {
    backgroundColor: '#161822',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  serverChipActive: { backgroundColor: 'rgba(229,9,20,0.2)', borderColor: '#e50914' },
  serverChipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '600' },
  serverChipTextActive: { color: '#fff', fontWeight: '800' },

  // Bottom Sheet Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#12141c',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 16,
    maxHeight: '72%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 12,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  sheetHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bottomSheetTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#262938',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetList: { paddingVertical: 6 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  sheetRowSelected: { backgroundColor: 'rgba(229,9,20,0.1)' },
  sheetRowText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600', flex: 1 },
  sheetRowTextSelected: { color: '#e50914', fontWeight: '800' },
  sheetRowSub: { color: '#52525b', fontSize: 11, marginTop: 2 },

  sheetEmptyBox: { padding: 32, alignItems: 'center', gap: 10 },
  sheetEmptyText: { color: '#52525b', fontSize: 13 },

  // Season / Episode sheet
  seasonTabsScroll: { marginVertical: 12 },
  seasonTabsRow: { gap: 8, paddingHorizontal: 2 },
  seasonTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1e2030',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  seasonTabActive: { backgroundColor: '#e50914', borderColor: '#e50914' },
  seasonTabText: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  seasonTabTextActive: { color: '#fff' },

  epRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  epNumber: {
    color: '#3f3f46',
    fontSize: 13,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'right',
  },
});
