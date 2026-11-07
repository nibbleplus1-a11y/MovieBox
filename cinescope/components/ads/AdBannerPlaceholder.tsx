import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { CONFIG } from '../../config';

interface AdBannerPlaceholderProps {
  variant?: 'feed' | 'compact' | 'player';
  title?: string;
  subtitle?: string;
  ctaText?: string;
  onPress?: () => void;
}

const AD_BANNER_URL = `${CONFIG.APP_URL.replace(/\/$/, '')}/api/ads/banner`;
const MONETAG_DIRECT_URL = 'https://monetag.com';

export const AdBannerPlaceholder: React.FC<AdBannerPlaceholderProps> = ({
  variant = 'feed',
  title = 'MovieVerse 1080p Cloud Network',
  subtitle = 'High-speed ad-supported cinema streaming with 5.1 surround dubs & zero buffering.',
  ctaText = 'Learn More',
  onPress,
}) => {
  const [webViewFailed, setWebViewFailed] = useState(false);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      Linking.openURL(MONETAG_DIRECT_URL).catch(() => {});
    }
  };

  if (variant === 'player') {
    return (
      <View style={styles.playerContainer}>
        <View style={styles.badgeRow}>
          <View style={styles.adBadge}>
            <Text style={styles.adBadgeText}>SPONSORED</Text>
          </View>
          <Text style={styles.adNote}>Cinema Cloud Partner</Text>
        </View>
        <View style={styles.playerContentRow}>
          <Ionicons name="sparkles" size={16} color="#E50914" style={{ marginRight: 8 }} />
          <Text style={styles.playerTitle} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity style={styles.playerCtaBtn} onPress={handlePress} activeOpacity={0.8}>
            <Text style={styles.playerCtaText}>{ctaText} ↗</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Real Monetag / Adsterra live webview banner
  if (!webViewFailed) {
    const bannerHeight = variant === 'compact' ? 64 : 78;
    return (
      <View style={[styles.container, { height: bannerHeight, backgroundColor: '#0f172a' }]}>
        <WebView
          source={{ uri: AD_BANNER_URL }}
          style={styles.adWebView}
          scrollEnabled={false}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          onError={() => setWebViewFailed(true)}
          onHttpError={() => setWebViewFailed(true)}
          onNavigationStateChange={(navState) => {
            // If user clicked link inside ad, open in external browser
            if (navState.url && navState.url !== AD_BANNER_URL && !navState.url.startsWith('about:')) {
              Linking.openURL(navState.url).catch(() => {});
            }
          }}
        />
      </View>
    );
  }

  // Graceful fallback if webview fails or offline
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(229, 9, 20, 0.08)', 'rgba(15, 23, 42, 0.6)']}
        style={styles.gradientBg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.topRow}>
          <View style={styles.adBadge}>
            <Text style={styles.adBadgeText}>SPONSORED</Text>
          </View>
          <Text style={styles.adNetworkLabel}>Ad Partner Showcase</Text>
        </View>

        <View style={styles.bodyRow}>
          <View style={styles.iconBox}>
            <Ionicons name="film-outline" size={24} color="#E50914" />
          </View>
          <View style={styles.textBox}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.disclaimerText}>Ads keep MovieVerse 100% free with no subscription</Text>
          <TouchableOpacity style={styles.ctaButton} onPress={handlePress} activeOpacity={0.85}>
            <Text style={styles.ctaText}>{ctaText} ↗</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    backgroundColor: '#0c0f17',
  },
  adWebView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  gradientBg: {
    padding: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  adBadge: {
    backgroundColor: '#E50914',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  adNetworkLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textBox: {
    flex: 1,
  },
  title: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  disclaimerText: {
    color: '#64748b',
    fontSize: 10,
    flex: 1,
  },
  ctaButton: {
    backgroundColor: '#E50914',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  // Player variant
  playerContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.25)',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  adNote: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '500',
  },
  playerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  playerCtaBtn: {
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    borderWidth: 1,
    borderColor: '#E50914',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  playerCtaText: {
    color: '#ff4d4f',
    fontSize: 11,
    fontWeight: '700',
  },
});
