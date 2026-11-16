import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CONFIG } from '../../config';
import { useTVDetect } from '../../hooks/useTVDetect';

interface AdBannerPlaceholderProps {
  variant?: 'feed' | 'compact' | 'player';
  title?: string;
  subtitle?: string;
  ctaText?: string;
  onPress?: () => void;
}

const MONETAG_DIRECT_URL = 'https://uplcm.com/4/12213398';

export const AdBannerPlaceholder: React.FC<AdBannerPlaceholderProps> = ({
  variant = 'feed',
  title = 'MovieVerse 1080p Cloud Network',
  subtitle = 'High-speed ad-supported cinema streaming with multi-language subs.',
  ctaText = 'Learn More',
  onPress,
}) => {
  const { isTVDevice } = useTVDetect();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      Linking.openURL(MONETAG_DIRECT_URL).catch(() => {});
    }
  };

  const isCompact = variant === 'compact';
  const isPlayer = variant === 'player';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isCompact && styles.containerCompact,
        isPlayer && styles.containerPlayer,
        isTVDevice && { marginHorizontal: 24, marginVertical: 8, opacity: 0.95 },
      ]}
      onPress={handlePress}
      activeOpacity={0.85}
      focusable={!isTVDevice}
    >
      <View style={styles.left}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SPONSORED</Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {!isCompact && (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>

      <View style={styles.ctaBox}>
        <Text style={styles.ctaText}>{ctaText}</Text>
        <Ionicons name="arrow-forward" size={12} color="#FFF" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0F121E',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 46, 85, 0.2)',
  },
  containerCompact: {
    paddingVertical: 8,
    marginVertical: 4,
  },
  containerPlayer: {
    marginHorizontal: 12,
    marginVertical: 6,
    backgroundColor: '#0A0C14',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  left: {
    flex: 1,
    marginRight: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 46, 85, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  badgeText: {
    color: '#FF2E55',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  ctaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: CONFIG.COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ctaText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
