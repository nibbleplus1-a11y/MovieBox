import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system/legacy';
import { useDownloads, DownloadTask } from '../services/downloadService';
import { MonetagInterstitialAd } from '../components/ads/MonetagInterstitialAd';

interface DownloadsScreenProps {
  navigation: any;
}

export default function DownloadsScreen({ navigation }: DownloadsScreenProps) {
  const insets = useSafeAreaInsets();
  const {
    activeTasks,
    completedTasks,
    quota,
    grantQuota,
    cancelDownload,
    deleteDownload,
  } = useDownloads();

  const [freeDisk, setFreeDisk] = useState<string>('');
  const [showRewardAd, setShowRewardAd] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    FileSystem.getFreeDiskStorageAsync()
      .then((freeBytes) => {
        if (!isMounted) return;
        const gb = (freeBytes / (1024 * 1024 * 1024)).toFixed(1);
        setFreeDisk(`${gb} GB free`);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [completedTasks.length]);

  const handlePlayOffline = (task: DownloadTask) => {
    if (!task.localUri) {
      Alert.alert('File not ready', 'This download has not finished yet.');
      return;
    }
    // Launch player with local file uri
    navigation.navigate('Player', {
      title: task.episodeTitle ? `${task.title} - ${task.episodeTitle}` : task.title,
      streamUrl: task.localUri,
      isOffline: true,
      poster: task.poster,
    });
  };

  const confirmDelete = (task: DownloadTask) => {
    Alert.alert(
      'Delete Download?',
      `Are you sure you want to remove "${task.title}" from your device?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteDownload(task.id),
        },
      ]
    );
  };

  const handleRewardAdComplete = () => {
    setShowRewardAd(false);
    grantQuota(3);
    Alert.alert('Unlocked! 🎉', 'You now have 3 more high-speed downloads!');
  };

  const renderActiveItem = ({ item }: { item: DownloadTask }) => {
    const percent = Math.round(item.progress * 100);
    return (
      <View style={S.activeCard}>
        {item.poster ? (
          <Image source={{ uri: item.poster }} style={S.activePoster} />
        ) : (
          <View style={[S.activePoster, S.posterPlaceholder]}>
            <Ionicons name="film-outline" size={20} color="#64748B" />
          </View>
        )}

        <View style={S.activeInfo}>
          <Text style={S.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.episodeTitle ? (
            <Text style={S.cardSubtitle} numberOfLines={1}>
              {item.episodeTitle}
            </Text>
          ) : null}

          {/* Progress bar */}
          <View style={S.progressTrack}>
            <View style={[S.progressFill, { width: `${percent}%` }]} />
          </View>

          <View style={S.progressMetaRow}>
            <Text style={S.sizeMeta}>{item.fileSize || 'Downloading…'}</Text>
            <Text style={S.percentMeta}>{percent}%</Text>
          </View>
        </View>

        <TouchableOpacity
          style={S.cancelBtn}
          onPress={() => cancelDownload(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderCompletedItem = ({ item }: { item: DownloadTask }) => {
    return (
      <View style={S.completedCard}>
        <TouchableOpacity
          style={S.posterContainer}
          onPress={() => handlePlayOffline(item)}
          activeOpacity={0.8}
        >
          {item.poster ? (
            <Image source={{ uri: item.poster }} style={S.completedPoster} />
          ) : (
            <View style={[S.completedPoster, S.posterPlaceholder]}>
              <Ionicons name="film-outline" size={28} color="#64748B" />
            </View>
          )}
          <View style={S.playOverlay}>
            <Ionicons name="play" size={22} color="#FFF" />
          </View>
        </TouchableOpacity>

        <View style={S.completedInfo}>
          <Text style={S.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.episodeTitle ? (
            <Text style={S.cardSubtitle} numberOfLines={1}>
              {item.episodeTitle}
            </Text>
          ) : null}

          <View style={S.metaRow}>
            <View style={S.badge}>
              <Ionicons name="checkmark-circle" size={13} color="#10B981" />
              <Text style={S.badgeText}>Ready Offline</Text>
            </View>
            {item.fileSize ? <Text style={S.fileSizeText}>{item.fileSize}</Text> : null}
          </View>
        </View>

        <View style={S.actionBtns}>
          <TouchableOpacity
            style={S.playBtn}
            onPress={() => handlePlayOffline(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="play-circle" size={32} color="#38BDF8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={S.deleteBtn}
            onPress={() => confirmDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const totalItems = activeTasks.length + completedTasks.length;

  return (
    <View style={[S.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={S.header}>
        <View>
          <Text style={S.headerTitle}>Downloads</Text>
          <Text style={S.headerSubtitle}>
            Watch offline anytime • {freeDisk || 'MovieVerse Hub'}
          </Text>
        </View>

        {/* 3-in-1 Ad Quota Badge */}
        <TouchableOpacity
          style={S.quotaBadge}
          onPress={() => setShowRewardAd(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="ticket-outline" size={16} color="#F59E0B" />
          <Text style={S.quotaText}>
            {quota > 0 ? `${quota} Free Left` : 'Unlock +3'}
          </Text>
        </TouchableOpacity>
      </View>

      {totalItems === 0 ? (
        <ScrollView contentContainerStyle={S.emptyContainer}>
          <View style={S.emptyIconCircle}>
            <Ionicons name="cloud-download-outline" size={54} color="#38BDF8" />
          </View>
          <Text style={S.emptyTitle}>No Downloads Yet</Text>
          <Text style={S.emptyDesc}>
            Download movies and series to watch them offline when you travel or don't have internet.
          </Text>
          <TouchableOpacity
            style={S.browseBtn}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.85}
          >
            <Ionicons name="compass-outline" size={18} color="#FFF" />
            <Text style={S.browseBtnText}>Explore Movies</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView style={S.scrollBody} showsVerticalScrollIndicator={false}>
          {/* Active downloads section */}
          {activeTasks.length > 0 && (
            <View style={S.section}>
              <View style={S.sectionHeader}>
                <Text style={S.sectionTitle}>
                  Downloading ({activeTasks.length})
                </Text>
              </View>
              <FlatList
                data={activeTasks}
                keyExtractor={(item) => item.id}
                renderItem={renderActiveItem}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Completed offline downloads section */}
          {completedTasks.length > 0 && (
            <View style={S.section}>
              <View style={S.sectionHeader}>
                <Text style={S.sectionTitle}>
                  Available Offline ({completedTasks.length})
                </Text>
              </View>
              <FlatList
                data={completedTasks}
                keyExtractor={(item) => item.id}
                renderItem={renderCompletedItem}
                scrollEnabled={false}
              />
            </View>
          )}
        </ScrollView>
      )}

      {/* Monetag Sponsor Ad for +3 Download Quota */}
      {showRewardAd && (
        <MonetagInterstitialAd
          visible={showRewardAd}
          onDismiss={() => setShowRewardAd(false)}
          onAdComplete={handleRewardAdComplete}
          title="Unlock 3 High-Speed Downloads"
          subtitle="Watch a quick sponsor ad to get 3 ad-free downloads!"
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#090A10',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  quotaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  quotaText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollBody: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 18,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
  },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131522',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  activePoster: {
    width: 48,
    height: 64,
    borderRadius: 6,
    backgroundColor: '#1E293B',
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: 2,
  },
  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sizeMeta: {
    color: '#64748B',
    fontSize: 11,
  },
  percentMeta: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  cancelBtn: {
    padding: 4,
  },
  completedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#11131E',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  posterContainer: {
    position: 'relative',
  },
  completedPoster: {
    width: 60,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  fileSizeText: {
    color: '#64748B',
    fontSize: 11,
  },
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    padding: 2,
  },
  deleteBtn: {
    padding: 6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyDesc: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF2E55',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#FF2E55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  browseBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
