import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, Image,
  TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CONFIG } from '../config';
import { api, MovieCard as MovieCardData, Feed } from '../services/api';

const { width } = Dimensions.get('window');
const HERO_H = 430;

const CATEGORIES = ['All', 'Movies', 'TV Series', 'Anime', 'Trending'] as const;
type Category = typeof CATEGORIES[number];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');

  const loadFeed = useCallback(async () => {
    try {
      const data = await api.feed();
      setFeed(data);
      setError(null);
    } catch (e: any) {
      setError('Could not connect to streaming server. Please verify network connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Auto-rotate hero spotlight every 4.5s
  useEffect(() => {
    if (!feed?.trending?.length) return;
    const timer = setInterval(() => {
      setHeroIndex(i => (i + 1) % Math.min(feed.trending.length, 5));
    }, 4500);
    return () => clearInterval(timer);
  }, [feed]);

  const openDetail = (movie: MovieCardData) => {
    navigation.navigate('Detail', {
      id: movie.subject_id,
      title: movie.title,
      cover: movie.cover,
    });
  };

  const openPlayer = (movie: MovieCardData) => {
    navigation.navigate('Player', {
      id: movie.subject_id,
      title: movie.title,
      cover: movie.cover,
      type: 'Movie',
    });
  };

  const allSections = useMemo(() => [
    { id: 'trending', title: 'Trending Now', icon: 'trending-up-outline', category: 'Trending', data: feed?.trending || [] },
    { id: 'cinema', title: 'In Cinema', icon: 'film-outline', category: 'Movies', data: feed?.cinema || [] },
    { id: 'hollywood', title: 'Hollywood Blockbusters', icon: 'sparkles-outline', category: 'Movies', data: feed?.hollywood || [] },
    { id: 'bollywood', title: 'Bollywood Hits', icon: 'star-outline', category: 'Movies', data: feed?.bollywood || [] },
    { id: 'south_indian', title: 'South Indian Cinema', icon: 'flash-outline', category: 'Movies', data: feed?.south_indian || [] },
    { id: 'series', title: 'Top TV Series', icon: 'tv-outline', category: 'TV Series', data: feed?.series || [] },
    { id: 'anime', title: 'Anime & Animation', icon: 'color-wand-outline', category: 'Anime', data: feed?.anime || [] },
    { id: 'asian_drama', title: 'Asian & K-Drama', icon: 'heart-outline', category: 'TV Series', data: feed?.asian_drama || [] },
  ], [feed]);

  const filteredSections = useMemo(() => {
    return allSections.filter(s => {
      if (!s.data || s.data.length === 0) return false;
      if (selectedCategory === 'All') return true;
      if (selectedCategory === 'Trending') return s.id === 'trending';
      if (selectedCategory === 'Movies') return ['cinema', 'hollywood', 'bollywood', 'south_indian'].includes(s.id);
      if (selectedCategory === 'TV Series') return ['series', 'asian_drama'].includes(s.id);
      if (selectedCategory === 'Anime') return s.id === 'anime';
      return true;
    });
  }, [allSections, selectedCategory]);

  const formatRating = (val?: string | number) => {
    if (!val || val === 'N/A') return null;
    const num = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(num) ? null : num.toFixed(1);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#E50914" />
        <Text style={styles.loadingText}>Initializing Cinema Engine…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={54} color="#ef4444" style={{ marginBottom: 12 }} />
        <Text style={styles.errorTitle}>Connection Offline</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => { setLoading(true); loadFeed(); }}
          activeOpacity={0.85}
        >
          <Text style={styles.retryText}>Reconnect Server</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hero = feed?.trending?.[heroIndex];
  const heroRating = hero ? formatRating(hero.rating || hero.imdb_rating) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Modern Spatial Navbar */}
      <View style={styles.navbar}>
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <Ionicons name="film" size={14} color="#fff" />
          </View>
          <Text style={styles.brandText}>CINE<Text style={{ color: '#E50914' }}>SCOPE</Text></Text>
        </View>
        <TouchableOpacity
          style={styles.searchPill}
          onPress={() => navigation.navigate('Search')}
          activeOpacity={0.8}
        >
          <Ionicons name="search-outline" size={15} color="#94a3b8" style={{ marginRight: 6 }} />
          <Text style={styles.searchPillText}>Search movies, shows…</Text>
        </TouchableOpacity>
      </View>

      {/* Category Pills Bar */}
      <View style={styles.categoryBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map(cat => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.75}
              >
                <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Fluid Scroll Area */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        bounces
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadFeed(); }}
            tintColor="#E50914"
            colors={['#E50914']}
          />
        }
      >
        {/* Apple TV+ / Netflix Hero Spotlight */}
        {hero && (
          <View style={styles.heroWrapper}>
            <TouchableOpacity
              style={styles.hero}
              activeOpacity={0.92}
              onPress={() => openDetail(hero)}
            >
              <Image
                source={{ uri: hero.cover }}
                style={styles.heroImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(8,10,15,0.4)', '#080A0F']}
                style={styles.heroGradient}
                pointerEvents="none"
              />

              <View style={styles.heroContent} pointerEvents="box-none">
                {/* Bento Match & Quality Badges */}
                <View style={styles.bentoRow}>
                  <View style={styles.matchBadge}>
                    <Text style={styles.matchText}>98% MATCH</Text>
                  </View>
                  <View style={styles.fhdBadge}>
                    <Text style={styles.fhdText}>1080p FHD</Text>
                  </View>
                  <View style={styles.audioBadge}>
                    <Text style={styles.audioText}>DOLBY 5.1</Text>
                  </View>
                  {heroRating ? (
                    <View style={styles.starBadge}>
                      <Ionicons name="star" size={11} color="#eab308" style={{ marginRight: 4 }} />
                      <Text style={styles.starText}>{heroRating}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Hero Title */}
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {hero.title}
                </Text>

                {/* Genre Tag */}
                {hero.genre ? (
                  <Text style={styles.heroGenre}>
                    {hero.genre.split(',').slice(0, 3).join(' • ')}
                  </Text>
                ) : null}

                {/* Action Buttons */}
                <View style={styles.heroButtons}>
                  <TouchableOpacity
                    style={styles.playBtnPrimary}
                    onPress={() => openPlayer(hero)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="play" size={17} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.playBtnText}>Stream Now</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.infoBtnSecondary}
                    onPress={() => openDetail(hero)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="information-circle-outline" size={19} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.infoBtnText}>Details & Dubs</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Spotlight Indicators */}
              <View style={styles.heroDots} pointerEvents="none">
                {feed?.trending?.slice(0, 5).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === heroIndex && styles.dotActive]}
                  />
                ))}
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Dynamic Content Shelves */}
        {filteredSections.map(section => (
          <View key={section.id} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Ionicons name={section.icon as any} size={16} color="#E50914" />
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              <Text style={styles.sectionCount}>{section.data.length} Titles</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shelf}
            >
              {section.data.map(item => {
                const itemRating = formatRating(item.rating || item.imdb_rating);
                return (
                  <TouchableOpacity
                    key={item.subject_id}
                    style={styles.shelfCard}
                    onPress={() => openDetail(item)}
                    activeOpacity={0.78}
                  >
                    <View style={styles.posterWrapper}>
                      <Image
                        source={{ uri: item.cover }}
                        style={styles.shelfPoster}
                        resizeMode="cover"
                      />
                      {itemRating ? (
                        <View style={styles.ratingBadge}>
                          <Ionicons name="star" size={9} color="#eab308" style={{ marginRight: 3 }} />
                          <Text style={styles.ratingBadgeText}>{itemRating}</Text>
                        </View>
                      ) : null}
                      <View style={styles.qualityTag}>
                        <Text style={styles.qualityTagText}>1080p</Text>
                      </View>
                    </View>
                    <Text style={styles.shelfTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080A0F',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#080A0F',
    padding: 24,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 14,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  errorIcon: { fontSize: 44, marginBottom: 12 },
  errorTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  errorText: {
    color: '#94A3B8',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: '#E50914',
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  retryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },

  // Navbar
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#080A0F',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#E50914',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  brandGlyph: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginLeft: 2 },
  brandText: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121520',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 6,
  },
  searchPillIcon: { fontSize: 12 },
  searchPillText: { color: '#94A3B8', fontSize: 12, fontWeight: '500' },

  // Category Filter Bar
  categoryBar: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#10131C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  categoryChipActive: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  categoryChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Hero Spotlight
  heroWrapper: {
    width,
    height: HERO_H,
    marginBottom: 8,
  },
  hero: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroContent: {
    position: 'absolute',
    bottom: 38,
    left: 16,
    right: 16,
  },
  bentoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  matchBadge: {
    backgroundColor: 'rgba(0, 229, 153, 0.15)',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 153, 0.4)',
  },
  matchText: {
    color: '#00E599',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  fhdBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  fhdText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  audioBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  audioText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  starBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  starText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '800',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroGenre: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 14,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  playBtnPrimary: {
    flex: 1,
    backgroundColor: '#E50914',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  playBtnIcon: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  playBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  infoBtnSecondary: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  infoBtnIcon: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  infoBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  heroDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    backgroundColor: '#E50914',
    width: 20,
  },

  // Shelves
  section: {
    paddingTop: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionCount: {
    color: '#525866',
    fontSize: 11,
    fontWeight: '600',
  },
  shelf: {
    paddingHorizontal: 16,
    gap: 12,
  },
  shelfCard: {
    width: 116,
  },
  posterWrapper: {
    width: 116,
    height: 172,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#10131C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    position: 'relative',
  },
  shelfPoster: {
    width: '100%',
    height: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(8,10,15,0.85)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  ratingBadgeText: {
    color: '#FBBF24',
    fontSize: 9,
    fontWeight: '800',
  },
  qualityTag: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(8,10,15,0.85)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  qualityTagText: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '800',
  },
  shelfTitle: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 15,
  },
});
