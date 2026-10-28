import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, RefreshControl, Dimensions, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CONFIG } from '../config';
import { WatchlistService, WatchlistItem } from '../services/watchlist';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;
const CARD_H = CARD_W * 1.48;

export default function WatchlistScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [list, setList] = useState<WatchlistItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const load = useCallback(async () => {
    const items = await WatchlistService.get();
    setList(items);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmRemove = (item: WatchlistItem) => {
    Alert.alert(
      'Remove from Watchlist',
      `Remove "${item.title}" from your watchlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await WatchlistService.remove(item.subject_id);
            setList(prev => prev.filter(i => i.subject_id !== item.subject_id));
          },
        },
      ]
    );
  };

  const openDetail = (item: WatchlistItem) => {
    navigation.navigate('Detail', {
      id: item.subject_id,
      title: item.title,
      cover: item.cover,
    });
  };

  const openPlayer = (item: WatchlistItem) => {
    navigation.navigate('Player', {
      id: item.subject_id,
      title: item.title,
      cover: item.cover,
      type: item.type || 'Movie',
    });
  };

  if (list.length === 0) {
    return (
      <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <View style={styles.emptyIconWrap}>
          <Ionicons name="bookmark-outline" size={42} color="#71717a" />
        </View>
        <Text style={styles.emptyTitle}>Your Watchlist is Empty</Text>
        <Text style={styles.emptySubtitle}>
          Save movies and shows to watch later.{'\n'}Tap the bookmark icon on any title.
        </Text>
        <TouchableOpacity
          style={styles.discoverBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.85}
        >
          <Ionicons name="compass-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.discoverBtnText}>Browse Content</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderGridItem = ({ item }: { item: WatchlistItem }) => (
    <TouchableOpacity
      style={styles.gridCard}
      onPress={() => openDetail(item)}
      onLongPress={() => confirmRemove(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.cover || 'https://via.placeholder.com/180x265/10131C/333' }}
        style={styles.gridPoster}
        resizeMode="cover"
      />
      <View style={styles.gridOverlay}>
        {item.type && (
          <View style={[styles.gridTypeBadge, item.type === 'Series' && styles.gridTypeBadgeSeries]}>
            <Text style={styles.gridTypeText}>{item.type === 'Series' ? 'TV' : 'FILM'}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.gridPlayBtn}
          onPress={() => openPlayer(item)}
          activeOpacity={0.85}
        >
          <Ionicons name="play" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.gridRemoveBtn}
          onPress={() => confirmRemove(item)}
          activeOpacity={0.85}
        >
          <Ionicons name="close" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={styles.gridCardBody}>
        <Text style={styles.gridCardTitle} numberOfLines={2}>{item.title}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderListItem = ({ item }: { item: WatchlistItem }) => (
    <TouchableOpacity
      style={styles.listRow}
      onPress={() => openDetail(item)}
      activeOpacity={0.78}
    >
      <Image
        source={{ uri: item.cover || 'https://via.placeholder.com/70x100/10131C/333' }}
        style={styles.listThumb}
        resizeMode="cover"
      />
      <View style={styles.listBody}>
        <Text style={styles.listTitle} numberOfLines={2}>{item.title}</Text>
        {item.type && (
          <View style={[styles.listTypePill, item.type === 'Series' && styles.listTypePillSeries]}>
            <Text style={[styles.listTypeText, item.type === 'Series' && styles.listTypeTextSeries]}>
              {item.type === 'Series' ? 'TV SHOW' : 'MOVIE'}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.listActions}>
        <TouchableOpacity
          style={styles.listPlayBtn}
          onPress={() => openPlayer(item)}
          activeOpacity={0.85}
        >
          <Ionicons name="play" size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.listRemoveBtn}
          onPress={() => confirmRemove(item)}
          activeOpacity={0.85}
        >
          <Ionicons name="close" size={16} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>My Watchlist</Text>
          <Text style={styles.headerCount}>{list.length} {list.length === 1 ? 'title' : 'titles'} saved</Text>
        </View>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'grid' && styles.toggleBtnActive]}
            onPress={() => setViewMode('grid')}
          >
            <Ionicons name="grid-outline" size={16} color={viewMode === 'grid' ? '#fff' : '#64748b'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list-outline" size={18} color={viewMode === 'list' ? '#fff' : '#64748b'} />
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'grid' ? (
        <FlatList
          data={list}
          keyExtractor={item => item.subject_id}
          numColumns={2}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={CONFIG.COLORS.accent}
            />
          }
          renderItem={renderGridItem}
        />
      ) : (
        <FlatList
          data={list}
          keyExtractor={item => item.subject_id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={CONFIG.COLORS.accent}
            />
          }
          renderItem={renderListItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CONFIG.COLORS.bg },

  emptyContainer: {
    flex: 1,
    backgroundColor: CONFIG.COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(229,9,20,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.25)',
    marginBottom: 8,
  },
  emptyIconBig: { fontSize: 44 },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    color: '#52525b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  discoverBtn: {
    marginTop: 16,
    backgroundColor: CONFIG.COLORS.accent,
    borderRadius: 50,
    paddingHorizontal: 28,
    paddingVertical: 13,
    shadowColor: CONFIG.COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  discoverBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.3 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerCount: {
    color: '#52525b',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: '#1C1C28',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  toggleBtn: {
    width: 34,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: CONFIG.COLORS.accent,
    shadowColor: CONFIG.COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },
  toggleBtnText: { color: '#52525b', fontSize: 18, fontWeight: '700' },
  toggleBtnTextActive: { color: '#FFFFFF' },

  // Grid
  gridContainer: { paddingHorizontal: 12, paddingBottom: 120 },
  gridRow: { gap: 12, marginBottom: 12 },
  gridCard: {
    width: CARD_W,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: CONFIG.COLORS.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  gridPoster: { width: CARD_W, height: CARD_H, backgroundColor: '#10131C' },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 8,
  },
  gridTypeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(229,9,20,0.85)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  gridTypeBadgeSeries: { backgroundColor: 'rgba(6,182,212,0.85)' },
  gridTypeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  gridPlayBtn: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -22,
    marginLeft: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(229,9,20,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  gridPlayIcon: { color: '#FFFFFF', fontSize: 16, marginLeft: 2 },
  gridRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  gridRemoveIcon: { color: '#94A3B8', fontSize: 10, fontWeight: '800' },
  gridCardBody: { padding: 8, paddingTop: 6 },
  gridCardTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', lineHeight: 16 },

  // List
  listContainer: { padding: 14, paddingBottom: 120 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14141E',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  listThumb: { width: 72, height: 106, backgroundColor: CONFIG.COLORS.card },
  listBody: { flex: 1, padding: 12, gap: 6 },
  listTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', lineHeight: 19 },
  listTypePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(229,9,20,0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.35)',
  },
  listTypePillSeries: {
    backgroundColor: 'rgba(6,182,212,0.12)',
    borderColor: 'rgba(6,182,212,0.35)',
  },
  listTypeText: { color: CONFIG.COLORS.accent, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  listTypeTextSeries: { color: '#22d3ee' },
  listActions: {
    flexDirection: 'column',
    gap: 6,
    paddingRight: 12,
    alignItems: 'center',
  },
  listPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(229,9,20,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.35)',
  },
  listPlayText: { color: CONFIG.COLORS.accent, fontSize: 12, fontWeight: '900', marginLeft: 2 },
  listRemoveBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  listRemoveText: { color: '#52525b', fontSize: 11, fontWeight: '800' },
});
