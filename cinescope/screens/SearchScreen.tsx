import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, Image,
  TouchableOpacity, StyleSheet, ActivityIndicator,
  Keyboard, ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CONFIG } from '../config';
import { api, SearchResult } from '../services/api';

const TRENDING_SEARCHES = [
  'Inception', 'Breaking Bad', 'The Batman', 'Oppenheimer',
  'Interstellar', 'Attack on Titan', 'The Bear', 'Dune',
];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.search(q);
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, []);

  const onChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text), 450);
  };

  const openDetail = (item: SearchResult) => {
    Keyboard.dismiss();
    navigation.navigate('Detail', {
      id: item.subject_id,
      title: item.title,
      cover: item.cover,
    });
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    inputRef.current?.focus();
  };

  const getTypeStyle = (type?: string) => {
    if (type === 'Series') return { bg: 'rgba(6,182,212,0.18)', border: 'rgba(6,182,212,0.45)', text: '#22d3ee' };
    return { bg: 'rgba(229,9,20,0.15)', border: 'rgba(229,9,20,0.45)', text: '#ff4d4f' };
  };

  const formatRating = (val?: string | number) => {
    if (!val || val === 'N/A') return null;
    const n = typeof val === 'number' ? val : parseFloat(String(val));
    return isNaN(n) ? null : n.toFixed(1);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Movies, shows, anime, actors…"
            placeholderTextColor="#4a4a5a"
            value={query}
            onChangeText={onChangeText}
            returnKeyType="search"
            onSubmitEditing={() => doSearch(query)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={CONFIG.COLORS.accent} />
          <Text style={styles.loadingText}>Searching…</Text>
        </View>
      ) : !searched ? (
        /* Trending Discovery Section */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.trendingSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Ionicons name="trending-up-outline" size={15} color="#e50914" />
              <Text style={styles.trendingLabel}>TRENDING SEARCHES</Text>
            </View>
            <View style={styles.trendingChips}>
              {TRENDING_SEARCHES.map(term => (
                <TouchableOpacity
                  key={term}
                  style={styles.trendingChip}
                  onPress={() => { setQuery(term); doSearch(term); }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.trendingChipText}>{term}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.emptyHero}>
            <Ionicons name="film-outline" size={48} color="#27272a" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>Find Your Next Watch</Text>
            <Text style={styles.emptySubtitle}>
              Search millions of movies, TV shows, and anime titles
            </Text>
          </View>
        </ScrollView>
      ) : results.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color="#27272a" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>No Results for "{query}"</Text>
          <Text style={styles.emptySubtitle}>Try a different title, actor, or genre</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.subject_id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text style={styles.resultCount}>{results.length} Results for "{query}"</Text>
          }
          renderItem={({ item }) => {
            const typeStyle = getTypeStyle(item.type);
            const rating = formatRating(item.imdb_rating || item.rating);
            return (
              <TouchableOpacity
                style={styles.resultCard}
                onPress={() => openDetail(item)}
                activeOpacity={0.78}
              >
                <Image
                  source={{ uri: item.cover || 'https://via.placeholder.com/70x100/10131C/333' }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
                <View style={styles.resultBody}>
                  <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.resultMeta}>
                    {item.type && (
                      <View style={[styles.typePill, { backgroundColor: typeStyle.bg, borderColor: typeStyle.border }]}>
                        <Text style={[styles.typePillText, { color: typeStyle.text }]}>
                          {item.type === 'Series' ? 'TV SHOW' : 'MOVIE'}
                        </Text>
                      </View>
                    )}
                    {item.year && <Text style={styles.metaText}>{String(item.year)}</Text>}
                    {rating && (
                      <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={10} color="#eab308" style={{ marginRight: 3 }} />
                        <Text style={styles.ratingText}>{rating}</Text>
                      </View>
                    )}
                  </View>
                  {item.genre ? (
                    <Text style={styles.genreText} numberOfLines={1}>{item.genre}</Text>
                  ) : null}
                </View>
                <View style={styles.playChip}>
                  <Ionicons name="play" size={12} color="#fff" />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CONFIG.COLORS.bg,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C28',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  searchIconText: {
    color: '#52525b',
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 24,
    marginTop: -2,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  clearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  emptyHero: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
    gap: 8,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 6 },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
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
  loadingText: {
    color: '#52525b',
    fontSize: 13,
    marginTop: 10,
    fontWeight: '500',
  },

  trendingSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  trendingLabel: {
    color: '#52525b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  trendingChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trendingChip: {
    backgroundColor: '#1C1C28',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  trendingChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },

  list: { padding: 14, gap: 2, paddingBottom: 120 },
  resultCount: {
    color: '#52525b',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  resultCard: {
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
  thumb: {
    width: 72,
    height: 106,
    backgroundColor: CONFIG.COLORS.card,
  },
  resultBody: {
    flex: 1,
    padding: 12,
    gap: 5,
  },
  resultTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  typePill: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  typePillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  metaText: { color: '#52525b', fontSize: 12 },
  ratingBadge: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  ratingText: { color: '#FBBF24', fontSize: 11, fontWeight: '700' },
  genreText: { color: '#3f3f46', fontSize: 11, fontWeight: '500' },

  playChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(229,9,20,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.3)',
  },
  playChipText: { color: CONFIG.COLORS.accent, fontSize: 12, fontWeight: '900', marginLeft: 2 },
});
