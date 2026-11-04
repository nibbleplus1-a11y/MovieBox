import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

interface AdBannerPlaceholderProps {
  variant?: 'feed' | 'compact' | 'player';
  title?: string;
  subtitle?: string;
  ctaText?: string;
  onPress?: () => void;
}

export const AdBannerPlaceholder: React.FC<AdBannerPlaceholderProps> = ({
  variant = 'feed',
  title = 'CineScope 1080p Cloud Network',
  subtitle = 'High-speed ad-supported cinema streaming with 5.1 surround dubs & zero buffering.',
  ctaText = 'Learn More',
  onPress,
}) => {
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      Linking.openURL('https://monetag.com').catch(() => {});
    }
  };

  if (variant === 'player') {
    return (
      <View style={styles.playerContainer}>
        <View style={styles.badgeRow}>
          <View style={styles.adBadge}>
            <Text style={styles.adBadgeText}>SPONSORED</Text>
          </View>
          <Text style={styles.adNote}>Ad Placement Preview</Text>
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
            <Text style={styles.adBadgeText}>ADVERTISEMENT</Text>
          </View>
          <Text style={styles.adNetworkLabel}>Monetag / Adsterra Slot</Text>
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
          <Text style={styles.disclaimerText}>Ads keep CineScope 100% free with no subscription</Text>
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
    marginVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    backgroundColor: '#0c0f17',
  },
  gradientBg: {
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  adBadge: {
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.5)',
  },
  adBadgeText: {
    color: '#FF4D5A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  adNetworkLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '500',
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  textBox: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
  },
  disclaimerText: {
    color: '#64748B',
    fontSize: 10,
    flex: 1,
    marginRight: 8,
  },
  ctaButton: {
    backgroundColor: '#E50914',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  playerContainer: {
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: 'rgba(12, 16, 26, 0.85)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  adNote: {
    color: '#64748B',
    fontSize: 9,
  },
  playerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerTitle: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  playerCtaBtn: {
    backgroundColor: 'rgba(229, 9, 20, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 6,
  },
  playerCtaText: {
    color: '#FF6B6B',
    fontSize: 10,
    fontWeight: '700',
  },
});
