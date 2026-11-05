import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  useWindowDimensions,
  Alert,
  Text,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayerState } from '../hooks/usePlayerState';
import { PlayerWebView } from '../components/player/PlayerWebView';
import { PlayerControls } from '../components/player/PlayerControls';
import { PlayerBottomSheet } from '../components/player/PlayerBottomSheet';
import { PlayerDashboard } from '../components/player/PlayerDashboard';
import { PlayerAdModal } from '../components/ads/PlayerAdModal';
import { api, MovieCard as MovieCardData } from '../services/api';
import { downloadStream } from '../services/downloadService';

const CACHE_KEY = 'movieverse_feed_cache_v2';

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { width: screenWidth } = useWindowDimensions();

  const [similarMovies, setSimilarMovies] = useState<MovieCardData[]>([]);
  const [showPrerollAd, setShowPrerollAd] = useState<boolean>(true);
  const [showPostrollAd, setShowPostrollAd] = useState<boolean>(false);

  // Download state
  const [showDownloadAd, setShowDownloadAd] = useState<boolean>(false);
  const [pendingDownload, setPendingDownload] = useState<{ url: string; filename: string } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadingFilename, setDownloadingFilename] = useState<string>('');

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

  const onSelectMovie = (m: MovieCardData) => {
    navigation.replace('Player', {
      id: m.subject_id,
      title: m.title,
      cover: m.cover,
      type: m.type || (isSeriesType ? 'TV Series' : 'Movie'),
    });
  };

  /**
   * Step 1: User taps download — show pre-download ad first.
   */
  const handleDownloadCurrent = () => {
    if (!activeStream?.url) {
      Alert.alert('Download', 'Stream is preparing. Please try again in a moment.');
      return;
    }
    const cleanName = (title || streamData?.title || 'Movie').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const epTag = currentSeason > 0 ? `_S${currentSeason}E${currentEpisode}` : '';
    const filename = `${cleanName}${epTag}.mp4`;
    const dlUrl =
      api.proxyUrl(activeStream.url, activeStream.headers?.Referer) +
      `&download=true&filename=${encodeURIComponent(filename)}`;

    // Save pending download and show ad first
    setPendingDownload({ url: dlUrl, filename });
    setShowDownloadAd(true);
  };

  /**
   * Step 2: Ad dismissed → start actual download.
   */
  const onDownloadAdComplete = () => {
    setShowDownloadAd(false);
    if (!pendingDownload) return;
    const { url, filename } = pendingDownload;
    setPendingDownload(null);

    setIsDownloading(true);
    setDownloadingFilename(filename);
    setDownloadProgress(0);

    downloadStream({
      url,
      filename,
      onProgress: (p) => setDownloadProgress(p),
      onComplete: (localUri) => {
        setIsDownloading(false);
        setDownloadProgress(0);
        Alert.alert(
          '✅ Download Complete',
          `"${filename}" has been saved to your device in the MovieVerse folder.`,
          [{ text: 'OK' }],
        );
      },
      onError: (err) => {
        setIsDownloading(false);
        setDownloadProgress(0);
        Alert.alert('Download Failed', err || 'Could not download the file. Please try again.');
      },
    });
  };

  const triggerExitWithAd = () => {
    setShowPostrollAd(true);
  };

  const onCompletePostroll = () => {
    setShowPostrollAd(false);
    handleBack();
  };

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
          onRetry={() => loadStreams(currentId, currentSeason, currentEpisode)}
          onBack={triggerExitWithAd}
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
            onBack={triggerExitWithAd}
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
        onComplete={() => setShowPrerollAd(false)}
      />

      {/* PRE-DOWNLOAD AD MODAL (Before Download Starts) */}
      <PlayerAdModal
        visible={showDownloadAd}
        mode="preroll"
        title={`Downloading: ${pendingDownload?.filename || ''}`}
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

      {/* IN-APP DOWNLOAD PROGRESS OVERLAY */}
      {isDownloading && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.dlOverlay}>
            <View style={styles.dlCard}>
              <ActivityIndicator size="large" color="#E50914" style={{ marginBottom: 12 }} />
              <Text style={styles.dlTitle}>Downloading…</Text>
              <Text style={styles.dlFilename} numberOfLines={2}>
                {downloadingFilename}
              </Text>
              <View style={styles.dlBarBg}>
                <View style={[styles.dlBarFill, { width: `${Math.round(downloadProgress * 100)}%` }]} />
              </View>
              <Text style={styles.dlPercent}>{Math.round(downloadProgress * 100)}%</Text>
              <Text style={styles.dlHint}>File will be saved to the MovieVerse folder on your device.</Text>
            </View>
          </View>
        </Modal>
      )}
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
