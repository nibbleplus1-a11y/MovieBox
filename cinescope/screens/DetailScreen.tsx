import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Share, Animated, Linking, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api, DetailData } from '../services/api';
import { WatchlistService } from '../services/watchlist';
import { WatchProgressService, WatchProgressItem } from '../services/watchProgress';
import { downloadManager } from '../services/downloadService';
import { DownloadFloatingBar } from '../components/downloads/DownloadFloatingBar';
import { PlayerAdModal } from '../components/ads/PlayerAdModal';

const { width } = Dimensions.get('window');
const BACKDROP_H = 340;

// ── Duration formatter ────────────────────────────────────────────────────────
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
    const mins = raw > 500 ? Math.round(raw / 60) : raw;
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  return null;
}

// ── Skeleton shimmer box ──────────────────────────────────────────────────────
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
    <View style={{ flex: 1, backgroundColor: '#07080B' }}>
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

// ── Section wrapper ──────────────────────────────────────────────────────────
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

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function DetailScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { id, title: initTitle, cover: initCover } = route.params || {};

  const [detail, setDetail]                   = useState<DetailData | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [inWatchlist, setInWatchlist]         = useState(false);
  const [savedProgress, setSavedProgress]     = useState<WatchProgressItem | null>(null);
  const [seasonsData, setSeasonsData]         = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason]   = useState(1);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const fadeIn = useRef(new Animated.Value(0)).current;

  // Sponsored Download states
  const [showDownloadAd, setShowDownloadAd]   = useState<boolean>(false);
  const [pendingDownload, setPendingDownload] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [d, wl, progress] = await Promise.all([
        api.detail(id),
        WatchlistService.has(id).catch(() => false),
        WatchProgressService.get(id).catch(() => null),
      ]);
      setDetail(d);
      setInWatchlist(Boolean(wl));
      setSavedProgress(progress);

      const hasSeriesType = d?.type === 'Series' || d?.type === 'TV Series';
      if (hasSeriesType || (progress && progress.season > 0)) {
        const ep = await api.episodes(id).catch(() => ({ seasons: [] }));
        if (ep?.seasons?.length) {
          setSeasonsData(ep.seasons);
          if (progress && progress.season > 0) {
            setSelectedSeason(progress.season);
          } else {
            setSelectedSeason(ep.seasons[0].season || 1);
          }
        }
      }
      Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } catch {
      setError('Could not load details. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Defer heavy data load until after initial animation frame
  // so the slide-in transition stays perfectly smooth
  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      loadData();
    });
    return () => cancelAnimationFrame(handle);
  }, [loadData]);

  // Refresh watch progress whenever returning back to this screen
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      WatchProgressService.get(id).then((p) => {
        if (isMounted && p) {
          setSavedProgress(p);
          if (p.season > 0) setSelectedSeason(p.season);
        }
      });
      return () => { isMounted = false; };
    }, [id])
  );

  const toggleWatchlist = async () => {
    if (inWatchlist) {
      await WatchlistService.remove(id); setInWatchlist(false);
    } else {
      await WatchlistService.add({ subject_id: id, title: detail?.title || initTitle, cover: detail?.cover || initCover, type: detail?.type, addedAt: Date.now() });
      setInWatchlist(true);
    }
  };

  const playNow = (dubId?: string, dubName?: string, season = 0, ep = 0, seekTime = 0) =>
    navigation.navigate('Player', {
      id: dubId || id, title: detail?.title || initTitle, cover: detail?.cover || initCover,
      initialDub: dubName, season, episode: ep, initialSeek: seekTime, type: isSeries ? 'TV Series' : (detail?.type || 'Movie'),
    });

  const handleDownload = async (season = 0, ep = 0) => {
    try {
      const data = await api.streams(id, season, ep);
      const playable = (data?.streams || []).filter(s => s && s.url && !s.url.includes('.mpd'));
      const targetStream = playable.find(s => s.quality === '1080p') || playable[0];
      if (targetStream?.url) {
        const movieTitle = detail?.title || initTitle || 'Movie';
        const cleanName = movieTitle.replace(/[^a-zA-Z0-9_\-]/g, '_');
        const epTag = season > 0 ? `_S${season}E${ep}` : '';
        const filename = `${cleanName}${epTag}.mp4`;
        const episodeTitle = season > 0 ? `Season ${season} • Episode ${ep}` : undefined;
        const dlUrl = api.proxyUrl(targetStream.url, targetStream.headers?.Referer) + `&download=true&filename=${encodeURIComponent(filename)}`;

        const downloadParams = {
          url: dlUrl,
          filename,
          title: movieTitle,
          poster: detail?.cover || initCover,
          episodeTitle,
          season,
          episode: ep,
        };

        // 3-in-1 Ad Quota: If quota available, download IMMEDIATELY without showing any ad!
        if (downloadManager.hasQuota()) {
          await downloadManager.consumeQuota();
          await downloadManager.startDownload(downloadParams);
          const remaining = downloadManager.getQuota();
          Alert.alert(
            'Download Started 📥',
            `"${movieTitle}" is downloading in the background.\n(${remaining} ad-free download${remaining === 1 ? '' : 's'} remaining)`,
            [
              { text: 'OK' },
              {
                text: 'View Downloads',
                onPress: () => navigation.navigate('Main', { screen: 'Downloads' }),
              },
            ]
          );
        } else {
          // No quota: Show sponsor ad to unlock 3 downloads
          setPendingDownload(downloadParams);
          setShowDownloadAd(true);
        }
      } else {
        Alert.alert('Download', 'Direct MP4 stream not available for download right now.');
      }
    } catch {
      Alert.alert('Download', 'Download server is busy. Please try again.');
    }
  };

  const onDownloadAdComplete = async () => {
    setShowDownloadAd(false);
    if (!pendingDownload) return;
    const item = pendingDownload;
    setPendingDownload(null);

    // Watch 1 sponsor ad -> grants 3 downloads! Current one uses 1 -> 2 remaining!
    await downloadManager.grantQuota(3);
    await downloadManager.consumeQuota();

    downloadManager
      .startDownload(item)
      .then(() => {
        Alert.alert(
          'Unlocked & Downloading! 🎉',
          `3 high-speed downloads unlocked! "${item.title}" is now downloading.\nYou have 2 ad-free downloads left!`,
          [
            { text: 'OK' },
            {
              text: 'View Downloads',
              onPress: () => navigation.navigate('Main', { screen: 'Downloads' }),
            },
          ]
        );
      })
      .catch((err: any) => {
        Alert.alert('Download Failed', err?.message || 'Could not start download.');
      });
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const d            = detail;
  const cover        = d?.cover || initCover;
  const title        = d?.title || initTitle;
  const rawRating    = (d as any)?.imdb_rating ?? (d as any)?.rating;
  const rating       = (() => { const n = parseFloat(String(rawRating || '')); return isNaN(n) ? null : n.toFixed(1); })();
  const durationStr  = formatDuration((d as any)?.duration || (d as any)?.duration_seconds);
  const isSeries     = d?.type === 'Series' || d?.type === 'TV Series' || seasonsData.length > 0;
  const activeSeason = seasonsData.find(s => Number(s.season) === Number(selectedSeason)) || seasonsData[0];
  const episodes     = (() => {
    if (!activeSeason) return [];
    if (activeSeason.episodes?.length > 0) return activeSeason.episodes;
    return Array.from({ length: activeSeason.episode_count || 1 }, (_, i) => ({
      season: activeSeason.season, episode: i + 1, title: `Episode ${i + 1}`,
    }));
  })();

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) return <SkeletonDetail />;

  if (error) return (
    <View style={S.errorScreen}>
      <StatusBar style="light" />
      <TouchableOpacity style={[S.backBtn, { top: insets.top + 8 }]} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={20} color="#FFF" />
      </TouchableOpacity>
      <Ionicons name="wifi-outline" size={52} color="#E50914" />
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
          <Image source={{ uri: cover || 'https://via.placeholder.com/600x340/10131c/333' }} style={S.backdropImg} resizeMode="cover" />
          <LinearGradient colors={['rgba(7,8,11,0)', 'rgba(7,8,11,0.65)', '#07080B']} style={S.backdropGrad} />
        </View>

        <View style={S.body}>
          {/* Top row: poster + info */}
          <View style={S.topRow}>
            <View style={S.posterWrapper}>
              <Image source={{ uri: cover }} style={S.poster} resizeMode="cover" />
              {(d as any)?.coming_soon && (
                <View style={S.csBadge}><Text style={S.csBadgeText}>COMING SOON</Text></View>
              )}
            </View>
            <View style={S.topInfo}>
              <Text style={S.titleText} numberOfLines={3}>{title}</Text>
              {/* Badges */}
              <View style={S.badgeRow}>
                <View style={S.hdBadge}><Text style={S.hdBadgeText}>1080p Ultra HD</Text></View>
                {rating && <View style={S.ratingBadge}><Text style={S.ratingText}>★ {rating}</Text></View>}
              </View>
              {/* Meta */}
              <View style={S.metaRow}>
                {d?.release_date ? <Text style={S.metaItem}>{String(d.release_date).slice(0, 4)}</Text> : null}
                {durationStr ? <><Text style={S.metaDot}> • </Text><Text style={S.metaItem}>{durationStr}</Text></> : null}
                {isSeries ? <><Text style={S.metaDot}> • </Text><Text style={S.metaItem}>Series</Text></> : null}
              </View>
              {d?.genre ? <Text style={S.genreText} numberOfLines={2}>{d.genre}</Text> : null}
              {((d as any)?.country || (d as any)?.language) ? (
                <Text style={S.langText}>{[(d as any)?.country, (d as any)?.language].filter(Boolean).join(' • ')}</Text>
              ) : null}
            </View>
          </View>

          {/* Play button */}
          {!(d as any)?.coming_soon ? (
            <TouchableOpacity
              style={S.playBtn}
              onPress={() => {
                const targetSeason = isSeries ? (savedProgress?.season || selectedSeason || 1) : 0;
                const targetEpisode = isSeries ? (savedProgress?.episode || 1) : 0;
                const targetSeek = savedProgress?.currentTime || 0;
                playNow(undefined, undefined, targetSeason, targetEpisode, targetSeek);
              }}
              activeOpacity={0.88}
            >
              <LinearGradient colors={['#E50914', '#B20710']} style={S.playGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="play" size={18} color="#FFF" />
                <Text style={S.playText}>
                  {isSeries
                    ? (savedProgress && (savedProgress.season > 0 || savedProgress.episode > 0)
                        ? `Resume S${savedProgress.season || selectedSeason} • E${savedProgress.episode || 1}`
                        : `Play S${selectedSeason} • E1`)
                    : (savedProgress && savedProgress.currentTime > 15
                        ? `Resume (${formatDuration(savedProgress.currentTime)})`
                        : 'Stream 1080p Full HD')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={S.csBar}>
              <Ionicons name="time-outline" size={15} color="#8B5CF6" />
              <Text style={S.csBarText}>Coming Soon{(d as any)?.coming_soon_date ? ` • ${(d as any).coming_soon_date}` : ''}</Text>
            </View>
          )}

          {/* Action deck: Download, My List, Share, Trailer */}
          <View style={S.actionDeck}>
            <TouchableOpacity
              style={[S.actionBtn, S.actionBtnDownload]}
              onPress={() => handleDownload(isSeries ? (selectedSeason || 1) : 0, isSeries ? 1 : 0)}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-download-outline" size={18} color="#38BDF8" />
              <Text style={[S.actionBtnTxt, { color: '#38BDF8', fontWeight: '700' }]}>Download</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[S.actionBtn, inWatchlist && S.actionBtnSaved]}
              onPress={toggleWatchlist}
              activeOpacity={0.8}
            >
              <Ionicons name={inWatchlist ? 'bookmark' : 'bookmark-outline'} size={18} color={inWatchlist ? '#00E599' : '#94A3B8'} />
              <Text style={[S.actionBtnTxt, inWatchlist && { color: '#00E599' }]}>{inWatchlist ? 'Saved' : 'My List'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={S.actionBtn}
              onPress={() => Share.share({ message: `Watch ${title} on MovieVerse!` }).catch(() => {})}
              activeOpacity={0.8}
            >
              <Ionicons name="share-social-outline" size={18} color="#94A3B8" />
              <Text style={S.actionBtnTxt}>Share</Text>
            </TouchableOpacity>

            {(d as any)?.trailer_url && (
              <TouchableOpacity
                style={S.actionBtn}
                onPress={() => navigation.navigate('Player', { id, title, cover, season: 0, episode: 0, type: 'Movie', trailerOnly: true })}
                activeOpacity={0.8}
              >
                <Ionicons name="film-outline" size={18} color="#94A3B8" />
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
                  <Text style={S.readMore}>{synopsisExpanded ? 'Show Less ▲' : 'Read More ▼'}</Text>
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
                      <Ionicons name="volume-high-outline" size={12} color={active ? '#E50914' : '#94A3B8'} />
                      <Text style={[S.dubTxt, active && S.dubTxtActive]}>{dub.lang_name || 'Audio'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Section>
          )}

          {/* VPN Affiliate Banner — High-Value Sponsor (NordVPN/ExpressVPN) */}
          <TouchableOpacity
            style={S.vpnBanner}
            activeOpacity={0.88}
            onPress={() => Linking.openURL('https://go.nordvpn.net/aff_c?offer_id=15&aff_id=120817&url_id=902').catch(() => {})}
          >
            <LinearGradient
              colors={['#0D1B4B', '#1A1F3A']}
              style={S.vpnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={S.vpnLeft}>
                <View style={S.vpnBadgeRow}>
                  <View style={S.vpnBadge}>
                    <Text style={S.vpnBadgeText}>SPONSORED</Text>
                  </View>
                  <Text style={S.vpnTagline}>Stream Without Limits</Text>
                </View>
                <Text style={S.vpnTitle}>Get NordVPN — Unblock Everything</Text>
                <Text style={S.vpnSub}>Faster streams · No throttling · 30-day free trial</Text>
              </View>
              <View style={S.vpnCtaBox}>
                <Ionicons name="shield-checkmark" size={22} color="#4F9CF9" />
                <Text style={S.vpnCtaText}>Try Free</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>


          {/* Episodes */}
          {seasonsData.length > 0 && (
            <Section title="EPISODES">
              {seasonsData.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
                  {seasonsData.map(s => (
                    <TouchableOpacity key={s.season} style={[S.seasonTab, selectedSeason === s.season && S.seasonTabActive]} onPress={() => setSelectedSeason(s.season)}>
                      <Text style={[S.seasonTabTxt, selectedSeason === s.season && S.seasonTabTxtActive]}>Season {s.season}</Text>
                      {s.episode_count > 0 && <Text style={[S.epCount, selectedSeason === s.season && { color: 'rgba(255,255,255,0.7)' }]}>{s.episode_count} eps</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <View style={{ gap: 10 }}>
                {episodes.map((ep: any) => (
                  <View key={ep.episode} style={S.epCard}>
                    <TouchableOpacity
                      style={S.epClickArea}
                      onPress={() => playNow(id, undefined, selectedSeason, ep.episode)}
                      activeOpacity={0.8}
                    >
                      <LinearGradient colors={['rgba(229,9,20,0.18)', 'rgba(229,9,20,0.06)']} style={S.epNum}>
                        <Text style={S.epNumTxt}>{ep.episode}</Text>
                      </LinearGradient>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={S.epTitle} numberOfLines={1}>{ep.title || `Episode ${ep.episode}`}</Text>
                        <Text style={S.epMeta}>Season {selectedSeason} • 1080p Full HD</Text>
                      </View>
                    </TouchableOpacity>

                    <View style={S.epActionsGroup}>
                      <TouchableOpacity
                        style={S.epDownloadBtn}
                        onPress={() => handleDownload(selectedSeason, ep.episode)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="cloud-download-outline" size={17} color="#38BDF8" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={S.epPlayBtn}
                        onPress={() => playNow(id, undefined, selectedSeason, ep.episode)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="play" size={14} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
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

      {/* PRE-DOWNLOAD AD MODAL (Before Download Starts) */}
      <PlayerAdModal
        visible={showDownloadAd}
        mode="download"
        title={pendingDownload?.filename || detail?.title || ''}
        onComplete={onDownloadAdComplete}
        onClose={() => setShowDownloadAd(false)}
      />

      {/* NON-BLOCKING BACKGROUND DOWNLOAD FLOATING INDICATOR */}
      <DownloadFloatingBar bottomOffset={insets.bottom + 16} />
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080B' },
  errorScreen: { flex: 1, backgroundColor: '#07080B', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  errorTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', marginTop: 8 },
  errorMsg: { color: '#94A3B8', fontSize: 14, textAlign: 'center', lineHeight: 21 },
  retryBtn: { marginTop: 12, backgroundColor: '#E50914', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  backBtn: { position: 'absolute', left: 14, zIndex: 100, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(7,8,11,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', elevation: 8 },
  backdrop: { width, height: BACKDROP_H },
  backdropImg: { width: '100%', height: '100%' },
  backdropGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: BACKDROP_H * 0.75 },
  body: { paddingHorizontal: 16, marginTop: -95 },
  topRow: { flexDirection: 'row', gap: 14, marginBottom: 18, alignItems: 'flex-end' },
  posterWrapper: {
    shadowColor: '#000',
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 10,
  },
  poster: { width: 115, height: 170, borderRadius: 12, backgroundColor: '#141724', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  csBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#8B5CF6', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, paddingVertical: 4, alignItems: 'center' },
  csBadgeText: { color: '#FFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  topInfo: { flex: 1, gap: 6, paddingBottom: 2 },
  titleText: { color: '#FFF', fontSize: 20, fontWeight: '900', lineHeight: 25, letterSpacing: -0.3 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  hdBadge: { backgroundColor: 'rgba(229,9,20,0.15)', borderWidth: 1, borderColor: 'rgba(229,9,20,0.3)', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  hdBadgeText: { color: '#E50914', fontSize: 10, fontWeight: '800' },
  ratingBadge: { backgroundColor: 'rgba(251,191,36,0.15)', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)' },
  ratingText: { color: '#FBBF24', fontSize: 10, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  metaItem: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  metaDot: { color: '#525866', fontSize: 12 },
  genreText: { color: '#CBD5E1', fontSize: 12, lineHeight: 17 },
  langText: { color: '#64748B', fontSize: 11, fontWeight: '500' },
  playBtn: { borderRadius: 12, overflow: 'hidden', marginBottom: 10, elevation: 6 },
  playGrad: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  playText: { color: '#FFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.2 },
  csBar: { backgroundColor: 'rgba(139,92,246,0.12)', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)' },
  csBarText: { color: '#8B5CF6', fontWeight: '700', fontSize: 14 },
  actionDeck: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  actionBtn: { flex: 1, backgroundColor: '#111420', borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 4 },
  actionBtnDownload: { borderColor: 'rgba(56,189,248,0.25)', backgroundColor: 'rgba(56,189,248,0.06)' },
  actionBtnSaved: { backgroundColor: 'rgba(0,229,153,0.1)', borderColor: 'rgba(0,229,153,0.35)' },
  actionBtnTxt: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  section: { marginTop: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  sectionSub: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  synopsis: { color: '#94A3B8', fontSize: 13, lineHeight: 21 },
  readMore: { color: '#E50914', fontSize: 12, fontWeight: '700', marginTop: 6 },
  dubChip: { backgroundColor: '#111420', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  dubChipActive: { backgroundColor: 'rgba(229,9,20,0.15)', borderColor: 'rgba(229,9,20,0.5)' },
  dubTxt: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  dubTxtActive: { color: '#FFF', fontWeight: '800' },
  seasonTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#111420', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  seasonTabActive: { backgroundColor: '#E50914', borderColor: '#E50914' },
  seasonTabTxt: { color: '#94A3B8', fontSize: 13, fontWeight: '700' },
  seasonTabTxtActive: { color: '#FFF', fontWeight: '800' },
  epCount: { color: '#64748B', fontSize: 10, fontWeight: '600', marginTop: 2 },
  epCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111420', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 10 },
  epClickArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  epNum: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  epNumTxt: { color: '#E50914', fontSize: 14, fontWeight: '900' },
  epTitle: { color: '#FFF', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  epMeta: { color: '#64748B', fontSize: 11 },
  epActionsGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  epDownloadBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(56,189,248,0.1)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.25)', alignItems: 'center', justifyContent: 'center' },
  epPlayBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E50914', alignItems: 'center', justifyContent: 'center' },
  crewRow: { flexDirection: 'row', gap: 12, marginBottom: 8, alignItems: 'flex-start' },
  crewLabel: { color: '#64748B', fontSize: 12, fontWeight: '700', width: 60, paddingTop: 1 },
  crewVal: { flex: 1, color: '#CBD5E1', fontSize: 13, lineHeight: 19 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  infoLabel: { color: '#64748B', fontSize: 12, fontWeight: '700', width: 55 },
  infoVal: { color: '#CBD5E1', fontSize: 13 },
  contentRating: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  contentRatingTxt: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  // ── VPN Affiliate Banner ────────────────────────────────────────────────────
  vpnBanner: { marginHorizontal: 16, marginTop: 16, marginBottom: 4, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(79,156,249,0.3)' },
  vpnGrad: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  vpnLeft: { flex: 1, gap: 4 },
  vpnBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vpnBadge: { backgroundColor: '#1E3A8A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  vpnBadgeText: { color: '#93C5FD', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  vpnTagline: { color: '#93C5FD', fontSize: 11, fontWeight: '600' },
  vpnTitle: { color: '#FFF', fontSize: 14, fontWeight: '800', lineHeight: 18 },
  vpnSub: { color: '#94A3B8', fontSize: 11, lineHeight: 16 },
  vpnCtaBox: { alignItems: 'center', gap: 4, minWidth: 56 },
  vpnCtaText: { color: '#4F9CF9', fontSize: 12, fontWeight: '800' },
  // ── In-App Download Overlay ─────────────────────────────────────────────────
  dlOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dlCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  dlTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  dlFilename: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  dlBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  dlBarFill: {
    height: '100%',
    backgroundColor: '#E50914',
    borderRadius: 3,
  },
  dlPercent: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  dlHint: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
  },
});

