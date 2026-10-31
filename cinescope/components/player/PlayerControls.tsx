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
import { EdgeInsets } from 'react-native-safe-area-context';
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
              { paddingTop: isFullscreen ? Math.max(insets.top, 14) : 12 },
            ]}
          >
            <TouchableOpacity style={styles.iconCircleBtn} onPress={onBack} activeOpacity={0.8}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={styles.topTitleBox}>
              <Text style={styles.topMovieTitle} numberOfLines={1}>
                {title || 'Now Playing'}
              </Text>
              <Text style={styles.topMovieSubtitle} numberOfLines={1}>
                {epLabel ? `${epLabel} · ` : ''}
                {selectedDubName} · {activeStreamQuality || '1080p'}
              </Text>
            </View>

            <View style={styles.topRightIcons}>
              <TouchableOpacity
                style={styles.toolChip}
                onPress={() => {
                  onOpenBottomSheet('audio');
                  onResetTimer();
                }}
              >
                <Ionicons name="volume-high-outline" size={13} color="#fff" />
                <Text style={styles.toolChipText}> Audio</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolChip}
                onPress={() => {
                  onOpenBottomSheet('quality');
                  onResetTimer();
                }}
              >
                <Ionicons name="flash-outline" size={13} color="#fff" />
                <Text style={styles.toolChipText}> Quality</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconCircleBtn}
                onPress={() => {
                  setIsLocked(true);
                  onResetTimer();
                }}
              >
                <Ionicons name="lock-open-outline" size={17} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* CENTER CONTROLS: -10s, Play/Pause, +10s */}
          <View style={styles.centerControls} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.seekBtn}
              onPress={() => onSeekRelative(-10)}
              activeOpacity={0.7}
            >
              <Ionicons name="play-back" size={28} color="#fff" />
              <Text style={styles.seekBtnSub}>10</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playPauseBtn}
              onPress={onTogglePlayPause}
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
              onPress={() => onSeekRelative(10)}
              activeOpacity={0.7}
            >
              <Ionicons name="play-forward" size={28} color="#fff" />
              <Text style={styles.seekBtnSub}>10</Text>
            </TouchableOpacity>
          </View>

          {/* BOTTOM CONTROLS: Scrubber & Quick Tools */}
          <View
            style={[
              styles.bottomBar,
              { paddingBottom: isFullscreen ? Math.max(insets.bottom, 10) + 4 : 10 },
            ]}
          >
            {/* Scrubber Bar */}
            <View style={styles.scrubberRow}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <TouchableWithoutFeedback
                onPress={(e) => {
                  const touchX = e.nativeEvent.locationX;
                  // FIX P1 #4: measured trackWidth prevents magic number skewing
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
                  {/* FIX P4 #21: clean centering without magic top number */}
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
                  onPress={() => {
                    onOpenBottomSheet('speed');
                    onResetTimer();
                  }}
                >
                  <Ionicons
                    name="speedometer-outline"
                    size={12}
                    color="#cbd5e1"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.trayActionText}>{playbackSpeed}x</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.trayActionBtn}
                  onPress={() => {
                    onOpenBottomSheet('servers');
                    onResetTimer();
                  }}
                >
                  <Ionicons
                    name="cloud-outline"
                    size={12}
                    color="#cbd5e1"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.trayActionText}>Server</Text>
                </TouchableOpacity>

                {seasonsCount > 0 && (
                  <TouchableOpacity
                    style={styles.trayActionBtn}
                    onPress={() => {
                      onOpenBottomSheet('episodes');
                      onResetTimer();
                    }}
                  >
                    <Ionicons
                      name="list"
                      size={12}
                      color="#cbd5e1"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.trayActionText}>Episodes</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={styles.fullscreenToggle} onPress={onToggleFullscreen}>
                <Ionicons name={isFullscreen ? 'contract' : 'expand'} size={22} color="#fff" />
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
  bottomBar: {
    paddingHorizontal: 14,
    gap: 8,
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
    minWidth: 42,
    textAlign: 'center',
  },
  scrubberTrack: {
    flex: 1,
    height: 20,
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
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    top: '50%',
    marginTop: -7,
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
