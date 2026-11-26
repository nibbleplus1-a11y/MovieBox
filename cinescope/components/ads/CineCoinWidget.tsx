/**
 * CineCoinWidget.tsx
 * Sleek header button displaying the user's current CineCoin balance.
 * Tapping it opens the CineCoinModal to redeem or earn coins.
 */

import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { adManager } from '../../services/adManager';
import { CineCoinModal } from './CineCoinModal';

interface CineCoinWidgetProps {
  style?: any;
}

export const CineCoinWidget: React.FC<CineCoinWidgetProps> = ({ style }) => {
  const [coins, setCoins] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = adManager.subscribe((newCoins) => {
      setCoins(newCoins);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <>
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.coinIcon}>🪙</Text>
        <Text style={styles.coinCount}>{coins}</Text>
      </TouchableOpacity>

      <CineCoinModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    gap: 4,
  },
  coinIcon: {
    fontSize: 13,
  },
  coinCount: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '900',
  },
});
