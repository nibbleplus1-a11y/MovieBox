/**
 * CineCoinModal.tsx
 * Interactive rewards dashboard where users view coin balance,
 * earn coins via daily bonuses or visiting sponsors, and redeem them for
 * 24h Ad-Free mode or instant skips.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { adManager } from '../../services/adManager';
import { AD_CONFIG, AD_CAMPAIGNS } from '../../constants/ads';

interface CineCoinModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CineCoinModal: React.FC<CineCoinModalProps> = ({ visible, onClose }) => {
  const [coins, setCoins] = useState(0);
  const [isAdFree, setIsAdFree] = useState(false);
  const [dailyClaimed, setDailyClaimed] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const loadData = async () => {
      const currentCoins = await adManager.getCoins();
      setCoins(currentCoins);

      const adFreeStatus = await adManager.isAdFree();
      setIsAdFree(adFreeStatus);
    };

    loadData();
    const unsubscribe = adManager.subscribe((newCoins) => {
      setCoins(newCoins);
    });

    return () => {
      unsubscribe();
    };
  }, [visible]);

  if (!visible) return null;

  const handleClaimDaily = async () => {
    const eligible = await adManager.checkDailyBonus();
    if (eligible) {
      setDailyClaimed(true);
      Alert.alert('Bonus Claimed! 🪙', `You received +${AD_CONFIG.COINS_FOR_DAILY_BONUS} CineCoin for logging in today!`);
    } else {
      Alert.alert('Already Claimed', 'You have already collected today’s bonus. Check back tomorrow!');
    }
  };

  const handleVisitSponsor = (campaign = AD_CAMPAIGNS[0]) => {
    adManager.recordClick(campaign.id);
    adManager.earnCoins(AD_CONFIG.COINS_PER_SPONSOR_VISIT, 'sponsor_visit');
    if (campaign.monetagUrl) {
      Linking.openURL(campaign.monetagUrl).catch(() => {});
    }
  };

  const handleRedeemAdFree = async () => {
    if (coins < AD_CONFIG.COST_AD_FREE_24H) {
      Alert.alert('Not Enough Coins', `You need ${AD_CONFIG.COST_AD_FREE_24H} CineCoins. Earn more by visiting sponsors!`);
      return;
    }

    const success = await adManager.spendCoins(AD_CONFIG.COST_AD_FREE_24H, 'redeem_ad_free_24h');
    if (success) {
      await adManager.activateAdFree(24);
      setIsAdFree(true);
      Alert.alert('🎉 VIP Mode Activated!', 'Enjoy 24 hours of 100% ad-free cinema streaming.');
    }
  };

  return (
    <Modal visible={true} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerIcon}>🪙</Text>
              <Text style={styles.headerTitle}>CineCoins Rewards</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Balance Card */}
            <View style={styles.balanceCard}>
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceLabel}>YOUR BALANCE</Text>
                <Text style={styles.balanceValue}>🪙 {coins} Coins</Text>
              </View>
              <View style={[styles.statusBadge, isAdFree ? styles.statusBadgeActive : null]}>
                <Text style={[styles.statusText, isAdFree ? styles.statusTextActive : null]}>
                  {isAdFree ? '✨ 24H VIP ACTIVE' : 'STANDARD FREE'}
                </Text>
              </View>
            </View>

            {/* Redeem Perks Section */}
            <Text style={styles.sectionTitle}>REDEEM PERKS</Text>

            {/* 24h Ad-Free */}
            <View style={styles.perkCard}>
              <View style={styles.perkIconWrap}>
                <Ionicons name="sparkles" size={22} color="#8B5CF6" />
              </View>
              <View style={styles.perkInfo}>
                <Text style={styles.perkTitle}>24 Hours Ad-Free Cinema</Text>
                <Text style={styles.perkDesc}>Bypass all pre-rolls and banners automatically</Text>
              </View>
              <TouchableOpacity
                style={[styles.redeemBtn, coins < AD_CONFIG.COST_AD_FREE_24H && styles.redeemBtnDisabled]}
                onPress={handleRedeemAdFree}
                activeOpacity={0.8}
              >
                <Text style={styles.redeemBtnText}>10 🪙</Text>
              </TouchableOpacity>
            </View>

            {/* Skip Ad */}
            <View style={styles.perkCard}>
              <View style={styles.perkIconWrap}>
                <Ionicons name="play-forward" size={22} color="#38BDF8" />
              </View>
              <View style={styles.perkInfo}>
                <Text style={styles.perkTitle}>Instant Ad-Skip</Text>
                <Text style={styles.perkDesc}>Skip pre-roll instantly right from the player</Text>
              </View>
              <View style={styles.passiveCostBadge}>
                <Text style={styles.passiveCostText}>1 🪙</Text>
              </View>
            </View>

            {/* Earn More Section */}
            <Text style={styles.sectionTitle}>EARN MORE COINS</Text>

            {/* Daily Login Bonus */}
            <TouchableOpacity
              style={styles.earnCard}
              onPress={handleClaimDaily}
              activeOpacity={0.8}
            >
              <View style={[styles.perkIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="calendar" size={22} color="#F59E0B" />
              </View>
              <View style={styles.perkInfo}>
                <Text style={styles.perkTitle}>Daily Login Bonus</Text>
                <Text style={styles.perkDesc}>Open the app once a day for free rewards</Text>
              </View>
              <View style={styles.earnBadge}>
                <Text style={styles.earnBadgeText}>+1 🪙</Text>
              </View>
            </TouchableOpacity>

            {/* Visit Sponsors */}
            {AD_CAMPAIGNS.slice(0, 2).map((camp) => (
              <TouchableOpacity
                key={camp.id}
                style={styles.earnCard}
                onPress={() => handleVisitSponsor(camp)}
                activeOpacity={0.8}
              >
                <View style={[styles.perkIconWrap, { backgroundColor: `${camp.accentColor}20` }]}>
                  <Ionicons name={camp.icon as any} size={22} color={camp.accentColor} />
                </View>
                <View style={styles.perkInfo}>
                  <Text style={styles.perkTitle}>Check out {camp.title.split('·')[0].trim()}</Text>
                  <Text style={styles.perkDesc}>{camp.subtitle}</Text>
                </View>
                <View style={[styles.earnBadge, { backgroundColor: `${camp.accentColor}25` }]}>
                  <Text style={[styles.earnBadgeText, { color: camp.accentColor }]}>+1 🪙</Text>
                </View>
              </TouchableOpacity>
            ))}

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 5, 8, 0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0F111A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 22,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  scroll: {
    paddingTop: 14,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 46, 85, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 46, 85, 0.25)',
    marginBottom: 20,
  },
  balanceInfo: {},
  balanceLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  balanceValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: '#8B5CF6',
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextActive: {
    color: '#A78BFA',
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  perkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161925',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  perkIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkInfo: {
    flex: 1,
  },
  perkTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  perkDesc: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  redeemBtn: {
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  redeemBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    opacity: 0.5,
  },
  redeemBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  passiveCostBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  passiveCostText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  earnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161925',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  earnBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  earnBadgeText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '800',
  },
});
