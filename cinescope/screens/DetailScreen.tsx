import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions, Share,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { CONFIG } from '../config';
import { api, DetailData } from '../services/api';
import { WatchlistService } from '../services/watchlist';

const { width } = Dimensions.get('window');

export default function DetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { id, title: initialTitle, cover: initialCover } = route.params || {};

  const [detail, setDetail] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [seasonsData, setSeasonsData] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch details
      try {
        const d = await api.detail(id);
        setDetail(d);

        if (d?.type === 'Series' || d?.type === 'TV Series') {
          try {
            const epData = await api.episodes(id);
            if (epData?.seasons?.length) {
              setSeasonsData(epData.seasons);
              setSelectedSeason(epData.seasons[0].season || 1);
            }
          } catch {}
        }
      } catch (fetchErr: any) {
        setError('Could not load movie details. Please check server connection.');
      }

      // 2. Check watchlist with resilient fallback
      try {
        const wl = await WatchlistService.has(id);
        setInWatchlist(wl);
      } catch {
        setInWatchlist(false);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleWatchlist = async () => {
    if (inWatchlist) {
      await WatchlistService.remove(id);
      setInWatchlist(false);
    } else {
      await WatchlistService.add({
        subject_id: id,
        title: detail?.title || initialTitle,
        cover: detail?.cover || initialCover,
        type: detail?.type,
        addedAt: Date.now(),
      });
      setInWatchlist(true);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Watch ${detail?.title || initialTitle} in 1080p Full HD on CineScope!`,
      });
    } catch {}
  };

  const playNow = (dubId?: string, dubName?: string, season = 0, episode = 0) => {
    navigation.navigate('Player', {
      id: dubId || id,
      title: detail?.title || initialTitle,
      cover: detail?.cover || initialCover,
      initialDub: dubName,
      season,
      episode,
      type: detail?.type || 'Movie',
    });
  };

  const d = detail;
  const cover = d?.cover || initialCover;
  const title = d?.title || initialTitle;
  const rawRating = d?.imdb_rating || d?.rating;
  const formattedRating = (() => {
    if (!rawRating || rawRating === 'N/A') return null;
    const num = typeof rawRating === 'number' ? rawRating : parseFloat(String(rawRating));
    return isNaN(num) ? null : num.toFixed(1);
  })();

  const isSeries = Boolean(d?.type === 'Series' || d?.type === 'TV Series' || seasonsData.length > 0);
  const activeSeasonObj = seasonsData.find(s => s.season === selectedSeason) || seasonsData[0];
  const currentSeasonEpisodes = (() => {
    if (!activeSeasonObj) return [];
    if (activeSeasonObj.episodes && activeSeasonObj.episodes.length > 0) {
      return activeSeasonObj.episodes;
    }
    const count = activeSeasonObj.episode_count || 1;
    return Array.from({ length: count }, (_, i) => ({
      season: activeSeasonObj.season,
      episode: i + 1,
      title: `Episode ${i + 1}`,
    }));
  })();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Floating Spatial Back Button */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 8 }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Text style={styles.backText}>‹</Text>
      </TouchableOpacity>

      <ScrollView
        bounces
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 }}
      >
        {/* Full-Bleed Backdrop Banner */}
        <View style={styles.backdrop} pointerEvents="none">
          <Image
            source={{ uri: cover || 'https://via.placeholder.com/600x400/10131c/666' }}
            style={styles.backdropImg}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(8,10,15,0.6)', '#080A0F']}
            style={styles.backdropGradient}
            pointerEvents="none"
          />
        </View>

        {/* Content Body */}
        <View style={styles.content}>
          {/* Top Row: Poster + Bento Info */}
          <View style={styles.topRow}>
            <Image
              source={{ uri: cover || 'https://via.placeholder.com/120x175/10131c/666' }}
              style={styles.poster}
              resizeMode="cover"
            />
            <View style={styles.topInfo}>
              <Text style={styles.title} numberOfLines={3}>{title}</Text>

              {/* Bento Metadata Badges */}
              <View style={styles.bentoRow}>
                <View style={styles.matchBadge}>
                  <Text style={styles.matchText}>98% MATCH</Text>
                </View>
                <View style={styles.fhdBadge}>
                  <Text style={styles.fhdText}>1080p FHD</Text>
                </View>
                {formattedRating && (
                  <View style={styles.starBadge}>
                    <Text style={styles.starText}>★ {formattedRating}</Text>
                  </View>
                )}
              </View>

              <View style={styles.metaRow}>
                {d?.release_date ? (
                  <Text style={styles.metaItem}>{d.release_date.slice(0, 4)}</Text>
                ) : (
                  <Text style={styles.metaItem}>2024</Text>
                )}
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaItem}>
                  {d?.duration || (d?.type === 'Series' ? 'TV Series' : '2h 15m')}
                </Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.audioMeta}>Dolby 5.1</Text>
              </View>

              {d?.genre ? (
                <Text style={styles.genreText} numberOfLines={2}>
                  {d.genre}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Primary Action Button (Full-Width Netflix / Apple TV+ CTA) */}
          <TouchableOpacity
            style={styles.primaryPlayBtn}
            onPress={() => playNow(undefined, undefined, isSeries ? selectedSeason : 0, isSeries ? 1 : 0)}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryPlayIcon}>▶</Text>
            <Text style={styles.primaryPlayText}>
              {isSeries ? `Play Season ${selectedSeason} Ep 1` : 'Stream 1080p Full HD'}
            </Text>
          </TouchableOpacity>

          {/* Secondary Action Deck */}
          <View style={styles.actionDeck}>
            <TouchableOpacity
              style={[styles.actionDeckBtn, inWatchlist && styles.actionDeckBtnActive]}
              onPress={toggleWatchlist}
              activeOpacity={0.8}
            >
              <Text style={styles.actionDeckIcon}>{inWatchlist ? '✓' : '+'}</Text>
              <Text style={[styles.actionDeckText, inWatchlist && styles.actionDeckTextActive]}>
                {inWatchlist ? 'In My List' : 'Add to List'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionDeckBtn}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Text style={styles.actionDeckIcon}>↗</Text>
              <Text style={styles.actionDeckText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionDeckBtn}
              onPress={() => playNow()}
              activeOpacity={0.8}
            >
              <Text style={styles.actionDeckIcon}>📥</Text>
              <Text style={styles.actionDeckText}>Download</Text>
            </TouchableOpacity>
          </View>

          {/* Loading or Error State for metadata */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#E50914" />
              <Text style={styles.loadingText}>Loading cinema streams & dubs…</Text>
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
                <Text style={styles.retryBtnText}>Retry Connection</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Prime Video Style Multi-Audio Dubs Shelf */}
          {d?.dubs && d.dubs.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>🔊 AUDIO LANGUAGES & DUBS</Text>
                <Text style={styles.sectionSubtitle}>{d.dubs.length} Available</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dubsShelf}
              >
                {d.dubs.map((dub, index) => {
                  const isCurrent = dub.subject_id === id;
                  return (
                    <TouchableOpacity
                      key={dub.subject_id || index}
                      style={[styles.dubChip, isCurrent && styles.dubChipActive]}
                      onPress={() => playNow(dub.subject_id, dub.lang_name)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.dubChipText, isCurrent && styles.dubChipTextActive]}>
                        {isCurrent ? '▶ ' : ''}{dub.lang_name || 'Audio Track'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Storyline / Synopsis */}
          {d?.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>STORYLINE</Text>
              <Text
                style={styles.description}
                numberOfLines={synopsisExpanded ? undefined : 4}
              >
                {d.description}
              </Text>
              {d.description.length > 180 && (
                <TouchableOpacity
                  onPress={() => setSynopsisExpanded(!synopsisExpanded)}
                  style={styles.readMoreBtn}
                >
                  <Text style={styles.readMoreText}>
                    {synopsisExpanded ? 'Show Less ▴' : 'Read More ▾'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* TV Series Episodes Section */}
          {seasonsData.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>EPISODES</Text>

              {/* Season Selection Tabs */}
              {seasonsData.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonRow}>
                  {seasonsData.map(s => (
                    <TouchableOpacity
                      key={s.season}
                      style={[styles.seasonTab, selectedSeason === s.season && styles.seasonTabActive]}
                      onPress={() => setSelectedSeason(s.season)}
                    >
                      <Text style={[styles.seasonTabText, selectedSeason === s.season && styles.seasonTabTextActive]}>
                        Season {s.season}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Episodes List */}
              <View style={styles.episodesList}>
                {currentSeasonEpisodes.map((ep: any) => (
                  <TouchableOpacity
                    key={ep.episode}
                    style={styles.episodeCard}
                    onPress={() => playNow(id, undefined, selectedSeason, ep.episode)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.episodeNumber}>
                      <Text style={styles.episodeNumberText}>{ep.episode}</Text>
                    </View>
                    <View style={styles.episodeInfo}>
                      <Text style={styles.episodeTitle} numberOfLines={1}>
                        {ep.title || `Episode ${ep.episode}`}
                      </Text>
                      <Text style={styles.episodeSub}>Season {selectedSeason} • 1080p HD</Text>
                    </View>
                    <View style={styles.episodePlayBtn}>
                      <Text style={styles.episodePlayIcon}>▶</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Cast Details */}
          {d?.cast ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>STARRING CAST</Text>
              <Text style={styles.castText}>{d.cast}</Text>
            </View>
          ) : null}

          {/* Director */}
          {d?.director ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DIRECTOR</Text>
              <Text style={styles.castText}>{d.director}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080A0F',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(8,10,15,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 34,
    marginTop: -2,
  },

  backdrop: {
    width,
    height: 300,
    position: 'relative',
  },
  backdropImg: {
    width: '100%',
    height: '100%',
  },
  backdropGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
  },

  content: {
    paddingHorizontal: 16,
  },
  topRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: -80,
    marginBottom: 20,
  },
  poster: {
    width: 120,
    height: 178,
    borderRadius: 12,
    backgroundColor: '#10131C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  topInfo: {
    flex: 1,
    paddingTop: 75,
    gap: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 25,
    letterSpacing: -0.3,
  },
  bentoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  matchBadge: {
    backgroundColor: 'rgba(0, 229, 153, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 153, 0.4)',
  },
  matchText: {
    color: '#00E599',
    fontSize: 9,
    fontWeight: '900',
  },
  fhdBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  fhdText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  starBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  starText: {
    color: '#FBBF24',
    fontSize: 9,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaItem: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  metaDot: {
    color: '#525866',
    fontSize: 10,
  },
  audioMeta: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  genreText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
  },

  // Primary CTA
  primaryPlayBtn: {
    backgroundColor: '#E50914',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryPlayIcon: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  primaryPlayText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.3,
  },

  // Action Deck
  actionDeck: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  actionDeckBtn: {
    flex: 1,
    backgroundColor: '#10131C',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    gap: 6,
  },
  actionDeckBtnActive: {
    backgroundColor: 'rgba(0, 229, 153, 0.12)',
    borderColor: 'rgba(0, 229, 153, 0.4)',
  },
  actionDeckIcon: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  actionDeckText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  actionDeckTextActive: {
    color: '#00E599',
    fontWeight: '700',
  },

  loadingBox: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10131C',
    borderRadius: 10,
    marginBottom: 16,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 8,
    fontSize: 13,
  },
  errorBox: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(229,9,20,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.3)',
    marginBottom: 16,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  retryBtn: {
    backgroundColor: '#E50914',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },

  // Sections
  section: {
    marginTop: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    color: '#525866',
    fontSize: 11,
    fontWeight: '600',
  },

  // Dubs Shelf
  dubsShelf: {
    gap: 8,
  },
  dubChip: {
    backgroundColor: '#10131C',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dubChipActive: {
    backgroundColor: 'rgba(229,9,20,0.15)',
    borderColor: '#E50914',
  },
  dubChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  dubChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Storyline
  description: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  readMoreBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  readMoreText: {
    color: '#E50914',
    fontSize: 12,
    fontWeight: '700',
  },

  // Episodes
  seasonRow: {
    marginTop: 8,
    marginBottom: 12,
  },
  seasonTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#10131C',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  seasonTabActive: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
  },
  seasonTabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  seasonTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  episodesList: {
    gap: 8,
  },
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10131C',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  episodeNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodeNumberText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  episodeInfo: {
    flex: 1,
  },
  episodeTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  episodeSub: {
    color: '#525866',
    fontSize: 11,
    marginTop: 2,
  },
  episodePlayBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(229,9,20,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229,9,20,0.3)',
  },
  episodePlayIcon: {
    color: '#E50914',
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 1,
  },

  castText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
});
