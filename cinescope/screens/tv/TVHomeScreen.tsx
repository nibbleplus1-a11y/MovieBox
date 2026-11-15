/**
 * TVHomeScreen — Android TV / Android Box optimised home screen.
 * Design: 1:1 Netflix / Prime Video "10-foot" layout.
 *   • Full-bleed animated hero banner (auto-cycles every 6 s)
 *   • Horizontal movie carousels with large 16:9 thumbnails
 *   • Bold focus rings for D-pad / remote navigation
 *   • Giant category tabs at the top (← → arrow keys)
 *   • Zero-clutter, 4-year-old friendly
 */
import React, {
  useCallback, useEffect, useRef, useState, useMemo,
} from 'react';
import {
  View, Text, Image, TouchableOpacity, FlatList,
  StyleSheet, Dimensions, Animated, ImageBackground,
  ScrollView, Platform, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { api, MovieCard as MovieCardData, Feed, resolvePoster } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../../config';

export const TVDimensionsContext = React.createContext({
  screenW: 1920,
  screenH: 1080,
  heroH: 650,
  cardW: 240,
  cardH: 355,
});

const GAP = 18;
const CATEGORIES = ['All', 'Movies', 'TV Series', 'Anime', 'Trending'] as const;
type Category = typeof CATEGORIES[number];

const CACHE_KEY = 'cinescope_feed_cache_v1';

// Map of Feed keys → section metadata
const FEED_SECTIONS: { key: keyof Feed; title: string; icon: string }[] = [
  { key: 'trending',      title: 'Trending Now',    icon: 'flame' },
  { key: 'cinema',        title: 'Now In Cinema',   icon: 'film' },
  { key: 'hollywood',     title: 'Hollywood',       icon: 'star' },
  { key: 'bollywood',     title: 'Bollywood',       icon: 'musical-notes' },
  { key: 'series',        title: 'TV Series',       icon: 'tv' },
  { key: 'anime',         title: 'Anime',           icon: 'sparkles' },
  { key: 'asian_drama',   title: 'Asian Drama',     icon: 'earth' },
  { key: 'top_rated',     title: 'Top Rated',       icon: 'trophy' },
  { key: 'new_releases',  title: 'New Releases',    icon: 'rocket' },
  { key: 'action',        title: 'Action',          icon: 'flash' },
  { key: 'scifi',         title: 'Sci-Fi',          icon: 'planet' },
  { key: 'comedy',        title: 'Comedy',          icon: 'happy' },
  { key: 'horror',        title: 'Horror',          icon: 'skull' },
  { key: 'anime_series',  title: 'Anime Series',    icon: 'library' },
  { key: 'cartoons',      title: 'Cartoons',        icon: 'color-palette' },
];

// Sections with data
type SectionData = { id: string; title: string; icon: string; data: MovieCardData[] };

function buildSections(feed: Feed | null, category: Category): SectionData[] {
  if (!feed) return [];
  const all: SectionData[] = FEED_SECTIONS
    .filter((s) => Array.isArray(feed[s.key]) && (feed[s.key] as MovieCardData[]).length > 0)
    .map((s) => ({ id: s.key, title: s.title, icon: s.icon, data: feed[s.key] as MovieCardData[] }));

  if (category === 'All') return all;
  const catLower = category.toLowerCase();
  return all.filter((s) => s.title.toLowerCase().includes(catLower) || s.id.toLowerCase().includes(catLower));
}

// ─── Utility ────────────────────────────────────────────────────────────────
const formatRating = (val?: string | number) => {
  if (!val || val === 'N/A') return null;
  const n = typeof val === 'number' ? val : parseFloat(val as string);
  return isNaN(n) ? null : n.toFixed(1);
};

// ─── Large TV Card ───────────────────────────────────────────────────────────
const TVCard = React.memo(({
  item, onPress, focused,
}: {
  item: MovieCardData;
  onPress: (item: MovieCardData) => void;
  focused?: boolean;
}) => {
  const { cardW, cardH } = React.useContext(TVDimensionsContext);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.08 : 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [focused]);

  const rating = formatRating(item.rating || item.imdb_rating);

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <Animated.View style={[styles.card, { width: cardW, transform: [{ scale }] }]}>
        {focused && <View style={styles.focusRing} />}
        <Image
          source={{ uri: resolvePoster(item.cover) }}
          style={[styles.cardPoster, { width: cardW, height: cardH }]}
          resizeMode="cover"
        />
        {/* quality badge */}
        <View style={styles.qualityBadge}>
          <Text style={styles.qualityText}>1080p</Text>
        </View>
        {/* rating */}
        {rating ? (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={11} color="#eab308" />
            <Text style={styles.ratingText}>{rating}</Text>
          </View>
        ) : null}
        {/* title bar */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.88)']}
          style={styles.cardGrad}
        >
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── Horizontal shelf ────────────────────────────────────────────────────────
const TVShelf = React.memo(({
  section,
  onPress,
}: {
  section: { id: string; title: string; icon: string; data: MovieCardData[] };
  onPress: (item: MovieCardData) => void;
}) => {
  const { cardW } = React.useContext(TVDimensionsContext);
  const renderItem = useCallback(
    ({ item }: { item: MovieCardData }) => (
      <TVCard item={item} onPress={onPress} />
    ),
    [onPress]
  );

  return (
    <View style={styles.shelf}>
      <View style={styles.shelfHeader}>
        <Ionicons name={section.icon as any} size={20} color={CONFIG.COLORS.accent} />
        <Text style={styles.shelfTitle}>{section.title}</Text>
      </View>
      <FlatList
        horizontal
        data={section.data}
        keyExtractor={(item) => item.subject_id}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 48, gap: GAP }}
        snapToInterval={cardW + GAP}
        decelerationRate="fast"
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        removeClippedSubviews
      />
    </View>
  );
});

// ─── Hero Banner ─────────────────────────────────────────────────────────────
const HeroBanner = React.memo(({
  items,
  onPlay,
  onInfo,
}: {
  items: MovieCardData[];
  onPlay: (item: MovieCardData) => void;
  onInfo: (item: MovieCardData) => void;
}) => {
  const { screenW, heroH } = React.useContext(TVDimensionsContext);
  const [idx, setIdx] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  const crossfadeTo = useCallback((next: number) => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    setIdx(next);
  }, [opacity]);

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => {
      setIdx((prev) => {
        const next = (prev + 1) % items.length;
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]).start();
        return next;
      });
    }, 6000);
    return () => clearInterval(t);
  }, [items.length]);

  if (!items.length) return null;
  const item = items[idx];
  const rating = formatRating(item.rating || item.imdb_rating);

  return (
    <View style={[styles.hero, { height: heroH }]}>
      <Animated.View style={[{ flex: 1 }, { opacity }]}>
        <ImageBackground
          source={{ uri: resolvePoster(item.cover) }}
          style={styles.heroBg}
          resizeMode="cover"
        >
          {/* gradient overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(10,10,15,0.35)', '#0A0A0F']}
            locations={[0.3, 0.72, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* left side info */}
          <View style={[styles.heroInfo, { maxWidth: Math.min(850, screenW * 0.55) }]}>
            {/* badges row */}
            <View style={styles.heroBadges}>
              {rating ? (
                <View style={styles.heroBadge}>
                  <Ionicons name="star" size={14} color="#eab308" />
                  <Text style={styles.heroBadgeText}>{rating}</Text>
                </View>
              ) : null}
              <View style={[styles.heroBadge, { backgroundColor: CONFIG.COLORS.accent }]}>
                <Text style={styles.heroBadgeText}>1080P</Text>
              </View>
              {item.year ? (
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{item.year}</Text>
                </View>
              ) : null}
            </View>
            {/* title */}
            <Text style={styles.heroTitle} numberOfLines={2}>{item.title}</Text>
            {/* genre subtitle */}
            {(item as any).genre ? (
              <Text style={styles.heroDesc} numberOfLines={1}>{(item as any).genre}</Text>
            ) : null}
            {/* CTA buttons */}
            <View style={styles.heroCTAs}>
              <TouchableOpacity
                style={styles.heroPlayBtn}
                onPress={() => onPlay(item)}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel={`Play ${item.title}`}
              >
                <Ionicons name="play" size={22} color="#000" />
                <Text style={styles.heroPlayText}>  Play</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heroInfoBtn}
                onPress={() => onInfo(item)}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel={`More info about ${item.title}`}
              >
                <Ionicons name="information-circle-outline" size={22} color="#fff" />
                <Text style={styles.heroInfoText}>  More Info</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>
      </Animated.View>
      {/* dot indicators */}
      <View style={styles.heroDots}>
        {items.slice(0, 7).map((_, i) => (
          <TouchableOpacity key={i} onPress={() => crossfadeTo(i)}>
            <View style={[styles.heroDot, i === idx && styles.heroDotActive]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

// ─── Category Tab Bar ────────────────────────────────────────────────────────
const CategoryBar = React.memo(({
  selected,
  onSelect,
}: {
  selected: Category;
  onSelect: (c: Category) => void;
}) => (
  <View style={styles.categoryBar}>
    {/* Logo / branding */}
    <Text style={styles.tvLogo}>{CONFIG.APP_NAME}</Text>
    <View style={styles.catTabs}>
      {CATEGORIES.map((cat) => {
        const active = cat === selected;
        return (
          <TouchableOpacity
            key={cat}
            onPress={() => onSelect(cat)}
            style={[styles.catTab, active && styles.catTabActive]}
            activeOpacity={0.8}
          >
            <Text style={[styles.catTabText, active && styles.catTabTextActive]}>
              {cat}
            </Text>
            {active && <View style={styles.catUnderline} />}
          </TouchableOpacity>
        );
      })}
    </View>
    {/* right side: search icon */}
    <TouchableOpacity style={styles.catSearch}>
      <Ionicons name="search" size={26} color="rgba(255,255,255,0.7)" />
    </TouchableOpacity>
  </View>
));

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function TVHomeScreen() {
  const navigation = useNavigation<any>();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category>('All');
  const [refreshing, setRefreshing] = useState(false);

  const { width: winW, height: winH } = useWindowDimensions();
  const screenW = Math.max(winW, winH);
  const screenH = Math.min(winW, winH);

  // 1:1 Netflix / Prime TV sizing:
  // Hero is 60-65% of screen height and 100% full width
  const heroH = Math.round(screenH * 0.62);
  // Exactly ~5.5 cards visible per row for a massive, cinematic 10-foot look
  const cardW = Math.max(180, Math.round((screenW - 140) / 5.5));
  const cardH = Math.round(cardW * 1.48);

  const dimValue = useMemo(() => ({
    screenW, screenH, heroH, cardW, cardH,
  }), [screenW, screenH, heroH, cardW, cardH]);

  const loadFeed = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      // Try cache first for instant display
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        try { setFeed(JSON.parse(cached)); setLoading(false); } catch {}
      }
      const data = await api.feed();
      setFeed(data);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
    } catch (e) {
      console.warn('[TVHome] feed load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadFeed(); }, [loadFeed]));

  const goDetail = useCallback((item: MovieCardData) => {
    // Pre-warm stream in background for ultra-fast playback
    api.streams(item.subject_id, 0, 0, (item as any).detail_path).catch(() => {});
    navigation.navigate('Detail', {
      id: item.subject_id,
      subjectId: item.subject_id,
      title: item.title,
      cover: item.cover,
      detailPath: (item as any).detail_path,
      item,
    });
  }, [navigation]);

  const goPlay = useCallback((item: MovieCardData) => {
    // Pre-warm stream in background for ultra-fast playback
    api.streams(item.subject_id, 0, 0, (item as any).detail_path).catch(() => {});
    navigation.navigate('Detail', {
      id: item.subject_id,
      subjectId: item.subject_id,
      title: item.title,
      cover: item.cover,
      detailPath: (item as any).detail_path,
      item,
      autoPlay: true,
    });
  }, [navigation]);

  // Build sections from raw Feed object
  const sections = useMemo(() => buildSections(feed, category), [feed, category]);

  // Hero items — first section's first 7 items
  const heroItems = useMemo(() =>
    feed?.trending?.slice(0, 7) ?? [],
    [feed]
  );

  if (loading && !feed) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={CONFIG.COLORS.accent} />
        <Text style={styles.loaderText}>Loading…</Text>
      </View>
    );
  }

  return (
    <TVDimensionsContext.Provider value={dimValue}>
      <View style={styles.root}>
        {/* Fixed top nav */}
        <CategoryBar selected={category} onSelect={setCategory} />

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          {/* Hero */}
          <HeroBanner items={heroItems} onPlay={goPlay} onInfo={goDetail} />

          {/* Shelves */}
          {sections.map((section) => (
            <TVShelf key={section.id} section={section} onPress={goDetail} />
          ))}
        </ScrollView>
      </View>
    </TVDimensionsContext.Provider>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },

  // Loading
  loader: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0A0A0F', gap: 16,
  },
  loaderText: {
    color: 'rgba(255,255,255,0.5)', fontSize: 18,
  },

  // Category bar (top nav)
  categoryBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 48, paddingTop: 22, paddingBottom: 14,
    gap: 12,
    // subtle gradient so nav doesn't cover hero
    backgroundColor: 'rgba(10,10,15,0.75)',
  },
  tvLogo: {
    fontSize: 22, fontWeight: '900', color: CONFIG.COLORS.accent,
    letterSpacing: 1.5, marginRight: 24,
    textShadowColor: 'rgba(255,46,85,0.6)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 },
  },
  catTabs: {
    flex: 1, flexDirection: 'row', gap: 6,
  },
  catTab: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8,
    alignItems: 'center',
  },
  catTabActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  catTabText: {
    fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.5,
  },
  catTabTextActive: {
    color: '#fff', fontWeight: '800',
  },
  catUnderline: {
    position: 'absolute', bottom: 2, left: 20, right: 20, height: 3,
    backgroundColor: CONFIG.COLORS.accent, borderRadius: 2,
  },
  catSearch: {
    padding: 10, marginLeft: 8,
  },

  // Hero
  hero: {
    width: '100%', marginTop: 0,
  },
  heroBg: {
    flex: 1, justifyContent: 'flex-end',
  },
  heroInfo: {
    paddingHorizontal: 60, paddingBottom: 50,
  },
  heroBadges: {
    flexDirection: 'row', gap: 8, marginBottom: 12,
  },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  heroBadgeText: {
    color: '#fff', fontSize: 13, fontWeight: '700',
  },
  heroTitle: {
    fontSize: 46, fontWeight: '900', color: '#fff',
    lineHeight: 52, marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 },
  },
  heroDesc: {
    fontSize: 15, color: 'rgba(255,255,255,0.72)',
    lineHeight: 22, marginBottom: 24,
  },
  heroCTAs: {
    flexDirection: 'row', gap: 16, alignItems: 'center',
  },
  heroPlayBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 36, paddingVertical: 14,
    elevation: 6,
  },
  heroPlayText: {
    color: '#000', fontSize: 18, fontWeight: '900',
  },
  heroInfoBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 10,
    paddingHorizontal: 28, paddingVertical: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
  },
  heroInfoText: {
    color: '#fff', fontSize: 18, fontWeight: '700',
  },
  heroDots: {
    position: 'absolute', bottom: 14, right: 60,
    flexDirection: 'row', gap: 7,
  },
  heroDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  heroDotActive: {
    backgroundColor: CONFIG.COLORS.accent, width: 22,
  },

  // Shelf
  shelf: {
    marginTop: 32,
  },
  shelfHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 48, marginBottom: 14,
  },
  shelfTitle: {
    fontSize: 20, fontWeight: '800', color: '#fff',
    letterSpacing: 0.3,
  },

  // Card
  card: {
    borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#16161E',
  },
  focusRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#fff',
    zIndex: 10,
  },
  cardPoster: {
    borderRadius: 10,
  },
  qualityBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  qualityText: {
    color: '#fff', fontSize: 11, fontWeight: '800',
  },
  ratingBadge: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  ratingText: {
    color: '#fff', fontSize: 11, fontWeight: '700',
  },
  cardGrad: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 10, paddingTop: 32, paddingBottom: 10,
  },
  cardTitle: {
    color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 17,
  },
});
