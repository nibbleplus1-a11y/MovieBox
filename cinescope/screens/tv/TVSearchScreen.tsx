/**
 * TVSearchScreen — TV-optimised search with large input, results grid.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, Dimensions, Image, ActivityIndicator, Keyboard,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { api, MovieCard as MovieCardData, SearchResult, resolvePoster } from '../../services/api';
import { CONFIG } from '../../config';

const COLS   = 6;
const PAD    = 48;
const GAP    = 14;

const TVResultCard = React.memo(({
  item, onPress, cardW, cardH,
}: {
  item: SearchResult;
  onPress: (i: SearchResult) => void;
  cardW: number;
  cardH: number;
}) => (
  <TouchableOpacity onPress={() => onPress(item)} activeOpacity={0.82} style={[styles.card, { width: cardW }]}>
    <Image source={{ uri: resolvePoster(item.cover) }} style={[styles.cardImg, { width: cardW, height: cardH }]} resizeMode="cover" />
    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.cardGrad}>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      {item.year ? <Text style={styles.cardYear}>{item.year}</Text> : null}
    </LinearGradient>
  </TouchableOpacity>
));

export default function TVSearchScreen() {
  const navigation = useNavigation<any>();
  const [query, setQuery]   = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const { width: winW, height: winH } = useWindowDimensions();
  const screenW = Math.max(winW, winH);
  const cardW = Math.max(140, Math.floor((screenW - PAD * 2 - GAP * (COLS - 1)) / COLS));
  const cardH = Math.floor(cardW * 1.46);

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);
    try {
      const data = await api.search(trimmed);
      setResults((data?.results ?? []) as SearchResult[]);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const goDetail = useCallback((item: SearchResult) => {
    navigation.navigate('Detail', { subjectId: item.subject_id, item });
  }, [navigation]);

  return (
    <View style={styles.root}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={28} color="rgba(255,255,255,0.5)" style={{ marginRight: 12 }} />
        <TextInput
          style={styles.input}
          placeholder="Search movies, series, anime…"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => doSearch(query)}
          returnKeyType="search"
          autoFocus
          selectionColor={CONFIG.COLORS.accent}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
            <Ionicons name="close-circle" size={24} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.searchBtn} onPress={() => doSearch(query)}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={CONFIG.COLORS.accent} />
          <Text style={styles.hint}>Searching…</Text>
        </View>
      ) : searched && results.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="film-outline" size={64} color="rgba(255,255,255,0.15)" />
          <Text style={styles.hint}>No results for "{query}"</Text>
        </View>
      ) : !searched ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={80} color="rgba(255,255,255,0.08)" />
          <Text style={styles.hintBig}>What do you want to watch?</Text>
          <Text style={styles.hint}>Type a title and press Search</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.subject_id}
          numColumns={COLS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: GAP }}
          renderItem={({ item }) => <TVResultCard item={item} onPress={goDetail} cardW={cardW} cardH={cardH} />}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0F' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 48, marginTop: 32, marginBottom: 24,
    backgroundColor: '#16161E', borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1, fontSize: 20, color: '#fff', fontWeight: '500',
  },
  searchBtn: {
    backgroundColor: CONFIG.COLORS.accent, borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 10, marginLeft: 14,
  },
  searchBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  hintBig: { color: 'rgba(255,255,255,0.5)', fontSize: 24, fontWeight: '700' },
  hint: { color: 'rgba(255,255,255,0.3)', fontSize: 16 },

  grid: { paddingHorizontal: PAD, paddingBottom: 40 },

  card: {
    borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#16161E',
  },
  cardImg: { borderRadius: 10 },
  cardGrad: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 8, paddingTop: 28, paddingBottom: 8,
  },
  cardTitle: { color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 16 },
  cardYear:  { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },
});
