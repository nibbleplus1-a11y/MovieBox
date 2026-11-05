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

interface PlayerAdModalProps {
  visible: boolean;
  mode: 'preroll' | 'postroll';
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

    if (mode === 'preroll') {
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
            return 0;
          }
          if (prev <= 3) {
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
    if (mode === 'preroll') {
      onComplete();
    } else {
      if (onClose) onClose();
      else onComplete();
    }
  };

  const handleOpenSponsor = () => {
    Linking.openURL('https://movieboxonline.net/').catch(() => {});
  };

  const widthInterpolated = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.contentCard}>
          {/* Top Tag & Countdown */}
          <View style={styles.headerRow}>
            <View style={styles.sponsoredBadge}>
              <Ionicons name="sparkles" size={12} color="#E50914" />
              <Text style={styles.sponsoredText}>
                {mode === 'preroll' ? 'SPONSORED ADVERTISEMENT' : 'SPONSORED SHOWCASE'}
              </Text>
            </View>

            {mode === 'preroll' && (
              <View style={styles.timerBadge}>
                <Ionicons name="time-outline" size={12} color="#94A3B8" />
                <Text style={styles.timerText}>
                  {secondsLeft > 0 ? `Starts in ${secondsLeft}s` : 'Ready to play'}
                </Text>
              </View>
            )}
          </View>

          {/* Progress Bar (Pre-roll only) */}
          {mode === 'preroll' && (
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
                name={mode === 'preroll' ? 'film' : 'heart'}
                size={32}
                color="#E50914"
              />
            </View>

            <View style={styles.adContent}>
              <Text style={styles.adHeadline}>
                {mode === 'preroll'
                  ? 'MovieVerse 1080p Ultra HD'
                  : 'Thanks for Watching on MovieVerse!'}
              </Text>
              <Text style={styles.adSubtext}>
                {mode === 'preroll'
                  ? `Loading high-speed cinema stream for "${title || 'Now Playing'}". Fast, ad-free streaming available with MovieVerse VIP.`
                  : 'Get the best streaming experience, fast downloads, and Dolby audio. Explore more trending hits or visit our sponsor.'}
              </Text>

              <View style={styles.perksRow}>
                <View style={styles.perkPill}>
                  <Ionicons name="flash" size={11} color="#E50914" />
                  <Text style={styles.perkText}>High Speed</Text>
                </View>
                <View style={styles.perkPill}>
                  <Ionicons name="cloud-download" size={11} color="#38BDF8" />
                  <Text style={styles.perkText}>Offline MP4</Text>
                </View>
                <View style={styles.perkPill}>
                  <Ionicons name="volume-high" size={11} color="#10B981" />
                  <Text style={styles.perkText}>Multi-Audio</Text>
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
              <Text style={styles.sponsorBtnText}>Visit Sponsor</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.skipBtn, !canSkip && styles.skipBtnDisabled]}
              onPress={handleSkipOrClose}
              disabled={!canSkip && mode === 'preroll'}
              activeOpacity={0.8}
            >
              <Text style={[styles.skipBtnText, !canSkip && styles.skipBtnTextDisabled]}>
                {mode === 'preroll'
                  ? canSkip
                    ? 'Skip Ad ›'
                    : `Skip in ${secondsLeft}s`
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
    zIndex: 9999,
  },
  contentCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0F131F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  sponsoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
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
    fontSize: 11,
    fontWeight: '600',
  },
  progressBarBg: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#E50914',
  },
  adBody: {
    padding: 18,
    alignItems: 'center',
  },
  adIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(229, 9, 20, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  adContent: {
    alignItems: 'center',
  },
  adHeadline: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  adSubtext: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  perksRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  perkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  perkText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  sponsorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  sponsorBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  skipBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  skipBtnTextDisabled: {
    color: '#64748B',
  },
});
