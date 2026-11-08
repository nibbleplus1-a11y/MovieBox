import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  useWindowDimensions,
  Alert,
  BackHandler,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayerState } from '../hooks/usePlayerState';
import { PlayerWebView } from '../components/player/PlayerWebView';
import { PlayerControls } from '../components/player/PlayerControls';
import { PlayerBottomSheet } from '../components/player/PlayerBottomSheet';
import { PlayerDashboard } from '../components/player/PlayerDashboard';
import { PlayerAdModal } from '../components/ads/PlayerAdModal';
import { api, MovieCard as MovieCardData } from '../services/api';
import { downloadManager } from '../services/downloadService';
import { DownloadFloatingBar } from '../components/downloads/DownloadFloatingBar';

const CACHE_KEY = 'movieverse_feed_cache_v2';

export default function PlayerScreen() {
  const insets    = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { width: screenWidth } = useWindowDimensions();
  // Debounce back-press to prevent accidental double-tap app close
  const lastBackPressRef = useRef<number>(0);

  const [similarMovies, setSimilarMovies] = useState<MovieCardData[]>([]);
  const [showPrerollAd, setShowPrerollAd] = useState<boolean>(false);
  const [prerollShown, setPrerollShown] = useState<boolean>(false);
  const [showPostrollAd, setShowPostrollAd] = useState<boolean>(false);


  // Download state
  const [showDownloadAd, setShowDownloadAd] = useState<boolean>(false);
  const [pendingDownload, setPendingDownload] = useState<any | null>(null);

  const {
    title,
    isSeriesType,
    currentId,
    currentSeason,
    currentEpisode,
    streamData,
    activeStream,
    selectedServer,
    streamUrl,
    useIframe,
    iframeServerName,
    loading,
    error,
    isPlaying,
    currentTime,
    duration,
    isBuffering,
    playbackSpeed,
    selectedDubName,
    controlsVisible,
    isLocked,
    setIsLocked,
    isFullscreen,
    bottomSheet,
    setBottomSheet,
    seasonsData,
    sheetSeason,
    setSheetSeason,
    trackWidth,
    setTrackWidth,
    webViewRef,
    fadeAnim,
    epLabel,
    playableStreams,
    dubsList,
    fallbackServers,
    progressRatio,
    sheetSeasonEpisodes,
    subtitlesList,
    activeSubtitle,
    isSearchingOnlineSubs,
    loadStreams,
    formatTime,
    togglePlayPause,
    seekRelative,
    seekAbsolute,
    changeSpeed,
    switchQuality,
    switchDub,
    switchServer,
    switchEpisode,
    searchOnlineSubs,
    selectSubtitle,
    toggleControls,
    toggleFullscreen,
    resetControlsTimer,
    handleWebViewMessage,
    handleBack,
    sendVideoCommand,
  } = usePlayerState();

  // Load Similar Movies for Recommendation Shelf
  useEffect(() => {
    let isMounted = true;
    const loadSimilar = async () => {
      try {
        let feedData: any = null;
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          try { feedData = JSON.parse(cached); } catch {}
        }
        if (!feedData) {
          feedData = await api.feed().catch(() => null);
        }
        if (!feedData || !isMounted) return;

        let pool: MovieCardData[] = [];
        if (isSeriesType) {
          pool = [...(feedData.series || []), ...(feedData.asian_drama || []), ...(feedData.trending || [])];
        } else {
          pool = [...(feedData.trending || []), ...(feedData.cinema || []), ...(feedData.hollywood || []), ...(feedData.top_rated || [])];
        }

        const filtered = pool.filter(m => m.subject_id !== currentId);
        const seen = new Set<string>();
        const unique: MovieCardData[] = [];
        for (const item of filtered) {
          if (!seen.has(item.subject_id)) {
            seen.add(item.subject_id);
            unique.push(item);
          }
          if (unique.length >= 12) break;
        }

        if (isMounted) setSimilarMovies(unique);
      } catch {}
    };

    loadSimilar();
    return () => { isMounted = false; };
  }, [currentId, isSeriesType]);

  // ── Trigger preroll interstitial once when stream URL first becomes ready ───
  useEffect(() => {
    if (streamUrl && !loading && !error && !prerollShown) {
      setPrerollShown(true);
      setShowPrerollAd(true);
      sendVideoCommand('if(window.videoEl){ window.videoEl.pause(); }');
    }
  }, [streamUrl, loading, error]);

  const onCompletePreroll = () => {
    setShowPrerollAd(false);
    sendVideoCommand('if(window.videoEl){ window.videoEl.muted = false; window.videoEl.play(); }');
  };

  // Reset preroll gate ONLY when user switches episode (not audio/dub)
  useEffect(() => {
    setPrerollShown(false);
  }, [currentSeason, currentEpisode]);

  const onSelectMovie = (m: MovieCardData) => {
    navigation.replace('Player', {
      id: m.subject_id,
      title: m.title,
      cover: m.cover,
      type: m.type || (isSeriesType ? 'TV Series' : 'Movie'),
    });
  };

  /**
   * Step 1: User taps download — check 3-in-1 ad quota first.
   */
  const handleDownloadCurrent = async () => {
    if (!activeStream?.url) {
      Alert.alert('Download', 'Stream is preparing. Please try again in a moment.');
      return;
    }
    const movieTitle = title || streamData?.title || 'Movie';
    const cleanName = movieTitle.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const epTag = currentSeason > 0 ? `_S${currentSeason}E${currentEpisode}` : '';
    const filename = `${cleanName}${epTag}.mp4`;
    const episodeTitle = currentSeason > 0 ? `Season ${currentSeason} • Episode ${currentEpisode}` : undefined;
    const dlUrl =
      api.proxyUrl(activeStream.url, activeStream.headers?.Referer) +
      `&download=true&filename=${encodeURIComponent(filename)}`;

    const downloadParams = {
      url: dlUrl,
      filename,
      title: movieTitle,
      poster: (route.params as any)?.cover || (route.params as any)?.poster,
      episodeTitle,
      season: currentSeason,
      episode: currentEpisode,
    };

    // If quota available, download IMMEDIATELY without showing any ad!
    if (downloadManager.hasQuota()) {
      await downloadManager.consumeQuota();
      await downloadManager.startDownload(downloadParams);
      const remaining = downloadManager.getQuota();
      Alert.alert(
        'Download Started 📥',
        `"${movieTitle}" is downloading in the background.\n(${remaining} ad-free download${remaining === 1 ? '' : 's'} remaining)`,
        [
          { text: 'OK' },
          {
            text: 'View Downloads',
            onPress: () => {
              if (isFullscreen) toggleFullscreen();
              navigation.navigate('Main', { screen: 'Downloads' });
            },
          },
        ]
      );
    } else {
      // Save pending download and show ad first to unlock 3 downloads
      setPendingDownload(downloadParams);
      setShowDownloadAd(true);
    }
  };

  /**
   * Step 2: Ad dismissed → grant 3 downloads and start background non-blocking download.
   */
  const onDownloadAdComplete = async () => {
    setShowDownloadAd(false);
    if (!pendingDownload) return;
    const item = pendingDownload;
    setPendingDownload(null);

    await downloadManager.grantQuota(3);
    await downloadManager.consumeQuota();

    downloadManager
      .startDownload(item)
      .then(() => {
        Alert.alert(
          'Unlocked & Downloading! 🎉',
          `3 downloads unlocked! "${item.title}" is downloading.\nYou have 2 ad-free downloads left!`,
          [
            { text: 'OK' },
            {
              text: 'View Downloads',
              onPress: () => {
                if (isFullscreen) toggleFullscreen();
                navigation.navigate('Main', { screen: 'Downloads' });
              },
            },
          ]
        );
      })
      .catch((err: any) => {
        Alert.alert('Download Failed', err?.message || 'Could not start download.');
      });
  };

  const handleBackAction = () => {
    if (isFullscreen) {
      toggleFullscreen();
      return;
    }
    triggerExitWithAd();
  };

  const triggerExitWithAd = () => {
    sendVideoCommand('if(window.videoEl){ window.videoEl.pause(); }');
    setShowPostrollAd(true);
  };

  const onCompletePostroll = () => {
    setShowPostrollAd(false);
    handleBack();
  };

  // Android hardware back handler: toggle fullscreen or show exit ad
  useEffect(() => {
    const onBackPress = () => {
      const now = Date.now();
      // Debounce: ignore rapid successive back presses (< 300ms)
      if (now - lastBackPressRef.current < 300) return true;
      lastBackPressRef.current = now;

      if (showPostrollAd) {
        onCompletePostroll();
        return true;
      }
      if (showPrerollAd) {
        onCompletePreroll();
        return true;
      }
      if (showDownloadAd) {
        setShowDownloadAd(false);
        return true;
      }
      if (bottomSheet !== 'none') {
        setBottomSheet('none');
        return true;
      }
      if (isFullscreen) {
        toggleFullscreen();
        return true;
      }
      triggerExitWithAd();
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [showPostrollAd, showPrerollAd, showDownloadAd, isFullscreen, bottomSheet]);

  const playerContainerStyle = isFullscreen
    ? styles.playerContainerFullscreen
    : { height: (screenWidth * 9) / 16, width: '100%' };

  return (
    <View style={styles.container}>
      <StatusBar hidden={isFullscreen} style="light" />

      {/* VIDEO PLAYER VIEWPORT */}
      <View style={[styles.playerContainer, playerContainerStyle]}>
        <PlayerWebView
          streamUrl={streamUrl}
          useIframe={useIframe}
          iframeServerName={iframeServerName}
          loading={loading}
          error={error}
          isBuffering={isBuffering}
          isFullscreen={isFullscreen}
          insets={insets}
          epLabel={epLabel}
          seasonsCount={seasonsData.length}
          webViewRef={webViewRef}
          currentTime={currentTime}
          activeSubtitleUrl={activeSubtitle?.url}
          activeSubtitleLang={activeSubtitle?.language}
          onRetry={() => loadStreams(currentId, currentSeason, currentEpisode)}
          onBack={handleBackAction}
          onToggleFullscreen={toggleFullscreen}
          onOpenBottomSheet={(type) => {
            setBottomSheet(type);
            resetControlsTimer();
          }}
          onMessage={handleWebViewMessage}
        />

        {/* GESTURE TOUCH LAYER FOR TOGGLING CONTROLS */}
        {!useIframe && !loading && !error && (
          <TouchableWithoutFeedback onPress={toggleControls}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        )}

        {/* OVERLAY CONTROLS */}
        {!useIframe && !loading && !error && (
          <PlayerControls
            controlsVisible={controlsVisible}
            fadeAnim={fadeAnim}
            isLocked={isLocked}
            setIsLocked={setIsLocked}
            isFullscreen={isFullscreen}
            insets={insets}
            title={title || streamData?.title}
            epLabel={epLabel}
            selectedDubName={selectedDubName}
            activeStreamQuality={activeStream?.quality}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            progressRatio={progressRatio}
            trackWidth={trackWidth}
            playbackSpeed={playbackSpeed}
            seasonsCount={seasonsData.length}
            formatTime={formatTime}
            onTogglePlayPause={togglePlayPause}
            onSeekRelative={seekRelative}
            onSeekAbsolute={seekAbsolute}
            onToggleFullscreen={toggleFullscreen}
            onBack={handleBackAction}
            onOpenBottomSheet={(type) => {
              setBottomSheet(type);
              resetControlsTimer();
            }}
            onResetTimer={resetControlsTimer}
            onTrackLayout={(w) => setTrackWidth(w)}
            onDownload={handleDownloadCurrent}
          />
        )}
      </View>

      {/* PORTRAIT DASHBOARD & RECOMMENDATIONS */}
      {!isFullscreen && (
        <PlayerDashboard
          title={title || streamData?.title}
          isSeriesType={isSeriesType}
          selectedDubName={selectedDubName}
          activeStream={activeStream}
          playbackSpeed={playbackSpeed}
          seasonsCount={seasonsData.length}
          dubsList={dubsList}
          currentId={currentId}
          playableStreams={playableStreams}
          fallbackServers={fallbackServers}
          useIframe={useIframe}
          selectedServer={selectedServer}
          similarMovies={similarMovies}
          onOpenBottomSheet={(type) => setBottomSheet(type)}
          onSwitchDub={switchDub}
          onSwitchQuality={switchQuality}
          onSwitchServer={switchServer}
          onSelectMovie={onSelectMovie}
        />
      )}

      {/* BOTTOM SHEET MODAL */}
      <PlayerBottomSheet
        bottomSheet={bottomSheet}
        insets={insets}
        isFullscreen={isFullscreen}
        dubsList={dubsList}
        currentId={currentId}
        playableStreams={playableStreams}
        activeStream={activeStream}
        useIframe={useIframe}
        selectedServer={selectedServer}
        fallbackServers={fallbackServers}
        playbackSpeed={playbackSpeed}
        seasonsData={seasonsData}
        sheetSeason={sheetSeason}
        currentSeason={currentSeason}
        currentEpisode={currentEpisode}
        sheetSeasonEpisodes={sheetSeasonEpisodes}
        subtitlesList={subtitlesList}
        activeSubtitle={activeSubtitle}
        isSearchingOnlineSubs={isSearchingOnlineSubs}
        onClose={() => setBottomSheet('none')}
        onSwitchDub={switchDub}
        onSwitchQuality={switchQuality}
        onChangeSpeed={changeSpeed}
        onSwitchServer={switchServer}
        onSwitchEpisode={switchEpisode}
        onSetSheetSeason={setSheetSeason}
        onSelectSubtitle={selectSubtitle}
        onSearchOnlineSubs={searchOnlineSubs}
      />

      {/* PRE-ROLL AD MODAL (Before Movie Starts) */}
      <PlayerAdModal
        visible={showPrerollAd}
        mode="preroll"
        title={title || streamData?.title}
        onComplete={onCompletePreroll}
      />

      {/* PRE-DOWNLOAD AD MODAL (Before Download Starts) */}
      <PlayerAdModal
        visible={showDownloadAd}
        mode="download"
        title={pendingDownload?.filename || title || ''}
        onComplete={onDownloadAdComplete}
      />

      {/* POST-ROLL AD MODAL (After Closing Player) */}
      <PlayerAdModal
        visible={showPostrollAd}
        mode="postroll"
        title={title || streamData?.title}
        onComplete={onCompletePostroll}
        onClose={onCompletePostroll}
      />

      {/* NON-BLOCKING BACKGROUND DOWNLOAD FLOATING INDICATOR (Hidden in Fullscreen) */}
      {!isFullscreen && <DownloadFloatingBar bottomOffset={insets.bottom + 16} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080B',
  },
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
  dlOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dlCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F131F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 24,
    alignItems: 'center',
  },
  dlTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  dlFilename: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  dlBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  dlBarFill: {
    height: '100%',
    backgroundColor: '#E50914',
    borderRadius: 3,
  },
  dlPercent: {
    color: '#E50914',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  dlHint: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
  },
});
