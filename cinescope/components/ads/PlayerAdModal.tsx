import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Linking,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

const ADSTERRA_DIRECT = 'https://asiafilm.org/4/c59f31c3db10b336a8c574304c2e9b41';
const MONETAG_DIRECT = 'https://uplcm.com/4/12213398';

interface PlayerAdModalProps {
  visible: boolean;
  mode: 'preroll' | 'postroll' | 'download';
  title?: string;
  onComplete: () => void;
  onClose?: () => void;
}

export const PlayerAdModal: React.FC<PlayerAdModalProps> = ({
  visible,
  mode,
  title,
  onComplete,
  onClose,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [canSkip, setCanSkip] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    if (mode === 'preroll' || mode === 'download') {
      setSecondsLeft(5);
      setCanSkip(false);
      progressAnim.setValue(0);

      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 5000,
        useNativeDriver: false,
      }).start();

      const timer = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanSkip(true);
            if (mode === 'download') {
              // Auto-trigger download on timer finish
              setTimeout(() => {
                onComplete();
              }, 400);
            }
            return 0;
          }
          if (prev <= 2) {
            setCanSkip(true);
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(timer);
      };
    } else {
      setCanSkip(true);
    }
  }, [visible, mode]);

  if (!visible) return null;

  const handleSkipOrClose = () => {
    if (mode === 'preroll' || mode === 'download') {
      onComplete();
    } else {
      if (onClose) onClose();
      else onComplete();
    }
  };

  const handleOpenSponsor = () => {
    const targetUrl = mode === 'download' ? MONETAG_DIRECT : ADSTERRA_DIRECT;
    Linking.openURL(targetUrl).catch(() => {});
  };

  const widthInterpolated = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const getBadgeText = () => {
    if (mode === 'download') return 'SPONSORED DOWNLOAD GATEWAY';
    if (mode === 'preroll') return 'SPONSORED PRE-ROLL';
    return 'SPONSORED SHOWCASE';
  };

  const getHeadline = () => {
    if (mode === 'download') return 'Free 1080p Download Unlocked';
    if (mode === 'preroll') return 'MovieVerse Ultra HD Stream';
    return 'Thanks for Watching on MovieVerse!';
  };

  const getSubtext = () => {
    if (mode === 'download') {
      return `High-speed cinema download for "${title || 'your video'}" is sponsored by our ad partners. Tap below to support or download will begin automatically.`;
    }
    if (mode === 'preroll') {
      return `Loading high-speed cinema stream for "${title || 'Now Playing'}". Fast, ad-free streaming available with MovieVerse VIP.`;
    }
    return 'Get the best streaming experience, fast downloads, and Dolby audio. Explore more trending hits or visit our sponsor.';
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.contentCard}>
          {/* Top Tag & Countdown */}
          <View style={styles.headerRow}>
            <View style={styles.sponsoredBadge}>
              <Ionicons name="sparkles" size={12} color="#E50914" />
              <Text style={styles.sponsoredText}>{getBadgeText()}</Text>
            </View>

            {(mode === 'preroll' || mode === 'download') && (
              <View style={styles.timerBadge}>
                <Ionicons name="time-outline" size={12} color="#94A3B8" />
                <Text style={styles.timerText}>
                  {secondsLeft > 0
                    ? mode === 'download'
                      ? `Starts in ${secondsLeft}s`
                      : `Skip in ${secondsLeft}s`
                    : 'Ready'}
                </Text>
              </View>
            )}
          </View>

          {/* Progress Bar (Pre-roll & Download) */}
          {(mode === 'preroll' || mode === 'download') && (
            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, { width: widthInterpolated }]} />
            </View>
          )}

          {/* Ad Creative Card */}
          <LinearGradient
            colors={['#161B29', '#0E121E']}
            style={styles.adBody}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.adIconCircle}>
              <Ionicons
                name={mode === 'download' ? 'cloud-download' : mode === 'preroll' ? 'film' : 'heart'}
                size={32}
                color="#E50914"
              />
            </View>

            <View style={styles.adContent}>
              <Text style={styles.adHeadline}>{getHeadline()}</Text>
              <Text style={styles.adSubtext}>{getSubtext()}</Text>

              <View style={styles.perksRow}>
                <View style={styles.perkPill}>
                  <Ionicons name="flash" size={11} color="#E50914" />
                  <Text style={styles.perkText}>High Speed</Text>
                </View>
                <View style={styles.perkPill}>
                  <Ionicons name="cloud-download" size={11} color="#38BDF8" />
                  <Text style={styles.perkText}>Direct MP4</Text>
                </View>
                <View style={styles.perkPill}>
                  <Ionicons name="shield-checkmark" size={11} color="#10B981" />
                  <Text style={styles.perkText}>Safe & Verified</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Action Footer */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.sponsorBtn}
              onPress={handleOpenSponsor}
              activeOpacity={0.8}
            >
              <Ionicons name="open-outline" size={15} color="#fff" />
              <Text style={styles.sponsorBtnText}>
                {mode === 'download' ? 'Visit Sponsor Offer ↗' : 'Visit Sponsor ↗'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.skipBtn, !canSkip && styles.skipBtnDisabled]}
              onPress={handleSkipOrClose}
              disabled={!canSkip && (mode === 'preroll' || mode === 'download')}
              activeOpacity={0.8}
            >
              <Text style={styles.skipBtnText}>
                {mode === 'download'
                  ? canSkip
                    ? 'Start Download ›'
                    : `Wait ${secondsLeft}s`
                  : mode === 'preroll'
                  ? canSkip
                    ? 'Skip Ad ›'
                    : `Wait ${secondsLeft}s`
                  : 'Close & Exit'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  sponsoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.25)',
    gap: 4,
  },
  sponsoredText: {
    color: '#E50914',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarBg: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#E50914',
  },
  adBody: {
    padding: 20,
    alignItems: 'center',
  },
  adIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  adContent: {
    alignItems: 'center',
  },
  adHeadline: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  adSubtext: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  perksRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  perkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  perkText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    padding: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  sponsorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 6,
  },
  sponsorBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  skipBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#E50914',
  },
  skipBtnDisabled: {
    opacity: 0.5,
  },
  skipBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
