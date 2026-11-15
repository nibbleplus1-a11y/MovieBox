import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../../config';

interface PlayerAdModalProps {
  visible: boolean;
  mode?: 'preroll' | 'postroll' | 'download';
  title?: string;
  onComplete: () => void;
  onClose?: () => void;
}

const AD_COOLDOWN_MS = 15 * 60 * 1000; // Show at most once every 15 minutes
const MONETAG_SPONSOR_URL = 'https://monetag.com';

export const PlayerAdModal: React.FC<PlayerAdModalProps> = ({
  visible,
  mode = 'preroll',
  title = '',
  onComplete,
  onClose,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(4);
  const [canSkip, setCanSkip] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!visible) {
      setShouldShow(false);
      return;
    }

    // Check frequency capping: only show 1 ad every 15 minutes
    const checkCap = async () => {
      try {
        const lastTime = await AsyncStorage.getItem('cinescope_last_ad_time');
        const now = Date.now();
        if (lastTime && now - Number(lastTime) < AD_COOLDOWN_MS) {
          // Cooldown active -> bypass ad immediately without interrupting user
          onComplete();
          return;
        }

        // Eligible to show
        await AsyncStorage.setItem('cinescope_last_ad_time', String(now));
        setShouldShow(true);
        setSecondsLeft(4);
        setCanSkip(false);
      } catch {
        onComplete();
      }
    };

    checkCap();
  }, [visible]);

  useEffect(() => {
    if (!shouldShow) return;

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setCanSkip(true);
          return 0;
        }
        if (prev <= 2) {
          setCanSkip(true);
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [shouldShow]);

  if (!visible || !shouldShow) return null;

  const handleFinish = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    onComplete();
  };

  const handleOpenSponsor = () => {
    Linking.openURL(MONETAG_SPONSOR_URL).catch(() => {});
  };

  return (
    <Modal visible={true} transparent={true} animationType="fade" onRequestClose={handleFinish}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Top sponsor badge */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>SPONSORED</Text>
            </View>
            <Text style={styles.hdText}>1080P CLOUD PARTNER</Text>
          </View>

          {/* Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="film" size={32} color={CONFIG.COLORS.accent} />
          </View>

          {/* Title */}
          <Text style={styles.title} numberOfLines={1}>
            {title ? `Streaming: ${title}` : 'High-Speed Cinema Stream'}
          </Text>
          <Text style={styles.subtitle}>
            Your movie is buffering in high quality. Support free streaming by checking out our sponsor!
          </Text>

          {/* Sponsor CTA card */}
          <TouchableOpacity
            style={styles.sponsorBanner}
            onPress={handleOpenSponsor}
            activeOpacity={0.85}
          >
            <View style={styles.sponsorInfo}>
              <Text style={styles.sponsorTitle}>MovieVerse Premium Cloud</Text>
              <Text style={styles.sponsorDesc}>Instant zero-buffer 1080p playback & multi-language subtitles.</Text>
            </View>
            <View style={styles.sponsorCta}>
              <Text style={styles.sponsorCtaText}>Visit ↗</Text>
            </View>
          </TouchableOpacity>

          {/* Skip / Continue Button */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.skipBtn, canSkip && styles.skipBtnActive]}
              onPress={handleFinish}
              activeOpacity={0.8}
              // TV remote support: auto-focus on remote D-pad
              hasTVPreferredFocus={true}
            >
              <Text style={styles.skipBtnText}>
                {secondsLeft > 0 ? `Skip in ${secondsLeft}s` : 'Continue to Movie →'}
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
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0F111A',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 46, 85, 0.25)',
    elevation: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  badge: {
    backgroundColor: 'rgba(255, 46, 85, 0.18)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 46, 85, 0.4)',
  },
  badgeText: {
    color: '#FF2E55',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  hdText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '700',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 46, 85, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
  },
  sponsorBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 18,
    gap: 10,
  },
  sponsorInfo: {
    flex: 1,
  },
  sponsorTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  sponsorDesc: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  sponsorCta: {
    backgroundColor: CONFIG.COLORS.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sponsorCtaText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  btnRow: {
    width: '100%',
  },
  skipBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  skipBtnActive: {
    backgroundColor: CONFIG.COLORS.accent,
  },
  skipBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
