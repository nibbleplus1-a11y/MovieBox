/**
 * PreRollAdModal.tsx
 * Professional YouTube-style Pre-Roll ad modal rendered 100% natively.
 * Features:
 * - 5-second countdown with automatic skip unlock
 * - CineCoin integration (Instant skip using 1 coin, or earn 1 coin by watching fully)
 * - Frequency capping & Ad-Free VIP support via adManager
 * - TV Remote friendly
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Linking,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { adManager } from '../../services/adManager';
import { AdCampaign, AD_CONFIG } from '../../constants/ads';

interface PreRollAdModalProps {
  visible: boolean;
  contentTitle?: string;
  genre?: string;
  onComplete: () => void;
}

export const PreRollAdModal: React.FC<PreRollAdModalProps> = ({
  visible,
  contentTitle = '',
  genre,
  onComplete,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(AD_CONFIG.SKIP_DELAY_SECONDS);
  const [canSkip, setCanSkip] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [campaign, setCampaign] = useState<AdCampaign | null>(null);
  const [userCoins, setUserCoins] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!visible) {
      setShouldShow(false);
      return;
    }

    const checkEligibility = async () => {
      const eligible = await adManager.canShowPreRoll();
      if (!eligible) {
        onComplete();
        return;
      }

      const activeCampaign = adManager.selectCampaign(genre);
      setCampaign(activeCampaign);
      adManager.recordImpression(activeCampaign.id);

      const coins = await adManager.getCoins();
      setUserCoins(coins);

      setSecondsLeft(AD_CONFIG.SKIP_DELAY_SECONDS);
      setCanSkip(false);
      setShouldShow(true);
    };

    checkEligibility();
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
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [shouldShow]);

  if (!visible || !shouldShow || !campaign) return null;

  const handleFinish = async (reward: boolean = false) => {
    if (timerRef.current) clearInterval(timerRef.current);
    await adManager.recordPreRoll();
    if (reward) {
      await adManager.earnCoins(1, 'watched_preroll');
    }
    onComplete();
  };

  const handleSkipWithCoin = async () => {
    const success = await adManager.spendCoins(AD_CONFIG.COST_SKIP_AD, 'instant_skip_ad');
    if (success) {
      handleFinish(false);
    }
  };

  const handleOpenSponsor = () => {
    adManager.recordClick(campaign.id);
    adManager.earnCoins(AD_CONFIG.COINS_PER_SPONSOR_VISIT, 'preroll_click');
    if (campaign.monetagUrl) {
      Linking.openURL(campaign.monetagUrl).catch(() => {});
    }
  };

  return (
    <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => handleFinish(false)}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Top header row */}
          <View style={styles.topHeader}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: `${campaign.accentColor}25` }]}>
                <Text style={[styles.badgeText, { color: campaign.accentColor }]}>{campaign.badge}</Text>
              </View>
              <Text style={styles.adIndexText}>
                {secondsLeft > 0 ? `Ad · 0:0${secondsLeft}` : 'Ad Finished'}
              </Text>
            </View>

            {/* Instant Skip with 1 Coin if user has coins */}
            {userCoins >= AD_CONFIG.COST_SKIP_AD && secondsLeft > 0 && (
              <TouchableOpacity
                style={styles.coinSkipBtn}
                onPress={handleSkipWithCoin}
                activeOpacity={0.8}
              >
                <Text style={styles.coinSkipText}>🪙 Skip (1 Coin)</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Visual Poster Banner */}
          <View style={styles.posterContainer}>
            <Image
              source={{ uri: campaign.posterUri }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
            <View style={styles.bannerGradient}>
              <View style={[styles.iconCircle, { backgroundColor: `${campaign.accentColor}25` }]}>
                <Ionicons name={campaign.icon as any} size={28} color={campaign.accentColor} />
              </View>
              <Text style={styles.campaignTitle} numberOfLines={1}>
                {campaign.title}
              </Text>
              <Text style={styles.campaignSubtitle} numberOfLines={2}>
                {campaign.subtitle}
              </Text>
            </View>
          </View>

          {/* Action Row */}
          <View style={styles.actions}>
            {/* Visit Sponsor button */}
            <TouchableOpacity
              style={[styles.sponsorBtn, { backgroundColor: campaign.accentColor }]}
              onPress={handleOpenSponsor}
              activeOpacity={0.85}
              focusable={Platform.OS === 'android'}
            >
              <Text style={styles.sponsorBtnText}>{campaign.ctaText} ↗</Text>
            </TouchableOpacity>

            {/* Skip / Continue button */}
            <TouchableOpacity
              style={[styles.skipBtn, canSkip && styles.skipBtnActive]}
              onPress={() => handleFinish(canSkip)}
              disabled={!canSkip}
              activeOpacity={0.85}
              hasTVPreferredFocus={canSkip}
              focusable={canSkip}
            >
              <Text style={[styles.skipBtnText, canSkip && styles.skipBtnTextActive]}>
                {secondsLeft > 0 ? `Skip in ${secondsLeft}s` : 'Continue to Film →'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content title subtitle */}
          <Text style={styles.nowPlayingHint} numberOfLines={1}>
            {contentTitle ? `Upcoming: ${contentTitle}` : 'High-Speed Stream Hub'}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 5, 8, 0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0F111A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    elevation: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  adIndexText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  coinSkipBtn: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  coinSkipText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
  },
  posterContainer: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
    backgroundColor: '#000',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    opacity: 0.45,
  },
  bannerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 17, 26, 0.6)',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  campaignTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  campaignSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  sponsorBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsorBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  skipBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  skipBtnActive: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  skipBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  skipBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  nowPlayingHint: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
});
