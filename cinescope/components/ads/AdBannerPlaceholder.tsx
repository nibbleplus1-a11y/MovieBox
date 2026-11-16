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

const ACTIVE_CAMPAIGNS = [
  {
    badge: 'SPONSORED OFFER',
    badgeColor: '#FF2E55',
    icon: 'shield-checkmark',
    iconColor: '#FF2E55',
    title: 'Shield VPN · 82% Off + 3 Mo Free',
    subtitle: 'Stream securely at full speed with zero ISP throttling & anonymous browsing.',
    ctaText: 'Claim 82% Off',
    accentColor: '#FF2E55',
  },
  {
    badge: 'FEATURED APP',
    badgeColor: '#38BDF8',
    icon: 'game-controller',
    iconColor: '#38BDF8',
    title: 'Play 10,000+ Games Free Online',
    subtitle: 'Instant cloud gaming with zero downloads & real player cash rewards.',
    ctaText: 'Play Now',
    accentColor: '#0284C7',
  },
  {
    badge: 'CINEMA VIP',
    badgeColor: '#10B981',
    icon: 'flash',
    iconColor: '#10B981',
    title: 'Ultra 4K Cloud Streaming Pass',
    subtitle: 'High-speed dedicated edge nodes with Dolby Atmos and zero waiting.',
    ctaText: 'Get VIP Pass',
    accentColor: '#059669',
  },
];

export const AdBannerPlaceholder: React.FC<AdBannerPlaceholderProps> = ({
  variant = 'feed',
  title,
  subtitle,
  ctaText,
  onPress,
}) => {
  const { isTVDevice } = useTVDetect();

  // Pick creative based on variant or provided props
  const defaultCampaign = variant === 'player' ? ACTIVE_CAMPAIGNS[2] : (variant === 'compact' ? ACTIVE_CAMPAIGNS[1] : ACTIVE_CAMPAIGNS[0]);
  const activeTitle = title && !title.includes('Placement') ? title : defaultCampaign.title;
  const activeSubtitle = subtitle && !subtitle.includes('Placement') ? subtitle : defaultCampaign.subtitle;
  const activeCta = ctaText && !ctaText.includes('Learn More') ? ctaText : defaultCampaign.ctaText;

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
      <View style={[styles.iconBox, { borderColor: `${defaultCampaign.accentColor}40` }]}>
        <Ionicons name={defaultCampaign.icon as any} size={20} color={defaultCampaign.iconColor} />
      </View>

      <View style={styles.left}>
        <View style={[styles.badge, { backgroundColor: `${defaultCampaign.badgeColor}20` }]}>
          <Text style={[styles.badgeText, { color: defaultCampaign.badgeColor }]}>{defaultCampaign.badge}</Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>{activeTitle}</Text>
        {!isCompact && (
          <Text style={styles.subtitle} numberOfLines={1}>{activeSubtitle}</Text>
        )}
      </View>

      <View style={[styles.ctaBox, { backgroundColor: defaultCampaign.accentColor }]}>
        <Text style={styles.ctaText}>{activeCta}</Text>
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
    borderColor: 'rgba(255, 46, 85, 0.25)',
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
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  left: {
    flex: 1,
    marginRight: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  badgeText: {
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
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  ctaText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
