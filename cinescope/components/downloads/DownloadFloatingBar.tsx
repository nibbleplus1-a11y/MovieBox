import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useDownloads } from '../../services/downloadService';

interface DownloadFloatingBarProps {
  bottomOffset?: number;
}

export const DownloadFloatingBar: React.FC<DownloadFloatingBarProps> = ({
  bottomOffset = 20,
}) => {
  const navigation = useNavigation<any>();
  const { activeTasks } = useDownloads();

  // Animated opacity for smooth show/hide
  const opacity = useRef(new Animated.Value(0)).current;
  const prevCountRef = useRef(0);

  const hasActive = activeTasks.length > 0;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: hasActive ? 1 : 0,
      duration: hasActive ? 300 : 500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    prevCountRef.current = activeTasks.length;
  }, [hasActive]);

  if (!hasActive) return null;

  const count = activeTasks.length;
  const primaryTask = activeTasks[0];
  const avgProgress =
    count > 0
      ? activeTasks.reduce((acc, t) => acc + t.progress, 0) / count
      : 0;
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
    <Animated.View
      style={[styles.floatingContainer, { bottom: bottomOffset, opacity }]}
      pointerEvents="box-none"
    >
      <View style={styles.barCard}>
        <TouchableOpacity
          style={styles.contentRow}
          onPress={handleOpenDownloads}
          activeOpacity={0.85}
        >
          {/* Pulsing download icon */}
          <View style={styles.iconBubble}>
            <Ionicons name="cloud-download" size={18} color="#38BDF8" />
          </View>

          <View style={styles.infoCol}>
            <View style={styles.titleRow}>
              <Text style={styles.titleText} numberOfLines={1}>
                {count > 1
                  ? `Downloading ${count} files…`
                  : (primaryTask?.title ||
                      primaryTask?.filename ||
                      'Downloading…')}
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

            {primaryTask?.fileSize ? (
              <Text style={styles.sizeText}>{primaryTask.fileSize}</Text>
            ) : null}
          </View>

          <View style={styles.viewBadge}>
            <Text style={styles.viewText}>View</Text>
            <Ionicons name="chevron-forward" size={14} color="#38BDF8" />
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
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
    backgroundColor: 'rgba(10, 15, 30, 0.97)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 14,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
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
  sizeText: {
    color: 'rgba(148, 163, 184, 0.7)',
    fontSize: 10,
    marginTop: 3,
    fontWeight: '500',
  },
  viewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 6,
  },
  viewText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
});
