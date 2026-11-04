import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayerState } from '../hooks/usePlayerState';
import { PlayerWebView } from '../components/player/PlayerWebView';
import { PlayerControls } from '../components/player/PlayerControls';
import { PlayerBottomSheet } from '../components/player/PlayerBottomSheet';
import { PlayerDashboard } from '../components/player/PlayerDashboard';
import { api, MovieCard as MovieCardData } from '../services/api';

const CACHE_KEY = 'cinescope_feed_cache_v1';

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [similarMovies, setSimilarMovies] = useState<MovieCardData[]>([]);

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
        // Deduplicate
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
          onBack={handleBack}
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
            onBack={handleBack}
            onOpenBottomSheet={(type) => {
              setBottomSheet(type);
              resetControlsTimer();
            }}
            onResetTimer={resetControlsTimer}
            onTrackLayout={(w) => setTrackWidth(w)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090a0f',
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
});
