/**
 * SponsoredCard.tsx
 * Native content-card ad component designed to blend seamlessly into MovieVerse content shelves.
 * 100% native React Native components — zero WebView, zero ad-network SDKs,
 * immune to Brave and network ad-blockers.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AdCampaign } from '../../constants/ads';
import { adManager } from '../../services/adManager';

interface SponsoredCardProps {
  campaign: AdCampaign;
  onPress?: () => void;
  width?: number;
  height?: number;
}

export const SponsoredCard: React.FC<SponsoredCardProps> = React.memo(({
  campaign,
  onPress,
  width = 116,
  height = 172,
}) => {
  const impressionRecorded = useRef(false);

  useEffect(() => {
    if (!impressionRecorded.current) {
      impressionRecorded.current = true;
      adManager.recordImpression(campaign.id);
    }
  }, [campaign.id]);

  const handlePress = () => {
    adManager.recordClick(campaign.id);
    // Award +1 CineCoin for visiting sponsor
    adManager.earnCoins(1, 'sponsored_card_visit');

    if (onPress) {
      onPress();
    } else if (campaign.monetagUrl) {
      Linking.openURL(campaign.monetagUrl).catch(() => {});
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, { width }]}
      onPress={handlePress}
      activeOpacity={0.78}
      focusable={Platform.OS === 'android'}
    >
      <View style={[styles.posterWrapper, { width, height }]}>
        <Image
          source={{ uri: campaign.posterUri }}
          style={styles.poster}
          resizeMode="cover"
        />

        {/* Rating Badge */}
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={9} color="#FBBF24" style={{ marginRight: 3 }} />
          <Text style={styles.ratingBadgeText}>{campaign.rating || '4.9'}</Text>
        </View>

        {/* Sponsored / Promo Badge */}
        <View style={[styles.sponsorBadge, { borderColor: `${campaign.accentColor}60` }]}>
          <Text style={[styles.sponsorBadgeText, { color: campaign.accentColor }]}>
            {campaign.badge}
          </Text>
        </View>

        {/* CTA Tag */}
        <View style={[styles.ctaTag, { backgroundColor: `${campaign.accentColor}E0` }]}>
          <Text style={styles.ctaTagText}>{campaign.ctaText}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {campaign.title}
      </Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 116,
  },
  posterWrapper: {
    width: 116,
    height: 172,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#10131C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(8,10,15,0.88)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
  },
  ratingBadgeText: {
    color: '#FBBF24',
    fontSize: 9,
    fontWeight: '800',
  },
  sponsorBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(8,10,15,0.88)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
  },
  sponsorBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  ctaTag: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    left: 6,
    borderRadius: 4,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 6,
  },
});
