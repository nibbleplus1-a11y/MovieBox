import React from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerState } from '../hooks/usePlayerState';
import { PlayerWebView } from '../components/player/PlayerWebView';
import { PlayerControls } from '../components/player/PlayerControls';
import { PlayerBottomSheet } from '../components/player/PlayerBottomSheet';
import { PlayerDashboard } from '../components/player/PlayerDashboard';

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

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
    toggleControls,
    toggleFullscreen,
    resetControlsTimer,
    handleWebViewMessage,
    handleBack,
  } = usePlayerState();

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
          onOpenBottomSheet={(type) => setBottomSheet(type)}
          onSwitchDub={switchDub}
          onSwitchQuality={switchQuality}
          onSwitchServer={switchServer}
        />
      )}

      {/* BOTTOM SHEET MODAL */}
      <PlayerBottomSheet
        bottomSheet={bottomSheet}
        insets={insets}
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
        onClose={() => setBottomSheet('none')}
        onSwitchDub={switchDub}
        onSwitchQuality={switchQuality}
        onChangeSpeed={changeSpeed}
        onSwitchServer={switchServer}
        onSwitchEpisode={switchEpisode}
        onSetSheetSeason={setSheetSeason}
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
