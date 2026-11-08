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
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { WebView } from 'react-native-webview';

const MONETAG_SMARTLINK = 'https://uplcm.com/4/12213398';
const ADSTERRA_SMARTLINK = 'https://asiafilm.org/4/c59f31c3db10b336a8c574304c2e9b41';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
  const [adLoaded, setAdLoaded] = useState(false);
  const webViewRef = useRef<WebView>(null);
  // Track whether we've started the countdown yet (wait for ad to load first, up to 2s)
  const [countdownStarted, setCountdownStarted] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Target ad smartlink based on mode
  const adUrl = mode === 'postroll' ? ADSTERRA_SMARTLINK : MONETAG_SMARTLINK;

  const startCountdown = () => {
    if (countdownRef.current) return; // already started
    setCountdownStarted(true);
    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          setCanSkip(true);
          return 0;
        }
        if (prev <= 2) setCanSkip(true);
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (!visible) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = null;
      return;
    }
    setSecondsLeft(5);
    setCanSkip(false);
    setAdLoaded(false);
    setCountdownStarted(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;

    // Start countdown after at most 1.5s even if ad didn't load
    const fallback = setTimeout(() => startCountdown(), 1500);
    return () => {
      clearTimeout(fallback);
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = null;
    };
  }, [visible, mode]);

  if (!visible) return null;

  const handleAction = () => {
    if (!canSkip) return;
    if (mode === 'postroll') {
      if (onClose) onClose();
      else onComplete();
    } else {
      onComplete();
    }
  };

  const getBadgeTitle = () => {
    if (mode === 'download') return 'SPONSORED DOWNLOAD UNLOCK';
    if (mode === 'postroll') return 'SPONSORED SHOWCASE';
    return 'SPONSORED PRE-ROLL';
  };

  const getCtaLabel = () => {
    if (!canSkip) {
      if (mode === 'download') return `Unlocking in ${secondsLeft}s…`;
      if (mode === 'postroll') return `Close in ${secondsLeft}s…`;
      return `Skip in ${secondsLeft}s…`;
    }
    if (mode === 'download') return 'Start Download Now ›';
    if (mode === 'postroll') return 'Close & Exit ›';
    return 'Skip Ad › Watch Movie';
  };

  const getCtaIcon = () => {
    if (mode === 'download') return 'cloud-download';
    if (mode === 'postroll') return 'close';
    return 'play';
  };

  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent>
      <View style={styles.container}>
        {/* Full-Screen Smartlink WebView */}
        <WebView
          ref={webViewRef}
          source={{ uri: adUrl }}
          style={styles.webView}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          onLoadEnd={() => {
            setAdLoaded(true);
            startCountdown();
          }}
          onError={() => {
            setAdLoaded(true);
            startCountdown();
          }}
          onNavigationStateChange={(navState: any) => {
            // If user explicitly clicks out to external offer
            if (
              navState.url &&
              navState.url !== adUrl &&
              !navState.url.startsWith('about:') &&
              !navState.url.includes('uplcm.com') &&
              !navState.url.includes('asiafilm.org')
            ) {
              Linking.openURL(navState.url).catch(() => {});
            }
          }}
        />

        {/* Loading Spinner until ad content responds */}
        {!adLoaded && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#E50914" />
            <Text style={styles.loadingText}>Loading Sponsor Preview…</Text>
          </View>
        )}

        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <View style={styles.badgeRow}>
            <View style={styles.adTag}>
              <Text style={styles.adTagText}>AD</Text>
            </View>
            <Text style={styles.badgeText}>{getBadgeTitle()}</Text>
          </View>

          <View style={styles.countdownTag}>
            <Ionicons name="time-outline" size={13} color="#E2E8F0" />
            <Text style={styles.countdownText}>
              {secondsLeft > 0 ? `${secondsLeft}s` : 'Ready'}
            </Text>
          </View>
        </View>

        {/* Bottom CTA / Skip Bar */}
        <View style={styles.bottomBar}>
          {title ? (
            <Text style={styles.movieTitle} numberOfLines={1}>
              {title}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.ctaBtn, !canSkip && styles.ctaBtnDisabled]}
            onPress={handleAction}
            activeOpacity={0.88}
            disabled={!canSkip}
          >
            <Ionicons name={getCtaIcon() as any} size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.ctaText}>{getCtaLabel()}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0A0E17',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    zIndex: 5,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  topBar: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 6,
  },
  adTag: {
    backgroundColor: '#E50914',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  badgeText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  countdownTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 5,
  },
  countdownText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
    gap: 12,
  },
  movieTitle: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E50914',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  ctaBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
