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

import { adManager } from '../../services/adManager';
import { AD_CAMPAIGNS, AdCampaign, AD_CONFIG } from '../../constants/ads';

interface PlayerAdModalProps {
  visible: boolean;
  mode?: 'preroll' | 'postroll' | 'download';
  title?: string;
  onComplete: () => void;
  onClose?: () => void;
}

export const PlayerAdModal: React.FC<PlayerAdModalProps> = ({
  visible,
  mode = 'preroll',
  title = '',
  onComplete,
  onClose,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(3);
  const [canSkip, setCanSkip] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [campaign, setCampaign] = useState<AdCampaign>(AD_CAMPAIGNS[0]);
  const [userCoins, setUserCoins] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!visible) {
      setShouldShow(false);
      return;
    }

    const checkCap = async () => {
      try {
        const adFree = await adManager.isAdFree();
        if (adFree) {
          onComplete();
          return;
        }

        if (mode !== 'download') {
          const eligible = await adManager.canShowPreRoll();
          if (!eligible) {
            onComplete();
            return;
          }
          await adManager.recordPreRoll();
        }

        const activeCampaign = adManager.selectCampaign();
        setCampaign(activeCampaign);
        adManager.recordImpression(activeCampaign.id);

        const coins = await adManager.getCoins();
        setUserCoins(coins);

        // Eligible to show
        setShouldShow(true);
        setSecondsLeft(3);
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
    adManager.recordClick(campaign.id);
    adManager.earnCoins(AD_CONFIG.COINS_PER_SPONSOR_VISIT, 'sponsor_modal_click');
    if (campaign.monetagUrl) {
      Linking.openURL(campaign.monetagUrl).catch(() => {});
    }
  };

  return (
    <Modal visible={true} transparent={true} animationType="fade" onRequestClose={handleFinish}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Top sponsor badge */}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: `${campaign.accentColor}25`, borderColor: `${campaign.accentColor}50` }]}>
              <Text style={[styles.badgeText, { color: campaign.accentColor }]}>{campaign.badge}</Text>
            </View>
            <Text style={styles.hdText}>1080P CLOUD PARTNER</Text>
          </View>

          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: `${campaign.accentColor}15` }]}>
            <Ionicons name={campaign.icon as any} size={32} color={campaign.accentColor} />
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
              <Text style={styles.sponsorTitle}>{campaign.title}</Text>
              <Text style={styles.sponsorDesc}>{campaign.subtitle}</Text>
            </View>
            <View style={[styles.sponsorCta, { backgroundColor: campaign.accentColor }]}>
              <Text style={styles.sponsorCtaText}>{campaign.ctaText} ↗</Text>
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
