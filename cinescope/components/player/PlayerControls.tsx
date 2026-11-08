import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { BottomSheetType } from '../../hooks/usePlayerState';

interface PlayerControlsProps {
  controlsVisible: boolean;
  fadeAnim: Animated.Value;
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
  isFullscreen: boolean;
  insets: EdgeInsets;
  title?: string;
  epLabel?: string | null;
  selectedDubName: string;
  activeStreamQuality?: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progressRatio: number;
  trackWidth: number;
  playbackSpeed: number;
  seasonsCount: number;
  formatTime: (sec: number) => string;
  onTogglePlayPause: () => void;
  onSeekRelative: (delta: number) => void;
  onSeekAbsolute: (percentage: number) => void;
  onToggleFullscreen: () => void;
  onBack: () => void;
  onOpenBottomSheet: (type: BottomSheetType) => void;
  onResetTimer: () => void;
  onTrackLayout: (width: number) => void;
  onDownload?: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  controlsVisible,
  fadeAnim,
  isLocked,
  setIsLocked,
  isFullscreen,
  insets,
  title,
  epLabel,
  selectedDubName,
  activeStreamQuality,
  isPlaying,
  currentTime,
  duration,
  progressRatio,
  trackWidth,
  playbackSpeed,
  seasonsCount,
  formatTime,
  onTogglePlayPause,
  onSeekRelative,
  onSeekAbsolute,
  onToggleFullscreen,
  onBack,
  onOpenBottomSheet,
  onResetTimer,
  onTrackLayout,
  onDownload,
}) => {
  if (!controlsVisible) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.controlsOverlay, { opacity: fadeAnim }]}
      pointerEvents="box-none"
    >
      {/* Screen Lock Mode */}
      {isLocked ? (
        <View style={styles.lockedContainer}>
          <TouchableOpacity
            style={styles.unlockBtn}
            onPress={() => {
              setIsLocked(false);
              onResetTimer();
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="lock-closed" size={18} color="#fff" />
            <Text style={styles.unlockText}>Screen Locked · Tap to Unlock</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* TOP BAR */}
          <View
            style={[
              styles.topBar,
              { paddingTop: isFullscreen ? Math.max(insets.top, 14) : 8 },
            ]}
          >
            <TouchableOpacity
              style={[styles.iconCircleBtn, !isFullscreen && styles.iconCircleBtnCompact]}
              onPress={onBack}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={isFullscreen ? 22 : 18} color="#fff" />
            </TouchableOpacity>

            <View style={styles.topTitleBox}>
              <Text style={[styles.topMovieTitle, !isFullscreen && styles.topMovieTitleCompact]} numberOfLines={1}>
                {title || 'Now Playing'}
              </Text>
              <Text style={[styles.topMovieSubtitle, !isFullscreen && styles.topMovieSubtitleCompact]} numberOfLines={1}>
                {epLabel ? `${epLabel} · ` : ''}
                {selectedDubName} · {activeStreamQuality || '1080p'}
              </Text>
            </View>

            <View style={[styles.topRightIcons, !isFullscreen && styles.topRightIconsCompact]}>
              <TouchableOpacity
                style={[styles.toolChip, !isFullscreen && styles.toolChipCompact]}
                onPress={() => {
                  onOpenBottomSheet('audio');
                  onResetTimer();
                }}
              >
                <Ionicons name="volume-high-outline" size={isFullscreen ? 13 : 11} color="#fff" />
                <Text style={[styles.toolChipText, !isFullscreen && styles.toolChipTextCompact]}> Audio</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolChip, !isFullscreen && styles.toolChipCompact]}
                onPress={() => {
                  onOpenBottomSheet('quality');
                  onResetTimer();
                }}
              >
                <Ionicons name="flash-outline" size={isFullscreen ? 13 : 11} color="#fff" />
                <Text style={[styles.toolChipText, !isFullscreen && styles.toolChipTextCompact]}> Quality</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toolChip, !isFullscreen && styles.toolChipCompact]}
                onPress={() => {
                  onOpenBottomSheet('subtitles');
                  onResetTimer();
                }}
              >
                <Ionicons name="chatbox-ellipses-outline" size={isFullscreen ? 13 : 11} color="#fff" />
                <Text style={[styles.toolChipText, !isFullscreen && styles.toolChipTextCompact]}> Subs</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.iconCircleBtn, !isFullscreen && styles.iconCircleBtnCompact]}
                onPress={() => {
                  setIsLocked(true);
                  onResetTimer();
                }}
              >
                <Ionicons name="lock-open-outline" size={isFullscreen ? 17 : 14} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* CENTER CONTROLS: -10s, Play/Pause, +10s */}
          <View
            style={[
              styles.centerControls,
              !isFullscreen && styles.centerControlsCompact,
            ]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={[styles.seekBtn, !isFullscreen && styles.seekBtnCompact]}
              onPress={() => onSeekRelative(-10)}
              activeOpacity={0.7}
            >
              <Ionicons name="play-back" size={isFullscreen ? 28 : 20} color="#fff" />
              <Text style={[styles.seekBtnSub, !isFullscreen && styles.seekBtnSubCompact]}>10</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.playPauseBtn, !isFullscreen && styles.playPauseBtnCompact]}
              onPress={onTogglePlayPause}
              activeOpacity={0.85}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={isFullscreen ? 28 : 20}
                color="#fff"
                style={{ marginLeft: isPlaying ? 0 : 2 }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.seekBtn, !isFullscreen && styles.seekBtnCompact]}
              onPress={() => onSeekRelative(10)}
              activeOpacity={0.7}
            >
              <Ionicons name="play-forward" size={isFullscreen ? 28 : 20} color="#fff" />
              <Text style={[styles.seekBtnSub, !isFullscreen && styles.seekBtnSubCompact]}>10</Text>
            </TouchableOpacity>
          </View>

          {/* BOTTOM CONTROLS: Scrubber & Quick Tools */}
          <View
            style={[
              styles.bottomBar,
              { paddingBottom: isFullscreen ? Math.max(insets.bottom, 10) + 4 : 8 },
            ]}
          >
            {/* Scrubber Bar */}
            <View style={styles.scrubberRow}>
              <Text style={[styles.timeText, !isFullscreen && styles.timeTextCompact]}>{formatTime(currentTime)}</Text>
              <TouchableWithoutFeedback
                onPress={(e) => {
                  const touchX = e.nativeEvent.locationX;
                  const effectiveWidth = Math.max(1, trackWidth);
                  onSeekAbsolute(touchX / effectiveWidth);
                }}
              >
                <View
                  style={styles.scrubberTrack}
                  onLayout={(e) => onTrackLayout(e.nativeEvent.layout.width)}
                >
                  <View style={styles.scrubberBg} />
                  <View style={[styles.scrubberFill, { width: `${progressRatio * 100}%` }]} />
                  <View style={[styles.scrubberThumb, { left: `${progressRatio * 100}%` }]} />
                </View>
              </TouchableWithoutFeedback>
              <Text style={[styles.timeText, !isFullscreen && styles.timeTextCompact]}>{formatTime(duration)}</Text>
            </View>

            {/* Feature Tray */}
            <View style={styles.bottomTray}>
              <View style={styles.bottomTrayLeft}>
                <TouchableOpacity
                  style={[styles.trayActionBtn, !isFullscreen && styles.trayActionBtnCompact]}
                  onPress={() => {
                    onOpenBottomSheet('speed');
                    onResetTimer();
                  }}
                >
                  <Ionicons
                    name="speedometer-outline"
                    size={isFullscreen ? 12 : 10}
                    color="#cbd5e1"
                    style={{ marginRight: 3 }}
                  />
                  <Text style={[styles.trayActionText, !isFullscreen && styles.trayActionTextCompact]}>{playbackSpeed}x</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.trayActionBtn, !isFullscreen && styles.trayActionBtnCompact]}
                  onPress={() => {
                    onOpenBottomSheet('servers');
                    onResetTimer();
                  }}
                >
                  <Ionicons
                    name="cloud-outline"
                    size={isFullscreen ? 12 : 10}
                    color="#cbd5e1"
                    style={{ marginRight: 3 }}
                  />
                  <Text style={[styles.trayActionText, !isFullscreen && styles.trayActionTextCompact]}>Server</Text>
                </TouchableOpacity>

                {seasonsCount > 0 && (
                  <TouchableOpacity
                    style={[styles.trayActionBtn, !isFullscreen && styles.trayActionBtnCompact]}
                    onPress={() => {
                      onOpenBottomSheet('episodes');
                      onResetTimer();
                    }}
                  >
                    <Ionicons
                      name="list"
                      size={isFullscreen ? 12 : 10}
                      color="#cbd5e1"
                      style={{ marginRight: 3 }}
                    />
                    <Text style={[styles.trayActionText, !isFullscreen && styles.trayActionTextCompact]}>Episodes</Text>
                  </TouchableOpacity>
                )}

                {onDownload && (
                  <TouchableOpacity
                    style={[styles.trayActionBtn, !isFullscreen && styles.trayActionBtnCompact]}
                    onPress={() => {
                      onDownload();
                      onResetTimer();
                    }}
                  >
                    <Ionicons
                      name="cloud-download-outline"
                      size={isFullscreen ? 12 : 10}
                      color="#38bdf8"
                      style={{ marginRight: 3 }}
                    />
                    <Text style={[styles.trayActionText, !isFullscreen && styles.trayActionTextCompact, { color: '#38bdf8' }]}>
                      {isFullscreen ? 'Download' : 'DL'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={styles.fullscreenToggle} onPress={onToggleFullscreen}>
                <Ionicons name={isFullscreen ? 'contract' : 'expand'} size={isFullscreen ? 22 : 18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  controlsOverlay: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleBtnCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  topTitleBox: { flex: 1 },
  topMovieTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  topMovieTitleCompact: { fontSize: 11 },
  topMovieSubtitle: { color: '#a1a1aa', fontSize: 11, marginTop: 1 },
  topMovieSubtitleCompact: { fontSize: 9 },
  topRightIcons: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topRightIconsCompact: { gap: 4 },
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
  toolChipCompact: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 4,
  },
  toolChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  toolChipTextCompact: { fontSize: 9 },
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  centerControlsCompact: {
    gap: 20,
  },
  seekBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
  },
  seekBtnCompact: {
    width: 36,
    height: 36,
  },
  seekBtnSub: { color: '#fff', fontSize: 11, fontWeight: '800', marginTop: 2 },
  seekBtnSubCompact: { fontSize: 9, marginTop: 0 },
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
  playPauseBtnCompact: {
    width: 44,
    height: 44,
    borderRadius: 22,
    elevation: 4,
  },
  bottomBar: {
    paddingHorizontal: 12,
    gap: 6,
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    minWidth: 42,
    textAlign: 'center',
  },
  timeTextCompact: {
    fontSize: 9,
    minWidth: 34,
  },
  scrubberTrack: {
    flex: 1,
    height: 18,
    justifyContent: 'center',
    position: 'relative',
  },
  scrubberBg: {
    position: 'absolute',
    left: 0,
    right: 0,
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
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    top: '50%',
    marginTop: -6,
    marginLeft: -6,
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
  bottomTrayLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trayActionBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trayActionBtnCompact: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trayActionText: { color: '#cbd5e1', fontSize: 11, fontWeight: '600' },
  trayActionTextCompact: { fontSize: 9 },
  fullscreenToggle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
});
