import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Share, Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, DetailData } from '../services/api';
import { WatchlistService } from '../services/watchlist';

const { width } = Dimensions.get('window');
const BACKDROP_H = 330;

// â”€â”€ Duration formatter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function formatDuration(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    if (/\d+h/i.test(raw) || /\d+m/i.test(raw)) return raw;
    const mins = parseInt(raw, 10);
    if (isNaN(mins) || mins <= 0) return null;
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  if (typeof raw === 'number' && raw > 0) {
    // Heuristic: values > 500 are likely seconds, smaller are minutes
    const mins = raw > 500 ? Math.round(raw / 60) : raw;
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  return null;
}

// â”€â”€ Skeleton shimmer box â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ShimmerBox({ w, h, radius = 8, style }: { w: any; h: number; radius?: number; style?: any }) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[{ width: w, height: h, borderRadius: radius, backgroundColor: '#1E2235' }, style, { opacity }]} />;
}

function SkeletonDetail() {
  return (
    <View style={{ flex: 1, backgroundColor: '#080A0F' }}>
      <ShimmerBox w={width} h={BACKDROP_H} radius={0} />
      <View style={{ paddingHorizontal: 16, marginTop: -90 }}>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <ShimmerBox w={110} h={165} radius={12} />
          <View style={{ flex: 1, paddingTop: 80, gap: 10 }}>
            <ShimmerBox w="90%" h={22} />
            <ShimmerBox w="50%" h={14} />
            <ShimmerBox w="65%" h={14} />
            <ShimmerBox w="55%" h={12} />
          </View>
        </View>
        <ShimmerBox w="100%" h={52} radius={14} style={{ marginTop: 20 }} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <ShimmerBox w="32%" h={48} radius={10} />
          <ShimmerBox w="32%" h={48} radius={10} />
          <ShimmerBox w="32%" h={48} radius={10} />
        </View>
        <ShimmerBox w="40%" h={13} style={{ marginTop: 26 }} />
        <ShimmerBox w="100%" h={13} style={{ marginTop: 10 }} />
        <ShimmerBox w="92%" h={13} style={{ marginTop: 6 }} />
        <ShimmerBox w="78%" h={13} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

// â”€â”€ Section wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={S.section}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={S.sectionSub}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

// â”€â”€ Main Screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function DetailScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { id, title: initTitle, cover: initCover } = route.params || {};

  const [detail, setDetail]                   = useState<DetailData | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [inWatchlist, setInWatchlist]         = useState(false);
  const [seasonsData, setSeasonsData]         = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason]   = useState(1);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const fadeIn = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [d, wl] = await Promise.all([
        api.detail(id),
        WatchlistService.has(id).catch(() => false),
      ]);
      setDetail(d);
      setInWatchlist(Boolean(wl));
      if (d?.type === 'Series' || d?.type === 'TV Series') {
        const ep = await api.episodes(id).catch(() => ({ seasons: [] }));
        if (ep?.seasons?.length) {
          setSeasonsData(ep.seasons);
          setSelectedSeason(ep.seasons[0].season || 1);
        }
      }
      Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch {
      setError('Could not load details. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleWatchlist = async () => {
    if (inWatchlist) {
      await WatchlistService.remove(id); setInWatchlist(false);
    } else {
      await WatchlistService.add({ subject_id: id, title: detail?.title || initTitle, cover: detail?.cover || initCover, type: detail?.type, addedAt: Date.now() });
      setInWatchlist(true);
    }
  };

  const playNow = (dubId?: string, dubName?: string, season = 0, ep = 0) =>
    navigation.navigate('Player', {
      id: dubId || id, title: detail?.title || initTitle, cover: detail?.cover || initCover,
      initialDub: dubName, season, episode: ep, type: detail?.type || 'Movie',
    });

  // â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const d            = detail;
  const cover        = d?.cover || initCover;
  const title        = d?.title || initTitle;
  const rawRating    = (d as any)?.imdb_rating ?? (d as any)?.rating;
  const rating       = (() => { const n = parseFloat(String(rawRating || '')); return isNaN(n) ? null : n.toFixed(1); })();
  const durationStr  = formatDuration((d as any)?.duration || (d as any)?.duration_seconds);
  const isSeries     = d?.type === 'Series' || d?.type === 'TV Series' || seasonsData.length > 0;
  const activeSeason = seasonsData.find(s => s.season === selectedSeason) || seasonsData[0];
  const episodes     = (() => {
    if (!activeSeason) return [];
    if (activeSeason.episodes?.length > 0) return activeSeason.episodes;
    return Array.from({ length: activeSeason.episode_count || 1 }, (_, i) => ({
      season: activeSeason.season, episode: i + 1, title: `Episode ${i + 1}`,
    }));
  })();

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (loading) return <SkeletonDetail />;

  if (error) return (
    <View style={S.errorScreen}>
      <StatusBar style="light" />
      <TouchableOpacity style={[S.backBtn, { top: insets.top + 8 }]} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={20} color="#FFF" />
      </TouchableOpacity>
      <Ionicons name="wifi-outline" size={52} color="#FF2E55" />
      <Text style={S.errorTitle}>Connection Error</Text>
      <Text style={S.errorMsg}>{error}</Text>
      <TouchableOpacity style={S.retryBtn} onPress={loadData}>
        <Text style={S.retryText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={S.container}>
      <StatusBar style="light" />
      <TouchableOpacity style={[S.backBtn, { top: insets.top + 8 }]} onPress={() => navigation.goBack()} activeOpacity={0.8}>
        <Ionicons name="arrow-back" size={20} color="#FFF" />
      </TouchableOpacity>

      <Animated.ScrollView
        bounces showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        style={{ opacity: fadeIn }}
      >
        {/* Backdrop */}
        <View style={S.backdrop} pointerEvents="none">
          <Image source={{ uri: cover || 'https://via.placeholder.com/600x330/10131c/333' }} style={S.backdropImg} resizeMode="cover" />
          <LinearGradient colors={['rgba(8,10,15,0)', 'rgba(8,10,15,0.55)', '#080A0F']} style={S.backdropGrad} />
        </View>

        <View style={S.body}>
          {/* Top row: poster + info */}
          <View style={S.topRow}>
            <View>
              <Image source={{ uri: cover }} style={S.poster} resizeMode="cover" />
              {(d as any)?.coming_soon && (
                <View style={S.csBadge}><Text style={S.csBadgeText}>COMING SOON</Text></View>
              )}
            </View>
            <View style={S.topInfo}>
              <Text style={S.titleText} numberOfLines={3}>{title}</Text>
              {/* Badges */}
              <View style={S.badgeRow}>
                <View style={S.hdBadge}><Text style={S.hdBadgeText}>HD 1080p</Text></View>
                {rating && <View style={S.ratingBadge}><Text style={S.ratingText}>â˜… {rating}</Text></View>}
              </View>
              {/* Meta */}
              <View style={S.metaRow}>
                {d?.release_date ? <Text style={S.metaItem}>{String(d.release_date).slice(0, 4)}</Text> : null}
                {durationStr ? <><Text style={S.metaDot}>Â·</Text><Text style={S.metaItem}>{durationStr}</Text></> : null}
                {isSeries ? <><Text style={S.metaDot}>Â·</Text><Text style={S.metaItem}>Series</Text></> : null}
              </View>
              {d?.genre ? <Text style={S.genreText} numberOfLines={2}>{d.genre}</Text> : null}
              {((d as any)?.country || (d as any)?.language) ? (
                <Text style={S.langText}>{[(d as any)?.country, (d as any)?.language].filter(Boolean).join(' Â· ')}</Text>
              ) : null}
            </View>
          </View>

          {/* Play button */}
          {!(d as any)?.coming_soon ? (
            <TouchableOpacity style={S.playBtn} onPress={() => playNow(undefined, undefined, isSeries ? selectedSeason : 0, isSeries ? 1 : 0)} activeOpacity={0.88}>
              <LinearGradient colors={['#FF2E55', '#CC1133']} style={S.playGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="play" size={18} color="#FFF" />
                <Text style={S.playText}>{isSeries ? `Play S${selectedSeason} Â· E1` : 'Stream 1080p Full HD'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={S.csBar}>
              <Ionicons name="time-outline" size={15} color="#8B5CF6" />
              <Text style={S.csBarText}>Coming Soon{(d as any)?.coming_soon_date ? ` Â· ${(d as any).coming_soon_date}` : ''}</Text>
            </View>
          )}

          {/* Action deck */}
          <View style={S.actionDeck}>
            <TouchableOpacity style={[S.actionBtn, inWatchlist && S.actionBtnSaved]} onPress={toggleWatchlist} activeOpacity={0.8}>
              <Ionicons name={inWatchlist ? 'bookmark' : 'bookmark-outline'} size={17} color={inWatchlist ? '#00E599' : '#94A3B8'} />
              <Text style={[S.actionBtnTxt, inWatchlist && { color: '#00E599' }]}>{inWatchlist ? 'Saved' : 'My List'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.actionBtn} onPress={() => Share.share({ message: `Watch ${title} on CineScope!` }).catch(() => {})} activeOpacity={0.8}>
              <Ionicons name="share-social-outline" size={17} color="#94A3B8" />
              <Text style={S.actionBtnTxt}>Share</Text>
            </TouchableOpacity>
            {(d as any)?.trailer_url && (
              <TouchableOpacity style={S.actionBtn} onPress={() => navigation.navigate('Player', { id, title, cover, season: 0, episode: 0, type: 'Movie', trailerOnly: true })} activeOpacity={0.8}>
                <Ionicons name="film-outline" size={17} color="#94A3B8" />
                <Text style={S.actionBtnTxt}>Trailer</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Synopsis */}
          {d?.description ? (
            <Section title="STORYLINE">
              <Text style={S.synopsis} numberOfLines={synopsisExpanded ? undefined : 3}>{d.description}</Text>
              {d.description.length > 160 && (
                <TouchableOpacity onPress={() => setSynopsisExpanded(!synopsisExpanded)}>
                  <Text style={S.readMore}>{synopsisExpanded ? 'Show Less â–´' : 'Read More â–¾'}</Text>
                </TouchableOpacity>
              )}
            </Section>
          ) : null}

          {/* Dubs */}
          {d?.dubs && d.dubs.length > 0 && (
            <Section title="AUDIO LANGUAGES" subtitle={`${d.dubs.length} tracks`}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {d.dubs.map((dub, i) => {
                  const active = dub.subject_id === id;
                  return (
                    <TouchableOpacity key={dub.subject_id || i} style={[S.dubChip, active && S.dubChipActive]} onPress={() => playNow(dub.subject_id, dub.lang_name)} activeOpacity={0.8}>
                      <Ionicons name="volume-high-outline" size={12} color={active ? '#FF2E55' : '#94A3B8'} />
                      <Text style={[S.dubTxt, active && S.dubTxtActive]}>{dub.lang_name || 'Audio'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Section>
          )}

          {/* Episodes */}
          {seasonsData.length > 0 && (
            <Section title="EPISODES">
              {seasonsData.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
                  {seasonsData.map(s => (
                    <TouchableOpacity key={s.season} style={[S.seasonTab, selectedSeason === s.season && S.seasonTabActive]} onPress={() => setSelectedSeason(s.season)}>
                      <Text style={[S.seasonTabTxt, selectedSeason === s.season && S.seasonTabTxtActive]}>Season {s.season}</Text>
                      {s.episode_count > 0 && <Text style={[S.epCount, selectedSeason === s.season && { color: 'rgba(255,255,255,0.6)' }]}>{s.episode_count} eps</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <View style={{ gap: 8 }}>
                {episodes.map((ep: any) => (
                  <TouchableOpacity key={ep.episode} style={S.epCard} onPress={() => playNow(id, undefined, selectedSeason, ep.episode)} activeOpacity={0.8}>
                    <LinearGradient colors={['rgba(255,46,85,0.15)', 'rgba(255,46,85,0.05)']} style={S.epNum}>
                      <Text style={S.epNumTxt}>{ep.episode}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text style={S.epTitle} numberOfLines={1}>{ep.title || `Episode ${ep.episode}`}</Text>
                      <Text style={S.epMeta}>Season {selectedSeason} Â· 1080p HD</Text>
                    </View>
                    <View style={S.epPlayBtn}><Ionicons name="play" size={12} color="#FF2E55" /></View>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>
          )}

          {/* Cast & Crew */}
          {(d?.cast || d?.director) && (
            <Section title="CAST & CREW">
              {d?.director && <View style={S.crewRow}><Text style={S.crewLabel}>Director</Text><Text style={S.crewVal}>{d.director}</Text></View>}
              {d?.cast && <View style={S.crewRow}><Text style={S.crewLabel}>Cast</Text><Text style={S.crewVal}>{d.cast}</Text></View>}
            </Section>
          )}

          {/* Extra info */}
          {((d as any)?.content_rating || (d as any)?.viewers) && (
            <Section title="INFO">
              {(d as any)?.content_rating && (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>Rated</Text>
                  <View style={S.contentRating}><Text style={S.contentRatingTxt}>{(d as any).content_rating}</Text></View>
                </View>
              )}
              {(d as any)?.viewers && (
                <View style={S.infoRow}>
                  <Text style={S.infoLabel}>Views</Text>
                  <Text style={S.infoVal}>{Number((d as any).viewers).toLocaleString()}</Text>
                </View>
              )}
            </Section>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080A0F' },
  errorScreen: { flex: 1, backgroundColor: '#080A0F', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  errorTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', marginTop: 8 },
  errorMsg: { color: '#94A3B8', fontSize: 14, textAlign: 'center', lineHeight: 21 },
  retryBtn: { marginTop: 12, backgroundColor: '#FF2E55', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  backBtn: { position: 'absolute', left: 14, zIndex: 100, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(8,10,15,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', elevation: 8 },
  backdrop: { width, height: BACKDROP_H },
  backdropImg: { width: '100%', height: '100%' },
  backdropGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: BACKDROP_H * 0.75 },
  body: { paddingHorizontal: 16, marginTop: -100 },
  topRow: { flexDirection: 'row', gap: 14, marginBottom: 20, alignItems: 'flex-end' },
  poster: { width: 110, height: 165, borderRadius: 12, backgroundColor: '#1A1D2E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', elevation: 8 },
  csBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#8B5CF6', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, paddingVertical: 4, alignItems: 'center' },
  csBadgeText: { color: '#FFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  topInfo: { flex: 1, gap: 6, paddingBottom: 2 },
  titleText: { color: '#FFF', fontSize: 21, fontWeight: '900', lineHeight: 26, letterSpacing: -0.3 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  hdBadge: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  hdBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  ratingBadge: { backgroundColor: 'rgba(251,191,36,0.15)', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)' },
  ratingText: { color: '#FBBF24', fontSize: 10, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  metaItem: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  metaDot: { color: '#525866', fontSize: 12 },
  genreText: { color: '#CBD5E1', fontSize: 12, lineHeight: 17 },
  langText: { color: '#525866', fontSize: 11, fontWeight: '500' },
  playBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 10, elevation: 6 },
  playGrad: { paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  playText: { color: '#FFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.2 },
  csBar: { backgroundColor: 'rgba(139,92,246,0.12)', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)' },
  csBarText: { color: '#8B5CF6', fontWeight: '700', fontSize: 14 },
  actionDeck: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  actionBtn: { flex: 1, backgroundColor: '#10131C', borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 4 },
  actionBtnSaved: { backgroundColor: 'rgba(0,229,153,0.1)', borderColor: 'rgba(0,229,153,0.35)' },
  actionBtnTxt: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  section: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  sectionSub: { color: '#525866', fontSize: 11, fontWeight: '600' },
  synopsis: { color: '#94A3B8', fontSize: 14, lineHeight: 22 },
  readMore: { color: '#FF2E55', fontSize: 12, fontWeight: '700', marginTop: 6 },
  dubChip: { backgroundColor: '#10131C', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  dubChipActive: { backgroundColor: 'rgba(255,46,85,0.12)', borderColor: 'rgba(255,46,85,0.5)' },
  dubTxt: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  dubTxtActive: { color: '#FFF', fontWeight: '800' },
  seasonTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: '#10131C', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  seasonTabActive: { backgroundColor: '#FF2E55', borderColor: '#FF2E55' },
  seasonTabTxt: { color: '#94A3B8', fontSize: 13, fontWeight: '700' },
  seasonTabTxtActive: { color: '#FFF', fontWeight: '800' },
  epCount: { color: '#525866', fontSize: 10, fontWeight: '600', marginTop: 2 },
  epCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10131C', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 12 },
  epNum: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  epNumTxt: { color: '#FF2E55', fontSize: 14, fontWeight: '900' },
  epTitle: { color: '#FFF', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  epMeta: { color: '#525866', fontSize: 11 },
  epPlayBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,46,85,0.12)', borderWidth: 1, borderColor: 'rgba(255,46,85,0.3)', alignItems: 'center', justifyContent: 'center' },
  crewRow: { flexDirection: 'row', gap: 12, marginBottom: 8, alignItems: 'flex-start' },
  crewLabel: { color: '#525866', fontSize: 12, fontWeight: '700', width: 60, paddingTop: 1 },
  crewVal: { flex: 1, color: '#CBD5E1', fontSize: 13, lineHeight: 19 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  infoLabel: { color: '#525866', fontSize: 12, fontWeight: '700', width: 55 },
  infoVal: { color: '#CBD5E1', fontSize: 13 },
  contentRating: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  contentRatingTxt: { color: '#FFF', fontSize: 11, fontWeight: '800' },
});
