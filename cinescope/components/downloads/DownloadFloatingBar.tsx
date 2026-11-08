import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useDownloads } from '../../services/downloadService';

interface DownloadFloatingBarProps {
  bottomOffset?: number;
}

export const DownloadFloatingBar: React.FC<DownloadFloatingBarProps> = ({ bottomOffset = 20 }) => {
  const navigation = useNavigation<any>();
  const { activeTasks, completedTasks } = useDownloads();
  const [dismissed, setDismissed] = useState(false);

  // If user explicitly dismissed the floating pill or nothing active, don't show
  if (dismissed || activeTasks.length === 0) {
    return null;
  }

  const count = activeTasks.length;
  const primaryTask = activeTasks[0];
  const avgProgress =
    count > 0 ? activeTasks.reduce((acc, t) => acc + t.progress, 0) / count : 0;
  const percentText = `${Math.round(avgProgress * 100)}%`;

  const handleOpenDownloads = () => {
    try {
      navigation.navigate('Main', { screen: 'Downloads' });
    } catch {
      try {
        navigation.navigate('Downloads');
      } catch {}
    }
  };

  return (
    <View style={[styles.floatingContainer, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={styles.barCard}>
        <TouchableOpacity
          style={styles.contentRow}
          onPress={handleOpenDownloads}
          activeOpacity={0.85}
        >
          <View style={styles.iconBubble}>
            <Ionicons name="cloud-download" size={18} color="#38BDF8" />
          </View>

          <View style={styles.infoCol}>
            <View style={styles.titleRow}>
              <Text style={styles.titleText} numberOfLines={1}>
                {count > 1
                  ? `Downloading ${count} items…`
                  : primaryTask?.title || primaryTask?.filename || 'Downloading…'}
              </Text>
              <Text style={styles.percentBadge}>{percentText}</Text>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(avgProgress * 100)}%` },
                ]}
              />
            </View>
          </View>

          <View style={styles.viewBadge}>
            <Text style={styles.viewText}>View</Text>
            <Ionicons name="chevron-forward" size={14} color="#38BDF8" />
          </View>
        </TouchableOpacity>

        {/* Explicit dismiss (X) button so it never gets stuck on screen */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => setDismissed(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={16} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
    alignItems: 'center',
  },
  barCard: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 12,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  percentBadge: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: 2,
  },
  viewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
    marginLeft: 6,
  },
});
